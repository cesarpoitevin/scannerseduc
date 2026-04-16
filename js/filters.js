// ============================================================
//  ImageFilters – Filtros e ajustes de imagem
// ============================================================

class ImageFilters {

    /**
     * Aplica filtro e ajustes a um canvas.
     * @param {HTMLCanvasElement} srcCanvas
     * @param {object} settings
     *   filter:     'color' | 'gray' | 'bw'
     *   brightness: -100 … 100
     *   contrast:   -100 … 100
     *   blur:        0 … 10
     *   rotation:    0 | 90 | 180 | 270
     * @returns {HTMLCanvasElement}
     */
    apply(srcCanvas, settings) {
        const { filter = 'color', brightness = 0, contrast = 0, blur = 0, rotation = 0 } = settings;

        // 1. Rotação
        let canvas = this._rotate(srcCanvas, rotation);

        // 2. Obter pixels
        const ctx  = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        // 3. Filtro de cor
        if (filter === 'gray') {
            this._grayscale(d);
        } else if (filter === 'bw') {
            this._blackWhite(d, this._calcBWThreshold(d));
        }

        // 4. Brilho + Contraste
        if (brightness !== 0 || contrast !== 0) {
            this._brightnessContrast(d, brightness, contrast);
        }

        ctx.putImageData(imgData, 0, 0);

        // 5. Suavização (blur) via CSS filter → novo canvas
        if (blur > 0) {
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width  = canvas.width;
            blurCanvas.height = canvas.height;
            const bctx = blurCanvas.getContext('2d');
            bctx.filter = `blur(${blur * 0.6}px)`;
            bctx.drawImage(canvas, 0, 0);
            bctx.filter = 'none';
            return blurCanvas;
        }

        return canvas;
    }

    // ── Rotação em múltiplos de 90° ────────────────────────────
    _rotate(canvas, degrees) {
        const deg = ((degrees % 360) + 360) % 360;
        if (deg === 0) return canvas;

        const swap   = deg === 90 || deg === 270;
        const outW   = swap ? canvas.height : canvas.width;
        const outH   = swap ? canvas.width  : canvas.height;

        const out = document.createElement('canvas');
        out.width  = outW;
        out.height = outH;
        const ctx  = out.getContext('2d');

        ctx.translate(outW / 2, outH / 2);
        ctx.rotate((deg * Math.PI) / 180);
        ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        return out;
    }

    // ── Escala de cinza ────────────────────────────────────────
    _grayscale(d) {
        for (let i = 0; i < d.length; i += 4) {
            const g = (d[i]*77 + d[i+1]*151 + d[i+2]*28) >> 8;
            d[i] = d[i+1] = d[i+2] = g;
        }
    }

    // ── Preto e branco adaptativo ──────────────────────────────
    _blackWhite(d, threshold) {
        for (let i = 0; i < d.length; i += 4) {
            const g  = (d[i]*77 + d[i+1]*151 + d[i+2]*28) >> 8;
            const bw = g > threshold ? 255 : 0;
            d[i] = d[i+1] = d[i+2] = bw;
        }
    }

    // Threshold automático usando método de Otsu simplificado
    _calcBWThreshold(d) {
        const hist = new Int32Array(256);
        const total = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
            hist[(d[i]*77 + d[i+1]*151 + d[i+2]*28) >> 8]++;
        }
        let sumAll = 0;
        for (let t = 0; t < 256; t++) sumAll += t * hist[t];

        let sumB = 0, wB = 0, best = 0, bestT = 128;
        for (let t = 0; t < 256; t++) {
            wB += hist[t];
            if (wB === 0) continue;
            const wF = total - wB;
            if (wF === 0) break;
            sumB += t * hist[t];
            const mB = sumB / wB;
            const mF = (sumAll - sumB) / wF;
            const v  = wB * wF * (mB - mF) * (mB - mF);
            if (v > best) { best = v; bestT = t; }
        }
        return bestT;
    }

    // ── Brilho e Contraste ─────────────────────────────────────
    _brightnessContrast(d, brightness, contrast) {
        // brightness: -100 .. +100  → adiciona ±255 * b/100
        // contrast:   -100 .. +100  → fator de escala
        const br = brightness * 2.55;
        const ct = contrast / 100;
        // Fórmula padrão de contraste
        const f = (259 * (ct * 255 + 255)) / (255 * (259 - ct * 255));

        for (let i = 0; i < d.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                let v = d[i + c];
                v = v + br;                       // brilho
                v = f * (v - 128) + 128;          // contraste
                d[i + c] = Math.max(0, Math.min(255, v)) | 0;
            }
        }
    }
}
