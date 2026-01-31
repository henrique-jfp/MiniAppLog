"""
🧪 Script de teste para validar o sistema de sessões
Execute com: python test_sessions.py
"""

import json
from datetime import datetime
from bot_multidelivery.schemas.sessions_schema import (
    DeliverySession, SessionPackage, SessionDeliverer, 
    SessionAddress, SessionAudit, Base
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# ==================== SETUP ====================

database_url = os.getenv('DATABASE_URL')

if not database_url:
    print("❌ DATABASE_URL não configurada!")
    print("Configure com: $env:DATABASE_URL='postgresql://...' ou export DATABASE_URL='...'")
    exit(1)

if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

print(f"📦 Testando conexão: {database_url[:40]}...")

try:
    engine = create_engine(database_url, echo=False)
    SessionLocal = sessionmaker(bind=engine)
    
    # Testa conexão
    with engine.connect() as conn:
        result = conn.execute("SELECT 1")
        print("✅ Conexão com PostgreSQL OK!")
    
except Exception as e:
    print(f"❌ Erro de conexão: {e}")
    exit(1)

# ==================== TESTES ====================

def test_schema_creation():
    """Verifica se o schema foi criado"""
    print("\n🔍 Testando criação do schema...")
    try:
        Base.metadata.tables
        print(f"✅ Schema definido com {len(Base.metadata.tables)} tabelas")
        for table_name in Base.metadata.tables:
            print(f"  • {table_name}")
        return True
    except Exception as e:
        print(f"❌ Erro ao verificar schema: {e}")
        return False

def test_insert_session():
    """Testa inserção de uma sessão"""
    print("\n📝 Testando inserção de sessão...")
    try:
        db = SessionLocal()
        
        session = DeliverySession(
            session_id="test-session-001",
            user_id=999,  # User de teste
            status="open",
            created_at=datetime.now(),
            session_type="test",
            total_packages=0,
            total_deliverers=0
        )
        
        db.add(session)
        db.commit()
        
        print(f"✅ Sessão criada: {session.session_id}")
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar sessão: {e}")
        return False

def test_insert_package():
    """Testa inserção de pacote"""
    print("\n📦 Testando inserção de pacote...")
    try:
        db = SessionLocal()
        
        # Insere endereço primeiro
        address = SessionAddress(
            address_id="addr-001",
            session_id="test-session-001",
            address="Rua Teste, 123",
            latitude=-23.5505,
            longitude=-46.6333,
            package_count=1,
            created_at=datetime.now()
        )
        db.add(address)
        
        # Insere pacote
        package = SessionPackage(
            package_id="pkg-001",
            session_id="test-session-001",
            barcode="1234567890123",
            address_id="addr-001",
            recipient_name="Teste Silva",
            recipient_phone="11999999999",
            address_full="Rua Teste, 123",
            delivery_status="pending",
            package_value=50.00,
            delivery_fee=5.00,
            created_at=datetime.now()
        )
        db.add(package)
        db.commit()
        
        print(f"✅ Pacote criado: {package.package_id}")
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar pacote: {e}")
        db.close()
        return False

def test_query_linked_data():
    """Testa query com dados linkedados"""
    print("\n🔗 Testando query de dados linkedados...")
    try:
        db = SessionLocal()
        
        session = db.query(DeliverySession).filter_by(session_id="test-session-001").first()
        
        if session:
            packages = db.query(SessionPackage).filter_by(session_id=session.session_id).all()
            print(f"✅ Sessão encontrada: {session.session_id}")
            print(f"   Pacotes: {len(packages)}")
            for pkg in packages:
                print(f"   • {pkg.barcode} - {pkg.recipient_name}")
            db.close()
            return True
        else:
            print("❌ Sessão não encontrada")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao fazer query: {e}")
        return False

def test_sessionengine():
    """Testa SessionEngine"""
    print("\n⚙️ Testando SessionEngine...")
    try:
        from bot_multidelivery.services.session_engine import SessionEngine
        
        db = SessionLocal()
        engine = SessionEngine(db)
        
        # Cria nova sessão
        session_id = engine.create_session(user_id=999, session_type="test")
        print(f"✅ SessionEngine criou sessão: {session_id}")
        
        # Adiciona pacotes
        result = engine.add_packages_to_session(session_id, [
            {"barcode": "111", "recipient_name": "João", "address": "Rua A"},
            {"barcode": "222", "recipient_name": "Maria", "address": "Rua B"}
        ])
        print(f"✅ Pacotes adicionados: {result['added']}")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro no SessionEngine: {e}")
        import traceback
        traceback.print_exc()
        return False

# ==================== EXECUÇÃO ====================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🧪 TESTES DO SISTEMA DE SESSÕES")
    print("="*60)
    
    results = []
    
    results.append(("Schema Creation", test_schema_creation()))
    results.append(("Insert Session", test_insert_session()))
    results.append(("Insert Package", test_insert_package()))
    results.append(("Query Linked Data", test_query_linked_data()))
    results.append(("SessionEngine", test_sessionengine()))
    
    print("\n" + "="*60)
    print("📊 RESUMO DOS TESTES")
    print("="*60)
    
    for test_name, passed in results:
        status = "✅ PASSOU" if passed else "❌ FALHOU"
        print(f"{status} - {test_name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    
    print(f"\nTotal: {passed}/{total} testes passaram")
    
    if passed == total:
        print("\n🎉 TUDO FUNCIONANDO!")
    else:
        print(f"\n⚠️ {total - passed} teste(s) falharam")
