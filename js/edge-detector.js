// ============================================================
//  EdgeDetector – Detecção automática de bordas do documento
// ============================================================

class EdgeDetector {
    constructor() {
        this.PROCESS_SIZE = 640; // dimensão máxima para processamento
        this.EDGE_THRESHOLD_PERCENT = 0.65; // percentil para threshold de borda
        this.MIN_AREA_RATIO = 0.05; // área mínima do quad em relação à imagem
    }

    /**
     * Detecta os 4 cantos do documento em um canvas.
     * @param {HTMLCanvasElement} sourceCanvas
     * @returns {number[][]|null} [[x,y],[x,y],[x,y],[x,y]] (TL,TR,BR,BL) ou null
     */
    detect(sourceCanvas) {
        const { procCanvas, scaleX, scaleY } = this._downscale(sourceCanvas);
        const w = procCanvas.width;
        const h = procCanvas.height;

        const ctx = procCanvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, w, h);

        const gray    = this._toGrayscale(imgData.data, w, h);
        const blurred = this._gaussianBlur(gray, w, h);
        const edges   = this._sobel(blurred, w, h);
        const corners = this._findCorners(edges, w, h);

        if (!corners) return null;

        // Escalar de volta para coordenadas da imagem original
        return corners.map(([x, y]) => [
            Math.round(x / scaleX),
            Math.round(y / scaleY),
        ]);
    }

    // ── Downscale ──────────────────────────────────────────────
    _downscale(canvas) {
        const { width, height } = canvas;
        const scale = Math.min(this.PROCESS_SIZE / width, this.PROCESS_SIZE / height, 1);
        const pw    = Math.round(width * scale);
        const ph    = Math.round(height * scale);

        const pc = document.createElement('canvas');
        pc.width  = pw;
        pc.height = ph;
        pc.getContext('2d').drawImage(canvas, 0, 0, pw, ph);

        return { procCanvas: pc, scaleX: pw / width, scaleY: ph / height };
    }

    // ── Grayscale ──────────────────────────────────────────────
    _toGrayscale(data, w, h) {
        const gray = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
            const j = i * 4;
            gray[i] = (data[j] * 77 + data[j + 1] * 151 + data[j + 2] * 28) >> 8;
        }
        return gray;
    }

    // ── Gaussian blur 5×5 ──────────────────────────────────────
    _gaussianBlur(gray, w, h) {
        const K = [1,4,7,4,1, 4,16,26,16,4, 7,26,41,26,7, 4,16,26,16,4, 1,4,7,4,1];
        const S = 273;
        const out = new Uint8Array(w * h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let s = 0;
                for (let ky = 0; ky < 5; ky++) {
                    for (let kx = 0; kx < 5; kx++) {
                        const sy = Math.min(h - 1, Math.max(0, y + ky - 2));
                        const sx = Math.min(w - 1, Math.max(0, x + kx - 2));
                        s += gray[sy * w + sx] * K[ky * 5 + kx];
                    }
                }
                out[y * w + x] = (s / S) | 0;
            }
        }
        return out;
    }

    // ── Sobel edge magnitude ───────────────────────────────────
    _sobel(gray, w, h) {
        const edges = new Float32Array(w * h);
        const g = (y, x) => gray[y * w + x];

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const gx = -g(y-1,x-1) + g(y-1,x+1)
                           - 2*g(y,x-1) + 2*g(y,x+1)
                           - g(y+1,x-1) + g(y+1,x+1);
                const gy = -g(y-1,x-1) - 2*g(y-1,x) - g(y-1,x+1)
                           + g(y+1,x-1) + 2*g(y+1,x) + g(y+1,x+1);
                edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
            }
        }
        return edges;
    }

    // ── Encontrar os 4 cantos ──────────────────────────────────
    _findCorners(edges, w, h) {
        // Threshold pelo percentil
        const vals = Array.from(edges).filter(v => v > 0).sort((a, b) => a - b);
        if (vals.length === 0) return null;
        const threshold = vals[Math.floor(vals.length * this.EDGE_THRESHOLD_PERCENT)] || 30;

        let tl = null, tr = null, bl = null, br = null;
        let minTL = Infinity, maxTR = -Infinity, minBL = Infinity, maxBR = -Infinity;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (edges[y * w + x] < threshold) continue;

                const sum  = x + y;   // min → TL, max → BR
                const diff = x - y;   // max → TR, min → BL

                if (sum  < minTL) { minTL = sum;  tl = [x, y]; }
                if (diff > maxTR) { maxTR = diff; tr = [x, y]; }
                if (diff < minBL) { minBL = diff; bl = [x, y]; }
                if (sum  > maxBR) { maxBR = sum;  br = [x, y]; }
            }
        }

        if (!tl || !tr || !bl || !br) return null;

        // Validar: área do quad deve ser suficientemente grande
        const area = this._quadArea([tl, tr, br, bl]);
        if (area < w * h * this.MIN_AREA_RATIO) return null;

        return [tl, tr, br, bl];
    }

    // ── Área de um quadrilátero (Shoelace) ────────────────────
    _quadArea(pts) {
        let area = 0;
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
        }
        return Math.abs(area) / 2;
    }

    /**
     * Renderiza a sobreposição de bordas em um canvas de overlay.
     * O overlay fica em cima do vídeo/imagem (apenas preview).
     * @param {HTMLCanvasElement} overlayCanvas
     * @param {number[][]|null} corners
     * @param {number} scaleX – proporção overlay/imagem
     * @param {number} scaleY
     */
    drawOverlay(overlayCanvas, corners, scaleX = 1, scaleY = 1) {
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        if (!corners) return;

        const pts = corners.map(([x, y]) => [x * scaleX, y * scaleY]);

        // Preenchimento semi-transparente
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        pts.slice(1).forEach(p => ctx.lineTo(...p));
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 230, 120, 0.08)';
        ctx.fill();

        // Contorno pontilhado verde
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        pts.slice(1).forEach(p => ctx.lineTo(...p));
        ctx.closePath();
        ctx.strokeStyle = '#00E678';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 5]);
        ctx.shadowColor = '#00E678';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Handles nos cantos
        pts.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#00E678';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }
}
