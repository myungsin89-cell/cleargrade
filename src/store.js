// IndexedDB 기반 데이터 저장소
const DB_NAME = 'autoGraderDB';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('students')) {
        database.createObjectStore('students', { keyPath: 'number' });
      }
      if (!database.objectStoreNames.contains('answerKeys')) {
        database.createObjectStore('answerKeys', { keyPath: 'subjectId' });
      }
      if (!database.objectStoreNames.contains('scanResults')) {
        database.createObjectStore('scanResults', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getAll(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function get(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, data) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function remove(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 기본 설정
const DEFAULT_SETTINGS = {
  id: 'main',
  examName: '진단평가',
  className: '',
  choiceCount: 4,
  subjects: [
    { id: 'sub1', name: '국어', questionCount: 25 },
    { id: 'sub2', name: '수학', questionCount: 25 },
    { id: 'sub3', name: '영어', questionCount: 25 },
  ]
};

async function getSettings() {
  const settings = await get('settings', 'main');
  return settings || DEFAULT_SETTINGS;
}

async function saveSettings(settings) {
  settings.id = 'main';
  return put('settings', settings);
}

async function getStudents() {
  const students = await getAll('students');
  return students.sort((a, b) => a.number - b.number);
}

async function saveStudent(student) {
  return put('students', student);
}

async function removeStudent(number) {
  return remove('students', number);
}

async function clearStudents() {
  return clearStore('students');
}

async function getAnswerKey(subjectId) {
  return get('answerKeys', subjectId);
}

async function saveAnswerKey(answerKey) {
  return put('answerKeys', answerKey);
}

async function getScanResult(id) {
  return get('scanResults', id);
}

async function getAllScanResults() {
  return getAll('scanResults');
}

async function saveScanResult(result) {
  return put('scanResults', result);
}

async function clearScanResults() {
  return clearStore('scanResults');
}

export {
  getSettings, saveSettings,
  getStudents, saveStudent, removeStudent, clearStudents,
  getAnswerKey, saveAnswerKey,
  getScanResult, getAllScanResults, saveScanResult, clearScanResults,
  DEFAULT_SETTINGS
};
