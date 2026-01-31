import os
import json
import tempfile
import shutil
import uuid
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from bot_multidelivery.config import BotConfig
from bot_multidelivery.session import session_manager, Romaneio, Route
from bot_multidelivery.persistence import data_store
from bot_multidelivery.services.deliverer_service import DelivererService
from bot_multidelivery.services.route_analyzer import RouteAnalyzer
from bot_multidelivery.parsers.shopee_parser import ShopeeRomaneioParser
from bot_multidelivery.clustering import DeliveryPoint, TerritoryDivider
from bot_multidelivery.services.map_generator import MapGenerator
from bot_multidelivery.colors import get_color_for_index
from bot_multidelivery.services import deliverer_service, geocoding_service, predictor, financial_service
from bot_multidelivery.models_transfer import TransferRequest, TransferStatus, SeparationSession

router = APIRouter(prefix="/api")

MAPS_DIR = os.path.join("data", "maps")
os.makedirs(MAPS_DIR, exist_ok=True)

# Armazenamento em memória (na produção usar Redis ou banco)
active_transfer_requests: Dict[str, TransferRequest] = {}
active_separation_sessions: Dict[str, SeparationSession] = {}

class DelivererInput(BaseModel):
    name: str
    telegram_id: int
    is_partner: bool = False

class StartSessionInput(BaseModel):
    date: Optional[str] = None
    period: str = "manhã"
    base_address: Optional[str] = None
    base_lat: Optional[float] = None
    base_lng: Optional[float] = None

class RouteValueInput(BaseModel):
    value: float
    session_id: Optional[str] = None

class OptimizeInput(BaseModel):
    num_deliverers: int
    session_id: Optional[str] = None

class AssignRouteInput(BaseModel):
    route_id: str
    deliverer_id: int
    session_id: Optional[str] = None

class FinalizeSessionInput(BaseModel):
    session_id: Optional[str] = None
    revenue: Optional[float] = None
    extra_revenue: float = 0.0
    other_costs: float = 0.0
    expenses: Optional[List[Dict[str, object]]] = None

class SeparationScanInput(BaseModel):
    barcode: str
    session_id: Optional[str] = None

class TransferRequestInput(BaseModel):
    package_ids: List[str]
    from_deliverer_id: int
    to_deliverer_id: int
    reason: str

class TransferApprovalInput(BaseModel):
    transfer_id: str
    approved: bool
    admin_id: int
    admin_name: str
    rejection_reason: Optional[str] = None

def _get_bot() -> Optional[Bot]:
    if not BotConfig.TELEGRAM_TOKEN:
        return None
    return Bot(token=BotConfig.TELEGRAM_TOKEN)

def _safe_map_path(filename: str) -> str:
    safe_name = os.path.basename(filename)
    return os.path.join(MAPS_DIR, safe_name)

@router.get("/admin/team")
async def get_team():
    """Lista todos os entregadores cadastrados"""
    deliverers = data_store.load_deliverers()
    return [
        {
            "id": d.telegram_id,
            "name": d.name,
            "is_partner": d.is_partner,
            "deliveries": d.total_deliveries,
            "earnings": d.total_earnings
        }
        for d in deliverers
    ]

@router.post("/admin/team")
async def add_member(data: DelivererInput):
    """Adiciona novo membro à equipe"""
    try:
        DelivererService.add_deliverer(
            telegram_id=data.telegram_id,
            name=data.name,
            is_partner=data.is_partner
        )
        return {"status": "success", "message": f"{data.name} adicionado!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/admin/team/{user_id}")
async def remove_member(user_id: int):
    """Remove membro permanentemente utilizando a persistência"""
    try:
        # Usa o método robusto que criamos no persistence.py
        data_store.delete_deliverer(user_id)
        return {"status": "success", "deleted_id": user_id}
    except Exception as e:
        print(f"Erro ao deletar: {e}")
        # Mesmo se der erro, vamos retornar sucesso pro frontend atualizar a lista
        # (às vezes foi deletado mas deu erro de relacionamento)
        return {"status": "success", "warning": str(e)}

@router.get("/auth/me")
async def get_me(user_id: int):
    """Retorna papel do usuário e dados básicos"""
    
    # Check Admin
    if user_id == BotConfig.ADMIN_TELEGRAM_ID:
        return {
            "id": user_id, 
            "role": "admin", 
            "name": "Administrador",
            "access": "full"
        }
    
    # Check Partner (Tentativa de buscar no config legado ou DB)
    # Como BotConfig.get_partner_by_id é usado no bot, vamos usar ele.
    # Mas precisamos garantir que ele existe. Se não, implementamos aqui.
    
    partner = None
    if hasattr(BotConfig, 'get_partner_by_id'):
        partner = BotConfig.get_partner_by_id(user_id)
    else:
        # Fallback manual se o método não existir estático
        for p in BotConfig.DELIVERY_PARTNERS:
            if p.telegram_id == user_id:
                partner = p
                break
                
    if partner:
         return {
             "id": user_id, 
             "role": "deliverer", 
             "name": partner.name,
             "is_partner": partner.is_partner,
             "capacity": getattr(partner, 'max_capacity', 0)
         }
         
    return {"id": user_id, "role": "guest", "name": "Visitante"}




def get_current_week_financials():
    """Lê os relatórios financeiros da semana atual e soma a sessão ativa (projeção)"""
    from datetime import datetime, timedelta
    
    # Define início da semana (Segunda-feira)
    today = datetime.now()
    start_week = today - timedelta(days=today.weekday())
    # Fim da semana (Domingo)
    end_week = start_week + timedelta(days=6)
    
    # Datas para gráfico/lista
    week_dates = [(start_week + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
    
    total_revenue = 0.0
    total_costs = 0.0
    total_profit = 0.0
    deliverer_earnings = {}
    
    # 1. Tentar buscar dados consolidados do Banco de Dados
    try:
        if data_store.using_database:
            from bot_multidelivery.database import db_manager, DailyFinancialReportDB
            with db_manager.get_session() as session:
                reports = session.query(DailyFinancialReportDB).filter(
                    DailyFinancialReportDB.date >= start_week.strftime('%Y-%m-%d'),
                    DailyFinancialReportDB.date <= end_week.strftime('%Y-%m-%d')
                ).all()
                
                for r in reports:
                    total_revenue += r.revenue
                    total_costs += r.delivery_costs + r.other_costs
                    total_profit += r.net_profit
                    
                    if r.deliverer_breakdown:
                        for name, value in r.deliverer_breakdown.items():
                            deliverer_earnings[name] = deliverer_earnings.get(name, 0) + value
        else:
            # Fallback para JSON (se o user não tiver migrado totalmente)
            import glob
            base_path = "data/financial/daily"
            
            for date_str in week_dates:
                file_path = f"{base_path}/{date_str}.json"
                if os.path.exists(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            total_revenue += data.get('revenue', 0)
                            total_costs += data.get('delivery_costs', 0) + data.get('other_costs', 0)
                            total_profit += data.get('net_profit', 0)
                            
                            # Soma ganhos individuais
                            breakdown = data.get('deliverer_breakdown', {})
                            for name, value in breakdown.items():
                                deliverer_earnings[name] = deliverer_earnings.get(name, 0) + value
                    except Exception:
                        continue
                        
    except Exception as e:
        print(f"Erro ao buscar histórico financeiro: {e}")

    # 2. Somar dados da SESSÃO ATIVA (Em tempo real)
    # Isso resolve o problema de "não vejo saldo" enquanto o dia não fecha
    try:
        active_session = session_manager.get_current_session()
        if active_session:
            # Verifica se a sessão é desta semana
            try:
                s_date = datetime.strptime(active_session.date, '%Y-%m-%d')
                if start_week <= s_date <= end_week:
                    # PROJEÇÃO SIMPLIFICADA (Valores default de mercado se não configurado)
                    AVG_REVENUE_PER_PKG = 8.00 
                    AVG_COST_PER_PKG = 4.50 
                    
                    session_revenue = active_session.total_delivered * AVG_REVENUE_PER_PKG
                    session_cost = 0.0
                    
                    for route in active_session.routes:
                        if route.assigned_to_name:
                            # Custo do entregador (apenas pacotes entregues contam)
                            route_cost = route.delivered_count * AVG_COST_PER_PKG
                            session_cost += route_cost
                            
                            # Adiciona ao breakdown
                            deliverer_earnings[route.assigned_to_name] = deliverer_earnings.get(route.assigned_to_name, 0) + route_cost
                    
                    # Atualiza totais
                    total_revenue += session_revenue
                    total_costs += session_cost
                    total_profit += (session_revenue - session_cost)
                    
            except ValueError:
                pass # Data inválida na sessão, ignora
    except Exception as e:
        print(f"Erro ao processar sessão ativa no financeiro: {e}")

    return {
        "dates": week_dates,
        "company": {
            "revenue": total_revenue,
            "costs": total_costs,
            "profit": total_profit
        },
        "deliverers": deliverer_earnings
    }

@router.get("/financial/balance")
async def get_financial_balance(user_id: int):
    """
    Retorna dados financeiros baseados no papel, calculados
    somando os JSONs da semana atual.
    """
    # 1. Identifica usuário
    user_info = await get_me(user_id)
    role = user_info.get('role')
    is_partner = user_info.get('is_partner', False)
    name = user_info.get('name')
    
    # 2. Calcula dados da semana
    week_data = get_current_week_financials()
    
    # 3. Resposta para Entregador Comum -> Só vê seus ganhos
    if role == 'deliverer' and not is_partner:
        my_balance = week_data['deliverers'].get(name, 0.0)
        return {
            "view": "personal",
            "period": "Semana Atual",
            "balance": my_balance,
            "currency": "BRL"
        }
        
    # 4. Resposta para Sócio ou Admin -> Vê tudo
    if role == 'admin' or (role == 'deliverer' and is_partner):
        return {
            "view": "company",
            "period": "Semana Atual",
            "company_stats": week_data['company'],
            "deliverers_stats": week_data['deliverers']
        }
        
    raise HTTPException(status_code=403, detail="Acesso negado")

@router.get("/deliverer/route")
async def get_my_route(user_id: int):
    """Retorna rota ativa do entregador"""
    route = session_manager.get_route_for_deliverer(user_id)
    
    if not route:
        return {"has_route": False, "message": "Nenhuma rota atribuída hoje."}
        
    stops_data = []
    
    # Processa e valida paradas
    if route.optimized_order:
        for idx, point in enumerate(route.optimized_order):
            pkg_id = getattr(point, "package_id", point.address)
            is_done = pkg_id in route.delivered_packages
            packages_info = [
                {"id": pkg_id, "status": "completed" if is_done else "pending"}
            ]
            
            stops_data.append({
                "id": idx + 1,
                "lat": point.lat,
                "lng": point.lng,
                "address": point.address,
                "packages": packages_info,
                "status": "completed" if is_done else "pending"
            })
            
    return {
        "has_route": True,
        "route_id": route.id,
        "summary": {
            "total_packages": route.total_packages,
            "total_stops": len(stops_data),
            "distance_km": route.total_distance_km,
            "estimated_time_min": getattr(route, 'total_time_minutes', 0)
        },
        "stops": stops_data
    }

@router.get("/admin/stats")
async def get_stats():
    """Retorna stats rápidos para dashboard"""
    session = session_manager.get_current_session()
    
    if not session:
        return {
            "active_session": False,
            "revenue": 0.0,
            "packages_total": 0,
            "deliverers_active": 0
        }
        
    return {
        "active_session": True,
        "session_name": session.session_name,
        "revenue": 0.0, # Placeholder
        "packages_total": session.total_packages,
        "delivered": session.total_delivered,
        "pending": session.total_pending,
        "routes_count": len(session.routes)
    }

@router.post("/session/start")
async def start_session(data: StartSessionInput):
    """Inicia (ou reutiliza) uma sessão ativa"""
    date_str = data.date or datetime.now().strftime('%Y-%m-%d')
    session = session_manager.get_current_session()

    if not session or session.is_finalized:
        session = session_manager.create_new_session(date_str, data.period)

    if data.base_address and data.base_lat is not None and data.base_lng is not None:
        session_manager.set_base_location(data.base_address, data.base_lat, data.base_lng, session.session_id)

    return {
        "session_id": session.session_id,
        "session_name": session.session_name,
        "date": session.date,
        "period": session.period,
        "base_address": session.base_address,
        "total_packages": session.total_packages,
        "routes_count": len(session.routes)
    }

@router.post("/session/route-value")
async def set_route_value(data: RouteValueInput):
    """Salva o valor total da rota para uso no fechamento financeiro"""
    session = session_manager.get_session(data.session_id) if data.session_id else session_manager.get_current_session()
    if not session:
        raise HTTPException(status_code=404, detail="Nenhuma sessão ativa")

    setattr(session, "route_value", float(data.value))
    session_manager._auto_save(session)
    return {"status": "ok", "route_value": float(data.value)}

def _process_romaneio_import(file: UploadFile, session_id: Optional[str]) -> Dict[str, object]:
    """Processa importação de romaneio e retorna payload final"""
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Arquivo deve ser Excel (.xlsx)")

    session = session_manager.get_session(session_id) if session_id else session_manager.get_current_session()
    if not session:
        session = session_manager.create_new_session(datetime.now().strftime('%Y-%m-%d'), 'manhã')

    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        deliveries = ShopeeRomaneioParser.parse(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar Excel: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    if not deliveries:
        raise HTTPException(status_code=400, detail="Nenhuma entrega encontrada no arquivo.")

    points: List[DeliveryPoint] = []
    rom_id = str(uuid.uuid4())[:8]

    for d in deliveries:
        address = f"{d.address}, {d.bairro}, {d.city}".strip(', ')
        lat = d.latitude
        lon = d.longitude

        if lat is None or lon is None:
            lat, lon = geocoding_service.geocode(address)

        points.append(DeliveryPoint(
            address=address,
            lat=lat,
            lng=lon,
            romaneio_id=rom_id,
            package_id=address,
            priority="normal"
        ))

    romaneio = Romaneio(
        id=rom_id,
        uploaded_at=datetime.now(),
        points=points
    )

    session_manager.add_romaneio(romaneio, session.session_id)
    session = session_manager.get_session(session.session_id)

    all_points: List[DeliveryPoint] = []
    for rom in session.romaneios:
        all_points.extend(rom.points)

    map_url = None
    if all_points:
        # ===== AGRUPA POR ENDEREÇO PARA MANTER SEQUÊNCIA CORRETA =====
        stops_by_addr = {}
        for p in all_points:
            addr_key = p.address.lower().strip()
            if addr_key not in stops_by_addr:
                stops_by_addr[addr_key] = {'lat': p.lat, 'lng': p.lng, 'address': p.address, 'count': 0}
            stops_by_addr[addr_key]['count'] += 1
        minimap_stops = [(d['lat'], d['lng'], d['address'], d['count'], 'pending') for d in stops_by_addr.values()]
        base_loc = (session.base_lat, session.base_lng, session.base_address) if session.base_lat and session.base_lng else None
        html = MapGenerator.generate_interactive_map(
            stops=minimap_stops,
            entregador_nome=f"Minimapa Completo - {session.total_packages} pacotes",
            current_stop=-1,
            total_packages=session.total_packages,
            total_distance_km=0,
            total_time_min=0,
            base_location=base_loc
        )
        filename = f"minimap_session_{session.session_id}.html"
        MapGenerator.save_map(html, _safe_map_path(filename))
        map_url = f"/api/maps/{filename}"

    return {
        "status": "ok",
        "session_id": session.session_id,
        "romaneio_id": romaneio.id,
        "packages": len(points),
        "total_packages": session.total_packages,
        "minimap_url": map_url
    }

@router.post("/session/romaneio/import")
async def import_romaneio(file: UploadFile = File(...), session_id: Optional[str] = Form(None)):
    """Importa romaneio Shopee e gera minimapa completo"""
    return _process_romaneio_import(file, session_id)

@router.post("/romaneio/import")
async def import_romaneio_alt(file: UploadFile = File(...), session_id: Optional[str] = Form(None)):
    """Endpoint alternativo de importação (evita conflitos 405)"""
    return _process_romaneio_import(file, session_id)

@router.get("/session/report")
async def get_session_report(session_id: Optional[str] = None):
    """Gera relatório da sessão atual (todos os romaneios) com minimapa"""
    session = session_manager.get_session(session_id) if session_id else session_manager.get_current_session()
    if not session or not session.romaneios:
        raise HTTPException(status_code=400, detail="Nenhum romaneio importado na sessão.")

    analyzer_input = []
    for rom in session.romaneios:
        for p in rom.points:
            analyzer_input.append({
                'address': p.address,
                'bairro': '',
                'lat': p.lat,
                'lon': p.lng,
                'stop': p.address
            })

    analyzer = RouteAnalyzer()
    route_value = getattr(session, "route_value", 0.0)
    result = analyzer.analyze_route(analyzer_input, route_value=route_value)

    map_url = None
    base_loc = (session.base_lat, session.base_lng, session.base_address) if session.base_lat and session.base_lng else None
    
    # ===== AGRUPA POR ENDEREÇO PARA MANTER SEQUÊNCIA CORRETA =====
    stops_by_addr = {}
    for d in analyzer_input:
        if d.get('lat') and d.get('lon'):
            addr_key = d['address'].lower().strip()
            if addr_key not in stops_by_addr:
                stops_by_addr[addr_key] = {'lat': d['lat'], 'lng': d['lon'], 'address': d['address'], 'count': 0}
            stops_by_addr[addr_key]['count'] += 1
    stops = [(d['lat'], d['lng'], d['address'], d['count'], 'pending') for d in stops_by_addr.values()]
    
    if stops:
        html = MapGenerator.generate_interactive_map(
            stops=stops,
            entregador_nome=f"Minimapa Sessão - {len(stops)} pacotes",
            current_stop=-1,
            total_packages=len(stops),
            total_distance_km=0,
            total_time_min=0,
            base_location=base_loc
        )
        filename = f"minimap_session_report_{session.session_id}.html"
        MapGenerator.save_map(html, _safe_map_path(filename))
        map_url = f"/api/maps/{filename}"

    from dataclasses import asdict
    analysis_dict = asdict(result)
    analysis_dict['formatted'] = {
        'header': {
            'value': f"💰 R$ {result.route_value:.2f}" if result.route_value > 0 else "Sem valor informado",
            'type': result.route_type,
            'score': result.overall_score,
            'recommendation': result.recommendation
        },
        'earnings': {
            'hourly': f"R$ {result.hourly_earnings:.2f}/hora" if result.hourly_earnings > 0 else "N/A",
            'package': f"R$ {result.package_earnings:.2f}/pacote" if result.package_earnings > 0 else "N/A",
            'time_estimate': f"{result.estimated_time_minutes:.0f} min ({result.estimated_time_minutes/60:.1f}h)"
        },
        'top_drops': [
            {'street': street, 'count': count, 'emoji': '🔥' if i == 0 else '✨' if i == 1 else '⭐'}
            for i, (street, count) in enumerate(result.top_drops or [])
        ],
        'profile': {
            'commercial': result.commercial_count,
            'vertical': result.vertical_count,
            'residential': result.total_packages - result.commercial_count - result.vertical_count,
            'type_label': result.route_type
        },
        'concentration': {
            'density': f"{result.density_score:.1f} pacotes/km²",
            'area': f"{result.area_coverage_km2:.2f} km²",
            'neighborhoods': result.unique_neighborhoods,
            'score': f"{result.concentration_score:.1f}/10"
        }
    }
    if map_url:
        analysis_dict['minimap_url'] = map_url

    return analysis_dict

@router.post("/routes/optimize")
async def optimize_routes(data: OptimizeInput):
    """Divide e otimiza a rota pela quantidade de entregadores"""
    session = session_manager.get_session(data.session_id) if data.session_id else session_manager.get_current_session()
    if not session or not session.romaneios:
        raise HTTPException(status_code=400, detail="Nenhum romaneio importado na sessão.")

    all_points: List[DeliveryPoint] = []
    for rom in session.romaneios:
        all_points.extend(rom.points)

    divider = TerritoryDivider(session.base_lat, session.base_lng)
    clusters = divider.divide_into_clusters(all_points, k=data.num_deliverers)

    routes: List[Route] = []
    for idx, cluster in enumerate(clusters):
        optimized = divider.optimize_cluster_route(cluster)
        color = get_color_for_index(idx)
        route = Route(
            id=f"ROTA_{cluster.id + 1}",
            cluster=cluster,
            color=color,
            optimized_order=optimized
        )
        routes.append(route)

    session_manager.set_routes(routes, session.session_id)

    preview = []
    base_loc = (session.base_lat, session.base_lng, session.base_address) if session.base_lat and session.base_lng else None
    entregadores_lista = [{'name': d.name, 'id': str(d.telegram_id)} for d in deliverer_service.get_all_deliverers()]

    for route in routes:
        # Agrupa por endereço para evitar paradas duplicadas
        stops_by_addr = {}
        for p in route.optimized_order:
            if p.lat is None or p.lng is None:
                continue
            addr_key = p.address.lower().strip()
            if addr_key not in stops_by_addr:
                stops_by_addr[addr_key] = {
                    'lat': p.lat,
                    'lng': p.lng,
                    'address': p.address,
                    'count': 0
                }
            stops_by_addr[addr_key]['count'] += 1

        stops_data = [
            (d['lat'], d['lng'], d['address'], d['count'], 'pending')
            for d in stops_by_addr.values()
        ]
        total_stops = len(stops_data)
        eta_minutes = max(10, route.total_distance_km / 25 * 60 + total_stops * 3)
        html = MapGenerator.generate_interactive_map(
            stops=stops_data,
            entregador_nome=route.id,
            current_stop=0,
            total_packages=route.total_packages,
            total_distance_km=route.total_distance_km,
            total_time_min=eta_minutes,
            base_location=base_loc,
            entregadores_lista=entregadores_lista,
            session_id=session.session_id
        )
        filename = f"route_{session.session_id}_{route.id}.html"
        MapGenerator.save_map(html, _safe_map_path(filename))
        route.map_file = filename
        preview.append({
            "route_id": route.id,
            "color": route.color,
            "total_packages": route.total_packages,
            "total_stops": total_stops,
            "map_url": f"/api/maps/{filename}"
        })

    session_manager._auto_save(session)

    return {
        "status": "ok",
        "session_id": session.session_id,
        "routes": preview
    }

@router.post("/routes/assign")
async def assign_route(data: AssignRouteInput):
    """Atribui um entregador a uma rota"""
    session = session_manager.get_session(data.session_id) if data.session_id else session_manager.get_current_session()
    if not session:
        raise HTTPException(status_code=404, detail="Nenhuma sessão ativa")

    target = next((r for r in session.routes if r.id == data.route_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Rota não encontrada")

    deliverer = deliverer_service.get_deliverer(data.deliverer_id)
    if not deliverer:
        raise HTTPException(status_code=404, detail="Entregador não encontrado")

    target.assigned_to_telegram_id = deliverer.telegram_id
    target.assigned_to_name = deliverer.name
    session_manager.set_routes(session.routes, session.session_id)

    return {"status": "ok", "route_id": target.id, "deliverer": deliverer.name}

@router.post("/routes/send")
async def send_routes(session_id: Optional[str] = Form(None)):
    """Envia as rotas atribuídas para cada entregador via Telegram"""
    session = session_manager.get_session(session_id) if session_id else session_manager.get_current_session()
    if not session:
        raise HTTPException(status_code=404, detail="Nenhuma sessão ativa")

    if not session.routes or any(not r.assigned_to_telegram_id for r in session.routes):
        raise HTTPException(status_code=400, detail="Atribua um entregador para cada rota antes de iniciar.")

    if not getattr(session, "separation_completed", False):
        raise HTTPException(status_code=400, detail="Finalize o modo separação antes de iniciar a rota.")

    bot = _get_bot()
    if not bot:
        raise HTTPException(status_code=500, detail="Token do bot não configurado")

    sent = []
    base_loc = (session.base_lat, session.base_lng, session.base_address) if session.base_lat and session.base_lng else None
    photo_path = os.path.join('bot_multidelivery', 'static', 'logoMiniApp.jpg')

    for route in session.routes:
        if not route.assigned_to_telegram_id:
            continue

        deliverer = deliverer_service.get_deliverer(route.assigned_to_telegram_id)
        route_url = f"{BotConfig.WEBAPP_URL}/?tab=routes"
        admin_url = f"{BotConfig.WEBAPP_URL}/?tab=dashboard"

        buttons = [[InlineKeyboardButton("🗺️ Abrir Mapa", url=route_url)]]
        if deliverer and deliverer.is_partner:
            buttons[0].append(InlineKeyboardButton("🧠 Painel Admin", url=admin_url))

        caption = (
            f"🚚 Rota atribuída: {route.id}\n"
            f"Pacotes: {route.total_packages}\n"
            f"Cor: {route.color}\n"
            f"Clique no botão abaixo para abrir sua rota no MiniApp."
        )

        if os.path.exists(photo_path):
            with open(photo_path, 'rb') as photo:
                await bot.send_photo(
                    chat_id=route.assigned_to_telegram_id,
                    photo=photo,
                    caption=caption,
                    reply_markup=InlineKeyboardMarkup(buttons)
                )
        else:
            await bot.send_message(
                chat_id=route.assigned_to_telegram_id,
                text=caption,
                reply_markup=InlineKeyboardMarkup(buttons)
            )

        sent.append(route.id)

    setattr(session, "started_at", datetime.now().isoformat())
    session_manager._auto_save(session)
    return {"status": "ok", "sent_routes": sent}

@router.get("/routes/combined-map")
async def get_combined_map(session_id: Optional[str] = None):
    """Gera mapa completo com cores por entregador"""
    session = session_manager.get_session(session_id) if session_id else session_manager.get_current_session()
    if not session or not session.routes:
        raise HTTPException(status_code=404, detail="Nenhuma rota disponível")

    base_loc = (session.base_lat, session.base_lng, session.base_address) if session.base_lat and session.base_lng else None

    html = MapGenerator.generate_multi_route_map(
        routes=session.routes,
        base_location=base_loc,
        session_id=session.session_id
    )
    filename = f"combined_{session.session_id}.html"
    MapGenerator.save_map(html, _safe_map_path(filename))

    return {"status": "ok", "map_url": f"/api/maps/{filename}"}

@router.post("/delivery/update")
async def update_delivery_status(payload: dict):
    """Atualiza status de entrega a partir do mapa"""
    entregador_id = payload.get('entregador_id')
    session_id = payload.get('session_id')
    package_address = payload.get('address')
    new_status = payload.get('status')

    if not all([entregador_id, new_status]):
        raise HTTPException(status_code=400, detail="Dados incompletos")

    try:
        entregador_id = int(entregador_id)
    except (ValueError, TypeError):
        pass

    delivery_success = (new_status == 'completed')
    if deliverer_service:
        deliverer_service.update_stats_after_delivery(
            telegram_id=entregador_id,
            delivery_success=delivery_success,
            delivery_time_minutes=5
        )

    if new_status == 'completed' and package_address:
        session_manager.mark_package_delivered(entregador_id, package_address, session_id)

    session = session_manager.get_session(session_id) if session_id else session_manager.get_current_session()
    if session and session.total_pending == 0:
        if not getattr(session, "all_delivered_notified", False):
            bot = _get_bot()
            if bot:
                close_url = f"{BotConfig.WEBAPP_URL}/?tab=financial"
                keyboard = InlineKeyboardMarkup([
                    [InlineKeyboardButton("✅ Fechar Dia", url=close_url)]
                ])
                await bot.send_message(
                    chat_id=BotConfig.ADMIN_TELEGRAM_ID,
                    text=f"✅ Sessão finalizada! Todas as entregas concluídas em {session.session_name}.\nClique abaixo para fechar o dia.",
                    reply_markup=keyboard
                )
            setattr(session, "all_delivered_notified", True)
            session_manager._auto_save(session)

    return {"success": True}

@router.post("/session/finalize")
async def finalize_session(data: FinalizeSessionInput):
    """Fecha sessão e salva financeiro"""
    session = session_manager.get_session(data.session_id) if data.session_id else session_manager.get_current_session()
    if not session:
        raise HTTPException(status_code=404, detail="Nenhuma sessão ativa")

    if session.total_pending > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Ainda existem {session.total_pending} pacotes pendentes. Finalize todas as entregas antes de fechar a rota."
        )

    route_value = getattr(session, "route_value", None)
    revenue = data.revenue if data.revenue is not None else (route_value or 0.0)
    if data.extra_revenue:
        revenue += float(data.extra_revenue)

    deliverer_costs: Dict[str, float] = {}
    for route in session.routes:
        if not route.assigned_to_name or not route.assigned_to_telegram_id:
            continue
        d = deliverer_service.get_deliverer(route.assigned_to_telegram_id)
        cost_per_pkg = d.cost_per_package if d else 1.0
        qty = route.delivered_count if route.delivered_count > 0 else route.total_packages
        deliverer_costs[route.assigned_to_name] = deliverer_costs.get(route.assigned_to_name, 0) + (qty * cost_per_pkg)

    report = financial_service.close_day(
        date=datetime.strptime(session.date, '%Y-%m-%d') if session.date else datetime.now(),
        revenue=revenue,
        deliverer_costs=deliverer_costs,
        other_costs=data.other_costs,
        total_packages=session.total_packages,
        total_deliveries=session.total_delivered,
        expenses=data.expenses or []
    )

    session_manager.finalize_session(session.session_id)

    return {"status": "ok", "report": report.to_dict()}

@router.get("/maps/{filename}")
async def get_map_file(filename: str):
    """Serve mapas HTML gerados"""
    path = _safe_map_path(filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Mapa não encontrado")
    return FileResponse(path, media_type='text/html')

@router.post("/route/analyze")
async def analyze_route_file(file: UploadFile = File(...), route_value: float = Form(0.0)):
    """
    Analisa arquivo de romaneio (XLSX Shopee) e retorna estatísticas de IA.
    Endpoint portado do Bot Telegram para a Web.
    """
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Arquivo deve ser Excel (.xlsx)")

    try:
        # Salva arquivo temporário
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
            
        try:
            # Parse usando lógica existente
            # A classe ShopeeRomaneioParser retorna List[ShopeeDelivery]
            deliveries = ShopeeRomaneioParser.parse(tmp_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao processar Excel: {str(e)}")
        finally:
            # Limpa temp
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

        if not deliveries:
             raise HTTPException(status_code=400, detail="Nenhuma entrega encontrada no arquivo.")

        # Converte objetos ShopeeDelivery -> Dict para o RouteAnalyzer
        # O RouteAnalyzer espera chaves: address, bairro, lat, lon
        analyzer_input = []
        for d in deliveries:
            analyzer_input.append({
                'address': d.address,
                'bairro': d.bairro,
                'lat': d.latitude,
                'lon': d.longitude,
                # Campos extras que podem ajudar
                'stop': d.stop
            })
            
        # Executa Análise
        analyzer = RouteAnalyzer()
        result = analyzer.analyze_route(analyzer_input, route_value=route_value)

        # Gera minimapa da análise (todos endereços)
        map_url = None
        base_loc = None
        session = session_manager.get_current_session()
        if session and session.base_lat and session.base_lng:
            base_loc = (session.base_lat, session.base_lng, session.base_address)

        if analyzer_input:
            stops = [(d['lat'], d['lon'], d['address'], 1, 'pending') for d in analyzer_input if d.get('lat') and d.get('lon')]
            if stops:
                html = MapGenerator.generate_interactive_map(
                    stops=stops,
                    entregador_nome=f"Minimapa Análise - {len(stops)} pacotes",
                    current_stop=-1,
                    total_packages=len(stops),
                    total_distance_km=0,
                    total_time_min=0,
                    base_location=base_loc
                )
                filename = f"minimap_analysis_{uuid.uuid4().hex[:8]}.html"
                MapGenerator.save_map(html, _safe_map_path(filename))
                map_url = f"/api/maps/{filename}"
        
        # Formata resultado para output rico
        from dataclasses import asdict
        analysis_dict = asdict(result)
        
        # Enriquece com formatações para o frontend
        analysis_dict['formatted'] = {
            'header': {
                'value': f"💰 R$ {result.route_value:.2f}" if result.route_value > 0 else "Sem valor informado",
                'type': result.route_type,
                'score': result.overall_score,
                'recommendation': result.recommendation
            },
            'earnings': {
                'hourly': f"R$ {result.hourly_earnings:.2f}/hora" if result.hourly_earnings > 0 else "N/A",
                'package': f"R$ {result.package_earnings:.2f}/pacote" if result.package_earnings > 0 else "N/A",
                'time_estimate': f"{result.estimated_time_minutes:.0f} min ({result.estimated_time_minutes/60:.1f}h)"
            },
            'top_drops': [
                {'street': street, 'count': count, 'emoji': '🔥' if i == 0 else '✨' if i == 1 else '⭐'}
                for i, (street, count) in enumerate(result.top_drops or [])
            ],
            'profile': {
                'commercial': result.commercial_count,
                'vertical': result.vertical_count,
                'residential': result.total_packages - result.commercial_count - result.vertical_count,
                'type_label': result.route_type
            },
            'concentration': {
                'density': f"{result.density_score:.1f} pacotes/km²",
                'area': f"{result.area_coverage_km2:.2f} km²",
                'neighborhoods': result.unique_neighborhoods,
                'score': f"{result.concentration_score:.1f}/10"
            }
        }
        
        if map_url:
            analysis_dict['minimap_url'] = map_url

        return analysis_dict

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro crítico na análise de rota: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@router.post("/routes/analyze-addresses")
async def analyze_addresses(
    addresses_text: str = Form(...),
    route_value: float = Form(0.0)
):
    """
    Analisa rota baseada APENAS em lista de endereços (sem arquivo Excel)
    ⚡ RÁPIDO: Retorna análise instantânea SEM geocodificação
    
    Aceita:
    - Endereços colados (um por linha)
    - Valor total da rota
    
    Retorna análise completa com tipo de rota, ganho por hora, top drops
    """
    if not addresses_text.strip():
        raise HTTPException(status_code=400, detail="Nenhum endereço informado")
    
    try:
        # Usa o novo método do RouteAnalyzer (RÁPIDO - sem geo)
        analyzer = RouteAnalyzer()
        result = analyzer.analyze_addresses_from_text(
            addresses_text=addresses_text,
            route_value=route_value,
            base_location=None
        )
        
        # Formata para output rico
        analysis_dict = {
            # Header com valores em destaque
            'header': {
                '💰 VALOR': f"R$ {result.route_value:.2f}" if result.route_value > 0 else "N/A",
                '⭐ TIPO': result.route_type,
                '📊 SCORE': f"{result.overall_score:.1f}/10",
                '✅ RECOMENDAÇÃO': result.recommendation,
                '⏱️ TEMPO EST': f"{result.estimated_time_minutes:.0f} min"
            },
            
            # Financeiro em destaque
            'financial': {
                'hourly': f"R$ {result.hourly_earnings:.2f}/hora" if result.hourly_earnings > 0 else "N/A",
                'per_package': f"R$ {result.package_earnings:.2f}/pkg" if result.package_earnings > 0 else "N/A"
            },
            
            # Perfil da Rota
            'profile': {
                'type': result.route_type,
                'commercial_count': result.commercial_count,
                'commercial_pct': f"{result.commercial_percentage:.1f}%",
                'vertical_count': result.vertical_count,
                'total_packages': result.total_packages,
                'unique_stops': result.total_stops
            },
            
            # Top 3 Drops (ruas com maior concentração)
            'top_drops': [
                {
                    'rank': i + 1,
                    'street': street,
                    'count': count,
                    'percentage': f"{(count/result.total_packages)*100:.1f}%",
                    'emoji': '🔥' if i == 0 else '🎯' if i == 1 else '⭐'
                }
                for i, (street, count) in enumerate(result.top_drops[:3])
            ],
            
            # Análise Qualitativa
            'analysis': {
                'pros': result.pros,
                'cons': result.cons,
            },
            
            # IA Comment (o mais importante!)
            'ai_comment': result.ai_comment,
            
            # Métricas Complementares
            'metrics': {
                'density': f"{result.density_score:.0f} pkg/km²",
                'concentration_score': f"{result.concentration_score:.1f}/10",
                'total_distance': f"{result.total_distance_km:.1f} km",
                'area_coverage': f"{result.area_coverage_km2:.2f} km²"
            }
        }
        
        return analysis_dict

    except Exception as e:
        print(f"Erro ao analisar endereços: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro na análise: {str(e)}")


@router.post("/routes/generate-map")
async def generate_map_for_addresses(
    addresses_text: str = Form(...)
):
    """
    🚀 MAPA ULTRA-RÁPIDO com geocoding paralelo
    - Agregação por endereço (sem duplicatas)
    - Paralização 8x (8 req simultâneas)
    - Cache agressivo
    - Fallback instantâneo
    """
    import random
    
    if not addresses_text.strip():
        raise HTTPException(status_code=400, detail="Nenhum endereço informado")
    
    try:
        from bot_multidelivery.services.geocoding_service import GeocodingService
        
        lines = [l.strip() for l in addresses_text.strip().split('\n') if l.strip()]
        total_packages = len(lines)
        
        # PASSO 1: Agrupa endereços únicos (remove duplicatas)
        unique_addresses = {}
        for addr in lines:
            addr_key = addr.lower().strip()
            if addr_key not in unique_addresses:
                unique_addresses[addr_key] = addr
        
        # PASSO 2: Geocodifica em PARALELO (8 simultâneas)
        geocoder = GeocodingService()
        stops_with_coords = []
        
        def geocode_single(address):
            """Geocodifica um endereço com fallback"""
            try:
                coords = geocoder.geocode(address)
                if coords and isinstance(coords, tuple) and len(coords) == 2:
                    return {
                        'lat': coords[0],
                        'lng': coords[1],
                        'address': address,
                        'success': True
                    }
            except Exception as e:
                logging.warning(f"Geocoding falhou para {address[:50]}: {e}")
            
            # FALLBACK: Coordenadas estimadas RJ + hash variation
            import hashlib
            seed = int(hashlib.md5(address.encode()).hexdigest()[:8], 16)
            random.seed(seed)
            return {
                'lat': -22.9570 + random.uniform(-0.025, 0.025),
                'lng': -43.1910 + random.uniform(-0.025, 0.025),
                'address': address,
                'success': False
            }
        
        # Executa em paralelo com ThreadPoolExecutor (8 threads)
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(geocode_single, unique_addresses.values()))
        
        stops_with_coords = [(
            r['lat'],
            r['lng'],
            r['address'],
            1,
            'pending'
        ) for r in results]
        # Executa em paralelo com ThreadPoolExecutor (8 threads)
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(geocode_single, unique_addresses.values()))
        
        stops_with_coords = [(
            r['lat'],
            r['lng'],
            r['address'],
            1,
            'pending'
        ) for r in results]
        
        # PASSO 3: Gera mapa com markers agregados
        map_html = MapGenerator.generate_interactive_map(
            stops=stops_with_coords,
            entregador_nome=f"🗺️ Minimapa - {len(unique_addresses)} paradas",
            current_stop=-1,
            total_packages=total_packages,
            total_distance_km=0,
            total_time_min=0,
            base_location=None
        )
        
        # Salva em temp e retorna
        import tempfile
        import hashlib
        
        map_hash = hashlib.md5(addresses_text.encode()).hexdigest()[:8]
        temp_dir = Path("data/temp_maps")
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        map_file = temp_dir / f"minimap_{map_hash}.html"
        with open(map_file, 'w', encoding='utf-8') as f:
            f.write(map_html)
        
        return {
            "status": "success",
            "map_url": f"/static/temp_maps/minimap_{map_hash}.html",
            "geocoded_count": sum(1 for r in results if r['success']),
            "total_addresses": len(unique_addresses),
            "processing_time_ms": "paralelo 8x"
        }
    
    except Exception as e:
        logging.error(f"Erro ao gerar mapa: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar mapa: {str(e)}")


# ============================================
# 🔄 MODO SEPARAÇÃO - Bipagem de Pacotes
# ============================================

@router.post("/separation/start")
async def start_separation():
    """Inicia modo separação após otimização de rotas"""
    try:
        session = session_manager.get_current_session()
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        if not session.routes:
            raise HTTPException(status_code=400, detail="Nenhuma rota para separar")
        
        # Normaliza rotas (pode ser dict ou list)
        if isinstance(session.routes, dict):
            routes_list = list(session.routes.values())
            route_ids = list(session.routes.keys())
            route_map = session.routes
        else:
            routes_list = list(session.routes or [])
            route_ids = [getattr(r, "id", f"ROTA_{i+1}") for i, r in enumerate(routes_list)]
            route_map = {rid: r for rid, r in zip(route_ids, routes_list)}

        def _route_packages(route):
            if hasattr(route, "packages") and route.packages is not None:
                return route.packages
            if hasattr(route, "optimized_order") and route.optimized_order is not None:
                return route.optimized_order
            return []

        # Conta total de pacotes
        total_packages = sum(len(_route_packages(r)) for r in routes_list)
        
        # Cria sessão de separação
        sep_session = SeparationSession(
            session_id=session.session_id,
            route_ids=route_ids,
            total_packages=total_packages
        )
        # cache para o scan
        sep_session._route_map = route_map
        
        active_separation_sessions[session.session_id] = sep_session
        
        return {
            "status": "started",
            "session": sep_session.to_dict()
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao iniciar separação: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/separation/scan")
async def scan_package(data: SeparationScanInput):
    """Bipa pacote e retorna informações de rota/entregador/sequência"""
    try:
        session = session_manager.get_current_session()
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        session_id = data.session_id or session.session_id
        sep_session = active_separation_sessions.get(session_id)
        if not sep_session:
            raise HTTPException(status_code=400, detail="Sessão de separação não iniciada")
        
        # Busca pacote pelo barcode em todas as rotas
        found_package = None
        found_route = None
        package_index = None

        # Normaliza rotas (pode ser dict ou list)
        if hasattr(sep_session, "_route_map") and isinstance(sep_session._route_map, dict):
            route_map = sep_session._route_map
        else:
            if isinstance(session.routes, dict):
                route_map = session.routes
            else:
                routes_list = list(session.routes or [])
                route_map = {getattr(r, "id", f"ROTA_{i+1}"): r for i, r in enumerate(routes_list)}

        barcode = (data.barcode or "").strip().upper()

        if not hasattr(sep_session, "scanned_codes"):
            sep_session.scanned_codes = set()
            sep_session.scanned_at_map = {}

        for route_id in sep_session.route_ids:
            route = route_map.get(route_id)
            if not route:
                continue

            if hasattr(route, "packages") and route.packages is not None:
                packages = route.packages
            elif hasattr(route, "optimized_order") and route.optimized_order is not None:
                packages = route.optimized_order
            else:
                packages = []

            # Monta sequência de endereços únicos (agrupa por endereço)
            address_sequence = {}
            unique_stop = 0
            for pkg in packages:
                addr = getattr(pkg, "address", "") or ""
                addr_key = addr.lower().strip()
                if addr_key not in address_sequence and addr_key:
                    unique_stop += 1
                    address_sequence[addr_key] = unique_stop

            for idx, pkg in enumerate(packages, 1):
                pkg_code = getattr(pkg, "barcode", None) or getattr(pkg, "package_id", None) or getattr(pkg, "id", None)
                if pkg_code and str(pkg_code).strip().upper() == barcode:
                    found_package = pkg
                    found_route = route
                    addr = getattr(pkg, "address", "") or ""
                    addr_key = addr.lower().strip()
                    package_index = address_sequence.get(addr_key, idx)
                    break

            if found_package:
                break

        if not found_package or not found_route:
            raise HTTPException(status_code=404, detail="Pacote não encontrado no romaneio")

        # Já foi bipado?
        if barcode in sep_session.scanned_codes:
            return {
                "status": "already_scanned",
                "message": "Pacote já foi bipado anteriormente",
                "scanned_at": sep_session.scanned_at_map.get(barcode),
                "route_color": found_route.color,
                "deliverer_name": found_route.assigned_to_name or "Não atribuído",
                "sequence": package_index
            }

        # Marca como bipado
        sep_session.scanned_codes.add(barcode)
        sep_session.scanned_at_map[barcode] = datetime.now().isoformat()

        # Atualiza contador
        sep_session.scanned_packages += 1

        # Verifica se completou
        if sep_session.scanned_packages >= sep_session.total_packages:
            sep_session.is_complete = True
            sep_session.completed_at = datetime.now()

        total_in_route = len(getattr(found_route, "packages", None) or getattr(found_route, "optimized_order", None) or [])

        return {
            "status": "success",
            "route_color": found_route.color,
            "deliverer_name": found_route.assigned_to_name or "Não atribuído",
            "deliverer_id": found_route.assigned_to_telegram_id,
            "sequence": package_index,
            "total_in_route": total_in_route,
            "progress": {
                "scanned": sep_session.scanned_packages,
                "total": sep_session.total_packages,
                "percentage": sep_session.progress_percentage
            },
            "address": getattr(found_package, "address", None)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao bipar pacote: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/separation/status")
async def get_separation_status(session_id: Optional[str] = None):
    """Retorna status da separação"""
    try:
        session = session_manager.get_current_session()
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        sid = session_id or session.session_id
        sep_session = active_separation_sessions.get(sid)
        
        if not sep_session:
            return {
                "active": False,
                "message": "Separação não iniciada"
            }
        
        return {
            "active": True,
            "session": sep_session.to_dict()
        }
    except Exception as e:
        print(f"Erro ao buscar status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/separation/complete")
async def complete_separation():
    """Finaliza separação e libera envio de rotas"""
    try:
        session = session_manager.get_current_session()
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        sep_session = active_separation_sessions.get(session.session_id)
        if not sep_session:
            raise HTTPException(status_code=400, detail="Separação não iniciada")
        
        if not sep_session.is_complete:
            return {
                "status": "incomplete",
                "message": f"Ainda faltam {sep_session.total_packages - sep_session.scanned_packages} pacotes para bipar"
            }
        
        # Marca sessão como pronta para envio
        session.separation_completed = True
        
        return {
            "status": "completed",
            "message": "Separação concluída! Agora pode enviar as rotas aos entregadores.",
            "session": sep_session.to_dict()
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao finalizar separação: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 🔄 TRANSFERÊNCIAS - Gerenciamento de Pacotes
# ============================================

@router.post("/delivery/transfer-request")
async def request_transfer(data: TransferRequestInput):
    """Entregador solicita transferência de pacote(s)"""
    try:
        session = session_manager.get_current_session()
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        # Busca nomes dos entregadores
        deliverers = data_store.load_deliverers()
        from_del = next((d for d in deliverers if d.telegram_id == data.from_deliverer_id), None)
        to_del = next((d for d in deliverers if d.telegram_id == data.to_deliverer_id), None)
        
        if not from_del or not to_del:
            raise HTTPException(status_code=404, detail="Entregador não encontrado")
        
        # Cria solicitação
        transfer_id = str(uuid.uuid4())
        transfer = TransferRequest(
            id=transfer_id,
            package_ids=data.package_ids,
            from_deliverer_id=data.from_deliverer_id,
            from_deliverer_name=from_del.name,
            to_deliverer_id=data.to_deliverer_id,
            to_deliverer_name=to_del.name,
            reason=data.reason
        )
        
        active_transfer_requests[transfer_id] = transfer
        
        # Marca pacotes como em transferência
        for route in session.routes.values():
            for pkg in route.packages:
                if pkg.id in data.package_ids:
                    pkg.status = "solicitacao_transferencia"
        
        return {
            "status": "requested",
            "transfer": transfer.to_dict(),
            "message": "Solicitação enviada ao administrador"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao solicitar transferência: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/delivery/pending-transfers")
async def get_pending_transfers():
    """Lista transferências pendentes (para admin)"""
    try:
        pending = [
            t.to_dict()
            for t in active_transfer_requests.values()
            if t.status == TransferStatus.PENDING
        ]
        
        return {
            "pending_count": len(pending),
            "transfers": pending
        }
    except Exception as e:
        print(f"Erro ao listar transferências: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delivery/transfer-approve")
async def approve_transfer(data: TransferApprovalInput):
    """Admin aprova ou rejeita transferência"""
    try:
        transfer = active_transfer_requests.get(data.transfer_id)
        if not transfer:
            raise HTTPException(status_code=404, detail="Transferência não encontrada")
        
        if transfer.status != TransferStatus.PENDING:
            raise HTTPException(status_code=400, detail="Transferência já foi processada")
        
        session = session_manager.get_current_session()
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        if data.approved:
            # Aprova transferência
            transfer.status = TransferStatus.APPROVED
            transfer.approved_at = datetime.now()
            transfer.approved_by_admin_id = data.admin_id
            transfer.approved_by_admin_name = data.admin_name
            
            # Move pacotes entre rotas
            from_route = None
            to_route = None
            
            for route in session.routes.values():
                if route.assigned_deliverer and route.assigned_deliverer.telegram_id == transfer.from_deliverer_id:
                    from_route = route
                if route.assigned_deliverer and route.assigned_deliverer.telegram_id == transfer.to_deliverer_id:
                    to_route = route
            
            if from_route and to_route:
                # Remove pacotes da rota origem
                packages_to_transfer = [p for p in from_route.packages if p.id in transfer.package_ids]
                from_route.packages = [p for p in from_route.packages if p.id not in transfer.package_ids]
                
                # Adiciona na rota destino
                for pkg in packages_to_transfer:
                    pkg.assigned_to = transfer.to_deliverer_name
                    pkg.status = "em_transito"
                    to_route.packages.append(pkg)
                
                message = f"Transferência aprovada! {len(packages_to_transfer)} pacote(s) movido(s)."
            else:
                message = "Transferência aprovada (rotas não encontradas para mover fisicamente)"
        else:
            # Rejeita
            transfer.status = TransferStatus.REJECTED
            transfer.rejection_reason = data.rejection_reason
            
            # Volta status dos pacotes
            for route in session.routes.values():
                for pkg in route.packages:
                    if pkg.id in transfer.package_ids:
                        pkg.status = "em_transito"
            
            message = "Transferência rejeitada"
        
        return {
            "status": "success",
            "transfer": transfer.to_dict(),
            "message": message
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao processar transferência: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/romaneio/import-additional")
async def import_additional_romaneio(file: UploadFile = File(...)):
    """Importa romaneio adicional para a sessão ativa"""
    try:
        session = session_manager.get_current_session()
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa. Crie uma sessão primeiro.")
        
        # Salva arquivo temporário
        temp_path = tempfile.mktemp(suffix=".xlsx")
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        try:
            # Parse novo romaneio
            parser = ShopeeRomaneioParser()
            deliveries = parser.parse(temp_path)
            
            if not deliveries:
                raise HTTPException(status_code=400, detail="Nenhuma entrega válida encontrada no arquivo")
            
            # Adiciona à sessão existente
            new_romaneio = Romaneio(
                id=str(uuid.uuid4()),
                filename=file.filename,
                deliveries=deliveries,
                created_at=datetime.now()
            )
            
            session.romaneios.append(new_romaneio)
            
            # Gera minimap do novo romaneio
            points = [DeliveryPoint(d.latitude, d.longitude, d.address) for d in deliveries]
            
            map_gen = MapGenerator()
            minimap_filename = f"minimap_additional_{new_romaneio.id}.html"
            minimap_path = _safe_map_path(minimap_filename)
            
            map_gen.generate_minimap(
                points,
                minimap_path,
                title=f"Romaneio Adicional - {file.filename}"
            )
            
            return {
                "status": "success",
                "message": f"Romaneio adicional importado! {len(deliveries)} entregas.",
                "romaneio_id": new_romaneio.id,
                "total_romaneios": len(session.romaneios),
                "total_deliveries": sum(len(r.deliveries) for r in session.romaneios),
                "minimap_url": f"/api/maps/{minimap_filename}"
            }
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao importar romaneio adicional: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================================================
# 🆕 NOVOS ENDPOINTS - PERSISTÊNCIA, REUSO E HISTÓRICO
# ========================================================================

@router.post("/session/create")
def create_session(
    session_name: str = Form(...),
    created_by: str = Form("admin")
):
    """
    🔥 Criar nova sessão SEM importar romaneio
    Retorna session_id para reutilizar depois
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager, SessionStatus
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session_id = str(uuid.uuid4())
        session = session_mgr.create_session(
            session_id=session_id,
            created_by=created_by,
            manifest_data={"session_name": session_name}
        )
        
        return {
            "status": "success",
            "session_id": session_id,
            "message": f"Sessão '{session_name}' criada! Use para reutilizar SEM re-import.",
            "status_value": SessionStatus.CREATED.value
        }
    except Exception as e:
        logger.error(f"Erro ao criar sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
def get_session(session_id: str):
    """
    🔍 Recuperar sessão existente (sem re-import!)
    Retorna todos os dados persistidos
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session = session_mgr.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        return {
            "status": "success",
            "session": session_mgr.get_session_summary(session_id)
        }
    except Exception as e:
        logger.error(f"Erro ao recuperar sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/open")
def open_session(session_id: str):
    """
    📂 Abrir sessão para finalizar romaneio SEM re-import
    Transição: CREATED → OPENED
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session = session_mgr.open_session(session_id)
        
        return {
            "status": "success",
            "message": f"Sessão {session_id} aberta! Pronta para finalizar.",
            "session": session_mgr.get_session_summary(session_id)
        }
    except Exception as e:
        logger.error(f"Erro ao abrir sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/start")
def start_session(session_id: str):
    """
    🚀 Iniciar distribuição de uma sessão
    Transição: OPENED → STARTED
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session = session_mgr.start_session(session_id)
        
        return {
            "status": "success",
            "message": f"Distribuição iniciada para sessão {session_id}",
            "session": session_mgr.get_session_summary(session_id)
        }
    except Exception as e:
        logger.error(f"Erro ao iniciar sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/complete")
def complete_session(session_id: str):
    """
    ✅ Finalizar sessão (todas entregas concluídas)
    Transição: IN_PROGRESS → COMPLETED → READ_ONLY
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session = session_mgr.complete_session(session_id)
        
        return {
            "status": "success",
            "message": f"Sessão {session_id} finalizada! Agora é histórico (READ_ONLY).",
            "session": session_mgr.get_session_summary(session_id)
        }
    except Exception as e:
        logger.error(f"Erro ao completar sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/history")
def get_session_history(session_id: str):
    """
    📚 Acessar sessão finalizada como histórico (READ_ONLY)
    Dados congelados, sem edição possível
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager, SessionStatus
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session = session_mgr.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        if session.status != SessionStatus.READ_ONLY:
            raise HTTPException(
                status_code=400,
                detail=f"Sessão não é histórico (status: {session.status.value})"
            )
        
        return {
            "status": "success",
            "history": session_mgr.get_session_summary(session_id),
            "addresses": session.addresses or [],
            "deliverers": session.deliverers or [],
            "route_assignments": session.route_assignments or [],
            "financials": session.financials or {}
        }
    except Exception as e:
        logger.error(f"Erro ao recuperar histórico: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/list/all")
def list_all_sessions(status: Optional[str] = None, limit: int = 50):
    """
    📋 Listar todas as sessões com filtro opcional de status
    Status: created, opened, started, in_progress, completed, read_only
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager, SessionStatus
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session_status = None
        if status:
            try:
                session_status = SessionStatus[status.upper()]
            except KeyError:
                raise HTTPException(status_code=400, detail=f"Status inválido: {status}")
        
        sessions = session_mgr.list_sessions(status=session_status, limit=limit)
        summaries = [session_mgr.get_session_summary(s.id) for s in sessions]
        
        return {
            "status": "success",
            "total": len(summaries),
            "sessions": summaries
        }
    except Exception as e:
        logger.error(f"Erro ao listar sessões: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/financials/session/{session_id}")
def get_session_financials(session_id: str):
    """
    💰 Obter financeiro COMPLETO da sessão
    Inclui: lucro rota, custo rota, salário entregador
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        session = session_mgr.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        return {
            "status": "success",
            "session_id": session_id,
            "financials": session.financials or {
                "total_profit": 0,
                "total_cost": 0,
                "total_salary": 0
            },
            "addresses_count": len(session.addresses or []),
            "deliverers_count": len(session.deliverers or []),
            "last_updated": session.last_updated.isoformat() if session.last_updated else None
        }
    except Exception as e:
        logger.error(f"Erro ao recuperar financeiro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/financials/calculate/session/{session_id}")
def calculate_session_financials(
    session_id: str,
    routes: List[Dict] = None,
    deliverers: List[Dict] = None
):
    """
    🧮 Calcular financeiro completo da sessão
    Input: lista de rotas e entregadores
    Output: lucro, custo, salário com breakdown detalhado
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager
        from bot_multidelivery.services.financial_service import enhanced_financial_calculator
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        # Calcular financeiro
        result = enhanced_financial_calculator.calculate_session_financials(
            session_id=session_id,
            routes=routes or [],
            deliverers=deliverers or []
        )
        
        # Persistir na sessão
        session_mgr.save_all_data(
            session_id=session_id,
            financials=result["summary"]
        )
        
        return {
            "status": "success",
            "financials": result
        }
    except Exception as e:
        logger.error(f"Erro ao calcular financeiro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/sessions")
def get_history_sessions(limit: int = 100):
    """
    📚 Obter histórico COMPLETO (todas as sessões READ_ONLY)
    Para exibir em HistoryView
    """
    try:
        from bot_multidelivery.session_persistence import SessionManager
        from bot_multidelivery.database import get_db
        
        db = next(get_db())
        session_mgr = SessionManager(db)
        
        history = session_mgr.get_history(limit=limit)
        
        return {
            "status": "success",
            "total": len(history),
            "sessions": history
        }
    except Exception as e:
        logger.error(f"Erro ao recuperar histórico: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/resume")
def resume_session(session_id: str):
    """
    ▶️ Retomar sessão - carrega estado completo para continuar no PC/mobile
    Retorna: romaneio, rotas, entregadores, financeiro, PASSO ATUAL
    """
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        
        # Define como sessão atual
        session_manager.set_current_session(session_id)
        
        # Monta payload completo de retomada
        routes_data = []
        if hasattr(session, "routes"):
            routes_obj = session.routes
            if isinstance(routes_obj, dict):
                routes_data = [{"id": rid, **vars(r)} for rid, r in routes_obj.items()]
            else:
                routes_data = [vars(r) for r in (routes_obj or [])]
        
        # Determina qual PASSO deve ser retomado
        current_step = getattr(session, "current_step", "idle")
        resume_tab = "analysis"  # default
        
        if current_step == "imported":
            resume_tab = "analysis"  # Voltará com romaneio carregado
        elif current_step in ["optimizing", "optimized"]:
            resume_tab = "analysis"  # Voltará na tela de otimização
        elif current_step in ["assigning", "assigned"]:
            resume_tab = "separation"  # Voltará na tela de atribuição/separação
        elif current_step == "separating":
            resume_tab = "separation"  # Voltará no modo separação
        
        return {
            "status": "resumed",
            "session_id": session_id,
            "resume_tab": resume_tab,  # ← Aba pra retomar
            "current_step": current_step,  # ← Passo atual
            "session_name": getattr(session, "session_name", ""),
            "date": getattr(session, "date", ""),
            "period": getattr(session, "period", ""),
            "created_at": str(getattr(session, "created_at", "")),
            "is_finalized": getattr(session, "is_finalized", False),
            "route_value": getattr(session, "route_value", 0.0),
            "num_deliverers": getattr(session, "num_deliverers", 0),
            "romaneios": {
                "count": len(getattr(session, "romaneios", [])),
                "total_addresses": sum(len(r.points) for r in getattr(session, "romaneios", []))
            },
            "routes": {
                "count": len(routes_data),
                "data": routes_data[:5]
            },
            "financials": {
                "total_packages": getattr(session, "total_packages", 0),
                "total_delivered": getattr(session, "total_delivered", 0),
                "total_pending": getattr(session, "total_pending", 0)
            }
        }
    except Exception as e:
        logger.error(f"Erro ao retomar sessão: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/update-step")
async def update_session_step(session_id: Optional[str] = None, step: str = "idle"):
    """
    📍 Atualizar o passo atual da sessão
    Passos: idle → importing → imported → optimizing → optimized → assigning → assigned → separating → completed
    """
    try:
        session = session_manager.get_current_session() if not session_id else session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        session.current_step = step
        session_manager._auto_save(session)
        
        return {
            "status": "updated",
            "session_id": session.session_id,
            "current_step": step
        }
    except Exception as e:
        logger.error(f"Erro ao atualizar passo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/state")
async def get_session_state():
    """
    🔄 Retorna o estado completo da sessão atual para reconstrução da UI
    Permite que o usuário retome exatamente de onde parou (troca de dispositivo)
    """
    session = session_manager.get_current_session()
    
    if not session or session.is_finalized:
        return {"active": False}
        
    # Constrói Assignments map
    assignments = {}
    routes_list = []
    
    for r in session.routes:
        if r.assigned_to_telegram_id:
             assignments[r.id] = r.assigned_to_telegram_id
             
        routes_list.append({
             "route_id": r.id,
             "total_stops": len(r.optimized_order),
             "total_packages": r.total_packages,
             # Se tiver cluster info, pode adicionar percentage_load aqui
             "map_url": f"/maps/{os.path.basename(r.map_file)}" if r.map_file else None,
             "deliverer_id": r.assigned_to_telegram_id
        })

    return {
        "active": True,
        "session_id": session.session_id,
        "current_step": session.current_step, # idle, imported, assigned, etc
        "has_romaneio": len(session.romaneios) > 0,
        "route_value": session.route_value,
        "num_deliverers": session.num_deliverers if session.num_deliverers > 0 else 2,
        "routes": routes_list,
        "assignments": assignments
    }


@router.post("/session/cancel-import")
async def cancel_romaneio_import(session_id: Optional[str] = None):
    """
    ❌ Cancelar importação de romaneio e voltar pra zero
    Limpa dados mas mantém sessão
    """
    try:
        session = session_manager.get_current_session() if not session_id else session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Nenhuma sessão ativa")
        
        # Limpa romaneios e rotas
        session.romaneios = []
        session.routes = []
        session.current_step = "idle"
        session.route_value = 0.0
        session.num_deliverers = 0
        
        session_manager._auto_save(session)
        
        return {
            "status": "cancelled",
            "session_id": session.session_id,
            "message": "Importação cancelada. Você pode começar uma nova."
        }
    except Exception as e:
        logger.error(f"Erro ao cancelar importação: {e}")
        raise HTTPException(status_code=500, detail=str(e))

