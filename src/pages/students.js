import { getStudents, saveStudent, removeStudent, clearStudents } from '../store.js';
import { downloadTemplate, readExcelStudents } from '../utils/excel.js';

export async function renderStudents(container) {
  let students = await getStudents();

  const renderTable = () => {
    const tbody = document.getElementById('studentList');
    tbody.innerHTML = '';

    // Sort students by number
    students.sort((a, b) => a.number - b.number);

    students.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <input type="number" class="edit-num" data-old="${s.number}" value="${s.number}" style="width: 80px;" required>
        </td>
        <td>
          <input type="text" class="edit-name" data-old="${s.number}" value="${s.name}" required>
        </td>
        <td>
          <button type="button" class="btn danger btn-sm" onclick="deleteStudent(${s.number})">삭제</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.deleteStudent = (num) => {
    students = students.filter(s => s.number !== num);
    renderTable();
  };

  window.addEmptyRow = () => {
    const maxNum = students.reduce((max, s) => Math.max(max, s.number), 0);
    students.push({ number: maxNum + 1, name: '' });
    renderTable();
  };

  window.clearAllStudents = () => {
    if (confirm('모든 학생 명단을 삭제하시겠습니까?')) {
      students = [];
      renderTable();
    }
  };

  window.saveStudentsForm = async () => {
    const nums = document.querySelectorAll('.edit-num');
    const names = document.querySelectorAll('.edit-name');

    // Set for duplicate check
    const numSet = new Set();
    const newStudents = [];

    for (let i = 0; i < nums.length; i++) {
      const num = parseInt(nums[i].value, 10);
      const name = names[i].value.trim();

      if (isNaN(num) || !name) {
        alert('출석번호와 이름을 모두 입력해주세요.');
        return;
      }
      if (numSet.has(num)) {
        alert(`중복된 출석번호가 있습니다: ${num}번`);
        return;
      }
      numSet.add(num);
      newStudents.push({ number: num, name });
    }

    try {
      await clearStudents();
      for (const s of newStudents) {
        await saveStudent(s);
      }
      students = newStudents;
      alert('학생 명단이 저장되었습니다.');
      renderTable();
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  let pendingPaste = [];
  let pendingExcel = [];

  // 1. Paste Parsing 
  window.handlePasteInput = (e) => {
    let text = e.target.value;
    pendingPaste = [];
    if (!text) {
      document.getElementById('pastePreviewText').style.display = 'none';
      document.getElementById('pasteAddBtn').style.display = 'none';
      return;
    }

    const lines = text.split('\n');
    lines.forEach(line => {
      let textLine = line.trim();
      if (!textLine) return;

      // Match number at the beginning, then spaces/tabs/punctuation, then the name
      let match = textLine.match(/^(\d+)[\s\t,.\-]+([^0-9\s]+)$/);
      // Fallback: number + spaces + anything
      if (!match) match = textLine.match(/^(\d+)[\s\t]+(.+)$/);

      if (match) {
        let num = parseInt(match[1], 10);
        let name = match[2].trim().replace(/^["']|["']$/g, '');
        pendingPaste.push({ number: num, name });
      }
    });

    const previewEl = document.getElementById('pastePreviewText');
    const addBtn = document.getElementById('pasteAddBtn');

    if (pendingPaste.length > 0) {
      previewEl.innerHTML = `✅ <strong>${pendingPaste.length}</strong>명의 정보가 수집되었습니다.`;
      previewEl.style.display = 'block';
      previewEl.style.color = 'var(--success-color)';
      addBtn.style.display = 'block';
    } else {
      previewEl.innerHTML = `❌ 인식된 학생이 없습니다. 양식(번호 이름)을 확인해주세요.`;
      previewEl.style.display = 'block';
      previewEl.style.color = 'var(--danger-color)';
      addBtn.style.display = 'none';
    }
  };

  window.applyPastedStudents = () => {
    if (pendingPaste.length === 0) return;
    let added = 0;
    pendingPaste.forEach(p => {
      if (!students.find(s => s.number === p.number)) {
        students.push(p);
        added++;
      }
    });
    renderTable();
    alert(`${added}명의 학생 목록이 하단 표에 임시 추가되었습니다. (중복 번호 제외)\\n완료 후 반드시 가장 하단의 [명단 저장하기]를 클릭해주세요.`);
    document.getElementById('pasteArea').value = '';
    document.getElementById('pastePreviewText').style.display = 'none';
    document.getElementById('pasteAddBtn').style.display = 'none';
    pendingPaste = [];
  };

  // 2. Excel Upload
  window.handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    pendingExcel = [];
    if (!file) {
      document.getElementById('excelPreviewText').style.display = 'none';
      document.getElementById('excelAddBtn').style.display = 'none';
      return;
    }

    try {
      const imported = await readExcelStudents(file);
      pendingExcel = imported;

      const previewEl = document.getElementById('excelPreviewText');
      const addBtn = document.getElementById('excelAddBtn');

      if (pendingExcel.length > 0) {
        previewEl.innerHTML = `✅ <strong>${pendingExcel.length}</strong>명의 정보가 수집되었습니다.`;
        previewEl.style.display = 'block';
        previewEl.style.color = 'var(--success-color)';
        addBtn.style.display = 'block';
      } else {
        previewEl.innerHTML = `❌ 엑셀에서 데이터를 찾지 못했습니다.`;
        previewEl.style.display = 'block';
        previewEl.style.color = 'var(--danger-color)';
        addBtn.style.display = 'none';
      }
    } catch (err) {
      console.error(err);
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  window.applyExcelStudents = () => {
    if (pendingExcel.length === 0) return;
    let added = 0;
    pendingExcel.forEach(p => {
      if (!students.find(s => s.number === p.number)) {
        students.push(p);
        added++;
      }
    });
    renderTable();
    alert(`${added}명의 학생 목록이 하단 표에 임시 추가되었습니다. (중복 번호 제외)\\n완료 후 반드시 가장 하단의 [명단 저장하기]를 클릭해주세요.`);
    document.getElementById('excelUpload').value = '';
    document.getElementById('excelPreviewText').style.display = 'none';
    document.getElementById('excelAddBtn').style.display = 'none';
    pendingExcel = [];
  };

  // Expose downloadTemplate to global
  window.triggerTemplateDownload = downloadTemplate;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">👨‍🎓 학생 관리</h1>
        <p class="subtitle">반 학생 명단을 등록하고 관리합니다.</p>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="card">
        <h3>빠른 등록 (복사/붙여넣기)</h3>
        <p style="font-size: 0.9em; margin-bottom: 16px; color: var(--text-muted);">
          엑셀이나 한글에서 번호와 함께 학생 명단을 복사해서 이곳에 붙여넣으세요.
        </p>
        <textarea 
          id="pasteArea"
          placeholder="예시:
1 홍길동
2 김철수" 
          style="height: 120px;" 
          oninput="handlePasteInput(event)"
        ></textarea>
        <div style="min-height: 24px;">
          <p id="pastePreviewText" style="display:none; font-size: 0.95em; margin-top: 12px; margin-bottom: 0;"></p>
        </div>
        <button type="button" id="pasteAddBtn" class="btn primary outline" onclick="applyPastedStudents()" style="display:none; margin-top: 12px; width: 100%;">이 명단 표에 추가하기 ↓</button>
      </div>

      <div class="card">
        <h3>엑셀 파일 업로드</h3>
        <p style="font-size: 0.9em; margin-bottom: 16px; color: var(--text-muted);">
          번호와 성함이 적힌 엑셀 파일이 있다면 바로 업로드하여 등록할 수 있습니다.
        </p>
        <div style="margin-bottom: 16px;">
          <button type="button" class="btn secondary outline" onclick="triggerTemplateDownload()">📥 양식 다운로드</button>
        </div>
        <input type="file" id="excelUpload" accept=".xlsx, .xls" onchange="handleExcelUpload(event)" style="padding: 8px; border: 1px dashed var(--primary-color); width: 100%; border-radius: var(--border-radius-sm);"/>
        <div style="min-height: 24px;">
          <p id="excelPreviewText" style="display:none; font-size: 0.95em; margin-top: 12px; margin-bottom: 0;"></p>
        </div>
        <button type="button" id="excelAddBtn" class="btn primary outline" onclick="applyExcelStudents()" style="display:none; margin-top: 12px; width: 100%;">이 명단 표에 추가하기 ↓</button>
      </div>
    </div>

    <div class="card">
      <div class="flex-between">
        <h3 style="margin-bottom: 0;">학생 목록 <span class="badge neutral" style="margin-left: 8px;">총 <span id="studentCount">${students.length}</span>명</span></h3>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn secondary outline" onclick="addEmptyRow()">+ 행 추가</button>
          <button type="button" class="btn danger outline" onclick="clearAllStudents()">전체 삭제</button>
        </div>
      </div>

      <form onsubmit="event.preventDefault(); saveStudentsForm();">
        <table class="data-table">
          <thead>
            <tr>
              <th width="120">출석번호</th>
              <th>이름</th>
              <th width="100">관리</th>
            </tr>
          </thead>
          <tbody id="studentList">
            <!-- Rendered by JS -->
          </tbody>
        </table>
        
        <div class="actions-bar">
          <button type="submit" class="btn primary" style="font-size: 1.1rem; padding: 12px 30px;">명단 저장하기</button>
        </div>
      </form>
    </div>
  `;

  // Update observer for student count
  const observer = new MutationObserver(() => {
    document.getElementById('studentCount').innerText = students.length;
  });
  setTimeout(() => {
    observer.observe(document.getElementById('studentList'), { childList: true });
    renderTable();
  }, 0);
}
