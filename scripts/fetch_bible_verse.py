#!/usr/bin/env python3
"""
Fetch daily Bible verse (KJV).
Saves to /opt/data/home/hermes/data/bible-verse.json
"""
import json
import urllib.request
from datetime import datetime

def fetch_bible_verse():
    """Fetch a daily verse - using a simple API"""
    try:
        # Using bible-api.com (returns KJV by default)
        url = "https://bible-api.com/random?translation=kjv"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        return {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'reference': data.get('reference', 'John 3:16'),
            'text': data.get('text', '').strip(),
            'translation': 'KJV'
        }
    except Exception as e:
        print(f"Error fetching Bible verse: {e}")
        # Fallback verse
        return {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'reference': 'Philippians 4:13',
            'text': 'I can do all things through Christ which strengtheneth me.',
            'translation': 'KJV'
        }

def main():
    print("Fetching daily Bible verse...")
    verse = fetch_bible_verse()
    
    output_path = '/opt/data/home/hermes/data/bible-verse.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(verse, f, indent=2, ensure_ascii=False)
    
    print(f"Saved Bible verse to {output_path}: {verse['reference']}")

if __name__ == '__main__':
    main()
