#!/usr/bin/env python3
"""
Fetch weather data from wttr.in API for Delmas, Mpumalanga, South Africa.
Saves to data/weather.json in the format expected by Personal Insights Hub.
"""
import json
import urllib.request
from datetime import datetime, timezone

def fetch_weather():
    # wttr.in API - replace spaces with + in URL
    city = 'Delmas,Mpumalanga,South+Africa'
    url = f'https://wttr.in/{city}?format=j1'
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        # Parse current weather
        current = data.get('current_condition', [{}])[0]
        temp = int(current.get('temp_C', 0))
        condition = current.get('weatherDesc', [{}])[0].get('value', 'Unknown')
        humidity = int(current.get('humidity', 0))
        wind = int(current.get('windspeedKmph', 0))
        
        # Map condition to icon
        condition_lower = condition.lower()
        if 'sunny' in condition_lower or 'clear' in condition_lower:
            icon = '☀️'
        elif 'partly cloudy' in condition_lower:
            icon = '⛅'
        elif 'cloudy' in condition_lower:
            icon = '☁️'
        elif 'rain' in condition_lower:
            icon = '🌧️'
        elif 'snow' in condition_lower:
            icon = '❄️'
        elif 'storm' in condition_lower or 'thunder' in condition_lower:
            icon = '⛈️'
        elif 'fog' in condition_lower or 'mist' in condition_lower:
            icon = '🌫️'
        else:
            icon = '🌤️'
        
        # Parse forecast (next 3 days)
        forecast = []
        weather_arr = data.get('weather', [])
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        for i, day_data in enumerate(weather_arr[:3]):
            date_str = day_data.get('date', '')
            try:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
                day_name = days[dt.weekday()]
            except:
                day_name = days[i] if i < len(days) else 'Day'
            
            high = int(day_data.get('maxtempC', 0))
            low = int(day_data.get('mintempC', 0))
            
            # Get representative condition for the day
            hourly = day_data.get('hourly', [{}])
            midday = hourly[4] if len(hourly) > 4 else hourly[0]  # 12:00 noon
            day_condition = midday.get('weatherDesc', [{}])[0].get('value', 'Unknown')
            
            # Map to icon
            day_condition_lower = day_condition.lower()
            if 'sunny' in day_condition_lower or 'clear' in day_condition_lower:
                day_icon = '☀️'
            elif 'partly cloudy' in day_condition_lower:
                day_icon = '⛅'
            elif 'cloudy' in day_condition_lower:
                day_icon = '☁️'
            elif 'rain' in day_condition_lower:
                day_icon = '🌧️'
            else:
                day_icon = '🌤️'
            
            forecast.append({
                'day': day_name,
                'high': high,
                'low': low,
                'condition': day_condition,
                'icon': day_icon
            })
        
        # Build output
        output = {
            'location': 'Delmas, Mpumalanga, South Africa',
            'current': {
                'temp': temp,
                'condition': condition,
                'humidity': humidity,
                'wind': wind,
                'icon': icon
            },
            'forecast': forecast,
            'last_updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
        }
        
        return output
        
    except Exception as e:
        print(f'Error fetching weather: {e}')
        return None

def main():
    print('Fetching weather data...')
    weather_data = fetch_weather()
    
    if not weather_data:
        print('Failed to fetch weather data.')
        return
    
    # Save to JSON
    output_path = '/opt/data/home/hermes/data/weather.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(weather_data, f, indent=2, ensure_ascii=False)
    
    print(f'Successfully saved weather data to {output_path}')
    print(f"Current: {weather_data['current']['temp']}°C, {weather_data['current']['condition']}")

if __name__ == '__main__':
    main()
