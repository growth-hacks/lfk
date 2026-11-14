// Приложение ЛФК: экраны «Сегодня», плеер упражнения и «Правила». Маршрут — в адресе после #.
import { EXERCISES, WEIGHT_RULE, BAND_NAMES } from './data/exercises.js';
import { PROGRAM } from './data/program.js';
import { PROFILE } from './data/profile.js';
import { SOURCES } from './data/sources.js';
import { FIGURES } from './data/figures.js';
import { RULES, HAND_RULES, STOP_SIGNS, DISCLAIMER } from './data/rules.js';
import { NEED } from './data/equipment.js';
import { kvGet, kvSet, kvAll, logAdd, logAll, logDelete, today, storageOk, replaceAll } from './store.js';
import { makeBackup, parseBackup, backupFileName } from './backup.js';
import { computeDay as computeDayFor, plural, pickStage, stageView as stageViewFor } from './day.js';
import { buildPlan, estimate, createRunner, unlockAudio, soundFor, keepAwake, setMuted, isMuted } from './timer.js';

const app = document.getElementById('app');
let cleanup = null;
let renderToken = 0;

// ---------- мелочи ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Источник: ссылка, если она есть; у личного плана кисти ссылки нет — просто название.
const srcLink = (s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title));
const range = (v) => (Array.isArray(v) ? `${v[0]}–${v[1]}` : `${v}`);
const num = (n) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const minutes = (sec) => Math.max(1, Math.round(sec / 60));
const fmtTime = (s) => { s = Math.ceil(s); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}`; };
const dayLabel = (d = new Date()) => { const s = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); return s[0].toUpperCase() + s.slice(1); };
const dateShort = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d)); };

const ICON = {
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.4" height="12" rx="1"/><rect x="11.6" y="4" width="3.4" height="12" rx="1"/></svg>',
  play: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.3v11.4a.8.8 0 0 0 1.2.7l9-5.7a.8.8 0 0 0 0-1.4l-9-5.7a.8.8 0 0 0-1.2.7Z"/></svg>',
  soundOn: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor"/><path d="M13 7a4 4 0 0 1 0 6M15.2 4.8a7 7 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor"/><path d="M13 7.5l5 5M18 7.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  replay: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.8-4.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5.2 2.6v3.8H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function setTab(name) {
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// ---------- звук: одна настройка на всё приложение ----------
function soundButton() {
  const off = isMuted();
  return `<button class="sound" type="button" data-sound aria-label="${off ? 'Звук выключен. Включить' : 'Звук включён. Выключить'}">
    ${off ? ICON.soundOff : ICON.soundOn}</button>`;
}
function topBar(back, crumb = '') {
  return `<div class="topbar">${back ? '<a class="back" href="#today">Сегодня</a>' : '<span></span>'}${crumb ? `<span class="crumb">${esc(crumb)}</span>` : ''}${soundButton()}</div>`;
}
async function toggleSound() {
  setMuted(!isMuted());
  await kvSet('muted', isMuted());
  document.querySelectorAll('[data-sound]').forEach((b) => { b.outerHTML = soundButton(); });
}

// ---------- упражнения и цели ----------
const RANGED = { hold: { label: 'Держать', unit: 'с', step: 1 }, reps: { label: 'Повторов', step: 1 }, sets: { label: 'Подходов', step: 1 }, duration: { label: 'Время', step: 30, time: true } };

// В какой группе программы упражнение: нужно для курсов, где уровень зависит от номера занятия.
const GROUP_OF = {};
for (const p of PROGRAM) for (const g of p.groups) for (const it of g.items) GROUP_OF[it.ex] = g.id;
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
// Отладка уровней: ?debug=1&session=17#ex/<id> — показать упражнение так, будто сейчас 17-е занятие курса.
const DEBUG_SESSION = new URLSearchParams(location.search).has('debug') ? Number(new URLSearchParams(location.search).get('session')) || 0 : 0;

// Уровень курса с личными заменами: подушка вместо доски, свои ленты.
const stageView = (S) => stageViewFor(S, PROFILE, BAND_NAMES);

async function getEx(id, courses = {}) {
  const base = EXERCISES[id];
  if (!base) return null;
  const ex = { id, ...base, goalId: id };
  if (base.levels) {
    const lvl = Math.min(await kvGet(`level:${id}`, 0), base.levels.length - 1);
    const L = base.levels[lvl];
    Object.assign(ex, { level: lvl, levelName: L.name, dose: L.dose, timer: L.timer, goalId: `${id}:${lvl}` });
  }
  const stages = PROFILE.stages?.[id] || base.stages;
  if (stages) {
    const c = courses[GROUP_OF[id]];
    const { idx, at, last, done } = pickStage(stages, DEBUG_SESSION || c?.session || 1);
    const stage = stageView(stages[idx]);
    Object.assign(ex, {
      stage, stageIndex: idx, session: at, courseTotal: c?.total || last, courseDone: done,
      nextStage: stages[idx + 1] ? { from: stages[idx].upTo + 1, name: stageView(stages[idx + 1]).name } : null,
    });
    if (stage.timer) ex.timer = stage.timer;
  }
  return ex;
}

async function getGoals(ex) {
  const g = {};
  for (const f of Object.keys(RANGED)) {
    if (Array.isArray(ex.timer?.[f])) g[f] = await kvGet(`goal:${ex.goalId}:${f}`, ex.timer[f][0]);
  }
  return g;
}

function doseShort(ex) {
  const t = ex.timer;
  if (ex.levels) return `Ступень ${ex.level + 1}: ${ex.levelName.toLowerCase()}`;
  if (ex.stage) return ex.stage.band ? ex.stage.name : `${ex.dose} · ${lowerFirst(ex.stage.name)}`;
  switch (t.type) {
    case 'measure': return 'обе ноги, результат в см';
    case 'hold': {
      let s = `${range(t.hold)} с × ${range(t.reps ?? 1)}`;
      if (t.sets) s += `, ${range(t.sets)} подхода`;
      if (t.sides) s += t.sides[0].includes('нога') ? ' на каждую ногу' : ', каждое положение';
      return s;
    }
    case 'tempo': return t.sets ? `${range(t.sets)} × ${range(t.reps)}` : `${range(t.reps)} раз`;
    case 'timed': return `${range(Array.isArray(t.duration) ? t.duration.map((s) => s / 60) : t.duration / 60)} мин`;
    case 'count': return `${range(t.reps)} повторов`;
    case 'free': return 'без нормы';
    default: return ex.dose || '';
  }
}

// Что положено сегодня — расчёт в day.js.
async function computeDay() {
  return computeDayFor({ program: PROGRAM, exercises: EXERCISES, log: await logAll(), now: new Date() });
}

async function toggleDone(id, isDone) {
  if (isDone) {
    const t = today();
    const rows = (await logAll()).filter((r) => r.kind === 'done' && r.ex === id && r.date === t);
    for (const r of rows) await logDelete(r.id);
  } else {
    await logAdd({ kind: 'done', ex: id, manual: true });
  }
}

// ---------- маршруты ----------
// Возврат из упражнения на «Сегодня» — к тому же месту списка, а не в начало.
let lastRoute = '';
let todayScroll = 0;

async function route() {
  cleanup?.();
  cleanup = null;
  if (lastRoute === 'today') todayScroll = window.scrollY;
  const token = ++renderToken;
  const hash = decodeURIComponent(location.hash.slice(1));
  const isPlayer = hash.startsWith('ex/');
  document.body.classList.toggle('player', isPlayer);
  if (isPlayer) {
    lastRoute = 'player';
    window.scrollTo(0, 0);
    await renderPlayer(hash.slice(3), token);
  } else if (hash === 'rules') {
    lastRoute = 'rules';
    window.scrollTo(0, 0);
    await renderRules(token);
  } else {
    const back = lastRoute === 'player';
    lastRoute = 'today';
    await renderToday(token);
    if (token === renderToken) window.scrollTo(0, back ? todayScroll : 0);
  }
}

// Общие нажатия: звук, галочки в списке, сворачивание разделов.
app.addEventListener('click', async (e) => {
  if (e.target.closest('[data-sound]')) { toggleSound(); return; }
  if (e.target.closest('[data-backup-save]')) { saveBackup(); return; }
  if (e.target.closest('[data-backup-load]')) { app.querySelector('#backup-file')?.click(); return; }
  const tick = e.target.closest('.tick-btn');
  if (tick) {
    const done = tick.getAttribute('aria-pressed') === 'true';
    tick.setAttribute('aria-pressed', String(!done)); // сразу, не дожидаясь записи
    tick.closest('.ex-item').classList.toggle('is-done', !done);
    await toggleDone(tick.dataset.ex, done);
    await renderToday(++renderToken);
  }
});
app.addEventListener('change', (e) => {
  if (e.target.id === 'backup-file' && e.target.files?.[0]) loadBackup(e.target.files[0]);
});
app.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.matches?.('details.part')) kvSet(`open:${d.dataset.part}`, d.open);
}, true);

window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 4), { passive: true });

(async () => {
  setMuted(await kvGet('muted', false));
  // Хранилище не открылось — отметки живут только до закрытия. Предупреждаем на всех экранах.
  if (!(await storageOk())) document.getElementById('storage-warn').hidden = false;
  window.addEventListener('hashchange', route);
  route();
})();

// ---------- Сегодня ----------
function exItem(ex, done) {
  return `<li class="ex-item${done ? ' is-done' : ''}">
    <button class="tick-btn" type="button" data-ex="${esc(ex.id)}" aria-pressed="${done}" aria-label="Сделано: ${esc(ex.name)}"><span class="tick">${ICON.check}</span></button>
    <a class="ex-row" href="#ex/${encodeURIComponent(ex.id)}">
      <span class="ex-main"><span class="ex-name">${esc(ex.name)}</span><span class="ex-dose">${esc(doseShort(ex))}</span></span>
      <span class="chev" aria-hidden="true"></span>
    </a>
  </li>`;
}

async function renderToday(token) {
  setTab('today');
  const { parts, doneToday, courses } = await computeDay();
  const relax = await kvGet('relax', 3);
  const exs = {};
  const sec = {};
  for (const p of parts) for (const g of p.groups) for (const id of g.items) {
    const ex = await getEx(id, courses);
    exs[id] = ex;
    sec[id] = estimate(ex.timer, await getGoals(ex), relax);
  }
  const open = {};
  for (const p of parts) open[p.id] = await kvGet(`open:${p.id}`, true);
  if (token !== renderToken) return;

  let total = 0;
  let done = 0;
  let leftSec = 0;
  const partHtml = parts.map((p) => {
    let pTotal = 0;
    let pDone = 0;
    let pSec = 0;
    const groupsHtml = p.groups.map((g) => {
      if (!g.rest) {
        for (const id of g.items) {
          pTotal += 1;
          pSec += sec[id];
          if (doneToday.has(id)) pDone += 1;
          else leftSec += sec[id];
        }
      }
      const list = `<ol class="ex-list">${g.items.map((id) => exItem(exs[id], doneToday.has(id))).join('')}</ol>`;
      const head = g.title ? `<h3 class="group-title">${esc(g.title)}</h3>` : '';
      const notes = [g.rest ? '' : g.courseNote, g.note, g.later, g.replacedNote].filter(Boolean).map((n) => `<p class="group-note">${esc(n)}</p>`).join('');
      const body = g.rest
        ? `<p class="rest">${esc(g.restText || 'Сегодня отдых: силовые были вчера. Следующие — завтра.')}</p>
           <details class="more"><summary>Показать упражнения</summary>${list}</details>`
        : list;
      return `<div class="group">${head}${notes}${body}</div>`;
    }).join('');
    total += pTotal;
    done += pDone;
    const meta = pTotal ? `${pDone} из ${pTotal} · ~${minutes(pSec)} мин` : 'сегодня отдых';
    return `<details class="part" data-part="${p.id}"${open[p.id] ? ' open' : ''}>
      <summary><span class="part-title">${esc(p.title)}</span><span class="part-meta">${esc(meta)}</span><span class="part-chev" aria-hidden="true"></span></summary>
      <div class="part-body">
        ${p.when ? `<p class="when"><b>Когда удобно.</b> ${esc(p.when)}</p>` : ''}
        ${groupsHtml}
      </div>
    </details>`;
  }).join('');

  const pct = total ? Math.round((100 * done) / total) : 0;
  const summary = done === total && total > 0
    ? 'Всё на сегодня сделано'
    : `Сделано ${done} из ${total} · осталось ~${minutes(leftSec)} мин`;

  app.innerHTML = `
    ${topBar(false)}
    <header>
      <p class="eyebrow">${esc(dayLabel())}</p>
      <h1>Сегодня</h1>
      <div class="progress">
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="Сделано за сегодня"><span style="width:${pct}%"></span></div>
        <p>${esc(summary)}</p>
      </div>
    </header>
    <div class="parts">${partHtml}</div>`;
}

// ---------- Правила ----------
async function renderRules(token = renderToken) {
  const lastBackup = await kvGet('lastBackup', '');
  if (token !== renderToken) return;
  setTab('rules');
  const li = (r) => `<li><b>${esc(r.title)}</b> ${esc(r.text)}</li>`;
  app.innerHTML = `
    ${topBar(false)}
    <header><p class="eyebrow">Перед началом</p><h1>Правила</h1></header>
    <section><ul class="rules">${RULES.map(li).join('')}</ul></section>
    <section aria-labelledby="h-hand"><h2 id="h-hand">Кисть</h2><ul class="rules">${HAND_RULES.map(li).join('')}</ul></section>
    <section aria-labelledby="h-stop"><h2 id="h-stop">Когда остановиться и идти к врачу</h2>
      <p>${esc(STOP_SIGNS.lead)}</p>
      <ul class="plain">${STOP_SIGNS.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </section>
    <section aria-labelledby="h-backup"><h2 id="h-backup">Резервная копия</h2>
      <p>Журнал хранится только на этом телефоне. Раз в неделю сохраняй копию в файл: по ней восстановятся отметки, замеры и номера занятий курса. Загрузить файл можно и в другом браузере.</p>
      <p class="small" id="backup-last">${lastBackupText(lastBackup)}</p>
      <div class="backup-btns">
        <button class="primary" type="button" data-backup-save>Сохранить в файл</button>
        <button class="ghost-btn" type="button" data-backup-load>Загрузить из файла</button>
        <input type="file" id="backup-file" accept=".json,application/json" hidden>
      </div>
      <p class="small" id="backup-status" role="status" aria-live="polite"></p>
    </section>
    <section aria-labelledby="h-src"><h2 id="h-src">Источники</h2>
      <ul class="plain">${Object.values(SOURCES).map((s) => `<li>${srcLink(s)}</li>`).join('')}</ul>
      <p class="small">${esc(DISCLAIMER)}</p>
    </section>`;
}

// ---------- резервная копия ----------
const records = (n) => `${n} ${plural(n, ['запись', 'записи', 'записей'])}`;
const lastBackupText = (iso) => (iso ? `Последняя копия — ${esc(dateShort(iso))}.` : 'Копий ещё не было.');
function backupStatus(text) {
  const el = app.querySelector('#backup-status');
  if (el) el.textContent = text;
}

async function saveBackup() {
  const now = new Date();
  await kvSet('lastBackup', today(now)); // до сборки файла: восстановленная копия знает свою дату
  const data = makeBackup({ kv: await kvAll(), log: await logAll(), now });
  const name = backupFileName(now);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  const last = app.querySelector('#backup-last');
  if (last) last.innerHTML = lastBackupText(today(now));
  backupStatus(`Файл ${name} сохранён в «Загрузки»: ${records(data.log.length)} журнала.`);
}

async function loadBackup(file) {
  const input = app.querySelector('#backup-file');
  let data;
  try {
    data = parseBackup(await file.text());
  } catch (err) {
    backupStatus(err.message);
    if (input) input.value = '';
    return;
  }
  const current = (await logAll()).length;
  const when = data.exported ? ` от ${dateShort(today(new Date(data.exported)))}` : '';
  const ok = confirm(`Загрузить копию${when}? В ней ${records(data.log.length)} журнала. Всё, что сейчас на телефоне (${records(current)}), заменится копией.`);
  if (input) input.value = '';
  if (!ok) return;
  try {
    await replaceAll(data);
  } catch (err) {
    backupStatus('Не получилось записать копию в хранилище телефона. Данные на телефоне не изменились.');
    return;
  }
  setMuted(await kvGet('muted', false));
  await renderRules(++renderToken);
  backupStatus(`Копия загружена: ${records(data.log.length)} журнала.`);
}

// ---------- плеер ----------
// Экран упражнения. До старта: анимация, ракурсы, «Следи». После старта вместо ракурсов — крупный таймер,
// его видно с пола. Кнопки — в закреплённой нижней строке: слева «Пропустить» (только до старта)
// или «Сначала» (на паузе), справа главная. Касание анимации ставит на паузу то, что сейчас идёт.

// Пропущенные сегодня: «Дальше» их больше не предлагает. Помним до перезагрузки страницы.
const skipped = { day: '', ids: new Set() };
function skippedToday() {
  const d = today();
  if (skipped.day !== d) { skipped.day = d; skipped.ids.clear(); }
  return skipped.ids;
}
let settingsOpenFor = '';

// «Для тебя» — первым пунктом «Следи»: личные замены нельзя пропустить.
function watchBlock(ex) {
  const note = PROFILE.notes[ex.id];
  const mine = note ? `<li class="foryou"><span class="tag">Для тебя</span>${esc(note)}</li>` : '';
  if (!ex.watch?.length) return mine ? `<ul class="watch">${mine}</ul>` : '';
  return `<section aria-labelledby="h-watch"><h2 id="h-watch">Следи</h2>
    <ul class="watch">${mine}${ex.watch.map(([b, rest]) => `<li><b>${esc(b)}</b>${esc(rest)}</li>`).join('')}</ul>
  </section>`;
}

function tipsBlock(ex) {
  if (!ex.tips?.length) return '';
  return `<section aria-labelledby="h-tips"><h2 id="h-tips">Совет</h2>
    <ul class="tips">${ex.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </section>`;
}

function levelsPicker(ex) {
  if (!ex.levels) return '';
  return `<div class="levels" role="group" aria-label="Ступень">
    ${ex.levels.map((L, i) => `<button class="lvl" type="button" data-level="${i}" aria-pressed="${i === ex.level}"><b>${i + 1}</b><span>${esc(L.short)}</span></button>`).join('')}
  </div>`;
}

function doseBlock(ex) {
  const src = SOURCES[ex.source];
  const rows = [];
  if (ex.levels) rows.push(['Ступень', `${ex.level + 1} из ${ex.levels.length}: ${esc(ex.levelName)}`]);
  rows.push(['Сколько', esc(ex.dose)]);
  if (ex.stage) {
    rows.push(['Занятие', ex.courseDone ? `курс из ${ex.courseTotal} занятий пройден` : `${ex.session} из ${ex.courseTotal}`]);
    rows.push(['Сейчас', esc(ex.stage.name)]);
    if (ex.nextStage) rows.push(['Дальше', `с ${ex.nextStage.from}-го занятия — ${esc(lowerFirst(ex.nextStage.name))}`]);
  }
  if (ex.progression) rows.push(['Дальше', esc(ex.progression)]);
  if (ex.weight) rows.push(['Вес', esc(WEIGHT_RULE)]);
  if (src) rows.push(['Источник', srcLink(src)]);
  const scale = ex.norms
    ? `<div class="dose"><b>Как читать результат</b><div class="scale">${ex.norms.map(([v, t]) => `<div class="row"><span class="v">${esc(v)}</span><span>${esc(t)}</span></div>`).join('')}</div></div>`
    : '';
  return `<section aria-labelledby="h-dose"><h2 id="h-dose">Сколько</h2>
    <div class="dose">${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span>${v}</span></div>`).join('')}</div>
    ${scale}
  </section>`;
}

function wordsBlock(ex, open) {
  return `<details class="words" id="words"${open ? ' open' : ''}><summary>Описание словами</summary>
    <ol class="steps">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>`;
}

// Строка под названием: что делаешь сегодня, с выбранной целью внутри диапазона источника.
function goalSummary(ex, goals) {
  const t = ex.timer;
  const g = (f) => (Array.isArray(t[f]) ? goals[f] : t[f]);
  let s;
  switch (t.type) {
    case 'hold': {
      const r = g('reps') ?? 1;
      s = r > 1 ? `${g('hold')} с × ${r}` : `${g('hold')} с`;
      if (t.sets) s += `, ${g('sets')} ${plural(g('sets'), ['подход', 'подхода', 'подходов'])}`;
      break;
    }
    case 'tempo':
    case 'count':
      s = t.sets ? `${g('sets')} × ${g('reps')}` : `${g('reps')} ${plural(g('reps'), ['раз', 'раза', 'раз'])}`;
      break;
    case 'timed': s = `${num(g('duration') / 60)} мин`; break;
    case 'measure': return 'обе ноги, результат в см';
    case 'free': return 'без нормы';
    default: return ex.dose || '';
  }
  if (t.sides) s += /нога|Опорная/.test(t.sides[0]) ? ' на каждую ногу' : ', каждое положение';
  return s;
}
function goalLine(ex, goals) {
  let s = ex.stage?.band ? ex.stage.name : goalSummary(ex, goals);
  if (!ex.stage?.band && Object.keys(RANGED).some((f) => Array.isArray(ex.timer[f]))) s = `Цель: ${s}`;
  if (ex.stage && !ex.stage.band) s += ` · ${lowerFirst(ex.stage.name)}`;
  if (ex.levels) s = `Ступень ${ex.level + 1}: ${lowerFirst(ex.levelName)} · ${s}`;
  return s;
}

// Что понадобится: предметы из equipment.js плюс опора и поверхность текущего занятия.
function needOf(ex) {
  const base = NEED[ex.id];
  const items = [Array.isArray(base) ? base[ex.level ?? 0] : base];
  if (ex.stage?.hold === 'hand') items.push('стена');
  items.push({ pad: 'балансировочная подушка', board: 'балансировочная доска' }[ex.stage?.surface]);
  return items.filter(Boolean).join(', ');
}

// Настройки за «изменить»: цель внутри диапазона, пауза между повторами, темп, ступень.
function settingsBox(ex) {
  const t = ex.timer;
  const stepper = (f, label, aria) => `<div class="stepper" data-field="${f}"><span class="lbl">${label}</span><span class="ctl">
      <button type="button" data-d="-1" aria-label="${aria}: меньше">−</button>
      <span class="val" id="val-${f}"></span>
      <button type="button" data-d="1" aria-label="${aria}: больше">+</button></span></div>`;
  const rows = Object.entries(RANGED).filter(([f]) => Array.isArray(t[f])).map(([f, info]) => {
    const r = info.time ? `${range(t[f].map((s) => s / 60))} мин` : `${range(t[f])}${info.unit ? ' ' + info.unit : ''}`;
    return stepper(f, `${info.label}<small>в источнике ${r}</small>`, info.label);
  });
  if (t.type === 'hold' && (t.reps ?? 1) !== 1) rows.push(stepper('relax', 'Пауза между повторами', 'Пауза'));
  const slow = t.type === 'tempo'
    ? '<div class="stepper"><span class="lbl">Темп</span><button class="seg" type="button" id="slow" aria-pressed="false">Медленнее</button></div>'
    : '';
  const lv = levelsPicker(ex);
  if (!rows.length && !slow && !lv) return '';
  return `${lv}${rows.length ? `<div class="goals" id="goals">${rows.join('')}</div>` : ''}${slow}`;
}

// Нижняя строка кнопок. set([текст, действие] | null, [текст, действие] | null) можно звать каждый кадр.
function actionBar() {
  const leftBtn = document.getElementById('act-left');
  const goBtn = document.getElementById('go');
  let leftFn = null;
  let goFn = null;
  let lastL = null;
  let lastG = null;
  leftBtn.addEventListener('click', () => leftFn?.());
  goBtn.addEventListener('click', () => goFn?.());
  return (left, go) => {
    leftFn = left?.[1] || null;
    goFn = go?.[1] || null;
    const l = left?.[0] || '';
    const g = go?.[0] || '';
    if (l !== lastL) { leftBtn.textContent = l; leftBtn.hidden = !l; lastL = l; }
    if (g !== lastG) { goBtn.textContent = g; goBtn.hidden = !g; lastG = g; }
  };
}

async function renderPlayer(id, token) {
  const { parts, doneToday, log, courses } = await computeDay();
  const ex = await getEx(id, courses);
  if (!ex) { location.hash = '#today'; return; }
  const goals = await getGoals(ex);
  const relax = await kvGet('relax', 3);
  if (token !== renderToken) return;

  let crumb = ex.area;
  for (const p of parts) for (const g of p.groups) {
    const i = g.items.indexOf(id);
    if (i >= 0) crumb = `${p.title}${g.title ? ': ' + g.title.toLowerCase() : ''} · ${i + 1} из ${g.items.length}`;
  }
  // «Дальше» и «Пропустить» ведут к следующему несделанному и непропущенному; если таких нет — к списку
  const skip = skippedToday();
  const flat = parts.flatMap((p) => p.groups.filter((g) => !g.rest).flatMap((g) => g.items));
  const open = (x) => x !== id && !doneToday.has(x) && !skip.has(x);
  const nextId = flat.slice(flat.indexOf(id) + 1).find(open) || flat.find(open) || null;
  const nextLabel = nextId ? `Дальше: ${EXERCISES[nextId].name}` : 'К списку на сегодня';
  const goNext = () => { location.hash = nextId ? `#ex/${encodeURIComponent(nextId)}` : '#today'; };
  const skipEx = () => { skip.add(id); goNext(); };

  const isMeasure = ex.timer.type === 'measure';
  const isFree = ex.timer.type === 'free'; // свободная практика: без таймера и норм
  const demoOnly = isMeasure || isFree;
  const need = needOf(ex);
  const settings = demoOnly ? '' : settingsBox(ex);
  const course = ex.stage ? (ex.courseDone ? 'курс пройден' : `занятие ${ex.session} из ${ex.courseTotal}`) : '';

  app.innerHTML = `
    ${topBar(true, crumb)}
    <header class="ex-head">
      <h1>${esc(ex.name)}</h1>
      <p class="meta"><span id="goal-text">${esc(goalLine(ex, goals))}</span>${course ? ` · ${esc(course)}` : ''}${doneToday.has(id) ? ' · <span class="done-mark">сегодня сделано</span>' : ''}${settings ? ' <button class="link" type="button" id="edit" aria-expanded="false" aria-controls="settings">изменить</button>' : ''}</p>
      ${need ? `<p class="need">Понадобится: ${esc(need)}</p>` : ''}
    </header>
    ${settings ? `<div class="settings" id="settings" hidden>${settings}</div>` : ''}
    <div class="stage-card">
      <div class="stage" id="stage" tabindex="0" role="button" aria-label="Анимация. Коснись, чтобы остановить или продолжить">
        <div class="figure" id="figure" hidden></div>
        <div class="hud" aria-hidden="true">
          <span class="pill phase" id="phase" hidden></span>
          <span class="pill count" id="count" hidden></span>
        </div>
        <div class="stage-bar"><span id="bar"></span></div>
        <span class="paused-mark" id="paused-mark" hidden aria-hidden="true">${ICON.play}</span>
      </div>
      <div class="views" id="views" role="group" aria-label="Ракурс" hidden></div>
      <div class="bigtimer" id="bigtimer" hidden><b class="bt-num" id="bt-num"></b><span class="bt-txt"><span class="bt-word" id="bt-word"></span><span class="bt-sub" id="bt-sub"></span></span></div>
    </div>
    ${watchBlock(ex)}
    <div class="legend" id="legend" hidden><span class="sw"></span><span id="legend-text"></span></div>
    ${isMeasure ? measureBox() : ''}
    ${tipsBlock(ex)}
    ${doseBlock(ex)}
    ${wordsBlock(ex, false)}
    <div class="actionbar" id="actionbar">
      <button class="ghost-btn" type="button" id="act-left" hidden></button>
      <button class="primary" type="button" id="go" hidden></button>
    </div>`;

  // «изменить» открывает настройки; открытыми они остаются и после смены ступени
  const editBtn = document.getElementById('edit');
  if (editBtn) {
    const box = document.getElementById('settings');
    const setOpen = (on) => {
      box.hidden = !on;
      editBtn.setAttribute('aria-expanded', String(on));
      editBtn.textContent = on ? 'скрыть' : 'изменить';
      settingsOpenFor = on ? id : '';
    };
    setOpen(settingsOpenFor === id);
    editBtn.addEventListener('click', () => setOpen(box.hidden));
  }

  // Ступени отжиманий
  app.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', async () => {
    const lvl = Number(b.dataset.level);
    if (lvl === ex.level) return;
    await kvSet(`level:${id}`, lvl);
    route();
  }));

  // Картинка: 3D, если есть, иначе схема из прототипа
  const stageEl = document.getElementById('stage');
  const figureEl = document.getElementById('figure');
  let stage = null;
  let m = null;
  let pose = null;
  if (ex.anim) {
    try {
      const [{ createStage }, { createMannequin }, mod] = await Promise.all([
        import('./anim/stage.js'), import('./anim/mannequin.js'), import(`./anim/poses/${ex.anim}.js`),
      ]);
      if (token !== renderToken) return;
      pose = mod.default;
      pose.configure?.(ex);
      stage = createStage(stageEl, { views: pose.views, view: Object.keys(pose.views)[0] });
      if (stage) {
        stageEl.insertBefore(stageEl.querySelector('canvas'), stageEl.firstChild);
        m = createMannequin();
        stage.scene.add(m.root);
        pose.setup(m, stage.scene, stage, ex);
        const viewsEl = document.getElementById('views');
        viewsEl.innerHTML = Object.entries(pose.views).map(([k, v]) => `<button class="seg" type="button" data-view="${k}" aria-pressed="false">${esc(v.label)}</button>`).join('');
        viewsEl.hidden = false;
        if (pose.legend) {
          document.getElementById('legend-text').textContent = pose.legend;
          document.getElementById('legend').hidden = false;
        }
        const viewBtns = [...viewsEl.querySelectorAll('[data-view]')];
        stage.onView((name) => {
          const fp = !!pose.views[name]?.firstPerson;
          m.head.visible = !fp;
          m.neck.visible = !fp;
          viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
        });
        viewBtns.forEach((b) => b.addEventListener('click', () => stage.setView(b.dataset.view)));
        stage.setView(Object.keys(pose.views)[0], false);
      }
    } catch (e) {
      stage = null;
    }
  }
  if (!stage) {
    if (FIGURES[ex.figure]) {
      figureEl.innerHTML = FIGURES[ex.figure];
    } else {
      figureEl.innerHTML = '<p class="hint" style="text-align:center;max-width:28ch">Анимация для этого упражнения ещё в работе. Как делать — в «Описании словами» ниже.</p>';
      document.getElementById('words').open = true;
    }
    figureEl.hidden = false;
  }

  // Анимация уступает место «Следи»: если пункты не помещаются над нижними кнопками, сцена становится ниже, но не ниже 200 px.
  const fitStage = () => {
    if (!stageEl.isConnected) { window.removeEventListener('resize', fitStage); return; }
    const lastLi = app.querySelector('.watch li:last-child');
    if (!lastLi) return;
    stageEl.style.height = '';
    const limit = window.innerHeight - document.getElementById('actionbar').offsetHeight - 8;
    const over = lastLi.getBoundingClientRect().bottom + window.scrollY - limit;
    if (over > 0) stageEl.style.height = `${Math.max(200, stageEl.offsetHeight - over)}px`;
  };
  // после отрисовки: к этому времени нижние кнопки уже подписаны и строка набрала высоту
  setTimeout(fitStage, 0);
  document.fonts?.ready.then(() => setTimeout(fitStage, 0));
  window.addEventListener('resize', fitStage);

  // Касание анимации — пауза или продолжение. Поворот пальцем и щипок касанием не считаются.
  let onStageTap = () => {};
  let down = null;
  let pointers = 0;
  stageEl.addEventListener('pointerdown', (e) => {
    pointers += 1;
    down = pointers === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  });
  const lift = (e) => {
    pointers = Math.max(0, pointers - 1);
    if (!down || e.type === 'pointercancel') { down = null; return; }
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 450;
    down = null;
    if (tap) onStageTap();
  };
  stageEl.addEventListener('pointerup', lift);
  stageEl.addEventListener('pointercancel', lift);
  stageEl.addEventListener('keydown', (e) => {
    if (e.target !== stageEl || (e.key !== ' ' && e.key !== 'Enter')) return;
    e.preventDefault();
    onStageTap();
  });

  if (demoOnly) {
    // Замер и свободная практика: таймера нет, анимация просто показывает движение по кругу.
    const setActions = actionBar();
    let saved = isFree && doneToday.has(id);
    const refresh = () => setActions(
      saved ? null : ['Пропустить', skipEx],
      saved ? [nextLabel, goNext] : (isMeasure ? ['Сохранить', () => document.getElementById('measure').requestSubmit()] : ['Сделал', markFree]),
    );
    async function markFree() {
      await logAdd({ kind: 'done', ex: id });
      soundFor('done');
      saved = true;
      refresh();
    }
    if (isMeasure) wireMeasure(ex, log, () => { saved = true; refresh(); });
    refresh();
    let raf = 0;
    if (pose?.demo && m) {
      const total = pose.demo.reduce((a, p) => a + p.dur, 0);
      const phaseEl = document.getElementById('phase');
      const mark = document.getElementById('paused-mark');
      let t0 = performance.now();
      let paused = false;
      let pausedAt = 0;
      onStageTap = () => {
        paused = !paused;
        if (paused) pausedAt = performance.now();
        else t0 += performance.now() - pausedAt;
        mark.hidden = !paused;
      };
      // отладка: __lfkPreview(t) — замереть на секунде t показа
      let fixedT = null;
      if (new URLSearchParams(location.search).has('debug')) window.__lfkPreview = (t) => { fixedT = t; };
      const loop = (now) => {
        if (!paused) {
          let tt = (fixedT ?? (now - t0) / 1000) % total;
          let i = 0;
          while (tt >= pose.demo[i].dur) { tt -= pose.demo[i].dur; i += 1; }
          pose.pose(m, { phase: i, u: tt / pose.demo[i].dur, t: tt, dur: pose.demo[i].dur, side: 0, rep: 0, kind: 'move', preview: true, view: stage.view });
          phaseEl.textContent = pose.demo[i].label;
          phaseEl.hidden = false;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    cleanup = () => { cancelAnimationFrame(raf); stage?.dispose(); };
    return;
  }

  wireRunner({ ex, goals, relax, stage, m, pose, nextLabel, goNext, skipEx, setStageTap: (fn) => { onStageTap = fn; } });
}

function wireRunner({ ex, goals, relax, stage, m, pose, nextLabel, goNext, skipEx, setStageTap }) {
  const el = (i) => document.getElementById(i);
  const phaseEl = el('phase');
  const countEl = el('count');
  const barEl = el('bar');
  const viewsEl = el('views');
  const bigEl = el('bigtimer');
  const btNum = el('bt-num');
  const btWord = el('bt-word');
  const btSub = el('bt-sub');
  const pausedMark = el('paused-mark');
  const goalText = el('goal-text');
  const slowBtn = el('slow');
  const isCount = ex.timer.type === 'count';
  const setActions = actionBar();
  let speed = 1;
  let previewT = 0;
  let previewPaused = false;
  let doneLogged = false;
  let raf = 0;
  let runner;

  const texts = new Map();
  const setText = (node, s) => { if (texts.get(node) !== s) { node.textContent = s; texts.set(node, s); } };
  const setHTML = (node, s) => { if (texts.get(node) !== s) { node.innerHTML = s; texts.set(node, s); } };

  function makeRunner() {
    runner = createRunner(buildPlan(ex.timer, goals, relax), {
      onEvent(e) {
        soundFor(e);
        if (e === 'done') markDone();
      },
    });
    runner.state.speed = speed;
    syncGoals();
  }

  async function markDone() {
    if (doneLogged) return;
    doneLogged = true;
    keepAwake(false);
    await logAdd({ kind: 'done', ex: ex.id, goals, level: ex.level ?? null });
    if (runner.state.status !== 'done') runner.finishNow();
  }

  function syncGoals() {
    for (const [f, info] of Object.entries(RANGED)) {
      const v = el(`val-${f}`);
      if (!v) continue;
      const val = goals[f];
      v.textContent = info.time ? `${num(val / 60)} мин` : `${val}${info.unit ? ' ' + info.unit : ''}`;
      const [lo, hi] = ex.timer[f];
      const box = v.closest('.stepper');
      box.querySelector('[data-d="-1"]').disabled = val <= lo;
      box.querySelector('[data-d="1"]').disabled = val >= hi;
    }
    const r = el('val-relax');
    if (r) {
      r.textContent = `${relax} с`;
      const box = r.closest('.stepper');
      box.querySelector('[data-d="-1"]').disabled = relax <= 2;
      box.querySelector('[data-d="1"]').disabled = relax >= 10;
    }
    goalText.textContent = goalLine(ex, goals);
  }

  el('goals')?.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b || b.disabled) return;
    const st = runner.state.status;
    if (st !== 'ready' && st !== 'done') return;
    const f = b.closest('.stepper').dataset.field;
    const d = Number(b.dataset.d);
    if (f === 'relax') {
      relax = Math.min(10, Math.max(2, relax + d));
      await kvSet('relax', relax);
    } else {
      const [lo, hi] = ex.timer[f];
      goals[f] = Math.min(hi, Math.max(lo, goals[f] + d * RANGED[f].step));
      await kvSet(`goal:${ex.goalId}:${f}`, goals[f]);
    }
    doneLogged = false;
    makeRunner();
  });

  slowBtn?.addEventListener('click', () => {
    speed = speed === 1 ? 0.5 : 1;
    runner.state.speed = speed;
    slowBtn.setAttribute('aria-pressed', String(speed !== 1));
  });

  // Действия нижних кнопок
  function start() {
    unlockAudio();
    if (runner.state.status === 'paused') { runner.resume(); return; }
    keepAwake(true);
    runner.next();
  }
  function restart() {
    keepAwake(false);
    makeRunner();
    previewT = 0;
    previewPaused = false;
  }
  // Счётные упражнения: повторы считаешь сам, одно нажатие — на подход.
  function countSetDone() {
    const st = runner.state;
    const plan = runner.plan;
    unlockAudio();
    keepAwake(true);
    if (st.status === 'ready') { st.status = 'run'; st.side = 0; st.set = 0; }
    if (st.set < plan.sets - 1) { st.set += 1; soundFor('setEnd'); }
    else if (st.side < plan.sides.length - 1) { st.side += 1; st.set = 0; soundFor('setEnd'); }
    else runner.finishNow();
  }
  function countLabel(st) {
    const plan = runner.plan;
    const where = [plan.sets > 1 ? `подход ${st.set + 1} из ${plan.sets}` : '', plan.sides.length > 1 ? lowerFirst(plan.sides[st.side]) : ''].filter(Boolean);
    return where.length ? `Сделал: ${where.join(', ')}` : 'Сделал';
  }

  setStageTap(() => {
    const st = runner.state.status;
    if (!isCount && st === 'run') runner.pause();
    else if (!isCount && st === 'paused') runner.resume();
    else previewPaused = !previewPaused;
  });

  // Показ до старта: удержание показываем коротко (3 с) и выходим из позы, чтобы не ждать 30 секунд.
  function previewPhase(dt) {
    // у счётных упражнений своих фаз нет — показываем движение из pose.demo
    const src = runner.plan.phases.length ? runner.plan.phases : (pose?.demo || []).map((d) => ({ label: d.label, dur: d.dur, kind: 'move' }));
    const list = src.map((ph, i) => ({
      i, ph, dur: ph.kind === 'hold' ? Math.min(ph.dur, 3) : ph.kind === 'relax' ? 1.4 : ph.dur,
    }));
    if (!list.length) return null;
    if (!previewPaused) previewT += dt * speed;
    const total = list.reduce((s, p) => s + p.dur, 0);
    // стороны и варианты в показе сменяют друг друга: правая → левая нога, А → Б
    const nSides = runner.plan.sides.length;
    const side = nSides > 1 ? Math.floor(previewT / total) % nSides : 0;
    let tt = previewT % total;
    for (const x of list) {
      if (tt < x.dur) return { index: x.i, u: tt / x.dur, t: tt, dur: x.dur, ph: x.ph, side };
      tt -= x.dur;
    }
    return { index: 0, u: 0, t: 0, dur: list[0].dur, ph: list[0].ph, side };
  }

  function update(dt) {
    const st = runner.state;
    const plan = runner.plan;
    const running = st.status === 'run' || st.status === 'paused';
    const timed = running && !isCount && runner.phase;

    // поза манекена: какая фаза, сколько от неё прошло, какая сторона и какой повтор
    if (pose && m) {
      if (timed) {
        const ph = runner.phase;
        pose.pose?.(m, { phase: st.phase, u: runner.phaseU, t: st.t, dur: ph.dur, side: st.side, rep: st.rep, kind: ph.kind, view: stage?.view });
      } else {
        const p = previewPhase(dt);
        const side = st.status === 'between' && st.set >= plan.sets - 1 ? st.side + 1 : (st.status === 'ready' ? (p?.side ?? 0) : st.side);
        if (p) pose.pose?.(m, { phase: p.index, u: p.u, t: p.t, dur: p.dur, side, rep: 0, kind: p.ph.kind, preview: true, view: stage?.view });
      }
    }

    // плашки на анимации: до старта — фаза показа и сторона, потом — подход и сторона
    const where = [plan.sets > 1 ? `Подход ${st.set + 1} из ${plan.sets}` : '', plan.sides[st.side] || ''].filter(Boolean).join(' · ');
    if (st.status === 'ready') {
      const p = pose ? previewPhase(0) : null;
      setText(phaseEl, p ? p.ph.label : '');
      phaseEl.hidden = !p;
      const sideName = plan.sides.length > 1 ? plan.sides[p?.side ?? 0] : '';
      setText(countEl, sideName);
      countEl.hidden = !sideName;
    } else {
      setText(phaseEl, where);
      phaseEl.hidden = !where || st.status === 'done';
      countEl.hidden = true;
    }
    barEl.style.width = timed ? `${(runner.phaseU * 100).toFixed(1)}%` : '0%';
    pausedMark.hidden = !(timed ? st.status === 'paused' : previewPaused);
    stage?.setLabelsVisible(st.status === 'ready');

    // до старта под анимацией ракурсы, потом крупный таймер
    const big = st.status !== 'ready';
    bigEl.hidden = !big;
    viewsEl.hidden = big || !viewsEl.children.length;
    if (big) {
      let n = '';
      let word = '';
      let sub = '';
      const rep = Math.min(st.rep + 1, plan.reps);
      if (running && isCount) {
        n = String(plan.reps);
        word = plural(plan.reps, ['повтор', 'повтора', 'повторов']);
      } else if (timed) {
        word = runner.phase.label;
        if (plan.type === 'tempo') n = `${rep}<small>/${plan.reps}</small>`;
        else {
          n = runner.remaining < 60 ? `${fmtTime(runner.remaining)}<small>с</small>` : fmtTime(runner.remaining);
          if (plan.reps > 1) sub = `повтор ${rep} из ${plan.reps}`;
          else if (plan.type === 'timed' && plan.phases.length > 1) sub = `часть ${st.phase + 1} из ${plan.phases.length}`;
        }
        if (st.status === 'paused') { sub = ''; word = 'Пауза'; }
      } else if (st.status === 'between') {
        word = 'Отдых';
        sub = st.message;
      } else if (st.status === 'done') {
        word = 'Готово';
        sub = 'записал в журнал';
      }
      setHTML(btNum, n);
      btNum.hidden = !n;
      setText(btWord, word);
      setText(btSub, sub);
      btSub.hidden = !sub;
    }

    // нижние кнопки
    if (st.status === 'ready') setActions(['Пропустить', skipEx], isCount ? [countLabel(st), countSetDone] : ['Начать', start]);
    else if (st.status === 'run') setActions(null, isCount ? [countLabel(st), countSetDone] : ['Пауза', () => runner.pause()]);
    else if (st.status === 'paused') setActions(['Сначала', restart], ['Продолжить', start]);
    else if (st.status === 'between') {
      const nextSide = st.set >= plan.sets - 1 ? plan.sides[st.side + 1] : null;
      setActions(null, [nextSide ? `Начать: ${nextSide}` : 'Следующий подход', start]);
    } else if (st.status === 'done') setActions(null, [nextLabel, goNext]);
    el('goals')?.classList.toggle('locked', running || st.status === 'between');
  }

  // Время идёт по часам, а не по кадрам: браузер может реже рисовать кадры, а секунды удержания должны быть честными.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1);
    last = now;
    runner.tick(dt);
    update(Math.min(dt, 0.1));
    raf = requestAnimationFrame(frame);
  }

  // Свернул приложение или погас экран — таймер встаёт на паузу.
  function onVisibility() {
    if (document.hidden && !isCount) runner.pause();
    last = performance.now();
  }
  document.addEventListener('visibilitychange', onVisibility);

  makeRunner();
  update(0);
  raf = requestAnimationFrame(frame);
  if (new URLSearchParams(location.search).has('debug')) {
    window.__lfkRunner = () => runner;
    // Отладка в скрытой панели, где кадры не идут: обновить экран вручную.
    window.__lfkUpdate = () => update(0);
    // Отладка: замереть в превью на моменте t секунд.
    window.__lfkPreview = (t) => { previewT = t; previewPaused = true; update(0); };
  }

  cleanup = () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
    stage?.dispose();
    keepAwake(false);
  };
}

// ---------- тест у стены ----------
function measureBox() {
  return `<form class="runbox measure" id="measure" novalidate>
    <p class="run-status">Запиши результат</p>
    <div class="fields">
      <label for="m-left">Левая нога, см<input id="m-left" name="left" inputmode="decimal" autocomplete="off" placeholder="0"></label>
      <label for="m-right">Правая нога, см<input id="m-right" name="right" inputmode="decimal" autocomplete="off" placeholder="0"></label>
    </div>
    <p class="run-sub" id="m-error" hidden></p>
    <div class="result" id="m-result" hidden></div>
    <div class="history" id="m-history"></div>
  </form>`;
}

function wireMeasure(ex, log, onSaved) {
  const form = document.getElementById('measure');
  const err = document.getElementById('m-error');
  const result = document.getElementById('m-result');
  const hist = document.getElementById('m-history');
  const parse = (v) => Number(String(v).replace(',', '.').trim());

  function verdict(v) { return v >= 10 ? 'обычно считается нормой' : 'икры тугие, растяжка нужна'; }
  function showHistory(rows) {
    const items = rows.filter((r) => r.kind === 'wall').sort((a, b) => b.at - a.at).slice(0, 6);
    hist.innerHTML = items.length
      ? `<b style="color:var(--ink)">Прошлые замеры</b>${items.map((r) => `<span>${esc(dateShort(r.date))}: левая ${num(r.left)} см · правая ${num(r.right)} см</span>`).join('')}`
      : '';
  }
  showHistory(log);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const leftRaw = document.getElementById('m-left').value;
    const rightRaw = document.getElementById('m-right').value;
    const left = parse(leftRaw);
    const right = parse(rightRaw);
    if (!(left >= 0 && left <= 40) || !(right >= 0 && right <= 40) || leftRaw.trim() === '' || rightRaw.trim() === '') {
      err.textContent = 'Введи оба числа в сантиметрах, например 9,5.';
      err.hidden = false;
      form.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    err.hidden = true;
    await logAdd({ kind: 'wall', ex: ex.id, left, right });
    await logAdd({ kind: 'done', ex: ex.id });
    const diff = Math.abs(left - right);
    result.innerHTML = `
      <p class="done-note">Сохранил</p>
      <p>Левая, ${num(left)} см: ${esc(verdict(left))}.</p>
      <p>Правая, ${num(right)} см: ${esc(verdict(right))}.</p>
      ${diff >= 1.5 ? `<p>Разница ${num(diff)} см: заметная асимметрия.</p>` : ''}`;
    result.hidden = false;
    showHistory(await logAll());
    onSaved?.();
  });
}
