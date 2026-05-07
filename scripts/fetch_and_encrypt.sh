#!/bin/bash
# Wrapper script to fetch data and encrypt with password tinus2026
# Usage: ./fetch_and_encrypt.sh

set -e

cd /opt/data/home/hermes

# Fetch calendar data
echo "Fetching calendar data..."
python3 scripts/fetch_calendar.py

# Encrypt calendar data
echo "Encrypting calendar data..."
node encrypt-data.js data/schedule.json data/schedule.enc.json tinus2026

# Fetch AI news
echo "Fetching AI news..."
python3 scripts/fetch_ai_news.py

# Encrypt AI news
echo "Encrypting AI news..."
node encrypt-data.js data/ai-news.json data/ai-news.enc.json tinus2026

# Fetch Bible verse
echo "Fetching Bible verse..."
python3 scripts/fetch_bible_verse.py

# Encrypt Bible verse
echo "Encrypting Bible verse..."
node encrypt-data.js data/bible-verse.json data/bible-verse.enc.json tinus2026

# Fetch weather (if script exists)
if [ -f "scripts/fetch_weather.py" ]; then
    echo "Fetching weather..."
    python3 scripts/fetch_weather.py
    echo "Encrypting weather data..."
    node encrypt-data.js data/weather.json data/weather.enc.json tinus2026
fi

echo "All data fetched and encrypted with password: tinus2026"
