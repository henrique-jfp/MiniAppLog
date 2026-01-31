import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bot_multidelivery.persistence import data_store
from bot_multidelivery.services.deliverer_service import DelivererService

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
    """Remove membro (apenas lógica simples por enquanto)"""
    # TODO: Implementar soft delete real no service
    # Por enquanto, carregamos, filtramos e salvamos
    deliverers = data_store.load_deliverers()
    new_list = [d for d in deliverers if d.telegram_id != user_id]
    
    if len(new_list) < len(deliverers):
        data_store.save_deliverers(new_list)
        return {"status": "success"}
    
    raise HTTPException(status_code=404, detail="Entregador não encontrado")

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
    """Lê os JSONs da semana atual para calcular totais"""
    from datetime import datetime, timedelta
    import glob
    
    # Define início da semana (Segunda-feira)
    today = datetime.now()
    start_week = today - timedelta(days=today.weekday())
    week_dates = [(start_week + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
    
    total_revenue = 0.0
    total_costs = 0.0
    total_profit = 0.0
    deliverer_earnings = {}
    
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
