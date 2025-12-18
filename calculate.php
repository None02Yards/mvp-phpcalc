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


$expression = str_replace(
    ['π', 'e'],
    [M_PI, M_E],
    $expression
);


$expression = str_replace('^', '**', $expression);

$expression = preg_replace_callback(
    '/\b(sin|cos|tan)\(([^()]*)\)/i',
    fn($m) => "{$m[1]}(({$m[2]})*pi()/180)",
    $expression
);


if (!preg_match('/^[0-9+\-\*\/().,\s%piEMacosintanlogqrt]+$/i', $expression)) {
    exit('Invalid characters in expression');
}

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
