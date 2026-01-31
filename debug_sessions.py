"""
🔍 DEBUG RÁPIDO - Verifica o que está falhando
Execute: python debug_sessions.py
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

print("\n" + "="*70)
print("🔍 DEBUG - SISTEMA DE SESSÕES")
print("="*70)

# 1. Verificar DATABASE_URL
print("\n1️⃣ Verificando DATABASE_URL...")
db_url = os.getenv('DATABASE_URL')
if db_url:
    print(f"✅ DATABASE_URL configurada: {db_url[:50]}...")
else:
    print("❌ DATABASE_URL NÃO configurada!")
    print("   Configure com: $env:DATABASE_URL='postgresql://...'")
    sys.exit(1)

# 2. Testar conexão com banco
print("\n2️⃣ Testando conexão com PostgreSQL...")
try:
    from sqlalchemy import create_engine
    url = db_url
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    
    engine = create_engine(url, echo=False, pool_pre_ping=True)
    with engine.connect() as conn:
        result = conn.execute("SELECT 1")
        print("✅ Conexão OK!")
except Exception as e:
    print(f"❌ Erro de conexão: {e}")
    sys.exit(1)

# 3. Verificar schema
print("\n3️⃣ Verificando se tabelas de sessão existem...")
try:
    from bot_multidelivery.database import db_manager
    db = db_manager.SessionLocal()
    
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    required_tables = ['delivery_sessions', 'session_packages', 'session_deliverers', 
                      'session_addresses', 'session_audit']
    
    found = [t for t in required_tables if t in tables]
    missing = [t for t in required_tables if t not in tables]
    
    if found:
        print(f"✅ Tabelas encontradas: {', '.join(found)}")
    if missing:
        print(f"❌ Tabelas faltando: {', '.join(missing)}")
        print("\n   Execute: python migrate.py")
        sys.exit(1)
    
    db.close()
except Exception as e:
    print(f"❌ Erro ao verificar schema: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 4. Testar SessionEngine
print("\n4️⃣ Testando SessionEngine...")
try:
    from bot_multidelivery.services.session_engine import SessionEngine
    from bot_multidelivery.database import db_manager
    
    db = db_manager.SessionLocal()
    engine = SessionEngine(db)
    
    # Tenta criar uma sessão de teste
    session_id = engine.create_session(user_id=999, session_type="debug")
    print(f"✅ SessionEngine funcionando! Session ID: {session_id}")
    
    db.close()
except Exception as e:
    print(f"❌ Erro no SessionEngine: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 5. Verificar FastAPI routes
print("\n5️⃣ Verificando se FastAPI routes estão registradas...")
try:
    from main_hybrid import app
    
    routes = [route.path for route in app.routes]
    session_routes = [r for r in routes if 'sessions' in r]
    
    if session_routes:
        print(f"✅ Routes de sessão encontradas:")
        for route in session_routes[:5]:
            print(f"   • {route}")
    else:
        print("❌ Nenhuma rota /api/sessions encontrada!")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Erro ao verificar routes: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 6. Verificar handlers Telegram
print("\n6️⃣ Verificando handlers Telegram...")
try:
    from bot_multidelivery.session_handlers import cmd_sessions
    print("✅ Handlers de sessão importáveis")
except Exception as e:
    print(f"❌ Erro ao importar handlers: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "="*70)
print("✅ TUDO OK! Sistema pronto para usar")
print("="*70)

print("\n🚀 Próximos passos:")
print("   1. python main_hybrid.py")
print("   2. Abra o Telegram e use: /sessions")
print("   3. Ou teste: python test_api.py")
