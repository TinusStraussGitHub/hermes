import imaplib
import email
import email.utils
import re
import subprocess
import os
import json
from datetime import datetime, timezone

ZOHO_USER = 'tshermes1979@zohomail.com'
APPROVED_SENDERS = ['tinus.strauss2@bme.co.za', 'Christiaan.Liebenberg@bme.co.za']

def get_password():
    try:
        with open('/opt/data/home/hermes/zoho_password.txt', 'r') as f:
            password = f.read().strip()
        if '|' in password:
            password = password.split('|', 1)[1]
        return password
    except FileNotFoundError:
        return None

def extract_text_body(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body += part.get_payload(decode=True).decode('utf-8', errors='ignore')
    else:
        body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
    return body

def parse_quote_request(body):
    body_lower = body.lower()
    items = []
    for match in re.finditer(r'(\d+)\s*(?:[a-z]*\s*)?(STD|PREMIUM|FREE)', body, re.IGNORECASE):
        qty, ver = match.groups()
        items.append({"version": ver.upper(), "quantity": int(qty)})
    
    if not items:
        version_match = re.search(r'(PREMIUM|STD)', body, re.IGNORECASE)
        version = version_match.group(1).upper() if version_match else 'PREMIUM'
        quantity_match = re.search(r'(\d+)', body)
        quantity = int(quantity_match.group(1)) if quantity_match else 1
        items = [{"version": version, "quantity": quantity}]
    
    currency_usd_only = 'dollar only' in body_lower or 'usd only' in body_lower or '$' in body
    currency_zar_only = 'zar' in body_lower and 'rand' in body_lower and not currency_usd_only
    currency = 'usd' if currency_usd_only else ('zar' if currency_zar_only else 'both')
    
    client_match = re.search(r'[Nn]ame\s*[\n\r]+([\w\s]+)', body)
    client_name = client_match.group(1).strip() if client_match else 'Quote Request'
    
    return items, currency, client_name

def main():
    sast_hour = (datetime.now(timezone.utc).hour + 2) % 24
    working_hours = 7 <= sast_hour < 17
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    if not working_hours:
        print(f"BLASTMAP Quote Handler - {timestamp}")
        print(f"Current SAST hour: {sast_hour} (working hours: False)")
        print("\nOutside working hours - skipping check")
        return
    
    password = get_password()
    if not password:
        print(f"BLASTMAP Quote Handler - {timestamp}")
        print(f"Current SAST hour: {sast_hour} (working hours: True)")
        print("\nError: Could not retrieve Zoho password")
        return
    
    mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
    mail.login(ZOHO_USER, password)
    mail.select('INBOX')
    
    status, messages = mail.search(None, 'UNSEEN')
    email_ids = messages[0].split()
    
    processed = []
    errors = []
    
    for eid in email_ids:
        status, msg_data = mail.fetch(eid, '(RFC822)')
        for resp in msg_data:
            if isinstance(resp, tuple):
                msg = email.message_from_bytes(resp[1])
                sender = email.utils.parseaddr(msg['From'])[1]
                
                if not sender or sender.lower() not in [s.lower() for s in APPROVED_SENDERS]:
                    continue
                
                body = extract_text_body(msg)
                
                if 'blastmap' in body.lower() and 'quote' in body.lower():
                    try:
                        items, currency, client_name = parse_quote_request(body)
                        
                        history_path = '/opt/data/home/hermes/bme-quote/output/quote_history.json'
                        try:
                            with open(history_path, 'r') as f:
                                history = json.load(f)
                        except (FileNotFoundError, json.JSONDecodeError):
                            history = []
                        
                        if history:
                            last_num = max(int(h.get('quote_number', '0').replace('BMP-', '')) for h in history)
                            quote_num = f"BMP-{last_num + 1:04d}"
                        else:
                            quote_num = "BMP-0001"
                        
                        cmd = [
                            'python3', '/opt/data/home/hermes/bme-quote/generate_quote.py',
                            'generate',
                            f'--currency={currency}',
                            f'--client-name={client_name}',
                            f'--client-company={client_name}',
                            f'--items={json.dumps(items)}'
                        ]
                        
                        result = subprocess.run(cmd, capture_output=True, text=True, cwd='/opt/data/home/hermes/bme-quote')
                        
                        if result.returncode == 0:
                            pdf_path = f'/opt/data/home/hermes/bme-quote/output/{quote_num}.pdf'
                            if os.path.exists(pdf_path):
                                history.append({
                                    'quote_number': quote_num,
                                    'client_name': client_name,
                                    'items': items,
                                    'currency': currency,
                                    'sender': sender,
                                    'timestamp': timestamp
                                })
                                with open(history_path, 'w') as f:
                                    json.dump(history, f, indent=2)
                                processed.append({'sender': sender, 'quote_number': quote_num, 'items': items, 'currency': currency})
                            else:
                                errors.append(f"PDF not found after generation for {quote_num}")
                        else:
                            errors.append(f"Generation failed for email from {sender}: {result.stderr}")
                        
                        mail.store(eid, '+FLAGS', '\\Seen')
                        
                    except Exception as e:
                        errors.append(f"Error processing email from {sender}: {str(e)}")
                        mail.store(eid, '+FLAGS', '\\Seen')
    
    mail.logout()
    
    if not processed and not errors:
        print(f"BLASTMAP Quote Handler - {timestamp}")
        print(f"Current SAST hour: {sast_hour} (working hours: {working_hours})")
        print("\nNo new quote requests found")
        return
    
    print(f"BLASTMAP Quote Handler - {timestamp}")
    print(f"Current SAST hour: {sast_hour} (working hours: {working_hours})")
    print(f"\nProcessed: {len(processed)} quote request(s)")
    for p in processed:
        items_str = ', '.join(f"{i['quantity']} {i['version']}" for i in p['items'])
        print(f"  - {p['sender']}: {p['quote_number']} ({items_str}) - {p['currency']}")
    
    if errors:
        print(f"\nErrors: {len(errors)}")
        for e in errors:
            print(f"  - {e}")

if __name__ == '__main__':
    main()