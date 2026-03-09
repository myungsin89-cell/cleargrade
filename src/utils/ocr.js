/**
 * Google Cloud Vision API 기반 OCR
 */

import { getSettings } from '../store.js';

/**
 * 하위 호환성을 위한 초기화 (실제 사용 안 함)
 */
export async function initTesseract() {
    console.log('[OCR] Google Vision 모듈 초기화 (준비 완료)');
    return true;
}

/**
 * DataURL 이미지를 base64로 변환하여 Google Vision API에 텍스트 인식을 요청합니다.
 * @param {string} dataUrl - 이미지 DataURL
 * @returns {Promise<{text: string, confidence: number}>} - 인식된 텍스트와 신뢰도(가짜) 반환
 */
export async function recognizeDigit(dataUrl) {
    return _callGoogleVisionAPI(dataUrl);
}

/**
 * 단어 단위 인식 (학번 등에 사용). Google Vision은 둘 다 같은 엔드포인트를 사용하므로 동일 함수 호출.
 */
export async function recognizeWord(dataUrl) {
    return _callGoogleVisionAPI(dataUrl);
}

/**
 * 실제 Google Vision API 호출 내부 함수
 */
async function _callGoogleVisionAPI(dataUrl) {
    const settings = await getSettings();
    const apiKey = settings.googleApiKey;

    if (!apiKey) {
        throw new Error('Google Cloud Vision API 키가 설정되지 않았습니다. [설정] 메뉴에서 API 키를 입력해주세요.');
    }

    // DataURL에서 base64 부분만 추출 (예: "data:image/jpeg;base64,.....")
    const base64Image = dataUrl.split(',')[1];

    if (!base64Image) {
        throw new Error('올바르지 않은 이미지 형식입니다.');
    }

    const payload = {
        requests: [
            {
                image: {
                    content: base64Image
                },
                features: [
                    {
                        // DOCUMENT_TEXT_DETECTION은 손글씨가 포함된 밀집 텍스트에 유리. 숫자/일반칸은 TEXT_DETECTION도 무방
                        // 일단 DOCUMENT_TEXT_DETECTION 으로 통일
                        type: "DOCUMENT_TEXT_DETECTION" 
                    }
                ]
            }
        ]
    };

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('[Google Vision API 오류]', errData);
            throw new Error(`Google API 호출 실패: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // 결과 파싱
        const responses = data.responses || [];
        if (responses.length > 0 && responses[0].fullTextAnnotation) {
            let recognizedText = responses[0].fullTextAnnotation.text.trim();
            // 개행이나 공백 제거 (숫자/학번 위주이므로)
            recognizedText = recognizedText.replace(/[\s\n\r]/g, '');
            return {
                text: recognizedText,
                confidence: 99 // Vision API V1은 전체 텍스트에 대한 신뢰도를 바로 주지 않음, 대략적 수치 부여
            };
        } else {
            // 인식 못함
            return {
                text: '',
                confidence: 0
            };
        }
    } catch (e) {
        console.error('[OCR 구글 API 호출 실패]', e);
        throw e;
    }
}

/**
 * 메모리 해제용 더미 함수
 */
export async function terminateTesseract() {
    console.log('[OCR] Google Vision 자원 해제 (동작 없음)');
}
