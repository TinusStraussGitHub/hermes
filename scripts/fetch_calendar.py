#!/usr/bin/env python3
"""
Fetch Outlook calendar iCal data and convert to Personal Insights Hub format.
Filters: Only upcoming events (today + 90 days), handles all-day vs timed events.
"""
import re
import json
import urllib.request
from datetime import datetime, timedelta

# Configuration
ICAL_URL = "https://outlook.office365.com/owa/calendar/b230ba720b3547b89d4e6e79b215ea28@bme.co.za/d273434a0b6347ef8a4b6cbe8e22a74411145327051186904376/calendar.ics"
OUTPUT_PATH = "/opt/data/home/hermes/data/schedule.json"

# Date range filter
today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
max_date = today + timedelta(days=90)

def parse_ical_datetime(dt_str):
    """Parse iCal datetime string (handles both YYYYMMDD and YYYYMMDDTHHMMSS formats)"""
    dt_str = dt_str.strip()
    
    # All-day event: YYYYMMDD (no T separator)
    if 'T' not in dt_str:
        return datetime.strptime(dt_str, "%Y%m%d")
    
    # Timed event: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    dt_str_clean = dt_str.rstrip('Z')
    
    # Try different formats
    for fmt in ["%Y%m%dT%H%M%S", "%Y%m%dT%H%M"]:
        try:
            dt = datetime.strptime(dt_str_clean, fmt)
            return dt
        except ValueError:
            continue
    
    return None

def fetch_ical():
    """Fetch iCal data from Outlook URL"""
    try:
        req = urllib.request.Request(ICAL_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching iCal: {e}")
        return None

def parse_events(ical_data):
    """Parse VEVENT blocks using regex"""
    events = []
    
    # Split into VEVENT blocks
    event_blocks = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', ical_data, re.DOTALL)
    
    for block in event_blocks:
        # Extract fields
        summary_match = re.search(r'SUMMARY:(.+)', block)
        dtstart_match = re.search(r'DTSTART(?:;[^:]*)*:(.+)', block)
        dtend_match = re.search(r'DTEND(?:;[^:]*)*:(.+)', block)
        
        if not summary_match or not dtstart_match:
            continue
        
        title = summary_match.group(1).strip()
        dtstart_str = dtstart_match.group(1).strip()
        
        # Parse start time
        dtstart = parse_ical_datetime(dtstart_str)
        if not dtstart:
            continue
        
        # Skip if before today or after max_date
        if dtstart < today or dtstart > max_date:
            continue
        
        # Calculate duration
        duration = "1h"  # default
        if dtend_match:
            dtend_str = dtend_match.group(1).strip()
            dtend = parse_ical_datetime(dtend_str)
            if dtend:
                diff = dtend - dtstart
                hours = diff.total_seconds() / 3600
                if hours < 1:
                    duration = f"{int(diff.total_seconds() / 60)}m"
                else:
                    duration = f"{hours}h"
        
        # Format time
        time_str = f"{dtstart.hour:02d}:{dtstart.minute:02d}" if dtstart.hour or dtstart.minute else ""
        
        events.append({
            'title': title,
            'time': time_str,
            'duration': duration,
            'datetime': dtstart
        })
    
    return events

def group_by_day(events):
    """Group events by day of week"""
    day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    days = {day: [] for day in day_order}
    
    for event in events:
        day_name = event['datetime'].strftime('%A')
        if day_name in days:
            days[day_name].append({
                'time': event['time'],
                'title': event['title'],
                'duration': event['duration']
            })
    
    # Sort events within each day by time
    for day in days:
        days[day].sort(key=lambda x: x['time'] if x['time'] else '99:99')
    
    # Return as list of dicts
    return [{'day': day, 'events': days[day]} for day in day_order if days[day]]

def main():
    print("Fetching calendar data...")
    ical_data = fetch_ical()
    
    if not ical_data:
        print("Failed to fetch iCal data. Keeping existing schedule.json.")
        return
    
    print("Parsing events...")
    events = parse_events(ical_data)
    print(f"Found {len(events)} upcoming events (today + 90 days)")
    
    if not events:
        print("No upcoming events found. Keeping existing schedule.json.")
        return
    
    weekly_schedule = group_by_day(events)
    
    # Write output
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(weekly_schedule, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully wrote {len(events)} events to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
