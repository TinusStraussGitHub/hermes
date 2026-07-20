#!/usr/bin/env python3
"""
Fetch Outlook calendar iCal data and convert to Personal Insights Hub format.
Filters: Only upcoming events (today + 90 days), handles all-day vs timed events.
Timezone handling: Converts all times to SAST (UTC+2).
"""
import re
import json
import urllib.request
from datetime import datetime, timedelta
try:
    from zoneinfo import ZoneInfo
    _HAVE_ZONEINFO = True
except Exception:  # pragma: no cover - extremely old interpreters
    _HAVE_ZONEINFO = False
    ZoneInfo = None  # type: ignore

# SAST as a real timezone (UTC+2, no DST) for astimezone conversions.
SAST_TZ = ZoneInfo('Africa/Johannesburg') if _HAVE_ZONEINFO else None

# Windows timezone names (as emitted by Outlook iCal) -> IANA zone.
# Using IANA via zoneinfo makes DST automatic (e.g. London BST in summer).
WINDOWS_TO_IANA = {
    'South Africa Standard Time': 'Africa/Johannesburg',
    'GMT Standard Time': 'Europe/London',          # UK: GMT in winter, BST (+1) in summer
    'Greenwich Standard Time': 'Africa/Monrovia',
    'W. Europe Standard Time': 'Europe/Berlin',
    'Romance Standard Time': 'Europe/Paris',
    'Central European Standard Time': 'Europe/Budapest',
    'E. Europe Standard Time': 'Europe/Chisinau',
    'Russia Time Zone 1': 'Europe/Kaliningrad',
    'Russian Standard Time': 'Europe/Moscow',
    'UTC': 'UTC',
    'E. Australia Standard Time': 'Australia/Brisbane',
    'AUS Eastern Standard Time': 'Australia/Sydney',
    'AUS Central Standard Time': 'Australia/Adelaide',
    'Cen. Australia Standard Time': 'Australia/Adelaide',
    'W. Australia Standard Time': 'Australia/Perth',
    'New Zealand Standard Time': 'Pacific/Auckland',
    'India Standard Time': 'Asia/Kolkata',
    'China Standard Time': 'Asia/Shanghai',
    'Tokyo Standard Time': 'Asia/Tokyo',
    'Korea Standard Time': 'Asia/Seoul',
    'Singapore Standard Time': 'Asia/Singapore',
    'SE Asia Standard Time': 'Asia/Bangkok',
    'Eastern Standard Time': 'America/New_York',
    'Central Standard Time': 'America/Chicago',
    'Mountain Standard Time': 'America/Denver',
    'Pacific Standard Time': 'America/Los_Angeles',
    'SA Western Standard Time': 'America/Bogota',
    'SA Pacific Standard Time': 'America/Bogota',
    'US Eastern Standard Time': 'America/New_York',
    'US Central Standard Time': 'America/Chicago',
    'US Mountain Standard Time': 'America/Denver',
    'US Pacific Standard Time': 'America/Los_Angeles',
    'Egypt Standard Time': 'Africa/Cairo',
    'Israel Standard Time': 'Asia/Jerusalem',
    'Arabian Standard Time': 'Asia/Dubai',
    'Fiji Standard Time': 'Pacific/Fiji',
}

# Configuration
ICAL_URL = "https://outlook.office365.com/owa/calendar/b230ba720b3547b89d4e6e79b215ea28@bme.co.za/d273434a0b6347ef8a4b6cbe8e22a74411145327051186904376/calendar.ics"
OUTPUT_PATH = "/opt/data/home/hermes/data/schedule.json"

# Date range filter
today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
max_date = today + timedelta(days=90)

# ── Timezone offset map (hours to add to get UTC) ──
# SAST = UTC+2, so to convert FROM a timezone TO SAST:
#   SAST_time = tz_time + (SAST_UTC_offset - tz_UTC_offset)
#   SAST_time = tz_time + (2 - tz_UTC_offset)
TZ_OFFSETS = {
    # Common Outlook timezone names → UTC offset in hours
    'South Africa Standard Time': 2,
    'GMT Standard Time': 0,
    'UTC': 0,
    'E. Australia Standard Time': 10,
    'AUS Eastern Standard Time': 10,
    'E. Europe Standard Time': 2,
    'Russian Standard Time': 3,
    'Kaliningrad Standard Time': 2,
    'W. Europe Standard Time': 1,
    'Romance Standard Time': 1,
    'Central European Standard Time': 1,
    'Eastern Standard Time': -5,
    'Pacific Standard Time': -8,
    'Central Standard Time': -6,
    'Mountain Standard Time': -7,
    'India Standard Time': 5.5,
    'China Standard Time': 8,
    'Tokyo Standard Time': 9,
    'Korea Standard Time': 9,
    'New Zealand Standard Time': 12,
    'W. Australia Standard Time': 8,
    'Cen. Australia Standard Time': 9.5,
    'AUS Central Standard Time': 9.5,
    'E. South America Standard Time': -3,
    'Argentina Standard Time': -3,
    'SA Western Standard Time': -4,
    'SA Pacific Standard Time': -5,
    'US Eastern Standard Time': -5,
    'US Mountain Standard Time': -7,
    'US Central Standard Time': -6,
    'US Pacific Standard Time': -8,
    'Alaskan Standard Time': -9,
    'Hawaiian Standard Time': -10,
    'Atlantic Standard Time': -4,
    'Newfoundland Standard Time': -3.5,
    'Central America Standard Time': -6,
    'Canada Central Standard Time': -6,
    'Mexico Standard Time': -6,
    'Eastern Brazil Standard Time': -3,
    'Greenland Standard Time': -1,
    'Mid-Atlantic Standard Time': -2,
    'Azores Standard Time': -1,
    'Cape Verde Standard Time': -1,
    'Greenwich Standard Time': 0,
    'Morocco Standard Time': 1,
    'W. Central Africa Standard Time': 1,
    'Egypt Standard Time': 2,
    'E. Africa Standard Time': 3,
    'Israel Standard Time': 2,
    'Jordan Standard Time': 2,
    'Middle East Standard Time': 2,
    'Syria Standard Time': 2,
    'Arab Standard Time': 3,
    'Arabian Standard Time': 4,
    'Caucasus Standard Time': 4,
    'Georgian Standard Time': 4,
    'Afghanistan Standard Time': 4.5,
    'West Asia Standard Time': 5,
    'Nepal Standard Time': 5.75,
    'Sri Lanka Standard Time': 5.5,
    'Myanmar Standard Time': 6.5,
    'SE Asia Standard Time': 7,
    'North Asia Standard Time': 7,
    'North Asia East Standard Time': 8,
    'Singapore Standard Time': 8,
    'Taipei Standard Time': 8,
    'Fiji Standard Time': 12,
    'Samoa Standard Time': 13,
    'Tonga Standard Time': 13,
    'Dateline Standard Time': -12,
}

SAST_UTC_OFFSET = 2  # SAST = UTC+2


def get_tz_offset(tz_name):
    """Get UTC offset in hours for a timezone name."""
    if tz_name in TZ_OFFSETS:
        return TZ_OFFSETS[tz_name]
    # Try partial match
    for key, val in TZ_OFFSETS.items():
        if key.lower() in tz_name.lower() or tz_name.lower() in key.lower():
            return val
    # Default: assume UTC if unknown
    print(f"  WARNING: Unknown timezone '{tz_name}', assuming UTC")
    return 0


def parse_ical_datetime(dt_str, tz_name=None):
    """
    Parse iCal datetime string and convert to SAST.

    Handles:
    - YYYYMMDD (all-day event)
    - YYYYMMDDTHHMMSS (floating time — assumed SAST)
    - YYYYMMDDTHHMMSSZ (UTC time)
    - With TZID prefix (converted from that timezone to SAST, DST-aware)
    """
    dt_str = dt_str.strip()

    # All-day event: YYYYMMDD (no T separator)
    if 'T' not in dt_str:
        return datetime.strptime(dt_str, "%Y%m%d"), False

    # Timed event
    dt_str_clean = dt_str.rstrip('Z')

    for fmt in ["%Y%m%dT%H%M%S", "%Y%m%dT%H%M"]:
        try:
            dt = datetime.strptime(dt_str_clean, fmt)
            break
        except ValueError:
            continue
    else:
        return None, False

    # Determine if this was UTC (Z suffix)
    is_utc = dt_str.strip().endswith('Z')

    if is_utc:
        # UTC time -> convert via zoneinfo to SAST (DST-safe)
        dt_aware = dt.replace(tzinfo=ZoneInfo('UTC')) if _HAVE_ZONEINFO else dt
        if _HAVE_ZONEINFO:
            dt = dt_aware.astimezone(SAST_TZ).replace(tzinfo=None)
    elif tz_name and tz_name != 'NONE':
        # Has a TZID -> convert from that timezone to SAST (DST-aware)
        if _HAVE_ZONEINFO:
            iana = WINDOWS_TO_IANA.get(tz_name)
            if iana is None:
                # fall back to static offset dict
                tz_offset = get_tz_offset(tz_name)
                delta = SAST_UTC_OFFSET - tz_offset
                if delta:
                    dt = dt + timedelta(hours=delta)
            else:
                dt_aware = dt.replace(tzinfo=ZoneInfo(iana))
                dt = dt_aware.astimezone(SAST_TZ).replace(tzinfo=None)
        else:
            # zoneinfo unavailable: static fallback
            tz_offset = get_tz_offset(tz_name)
            delta = SAST_UTC_OFFSET - tz_offset
            if delta:
                dt = dt + timedelta(hours=delta)
    # else: floating time (no Z, no TZID) — already in local/SAST, no conversion

    return dt, True


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
    """Parse VEVENT blocks using regex, converting all times to SAST"""
    events = []

    event_blocks = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', ical_data, re.DOTALL)

    for block in event_blocks:
        summary_match = re.search(r'SUMMARY:(.+)', block)
        dtstart_match = re.search(r'DTSTART(?:;[^:]*)*:(.+)', block)
        dtend_match = re.search(r'DTEND(?:;[^:]*)*:(.+)', block)

        if not summary_match or not dtstart_match:
            continue

        title = summary_match.group(1).strip()
        dtstart_str = dtstart_match.group(1).strip()

        # Extract TZID from DTSTART line
        tz_match = re.search(r'TZID=([^:]+):', dtstart_match.group(0))
        tz_name = tz_match.group(1) if tz_match else None

        # Parse start time (converted to SAST)
        dtstart, is_timed = parse_ical_datetime(dtstart_str, tz_name)
        if not dtstart:
            continue

        # Skip if before today or after max_date
        if dtstart < today or dtstart > max_date:
            continue

        # Calculate duration
        duration = "1h"  # default
        if dtend_match:
            dtend_str = dtend_match.group(1).strip()
            # Extract TZID from DTEND line
            tz_end_match = re.search(r'TZID=([^:]+):', dtend_match.group(0))
            tz_end_name = tz_end_match.group(1) if tz_end_match else tz_name
            dtend, _ = parse_ical_datetime(dtend_str, tz_end_name)
            if dtend:
                diff = dtend - dtstart
                hours = diff.total_seconds() / 3600
                if hours < 1:
                    duration = f"{int(diff.total_seconds() / 60)}m"
                else:
                    duration = f"{hours}h"

        # Format time string
        time_str = f"{dtstart.hour:02d}:{dtstart.minute:02d}" if is_timed else ""

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

    # Debug: print what we parsed
    for day in weekly_schedule:
        print(f"\n{day['day']}:")
        for e in day['events']:
            print(f"  {e['time']:6s} - {e['title'][:60]}")


if __name__ == "__main__":
    main()
