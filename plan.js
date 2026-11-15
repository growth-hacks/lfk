// Экран «План»: как часто делать каждую программу, порядок разделов, какие упражнения не показывать.
// План хранится на телефоне (kv): plan:unit:<программа> = { mode, days, start }, plan:order, plan:hidden.
// Читается один раз при запуске (loadPlan), дальше живёт в памяти и записывается при каждом изменении.
import { PROGRAM, UNITS } from './data/program.js';
import { EXERCISES } from './data/exercises.js';
import { kvGet, kvSet, today } from './store.js';
import { modeLabel, WEEKDAY_SHORT } from './day.js';

const plan = { units: {}, order: [], hidden: [] };

export async function loadPlan() {
  plan.units = {};
  for (const u of UNITS) {
    const v = await kvGet(`plan:unit:${u.id}`, null);
    if (v?.mode) plan.units[u.id] = v;
  }
  plan.order = await kvGet('plan:order', []);
  plan.hidden = await kvGet('plan:hidden', []);
}
export const getPlan = () => plan;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MODES = [
  ['daily', 'Каждый день', ''],
  ['alternate', 'Через день', 'после занятия — день отдыха'],
  ['week', 'По дням недели', ''],
  ['off', 'Не делаю', ''],
];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // с понедельника
// Раскрытые и свёрнутые вручную блоки — помним, пока открыто приложение. Невыбранная программа раскрыта сама.
const opened = new Set();
const closed = new Set();
let reorder = false;

const tomorrow = () => { const d = new Date(); return today(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); };

// «Через день»: с какого дня начать. Чтобы в один день не выпадало всё сразу, новая программа
// начинается в тот из двух дней (сегодня или завтра), где программ «через день» меньше.
function suggestStart(id) {
  const t = today();
  const others = UNITS.filter((u) => u.id !== id && plan.units[u.id]?.mode === 'alternate');
  const later = others.filter((u) => (plan.units[u.id].start || t) > t).length;
  return others.length - later > later ? tomorrow() : t;
}

function partsInOrder() {
  const rank = (p) => { const i = plan.order.indexOf(p.id); return i < 0 ? plan.order.length + PROGRAM.indexOf(p) : i; };
  return [...PROGRAM].sort((a, b) => rank(a) - rank(b));
}
const groupsOf = (u) => PROGRAM.flatMap((p) => p.groups).filter((g) => u.groups.includes(g.id));

function unitHtml(u, single) {
  const e = plan.units[u.id];
  const value = modeLabel(e);
  const unset = !e?.mode || (e.mode === 'week' && !e.days?.length);
  const modes = MODES.map(([m, label, sub]) => `<label class="pu-mode">
      <input type="radio" name="mode-${esc(u.id)}" value="${m}" data-unit="${esc(u.id)}"${e?.mode === m ? ' checked' : ''}>
      <span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
    </label>`).join('');
  let extra = '';
  if (e?.mode === 'week') {
    const chosen = e.days || [];
    const per = u.hint?.perWeek;
    const warn = !chosen.length ? 'Выбери дни.' : (per && chosen.length > per ? `Это больше, чем рекомендуется: ${per} раза в неделю.` : '');
    extra = `<div class="pu-days" role="group" aria-label="Дни недели">${WEEK.map((d) => `<button type="button" class="day" data-unit="${esc(u.id)}" data-day="${d}" aria-pressed="${chosen.includes(d)}">${WEEKDAY_SHORT[d]}</button>`).join('')}</div>
      ${warn ? `<p class="small">${esc(warn)}</p>` : ''}`;
  } else if (e?.mode === 'alternate') {
    const later = (e.start || '') > today();
    extra = `<div class="pu-start" role="group" aria-label="Когда начать">
        <span class="small">Начать:</span>
        <button type="button" class="day" data-unit="${esc(u.id)}" data-start="today" aria-pressed="${!later}">сегодня</button>
        <button type="button" class="day" data-unit="${esc(u.id)}" data-start="tomorrow" aria-pressed="${later}">завтра</button>
      </div>`;
  }
  const groups = groupsOf(u);
  const ids = groups.flatMap((g) => g.items.map((i) => i.ex));
  const shown = ids.filter((id) => !plan.hidden.includes(id)).length;
  const course = groups.some((g) => g.course);
  const exList = `<details class="more pu-ex"${opened.has(`ex:${u.id}`) ? ' open' : ''} data-open-key="ex:${esc(u.id)}">
      <summary>Упражнения: ${shown} из ${ids.length}</summary>
      <ul class="pu-ex-list">${ids.map((id) => `<li><label><input type="checkbox" data-show-ex="${esc(id)}"${plan.hidden.includes(id) ? '' : ' checked'}> ${esc(EXERCISES[id].name)}</label></li>`).join('')}</ul>
      ${course ? '<p class="small">Это упражнения курса: если убрать одно, курс станет неполным.</p>' : ''}
    </details>`;
  return `<details class="pu" data-unit-box="${esc(u.id)}" data-open-key="${esc(u.id)}"${opened.has(u.id) || (unset && !closed.has(u.id)) ? ' open' : ''}>
    <summary><span class="pu-title">${esc(single ? 'Как часто' : u.short || u.title)}</span><span class="pu-value${unset ? ' is-unset' : ''}">${esc(value)}</span><span class="part-chev" aria-hidden="true"></span></summary>
    <div class="pu-body">
      ${u.hint ? `<p class="small">${esc(u.hint.text)}</p>` : ''}
      <fieldset class="pu-modes"><legend class="visually-hidden">Как часто: ${esc(u.title)}</legend>${modes}</fieldset>
      ${extra}
      ${exList}
    </div>
  </details>`;
}

function listHtml() {
  return partsInOrder().map((p) => {
    const units = UNITS.filter((u) => u.part === p.id);
    const handle = reorder ? `<span class="pu-handle" tabindex="0" role="button" aria-label="${esc(p.title)}: перетащи или двигай стрелками вверх и вниз">≡</span>` : '';
    return `<section class="plan-part${reorder ? ' is-sorting' : ''}" data-part="${esc(p.id)}">
      <div class="plan-part-head"><h2>${esc(p.title)}</h2>${handle}</div>
      ${reorder ? '' : units.map((u) => unitHtml(u, units.length === 1)).join('')}
    </section>`;
  }).join('');
}

export function renderPlan(root, topBarHtml) {
  root.innerHTML = `
    ${topBarHtml}
    <header>
      <h1>План</h1>
      <p>Выбери, как часто делать каждую программу. «Сегодня» покажет только то, что по плану.</p>
    </header>
    <p class="small plan-sort-hint"${reorder ? '' : ' hidden'}>Перетащи разделы пальцем в нужном порядке.</p>
    <div id="plan-list" class="plan-list">${listHtml()}</div>
    <div class="plan-foot">
      <button type="button" class="ghost-btn" data-reorder>${reorder ? 'Готово' : 'Изменить порядок'}</button>
      <a class="primary" href="#today">К списку на сегодня</a>
    </div>`;
}

function refresh(root) {
  const list = root.querySelector('#plan-list');
  if (list) list.innerHTML = listHtml();
  const btn = root.querySelector('[data-reorder]');
  if (btn) btn.textContent = reorder ? 'Готово' : 'Изменить порядок';
  const hint = root.querySelector('.plan-sort-hint');
  if (hint) hint.hidden = !reorder;
}

async function setUnit(id, entry) {
  plan.units[id] = entry;
  await kvSet(`plan:unit:${id}`, entry);
}

async function saveOrder(list) {
  plan.order = [...list.querySelectorAll('.plan-part')].map((s) => s.dataset.part);
  await kvSet('plan:order', plan.order);
}

// Перетаскивание разделов: карточка едет за пальцем, остальные расступаются (меняем место в списке на лету).
function wireDrag(root) {
  let drag = null;
  root.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('#plan-list .plan-part.is-sorting');
    if (!card || drag) return;
    e.preventDefault();
    const rect = card.getBoundingClientRect();
    drag = { card, list: card.parentElement, grab: e.clientY - rect.top, id: e.pointerId };
    try { card.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает, пока палец над списком */ }
    card.classList.add('is-dragging');
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { card, list, grab } = drag;
    // найти соседа, чью середину палец уже прошёл, и встать рядом с ним
    const others = [...list.querySelectorAll('.plan-part')].filter((s) => s !== card);
    const before = others.find((s) => { const r = s.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    if (before ? card.nextElementSibling !== before : list.lastElementChild !== card) list.insertBefore(card, before || null);
    card.style.transform = '';
    const natural = card.getBoundingClientRect().top;
    card.style.transform = `translateY(${e.clientY - grab - natural}px)`;
  });
  const drop = async (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { card, list } = drag;
    drag = null;
    card.style.transform = '';
    card.classList.remove('is-dragging');
    await saveOrder(list);
  };
  root.addEventListener('pointerup', drop);
  root.addEventListener('pointercancel', drop);
  // с клавиатуры: стрелки на ручке
  root.addEventListener('keydown', async (e) => {
    const h = e.target.closest?.('.pu-handle');
    if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const card = h.closest('.plan-part');
    const list = card.parentElement;
    if (e.key === 'ArrowUp' && card.previousElementSibling) list.insertBefore(card, card.previousElementSibling);
    if (e.key === 'ArrowDown' && card.nextElementSibling) list.insertBefore(card.nextElementSibling, card);
    h.focus();
    await saveOrder(list);
  });
  // долгое нажатие на заголовок раздела включает перестановку
  let press = null;
  const cancel = () => { if (press) { clearTimeout(press.timer); press = null; } };
  root.addEventListener('pointerdown', (e) => {
    const head = e.target.closest('#plan-list .plan-part:not(.is-sorting) .plan-part-head');
    if (!head) return;
    press = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { press = null; reorder = true; navigator.vibrate?.(15); refresh(root); }, 500) };
  });
  root.addEventListener('pointermove', (e) => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancel(); });
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
}

// Нажатия на экране «План». Вешается один раз на корень приложения.
export function wirePlan(root) {
  wireDrag(root);
  root.addEventListener('change', async (e) => {
    if (!e.target.closest('#plan-list')) return;
    const t = e.target;
    if (t.matches('input[type=radio][data-unit]')) {
      const id = t.dataset.unit;
      opened.add(id);
      const prev = plan.units[id] || {};
      await setUnit(id, { mode: t.value, days: prev.days || [], start: t.value === 'alternate' ? suggestStart(id) : prev.start || '' });
      refresh(root);
    } else if (t.matches('[data-show-ex]')) {
      const id = t.dataset.showEx;
      plan.hidden = t.checked ? plan.hidden.filter((x) => x !== id) : [...plan.hidden, id];
      await kvSet('plan:hidden', plan.hidden);
      refresh(root);
    }
  });
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-reorder]')) { reorder = !reorder; refresh(root); return; }
    if (!e.target.closest('#plan-list')) return;
    const day = e.target.closest('.day[data-day]');
    if (day) {
      const id = day.dataset.unit;
      const d = Number(day.dataset.day);
      const cur = plan.units[id]?.days || [];
      await setUnit(id, { ...plan.units[id], mode: 'week', days: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] });
      refresh(root);
      return;
    }
    const st = e.target.closest('.day[data-start]');
    if (st) {
      const id = st.dataset.unit;
      await setUnit(id, { ...plan.units[id], start: st.dataset.start === 'tomorrow' ? tomorrow() : today() });
      refresh(root);
    }
  });
  root.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.matches?.('details[data-open-key]') || !d.closest('#plan-list')) return;
    const k = d.dataset.openKey;
    if (d.open) { opened.add(k); closed.delete(k); } else { opened.delete(k); closed.add(k); }
  }, true);
}
