import { getSettings, getStudents, saveScanResult } from '../store.js';
import { loadImageFromFile, extractBox, getQuestionBoxDefs, studentNumberBoxDef, studentNameBoxDef } from '../utils/imageProcess.js';
import { initTesseract, recognizeDigit, recognizeWord, terminateTesseract } from '../utils/ocr.js';

export async function renderScan(container, settings) {
  const students = await getStudents();

  if (students.length === 0) {
    container.innerHTML = `
      <h1 class="page-title">📷 스캔 업로드</h1>
      <div class="card" style="text-align: center; padding: 50px;">
        <h3 style="color: var(--danger-color); margin-bottom: 20px;">학생 명단이 없습니다.</h3>
        <p>명단이 등록되어야 스캔된 답안지의 출석번호를 매칭할 수 있습니다.</p>
        <br>
        <button class="btn primary" onclick="document.querySelector('a[href=\\'/students\\']').click()">학생 관리로 이동</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📷 스캔 업로드</h1>
        <p class="subtitle">학생들이 작성한 답안지(이미지 파일)를 업로드하여 자동 인식합니다.</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 style="margin-bottom: 16px;">파일 업로드</h3>
        <p style="margin-bottom: 24px; color: var(--text-muted); font-size: 0.95em;">
          스캔 또는 촬영한 이미지(JPG, PNG) 여러 장을 드래그하거나 선택하세요.<br>
          <span style="color: #b45309;">※ PDF 스캔인 경우 이미지 파일로 변환 후 올려주세요.</span>
        </p>
        
        <input type="file" id="scanFiles" multiple accept="image/jpeg, image/png" style="display: none;" onchange="handleFiles(event)">
        <div id="dropZone" style="
          border: 2px dashed #cbd5e1; 
          border-radius: var(--border-radius); 
          padding: 48px 24px; 
          text-align: center; 
          cursor: pointer;
          background: #f8fafc;
          transition: all 0.2s;
        " onclick="document.getElementById('scanFiles').click()">
          <div style="font-size: 3rem; margin-bottom: 16px;">📤</div>
          <div style="font-size: 1.1rem; color: var(--text-main);">
            <strong style="color: var(--primary-color);">여기를 클릭</strong>하거나 파일들을 끌어다 놓으세요.
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div class="card" id="instructionContainer" style="background: #fffbeb; border-left: 4px solid var(--warning-color); padding: 24px; height: 100%;">
          <h4 style="color: #b45309; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            업로드 및 촬영 안내사항
          </h4>
          <ul style="padding-left: 20px; line-height: 1.8; color: #78350f; font-size: 0.95rem; margin-bottom: 0;">
            <li style="margin-bottom: 8px;"><strong>스마트폰 촬영 주의:</strong> 화면에 그림자가 짙게 지거나 종이가 구겨지면 오답으로 인식될 수 있으니 밝고 반듯하게 찍어주세요.</li>
            <li style="margin-bottom: 8px;"><strong>마커 보존:</strong> 답안지 모서리의 <strong style="color: #92400e;">검은 점(●) 4개</strong>가 사진에서 절대 짤리면 안 됩니다.</li>
            <li style="margin-bottom: 8px;"><strong>순서 무관:</strong> 학생들의 답안지가 번호순이 아니어도, 뒤죽박죽 섞여 있어도 AI가 학번을 자동 판독합니다.</li>
            <li style="margin-bottom: 8px;"><strong>과목별 따로 업로드 가능:</strong> 각 과목을 따로따로 올리셔도 되고, 원하신다면 '국영수'를 한꺼번에 섞어서 업로드해도 문제없습니다.</li>
            <li>올리신 직후 <strong>[🔍 검수 및 매칭]</strong> 화면에서 과목과 학생 번호를 최종적으로 확인하고 수정하실 수 있습니다.</li>
          </ul>
        </div>

        <div class="card" id="progressContainer" style="display: none;">
          <h3 style="margin-bottom: 16px;">인식 진행 상황</h3>
          <p id="progressText" style="margin-bottom: 12px; font-weight: 600; color: var(--primary-color);">대기 중...</p>
          <div style="width: 100%; background: #e2e8f0; border-radius: var(--border-radius-pill); overflow: hidden; height: 12px; margin-bottom: 24px;">
            <div id="progressBar" style="width: 0%; height: 100%; background: var(--primary-color); transition: width 0.3s ease;"></div>
          </div>
          <div id="scanLog" style="
            height: 180px; 
            overflow-y: auto; 
            background: #1e293b; 
            color: #f8fafc;
            padding: 16px; 
            border-radius: var(--border-radius-sm); 
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; 
            font-size: 0.85em;
            white-space: pre-wrap;
            line-height: 1.6;
          "></div>
        </div>
      </div>
    </div>
  `;

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('scanFiles');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.background = '#e8f5e9';
    dropZone.style.borderColor = 'var(--primary-color)';
  });
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.background = '#fafafa';
    dropZone.style.borderColor = '#ccc';
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.background = '#fafafa';
    dropZone.style.borderColor = '#ccc';
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  });

  window.handleFiles = (e) => {
    if (e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const logMsg = (msg) => {
    const log = document.getElementById('scanLog');
    log.innerHTML += `<div>${msg}</div>`;
    log.scrollTop = log.scrollHeight;
  };

  const updateProgress = (pct, text) => {
    document.getElementById('progressBar').style.width = `${pct}%`;
    document.getElementById('progressText').innerText = text;
  };

  async function processFiles(files) {
    document.getElementById('progressContainer').style.display = 'block';
    const totalFiles = files.length;
    fileInput.disabled = true;
    dropZone.style.pointerEvents = 'none';

    // OCR 준비
    logMsg('OCR 엔진 준비 중...');
    await initTesseract();
    logMsg('엔진 준비 완료.');

    const boxDefs = getQuestionBoxDefs(settings);

    let successCount = 0;

    // 단순 모의 루프 (가장 첫 번째 과목으로 맵핑한다고 임시 가정)
    // 실제로는 OCR로 과목명, 번호를 다 읽어야 완벽하지만,
    // MVP에서는 사용자가 설정한 과목 기준으로 1번 학생부터 순차 매핑하거나 파일명으로 유추
    // 여기서는 화면 우상단의 출석번호 박스를 읽어 학생을 식별합니다.

    for (let fIdx = 0; fIdx < totalFiles; fIdx++) {
      const file = files[fIdx];
      updateProgress((fIdx / totalFiles) * 100, `${fIdx + 1}/${totalFiles} 파일 처리 중: ${file.name}`);
      logMsg(`👉 파일 분석 시작: ${file.name}`);

      try {
        const img = await loadImageFromFile(file);

        // 1. 학생 출석번호 식별 (OCR)
        const numDataUrl = extractBox(img, studentNumberBoxDef);
        const { text: stNumText, confidence: stNumConf } = await recognizeDigit(numDataUrl);

        let identifiedStudent = null;
        let pNum = parseInt(stNumText, 10);
        if (!isNaN(pNum)) {
          identifiedStudent = students.find(s => s.number === pNum);
        }

        // 이름 식별 추가 (MNIST 모델은 한글 인식을 지원하지 않으므로 건너뜀)
        // const nameDataUrl = extractBox(img, studentNameBoxDef);
        // const { text: stNameText, confidence: stNameConf } = await recognizeWord(nameDataUrl);
        const stNameText = '';
        const stNameConf = 0;

        if (!identifiedStudent) {
          logMsg(`[경고] 식별 불확실 (입력결과 - 번호: ${stNumText}). 검수화면에서 수동 지정이 필요합니다.`);
          // 일단 미지정(0)으로 저장
          pNum = 0;
        } else {
          logMsg(`✔ 학생 식별: ${identifiedStudent.number}번 ${identifiedStudent.name} (신뢰도: 번호 ${Math.round(stNumConf)}%)`);
        }

        // MVP에서는 한 장이 한 과목(우선 첫번째 과목)이라고 가정, 사용자가 스캔 후 검수창에서 과목 수동 지정
        // 여기선 settings.subjects[0] 에 매핑 (나중에 리뷰창에서 쉽게 변경 가능)
        const targetSubject = settings.subjects[0];

        // 2. 답안 칸 OCR 추출
        const answers = {};
        const subjectBoxDefs = boxDefs[targetSubject.id];

        // 전체 원본 캔버스 저장용 (리뷰용)
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const originalDataUrl = canvas.toDataURL('image/jpeg', 0.6); // 사이즈 압축

        const qCount = targetSubject.questionCount;
        for (let q = 1; q <= qCount; q++) {
          const boxDef = subjectBoxDefs[q];
          // 답안 칸의 경우 테두리가 인식 방해를 하므로 removeBorder=true 사용
          const qDataUrl = extractBox(img, boxDef, true);
          const ocrRes = await recognizeDigit(qDataUrl);

          answers[q] = {
            digit: parseInt(ocrRes.text, 10),
            rawText: ocrRes.text,
            confidence: ocrRes.confidence,
            boxImage: qDataUrl // 잘라낸 이진화 이미지 (리뷰용)
          };
        }

        // 3. 결과 저장
        const resultId = `scan_${Date.now()}_${fIdx}`;
        await saveScanResult({
          id: resultId,
          fileName: file.name,
          studentNumber: pNum, // 0이면 미확인
          subjectId: targetSubject.id,
          ocrData: answers,
          originalImage: originalDataUrl,
          reviewed: false // 검수 대기 상태
        });

        successCount++;
        logMsg(`✔ 저장 완료: ${file.name}`);

      } catch (err) {
        console.error(err);
        logMsg(`❌ 오류 발생 (${file.name}): ${err.message}`);
      }
    }

    updateProgress(100, `처리 완료!`);
    logMsg(`★ 총 ${totalFiles}개 중 ${successCount}개 처리 성공.`);

    fileInput.disabled = false;
    dropZone.style.pointerEvents = 'auto';

    // 안내 메세지 후 이동 추천
    if (successCount > 0) {
      logMsg(`<br><button class="btn primary" onclick="document.querySelector('a[href=\\'/review\\']').click()">🔍 검수 화면으로 이동</button>`);
    }

    // 엔진 종료 (메모리 해제)
    await terminateTesseract();
  }
}
