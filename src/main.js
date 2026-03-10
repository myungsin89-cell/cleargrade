import './style.css';
import { getSettings } from './store.js';

// Import pages
import { renderSettings } from './pages/settings.js';
import { renderStudents } from './pages/students.js';
import { renderAnswerSheet } from './pages/answerSheet.js';
import { renderAnswerKey } from './pages/answerKey.js';
import { renderScan } from './pages/scan.js';
import { renderReview } from './pages/review.js';
import { renderResults } from './pages/results.js';

// DOM Elements
const app = document.querySelector('#app');
let currentSettings = null;

// Routing logic
const routes = {
  '/': renderHome,
  '/settings': renderSettings,
  '/students': renderStudents,
  '/answer-sheet': renderAnswerSheet,
  '/answer-key': renderAnswerKey,
  '/scan': renderScan,
  '/review': renderReview,
  '/results': renderResults,
};

async function navigate(path) {
  window.history.pushState({}, '', path);
  await renderPage(path);
}

async function renderPage(path) {
  currentSettings = await getSettings();

  // Update navigation active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === path);
  });

  const appEl = document.querySelector('#app');
  const mainContentEl = document.querySelector('.main-content');
  if (mainContentEl) {
    mainContentEl.classList.remove('full-width'); // Reset for normal pages
  }

  if (appEl) {
    appEl.innerHTML = ''; // Clear current content
    await renderFn(appEl, currentSettings);
  }
}

// Layout template
function setupLayout() {
  document.querySelector('#app-container').innerHTML = `
    <nav class="sidebar">
      <div class="sidebar-header">
        <img src="/logo.png" alt="ClearGrade Logo" class="brand-logo" />
        <span class="brand-text"><strong>Clear</strong>Grade</span>
      </div>
      <ul class="nav-links">
        <li><a href="/" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          홈
        </a></li>
        <li><a href="/settings" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          시험 설정
        </a></li>
        <li><a href="/students" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          학생 관리
        </a></li>
        <li><a href="/answer-sheet" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          답안지 생성
        </a></li>
        <li><a href="/answer-key" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
          정답 입력
        </a></li>
        <li><a href="/scan" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          스캔 업로드
        </a></li>
        <li><a href="/review" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          검수하기
        </a></li>
        <li><a href="/results" class="nav-link" data-link>
          <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          채점 결과
        </a></li>
      </ul>
    </nav>
    <main class="main-content">
      <div class="topbar">
        <div class="topbar-info">
          <span class="exam-status">현재 시험:</span>
          <span class="exam-name" id="topbar-exam-name">로딩 중...</span>
        </div>
      </div>
      <div id="app"></div>
    </main>
  `;

  // Handle navigation clicks
  document.body.addEventListener('click', e => {
    if (e.target.matches('[data-link]')) {
      e.preventDefault();
      navigate(e.target.getAttribute('href'));
    }
  });

  // Handle back/forward buttons
  window.addEventListener('popstate', () => {
    renderPage(window.location.pathname);
  });
}

// Home page
function renderHome(container, settings) {
  // Update topbar
  const topbarExamName = document.getElementById('topbar-exam-name');
  if (topbarExamName) {
    topbarExamName.textContent = settings.examName;
  }

  container.innerHTML = `
    <div class="home-container">
      <div class="hero-section">
        <h1 style="color: var(--primary-color);">ClearGrade 스마트 자동 채점</h1>
        <p class="subtitle">다섯 가지 단계로 간편하게 시험을 채점하세요.</p>
        <p class="subtitle" style="font-size: 0.9rem; color: var(--success-color); margin-top: 8px; font-weight: 500;">🛡️ 완벽 오프라인 보안 보장 : 어떤 정보도 외부 인터넷 서버로 전송하지 않습니다.</p>
      </div>
      
      <div class="card timeline-card">
        <h2 class="timeline-title">작업 순서 안내</h2>
        <div class="timeline">
          
          <div class="timeline-item">
            <div class="timeline-point">1</div>
            <div class="timeline-content">
              <h3>시험 및 과목 설정</h3>
              <p>채점할 전체 시험명과 과목, 문항 수를 먼저 설정합니다. (${settings.examName} - ${settings.subjects.length}과목 설정됨)</p>
              <button class="btn primary outline" onclick="document.querySelector('a[href=\\'/settings\\']').click()">설정 확인하기 &rarr;</button>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-point">2</div>
            <div class="timeline-content">
              <h3>학생 명단 등록</h3>
              <p>반 학생 명단을 등록하여 번호와 이름을 매칭시킵니다.</p>
              <button class="btn primary outline" onclick="document.querySelector('a[href=\\'/students\\']').click()">명단 입력하기 &rarr;</button>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-point">3</div>
            <div class="timeline-content">
              <h3>맞춤 답안지 인쇄</h3>
              <p>학생별 정보가 미리 마킹된 검은색 테두리의 OCR 답안지를 인쇄합니다.</p>
              <div class="action-row">
                <button class="btn primary" onclick="document.querySelector('a[href=\\'/answer-sheet\\']').click()">답안지 인쇄하기 &rarr;</button>
                <button class="btn secondary outline" onclick="document.querySelector('a[href=\\'/answer-key\\']').click()">정답 입력하기 &rarr;</button>
              </div>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-point">4</div>
            <div class="timeline-content">
              <h3>답안지 스캔 및 검수</h3>
              <p>학생들이 푼 답안지를 사진으로 찍거나 스캔하여 업로드 후 AI가 인식한 숫자를 맞는지 검수합니다.</p>
              <div class="action-row">
                <button class="btn primary outline" onclick="document.querySelector('a[href=\\'/scan\\']').click()">스캔 업로드 &rarr;</button>
                <button class="btn secondary outline" onclick="document.querySelector('a[href=\\'/review\\']').click()">검수하기 &rarr;</button>
              </div>
            </div>
          </div>

          <div class="timeline-item finish">
            <div class="timeline-point">5</div>
            <div class="timeline-content">
              <h3>결과 확인 및 다운로드</h3>
              <p>자동 채점된 점수를 확인하고 엑셀 파일로 다운로드합니다.</p>
              <button class="btn primary" onclick="document.querySelector('a[href=\\'/results\\']').click()">결과 확인하기 &rarr;</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

// Initialize app
async function init() {
  setupLayout();
  await renderPage(window.location.pathname);
}

init();
