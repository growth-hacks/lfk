// Расчёт дня: что положено сегодня, какое по счёту занятие курса, какой уровень упражнения.
// Без DOM и без хранилища — всё приходит на вход. Проверки: tests/day.test.mjs (node --test).
import { today, daysBetween } from './store.js';

export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const WEEKDAY_TO = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
export const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// Курс (голеностоп): какое по счёту занятие. Занятие = день, в который в группе есть хотя бы одна отметка «сделано».
export function courseState(g, log, t) {
  const ids = new Set(g.items.map((i) => i.ex));
  const dates = new Set(log.filter((r) => r.kind === 'done' && ids.has(r.ex)).map((r) => r.date));
  const didToday = dates.has(t);
  return { didToday, session: didToday ? dates.size : dates.size + 1, total: g.course?.sessions || 0 };
}

// Ближайший день плана после wd: «завтра», «в понедельник».
function nextDay(days, wd) {
  for (let k = 1; k <= 7; k += 1) {
    const d = (wd + k) % 7;
    if (days.includes(d)) return k === 1 ? 'завтра' : WEEKDAY_TO[d];
  }
  return '';
}

// Частота программы словами: для «Сегодня» и экрана «План».
export function modeLabel(entry) {
  const days = entry?.days || [];
  switch (entry?.mode) {
    case 'daily': return 'каждый день';
    case 'alternate': return 'через день';
    case 'off': return 'не делаю';
    case 'week': return days.length ? [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ') : 'дни не выбраны';
    default: return 'не выбрано';
  }
}

// Идёт ли программа сегодня по плану пользователя.
//   status: 'today' — по плану сегодня (или уже есть отметка сегодня); 'rest' — по плану не сегодня;
//   'off' — «не делаю»; 'unset' — частота не выбрана. text — пояснение для «Не сегодня».
export function unitState(entry, ids, log, t, yesterday, wd) {
  const did = (date) => log.some((r) => r.kind === 'done' && r.date === date && ids.has(r.ex));
  let mode = entry?.mode;
  const days = entry?.days || [];
  if (mode === 'week' && !days.length) mode = undefined;
  if (did(t)) return { status: 'today', text: '' };
  switch (mode) {
    case 'daily': return { status: 'today', text: '' };
    case 'alternate': {
      // начало можно отложить на завтра, чтобы программы «через день» чередовались, а не шли в один день
      const wait = entry.start && entry.start > t ? daysBetween(t, entry.start) : 0;
      if (wait) return { status: 'rest', text: `начнёшь ${wait === 1 ? 'завтра' : WEEKDAY_TO[(wd + wait) % 7]}` };
      return did(yesterday) ? { status: 'rest', text: 'через день: следующее занятие завтра' } : { status: 'today', text: '' };
    }
    case 'week': return days.includes(wd) ? { status: 'today', text: '' } : { status: 'rest', text: `по плану — ${nextDay(days, wd)}` };
    case 'off': return { status: 'off', text: 'не в плане' };
    default: return { status: 'unset', text: 'частота не выбрана' };
  }
}

// Что положено в день now. Чистая функция: программа, упражнения, журнал, план и дата приходят на вход —
// так её можно проверить на любой день.
//   plan: { units: { [программа]: { mode, days, start } }, order: [раздел…], hidden: [упражнение…] }.
export function computeDay({ program, units = [], exercises, log, plan = {}, now = new Date() }) {
  const t = today(now);
  const yesterday = today(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const wd = now.getDay();
  const doneToday = new Set(log.filter((r) => r.kind === 'done' && r.date === t).map((r) => r.ex));
  const skippedToday = new Set(log.filter((r) => r.kind === 'skip' && r.date === t && !doneToday.has(r.ex)).map((r) => r.ex));
  const hidden = new Set(plan.hidden || []);
  const last = {};
  for (const r of log) if (r.kind === 'done' && (!last[r.ex] || r.date > last[r.ex])) last[r.ex] = r.date;

  // состояние каждой программы и к какой программе относится группа
  const groupsById = {};
  for (const p of program) for (const g of p.groups) groupsById[g.id] = { p, g };
  const unitOf = {};
  const unitStates = {};
  for (const u of units) {
    const ids = new Set(u.groups.flatMap((gid) => groupsById[gid]?.g.items.map((i) => i.ex) || []));
    unitStates[u.id] = { ...unitState(plan.units?.[u.id], ids, log, t, yesterday, wd), unit: u };
    for (const gid of u.groups) unitOf[gid] = u.id;
  }
  const courses = {};
  for (const p of program) for (const g of p.groups) if (g.course) courses[g.id] = courseState(g, log, t);
  const groupToday = (gid) => unitStates[unitOf[gid]]?.status === 'today';

  const order = plan.order || [];
  const rank = (p) => { const i = order.indexOf(p.id); return i < 0 ? order.length + program.indexOf(p) : i; };
  const parts = [...program].sort((a, b) => rank(a) - rank(b)).map((p) => ({
    ...p,
    groups: p.groups.map((g) => {
      const items = [];
      const replaced = [];
      let later = '';
      for (const it of g.items) {
        if (hidden.has(it.ex) && !doneToday.has(it.ex)) continue;
        // в дни курса упражнение заменяют упражнения курса; уже отмеченное сегодня оставляем в списке
        if (it.skipWith && groupToday(it.skipWith) && !doneToday.has(it.ex)) {
          replaced.push(it);
          continue;
        }
        if (it.freq?.every) {
          const l = last[it.ex];
          const due = doneToday.has(it.ex) || !l || daysBetween(l, t) >= it.freq.every;
          if (!due) {
            const left = it.freq.every - daysBetween(l, t);
            later = `${exercises[it.ex].name} — через ${left} ${plural(left, ['день', 'дня', 'дней'])}.`;
            continue;
          }
        }
        items.push(it.ex);
      }
      const st = unitStates[unitOf[g.id]] || { status: 'unset', text: 'частота не выбрана' };
      let courseNote = '';
      const c = courses[g.id];
      if (c?.total) courseNote = c.session > c.total ? `Курс из ${c.total} занятий пройден.` : `Сегодня занятие ${c.session} из ${c.total}.`;
      let replacedNote = '';
      let replacedBy = '';
      if (replaced.length) {
        const names = replaced.map((it) => `«${exercises[it.ex].name}»`).join(' и ');
        const by = groupsById[replaced[0].skipWith];
        replacedBy = by.p.id;
        replacedNote = `${names} сегодня — в разделе «${by.p.title}»: там они усложняются по программе.`;
      }
      return { ...g, unit: unitOf[g.id] || '', status: st.status, statusText: st.text, today: st.status === 'today', items, later, courseNote, replacedNote, replacedBy };
    }),
  }));
  const planEmpty = units.every((u) => !plan.units?.[u.id]?.mode);
  return { parts, doneToday, skippedToday, log, courses, units: unitStates, planEmpty };
}

// Уровень курса по номеру занятия: первый уровень, у которого upTo >= номера. После конца курса — последний.
export function pickStage(stages, session) {
  const last = stages[stages.length - 1].upTo;
  const at = Math.min(Math.max(1, session || 1), last);
  const idx = Math.max(0, stages.findIndex((s) => at <= s.upTo));
  return { idx, at, last, done: session > last };
}

// Личная пометка «Для тебя»: строка — всегда; { text, when } — только на подходящем уровне курса.
export function noteFor(note, stage, stageIndex) {
  if (!note) return '';
  if (typeof note === 'string') return note;
  return note.when && !note.when(stage, stageIndex) ? '' : note.text;
}

// Уровень с личными заменами: подушка вместо доски, свои ленты.
export function stageView(S, profile = {}, bandNames = []) {
  const v = { ...S };
  if (v.surface === 'board' && profile.board) { v.surface = profile.board.as; v.name = profile.board.name; }
  if (v.band) v.name = `${v.sets} × 10 на каждую ногу, лента ${profile.bands?.[v.band - 1] || bandNames[v.band - 1]}`;
  return v;
}
