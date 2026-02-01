# -*- coding: utf-8 -*-
"""
api_routes.py (Aggregator)
Este arquivo agora serve apenas como ponto de entrada para os routers modulares.
Mantido para retrocompatibilidade com main_multidelivery.py.
"""
from fastapi import APIRouter
from bot_multidelivery.routers import admin, auth, financial, session, logistic

# Router Principal
router = APIRouter(prefix="/api")

# Incluindo Sub-Routers
router.include_router(admin.router)
router.include_router(auth.router)
router.include_router(financial.router)
router.include_router(session.router)
router.include_router(logistic.router)

# Health Check (se não estiver no main)
@router.get("/")
async def api_root():
    return {"message": "Mini App API Running", "version": "2.0 (Modular)"}

