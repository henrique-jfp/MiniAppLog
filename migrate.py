"""
🚀 Script para rodar migrations do Alembic
Execute com: python migrate.py
"""

import os
import sys
from alembic.config import Config
from alembic import command

def run_migrations():
    """Roda todas as migrations pendentes"""
    
    # Carrega variáveis de ambiente
    from dotenv import load_dotenv
    load_dotenv()
    
    # Pega DATABASE_URL
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ ERRO: DATABASE_URL não configurada!")
        print("Configure a variável de ambiente DATABASE_URL")
        return False
    
    # Converte postgres:// para postgresql:// se necessário
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
        print("🔄 Convertido postgres:// → postgresql://")
    
    print(f"✅ DATABASE_URL: {database_url[:50]}...")
    
    try:
        # Cria config do Alembic
        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option('sqlalchemy.url', database_url)
        
        print("\n🔍 Verificando migrations pendentes...")
        
        # Roda upgrade
        print("🚀 Rodando migrations...")
        command.upgrade(alembic_cfg, "head")
        
        print("\n✅ ✅ ✅ SUCESSO! Todas as migrations foram aplicadas!")
        return True
        
    except Exception as e:
        print(f"\n❌ ERRO ao rodar migrations: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)
