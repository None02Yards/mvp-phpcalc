const expressionInput = document.getElementById('expression');
const resultDiv = document.getElementById('result');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const confirmOverlay = document.getElementById('confirm-overlay');

const HISTORY_KEY = 'calc_history';
const HISTORY_LIMIT = 10;

let history = loadHistory();


function appendExpression(value) {
    expressionInput.value += value;
}

function resetCalculator() {
    expressionInput.value = '';
    resultDiv.textContent = '';
}


function toggleHistory() {
    historyPanel.classList.toggle('hidden');
}

function clearHistory() {
    confirmOverlay.classList.remove('hidden');
}

function confirmClearHistory() {
    history = [];
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    closeConfirm();
}

function closeConfirm() {
    confirmOverlay.classList.add('hidden');
}

function addToHistory(expression, result) {
    history.unshift({ expression, result });

    if (history.length > HISTORY_LIMIT) {
        history.pop();
    }

    saveHistory();
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';

    if (history.length === 0) {
        historyList.innerHTML = '<li style="opacity:.6">No history yet</li>';
        return;
    }

    history.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.expression} = ${item.result}`;

        li.onclick = () => {
            expressionInput.value = item.expression;
            resultDiv.textContent = 'Result: ' + item.result;
        };

        historyList.appendChild(li);
    });
}

function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}


function calculate() {
    const expression = expressionInput.value.trim();

    if (!expression) {
        resultDiv.textContent = 'Error: Expression is empty';
        return;
    }

    resultDiv.textContent = 'Calculating...';

    fetch('calculate.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'expression=' + encodeURIComponent(expression)
    })
        .then(res => res.text())
        .then(result => {
            if (!result || result.toLowerCase().includes('error')) {
                resultDiv.textContent = 'Error evaluating expression';
                return;
            }

            resultDiv.textContent = 'Result: ' + result;
            addToHistory(expression, result);
        })
        .catch(() => {
            resultDiv.textContent = 'Server error';
        });
}


document.addEventListener('keydown', function (e) {
    const allowedKeys = '0123456789+-*/().';

    if (allowedKeys.includes(e.key)) {
        appendExpression(e.key);
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        calculate();
    }

    if (e.key === 'Backspace') {
        expressionInput.value = expressionInput.value.slice(0, -1);
    }

    if (e.key === 'Escape') {
        resetCalculator();
        closeConfirm();
    }
});


renderHistory();
