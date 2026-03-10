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
        grays[i/4] = avg;

        const x = (i/4) % sw;
        const y = Math.floor((i/4) / sw);
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
        const isText = grays[i/4] < threshold;
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
                segments.push({startX: startX, endX: x - 1});
            }
        }
        if (inDigit) {
            segments.push({startX: startX, endX: sw - 1});
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
                    charImgData.data[idx+1] = color;
                    charImgData.data[idx+2] = color;
                    charImgData.data[idx+3] = 255;
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

    const segmentWidth = sw / choiceCount;
    const darknessLevels = new Array(choiceCount).fill(0);
    const threshold = 180; 

    // OMR 동그라미 내의 픽셀만 계산 (위아래 여백 배제)
    const yStart = Math.floor(sh * 0.2);
    const yEnd = Math.floor(sh * 0.8);

    for (let c = 0; c < choiceCount; c++) {
        // 좌우 여백 배제
        const segStart = Math.floor(c * segmentWidth + segmentWidth * 0.25); 
        const segEnd = Math.floor((c + 1) * segmentWidth - segmentWidth * 0.25);
        
        let darkPixelCount = 0;
        let totalSegmentPixels = Math.max(1, (segEnd - segStart) * (yEnd - yStart));

        for (let y = yStart; y < yEnd; y++) {
            for (let x = segStart; x < segEnd; x++) {
                const idx = (y * sw + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const avg = (r + g + b) / 3;
                
                if (avg < threshold) {
                    darkPixelCount++;
                }
            }
        }
        
        darknessLevels[c] = darkPixelCount / totalSegmentPixels;
    }

    let maxDarkness = 0;
    let bestChoiceIndex = -1;

    for (let c = 0; c < choiceCount; c++) {
        if (darknessLevels[c] > maxDarkness) {
            maxDarkness = darknessLevels[c];
            bestChoiceIndex = c;
        }
    }

    // 원본 크롭 이미지는 리뷰용으로 브라우저에 표시
    const boxImage = tempCanvas.toDataURL('image/jpeg', 0.8);
    const FillThreshold = 0.20; // 20% 이상 채워졌으면 마킹으로 간주
    
    if (maxDarkness > FillThreshold) {
        return {
            text: String(bestChoiceIndex + 1),
            confidence: Math.min(100, Math.round(maxDarkness * 100 * 2.5)),
            boxImage: boxImage
        };
    } else {
        return {
            text: '', // 미기입
            confidence: 0,
            boxImage: boxImage
        };
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

            // OMR areas are wider. 
            // `q-num` text is width 10mm + 2mm margin (approx 12-14 mm offset).
            const boxStartX = startX + (col * colW) + 14; 
            const boxStartY = startY + (row * rowH) + 1; // Center vertically on the line
            const boxW = 8.5 * settings.choiceCount; // Box width scales with choiceCount, approx 8.5mm per choice
            const boxH = 9; // Height to capture 6.5mm circles

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
    h: 70 / 297
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
