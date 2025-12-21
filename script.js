// Updated frontend script for the PHP calculator
// Changes since last version:
// - Extra normalization and ASCII fallback (π -> pi, replace unicode operators).
// - Local tokenization check to catch "Empty expression after tokenization" before sending.
// - Use FormData for POST (avoids urlencoded edge-cases with plus signs).
// - Automatic retry with ASCII-only expression if server responds with tokenization error.
// - Better user guidance when tokenization still fails.
//
// Keep HISTORY, export/import, debounce, keyboard support, etc.

const expressionInput = document.getElementById('expression');
const resultDiv = document.getElementById('result');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const confirmOverlay = document.getElementById('confirm-overlay');

const angleSelect = document.getElementById('angle-select'); // optional
const precisionInput = document.getElementById('precision-input'); // optional
const formatSelect = document.getElementById('format-select'); // optional

const calcButton = document.getElementById('calc-button');
const copyButton = document.getElementById('copy-button');
const exportButton = document.getElementById('export-button');
const importInput = document.getElementById('import-input');

const HISTORY_KEY = 'calc_history';
const HISTORY_LIMIT = 20;
const DEBOUNCE_MS = 500;

// endpoint - change if your backend filename differs (calculate.php / calculator.php)
const ENDPOINT = 'calculate.php';

// Debug flag - set true to show extra debug info in UI (do not enable in production)
const DEBUG_SHOW_PAYLOAD = false;

let history = loadHistory();
let debounceTimer = null;

// Utility: escape HTML to avoid XSS when injecting text
function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Map single Unicode button input to ASCII when inserting from buttons
function mapInsertedSymbol(raw) {
    if (!raw) return raw;
    const map = {
        '×': '*',
        '✕': '*',
        '✖': '*',
        '\u00D7': '*',
        '÷': '/',
        '∕': '/',
        '\u00F7': '/',
        '−': '-', // minus sign
        '–': '-', // en dash
        '—': '-', // em dash
        // Keep π glyph by default (server handles it), but we also provide ascii fallback later
        'π': 'π'
    };
    return map[raw] ?? raw;
}

function appendExpression(value) {
    if (!expressionInput) return;
    const mapped = mapInsertedSymbol(value);
    const el = expressionInput;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    el.value = before + mapped + after;
    const caret = start + mapped.length;
    el.setSelectionRange(caret, caret);
    el.focus();
}

function resetCalculator() {
    if (expressionInput) expressionInput.value = '';
    if (resultDiv) {
        resultDiv.textContent = '';
        resultDiv.className = '';
    }
}

function toggleHistory() {
    if (!historyPanel) return;
    historyPanel.classList.toggle('hidden');
}

function clearHistory() {
    if (!confirmOverlay) return;
    confirmOverlay.classList.remove('hidden');
}

function confirmClearHistory() {
    history = [];
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    closeConfirm();
}

function closeConfirm() {
    if (!confirmOverlay) return;
    confirmOverlay.classList.add('hidden');
}

function addToHistory(expression, result, source = 'local') {
    if (!expression && !result) return;
    if (history.length > 0 && history[0].expression === expression && history[0].result === result) {
        return;
    }
    history.unshift({
        expression: expression,
        result: result,
        ts: new Date().toISOString(),
        source
    });
    if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
    saveHistory();
    renderHistory();
}

function mergeServerHistory(serverHistory = []) {
    if (!Array.isArray(serverHistory) || serverHistory.length === 0) return;
    for (const it of serverHistory) {
        const expression = it.expression ?? it.expr ?? '';
        const result = (typeof it.result !== 'undefined') ? String(it.result) : '';
        if (!expression) continue;
        if (history.some(h => h.expression === expression && h.result === result)) continue;
        history.push({ expression, result, ts: it.timestamp ?? it.ts ?? new Date().toISOString(), source: 'server' });
    }
    history.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    history.length = Math.min(history.length, HISTORY_LIMIT);
    saveHistory();
    renderHistory();
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    if (history.length === 0) {
        const li = document.createElement('li');
        li.style.opacity = '.6';
        li.textContent = 'No history yet';
        historyList.appendChild(li);
        return;
    }
    history.forEach(item => {
        const li = document.createElement('li');
        const ts = item.ts ? ` (${new Date(item.ts).toLocaleString()})` : '';
        li.innerHTML = `<strong>${escapeHtml(item.expression)}</strong> = <span class="hist-result">${escapeHtml(String(item.result))}</span><small class="muted">${escapeHtml(ts)}</small>`;
        li.addEventListener('click', () => {
            if (expressionInput) expressionInput.value = item.expression;
            if (resultDiv) resultDiv.textContent = 'Result: ' + item.result;
        });
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            copyToClipboard(item.expression);
        });
        historyList.appendChild(li);
    });
}

function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save history', e);
    }
}

function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch (e) {
        return [];
    }
}

function copyToClipboard(text) {
    if (!text) return;
    if (!navigator.clipboard) {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        tmp.style.position = 'fixed';
        tmp.style.left = '-9999px';
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(tmp);
        return;
    }
    navigator.clipboard.writeText(text).catch(console.error);
}

function getFormOptions() {
    const angle = angleSelect ? (angleSelect.value === 'rad' ? 'rad' : 'deg') : 'deg';
    const precision = precisionInput && precisionInput.value !== '' ? String(Number(precisionInput.value)) : '';
    const format = formatSelect ? (formatSelect.value === 'plain' ? 'plain' : 'json') : 'json';
    return { angle, precision, format };
}

function showLoading() {
    if (!resultDiv) return;
    resultDiv.textContent = 'Calculating...';
    resultDiv.className = 'loading';
}

function showError(msg, detail = '') {
    if (!resultDiv) return;
    // Keep message readable; detail may contain multiple lines.
    resultDiv.innerHTML = `<span class="error">Error: ${escapeHtml(String(msg))}</span>` +
        (detail ? `<div class="error-detail" style="white-space:pre-wrap;margin-top:.4rem">${escapeHtml(String(detail))}</div>` : '');
    resultDiv.classList.remove('loading');
    resultDiv.classList.add('error');
}

function showResult(res) {
    if (!resultDiv) return;
    resultDiv.textContent = 'Result: ' + res;
    resultDiv.classList.remove('loading', 'error');
    resultDiv.classList.add('success');
}

// Normalize expression: replace common Unicode glyphs with ASCII equivalents,
// remove invisible characters, collapse spaces. Keep π glyph by default.
function normalizeExpressionForServer(rawExpr) {
    if (rawExpr == null) return '';
    let s = String(rawExpr);
    // Replace non-breaking space and other space-like chars with regular space
    s = s.replace(/\u00A0/g, ' ');
    // Replace multiplication/division glyphs with ASCII
    s = s.replace(/[×✕✖\u00D7]/g, '*');
    s = s.replace(/[÷∕\u00F7]/g, '/');
    // Normalize dashes/minus to hyphen-minus
    s = s.replace(/[–—−]/g, '-');
    // Replace fancy plus (rare) with normal plus
    s = s.replace(/[＋]/g, '+');
    // Remove zero-width and control characters that may break the tokenizer
    s = s.replace(/[\u200B-\u200F\uFEFF\u2060-\u206F]/g, '');
    // Collapse whitespace
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

// Create an ASCII-only fallback expression (replace π->pi and e.g. unicode digits)
function asciiFallbackExpression(expr) {
    if (expr == null) return '';
    let s = String(expr);
    // Replace pi glyph with ascii 'pi'
    s = s.replace(/π/g, 'pi').replace(/\bPI\b/gi, 'pi');
    // Replace unicode fullwidth digits/operators with ascii equivalents
    // (common UTF-8 fullwidth range: 0xFF10-FF5E)
    s = s.replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 48));
    s = s.replace(/[\uFF0B]/g, '+').replace(/[\uFF0D]/g, '-').replace(/[\uFF0A]/g, '*').replace(/[\uFF0F]/g, '/');
    // Ensure percent sign is ASCII %
    s = s.replace(/％/g, '%');
    // Remove any remaining zero-width characters
    s = s.replace(/[\u200B-\u200F\uFEFF]/g, '');
    return s;
}

// Local tokenization check (simple) to approximate server tokenization.
// Returns array of tokens or empty array if nothing matched.
function localTokenize(expr) {
    if (!expr) return [];
    // We'll use the same token patterns as the server but in JS.
    // number: 123, 3.14, .5
    // identifier: letters + digits + underscore
    // operators: + - * / ^ % ( ) , 
    const tokenPattern = /(\d+(\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|([+\-*\/\^%\(\),])/g;
    const tokens = [];
    let m;
    while ((m = tokenPattern.exec(expr)) !== null) {
        tokens.push(m[0]);
    }
    return tokens;
}

// Debug helper: show payload in UI if debug flag is enabled
function debugShowPayload(msg) {
    if (!DEBUG_SHOW_PAYLOAD || !resultDiv) return;
    const pre = document.createElement('pre');
    pre.style.fontSize = '0.8em';
    pre.style.opacity = '0.9';
    pre.textContent = String(msg);
    resultDiv.appendChild(pre);
}

// Main calculate function with retry-on-tokenization-error
async function calculate() {
    if (!expressionInput) return;
    const originalExpr = expressionInput.value || '';
    const normalizedExpr = normalizeExpressionForServer(originalExpr);
    const asciiExpr = asciiFallbackExpression(normalizedExpr);

    // Local tokenization check. If local tokens are empty, show helpful message and don't send.
    const localTokens = localTokenize(normalizedExpr);
    if (localTokens.length === 0) {
        showError('Expression seems invalid or empty after normalization.',
            `Normalized expression: "${normalizedExpr || '(empty)'}"\n` +
            'Local tokenizer found no tokens. Common causes:\n' +
            '• Non-ASCII operators (×, ÷) or invisible characters\n' +
            '• Using an unsupported symbol or comma as decimal separator\n\n' +
            'Suggestions:\n' +
            '• Replace × with * and ÷ with /\n' +
            '• Remove invisible characters (copy/paste into a plain text editor first)\n' +
            '• Try this ASCII fallback expression: ' + (asciiExpr || '(empty)')
        );
        return;
    }

    showLoading();

    const opts = getFormOptions();

    // Use FormData to avoid potential urlencoded pitfalls with plus signs and encoding.
    const form = new FormData();
    form.append('expression', normalizedExpr);
    form.append('client_expr_raw', originalExpr); // extra for server diagnostics (optional)
    form.append('client_expr_ascii', asciiExpr);
    if (opts.angle) form.append('angle', opts.angle);
    if (opts.precision) form.append('precision', opts.precision);
    if (opts.format) form.append('format', opts.format);
    // Ask server to echo back raw expression when returning tokenization error (optional)
    form.append('client_debug', '1');

    // Debug log
    if (console && console.info) {
        console.info('Calculator request ->', {
            endpoint: ENDPOINT,
            expression_sent: normalizedExpr,
            ascii_fallback: asciiExpr,
            original_expression: originalExpr
        });
    }
    debugShowPayload(`Normalized: ${normalizedExpr}\nASCII fallback: ${asciiExpr}`);

    // helper to POST form and parse response
    async function postForm(formData) {
        const resp = await fetch(ENDPOINT, {
            method: 'POST',
            body: formData
        });
        const text = await resp.text();
        const ct = resp.headers.get('content-type') || '';
        let data = text;
        try {
            if (ct.includes('application/json')) data = JSON.parse(text);
            else {
                // try parse anyway if looks like JSON
                if (/^\s*[{\[]/.test(text)) data = JSON.parse(text);
            }
        } catch (e) {
            // keep raw text
        }
        return { ok: resp.ok, status: resp.status, data, rawText: text };
    }

    // First attempt: normalized expression
    try {
        let attempt = 0;
        let maxAttempts = 2;
        let lastError = null;
        while (attempt < maxAttempts) {
            const useAscii = (attempt === 1); // second attempt uses ascii fallback
            const payload = new FormData();
            payload.append('expression', useAscii ? asciiExpr : normalizedExpr);
            payload.append('client_expr_raw', originalExpr);
            payload.append('client_expr_ascii', asciiExpr);
            if (opts.angle) payload.append('angle', opts.angle);
            if (opts.precision) payload.append('precision', opts.precision);
            if (opts.format) payload.append('format', opts.format);
            payload.append('client_debug', '1');

            const { ok, status, data, rawText } = await postForm(payload);

            if (!ok) {
                // server returned HTTP error; check JSON shape
                if (data && typeof data === 'object' && data.error) {
                    const serverError = String(data.error);
                    lastError = { serverError, data, rawText, status };
                    // If server indicates tokenization/empty tokens, retry with ascii fallback if not already used
                    if ((/tokenization/i.test(serverError) || /Empty expression after tokenization/i.test(serverError)) && attempt === 0) {
                        attempt++;
                        continue; // retry with ascii
                    }
                    // Not a tokenization-related error or already retried: show helpful message
                    const serverRaw = data.raw ?? data.raw_expression ?? data.rawExpr ?? data.client_expr_raw ?? null;
                    const detailParts = [];
                    if (serverRaw) detailParts.push(`Server received: ${serverRaw}`);
                    detailParts.push('Common culprits: non-ASCII operators (×, ÷), non-breaking spaces, or invisible characters.');
                    detailParts.push('Normalized expression we sent: ' + (useAscii ? asciiExpr : normalizedExpr));
                    showError(serverError, detailParts.join('\n'));
                    return;
                } else {
                    // unknown error text
                    showError(`Server returned HTTP ${status}`, typeof data === 'string' ? data : JSON.stringify(data));
                    return;
                }
            }

            // OK response (200-level). Inspect body
            if (data && typeof data === 'object') {
                if (data.error) {
                    const serverError = String(data.error);
                    lastError = { serverError, data, rawText, status };
                    if ((/tokenization/i.test(serverError) || /Empty expression after tokenization/i.test(serverError)) && attempt === 0) {
                        attempt++;
                        continue; // retry with ascii fallback
                    }
                    const serverRaw = data.raw ?? data.raw_expression ?? data.rawExpr ?? data.client_expr_raw ?? null;
                    const detailParts = [];
                    if (serverRaw) detailParts.push(`Server received: ${serverRaw}`);
                    detailParts.push('Normalized expression we sent: ' + (useAscii ? asciiExpr : normalizedExpr));
                    showError(serverError, detailParts.join('\n'));
                    return;
                }

                // success: data.result expected
                const result = typeof data.result !== 'undefined' ? data.result : (data.res ?? null);
                if (result === null || typeof result === 'undefined') {
                    showError('Unexpected server response', JSON.stringify(data));
                    return;
                }
                showResult(result);
                addToHistory(originalExpr, result);
                if (data.history) mergeServerHistory(data.history);
                if (data.rpn && console && console.info) console.info('RPN (server):', data.rpn);
                return;
            }

            // plain text response
            if (typeof data === 'string') {
                const txt = data.trim();
                if (/error/i.test(txt)) {
                    lastError = { serverError: txt, data, rawText };
                    if ((/tokenization/i.test(txt) || /Empty expression after tokenization/i.test(txt)) && attempt === 0) {
                        attempt++;
                        continue; // retry with ascii
                    }
                    showError(txt, `Normalized expression: ${useAscii ? asciiExpr : normalizedExpr}`);
                    return;
                }
                // success plain text result
                showResult(txt);
                addToHistory(originalExpr, txt);
                return;
            }

            // fallback unknown
            showError('Unexpected server response', String(rawText || JSON.stringify(data)));
            return;
        } // end attempts loop

        // If we exit loop with no successful result
        if (lastError) {
            const se = lastError.serverError || 'Unknown error';
            showError(se, 'All automatic retries failed. Try editing the expression and use ASCII operators (*, /) and digits.');
            return;
        } else {
            showError('Calculation failed', 'No response from server');
        }
    } catch (err) {
        console.error('Fetch/processing error', err);
        showError('Network or processing error', err && err.message ? err.message : String(err));
    }
}

// Debounced calculate while typing (optional)
function scheduleCalculate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        calculate();
    }, DEBOUNCE_MS);
}

// Export history to JSON file
function exportHistory() {
    try {
        const dataStr = JSON.stringify(history, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'calc_history.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export failed', e);
    }
}

// Import history JSON file (replace or merge)
function importHistoryFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!Array.isArray(data)) throw new Error('Invalid file format (expected array)');
            for (const it of data) {
                if (!it.expression || typeof it.result === 'undefined') continue;
                if (!history.some(h => h.expression === it.expression && h.result == it.result)) {
                    history.push({ expression: it.expression, result: String(it.result), ts: it.ts || new Date().toISOString(), source: 'import' });
                }
            }
            history.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
            history.length = Math.min(history.length, HISTORY_LIMIT);
            saveHistory();
            renderHistory();
        } catch (e) {
            alert('Import failed: ' + (e.message || e));
        }
    };
    reader.readAsText(file);
}

// Keyboard handling
document.addEventListener('keydown', function (e) {
    const active = document.activeElement;
    const typingInField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

    const quickKeys = '0123456789+-*/().^%';
    if (quickKeys.includes(e.key) && document.activeElement !== expressionInput) {
        if (expressionInput) {
            expressionInput.focus();
            appendExpression(e.key);
            e.preventDefault();
        }
    }

    if (!typingInField && expressionInput) {
        if (e.key === 'Enter') {
            e.preventDefault();
            calculate();
            return;
        }
        if (e.key === 'Backspace') {
            expressionInput.value = expressionInput.value.slice(0, -1);
            return;
        }
        if (e.key === 'Escape') {
            resetCalculator();
            closeConfirm();
            return;
        }
    } else if (typingInField && expressionInput) {
        if (e.key === 'Enter') {
            e.preventDefault();
            calculate();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (expressionInput.tagName !== 'TEXTAREA') {
                e.preventDefault();
                calculate();
            }
            return;
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            const allowedForLive = /[0-9+\-*/^()%.,eπpiea-zA-Z()]/;
            if (allowedForLive.test(e.key)) {
                scheduleCalculate();
            }
        }
    }

    // Ctrl/Cmd+C copy result quickly
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (resultDiv && resultDiv.textContent && resultDiv.textContent.startsWith('Result:')) {
            const txt = resultDiv.textContent.replace(/^Result:\s*/, '');
            copyToClipboard(txt);
        }
    }
});

// Attach button handlers if present
if (calcButton) calcButton.addEventListener('click', (e) => { e.preventDefault(); calculate(); });
if (copyButton) copyButton.addEventListener('click', () => {
    if (!resultDiv) return;
    const txt = resultDiv.textContent.replace(/^Result:\s*/, '') || '';
    if (txt) copyToClipboard(txt);
});
if (exportButton) exportButton.addEventListener('click', exportHistory);
if (importInput) importInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importHistoryFile(f);
});

// Double-click history to append expression
if (historyList) historyList.addEventListener('dblclick', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const exprStrong = li.querySelector('strong');
    if (exprStrong && expressionInput) {
        appendExpression(' ' + exprStrong.textContent);
    }
});

// Initial render
renderHistory();