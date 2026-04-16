<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#0B0F1A">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Scanner Web</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

<div id="app">

  <!-- ═══════════════════════════════════════════════════════
       CABEÇALHO
  ═══════════════════════════════════════════════════════════ -->
  <header class="app-header">
    <div class="app-logo">📄</div>
    <div>
      <div class="app-title">Scanner Web</div>
      <div class="app-subtitle">Digitalize documentos de qualquer dispositivo</div>
    </div>
  </header>

  <!-- Barra de progresso por etapas -->
  <div class="steps-bar" id="steps-bar">
    <div class="step-dot active" id="dot-1"></div>
    <div style="flex:1;height:2px;background:var(--border);border-radius:2px"></div>
    <div class="step-dot" id="dot-2"></div>
    <div style="flex:1;height:2px;background:var(--border);border-radius:2px"></div>
    <div class="step-dot" id="dot-3"></div>
    <span class="step-label" id="step-label">Capturar</span>
  </div>

  <!-- ═══════════════════════════════════════════════════════
       ETAPA 1 – CAPTURA
  ═══════════════════════════════════════════════════════════ -->
  <section id="step-capture" class="step-section">

    <!-- Viewfinder da câmera -->
    <div class="camera-wrap">
      <video id="camera-feed" autoplay playsinline muted></video>
      <canvas id="overlay-canvas"></canvas>
      <div class="camera-grid"></div>

      <!-- Dica de alinhamento -->
      <div style="
        position:absolute; bottom:12px; left:50%; transform:translateX(-50%);
        background:rgba(0,0,0,.6); color:#fff; font-size:0.75rem;
        padding:5px 12px; border-radius:20px; pointer-events:none;
        backdrop-filter:blur(4px); white-space:nowrap;
      ">
        Enquadre o documento na câmera
      </div>

      <!-- Erro de câmera -->
      <div id="camera-error">
        <div class="icon">📷</div>
        <strong>Câmera não disponível</strong>
        <p>Verifique as permissões de câmera ou use o botão de galeria abaixo.</p>
        <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">
          📁 Escolher imagem
        </button>
      </div>
    </div>

    <!-- Controles de captura -->
    <div class="capture-bar">

      <!-- Galeria -->
      <button class="btn-icon" id="btn-upload" title="Carregar imagem da galeria" aria-label="Galeria">
        🖼️
      </button>

      <!-- Captura principal -->
      <button class="btn-capture-main" id="btn-capture" title="Capturar foto" aria-label="Capturar"></button>

      <!-- Virar câmera -->
      <button class="btn-icon" id="btn-flip" title="Alternar câmera" aria-label="Virar câmera">
        🔄
      </button>

    </div>

    <!-- Input oculto para upload de arquivo -->
    <input type="file" id="file-input" accept="image/*" capture="environment" style="display:none">

  </section>

  <!-- ═══════════════════════════════════════════════════════
       ETAPA 2 – AJUSTAR / EDITAR
  ═══════════════════════════════════════════════════════════ -->
  <section id="step-adjust" class="step-section" style="display:none">

    <div class="adjust-wrap">

      <!-- Preview com handles de canto -->
      <div class="preview-box" style="position:relative">
        <canvas id="preview-canvas"></canvas>
        <div class="rotation-badge" id="rotation-badge">↻ 0°</div>
      </div>

      <div style="padding:8px 14px 0;font-size:0.75rem;color:var(--text-muted);text-align:center">
        Arraste os pontos verdes para ajustar os cantos do documento
      </div>

      <!-- Painel de controles -->
      <div class="controls-panel">

        <!-- Tipo de filtro -->
        <div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;font-weight:600">
            FILTRO
          </div>
          <div class="filter-group">
            <button class="filter-btn active" data-filter="color">
              <span class="ficon">🎨</span>Cor
            </button>
            <button class="filter-btn" data-filter="gray">
              <span class="ficon">🩶</span>Cinza
            </button>
            <button class="filter-btn" data-filter="bw">
              <span class="ficon">⬛</span>P&amp;B
            </button>
          </div>
        </div>

        <!-- Ajustes numéricos -->
        <div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;font-weight:600">
            AJUSTES
          </div>
          <div class="sliders-group">

            <div class="slider-row">
              <span class="slider-label">☀️ Brilho</span>
              <input type="range" id="slider-brightness" min="-100" max="100" value="0" step="5">
              <span class="slider-value" id="val-brightness">+0</span>
            </div>

            <div class="slider-row">
              <span class="slider-label">◑ Contraste</span>
              <input type="range" id="slider-contrast" min="-100" max="100" value="0" step="5">
              <span class="slider-value" id="val-contrast">+0</span>
            </div>

            <div class="slider-row">
              <span class="slider-label">💧 Suavização</span>
              <input type="range" id="slider-blur" min="0" max="10" value="0" step="1">
              <span class="slider-value" id="val-blur">+0</span>
            </div>

          </div>
        </div>

        <!-- Rotação -->
        <div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;font-weight:600">
            ROTAÇÃO
          </div>
          <div class="rotation-row">
            <button class="btn-rotate" id="btn-rotate-left" title="Girar 90° esquerda">↺</button>
            <span style="font-size:0.8rem;color:var(--text-muted);flex:1;text-align:center">
              Girar 90°
            </span>
            <button class="btn-rotate" id="btn-rotate-right" title="Girar 90° direita">↻</button>
          </div>
        </div>

      </div>

    </div><!-- /adjust-wrap -->

    <!-- Botões de ação -->
    <div class="adjust-actions">
      <button class="btn btn-ghost" id="btn-back">← Voltar</button>
      <button class="btn btn-primary" id="btn-process" style="flex:2">
        ✂️ Digitalizar Documento
      </button>
    </div>

  </section>

  <!-- ═══════════════════════════════════════════════════════
       ETAPA 3 – RESULTADO
  ═══════════════════════════════════════════════════════════ -->
  <section id="step-result" class="step-section" style="display:none">

    <div class="result-wrap">

      <!-- Preview do documento processado -->
      <div class="result-preview">
        <canvas id="result-canvas"></canvas>
      </div>

      <!-- Botões de exportação -->
      <div class="result-actions">

        <button class="btn btn-secondary" id="btn-download-jpg">
          🖼️ Salvar JPG
        </button>

        <button class="btn btn-secondary" id="btn-download-pdf">
          📄 Salvar PDF
        </button>

        <button class="btn btn-accent" id="btn-ocr">
          🔍 Extrair Texto (OCR)
        </button>

        <button class="btn btn-ghost btn-full" id="btn-new-scan">
          🔄 Novo Documento
        </button>

      </div>

      <!-- Resultado do OCR -->
      <div id="ocr-section" style="display:none">
        <div class="ocr-header">
          <h3>🔤 Texto Extraído</h3>
          <button class="btn btn-sm btn-secondary" id="btn-copy-text">📋 Copiar</button>
        </div>
        <pre id="ocr-text"></pre>
      </div>

      <div style="height:20px"></div>

    </div>

  </section>

</div><!-- /#app -->

<!-- ═══════════════════════════════════════════════════════
     LOADER (overlay global)
═══════════════════════════════════════════════════════════ -->
<div id="loader">
  <div class="loader-spinner"></div>
  <div id="loader-msg">Aguarde...</div>
</div>

<!-- Toast de notificações -->
<div id="toast"></div>

<!-- ─── Scripts ──────────────────────────────────────────── -->
<script src="js/edge-detector.js"></script>
<script src="js/perspective.js"></script>
<script src="js/filters.js"></script>
<script src="js/app.js"></script>

<script>
// ── Sincronizar canvas de overlay com o tamanho do vídeo ──
(function () {
  const video   = document.getElementById('camera-feed');
  const overlay = document.getElementById('overlay-canvas');

  function sync() {
    overlay.width  = video.videoWidth  || video.clientWidth;
    overlay.height = video.videoHeight || video.clientHeight;
  }

  video.addEventListener('loadedmetadata', sync);
  window.addEventListener('resize', sync);
  sync();
})();

// ── Atualizar barra de etapas ─────────────────────────────
(function () {
  const labels = ['Capturar', 'Ajustar', 'Resultado'];
  const dots   = [
    document.getElementById('dot-1'),
    document.getElementById('dot-2'),
    document.getElementById('dot-3'),
  ];
  const labelEl = document.getElementById('step-label');

  // Observar mudanças nos steps via MutationObserver
  const steps = ['step-capture','step-adjust','step-result'];
  const observer = new MutationObserver(() => {
    steps.forEach((id, i) => {
      const visible = document.getElementById(id).style.display !== 'none';
      dots[i].className = 'step-dot' + (visible ? ' active' : (i < steps.findIndex(s =>
        document.getElementById(s).style.display !== 'none') ? ' done' : ''));
      if (visible) labelEl.textContent = labels[i];
    });
  });

  steps.forEach(id => {
    observer.observe(document.getElementById(id), {
      attributes: true, attributeFilter: ['style'],
    });
  });
})();
</script>

</body>
</html>
