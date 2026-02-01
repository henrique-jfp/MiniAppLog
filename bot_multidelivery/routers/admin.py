# -*- coding: utf-8 -*-
from fastapi import APIRouter, HTTPException
from bot_multidelivery.config import BotConfig
from bot_multidelivery.persistence import data_store
from bot_multidelivery.services.deliverer_service import DelivererService
from bot_multidelivery.schemas import DelivererInput

router = APIRouter(prefix="/admin", tags=["Admin Team"])

@router.get("/team")
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

@router.post("/team")
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

@router.delete("/team/{user_id}")
async def remove_member(user_id: int):
    """Remove membro permanentemente utilizando a persistência"""
    try:
        data_store.delete_deliverer(user_id)
        return {"status": "success", "deleted_id": user_id}
    except Exception as e:
        return {"status": "success", "warning": str(e)}

@router.get("/stats")
async def get_stats():
    """Retorna estatísticas gerais do sistema"""
    # Exemplo simples, pode ser expandido
    deliverers = data_store.load_deliverers()
    total_pkgs = sum(d.total_deliveries for d in deliverers)
    return {
        "total_deliverers": len(deliverers),
        "total_packages_delivered": total_pkgs,
        "system_status": "online"
    }
