     1|// Configuration
     2|const PASSWORD_HASH="21930c0854d25f9222d95fd4237f475d3e403e2161194a04b087a14302ce05ee"; // SHA-256 of "tinus2026"
     3|// Use relative path so it works in both local and GitHub Pages environments
     4|const DATA_BASE = "data/";
     5|const DATA_EXT = ".enc.json"; // Encrypted files
     6|
     7|// State
     8|let isDarkMode = true;
     9|let knowledgeBase = [];
    10|let currentPassword = null; // Store password for decryption
    11|let insightsCollapsed = false;
    12|
    13|// Initialize AOS animations
    14|AOS.init({ duration: 600, once: true });
    15|
    16|// Password Check
    17|async function checkPassword() {
    18|    const input = document.getElementById("passwordInput").value;
    19|    const hash = await sha256(input);
    20|    
    21|    if (hash === PASSWORD_HASH) {
    22|        currentPassword = input; // Store for decryption
    23|        document.getElementById("loginModal").classList.add("hidden");
    24|        document.getElementById("dashboard").classList.remove("hidden");
    25|        loadAllData();
    26|    } else {
    27|        document.getElementById("loginError").classList.remove("hidden");
    28|        setTimeout(() => document.getElementById("loginError").classList.add("hidden"), 3000);
    29|    }
    30|}
    31|
    32|// SHA-256 Hashing
    33|async function sha256(message) {
    34|    const msgBuffer = new TextEncoder().encode(message);
    35|    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    36|    const hashArray = Array.from(new Uint8Array(hashBuffer));
    37|    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    38|}
    39|
    40|// Decrypt data using Web Crypto API
    41|async function decryptData(encryptedJson, password) {
    42|    try {
    43|        // Parse the JSON structure from Node.js
    44|        const encrypted = JSON.parse(encryptedJson);
    45|        
    46|        // Convert base64 to ArrayBuffer
    47|        const salt = base64ToArrayBuffer(encrypted.salt);
    48|        const iv = base64ToArrayBuffer(encrypted.iv);
    49|        const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
    50|        
    51|        // Derive key using PBKDF2 (same as Node.js)
    52|        const key = await deriveKey(password, salt);
    53|        
    54|        // Decrypt using AES-CBC
    55|        const decrypted = await crypto.subtle.decrypt(
    56|            { name: "AES-CBC", iv: iv },
    57|            key,
    58|            ciphertext
    59|        );
    60|        
    61|        // Convert decrypted ArrayBuffer to string
    62|        return new TextDecoder().decode(decrypted);
    63|    } catch (error) {
    64|        console.error("Decryption error:", error);
    65|        return null;
    66|    }
    67|}
    68|
    69|// Derive key using PBKDF2 (must match Node.js)
    70|async function deriveKey(password, salt) {
    71|    // Import password as key material
    72|    const passwordKey = await crypto.subtle.importKey(
    73|        "raw",
    74|        new TextEncoder().encode(password),
    75|        "PBKDF2",
    76|        false,
    77|        ["deriveKey"]
    78|    );
    79|    
    80|    // Derive the actual key
    81|    return await crypto.subtle.deriveKey(
    82|        {
    83|            name: "PBKDF2",
    84|            salt: salt,
    85|            iterations: 100000,
    86|            hash: "SHA-256"
    87|        },
    88|        passwordKey,
    89|        { name: "AES-CBC", length: 256 },
    90|        false,
    91|        ["decrypt"]
    92|    );
    93|}
    94|
    95|// Helper: Base64 to ArrayBuffer
    96|function base64ToArrayBuffer(base64) {
    97|    const binaryString = atob(base64);
    98|    const bytes = new Uint8Array(binaryString.length);
    99|    for (let i = 0; i < binaryString.length; i++) {
   100|        bytes[i] = binaryString.charCodeAt(i);
   101|    }
   102|    return bytes.buffer;
   103|}
   104|
   105|// Load All Data
   106|async function loadAllData() {
   107|    try {
   108|        // Fetch encrypted files
   109|        const [scheduleEnc, weatherEnc, knowledgeEnc, insightsEnc] = await Promise.all([
   110|            fetch(DATA_BASE + "schedule" + DATA_EXT).then(r => r.text()),
   111|            fetch(DATA_BASE + "weather" + DATA_EXT).then(r => r.text()),
   112|            fetch(DATA_BASE + "knowledge" + DATA_EXT).then(r => r.text()),
   113|            fetch(DATA_BASE + "insights" + DATA_EXT).then(r => r.text())
   114|        ]);
   115|        
   116|        // Decrypt and parse
   117|        const scheduleText = await decryptData(scheduleEnc, currentPassword);
   118|        const weatherText = await decryptData(weatherEnc, currentPassword);
   119|        const knowledgeText = await decryptData(knowledgeEnc, currentPassword);
   120|        const insightsText = await decryptData(insightsEnc, currentPassword);
   121|        
   122|        if (!scheduleText || !weatherText || !knowledgeText || !insightsText) {
   123|            throw new Error("Decryption failed - wrong password or corrupted data");
   124|        }
   125|        
   126|        const schedule = JSON.parse(scheduleText);
   127|        const weather = JSON.parse(weatherText);
   128|        const knowledge = JSON.parse(knowledgeText);
   129|        const insights = JSON.parse(insightsText);
   130|        
   131|        renderInsights(insights);
   132|        renderSchedule(schedule);
   133|        renderWeather(weather);
   134|        renderKnowledgeBase(knowledge);
   135|        updateTimestamps(insights.last_generated);
   136|        
   137|        // Store knowledge base for search
   138|        knowledgeBase = knowledge;
   139|    } catch (error) {
   140|        console.error("Error loading data:", error);
   141|        alert("Error loading data. Please check console for details.");
   142|    }
   143|}
   144|
   145|// Render AI Insights (collapsible)
   146|function renderInsights(insights) {
   147|    const container = document.getElementById("insightsContent");
   148|    container.innerHTML = `
   149|        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg transition-colors duration-300" data-aos="fade-up">
   150|            <h3 class="font-bold text-blue-600 dark:text-blue-400 mb-2">Weekly Summary</h3>
   151|            <p class="text-gray-700 dark:text-gray-300">${insights.weekly_summary}</p>
   152|        </div>
   153|        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg transition-colors duration-300" data-aos="fade-up" data-aos-delay="100">
   154|            <h3 class="font-bold text-green-600 dark:text-green-400 mb-2">Schedule Tip</h3>
   155|            <p class="text-gray-700 dark:text-gray-300">${insights.schedule_insights}</p>
   156|        </div>
   157|        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg transition-colors duration-300" data-aos="fade-up" data-aos-delay="200">
   158|            <h3 class="font-bold text-yellow-600 dark:text-yellow-400 mb-2">Weather Impact</h3>
   159|            <p class="text-gray-700 dark:text-gray-300">${insights.weather_impact}</p>
   160|        </div>
   161|        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg transition-colors duration-300" data-aos="fade-up" data-aos-delay="300">
   162|            <h3 class="font-bold text-purple-600 dark:text-purple-400 mb-2">Knowledge Highlight</h3>
   163|            <p class="text-gray-700 dark:text-gray-300">${insights.knowledge_highlight}</p>
   164|        </div>
   165|    `;
   166|}
   167|
   168|// Toggle AI Insights Collapse
   169|function toggleInsights() {
   170|    const content = document.getElementById("insightsContent");
   171|    const toggleIcon = document.getElementById("insightsToggle");
   172|    const toggleText = document.getElementById("insightsToggleText");
   173|    
   174|    insightsCollapsed = !insightsCollapsed;
   175|    
   176|    if (insightsCollapsed) {
   177|        content.style.display = "none";
   178|        toggleIcon.style.transform = "rotate(-90deg)";
   179|        toggleText.textContent = "Expand";
   180|    } else {
   181|        content.style.display = "grid";
   182|        toggleIcon.style.transform = "rotate(0deg)";
   183|        toggleText.textContent = "Collapse";
   184|    }
   185|}
   186|
   187|// Render Weekly Schedule
   188|function renderSchedule(schedule) {
   189|    const container = document.getElementById("scheduleContent");
   190|    container.innerHTML = schedule.map(day => `
   191|        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg transition-colors duration-300" data-aos="fade-right">
   192|            <h3 class="font-bold text-lg mb-3 text-blue-600 dark:text-blue-400">${day.day}</h3>
   193|            <div class="space-y-3">
   194|                ${day.events.map(event => `
   195|                    <div class="event-card bg-white dark:bg-gray-600 p-3 rounded-lg transition-colors duration-300">
   196|                        <div class="flex justify-between items-center">
   197|                            <span class="font-semibold text-gray-900 dark:text-white">${event.title}</span>
   198|                            <span class="text-sm text-gray-600 dark:text-gray-400">${event.time}</span>
   199|                        </div>
   200|                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Duration: ${event.duration}</p>
   201|                    </div>
   202|                `).join("")}
   203|            </div>
   204|        </div>
   205|    `).join("");
   206|}
   207|
   208|// Render Weather
   209|function renderWeather(weather) {
   210|    const container = document.getElementById("weatherContent");
   211|    container.innerHTML = `
   212|        <div class="text-center mb-4">
   213|            <div class="weather-icon text-6xl mb-2">${weather.current.icon}</div>
   214|            <p class="text-3xl font-bold text-gray-900 dark:text-white">${weather.current.temp}°C</p>
   215|            <p class="text-gray-600 dark:text-gray-400">${weather.current.condition}</p>
   216|            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Delmas, ZA</p>
   217|        </div>
   218|        <div class="grid grid-cols-5 gap-2 text-center">
   219|            ${weather.forecast.map(day => `
   220|                <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-colors duration-300">
   221|                    <p class="font-semibold text-gray-900 dark:text-white">${day.day}</p>
   222|                    <p class="text-xl my-1">${day.icon}</p>
   223|                    <p class="text-sm text-gray-700 dark:text-gray-300">${day.high}°/${day.low}°</p>
   224|                </div>
   225|            `).join("")}
   226|        </div>
   227|        <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
   228|            <p>Humidity: ${weather.current.humidity}%</p>
   229|            <p>Wind: ${weather.current.wind} km/h</p>
   230|        </div>
   231|    `;
   232|}
   233|
   234|// Render Knowledge Base with clickable cards
   235|function renderKnowledgeBase(knowledge) {
   236|    const container = document.getElementById("kbContent");
   237|    container.innerHTML = knowledge.map((note, index) => `
   238|        <div class="kb-card bg-gray-100 dark:bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition" 
   239|             data-aos="fade-up" 
   240|             onclick="openNoteModal(${index})">
   241|            <h3 class="font-bold text-blue-600 dark:text-blue-400 mb-2">${note.title}</h3>
   242|            <p class="text-gray-700 dark:text-gray-300 text-sm mb-3">${note.snippet}</p>
   243|            <div class="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
   244|                <div class="flex gap-1">
   245|                    ${note.tags.map(tag => `<span class="bg-gray-300 dark:bg-gray-600 px-2 py-1 rounded">${tag}</span>`).join("")}
   246|                </div>
   247|                <span>${note.last_modified}</span>
   248|            </div>
   249|        </div>
   250|    `).join("");
   251|}
   252|
   253|// Open Note Modal with full content
   254|function openNoteModal(noteIndex) {
   255|    const note = knowledgeBase[noteIndex];
   256|    if (!note) return;
   257|    
   258|    document.getElementById("noteTitle").textContent = note.title;
   259|    document.getElementById("noteContent").innerHTML = formatNoteContent(note.content || note.snippet);
   260|    document.getElementById("noteModified").textContent = `Last modified: ${note.last_modified}`;
   261|    
   262|    // Render tags
   263|    const tagsContainer = document.getElementById("noteTags");
   264|    tagsContainer.innerHTML = note.tags.map(tag => 
   265|        `<span class="bg-gray-300 dark:bg-gray-600 px-2 py-1 rounded">${tag}</span>`
   266|    ).join("");
   267|    
   268|    // Show modal
   269|    document.getElementById("noteModal").classList.remove("hidden");
   270|}
   271|
   272|// Close Note Modal
   273|function closeNoteModal() {
   274|    document.getElementById("noteModal").classList.add("hidden");
   275|}
   276|
   277|// Format note content (convert markdown-like syntax to HTML)
   278|function formatNoteContent(content) {
   279|    if (!content) return '<p class="text-gray-400">No content available</p>';
   280|    
   281|    // Convert markdown to HTML (basic implementation)
   282|    let html = content;
   283|    
   284|    // Headers
   285|    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-white">$1</h3>');
   286|    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-white">$1</h2>');
   287|    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-white">$1</h1>');
   288|    
   289|    // Bold and italic
   290|    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
   291|    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
   292|    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
   293|    
   294|    // Code blocks
   295|    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 p-4 rounded-lg overflow-x-auto text-white"><code>$1</code></pre>');
   296|    html = html.replace(/`(.+?)`/g, '<code class="bg-gray-900 dark:bg-gray-800 px-2 py-1 rounded text-white">$1</code>');
   297|    
   298|    // Links
   299|    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>');
   300|    
   301|    // Lists
   302|    html = html.replace(/^\s*[-*+] (.+)$/gim, '<li class="ml-4 text-gray-700 dark:text-gray-300">$1</li>');
   303|    html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc ml-4 my-2">$1</ul>');
   304|    
   305|    // Paragraphs (lines with content)
   306|    html = html.split('\n\n').map(para => {
   307|        if (para.trim().startsWith('<')) return para; // Already has HTML tags
   308|        return `<p class="mb-3 text-gray-700 dark:text-gray-300">${para}</p>`;
   309|    }).join('\n');
   310|    
   311|    return html;
   312|}
   313|
   314|// Knowledge Base Search
   315|document.getElementById("kbSearch").addEventListener("input", (e) => {
   316|    const query = e.target.value.toLowerCase();
   317|    const filtered = knowledgeBase.filter(note => 
   318|        note.title.toLowerCase().includes(query) || 
   319|        note.snippet.toLowerCase().includes(query) || 
   320|        (note.content && note.content.toLowerCase().includes(query)) ||
   321|        note.tags.some(tag => tag.toLowerCase().includes(query))
   322|    );
   323|    renderKnowledgeBase(filtered);
   324|});
   325|
   326|// Close modal on background click
   327|document.getElementById("noteModal").addEventListener("click", (e) => {
   328|    if (e.target.id === "noteModal") {
   329|        closeNoteModal();
   330|    }
   331|});
   332|
   333|// Dark Mode Toggle
   334|function toggleDarkMode() {
   335|    isDarkMode = !isDarkMode;
   336|    document.documentElement.classList.toggle("dark");
   337|    document.getElementById("themeIcon").textContent = isDarkMode ? "🌙" : "☀️";
   338|    localStorage.setItem("darkMode", isDarkMode);
   339|}
   340|
   341|// Load Dark Mode Preference
   342|if (localStorage.getItem("darkMode") === "false") {
   343|    isDarkMode = false;
   344|    document.documentElement.classList.remove("dark");
   345|    document.getElementById("themeIcon").textContent = "☀️";
   346|}
   347|
   348|// Update Timestamps
   349|function updateTimestamps(lastGenerated) {
   350|    const date = new Date(lastGenerated);
   351|    const formatted = date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
   352|    document.getElementById("lastUpdated").textContent = `Updated: ${formatted}`;
   353|    document.getElementById("footerUpdated").textContent = formatted;
   354|}
   355|
   356|// Allow Enter key to submit password
   357|document.getElementById("passwordInput").addEventListener("keypress", (e) => {
   358|    if (e.key === "Enter") checkPassword();
   359|});
   360|
   361|// Register Service Worker for PWA
   362|if ('serviceWorker' in navigator) {
   363|    window.addEventListener('load', () => {
   364|        navigator.serviceWorker.register('./service-worker.js')
   365|            .then(registration => {
   366|                console.log('ServiceWorker registration successful with scope: ', registration.scope);
   367|            })
   368|            .catch(error => {
   369|                console.log('ServiceWorker registration failed: ', error);
   370|            });
   371|    });
   372|}
   373|