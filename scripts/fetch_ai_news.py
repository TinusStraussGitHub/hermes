#!/usr/bin/env python3
"""
Fetch daily AI news from RSS feeds.
Saves to /opt/data/home/hermes/data/ai-news.json
"""
import json
import urllib.request
from datetime import datetime

def fetch_ai_news():
    """Fetch AI news from multiple RSS feeds"""
    feeds = [
        "https://techcrunch.com/tag/artificial-intelligence/feed/",
        "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    ]
    
    articles = []
    
    for feed_url in feeds:
        try:
            # Parse RSS feed (simple regex-based, no feedparser needed)
            req = urllib.request.Request(feed_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as response:
                xml_data = response.read().decode('utf-8', errors='ignore')
            
            # Extract items using regex
            items = re.findall(r'<item>(.*?)</item>', xml_data, re.DOTALL)
            
            for item in items[:5]:  # Max 5 per feed
                title_match = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>', item)
                link_match = re.search(r'<link>(.*?)</link>', item)
                desc_match = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>', item)
                
                if title_match:
                    title = title_match.group(1) or title_match.group(2)
                    link = link_match.group(1) if link_match else ""
                    desc = desc_match.group(1) or desc_match.group(2) if desc_match else ""
                    
                    articles.append({
                        'title': title.strip(),
                        'url': link.strip(),
                        'summary': desc.strip()[:200] if desc else "",
                        'source': 'TechCrunch' if 'techcrunch' in feed_url else 'MIT Tech Review'
                    })
                    
                    if len(articles) >= 10:  # Max 10 total
                        break
        except Exception as e:
            print(f"Error fetching from {feed_url}: {e}")
    
    return articles

def main():
    print("Fetching AI news...")
    articles = fetch_ai_news()
    
    output = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'headlines': articles[:10],
        'summary': f"Today's AI news: {len(articles)} articles from top sources."
    }
    
    output_path = '/opt/data/home/hermes/data/ai-news.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"Saved {len(articles)} AI news articles to {output_path}")

if __name__ == '__main__':
    import re
    main()
