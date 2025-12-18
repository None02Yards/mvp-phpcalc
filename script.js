
const expressionInput = document.getElementById('expression');
const resultDiv = document.getElementById('result');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');

let history = [];


function appendExpression(value) {
    expressionInput.value += value;
}

function toggleHistory() {
    historyPanel.classList.toggle('hidden');
}

function resetCalculator() {
    expressionInput.value = '';
    resultDiv.textContent = '';
}

function calculate() {
    const expression = expressionInput.value.trim();

    if (!expression) {
        resultDiv.textContent = 'Error: Expression is empty';
        return;
    }

    // UX feedback
    resultDiv.textContent = 'Calculating...';

    fetch('calculate.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'expression=' + encodeURIComponent(expression)
    })
        .then(response => response.text())
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


function addToHistory(expression, result) {
    const item = {
        expression,
        result
    };

    history.unshift(item);

    // limit history size
    if (history.length > 10) {
        history.pop();
    }

    renderHistory();
}
function renderHistory() {
    historyList.innerHTML = '';

    history.forEach(entry => {
        const li = document.createElement('li');
        li.textContent = `${entry.expression} = ${entry.result}`;

        li.onclick = () => {
            expressionInput.value = entry.expression;
            resultDiv.textContent = 'Result: ' + entry.result;
        };

        historyList.appendChild(li);
    });
}





/*
|--------------------------------------------------------------------------
| Optional: Keyboard support (bonus UX)
|--------------------------------------------------------------------------
*/
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
    }
});

