"""
🔥 HANDLERS DE SESSÃO - Integração com o Telegram Bot
Gerencia: criar sessão, adicionar pacotes, iniciar, entregar, finalizar
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, ConversationHandler
from sqlalchemy.orm import Session
import logging
import json

from .services.session_engine import SessionEngine
from .database import db_manager

logger = logging.getLogger(__name__)

# Estados da conversa
CHOOSING_SESSION_ACTION = 1
ADDING_PACKAGES = 2
SELECTING_DELIVERERS = 3


async def cmd_sessions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Comando /sessions - Menu principal de gerenciamento de sessões
    """
    user_id = update.effective_user.id
    
    keyboard = [
        [
            InlineKeyboardButton("➕ Nova Sessão", callback_data="new_session"),
            InlineKeyboardButton("📂 Minhas Sessões", callback_data="list_sessions")
        ],
        [
            InlineKeyboardButton("🔄 Reutilizar", callback_data="reuse_session"),
            InlineKeyboardButton("📊 Dashboard", callback_data="open_dashboard")
        ]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🎯 *Gerenciador de Sessões de Entrega*\n\n"
        "O que você quer fazer?\n"
        "• *Nova Sessão*: Cria uma nova rodada de entregas\n"
        "• *Minhas Sessões*: Vê todas suas sessões\n"
        "• *Reutilizar*: Abre uma sessão existente que ainda não foi iniciada\n"
        "• *Dashboard*: Acompanha entregas em tempo real",
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )


async def new_session_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Cria uma nova sessão vazia pronta para receber pacotes
    """
    user_id = update.effective_user.id
    query = update.callback_query
    await query.answer()
    
    try:
        db: Session = db_manager.SessionLocal()
        engine = SessionEngine(db)
        
        session_id = engine.create_session(
            user_id=user_id,
            session_type="telegram"
        )
        
        # Salva no context para usar depois
        context.user_data["current_session_id"] = session_id
        
        await query.edit_message_text(
            f"✅ *Sessão Criada!*\n\n"
            f"🆔 ID: `{session_id}`\n\n"
            f"Agora você pode:\n"
            f"1️⃣ Enviar arquivo CSV com pacotes\n"
            f"2️⃣ Adicionar pacotes manualmente\n"
            f"3️⃣ Iniciar a sessão\n\n"
            f"Use /add_packages para enviar dados",
            parse_mode="Markdown"
        )
        
        db.close()
    
    except Exception as e:
        logger.error(f"Erro ao criar sessão: {e}")
        await query.edit_message_text(f"❌ Erro: {e}")


async def list_sessions_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Lista todas as sessões do usuário agrupadas por status
    """
    user_id = update.effective_user.id
    query = update.callback_query
    await query.answer()
    
    try:
        db: Session = db_manager.SessionLocal()
        
        from schemas.sessions_schema import DeliverySession
        
        sessions = db.query(DeliverySession).filter_by(user_id=user_id).all()
        
        if not sessions:
            await query.edit_message_text("Você não tem sessões ainda.")
            db.close()
            return
        
        # Agrupa por status
        by_status = {}
        for s in sessions:
            status = s.status
            if status not in by_status:
                by_status[status] = []
            by_status[status].append(s)
        
        # Monta mensagem
        text = "*📋 Suas Sessões*\n\n"
        
        status_emoji = {
            "open": "🔵",
            "active": "🟢",
            "completed": "🟣",
            "paused": "🟡"
        }
        
        for status, session_list in by_status.items():
            emoji = status_emoji.get(status, "⚪")
            text += f"{emoji} *{status.upper()}* ({len(session_list)})\n"
            
            for s in session_list[:5]:  # Mostra até 5 por status
                text += (
                    f"  • `{s.session_id[:8]}...` "
                    f"| 📦 {s.total_packages} pacotes "
                    f"| 💰 R$ {s.total_profit:.2f}\n"
                )
        
        # Botões para ações rápidas
        keyboard = [
            [InlineKeyboardButton("🔄 Reutilizar", callback_data="reuse_session"),
             InlineKeyboardButton("🆕 Nova", callback_data="new_session")]
        ]
        
        await query.edit_message_text(
            text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
        
        db.close()
    
    except Exception as e:
        logger.error(f"Erro ao listar sessões: {e}")
        await query.edit_message_text(f"❌ Erro: {e}")


async def reuse_session_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Abre uma sessão em estado OPEN para reutilização
    """
    user_id = update.effective_user.id
    query = update.callback_query
    await query.answer()
    
    try:
        db: Session = db_manager.SessionLocal()
        
        from schemas.sessions_schema import DeliverySession
        
        # Busca sessões abertas
        open_sessions = db.query(DeliverySession).filter(
            DeliverySession.user_id == user_id,
            DeliverySession.status == "open"
        ).all()
        
        if not open_sessions:
            await query.edit_message_text(
                "❌ Você não tem sessões abertas (OPEN) para reutilizar."
            )
            db.close()
            return
        
        # Cria botões para cada sessão
        keyboard = []
        for s in open_sessions[:10]:
            btn_text = f"📦 {s.total_packages} pacotes"
            btn_data = f"reuse_select_{s.session_id}"
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=btn_data)])
        
        await query.edit_message_text(
            "🔄 *Qual sessão você quer reutilizar?*\n\n"
            "(Selecione uma sessão aberta)",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
        
        db.close()
    
    except Exception as e:
        logger.error(f"Erro ao buscar sessões para reutilizar: {e}")
        await query.edit_message_text(f"❌ Erro: {e}")


async def reuse_session_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Seleciona uma sessão específica para reutilizar
    """
    query = update.callback_query
    await query.answer()
    
    # Extrai o ID da sessão
    session_id = query.data.split("reuse_select_")[1]
    
    # Salva no context
    context.user_data["current_session_id"] = session_id
    
    try:
        db: Session = db_manager.SessionLocal()
        engine = SessionEngine(db)
        
        result = engine.reuse_session_before_start(session_id)
        
        await query.edit_message_text(
            f"✅ *Sessão Reutilizada!*\n\n"
            f"🔄 Uso #{result['reuse_count']}\n"
            f"📦 Pacotes atuais: {result['current_packages']}\n\n"
            f"Você pode:\n"
            f"• Adicionar mais pacotes\n"
            f"• Iniciar a distribuição\n\n"
            f"Use /start_session para iniciar",
            parse_mode="Markdown"
        )
        
        db.close()
    
    except Exception as e:
        logger.error(f"Erro ao reutilizar sessão: {e}")
        await query.edit_message_text(f"❌ Erro: {e}")


async def cmd_start_session(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Inicia uma sessão (muda status de OPEN para ACTIVE)
    """
    session_id = context.user_data.get("current_session_id")
    
    if not session_id:
        await update.message.reply_text(
            "❌ Selecione uma sessão primeiro!\nUse /sessions"
        )
        return
    
    try:
        db: Session = db_manager.SessionLocal()
        
        from schemas.sessions_schema import DeliverySession
        
        session = db.query(DeliverySession).filter_by(session_id=session_id).first()
        
        if not session:
            await update.message.reply_text("❌ Sessão não encontrada")
            db.close()
            return
        
        # Mostra estatísticas antes de iniciar
        await update.message.reply_text(
            f"📊 *Resumo da Sessão*\n\n"
            f"🔵 Status: {session.status}\n"
            f"📦 Total de pacotes: {session.total_packages}\n"
            f"♻️ Reutilização: {'Sim' if session.was_reused else 'Não'}\n"
            f"🔄 Uso #{session.reuse_count}\n\n"
            f"Envie a lista de entregadores (IDs separados por vírgula):\n"
            f"Ex: `123, 456, 789`",
            parse_mode="Markdown"
        )
        
        context.user_data["awaiting_deliverers"] = True
        
        db.close()
    
    except Exception as e:
        logger.error(f"Erro ao iniciar sessão: {e}")
        await update.message.reply_text(f"❌ Erro: {e}")


async def handle_deliverer_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Processa a entrada de IDs de entregadores
    """
    if not context.user_data.get("awaiting_deliverers"):
        return
    
    session_id = context.user_data.get("current_session_id")
    message_text = update.message.text
    
    try:
        # Extrai IDs
        deliverer_ids = [
            int(x.strip()) for x in message_text.split(",")
            if x.strip().isdigit()
        ]
        
        if not deliverer_ids:
            await update.message.reply_text(
                "❌ Nenhum ID de entregador encontrado.\n"
                "Digite IDs separados por vírgula"
            )
            return
        
        db: Session = next(get_db())
        engine = SessionEngine(db)
        
        result = engine.start_session(session_id, deliverer_ids)
        
        context.user_data["awaiting_deliverers"] = False
        
        await update.message.reply_text(
            f"🚀 *Sessão Iniciada!*\n\n"
            f"✅ Entregadores: {result['deliverers']}\n"
            f"📦 Pacotes: {result['packages']}\n"
            f"Status: {result['status']}\n\n"
            f"Entregas em andamento... Use /dashboard para acompanhar",
            parse_mode="Markdown"
        )
        
        db.close()
    
    except Exception as e:
        logger.error(f"Erro ao processar entregadores: {e}")
        await update.message.reply_text(f"❌ Erro: {e}")


async def cmd_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Mostra dashboard da sessão em tempo real
    """
    session_id = context.user_data.get("current_session_id")
    
    if not session_id:
        await update.message.reply_text("❌ Selecione uma sessão primeiro!")
        return
    
    try:
        db: Session = db_manager.SessionLocal()
        engine = SessionEngine(db)
        
        data = engine.get_session_with_links(session_id)
        
        packages = data["packages"]
        deliverers = data["deliverers"]
        financial = data["financial"]
        
        delivered = len([p for p in packages if p["status"] == "delivered"])
        pending = len([p for p in packages if p["status"] == "pending"])
        progress = (delivered / len(packages) * 100) if packages else 0
        
        message = (
            f"📊 *Dashboard da Sessão*\n\n"
            f"🔵 Status: {data['session']['status'].upper()}\n"
            f"⏱️ Criada: {data['session']['created_at']}\n\n"
            f"📦 *Progresso de Entrega*\n"
            f"  ✅ Entregues: {delivered}\n"
            f"  ⏳ Pendentes: {pending}\n"
            f"  📈 Progresso: {progress:.1f}%\n\n"
            f"💰 *Financeiro*\n"
            f"  💵 Receita: R$ {financial['total_revenue']:.2f}\n"
            f"  💸 Custos: R$ {financial['total_cost']:.2f}\n"
            f"  📊 Lucro: R$ {financial['total_profit']:.2f}\n"
            f"  👥 Pagamento: R$ {sum(d['total_earned'] for d in deliverers):.2f}\n\n"
            f"👷 *Entregadores*: {len(deliverers)}\n"
        )
        
        # Detalhes de entregadores
        for d in deliverers[:3]:
            message += f"  • ID {d['id']}: {d['packages_delivered']} entregas (R$ {d['total_earned']:.2f})\n"
        
        await update.message.reply_text(message, parse_mode="Markdown")
        
        db.close()
    
    except Exception as e:
        logger.error(f"Erro ao carregar dashboard: {e}")
        await update.message.reply_text(f"❌ Erro: {e}")
