#!/usr/bin/env python3
"""
BME Hardware Requirements PDF Generator
Creates a branded PDF with BLASTMAP hardware requirements using the current BME logo.
"""

import os
import subprocess
from pathlib import Path

OUTPUT_DIR = Path('/opt/data/home/hermes/bme-quote/output')
LOGO_SVG_PATH = "/opt/data/home/hermes/assets/bme-logos/BME_Primary Logo_Charcoal.svg"

def load_logo():
    """Load and prepare the SVG logo for inline embedding."""
    if os.path.exists(LOGO_SVG_PATH):
        with open(LOGO_SVG_PATH, 'r') as f:
            logo_svg = f.read().strip()
        if logo_svg.startswith('<?xml'):
            logo_svg = logo_svg[logo_svg.index('?>')+2:].strip()
        return logo_svg
    return ''

def generate_hardware_pdf():
    """Generate the hardware requirements PDF."""
    logo_svg = load_logo()
    
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BLASTMAP Hardware Requirements</title>
<style>
  @page {{
    size: A4;
    margin: 15mm;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #141414;
    font-size: 11pt;
    line-height: 1.5;
    background: #fff;
  }}
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 16px;
    border-bottom: 3px solid #BF0000;
    margin-bottom: 24px;
  }}
  .header-left {{ background: white; padding: 2px; }}
  .header-left svg {{ height: 52px; width: auto; }}
  .header-right {{
    text-align: right;
  }}
  .header-right h1 {{
    font-size: 22pt;
    color: #BF0000;
    letter-spacing: 2px;
    text-transform: uppercase;
  }}
  .section {{
    margin-bottom: 20px;
  }}
  .section h2 {{
    font-size: 14pt;
    color: #BF0000;
    margin-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 6px;
  }}
  .subsection {{
    margin-bottom: 16px;
  }}
  .subsection h3 {{
    font-size: 11pt;
    color: #141414;
    margin-bottom: 8px;
    font-weight: 600;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }}
  th {{
    background: #141414;
    color: #fff;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 8px 12px;
    text-align: left;
  }}
  td {{
    padding: 8px 12px;
    border-bottom: 1px solid #e0e0e0;
    font-size: 10pt;
  }}
  tr:nth-child(even) {{ background: #fafafa; }}
  .footer {{
    border-top: 2px solid #BF0000;
    padding-top: 12px;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    margin-top: 24px;
  }}
  .footer-right .bme-name {{
    font-size: 11pt;
    font-weight: 700;
    color: #BF0000;
  }}
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    {logo_svg}
  </div>
  <div class="header-right">
    <h1>BLASTMAP</h1>
  </div>
</div>

<div class="section">
  <h2>Hardware Requirements</h2>
  
  <div class="subsection">
    <h3>Supported Operating Systems</h3>
    <p>Vista, Windows 7, Windows 8, Windows 10, Windows 11</p>
  </div>
  
  <div class="subsection">
    <h3>Minimum Hardware Requirements</h3>
    <table>
      <thead>
        <tr><th>Component</th><th>Requirement</th></tr>
      </thead>
      <tbody>
        <tr><td>RAM</td><td>4 Gigabytes</td></tr>
        <tr><td>Disk Space</td><td>500 Megabytes</td></tr>
        <tr><td>Processor</td><td>2 Core 2.00 GHz</td></tr>
        <tr><td>OS Type</td><td>32-bit</td></tr>
      </tbody>
    </table>
  </div>
  
  <div class="subsection">
    <h3>Recommended Hardware Requirements</h3>
    <table>
      <thead>
        <tr><th>Component</th><th>Requirement</th></tr>
      </thead>
      <tbody>
        <tr><td>RAM</td><td>8 Gigabytes</td></tr>
        <tr><td>Disk Space</td><td>500 Megabytes</td></tr>
        <tr><td>Processor</td><td>Core i7 2.00 GHz</td></tr>
        <tr><td>OS Type</td><td>64-bit</td></tr>
      </tbody>
    </table>
  </div>
</div>

<div class="footer">
  <div class="footer-right">
    <div class="bme-name">BME</div>
  </div>
</div>

</body>
</html>'''

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    html_path = OUTPUT_DIR / "BLASTMAP_Hardware_Requirements.html"
    pdf_path = OUTPUT_DIR / "BLASTMAP_Hardware_Requirements.pdf"
    
    with open(html_path, 'w') as f:
        f.write(html)
    
    result = subprocess.run(
        ["node", "/opt/data/skills/productivity/html-to-pdf/scripts/html-to-pdf.js", str(html_path), str(pdf_path)],
        capture_output=True, text=True, timeout=60
    )
    print(result.stdout)
    return str(pdf_path)

if __name__ == "__main__":
    generate_hardware_pdf()