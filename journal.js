// Журнал показывает первую неделю или последние семь местных календарных дней.
import { EXERCISES } from './data/exercises.js';
import { PROGRAM, UNITS } from './data/program.js';
import { orderParts, plural, WEEKDAY_SHORT } from './day.js';
import { daysBetween, today } from './store.js';

const WEEK_LENGTH = 7;
const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
export const JOURNAL_START_KEY = 'journal:first-week';

function isScheduled(entry) {
  return entry?.mode === 'daily' || entry?.mode === 'alternate' || (entry?.mode === 'week' && entry.days?.length > 0);
}

function plannedDays(entry, days) {
  switch (entry?.mode) {
    case 'daily': return days.length;
    case 'week': {
      const selected = entry.days || [];
      return selected.length ? days.filter((day) => selected.includes(day.weekday)).length : null;
    }
    case 'alternate': {
      // Сравниваем с календарём «через день» от начала, выбранного в плане.
      // В старом плане без даты начала точное число дней неизвестно.
      if (!entry.start) return '3–4';
      return days.filter((day) => day.key >= entry.start && daysBetween(entry.start, day.key) % 2 === 0).length;
    }
    case 'off': return 0;
    default: return null;
  }
}

export function computeJournal({ log = [], plan = {}, firstDay = '', now = new Date() }) {
  const current = today(now);
  const completed = log.filter((row) => row.kind === 'done' && row.date <= current && Object.hasOwn(EXERCISES, row.ex));
  const hasHistory = completed.length > 0;
  const hasPlan = UNITS.some((unit) => isScheduled(plan.units?.[unit.id]));
  const start = firstDay || (hasPlan && !hasHistory ? current : '');
  const elapsed = start ? daysBetween(start, current) : WEEK_LENGTH;
  const firstWeek = elapsed >= 0 && elapsed < WEEK_LENGTH;
  const offset = firstWeek ? -elapsed : 1 - WEEK_LENGTH;
  const days = Array.from({ length: WEEK_LENGTH }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + index);
    const key = today(date);
    return { date, key, weekday: date.getDay(), current: key === current, future: key > current };
  });
  const week = new Set(days.map((day) => day.key));
  const doneByExercise = new Map();
  for (const row of completed) {
    if (!week.has(row.date)) continue;
    if (!doneByExercise.has(row.ex)) doneByExercise.set(row.ex, new Set());
    doneByExercise.get(row.ex).add(row.date);
  }

  const hidden = new Set(plan.hidden || []);
  const sections = [];
  for (const part of orderParts(PROGRAM, plan.order || [])) {
    const units = UNITS.filter((unit) => unit.part === part.id);
    for (const unit of units) {
      const entry = plan.units?.[unit.id];
      const planned = plannedDays(entry, days);
      const active = isScheduled(entry);
      const groups = part.groups.filter((group) => unit.groups.includes(group.id));
      const ids = new Set(groups.flatMap((group) => group.items.map((item) => item.ex)));
      const exercises = [];
      const dates = new Set();
      for (const id of ids) {
        const exercise = EXERCISES[id];
        const marked = doneByExercise.get(id);
        // Сохраняем отметки недели после изменения плана. Замер показываем в неделю, когда он сделан.
        if (!marked && (!active || hidden.has(id) || exercise.timer?.type === 'measure')) continue;
        if (marked) for (const key of marked) dates.add(key);
        exercises.push({ id, name: exercise.name, dates: marked || new Set() });
      }
      if (exercises.length) sections.push({ id: unit.id, title: unit.title, dates, plannedDays: planned, exercises });
    }
  }
  return { days, sections, firstWeek, hasHistory, startToSave: !firstDay && firstWeek ? start : '' };
}

function weekMarks(days, dates) {
  return days.map((day) => `<span class="journal-mark${day.future ? ' future' : dates.has(day.key) ? ' done' : ''}" aria-hidden="true"></span>`).join('');
}

function markedDates(days, dates) {
  const labels = days.filter((day) => dates.has(day.key)).map((day) => dateLabel.format(day.date));
  return labels.length ? `<span class="visually-hidden">Отметки ${labels.join(', ')}.</span>` : '';
}

export function renderJournal(root, { days, sections, firstWeek, hasHistory }, esc) {
  const range = dateLabel.formatRange(days[0].date, days[days.length - 1].date);
  const period = sections.length || firstWeek || hasHistory
    ? `<p class="journal-period">${firstWeek ? 'Первая неделя' : 'Последние 7 дней'} · ${range}</p>` : '';
  const title = `<header><h1>Журнал</h1>${period}</header>`;
  if (!sections.length) {
    const message = hasHistory || firstWeek ? 'За эти семь дней пока нет отметок.' : 'Настрой план, чтобы увидеть первую неделю в журнале.';
    root.innerHTML = `${title}<div class="empty"><p>${message}</p><a class="primary" href="#plan">Открыть план</a></div>`;
    return;
  }

  const dates = days.map((day) => `<span${day.current ? ' class="journal-today"' : day.future ? ' class="journal-future"' : ''}>
    <span>${WEEKDAY_SHORT[day.weekday]}</span><time datetime="${day.key}">${day.date.getDate()}</time>
  </span>`).join('');
  const cards = sections.map(({ id, title, dates, plannedDays, exercises }) => {
    const rows = exercises.map(({ name, dates }) => `<li class="journal-grid">
      <span class="journal-row-label"><span>${esc(name)}</span><small>${dates.size} ${plural(dates.size, ['день', 'дня', 'дней'])}</small>${markedDates(days, dates)}</span>
      ${weekMarks(days, dates)}
    </li>`).join('');
    const target = plannedDays === null ? '—' : `${plannedDays}/${days.length}`;
    return `<details class="journal-group" name="journal-section" data-journal-section="${esc(id)}">
      <summary class="journal-grid">
        <span class="journal-row-label journal-section-label">
          <i class="journal-chevron" aria-hidden="true"></i><b>${esc(title)}</b>
          <small>Сделано: ${dates.size}/${days.length}</small>
          <small>План: ${target}${plannedDays === null ? '<span class="visually-hidden"> Частота не выбрана.</span>' : ''}</small>
          ${markedDates(days, dates)}
        </span>
        ${weekMarks(days, dates)}
      </summary>
      <ul class="journal-exercises">${rows}</ul>
    </details>`;
  }).join('');
  root.innerHTML = `${title}<div class="journal-week">
    <div class="journal-grid journal-dates" aria-hidden="true"><span>Раздел</span>${dates}</div>
    ${cards}
    <div class="journal-legend">
      <span><i class="journal-mark done journal-section-mark" aria-hidden="true"></i>Раздел</span>
      <span><i class="journal-mark done" aria-hidden="true"></i>Упражнение</span>
      <span><i class="journal-mark" aria-hidden="true"></i>Без отметки</span>
    </div>
  </div>`;
}
