#!/usr/bin/env python3
"""
BME Conference App - User Guide PDF generator.
Generates a professional, BME-branded user guide with content + screenshots.
"""
import base64
import os
import html
from pathlib import Path

SRC = Path('/opt/data/home/hermes/user-guide-resized')   # resized screenshots
OUT = Path('/opt/data/home/hermes/user-guide-output-v3')  # output dir
LOGO_PATH = Path('/opt/data/home/hermes/assets/bme-logos/BME_Primary Logo_Charcoal.svg')

# Logo
with open(LOGO_PATH) as f:
    logo_svg = f.read().strip()
if logo_svg.startswith('<?xml'):
    logo_svg = logo_svg[logo_svg.index('?>') + 2:].strip()
logo_svg = logo_svg.replace('<svg ', '<svg style="height:52px;width:auto;" ', 1)

# Image helper
def img_b64(name):
    with open(SRC / name, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()

def shot(name, caption=None, max_w=240):
    """Single screenshot with optional caption."""
    cap = caption or name.replace('.png', '')
    return (
        f'<div class="shot">'
        f'<img src="{img_b64(name)}" alt="{html.escape(cap)}" style="max-width:{max_w}px;">'
        f'<div class="shot-cap">{html.escape(cap)}</div>'
        f'</div>'
    )

def two_up(left_name, left_cap, right_name, right_cap, max_w=230):
    """Two screenshots side-by-side using a real <table> (WeasyPrint-safe)."""
    return (
        f'<table class="two-up"><tr>'
        f'<td>{shot(left_name, left_cap, max_w)}</td>'
        f'<td>{shot(right_name, right_cap, max_w)}</td>'
        f'</tr></table>'
    )

# ---------- Content sections ----------
# Each section: number, title, body paragraphs (HTML), screenshot(s)

# Section 1: Registration, Login & Forgot Password
s1 = f"""
<h2>1. Registration, Login &amp; Forgot Password</h2>

<p><strong>First Time Users:</strong> Tap the <em>Register</em> button on the login screen. You will be asked to enter your Name, Surname, Company Name, Job Title, Email address, and Mobile number.</p>

<p><strong>POPIA Consent:</strong> In compliance with the South African Protection of Personal Information Act (POPIA), you must review the privacy notice and tick the consent box before your account can be created.</p>

<p><strong>Returning Users:</strong> Simply log in with the email address and password you registered with.</p>

<p><strong>Forgot Password:</strong> If you forget your password, click the <em>Forgot your password?</em> link under the login button. Enter your email address and you will receive a secure password reset link directly from Firebase Authentication to easily recover access to your account.</p>

<p><strong>Install as an App:</strong> On Android (Chrome menu &rarr; Install App) or iOS (Safari Share button &rarr; Add to Home Screen) to use the app like a native mobile application.</p>

{two_up('Register.png', 'Register', 'Login.png', 'Login')}
<div class="single-center">{shot('Forget Password.png', 'Forgot Password')}</div>
"""

# Section 2: Conference Schedule
s2 = f"""
<h2>2. Conference Schedule</h2>

<p>View the full list of sessions for the current year. Tap any session to open its detail view, which includes the <strong>Speaker Bio</strong>, session description, and venue location.</p>

<p><strong>Bookmarking (Personal Agenda):</strong> Tap the bookmark icon on any session to add it to your personal favourites. You can toggle the filter at the top of the schedule to view only your bookmarked sessions, making it easy to build and reference your personalised conference agenda.</p>

<p><strong>Rating:</strong> After attending a session, use the star rating system in the session details screen to provide feedback on the speaker and content.</p>

{two_up('Schedule.png', 'Full Schedule', 'My Schedule.png', 'My Schedule (Bookmarked)')}
"""

# Section 3: Live Updates (Newsfeed)
s3 = f"""
<h2>3. Live Updates (Newsfeed)</h2>

<p>The Newsfeed is your home for real-time announcements during the conference. Posts are colour-coded so you can spot the important ones at a glance:</p>

<ul>
  <li><strong style="color:#BF0000;">Announcements</strong> &mdash; highlighted in red for urgent conference-wide news.</li>
  <li><strong style="color:#1565C0;">Session Posts</strong> &mdash; highlighted in blue for specific session updates or interesting facts.</li>
</ul>

<div class="single-center">{shot('News.png', 'Newsfeed')}</div>
"""

# Section 4: Live Polling
s4 = f"""
<h2>4. Live Polling</h2>

<p>When a speaker starts a live poll, it will appear instantly in the <strong>Polls</strong> tab on the home screen. Tap your chosen answer to cast your vote. Once you have voted, you will see the real-time percentage results from all attendees who have participated.</p>

<div class="single-center">{shot('Polls.png', 'Live Polls')}</div>
"""

# Section 5: Session Q&A
s5 = f"""
<h2>5. Session Q&amp;A</h2>

<p>Select the active session from the dropdown menu at the top of the Q&amp;A screen, then type your question in the bottom input bar and tap send.</p>

<p><strong>Upvoting Questions:</strong> See a question you like? Tap the <em>Thumbs Up</em> icon to move it to the top so the speaker sees it first. To prevent spamming, you are limited to exactly <strong>one upvote per question</strong>, and you <strong>cannot upvote your own questions</strong>. Tap the <em>Thumbs Up</em> again if you wish to remove your upvote.</p>

<div class="single-center">{shot('Q&A.png', 'Session Q&A')}</div>
"""

# Section 6: Venue & Directions
s6 = f"""
<h2>6. Venue &amp; Directions</h2>

<p>The <strong>Venue</strong> tab shows the CSIR ICC details including address, parking information, and a map. Tap <em>Get Directions</em> to open Google Maps with the precise location already set, ready for turn-by-turn navigation.</p>

<div class="single-center">{shot('Venue.png', 'Venue & Directions')}</div>
"""

# Section 7: BME Connect (Networking Hub)
s7 = f"""
<h2>7. BME Connect (Networking Hub)</h2>

<p>The <strong>Connect</strong> tab is a digital business card exchange and leads manager built to help you network safely and efficiently during the conference.</p>

<h3>7.1 My Card</h3>
<p>Displays your custom attendee badge and a personal, scan-ready <strong>QR Code</strong>. Tap <em>Edit Card</em> to update your contact details or toggle <strong>Shared Contact Preferences</strong> (for example, choose whether to share your email, mobile number, or company/job title). Unsharing a field hides it from other attendees in real-time.</p>

<div class="single-center">{shot('My Card.png', 'My Card')}</div>
<div class="single-center">{shot('Edit My Card.png', 'Edit My Card')}</div>

<h3>7.2 Scan QR</h3>
<p>Tap <em>Start Camera</em> to activate your device's camera scanner, then point it at another attendee's QR code to instantly trade contact details.</p>

<p><strong>Bidirectional Exchange:</strong> To keep networking fast, BME Connect automatically registers a mutual connection. When you scan someone, the system instantly sets up a two-way contact link so both of you see each other under <em>My Contacts</em> immediately.</p>

<div class="single-center">{shot('Scan QR.png', 'Scan QR Code')}</div>

<h3>7.3 My Contacts (Leads Manager)</h3>
<p>Scroll and filter your connections in real-time by search query or lead rating.</p>

<ul>
  <li><strong>Private Lead Rating:</strong> Classify connections privately as <strong>Hot</strong>, <strong>Warm</strong>, or <strong>Cold</strong> to prioritise follow-ups.</li>
  <li><strong>Private Follow-up Notes:</strong> Add private summaries, actions, or meeting notes for each contact. These notes are stored securely and are only visible to you.</li>
  <li><strong>Save vCard:</strong> Tap <em>Save vCard</em> to download a standard <code>.vcf</code> contact file directly to your smartphone or computer's address book. The download strictly respects the contact's privacy flags, omitting any hidden fields.</li>
</ul>

<div class="single-center">{shot('My Contacts.png', 'My Contacts')}</div>
"""

# QR code block (separate, prominent)
qr_html = f"""
<div class="qr-block">
  <div class="qr-img"><img src="{img_b64('qr-code.png')}" alt="Scan to open the BME Conference App"></div>
  <div class="qr-text">
    <h3>Get the App</h3>
    <p>Scan this QR code with your smartphone camera to open the BME Conference App. You can also install it to your home screen as a Progressive Web App &mdash; no app store required.</p>
  </div>
</div>
"""

HTML = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>BME Conference App - User Guide</title>
<style>
@page {{ size: A4; margin: 16mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #141414; font-size: 10.5pt; line-height: 1.55; background: #fff; }}

.header {{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:3px solid #BF0000; margin-bottom:22px; }}
.header-left svg {{ height:52px; width:auto; }}
.header-right {{ text-align:right; }}
.header-right h1 {{ font-size:21pt; color:#BF0000; letter-spacing:1.5px; text-transform:uppercase; margin:0; }}
.header-right .subtitle {{ font-size:9pt; color:#666; margin-top:3px; }}

h2 {{ font-size:13.5pt; color:#BF0000; margin:22px 0 8px; border-left:4px solid #BF0000; padding-left:10px; text-transform:uppercase; letter-spacing:0.5px; page-break-after: avoid; }}
h3 {{ font-size:11pt; color:#141414; margin:14px 0 6px; }}
p {{ margin:6px 0; }}
ul {{ margin:6px 0 8px 0; padding-left:20px; }}
li {{ margin:3px 0; }}
code {{ background:#f4f4f4; padding:1px 5px; border-radius:3px; font-family:Consolas,monospace; font-size:9.5pt; }}

.shot {{ margin:10px 0 14px; text-align:center; page-break-inside: avoid; }}
.shot img {{ display:block; margin:0 auto; width:auto; max-width:240px; height:auto; border:1px solid #e0e0e0; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.08); }}
.shot-cap {{ font-size:8.5pt; color:#666; margin-top:5px; font-style:italic; }}
.single-center {{ text-align:center; margin:12px 0 16px; page-break-inside: avoid; }}
.single-center .shot img {{ max-width:280px; }}

/* Real <table> for two-up (WeasyPrint-safe per pitfall #13) */
.two-up {{ width:100%; border-collapse:collapse; margin:12px 0 16px; page-break-inside: avoid; }}
.two-up td {{ width:50%; text-align:center; vertical-align:top; padding:6px; }}
.two-up .shot {{ margin:0; }}
.two-up .shot img {{ max-width:230px; }}

/* QR block (real <div>-based but with explicit widths) */
.qr-block {{ width:100%; background:#f8f8f8; border:1px solid #e0e0e0; border-left:4px solid #BF0000; border-radius:6px; margin:18px 0; padding:18px 22px; display:table; page-break-inside: avoid; }}
.qr-block .qr-img {{ display:table-cell; vertical-align:middle; width:170px; text-align:center; padding-right:22px; }}
.qr-block .qr-img img {{ width:150px; height:150px; border:1px solid #ddd; border-radius:4px; display:block; margin:0 auto; }}
.qr-block .qr-text {{ display:table-cell; vertical-align:middle; }}
.qr-block .qr-text h3 {{ font-size:13pt; color:#BF0000; margin:0 0 6px 0; text-transform:uppercase; letter-spacing:0.5px; }}
.qr-block .qr-text p {{ margin:0; font-size:10pt; color:#141414; }}

.content-box {{ background:#f8f8f8; border-left:3px solid #BF0000; padding:10px 14px; border-radius:0 4px 4px 0; margin:12px 0; font-size:9.5pt; }}

.footer {{ border-top:2px solid #BF0000; padding-top:10px; margin-top:30px; display:flex; justify-content:space-between; align-items:flex-end; font-size:8pt; color:#888; }}
.footer .brand {{ font-size:11pt; font-weight:700; color:#BF0000; }}
</style>
</head>
<body>

<div class="header">
  <div class="header-left">{logo_svg}</div>
  <div class="header-right">
    <h1>BME Conference App</h1>
    <div class="subtitle">User Guide</div>
  </div>
</div>

{qr_html}

{s1}
{s2}
{s3}
{s4}
{s5}
{s6}
{s7}

<div class="footer">
  <div>BME Conference App &mdash; User Guide &middot; www.bme.co.za</div>
  <div class="brand">BME</div>
</div>

</body>
</html>
"""

# Write outputs
OUT.mkdir(exist_ok=True)
html_path = OUT / 'user-guide.html'
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(HTML)
print(f"HTML written: {html_path} ({len(HTML):,} bytes)")
