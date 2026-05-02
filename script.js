// Configuration
const PASSWORD_HASH = "21930c0854d25f9222d95fd4237f475d3e403e2161194a04b087a14302ce05ee"; // SHA-256 of "tinus2026"
// Use relative path so it works in both local and GitHub Pages environments
const DATA_BASE = "data/";
const DATA_EXT = ".enc.json"; // Encrypted files

// State
let isDarkMode = true;
let knowledgeBase = [];
let currentPassword = null; // Store password for decryption

// Initialize AOS animations
AOS.init({ duration: 600, once: true });

// Password Check
async function checkPassword() {
    const input = document.getElementById("passwordInput").value;
    const hash = await sha256(input);
    
    if (hash === PASSWORD_HASH) {
        currentPassword = input; // Store for decryption
        document.getElementById("loginModal").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        loadAllData();
    } else {
        document.getElementById("loginError").classList.remove("hidden");
        setTimeout(() => document.getElementById("loginError").classList.add("hidden"), 3000);
    }
}

// SHA-256 Hashing
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Decrypt data using Web Crypto API
async function decryptData(encryptedJson, password) {
    try {
        // Parse the JSON structure from Node.js
        const encrypted = JSON.parse(encryptedJson);
        
        // Convert base64 to ArrayBuffer
        const salt = base64ToArrayBuffer(encrypted.salt);
        const iv = base64ToArrayBuffer(encrypted.iv);
        const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
        
        // Derive key using PBKDF2 (same as Node.js)
        const key = await deriveKey(password, salt);
        
        // Decrypt using AES-CBC
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-CBC", iv: iv },
            key,
            ciphertext
        );
        
        // Convert decrypted ArrayBuffer to string
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error("Decryption error:", error);
        return null;
    }
}

// Derive key using PBKDF2 (must match Node.js)
async function deriveKey(password, salt) {
    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    
    // Derive the actual key
    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-CBC", length: 256 },
        false,
        ["decrypt"]
    );
}

// Helper: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Load All Data
async function loadAllData() {
    try {
        // Fetch encrypted files
        const [scheduleEnc, weatherEnc, knowledgeEnc, insightsEnc] = await Promise.all([
            fetch(DATA_BASE + "schedule" + DATA_EXT).then(r => r.text()),
            fetch(DATA_BASE + "weather" + DATA_EXT).then(r => r.text()),
            fetch(DATA_BASE + "knowledge" + DATA_EXT).then(r => r.text()),
            fetch(DATA_BASE + "insights" + DATA_EXT).then(r => r.text())
        ]);
        
        // Decrypt and parse
        const scheduleText = await decryptData(scheduleEnc, currentPassword);
        const weatherText = await decryptData(weatherEnc, currentPassword);
        const knowledgeText = await decryptData(knowledgeEnc, currentPassword);
        const insightsText = await decryptData(insightsEnc, currentPassword);
        
        if (!scheduleText || !weatherText || !knowledgeText || !insightsText) {
            throw new Error("Decryption failed - wrong password or corrupted data");
        }
        
        const schedule = JSON.parse(scheduleText);
        const weather = JSON.parse(weatherText);
        const knowledge = JSON.parse(knowledgeText);
        const insights = JSON.parse(insightsText);
        
        renderInsights(insights);
        renderSchedule(schedule);
        renderWeather(weather);
        renderKnowledgeBase(knowledge);
        updateTimestamps(insights.last_generated);
        
        // Store knowledge base for search
        knowledgeBase = knowledge;
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Error loading data. Please check console for details.");
    }
}

// Render AI Insights
function renderInsights(insights) {
    const container = document.getElementById("insightsContent");
    container.innerHTML = `
        <div class="bg-gray-700 p-4 rounded-lg" data-aos="fade-up">
            <h3 class="font-bold text-blue-400 mb-2">Weekly Summary</h3>
            <p class="text-gray-300">${insights.weekly_summary}</p>
        </div>
        <div class="bg-gray-700 p-4 rounded-lg" data-aos="fade-up" data-aos-delay="100">
            <h3 class="font-bold text-green-400 mb-2">Schedule Tip</h3>
            <p class="text-gray-300">${insights.schedule_insights}</p>
        </div>
        <div class="bg-gray-700 p-4 rounded-lg" data-aos="fade-up" data-aos-delay="200">
            <h3 class="font-bold text-yellow-400 mb-2">Weather Impact</h3>
            <p class="text-gray-300">${insights.weather_impact}</p>
        </div>
        <div class="bg-gray-700 p-4 rounded-lg" data-aos="fade-up" data-aos-delay="300">
            <h3 class="font-bold text-purple-400 mb-2">Knowledge Highlight</h3>
            <p class="text-gray-300">${insights.knowledge_highlight}</p>
        </div>
    `;
}

// Render Weekly Schedule
function renderSchedule(schedule) {
    const container = document.getElementById("scheduleContent");
    container.innerHTML = schedule.map(day => `
        <div class="bg-gray-700 p-4 rounded-lg" data-aos="fade-right">
            <h3 class="font-bold text-lg mb-3 text-blue-400">${day.day}</h3>
            <div class="space-y-3">
                ${day.events.map(event => `
                    <div class="event-card bg-gray-600 p-3 rounded-lg">
                        <div class="flex justify-between items-center">
                            <span class="font-semibold">${event.title}</span>
                            <span class="text-sm text-gray-400">${event.time}</span>
                        </div>
                        <p class="text-sm text-gray-400 mt-1">Duration: ${event.duration}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `).join("");
}

// Render Weather
function renderWeather(weather) {
    const container = document.getElementById("weatherContent");
    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="weather-icon text-6xl mb-2">${weather.current.icon}</div>
            <p class="text-3xl font-bold">${weather.current.temp}°C</p>
            <p class="text-gray-400">${weather.current.condition}</p>
            <p class="text-sm text-gray-400 mt-2">Delmas, ZA</p>
        </div>
        <div class="grid grid-cols-5 gap-2 text-center">
            ${weather.forecast.map(day => `
                <div class="bg-gray-700 p-2 rounded-lg">
                    <p class="font-semibold">${day.day}</p>
                    <p class="text-xl my-1">${day.icon}</p>
                    <p class="text-sm">${day.high}°/${day.low}°</p>
                </div>
            `).join("")}
        </div>
        <div class="mt-4 text-sm text-gray-400">
            <p>Humidity: ${weather.current.humidity}%</p>
            <p>Wind: ${weather.current.wind} km/h</p>
        </div>
    `;
}

// Render Knowledge Base
function renderKnowledgeBase(knowledge) {
    const container = document.getElementById("kbContent");
    container.innerHTML = knowledge.map(note => `
        <div class="kb-card bg-gray-700 p-4 rounded-lg cursor-pointer" data-aos="fade-up">
            <h3 class="font-bold text-blue-400 mb-2">${note.title}</h3>
            <p class="text-gray-300 text-sm mb-3">${note.snippet}</p>
            <div class="flex justify-between items-center text-xs text-gray-400">
                <div class="flex gap-1">
                    ${note.tags.map(tag => `<span class="bg-gray-600 px-2 py-1 rounded">${tag}</span>`).join("")}
                </div>
                <span>${note.last_modified}</span>
            </div>
        </div>
    `).join("");
}

// Knowledge Base Search
document.getElementById("kbSearch").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = knowledgeBase.filter(note => 
        note.title.toLowerCase().includes(query) || 
        note.snippet.toLowerCase().includes(query) || 
        note.tags.some(tag => tag.toLowerCase().includes(query))
    );
    renderKnowledgeBase(filtered);
});

// Dark Mode Toggle
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle("dark");
    document.getElementById("themeIcon").textContent = isDarkMode ? "🌙" : "☀️";
    localStorage.setItem("darkMode", isDarkMode);
}

// Load Dark Mode Preference
if (localStorage.getItem("darkMode") === "false") {
    isDarkMode = false;
    document.documentElement.classList.remove("dark");
    document.getElementById("themeIcon").textContent = "☀️";
}

// Update Timestamps
function updateTimestamps(lastGenerated) {
    const date = new Date(lastGenerated);
    const formatted = date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
    document.getElementById("lastUpdated").textContent = `Updated: ${formatted}`;
    document.getElementById("footerUpdated").textContent = formatted;
}

// Allow Enter key to submit password
document.getElementById("passwordInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkPassword();
});
