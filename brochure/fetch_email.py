#!/usr/bin/env python3
import imaplib, email, os, sys

ZOHO_USER = 'tshermes1979@zohomail.com'
ZOHO_PASSWORD_FILE = '/opt/data/home/hermes/zoho_password.txt'
OUTDIR = '/opt/data/home/hermes/brochure'

os.makedirs(OUTDIR, exist_ok=True)

with open(ZOHO_PASSWORD_FILE) as f:
    pw = f.read().strip()
if '|' in pw:
    pw = pw.split('|', 1)[1]

mail = imaplib.IMAP4_SSL('imap.zoho.com', 993)
mail.login(ZOHO_USER, pw)
mail.select('INBOX')

# Search recent emails from the user (approved) - look for brochure / underground
status, msgs = mail.search(None, 'ALL')
ids = msgs[0].split()
print(f"Total INBOX messages: {len(ids)}")

found = None
for mid in reversed(ids[-40:]):
    status, data = mail.fetch(mid, '(RFC822)')
    msg = email.message_from_bytes(data[0][1])
    sender = email.utils.parseaddr(msg['From'])[1]
    subject = msg.get('Subject', '')
    # grab a text preview
    text = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain':
                p = part.get_payload(decode=True)
                if p: text += p.decode('utf-8', 'ignore')
    else:
        p = msg.get_payload(decode=True)
        if p: text = p.decode('utf-8', 'ignore')
    # count image attachments
    nimg = 0
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type().startswith('image/'):
                nimg += 1
    low = (subject + text).lower()
    if ('underground' in low and 'brochure' in low) or ('blastmap' in low and nimg >= 1 and 'brochure' in low):
        print(f"MATCH id={mid} from={sender} subject={subject!r} images={nimg}")
        found = (mid, msg)
        break
    else:
        print(f"  skip id={mid} from={sender} subj={subject!r} nimg={nimg}")

if not found:
    print("NO MATCH FOUND")
    mail.logout()
    sys.exit(1)

mid, msg = found
# Save text body
text = ""
if msg.is_multipart():
    for part in msg.walk():
        if part.get_content_type() == 'text/plain':
            p = part.get_payload(decode=True)
            if p: text += p.decode('utf-8', 'ignore')
        if part.get_content_type() == 'text/html':
            p = part.get_payload(decode=True)
            if p and not text: text += p.decode('utf-8', 'ignore')
else:
    p = msg.get_payload(decode=True)
    if p: text = p.decode('utf-8', 'ignore')

with open(os.path.join(OUTDIR, 'body.txt'), 'w') as f:
    f.write(text)
print("=== BODY ===")
print(text[:2000])

# Save all image attachments
img_idx = 0
for part in msg.walk():
    if part.get_content_type().startswith('image/'):
        fn = part.get_filename() or f"img_{img_idx}"
        data = part.get_payload(decode=True)
        if data:
            # keep extension
            ext = os.path.splitext(fn)[1] or '.png'
            out = os.path.join(OUTDIR, f"brochure_img_{img_idx}{ext}")
            with open(out, 'wb') as f:
                f.write(data)
            print(f"Saved image: {out} ({len(data)} bytes)")
            img_idx += 1

print(f"Total images saved: {img_idx}")
mail.logout()
