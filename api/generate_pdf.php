<?php
// ============================================================
//  Geração de PDF puro (sem biblioteca externa) – api/generate_pdf.php
// ============================================================

require_once dirname(__DIR__) . '/config.php';

// Verificar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Método não permitido');
}

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (empty($input['image'])) {
    http_response_code(400);
    exit('Imagem não fornecida');
}

// Extrair dados da imagem
if (!preg_match('/^data:image\/(jpeg|png|webp);base64,(.+)$/', $input['image'], $m)) {
    http_response_code(400);
    exit('Formato inválido');
}

$imgType = $m[1];
$rawImg  = base64_decode($m[2]);

// Converter para JPEG se necessário (PNG/WebP)
if ($imgType !== 'jpeg') {
    $src = imagecreatefromstring($rawImg);
    if (!$src) { http_response_code(500); exit('Falha ao decodificar imagem'); }

    // Fundo branco para PNG transparente
    $dst = imagecreatetruecolor(imagesx($src), imagesy($src));
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopy($dst, $src, 0, 0, 0, 0, imagesx($src), imagesy($src));

    ob_start();
    imagejpeg($dst, null, JPEG_QUALITY);
    $rawImg = ob_get_clean();
    imagedestroy($src);
    imagedestroy($dst);
}

// Dimensões da imagem
$imgInfo = getimagesizefromstring($rawImg);
if (!$imgInfo) { http_response_code(500); exit('Não foi possível obter dimensões'); }

$imgW = $imgInfo[0];
$imgH = $imgInfo[1];

// Tamanho da página A4 em pontos (72 dpi: 1 pt = 1/72 inch)
// A4 = 210mm x 297mm = 595pt x 842pt
$pageW = 595;
$pageH = 842;
$margin = 28; // ~1 cm

// Escalar imagem para caber na página com margem
$availW = $pageW - 2 * $margin;
$availH = $pageH - 2 * $margin;
$scale  = min($availW / $imgW, $availH / $imgH);
$fitW   = round($imgW * $scale, 4);
$fitH   = round($imgH * $scale, 4);
$posX   = round(($pageW - $fitW) / 2, 4);   // centralizado
$posY   = round(($pageH - $fitH) / 2, 4);   // centralizado (coord. PDF: base inferior)
$pdfY   = round($pageH - $posY - $fitH, 4); // converter para coordenada PDF

// ---- Construir PDF manualmente ----
$title = isset($input['title']) ? preg_replace('/[^\w\s\-]/u', '', $input['title']) : 'Documento';

function pdfStr($s) {
    return '(' . addcslashes($s, '()\\') . ')';
}

$imgLen = strlen($rawImg);

// Objeto 5: XObject de imagem JPEG
$obj5body = "<< /Type /XObject /Subtype /Image\n"
          . "   /Width {$imgW} /Height {$imgH}\n"
          . "   /ColorSpace /DeviceRGB /BitsPerComponent 8\n"
          . "   /Filter /DCTDecode /Length {$imgLen}\n"
          . ">>\nstream\n";
$obj5end  = "\nendstream";

// Conteúdo da página
$streamContent = "q\n{$fitW} 0 0 {$fitH} {$posX} {$pdfY} cm\n/Im1 Do\nQ";
$streamLen = strlen($streamContent);

// Construir PDF
$now   = date('YmdHis');
$pdf   = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";  // header + marcador binário

$offsets = [];

// Obj 1 – Catalog
$offsets[1] = strlen($pdf);
$pdf .= "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

// Obj 2 – Pages
$offsets[2] = strlen($pdf);
$pdf .= "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

// Obj 3 – Page
$offsets[3] = strlen($pdf);
$pdf .= "3 0 obj\n"
      . "<< /Type /Page /Parent 2 0 R\n"
      . "   /MediaBox [0 0 {$pageW} {$pageH}]\n"
      . "   /Contents 4 0 R\n"
      . "   /Resources << /XObject << /Im1 5 0 R >> >>\n"
      . ">>\nendobj\n";

// Obj 4 – Stream de conteúdo
$offsets[4] = strlen($pdf);
$pdf .= "4 0 obj\n<< /Length {$streamLen} >>\nstream\n{$streamContent}\nendstream\nendobj\n";

// Obj 5 – Imagem
$offsets[5] = strlen($pdf);
$pdf .= "5 0 obj\n" . $obj5body . $rawImg . $obj5end . "\nendobj\n";

// Tabela xref
$xrefOffset = strlen($pdf);
$pdf .= "xref\n0 6\n";
$pdf .= "0000000000 65535 f \n";
for ($i = 1; $i <= 5; $i++) {
    $pdf .= str_pad($offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
}

$pdf .= "trailer\n<< /Size 6 /Root 1 0 R >>\n";
$pdf .= "startxref\n{$xrefOffset}\n%%EOF\n";

// Enviar resposta
$filename = 'documento_' . date('Ymd_His') . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($pdf));
header('Cache-Control: no-cache, no-store');
echo $pdf;
