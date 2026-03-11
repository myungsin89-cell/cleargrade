/**
 * Tesseract.js API 기반 로컬 OCR
 */

let worker = null;

/**
 * 스캔 화면 로드 시 OCR 엔진(Worker) 초기화 및 로드 미리 진행
 */
export async function initTesseract() {
    if (worker) return true; // 이미 로딩됨

    try {
        console.log('[OCR] Tesseract.js 로컬 엔진 초기화 중...');
        worker = await Tesseract.createWorker('kor+eng', 1, {
            logger: m => {
                // console.log(m); // 진행률 확인하고 싶을 때 주석 해제
            }
        });
        // 인식 최적화: 문서(단일 블록) 모드로 설정
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });
        console.log('[OCR] Tesseract.js 엔진 로딩 성공');
        return true;
    } catch (e) {
        console.error('[OCR] Tesseract.js 초기화 실패:', e);
        worker = null;
        return false;
    }
}

/**
 * 하위 호환성 위해 남겨둔 함수. 현재 사용하지 않음.
 */
export async function recognizeDigit(dataUrl) {
    return { text: '', confidence: 0 };
}

/**
 * 단어 단위 인식 (학번, 과목명 등에 사용).
 * @param {string} dataUrl - 크롭된 헤더 DataURL 이미지
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function recognizeWord(dataUrl) {
    if (!worker) {
        console.warn('Tesseract Worker가 초기화되지 않았습니다. OCR 인식을 건너뜁니다.');
        return { text: '', confidence: 0 };
    }

    try {
        const { data: { text, confidence } } = await worker.recognize(dataUrl);
        // 공백, 빈줄 제거하여 리턴
        let recognizedText = text.trim().replace(/[\s\n\r]/g, '');
        return {
            text: recognizedText,
            confidence: confidence // 0 ~ 100
        };
    } catch (e) {
        console.error('[OCR] Tesseract 처리 실패', e);
        return { text: '', confidence: 0 };
    }
}

/**
 * 제목 전용 인식 (과목명 + 시험명).
 * PSM을 SINGLE_LINE으로 임시 전환하여 한 줄 텍스트에 최적화.
 * @param {string} dataUrl - 크롭된 제목 영역 DataURL 이미지
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function recognizeTitle(dataUrl) {
    if (!worker) {
        console.warn('Tesseract Worker가 초기화되지 않았습니다.');
        return { text: '', confidence: 0 };
    }

    try {
        // 제목은 한 줄이므로 SINGLE_LINE 모드가 더 정확
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
        const { data: { text, confidence } } = await worker.recognize(dataUrl);
        // 원래 모드로 복원
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });

        let recognizedText = text.trim().replace(/[\s\n\r]/g, '');
        return {
            text: recognizedText,
            confidence: confidence
        };
    } catch (e) {
        console.error('[OCR] 제목 인식 실패', e);
        return { text: '', confidence: 0 };
    }
}

/**
 * 메모리 해제용 함수 (스캔 완료 후 호출)
 */
export async function terminateTesseract() {
    if (worker) {
        console.log('[OCR] Tesseract.js 자원 해제 완료');
        await worker.terminate();
        worker = null;
    }
}
