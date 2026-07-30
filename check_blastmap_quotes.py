import imaplib
import email
import re
import subprocess
import os
import smtplib
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone

ZOHO_USER = 'tshermes1979@zohomail.com'

def get_password():
    """Extract password from zoho_password.txt."""
    with open('/opt/data/home/hermes/zoho_password.txt', 'r') as f:
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

def generate_quote(items, client_name, currency):
    """Generate quote PDF."""
    items_json = json.dumps(items)
    cmd = f'python3 /opt/data/home/hermes/bme-quote/generate_quote.py generate --currency {currency} --client-name "{client_name}" --client-company "Quote Request" --items \'{items_json}\''
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout, result.stderr

def send_quote_email(to_email, quote_num, version, quantity, pdf_path, total_usd, total_zar, valid_until, currency):
    """Send quote PDF via SMTP."""
    password = get_password()
    
    # Check Sent folder to avoid duplicates
    if check_sent_folder(quote_num):
        print(f"Quote {quote_num} already sent - skipping")
        return False
    
    # Send email
    msg = MIMEMultipart()
    msg['From'] = ZOHO_USER
    msg['To'] = to_email
    msg['Subject'] = f"BLASTMAP Quote {quote_num} - {quantity} {version} License(s) (USD/ZAR, No VAT)"
    
    body = f"Please find attached BLASTMAP quote {quote_num} for {quantity} {version} license(s).\n\nTotal: ${total_usd} USD (R{total_zar} ZAR)\n\nValid until: {valid_until}"
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
    # Time check
    sast_hour = (datetime.now(timezone.utc).hour + 2) % 24
    working_hours = 7 <= sast_hour < 17
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    print(f"BLASTMAP Quote Handler - {timestamp}")
    print(f"Current SAST hour: {sast_hour} (working hours: {working_hours})")
    
    if not working_hours:
        print("\nOutside working hours - skipping email check")
        return
    
    APPROVED_SENDERS = ['tinus.strauss2@bme.co.za', 'christiaan.liebenberg@bme.co.za']
    
    # Connect to IMAP
    password = get_password()
    mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
    mail.login(ZOHO_USER, password)
    mail.select('INBOX')
    
    # Search for UNSEEN emails
    status, messages = mail.search(None, 'UNSEEN')
    email_ids = messages[0].split()
    
    processed_count = 0
    
    for eid in email_ids:
        status, msg_data = mail.fetch(eid, '(RFC822)')
        for resp in msg_data:
            if isinstance(resp, tuple):
                msg = email.message_from_bytes(resp[1])
                
                # Get sender
                sender = email.utils.parseaddr(msg['From'])[1]
                if not sender:
                    sender = msg['From']
                
                # Check if sender is approved (case-insensitive)
                if sender.lower() not in [s.lower() for s in APPROVED_SENDERS]:
                    continue
                
                # Check if this is a quote request
                body = extract_text_body(msg)
                if 'blastmap' not in body.lower() or 'quote' not in body.lower():
                    continue
                
                # Extract version and quantity
                version_match = re.search(r'(PREMIUM|STD)', body, re.IGNORECASE)
                version = version_match.group(1).upper() if version_match else 'PREMIUM'
                
                quantity_match = re.search(r'(\d+)', body)
                quantity = int(quantity_match.group(1)) if quantity_match else 1
                
                # Extract client name
                client_match = re.search(r'[Nn]ame\s*[\n\r]+([\w\s]+)', body)
                client_name = client_match.group(1).strip() if client_match else 'Quote Request'
                
                # Determine currency
                currency_usd_only = 'dollar only' in body.lower() or 'usd only' in body.lower() or '$' in body
                currency_zar_only = 'zar' in body.lower() and 'rand' in body.lower() and not currency_usd_only
                currency = 'usd' if currency_usd_only else ('zar' if currency_zar_only else 'both')
                
                # Generate quote
                print(f"\nGenerating quote for {sender}: {quantity} {version} - {currency}")
                stdout, stderr = generate_quote(
                    [{"version": version, "quantity": quantity}],
                    client_name,
                    currency
                )
                
                # Get quote number from output or history
                quote_num = "0001"  # Default
                
                # Check for generated PDF
                output_dir = '/opt/data/home/hermes/bme-quote/output'
                pdf_files = sorted([f for f in os.listdir(output_dir) if f.startswith('BMP-') and f.endswith('.pdf')], reverse=True)
                if pdf_files:
                    pdf_path = os.path.join(output_dir, pdf_files[0])
                    quote_num = pdf_files[0].replace('BMP-', '').replace('.pdf', '')
                    
                    # Read history for totals
                    total_usd = 1000
                    total_zar = 19000
                    valid_until = "2026-07-30"
                    
                    history_file = os.path.join(output_dir, 'quote_history.json')
                    if os.path.exists(history_file):
                        with open(history_file, 'r') as f:
                            history = json.load(f)
                            if history:
                                latest = history[-1]
                                total_usd = latest.get('total_usd', total_usd)
                                total_zar = latest.get('total_zar', total_zar)
                                valid_until = latest.get('valid_until', valid_until)
                    
                    # Send quote
                    result = send_quote_email(sender, quote_num, version, quantity, pdf_path, total_usd, total_zar, valid_until, currency)
                    if result:
                        processed_count += 1
                        print(f"Sent: {sender}: BMP-{quote_num} ({version} x {quantity}) - {currency}")
                        mail.store(eid, '+FLAGS', '\\Seen')
    
    mail.close()
    mail.logout()
    
    if processed_count == 0:
        print("\nNo new quote requests found")
    else:
        print(f"\nProcessed: {processed_count} quote request(s)")

if __name__ == '__main__':
    main()