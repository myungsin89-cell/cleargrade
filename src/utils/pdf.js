export function generateAnswerSheets(settings, students) {
  // Create a hidden print container
  let printContainer = document.getElementById('print-container');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    document.body.appendChild(printContainer);
  }

  printContainer.innerHTML = '';

  // Add print styles dynamically
  let styleLine = document.getElementById('print-style');
  if (!styleLine) {
    styleLine = document.createElement('style');
    styleLine.id = 'print-style';
    styleLine.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #print-container, #print-container * {
          visibility: visible;
        }
        #print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white;
        }
        @page {
          size: A4;
          margin: 0;
        }
        .page {
          width: 210mm;
          height: 297mm;
          padding: 15mm;
          box-sizing: border-box;
          page-break-after: always;
          position: relative;
          background: white;
          color: black;
          font-family: 'Pretendard', sans-serif;
        }
      }
      
      /* Visible in screen for preview if needed, but normally hidden */
      #print-container {
        display: none;
      }
      @media print {
        #print-container { display: block; }
      }

      /* Answer Sheet Specific Styles */
      .page {
        width: 210mm;
        height: 297mm;
        padding: 15mm;
        box-sizing: border-box;
        position: relative;
        background: white;
        border: 1px solid #ccc; /* For screen preview */
        margin-bottom: 20px;
      }
      
      /* Markers used for OCR alignment */
      .marker {
        position: absolute;
        width: 20px;
        height: 20px;
        background: black !important;
        border-radius: 50%;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .marker.tl { top: 15mm; left: 15mm; }
      .marker.tr { top: 15mm; right: 15mm; }
      .marker.bl { bottom: 15mm; left: 15mm; }
      .marker.br { bottom: 15mm; right: 15mm; }

      .header {
        text-align: center;
        margin-top: 10mm;
        height: 50mm;
        position: relative;
      }
      .header h1 {
        font-size: 24pt;
        margin: 0;
        padding-top: 5mm;
        letter-spacing: 2px;
      }
      .header h2 {
        font-size: 18pt;
        font-weight: normal;
        margin: 5mm 0 0 0;
      }
      .student-info {
        position: absolute;
        bottom: 5mm;
        right: 15mm;
        display: flex;
        gap: 15px;
        font-size: 14pt;
      }
      .student-number-box, .student-name-box {
        display: flex;
        align-items: center;
      }
      .student-val {
        border-bottom: 1px solid black;
        width: 30mm;
        height: 8mm;
        display: inline-block;
        text-align: center;
        margin-left: 5px;
      }

      /* Question Grid */
      .q-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        row-gap: 8mm;
        column-gap: 5mm;
        margin: 0 5mm;
      }
      .q-item {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        font-size: 14pt;
        height: 15mm;
      }
      .q-num {
        width: 10mm;
        text-align: right;
        margin-right: 5mm;
        font-weight: bold;
      }
      .omr-container {
        display: flex;
        gap: 2mm;
        align-items: center;
      }
      .omr-circle {
        width: 6.5mm;
        height: 6.5mm;
        border: 1px solid black;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9pt;
        color: #444;
      }
      
      .instructions {
        position: absolute;
        bottom: 25mm;
        left: 20mm;
        right: 20mm;
        text-align: center;
        font-size: 12pt;
        color: #333;
        border-top: 1px solid #ccc;
        padding-top: 5mm;
      }
    `;
    document.head.appendChild(styleLine);
  }

  // Generate pages: Group by Subject first, then order by Student Number
  let html = '';

  // Sort students by number to ensure ordered printing
  const sortedStudents = [...students].sort((a, b) => a.number - b.number);

  settings.subjects.forEach(subject => {
    sortedStudents.forEach(student => {
      // 1 Page per subject + student
      html += `
        <div class="page">
          <!-- 4 Corners for OCR Perspective Transform -->
          <div class="marker tl"></div>
          <div class="marker tr"></div>
          <div class="marker bl"></div>
          <div class="marker br"></div>

          <div class="header">
            <h1>${settings.examName}</h1>
            <h2>- ${subject.name} -</h2>
            
            <div class="student-info">
              <div class="student-number-box">번호: <span class="student-val">${student.number}</span></div>
              <div class="student-name-box">이름: <span class="student-val">${student.name}</span></div>
            </div>
          </div>

          <div class="q-grid">
      `;

      // Render question circles for OMR
      for (let i = 1; i <= subject.questionCount; i++) {
        let circlesHtml = `<div class="omr-container" data-q="${i}">`;
        for (let c = 1; c <= settings.choiceCount; c++) {
          circlesHtml += `<div class="omr-circle">${c}</div>`;
        }
        circlesHtml += `</div>`;

        html += `
          <div class="q-item">
            <div class="q-num">${i}.</div>
            ${circlesHtml}
          </div>
        `;
      }

      html += `
          </div>
          
          <div class="instructions">
            ※ 해당하는 번호의 <strong>동그라미를 검게 색칠</strong>해주세요. (예: 1번이 정답이면 1번 동그라미를 색칠)<br>
            색칠이 연하거나 여러 개를 칠하면 오답 처리될 수 있습니다.
          </div>
        </div>
      `;
    });
  });

  printContainer.innerHTML = html;

  // Wait a tiny bit for DOM paint, then print
  setTimeout(() => {
    window.print();
  }, 100);
}
