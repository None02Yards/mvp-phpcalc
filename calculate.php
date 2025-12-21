<?php
// calculate.php
// Enhanced calculator MVP: safe parsing & evaluation, functions, constants, history, JSON output.
//
// POST parameters:
// - expression: required, the math expression
// - angle: optional, "deg" (default) or "rad"
// - precision: optional integer for number_format rounding
// - format: optional, "json" (default) or "plain"
//
// Example:
// curl -d "expression=sin(30)+2^3&angle=deg&precision=4" http://example.com/calculator.php

declare(strict_types=1);

session_start();

// Helper: send JSON error and exit
function errorResponse(string $message, int $httpCode = 400, array $extra = []): void {
    http_response_code($httpCode);
    $payload = array_merge(['error' => $message], $extra);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Invalid request method', 405);
}
// ---- unified input handling (FormData | JSON | urlencoded) ----
$input = $_POST;

if (empty($input)) {
    $raw = file_get_contents('php://input');
    if ($raw !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $input = $json;
        }
    }
}

$rawExpr = trim((string)($input['expression'] ?? ''));

if ($rawExpr === '') {
    errorResponse('No expression received', 400, [
        'post' => $_POST,
        'input_hex' => bin2hex(file_get_contents('php://input'))
    ]);
}


$rawExpr = (string) $_POST['expression'];

// Normalize BEFORE validation
$rawExpr = preg_replace('/[\x{200B}-\x{200F}\x{FEFF}\x{2060}-\x{206F}]/u', '', $rawExpr);
$rawExpr = str_replace("\xC2\xA0", ' ', $rawExpr); // non-breaking space
$rawExpr = trim($rawExpr);


$angleUnit = isset($_POST['angle']) && strtolower($_POST['angle']) === 'rad' ? 'rad' : 'deg';
$precision = isset($_POST['precision']) ? intval($_POST['precision']) : null;
$format = isset($_POST['format']) && strtolower($_POST['format']) === 'plain' ? 'plain' : 'json';

$expr = str_replace(['π', 'PI', 'Pi'], ['pi', 'pi', 'pi'], $rawExpr);
$expr = str_replace('e', 'e', $expr); // leave 'e' as identifier (will be interpreted as constant)

// Tokenization
function tokenize(string $s): array {
    $s = trim($s);
    if ($s === '') return [];

    $pattern = '/\G\s*(
        \d+(?:\.\d+)?|\.\d+        # number
        |[A-Za-z_][A-Za-z0-9_]*    # identifier
        |[\+\-\*\/\^\%\(\),]       # operators
    )/x';

    $tokens = [];
    $offset = 0;
    $len = strlen($s);

    while ($offset < $len) {
        if (!preg_match($pattern, $s, $m, 0, $offset)) {
            throw new RuntimeException(
                'Invalid character at offset ' . $offset .
                ' (hex: ' . bin2hex($s[$offset]) . ')'
            );
        }
        $tokens[] = $m[1];
        $offset += strlen($m[0]);
    }

    return $tokens;
}




// Operator metadata
$ops = [
    '+' => ['prec' => 2, 'assoc' => 'L', 'argCount' => 2],
    '-' => ['prec' => 2, 'assoc' => 'L', 'argCount' => 2],
    '*' => ['prec' => 3, 'assoc' => 'L', 'argCount' => 2],
    '/' => ['prec' => 3, 'assoc' => 'L', 'argCount' => 2],
    '^' => ['prec' => 4, 'assoc' => 'R', 'argCount' => 2],
    'u-' => ['prec' => 5, 'assoc' => 'R', 'argCount' => 1], // unary minus
    '%' => ['prec' => 6, 'assoc' => 'L', 'argCount' => 1], // postfix percent
];

// Allowed functions -> map to internal names
$functions = [
    'sin' => 1,
    'cos' => 1,
    'tan' => 1,
    'asin' => 1,
    'acos' => 1,
    'atan' => 1,
    'log' => 1,  // base 10
    'ln'  => 1,  // natural log
    'sqrt' => 1,
    'abs' => 1,
    'pow' => 2,
];

// Allowed constants
$constants = [
    'pi' => M_PI,
    'e'  => M_E,
];

// Shunting-yard: convert infix tokens to RPN
function toRPN(array $tokens, array $ops, array $functions): array {
    $output = [];
    $stack = [];
    $prevToken = null;

    foreach ($tokens as $token) {
        // number
        if (preg_match('/^\d+(\.\d+)?$|^\.\d+$/', $token)) {
            $output[] = $token;
            $prevToken = 'number';
            continue;
        }

        // identifier: function or constant
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $token)) {
            $low = strtolower($token);
            if (array_key_exists($low, $functions)) {
                // function token
                $stack[] = $low;
            } else {
                // treat as constant/variable
                $output[] = $low;
            }
            $prevToken = 'ident';
            continue;
        }

        // left paren
        if ($token === '(') {
            $stack[] = $token;
            $prevToken = '(';
            continue;
        }

        // right paren
        if ($token === ')') {
            while (!empty($stack) && end($stack) !== '(') {
                $output[] = array_pop($stack);
            }
            if (empty($stack)) {
                throw new RuntimeException('Mismatched parentheses');
            }
            array_pop($stack); // pop '('
            // if top of stack is a function, pop it to output
            if (!empty($stack) && is_string(end($stack)) && array_key_exists(strtolower(end($stack)), $functions)) {
                $output[] = array_pop($stack);
            }
            $prevToken = ')';
            continue;
        }

        // comma (function argument separator)
        if ($token === ',') {
            while (!empty($stack) && end($stack) !== '(') {
                $output[] = array_pop($stack);
            }
            if (empty($stack)) {
                throw new RuntimeException('Misplaced comma or mismatched parentheses');
            }
            $prevToken = ',';
            continue;
        }

        // operators
        if (in_array($token, array('+','-','*','/','^','%'), true)) {
            // detect unary minus
            if ($token === '-' && ($prevToken === null || in_array($prevToken, ['(', ',', 'operator']))) {
                $token = 'u-';
            }
            $o1 = $token;
            while (!empty($stack)) {
                $o2 = end($stack);
                if (array_key_exists($o2, $ops)) {
                    $p1 = $ops[$o1]['prec'];
                    $p2 = $ops[$o2]['prec'];
                    if (
                        ($ops[$o1]['assoc'] === 'L' && $p1 <= $p2) ||
                        ($ops[$o1]['assoc'] === 'R' && $p1 < $p2)
                    ) {
                        $output[] = array_pop($stack);
                        continue;
                    }
                }
                break;
            }
            $stack[] = $o1;
            $prevToken = 'operator';
            continue;
        }

        throw new RuntimeException('Unknown token: ' . $token);
    }

    while (!empty($stack)) {
        $tok = array_pop($stack);
        if ($tok === '(' || $tok === ')') {
            throw new RuntimeException('Mismatched parentheses');
        }
        $output[] = $tok;
    }

    return $output;
}

// Evaluate RPN
function evalRPN(array $rpn, array $ops, array $functions, array $constants, string $angleUnit) {
    $stack = [];

    foreach ($rpn as $token) {
        // number
        if (preg_match('/^\d+(\.\d+)?$|^\.\d+$/', $token)) {
            $stack[] = (float) $token;
            continue;
        }

        // constant
        if (is_string($token) && array_key_exists(strtolower($token), $constants)) {
            $stack[] = $constants[strtolower($token)];
            continue;
        }

        // function
        if (is_string($token) && array_key_exists(strtolower($token), $functions)) {
            $fname = strtolower($token);
            $argc = $functions[$fname] ?? 1;
            if (count($stack) < $argc) {
                throw new RuntimeException("Function $fname expects $argc arguments");
            }
            if ($argc === 1) {
                $a = array_pop($stack);
                $res = applyFunction($fname, [$a], $angleUnit);
                $stack[] = $res;
            } else {
                $args = [];
                for ($i = 0; $i < $argc; $i++) {
                    array_unshift($args, array_pop($stack));
                }
                $res = applyFunction($fname, $args, $angleUnit);
                $stack[] = $res;
            }
            continue;
        }

        // operators
        if (is_string($token) && array_key_exists($token, $ops)) {
            $meta = $ops[$token];
            $argc = $meta['argCount'];
            if (count($stack) < $argc) {
                throw new RuntimeException("Operator $token missing operand(s)");
            }
            if ($argc === 2) {
                $b = array_pop($stack);
                $a = array_pop($stack);
                $stack[] = applyOperator($token, $a, $b);
            } else { // unary
                $a = array_pop($stack);
                if ($token === 'u-') {
                    $stack[] = -$a;
                } elseif ($token === '%') {
                    $stack[] = $a / 100.0;
                } else {
                    throw new RuntimeException("Unknown unary operator $token");
                }
            }
            continue;
        }

        throw new RuntimeException("Unknown token in RPN: $token");
    }

    if (count($stack) !== 1) {
        throw new RuntimeException('Invalid expression (stack != 1)');
    }

    return $stack[0];
}

function applyOperator(string $op, float $a, float $b): float {
    switch ($op) {
        case '+': return $a + $b;
        case '-': return $a - $b;
        case '*': return $a * $b;
        case '/':
            if ($b == 0.0) throw new RuntimeException('Division by zero');
            return $a / $b;
        case '^': return pow($a, $b);
        default:
            throw new RuntimeException("Unsupported operator $op");
    }
}

function applyFunction(string $name, array $args, string $angleUnit) {
    $v = $args[0] ?? null;
    switch ($name) {
        case 'sin':
            return sin(convertAngle($v, $angleUnit));
        case 'cos':
            return cos(convertAngle($v, $angleUnit));
        case 'tan':
            return tan(convertAngle($v, $angleUnit));
        case 'asin':
            $res = asin($v);
            return $angleUnit === 'deg' ? rad2deg($res) : $res;
        case 'acos':
            $res = acos($v);
            return $angleUnit === 'deg' ? rad2deg($res) : $res;
        case 'atan':
            $res = atan($v);
            return $angleUnit === 'deg' ? rad2deg($res) : $res;
        case 'log': // base 10
            if ($v <= 0) throw new RuntimeException('log argument must be positive');
            return log10($v);
        case 'ln': // natural log
            if ($v <= 0) throw new RuntimeException('ln argument must be positive');
            return log($v);
        case 'sqrt':
            if ($v < 0) throw new RuntimeException('sqrt argument must be non-negative');
            return sqrt($v);
        case 'abs':
            return abs($v);
        case 'pow':
            $b = $args[1] ?? null;
            return pow($v, $b);
        default:
            throw new RuntimeException("Unsupported function $name");
    }
}

function convertAngle(float $val, string $angleUnit): float {
    return $angleUnit === 'deg' ? deg2rad($val) : $val;
}

// Validate characters roughly before tokenization (to reject strange input early)
if (!preg_match('/^[0-9A-Za-z_\s\.\+\-\*\/\^\%\(\),πPIeE]+$/u', $rawExpr)) {
    errorResponse('Invalid characters in expression', 400);
}

// Tokenize
try {
    $tokens = tokenize($expr);
} catch (Throwable $e) {
    errorResponse('Tokenization error: ' . $e->getMessage(), 400);
}

if (count($tokens) === 0) {
    errorResponse(
        'Empty expression after tokenization',
        400,
        [
            'raw_received' => $rawExpr,
            'length' => strlen($rawExpr),
            'hex' => bin2hex($rawExpr)
        ]
    );
}


// Convert to RPN
try {
    $rpn = toRPN($tokens, $ops, $functions);
} catch (Throwable $e) {
    errorResponse('Parsing error: ' . $e->getMessage(), 400);
}

// Evaluate RPN
try {
    $result = evalRPN($rpn, $ops, $functions, $constants, $angleUnit);
} catch (Throwable $e) {
    errorResponse('Calculation error: ' . $e->getMessage(), 400);
}

// Validate numeric result
if (!is_finite($result) || is_nan($result)) {
    errorResponse('Calculation resulted in non-finite value', 400);
}

// Apply precision if requested
if (is_int($precision)) {
    $resultRounded = round($result, $precision);
} else {
    $resultRounded = $result;
}

// Store history in session (last 20)
if (!isset($_SESSION['calc_history']) || !is_array($_SESSION['calc_history'])) {
    $_SESSION['calc_history'] = [];
}
array_unshift($_SESSION['calc_history'], [
    'expression' => $rawExpr,
    'angle' => $angleUnit,
    'result' => $resultRounded,
    'timestamp' => gmdate('c'),
]);
if (count($_SESSION['calc_history']) > 20) {
    array_pop($_SESSION['calc_history']);
}

// Output
if ($format === 'plain') {
    header('Content-Type: text/plain; charset=utf-8');
    echo (string) $resultRounded;
    exit;
}

// JSON response
$response = [
    'expression' => $rawExpr,
    'rpn' => $rpn,
    'angle' => $angleUnit,
    'result' => $resultRounded,
    'precision' => $precision,
    'history_count' => count($_SESSION['calc_history']),
    'history' => array_slice($_SESSION['calc_history'], 0, 10),
];

header('Content-Type: application/json; charset=utf-8');
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;
?>