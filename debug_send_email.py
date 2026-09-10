#!/usr/bin/env python3
import smtplib
import ssl
from email.message import EmailMessage
import os

# Load Zoho password
with open('/opt/data/home/hermes/zoho_password.txt', 'r') as f:
    zoho_password = f.read().strip()

print(f"Attempting to send email using Zoho SMTP")
print(f"Sender: tshermes1979@gmail.com")
print(f"Receiver: tinus.strauss2@bme.co.za")
print(f"Password: {zoho_password}")

# Email details
sender_email = 'tshermes1979@gmail.com'
sender_password = zoho_password
receiver_email = 'tinus.strauss2@bme.co.za'

# Quote details
quote_number = 'BMP-0086'
quote_pdf_path = '/opt/data/home/hermes/bme-quote/output/BMP-0086.pdf'
client_name = 'Ian'
client_company = 'Rockland'

# Create email message
msg = EmailMessage()
msg['Subject'] = f'BLASTMAP Quote - {quote_number} for {client_name}'
msg['From'] = sender_email
msg['To'] = receiver_email
msg.set_content(f'''
Dear {client_name},

Please find attached the latest BLASTMAP STANDARD quote in ZAR currency for {client_company}.

Quote Details:
- License Type: BLASTMAP STANDARD
- Currency: ZAR
- Total: R58,420.08 ZAR
- Valid Until: 8 August 2026

This quote was generated using the updated ZAR-based pricing system.

Best regards,
Hermes Agent
''')

# Attach PDF
if os.path.exists(quote_pdf_path):
    with open(quote_pdf_path, 'rb') as f:
        pdf_data = f.read()
    msg.add_attachment(pdf_data, maintype='application', subtype='octet-stream', filename=os.path.basename(quote_pdf_path))
    print(f"PDF attached: {quote_pdf_path}")
else:
    msg.set_content('Warning: PDF file not found for attachment.')
    print(f"WARNING: PDF not found at {quote_pdf_path}")

# Test SMTP connection first
try:
    context = ssl.create_default_context()
    print(f"Testing SMTP connection to smtp.zoho.com:465...")
    server_test = smtplib.SMTP_SSL('smtp.zoho.com', 465, context=context, timeout=10)
    server_test.close()
    print("SMTP connection test: SUCCESS")
except Exception as e:
    print(f"SMTP connection test FAILED: {str(e)}")
    print("This indicates a network/server issue, not authentication")

# Send email via Zoho SMTP
try:
    context = ssl.create_default_context()
    print(f"Attempting to login to smtp.zoho.com...")
    with smtplib.SMTP_SSL('smtp.zoho.com', 465, context=context) as server:
        print(f"Login attempt with user: {sender_email}")
        # Try login (but don't actually send)
        server.login(sender_email, sender_password)
        print(f"Login SUCCESS: Authentication passed")
        print(f"Now sending email...")
        server.send_message(msg)
        print(f"SUCCESS: Email with BMP-0086 PDF sent to tinus.strauss2@bme.co.za")
except Exception as e:
    print(f"ERROR: Failed to send email: {str(e)}")
    if "535" in str(e) or "Authentication Failed" in str(e):
        print("\n--- AUTHENTICATION ERROR ---")
        print("Possible causes:")
        print("1. Zoho app password required (not your regular Gmail password)")
        print("2. Password was revoked/rotated")
        print("3. 2FA settings blocking")
        print("4. Zoho account is not properly configured for SMTP")
    print("\n--- Manual Workaround ---")
    print(f"Quote PDF is available at: {quote_pdf_path}")
    print(f"Client: {client_name} ({client_company})")
    print(f"Total: R58,420.08 ZAR")