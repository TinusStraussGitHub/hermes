#!/usr/bin/env python3
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

# Configuration
ZOHO_USER = 'tshermes1979@zohomail.com'
ZOHO_PASSWORD = 'cbq48WSUrGYa'
APPROVED_SENDERS = ['tinus.strauss2@bme.co.za', 'christiaan.liebenberg@bme.co.za']
IMAP_SERVER = 'imap.zoho.com'
SMTP_SERVER = 'smtp.zoho.com'

def extract_password():
    """Extract password from zoho_password.txt (may have '1|password' format)."""
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
                payload = part.get_payload(decode=True)
                if payload:
                    body += payload.decode('utf-8', errors='ignore')
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode('utf-8', errors='ignore')
    return body

def get_sender_email(msg):
    """Extract sender email address from message."""
    from_header = msg.get('From', '')
    match = re.search(r'<([^>]+)>', from_header)
    if match:
        return match.group(1).lower()
    match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', from_header)
    if match:
        return match.group(1).lower()
    return from_header.lower()

def check_sent_folder_exists(mail, quote_num):
    """Check Sent folder to avoid duplicates."""
    try:
        mail.select('"Sent"')
        status, sent = mail.search(None, 'ALL')
        if status == 'OK':
            for sid in sent[0].split():
                status, msg_data = mail.fetch(sid, '(RFC822)')
                for resp in msg_data:
                    if isinstance(resp, tuple) and quote_num.encode() in resp[1]:
                        return True
    except Exception as e:
        print(f"  Warning: Could not check Sent folder: {e}")
    return False

def send_quote_email(to_email, quote_num, version, quantity, pdf_path, total_usd, total_zar, valid_until):
    """Send quote PDF via SMTP."""
    password = extract_password()
    
    # Check Sent folder to avoid duplicates
    try:
        imap_mail = imaplib.IMAP4_SSL(IMAP_SERVER, 993)
        imap_mail.login(ZOHO_USER, password)
        if check_sent_folder_exists(imap_mail, quote_num):
            print(f"  Quote {quote_num} already sent - skipping")
            imap_mail.logout()
            return False
        imap_mail.logout()
    except Exception as e:
        print(f"  Warning: Could not verify sent status: {e}")
    
    # Send email
    msg = MIMEMultipart()
    msg['From'] = ZOHO_USER
    msg['To'] = to_email
    msg['Subject'] = f"BLASTMAP Quote {quote_num} - {quantity} {version} License(s) (USD/ZAR, No VAT)"
    
    body = f"Please find attached BLASTMAP quote {quote_num} for {quantity} {version} license(s).\n\nTotal: ${total_usd:,.2f} USD (R{total_zar:,.2f} ZAR)\n\nValid until: {valid_until}"
    msg.attach(MIMEText(body, 'plain'))
    
    with open(pdf_path, 'rb') as f:
        attach = MIMEApplication(f.read())
        attach.add_header('Content-Disposition', 'attachment', filename=os.path.basename(pdf_path))
        msg.attach(attach)
    
    try:
        server = smtplib.SMTP(SMTP_SERVER, 587)
        server.starttls()
        server.login(ZOHO_USER, password)
        server.send_message(msg)
        server.quit()
        print(f"  Quote email sent to {to_email}")
        return True
    except Exception as e:
        print(f"  Error sending email: {e}")
        return False

def parse_quote_request(body):
    """Parse version and quantity from email body."""
    version_match = re.search(r'(PREMIUM|STD)', body, re.IGNORECASE)
    version = version_match.group(1).upper() if version_match else 'PREMIUM'
    
    quantity_match = re.search(r'(\d+)', body)
    quantity = int(quantity_match.group(1)) if quantity_match else 1
    
    return version, quantity

def main():
    print("=" * 60)
    print(f"BLASTMAP Quote Handler - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check working hours (SAST = UTC+2)
    sast_hour = (datetime.now(timezone.utc).hour + 2) % 24
    working_hours = 7 <= sast_hour < 17
    print(f"Current SAST hour: {sast_hour} (working hours: {working_hours})")
    
    if not working_hours:
        print("Outside working hours - skipping quote processing")
        return
    
    password = extract_password()
    print(f"Connecting to IMAP server...")
    
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, 993)
        mail.login(ZOHO_USER, password)
        mail.select('INBOX')
        
        # Search for UNSEEN emails
        status, messages = mail.search(None, 'UNSEEN')
        
        if status != 'OK':
            print(f"IMAP search failed: {status}")
            return
        
        email_ids = messages[0].split()
        print(f"Found {len(email_ids)} unread emails")
        
        processed = []
        errors = []
        
        for eid in email_ids:
            status, msg_data = mail.fetch(eid, '(RFC822)')
            
            if status != 'OK':
                continue
            
            for resp in msg_data:
                if not isinstance(resp, tuple):
                    continue
                
                msg = email.message_from_bytes(resp[1])
                sender = get_sender_email(msg)
                subject = msg.get('Subject', '')
                body = extract_text_body(msg)
                
                print(f"\nEmail from: {sender}")
                print(f"Subject: {subject}")
                
                # Check if sender is approved (case-insensitive)
                if sender not in [s.lower() for s in APPROVED_SENDERS]:
                    print(f"  Sender not approved - skipping")
                    continue
                
                # Check if email is about blastmap quote
                body_lower = body.lower()
                subject_lower = subject.lower()
                
                if 'blastmap' not in body_lower and 'blastmap' not in subject_lower:
                    print(f"  No BLASTMAP reference - skipping")
                    continue
                
                if 'quote' not in body_lower and 'quote' not in subject_lower:
                    print(f"  No quote keyword - skipping")
                    continue
                
                print(f"  Quote request detected!")
                
                # Parse version and quantity
                version, quantity = parse_quote_request(body)
                print(f"  Version: {version}, Quantity: {quantity}")
                
                # Generate quote
                items_json = json.dumps([{"version": version, "quantity": quantity}])
                result = subprocess.run(
                    ['python3', '/opt/data/home/hermes/bme-quote/generate_quote.py', 'generate',
                     '--currency', 'both',
                     '--client-name', 'Quote Request',
                     '--client-company', 'Quote Request',
                     '--client-email', sender,
                     '--items', items_json,
                     '--no-vat'],
                    capture_output=True, text=True, timeout=120
                )
                
                if result.returncode != 0:
                    error_msg = f"Failed to generate quote: {result.stderr}"
                    print(f"  {error_msg}")
                    errors.append(error_msg)
                    continue
                
                output = result.stdout
                print(output)
                
                # Extract quote number from output
                quote_match = re.search(r'BMP-\d{4}', output)
                if quote_match:
                    quote_num = quote_match.group()
                    pdf_path = f'/opt/data/home/hermes/bme-quote/output/{quote_num}.pdf'
                    
                    # Read the generated quote info
                    history_file = '/opt/data/home/hermes/bme-quote/output/quote_history.json'
                    if os.path.exists(history_file):
                        with open(history_file, 'r') as f:
                            history = json.load(f)
                        
                        latest = history[-1]
                        total_usd = latest['total_usd']
                        total_zar = latest['total_zar']
                        valid_until = latest['valid_until']
                        
                        # Send the quote
                        send_quote_email(sender, quote_num, version, quantity, pdf_path, total_usd, total_zar, valid_until)
                        processed.append(quote_num)
                
                # Mark email as Seen
                mail.store(eid, '+FLAGS', '\\Seen')
        
        mail.logout()
        
        print("\n" + "=" * 60)
        print("Summary:")
        print(f"  Quotes generated and sent: {len(processed)}")
        for q in processed:
            print(f"    - {q}")
        if errors:
            print(f"  Errors: {len(errors)}")
            for e in errors:
                print(f"    - {e}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()