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

// Курс по дням недели (голеностоп): идёт ли группа сегодня и какое по счёту занятие.
// Занятие = день, в который в группе есть хотя бы одна отметка «сделано».
export function courseState(g, log, t, wd) {
  const ids = new Set(g.items.map((i) => i.ex));
  const dates = new Set(log.filter((r) => r.kind === 'done' && ids.has(r.ex)).map((r) => r.date));
  const didToday = dates.has(t);
  const days = g.freq?.days || [0, 1, 2, 3, 4, 5, 6];
  const due = didToday || days.includes(wd);
  let next = '';
  for (let k = 1; k <= 7 && !due; k += 1) {
    const d = (wd + k) % 7;
    if (days.includes(d)) next = k === 1 ? 'завтра' : WEEKDAY_TO[d];
    if (next) break;
  }
  return { due, next, session: didToday ? dates.size : dates.size + 1, total: g.course?.sessions || 0 };
}

// Что положено в день now: каждый день, раз в 14 дней, через день, по дням недели.
// Чистая функция: программа, упражнения, журнал и дата приходят на вход — так её можно проверить на любой день.
export function computeDay({ program, exercises, log, now = new Date() }) {
  const t = today(now);
  const yesterday = today(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const wd = now.getDay();
  const doneToday = new Set(log.filter((r) => r.kind === 'done' && r.date === t).map((r) => r.ex));
  const last = {};
  for (const r of log) if (r.kind === 'done' && (!last[r.ex] || r.date > last[r.ex])) last[r.ex] = r.date;
  const courses = {};
  for (const p of program) for (const g of p.groups) if (g.freq?.days) courses[g.id] = courseState(g, log, t, wd);

  const parts = program.map((p) => ({
    ...p,
    groups: p.groups.map((g) => {
      const items = [];
      const replaced = [];
      let later = '';
      for (const it of g.items) {
        // в дни курса упражнение заменяют упражнения курса; уже отмеченное сегодня оставляем в списке
        if (it.skipWith && courses[it.skipWith]?.due && !doneToday.has(it.ex)) {
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
      let rest = false;
      let restText = '';
      if (g.alternate) {
        const didYesterday = log.some((r) => r.kind === 'done' && r.date === yesterday && g.items.some((i) => i.ex === r.ex));
        const didToday = g.items.some((i) => doneToday.has(i.ex));
        rest = didYesterday && !didToday;
      }
      let courseNote = '';
      const c = courses[g.id];
      if (c) {
        rest = !c.due;
        restText = `Сегодня занятия нет. Следующее — ${c.next}.`;
        if (c.total) courseNote = c.session > c.total ? `Курс из ${c.total} занятий пройден.` : `Сегодня занятие ${c.session} из ${c.total}.`;
      }
      let replacedNote = '';
      if (replaced.length) {
        const names = replaced.map((it) => `«${exercises[it.ex].name}»`).join(' и ');
        const by = program.flatMap((p) => p.groups.map((x) => ({ p, x }))).find(({ x }) => x.id === replaced[0].skipWith);
        replacedNote = `Сегодня вместо упражнений ${names} — похожие из раздела «${by.p.title}»: там они усложняются по программе.`;
      }
      return { ...g, items, rest, restText, later, courseNote, replacedNote };
    }),
  }));
  return { parts, doneToday, log, courses };
}

// Уровень курса по номеру занятия: первый уровень, у которого upTo >= номера. После конца курса — последний.
export function pickStage(stages, session) {
  const last = stages[stages.length - 1].upTo;
  const at = Math.min(Math.max(1, session || 1), last);
  const idx = Math.max(0, stages.findIndex((s) => at <= s.upTo));
  return { idx, at, last, done: session > last };
}

// Уровень с личными заменами: подушка вместо доски, свои ленты.
export function stageView(S, profile = {}, bandNames = []) {
  const v = { ...S };
  if (v.surface === 'board' && profile.board) { v.surface = profile.board.as; v.name = profile.board.name; }
  if (v.band) v.name = `${v.sets} × 10 на каждую ногу, лента ${profile.bands?.[v.band - 1] || bandNames[v.band - 1]}`;
  return v;
}
