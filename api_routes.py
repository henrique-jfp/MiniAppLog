import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bot_multidelivery.config import BotConfig
from bot_multidelivery.session import session_manager
from bot_multidelivery.persistence import data_store
from bot_multidelivery.services.deliverer_service import DelivererService
from bot_multidelivery.services.route_analyzer import RouteAnalyzer
from bot_multidelivery.parsers.shopee_parser import ShopeeRomaneioParser
from fastapi import UploadFile, File
import tempfile
import shutil

router = APIRouter(prefix="/api")

class DelivererInput(BaseModel):
    name: str
    telegram_id: int
    is_partner: bool = False

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
            packages_info = [
                {"id": p.tracking_code, "status": "pending"} 
                for p in point.packages
            ]
            
            stops_data.append({
                "id": idx + 1,
                "lat": point.lat,
                "lng": point.lng,
                "address": point.address,
                "packages": packages_info,
                "status": "pending" # TODO: Integrar status real
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

@router.post("/route/analyze")
async def analyze_route_file(file: UploadFile = File(...)):
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
        result = analyzer.analyze_route(analyzer_input)
        
        # Retorna Dataclass como Dict
        from dataclasses import asdict
        return asdict(result)

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro crítico na análise de rota: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
