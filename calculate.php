<!-- calculate.php -->
<?php

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Invalid request method');
}

if (!isset($_POST['expression'])) {
    http_response_code(400);
    exit('No expression received');
}

$expression = $_POST['expression'];

/*
|--------------------------------------------------------------------------
| Normalize expression
|--------------------------------------------------------------------------
*/

// Constants
$expression = str_replace(
    ['π', 'e'],
    [M_PI, M_E],
    $expression
);

// Power operator
$expression = str_replace('^', '**', $expression);

// Whitelist characters & functions
$allowedPattern = '/^[0-9+\-*/().,%\s**M_PIEMacosintanlogqrt]+$/';

if (!preg_match($allowedPattern, $expression)) {
    exit('Invalid characters in expression');
}

/*
|--------------------------------------------------------------------------
| Safe evaluation
|--------------------------------------------------------------------------
*/
function safeEval($expr) {
    try {
        ob_start();
        $result = eval("return $expr;");
        ob_end_clean();
        return $result;
    } catch (Throwable $e) {
        return null;
    }
}

$result = safeEval($expression);

if ($result === null || is_nan($result) || is_infinite($result)) {
    exit('Calculation error');
}

echo $result;
