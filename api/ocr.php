<?php
// ============================================================
//  OCR via Gemini – api/ocr.php
// ============================================================

// Tenta fora do public_html primeiro (produção), depois na raiz (desenvolvimento)
$configPath = dirname(dirname(__DIR__)) . '/config.php';
if (!file_exists($configPath)) {
    $configPath = dirname(__DIR__) . '/config.php';
}
require_once $configPath;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido']);
    exit;
}

$raw = file_get_contents('php://input');
if (strlen($raw) > MAX_IMAGE_SIZE * 1.4) { // base64 ~33% overhead
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Imagem muito grande (máx 10 MB)']);
    exit;
}

$input = json_decode($raw, true);

if (empty($input['image'])) {
    echo json_encode(['success' => false, 'error' => 'Nenhuma imagem enviada']);
    exit;
}

// Detectar tipo MIME e extrair base64
if (!preg_match('/^data:(image\/(jpeg|png|webp));base64,(.+)$/', $input['image'], $m)) {
    echo json_encode(['success' => false, 'error' => 'Formato de imagem inválido']);
    exit;
}

$mimeType  = $m[1];
$base64    = $m[3];

// Prompt de OCR
$prompt = isset($input['prompt']) && !empty($input['prompt'])
    ? htmlspecialchars(strip_tags($input['prompt']), ENT_QUOTES, 'UTF-8')
    : 'Extraia todo o texto deste documento. Preserve a estrutura, parágrafos e formatação original ao máximo possível. Retorne apenas o texto extraído, sem comentários adicionais.';

$body = json_encode([
    'contents' => [[
        'parts' => [
            ['text' => $prompt],
            ['inline_data' => [
                'mime_type' => $mimeType,
                'data'      => $base64,
            ]],
        ],
    ]],
    'generationConfig' => [
        'temperature'     => 0.1,
        'topP'            => 0.8,
        'maxOutputTokens' => 8192,
    ],
], JSON_UNESCAPED_UNICODE);

$url = 'https://generativelanguage.googleapis.com/v1beta/models/'
     . GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY;

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false) {
    echo json_encode(['success' => false, 'error' => 'Falha na conexão com serviço OCR: ' . $curlErr]);
    exit;
}

$data = json_decode($response, true);

if ($httpCode !== 200) {
    $msg = $data['error']['message'] ?? 'Erro desconhecido na API';
    echo json_encode(['success' => false, 'error' => "Erro API ({$httpCode}): {$msg}"]);
    exit;
}

$text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

if (empty($text)) {
    echo json_encode(['success' => false, 'error' => 'Nenhum texto foi extraído. Tente com uma imagem mais nítida.']);
    exit;
}

echo json_encode(['success' => true, 'text' => $text], JSON_UNESCAPED_UNICODE);
