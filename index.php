<?php
echo "<h1>DEBUG: New index.php loaded!</h1>";
exit;
?>

<!DOCTYPE html>
<html>
<head>
    <title>Grid Style Scientific Calculator</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="grid-calculator">
        <h1>Scientific Calculator</h1>
        <div class="output">
            <input type="text" id="expression" placeholder="Enter expression" readonly>
            <div id="result"></div>
        </div>
        <div class="buttons-grid">
            <button class="btn-function" onclick="appendExpression('(')">(</button>
            <button class="btn-function" onclick="appendExpression(')')">)</button>
            <button class="btn-function" onclick="appendExpression('%')">%</button>
            <button class="btn-operation" onclick="resetCalculator()">AC</button>
            
            <button class="btn-number" onclick="appendExpression('7')">7</button>
            <button class="btn-number" onclick="appendExpression('8')">8</button>
            <button class="btn-number" onclick="appendExpression('9')">9</button>
            <button class="btn-operation" onclick="appendExpression('/')">÷</button>
            
            <button class="btn-number" onclick="appendExpression('4')">4</button>
            <button class="btn-number" onclick="appendExpression('5')">5</button>
            <button class="btn-number" onclick="appendExpression('6')">6</button>
            <button class="btn-operation" onclick="appendExpression('*')">×</button>
            
            <button class="btn-number" onclick="appendExpression('1')">1</button>
            <button class="btn-number" onclick="appendExpression('2')">2</button>
            <button class="btn-number" onclick="appendExpression('3')">3</button>
            <button class="btn-operation" onclick="appendExpression('-')">−</button>
            
            <button class="btn-number" onclick="appendExpression('0')">0</button>
            <button class="btn-number" onclick="appendExpression('.')">.</button>
            <button class="btn-operation" onclick="calculate()">=</button>
            <button class="btn-operation" onclick="appendExpression('+')">+</button>
            
            <button class="btn-function" onclick="appendExpression('sin(')">sin</button>
            <button class="btn-function" onclick="appendExpression('cos(')">cos</button>
            <button class="btn-function" onclick="appendExpression('tan(')">tan</button>
            <button class="btn-function" onclick="appendExpression('sqrt(')">√</button>
            
            <button class="btn-function" onclick="appendExpression('^')">xⁿ</button>
            <button class="btn-function" onclick="appendExpression('log(')">log</button>
            <button class="btn-function" onclick="appendExpression('π')">π</button>
            <button class="btn-function" onclick="appendExpression('e')">e</button>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>