import os
import json
from fastapi import APIRouter, HTTPException
from bot_multidelivery.config import BotConfig
from bot_multidelivery.session import session_manager

router = APIRouter(prefix="/api")

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
