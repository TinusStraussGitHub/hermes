/**
 * BME Caliper Borehole Processor - Client-Side Engine
 * 100% Client-side data processing, zero server backend
 * CWLS LAS 2.0 parser & ExcelJS template modifier
 */

(function () {
  'use strict';

  // State Management
  const state = {
    lasFiles: [], // Array of { name, size, content }
    templateChoice: 'default', // 'default' | 'custom'
    customTemplateBuffer: null,
    customTemplateName: '',
    processedWorkbookBuffer: null,
    processedHoles: [],
    activeHoleIndex: 0,
    isProcessing: false
  };

  // DOM Elements Cache
  const elements = {
    offlineBadge: document.getElementById('offline-badge'),
    offlineStatusText: document.getElementById('offline-status-text'),
    alertBanner: document.getElementById('alert-banner'),
    alertMessage: document.getElementById('alert-message'),
    btnCloseAlert: document.getElementById('btn-close-alert'),
    btnOpenDocs: document.getElementById('btn-open-docs'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnModalExportZip: document.getElementById('btn-modal-export-zip'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    btnClearLas: document.getElementById('btn-clear-las'),
    btnDownloadTemplate: document.getElementById('btn-download-template'),
    btnResetSettings: document.getElementById('btn-reset-settings'),
    btnProcessData: document.getElementById('btn-process-data'),
    btnDownloadResult: document.getElementById('btn-download-result'),
    downloadFilenameLabel: document.getElementById('download-filename-label'),
    
    // Upload Zones
    lasDropzone: document.getElementById('las-dropzone'),
    lasFileInput: document.getElementById('las-file-input'),
    lasFilesContainer: document.getElementById('las-files-container'),
    lasFileCount: document.getElementById('las-file-count'),
    lasFileChips: document.getElementById('las-file-chips'),
    
    // Template
    radioTemplateDefault: document.getElementById('radio-template-default'),
    radioTemplateCustom: document.getElementById('radio-template-custom'),
    optionDefaultTemplate: document.getElementById('option-default-template'),
    optionCustomTemplate: document.getElementById('option-custom-template'),
    customTemplateZone: document.getElementById('custom-template-zone'),
    templateDropzone: document.getElementById('template-dropzone'),
    templateFileInput: document.getElementById('template-file-input'),
    templateDropzoneLabel: document.getElementById('template-dropzone-label'),
    templateStatusName: document.getElementById('template-status-name'),
    
    // Form Inputs
    inputClient: document.getElementById('input-client'),
    inputMine: document.getElementById('input-mine'),
    inputBlockId: document.getElementById('input-block-id'),
    inputPlannedDiam: document.getElementById('input-planned-diam'),
    inputFinalStemming: document.getElementById('input-final-stemming'),
    inputDensity: document.getElementById('input-density'),
    inputRigOperator: document.getElementById('input-rig-operator'),
    inputDate: document.getElementById('input-date'),
    inputFilename: document.getElementById('input-filename'),
    
    // Progress
    progressSection: document.getElementById('progress-section'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressStatusLabel: document.getElementById('progress-status-label'),
    progressPercentage: document.getElementById('progress-percentage'),
    logTerminal: document.getElementById('log-terminal'),
    
    // Results
    resultsContainer: document.getElementById('results-container'),
    metricHolesCount: document.getElementById('metric-holes-count'),
    metricTotalDepth: document.getElementById('metric-total-depth'),
    metricAvgDiam: document.getElementById('metric-avg-diam'),
    metricAvgOverbreak: document.getElementById('metric-avg-overbreak'),
    metricOverbreakPct: document.getElementById('metric-overbreak-pct'),
    metricPlannedDiamSub: document.getElementById('metric-planned-diam-sub'),
    
    // Visualizer
    holeSelector: document.getElementById('hole-selector'),
    boreholeSvg: document.getElementById('borehole-svg'),
    activeHoleName: document.getElementById('active-hole-name'),
    statTopDepth: document.getElementById('stat-top-depth'),
    statBottomDepth: document.getElementById('stat-bottom-depth'),
    statCaliperedLen: document.getElementById('stat-calipered-len'),
    statStemmingVal: document.getElementById('stat-stemming-val'),
    statMinDiam: document.getElementById('stat-min-diam'),
    statMaxDiam: document.getElementById('stat-max-diam'),
    statMeanDiam: document.getElementById('stat-mean-diam'),
    statExpDepth: document.getElementById('stat-exp-depth'),
    statExpMass: document.getElementById('stat-exp-mass'),
    statTheoMass: document.getElementById('stat-theo-mass'),
    holeFlags: document.getElementById('hole-flags'),
    
    // Table Preview
    summaryTableBody: document.getElementById('summary-table-body'),
    summaryTableFooter: document.getElementById('summary-table-footer'),
    
    // Modal
    docsModal: document.getElementById('docs-modal'),
    btnCloseDocs: document.getElementById('btn-close-docs'),
    btnModalCloseAction: document.getElementById('btn-modal-close-action'),
    docsMarkdownContent: document.getElementById('docs-markdown-content')
  };

  // ==========================================
  // Service Worker & Offline Capability
  // ==========================================
  function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => {
          console.log('[App] Service Worker registered:', reg.scope);
          reg.update();
          updateOfflineStatus(true);
        })
        .catch((err) => {
          console.warn('[App] Service Worker registration failed:', err);
          updateOfflineStatus(false);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      window.addEventListener('online', () => updateOfflineStatus(true));
      window.addEventListener('offline', () => updateOfflineStatus(true, true));
    } else {
      updateOfflineStatus(false);
    }
  }

  function updateOfflineStatus(isSupported, isOffline = false) {
    if (elements.offlineBadge) {
      if (isOffline) {
        elements.offlineBadge.className = 'badge offline-badge ready';
        elements.offlineStatusText.textContent = 'Offline Mode Active';
      } else if (isSupported) {
        elements.offlineBadge.className = 'badge offline-badge ready';
        elements.offlineStatusText.textContent = 'Offline Cached';
      } else {
        elements.offlineBadge.className = 'badge offline-badge';
        elements.offlineStatusText.textContent = 'Web Storage Ready';
      }
    }
  }

  // ==========================================
  // Notification Banner
  // ==========================================
  function showAlert(message, type = 'info') {
    if (!elements.alertBanner) return;
    elements.alertMessage.textContent = message;
    elements.alertBanner.className = `alert-banner ${type}`;
    elements.alertBanner.classList.remove('hidden');
    elements.alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    if (elements.alertBanner) {
      elements.alertBanner.classList.add('hidden');
    }
  }

  // ==========================================
  // Logging Helper
  // ==========================================
  function logMessage(text, type = 'info') {
    if (!elements.logTerminal) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const line = document.createElement('div');
    line.className = 'log-line';
    
    let typeClass = '';
    if (type === 'success') typeClass = 'log-success';
    if (type === 'warn' || type === 'error') typeClass = 'log-warn';
    
    line.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="${typeClass}">${escapeHtml(text)}</span>`;
    elements.logTerminal.appendChild(line);
    elements.logTerminal.scrollTop = elements.logTerminal.scrollHeight;
  }

  function clearLogs() {
    if (elements.logTerminal) elements.logTerminal.innerHTML = '';
  }

  function updateProgress(pct, status) {
    if (elements.progressBarFill) elements.progressBarFill.style.width = pct + '%';
    if (elements.progressPercentage) elements.progressPercentage.textContent = pct + '%';
    if (elements.progressStatusLabel) elements.progressStatusLabel.textContent = status;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================
  // LAS Files Upload & Management
  // ==========================================
  function handleLasFiles(files) {
    const validFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.las') || f.name.toLowerCase().endsWith('.txt'));
    if (validFiles.length === 0) {
      showAlert('No valid .LAS borehole files found in the selection.', 'error');
      return;
    }

    let loadedCount = 0;
    for (const file of validFiles) {
      // Avoid exact duplicates
      if (state.lasFiles.some(existing => existing.name === file.name)) {
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        state.lasFiles.push({
          name: file.name,
          size: file.size,
          content: e.target.result
        });
        loadedCount++;
        renderLasChips();
      };
      reader.readAsText(file);
    }

    hideAlert();
  }

  function renderLasChips() {
    if (!elements.lasFilesContainer || !elements.lasFileChips) return;
    
    if (state.lasFiles.length === 0) {
      elements.lasFilesContainer.classList.add('hidden');
      return;
    }

    elements.lasFilesContainer.classList.remove('hidden');
    elements.lasFileCount.textContent = `${state.lasFiles.length} hole${state.lasFiles.length === 1 ? '' : 's'} ready for processing`;
    elements.lasFileChips.innerHTML = '';

    state.lasFiles.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        </svg>
        <span class="chip-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <button type="button" class="btn-remove-chip" data-index="${index}" title="Remove file">&times;</button>
      `;
      elements.lasFileChips.appendChild(chip);
    });

    // Attach remove handlers
    elements.lasFileChips.querySelectorAll('.btn-remove-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        state.lasFiles.splice(idx, 1);
        renderLasChips();
      });
    });
  }

  // Load sample LAS files
  async function loadSampleLasFiles() {
    try {
      const sampleNames = ['BH_001.las', 'BH_002.las', 'BH_003.las'];
      state.lasFiles = []; // replace existing

      // Try network fetch first
      let loadedViaFetch = false;
      try {
        for (const name of sampleNames) {
          const res = await fetch(`./sample_data/${name}`);
          if (!res.ok) throw new Error(`Fetch status ${res.status}`);
          const text = await res.text();
          state.lasFiles.push({
            name: name,
            size: text.length,
            content: text
          });
        }
        loadedViaFetch = true;
      } catch (fetchErr) {
        console.warn('Network fetch for samples failed (likely running locally via file://), checking embedded fallback:', fetchErr);
      }

      // If fetch failed (e.g. running locally via file://), use pre-loaded memory fallback
      if (!loadedViaFetch && window.SAMPLE_LAS_FILES && window.SAMPLE_LAS_FILES.length > 0) {
        window.SAMPLE_LAS_FILES.forEach(sample => {
          state.lasFiles.push({
            name: sample.name,
            size: sample.content.length,
            content: sample.content
          });
        });
      }

      if (state.lasFiles.length === 0) {
        throw new Error('No sample files available.');
      }

      renderLasChips();
      showAlert('Successfully loaded 3 sample borehole .LAS files (BH_001, BH_002, BH_003).', 'success');
    } catch (err) {
      console.error('Failed to load sample data:', err);
      showAlert('Could not load sample files. Please upload your own .LAS files.', 'error');
    }
  }

  // ==========================================
  // Template Choice Management
  // ==========================================
  function setTemplateChoice(choice) {
    state.templateChoice = choice;
    if (choice === 'default') {
      elements.optionDefaultTemplate.classList.add('active');
      elements.optionCustomTemplate.classList.remove('active');
      elements.radioTemplateDefault.checked = true;
      elements.customTemplateZone.classList.add('hidden');
      elements.templateStatusName.textContent = 'Using: Standard BME Caliper Template';
    } else {
      elements.optionDefaultTemplate.classList.remove('active');
      elements.optionCustomTemplate.classList.add('active');
      elements.radioTemplateCustom.checked = true;
      elements.customTemplateZone.classList.remove('hidden');
      if (state.customTemplateName) {
        elements.templateStatusName.textContent = `Using: ${state.customTemplateName}`;
      } else {
        elements.templateStatusName.textContent = 'Custom template selected: Please upload .xlsx file below';
      }
    }
  }

  function handleCustomTemplateFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.xlsx')) {
      showAlert('Please upload a valid Excel workbook file (.xlsx).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      state.customTemplateBuffer = e.target.result;
      state.customTemplateName = file.name;
      elements.templateDropzoneLabel.innerHTML = `Loaded: <strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
      elements.templateStatusName.textContent = `Using: ${file.name}`;
      showAlert(`Custom template "${file.name}" ready!`, 'success');
    };
    reader.readAsArrayBuffer(file);
  }

  // ==========================================
  // LAS Parsing & Borehole Math Engine
  // ==========================================
  function parseLasContent(fileName, text, finalStemming, plannedDiam, density) {
    // 1. Split lines
    const rawLines = text.split(/\r?\n/);
    
    // Find where ASCII data begins.
    // In CWLS LAS 2.0, data begins after ~A or ~Ascii line.
    // If not found, per Python code, skip first 20 header lines: las_content = las_content[20:]
    let dataStartIndex = -1;
    for (let i = 0; i < rawLines.length; i++) {
      const trimmed = rawLines[i].trim();
      if (trimmed.toUpperCase().startsWith('~A')) {
        dataStartIndex = i + 1;
        break;
      }
    }
    if (dataStartIndex === -1) {
      dataStartIndex = Math.min(20, rawLines.length);
    }

    const dataLines = rawLines.slice(dataStartIndex);
    const rawData = [];

    for (const line of dataLines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] !== '') {
        const depth = parseFloat(parts[0]);
        const diam = parseFloat(parts[1]);
        if (!isNaN(depth) && !isNaN(diam)) {
          rawData.push([depth, diam]);
        }
      }
    }

    // Criteria 1: Delete rows where Diameter < 0, along with the next 50 rows
    // Standard used in BME to remove inaccurate/null readings at bottom of hole
    const filtered1 = [];
    for (let i = 0; i < rawData.length; i++) {
      const diam = rawData[i][1];
      if (diam < 0) {
        // Skip current row and next 50 rows
        i += 50;
        continue;
      }
      filtered1.push(rawData[i]);
    }

    // Criteria 2: Delete rows where Depth < finalStemming
    const filtered2 = filtered1.filter(row => row[0] >= finalStemming);

    // Sorting: Sort ascending by Depth (column A)
    filtered2.sort((a, b) => a[0] - b[0]);

    // Calculate hole statistics
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    let minDiam = 0, maxDiam = 0, sumDiam = 0, maxDepth = 0, topDepth = 0;

    if (filtered2.length > 0) {
      topDepth = filtered2[0][0];
      maxDepth = filtered2[filtered2.length - 1][0];
      minDiam = filtered2[0][1];
      maxDiam = filtered2[0][1];

      for (const row of filtered2) {
        const d = row[1];
        if (d < minDiam) minDiam = d;
        if (d > maxDiam) maxDiam = d;
        sumDiam += d;
      }
    }

    const count = filtered2.length;
    const meanDiam = count > 0 ? (sumDiam / count) : 0;
    const caliperedLen = count > 0 ? Math.max(0, maxDepth - topDepth) : 0;
    const expDepth = Math.max(0, maxDepth - finalStemming);
    
    // Explosive mass calculations:
    // Volume = PI * (radius in m)^2 * length
    // Mass = Volume * (density in g/cc * 1000 kg/m^3)
    const meanRadM = (meanDiam / 2) / 1000;
    const plannedRadM = (plannedDiam / 2) / 1000;
    const actualVolM3 = Math.PI * Math.pow(meanRadM, 2) * expDepth;
    const theoVolM3 = Math.PI * Math.pow(plannedRadM, 2) * expDepth;
    const expMassKg = actualVolM3 * (density * 1000);
    const theoMassKg = theoVolM3 * (density * 1000);
    const overbreakPct = plannedDiam > 0 ? ((meanDiam - plannedDiam) / plannedDiam) * 100 : 0;

    return {
      fileName: fileName,
      baseName: baseName,
      data: filtered2,
      rawCount: rawData.length,
      validCount: filtered2.length,
      topDepth: topDepth,
      maxDepth: maxDepth,
      caliperedLen: caliperedLen,
      minDiam: minDiam,
      maxDiam: maxDiam,
      meanDiam: meanDiam,
      plannedDiam: plannedDiam,
      finalStemming: finalStemming,
      expDepth: expDepth,
      expMassKg: expMassKg,
      theoMassKg: theoMassKg,
      overbreakPct: overbreakPct
    };
  }

  // Helper to escape XML special characters
  function xmlEscape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ==========================================
  // Excel Processing Engine (JSZip OpenXML Engine)
  // Preserves 100% of charts, drawings, relationships and formatting
  // ==========================================
  async function processWorkbook(siteInfo, parsedHoles) {
    logMessage('Loading Excel workbook template...', 'info');
    updateProgress(15, 'Loading Excel template...');

    // 1. Obtain template buffer
    let templateBuffer;
    if (state.templateChoice === 'custom' && state.customTemplateBuffer) {
      templateBuffer = state.customTemplateBuffer;
      logMessage(`Using uploaded template: ${state.customTemplateName}`, 'info');
    } else {
      let loadedViaFetch = false;
      try {
        const resp = await fetch('./templates/BME_Caliper_Template.xlsx');
        if (resp.ok) {
          templateBuffer = await resp.arrayBuffer();
          loadedViaFetch = true;
          logMessage('Using standard built-in BME Caliper template (from templates folder)', 'info');
        }
      } catch (fetchErr) {
        console.warn('Network fetch for template failed (likely local file:// protocol), using memory fallback:', fetchErr);
      }

      if (!loadedViaFetch) {
        if (window.DEFAULT_BME_TEMPLATE_B64) {
          logMessage('Using built-in offline BME Caliper template (local memory)', 'info');
          const binaryStr = atob(window.DEFAULT_BME_TEMPLATE_B64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          templateBuffer = bytes.buffer;
        } else {
          throw new Error('Could not load BME template file from disk or memory.');
        }
      }
    }

    updateProgress(30, 'Opening template archive and preserving charts...');
    const zip = await JSZip.loadAsync(templateBuffer);

    // Map sheet names to their XML paths in zip via workbook.xml and workbook.xml.rels
    const sheetPathMap = {};
    try {
      const wbXmlStr = await zip.file('xl/workbook.xml').async('text');
      const wbRelsStr = await zip.file('xl/_rels/workbook.xml.rels').async('text');
      
      const relMap = {};
      const relMatches = wbRelsStr.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g);
      for (const m of relMatches) {
        relMap[m[1]] = m[2];
      }

      const sheetMatches = wbXmlStr.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g);
      for (const m of sheetMatches) {
        const name = m[1];
        const rId = m[2];
        const target = relMap[rId];
        if (target) {
          sheetPathMap[name] = target.startsWith('xl/') ? target : ('xl/' + target);
        }
      }
    } catch (e) {
      console.warn('Could not parse workbook sheet paths dynamically, using defaults:', e);
    }

    // Default fallbacks if dynamic map had an issue
    const infoPath = sheetPathMap['Information'] || 'xl/worksheets/sheet3.xml';
    const tablePath = sheetPathMap['Table'] || 'xl/worksheets/sheet2.xml';

    // 2. Update Information Sheet
    logMessage('Populating Information sheet with site settings...', 'info');
    updateProgress(40, 'Writing site parameters into Information sheet...');
    const infoFile = zip.file(infoPath);
    if (infoFile) {
      const origSheet3 = await infoFile.async('text');
      const sDataStart = origSheet3.indexOf('<sheetData>');
      const sDataEnd = origSheet3.indexOf('</sheetData>') + 12;
      if (sDataStart !== -1 && sDataEnd !== -1) {
        const header3 = origSheet3.substring(0, sDataStart);
        const footer3 = origSheet3.substring(sDataEnd);

        const newSheetData3 = '<sheetData>' +
          '<row r="1" spans="1:3" ht="21" x14ac:dyDescent="0.4"><c r="A1" s="65" t="s"><v>22</v></c><c r="B1" s="66"/><c r="C1" s="9" t="inlineStr"><is><t>' + xmlEscape(siteInfo.client) + '</t></is></c></row>' +
          '<row r="2" spans="1:3" ht="21" x14ac:dyDescent="0.4"><c r="A2" s="67" t="s"><v>23</v></c><c r="B2" s="68"/><c r="C2" s="10" t="inlineStr"><is><t>' + xmlEscape(siteInfo.mine) + '</t></is></c></row>' +
          '<row r="3" spans="1:3" ht="21" x14ac:dyDescent="0.4"><c r="A3" s="67" t="s"><v>24</v></c><c r="B3" s="68"/><c r="C3" s="10" t="inlineStr"><is><t>' + xmlEscape(siteInfo.blockId) + '</t></is></c></row>' +
          '<row r="4" spans="1:3" ht="21" x14ac:dyDescent="0.4"><c r="A4" s="59" t="s"><v>25</v></c><c r="B4" s="60"/><c r="C4" s="10"><v>' + siteInfo.plannedDiam + '</v></c></row>' +
          '<row r="5" spans="1:3" ht="21" x14ac:dyDescent="0.4"><c r="A5" s="59" t="s"><v>26</v></c><c r="B5" s="60"/><c r="C5" s="10"><v>' + siteInfo.finalStemming + '</v></c></row>' +
          '<row r="6" spans="1:3" ht="21" x14ac:dyDescent="0.4"><c r="A6" s="63" t="s"><v>34</v></c><c r="B6" s="64"/><c r="C6" s="10"><v>' + siteInfo.density + '</v></c></row>' +
          '<row r="7" spans="1:3" ht="21" x14ac:dyDescent="0.4"><c r="A7" s="59" t="s"><v>27</v></c><c r="B7" s="60"/><c r="C7" s="10" t="inlineStr"><is><t>' + xmlEscape(siteInfo.rigOperator) + '</t></is></c></row>' +
          '<row r="8" spans="1:3" ht="21.6" thickBot="1" x14ac:dyDescent="0.45"><c r="A8" s="61" t="s"><v>28</v></c><c r="B8" s="62"/><c r="C8" s="11" t="inlineStr"><is><t>' + xmlEscape(siteInfo.date) + '</t></is></c></row>' +
          '</sheetData>';

        zip.file(infoPath, header3 + newSheetData3 + footer3);
      }
    }

    // 3. Populate each borehole into Sheet1, Sheet2, ... (preserving chart sheets)
    updateProgress(55, 'Writing borehole profiles & mathematical formulas...');
    const maxSupportedHoles = 50;
    const holesToProcess = parsedHoles.slice(0, maxSupportedHoles);

    for (let i = 0; i < holesToProcess.length; i++) {
      const hole = holesToProcess[i];
      const sheetName = `Sheet${i + 1}`;
      const sheetFile = sheetPathMap[sheetName] || `xl/worksheets/sheet${i + 4}.xml`;
      const sZipEntry = zip.file(sheetFile);

      if (!sZipEntry) {
        logMessage(`Note: ${sheetName} not found in template, skipping.`, 'info');
        continue;
      }

      logMessage(`Writing Hole [${hole.baseName}] -> ${sheetName} (${hole.data.length} depth points)...`, 'info');

      const origSheet = await sZipEntry.async('text');
      const dStart = origSheet.indexOf('<sheetData>');
      const dEnd = origSheet.indexOf('</sheetData>') + 12;
      if (dStart === -1 || dEnd === -1) continue;

      let sHeader = origSheet.substring(0, dStart);
      const sFooter = origSheet.substring(dEnd);

      const maxRow = Math.max(4, hole.data.length + 1);
      sHeader = sHeader.replace(/dimension ref="[^"]*"/, `dimension ref="A1:N${maxRow}"`);

      let rowsXml = '<sheetData>';
      // Row 1: Headers & Hole Name in L1
      rowsXml += '<row r="1" spans="1:14" x14ac:dyDescent="0.3">' +
        '<c r="A1" s="5" t="s"><v>14</v></c>' +
        '<c r="B1" s="5" t="s"><v>15</v></c>' +
        '<c r="C1" s="5" t="s"><v>29</v></c>' +
        '<c r="D1" s="5" t="s"><v>30</v></c>' +
        '<c r="E1" s="5" t="s"><v>31</v></c>' +
        '<c r="F1" s="5" t="s"><v>32</v></c>' +
        '<c r="G1" s="6" t="s"><v>16</v></c>' +
        '<c r="H1" s="5" t="s"><v>17</v></c>' +
        '<c r="J1" s="5" t="s"><v>13</v></c>' +
        '<c r="K1" s="5"/>' +
        '<c r="L1" s="7" t="inlineStr"><is><t>' + xmlEscape(hole.baseName) + '</t></is></c>' +
        '<c r="M1" s="7"><f>Information!C2</f><v>0</v></c>' +
        '<c r="N1" s="5"><f>Information!C3</f><v>0</v></c>' +
        '</row>';

      for (let r = 0; r < hole.data.length; r++) {
        const rowNum = r + 2;
        const depth = hole.data[r][0].toFixed(2);
        const diam = hole.data[r][1].toFixed(2);

        let sideCells = '';
        if (rowNum === 2) {
          sideCells = '<c r="J2" s="5" t="s"><v>18</v></c><c r="K2" s="3"><f>MAX(B2:B' + maxRow + ')</f><v>0</v></c>';
        } else if (rowNum === 3) {
          sideCells = '<c r="J3" s="5" t="s"><v>19</v></c><c r="K3" s="3"><f>MIN(B2:B' + maxRow + ')</f><v>0</v></c>';
        } else if (rowNum === 4) {
          sideCells = '<c r="J4" s="5" t="s"><v>20</v></c><c r="K4" s="3"><f>AVERAGE(B2:B' + maxRow + ')</f><v>0</v></c>';
        }

        rowsXml += '<row r="' + rowNum + '" spans="1:14" x14ac:dyDescent="0.3">' +
          '<c r="A' + rowNum + '" s="3"><v>' + depth + '</v></c>' +
          '<c r="B' + rowNum + '" s="3"><v>' + diam + '</v></c>' +
          '<c r="C' + rowNum + '" s="3"><f>B' + rowNum + '/2</f><v>0</v></c>' +
          '<c r="D' + rowNum + '" s="3"><f>(B' + rowNum + '-(B' + rowNum + '*2))/2</f><v>0</v></c>' +
          '<c r="E' + rowNum + '" s="3"><f>G' + rowNum + '/2</f><v>0</v></c>' +
          '<c r="F' + rowNum + '" s="3"><f>(G' + rowNum + '-(G' + rowNum + '*2))/2</f><v>0</v></c>' +
          '<c r="G' + rowNum + '" s="8"><f>Information!C$4</f><v>0</v></c>' +
          '<c r="H' + rowNum + '" s="3"><f>B' + rowNum + '-G' + rowNum + '</f><v>0</v></c>' +
          sideCells +
          '</row>';
      }

      // If less than 3 data rows, ensure rows 3 & 4 still exist for J/K summary formulas
      if (hole.data.length === 1) {
        rowsXml += '<row r="3" spans="1:14" x14ac:dyDescent="0.3"><c r="J3" s="5" t="s"><v>19</v></c><c r="K3" s="3"><f>MIN(B2:B2)</f><v>0</v></c></row>';
        rowsXml += '<row r="4" spans="1:14" x14ac:dyDescent="0.3"><c r="J4" s="5" t="s"><v>20</v></c><c r="K4" s="3"><f>AVERAGE(B2:B2)</f><v>0</v></c></row>';
      } else if (hole.data.length === 2) {
        rowsXml += '<row r="4" spans="1:14" x14ac:dyDescent="0.3"><c r="J4" s="5" t="s"><v>20</v></c><c r="K4" s="3"><f>AVERAGE(B2:B3)</f><v>0</v></c></row>';
      }

      rowsXml += '</sheetData>';
      zip.file(sheetFile, sHeader + rowsXml + sFooter);
    }

    // 4. Update Table summary sheet (sheet2.xml)
    updateProgress(80, 'Updating Table summary sheet formulas...');
    const tableFile = zip.file(tablePath);
    if (tableFile) {
      let tXml = await tableFile.async('text');

      // Update cached names in A3..A(N+2) so they display immediately
      for (let i = 0; i < holesToProcess.length; i++) {
        const rowNum = i + 3;
        const holeName = xmlEscape(holesToProcess[i].baseName);
        const cellRegex = new RegExp('<c r="A' + rowNum + '"[^>]*>(?:<f>[^<]*<\\/f>)?(?:<v>[^<]*<\\/v>)?<\\/c>');
        const replacement = '<c r="A' + rowNum + '" s="70" t="str"><f>Sheet' + (i + 1) + '!L1</f><v>' + holeName + '</v></c>';
        if (cellRegex.test(tXml)) {
          tXml = tXml.replace(cellRegex, replacement);
        }
      }

      // Update summary rows 53 (Minimum), 54 (Average), 55 (Maximum)
      const lastHoleRow = Math.max(3, holesToProcess.length + 2);
      const summaryCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];

      // Row 53: Minimum
      let r53Regex = /<row r="53"[^>]*>[\s\S]*?<\/row>/;
      let r53Cells = '<row r="53" spans="1:16" ht="15.6" x14ac:dyDescent="0.3"><c r="A53" s="14" t="s"><v>7</v></c>';
      for (const col of summaryCols) {
        r53Cells += '<c r="' + col + '53" s="22"><f>MIN(' + col + '3:' + col + lastHoleRow + ')</f><v>0</v></c>';
      }
      r53Cells += '<c r="P53" s="2"/></row>';
      if (r53Regex.test(tXml)) {
        tXml = tXml.replace(r53Regex, r53Cells);
      }

      // Row 54: Average
      let r54Regex = /<row r="54"[^>]*>[\s\S]*?<\/row>/;
      let r54Cells = '<row r="54" spans="1:16" ht="15.6" x14ac:dyDescent="0.3"><c r="A54" s="15" t="s"><v>0</v></c>';
      for (const col of summaryCols) {
        r54Cells += '<c r="' + col + '54" s="23"><f>AVERAGE(' + col + '3:' + col + lastHoleRow + ')</f><v>0</v></c>';
      }
      r54Cells += '<c r="P54" s="2"/></row>';
      if (r54Regex.test(tXml)) {
        tXml = tXml.replace(r54Regex, r54Cells);
      }

      // Row 55: Maximum
      let r55Regex = /<row r="55"[^>]*>[\s\S]*?<\/row>/;
      let r55Cells = '<row r="55" spans="1:16" ht="16.2" thickBot="1" x14ac:dyDescent="0.35"><c r="A55" s="69" t="s"><v>8</v></c>';
      for (const col of summaryCols) {
        r55Cells += '<c r="' + col + '55" s="24"><f>MAX(' + col + '3:' + col + lastHoleRow + ')</f><v>0</v></c>';
      }
      r55Cells += '</row>';
      if (r55Regex.test(tXml)) {
        tXml = tXml.replace(r55Regex, r55Cells);
      }

      zip.file(tablePath, tXml);
    }

    // 5. Instruct Excel to force full recalculation of formulas and refresh charts upon opening
    try {
      let wbXml = await zip.file('xl/workbook.xml').async('text');
      if (wbXml.includes('<calcPr')) {
        wbXml = wbXml.replace(/<calcPr[^>]*\/>/, '<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>');
      } else if (wbXml.includes('</workbook>')) {
        wbXml = wbXml.replace('</workbook>', '<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
      }
      zip.file('xl/workbook.xml', wbXml);
    } catch (calcErr) {
      console.warn('Could not update calcPr:', calcErr);
    }

    updateProgress(95, 'Generating output workbook package (all 102 graphs & drawings preserved)...');
    const outBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    logMessage('Workbook generation complete! All graphs and charts preserved.', 'success');
    updateProgress(100, 'Processing complete!');
    return outBuffer;
  }

  // ==========================================
  // Process Orchestrator
  // ==========================================
  async function handleProcess() {
    if (state.isProcessing) return;
    hideAlert();

    if (state.lasFiles.length === 0) {
      showAlert('Please upload at least one .LAS borehole file or click "Load 3 Sample Holes".', 'error');
      return;
    }

    const plannedDiam = parseFloat(elements.inputPlannedDiam.value);
    const finalStemming = parseFloat(elements.inputFinalStemming.value);
    const density = parseFloat(elements.inputDensity.value);

    if (isNaN(plannedDiam) || plannedDiam <= 0) {
      showAlert('Please enter a valid numeric Planned Hole Diameter (e.g. 165).', 'error');
      elements.inputPlannedDiam.focus();
      return;
    }
    if (isNaN(finalStemming) || finalStemming < 0) {
      showAlert('Please enter a valid numeric Final Stemming (e.g. 1.0).', 'error');
      elements.inputFinalStemming.focus();
      return;
    }
    if (isNaN(density) || density <= 0) {
      showAlert('Please enter a valid numeric Average In-Hole Density (e.g. 1.2).', 'error');
      elements.inputDensity.focus();
      return;
    }

    const siteInfo = {
      client: elements.inputClient.value.trim(),
      mine: elements.inputMine.value.trim(),
      blockId: elements.inputBlockId.value.trim(),
      plannedDiam: plannedDiam,
      finalStemming: finalStemming,
      density: density,
      rigOperator: elements.inputRigOperator.value.trim(),
      date: elements.inputDate.value,
      filename: elements.inputFilename.value.trim() || 'Calipering.xlsx'
    };

    try {
      state.isProcessing = true;
      elements.btnProcessData.disabled = true;
      elements.progressSection.classList.remove('hidden');
      clearLogs();
      logMessage(`Starting Caliper processing for ${state.lasFiles.length} file(s)...`, 'info');

      // 1. Parse LAS files
      const parsedHoles = [];
      for (const file of state.lasFiles) {
        logMessage(`Parsing .LAS file: ${file.name}`, 'info');
        const hole = parseLasContent(file.name, file.content, finalStemming, plannedDiam, density);
        parsedHoles.push(hole);
      }

      state.processedHoles = parsedHoles;
      state.activeHoleIndex = 0;

      // 2. Generate Excel workbook
      const buffer = await processWorkbook(siteInfo, parsedHoles);
      state.processedWorkbookBuffer = buffer;

      // 3. Update UI with results
      renderResults(siteInfo, parsedHoles);
      elements.resultsContainer.classList.remove('hidden');
      elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showAlert(`Successfully processed ${parsedHoles.length} borehole(s)! Ready for download.`, 'success');

    } catch (err) {
      console.error('Processing error:', err);
      logMessage(`Fatal Error: ${err.message}`, 'error');
      showAlert(`Error processing borehole data: ${err.message}`, 'error');
    } finally {
      state.isProcessing = false;
      elements.btnProcessData.disabled = false;
    }
  }

  // ==========================================
  // Results & KPI Rendering
  // ==========================================
  function renderResults(siteInfo, holes) {
    // Download button label
    elements.downloadFilenameLabel.textContent = siteInfo.filename;

    // Aggregate statistics
    let totalDepth = 0;
    let sumDiam = 0;
    let countHolesWithData = 0;
    let sumOverbreak = 0;

    holes.forEach(h => {
      totalDepth += h.caliperedLen;
      if (h.validCount > 0) {
        sumDiam += h.meanDiam;
        sumOverbreak += (h.meanDiam - siteInfo.plannedDiam);
        countHolesWithData++;
      }
    });

    const avgDiam = countHolesWithData > 0 ? (sumDiam / countHolesWithData) : 0;
    const avgOverbreak = countHolesWithData > 0 ? (sumOverbreak / countHolesWithData) : 0;
    const overbreakPct = siteInfo.plannedDiam > 0 ? ((avgDiam - siteInfo.plannedDiam) / siteInfo.plannedDiam) * 100 : 0;

    elements.metricHolesCount.textContent = holes.length;
    elements.metricTotalDepth.innerHTML = `${totalDepth.toFixed(1)} <span class="unit">m</span>`;
    elements.metricAvgDiam.innerHTML = `${avgDiam.toFixed(1)} <span class="unit">mm</span>`;
    elements.metricPlannedDiamSub.textContent = `Planned: ${siteInfo.plannedDiam.toFixed(1)} mm`;

    const sign = avgOverbreak >= 0 ? '+' : '';
    elements.metricAvgOverbreak.innerHTML = `${sign}${avgOverbreak.toFixed(1)} <span class="unit">mm</span>`;
    elements.metricOverbreakPct.textContent = `${sign}${overbreakPct.toFixed(1)}% variance from nominal`;

    // Render hole selector pills
    renderHoleSelector(holes);

    // Render active hole visualizer and stats
    renderHoleVisualizer(holes[0], siteInfo);

    // Render Table preview
    renderTablePreview(holes, siteInfo);
  }

  function renderHoleSelector(holes) {
    if (!elements.holeSelector) return;
    elements.holeSelector.innerHTML = '';

    holes.forEach((h, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-hole-tab ${idx === state.activeHoleIndex ? 'active' : ''}`;
      btn.textContent = h.baseName;
      btn.addEventListener('click', () => {
        state.activeHoleIndex = idx;
        document.querySelectorAll('.btn-hole-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const plannedDiam = parseFloat(elements.inputPlannedDiam.value);
        const finalStemming = parseFloat(elements.inputFinalStemming.value);
        renderHoleVisualizer(holes[idx], { plannedDiam, finalStemming });
      });
      elements.holeSelector.appendChild(btn);
    });
  }

  // ==========================================
  // Interactive SVG Borehole Visualizer
  // ==========================================
  function renderHoleVisualizer(hole, siteInfo) {
    if (!hole || !elements.boreholeSvg) return;

    // Update side stats panel
    elements.activeHoleName.textContent = `Borehole: ${hole.baseName}`;
    elements.statTopDepth.textContent = `${hole.topDepth.toFixed(2)} m`;
    elements.statBottomDepth.textContent = `${hole.maxDepth.toFixed(2)} m`;
    elements.statCaliperedLen.textContent = `${hole.caliperedLen.toFixed(2)} m`;
    elements.statStemmingVal.textContent = `${siteInfo.finalStemming.toFixed(2)} m`;
    elements.statMinDiam.textContent = `${hole.minDiam.toFixed(1)} mm`;
    elements.statMaxDiam.textContent = `${hole.maxDiam.toFixed(1)} mm`;
    elements.statMeanDiam.textContent = `${hole.meanDiam.toFixed(1)} mm`;
    elements.statExpDepth.textContent = `${hole.expDepth.toFixed(2)} m`;
    elements.statExpMass.textContent = `${hole.expMassKg.toFixed(1)} kg`;
    elements.statTheoMass.textContent = `${hole.theoMassKg.toFixed(1)} kg`;

    // Cavity alerts
    elements.holeFlags.innerHTML = '';
    if (hole.maxDiam > hole.plannedDiam * 1.15) {
      elements.holeFlags.innerHTML += `
        <div class="flag-alert warning">
          <strong>Cavity Alert:</strong> Max diameter (${hole.maxDiam.toFixed(1)} mm) exceeds planned by &gt;15%. Check for explosive overloading.
        </div>
      `;
    }
    if (hole.minDiam < hole.plannedDiam * 0.9) {
      elements.holeFlags.innerHTML += `
        <div class="flag-alert warning">
          <strong>Constriction Alert:</strong> Min diameter (${hole.minDiam.toFixed(1)} mm) is below 90% of nominal bit size. Check for hole bridging.
        </div>
      `;
    }
    if (hole.data.length === 0) {
      elements.holeFlags.innerHTML += `
        <div class="flag-alert warning">No valid caliper points remaining after stemming and bottom filters.</div>
      `;
    }

    // Render SVG
    const svg = elements.boreholeSvg;
    svg.innerHTML = '';

    const width = 640;
    const height = 480;
    const margin = { top: 30, right: 60, bottom: 40, left: 70 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    if (hole.data.length === 0) {
      svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#64748b">No data points to display for ${escapeHtml(hole.baseName)}</text>`;
      return;
    }

    const minDepth = Math.max(0, hole.topDepth - 0.5);
    const maxDepth = hole.maxDepth + 0.5;
    const depthSpan = maxDepth - minDepth || 1;

    // X Scale: Borehole diameter centered around chartW / 2
    // Max diameter for scale
    const plannedD = siteInfo.plannedDiam || 165;
    const maxViewDiam = Math.max(plannedD * 1.6, hole.maxDiam * 1.2, 250);
    const centerX = margin.left + chartW / 2;

    const scaleX = (radMm) => (radMm / (maxViewDiam / 2)) * (chartW / 2);
    const scaleY = (d) => margin.top + ((d - minDepth) / depthSpan) * chartH;

    // SVG Defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <pattern id="stemming-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#eab308" stroke-width="2" opacity="0.4" />
      </pattern>
    `;
    svg.appendChild(defs);

    // Background grid & depth ticks
    const depthStep = depthSpan > 15 ? 2 : 1;
    for (let d = Math.ceil(minDepth); d <= maxDepth; d += depthStep) {
      const y = scaleY(d);
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', margin.left);
      gridLine.setAttribute('x2', width - margin.right);
      gridLine.setAttribute('y1', y);
      gridLine.setAttribute('y2', y);
      gridLine.setAttribute('stroke', '#f1f5f9');
      gridLine.setAttribute('stroke-width', '1');
      svg.appendChild(gridLine);

      // Depth label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', margin.left - 10);
      text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-size', '11');
      text.setAttribute('fill', '#94a3b8');
      text.textContent = `${d.toFixed(1)}m`;
      svg.appendChild(text);
    }

    // Centerline (axis of hole)
    const centerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    centerLine.setAttribute('x1', centerX);
    centerLine.setAttribute('x2', centerX);
    centerLine.setAttribute('y1', margin.top);
    centerLine.setAttribute('y2', height - margin.bottom);
    centerLine.setAttribute('stroke', '#cbd5e1');
    centerLine.setAttribute('stroke-dasharray', '4 4');
    centerLine.setAttribute('stroke-width', '1.5');
    svg.appendChild(centerLine);

    // Stemming zone band (0 to finalStemming)
    const stemmingY1 = scaleY(minDepth);
    const stemmingY2 = scaleY(Math.min(siteInfo.finalStemming, maxDepth));
    if (stemmingY2 > stemmingY1) {
      const stemmingRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      stemmingRect.setAttribute('x', margin.left);
      stemmingRect.setAttribute('y', stemmingY1);
      stemmingRect.setAttribute('width', chartW);
      stemmingRect.setAttribute('height', stemmingY2 - stemmingY1);
      stemmingRect.setAttribute('fill', 'url(#stemming-hatch)');
      svg.appendChild(stemmingRect);

      const stemLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stemLabel.setAttribute('x', width - margin.right - 8);
      stemLabel.setAttribute('y', (stemmingY1 + stemmingY2) / 2 + 4);
      stemLabel.setAttribute('text-anchor', 'end');
      stemLabel.setAttribute('font-size', '10');
      stemLabel.setAttribute('font-weight', '600');
      stemLabel.setAttribute('fill', '#b45309');
      stemLabel.textContent = `Stemming (${siteInfo.finalStemming}m)`;
      svg.appendChild(stemLabel);
    }

    // Planned diameter boundary lines
    const plannedR = plannedD / 2;
    const planX1 = centerX - scaleX(plannedR);
    const planX2 = centerX + scaleX(plannedR);

    const planLineL = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    planLineL.setAttribute('x1', planX1);
    planLineL.setAttribute('x2', planX1);
    planLineL.setAttribute('y1', margin.top);
    planLineL.setAttribute('y2', height - margin.bottom);
    planLineL.setAttribute('stroke', '#3b82f6');
    planLineL.setAttribute('stroke-dasharray', '5 3');
    planLineL.setAttribute('stroke-width', '1.5');
    svg.appendChild(planLineL);

    const planLineR = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    planLineR.setAttribute('x1', planX2);
    planLineR.setAttribute('x2', planX2);
    planLineR.setAttribute('y1', margin.top);
    planLineR.setAttribute('y2', height - margin.bottom);
    planLineR.setAttribute('stroke', '#3b82f6');
    planLineR.setAttribute('stroke-dasharray', '5 3');
    planLineR.setAttribute('stroke-width', '1.5');
    svg.appendChild(planLineR);

    // Build caliper polygon (left trace and right trace symmetric or measured)
    // Left boundary goes from top to bottom
    // Right boundary goes from bottom to top to close the polygon
    const pointsLeft = [];
    const pointsRight = [];

    for (const pt of hole.data) {
      const depth = pt[0];
      const diam = pt[1];
      const r = diam / 2;
      const y = scaleY(depth);
      const xL = centerX - scaleX(r);
      const xR = centerX + scaleX(r);

      pointsLeft.push(`${xL.toFixed(1)},${y.toFixed(1)}`);
      pointsRight.unshift(`${xR.toFixed(1)},${y.toFixed(1)}`);
    }

    const polygonPts = pointsLeft.concat(pointsRight).join(' ');
    const caliperPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    caliperPoly.setAttribute('points', polygonPts);
    caliperPoly.setAttribute('fill', 'rgba(16, 185, 129, 0.15)');
    caliperPoly.setAttribute('stroke', '#10b981');
    caliperPoly.setAttribute('stroke-width', '2');
    svg.appendChild(caliperPoly);

    // Highlight cavities (diam > plannedD * 1.1)
    for (let i = 0; i < hole.data.length - 1; i++) {
      const pt1 = hole.data[i];
      const pt2 = hole.data[i + 1];
      if (pt1[1] > plannedD * 1.1 || pt2[1] > plannedD * 1.1) {
        const y1 = scaleY(pt1[0]);
        const y2 = scaleY(pt2[0]);
        const xL1 = centerX - scaleX(pt1[1] / 2);
        const xL2 = centerX - scaleX(pt2[1] / 2);
        const xR1 = centerX + scaleX(pt1[1] / 2);
        const xR2 = centerX + scaleX(pt2[1] / 2);

        const cavityPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        cavityPoly.setAttribute('points', `${xL1},${y1} ${xL2},${y2} ${xR2},${y2} ${xR1},${y1}`);
        cavityPoly.setAttribute('fill', 'rgba(249, 115, 22, 0.3)');
        cavityPoly.setAttribute('stroke', '#f97316');
        cavityPoly.setAttribute('stroke-width', '1.5');
        svg.appendChild(cavityPoly);
      }
    }

    // Diameter indicator labels on top axis
    const topDiamL = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    topDiamL.setAttribute('x', planX1);
    topDiamL.setAttribute('y', margin.top - 8);
    topDiamL.setAttribute('text-anchor', 'middle');
    topDiamL.setAttribute('font-size', '10');
    topDiamL.setAttribute('font-weight', '600');
    topDiamL.setAttribute('fill', '#2563eb');
    topDiamL.textContent = `-${(plannedD / 2).toFixed(0)}mm`;
    svg.appendChild(topDiamL);

    const topDiamR = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    topDiamR.setAttribute('x', planX2);
    topDiamR.setAttribute('y', margin.top - 8);
    topDiamR.setAttribute('text-anchor', 'middle');
    topDiamR.setAttribute('font-size', '10');
    topDiamR.setAttribute('font-weight', '600');
    topDiamR.setAttribute('fill', '#2563eb');
    topDiamR.textContent = `+${(plannedD / 2).toFixed(0)}mm`;
    svg.appendChild(topDiamR);

    // Interactive tooltip overlay
    const tooltipGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tooltipGroup.setAttribute('visibility', 'hidden');
    tooltipGroup.innerHTML = `
      <line id="tip-line" x1="${margin.left}" x2="${width - margin.right}" y1="0" y2="0" stroke="#0284c7" stroke-dasharray="2 2" />
      <circle id="tip-dot-l" cx="0" cy="0" r="4" fill="#0284c7" />
      <circle id="tip-dot-r" cx="0" cy="0" r="4" fill="#0284c7" />
      <rect id="tip-bg" x="0" y="0" width="140" height="42" rx="4" fill="#0f172a" opacity="0.9" />
      <text id="tip-text1" x="0" y="0" fill="#ffffff" font-size="11" font-weight="600"></text>
      <text id="tip-text2" x="0" y="0" fill="#38bdf8" font-size="10"></text>
    `;
    svg.appendChild(tooltipGroup);

    // Mousemove handler for interactive inspection
    svg.onmousemove = (e) => {
      const rect = svg.getBoundingClientRect();
      const clientY = e.clientY - rect.top;
      const svgY = (clientY / rect.height) * height;

      if (svgY >= margin.top && svgY <= height - margin.bottom) {
        const hoverDepth = minDepth + ((svgY - margin.top) / chartH) * depthSpan;
        
        // Find nearest point
        let nearest = hole.data[0];
        let minDist = Math.abs(hole.data[0][0] - hoverDepth);
        for (let i = 1; i < hole.data.length; i++) {
          const dist = Math.abs(hole.data[i][0] - hoverDepth);
          if (dist < minDist) {
            minDist = dist;
            nearest = hole.data[i];
          }
        }

        if (nearest) {
          const depth = nearest[0];
          const diam = nearest[1];
          const y = scaleY(depth);
          const xL = centerX - scaleX(diam / 2);
          const xR = centerX + scaleX(diam / 2);

          tooltipGroup.setAttribute('visibility', 'visible');
          const line = tooltipGroup.querySelector('#tip-line');
          line.setAttribute('y1', y);
          line.setAttribute('y2', y);

          const dotL = tooltipGroup.querySelector('#tip-dot-l');
          dotL.setAttribute('cx', xL);
          dotL.setAttribute('cy', y);

          const dotR = tooltipGroup.querySelector('#tip-dot-r');
          dotR.setAttribute('cx', xR);
          dotR.setAttribute('cy', y);

          const tipBg = tooltipGroup.querySelector('#tip-bg');
          const tipT1 = tooltipGroup.querySelector('#tip-text1');
          const tipT2 = tooltipGroup.querySelector('#tip-text2');

          const tipX = Math.min(width - margin.right - 145, Math.max(margin.left + 5, xR + 10));
          const tipY = Math.max(margin.top + 5, y - 20);

          tipBg.setAttribute('x', tipX);
          tipBg.setAttribute('y', tipY);

          tipT1.setAttribute('x', tipX + 8);
          tipT1.setAttribute('y', tipY + 16);
          tipT1.textContent = `Depth: ${depth.toFixed(2)} m`;

          const diff = diam - plannedD;
          const diffSign = diff >= 0 ? '+' : '';
          tipT2.setAttribute('x', tipX + 8);
          tipT2.setAttribute('y', tipY + 32);
          tipT2.textContent = `Diam: ${diam.toFixed(1)}mm (${diffSign}${diff.toFixed(1)}mm)`;
        }
      }
    };

    svg.onmouseleave = () => {
      tooltipGroup.setAttribute('visibility', 'hidden');
    };
  }

  // ==========================================
  // Table Sheet Preview
  // ==========================================
  function renderTablePreview(holes, siteInfo) {
    if (!elements.summaryTableBody || !elements.summaryTableFooter) return;

    elements.summaryTableBody.innerHTML = '';
    elements.summaryTableFooter.innerHTML = '';

    const depths = [];
    const meanDiams = [];
    const minDiams = [];
    const maxDiams = [];
    const overbreaks = [];
    const expMasses = [];
    const theoMasses = [];

    holes.forEach((h) => {
      depths.push(h.maxDepth);
      meanDiams.push(h.meanDiam);
      minDiams.push(h.minDiam);
      maxDiams.push(h.maxDiam);
      overbreaks.push(h.overbreakPct);
      expMasses.push(h.expMassKg);
      theoMasses.push(h.theoMassKg);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(h.baseName)}</strong></td>
        <td>${h.maxDepth.toFixed(2)}</td>
        <td>${h.meanDiam.toFixed(2)}</td>
        <td>${h.minDiam.toFixed(2)}</td>
        <td>${h.maxDiam.toFixed(2)}</td>
        <td>${siteInfo.plannedDiam.toFixed(2)}</td>
        <td style="color: ${h.overbreakPct >= 0 ? '#b45309' : '#0284c7'}">${h.overbreakPct >= 0 ? '+' : ''}${h.overbreakPct.toFixed(1)}%</td>
        <td>${siteInfo.finalStemming.toFixed(2)}</td>
        <td>${h.expMassKg.toFixed(1)}</td>
        <td>${h.theoMassKg.toFixed(1)}</td>
      `;
      elements.summaryTableBody.appendChild(tr);
    });

    // Helper math functions
    const min = arr => arr.length ? Math.min(...arr) : 0;
    const max = arr => arr.length ? Math.max(...arr) : 0;
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const minRow = `
      <tr>
        <td>Minimum</td>
        <td>${min(depths).toFixed(2)}</td>
        <td>${min(meanDiams).toFixed(2)}</td>
        <td>${min(minDiams).toFixed(2)}</td>
        <td>${min(maxDiams).toFixed(2)}</td>
        <td>${siteInfo.plannedDiam.toFixed(2)}</td>
        <td>${min(overbreaks).toFixed(1)}%</td>
        <td>${siteInfo.finalStemming.toFixed(2)}</td>
        <td>${min(expMasses).toFixed(1)}</td>
        <td>${min(theoMasses).toFixed(1)}</td>
      </tr>
    `;

    const avgRow = `
      <tr>
        <td>Average</td>
        <td>${avg(depths).toFixed(2)}</td>
        <td>${avg(meanDiams).toFixed(2)}</td>
        <td>${avg(minDiams).toFixed(2)}</td>
        <td>${avg(maxDiams).toFixed(2)}</td>
        <td>${siteInfo.plannedDiam.toFixed(2)}</td>
        <td>${avg(overbreaks).toFixed(1)}%</td>
        <td>${siteInfo.finalStemming.toFixed(2)}</td>
        <td>${avg(expMasses).toFixed(1)}</td>
        <td>${avg(theoMasses).toFixed(1)}</td>
      </tr>
    `;

    const maxRow = `
      <tr>
        <td>Maximum</td>
        <td>${max(depths).toFixed(2)}</td>
        <td>${max(meanDiams).toFixed(2)}</td>
        <td>${max(minDiams).toFixed(2)}</td>
        <td>${max(maxDiams).toFixed(2)}</td>
        <td>${siteInfo.plannedDiam.toFixed(2)}</td>
        <td>${max(overbreaks).toFixed(1)}%</td>
        <td>${siteInfo.finalStemming.toFixed(2)}</td>
        <td>${max(expMasses).toFixed(1)}</td>
        <td>${max(theoMasses).toFixed(1)}</td>
      </tr>
    `;

    elements.summaryTableFooter.innerHTML = minRow + avgRow + maxRow;
  }

  // ==========================================
  // File Download Handlers
  // ==========================================
  function downloadProcessedExcel() {
    if (!state.processedWorkbookBuffer) {
      showAlert('No processed workbook available yet. Please click "Process & Generate Excel" first.', 'error');
      return;
    }

    const filename = elements.inputFilename.value.trim() || 'Calipering.xlsx';
    const blob = new Blob([state.processedWorkbookBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadBlankTemplate() {
    try {
      let blob;
      try {
        const resp = await fetch('./templates/BME_Caliper_Template.xlsx');
        if (resp.ok) blob = await resp.blob();
      } catch (fetchErr) {
        console.warn('Network fetch for template download failed, using memory fallback:', fetchErr);
      }

      if (!blob && window.DEFAULT_BME_TEMPLATE_B64) {
        const binaryStr = atob(window.DEFAULT_BME_TEMPLATE_B64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        blob = new Blob([bytes.buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }

      if (!blob) throw new Error('Could not access template file');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'BME_Caliper_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showAlert('Could not download template file.', 'error');
    }
  }

  // Export full standalone GitHub Pages package as ZIP
  async function exportGitHubPagesZip() {
    try {
      showAlert('Preparing GitHub Pages static repository ZIP package...', 'info');
      const zip = new JSZip();

      // Fetch all local static files
      const fileList = [
        { path: 'index.html', fetchPath: './index.html' },
        { path: 'style.css', fetchPath: './style.css' },
        { path: 'script.js', fetchPath: './script.js' },
        { path: 'service-worker.js', fetchPath: './service-worker.js' },
        { path: 'README.md', fetchPath: './README.md' },
        { path: 'libs/marked.min.js', fetchPath: './libs/marked.min.js' },
        { path: 'libs/exceljs.min.js', fetchPath: './libs/exceljs.min.js' },
        { path: 'libs/jszip.min.js', fetchPath: './libs/jszip.min.js' },
        { path: 'libs/defaults.js', fetchPath: './libs/defaults.js' },
        { path: 'templates/BME_Caliper_Template.xlsx', fetchPath: './templates/BME_Caliper_Template.xlsx', binary: true },
        { path: 'sample_data/BH_001.las', fetchPath: './sample_data/BH_001.las' },
        { path: 'sample_data/BH_002.las', fetchPath: './sample_data/BH_002.las' },
        { path: 'sample_data/BH_003.las', fetchPath: './sample_data/BH_003.las' }
      ];

      for (const item of fileList) {
        const res = await fetch(item.fetchPath);
        if (res.ok) {
          if (item.binary) {
            const data = await res.arrayBuffer();
            zip.file(item.path, data);
          } else {
            const text = await res.text();
            zip.file(item.path, text);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bme-caliper-github-pages.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAlert('GitHub Pages ZIP package downloaded! Unzip and push to your GitHub repo.', 'success');
    } catch (err) {
      console.error('Failed to generate ZIP package:', err);
      showAlert(`Failed to export ZIP package: ${err.message}`, 'error');
    }
  }

  // ==========================================
  // Documentation Modal
  // ==========================================
  async function openDocsModal() {
    elements.docsModal.classList.remove('hidden');
    if (elements.docsMarkdownContent) {
      try {
        const res = await fetch('./README.md');
        if (res.ok) {
          const md = await res.text();
          if (window.marked && typeof window.marked.parse === 'function') {
            elements.docsMarkdownContent.innerHTML = window.marked.parse(md);
          } else {
            elements.docsMarkdownContent.innerText = md;
          }
        }
      } catch (err) {
        elements.docsMarkdownContent.innerHTML = '<p>Could not load documentation.</p>';
      }
    }
  }

  function closeDocsModal() {
    elements.docsModal.classList.add('hidden');
  }

  // ==========================================
  // Event Listeners Binding
  // ==========================================
  function initEventListeners() {
    // Dropzone .LAS
    if (elements.lasDropzone) {
      elements.lasDropzone.addEventListener('click', () => elements.lasFileInput.click());
      elements.lasDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.lasDropzone.classList.add('dragover');
      });
      elements.lasDropzone.addEventListener('dragleave', () => elements.lasDropzone.classList.remove('dragover'));
      elements.lasDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.lasDropzone.classList.remove('dragover');
        if (e.dataTransfer.files) handleLasFiles(e.dataTransfer.files);
      });
    }

    if (elements.lasFileInput) {
      elements.lasFileInput.addEventListener('change', (e) => {
        if (e.target.files) handleLasFiles(e.target.files);
      });
    }

    // Template Dropzone
    if (elements.templateDropzone) {
      elements.templateDropzone.addEventListener('click', () => elements.templateFileInput.click());
      elements.templateDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.templateDropzone.classList.add('dragover');
      });
      elements.templateDropzone.addEventListener('dragleave', () => elements.templateDropzone.classList.remove('dragover'));
      elements.templateDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.templateDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleCustomTemplateFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (elements.templateFileInput) {
      elements.templateFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleCustomTemplateFile(e.target.files[0]);
        }
      });
    }

    // Radio choice
    if (elements.optionDefaultTemplate) {
      elements.optionDefaultTemplate.addEventListener('click', () => setTemplateChoice('default'));
    }
    if (elements.optionCustomTemplate) {
      elements.optionCustomTemplate.addEventListener('click', () => setTemplateChoice('custom'));
    }

    // Actions
    if (elements.btnLoadSample) elements.btnLoadSample.addEventListener('click', loadSampleLasFiles);
    if (elements.btnClearLas) {
      elements.btnClearLas.addEventListener('click', () => {
        state.lasFiles = [];
        renderLasChips();
      });
    }
    if (elements.btnDownloadTemplate) elements.btnDownloadTemplate.addEventListener('click', downloadBlankTemplate);
    if (elements.btnProcessData) elements.btnProcessData.addEventListener('click', handleProcess);
    if (elements.btnDownloadResult) elements.btnDownloadResult.addEventListener('click', downloadProcessedExcel);
    if (elements.btnExportZip) elements.btnExportZip.addEventListener('click', exportGitHubPagesZip);
    if (elements.btnModalExportZip) elements.btnModalExportZip.addEventListener('click', exportGitHubPagesZip);

    // Reset settings
    if (elements.btnResetSettings) {
      elements.btnResetSettings.addEventListener('click', () => {
        elements.inputClient.value = 'Anglo American';
        elements.inputMine.value = 'Kolomela Mine';
        elements.inputBlockId.value = 'BLK-2026-09';
        elements.inputPlannedDiam.value = '165';
        elements.inputFinalStemming.value = '1.0';
        elements.inputDensity.value = '1.2';
        elements.inputRigOperator.value = 'T. Strauss';
        elements.inputFilename.value = 'Calipering.xlsx';
        const today = new Date().toISOString().split('T')[0];
        elements.inputDate.value = today;
        showAlert('Settings reset to defaults.', 'info');
      });
    }

    // Modal
    if (elements.btnOpenDocs) elements.btnOpenDocs.addEventListener('click', openDocsModal);
    if (elements.btnCloseDocs) elements.btnCloseDocs.addEventListener('click', closeDocsModal);
    if (elements.btnModalCloseAction) elements.btnModalCloseAction.addEventListener('click', closeDocsModal);
    if (elements.docsModal) {
      elements.docsModal.addEventListener('click', (e) => {
        if (e.target === elements.docsModal) closeDocsModal();
      });
    }

    if (elements.btnCloseAlert) elements.btnCloseAlert.addEventListener('click', hideAlert);

    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    if (elements.inputDate && !elements.inputDate.value) {
      elements.inputDate.value = today;
    }
  }

  // ==========================================
  // Initialization
  // ==========================================
  function init() {
    initEventListeners();
    initServiceWorker();
    console.log('[BME Caliper Processor] Ready.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
