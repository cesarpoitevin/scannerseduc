<?php
// ============================================================
//  Scanner Web – Configuração (TEMPLATE)
//  Copie este arquivo para config.php e preencha os valores
// ============================================================

// Chave da API Gemini – obtenha em https://aistudio.google.com/app/apikey
define('GEMINI_API_KEY', 'SUA_CHAVE_API_AQUI');

// Modelo Gemini para OCR
define('GEMINI_MODEL', 'gemini-2.5-flash');

// Tamanho máximo de imagem aceita (bytes) — 10 MB
define('MAX_IMAGE_SIZE', 10 * 1024 * 1024);

// Qualidade JPEG para saída (0–100)
define('JPEG_QUALITY', 92);
