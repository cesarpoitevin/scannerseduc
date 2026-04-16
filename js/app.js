// ============================================================
//  DocumentScanner – Controlador principal da aplicação
// ============================================================

class CameraManager {
    constructor(videoEl) {
        this.video       = videoEl;
        this.stream      = null;
        this.facingMode  = 'environment'; // câmera traseira por padrão
        this._running    = false;
    }

    async start() {
        await this.stop();

        // Tenta constrains progressivamente mais permissivos
        const tries = [
            { video: { facingMode: { ideal: this.facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } } },
            { video: { facingMode: { ideal: this.facingMode } } },
            { video: true },
        ];

        let lastErr;
        for (const c of tries) {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ ...c, audio: false });
                break;
            } catch (e) { lastErr = e; }
        }
        if (!this.stream) throw lastErr;

        this.video.srcObject = this.stream;

        // Aguarda o vídeo realmente ter frames (evento canplay)
        await new Promise((resolve) => {
            if (this.video.readyState >= 3) { this._running = true; resolve(); return; }
            const onReady = () => { this._running = true; this.video.removeEventListener('canplay', onReady); resolve(); };
            this.video.addEventListener('canplay', onReady);
            this.video.play().catch(() => {}); // play() pode falhar em alguns browsers sem interação
        });
    }

    async stop() {
        this._running = false;
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
            this.video.srcObject = null;
        }
    }

    async flip() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.start();
    }

    isReady() {
        // videoWidth > 0 é mais confiável que readyState em mobile
        return this._running && this.video.videoWidth > 0;
    }

    /** Captura o frame atual como canvas */
    getFrame() {
        if (!this.isReady()) return null;
        const c = document.createElement('canvas');
        c.width  = this.video.videoWidth;
        c.height = this.video.videoHeight;
        c.getContext('2d').drawImage(this.video, 0, 0);
        return c;
    }
}

// ────────────────────────────────────────────────────────────

class CornerEditor {
    constructor(canvas) {
        this.canvas       = canvas;
        this.ctx          = canvas.getContext('2d');
        this.image        = null;
        this.corners      = [[0,0],[1,0],[1,1],[0,1]]; // normalized 0..1
        this.dragging     = -1;
        this.HANDLE_R     = 18;
        this._setupEvents();
    }

    setImage(img) {
        this.image = img;
        this.render();
    }

    /** corners em coordenadas do canvas de exibição */
    setCorners(pts) {
        this.corners = pts.map(([x, y]) => [
            x / this.canvas.width,
            y / this.canvas.height,
        ]);
        this.render();
    }

    /** Retorna cantos em coordenadas do canvas de exibição */
    getCorners() {
        return this.corners.map(([nx, ny]) => [
            nx * this.canvas.width,
            ny * this.canvas.height,
        ]);
    }

    render(previewSettings = null) {
        const { canvas, ctx, image, corners } = this;
        if (!image) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        // Aplicar prévia de filtro suave (apenas cinza/bw como hint visual)
        if (previewSettings && previewSettings.filter !== 'color') {
            ctx.globalAlpha = 0.35;
            if (previewSettings.filter === 'gray') {
                ctx.filter = 'grayscale(1)';
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.filter = 'grayscale(1) contrast(2)';
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            }
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
        }

        const pts = corners.map(([nx, ny]) => [nx * canvas.width, ny * canvas.height]);

        // Área do documento
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        pts.slice(1).forEach(p => ctx.lineTo(...p));
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,230,120,0.07)';
        ctx.fill();

        // Contorno
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        pts.slice(1).forEach(p => ctx.lineTo(...p));
        ctx.closePath();
        ctx.strokeStyle = '#00E678';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.shadowColor = '#00E678';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Handles
        const labels = ['TL','TR','BR','BL'];
        pts.forEach(([x, y], i) => {
            ctx.beginPath();
            ctx.arc(x, y, this.HANDLE_R / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#00E678';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    _setupEvents() {
        const getPos = (e) => {
            const r     = this.canvas.getBoundingClientRect();
            const src   = e.touches ? e.touches[0] : e;
            const scaleX = this.canvas.width  / r.width;
            const scaleY = this.canvas.height / r.height;
            return [
                (src.clientX - r.left) * scaleX,
                (src.clientY - r.top)  * scaleY,
            ];
        };

        const hit = ([mx, my]) => {
            for (let i = 0; i < this.corners.length; i++) {
                const [cx, cy] = [
                    this.corners[i][0] * this.canvas.width,
                    this.corners[i][1] * this.canvas.height,
                ];
                if (Math.hypot(mx - cx, my - cy) < this.HANDLE_R) return i;
            }
            return -1;
        };

        const down = (e) => {
            this.dragging = hit(getPos(e));
            if (this.dragging !== -1) e.preventDefault();
        };
        const move = (e) => {
            if (this.dragging === -1) return;
            e.preventDefault();
            const [x, y] = getPos(e);
            this.corners[this.dragging] = [
                Math.max(0, Math.min(1, x / this.canvas.width)),
                Math.max(0, Math.min(1, y / this.canvas.height)),
            ];
            this.render();
        };
        const up = () => { this.dragging = -1; };

        this.canvas.addEventListener('mousedown',  down);
        this.canvas.addEventListener('mousemove',  move);
        this.canvas.addEventListener('mouseup',    up);
        this.canvas.addEventListener('touchstart', down, { passive: false });
        this.canvas.addEventListener('touchmove',  move, { passive: false });
        this.canvas.addEventListener('touchend',   up);
    }
}

// ────────────────────────────────────────────────────────────

class DocumentScanner {
    constructor() {
        this.state       = 'capture';
        this.camera      = null;
        this.edgeDetector    = new EdgeDetector();
        this.perspectiveTransformer = new PerspectiveTransformer();
        this.imageFilters    = new ImageFilters();
        this.cornerEditor    = null;
        this.capturedCanvas  = null;
        this.processedCanvas = null;
        this._rafId          = null;

        this.settings = {
            filter:     'color',
            brightness: 0,
            contrast:   0,
            blur:       0,
            rotation:   0,
        };

        this._init();
    }

    // ── Inicialização ──────────────────────────────────────────
    _init() {
        this._bindEl();
        this._bindEvents();
        this._startCamera();
    }

    _bindEl() {
        const $ = id => document.getElementById(id);
        const $$ = sel => document.querySelectorAll(sel);

        this.el = {
            // Steps
            stepCapture: $('step-capture'),
            stepAdjust:  $('step-adjust'),
            stepResult:  $('step-result'),

            // Capture
            video:          $('camera-feed'),
            overlayCanvas:  $('overlay-canvas'),
            btnCapture:     $('btn-capture'),
            btnFlip:        $('btn-flip'),
            btnUpload:      $('btn-upload'),
            fileInput:      $('file-input'),
            cameraError:    $('camera-error'),

            // Adjust
            previewCanvas: $('preview-canvas'),
            filterBtns:    $$('[data-filter]'),
            sliderBrightness: $('slider-brightness'),
            sliderContrast:   $('slider-contrast'),
            sliderBlur:       $('slider-blur'),
            valueBrightness:  $('val-brightness'),
            valueContrast:    $('val-contrast'),
            valueBlur:        $('val-blur'),
            btnRotateLeft:  $('btn-rotate-left'),
            btnRotateRight: $('btn-rotate-right'),
            btnBack:        $('btn-back'),
            btnProcess:     $('btn-process'),

            // Result
            resultCanvas:   $('result-canvas'),
            btnDownloadJpg: $('btn-download-jpg'),
            btnDownloadPdf: $('btn-download-pdf'),
            btnOcr:         $('btn-ocr'),
            btnNewScan:     $('btn-new-scan'),
            ocrSection:     $('ocr-section'),
            ocrText:        $('ocr-text'),
            btnCopyText:    $('btn-copy-text'),

            // UI
            loader:        $('loader'),
            loaderMsg:     $('loader-msg'),
            toast:         $('toast'),
        };
    }

    _bindEvents() {
        const el = this.el;

        // touchstart para resposta imediata no mobile (sem delay de 300ms)
        el.btnCapture.addEventListener('touchstart', (e) => { e.preventDefault(); this._capture(); }, { passive: false });
        el.btnCapture.addEventListener('click', () => this._capture()); // fallback desktop
        el.btnFlip.addEventListener('click',    () => this._flipCamera());
        el.btnUpload.addEventListener('click',  () => el.fileInput.click());
        el.fileInput.addEventListener('change', (e) => this._loadFile(e));

        el.btnBack.addEventListener('click',    () => this._setState('capture'));
        el.btnProcess.addEventListener('click', () => this._processDocument());

        // Filtros
        el.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                el.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.filter = btn.dataset.filter;
                this.cornerEditor?.render(this.settings);
            });
        });

        // Sliders
        const bindSlider = (slider, valEl, key, scale = 1) => {
            slider.addEventListener('input', () => {
                const v = parseInt(slider.value);
                this.settings[key] = v;
                if (valEl) valEl.textContent = (v >= 0 ? '+' : '') + Math.round(v * scale);
                this.cornerEditor?.render(this.settings);
            });
        };
        bindSlider(el.sliderBrightness, el.valueBrightness, 'brightness');
        bindSlider(el.sliderContrast,   el.valueContrast,   'contrast');
        bindSlider(el.sliderBlur,       el.valueBlur,       'blur');

        // Rotação
        el.btnRotateLeft.addEventListener('click',  () => {
            this.settings.rotation = (this.settings.rotation - 90 + 360) % 360;
            this.cornerEditor?.render(this.settings);
        });
        el.btnRotateRight.addEventListener('click', () => {
            this.settings.rotation = (this.settings.rotation + 90) % 360;
            this.cornerEditor?.render(this.settings);
        });

        // Resultado
        el.btnDownloadJpg.addEventListener('click', () => this._downloadJpg());
        el.btnDownloadPdf.addEventListener('click', () => this._downloadPdf());
        el.btnOcr.addEventListener('click',         () => this._performOcr());
        el.btnNewScan.addEventListener('click',     () => this._reset());
        el.btnCopyText.addEventListener('click',    () => this._copyOcrText());
    }

    // ── Câmera ─────────────────────────────────────────────────
    async _startCamera() {
        this.camera = new CameraManager(this.el.video);
        try {
            await this.camera.start();
            this.el.cameraError.style.display = 'none';
            this._startOverlayLoop();
        } catch (err) {
            this.el.cameraError.style.display = 'flex';
            console.warn('Camera error:', err);
        }
    }

    async _flipCamera() {
        try {
            await this.camera.flip();
        } catch (e) {
            this._toast('Não foi possível alternar a câmera');
        }
    }

    // ── Loop de detecção de bordas no preview da câmera ────────
    _startOverlayLoop() {
        let lastCorners   = null;
        let lastDetect    = 0;
        const DETECT_MS   = 600; // detectar a cada 600ms

        const loop = () => {
            this._rafId = requestAnimationFrame(loop);
            if (this.state !== 'capture') return;

            const video = this.el.video;
            const ov    = this.el.overlayCanvas;

            // Sincronizar tamanho do overlay com o vídeo em tempo real
            if (video.videoWidth > 0 && (ov.width !== video.videoWidth || ov.height !== video.videoHeight)) {
                ov.width  = video.videoWidth;
                ov.height = video.videoHeight;
            }

            if (!this.camera?.isReady()) return;

            const now = Date.now();
            if (now - lastDetect > DETECT_MS) {
                lastDetect = now;
                const frame = this.camera.getFrame();
                if (frame) {
                    const corners = this.edgeDetector.detect(frame);
                    // Corners já estão em coordenadas do frame; overlay tem o mesmo tamanho
                    if (corners) lastCorners = corners;
                    else lastCorners = null;
                }
            }

            this.edgeDetector.drawOverlay(this.el.overlayCanvas, lastCorners, 1, 1);

            // Dica de status no overlay
            this._drawCameraHint(ov, lastCorners);
        };

        loop();
    }

    // Dica textual dentro do viewfinder
    _drawCameraHint(canvas, corners) {
        const ctx = canvas.getContext('2d');
        const msg   = corners ? '\u2713  Documento detectado — toque para capturar' : 'Enquadre o documento';
        const color = corners ? '#00E678' : 'rgba(255,255,255,0.9)';

        // Fonte proporcional ao canvas nativo (câmera 1280px → fonte ~38px → visível em display menor)
        const fontSize = Math.round(canvas.height * 0.05);
        const padV = Math.round(fontSize * 0.55);
        const padH = Math.round(fontSize * 0.8);
        const by   = canvas.height - Math.round(canvas.height * 0.05) - padV;

        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';

        const tw = ctx.measureText(msg).width;
        const bx = (canvas.width - tw) / 2 - padH;
        const bw = tw + padH * 2;
        const bh = fontSize + padV * 2;

        // Fundo arredondado
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(bx, by - fontSize - padV + 4, bw, bh, fontSize * 0.4);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.fillText(msg, canvas.width / 2, by);
        ctx.restore();
    }

    // ── Captura ────────────────────────────────────────────────
    _capture() {
        const video = this.el.video;

        // Captura diretamente do elemento <video> — não depende de isReady()
        if (!video.videoWidth || !video.videoHeight) {
            this._toast('⏳ Câmera ainda iniciando, aguarde um segundo…');
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            this.capturedCanvas = canvas;
            this._setState('adjust');
            this._setupEditor(canvas);
        } catch (err) {
            this._toast('Erro ao capturar: ' + err.message);
            console.error(err);
        }
    }

    _loadFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width  = img.naturalWidth;
                c.height = img.naturalHeight;
                c.getContext('2d').drawImage(img, 0, 0);
                this.capturedCanvas = c;
                this._setState('adjust');
                this._setupEditor(c);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // ── Editor de cantos ───────────────────────────────────────
    _setupEditor(srcCanvas) {
        const preview   = this.el.previewCanvas;
        const container = preview.parentElement;
        // clientWidth pode ser 0 logo após mudar display; usa innerWidth como fallback
        const maxW = (container.clientWidth || window.innerWidth) - 16;
        const maxH = window.innerHeight * 0.45;
        const ratio = Math.min(maxW / srcCanvas.width, maxH / srcCanvas.height, 1);

        preview.width  = Math.round(srcCanvas.width  * ratio);
        preview.height = Math.round(srcCanvas.height * ratio);

        this.cornerEditor = new CornerEditor(preview);
        this.cornerEditor.setImage(srcCanvas);

        // Detectar bordas na imagem capturada
        const corners = this.edgeDetector.detect(srcCanvas);
        if (corners) {
            this.cornerEditor.setCorners(corners.map(([x, y]) => [x * ratio, y * ratio]));
        } else {
            // Default: levemente recuado
            const m = 12;
            this.cornerEditor.setCorners([
                [m, m],
                [preview.width - m, m],
                [preview.width - m, preview.height - m],
                [m, preview.height - m],
            ]);
        }
    }

    // ── Processar documento ────────────────────────────────────
    async _processDocument() {
        if (!this.capturedCanvas || !this.cornerEditor) return;

        this._showLoader('Processando documento...');

        try {
            // Cantos no canvas de preview → escalar para imagem original
            const dispCorners = this.cornerEditor.getCorners();
            const scX = this.capturedCanvas.width  / this.cornerEditor.canvas.width;
            const scY = this.capturedCanvas.height / this.cornerEditor.canvas.height;
            const srcCorners = dispCorners.map(([x, y]) => [x * scX, y * scY]);

            // Correção de perspectiva (em worker-like promise para não travar UI)
            const warped = await new Promise(resolve => {
                setTimeout(() => {
                    resolve(this.perspectiveTransformer.warp(this.capturedCanvas, srcCorners));
                }, 0);
            });

            // Filtros e ajustes
            const filtered = await new Promise(resolve => {
                setTimeout(() => {
                    resolve(this.imageFilters.apply(warped, this.settings));
                }, 0);
            });

            this.processedCanvas = filtered;
            this._setState('result');
            this._renderResult(filtered);

        } catch (err) {
            console.error(err);
            this._toast('Erro ao processar: ' + err.message);
        } finally {
            this._hideLoader();
        }
    }

    _renderResult(canvas) {
        const resultCanvas = this.el.resultCanvas;
        const maxW = resultCanvas.parentElement.clientWidth;
        const maxH = window.innerHeight * 0.55;
        const ratio = Math.min(maxW / canvas.width, maxH / canvas.height, 1);

        resultCanvas.width  = Math.round(canvas.width  * ratio);
        resultCanvas.height = Math.round(canvas.height * ratio);
        resultCanvas.getContext('2d').drawImage(canvas, 0, 0, resultCanvas.width, resultCanvas.height);
    }

    // ── Downloads ──────────────────────────────────────────────
    _downloadJpg() {
        if (!this.processedCanvas) return;
        const a = document.createElement('a');
        a.download = 'documento_' + _dateStr() + '.jpg';
        a.href     = this.processedCanvas.toDataURL('image/jpeg', 0.93);
        a.click();
    }

    async _downloadPdf() {
        if (!this.processedCanvas) return;
        this._showLoader('Gerando PDF...');
        try {
            const imageData = this.processedCanvas.toDataURL('image/jpeg', 0.93);
            const res = await fetch('api/generate_pdf.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData }),
            });
            if (!res.ok) throw new Error('Servidor retornou ' + res.status);

            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.download = 'documento_' + _dateStr() + '.pdf';
            a.href     = url;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 3000);
        } catch (err) {
            this._toast('Erro ao gerar PDF: ' + err.message);
        } finally {
            this._hideLoader();
        }
    }

    // ── OCR ────────────────────────────────────────────────────
    async _performOcr() {
        if (!this.processedCanvas) return;
        this._showLoader('Extraindo texto com IA...');

        try {
            const imageData = this.processedCanvas.toDataURL('image/jpeg', 0.93);
            const res = await fetch('api/ocr.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Falha no OCR');

            this.el.ocrText.textContent = data.text;
            this.el.ocrSection.style.display = '';
            this.el.ocrSection.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            this._toast('Erro OCR: ' + err.message);
        } finally {
            this._hideLoader();
        }
    }

    _copyOcrText() {
        const text = this.el.ocrText.textContent;
        if (!text) return;
        navigator.clipboard?.writeText(text).then(() => {
            this._toast('Texto copiado!');
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            this._toast('Texto copiado!');
        });
    }

    // ── Estado ─────────────────────────────────────────────────
    _setState(state) {
        this.state = state;
        const { stepCapture, stepAdjust, stepResult } = this.el;

        stepCapture.style.display = state === 'capture' ? '' : 'none';
        stepAdjust.style.display  = state === 'adjust'  ? '' : 'none';
        stepResult.style.display  = state === 'result'  ? '' : 'none';

        if (state === 'result') {
            // Só para a câmera quando chega no resultado final
            this.camera?.stop().catch(() => {});
        } else if (state === 'capture') {
            // Reinicia câmera apenas se parou (ex: vindo do resultado)
            if (!this.camera?.isReady()) {
                this.camera?.start()
                    .then(() => { this.el.cameraError.style.display = 'none'; })
                    .catch(err => {
                        console.error('Câmera:', err);
                        this.el.cameraError.style.display = 'flex';
                    });
            }
        }
        // Em 'adjust': câmera continua rodando em background — volta instantânea
    }

    _reset() {
        this.capturedCanvas  = null;
        this.processedCanvas = null;
        this.cornerEditor    = null;
        this.settings        = { filter:'color', brightness:0, contrast:0, blur:0, rotation:0 };

        // Reset UI
        this.el.filterBtns.forEach((b, i) => b.classList.toggle('active', i === 0));
        this.el.sliderBrightness.value = 0;
        this.el.sliderContrast.value   = 0;
        this.el.sliderBlur.value       = 0;
        this.el.valueBrightness.textContent = '+0';
        this.el.valueContrast.textContent   = '+0';
        this.el.valueBlur.textContent       = '+0';
        this.el.ocrSection.style.display = 'none';
        this.el.ocrText.textContent = '';

        this._setState('capture');
    }

    // ── Helpers UI ────────────────────────────────────────────
    _showLoader(msg = 'Aguarde...') {
        this.el.loaderMsg.textContent = msg;
        this.el.loader.style.display  = 'flex';
    }

    _hideLoader() {
        this.el.loader.style.display = 'none';
    }

    _toast(msg, duration = 3000) {
        const t = this.el.toast;
        t.textContent   = msg;
        t.style.opacity = '1';
        t.style.transform = 'translateY(0)';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            t.style.opacity   = '0';
            t.style.transform = 'translateY(10px)';
        }, duration);
    }
}

// ── Helpers ────────────────────────────────────────────────
function _dateStr() {
    return new Date().toISOString().replace(/[:\-T]/g,'').slice(0,14);
}

// ── Boot ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.scanner = new DocumentScanner();
});
