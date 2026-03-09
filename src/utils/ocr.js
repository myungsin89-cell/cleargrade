/**
 * TensorFlow.js 기반 OCR (숫자 전용)
 * MNIST 데이터셋으로 학습된 모델을 통해 0~9의 숫자를 인식합니다.
 */

let model = null;

// MNIST 모델 URL (Google이 제공하는 공개 모델)
const MODEL_URL = 'https://storage.googleapis.com/tfjs-models/tfjs/mnist_math/model.json';

/**
 * TensorFlow.js 숫자 인식 모델 초기화
 */
export async function initTesseract() { // 기존 호환성을 위해 이름 유지
    if (model) return model;

    console.log('[OCR] TensorFlow 모델 로딩 중...');
    
    // tf는 index.html의 CDN을 통해 전역(window.tf)으로 로드됩니다.
    if (!window.tf) {
        throw new Error('TensorFlow.js 라이브러리가 로드되지 않았습니다.');
    }

    try {
        model = await window.tf.loadLayersModel(MODEL_URL);
        console.log('[OCR] TensorFlow 모델 로드 완료');
        
        // Warmup (최초 추론 속도 향상을 위한 빈 텐서 실행)
        const dummyInput = window.tf.zeros([1, 28, 28, 1]);
        model.predict(dummyInput);
        dummyInput.dispose();
        
    } catch (e) {
        console.error('[OCR] 모델 로딩 실패:', e);
        throw e;
    }

    return model;
}

/**
 * 캔버스나 Data URL에서 MNIST 규격에 맞춰 숫자를 예측합니다.
 * @param {string} dataUrl - 전처리된 28x28 형태의 흑백 이미지 DataURL
 */
export async function recognizeDigit(dataUrl) {
    if (!model) {
        await initTesseract();
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // tf.tidy를 사용하여 텐서 메모리 누수 방지
            const prediction = window.tf.tidy(() => {
                // 1. 이미지를 텐서로 변환 (shape: [H, W, 4])
                const tensorObj = window.tf.browser.fromPixels(img, 1); // 1채널 흑백으로 불러옴
                
                // 2. 모델 입력 규격(배치 크기 1, 28, 28, 1)으로 리쉐이프하고 정규화
                // MNIST 모델은 0~1 사이의 float32 값을 기대합니다.
                const batched = tensorObj.expandDims(0).toFloat().div(window.tf.scalar(255));
                
                // 3. 예측 수행
                const result = model.predict(batched);
                
                // 4. 가장 높은 확률의 클래스(0~9)와 그 확률값 추출
                const scores = result.dataSync(); // 동기적으로 배열 데이터 가져오기
                const predictedClass = result.argMax(1).dataSync()[0];
                const confidence = scores[predictedClass] * 100; // 확률을 퍼센트로 변환

                return {
                    text: predictedClass.toString(),
                    confidence: confidence
                };
            });
            
            resolve(prediction);
        };
        img.src = dataUrl;
    });
}

/**
 * 이름(단어) 인식은 TF 숫자모델에서 지원하지 않으므로 빈 값 반환 (Stub)
 */
export async function recognizeWord(dataUrl) {
    return {
        text: '',
        confidence: 0
    };
}

/**
 * 메모리 해제
 */
export async function terminateTesseract() {
    if (model) {
        // model.dispose(); // 메모리 해제가 필요할 경우 활성화
        console.log('[OCR] TensorFlow 자원 해제(Stub)');
    }
}
