import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

# Configuração de Logs
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger("HybridServer")

# Importa o bot (Cérebro)
from bot_multidelivery.bot import create_application, BotConfig

# Variável global para o bot
bot_app = None

@asynccontextmanager
async def lifespan(server: FastAPI):
    """Gerencia o ciclo de vida do Servidor + Bot"""
    global bot_app
    
    # --- STARTUP ---
    logger.info("🚀 [HYBRID] Iniciando Servidor Híbrido (FastAPI + Telegram)...")
    
    # 1. Cria a aplicação do Bot
    bot_app = create_application()
    
    if bot_app:
        # 2. Inicializa o bot
        await bot_app.initialize()
        await bot_app.start()
        
        # 3. Inicia o Polling (em background)
        # O Polling roda no loop de eventos do FastAPI
        logger.info("🧠 [BOT] Iniciando Polling do Telegram...")
        await bot_app.updater.start_polling(drop_pending_updates=True, allowed_updates=["message", "callback_query"])
        
        logger.info("✅ [OK] Sistema Operacional e Pronto!")
    else:
        logger.error("❌ [ERRO] Falha ao criar aplicação do Bot (Token ausente?)")

    yield
    
    # --- SHUTDOWN ---
    logger.info("🛑 [HYBRID] Desligando sistema...")
    
    if bot_app:
        logger.info("💤 [BOT] Parando Polling...")
        await bot_app.updater.stop()
        logger.info("💤 [BOT] Parando App...")
        await bot_app.stop()
        await bot_app.shutdown()
        logger.info("✅ [OK] Bot desligado com segurança.")

# Cria o servidor FastAPI
app = FastAPI(title="BotEntregador MiniApp API", version="1.0.0", lifespan=lifespan)

# --- ROTAS DA API ---
@app.get("/api/status")
async def get_status():
    """Retorna status do bot e do servidor"""
    is_bot_running = bot_app and bot_app.updater and bot_app.updater.running
    return {
        "server": "running",
        "bot_polling": is_bot_running
    }

# --- SERVING DO FRONTEND (REACT) ---
# Em produção, o frontend estará compilado em 'webapp/dist'
if os.path.exists("webapp/dist"):
    # Monta arquivos estáticos (CSS, JS, Imagens)
    app.mount("/assets", StaticFiles(directory="webapp/dist/assets"), name="assets")
    
    # Serve o index.html para qualquer outra rota (SPA Fallback)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Se for arquivo específico que existe no root do dist (ex: favicon.ico), serve ele.
        possible_file = os.path.join("webapp/dist", full_path)
        if os.path.isfile(possible_file):
             return FileResponse(possible_file)
             
        # Se não, retorna o index.html (React router cuida do resto)
        return FileResponse("webapp/dist/index.html")
else:
    @app.get("/")
    async def root():
        return {
            "status": "online",
            "message": "Backend Híbrido rodando! Compile o Frontend (webapp) para ver a interface."
        }

if __name__ == "__main__":
    # Roda o servidor na porta 8000 (ou PORT do ambiente)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main_hybrid:app", host="0.0.0.0", port=port, reload=False)
