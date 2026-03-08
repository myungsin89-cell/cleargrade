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
export function extractBox(img, boxDef) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 원본 이미지의 크기
    const imgW = img.width;
    const imgH = img.height;

    // 잘라낼 실제 픽셀 영역
    // 약간 안쪽으로 잘라서 테두리 선(border)을 제외시킴 (+여백)
    const marginX = (boxDef.w * imgW) * 0.15;
    const marginY = (boxDef.h * imgH) * 0.15;

    const sx = (boxDef.x * imgW) + marginX;
    const sy = (boxDef.y * imgH) + marginY;
    const sw = (boxDef.w * imgW) - (marginX * 2);
    const sh = (boxDef.h * imgH) - (marginY * 2);

    canvas.width = sw;
    canvas.height = sh;

    // 원본에서 잘라서 캔버스에 그리기
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    // 이진화(Binarization) 처리
    const imageData = ctx.getImageData(0, 0, sw, sh);
    const data = imageData.data;
    const threshold = 180; // 임계값

    for (let i = 0; i < data.length; i += 4) {
        // Grayscale: 0.299*R + 0.587*G + 0.114*B
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        // 임계값보다 밝으면 흰색, 어두우면 검은색
        const color = avg > threshold ? 255 : 0;

        data[i] = color; // R
        data[i + 1] = color; // G
        data[i + 2] = color; // B
        // data[i+3] 은 Alpha (그대로 255 유지)
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/png');
}

/**
 * PDF 생성 로직(pdf.js)의 물리적 길이를 기반으로 상대적 비율 산출
 * mm 단위를 기반으로 화면(0~1) 비율을 계산합니다.
 */
export function getQuestionBoxDefs(settings) {
    const A4_W = 210;
    const A4_H = 297;
    const cols = 5;

    const defs = {};

    // .q-grid 는 margin: 0 10mm;
    // padding 15mm 가 있으므로, grid의 시작 X = 15 + 10 = 25mm 
    // grid의 총 너비 = 210 - (15*2) - (10*2) = 160mm

    // CSS Grid: repeat(5, 1fr), gap: 15px 10px (row gap, column gap)
    // 15px/10px 을 mm로 환산해 추정하기 보다, 균등 분할로 근사치 적용 (OCR은 여유 있게 잡음)

    const startX = 25 / A4_W;
    // 눈대중으로 헤더 높이는 대략 60mm 정도 차지 (padding 15 + margin-top 10 + h1/h2 30 + mb 20 ? 좀 짧게)
    // 안전하게 실제 그려진 DOM 비율을 모방하는 방식을 채택
    // 여기서는 대략적인 비율로 Grid 위치를 정의합니다.
    const startY = 75 / A4_H;

    const colW = (160 / cols) / A4_W;
    const rowH = 20 / A4_H; // 대략 행당 높이

    settings.subjects.forEach(subject => {
        defs[subject.id] = {};
        for (let i = 1; i <= subject.questionCount; i++) {
            const row = Math.floor((i - 1) / cols);
            const col = (i - 1) % cols;

            // 문제 칸(q-box)은 아이템의 오른쪽에 위치
            // q-num 폭, 간격 제외하고 대략 아이템 너비의 우측 60% 로 가정
            defs[subject.id][i] = {
                x: startX + (col * colW) + (colW * 0.4),
                y: startY + (row * rowH),
                w: 15 / A4_W, // 실제 1.5cm 박스
                h: 15 / A4_H
            };
        }
    });

    return defs;
}

// 학생 번호 칸 위치 추정 (우상단)
export const studentNumberBoxDef = {
    x: 150 / 210,
    y: 40 / 297,
    w: 30 / 210,
    h: 15 / 297
};

// 과목명 칸 위치 추정
export const subjectTitleBoxDef = {
    x: 0,
    y: 25 / 297,
    w: 1,
    h: 20 / 297
};
