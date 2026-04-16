// ============================================================
//  PerspectiveTransformer – Correção de perspectiva (achate)
// ============================================================

class PerspectiveTransformer {

    /**
     * Aplica correção de perspectiva em um canvas, dado os 4 cantos do documento.
     * @param {HTMLCanvasElement} srcCanvas – imagem original
     * @param {number[][]} corners – [TL, TR, BR, BL] em coordenadas do srcCanvas
     * @returns {HTMLCanvasElement}
     */
    /**
     * Limite de pixels para o loop pixel-a-pixel.
     * 800×600 = 480 000 px ≈ < 1s em mobile.
     * O resultado ainda tem qualidade excelente para PDF.
     */
    static MAX_PIXELS = 480_000;

    warp(srcCanvas, corners) {
        const [tl, tr, br, bl] = corners;

        // Dimensões naturais de saída (baseadas nos lados do quad)
        const wTop    = Math.hypot(tr[0]-tl[0], tr[1]-tl[1]);
        const wBottom = Math.hypot(br[0]-bl[0], br[1]-bl[1]);
        const hLeft   = Math.hypot(bl[0]-tl[0], bl[1]-tl[1]);
        const hRight  = Math.hypot(br[0]-tr[0], br[1]-tr[1]);

        const rawW = Math.round(Math.max(wTop, wBottom));
        const rawH = Math.round(Math.max(hLeft, hRight));

        // ── Limitar resolução para não travar em mobile ──────────
        const pxScale = Math.min(1, Math.sqrt(PerspectiveTransformer.MAX_PIXELS / (rawW * rawH)));
        const outW = Math.max(1, Math.round(rawW * pxScale));
        const outH = Math.max(1, Math.round(rawH * pxScale));

        // Escalar source canvas e corners pelo mesmo fator
        let src = srcCanvas;
        let sc  = corners;
        if (pxScale < 0.999) {
            src = document.createElement('canvas');
            src.width  = Math.round(srcCanvas.width  * pxScale);
            src.height = Math.round(srcCanvas.height * pxScale);
            src.getContext('2d').drawImage(srcCanvas, 0, 0, src.width, src.height);
            sc = corners.map(([x, y]) => [x * pxScale, y * pxScale]);
        }

        // Pontos de destino (retângulo perfeito)
        const dst = [[0, 0], [outW-1, 0], [outW-1, outH-1], [0, outH-1]];

        // Homografia inversa: dst → src (mapeamento inverso)
        const H = this._computeHomography(dst, sc);

        // Criar canvas de saída
        const dstCanvas = document.createElement('canvas');
        dstCanvas.width  = outW;
        dstCanvas.height = outH;

        const srcCtx  = src.getContext('2d');
        const srcData = srcCtx.getImageData(0, 0, src.width, src.height);
        const dstCtx  = dstCanvas.getContext('2d');
        const dstData = dstCtx.createImageData(outW, outH);

        const sw = src.width;
        const sh = src.height;

        for (let dy = 0; dy < outH; dy++) {
            for (let dx = 0; dx < outW; dx++) {
                const [sx, sy] = this._applyH(H, dx, dy);
                const pixel    = this._bilinear(srcData.data, sw, sh, sx, sy);
                const i        = (dy * outW + dx) * 4;
                dstData.data[i]     = pixel[0];
                dstData.data[i + 1] = pixel[1];
                dstData.data[i + 2] = pixel[2];
                dstData.data[i + 3] = 255;
            }
        }

        dstCtx.putImageData(dstData, 0, 0);
        return dstCanvas;
    }

    // ── Homografia via DLT (Direct Linear Transform) ──────────
    // Resolve o sistema 8×8: A·h = b   (h9 = 1)
    _computeHomography(srcPts, dstPts) {
        const A = [];
        const b = [];

        for (let i = 0; i < 4; i++) {
            const [x,  y]  = srcPts[i];
            const [xp, yp] = dstPts[i];

            A.push([x, y, 1, 0, 0, 0, -x*xp, -y*xp]);
            b.push(xp);

            A.push([0, 0, 0, x, y, 1, -x*yp, -y*yp]);
            b.push(yp);
        }

        const h = this._gauss(A, b);

        return [
            [h[0], h[1], h[2]],
            [h[3], h[4], h[5]],
            [h[6], h[7], 1],
        ];
    }

    // ── Eliminação de Gauss-Jordan com pivô parcial ────────────
    _gauss(A, b) {
        const n = b.length;
        // Matriz aumentada
        const M = A.map((row, i) => [...row, b[i]]);

        for (let col = 0; col < n; col++) {
            // Pivô parcial
            let maxRow = col;
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
            }
            [M[col], M[maxRow]] = [M[maxRow], M[col]];

            if (Math.abs(M[col][col]) < 1e-12) continue; // singular

            // Eliminar todas as linhas (Gauss-Jordan → solução direta)
            for (let row = 0; row < n; row++) {
                if (row === col) continue;
                const f = M[row][col] / M[col][col];
                for (let j = col; j <= n; j++) {
                    M[row][j] -= f * M[col][j];
                }
            }
        }

        return M.map((row, i) => row[n] / row[i]);
    }

    // ── Aplicar matriz H a um ponto ────────────────────────────
    _applyH(H, x, y) {
        const w  = H[2][0]*x + H[2][1]*y + H[2][2];
        const sx = (H[0][0]*x + H[0][1]*y + H[0][2]) / w;
        const sy = (H[1][0]*x + H[1][1]*y + H[1][2]) / w;
        return [sx, sy];
    }

    // ── Interpolação bilinear ──────────────────────────────────
    _bilinear(data, w, h, x, y) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const x1 = x0 + 1,       y1 = y0 + 1;
        const fx  = x - x0,      fy  = y - y0;

        if (x0 < 0 || y0 < 0 || x1 >= w || y1 >= h) {
            return [255, 255, 255]; // branco fora dos limites
        }

        const idx = (r, c) => (r * w + c) * 4;
        const i00 = idx(y0, x0), i01 = idx(y0, x1);
        const i10 = idx(y1, x0), i11 = idx(y1, x1);

        return [0, 1, 2].map(c =>
            data[i00+c]*(1-fx)*(1-fy) +
            data[i01+c]*fx*(1-fy) +
            data[i10+c]*(1-fx)*fy +
            data[i11+c]*fx*fy
        );
    }
}
