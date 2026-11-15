// Личная программа v1: разделы по частям тела, внутри — группы упражнений.
// when — когда удобно делать (из источников). { every: 14 } у упражнения — раз в 14 дней (в дни своей программы).
// Как часто делать каждую программу, решает пользователь на экране «План» (plan.js); здесь — только подсказки.
// course: { sessions } — курс (голеностоп): длина в занятиях; номер занятия считается по дням с отметками в группе.
// skipWith: 'группа' — в дни программы этой группы упражнение не показываем: его заменяют упражнения группы.
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
    when: 'Сначала баланс, потом лента сидя.',
    groups: [
      {
        id: 'ankle-balance', title: 'Баланс',
        note: 'Программа 2BFit: 3 раза в неделю, 8 недель. Уровень каждого упражнения меняется сам по номеру занятия.',
        course: { sessions: 24 }, source: 'hupperets2009',
        items: plain(['ankle-split-squat', 'ankle-step-raise', 'ankle-stance', 'ankle-runner', 'ankle-leg-sway', 'ankle-toe-walk']),
      },
      {
        id: 'ankle-band', title: 'Лента',
        note: '3 раза в неделю, 6 недель. Каждую неделю растёт число подходов или жёсткость ленты.',
        course: { sessions: 18 }, source: 'docherty1998',
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
      { id: 'hand-strength', title: 'Силовые', note: 'Через день, 3–4 раза в неделю.', items: daily(['wrist-ext-weight', 'wrist-flex-weight', 'hammer', 'forearm-rotation', 'grip', 'finger-ext', 'thumb-band', 'pushups']) },
    ],
  },
];

// Программы для плана: у каждой своя частота. Обычно программа — раздел целиком,
// у кисти две: разминка с чувством положения идут каждый день, силовые — через день.
// hint — частота из источника (2BFit и Docherty, личный план кисти), только подсказка: выбирает пользователь.
//   Нет hint — в источнике частоты нет. perWeek — больше этого числа дней в неделю — предупреждение.
export const UNITS = [
  { id: 'calves', part: 'calves', title: 'Икры', groups: ['calves-all'] },
  { id: 'feet', part: 'feet', title: 'Стопа', groups: ['feet-all'] },
  {
    id: 'ankle', part: 'ankle', title: 'Голеностоп', groups: ['ankle-balance', 'ankle-band'],
    hint: { perWeek: 3, text: 'Программа рассчитана на 3 раза в неделю.' },
  },
  {
    id: 'hand', part: 'hand', title: 'Кисть: разминка и чувство положения', short: 'Разминка и чувство положения', groups: ['hand-warmup', 'hand-sense'],
    hint: { text: 'Рекомендуется каждый день.' },
  },
  {
    id: 'hand-strength', part: 'hand', title: 'Кисть: силовые', short: 'Силовые', groups: ['hand-strength'],
    hint: { text: 'Рекомендуется через день, 3–4 раза в неделю.' },
  },
];
