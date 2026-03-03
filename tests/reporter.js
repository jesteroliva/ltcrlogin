const path = require('path');
const fs = require('fs');
const { csvEscape, writeFileSafely, timestamp } = require('./utils');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeRunIdToIso(runId) {
  const match = String(runId).match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!match) {
    return null;
  }
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
}

function formatPht(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

function csvTimePht(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${String(value)} PHT`;
  }

  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return `${year}-${month}-${day} ${hour}:${minute}:${second} PHT`;
}

function deriveActionIndicators(entries, module) {
  const moduleEntries = entries.filter((entry) => entry.module === module);
  // Cache of extracted test source texts per module
  const testSourceCache = deriveActionIndicators._testSourceCache || (deriveActionIndicators._testSourceCache = {});

  function getTestSourceTextsForModule(moduleName) {
    if (testSourceCache[moduleName]) return testSourceCache[moduleName];
    const texts = [];
    try {
      const testsDir = path.join(__dirname);
      const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.spec.ts') || f.endsWith('.spec.js') || f.endsWith('.ts'));
      // Properly escape regex for module name
      const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const moduleRegex = new RegExp(`test\(\s*['\"]${esc(moduleName)}['\"]`, 'i');
      for (const file of files) {
        try {
          const full = path.join(testsDir, file);
          const content = fs.readFileSync(full, 'utf8');
          if (moduleRegex.test(content)) {
            // include the test title
            texts.push(moduleName);
            // extract test('...', async ({ ... }) => { ...test.step('...')... })
            // For checkLoginButton.spec.ts, extract test and test.step
            if (file === 'checkLoginButton.spec.ts') {
              // Find all test('...')
              const testTitleRe = /test\(\s*['\"]([^'\"]+)['\"]/g;
              let t;
              while ((t = testTitleRe.exec(content))) {
                if (t[1]) texts.push(t[1]);
              }
              // Find all test.step('...')
              const stepRe = /test\.step\(\s*['\"]([^'\"]+)['\"]/g;
              let m;
              while ((m = stepRe.exec(content))) {
                if (m[1]) texts.push(m[1]);
              }
            } else {
              // fallback: extract test.step and .step for other files
              const stepRe = /test\.step\(\s*['\"]([^'\"]+)['\"]/g;
              let m;
              while ((m = stepRe.exec(content))) {
                if (m[1]) texts.push(m[1]);
              }
              const stepRe2 = /\.step\(\s*['\"]([^'\"]+)['\"]/g;
              while ((m = stepRe2.exec(content))) {
                if (m[1]) texts.push(m[1]);
              }
            }
          }
        } catch (e) {
          // ignore file read errors
        }
      }
    } catch (e) {
      // ignore dir read errors
    }
    testSourceCache[moduleName] = texts;
    return texts;
  }
  const endToEndRules = {
    Roles: /permissions_reflects_new_role|permissions_reflects_updated_role|cross_module/i,
    Permissions: /roles_reflect_new_permission|roles_reflect_updated_permission|cross_module/i,
    Announcements: /dashboard_message_check|dashboard_message_any_check|dashboard_shows_message/i,
  };
  // Dynamically extract all test and test.step names from checkLoginButton.spec.ts for action summary
  let dynamicActionSpecs = [];
  try {
    const testsDir = path.join(__dirname);
    const file = 'checkLoginButton.spec.ts';
    const full = path.join(testsDir, file);
    const content = fs.readFileSync(full, 'utf8');
    // Find all test('...')
    const testTitleRe = /test\(\s*['\"]([^'\"]+)['\"]/g;
    let t;
    while ((t = testTitleRe.exec(content))) {
      if (t[1]) dynamicActionSpecs.push({ label: t[1], regex: new RegExp(t[1], 'i') });
    }
    // Find all test.step('...')
    const stepRe = /test\.step\(\s*['\"]([^'\"]+)['\"]/g;
    let m;
    while ((m = stepRe.exec(content))) {
      if (m[1]) dynamicActionSpecs.push({ label: m[1], regex: new RegExp(m[1], 'i') });
    }
  } catch (e) {
    // fallback: no dynamic actions
  }
  // If no dynamic actions found, fallback to previous static ones
  if (dynamicActionSpecs.length === 0) {
    dynamicActionSpecs = [
      { label: 'Login Button', regex: /login button|check for login button/i },
      { label: 'Login Redirect', regex: /redirect|verify url|login redirect/i },
      { label: 'Screenshot', regex: /screenshot/i },
    ];
  }
  const actionSpecs = dynamicActionSpecs;

  const indicators = actionSpecs.map((spec) => {
    const moduleEndToEndRegex = endToEndRules[module];

    if (spec.label === 'End-to-End' && !moduleEndToEndRegex) {
      return {
        label: spec.label,
        status: 'N/A',
        reason: 'End-to-End applies only to modules with explicit cross-page reflection checks.',
      };
    }

    const effectiveRegex = spec.label === 'End-to-End' && moduleEndToEndRegex ? moduleEndToEndRegex : spec.regex;

    const sourceTexts = getTestSourceTextsForModule(module);

    const buildSearchText = (entry) => {
      const parts = [];
      if (entry && entry.step) parts.push(String(entry.step));
      if (entry && entry.message) parts.push(String(entry.message));
      if (entry && entry.source) {
        parts.push(typeof entry.source === 'string' ? entry.source : JSON.stringify(entry.source));
      }

      // Use test and test.steps from entry if present
      if (entry && entry.test) {
        if (typeof entry.test === 'string') {
          parts.push(entry.test);
        } else if (typeof entry.test === 'object') {
          if (entry.test.title) parts.push(String(entry.test.title));
          if (Array.isArray(entry.test.steps)) parts.push(entry.test.steps.join(' '));
          else if (entry.test.steps && typeof entry.test.steps === 'string') parts.push(entry.test.steps);
        }
      }

      // Support a flattened `testSteps` property (array or string)
      if (entry && entry.testSteps) {
        if (Array.isArray(entry.testSteps)) parts.push(entry.testSteps.join(' '));
        else parts.push(String(entry.testSteps));
      }

      // include extracted test source texts (titles and step names)
      if (Array.isArray(sourceTexts) && sourceTexts.length > 0) parts.push(sourceTexts.join(' '));
      return parts.filter(Boolean).join(' ');
    };

    const matched = moduleEntries.filter((entry) => effectiveRegex.test(buildSearchText(entry)));

    if (spec.label === 'End-to-End' && moduleEndToEndRegex && matched.length === 0) {
      return {
        label: spec.label,
        status: 'FAIL',
        reason: 'Expected end-to-end reflection/check steps are applicable but were not detected in logs.',
      };
    }

    if (matched.length === 0) {
      return { label: spec.label, status: 'N/A', reason: `${spec.label} not detected in logged steps.` };
    }

    const hasFail = matched.some((entry) => entry.status === 'FAIL');
    if (hasFail) {
      return { label: spec.label, status: 'FAIL', reason: `${spec.label} has at least one failed step.` };
    }

    return { label: spec.label, status: 'PASS', reason: `${spec.label} executed without failed step logs.` };
  });

  return indicators;
}

function fileStampPht(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  const dayPeriod = (get('dayPeriod') || '').toUpperCase();

  return `${year}-${month}-${day}_${hour}-${minute}-${second}_${dayPeriod}_PHT`;
}

function isValidationEntry(entry) {
  const stepText = String(entry?.step || '').toLowerCase();
  const messageText = String(entry?.message || '').toLowerCase();
  return (
    stepText.includes('validation')
    || stepText.includes('console_http_422')
    || stepText.includes('console_http_400')
    || messageText.startsWith('validation shown:')
    || messageText.startsWith('validation not shown:')
    || messageText.includes('validation-response noise')
  );
}

class RunReporter {
  constructor() {
    this.runId = timestamp();
    this.entries = [];
    this.moduleResults = new Map();
    this.moduleUrls = new Map();

    const runIdIso = normalizeRunIdToIso(this.runId);
    const fileStampSource = runIdIso || new Date().toISOString();
    const fileStamp = fileStampPht(fileStampSource);
    this.csvPath = path.join('artifacts', 'reports', `report-${fileStamp}.csv`);
    this.htmlPath = path.join('artifacts', 'reports', `report-${fileStamp}.html`);

    this.writeSnapshot();
  }

  log({ module, step, status, message }) {
    this.entries.push({
      time: new Date().toISOString(),
      module,
      step,
      status,
      message,
    });

    const previous = this.moduleResults.get(module) || 'PASS';
    const next = status === 'FAIL' ? 'FAIL' : previous;
    this.moduleResults.set(module, next);

    if (step === 'module_url' && message) {
      const directUrl = String(message).replace(/^URL:\s*/i, '').trim();
      if (directUrl) {
        this.moduleUrls.set(module, directUrl);
      }
    }

    if (!this.moduleUrls.has(module) && message) {
      const match = String(message).match(/currentUrl=([^;\s]+)/i);
      if (match && match[1]) {
        this.moduleUrls.set(module, match[1]);
      }
    }

    this.writeSnapshot();

  }

  buildArtifacts(generatedIso, durationMs) {
    const runIdIso = normalizeRunIdToIso(this.runId);
    const runIdPht = runIdIso ? formatPht(runIdIso) : this.runId;
    const generatedPht = formatPht(generatedIso);
    // Format duration
    let durationText = '';
    if (typeof durationMs === 'number' && durationMs > 0) {
      const s = Math.floor(durationMs / 1000) % 60;
      const m = Math.floor(durationMs / 60000) % 60;
      const h = Math.floor(durationMs / 3600000);
      durationText = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
    } else {
      durationText = 'N/A';
    }

    const csvLines = [
      'time,module,step,status,message',
      ...this.entries.map((entry) =>
        [csvTimePht(entry.time), entry.module, entry.step, entry.status, entry.message]
          .map(csvEscape)
          .join(',')
      ),
    ];

    const passCount = this.entries.filter((e) => e.status === 'PASS').length;
    const failCount = this.entries.filter((e) => e.status === 'FAIL').length;
    const infoCount = this.entries.filter((e) => e.status === 'INFO').length;
    const failedModules = [...this.moduleResults.entries()]
      .filter(([, status]) => status === 'FAIL')
      .map(([module]) => module)
      .sort((a, b) => a.localeCompare(b));
    const failedModuleListHtml = failedModules.length > 0
      ? failedModules.map((module) => `<li>${escapeHtml(module)}</li>`).join('')
      : '<li>No failed modules.</li>';

    const summaryRows = [...this.moduleResults.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([module, status]) => {
        const statusClass = status === 'PASS' ? 'status-pass' : status === 'FAIL' ? 'status-fail' : 'status-info';
        const moduleUrl = this.moduleUrls.get(module) || 'N/A';
        const normalizedUrl = moduleUrl === '-' ? 'N/A' : moduleUrl;
        const urlCell = isHttpUrl(normalizedUrl)
          ? `<a class="url-link" href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(normalizedUrl)} <span class="url-link-icon" aria-hidden="true">↗</span></a>`
          : `<span class="na-text">N/A</span>`;
        const actionIndicators = deriveActionIndicators(this.entries, module)
          .map((item) => {
            const chipClass =
              item.status === 'PASS'
                ? 'action-chip-pass'
                : item.status === 'FAIL'
                  ? 'action-chip-fail'
                  : 'action-chip-na';
            return `<span class="action-chip ${chipClass}" title="${escapeHtml(item.reason)}">${escapeHtml(item.label)}: ${escapeHtml(item.status)}</span>`;
          })
          .join('');
        const viewButton = `<button type="button" class="view-actions-btn" data-module="${escapeHtml(module)}">View</button>`;

        return `<tr>
          <td>${escapeHtml(module)}</td>
          <td>${urlCell}</td>
          <td>
            <div class="actions-chips">${actionIndicators}</div>
          </td>
          <td>${viewButton}</td>
          <td><span class="status-chip ${statusClass}">${escapeHtml(status)}</span></td>
        </tr>`;
      });

    const detailRows = this.entries
      .map((e) => {
        const statusClass = e.status === 'PASS' ? 'status-pass' : e.status === 'FAIL' ? 'status-fail' : 'status-info';
        const phtTime = formatPht(e.time);
        const indicator = isValidationEntry(e) ? 'Validation' : 'Standard';
        const indicatorClass = indicator === 'Validation' ? 'entry-kind-validation' : 'entry-kind-standard';
        return `<tr>
          <td>${escapeHtml(`${phtTime} (PHT)`)}</td>
          <td>${escapeHtml(e.module)}</td>
          <td>${escapeHtml(e.step)}</td>
          <td><span class="entry-kind ${indicatorClass}">${escapeHtml(indicator)}</span></td>
          <td><span class="status-chip ${statusClass}">${escapeHtml(e.status)}</span></td>
          <td>${escapeHtml(e.message)}</td>
        </tr>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Portal Automation Report - ${this.runId}</title>
  <style>
    :root {
      --bg: #f6f8fb;
      --panel: #ffffff;
      --line: #e8edf5;
      --text: #1f2937;
      --muted: #6b7280;
      --pass-bg: #e8f7ee;
      --pass-text: #0f7a36;
      --fail-bg: #fdecec;
      --fail-text: #b42318;
      --info-bg: #ebf4ff;
      --info-text: #175cd3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, Segoe UI, Arial, sans-serif;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }
    .title { margin: 0 0 8px; font-size: 24px; }
    .meta { color: var(--muted); font-size: 13px; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .card h3 { margin: 0; font-size: 12px; color: var(--muted); font-weight: 600; }
    .card p { margin: 8px 0 0; font-size: 24px; font-weight: 700; }
    .card-actions {
      margin-top: 10px;
    }
    .card-btn {
      border: 1px solid var(--line);
      background: #fff;
      color: #3f5bd8;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .card-btn:hover { background: #f7f9ff; }
    .card-btn[disabled] {
      cursor: not-allowed;
      color: var(--muted);
      background: #f8fafc;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .fail-panel {
      display: none;
    }
    .fail-panel.show {
      display: block;
    }
    .fail-list {
      margin: 0;
      padding-left: 20px;
    }
    .fail-list li {
      margin: 6px 0;
      font-size: 13px;
    }
    .panel h2 { margin: 8px 8px 12px; font-size: 16px; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 8px 10px;
    }
    .input, .select {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 13px;
      background: #fff;
    }
    .table-wrap { overflow: auto; border-radius: 10px; }
    table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
      min-width: 850px;
      font-size: 13px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      text-align: left;
      padding: 10px 12px;
      vertical-align: top;
      background: #fff;
    }
    #detailsTable td:nth-child(6) {
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 2;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #4b5563;
      cursor: pointer;
      user-select: none;
    }
    th:hover { background: #f9fbff; }
    .status-chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .status-pass { background: var(--pass-bg); color: var(--pass-text); }
    .status-fail { background: var(--fail-bg); color: var(--fail-text); }
    .status-info { background: var(--info-bg); color: var(--info-text); }
    .entry-kind {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .entry-kind-validation { background: #fff4d6; color: #8a5a00; }
    .entry-kind-standard { background: #f2f4f7; color: #475467; }
    .url-link {
      color: #3f5bd8;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .url-link:hover { text-decoration: underline; }
    .url-link-icon { font-size: 12px; line-height: 1; }
    .na-text { color: var(--muted); font-weight: 600; }
    .actions-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .action-chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
    .action-chip-pass { background: var(--pass-bg); color: var(--pass-text); }
    .action-chip-fail { background: var(--fail-bg); color: var(--fail-text); }
    .action-chip-na { background: #f2f4f7; color: #475467; }
    .view-actions-btn {
      border: 1px solid var(--line);
      background: #fff;
      color: #3f5bd8;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .view-actions-btn:hover { background: #f7f9ff; }
    .hint { color: var(--muted); font-size: 12px; padding: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">Portal Automation Report</h1>
      <div class="meta">Run ID: ${runIdPht} (PHT)</div>
      <div class="meta">Generated: ${generatedPht} (PHT)</div>
      <div class="meta">Total Duration: ${durationText}</div>
    </div>

    <div class="cards">
      <div class="card"><h3>Total Steps</h3><p>${this.entries.length}</p></div>
      <div class="card"><h3>PASS</h3><p>${passCount}</p></div>
      <div class="card">
        <h3>FAIL</h3>
        <p>${failCount}</p>
        <div class="card-actions">
          <button id="viewFailModulesBtn" class="card-btn" type="button" ${failCount > 0 ? '' : 'disabled'}>View Failed Modules</button>
        </div>
      </div>
      <div class="card"><h3>INFO</h3><p>${infoCount}</p></div>
      <div class="card"><h3>Modules</h3><p>${this.moduleResults.size}</p></div>
    </div>

    <div id="failedModulesPanel" class="panel fail-panel">
      <h2>Failed Modules</h2>
      <div class="hint">Modules currently marked with FAIL status.</div>
      <ul class="fail-list">${failedModuleListHtml}</ul>
    </div>

    <div class="panel">
      <h2>Module Summary</h2>
      <div class="hint">Click column headers to sort.</div>
      <div class="table-wrap">
        <table data-sortable>
          <thead><tr><th>Module</th><th>URL</th><th>Actions Summary</th><th>Actions</th><th>Status</th></tr></thead>
          <tbody>${summaryRows.join('\n')}</tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h2>Step Details</h2>
      <div class="toolbar">
        <input id="searchInput" class="input" placeholder="Search module/step/message" />
        <select id="statusFilter" class="select">
          <option value="">All Statuses</option>
          <option value="PASS">PASS</option>
          <option value="FAIL">FAIL</option>
          <option value="INFO">INFO</option>
        </select>
      </div>
      <div class="hint">Click any header to sort. Use search/filter to narrow rows.</div>
      <div class="table-wrap">
        <table id="detailsTable" data-sortable>
          <thead><tr><th>Time (PHT)</th><th>Module</th><th>Step</th><th>Indicator</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    (() => {
      function getCellValue(row, colIndex) {
        return (row.children[colIndex]?.innerText || '').trim();
      }

      function makeSortable(table) {
        const headers = table.querySelectorAll('thead th');
        const tbody = table.querySelector('tbody');
        headers.forEach((header, index) => {
          let asc = true;
          header.addEventListener('click', () => {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.sort((a, b) => {
              const va = getCellValue(a, index);
              const vb = getCellValue(b, index);
              return asc ? va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' }) : vb.localeCompare(va, undefined, { numeric: true, sensitivity: 'base' });
            });
            asc = !asc;
            rows.forEach((row) => tbody.appendChild(row));
          });
        });
      }

      document.querySelectorAll('table[data-sortable]').forEach(makeSortable);

      const searchInput = document.getElementById('searchInput');
      const statusFilter = document.getElementById('statusFilter');
      const detailsTable = document.getElementById('detailsTable');
      const rows = Array.from(detailsTable.querySelectorAll('tbody tr'));
      const summaryPanel = document.querySelector('.panel');
      const viewFailModulesBtn = document.getElementById('viewFailModulesBtn');
      const failedModulesPanel = document.getElementById('failedModulesPanel');

      function applyFilters() {
        const query = (searchInput.value || '').toLowerCase();
        const status = statusFilter.value;

        rows.forEach((row) => {
          const text = row.innerText.toLowerCase();
          const rowStatus = getCellValue(row, 4).toUpperCase();
          const matchesSearch = !query || text.includes(query);
          const matchesStatus = !status || rowStatus === status;
          row.style.display = matchesSearch && matchesStatus ? '' : 'none';
        });
      }

      searchInput.addEventListener('input', applyFilters);
      statusFilter.addEventListener('change', applyFilters);

      if (viewFailModulesBtn && failedModulesPanel) {
        viewFailModulesBtn.addEventListener('click', () => {
          statusFilter.value = 'FAIL';
          applyFilters();

          const isShown = failedModulesPanel.classList.contains('show');
          if (isShown) {
            failedModulesPanel.classList.remove('show');
          } else {
            failedModulesPanel.classList.add('show');
          }

          const detailsPanel = detailsTable.closest('.panel');
          if (detailsPanel) {
            detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }

      document.querySelectorAll('.view-actions-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const moduleName = button.getAttribute('data-module') || '';
          searchInput.value = moduleName;
          statusFilter.value = '';
          applyFilters();
          if (summaryPanel) {
            const detailsPanels = document.querySelectorAll('.panel');
            const detailsPanel = detailsPanels[1] || null;
            if (detailsPanel) {
              detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });
      });
    })();
  </script>
</body>
</html>`;

    return {
      csvText: csvLines.join('\n'),
      html,
    };
  }

  pass(module, step, message) {
    this.log({ module, step, status: 'PASS', message });
  }

  info(module, step, message) {
    this.log({ module, step, status: 'INFO', message });
  }

  fail(module, step, message) {
    this.log({ module, step, status: 'FAIL', message });
  }

  validation(module, step, shown, expectedMessage) {
    this.log({
      module,
      step,
      status: shown ? 'PASS' : 'FAIL',
      message: shown ? `Validation shown: ${expectedMessage}` : `Validation not shown: ${expectedMessage}`,
    });
  }

  writeSnapshot() {
    const generatedIso = new Date().toISOString();
    const artifacts = this.buildArtifacts(generatedIso);
    writeFileSafely(this.csvPath, artifacts.csvText);
    writeFileSafely(this.htmlPath, artifacts.html);
  }

  save() {
    this.writeSnapshot();
    // Log total duration in seconds and minutes
    if (this.entries.length > 1) {
      const first = this.entries[0].time;
      const last = this.entries[this.entries.length - 1].time;
      let durationMs = 0;
      try {
        durationMs = new Date(last) - new Date(first);
      } catch {}
      if (durationMs > 0) {
        const seconds = Math.round(durationMs / 1000);
        const minutes = (seconds / 60).toFixed(2);
        console.log(`Total test duration: ${seconds}s (${minutes} min)`);
      }
    }
    return { csvPath: this.csvPath, htmlPath: this.htmlPath, runId: this.runId };
  }
}

module.exports = {
  RunReporter,
};
