#!/usr/bin/env python3
"""
BME Quote Generator
Generates professional PDF quotes for BLASTMAP and XPLOLOG products.
Uses BME brand colors: Red=#BF0000, Black=#141414
"""

import json
import os
import sys
import subprocess
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Paths
BASE_DIR = Path("/opt/data/home/hermes/bme-quote")
CONFIG_FILE = BASE_DIR / "config.json"
TEMPLATE_FILE = BASE_DIR / "template.html"
OUTPUT_DIR = BASE_DIR / "output"
LOGO_PATH = "/opt/data/home/hermes/assets/bme-logos/png/bme-logo-black-400.png"
PDF_SCRIPT = Path("/opt/data/skills/productivity/html-to-pdf/scripts/html-to-pdf.js")


def load_config():
    """Load and return the config dictionary."""
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)


def save_config(config):
    """Save the config dictionary."""
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_next_quote_number(config):
    """Get the next quote number and increment counter."""
    config["quote_counter"] += 1
    num = config["quote_counter"]
    save_config(config)
    return f"BMP-{num:04d}"


def update_exchange_rate(config):
    """Fetch the latest USD/ZAR exchange rate."""
    import urllib.request
    try:
        url = "https://open.er-api.com/v6/latest/USD"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            config["exchange_rate"]["usd_to_zar"] = data["rates"]["ZAR"]
            config["exchange_rate"]["last_updated"] = datetime.now().strftime("%Y-%m-%d")
            config["exchange_rate"]["source"] = "open.er-api.com"
            save_config(config)
            print(f"  Exchange rate updated: 1 USD = {data['rates']['ZAR']} ZAR")
    except Exception as e:
        print(f"  Warning: Could not update exchange rate: {e}")
        print(f"  Using existing rate: 1 USD = {config['exchange_rate']['usd_to_zar']} ZAR")


def format_currency(amount):
    """Format a number as currency with comma separators."""
    return f"{amount:,.2f}"


def format_zar(amount):
    """Format ZAR currency."""
    return f"R {amount:,.2f}"


def build_quote_items(items, exchange_rate, currency="both"):
    """
    Build HTML table rows for quote items.
    items: list of dicts with keys:
      - version (STD/PREMIUM) for BLASTMAP
      - product (XPLOLOG) and item (android_tablet/xplolog_license) for XPLOLOG
      - quantity
    currency: "usd", "zar", or "both" - determines which price columns to show
    Returns: (items_html, subtotal_usd, subtotal_zar)
    """
    config = load_config()
    rows = []
    subtotal_usd = 0
    subtotal_zar = 0

    for item in items:
        qty = item["quantity"]
        
        # Handle XPLOLOG products
        if item.get("product") == "XPLOLOG":
            product = config["products"]["XPLOLOG"]["items"][item["item"]]
            unit_price = product["price_usd"]
            line_total_usd = unit_price * qty
            line_total_zar = line_total_usd * exchange_rate
            subtotal_usd += line_total_usd
            subtotal_zar += line_total_zar
            
            license_term = product.get("license_term", "1 Year")
            pricing_type = product.get("pricing_type", "annual")
            
            # Build price cells based on currency
            if currency == "usd":
                price_cells = f"      <td>${format_currency(unit_price)}</td>\n      <td><strong>${format_currency(line_total_usd)}</strong></td>"
            elif currency == "zar":
                price_cells = f"      <td>{format_zar(unit_price * exchange_rate)}</td>\n      <td><strong>{format_zar(line_total_zar)}</strong></td>"
            else:  # both
                price_cells = f"      <td>${format_currency(unit_price)} / {format_zar(unit_price * exchange_rate)}</td>\n      <td><strong>${format_currency(line_total_usd)} / {format_zar(line_total_zar)}</strong></td>"
            
            row = f"""    <tr>
      <td>
        <div class="item-name">{product['name']}</div>
        <div class="item-desc">{product['description']} — {license_term}</div>
      </td>
      <td><span class="qty-badge">{qty}</span></td>
{price_cells}
    </tr>"""
            rows.append(row)
        # Handle MODULAR add-on products (e.g. Vibration Module)
        elif item.get("product") == "MODULAR":
            product = config["products"]["MODULAR"]["items"][item["item"]]
            unit_price = product["price_usd"]
            line_total_usd = unit_price * qty
            line_total_zar = line_total_usd * exchange_rate
            subtotal_usd += line_total_usd
            subtotal_zar += line_total_zar

            license_term = product.get("license_term", "1 Year")
            pricing_type = product.get("pricing_type", "annual")

            if currency == "usd":
                price_cells = f"      <td>${format_currency(unit_price)}</td>\n      <td><strong>${format_currency(line_total_usd)}</strong></td>"
            elif currency == "zar":
                price_cells = f"      <td>{format_zar(unit_price * exchange_rate)}</td>\n      <td><strong>{format_zar(line_total_zar)}</strong></td>"
            else:
                price_cells = f"      <td>${format_currency(unit_price)} / {format_zar(unit_price * exchange_rate)}</td>\n      <td><strong>${format_currency(line_total_usd)} / {format_zar(line_total_zar)}</strong></td>"

            row = f"""    <tr>
      <td>
        <div class="item-name">{product['name']}</div>
        <div class="item-desc"><strong>{license_term}</strong></div>
      </td>
      <td><span class="qty-badge">{qty}</span></td>
{price_cells}
    </tr>"""
            rows.append(row)
        else:
            # Handle BLASTMAP versions
            version = item["version"].upper()
            product = config["versions"][version]
            unit_price = product["price_usd"]
            line_total_usd = unit_price * qty
            line_total_zar = line_total_usd * exchange_rate
            subtotal_usd += line_total_usd
            subtotal_zar += line_total_zar

            features_html = ""
            if product.get("features") and version != "UNDERGROUND":
                features_html = "<ul class='feature-list'>" + "".join(
                    f"<li>{f}</li>" for f in product["features"]
                ) + "</ul>"

            # Build price cells based on currency
            if currency == "usd":
                price_cells = f"      <td>${format_currency(unit_price)}</td>\n      <td><strong>${format_currency(line_total_usd)}</strong></td>"
            elif currency == "zar":
                price_cells = f"      <td>{format_zar(unit_price * exchange_rate)}</td>\n      <td><strong>{format_zar(line_total_zar)}</strong></td>"
            else:  # both
                price_cells = f"      <td>${format_currency(unit_price)} / {format_zar(unit_price * exchange_rate)}</td>\n      <td><strong>${format_currency(line_total_usd)} / {format_zar(line_total_zar)}</strong></td>"

            row = f"""    <tr>
      <td>
        <div class="item-name">{product['name']}</div>
        <div class="item-desc"><strong>1 Year License</strong></div>
        {features_html}
      </td>
      <td><span class="qty-badge">{qty}</span></td>
{price_cells}
    </tr>"""
            rows.append(row)

    return "\n".join(rows), subtotal_usd, subtotal_zar


def generate_quote(
    client_name,
    client_company,
    client_email,
    client_phone,
    items,
    prepared_by="Tinus Strauss",
    reference="",
    valid_days=30,
    update_rate=True,
    include_vat=True,
    currency="both",
):
    """
    Generate a BME quote PDF.

    Args:
        client_name: Client contact name
        client_company: Client company name
        client_email: Client email address
        client_phone: Client phone number
        items: List of dicts with:
               - BLASTMAP: {"version": "STD/PREMIUM", "quantity": N}
               - XPLOLOG: {"product": "XPLOLOG", "item": "android_tablet/xplolog_license", "quantity": N}
        prepared_by: Name of person preparing the quote
        reference: Optional reference string
        valid_days: Number of days the quote is valid (default 30)
        update_rate: Whether to fetch latest exchange rate
        include_vat: Whether to include VAT (default True)
        currency: "usd", "zar", or "both" (default "both")

    Returns:
        dict with quote_number, pdf_path, totals
    """
    config = load_config()

    # Update exchange rate if requested
    if update_rate:
        update_exchange_rate(config)

    exchange_rate = config["exchange_rate"]["usd_to_zar"]
    quote_number = get_next_quote_number(config)

    # Dates
    quote_date = datetime.now().strftime("%d %B %Y")
    valid_until = (datetime.now() + timedelta(days=valid_days)).strftime("%d %B %Y")
    rate_date = config["exchange_rate"]["last_updated"]

    # Build items with currency support
    items_html, subtotal_usd, subtotal_zar = build_quote_items(items, exchange_rate, currency)

    if include_vat:
        vat_usd = subtotal_usd * 0.15
        vat_zar = subtotal_zar * 0.15
        total_usd = subtotal_usd + vat_usd
        total_zar = subtotal_zar + vat_zar
    else:
        vat_usd = 0
        vat_zar = 0
        total_usd = subtotal_usd
        total_zar = subtotal_zar

    # Read template
    with open(TEMPLATE_FILE, "r") as f:
        html = f.read()

    # Embed logo as inline SVG (Puppeteer can't load local file:// images)
    logo_svg = ""
    SVG_LOGO_PATH = "/opt/data/home/hermes/assets/bme-logos/BME_Primary Logo_Charcoal.svg"
    if os.path.exists(SVG_LOGO_PATH):
        with open(SVG_LOGO_PATH, "r") as lf:
            logo_svg = lf.read().strip()
            # Strip XML declaration for inline HTML embedding
            if logo_svg.startswith("<?xml"):
                logo_svg = logo_svg[logo_svg.index("?>")+2:].strip()
    else:
        print(f"  Warning: Logo SVG not found at {SVG_LOGO_PATH}")

    # Set table header based on currency
    if currency == "usd":
        price_header = "Unit Price (USD)"
        total_header = "Total (USD)"
        subtotal_display = f"${format_currency(subtotal_usd)}"
        total_display = f"${format_currency(total_usd)}"
    elif currency == "zar":
        price_header = "Unit Price (ZAR)"
        total_header = "Total (ZAR)"
        subtotal_display = format_zar(subtotal_zar)
        total_display = format_zar(total_zar)
    else:  # both
        price_header = "Unit Price (USD / ZAR)"
        total_header = "Total (USD / ZAR)"
        subtotal_display = f"${format_currency(subtotal_usd)} / {format_zar(subtotal_zar)}"
        total_display = f"${format_currency(total_usd)} / {format_zar(total_zar)}"

    # Replace placeholders
    html = html.replace("{{QUOTE_NUMBER}}", quote_number)
    html = html.replace("{{LOGO_SVG}}", logo_svg)
    html = html.replace("{{CLIENT_NAME}}", client_name)
    html = html.replace("{{CLIENT_COMPANY}}", client_company)
    html = html.replace("{{CLIENT_EMAIL}}", client_email)
    html = html.replace("{{CLIENT_PHONE}}", client_phone)
    html = html.replace("{{QUOTE_DATE}}", quote_date)
    html = html.replace("{{VALID_UNTIL}}", valid_until)
    html = html.replace("{{PREPARED_BY}}", prepared_by)
    html = html.replace("{{REFERENCE}}", reference)
    html = html.replace("{{QUOTE_ITEMS}}", items_html)
    html = html.replace("{{SUBTOTAL_USD}}", format_currency(subtotal_usd))
    html = html.replace("{{SUBTOTAL_ZAR}}", format_zar(subtotal_zar))
    html = html.replace("{{VAT_USD}}", format_currency(vat_usd))
    html = html.replace("{{VAT_ZAR}}", format_zar(vat_zar))
    html = html.replace("{{TOTAL_USD}}", format_currency(total_usd))
    html = html.replace("{{TOTAL_ZAR}}", format_zar(total_zar))
    html = html.replace("{{EXCHANGE_RATE}}", format_currency(exchange_rate))
    html = html.replace("{{RATE_DATE}}", rate_date)
    html = html.replace("{{PRICE_HEADER}}", price_header)
    html = html.replace("{{TOTAL_HEADER}}", total_header)
    html = html.replace("{{SUBTOTAL_DISPLAY}}", subtotal_display)
    html = html.replace("{{TOTAL_DISPLAY}}", total_display)
    
    # VAT conditional placeholders
    if include_vat:
        if currency == "usd":
            vat_rows = f"""    <div class="total-row">
      <span>VAT (15%)</span>
      <span>${format_currency(vat_usd)}</span>
    </div>
    <div class="total-row sub-total">
      <span>Total (excl. VAT)</span>
      <span>${format_currency(subtotal_usd)}</span>
    </div>"""
            total_label = "(incl. VAT)"
            total_label_zar = " (incl. VAT)"
        elif currency == "zar":
            vat_rows = f"""    <div class="total-row">
      <span>VAT (15%)</span>
      <span>{format_zar(vat_zar)}</span>
    </div>
    <div class="total-row sub-total">
      <span>Total (excl. VAT)</span>
      <span>{format_zar(subtotal_zar)}</span>
    </div>"""
            total_label = "(incl. VAT)"
            total_label_zar = " (incl. VAT)"
        else:  # both
            vat_rows = f"""    <div class="total-row">
      <span>VAT (15%)</span>
      <span>${format_currency(vat_usd)} / {format_zar(vat_zar)}</span>
    </div>
    <div class="total-row sub-total">
      <span>Total (excl. VAT)</span>
      <span>${format_currency(subtotal_usd)} / {format_zar(subtotal_zar)}</span>
    </div>"""
            total_label = "(incl. VAT)"
            total_label_zar = " (incl. VAT)"
    else:
        vat_rows = ""
        total_label = ""
        total_label_zar = ""
    
    html = html.replace("{{VAT_ROWS}}", vat_rows)
    html = html.replace("{{TOTAL_LABEL}}", total_label)
    html = html.replace("{{TOTAL_LABEL_ZAR}}", total_label_zar)

    # Save HTML
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    html_path = OUTPUT_DIR / f"{quote_number}.html"
    pdf_path = OUTPUT_DIR / f"{quote_number}.pdf"

    with open(html_path, "w") as f:
        f.write(html)

    # Convert to PDF
    try:
        result = subprocess.run(
            ["node", str(PDF_SCRIPT), str(html_path), str(pdf_path)],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            print(f"  Puppeteer PDF generation failed: {result.stderr}")
            print("  Trying WeasyPrint fallback...")
            result = subprocess.run(
                ["weasyprint", str(html_path), str(pdf_path)],
                capture_output=True, text=True, timeout=60
            )
            if result.returncode != 0:
                print(f"  WeasyPrint also failed: {result.stderr}")
                print(f"  HTML saved at: {html_path}")
                return None

        print(f"  PDF generated: {pdf_path}")
    except FileNotFoundError:
        print("  Error: Neither node nor weasyprint found. Install one of them.")
        print(f"  HTML saved at: {html_path}")
        return None

    result = {
        "quote_number": quote_number,
        "pdf_path": str(pdf_path),
        "html_path": str(html_path),
        "subtotal_usd": subtotal_usd,
        "vat_usd": vat_usd,
        "total_usd": total_usd,
        "total_zar": total_zar,
        "exchange_rate": exchange_rate,
        "quote_date": quote_date,
        "valid_until": valid_until,
        "client_name": client_name,
        "client_company": client_company,
        "items": items,
        "currency": currency,
        "include_vat": include_vat,
    }

    # Save quote record
    record_file = OUTPUT_DIR / "quote_history.json"
    history = []
    if record_file.exists():
        with open(record_file, "r") as f:
            history = json.load(f)
    history.append(result)
    with open(record_file, "w") as f:
        json.dump(history, f, indent=2)

    return result


def set_prices(std_price=None, premium_price=None, android_tablet_price=None, xplolog_license_price=None):
    """Update BME product prices."""
    config = load_config()
    if std_price is not None:
        config["versions"]["STD"]["price_usd"] = std_price
    if premium_price is not None:
        config["versions"]["PREMIUM"]["price_usd"] = premium_price
    if android_tablet_price is not None:
        config["products"]["XPLOLOG"]["items"]["android_tablet"]["price_usd"] = android_tablet_price
    if xplolog_license_price is not None:
        config["products"]["XPLOLOG"]["items"]["xplolog_license"]["price_usd"] = xplolog_license_price
    save_config(config)
    print("Prices updated:")
    if std_price is not None:
        print(f"  BLASTMAP STD:      ${format_currency(std_price)}")
    if premium_price is not None:
        print(f"  BLASTMAP PREMIUM:  ${format_currency(premium_price)}")
    if android_tablet_price is not None:
        print(f"  XPLOLOG Tablet:    ${format_currency(android_tablet_price)}")
    if xplolog_license_price is not None:
        print(f"  XPLOLOG License:   ${format_currency(xplolog_license_price)}")


def show_prices():
    """Display current prices and exchange rate."""
    config = load_config()
    er = config["exchange_rate"]
    print("Current BLASTMAP Prices:")
    print(f"  BLASTMAP FREE:     ${format_currency(config['versions']['FREE']['price_usd'])}")
    print(f"  BLASTMAP STD:      ${format_currency(config['versions']['STD']['price_usd'])}")
    print(f"  BLASTMAP PREMIUM:  ${format_currency(config['versions']['PREMIUM']['price_usd'])}")
    
    if "products" in config and "XPLOLOG" in config["products"]:
        print("\nCurrent XPLOLOG Prices:")
        for item_key, item in config["products"]["XPLOLOG"]["items"].items():
            pricing_type = item.get("pricing_type", "annual")
            term = item.get("license_term", "per year")
            print(f"  {item['name']}: ${format_currency(item['price_usd'])} ({pricing_type}, {term})")
    
    print(f"\nExchange Rate: 1 USD = {format_currency(er['usd_to_zar'])} ZAR")
    print(f"  Last updated: {er['last_updated']} ({er['source']})")
    print(f"\nNext quote number: BMP-{config['quote_counter'] + 1:04d}")


def show_history():
    """Display quote history."""
    record_file = OUTPUT_DIR / "quote_history.json"
    if not record_file.exists():
        print("No quotes generated yet.")
        return
    with open(record_file, "r") as f:
        history = json.load(f)
    print(f"Quote History ({len(history)} quotes):")
    print("-" * 80)
    for q in history:
        items_str = []
        for i in q["items"]:
            if i.get("version"):
                items_str.append(f"{i['quantity']}x {i['version']}")
            elif i.get("product"):
                items_str.append(f"{i['quantity']}x {i['product']}/{i['item']}")
        print(f"  {q['quote_number']} | {q['quote_date']} | {q['client_name']} ({q['client_company']})")
        print(f"    Items: {', '.join(items_str)}")
        if q.get('include_vat', True):
            vat = "incl. VAT"
        else:
            vat = "excl. VAT"
        print(f"    Total: ${format_currency(q['total_usd'])} / {q.get('currency', 'both')} / {vat}")
        print()


def main():
    parser = argparse.ArgumentParser(description="BME Quote Generator")
    subparsers = parser.add_subparsers(dest="command", help="Command")

    # Price command
    price_parser = subparsers.add_parser("set-prices", help="Set product prices")
    price_parser.add_argument("--std-price", type=float, help="BLASTMAP STD price in USD")
    price_parser.add_argument("--premium-price", type=float, help="BLASTMAP PREMIUM price in USD")
    price_parser.add_argument("--tablet-price", type=float, help="XPLOLOG Android Tablet price in USD")
    price_parser.add_argument("--xplolog-price", type=float, help="XPLOLOG License annual price in USD")

    # Show prices
    subparsers.add_parser("prices", help="Show current prices")

    # Generate quote
    gen_parser = subparsers.add_parser("generate", help="Generate a new quote")
    gen_parser.add_argument("--client-name", required=True, help="Client contact name")
    gen_parser.add_argument("--client-company", required=True, help="Client company")
    gen_parser.add_argument("--client-email", required=True, help="Client email")
    gen_parser.add_argument("--client-phone", default="", help="Client phone")
    gen_parser.add_argument("--items", required=True,
                            help='Items as JSON, e.g. \'[{"version":"STD","quantity":2},{"version":"PREMIUM","quantity":1}]\'')
    gen_parser.add_argument("--prepared-by", default="Tinus Strauss", help="Prepared by")
    gen_parser.add_argument("--reference", default="", help="Reference")
    gen_parser.add_argument("--valid-days", type=int, default=30, help="Valid for N days")
    gen_parser.add_argument("--no-rate-update", action="store_true", help="Skip exchange rate update")
    gen_parser.add_argument("--no-vat", action="store_true", help="Generate quote without VAT")
    gen_parser.add_argument("--currency", choices=["usd", "zar", "both"], default="both",
                           help="Currency display: usd, zar, or both (default: both)")

    # History
    subparsers.add_parser("history", help="Show quote history")

    # Update rate
    subparsers.add_parser("update-rate", help="Update exchange rate")

    args = parser.parse_args()

    if args.command == "set-prices":
        set_prices(
            std_price=args.std_price,
            premium_price=args.premium_price,
            android_tablet_price=args.tablet_price,
            xplolog_license_price=args.xplolog_price
        )
    elif args.command == "prices":
        show_prices()
    elif args.command == "generate":
        items = json.loads(args.items)
        result = generate_quote(
            client_name=args.client_name,
            client_company=args.client_company,
            client_email=args.client_email,
            client_phone=args.client_phone,
            items=items,
            prepared_by=args.prepared_by,
            reference=args.reference,
            valid_days=args.valid_days,
            update_rate=not args.no_rate_update,
            include_vat=not args.no_vat,
            currency=args.currency,
        )
        if result:
            print(f"\nQuote {result['quote_number']} generated successfully!")
            print(f"  Client: {result['client_name']} ({result['client_company']})")
            if result['currency'] == 'zar':
                print(f"  Total:  {format_zar(result['total_zar'])}")
            else:
                print(f"  Total:  ${format_currency(result['total_usd'])}")
            if result['currency'] == 'both':
                print(f"  (ZAR: {format_zar(result['total_zar'])})")
            print(f"  PDF:    {result['pdf_path']}")
    elif args.command == "history":
        show_history()
    elif args.command == "update-rate":
        config = load_config()
        update_exchange_rate(config)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()