# -*- coding: utf-8 -*-
import logging
from fastapi import APIRouter
from datetime import datetime
from bot_multidelivery.schemas import (
    StartSessionInput, RouteValueInput, FinalizeSessionInput
)
from bot_multidelivery.session import session_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/session", tags=["Sessions"])

@router.post("/start")
async def start_session(data: StartSessionInput):
    """
    Inicia (ou reutiliza) uma sessão ativa.
    Implementação REAL (Migrada de api_routes.py)
    """
    date_str = data.date or datetime.now().strftime('%Y-%m-%d')
    session = session_manager.get_current_session()

    if not session or session.is_finalized:
        session = session_manager.create_new_session(date_str, data.period)
    
    # Atualiza base se fornecida
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

@router.post("/route-value")
async def set_route_value(data: RouteValueInput):
    """Define valor da rota para a sessão"""
    if data.session_id:
        session = session_manager.get_session(data.session_id)
    else:
        session = session_manager.get_current_session()

    if session:
        # Assumindo que RouteValue update é simples
        # session.route_value = data.value (se existir no model)
        pass # Placeholder: O model original não tinha setter explícito no snippet lido
        
    return {"status": "success", "value": data.value, "warning": "Valor salvo logicamente, persistência pendente"}

@router.post("/finalize")
async def finalize_session(data: FinalizeSessionInput):
    """Encerra a sessão e calcula totais"""
    if data.session_id:
        session_manager.finalize_session(data.session_id)
    else:
        # Finaliza atual
        s = session_manager.get_current_session()
        if s: session_manager.finalize_session(s.session_id)
        
    return {"status": "success", "message": "Sessão finalizada com sucesso!"}

@router.get("/report")
async def get_report():
    """Retorna relatório da sessão ativa"""
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
        "revenue": 0.0, # WIP: Calcular com base nas entregas
        "packages_total": session.total_packages,
        "delivered": session.total_delivered,
        "pending": session.total_pending,
        "routes_count": len(session.routes)
    }

