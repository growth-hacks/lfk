// Резервная копия: журнал и настройки в файл JSON и обратно.
// Файл приходит снаружи, поэтому parseBackup проверяет всё и пропускает только известный формат.
// Без DOM и без хранилища — проверки в tests/backup.test.mjs.

export const BACKUP_APP = 'lfk';
export const BACKUP_FORMAT = 1;
const MAX_TEXT = 20 * 1024 * 1024;
const MAX_ROWS = 200000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function makeBackup({ kv, log, now = new Date() }) {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exported: now.toISOString(),
    kv,
    log: log.map(({ id, ...row }) => row), // номер записи хранилище назначит заново
  };
}

// Имя файла: lfk-kopiya-2026-11-14.json
export function backupFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `lfk-kopiya-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

// Простое значение JSON неглубокой вложенности: числа, строки, да/нет, списки и объекты из них.
function plainValue(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= 500;
  if (depth >= 3) return false;
  if (Array.isArray(v)) return v.length <= 100 && v.every((x) => plainValue(x, depth + 1));
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    return keys.length <= 50 && keys.every((k) => k.length <= 100 && k !== '__proto__' && plainValue(v[k], depth + 1));
  }
  return false;
}

const fail = (msg) => { throw new Error(msg); };

// Разбирает текст файла. Возвращает { kv, log, exported } или бросает ошибку с понятным текстом.
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT) fail('Файл слишком большой для резервной копии.');
  let d;
  try { d = JSON.parse(text); } catch (e) { fail('Это не файл резервной копии: не получается прочитать.'); }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.app !== BACKUP_APP) fail('Это не файл резервной копии ЛФК.');
  if (d.format !== BACKUP_FORMAT) fail('Копия сделана в другой версии приложения: формат не подходит.');
  if (!Array.isArray(d.kv) || !Array.isArray(d.log)) fail('Файл повреждён: нет журнала или настроек.');
  if (d.kv.length > MAX_ROWS || d.log.length > MAX_ROWS) fail('Файл слишком большой для резервной копии.');

  const kv = d.kv.map((e, i) => {
    if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || !e[0] || e[0].length > 200 || !plainValue(e[1])) {
      fail(`Файл повреждён: настройка № ${i + 1}.`);
    }
    return [e[0], e[1]];
  });
  const log = d.log.map((r, i) => {
    const bad = () => fail(`Файл повреждён: запись журнала № ${i + 1}.`);
    if (!r || typeof r !== 'object' || Array.isArray(r)) bad();
    const { id, ...row } = r;
    if (typeof row.date !== 'string' || !DATE.test(row.date)) bad();
    if (typeof row.kind !== 'string' || !row.kind || row.kind.length > 40) bad();
    if (row.ex !== undefined && (typeof row.ex !== 'string' || row.ex.length > 100)) bad();
    if (!plainValue(row)) bad();
    return row;
  });
  return { kv, log, exported: typeof d.exported === 'string' ? d.exported : '' };
}
