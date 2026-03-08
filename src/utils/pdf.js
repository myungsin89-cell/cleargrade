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
        margin-bottom: 20mm;
      }
      .header h1 {
        font-size: 24pt;
        margin-bottom: 5mm;
        letter-spacing: 2px;
      }
      .header h2 {
        font-size: 18pt;
        font-weight: normal;
        margin-bottom: 10mm;
      }
      .student-info {
        display: flex;
        justify-content: flex-end;
        gap: 20px;
        font-size: 14pt;
        margin-right: 15mm;
      }
      .student-info span {
        border-bottom: 1px solid black;
        padding: 0 10px;
        min-width: 80px;
        display: inline-block;
        text-align: center;
      }

      /* Question Grid */
      .q-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 15px 10px;
        margin: 0 10mm;
      }
      .q-item {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14pt;
      }
      .q-num {
        width: 30px;
        text-align: right;
        margin-right: 15px;
        font-weight: bold;
      }
      .q-box {
        width: 1.5cm;
        height: 1.5cm;
        border: 2px solid black;
        display: flex;
        align-items: center;
        justify-content: center;
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
              <div>번호: <span>${student.number}</span></div>
              <div>이름: <span>${student.name}</span></div>
            </div>
          </div>

          <div class="q-grid">
      `;

      // Render question boxes
      for (let i = 1; i <= subject.questionCount; i++) {
        // Add extra bottom margin every 5 items (which is 1 full row since grid has 5 columns)
        // This creates a visual break for easier reading/grading
        const extraSpacing = (i % 5 === 0 && i !== subject.questionCount) ? 'margin-bottom: 24px;' : '';

        html += `
          <div class="q-item" style="${extraSpacing}">
            <div class="q-num">${i}.</div>
            <div class="q-box" data-q="${i}"></div>
          </div>
        `;
      }

      html += `
          </div>
          
          <div class="instructions">
            ※ 네모 칸 안에 <strong>1부터 ${settings.choiceCount}까지의 숫자 하나</strong>를 정자로 또박또박 적어주세요.<br>
            글씨가 칸 밖으로 나가지 않도록 주의해주세요.
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
