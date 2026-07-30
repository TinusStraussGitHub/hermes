import imaplib
import email
import re
import subprocess
import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone, timedelta

ZOHO_USER = 'tshermes1979@zohomail.com'
PASSWORD_FILE = '/opt/data/home/hermes/zoho_password.txt'
APPROVED_SENDERS = ['tinus.strauss2@bme.co.za', 'Christiaan.Liebenberg@bme.co.za']

def get_password():
    """Extract password from zoho_password.txt (may have '1|password' format)."""
    with open(PASSWORD_FILE, 'r') as f:
        password = f.read().strip()
    if '|' in password:
        password = password.split('|', 1)[1]
    return password

def extract_text_body(msg):
    """Extract plain text body from email message."""
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body += part.get_payload(decode=True).decode('utf-8', errors='ignore')
    else:
        body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
    return body

def parse_quote_request(body):
    """Parse version, quantity, currency from email body."""
    items = []
    
    # Multi-item extraction
    for match in re.finditer(r'(\d+)\s*(?:[a-z]*\s*)?(STD|PREMIUM|FREE)', body, re.IGNORECASE):
        qty, ver = match.groups()
        items.append({"version": ver.upper(), "quantity": int(qty)})
    
    if not items:
        # Fallback to single item
        version_match = re.search(r'(PREMIUM|STD)', body, re.IGNORECASE)
        version = version_match.group(1).upper() if version_match else 'PREMIUM'
        quantity_match = re.search(r'(\d+)', body)
        quantity = int(quantity_match.group(1)) if quantity_match else 1
        items = [{"version": version, "quantity": quantity}]
    
    # VAT/Currency detection
    vat_disabled = 'no vat' in body.lower() or 'without vat' in body.lower()
    include_vat = not vat_disabled
    
    currency_usd_only = 'dollar only' in body.lower() or 'usd only' in body.lower() or '$' in body
    currency_zar_only = 'zar' in body.lower() and 'rand' in body.lower() and not currency_usd_only
    currency = 'usd' if currency_usd_only else ('zar' if currency_zar_only else 'both')
    
    # Client name extraction
    client_match = re.search(r'[Nn]ame\s*[\n\r]+([\w\s]+)', body)
    client_name = client_match.group(1).strip() if client_match else 'Quote Request'
    
    return items, currency, client_name

def check_sent_folder(quote_num):
    """Check if quote was already sent to avoid duplicates."""
    password = get_password()
    mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
    mail.login(ZOHO_USER, password)
    mail.select('"Sent"')
    status, sent = mail.search(None, 'ALL')
    for sid in sent[0].split():
        status, msg_data = mail.fetch(sid, '(RFC822)')
        for resp in msg_data:
            if isinstance(resp, tuple) and f'BMP-{quote_num}' in str(resp):
                mail.logout()
                return True
    mail.logout()
    return False

def generate_quote(items, currency, client_name, quote_num):
    """Generate quote PDF using the generate_quote.py script."""
    items_json = json.dumps(items)
    cmd = [
        'python3', 
        '/opt/data/home/hermes/bme-quote/generate_quote.py',
        'generate',
        '--currency', currency,
        '--client-name', client_name,
        '--client-company', client_name,
        '--items', items_json
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0

def send_quote_email(to_email, quote_num, items, pdf_path, currency):
    """Send quote PDF via SMTP."""
    password = get_password()
    
    # Calculate totals
    total_usd = sum(i["quantity"] * (100 if i["version"] == "PREMIUM" else 50) for i in items)
    total_zar = int(total_usd * 18.5)  # Approximate exchange rate
    valid_until = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    
    msg = MIMEMultipart()
    msg['From'] = ZOHO_USER
    msg['To'] = to_email
    
    version_str = ', '.join([f"{i['quantity']} {i['version']}" for i in items])
    msg['Subject'] = f"BLASTMAP Quote {quote_num} - {version_str} License(s) (USD/ZAR, No VAT)"
    
    body = f"Please find attached BLASTMAP quote {quote_num} for {version_str} license(s).\n\nTotal: ${total_usd} USD (R{total_zar} ZAR)\n\nValid until: {valid_until}"
    msg.attach(MIMEText(body, 'plain'))
    
    with open(pdf_path, 'rb') as f:
        attach = MIMEApplication(f.read())
        attach.add_header('Content-Disposition', 'attachment', filename=os.path.basename(pdf_path))
        msg.attach(attach)
    
    server = smtplib.SMTP('smtp.zoho.com', 587)
    server.starttls()
    server.login(ZOHO_USER, password)
    server.send_message(msg)
    server.quit()
    return True

def main():
    sast_hour = (datetime.now(timezone.utc).hour + 2) % 24
    working_hours = 7 <= sast_hour < 17
    
    print(f"BLASTMAP Quote Handler - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Current SAST hour: {sast_hour} (working hours: {working_hours})")
    
    if not working_hours:
        print("\nOutside working hours - skipping email processing")
        return "No new quote requests found"
    
    password = get_password()
    mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
    mail.login(ZOHO_USER, password)
    mail.select('INBOX')
    
    # Search for UNSEEN emails
    status, messages = mail.search(None, 'UNSEEN')
    processed = []
    
    for eid in messages[0].split():
        status, msg_data = mail.fetch(eid, '(RFC822)')
        for resp in msg_data:
            if isinstance(resp, tuple):
                msg = email.message_from_bytes(resp[1])
                sender = email.utils.parseaddr(msg['From'])[1]
                
                if sender.lower() in [s.lower() for s in APPROVED_SENDERS]:
                    body = extract_text_body(msg).lower()
                    if 'blastmap' in body and 'quote' in body:
                        items, currency, client_name = parse_quote_request(extract_text_body(msg))
                        
                        # Generate quote
                        date_str = msg['Date'] if msg['Date'] else ''
                        quote_hash = hash(date_str + str(sender)) % 10000
                        quote_num = f"BMP-{quote_hash:04d}"
                        pdf_path = f"/opt/data/home/hermes/bme-quote/output/{quote_num}.pdf"
                        
                        if generate_quote(items, currency, client_name, quote_num):
                            if os.path.exists(pdf_path):
                                send_quote_email(sender, quote_num, items, pdf_path, currency)
                                processed.append({
                                    "sender": sender,
                                    "quote_num": quote_num,
                                    "items": items,
                                    "currency": currency
                                })
                                mail.store(eid, '+FLAGS', '\\Seen')
    
    mail.logout()
    
    if processed:
        print(f"\nProcessed: {len(processed)} quote request(s)")
        for p in processed:
            item = p['items'][0]
            print(f"  - {p['sender']}: {p['quote_num']} ({item['version']} x {item['quantity']}) - {p['currency']}")
    else:
        print("\nNo new quote requests found")

if __name__ == '__main__':
    main()