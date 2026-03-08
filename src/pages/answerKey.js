import { getAnswerKey, saveAnswerKey } from '../store.js';

export async function renderAnswerKey(container, settings) {
  let activeTab = settings.subjects[0]?.id;
  let answerKeys = {}; // { subjectId: { 1: 3, 2: 1, ... } }

  // Load existing keys
  for (const sub of settings.subjects) {
    const keyData = await getAnswerKey(sub.id);
    if (keyData && keyData.answers) {
      answerKeys[sub.id] = keyData.answers;
    } else {
      answerKeys[sub.id] = {}; // Initialize empty
    }
  }

  const renderContent = () => {
    if (!settings.subjects || settings.subjects.length === 0) {
      container.innerHTML = `
        <h1 class="page-title">🔑 정답 입력</h1>
        <div class="card">과목 설정이 없습니다. 설정 메뉴에서 과목을 먼저 추가해주세요.</div>
      `;
      return;
    }

    const currentSubject = settings.subjects.find(s => s.id === activeTab);
    const answers = answerKeys[activeTab];

    let tabsHtml = settings.subjects.map(s => `
      <button 
        class="tab-btn ${s.id === activeTab ? 'active' : ''}" 
        onclick="switchTab('${s.id}')"
      >
        ${s.name}
      </button>
    `).join('');

    let gridHtml = '';
    for (let i = 1; i <= currentSubject.questionCount; i++) {
      let val = answers[i] || '';
      gridHtml += `
        <div class="ans-item">
          <span class="ans-num">${i}번</span>
          <input type="number" 
            class="ans-input" 
            id="ans-${activeTab}-${i}"
            min="1" 
            max="${settings.choiceCount}" 
            value="${val}"
            oninput="updateAnswer('${activeTab}', ${i}, this.value)"
            onkeydown="handleKeyNavigation(event, '${activeTab}', ${i})"
          >
        </div>
      `;
    }

    container.innerHTML = `
      <style>
        .tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 0px;
        }
        .tab-btn {
          padding: 12px 24px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          color: var(--text-muted);
          font-size: 1rem;
          position: relative;
          transition: all 0.2s;
        }
        .tab-btn.active {
          color: var(--primary-color);
        }
        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: var(--primary-color);
        }
        .tab-btn:hover:not(.active) {
          color: var(--text-main);
          background-color: #f8fafc;
          border-radius: 8px 8px 0 0;
        }
        .ans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 16px;
        }
        .ans-item {
          display: flex;
          align-items: center;
          background: #ffffff;
          padding: 12px;
          border-radius: var(--border-radius-sm);
          border: 1px solid #cbd5e1;
          transition: border-color 0.2s;
        }
        .ans-item:focus-within {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--secondary-color);
        }
        .ans-num {
          font-weight: 600;
          margin-right: 12px;
          width: 40px;
          color: var(--text-muted);
        }
        .ans-input {
          width: 50px !important;
          text-align: center;
          font-size: 1.25rem;
          padding: 6px !important;
          border: none;
          background: #f1f5f9;
          font-weight: 700;
          color: var(--primary-color);
        }
        .ans-input:focus {
          outline: none;
          background: #ffffff;
        }
      </style>

      <div class="page-header">
        <div>
          <h1 class="page-title">🔑 정답 입력</h1>
          <p class="subtitle">채점의 기준이 될 과목별 정답을 입력합니다. (1~${settings.choiceCount}의 숫자)</p>
        </div>
      </div>

      <div class="card">
        <div class="tabs">
          ${tabsHtml}
        </div>
        
        <div class="ans-grid" style="margin-bottom: 24px;">
          ${gridHtml}
        </div>

        <div class="actions-bar">
          <button class="btn primary" onclick="saveCurrentKey()" style="font-size: 1.05rem; padding: 12px 24px;">
            ${currentSubject.name} 정답 저장하기
          </button>
        </div>
      </div>
    `;
  };

  window.switchTab = (id) => {
    activeTab = id;
    renderContent();
  };

  window.updateAnswer = (subjectId, qNum, val) => {
    // Only accept 1 to choiceCount
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= settings.choiceCount) {
      answerKeys[subjectId][qNum] = num;

      // Auto-advance to the next input if a valid 1-digit answer is entered
      if (val.length === 1) {
        const nextInput = document.getElementById(`ans-${subjectId}-${qNum + 1}`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    } else {
      // Handle backspace or invalid
      if (val === '') {
        delete answerKeys[subjectId][qNum];
      } else {
        // Revert to old value if invalid
        document.getElementById(`ans-${subjectId}-${qNum}`).value = answerKeys[subjectId][qNum] || '';
      }
    }
  };

  window.handleKeyNavigation = (e, subjectId, qNum) => {
    let nextQNum = null;
    // Right (39) or Down (40)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextQNum = qNum + 1;
    }
    // Left (37) or Up (38)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextQNum = qNum - 1;
    }

    if (nextQNum !== null) {
      const nextInput = document.getElementById(`ans-${subjectId}-${nextQNum}`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  window.saveCurrentKey = async () => {
    const currentSubject = settings.subjects.find(s => s.id === activeTab);
    const answers = answerKeys[activeTab];

    // Check missing
    const missing = [];
    for (let i = 1; i <= currentSubject.questionCount; i++) {
      if (!answers[i]) missing.push(i);
    }

    if (missing.length > 0) {
      const proceed = confirm(`아직 입력하지 않은 정답이 있습니다 (${missing.join(', ')}번).\\n이대로 저장하시겠습니까?`);
      if (!proceed) return;
    }

    try {
      await saveAnswerKey({
        subjectId: activeTab,
        answers: answers
      });
      alert(`${currentSubject.name} 정답이 저장되었습니다.`);
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  renderContent();
}
