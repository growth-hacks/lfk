// Хранилище на телефоне (IndexedDB). Два раздела:
//   kv  — настройки и текущие значения: цели в диапазонах, ступень отжиманий, пауза между повторами;
//   log — записи по дням: выполненные упражнения, замеры теста у стены, позже — боль.
// Данные не уходят с телефона. Резервная копия — файл JSON (backup.js, кнопки на экране «Правила»).

const DB_NAME = 'lfk';
const DB_VERSION = 1;
let dbPromise = null;
const memory = { kv: new Map(), log: [] }; // запасной вариант, если IndexedDB недоступна

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('log')) {
        const log = db.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
        log.createIndex('date', 'date');
        log.createIndex('ex', 'ex');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const req2p = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

export async function kvGet(key, fallback) {
  const db = await open();
  if (!db) return memory.kv.has(key) ? memory.kv.get(key) : fallback;
  const v = await tx(db, 'kv', 'readonly', (s) => req2p(s.get(key)));
  return v === undefined ? fallback : v;
}

export async function kvSet(key, value) {
  const db = await open();
  if (!db) { memory.kv.set(key, value); return; }
  await tx(db, 'kv', 'readwrite', (s) => req2p(s.put(value, key)));
}

export async function logAdd(entry) {
  const row = { date: today(), at: Date.now(), ...entry };
  const db = await open();
  if (!db) { memory.log.push({ id: memory.log.length + 1, ...row }); return row; }
  await tx(db, 'log', 'readwrite', (s) => req2p(s.add(row)));
  askPersist();
  return row;
}

export async function logAll() {
  const db = await open();
  if (!db) return memory.log.slice();
  return tx(db, 'log', 'readonly', (s) => req2p(s.getAll()));
}

export async function logDelete(id) {
  const db = await open();
  if (!db) { memory.log = memory.log.filter((r) => r.id !== id); return; }
  await tx(db, 'log', 'readwrite', (s) => req2p(s.delete(id)));
}

// Открылось ли хранилище. Если нет — всё живёт в памяти и пропадёт после закрытия (частный режим, сбой).
export async function storageOk() {
  return Boolean(await open());
}

// Все настройки парами [ключ, значение] — для резервной копии.
export async function kvAll() {
  const db = await open();
  if (!db) return [...memory.kv.entries()];
  return tx(db, 'kv', 'readonly', async (s) => {
    const [keys, values] = await Promise.all([req2p(s.getAllKeys()), req2p(s.getAll())]);
    return keys.map((k, i) => [k, values[i]]);
  });
}

// Загрузка из резервной копии: настройки и журнал заменяются целиком, одной транзакцией.
export async function replaceAll({ kv, log }) {
  const db = await open();
  if (!db) {
    memory.kv = new Map(kv);
    memory.log = log.map((r, i) => ({ ...r, id: i + 1 }));
    return;
  }
  await new Promise((resolve, reject) => {
    const t = db.transaction(['kv', 'log'], 'readwrite');
    const k = t.objectStore('kv');
    const l = t.objectStore('log');
    k.clear();
    l.clear();
    for (const [key, value] of kv) k.put(value, key);
    for (const row of log) l.add(row);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  askPersist();
}

// Просим браузер не удалять данные при нехватке места. Один раз.
let persistAsked = false;
async function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* не страшно */ }
}

// Дата по местному времени в виде 2026-11-10.
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
