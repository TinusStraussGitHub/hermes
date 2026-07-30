#!/bin/bash
# BLASTMAP Quote Handler - Check INBOX for quote requests and process

python3 << 'PYTHON_SCRIPT'
import imaplib
import email
import re
import json
import subprocess
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone, timedelta

ZOHO_USER = 'tshermes1979@zohomail.com'
ZOHO_PASSWORD = 'cbq48WSUrGYa'
APPROVED_SENDERS = ['tinus.strauss2@bme.co.za', 'Christiaan.Liebenberg@bme.co.za']

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
    items = []
    for match in re.finditer(r'(\d+)\s*(?:[a-z]*\s*)(STD|PREMIUM|FREE)', body, re.IGNORECASE):
        qty, ver = match.groups()
        items.append({"version": ver.upper(), "quantity": int(qty)})
    
    if not items:
        version_match = re.search(r'(PREMIUM|STD|FREE)', body, re.IGNORECASE)
        version = version_match.group(1).upper() if version_match else 'PREMIUM'
        quantity_match = re.search(r'(\d+)', body)
        quantity = int(quantity_match.group(1)) if quantity_match else 1
        items = [{"version": version, "quantity": quantity}]
    
    vat_disabled = 'no vat' in body.lower() or 'without vat' in body.lower()
    
    currency_usd_only = 'usd only' in body.lower() or 'dollar only' in body.lower() or '$' in body
    currency_zar_only = ('zar' in body.lower() or 'rand' in body.lower()) and not currency_usd_only
    
    if currency_usd_only:
        currency = 'usd'
    elif currency_zar_only:
        currency = 'zar'
    else:
        currency = 'both'
    
    client_match = re.search(r'[Nn]ame\s*[\n\r]+([\w\s]+)', body)
    client_name = client_match.group(1).strip() if client_match else 'Quote Request'
    
    return items, currency, vat_disabled, client_name

def generate_quote(items, currency, client_name, vat_disabled):
    items_str = json.dumps(items)
    cmd = [
        'python3', '/opt/data/home/hermes/bme-quote/generate_quote.py', 'generate',
        '--currency', currency, '--client-name', client_name, '--client-company', client_name,
        '--items', items_str
    ]
    if vat_disabled:
        cmd.append('--no-vat')
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd='/opt/data/home/hermes/bme-quote/output')
    print(result.stdout)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None
    
    # Load the generated quote from history
    try:
        with open('/opt/data/home/hermes/bme-quote/output/quote_history.json', 'r') as f:
            history = json.load(f)
            return history[-1] if history else None
    except:
        return None

def main():
    sast_hour = (datetime.now(timezone.utc).hour + 2) % 24
    working_hours = 7 <= sast_hour < 17
    
    print(f"BLASTMAP Quote Handler - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Current SAST hour: {sast_hour} (working hours: {working_hours})")
    
    if not working_hours:
        print("\nOutside working hours - skipping processing")
        return
    
    processed = []
    
    try:
        mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
        mail.login(ZOHO_USER, ZOHO_PASSWORD)
        mail.select('INBOX')
        
        status, messages = mail.search(None, 'UNSEEN')
        email_ids = messages[0].split()
        
        if not email_ids:
            print("\nNo new quote requests found")
        else:
            print(f"\nFound {len(email_ids)} unread email(s)")
            for eid in email_ids:
                status, msg_data = mail.fetch(eid, '(RFC822)')
                for resp in msg_data:
                    if isinstance(resp, tuple):
                        msg = email.message_from_bytes(resp[1])
                        sender = email.utils.parseaddr(msg['From'])[1]
                        
                        if sender and sender.lower() in [s.lower() for s in APPROVED_SENDERS]:
                            body = extract_text_body(msg)
                            if 'blastmap' in body.lower() and 'quote' in body.lower():
                                items, currency, vat_disabled, client_name = parse_quote_request(body)
                                
                                for item in items:
                                    quote = generate_quote([item], currency, client_name, vat_disabled)
                                    if quote:
                                        processed.append({
                                            'sender': sender,
                                            'quote': quote,
                                            'item': item
                                        })
                                        # Mark as Seen to prevent re-processing
                                        mail.store(eid, '+FLAGS', '\\Seen')
        
        mail.close()
        mail.logout()
        
        if processed:
            print(f"\nProcessed: {len(processed)} quote request(s)")
            for p in processed:
                q = p['quote']
                i = p['item']
                print(f"  - {p['sender']}: {q['quote_number']} ({i['version']} x {i['quantity']}) - {q['currency']}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
PYTHON_SCRIPT