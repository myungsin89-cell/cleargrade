/**
 * 이미지 처리 유틸리티
 * 브라우저 Canvas를 활용하여 이미지에서 특정 영역을 잘라내어 이진화(Binarization)합니다.
 */

// A4 비율: 210 x 297
const PAGE_RATIO = 297 / 210;

/**
 * File 객체(이미지)를 HTMLImageElement로 변환
 */
export function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 이미지에서 특정 상대적 좌표 영역을 잘라내고 MNIST 전처리(28x28, 흑백 반전, 패딩, 대비증가)를 수행합니다.
 * 
 * @param {HTMLImageElement} img - 원본 스캔 이미지
 * @param {Object} boxDef - { x, y, w, h } 상대적 좌표 (0~1 비율)
 * @returns {String | Array<String>} DataURL (28x28 이미지) 또는 다중 숫자 분할 시 URL 배열
 */
export function extractBox(img, boxDef, removeBorder = false, returnMultiple = false, rawImage = false) {
    // 1. 원본 이미지에서 박스 영역 잘라내기
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    const imgW = img.width;
    const imgH = img.height;

    let sx = boxDef.x * imgW;
    let sy = boxDef.y * imgH;
    let sw = boxDef.w * imgW;
    let sh = boxDef.h * imgH;

    if (!removeBorder) {
        // 기존: 고정적으로 가장자리 15% 잘라내기 (이름, 번호칸 등에 사용)
        const marginX = sw * 0.15;
        const marginY = sh * 0.15;
        sx += marginX;
        sy += marginY;
        sw -= marginX * 2;
        sh -= marginY * 2;
    }

    sw = Math.floor(sw);
    sh = Math.floor(sh);

    tempCanvas.width = sw;
    tempCanvas.height = sh;
    tempCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    // 헤더 전체 등 통째로 잘라서 원본 그대로 쓸 경우 이진화 생략
    if (rawImage) {
        return tempCanvas.toDataURL('image/png');
    }

    // 2. 픽셀 데이터 가져오기
    const imageData = tempCtx.getImageData(0, 0, sw, sh);
    const data = imageData.data;

    // 3. 대비 향상 (Contrast Stretching) - 연필선 보정
    let minGray = 255;
    let maxGray = 0;
    const grays = new Uint8Array(sw * sh);

    for (let i = 0; i < data.length; i += 4) {
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        grays[i / 4] = avg;

        const x = (i / 4) % sw;
        const y = Math.floor((i / 4) / sw);
        // 중앙 60% 영역만 밝기 기준으로 삼아 박스 외곽 테두리 픽셀 간섭을 배제
        if (x > sw * 0.2 && x < sw * 0.8 && y > sh * 0.2 && y < sh * 0.8) {
            if (avg < minGray) minGray = avg;
            if (avg > maxGray) maxGray = avg;
        }
    }

    // 대비가 너무 낮으면(백지) 보정 생략
    if (maxGray - minGray > 30) {
        for (let i = 0; i < grays.length; i++) {
            // 정규화 (0~255)
            let val = ((grays[i] - minGray) / (maxGray - minGray)) * 255;
            if (val < 0) val = 0;
            if (val > 255) val = 255;
            grays[i] = val;
        }
    }

    // 4. 이진화 (Threshold) 및 반전 (글자가 흰색 255, 배경이 검정 0)
    // MNIST 모델은 검은 배경에 흰 글씨를 요구합니다.
    const threshold = 160; // 대비 정규화 후의 임계값

    // 테두리 제거 로직 (BFS) - 기존 로직을 흑백반전 상태에 맞게 수정
    if (removeBorder) {
        const visited = new Uint8Array(sw * sh);
        const stack = [];
        const marginEdgeX = Math.floor(sw * 0.2);
        const marginEdgeY = Math.floor(sh * 0.2);

        // 가장자리 픽셀 스택에 넣기 (반전 전 기준 어두운 색)
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                if (x < marginEdgeX || x >= sw - marginEdgeX || y < marginEdgeY || y >= sh - marginEdgeY) {
                    const idx = y * sw + x;
                    if (grays[idx] < threshold) {
                        stack.push([x, y]);
                        visited[idx] = 1;
                    }
                }
            }
        }

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const idx = y * sw + x;
            grays[idx] = 255; // 지우기 (흰색으로)

            const neighbors = [
                [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
                [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]
            ];

            for (let [nx, ny] of neighbors) {
                if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
                    const nIdx = ny * sw + nx;
                    if (!visited[nIdx]) {
                        visited[nIdx] = 1;
                        if (grays[nIdx] < threshold) {
                            stack.push([nx, ny]);
                        }
                    }
                }
            }
        }
    }

    // 최종 이진화 및 반전 적용
    for (let i = 0; i < data.length; i += 4) {
        const isText = grays[i / 4] < threshold;
        const color = isText ? 255 : 0; // 텍스트면 흰색(255), 배경이면 검은색(0)
        data[i] = color;
        data[i + 1] = color;
        data[i + 2] = color;
        data[i + 3] = 255; // Alpha
    }
    tempCtx.putImageData(imageData, 0, 0);

    // 5. 바운딩 박스 추출 및 분할 (returnMultiple에 따라 다름)
    if (returnMultiple) {
        // --- 세로 투영(Vertical Projection)을 통한 숫자 다중 분할 (수험번호 등) ---
        const isText = new Uint8Array(sw * sh);
        for (let i = 0; i < sw * sh; i++) {
            isText[i] = grays[i] < threshold ? 1 : 0;
        }

        const colSums = new Int32Array(sw);
        for (let x = 0; x < sw; x++) {
            let sum = 0;
            for (let y = 0; y < sh; y++) {
                sum += isText[y * sw + x];
            }
            colSums[x] = sum;
        }

        const segments = [];
        let inDigit = false;
        let startX = 0;
        for (let x = 0; x < sw; x++) {
            if (!inDigit && colSums[x] > 0) {
                inDigit = true;
                startX = x;
            } else if (inDigit && colSums[x] <= 0) { // 완전한 공백에서 자르기
                inDigit = false;
                segments.push({ startX: startX, endX: x - 1 });
            }
        }
        if (inDigit) {
            segments.push({ startX: startX, endX: sw - 1 });
        }

        const dataUrls = [];
        for (let seg of segments) {
            if (seg.endX - seg.startX < 2) continue; // 너무 얇은 노이즈 무시

            let minX = seg.startX;
            let maxX = seg.endX;
            let minY = sh, maxY = 0;

            for (let y = 0; y < sh; y++) {
                for (let x = minX; x <= maxX; x++) {
                    if (isText[y * sw + x]) {
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            if (minY > maxY) continue; // 빈 칸

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 28;
            finalCanvas.height = 28;
            const finalCtx = finalCanvas.getContext('2d');
            finalCtx.fillStyle = 'black';
            finalCtx.fillRect(0, 0, 28, 28);

            const textW = maxX - minX + 1;
            const textH = maxY - minY + 1;
            const scale = 20 / Math.max(textW, textH);
            const targetW = textW * scale;
            const targetH = textH * scale;
            const dx = (28 - targetW) / 2;
            const dy = (28 - targetH) / 2;

            const charCanvas = document.createElement('canvas');
            charCanvas.width = textW;
            charCanvas.height = textH;
            const charCtx = charCanvas.getContext('2d');
            const charImgData = charCtx.createImageData(textW, textH);
            for (let y = 0; y < textH; y++) {
                for (let x = 0; x < textW; x++) {
                    const idx = (y * textW + x) * 4;
                    const color = isText[(minY + y) * sw + (minX + x)] ? 255 : 0;
                    charImgData.data[idx] = color;
                    charImgData.data[idx + 1] = color;
                    charImgData.data[idx + 2] = color;
                    charImgData.data[idx + 3] = 255;
                }
            }
            charCtx.putImageData(charImgData, 0, 0);
            finalCtx.drawImage(charCanvas, dx, dy, targetW, targetH);
            dataUrls.push(finalCanvas.toDataURL('image/png'));
        }
        return dataUrls;

    } else {
        // --- 단일 칸 (문제 정답 등) ---
        let minX = sw, minY = sh, maxX = 0, maxY = 0;
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const idx = (y * sw + x) * 4;
                if (data[idx] > 0) { // 글씨 픽셀
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 28;
        finalCanvas.height = 28;
        const finalCtx = finalCanvas.getContext('2d');

        finalCtx.fillStyle = 'black';
        finalCtx.fillRect(0, 0, 28, 28);

        if (minX > maxX || minY > maxY) {
            return finalCanvas.toDataURL('image/png');
        }

        const textW = maxX - minX + 1;
        const textH = maxY - minY + 1;

        const scale = 20 / Math.max(textW, textH);
        const targetW = textW * scale;
        const targetH = textH * scale;

        const dx = (28 - targetW) / 2;
        const dy = (28 - targetH) / 2;

        finalCtx.drawImage(
            tempCanvas,
            minX, minY, textW, textH,
            dx, dy, targetW, targetH
        );

        return finalCanvas.toDataURL('image/png');
    }
}

/**
 * OMR 영역을 분석하여 가장 까맣게 칠해진 동그라미 번호를 반환합니다.
 * @param {HTMLImageElement} img - 원본 스캔 이미지
 * @param {Object} boxDef - { x, y, w, h } 상대적 좌표 (0~1 비율)
 * @param {number} choiceCount - 선택지 개수 (예: 5)
 * @returns {Object} - { text: string (선택번호), confidence: number, boxImage: string }
 */
export async function analyzeOmrBox(img, boxDef, choiceCount) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    const imgW = img.width;
    const imgH = img.height;

    let sx = boxDef.x * imgW;
    let sy = boxDef.y * imgH;
    let sw = boxDef.w * imgW;
    let sh = boxDef.h * imgH;

    sw = Math.floor(sw);
    sh = Math.floor(sh);

    tempCanvas.width = sw;
    tempCanvas.height = sh;
    tempCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const imageData = tempCtx.getImageData(0, 0, sw, sh);
    const data = imageData.data;

    // ── 실제 동그라미 위치 계산 (pdf.js 레이아웃 기반) ────────────────────
    // pdf.js: q-num=10mm, margin-right=5mm → OMR 시작=15mm from 열 왼쪽
    // boxStartX = col시작 + 14 - 1.5*(N/5) mm
    // → 박스 기준 OMR 시작 오프셋 = 15 - (14 - 1.5*N/5) = 1 + 0.3*N mm
    // 동그라미: 지름 6.5mm, 간격 2mm → 피치 8.5mm
    // boxW = 10*N mm → 픽셀 단위 변환: px/mm = sw / (10*choiceCount)

    const boxW_mm = 10 * choiceCount;
    const pxPerMm = sw / boxW_mm;

    const omrOffset_mm = 1 + 0.3 * choiceCount; // 박스 왼쪽부터 첫 동그라미 왼쪽까지
    const circleDiam_mm = 6.5;
    const circleGap_mm = 2.0;
    const pitch_mm = circleDiam_mm + circleGap_mm; // 8.5mm
    const circleR_mm = circleDiam_mm / 2;           // 3.25mm

    // Y: 박스 높이 중 동그라미가 차지하는 영역 (boxH=14mm, 동그라미=6.5mm → 상하 여백 3.75mm)
    const boxH_mm = 14;
    const circleYCenter = sh / 2; // 박스 수직 중앙
    const circleR_px = circleR_mm * pxPerMm;

    const darknessLevels = new Array(choiceCount).fill(0);
    const threshold = 180;

    for (let c = 0; c < choiceCount; c++) {
        // 동그라미 중심 X (픽셀)
        const centerX_mm = omrOffset_mm + c * pitch_mm + circleR_mm;
        const centerX = centerX_mm * pxPerMm;

        // 원형 샘플링: 동그라미 내부 픽셀만
        let darkPixelCount = 0;
        let totalPixels = 0;

        const xFrom = Math.max(0, Math.floor(centerX - circleR_px));
        const xTo = Math.min(sw - 1, Math.ceil(centerX + circleR_px));
        const yFrom = Math.max(0, Math.floor(circleYCenter - circleR_px));
        const yTo = Math.min(sh - 1, Math.ceil(circleYCenter + circleR_px));

        for (let y = yFrom; y <= yTo; y++) {
            for (let x = xFrom; x <= xTo; x++) {
                // 원 내부 판정
                const dx = x - centerX;
                const dy = y - circleYCenter;
                if (dx * dx + dy * dy > circleR_px * circleR_px) continue;

                totalPixels++;
                const idx = (y * sw + x) * 4;
                const avg = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                if (avg < threshold) darkPixelCount++;
            }
        }

        darknessLevels[c] = totalPixels > 0 ? darkPixelCount / totalPixels : 0;
    }


    // 원본 크롭 이미지는 리뷰용으로 브라우저에 표시
    const boxImage = tempCanvas.toDataURL('image/jpeg', 0.8);

    // ── 베이스라인 차감 방식 ────────────────────────────────────────────────
    // 문제: 원형 샘플링 시 인쇄된 동그라미 테두리가 모든 칸에 ~15-20% 기여
    // 해결: (N-1)개의 가장 밝은(=빈) 칸들의 평균을 "테두리 기준값"으로 삼고,
    //       그보다 얼마나 더 어두운지만 측정
    const sortedByDark = [...darknessLevels].sort((a, b) => a - b);

    // 기준값: 가장 밝은 (choiceCount-1)개의 평균 → 빈 칸들의 자연 어두움
    const nBaseline = Math.max(1, choiceCount - 1);
    const baseline = sortedByDark.slice(0, nBaseline).reduce((s, v) => s + v, 0) / nBaseline;

    // 각 칸의 초과 어두움 (베이스라인 대비)
    const excessLevels = darknessLevels.map(d => Math.max(0, d - baseline));

    let maxExcess = 0;
    let bestChoiceIndex = -1;
    for (let c = 0; c < choiceCount; c++) {
        if (excessLevels[c] > maxExcess) {
            maxExcess = excessLevels[c];
            bestChoiceIndex = c;
        }
    }

    // 최소 초과 기준: 베이스라인보다 6% 이상 어두워야 마킹으로 인정
    // (인쇄 노이즈 편차 ~2-3%보다 훨씬 높은 기준)
    const ExcessThreshold = 0.06;

    if (maxExcess >= ExcessThreshold) {
        // 신뢰도: 초과분이 ExcessThreshold의 몇 배인지 (4배=100%, 1배=40%)
        const excessRatio = maxExcess / ExcessThreshold;
        const confidence = Math.min(100, Math.round((excessRatio - 1) * 20 + 40));

        // 신뢰도 50% 미만이면 빈칸으로 (선생님이 직접 확인)
        if (confidence < 50) {
            return { text: '', confidence: Math.max(0, confidence), boxImage };
        }

        return {
            text: String(bestChoiceIndex + 1),
            confidence: Math.max(0, confidence),
            boxImage
        };
    } else {
        return { text: '', confidence: 0, boxImage };
    }
}


export function getQuestionBoxDefs(settings) {
    const A4_W = 210;
    const A4_H = 297;
    const cols = 3; // 3 columns for wider OMR boxes

    const defs = {};

    const startX = 20; // 15mm padding + 5mm margin
    const startY = 70; // 15mm padding + 10mm header-mt + 45mm header height

    const colW = 53.333; // 160 / 3 (Account for CSS Grid gaps perfectly)
    const rowH = 20;    // 10mm row height + 10mm row-gap

    settings.subjects.forEach(subject => {
        defs[subject.id] = {};
        for (let i = 1; i <= subject.questionCount; i++) {
            const row = Math.floor((i - 1) / cols);
            const col = (i - 1) % cols;

            // OMR areas are wider and taller for better alignment tolerance.
            // `q-num` text is width 10mm + 2mm margin (approx 12-14 mm offset).
            const colGap = 5; // CSS .q-grid column-gap: 5mm
            const boxW = 10 * settings.choiceCount; // Box width scales with choiceCount, expanded from 8.5mm to 10mm
            const boxH = 14; // 14mm: q-item 10mm + 상하 여유 2mm씩

            // 각 q-item의 높이는 10mm, 중심은 row 시작 + 5mm
            // boxH=14mm이면 위로 2mm 올려야 중심이 맞음: 5 - 7 = -2 → 약 -1~-2 사용
            const boxStartX = startX + (col * (colW + colGap)) + 14 - (1.5 * (settings.choiceCount / 5));
            const boxStartY = startY + (row * rowH) - 2.0; // q-item 중심(+5mm) 기준 boxH/2 만큼 위로

            defs[subject.id][i] = {
                x: boxStartX / A4_W,
                y: boxStartY / A4_H,
                w: boxW / A4_W,
                h: boxH / A4_H
            };
        }
    });

    return defs;
}

// Header 영역 전체 박스 (과목명, 학번, 이름 등 한 번에 추출용)
export const headerBoxDef = {
    x: 0,
    y: 0,
    w: 1,
    h: 80 / 297
};

// 기존의 분할 칸들은 하위 호환성을 위해 유지하거나 제거해도 무방
export const studentNumberBoxDef = {
    x: 55 / 210,
    y: 46 / 297,
    w: 40 / 210,
    h: 14 / 297
};

// 학생 이름 칸 위치 (Centered in header)
export const studentNameBoxDef = {
    x: 115 / 210,
    y: 46 / 297,
    w: 40 / 210,
    h: 14 / 297
};

// 과목명 칸 위치 추정 (현재 미사용)
export const subjectTitleBoxDef = {
    x: 0,
    y: 25 / 297,
    w: 1,
    h: 20 / 297
};

// =============================================================================
// 코너 마커 탐지 및 좌표 보정
// =============================================================================

// A4 답안지에서 마커의 이상적인 위치 (mm 단위)
// pdf.js 기준: .marker { width: 20px, height: 20px } ≈ 7mm
// .marker.tl { top: 15mm; left: 15mm; }  → 중심: (18.5, 18.5)
// .marker.tr { top: 15mm; right: 15mm; } → 중심: (191.5, 18.5)
// .marker.bl { bottom: 15mm; left: 15mm;} → 중심: (18.5, 278.5)
// .marker.br { bottom: 15mm; right: 15mm;} → 중심: (191.5, 278.5)
const IDEAL_MARKERS_MM = {
    tl: { x: 18.5 / 210, y: 18.5 / 297 },
    tr: { x: 191.5 / 210, y: 18.5 / 297 },
    bl: { x: 18.5 / 210, y: 278.5 / 297 },
    br: { x: 191.5 / 210, y: 278.5 / 297 },
};

/**
 * 이미지의 4개 코너 영역에서 검은 원형 마커의 무게중심 좌표를 탐지합니다.
 * 
 * @param {HTMLImageElement} img
 * @returns {{ tl, tr, bl, br } | null} 픽셀 좌표 (0~1 상대값) 또는 실패 시 null
 */
export function detectMarkers(img) {
    const canvas = document.createElement('canvas');
    // 탐지 속도를 위해 축소된 해상도로 작업
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const w = Math.floor(img.width * scale);
    const h = Math.floor(img.height * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // 그레이스케일 변환 + 어두운 픽셀 마스크 (임계값 80: 매우 검은 픽셀만)
    const dark = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        dark[i] = gray < 80 ? 1 : 0;
    }

    /**
     * 지정된 코너 영역(전체 이미지의 25% × 25% 구역)에서
     * 가장 큰 어두운 픽셀 클러스터의 무게중심을 반환합니다.
     */
    function findMarkerInRegion(rxStart, rxEnd, ryStart, ryEnd) {
        const xS = Math.floor(rxStart * w);
        const xE = Math.floor(rxEnd * w);
        const yS = Math.floor(ryStart * h);
        const yE = Math.floor(ryEnd * h);

        // BFS로 클러스터 탐지
        const visited = new Uint8Array(w * h);
        let bestCluster = null;
        let bestSize = 0;

        for (let py = yS; py < yE; py++) {
            for (let px = xS; px < xE; px++) {
                const idx = py * w + px;
                if (!dark[idx] || visited[idx]) continue;

                // BFS 시작
                const queue = [[px, py]];
                visited[idx] = 1;
                let sumX = 0, sumY = 0, size = 0;

                let head = 0;
                while (head < queue.length) {
                    const [cx, cy] = queue[head++];
                    sumX += cx;
                    sumY += cy;
                    size++;

                    const neighbors = [
                        [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
                    ];
                    for (const [nx, ny] of neighbors) {
                        if (nx >= xS && nx < xE && ny >= yS && ny < yE) {
                            const nIdx = ny * w + nx;
                            if (dark[nIdx] && !visited[nIdx]) {
                                visited[nIdx] = 1;
                                queue.push([nx, ny]);
                            }
                        }
                    }
                }

                if (size > bestSize) {
                    bestSize = size;
                    bestCluster = { x: sumX / size, y: sumY / size, size };
                }
            }
        }

        // 클러스터가 너무 작으면 노이즈로 간주 (최소 픽셀 수: 80으로 상향)
        if (!bestCluster || bestCluster.size < 80) return null;

        // 이미지 전체 기준 상대 좌표(0~1)로 변환
        return {
            x: bestCluster.x / w,
            y: bestCluster.y / h,
            size: bestCluster.size,
        };
    }

    // 각 코너 구역에서 마커 탐지 (이미지의 20% 구역씩 - 더 좁은 범위로 정확도 향상)
    const tl = findMarkerInRegion(0, 0.20, 0, 0.20);
    const tr = findMarkerInRegion(0.80, 1, 0, 0.20);
    const bl = findMarkerInRegion(0, 0.20, 0.80, 1);
    const br = findMarkerInRegion(0.80, 1, 0.80, 1);

    if (!tl || !tr || !bl || !br) {
        console.warn('[마커 탐지] 일부 마커를 찾지 못했습니다:', { tl, tr, bl, br });
        return null;
    }

    // ── 탐지된 마커 유효성 검증 ───────────────────────────────────────────
    // 실제 마커가 이루는 사각형의 가로:세로 비율이 A4 기준과 비슷한지 확인
    // A4 기준 마커 간격: 너비 173mm / 높이 260mm ≈ 0.665
    const markerW = ((tr.x - tl.x) + (br.x - bl.x)) / 2; // 좌우 평균 너비
    const markerH = ((bl.y - tl.y) + (br.y - tr.y)) / 2; // 상하 평균 높이

    if (markerH < 0.001) {
        console.warn('[마커 탐지] 유효하지 않은 마커 위치 (높이 0)');
        return null;
    }

    const aspectRatio = markerW / markerH;
    const EXPECTED_RATIO = 173 / 260; // ≈ 0.665
    const RATIO_TOLERANCE = 0.15; // ±15% 허용

    if (Math.abs(aspectRatio - EXPECTED_RATIO) > RATIO_TOLERANCE) {
        console.warn(`[마커 탐지] 비율 불일치 (탐지 ${aspectRatio.toFixed(3)}, 기대 ${EXPECTED_RATIO.toFixed(3)}). 폴백.`);
        return null;
    }

    console.log(`[마커 탐지 성공] 비율: ${aspectRatio.toFixed(3)}`, { tl, tr, bl, br });
    return { tl, tr, bl, br };
}


/**
 * 탐지된 마커 좌표를 기반으로 OMR 박스 정의를 보정합니다.
 * 
 * 원리: 두 좌표계(이상적 마커 위치 <-> 탐지된 마커 위치) 사이의
 * 쌍선형 보간(bilinear interpolation)으로 임의의 좌표를 변환합니다.
 * 
 * @param {Object} boxDef - { x, y, w, h } 상대 좌표 (기존 하드코딩)
 * @param {{ tl, tr, bl, br }} markers - detectMarkers() 반환값
 * @returns {Object} 보정된 { x, y, w, h }
 */
export function applyMarkerCorrection(boxDef, markers) {
    const ideal = IDEAL_MARKERS_MM;

    /**
     * 쌍선형 보간: 이상적 좌표계의 점 (px, py)를
     * 탐지된 마커 좌표계로 변환합니다.
     */
    function transformPoint(px, py) {
        // 이상적 마커 사각형 기준 내 상대 위치 계산
        const idealW = ideal.tr.x - ideal.tl.x;
        const idealH = ideal.bl.y - ideal.tl.y;

        const u = (px - ideal.tl.x) / idealW; // 0~1 (좌→우)
        const v = (py - ideal.tl.y) / idealH; // 0~1 (위→아래)

        // 쌍선형 보간으로 탐지된 마커 좌표계 위치 계산
        const x =
            (1 - u) * (1 - v) * markers.tl.x +
            u * (1 - v) * markers.tr.x +
            (1 - u) * v * markers.bl.x +
            u * v * markers.br.x;

        const y =
            (1 - u) * (1 - v) * markers.tl.y +
            u * (1 - v) * markers.tr.y +
            (1 - u) * v * markers.bl.y +
            u * v * markers.br.y;

        return { x, y };
    }

    // 박스의 네 꼭짓점을 변환
    const topLeft = transformPoint(boxDef.x, boxDef.y);
    const topRight = transformPoint(boxDef.x + boxDef.w, boxDef.y);
    const bottomLeft = transformPoint(boxDef.x, boxDef.y + boxDef.h);

    return {
        x: topLeft.x,
        y: topLeft.y,
        w: topRight.x - topLeft.x,
        h: bottomLeft.y - topLeft.y,
    };
}
