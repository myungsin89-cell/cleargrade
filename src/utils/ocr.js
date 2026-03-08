import Tesseract from 'tesseract.js';

let worker = null;

/**
 * Tesseract 워커 초기화 (최초 1회 실행 후 재사용)
 */
export async function initTesseract() {
    if (worker) return worker;

    worker = await Tesseract.createWorker('kor+eng');

    // 단일 숫자 모드로 설정 (1~5 정답용)
    await worker.setParameters({
        tessedit_char_whitelist: '0123456789', // 숫자로만 제한
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR, // 단일 문자 모드
    });

    return worker;
}

/**
 * 이미지 Data URL에서 텍스트(숫자)를 추출합니다.
 */
export async function recognizeDigit(dataUrl) {
    const tesseractWorker = await initTesseract();
    const { data: { text, confidence } } = await tesseractWorker.recognize(dataUrl);

    return {
        text: text.trim(),
        confidence: confidence
    };
}

/**
 * 학생 번호 등 여러 글씨가 있을 수 있는 박스 인식
 */
export async function recognizeWord(dataUrl) {
    if (!worker) {
        worker = await Tesseract.createWorker('kor+eng');
    }
    // 파라미터를 일반 단어 모드로 임시 변경
    await worker.setParameters({
        tessedit_char_whitelist: '', // 화이트리스트 해제 (한글 등 포함)
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
    });

    const { data: { text, confidence } } = await worker.recognize(dataUrl);

    // 다시 단일 숫자 모드로 복귀
    await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR,
    });

    return {
        text: text.replace(/\\s+/g, ''),
        confidence: confidence
    };
}

/**
 * 워커 종료 (메모리 해제)
 */
export async function terminateTesseract() {
    if (worker) {
        await worker.terminate();
        worker = null;
    }
}
