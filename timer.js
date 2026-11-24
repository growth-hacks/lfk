// Таймер упражнения: подходы, повторы, фазы («Держи» / «Расслабь», «Вверх» / «Вниз»), стороны.
// Внутри подхода всё идёт само. Между подходами и сторонами — ждём кнопку: отдых в источниках не задан.
// Звук, вибрация и «экран не гаснет» — из прототипа zaryadka-dlya-ikr-i-stop.html.

const pick = (v, goal) => (Array.isArray(v) ? (goal ?? v[0]) : v);

// Собирает план из описания timer и выбранных целей.
export function buildPlan(timer, goals = {}, relax = 3) {
  const sides = timer.sides || [null];
  const sets = pick(timer.sets ?? 1, goals.sets);
  let reps = pick(timer.reps ?? 1, goals.reps);
  let phases;
  if (timer.type === 'hold') {
    const hold = pick(timer.hold, goals.hold);
    phases = [{ label: 'Держи', dur: hold, kind: 'hold' }, { label: 'Расслабь', dur: relax, kind: 'relax' }];
  } else if (timer.type === 'tempo') {
    phases = timer.phases.map(([label, dur]) => ({ label, dur, kind: 'move' }));
  } else if (timer.type === 'timed') {
    const total = pick(timer.duration, goals.duration);
    // время можно разбить на равные части: «круги по часовой», «восьмёрка влево»…
    phases = timer.segments
      ? timer.segments.map((label) => ({ label, dur: total / timer.segments.length, kind: 'hold' }))
      : [{ label: timer.label || 'Держи', dur: total, kind: 'hold' }];
    reps = 1;
  } else {
    phases = [];
  }
  return { type: timer.type, sides, sets, reps, phases };
}

// Сколько примерно секунд займёт упражнение.
export function estimate(timer, goals = {}, relax = 3) {
  if (timer.type === 'measure') return 150;
  const p = buildPlan(timer, goals, relax);
  if (timer.type === 'count') return p.reps * (timer.secPerRep ?? 8) * p.sets * p.sides.length;
  const rep = p.phases.reduce((s, ph) => s + ph.dur, 0);
  const lastRelax = timer.type === 'hold' ? relax : 0;
  return p.sides.length * p.sets * (p.reps * rep - lastRelax);
}

export function createRunner(plan, { onEvent = () => {}, completedSets = 0 } = {}) {
  const st = {
    status: 'ready', // ready | run | paused | between | done
    side: 0, set: 0, rep: 0, phase: 0, t: 0,
    speed: 1,
    message: '',
  };
  const lastPhase = (i) => i === plan.phases.length - 1;

  function phaseList() {
    // После последнего повтора подхода пауза «Расслабь» не нужна.
    return plan.phases;
  }

  function startSet() {
    st.rep = 0; st.phase = 0; st.t = 0;
    st.status = 'run';
    if (plan.phases[0]?.kind === 'hold') onEvent('holdStart');
  }

  function endSet() {
    const moreSets = st.set < plan.sets - 1;
    const moreSides = st.side < plan.sides.length - 1;
    if (moreSets || moreSides) {
      st.status = 'between';
      st.message = moreSets ? `Подход ${st.set + 1} из ${plan.sets} готов` : `Теперь: ${plan.sides[st.side + 1]}`;
      onEvent('setEnd', st.side * plan.sets + st.set + 1);
    } else {
      st.status = 'done';
      st.message = 'Готово';
      onEvent('done');
    }
  }

  function next() {
    if (st.status === 'ready') { st.side = 0; st.set = 0; startSet(); return; }
    if (st.status === 'between') {
      if (st.set < plan.sets - 1) st.set += 1;
      else { st.side += 1; st.set = 0; }
      startSet();
    }
  }

  function tick(dt) {
    if (st.status !== 'run') return;
    const list = phaseList();
    const ph = list[st.phase];
    if (!ph) return;
    st.t += dt * (ph.kind === 'move' ? st.speed : 1);
    if (st.t < ph.dur) return;
    st.t = 0;
    if (ph.kind === 'hold') onEvent('holdEnd');
    const lastRep = st.rep >= plan.reps - 1;
    // конец повтора
    if (lastPhase(st.phase) || (lastRep && list[st.phase + 1]?.kind === 'relax')) {
      if (plan.type === 'tempo') onEvent('repEnd');
      if (lastRep) { st.rep = plan.reps; endSet(); return; }
      st.rep += 1;
      st.phase = 0;
      if (list[0].kind === 'hold') onEvent('holdStart');
      return;
    }
    st.phase += 1;
    if (list[st.phase].kind === 'hold') onEvent('holdStart');
  }

  // Для счётных упражнений: отметить повтор вручную.
  function countRep() {
    if (st.status === 'ready') { st.side = 0; st.set = 0; st.rep = 0; st.status = 'run'; }
    if (st.status !== 'run') return;
    st.rep += 1;
    onEvent('repEnd');
    if (st.rep >= plan.reps) endSet();
  }

  function countSet() {
    if (plan.type !== 'count' || st.status === 'done') return;
    if (st.status === 'ready' || st.status === 'between') next();
    st.rep = plan.reps;
    endSet();
    next();
  }

  if (Number.isInteger(completedSets) && completedSets > 0 && completedSets < plan.sets * plan.sides.length) {
    // Восстанавливаем границу между подходами. Таймер ждёт явного старта.
    st.side = Math.floor((completedSets - 1) / plan.sets);
    st.set = (completedSets - 1) % plan.sets;
    st.rep = plan.reps;
    st.status = 'between';
    st.message = `Готово подходов: ${completedSets} из ${plan.sets * plan.sides.length}`;
    if (plan.type === 'count') next();
  }

  return {
    state: st,
    plan,
    next,
    tick,
    countRep,
    countSet,
    // Начать текущий подход заново (кнопка «Заново» во время выполнения).
    restartSet() { if (st.status === 'run' || st.status === 'paused') startSet(); },
    pause() { if (st.status === 'run') st.status = 'paused'; },
    resume() { if (st.status === 'paused') st.status = 'run'; },
    get phase() { return plan.phases[st.phase] || null; },
    get phaseU() { const ph = plan.phases[st.phase]; return ph ? Math.min(1, st.t / ph.dur) : 0; },
    get remaining() { const ph = plan.phases[st.phase]; return ph ? Math.max(0, ph.dur - st.t) : 0; },
  };
}

// ---------- звук, вибрация, экран ----------
let ctx = null;
let muted = false;
// Звук выключается одной настройкой на всё приложение. Вибрация при этом остаётся.
export function setMuted(v) { muted = !!v; }
export function isMuted() { return muted; }
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

export function beep({ times = 1, freq = 880, vol = 0.25, len = 0.22 } = {}) {
  if (!ctx || muted) return;
  try {
    for (let i = 0; i < times; i++) {
      const t0 = ctx.currentTime + i * (len + 0.06);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + len + 0.02);
    }
  } catch (e) { /* звук не обязателен */ }
}

export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* нет вибрации */ }
}

let lock = null;
export async function keepAwake(on) {
  keepAwake.wanted = on;
  try {
    if (on && 'wakeLock' in navigator && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch (e) { lock = null; }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && lock === null && keepAwake.wanted) keepAwake(true);
});

// Звуки событий таймера.
export function soundFor(event) {
  if (event === 'holdStart') beep({ freq: 660, vol: 0.12, len: 0.12 });
  else if (event === 'holdEnd') beep({ freq: 880 });
  else if (event === 'repEnd') beep({ freq: 520, vol: 0.08, len: 0.08 });
  else if (event === 'setEnd') { beep({ times: 2 }); vibrate([120, 80, 120]); }
  else if (event === 'done') { beep({ times: 3, freq: 990 }); vibrate([150, 80, 150, 80, 150]); }
}
