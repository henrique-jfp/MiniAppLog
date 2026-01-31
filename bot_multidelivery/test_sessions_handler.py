"""
🧪 TESTE SIMPLES - Para usar no Telegram sem tabelas
Cria um handler de teste que valida tudo
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
import logging

logger = logging.getLogger(__name__)

async def cmd_test_sessions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Comando de teste: /test_sessions
    Testa se o sistema de sessões está funcionando
    """
    user_id = update.effective_user.id
    
    try:
        # Teste 1: Verificar DATABASE_URL
        import os
        db_url = os.getenv('DATABASE_URL')
        
        test_results = []
        
        if db_url:
            test_results.append("✅ DATABASE_URL configurada")
        else:
            test_results.append("❌ DATABASE_URL não configurada")
            
        # Teste 2: Verificar conexão com banco
        try:
            from bot_multidelivery.database import db_manager
            db = db_manager.SessionLocal()
            db.execute("SELECT 1")
            test_results.append("✅ Conexão com PostgreSQL OK")
            db.close()
        except Exception as e:
            test_results.append(f"❌ Erro ao conectar: {str(e)[:50]}")
        
        # Teste 3: Verificar tabelas
        try:
            from sqlalchemy import inspect
            from bot_multidelivery.database import db_manager
            
            inspector = inspect(db_manager.engine)
            tables = inspector.get_table_names()
            
            required = ['delivery_sessions', 'session_packages', 'session_audit']
            found = len([t for t in required if t in tables])
            
            if found == len(required):
                test_results.append(f"✅ Tabelas de sessão criadas ({found}/{len(required)})")
            else:
                test_results.append(f"⚠️ Tabelas: {found}/{len(required)} (execute: python migrate.py)")
                
        except Exception as e:
            test_results.append(f"❌ Erro ao verificar tabelas: {str(e)[:50]}")
        
        # Teste 4: Verificar SessionEngine
        try:
            from bot_multidelivery.services.session_engine import SessionEngine
            test_results.append("✅ SessionEngine importável")
        except Exception as e:
            test_results.append(f"❌ SessionEngine erro: {str(e)[:50]}")
        
        # Teste 5: Verificar BarcodeOCR
        try:
            from bot_multidelivery.services.barcode_ocr_service import BarcodeOCRService
            test_results.append("✅ BarcodeOCRService importável")
        except Exception as e:
            test_results.append(f"❌ BarcodeOCR erro: {str(e)[:50]}")
        
        # Montaa mensagem
        msg = (
            f"🧪 *TESTE DO SISTEMA DE SESSÕES*\n\n"
            f"*Resultados:*\n"
        )
        
        for result in test_results:
            msg += f"{result}\n"
        
        msg += (
            f"\n*Status:*\n"
            f"👤 User ID: `{user_id}`\n"
            f"🌍 Railway: Online\n"
        )
        
        # Verifica se pode usar /sessions
        if "Tabelas: 3/3" in test_results[-1] or "criadas" in test_results[-1]:
            msg += f"\n✅ Pronto! Use: /sessions"
            keyboard = [[InlineKeyboardButton("🎯 Ir para /sessions", callback_data="goto_sessions")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
        else:
            msg += f"\n⚠️ Precisa executar no servidor:\n`python migrate.py`"
            reply_markup = None
        
        await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(
            f"❌ Erro no teste:\n`{str(e)}`",
            parse_mode="Markdown"
        )
        logger.error(f"Erro em test_sessions: {e}", exc_info=True)


async def test_sessions_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback para ir para /sessions após teste"""
    query = update.callback_query
    await query.answer()
    await query.delete_message()
    
    # Chama o handler de sessions
    from .session_handlers import cmd_sessions
    await cmd_sessions(query, context)
