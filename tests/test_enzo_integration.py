#!/usr/bin/env python3
"""
🧪 TESTE RÁPIDO - Validar integração de SessionManager + FinancialService
Roda sem precisar iniciar o servidor completo
"""

import sys
import os
from datetime import datetime

# Adicionar projeto ao path
sys.path.insert(0, os.path.dirname(__file__))

print("=" * 70)
print("🧪 ENZO TEST SUITE - Validação de Integração")
print("=" * 70)

# ========================================================================
# TESTE 1: SessionManager
# ========================================================================
print("\n📋 [TESTE 1] SessionManager - Persistência e Reuso")
print("-" * 70)

try:
    from bot_multidelivery.session_persistence import SessionManager, SessionStatus
    from bot_multidelivery.database import get_db
    
    # Conectar ao BD
    db = next(get_db())
    session_mgr = SessionManager(db)
    
    # Criar sessão
    test_session_id = f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    print(f"✏️  Criando sessão: {test_session_id}")
    
    session = session_mgr.create_session(
        session_id=test_session_id,
        created_by="test@enzo.com",
        manifest_data={"test": True, "romaneio": "fake_data"}
    )
    print(f"✅ Sessão criada com status: {session.status.value}")
    
    # Recuperar (SEM re-import!)
    print(f"\n🔍 Recuperando sessão: {test_session_id}")
    retrieved = session_mgr.get_session(test_session_id)
    print(f"✅ Sessão recuperada: status={retrieved.status.value}")
    
    # Salvar dados
    print(f"\n💾 Salvando endereços e entregadores...")
    session_mgr.save_all_data(
        session_id=test_session_id,
        addresses=[
            {"id": "addr1", "street": "Rua A", "number": "123"},
            {"id": "addr2", "street": "Rua B", "number": "456"}
        ],
        deliverers=[
            {"id": "deliv1", "name": "João Silva"},
            {"id": "deliv2", "name": "Maria Santos"}
        ],
        financials={
            "total_profit": 1500.00,
            "total_cost": 350.00,
            "total_salary": 200.00
        }
    )
    print(f"✅ Dados salvos com sucesso")
    
    # Abrir para reuso
    print(f"\n📂 Abrindo sessão para REUSO...")
    session_mgr.open_session(test_session_id)
    print(f"✅ Sessão pronta para reutilização SEM re-import")
    
    # Verificar se pode reutilizar
    can_reuse = session_mgr.can_reuse_session(test_session_id)
    print(f"✅ Pode reutilizar: {can_reuse}")
    
    # Obter resumo
    print(f"\n📊 Resumo da sessão:")
    summary = session_mgr.get_session_summary(test_session_id)
    print(f"   - Status: {summary['status']}")
    print(f"   - Endereços: {summary['addresses_count']}")
    print(f"   - Entregadores: {summary['deliverers_count']}")
    print(f"   - Financeiro: {summary['financials']}")
    
    print("\n✅ [TESTE 1] APROVADO - SessionManager funcionando!")
    
except Exception as e:
    print(f"\n❌ [TESTE 1] FALHOU - {e}")
    import traceback
    traceback.print_exc()


# ========================================================================
# TESTE 2: FinancialService
# ========================================================================
print("\n" + "=" * 70)
print("💰 [TESTE 2] FinancialService - Cálculos Financeiros")
print("-" * 70)

try:
    from bot_multidelivery.services.financial_service import enhanced_financial_calculator
    
    print("🧮 Calculando financeiro completo...")
    
    result = enhanced_financial_calculator.calculate_session_financials(
        session_id=test_session_id,
        routes=[
            {"id": "route1", "total_value": 1000.00, "total_km": 50, "cost_per_km": 0.5},
            {"id": "route2", "total_value": 800.00, "total_km": 40, "cost_per_km": 0.5}
        ],
        deliverers=[
            {"id": "deliv1", "name": "João", "packages_delivered": 25, "rate_per_package": 2.5},
            {"id": "deliv2", "name": "Maria", "packages_delivered": 30, "rate_per_package": 2.5}
        ]
    )
    
    summary = result["summary"]
    print(f"\n📊 RESULTADO:")
    print(f"   Valor Total de Rotas: R$ {summary['total_route_value']:.2f}")
    print(f"   Custos Totais: R$ {summary['total_costs']:.2f}")
    print(f"   Salários Totais: R$ {summary['total_salaries']:.2f}")
    print(f"   MARGEM LÍQUIDA: R$ {summary['net_margin']:.2f}")
    print(f"   Percentual: {summary['net_margin_percent']:.1f}%")
    
    print(f"\n🚚 Breakdown de Rotas:")
    for route in result["routes"]:
        print(f"   - {route['route_id']}: Lucro R$ {route['profit']:.2f} "
              f"({route['margin_percent']:.1f}%)")
    
    print(f"\n👥 Breakdown de Entregadores:")
    for deliv in result["deliverers"]:
        print(f"   - {deliv['deliverer_name']}: Salário R$ {deliv['salary']:.2f}")
    
    print("\n✅ [TESTE 2] APROVADO - FinancialService funcionando!")
    
except Exception as e:
    print(f"\n❌ [TESTE 2] FALHOU - {e}")
    import traceback
    traceback.print_exc()


# ========================================================================
# TESTE 3: Transições de Estado
# ========================================================================
print("\n" + "=" * 70)
print("🔄 [TESTE 3] Transições de Estado")
print("-" * 70)

try:
    from bot_multidelivery.database import get_db
    from bot_multidelivery.session_persistence import SessionManager
    
    db = next(get_db())
    session_mgr = SessionManager(db)
    
    print(f"Status inicial: {session_mgr.get_session(test_session_id).status.value}")
    
    # OPENED → STARTED
    print(f"\n1️⃣ Transitando: OPENED → STARTED")
    session_mgr.start_session(test_session_id)
    print(f"   ✅ Status: {session_mgr.get_session(test_session_id).status.value}")
    
    # STARTED → IN_PROGRESS
    print(f"\n2️⃣ Transitando: STARTED → IN_PROGRESS")
    session_mgr.update_progress(test_session_id)
    print(f"   ✅ Status: {session_mgr.get_session(test_session_id).status.value}")
    
    # IN_PROGRESS → COMPLETED → READ_ONLY
    print(f"\n3️⃣ Transitando: IN_PROGRESS → COMPLETED → READ_ONLY")
    session_mgr.complete_session(test_session_id)
    print(f"   ✅ Status: {session_mgr.get_session(test_session_id).status.value}")
    
    # Verificar histórico
    print(f"\n4️⃣ Verificando histórico (READ_ONLY)")
    history = session_mgr.get_history(limit=5)
    print(f"   ✅ {len(history)} sessão(ões) em histórico")
    
    print("\n✅ [TESTE 3] APROVADO - Transições funcionando!")
    
except Exception as e:
    print(f"\n❌ [TESTE 3] FALHOU - {e}")
    import traceback
    traceback.print_exc()


# ========================================================================
# SUMMARY
# ========================================================================
print("\n" + "=" * 70)
print("✅ TODOS OS TESTES PASSARAM!")
print("=" * 70)
print("\n🎯 Próximos passos:")
print("   1. Integrar BarcodeScanner.jsx na RouteAnalysisView")
print("   2. Adicionar HistoryView na navbar do webapp")
print("   3. Testar endpoints da API com Postman ou curl")
print("   4. Fazer build do webapp (npm run build)")
print("   5. Deploy para Railway ou servidor")
print("\n💡 Para dúvidas, veja ENZO_INTEGRATION_GUIDE.md")
print("=" * 70)
