import { getStudents } from '../store.js';
import { generateAnswerSheets } from '../utils/pdf.js';

export async function renderAnswerSheet(container, settings) {
  const students = await getStudents();

  if (students.length === 0) {
    container.innerHTML = `
      <h1 class="page-title">📄 답안지 생성</h1>
      <div class="card" style="text-align: center; padding: 50px;">
        <h3 style="color: var(--danger-color); margin-bottom: 20px;">학생 명단이 없습니다.</h3>
        <p>답안지를 생성하려면 먼저 학생 명단을 등록해야 합니다.</p>
        <br>
        <button class="btn primary" onclick="document.querySelector('a[href=\\'/students\\']').click()">학생 관리로 이동</button>
      </div>
    `;
    return;
  }

  const subjectCount = settings.subjects.length;
  const studentCount = students.length;
  const totalPages = subjectCount * studentCount;

  // 정렬 한 번 해두기
  const sortedStudents = [...students].sort((a, b) => a.number - b.number);

  // 전역 함수들 바인딩
  window.handlePrintAll = () => {
    generateAnswerSheets(settings, sortedStudents, null);
  };

  window.handlePrintIndividual = (studentId) => {
    const student = sortedStudents.find(s => s.id === studentId);
    if (!student) return;
    
    const subjectSelect = document.getElementById('print-subject-select');
    const targetSubjectId = subjectSelect.value === 'ALL' ? null : subjectSelect.value;
    
    generateAnswerSheets(settings, [student], targetSubjectId);
  };

  // 과목 드롭다운 옵션 HTML 생성
  let subjectOptions = `<option value="ALL">전체 과목 인쇄</option>`;
  settings.subjects.forEach(sub => {
      subjectOptions += `<option value="${sub.id}">${sub.name}만 인쇄</option>`;
  });

  // 학생별 개별 인쇄 리스트 HTML 생성
  let studentRows = '';
  sortedStudents.forEach(student => {
      studentRows += `
        <tr>
          <td style="text-align: center;"><strong>${student.number}</strong></td>
          <td>${student.name}</td>
          <td style="text-align: right;">
            <button class="btn secondary outline" style="padding: 4px 10px; font-size: 0.85rem;" onclick="handlePrintIndividual('${student.id}')">🖨️ 개별 인쇄</button>
          </td>
        </tr>
      `;
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📄 답안지 생성</h1>
        <p class="subtitle">학생별 맞춤형 답안지를 인쇄합니다.</p>
      </div>
      <button class="btn primary" onclick="handlePrintAll()">🖨️ 전체 학생 일괄 인쇄 (${totalPages}장)</button>
    </div>

    <div class="card timeline-card" style="max-width: 900px; margin-bottom: 24px;">
      <div class="grid-2">
        <div>
          <h3 style="margin-bottom: 16px;">출력 정보 요약</h3>
          <table class="data-table">
            <tr>
              <th>시험명</th>
              <td><span class="exam-name" style="font-size: 1rem;">${settings.examName}</span></td>
            </tr>
            <tr>
              <th>대상 학생</th>
              <td><strong>${studentCount}명</strong></td>
            </tr>
            <tr>
              <th>응시 과목</th>
              <td>
                <div style="line-height: 1.4;">${settings.subjects.map(s => s.name).join(', ')}</div>
                <span style="color: var(--text-muted); font-size: 0.85em;">(총 ${subjectCount}과목)</span>
              </td>
            </tr>
            <tr>
              <th>선지 개수</th>
              <td>${settings.choiceCount}지선다 (동그라미 색칠 방식)</td>
            </tr>
            <tr style="background-color: var(--secondary-color);">
              <th>총 예상 장수</th>
              <td><strong>${totalPages}장</strong> <span style="font-size: 0.9em; color: var(--text-muted);">(학생 1명당 ${subjectCount}장)</span></td>
            </tr>
          </table>
        </div>

        <div style="display: flex; flex-direction: column; justify-content: center;">
          <div style="background: #fffbeb; border-left: 4px solid var(--warning-color); padding: 24px; border-radius: var(--border-radius-sm);">
            <h4 style="color: #b45309; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              인쇄 주의사항
            </h4>
            <ul style="padding-left: 20px; line-height: 1.8; color: #78350f; font-size: 0.95rem;">
              <li><strong>용지 크기:</strong> 반드시 <strong style="color: #92400e;">A4</strong> 크기로 인쇄해주세요.</li>
              <li><strong>여백 설정:</strong> 인쇄 옵션에서 여백을 <strong style="color: #92400e;">'기본값' 또는 '없음'</strong>으로 설정하세요.</li>
              <li><strong>비율:</strong> <strong style="color: #92400e;">배율 100%</strong>를 유지해야 스캔 시 인식이 잘 됩니다.</li>
              <li>화면의 다각형 테두리와 모서리 점(●) 4개가 잘리지 않아야 합니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 개별 인쇄 세션 -->
    <div class="card" style="max-width: 900px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0;">개별 학생 인쇄</h3>
          <div style="display: flex; align-items: center; gap: 8px;">
              <label style="font-weight: bold; font-size: 0.9rem;">대상 과목 선택:</label>
              <select id="print-subject-select" style="padding: 6px; border-radius: 4px; border: 1px solid #cbd5e1;">
                  ${subjectOptions}
              </select>
          </div>
      </div>
      
      <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: var(--border-radius-sm);">
          <table class="data-table" style="margin: 0;">
              <thead style="position: sticky; top: 0; background: white; z-index: 10;">
                  <tr>
                      <th style="width: 80px; text-align: center;">번호</th>
                      <th>이름</th>
                      <th style="width: 120px; text-align: right;">인쇄 기능</th>
                  </tr>
              </thead>
              <tbody>
                  ${studentRows}
              </tbody>
          </table>
      </div>
    </div>
  `;
}
