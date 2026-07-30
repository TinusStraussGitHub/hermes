#!/usr/bin/env python3
"""BLASTMAP Quote Email Handler - Checks for quote requests and generates quotes."""

import imaplib
import email
import email.utils
import re
import subprocess
import os
import smtplib
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone

# Configuration
ZOHO_USER = 'tshermes1979@zohomail.com'
ZOHO_PASSWORD_FILE = '/opt/data/home/hermes/zoho_password.txt'
APPROVED_SENDERS = ['tinus.strauss2@bme.co.za', 'Christiaan.Liebenberg@bme.co.za']
GENERATE_SCRIPT = '/opt/data/home/hermes/bme-quote/generate_quote.py'

def get_password():
    """Extract password from zoho_password.txt (may have '1|password' format)."""
    with open(ZOHO_PASSWORD_FILE, 'r') as f:
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
                payload = part.get_payload(decode=True)
                if payload:
                    body += payload.decode('utf-8', errors='ignore')
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode('utf-8', errors='ignore')
    return body

def parse_quote_request(body):
    """Parse email body for quote request details."""
    items = []
    
    # Multi-item extraction (handles "2 STD and 1 PREMIUM" style)
    for match in re.finditer(r'(\d+)\s*(?:[a-z]*\s*)?(STD|PREMIUM|FREE)', body, re.IGNORECASE):
        qty, ver = match.groups()
        items.append({"version": ver.upper(), "quantity": int(qty)})
    
    if not items:
        # Fallback to single item
        version_match = re.search(r'(PREMIUM|STD|FREE)', body, re.IGNORECASE)
        version = version_match.group(1).upper() if version_match else 'PREMIUM'
        quantity_match = re.search(r'(\d+)', body)
        quantity = int(quantity_match.group(1)) if quantity_match else 1
        items = [{"version": version, "quantity": quantity}]
    
    # VAT detection: default True unless explicitly disabled
    vat_disabled = 'no vat' in body.lower() or 'without vat' in body.lower()
    include_vat = not vat_disabled
    
    # Currency detection
    currency_usd_only = 'dollar only' in body.lower() or 'usd only' in body.lower() or '$' in body and 'zar' not in body.lower()
    currency_zar_only = 'zar' in body.lower() and 'rand' in body.lower() and not currency_usd_only
    currency = 'usd' if currency_usd_only else ('zar' if currency_zar_only else 'both')
    
    # Client name extraction
    client_match = re.search(r'[Nn]ame\s*[\n\r]+([\w\s]+)', body)
    client_name = client_match.group(1).strip() if client_match else 'Quote Request'
    
    # Company name extraction
    company_match = re.search(r'[Cc]ompany\s*[\n\r]+([\w\s]+)', body)
    client_company = company_match.group(1).strip() if company_match else client_name
    
    return items, include_vat, currency, client_name, client_company

def check_sent_folder(mail, quote_num):
    """Check if quote has already been sent to avoid duplicates."""
    try:
        mail.select('"Sent"')
        status, sent = mail.search(None, 'ALL')
        for sid in sent[0].split():
            status, msg_data = mail.fetch(sid, '(RFC822)')
            for resp in msg_data:
                if isinstance(resp, tuple) and f'BMP-{quote_num}' in str(resp):
                    return True
    except Exception as e:
        print(f"  Warning: Could not check Sent folder: {e}")
    return False

def send_quote_email(to_email, quote_result):
    """Send quote PDF via SMTP."""
    password = get_password()
    
    quote_num = quote_result['quote_number']
    total_usd = quote_result['total_usd']
    total_zar = quote_result['total_zar']
    valid_until = quote_result['valid_until']
    version = quote_result['items'][0]['version'] if quote_result['items'] else 'PREMIUM'
    quantity = quote_result['items'][0]['quantity'] if quote_result['items'] else 1
    
    # Check if already sent
    mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
    mail.login(ZOHO_USER, password)
    if check_sent_folder(mail, quote_num):
        print(f"  Quote {quote_num} already sent - skipping")
        mail.logout()
        return False
    mail.logout()
    
    # Build email
    msg = MIMEMultipart()
    msg['From'] = ZOHO_USER
    msg['To'] = to_email
    msg['Subject'] = f"BLASTMAP Quote {quote_num} - {quantity} {version} License(s) (USD/ZAR, No VAT)"
    
    body = f"Please find attached BLASTMAP quote {quote_num} for {quantity} {version} license(s).\n\nTotal: ${total_usd:,.2f} USD (R{total_zar:,.2f} ZAR)\n\nValid until: {valid_until}\n\nBest regards,\nBME Team"
    msg.attach(MIMEText(body, 'plain'))
    
    pdf_path = quote_result['pdf_path']
    if os.path.exists(pdf_path):
        with open(pdf_path, 'rb') as f:
            attach = MIMEApplication(f.read())
            attach.add_header('Content-Disposition', 'attachment', filename=os.path.basename(pdf_path))
            msg.attach(attach)
    else:
        print(f"  Warning: PDF not found at {pdf_path}")
        return False
    
    # Send email
    server = smtplib.SMTP('smtp.zoho.com', 587)
    server.starttls()
    server.login(ZOHO_USER, password)
    server.send_message(msg)
    server.quit()
    print(f"  Quote {quote_num} sent to {to_email}")
    return True

def main():
    sast_hour = (datetime.now(timezone.utc).hour + 2) % 24
    working_hours = 7 <= sast_hour < 17
    
    print(f"BLASTMAP Quote Handler - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Current SAST hour: {sast_hour} (working hours: {working_hours})")
    
    if not working_hours:
        print("\nOutside working hours - skipping email check")
        return
    
    password = get_password()
    
    # Connect to IMAP
    mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
    mail.login(ZOHO_USER, password)
    mail.select('INBOX')
    
    # Search for UNSEEN emails
    status, messages = mail.search(None, 'UNSEEN')
    
    processed = []
    for msgid in messages[0].split():
        if not msgid:
            continue
            
        status, msg_data = mail.fetch(msgid, '(RFC822)')
        
        for response_part in msg_data:
            if not isinstance(response_part, tuple):
                continue
                
            msg = email.message_from_bytes(response_part[1])
            
            # Extract sender
            sender = email.utils.parseaddr(msg['From'])[1]
            
            # Check if approved sender (case-insensitive)
            if sender.lower() not in [s.lower() for s in APPROVED_SENDERS]:
                print(f"  Unapproved sender: {sender}")
                continue
            
            # Extract body and check for quote keywords
            body = extract_text_body(msg)
            subject = msg.get('Subject', '')
            
            if 'blastmap' in body.lower() or 'blastmap' in subject.lower():
                if 'quote' in body.lower() or 'quote' in subject.lower():
                    print(f"  Processing quote request from {sender}")
                    
                    # Parse request
                    items, include_vat, currency, client_name, client_company = parse_quote_request(body)
                    
                    # Generate quote
                    result = subprocess.run([
                        'python3', GENERATE_SCRIPT, 'generate',
                        '--client-name', client_name,
                        '--client-company', client_company,
                        '--client-email', sender,
                        '--items', json.dumps(items),
                        '--no-vat',
                        '--currency', currency
                    ], capture_output=True, text=True)
                    
                    if result.returncode != 0:
                        print(f"  Error generating quote: {result.stderr}")
                        continue
                    
                    print(result.stdout)
                    
                    # Load the quote result
                    output_dir = '/opt/data/home/hermes/bme-quote/output'
                    history_file = os.path.join(output_dir, 'quote_history.json')
                    
                    # Find the latest quote
                    with open(history_file, 'r') as f:
                        history = json.load(f)
                    
                    latest_quote = history[-1]
                    
                    # Send the quote
                    send_quote_email(sender, latest_quote)
                    
                    processed.append({
                        'sender': sender,
                        'quote_number': latest_quote['quote_number'],
                        'items': items,
                        'currency': currency
                    })
                    
                    # Mark as Seen to prevent re-processing
                    mail.store(msgid, '+FLAGS', '\\Seen')
    
    mail.close()
    mail.logout()
    
    # Report
    if processed:
        print(f"\nProcessed: {len(processed)} quote request(s)")
        for p in processed:
            items_str = ', '.join([f"{i['quantity']}x {i['version']}" for i in p['items']])
            print(f"  - {p['sender']}: {p['quote_number']} ({items_str}) - {p['currency']}")
    else:
        print("\nNo new quote requests found")

if __name__ == '__main__':
    main()