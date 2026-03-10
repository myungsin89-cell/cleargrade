import { getAllScanResults, saveScanResult, getStudents, getSettings, clearScanResults } from '../store.js';

export async function renderReview(container, settings) {
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.classList.add('full-width'); // Expand this specific screen
  }

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

  // Initialize filter state if not exists
  if (!window.activeSubjectFilter) {
    window.activeSubjectFilter = 'ALL';
  }

  // Combine, Filter, and Sort the display list
  const allResults = [...unreviewed, ...reviewed];
  const displayList = allResults
    .filter(r => window.activeSubjectFilter === 'ALL' || r.subjectId === window.activeSubjectFilter)
    .sort((a, b) => {
      // Sort by student number ascending. Put unassigned (0) at the end.
      const numA = a.studentNumber === 0 ? 9999 : a.studentNumber;
      const numB = b.studentNumber === 0 ? 9999 : b.studentNumber;
      return numA - numB;
    });

  let currentIndex = 0;
  let currentResult = displayList.length > 0 ? displayList[currentIndex] : null;
  let isDirty = false;

  window.markDirty = () => {
    isDirty = true;
  };

  const renderCurrent = () => {
    isDirty = false; // Reset dirty state on render

    if (!currentResult) {
      const emptyMsg = window.activeSubjectFilter === 'ALL' 
         ? '모든 검수가 완료되었습니다! 🎉' 
         : '해당 과목의 스캔본이 없습니다.';

      container.innerHTML = `
        <h1 class="page-title">검수하기</h1>
        
        <!-- 과목 필터 탭 (빈 화면에서도 탭 이동 가능하게) -->
        <div style="margin-bottom: 20px; display: flex; gap: 10px;">
            <button class="btn ${window.activeSubjectFilter === 'ALL' ? 'primary' : 'neutral outline'}" onclick="window.setSubjectFilter('ALL')">전체 보기</button>
            ${settings.subjects.map(sub => `
                <button class="btn ${window.activeSubjectFilter === sub.id ? 'primary' : 'neutral outline'}" onclick="window.setSubjectFilter('${sub.id}')">${sub.name}</button>
            `).join('')}
        </div>

        <div class="card" style="text-align: center; padding: 50px;">
          <h3 style="color: var(--primary-color);">${emptyMsg}</h3>
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
           padding: 12px; /* Increased from 10px for more air */
           text-align: center; 
           background: ${isLowConf ? '#ffebee' : 'white'};
           min-height: 100px; /* Ensure consistent height */
         ">
           <div style="font-weight: bold; margin-bottom: 5px;">${i}번</div>
           ${imgSrc ? `<img src="${imgSrc}" style="width: 110px; height: 32px; object-fit: contain; border:1px solid #ccc; background:#fff; margin-bottom: 5px;" />` : ''}
           <br>
           <input type="number" 
             id="rev-q-${i}" 
             value="${v}" 
             min="1" max="${settings.choiceCount}"
             oninput="markDirty(); handleReviewInput(event, ${i}, ${targetSubject.questionCount}, ${settings.choiceCount})"
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
            grid-template-columns: 420px 1fr; /* 420px fixed for image to make it larger, REST OF WIDE SCREEN for the important form */
            gap: 20px;
            height: calc(100vh - 120px); /* Fill screen to prevent overall scroll */
        }
        .full-img-container {
            background: #f8fafc;
            padding: 12px;
            border-radius: var(--border-radius);
            text-align: center;
            height: 100%;
            overflow: auto;
            border: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
        }
        .full-img-container img {
            max-width: 100%;
            height: auto;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            box-shadow: var(--shadow-sm);
        }
        
        /* Dense Header Meta Strip */
        .dense-meta-strip {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 16px;
            background: #f8fafc;
            border-radius: var(--border-radius-sm);
            border: 1px solid #e2e8f0;
            margin-bottom: 12px;
        }
        .dense-meta-strip .form-group {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .dense-meta-strip label {
            margin: 0;
            white-space: nowrap;
            font-size: 0.9rem;
        }
        .dense-meta-strip select {
            padding: 4px 8px;
            font-size: 0.9rem;
            width: auto;
        }
        
        /* Dense Question Grid */
        .q-grid-rev {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); /* Widened to 150px to house 110px image + padding */
            gap: 12px;
            overflow-y: auto;
            padding-right: 6px;
            align-content: start;
        }
        .q-grid-rev::-webkit-scrollbar {
            width: 8px;
        }
        .q-grid-rev::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 4px;
        }
        
        /* Specific dense styling for q-boxes */
        .q-grid-rev > div {
           padding: 6px !important;
        }
        .q-grid-rev > div img {
           width: 110px !important;
           height: 32px !important;
           margin-bottom: 4px !important;
        }
        .q-grid-rev > div input {
           width: 50px !important;
           padding: 4px !important;
           font-size: 1.1em !important;
        }
        .q-grid-rev > div .conf-text {
            font-size: 0.7em !important;
            margin-top: 2px !important;
        }
        
        /* Right panel flex layout */
        .right-panel {
            display: flex;
            flex-direction: column;
            overflow: hidden; /* Important for grid containment */
        }
        .right-panel > .card {
            display: flex;
            flex-direction: column;
            height: 100%;
            margin-bottom: 0;
            padding: 20px;
        }
      </style>

      <div class="page-header" style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <h1 class="page-title" style="margin:0;">
            검수하기 
          </h1>
          <span class="badge neutral" style="font-size: 1rem; padding: 6px 14px;">${currentIndex + 1} / ${displayList.length}</span>
          <button class="btn primary" style="margin-left: 10px; font-size: 0.9rem; padding: 6px 14px;" onclick="document.getElementById('matching-modal').style.display='flex'">전체 학생 매칭 현황</button>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn danger" style="margin-right: 20px; font-size: 0.9rem; padding: 6px 14px;" onclick="window.confirmUnsaved(() => clearAllScans())">전체 스캔본 일괄 삭제</button>
          <button class="btn secondary outline" onclick="prevItem()" ${currentIndex === 0 ? 'disabled' : ''}>◀ 이전 스캔</button>
          <button class="btn secondary outline" onclick="nextItem()" ${currentIndex === displayList.length - 1 ? 'disabled' : ''}>다음 스캔 ▶</button>
        </div>
      </div>

      <!-- 과목 필터 탭 -->
      <div style="margin-bottom: 20px; display: flex; gap: 10px;">
          <button class="btn ${window.activeSubjectFilter === 'ALL' ? 'primary' : 'neutral outline'}" onclick="window.setSubjectFilter('ALL')">전체 보기</button>
          ${settings.subjects.map(sub => `
              <button class="btn ${window.activeSubjectFilter === sub.id ? 'primary' : 'neutral outline'}" onclick="window.setSubjectFilter('${sub.id}')">${sub.name}</button>
          `).join('')}
      </div>

      <div class="review-layout">
          <!-- 원본 이미지 영역 -->
          <div class="full-img-container card" style="padding: 16px; margin: 0;">
              <h3 style="margin-bottom:12px; font-size: 1.1rem; flex-shrink: 0;">원본 이미지 <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">(${currentResult.fileName})</span></h3>
              <div style="flex: 1; overflow: auto;">
                  ${currentResult.originalImage
            ? `<img src="${currentResult.originalImage}" alt="스캔 원본">`
            : '<div style="padding:50px; color:var(--text-muted); background: #f1f5f9; border-radius: 8px;">등록된 이미지가 없습니다.</div>'}
              </div>
          </div>

          <!-- 수정 폼 영역 -->
          <div class="right-panel">
              <div class="card">
                  <!-- 초고밀도 메타 정보 (학생, 과목, 삭제) -->
                  <div class="dense-meta-strip" style="${currentResult.studentNumber === 0 ? 'border: 2px solid var(--danger-color); background: #fff4f2;' : ''}">
                      <div class="form-group">
                          <label style="font-weight: 700;">학생 매칭:</label>
                          <select id="rev-student" style="${currentResult.studentNumber === 0 ? 'border-color: var(--danger-color);' : ''}" onchange="markDirty(); renderMatchingStatus()">
                              ${studentOptions}
                          </select>
                      </div>
                      <div class="form-group" style="margin-left: 12px;">
                          <label style="font-weight: 700;">과목 매칭:</label>
                          <select id="rev-subject" onchange="markDirty(); renderMatchingStatus()">
                              ${subjectOptions}
                          </select>
                      </div>
                      
                      <!-- 개별 스캔본 삭제 버튼을 메타 정보 우측 끝으로 이동하여 강조 -->
                      <div style="margin-left: auto;">
                          <button class="btn danger" style="padding: 6px 12px; font-size: 0.85rem;" onclick="deleteCurrent()">이 스캔본 삭제하기</button>
                      </div>
                  </div>
                  
                  ${currentResult.studentNumber === 0 ? '<div style="color:var(--danger-color); font-size:0.85em; margin-bottom:12px; font-weight: 500;">출석번호 인식 실패. 명단에서 학생을 <strong>이름으로 검색</strong>하여 변경해주세요.</div>' : ''}

                  <!-- 텍스트 압축 -->
                  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; flex-shrink: 0;">
                      <h3 style="margin: 0; font-size: 1.1rem;">인식 결과 확인 및 수정</h3>
                      <span style="font-size:0.8em; color:var(--danger-color); font-weight:600;">(빨간 테두리 집중 확인)</span>
                  </div>

                  <!-- 위치 고정형 (Sticky) 액션 바 -->
                  <div class="actions-bar" style="position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,0.95); backdrop-filter: blur(4px); padding: 10px 0; border-bottom: 1px solid #eee; margin-bottom: 15px; flex-shrink: 0;">
                      <button class="btn primary" style="width: 100%; font-size: 1.1rem; padding: 14px;" onclick="saveCurrentReview()">
                          ${isReviewed ? '✔️ 수정 완료 (저장)' : '✔️ 검수 완료 (동기화 후 다음 스캔으로 이동)'}
                      </button>
                  </div>

                  <!-- 문제 그리드 (스크롤 가능한 핵심 영역) -->
                  <div class="q-grid-rev" style="flex: 1; padding-top: 5px;">
                      ${qHtml}
                  </div>
              </div>
          </div>
      </div>

      <!-- 명렬표 매칭 현황 모달 (숨김) -->
      <div id="matching-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
          <div class="card" style="width: 90%; max-width: 1000px; max-height: 85vh; display: flex; flex-direction: column; padding: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0;">
                  <h2 style="margin: 0;">📊 학생 매칭 명렬표 현황</h2>
                  <button class="btn neutral outline" style="font-size: 1.2rem; padding: 4px 12px;" onclick="document.getElementById('matching-modal').style.display='none'">닫기 ✖</button>
              </div>
              <div id="matching-status-container" style="flex: 1; overflow: auto; padding-right: 8px;"></div>
          </div>
      </div>
    `;

    // Render the matching status immediately after mounting the DOM
    window.renderMatchingStatus();
  };

  window.renderMatchingStatus = () => {
    const containerEl = document.getElementById('matching-status-container');
    if (!containerEl) return;

    const stSelect = document.getElementById('rev-student');
    const sbSelect = document.getElementById('rev-subject');
    
    // Fallbacks just in case DOM isn't fully ready
    const activeStudent = stSelect ? parseInt(stSelect.value, 10) : currentResult?.studentNumber;
    const activeSubject = sbSelect ? sbSelect.value : currentResult?.subjectId;

    let html = `<table class="styled-table" style="font-size: 0.85em; table-layout: auto; white-space: nowrap; margin: 0; width: 100%;">
      <thead>
        <tr>
          <th style="padding: 6px; text-align:center;">번호</th>
          <th style="padding: 6px; text-align:center;">이름</th>
          ${settings.subjects.map(sub => `<th style="padding: 6px; text-align:center;">${sub.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
    `;

    students.forEach(student => {
      // Highlight row if it is the currently active student in the dropdown
      const isCurrentRow = student.number === activeStudent;
      const rowStyle = isCurrentRow ? 'background-color: #ebf8ff;' : '';
      
      html += `<tr style="${rowStyle}">
        <td style="padding: 6px; text-align:center; font-weight:bold;">${student.number}</td>
        <td style="padding: 6px; text-align:center;">${student.name}</td>
      `;

      settings.subjects.forEach(subject => {
        let count = 0;
        
        allResults.forEach(r => {
          let sNum = r.studentNumber;
          let subId = r.subjectId;
          
          if (currentResult && r.id === currentResult.id) {
             sNum = activeStudent;
             subId = activeSubject;
          }

          if (sNum === student.number && subId === subject.id) {
             count++;
          }
        });

        let cellHtml = '';
        if (count === 1) cellHtml = '<span style="color:var(--primary-color); font-weight:bold;">O</span>';
        else if (count > 1) cellHtml = `<span style="color:var(--danger-color); font-weight:bold;">${count}</span>`;
        else cellHtml = '<span style="color:#cbd5e1;">-</span>';

        html += `<td style="padding: 6px; text-align:center; background-color: ${isCurrentRow && subject.id === activeSubject ? '#dbeffe' : 'transparent'};">${cellHtml}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    containerEl.innerHTML = html;
  };

  window.confirmUnsaved = (callback) => {
    if (isDirty) {
      if (confirm('수정된 내용이 아직 저장되지 않았습니다.\n저장하지 않고 이동하시겠습니까?')) {
        callback();
      }
    } else {
      callback();
    }
  };

  window.prevItem = () => {
    window.confirmUnsaved(() => {
      if (currentIndex > 0) {
        currentIndex--;
        currentResult = displayList[currentIndex];
        renderCurrent();
      }
    });
  };

  window.nextItem = () => {
    window.confirmUnsaved(() => {
      if (currentIndex < displayList.length - 1) {
        currentIndex++;
        currentResult = displayList[currentIndex];
        renderCurrent();
      }
    });
  };

  window.setSubjectFilter = (subjectId) => {
    window.confirmUnsaved(() => {
      window.activeSubjectFilter = subjectId;
      renderReview(container, settings); // Re-render the entire view to recalculate displayList
    });
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
      const el = document.getElementById(`rev-q-${i}`);
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
