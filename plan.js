// Экран «План»: как часто делать каждую программу, порядок разделов, какие упражнения не показывать.
// План хранится на телефоне (kv): plan:unit:<программа> = { mode, days }, plan:order, plan:hidden.
// Читается один раз при запуске (loadPlan), дальше живёт в памяти и записывается при каждом изменении.
import { PROGRAM, UNITS } from './data/program.js';
import { EXERCISES } from './data/exercises.js';
import { kvGet, kvSet } from './store.js';
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

function partsInOrder() {
  const rank = (p) => { const i = plan.order.indexOf(p.id); return i < 0 ? plan.order.length + PROGRAM.indexOf(p) : i; };
  return [...PROGRAM].sort((a, b) => rank(a) - rank(b));
}
const groupsOf = (u) => PROGRAM.flatMap((p) => p.groups).filter((g) => u.groups.includes(g.id));

function unitHtml(u, single) {
  const e = plan.units[u.id];
  const value = modeLabel(e);
  const unset = !e?.mode || (e.mode === 'week' && !e.days?.length);
  const hint = u.hint ? `Источник: ${u.hint.text} (${u.hint.by}).` : 'В источнике частоты нет, выбери сам.';
  const modes = MODES.map(([m, label, sub]) => `<label class="pu-mode">
      <input type="radio" name="mode-${esc(u.id)}" value="${m}" data-unit="${esc(u.id)}"${e?.mode === m ? ' checked' : ''}>
      <span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
    </label>`).join('');
  let days = '';
  if (e?.mode === 'week') {
    const chosen = e.days || [];
    const warn = !chosen.length ? 'Выбери дни.'
      : (u.hint?.perWeek && chosen.length > u.hint.perWeek ? `Это больше, чем в источнике: там ${u.hint.text}.` : '');
    days = `<div class="pu-days" role="group" aria-label="Дни недели">${WEEK.map((d) => `<button type="button" class="day" data-unit="${esc(u.id)}" data-day="${d}" aria-pressed="${chosen.includes(d)}">${WEEKDAY_SHORT[d]}</button>`).join('')}</div>
      ${warn ? `<p class="small">${esc(warn)}</p>` : ''}`;
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
      <p class="small">${esc(hint)}</p>
      <fieldset class="pu-modes"><legend class="visually-hidden">Как часто: ${esc(u.title)}</legend>${modes}</fieldset>
      ${days}
      ${exList}
    </div>
  </details>`;
}

function listHtml() {
  const parts = partsInOrder();
  return parts.map((p, i) => {
    const units = UNITS.filter((u) => u.part === p.id);
    const move = reorder ? `<span class="pu-move">
        <button type="button" class="ghost-btn" data-move="-1" data-part="${esc(p.id)}" aria-label="${esc(p.title)} выше"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="ghost-btn" data-move="1" data-part="${esc(p.id)}" aria-label="${esc(p.title)} ниже"${i === parts.length - 1 ? ' disabled' : ''}>↓</button>
      </span>` : '';
    return `<section class="plan-part">
      <div class="plan-part-head"><h2>${esc(p.title)}</h2>${move}</div>
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
}

async function setUnit(id, entry) {
  plan.units[id] = entry;
  await kvSet(`plan:unit:${id}`, entry);
}

// Нажатия на экране «План». Вешается один раз на корень приложения.
export function wirePlan(root) {
  root.addEventListener('change', async (e) => {
    if (!e.target.closest('#plan-list')) return;
    const t = e.target;
    if (t.matches('input[type=radio][data-unit]')) {
      const id = t.dataset.unit;
      opened.add(id);
      await setUnit(id, { mode: t.value, days: plan.units[id]?.days || [] });
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
      await setUnit(id, { mode: 'week', days: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] });
      refresh(root);
      return;
    }
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const ids = partsInOrder().map((p) => p.id);
      const i = ids.indexOf(mv.dataset.part);
      const j = i + Number(mv.dataset.move);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      plan.order = ids;
      await kvSet('plan:order', ids);
      refresh(root);
      root.querySelector(`[data-move="${mv.dataset.move}"][data-part="${mv.dataset.part}"]`)?.focus();
    }
  });
  root.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.matches?.('details[data-open-key]') || !d.closest('#plan-list')) return;
    const k = d.dataset.openKey;
    if (d.open) { opened.add(k); closed.delete(k); } else { opened.delete(k); closed.add(k); }
  }, true);
}
