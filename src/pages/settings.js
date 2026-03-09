import { saveSettings } from '../store.js';

export function renderSettings(container, settings) {
  // Deep copy for local edits
  let localSettings = JSON.parse(JSON.stringify(settings));

  const renderSubjectRows = () => {
    const tbody = document.getElementById('subjectList');
    tbody.innerHTML = '';
    localSettings.subjects.forEach((sub, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <input type="text" value="${sub.name}" id="subj-name-${index}" required>
        </td>
        <td>
          <input type="number" value="${sub.questionCount}" id="subj-count-${index}" min="1" max="100" required>
        </td>
        <td>
          <button type="button" class="btn danger btn-sm" onclick="removeSubject(${index})">삭제</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.addSubject = () => {
    if (localSettings.subjects.length >= 5) {
      alert('과목은 최대 5개까지만 추가할 수 있습니다.');
      return;
    }
    localSettings.subjects.push({
      id: 'sub' + Date.now(),
      name: `과목 ${localSettings.subjects.length + 1}`,
      questionCount: 20
    });
    renderSubjectRows();
  };

  window.removeSubject = (index) => {
    if (localSettings.subjects.length <= 1) {
      alert('최소 1개의 과목은 있어야 합니다.');
      return;
    }
    localSettings.subjects.splice(index, 1);
    renderSubjectRows();
  };

  window.saveForm = async () => {
    // Update local config before saving
    localSettings.examName = document.getElementById('examName').value;
    localSettings.choiceCount = parseInt(document.getElementById('choiceCount').value, 10);
    localSettings.googleApiKey = document.getElementById('googleApiKey').value;

    // Update subjects
    localSettings.subjects.forEach((sub, index) => {
      sub.name = document.getElementById(`subj-name-${index}`).value;
      sub.questionCount = parseInt(document.getElementById(`subj-count-${index}`).value, 10);
    });

    try {
      await saveSettings(localSettings);
      alert('설정이 저장되었습니다.');
      // Refresh to main page or keep here
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ 시험 설정</h1>
        <p class="subtitle">시험 이름, 과목, 문항 수, 선지 개수를 설정합니다.</p>
      </div>
      <button type="button" class="btn primary" onclick="saveForm()">저장하기</button>
    </div>
    
    <form id="settingsForm" onsubmit="event.preventDefault(); saveForm();">
      <div class="card">
        <h3 style="margin-bottom: 24px;">기본 설정</h3>
        <div class="grid-2">
          <div class="form-group">
            <label for="examName">시험명</label>
            <input type="text" id="examName" value="${localSettings.examName}" required>
          </div>
          <div class="form-group">
            <label for="choiceCount">선택지 개수 (기본 4지선다)</label>
            <select id="choiceCount" required>
              <option value="4" ${localSettings.choiceCount === 4 ? 'selected' : ''}>4개 (①~④)</option>
              <option value="5" ${localSettings.choiceCount === 5 ? 'selected' : ''}>5개 (①~⑤)</option>
            </select>
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label for="googleApiKey">Google Cloud Vision API 키 <span style="font-size: 0.8em; color: var(--text-muted); font-weight: normal;">(선택. 학번 인식용. 미입력 시 수동 입력 필요. OMR 자동채점은 작동함)</span></label>
            <input type="password" id="googleApiKey" value="${localSettings.googleApiKey || ''}" placeholder="AIzsyA...">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex-between">
          <h3 style="margin-bottom: 0;">과목 및 문항 설정</h3>
          <button type="button" class="btn secondary outline" onclick="addSubject()">+ 과목 추가</button>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th width="80">순서</th>
              <th>과목명</th>
              <th width="120">문항 수</th>
              <th width="100">관리</th>
            </tr>
          </thead>
          <tbody id="subjectList">
            <!-- Rendered by JS -->
          </tbody>
        </table>
      </div>
      
      <div class="actions-bar">
        <button type="submit" class="btn primary" style="font-size: 1.1rem; padding: 12px 30px;">저장하기</button>
      </div>
    </form>
  `;

  // Initial render
  renderSubjectRows();
}
