<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Grid Style Scientific Calculator</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="grid-calculator">
        <h1>Scientific Calculator</h1>

        <div class="controls">
            <label for="angle-select">Angle:</label>
            <select id="angle-select" aria-label="Angle units">
                <option value="deg" selected>deg</option>
                <option value="rad">rad</option>
            </select>

            <label for="precision-input">Precision:</label>
            <input id="precision-input" type="number" min="0" max="12" step="1" placeholder="auto" aria-label="Result precision">

            <label for="format-select">Format:</label>
            <select id="format-select" aria-label="Response format">
                <option value="json" selected>json</option>
                <option value="plain">plain</option>
            </select>

            <button id="copy-button" type="button" title="Copy result">Copy</button>
            <button id="export-button" type="button" title="Export history">Export</button>
            <input id="import-input" type="file" accept="application/json" style="display:inline-block" title="Import history">
        </div>

        <div class="output">
            <!-- make input editable so users can type -->
            <input type="text" id="expression" placeholder="Enter expression" aria-label="Expression">
            <div id="result" aria-live="polite"></div>
        </div>

        <div class="buttons-grid" role="group" aria-label="Calculator buttons">
            <button class="btn-function" type="button" onclick="appendExpression('(')">(</button>
            <button class="btn-function" type="button" onclick="appendExpression(')')">)</button>
            <button class="btn-function" type="button" onclick="appendExpression('%')">%</button>
            <button class="btn-operation" type="button" onclick="resetCalculator()">AC</button>
            <button class="btn-operation" type="button" onclick="toggleHistory()">History</button>

            <button class="btn-number" type="button" onclick="appendExpression('7')">7</button>
            <button class="btn-number" type="button" onclick="appendExpression('8')">8</button>
            <button class="btn-number" type="button" onclick="appendExpression('9')">9</button>
            <button class="btn-operation" type="button" onclick="appendExpression('/')">÷</button>
            
            <button class="btn-number" type="button" onclick="appendExpression('4')">4</button>
            <button class="btn-number" type="button" onclick="appendExpression('5')">5</button>
            <button class="btn-number" type="button" onclick="appendExpression('6')">6</button>
            <button class="btn-operation" type="button" onclick="appendExpression('*')">×</button>
            
            <button class="btn-number" type="button" onclick="appendExpression('1')">1</button>
            <button class="btn-number" type="button" onclick="appendExpression('2')">2</button>
            <button class="btn-number" type="button" onclick="appendExpression('3')">3</button>
            <button class="btn-operation" type="button" onclick="appendExpression('-')">−</button>
            
            <button class="btn-number" type="button" onclick="appendExpression('0')">0</button>
            <button class="btn-number" type="button" onclick="appendExpression('.')">.</button>
            <!-- Add id so JS can bind handler -->
            <button id="calc-button" class="btn-operation" type="button" onclick="calculate()">=</button>
            <button class="btn-operation" type="button" onclick="appendExpression('+')">+</button>
            
            <button class="btn-function" type="button" onclick="appendExpression('sin(')">sin</button>
            <button class="btn-function" type="button" onclick="appendExpression('cos(')">cos</button>
            <button class="btn-function" type="button" onclick="appendExpression('tan(')">tan</button>
            <button class="btn-function" type="button" onclick="appendExpression('sqrt(')">√</button>
            
            <button class="btn-function" type="button" onclick="appendExpression('^')">xⁿ</button>
            <button class="btn-function" type="button" onclick="appendExpression('log(')">log</button>
            <button class="btn-function" type="button" onclick="appendExpression('π')">π</button>
            <button class="btn-function" type="button" onclick="appendExpression('e')">e</button>
        </div>
    </div>

    <div id="history-panel" class="history hidden" aria-hidden="true">
        <h3>History</h3>

        <button class="history-clear-btn" type="button" onclick="clearHistory()">
            Clear History
        </button>

        <ul id="history-list" role="list"></ul>
    </div>

    <div id="confirm-overlay" class="confirm-overlay hidden" aria-hidden="true">
        <div class="confirm-box">
            <p>Clear all history?</p>
            <div class="confirm-actions">
                <button class="confirm-cancel" type="button" onclick="closeConfirm()">Cancel</button>
                <button class="confirm-ok" type="button" onclick="confirmClearHistory()">Clear</button>
            </div>
        </div>
    </div>

    <!-- Ensure this file name matches your front-end JS file (script.js or calculator.js) -->
    <script src="script.js"></script>
</body>
</html>