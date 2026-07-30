#!/usr/bin/env python3
"""Build a BME-branded BLASTMAP UNDERGROUND brochure PDF - images matched by original filename."""
import base64, re, html, os
from pathlib import Path

HERE = Path('/opt/data/home/hermes/brochure')

SVG = (HERE.parent / 'assets/bme-logos/BME_Primary Logo_Charcoal.svg').read_text().strip()
if SVG.startswith('<?xml'):
    SVG = SVG[SVG.index('?>')+2:].strip()
SVG = re.sub(r'<defs.*?</defs>', '', SVG, flags=re.S)
SVG = SVG.replace('class="cls-1"', 'fill="#bf0000"').replace('class="cls-2"', 'fill="#141414"').replace('class="cls-3"', 'fill="#ff0000"')
SVG = SVG.replace('<svg ', '<svg style="height:54px;width:auto;" ')
if '<rect' not in SVG[:200]:
    SVG = SVG.replace('>', '><rect width="1000" height="291" fill="white"/>', 1)

def b64(n):
    return 'data:image/png;base64,' + base64.b64encode((HERE/f'brochure_img_{n}.png').read_bytes()).decode()

# Original filenames -> image number (content images are 2..13)
IMG = {n: b64(n) for n in range(2, 14)}

title = "BLASTMAP UNDERGROUND"
tagline = "Complete Underground Drill &amp; Blast Design Solution"
hero = "Design Smarter. Blast Better. Deliver Results."

intro = ("BLASTMAP UNDERGROUND is a powerful mine planning and blast design solution built "
         "specifically for underground mining operations. From development ends and production "
         "stopes to shafts and longhole drilling, BLASTMAP UNDERGROUND provides the tools "
         "engineers need to design, analyse, and optimize every blast.")

# features matched by original filename
features = [
    ("Tunnel Shape Designer",
     "Quickly create and customize tunnel profiles to match your mine's specific development "
     "requirements. Design accurate tunnel geometries with confidence and ensure consistent "
     "blast layouts throughout your operation.", IMG[11]),  # Tunnel Design.png
    ("Reusable Cut Designer",
     "Save time and standardize designs with the Cut Designer. Create, store, and reuse proven "
     "cut patterns, allowing engineers to apply best-practice designs across multiple headings "
     "and projects.", IMG[12]),  # Cut Designer.png
    ("Shaft Design with Rings",
     "Design shaft blasting patterns efficiently using ring-based layouts. Generate accurate "
     "shaft blast designs that improve planning consistency and support safe, productive "
     "operations.", IMG[5]),  # Shaft Design.png
    ("Uphole Ring Design",
     "Develop and optimize uphole ring patterns for production blasting. Easily manage drilling "
     "parameters and ring layouts to maximize blast performance and ore recovery.", IMG[9]),  # Ring Design.png
]

reporting = [
    ("Technical Reports",
     "Generate comprehensive technical reports containing detailed blast design information, "
     "drilling parameters, and engineering data for review and auditing purposes.", IMG[8]),  # Technical Report.png
    ("Working Plan Reports",
     "Produce clear, practical working plans for field crews, ensuring accurate communication "
     "of blast instructions and improving execution underground.", IMG[7]),  # Working Plan Report.png
]

analysis = [
    ("Vibration Prediction Model",
     "Predict blast-induced ground vibrations before firing. Evaluate potential impacts and make "
     "informed design adjustments to help maintain compliance and reduce operational risk.", IMG[2]),  # Vibration Prediction.png
    ("Fragmentation Prediction Model",
     "Estimate expected rock fragmentation outcomes and optimize blast designs to improve "
     "downstream performance, material handling, and overall productivity.", IMG[3]),  # Fragmentation Prediction.png
]

why = [
    "Faster blast design workflows",
    "Standardized and reusable design templates",
    "Improved blast quality and consistency",
    "Advanced predictive analysis tools",
    "Comprehensive technical and operational reporting",
    "Designed specifically for underground mining environments",
]

closing = ("BLASTMAP UNDERGROUND combines powerful design tools, advanced analysis capabilities, "
           "and professional reporting into a single integrated platform&mdash;helping mining "
           "operations achieve safer, more efficient, and more predictable blasting results.")

def feat_cards(items):
    out = []
    for name, desc, img in items:
        out.append(f"""
        <table class="feat">
          <tr>
            <td class="feat-text">
              <h3>{html.escape(name)}</h3>
              <p>{html.escape(desc)}</p>
            </td>
            <td class="feat-img"><img src="{img}" alt="{html.escape(name)}"/></td>
          </tr>
        </table>""")
    return "\n".join(out)

why_items = "\n".join(f'<li>{html.escape(w)}</li>' for w in why)

HTML = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 16mm 15mm 18mm 15mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color:#141414; font-size:10.5pt; line-height:1.55; margin:0; }}
.header {{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:10px; border-bottom:3px solid #BF0000; margin-bottom:6px; }}
.header-right {{ text-align:right; font-size:8.5pt; color:#666; }}
.hero {{ background:#141414; color:#fff; padding:26px 22px; margin:14px 0 20px; border-left:6px solid #BF0000; }}
.hero h1 {{ margin:0; font-size:26pt; letter-spacing:2px; color:#fff; text-transform:uppercase; }}
.hero .tag {{ font-size:12pt; color:#ff6b6b; margin-top:4px; }}
.hero .tag2 {{ font-size:13pt; color:#fff; margin-top:10px; font-style:italic; }}
.section-title {{ font-size:15pt; color:#BF0000; text-transform:uppercase; letter-spacing:1px; margin:22px 0 12px; border-left:4px solid #BF0000; padding-left:10px; }}
.intro {{ font-size:11pt; color:#333; margin-bottom:8px; }}
.feat {{ width:100%; border-collapse:collapse; margin-bottom:14px; background:#f8f8f8; border-left:3px solid #BF0000; }}
.feat td {{ vertical-align:top; padding:12px 14px; }}
.feat-text h3 {{ margin:0 0 6px; font-size:12.5pt; color:#141414; }}
.feat-text p {{ margin:0; font-size:10pt; color:#444; }}
.feat-img {{ width:42%; text-align:center; }}
.feat-img img {{ width:100%; max-width:230px; height:auto; display:block; margin:0 auto; border:1px solid #e0e0e0; }}
.why {{ background:#f8f8f8; border-left:3px solid #BF0000; padding:14px 18px; }}
.why ul {{ margin:0; padding-left:18px; }}
.why li {{ font-size:10.5pt; color:#333; padding:3px 0; }}
.closing {{ background:#141414; color:#fff; padding:20px 22px; margin-top:20px; border-left:6px solid #BF0000; font-size:11pt; }}
.footer {{ border-top:2px solid #BF0000; margin-top:22px; padding-top:8px; display:flex; justify-content:space-between; font-size:8pt; color:#888; }}
.footer .b {{ color:#BF0000; font-weight:700; font-size:12pt; }}
</style></head>
<body>
  <div class="header">
    <div class="logo">{SVG}</div>
    <div class="header-right">Member of the Omnia Group<br>www.bme.co.za</div>
  </div>

  <div class="hero">
    <h1>{title}</h1>
    <div class="tag">{tagline}</div>
    <div class="tag2">{hero}</div>
  </div>

  <p class="intro">{intro}</p>

  <div class="section-title">Key Features</div>
  {feat_cards(features)}

  <div class="section-title">Powerful Reporting</div>
  {feat_cards(reporting)}

  <div class="section-title">Advanced Blast Analysis</div>
  {feat_cards(analysis)}

  <div class="section-title">Why Choose BLASTMAP UNDERGROUND?</div>
  <div class="why"><ul>{why_items}</ul></div>

  <div class="closing">{closing}</div>

  <div class="footer">
    <div>BLASTMAP UNDERGROUND &mdash; Underground Drill &amp; Blast Design Solution<br>www.bme.co.za</div>
    <div class="b">BME</div>
  </div>
</body></html>"""

(HERE / 'brochure.html').write_text(HTML)
print("HTML written")
