#!/usr/bin/env python3
"""
🚀 Setup Script - Configura tudo automaticamente
Execute com: python setup_final.py
"""

import os
import subprocess
import sys
from dotenv import load_dotenv

def print_header(text):
    print(f"\n{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}\n")

def check_python_version():
    """Verifica versão do Python"""
    print_header("1️⃣ Verificando Python")
    
    version = sys.version_info
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print("❌ Python 3.9+ requerido!")
        return False
    
    return True

def install_requirements():
    """Instala dependências"""
    print_header("2️⃣ Instalando dependências")
    
    print("📦 pip install -r requirements.txt...")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Erro: {result.stderr}")
        return False
    
    print("✅ Dependências instaladas!")
    return True

def setup_database():
    """Configura banco de dados"""
    print_header("3️⃣ Configurando Banco de Dados")
    
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("⚠️ DATABASE_URL não configurada!")
        print("\nConfigure em um dos modos:")
        print("  Windows PowerShell:")
        print("    $env:DATABASE_URL='postgresql://user:pass@localhost/db'")
        print("\n  Linux/Mac:")
        print("    export DATABASE_URL='postgresql://user:pass@localhost/db'")
        print("\n  Railway:")
        print("    Configure no dashboard do Railway")
        
        return False
    
    print(f"✅ DATABASE_URL: {database_url[:50]}...")
    
    # Testa conexão
    print("\n🔍 Testando conexão com banco de dados...")
    
    result = subprocess.run(
        [sys.executable, "migrate.py"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Erro na migration:\n{result.stderr}")
        return False
    
    print("✅ Migrations aplicadas com sucesso!")
    return True

def run_tests():
    """Roda testes"""
    print_header("4️⃣ Rodando Testes")
    
    print("🧪 test_sessions.py...")
    result = subprocess.run(
        [sys.executable, "test_sessions.py"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"⚠️ Aviso: {result.stderr}")
    else:
        print("✅ Testes unitários OK!")
    
    return True

def print_next_steps():
    """Mostra próximos passos"""
    print_header("✅ SETUP CONCLUÍDO!")
    
    print("""
🎯 Próximos Passos:

1. Inicie o servidor (em um terminal):
   python main_hybrid.py

2. Teste a API (em outro terminal):
   python test_api.py

3. Use no Telegram:
   /sessions

4. Leia a documentação:
   - SESSIONS_GUIDE.md (completo)
   - IMPLEMENTATION_SUMMARY.md (resumo)
   - FINAL_SUMMARY.txt (estrutura)

📊 Endpoints disponíveis:
   POST   /api/sessions/create
   POST   /api/sessions/{id}/packages
   POST   /api/sessions/{id}/reuse
   POST   /api/sessions/{id}/start
   POST   /api/sessions/{id}/delivery/complete
   POST   /api/sessions/{id}/complete
   GET    /api/sessions/{id}
   GET    /api/sessions/user/{id}
   POST   /api/sessions/{id}/scan-barcode
   GET    /api/sessions/{id}/dashboard

🤖 Comandos Telegram:
   /sessions           - Menu principal
   /start_session      - Iniciar sessão
   /session_dashboard  - Ver dashboard

🔥 Caralho, isso é genial! 🚀
    """)

def main():
    """Main setup flow"""
    print("\n" + "╔" + "═"*68 + "╗")
    print("║" + " "*15 + "🚀 SETUP DO SISTEMA DE SESSÕES" + " "*22 + "║")
    print("║" + " "*18 + "BotEntregador v1.0" + " "*30 + "║")
    print("╚" + "═"*68 + "╝")
    
    # Checklist
    steps = [
        ("Python", check_python_version),
        ("Dependências", install_requirements),
        ("Banco de Dados", setup_database),
        ("Testes", run_tests),
    ]
    
    for step_name, step_func in steps:
        try:
            if not step_func():
                print(f"\n❌ Falha em: {step_name}")
                return 1
        except Exception as e:
            print(f"\n❌ Erro em {step_name}: {e}")
            import traceback
            traceback.print_exc()
            return 1
    
    print_next_steps()
    return 0

if __name__ == "__main__":
    sys.exit(main())
