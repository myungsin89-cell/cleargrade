import { getSettings, getStudents, getAllScanResults, getAnswerKey } from '../store.js';
import { exportToExcel } from '../utils/excel.js';

export async function renderResults(container, settings) {
  const students = await getStudents();
  const rawScans = await getAllScanResults();

  // 1. Check readiness
  if (students.length === 0) {
    container.innerHTML = `
      <h1 class="page-title">📊 채점 결과</h1>
      <div class="card" style="text-align: center; padding: 50px;">
        <h3 style="color: #666; margin-bottom: 20px;">먼저 학생 명단을 등록하고 스캔을 진행해주세요.</h3>
      </div>
    `;
    return;
  }

  // 2. Prepare Answer Keys
  const answerKeysObj = {};
  for (const sub of settings.subjects) {
    const keyData = await getAnswerKey(sub.id);
    answerKeysObj[sub.id] = keyData ? keyData.answers : {};
  }

  // 3. Grade the Scans (only take reviewed ones if possible, but let's take all to be robust, 
  // warn if unreviewed exist)
  const unreviewedCount = rawScans.filter(r => !r.reviewed).length;
  const scans = rawScans.filter(r => r.studentNumber !== 0); // Ignore unassigned

  // scores = { [studentNumber]: { [subjectId]: { total: number, details: { [qNum]: boolean } } } }
  const scores = {};

  scans.forEach(scan => {
    const sNum = scan.studentNumber;
    const subId = scan.subjectId;
    const keys = answerKeysObj[subId] || {};
    const subDef = settings.subjects.find(s => s.id === subId);

    if (!scores[sNum]) scores[sNum] = {};

    let correctCount = 0;
    const details = {};

    if (subDef) {
      for (let i = 1; i <= subDef.questionCount; i++) {
        const studentAns = scan.ocrData[i] ? scan.ocrData[i].digit : 0;
        const trueAns = keys[i] || -1; // -1 means no key entered 

        const isCorrect = (studentAns === trueAns);
        if (isCorrect) correctCount++;
        details[i] = isCorrect;
      }
    }

    scores[sNum][subId] = {
      total: correctCount,
      details: details
    };
  });

  // 4. Render Layout

  let warningHtml = '';
  if (unreviewedCount > 0) {
    warningHtml = `
      <div style="background: #fff3e0; border-left: 4px solid var(--warning-color); padding: 15px; border-radius: 4px; margin-bottom: 20px;">
        <strong>⚠️ 알림:</strong> 아직 검수가 완료되지 않은 스캔본이 ${unreviewedCount}장 있습니다. 정확한 채점을 위해 모두 검수하는 것을 권장합니다.
      </div>
    `;
  }

  // Generate Table
  let theadHtml = `
    <tr>
      <th style="width: 80px;">번호</th>
      <th style="width: 100px;">이름</th>
      ${settings.subjects.map(s => `<th>${s.name}</th>`).join('')}
    </tr>
  `;
  let tbodyHtml = '';
  students.forEach(st => {
    tbodyHtml += `<tr>
      <td>${st.number}</td>
      <td>${st.name}</td>
    `;

    settings.subjects.forEach(sub => {
      const sData = scores[st.number] && scores[st.number][sub.id];
      if (sData) {
        // Check if key even exists
        const hasKey = Object.keys(answerKeysObj[sub.id] || {}).length > 0;
        if (!hasKey) {
          tbodyHtml += `<td style="color:#aaa;">정답 미입력</td>`;
        } else {
          const pct = Math.round((sData.total / sub.questionCount) * 100);
          const color = pct >= 80 ? 'var(--primary-color)' : (pct < 50 ? 'var(--danger-color)' : '#333');

          tbodyHtml += `
              <td>
                <span style="font-size: 1.1em; font-weight: bold; color: ${color};">${sData.total}</span>
                <span style="font-size: 0.85em; color: #666;"> / ${sub.questionCount}</span>
              </td>
            `;
        }
      } else {
        tbodyHtml += `<td style="color: #999;">미응시</td>`;
      }
    });

    tbodyHtml += `</tr>`;
  });

  // Provide export function manually to window
  window.triggerExport = () => {
    exportToExcel({
      examName: settings.examName,
      subjects: settings.subjects,
      students: students,
      scores: scores
    });
  };

  container.innerHTML = `
    <style>
      .results-table {
        table-layout: fixed;
      }
      .results-table th, .results-table td {
        text-align: center !important;
        vertical-align: middle;
      }
    </style>
    <div class="page-header">
      <div>
        <h1 class="page-title">📊 채점 결과</h1>
        <p class="subtitle">학생별 채점 결과를 확인하고 엑셀로 내보냅니다.</p>
      </div>
      <button class="btn primary" onclick="triggerExport()" style="font-size: 1.05rem;">📥 엑셀 다운로드</button>
    </div>

    ${warningHtml}

    <div class="card">
      <table class="data-table results-table">
        <thead>
          ${theadHtml}
        </thead>
        <tbody>
          ${tbodyHtml}
        </tbody>
      </table>
    </div>
  `;
}
