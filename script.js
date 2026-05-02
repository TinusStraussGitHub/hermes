// Configuration
const PASSWORD_HASH = '21930c0854d25f9222d95fd4237f475d3e403e2161194a04b087a14302ce05ee'; // SHA-256 of 'tinus2026'
const DATA_BASE = 'data/';

// State
let isDarkMode = false;
let allInsightsCollapsed = true;
let notes = [];
let decryptedPassword = null; // Store password after login

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated
  if (sessionStorage.getItem('hermes_auth') === 'true') {
    showApp();
  }
  
  // Check system dark mode preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    isDarkMode = true;
    document.documentElement.classList.add('dark');
    updateThemeIcon();
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('hermes_theme')) {
      isDarkMode = e.matches;
      document.documentElement.classList.toggle('dark', isDarkMode);
      updateThemeIcon();
    }
  });
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});

// Password check
async function checkPassword() {
  const input = document.getElementById('passwordInput').value;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (hashHex === PASSWORD_HASH) {
    sessionStorage.setItem('hermes_auth', 'true');
    decryptedPassword = input; // Store password for data decryption
    showApp();
  } else {
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'block';
    document.getElementById('passwordInput').value = '';
    setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
  }
}

function showApp() {
  document.getElementById('loginModal').classList.remove('active');
  document.getElementById('app').style.display = 'block';
  loadAllData();
}

function logout() {
  sessionStorage.removeItem('hermes_auth');
  decryptedPassword = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginModal').classList.add('active');
}

// Dark mode toggle
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.documentElement.classList.toggle('dark', isDarkMode);
  localStorage.setItem('hermes_theme', isDarkMode ? 'dark' : 'light');
  updateThemeIcon();
  
  // Update theme-color meta
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = isDarkMode ? '#000000' : '#f5f5f7';
  }
}

function updateThemeIcon() {
  const icon = document.getElementById('themeIcon');
  icon.textContent = isDarkMode ? '☀️' : '🌙';
}

// Load all data
async function loadAllData() {
  // Ensure we have the password
  if (!decryptedPassword) {
    decryptedPassword = 'tinus2026'; // Fallback
  }
  
  await Promise.all([
    loadSchedule(),
    loadWeather(),
    loadKnowledge(),
    loadInsights()
  ]);
}

// Decrypt data
async function decryptData(encryptedData, password) {
  try {
    const salt = Uint8Array.from(atob(encryptedData.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedData.ciphertext), c => c.charCodeAt(0));
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-CBC', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    console.error('Decryption failed:', e);
    throw new Error('Failed to decrypt data');
  }
}

// Load schedule
async function loadSchedule() {
  try {
    const response = await fetch(DATA_BASE + 'schedule.enc.json');
    if (!response.ok) throw new Error('Failed to load schedule');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    renderSchedule(data);
  } catch (error) {
    console.error('Schedule load error:', error);
    document.getElementById('scheduleList').innerHTML = 
      '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No calendar data available</p>';
  }
}

function renderSchedule(events) {
  const container = document.getElementById('scheduleList');
  if (!events || events.length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No events today</p>';
    return;
  }
  
  container.innerHTML = events.map((event, idx) => `
    <div class="event-item" style="animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s backwards;">
      <div class="event-title">${escapeHtml(event.summary || event.title || 'Untitled Event')}</div>
      <div class="event-time">
        🕐 ${formatTime(event.start || event.startTime)} - ${formatTime(event.end || event.endTime)}
        ${event.location ? `• 📍 ${escapeHtml(event.location)}` : ''}
      </div>
    </div>
  `).join('');
}

// Load weather
async function loadWeather() {
  try {
    const response = await fetch(DATA_BASE + 'weather.enc.json');
    if (!response.ok) throw new Error('Failed to load weather');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    renderWeather(data);
  } catch (error) {
    console.error('Weather load error:', error);
    document.getElementById('weatherInfo').innerHTML = 
      '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">Weather data unavailable</p>';
  }
}

function renderWeather(data) {
  const container = document.getElementById('weatherInfo');
  const temp = Math.round(data.main?.temp || data.temperature || 0);
  const desc = data.weather?.[0]?.description || data.condition || 'Unknown';
  const icon = getWeatherEmoji(data.weather?.[0]?.main || data.condition || '');
  const humidity = data.main?.humidity || data.humidity || '--';
  const wind = Math.round((data.wind?.speed || data.wind_speed || 0) * 3.6);
  const feelsLike = Math.round(data.main?.feels_like || data.feels_like || temp);
  
  container.innerHTML = `
    <div class="weather-main">
      <div class="weather-icon">${icon}</div>
      <div>
        <div class="weather-temp">${temp}°C</div>
        <div class="weather-desc">${escapeHtml(desc)}</div>
        <div style="font-size: 14px; color: var(--text-tertiary); margin-top: 4px;">
          Feels like ${feelsLike}°C
        </div>
      </div>
    </div>
    <div class="weather-details">
      <div class="weather-detail-item">
        <div class="weather-detail-label">Humidity</div>
        <div class="weather-detail-value">${humidity}%</div>
      </div>
      <div class="weather-detail-item">
        <div class="weather-detail-label">Wind</div>
        <div class="weather-detail-value">${wind} km/h</div>
      </div>
      <div class="weather-detail-item">
        <div class="weather-detail-label">Condition</div>
        <div class="weather-detail-value" style="font-size: 14px;">${escapeHtml(desc)}</div>
      </div>
    </div>
  `;
}

function getWeatherEmoji(condition) {
  const map = {
    'Clear': '☀️', 'Sunny': '☀️', 'Clouds': '☁️', 'Cloudy': '☁️',
    'Rain': '🌧️', 'Drizzle': '🌦️', 'Thunderstorm': '⛈️',
    'Snow': '❄️', 'Mist': '🌫️', 'Fog': '🌫️', 'Haze': '🌫️'
  };
  return map[condition] || '🌤️';
}

// Load knowledge
async function loadKnowledge() {
  try {
    const response = await fetch(DATA_BASE + 'knowledge.enc.json');
    if (!response.ok) throw new Error('Failed to load knowledge');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    notes = data;
    document.getElementById('noteCount').textContent = `${data.length} notes`;
    renderKnowledge(data);
  } catch (error) {
    console.error('Knowledge load error:', error);
    document.getElementById('knowledgeList').innerHTML = 
      '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No notes available</p>';
  }
}

function renderKnowledge(notesToShow) {
  const container = document.getElementById('knowledgeList');
  if (!notesToShow || notesToShow.length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No notes found</p>';
    return;
  }
  
  container.innerHTML = notesToShow.map((note, idx) => `
    <div class="knowledge-card" onclick="openNoteModal(${idx})" 
         style="animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s backwards;">
      <h3>${escapeHtml(note.title || 'Untitled')}</h3>
      <p>${escapeHtml(note.summary || (note.content && note.content.substring(0, 150)) || 'No preview available')}</p>
      ${note.tags ? `<div class="tags">${note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
    </div>
  `).join('');
}

function searchNotes() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  if (!notes || notes.length === 0) return;
  
  const filtered = notes.filter(note => 
    (note.title && note.title.toLowerCase().includes(query)) ||
    (note.content && note.content.toLowerCase().includes(query)) ||
    (note.summary && note.summary.toLowerCase().includes(query)) ||
    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
  );
  
  renderKnowledge(filtered);
}

// Load insights
async function loadInsights() {
  try {
    const response = await fetch(DATA_BASE + 'insights.enc.json');
    if (!response.ok) throw new Error('Failed to load insights');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    renderInsights(data);
  } catch (error) {
    console.error('Insights load error:', error);
    document.getElementById('insightsList').innerHTML = 
      '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No insights available</p>';
  }
}

function renderInsights(insights) {
  const container = document.getElementById('insightsList');
  if (!insights || insights.length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No insights available</p>';
    return;
  }
  
  // Start with all insights collapsed
  allInsightsCollapsed = true;
  document.getElementById('toggleAllText').textContent = 'Expand All';
  
  container.innerHTML = insights.map((insight, idx) => `
    <div class="insight-item" style="animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s backwards;">
      <div class="insight-header" onclick="toggleInsight(${idx})">
        <div class="insight-title">${escapeHtml(insight.title || `Insight ${idx + 1}`)}</div>
        <div class="insight-toggle" id="insightToggle${idx}">▼</div>
      </div>
      <div class="insight-content" id="insightContent${idx}">
        <div class="insight-text">${formatNoteContent(insight.content || insight.text || 'No content')}</div>
      </div>
    </div>
  `).join('');
}

function toggleInsight(idx) {
  const content = document.getElementById(`insightContent${idx}`);
  const toggle = document.getElementById(`insightToggle${idx}`);
  content.classList.toggle('expanded');
  toggle.style.transform = content.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
  
  // Update allInsightsCollapsed state
  const allContents = document.querySelectorAll('.insight-content');
  const allToggles = document.querySelectorAll('.insight-toggle');
  const anyExpanded = Array.from(allContents).some(c => c.classList.contains('expanded'));
  allInsightsCollapsed = !anyExpanded;
  document.getElementById('toggleAllText').textContent = allInsightsCollapsed ? 'Expand All' : 'Collapse All';
}

function toggleAllInsights() {
  const contents = document.querySelectorAll('.insight-content');
  const toggles = document.querySelectorAll('.insight-toggle');
  const text = document.getElementById('toggleAllText');
  
  allInsightsCollapsed = !allInsightsCollapsed;
  
  contents.forEach((content, idx) => {
    if (allInsightsCollapsed) {
      content.classList.remove('expanded');
      toggles[idx].style.transform = 'rotate(0deg)';
    } else {
      content.classList.add('expanded');
      toggles[idx].style.transform = 'rotate(180deg)';
    }
  });
  
  text.textContent = allInsightsCollapsed ? 'Expand All' : 'Collapse All';
}

// Note modal
function openNoteModal(idx) {
  if (!notes || idx >= notes.length) return;
  const note = notes[idx];
  document.getElementById('noteModalTitle').textContent = note.title || 'Untitled';
  document.getElementById('noteModalContent').innerHTML = formatNoteContent(note.content || 'No content');
  
  const tagsContainer = document.getElementById('noteModalTags');
  tagsContainer.innerHTML = note.tags ? 
    note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '';
  
  document.getElementById('noteModal').classList.add('active');
}

function closeNoteModal(event) {
  if (event && event.target !== document.getElementById('noteModal')) return;
  document.getElementById('noteModal').classList.remove('active');
}

// Utilities
function formatTime(dateStr) {
  if (!dateStr) return '--:--';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatNoteContent(content) {
  if (!content) return '';
  return escapeHtml(content)
    .replace(/\n/g, '<br>')
    .replace(/#{1,6}\s?(.*)/g, '<strong>$1</strong>')
    .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
    .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openObsidianVault() {
  alert('Obsidian vault path: ~/Documents/Obsidian Vault/\nOpen this path in your Obsidian app.');
}
