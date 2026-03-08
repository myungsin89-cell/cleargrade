import * as XLSX from 'xlsx';

/**
 * 엑셀 파일 생성 및 다운로드 기능 (학생 명단 양식 등)
 */
export function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const data = [
        ['출석번호', '이름'],
        [1, '홍길동'],
        [2, '김철수'],
        [3, '이영희']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, '학생명단');
    XLSX.writeFile(wb, '학생명단_등록양식.xlsx');
}

/**
 * 엑셀 파일을 읽어 학생 데이터 배열로 변환하는 함수
 */
export function readExcelStudents(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const students = [];
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;
                    let num = parseInt(row[0], 10);
                    let name = (row[1] || '').toString().trim();
                    if (!isNaN(num) && name) {
                        students.push({ number: num, name: name });
                    }
                }
                resolve(students);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * 채점 결과를 엑셀 파일로 다운로드합니다.
 * @param {Object} gradingData - { examName, subjects, students, scores: { [sNum]: { [subId]: { total, details } } } }
 */
export function exportToExcel(gradingData) {
    const wb = XLSX.utils.book_new();
    const { examName, subjects, students, scores } = gradingData;

    // 1. 종합 요약 시트
    const summaryData = [
        [`[ ${examName} ] 종합 채점 결과`],
        [],
        ['출석번호', '이름', ...subjects.map(s => s.name)]
    ];

    students.forEach(st => {
        const row = [st.number, st.name];
        subjects.forEach(sub => {
            const scoreObj = scores[st.number] && scores[st.number][sub.id];
            if (scoreObj) {
                // 점수를 백분율로 환산 (옵션이지만 보통 개수/총점 형태로 표기)
                row.push(`${scoreObj.total} / ${sub.questionCount}`);
            } else {
                row.push('미응시');
            }
        });
        summaryData.push(row);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, '종합 요약');

    // 2. 과목별 상세 시트
    subjects.forEach(sub => {
        const subData = [
            [`[ ${examName} - ${sub.name} ] 문항별 상세 ( O: 맞음, X: 틀림 )`],
            [],
            ['출석번호', '이름', '총 맞은개수', ...Array.from({ length: sub.questionCount }, (_, i) => `${i+1}번`)]
        ];

        students.forEach(st => {
            const scoreObj = scores[st.number] && scores[st.number][sub.id];
            const row = [st.number, st.name];

            if (scoreObj) {
                row.push(scoreObj.total);
                for (let i = 1; i <= sub.questionCount; i++) {
                    row.push(scoreObj.details[i] ? 'O' : 'X');
                }
            } else {
                row.push('미응시');
                for (let i = 1; i <= sub.questionCount; i++) row.push('-');
            }
            subData.push(row);
        });

        const wsSub = XLSX.utils.aoa_to_sheet(subData);
        XLSX.utils.book_append_sheet(wb, wsSub, sub.name);
    });

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${examName}_채점결과_${today}.xlsx`);
}
