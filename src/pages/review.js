import { getAllScanResults, saveScanResult, getStudents, getSettings, clearScanResults } from '../store.js';

export async function renderReview(container, settings) {
  const results = await getAllScanResults();
  const students = await getStudents();

  if (results.length === 0) {
    container.innerHTML = `
      <h1 class="page-title">🔍 검수하기</h1>
      <div class="card" style="text-align: center; padding: 50px;">
        <h3 style="color: #666; margin-bottom: 20px;">업로드된 스캔 결과가 없습니다.</h3>
        <button class="btn primary" onclick="document.querySelector('a[href=\\'/scan\\']').click()">스캔 화면으로 이동</button>
      </div>
    `;
    return;
  }

  // Filter unreviewed first, then reviewed
  const unreviewed = results.filter(r => !r.reviewed);
  const reviewed = results.filter(r => r.reviewed);

  const displayList = [...unreviewed, ...reviewed];

  let currentIndex = 0;
  let currentResult = displayList[currentIndex];

  const renderCurrent = () => {
    if (!currentResult) {
      container.innerHTML = `
        <h1 class="page-title">🔍 검수하기</h1>
        <div class="card" style="text-align: center; padding: 50px;">
          <h3 style="color: var(--primary-color);">모든 검수가 완료되었습니다! 🎉</h3>
          <p style="margin-top: 15px;">채점 결과 화면에서 점수를 확인하고 엑셀로 다운로드하세요.</p>
          <br>
          <button class="btn primary" onclick="document.querySelector('a[href=\\'/results\\']').click()">📊 채점 결과 확인하기</button>
        </div>
      `;
      return;
    }

    const isReviewed = currentResult.reviewed;
    const targetSubject = settings.subjects.find(s => s.id === currentResult.subjectId) || settings.subjects[0];

    // Build question editor grid
    let qHtml = '';
    for (let i = 1; i <= targetSubject.questionCount; i++) {
      const ans = currentResult.ocrData[i];
      const conf = ans ? ans.confidence : 0;
      const v = ans ? (!isNaN(ans.digit) ? ans.digit : '') : '';
      const isLowConf = conf < 70; // 70% 미만은 주의 표시

      let imgSrc = ans ? ans.boxImage : '';

      qHtml += `
         <div style="
           border: 2px solid ${isLowConf ? 'var(--danger-color)' : '#eee'}; 
           border-radius: 8px; 
           padding: 10px; 
           text-align: center; 
           background: ${isLowConf ? '#ffebee' : 'white'}
         ">
           <div style="font-weight: bold; margin-bottom: 5px;">${i}번</div>
           ${imgSrc ? `<img src="${imgSrc}" style="width: 40px; height: 40px; border:1px solid #ccc; background:#fff; margin-bottom: 5px;" />` : ''}
           <br>
           <input type="number" 
             id="rev-q-${i}" 
             value="${v}" 
             min="1" max="${settings.choiceCount}"
             oninput="handleReviewInput(event, ${i}, ${targetSubject.questionCount}, ${settings.choiceCount})"
             onkeydown="handleReviewKey(event, ${i}, ${targetSubject.questionCount})"
             style="width: 60px; text-align: center; font-size: 1.2em; font-weight: bold;"
             ${conf < 70 ? 'autofocus' : ''}
           >
           <div style="font-size: 0.75em; color: #666; margin-top: 5px;">인식률: ${Math.round(conf)}%</div>
         </div>
       `;
    }

    // Build student options
    let studentOptions = `<option value="0">알 수 없음 (직접 선택)</option>`;
    students.forEach(s => {
      const selected = s.number === currentResult.studentNumber ? 'selected' : '';
      studentOptions += `<option value="${s.number}" ${selected}>${s.number}번 ${s.name}</option>`;
    });

    // Build subject options
    let subjectOptions = '';
    settings.subjects.forEach(sub => {
      const selected = sub.id === currentResult.subjectId ? 'selected' : '';
      subjectOptions += `<option value="${sub.id}" ${selected}>${sub.name}</option>`;
    });

    container.innerHTML = `
      <style>
        .review-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }
        .full-img-container {
            background: #f8fafc;
            padding: 16px;
            border-radius: var(--border-radius);
            text-align: center;
            max-height: 80vh;
            overflow: auto;
            border: 1px solid #e2e8f0;
        }
        .full-img-container img {
            max-width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            box-shadow: var(--shadow-sm);
        }
        .q-grid-rev {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            gap: 16px;
            max-height: 60vh;
            overflow-y: auto;
            padding-right: 12px;
            padding-bottom: 24px;
        }
        .q-grid-rev::-webkit-scrollbar {
            width: 8px;
        }
        .q-grid-rev::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 4px;
        }
      </style>

      <div class="page-header">
        <div>
          <h1 class="page-title" style="margin:0;">
            🔍 검수하기 
            <span class="badge neutral" style="margin-left: 12px; font-size: 0.9rem;">${currentIndex + 1} / ${displayList.length}</span>
          </h1>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn danger outline" style="margin-right: 20px; font-size: 0.85rem; padding: 6px 12px;" onclick="clearAllScans()">전체 스캔본 삭제</button>
          <button class="btn secondary outline" onclick="prevItem()" ${currentIndex === 0 ? 'disabled' : ''}>◀ 이전</button>
          <button class="btn secondary outline" onclick="nextItem()" ${currentIndex === displayList.length - 1 ? 'disabled' : ''}>다음 ▶</button>
        </div>
      </div>

      <div class="review-layout">
          <!-- 원본 이미지 영역 -->
          <div class="full-img-container card" style="padding: 24px;">
              <h3 style="margin-bottom:16px;">원본 스캔 이미지 <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">(${currentResult.fileName})</span></h3>
              ${currentResult.originalImage
        ? `<img src="${currentResult.originalImage}" alt="스캔 원본">`
        : '<div style="padding:50px; color:var(--text-muted); background: #f1f5f9; border-radius: 8px;">등록된 이미지가 없습니다.</div>'}
          </div>

          <!-- 수정 폼 영역 -->
          <div>
              <div class="card" style="margin-bottom: 24px; ${currentResult.studentNumber === 0 ? 'border: 2px solid var(--danger-color); box-shadow: 0 0 0 4px #fee2e2;' : ''}">
                  <div class="grid-2">
                      <div class="form-group" style="margin:0;">
                          <label style="font-weight: 700;">학생 매칭</label>
                          <select id="rev-student" style="${currentResult.studentNumber === 0 ? 'border-color: var(--danger-color); background:#fff4f2;' : ''}">
                              ${studentOptions}
                          </select>
                          ${currentResult.studentNumber === 0 ? '<div style="color:var(--danger-color); font-size:0.85em; margin-top:8px; font-weight: 500;">⚠️ 출석번호 인식 실패. 명단에서 학생을 직접 선택해주세요.</div>' : ''}
                      </div>
                      <div class="form-group" style="margin:0;">
                          <label style="font-weight: 700;">과목 매칭</label>
                          <select id="rev-subject">
                              ${subjectOptions}
                          </select>
                      </div>
                  </div>
              </div>

              <div class="card">
                  <h3 style="margin-bottom: 20px;">인식 결과 확인 및 수정 <span style="font-size:0.85em; color:var(--text-muted); font-weight:normal; margin-left:8px;">(빨간 테두리는 한 번 더 확인하세요)</span></h3>
                  <div class="q-grid-rev">
                      ${qHtml}
                  </div>

                  <div class="actions-bar">
                      <button class="btn danger outline" onclick="deleteCurrent()">스캔본 삭제</button>
                      <button class="btn primary" onclick="saveCurrentReview()">
                          ${isReviewed ? '✔️ 수정 완료' : '✔️ 검수 완료 (다음으로)'}
                      </button>
                  </div>
              </div>
          </div>
      </div>
    `;
  };

  window.prevItem = () => {
    if (currentIndex > 0) {
      currentIndex--;
      currentResult = displayList[currentIndex];
      renderCurrent();
    }
  };

  window.nextItem = () => {
    if (currentIndex < displayList.length - 1) {
      currentIndex++;
      currentResult = displayList[currentIndex];
      renderCurrent();
    }
  };

  window.deleteCurrent = async () => {
    if (confirm('이 스캔 결과를 영구적으로 삭제하시겠습니까?')) {
      const id = currentResult.id;

      const DB_NAME = 'autoGraderDB';
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('scanResults', 'readwrite');
        tx.objectStore('scanResults').delete(id);
        tx.oncomplete = () => {
          displayList.splice(currentIndex, 1);
          if (displayList.length === 0) {
              renderReview(container, settings); // Reload empty
              return;
          }
          if (currentIndex >= displayList.length) currentIndex = Math.max(0, displayList.length - 1);
          currentResult = displayList[currentIndex];
          renderCurrent();
        };
      };
    }
  };

  window.clearAllScans = async () => {
    if (confirm('경고: 복구할 수 없습니다! 지금까지 올린 모든 스캔본 데이터를 지우시겠습니까?')) {
      try {
        await clearScanResults();
        renderReview(container, settings);
      } catch (err) {
        console.error(err);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  window.saveCurrentReview = async () => {
    const studentSelect = document.getElementById('rev-student').value;
    const subjectSelect = document.getElementById('rev-subject').value;
    const targetSubject = settings.subjects.find(s => s.id === subjectSelect);

    const sNum = parseInt(studentSelect, 10);
    if (sNum === 0) {
      alert('학생을 지정해주세요.');
      return;
    }

    // Read all inputs
    for (let i = 1; i <= targetSubject.questionCount; i++) {
      const el = document.getElementById(`rev - q -${i} `);
      if (el && currentResult.ocrData[i]) {
        const val = parseInt(el.value, 10);
        currentResult.ocrData[i].digit = isNaN(val) ? 0 : val;
      } else if (el && !currentResult.ocrData[i]) {
        const val = parseInt(el.value, 10);
        currentResult.ocrData[i] = {
          digit: isNaN(val) ? 0 : val,
          rawText: el.value,
          confidence: 100, // Manually set
          boxImage: ''
        }
      }
    }

    currentResult.studentNumber = sNum;
    currentResult.subjectId = subjectSelect;
    currentResult.reviewed = true;

    try {
      await saveScanResult(currentResult);

      // Go to next unreviewed or regular next
      const unreviewedIdx = displayList.findIndex((r, idx) => idx > currentIndex && !r.reviewed);
      if (unreviewedIdx !== -1) {
        currentIndex = unreviewedIdx;
      } else {
        currentIndex++;
      }

      if (currentIndex >= displayList.length) {
        currentResult = null; // Done
      } else {
        currentResult = displayList[currentIndex];
      }

      renderCurrent();

    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  window.handleReviewKey = (e, index, total) => {
    let nextIndex = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = index < total ? index + 1 : 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = index > 1 ? index - 1 : total;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const nextInput = document.getElementById(`rev-q-${nextIndex}`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  window.handleReviewInput = (e, index, total, maxChoice) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= maxChoice) {
      if (index < total) {
        const nextInput = document.getElementById(`rev-q-${index + 1}`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };

  renderCurrent();
}
