// Личная программа v1: разделы по частям тела, внутри — группы упражнений.
// when — когда удобно делать (из источников). freq: 'daily' — каждый день; { every: 14 } — раз в 14 дней.
// Группа с alternate — через день.
// Группа с freq: { perWeek, days } — курс по дням недели (голеностоп): perWeek — частота из источника,
//   days — дни по умолчанию (0 — воскресенье … 6 — суббота). Будущий график будет менять days, perWeek — подсказка.
//   course: { sessions } — длина курса в занятиях; номер занятия считается по дням с отметками в группе.
// skipWith: 'группа' — в дни этой группы упражнение не показываем: его заменяют упражнения группы.
const daily = (ids) => ids.map((ex) => ({ ex, freq: 'daily' }));
const plain = (ids) => ids.map((ex) => ({ ex }));

export const PROGRAM = [
  {
    id: 'calves', title: 'Икры',
    when: 'После душа: сначала тест у стены, когда подошёл срок, потом растяжка.',
    groups: [
      { id: 'calves-all', items: [{ ex: 'wall-test', freq: { every: 14 } }, ...daily(['calf-straight', 'calf-bent'])] },
    ],
  },
  {
    id: 'feet', title: 'Стопа',
    when: 'Каждый день, 5–10 минут, босиком. Баланс удобно делать, пока чистишь зубы.',
    groups: [
      {
        id: 'feet-all',
        items: [
          ...daily(['short-foot', 'toe-yoga', 'toe-spread']),
          { ex: 'heel-raise', freq: 'daily', skipWith: 'ankle-balance' },
          { ex: 'balance', freq: 'daily', skipWith: 'ankle-balance' },
        ],
      },
    ],
  },
  {
    id: 'ankle', title: 'Голеностоп',
    when: 'Три раза в неделю: сначала баланс, потом лента сидя.',
    groups: [
      {
        id: 'ankle-balance', title: 'Баланс',
        note: 'Программа 2BFit: 3 раза в неделю, 8 недель. Уровень каждого упражнения меняется сам по номеру занятия.',
        freq: { perWeek: 3, days: [1, 3, 5] }, course: { sessions: 24 }, source: 'hupperets2009',
        items: plain(['ankle-split-squat', 'ankle-step-raise', 'ankle-stance', 'ankle-runner', 'ankle-leg-sway', 'ankle-toe-walk']),
      },
      {
        id: 'ankle-band', title: 'Лента',
        note: '3 раза в неделю, 6 недель. Каждую неделю растёт число подходов или жёсткость ленты.',
        freq: { perWeek: 3, days: [1, 3, 5] }, course: { sessions: 18 }, source: 'docherty1998',
        items: plain(['ankle-band-df', 'ankle-band-pf', 'ankle-band-in', 'ankle-band-ev']),
      },
    ],
  },
  {
    id: 'hand', title: 'Кисть',
    when: 'Сначала разминка, потом остальное.',
    groups: [
      { id: 'hand-warmup', title: 'Разминка', note: 'Подвижность из этапа 1, каждый день.', items: daily(['wrist-flex-ext', 'wrist-deviation', 'forearm-rotation-free', 'thumb-mobility']) },
      { id: 'hand-sense', title: 'Чувство положения', note: 'Каждый день.', items: daily(['ball-table', 'ball-wall', 'angle-eyes-closed', 'dart-throw']) },
      { id: 'hand-strength', title: 'Силовые', note: 'Через день, 3–4 раза в неделю.', alternate: true, items: daily(['wrist-ext-weight', 'wrist-flex-weight', 'hammer', 'forearm-rotation', 'grip', 'finger-ext', 'thumb-band', 'pushups']) },
    ],
  },
];
