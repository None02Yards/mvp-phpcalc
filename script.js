// // Initialize an empty expression
// let expressionField = document.getElementById('expression');
// let resultField = document.getElementById('result');

// // Append to the expression
// function appendExpression(value) {
//     expressionField.value += value;
// }

// // Reset the calculator
// function resetCalculator() {
//     expressionField.value = '';
//     resultField.textContent = '';
// }

// // Perform the calculation
// function calculate() {
//     try {
//         // Extend Math functionalities
//         const extendedMath = {
//             sin: Math.sin,
//             cos: Math.cos,
//             tan: Math.tan,
//             sqrt: Math.sqrt,
//             log: Math.log,
//             pi: Math.PI,
//             e: Math.E,
//             "^": (base, exp) => Math.pow(base, exp),
//         };

//         // Securely evaluate the expression
//         const safeEval = new Function('Math', `return (${expressionField.value});`);
//         const result = safeEval(extendedMath);
//         resultField.textContent = `Result: ${result}`;
//     } catch (error) {
//         resultField.textContent = 'Error: Invalid Expression';
//     }
// }


const expressionInput = document.getElementById('expression');
const resultDiv = document.getElementById('result');

/*
|--------------------------------------------------------------------------
| Append characters / functions to expression
|--------------------------------------------------------------------------
*/
function appendExpression(value) {
    expressionInput.value += value;
}

/*
|--------------------------------------------------------------------------
| Reset calculator
|--------------------------------------------------------------------------
*/
function resetCalculator() {
    expressionInput.value = '';
    resultDiv.textContent = '';
}

/*
|--------------------------------------------------------------------------
| Calculate expression (server-side)
|--------------------------------------------------------------------------
*/
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
        })
        .catch(() => {
            resultDiv.textContent = 'Server error';
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

