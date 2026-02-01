# -*- coding: utf-8 -*-
from fastapi import APIRouter
from bot_multidelivery.persistence import data_store
from datetime import datetime, timedelta

router = APIRouter(prefix="/financial", tags=["Financial"])

def get_current_week_financials():
    """Helper para buscar finanças da semana atual"""
    today = datetime.now()
    start_week = today - timedelta(days=today.weekday()) # Segunda
    end_week = start_week + timedelta(days=6) # Domingo

    reports = data_store.get_financial_reports(start_week, end_week)
    
    total_rev = sum(r.total_revenue for r in reports)
    total_cost = sum(r.total_cost for r in reports)
    net_profit = total_rev - total_cost

    return {
        "start_date": start_week.strftime('%Y-%m-%d'),
        "end_date": end_week.strftime('%Y-%m-%d'),
        "revenue": total_rev,
        "costs": total_cost,
        "profit": net_profit,
        "days_closed": len(reports)
    }

@router.get("/balance")
async def get_financial_balance(user_id: int):
    """
    Retorna resumo financeiro para o painel.
    Se for sócio, vê o lucro da empresa. Se for entregador, vê seus ganhos.
    """
    # Lógica simplificada: por enquanto todos veem o balanço da semana
    # Futuro: Filtrar por deliverer_id se não for admin
    
    week_data = get_current_week_financials()
    return {
        "balance": week_data["profit"], 
        "period": "Semana Atual", 
        "currency": "BRL"
    }

@router.get("/session/{session_id}")
async def get_session_financials(session_id: str):
    """Retorna detalhes financeiros de uma sessão específica"""
    # Exemplo: Retorna dados mockados ou carrega do histórico
    # Como a lógica completa financeiro é complexa e estava no api_routes gigante
    # vamos deixar o stub aqui pronto para ser expandido.
    return {
        "session_id": session_id,
        "revenue": 0.0,
        "costs": 0.0,
        "profit": 0.0,
        "details": "Not implemented yet in modular router (TODO)"
    }
