#!/usr/bin/env python3
"""
Send BLASTMAP quote PDF via Zoho SMTP using app password with SSL on port 465.
"""
import smtplib
import ssl
from email.message import EmailMessage
import os

# Load Zoho app password
with open('/opt/data/home/hermes/zoho_password.txt', 'r') as f:
    zoho_password = f.read().strip()

# Email details
sender_email = 'tshermes1979@gmail.com'
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

# Send email via Zoho SMTP with SSL on port 465
try:
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL('smtp.zoho.com', 465, context=context) as server:
        server.login(sender_email, zoho_password)
        server.send_message(msg)
    print('SUCCESS: Email with BMP-0086 PDF sent to tinus.strauss2@bme.co.za')
except Exception as e:
    print(f'ERROR: Failed to send email: {str(e)}')