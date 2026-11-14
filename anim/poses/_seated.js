// Упражнения для стопы сидя: короткая стопа, йога для пальцев, разведение пальцев.
// Сидим на табурете, стопы на полу под коленями. Камеры — крупно на стопы.
import { stool } from '../props.js';
import { ANKLE_H } from '../mannequin.js';
import { holdLevel, v3, palmDown, cueArrow, pointArrow, footPoint } from './_kit.js';

const DEG = Math.PI / 180;
const FEET_X = 0.15;
const FEET_Z = -0.50;

const VIEWS = {
  short: {
    inside: { label: 'Свод изнутри', pos: [-0.72, 0.11, -0.57], target: [0.15, 0.05, -0.57], fov: 22 },
    side: { label: 'Снаружи', pos: [1.0, 0.12, -0.57], target: [0.15, 0.05, -0.57], fov: 22 },
    fp: { label: 'Как видишь ты', pos: [0, 1.08, -0.5], target: [0.02, 0.03, -0.68], fov: 24, firstPerson: true },
  },
  yoga: {
    front: { label: 'Спереди, крупно', pos: [0.13, 0.12, -1.0], target: [0.15, 0.025, -0.64], fov: 30 },
    fp: { label: 'Как видишь ты', pos: [0, 1.08, -0.5], target: [0, 0.03, -0.7], fov: 22, firstPerson: true },
  },
  spread: {
    top: { label: 'Сверху, крупно', pos: [0.15, 0.46, -0.92], target: [0.15, 0.02, -0.69], fov: 24 },
    fp: { label: 'Как видишь ты', pos: [0.02, 1.08, -0.5], target: [0.15, 0.03, -0.66], fov: 17, firstPerson: true },
  },
};

export function makeSeated(kind) {
  const arrows = [];
  const labels = {};
  let ghosts = [];
  return {
    legend: {
      short: 'Оранжевые стрелки: свод поднимается, подушечка тянется к пятке. Полупрозрачным — стопа до начала.',
      yoga: 'Оранжевым — пальцы, которые поднимаются. Остальные прижаты к полу.',
      spread: 'Полупрозрачным — где пальцы были. Оранжевым — куда разошлись. Стопа стоит на месте.',
    }[kind],
    views: VIEWS[kind],
    setup(m, scene, stage) {
      // при повторном заходе на страницу всё создаём заново
      arrows.length = 0;
      for (const k of Object.keys(labels)) delete labels[k];
      ghosts = [];
      scene.add(stool({ seat: 0.44, z: 0.06 }));
      if (kind === 'short') {
        for (let i = 0; i < 2; i++) { const a = cueArrow(m.materials.cue, i ? 0.55 : 0.75); arrows.push(a); scene.add(a); }
        ghosts = [m.legs.R.foot.addGhostBody(m.materials.ghost)];
        if (stage) {
          labels.heel = stage.label('пятка');
          labels.ball = stage.label('подушечка');
          labels.arch = stage.label('свод');
        }
      }
      if (kind === 'spread') {
        ghosts = [m.legs.R.foot.addGhostToes(m.materials.ghost), m.legs.L.foot.addGhostToes(m.materials.ghost)];
      }
      if (kind === 'yoga' && stage) labels.big = stage.label('большой палец');
    },
    pose(m, s) {
      const k = holdLevel(s, { rise: 0.6, fall: 0.5, rest: 0 });
      m.reset();
      m.pelvis.position.set(0, 0.52, 0.06);
      m.spine.rotation.x = -10 * DEG;
      for (const [key, sx] of [['R', 1], ['L', -1]]) {
        m.leg(key, v3(sx * FEET_X, ANKLE_H, FEET_Z), { pole: v3(sx * 0.3, 1.2, -1.2) });
        // руки опираются о табурет по бокам, чтобы не закрывать стопы
        m.arm(key, v3(sx * 0.23, 0.47, 0.08), { hand: palmDown(sx), pole: v3(sx * 0.8, 0.9, 0.6) });
        m.arms[key].hand.setFingers({ all: [8, 10, 6] });
        m.arms[key].hand.setThumb('open');
      }
      // вид изнутри смотрит между ног — левую ногу прячем, чтобы не закрывала правую стопу
      m.legs.L.hip.visible = !(kind === 'short' && s.view === 'inside');
      const legs = [m.legs.R, m.legs.L];

      if (kind === 'short') {
        legs.forEach((leg) => leg.foot.setDome(k));
        const R = m.legs.R;
        pointArrow(arrows[0], footPoint(R, -0.03, -0.074 + 0.02 * k, -0.035), v3(0, 1, 0));
        pointArrow(arrows[1], footPoint(R, -0.07, -0.072, -0.105 + 0.01 * k), v3(0, 0, 1));
        if (labels.heel) {
          labels.heel.set(footPoint(R, -0.05, -0.005, 0.04));
          labels.ball.set(footPoint(R, -0.05, 0.0, -0.13));
          labels.arch.set(footPoint(R, -0.06, -0.11, -0.035));
        }
      }

      if (kind === 'yoga') {
        // side 0 — вариант А: большой вниз, остальные вверх; side 1 — вариант Б: наоборот
        const A = s.side !== 1;
        legs.forEach((leg) => {
          for (let t = 0; t < 5; t++) {
            const lifts = A ? t !== 0 : t === 0;
            leg.foot.setToe(t, { up: lifts ? 32 * k : 0 });
            leg.foot.tintToe(t, lifts && k > 0.15 ? m.materials.move : null);
          }
        });
        if (labels.big) labels.big.set(footPoint(m.legs.R, -0.045, -0.035, -0.215));
      }

      if (kind === 'spread') {
        const fan = [-20, -7, 5, 15, 25];
        legs.forEach((leg) => {
          for (let t = 0; t < 5; t++) {
            leg.foot.setToe(t, { spread: fan[t] * k });
            leg.foot.tintToe(t, k > 0.2 ? m.materials.move : null);
          }
        });
      }
    },
  };
}
