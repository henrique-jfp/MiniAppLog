"""
🌐 Script para testar a API REST
Execute com: python test_api.py
Certifique que o servidor está rodando: python main_hybrid.py
"""

import requests
import json
import time

BASE_URL = "http://localhost:8080/api"

# Cores para output
GREEN = "\033[92m"
RED = "\033[91m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def print_test(name, passed, response=None):
    """Imprime resultado do teste"""
    status = f"{GREEN}✅ PASSOU{RESET}" if passed else f"{RED}❌ FALHOU{RESET}"
    print(f"{status} - {name}")
    if response and not passed:
        print(f"  Resposta: {response}")

def test_create_session():
    """Testa criação de sessão"""
    print(f"\n{BLUE}1️⃣ Testando POST /sessions/create{RESET}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/sessions/create",
            json={
                "user_id": 999,
                "session_type": "manual",
                "file_name": "test_romaneiro.csv"
            }
        )
        
        passed = response.status_code == 200
        print_test("Create Session", passed, response.json() if response.status_code != 200 else None)
        
        if passed:
            session_id = response.json()["session_id"]
            print(f"  Session ID: {YELLOW}{session_id}{RESET}")
            return session_id
        return None
        
    except Exception as e:
        print_test("Create Session", False, str(e))
        return None

def test_add_packages(session_id):
    """Testa adição de pacotes"""
    print(f"\n{BLUE}2️⃣ Testando POST /sessions/{{id}}/packages{RESET}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/sessions/{session_id}/packages",
            json={
                "packages": [
                    {
                        "barcode": "1111111111111",
                        "recipient_name": "João Silva",
                        "address": "Rua A, 123",
                        "value": 50.00
                    },
                    {
                        "barcode": "2222222222222",
                        "recipient_name": "Maria Santos",
                        "address": "Rua B, 456",
                        "value": 75.00
                    }
                ]
            }
        )
        
        passed = response.status_code == 200
        print_test("Add Packages", passed, response.json() if response.status_code != 200 else None)
        
        if passed:
            data = response.json()
            print(f"  Adicionados: {YELLOW}{data['added']}{RESET}")
            print(f"  Duplicatas: {YELLOW}{data['duplicates_skipped']}{RESET}")
        
        return passed
        
    except Exception as e:
        print_test("Add Packages", False, str(e))
        return False

def test_get_session(session_id):
    """Testa obtenção de dados da sessão"""
    print(f"\n{BLUE}3️⃣ Testando GET /sessions/{{id}}{RESET}")
    
    try:
        response = requests.get(f"{BASE_URL}/sessions/{session_id}")
        
        passed = response.status_code == 200
        print_test("Get Session", passed, response.json() if response.status_code != 200 else None)
        
        if passed:
            data = response.json()["data"]
            print(f"  Status: {YELLOW}{data['session']['status']}{RESET}")
            print(f"  Pacotes: {YELLOW}{len(data['packages'])}{RESET}")
            print(f"  Receita: R$ {YELLOW}{data['financial']['total_revenue']}{RESET}")
        
        return passed
        
    except Exception as e:
        print_test("Get Session", False, str(e))
        return False

def test_start_session(session_id):
    """Testa inicialização de sessão"""
    print(f"\n{BLUE}4️⃣ Testando POST /sessions/{{id}}/start{RESET}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/sessions/{session_id}/start",
            json={
                "deliverer_ids": [123, 456]
            }
        )
        
        passed = response.status_code == 200
        print_test("Start Session", passed, response.json() if response.status_code != 200 else None)
        
        if passed:
            data = response.json()["result"]
            print(f"  Status: {YELLOW}{data['status']}{RESET}")
            print(f"  Entregadores: {YELLOW}{data['deliverers']}{RESET}")
        
        return passed
        
    except Exception as e:
        print_test("Start Session", False, str(e))
        return False

def test_dashboard(session_id):
    """Testa dashboard da sessão"""
    print(f"\n{BLUE}5️⃣ Testando GET /sessions/{{id}}/dashboard{RESET}")
    
    try:
        response = requests.get(f"{BASE_URL}/sessions/{session_id}/dashboard")
        
        passed = response.status_code == 200
        print_test("Get Dashboard", passed, response.json() if response.status_code != 200 else None)
        
        if passed:
            data = response.json()
            print(f"  Progresso: {YELLOW}{data['progress']['percentage']}%{RESET}")
            print(f"  Lucro: R$ {YELLOW}{data['financial']['profit']}{RESET}")
        
        return passed
        
    except Exception as e:
        print_test("Get Dashboard", False, str(e))
        return False

def test_list_sessions():
    """Testa listagem de sessões"""
    print(f"\n{BLUE}6️⃣ Testando GET /sessions/user/{{id}}{RESET}")
    
    try:
        response = requests.get(f"{BASE_URL}/sessions/user/999")
        
        passed = response.status_code == 200
        print_test("List Sessions", passed, response.json() if response.status_code != 200 else None)
        
        if passed:
            data = response.json()
            print(f"  Total: {YELLOW}{data['total']}{RESET}")
        
        return passed
        
    except Exception as e:
        print_test("List Sessions", False, str(e))
        return False

def test_server_status():
    """Verifica status do servidor"""
    print(f"\n{BLUE}0️⃣ Verificando status do servidor{RESET}")
    
    try:
        response = requests.get("http://localhost:8080/api/status", timeout=5)
        
        passed = response.status_code == 200
        print_test("Server Status", passed)
        
        if not passed:
            print(f"  {YELLOW}Servidor não respondeu em http://localhost:8080{RESET}")
            print(f"  {YELLOW}Certifique que está rodando: python main_hybrid.py{RESET}")
        
        return passed
        
    except requests.exceptions.ConnectionError:
        print_test("Server Status", False, "Conexão recusada")
        print(f"  {YELLOW}Certifique que o servidor está rodando:{RESET}")
        print(f"  {YELLOW}python main_hybrid.py{RESET}")
        return False
    except Exception as e:
        print_test("Server Status", False, str(e))
        return False

# ==================== EXECUÇÃO ====================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🌐 TESTES DA API REST")
    print("="*60)
    
    # Testa servidor
    if not test_server_status():
        print(f"\n{RED}❌ Servidor não está rodando!{RESET}")
        print(f"{YELLOW}Inicie com: python main_hybrid.py{RESET}")
        exit(1)
    
    print(f"\n{GREEN}✅ Servidor respondendo!{RESET}")
    
    # Roda testes
    session_id = test_create_session()
    
    if session_id:
        test_add_packages(session_id)
        test_get_session(session_id)
        test_start_session(session_id)
        time.sleep(1)  # Pequeno delay
        test_dashboard(session_id)
        test_list_sessions()
    
    print("\n" + "="*60)
    print(f"{GREEN}✅ TESTES COMPLETOS!{RESET}")
    print("="*60)
