// Configuration
const PASSWORD_HASH = '5f26acbec5d43ca191b9859e2aa887868091fc51c5e57df4eee9d72bfc6f19b0'; // SHA-256 of 'tinus1979'
const DATA_BASE = 'data/';

// State
let isDarkMode = false;
let notes = [];
let decryptedPassword = null;
let weeklyScheduleData = null;
let currentSelectedDay = null;
let showAllEvents = false;

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
    decryptedPassword = 'tinus1979';
  }
  
  await Promise.all([
    loadSchedule(),
    loadWeather(),
    loadKnowledge(),
    loadInsights(),
    loadStandup(),
    loadAiNews(),
    loadBibleVerse()
  ]);
}

// Toggle section visibility
function toggleSection(sectionName) {
  const section = document.getElementById(sectionName + 'Section');
  const toggleText = document.getElementById(sectionName + 'ToggleText');
  
  if (!section || !toggleText) return;
  
  section.classList.toggle('collapsed');
  toggleText.textContent = section.classList.contains('collapsed') ? 'Expand' : 'Collapse';
}

// Load Weather
async function loadWeather() {
  try {
    const response = await fetch(DATA_BASE + 'weather.enc.json');
    if (!response.ok) throw new Error('Failed to load weather');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    renderWeather(data);
  } catch (error) {
    console.error('Weather load error:', error);
    const container = document.getElementById('weatherWidget');
    if (container) {
      container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No weather data available</p>';
    }
  }
}

function renderWeather(data) {
  const container = document.getElementById('weatherWidget');
  if (!container) return;
  
  if (!data || !data.current) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No weather data available</p>';
    return;
  }
  
  const forecastHTML = data.forecast ? data.forecast.map(day => `
    <div style="text-align: center; padding: 8px;">
      <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${day.day}</div>
      <div style="font-size: 24px; margin: 4px 0;">${day.icon || '☀️'}</div>
      <div style="font-size: 14px; font-weight: 500;">${day.high}°</div>
      <div style="font-size: 12px; color: var(--text-tertiary);">${day.low}°</div>
    </div>
  `).join('') : '';
  
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <span style="font-size: 48px;">${data.current.icon || '🌤️'}</span>
          <div>
            <div style="font-size: 36px; font-weight: 300; color: var(--text-primary);">${data.current.temp}°C</div>
            <div style="font-size: 14px; color: var(--text-secondary);">${data.current.condition || 'Unknown'}</div>
          </div>
        </div>
        <div style="display: flex; gap: 16px; font-size: 13px; color: var(--text-tertiary);">
          <span>💧 ${data.current.humidity || '--'}%</span>
          <span>💨 ${data.current.wind || '--'} km/h</span>
        </div>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        ${forecastHTML}
      </div>
    </div>
    <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 12px; text-align: right;">
      Last updated: ${data.last_updated || 'Unknown'}
    </div>
  `;
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
  showAllEvents = false; // Reset to default view when switching days
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
  
  // Show ALL events for the selected day (no time filtering)
  // The day button already shows the correct count
  const displayEvents = showAllEvents ? dayData.events : dayData.events.slice(0, 5);
  const hasMoreEvents = dayData.events.length > 5 && !showAllEvents;
  
  container.innerHTML = `
    ${displayEvents.map((event, idx) => `
      <div class="event-item" style="animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s backwards;">
        <div class="event-title">${escapeHtml(event.title || 'Untitled Event')}</div>
        <div class="event-time">
          🕐 ${event.time || '--:--'} (${event.duration || '1h'})
        </div>
      </div>
    `).join('')}
    ${hasMoreEvents ? `
      <button onclick="toggleShowAllEvents()" class="modern-btn secondary" style="margin-top: 12px; width: 100%;">
        Show All Events (${dayData.events.length - 5} more)
      </button>
    ` : ''}
    ${showAllEvents && dayData.events.length > 5 ? `
      <button onclick="toggleShowAllEvents()" class="modern-btn secondary" style="margin-top: 12px; width: 100%;">
        Show Less
      </button>
    ` : ''}
  `;
}

// Toggle show all events
function toggleShowAllEvents() {
  showAllEvents = !showAllEvents;
  const dayData = weeklyScheduleData.find(d => d.day === currentSelectedDay);
  renderDaySchedule(dayData);
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
}

// Load AI News
async function loadAiNews() {
  try {
    const response = await fetch(DATA_BASE + 'ai-news.enc.json');
    if (!response.ok) throw new Error('Failed to load AI news');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    renderAiNews(data);
  } catch (error) {
    console.error('AI News load error:', error);
    const container = document.getElementById('aiNewsList');
    if (container) {
      container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No AI news available</p>';
    }
  }
}

function renderAiNews(data) {
  const container = document.getElementById('aiNewsList');
  if (!container) return;
  
  if (!data || !data.headlines || data.headlines.length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No AI news available</p>';
    return;
  }
  
  container.innerHTML = data.headlines.map((article, idx) => `
    <div class="news-item" style="animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s backwards;">
      <div class="news-title">
        <a href="${article.url || '#'}" target="_blank" style="color: var(--text-primary); text-decoration: none;">
          ${escapeHtml(article.title || 'Untitled')}
        </a>
      </div>
      <div class="news-meta">
        <span class="news-source">${escapeHtml(article.source || 'Unknown')}</span>
      </div>
    </div>
  `).join('');
}

// Load Bible Verse
async function loadBibleVerse() {
  try {
    const response = await fetch(DATA_BASE + 'bible-verse.enc.json');
    if (!response.ok) throw new Error('Failed to load Bible verse');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    renderBibleVerse(data);
  } catch (error) {
    console.error('Bible Verse load error:', error);
    const container = document.getElementById('bibleVerseContainer');
    if (container) {
      container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No verse available</p>';
    }
  }
}

function renderBibleVerse(data) {
  const container = document.getElementById('bibleVerseContainer');
  if (!container) return;
  
  if (!data || !data.reference) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No verse available</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="verse-reference">${escapeHtml(data.reference)}</div>
    <div class="verse-text">${escapeHtml(data.text || '')}</div>
    <div class="verse-translation">${escapeHtml(data.translation || 'KJV')}</div>
  `;
}

// Note modal
function openNoteModal(idx) {
  if (!notes || idx >= notes.length) return;
  const note = notes[idx];
  document.getElementById('noteModalTitle').textContent = note.title || 'Untitled';
  
  // Format content with markdown
  const formattedContent = formatNoteContent(note.content || 'No content');
  
  // Generate table of contents from headings
  const toc = generateTableOfContents(note.content || '');
  
  // Combine TOC and content
  const fullContent = toc + '<div class="markdown-body">' + formattedContent + '</div>';
  document.getElementById('noteModalContent').innerHTML = fullContent;
  
  // Add reading progress bar
  addReadingProgress();
  
  const tagsContainer = document.getElementById('noteModalTags');
  tagsContainer.innerHTML = note.tags ? 
    note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '';
  
  document.getElementById('noteModal').classList.add('active');
}

function closeNoteModal(event) {
  if (event && event.target !== document.getElementById('noteModal')) return;
  document.getElementById('noteModal').classList.remove('active');
  // Remove progress bar on close
  const progressBar = document.querySelector('.reading-progress');
  if (progressBar) progressBar.remove();
}

// Generate table of contents from markdown headings
function generateTableOfContents(markdown) {
  if (!markdown) return '';
  
  // Extract headings (h1-h4)
  const headingRegex = /^(#{1,4})\s+(.+)$/gm;
  const headings = [];
  let match;
  
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    
    headings.push({ level, text, id });
  }
  
  if (headings.length === 0) return '';
  
  // Build TOC HTML
  let tocHTML = '<div class="toc-container"><div class="toc-title">📑 Table of Contents</div><ul class="toc-list">';
  
  headings.forEach(heading => {
    const className = 'toc-h' + heading.level;
    const escapedText = escapeHtml(heading.text);
    tocHTML += `<li class="${className}"><a href="#" onclick="scrollToHeading('${heading.id}'); return false;">${escapedText}</a></li>`;
  });
  
  tocHTML += '</ul></div>';
  
  // Also add IDs to the actual headings in the content for scrolling
  return tocHTML;
}

// Scroll to heading smoothly
function scrollToHeading(id) {
  // Find the heading element in the modal content
  const content = document.getElementById('noteModalContent');
  const headings = content.querySelectorAll('h1, h2, h3, h4');
  
  for (const h of headings) {
    if (h.textContent.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') === id) {
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    }
  }
}

// Add reading progress bar
function addReadingProgress() {
  // Remove existing progress bar
  const existingBar = document.querySelector('.reading-progress');
  if (existingBar) existingBar.remove();
  
  // Create progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'reading-progress';
  document.body.appendChild(progressBar);
  
  // Update progress on scroll
  const modalContent = document.getElementById('noteModalContent');
  if (!modalContent) return;
  
  modalContent.onscroll = function() {
    const scrollTop = modalContent.scrollTop;
    const scrollHeight = modalContent.scrollHeight - modalContent.clientHeight;
    const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    progressBar.style.width = progress + '%';
  };
}

// Utilities
function formatNoteContent(content) {
  if (!content) return '';
  
  // Configure marked for safe rendering
  if (typeof marked !== 'undefined') {
    // Parse markdown to HTML
    const html = marked.parse(content, {
      breaks: true,
      gfm: true  // GitHub Flavored Markdown (tables, strikethrough, etc.)
    });
    
    // Add IDs to headings for TOC navigation
    return html.replace(/<h([1-4])>(.*?)<\/h[1-4]>/g, (match, level, text) => {
      const id = text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      return `<h${level} id="${id}">${text}</h${level}>`;
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

// Standup Tracker Functions
async function loadStandup() {
  try {
    const response = await fetch(DATA_BASE + 'standup.enc.json');
    if (!response.ok) throw new Error('Failed to load standup data');
    const encrypted = await response.json();
    const data = await decryptData(encrypted, decryptedPassword);
    
    renderStandupBoard(data);
  } catch (error) {
    console.error('Standup load error:', error);
    document.getElementById('standupBoard').innerHTML = 
      '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No standup data available</p>';
  }
}

function renderStandupBoard(data) {
  const container = document.getElementById('standupBoard');
  
  if (!data.team_members || Object.keys(data.team_members).length === 0) {
    container.innerHTML = '<p style="color: var(--text-tertiary); padding: 20px; text-align: center;">No team members tracked yet</p>';
    return;
  }
  
  // Update last updated
  if (data.last_updated) {
    const date = new Date(data.last_updated);
    document.getElementById('standupLastUpdated').textContent = 
      `Updated: ${date.toLocaleDateString('en-GB')}`;
  }
  
  let html = '';
  
  // Sort team members alphabetically by name
  const sortedMembers = Object.entries(data.team_members).sort((a, b) => 
    a[0].localeCompare(b[0])
  );
  
  for (const [name, member] of sortedMembers) {
    html += `
      <div class="kanban-person">
        <h3>${escapeHtml(name)}</h3>
        ${member.tasks && member.tasks.length > 0 ? 
          member.tasks.map(task => {
            const status = task.status || 'in_progress';
            const statusConfig = {
              'in_progress': { 
                label: 'IN PROGRESS', 
                class: 'status-in-progress',
                icon: '⟳'
              },
              'completed': { 
                label: 'COMPLETED', 
                class: 'status-completed',
                icon: '✓'
              },
              'potentially_completed': { 
                label: 'POTENTIALLY DONE', 
                class: 'status-potentially',
                icon: '?'
              }
            };
            const config = statusConfig[status] || statusConfig['in_progress'];
            
            return `
              <div class="kanban-task ${config.class}">
                <div class="task-header">
                  <span class="task-status-badge ${config.class}">
                    ${config.icon} ${config.label}
                  </span>
                </div>
                <div class="task-description">${escapeHtml(task.description)}</div>
                ${task.added_on ? 
                  `<div class="task-date">📅 ${task.added_on}</div>` : ''}
                ${task.completed_on && status === 'completed' ? 
                  `<div class="task-date">✅ ${task.completed_on}</div>` : ''}
              </div>
            `;
          }).join('') : 
          '<p style="color: var(--text-tertiary); font-size: 13px;">No active tasks</p>'
        }
      </div>
    `;
  }
  
  container.innerHTML = html;
}
