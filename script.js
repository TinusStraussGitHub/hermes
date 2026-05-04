// Configuration
const PASSWORD_HASH = '21930c0854d25f9222d95fd4237f475d3e403e2161194a04b087a14302ce05ee'; // SHA-256 of 'tinus2026'
const DATA_BASE = 'data/';

// State
let isDarkMode = false;
let allInsightsCollapsed = true;
let notes = [];
let decryptedPassword = null;
let weeklyScheduleData = null;
let currentSelectedDay = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('hermes_auth') === 'true') {
    showApp();
  }
  
  // First check if user has a saved theme preference in localStorage
  const savedTheme = localStorage.getItem('hermes_theme');
  if (savedTheme) {
    // Use saved preference
    isDarkMode = savedTheme === 'dark';
    document.documentElement.classList.toggle('dark', isDarkMode);
    updateThemeIcon();
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Fall back to system preference if no saved preference
    isDarkMode = true;
    document.documentElement.classList.add('dark');
    updateThemeIcon();
  }
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('hermes_theme')) {
      isDarkMode = e.matches;
      document.documentElement.classList.toggle('dark', isDarkMode);
      updateThemeIcon();
    }
  });
  
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
    decryptedPassword = input;
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
  if (!decryptedPassword) {
    decryptedPassword = 'tinus2026';
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

// Load schedule (weekly format)
async function loadSchedule() {
  try {
    const response = await fetch(DATA_BASE + 'schedule.enc.json');
    if (!response.ok) throw new Error('Failed to load schedule');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    weeklyScheduleData = data;
    renderWeeklyCalendar(data);
  } catch (error) {
    console.error('Schedule load error:', error);
    document.getElementById('weeklyCalendar').innerHTML = 
      '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No schedule data available</p>';
  }
}

// Render weekly calendar with day buttons
function renderWeeklyCalendar(weekData) {
  const container = document.getElementById('weeklyCalendar');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  
  container.innerHTML = weekData.map(dayData => {
    const isToday = dayData.day === today;
    const eventCount = dayData.events ? dayData.events.length : 0;
    const isSelected = currentSelectedDay === dayData.day;
    
    return `
      <div onclick="selectDay('${dayData.day}')" 
           style="
             background: ${isSelected ? 'var(--accent)' : (isToday ? 'var(--accent-light)' : 'var(--bg-secondary)')};
             color: ${isSelected ? 'white' : 'var(--text-primary)'};
             border: 1px solid ${isToday ? 'var(--accent)' : 'var(--border-light)'};
             border-radius: var(--radius-sm);
             padding: 12px;
             cursor: pointer;
             transition: all 0.3s ease;
             text-align: center;
             animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) backwards;
           "
           onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';"
           onmouseout="this.style.transform=''; this.style.boxShadow='';">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
          ${isToday ? '📍 ' : ''}${dayData.day}
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          ${eventCount} event${eventCount !== 1 ? 's' : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Show today's schedule by default
  if (!currentSelectedDay) {
    selectDay(today);
  }
}

// Select a day to view its schedule
function selectDay(dayName) {
  currentSelectedDay = dayName;
  const dayData = weeklyScheduleData.find(d => d.day === dayName);
  
  // Update title
  document.getElementById('scheduleTitle').textContent = `${dayName}'s Schedule`;
  
  // Show back button
  document.getElementById('backToWeekBtn').style.display = 'block';
  
  // Re-render calendar to show selection
  renderWeeklyCalendar(weeklyScheduleData);
  
  // Render events for selected day
  renderDaySchedule(dayData);
}

// Show weekly view
function showWeeklyView() {
  currentSelectedDay = null;
  document.getElementById('scheduleTitle').textContent = 'Weekly Schedule';
  document.getElementById('backToWeekBtn').style.display = 'none';
  renderWeeklyCalendar(weeklyScheduleData);
  document.getElementById('scheduleList').innerHTML = '';
}

// Render schedule for a specific day
function renderDaySchedule(dayData) {
  const container = document.getElementById('scheduleList');
  
  if (!dayData || !dayData.events || dayData.events.length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No events for this day</p>';
    return;
  }
  
  container.innerHTML = dayData.events.map((event, idx) => `
    <div class="event-item" style="animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s backwards;">
      <div class="event-title">${escapeHtml(event.title || 'Untitled Event')}</div>
      <div class="event-time">
        🕐 ${event.time || '--:--'} (${event.duration || '1h'})
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
  const current = data.current || {};
  const temp = current.temp || 0;
  const desc = current.condition || 'Unknown';
  const icon = current.icon || '🌤️';
  const humidity = current.humidity || '--';
  const wind = current.wind || 0;
  
  container.innerHTML = `
    <div class="weather-main">
      <div class="weather-icon">${icon}</div>
      <div>
        <div class="weather-temp">${temp}°C</div>
        <div class="weather-desc">${escapeHtml(desc)}</div>
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
    </div>
    ${data.forecast ? `
    <div style="margin-top: 16px;">
      <div style="font-size: 14px; color: var(--text-tertiary); margin-bottom: 8px;">3-Day Forecast</div>
      <div style="display: flex; gap: 8px;">
        ${data.forecast.map(day => `
          <div style="flex: 1; background: var(--bg-secondary); padding: 10px; border-radius: var(--radius-sm); text-align: center; border: 1px solid var(--border-light);">
            <div style="font-size: 12px; color: var(--text-tertiary);">${day.day}</div>
            <div style="font-size: 20px; margin: 4px 0;">${day.icon || '🌤️'}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${day.low}° / ${day.high}°</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;
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
  
  // Insights is an object with keys, convert to array
  const insightsArray = Object.entries(insights)
    .filter(([key]) => key !== 'last_generated' && key !== 'last_updated')
    .map(([key, value]) => ({
      id: key,
      title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: value
    }));
  
  if (insightsArray.length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No insights available</p>';
    return;
  }
  
  allInsightsCollapsed = true;
  document.getElementById('toggleAllText').textContent = 'Expand All';
  
  container.innerHTML = insightsArray.map((insight, idx) => `
    <div class="insight-item" style="animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s backwards;">
      <div class="insight-header" onclick="toggleInsight(${idx})">
        <div class="insight-title">${escapeHtml(insight.title)}</div>
        <div class="insight-toggle" id="insightToggle${idx}">▼</div>
      </div>
      <div class="insight-content" id="insightContent${idx}">
        <div class="insight-text">${formatNoteContent(insight.content)}</div>
      </div>
    </div>
  `).join('');
}

function toggleInsight(idx) {
  const content = document.getElementById(`insightContent${idx}`);
  const toggle = document.getElementById(`insightToggle${idx}`);
  content.classList.toggle('expanded');
  toggle.style.transform = content.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
  
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
function formatNoteContent(content) {
  if (!content) return '';
  
  // Configure marked for safe rendering
  if (typeof marked !== 'undefined') {
    // Parse markdown to HTML
    return marked.parse(content, {
      breaks: true,
      gfm: true  // GitHub Flavored Markdown (tables, strikethrough, etc.)
    });
  }
  
  // Fallback to basic formatting if marked is not available
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
