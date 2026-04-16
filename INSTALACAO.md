# Scanner Web – Instruções de Instalação

## Pré-requisitos (Hostinger Business)

- PHP 8.0+
- Extensões habilitadas: `curl`, `gd` (ambas já ativas no Hostinger Business)
- HTTPS obrigatório (a câmera só funciona em HTTPS ou localhost)

---

## 1. Upload dos Arquivos

Envie toda a pasta via FTP/SFTP ou pelo Gerenciador de Arquivos do hPanel:

```
public_html/scanner/          ← ou na raiz public_html/
├── index.php
├── config.php
├── .htaccess
├── css/style.css
├── js/app.js
├── js/edge-detector.js
├── js/perspective.js
├── js/filters.js
├── api/ocr.php
└── api/generate_pdf.php
```

---

## 2. Configurar a Chave da API Gemini

1. Acesse https://aistudio.google.com/app/apikey
2. Clique em **Create API Key**
3. Copie a chave
4. Abra `config.php` e substitua:

```php
define('GEMINI_API_KEY', 'SUA_CHAVE_API_AQUI');
```

pela sua chave real. Exemplo:

```php
define('GEMINI_API_KEY', 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
```

---

## 3. Permissões de arquivo (se necessário)

```
chmod 644 config.php
chmod 644 api/*.php
chmod 755 css/ js/ api/
```

---

## 4. Testar

Acesse `https://seudominio.com/scanner/` pelo celular ou PC.

- Conceda permissão de câmera quando solicitado
- O contorno verde deve aparecer ao enquadrar um documento

---

## Funcionalidades

| Recurso | Descrição |
|---|---|
| 📷 Câmera ao vivo | Acesso à câmera traseira (padrão) |
| 🔲 Detecção de bordas | Contorno verde automático no preview |
| ✋ Ajuste manual | Arraste os 4 pontos para corrigir cantos |
| ✂️ Achate perspectiva | Correção automática de distorção |
| 🎨 Filtros | Cor / Escala de cinza / Preto & Branco |
| ☀️ Brilho & Contraste | Sliders de ajuste fino |
| 💧 Suavização | Redução de ruído |
| ↺ Rotação | Giros de 90° |
| 🖼️ Download JPG | Salvar como imagem |
| 📄 Download PDF | Gerar PDF A4 (sem biblioteca externa) |
| 🔍 OCR | Extração de texto via Gemini 2.5 Flash |

---

## Segurança

- `config.php` está protegido pelo `.htaccess` (acesso direto bloqueado)
- Imagens são processadas no cliente (não salvas no servidor)
- A API Gemini recebe a imagem apenas quando o OCR é solicitado

---

## Solução de Problemas

**Câmera não abre:**
- Verifique se o site usa HTTPS
- No Chrome: `Configurações → Privacidade → Configurações de site → Câmera`

**OCR não funciona:**
- Confirme que a chave API está correta no `config.php`
- Verifique se a extensão `curl` está ativa no PHP (hPanel → PHP → Extensões)

**PDF não baixa:**
- Verifique se a extensão `gd` está ativa (necessária para converter PNG→JPEG)
- Teste com uma imagem JPEG diretamente

**Erro "413 Payload Too Large":**
- A imagem é maior que 10 MB. Reduza a resolução ou aumente `MAX_IMAGE_SIZE` no `config.php`
