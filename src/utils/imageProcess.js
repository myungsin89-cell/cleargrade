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
 * @returns {String} DataURL (28x28 이미지)
 */
export function extractBox(img, boxDef, removeBorder = false) {
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
        if (avg < minGray) minGray = avg;
        if (avg > maxGray) maxGray = avg;
    }

    // 대비가 너무 낮으면(백지) 보정 생략
    if (maxGray - minGray > 30) {
        for (let i = 0; i < grays.length; i++) {
            // 정규화 (0~255)
            let val = ((grays[i] - minGray) / (maxGray - minGray)) * 255;
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

    // 5. 바운딩 박스(Bounding Box) 추출 - 글씨가 있는 영역만 타이트하게 잘라냄
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

    // 6. 28x28 최종 캔버스에 그리기 (패딩 포함)
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 28;
    finalCanvas.height = 28;
    const finalCtx = finalCanvas.getContext('2d');
    
    // 검은색 배경 채우기
    finalCtx.fillStyle = 'black';
    finalCtx.fillRect(0, 0, 28, 28);

    // 글씨가 없으면 빈 이미지 반환
    if (minX > maxX || minY > maxY) {
        return finalCanvas.toDataURL('image/png');
    }

    const textW = maxX - minX + 1;
    const textH = maxY - minY + 1;

    // 긴 변을 20픽셀(전체 28에서 4픽셀씩 여백)로 맞춤
    const scale = 20 / Math.max(textW, textH);
    const targetW = textW * scale;
    const targetH = textH * scale;

    // 정가운데 위치 계산
    const dx = (28 - targetW) / 2;
    const dy = (28 - targetH) / 2;

    // 타이트하게 잘라낸 부분을 28x28 캔버스 가운데에 스케일링하여 그리기
    finalCtx.drawImage(
        tempCanvas, 
        minX, minY, textW, textH, 
        dx, dy, targetW, targetH
    );

    return finalCanvas.toDataURL('image/png');
}

export function getQuestionBoxDefs(settings) {
    const A4_W = 210;
    const A4_H = 297;
    const cols = 5;

    const defs = {};

    // Exact grid physical start
    const startX = 25; // 15mm padding + 10mm margin
    const startY = 75; // 15mm padding + 10mm header-mt + 50mm header height

    const colW = 32; // (210 - 30 - 20) / 5
    const rowH = 23; // 15mm q-box + 8mm row gap

    settings.subjects.forEach(subject => {
        defs[subject.id] = {};
        for (let i = 1; i <= subject.questionCount; i++) {
            const row = Math.floor((i - 1) / cols);
            const col = (i - 1) % cols;

            // 물리적인 박스는 15x15mm 이지만, 프린터 배율 축소(Fit to page)나 스캔 오차를 감안해 
            // 23x23mm의 넉넉한 영역을 스캔하고 BFS 로직으로 테두리만 동적으로 지웁니다.
            defs[subject.id][i] = {
                x: (startX + (col * colW) + 12) / A4_W,
                y: (startY + (row * rowH) - 4) / A4_H,
                w: 23 / A4_W,
                h: 23 / A4_H
            };
        }
    });

    return defs;
}

// 학생 번호 칸 위치
export const studentNumberBoxDef = {
    x: 95 / 210,
    y: 58 / 297,
    w: 40 / 210,
    h: 14 / 297
};

// 학생 이름 칸 위치
export const studentNameBoxDef = {
    x: 145 / 210,
    y: 58 / 297,
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
