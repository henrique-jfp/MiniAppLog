import re

file_path = 'c:/MiniappRefatorado/bot_multidelivery/bot.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Top-Level Functions
functions_to_remove = [
    r'async def cmd_add_deliverer.*?parse_mode=\'HTML\'\s+\)',
    r'async def cmd_list_deliverers.*?msg\s+\+= f"- {d.name} \(ID: {d.telegram_id}\)\\n"',
    r'async def cmd_ranking.*?msg\s+\+= f"\[FIRE\] Streak: {personal_stats\[\'streak_days\'\]} dias\\n"',
    r'async def send_deliverer_summary.*?reply_markup=InlineKeyboardMarkup\(keyboard\)\)'
]

new_content = content

# Helper to remove functions (non-greedy execution is tricky with DOTALL)
# Instead of regex for complex functions, I will use known start/end markers if possible, 
# or just blank them out if I can identify exact strings.

# Let's try to remove by exact string match of the body if I had it. 
# But regex with dotall is better if I have distinct start/end.

patterns = [
    (r'async def cmd_add_deliverer\(.*?\):.*?"1️⃣ Nome completo do entregador\?",\s+parse_mode=\'HTML\'\s+\)', re.DOTALL),
    (r'async def cmd_list_deliverers\(.*?\):.*?for d in inactive:\s+msg \+= f"- \{d.name\} \(ID: \{d.telegram_id\}\)\\n"', re.DOTALL),
    (r'async def cmd_ranking\(.*?\):.*?msg \+= f"\[FIRE\] Streak: \{personal_stats\[\'streak_days\'\]\} dias\\n"', re.DOTALL),
    (r'async def send_deliverer_summary\(.*?\):.*?await target_message.reply_text\(msg, parse_mode=\'HTML\', reply_markup=InlineKeyboardMarkup\(keyboard\)\)', re.DOTALL)
]

for pattern, flags in patterns:
    # Check if pattern matches
    match = re.search(pattern, new_content, flags)
    if match:
        print(f"MATCHED: {pattern[:50]}...")
        new_content = re.sub(pattern, '', new_content, flags=flags)
    else:
        print(f"FAILED TO MATCH: {pattern[:50]}...")

# 2. Remove Code Blocks inside handle_admin_message
# Strategy: Look for specific 'if state == "adding_deliverer_name":' and remove until end of block.
# Since blocks end with 'return', we can use that.

blocks_admin = [
    r'if state == "adding_deliverer_name":.*?return',
    r'if state == "adding_deliverer_id":.*?return',
    r'if state == "adding_deliverer_cost":.*?return',
]

for pattern in blocks_admin:
    # Use NON-GREEDY match .*? to stop at first return
    # But wait, python blocks might have nested returns or strings.
    # Simple regex might be dangerous.
    
    # Let's try matches.
    match = re.search(pattern, new_content, re.DOTALL)
    if match:
         print(f"MATCHED BLOCK: {pattern[:30]}...")
         new_content = re.sub(pattern, '', new_content, flags=re.DOTALL)
    else:
         print(f"FAILED BLOCK: {pattern[:30]}...")

# 3. Remove Code Blocks inside handle_callback_query
blocks_callback = [
    r'elif data.startswith\("add_partner_"\):.*?edit_message_text\(\s+"\[DINHEIRO\].*?parse_mode=\'HTML\'\s+\)',
    r'elif data == "confirm_add_deliverer":.*?Peça para ele dar /start no bot!",\s+parse_mode=\'HTML\'\s+\)'
    # Note: I'm skipping cancel_add_deliverer because it was defined inline or missed in my manual scan?
    # I saw it in the file.
]

# I need to be more precise.
# Let's write the result
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
