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
 * 이미지에서 특정 상대적 좌표 영역을 잘라내고 흑백(이진화) 변환하여 DataURL로 반환
 * 
 * @param {HTMLImageElement} img - 원본 스캔 이미지
 * @param {Object} boxDef - { x, y, w, h } 상대적 좌표 (0~1 비율)
 * @returns {String} DataURL
 */
export function extractBox(img, boxDef, removeBorder = false) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

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

    canvas.width = sw;
    canvas.height = sh;

    // 원본에서 잘라서 캔버스에 그리기
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    // 이진화(Binarization) 처리
    const imageData = ctx.getImageData(0, 0, sw, sh);
    const data = imageData.data;
    const threshold = 180; // 임계값

    for (let i = 0; i < data.length; i += 4) {
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const color = avg > threshold ? 255 : 0;
        data[i] = color; // R
        data[i + 1] = color; // G
        data[i + 2] = color; // B
    }

    if (removeBorder) {
        // 박스 테두리에 걸친 검은색 섬(Border Line)을 동적으로 찾아 지우기 (BFS)
        // 화면 가장자리 10% 두께 안쪽에 닿아있는 검은색 픽셀들을 타겟으로 삼음
        const stack = [];
        const visited = new Uint8Array(sw * sh);
        const marginEdgeX = Math.floor(sw * 0.2);
        const marginEdgeY = Math.floor(sh * 0.2);

        // 상하좌우 가장자리 픽셀들 중 검은색을 스택에 추가
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                if (x < marginEdgeX || x >= sw - marginEdgeX || y < marginEdgeY || y >= sh - marginEdgeY) {
                    const idx = (y * sw + x) * 4;
                    if (data[idx] === 0) {
                        stack.push([x, y]);
                        visited[y * sw + x] = 1;
                    }
                }
            }
        }

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const idx = (y * sw + x) * 4;
            
            // 검은색을 흰색으로 지움
            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;

            // 상하좌우 탐색
            const neighbors = [
                [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
                [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]
            ];

            for (let [nx, ny] of neighbors) {
                if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
                    const nIdx = ny * sw + nx;
                    if (!visited[nIdx]) {
                        visited[nIdx] = 1;
                        if (data[nIdx * 4] === 0) {
                            stack.push([nx, ny]);
                        }
                    }
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
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
