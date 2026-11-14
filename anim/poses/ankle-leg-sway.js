// Мах скрещенной ногой — 2BFit, упражнение E (Hupperets 2009, приложение к статье).
// Чуть наклонился вперёд, руки на стене, вес на опорной ноге. Свободная нога махом идёт перед собой
// к опорной стороне, потом в свою сторону; в обеих крайних точках носок на себя.
// Уровни: руки на стене → без опоры → без опоры с закрытыми глазами → подушка (или доска).
// side 0 — опорная правая, 1 — левая.
import * as THREE from 'three';
import { ANKLE_H } from '../mannequin.js';
import { wall } from '../props.js';
import { ease, mix, v3, palmOnWall, footPoint } from './_kit.js';
import { stageOf, ankleKit } from './_ankle.js';

const DEG = Math.PI / 180;
const WALL = -0.62;
const kit = ankleKit();
let st = stageOf(null);
const labels = {};

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// квадратичная кривая: нога идёт маятником — внизу ниже, в крайних точках выше
const bezier = (a, c, b, t) => a.clone().multiplyScalar((1 - t) * (1 - t)).add(c.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t));

export default {
  legend: 'Оранжевым — носок на себя в крайних точках маха.',
  views: {
    // по умолчанию строго сбоку: спереди сбоку стена закрывала ногу (feedback 14.11, п. 8)
    side: { label: 'Сбоку', pos: [3.2, 1.05, -0.25], target: [0, 0.8, -0.1], fov: 42 },
    front: { label: 'Спереди сбоку', pos: [2.1, 0.85, -1.85], target: [0, 0.38, -0.12], fov: 42 },
    top: { label: 'Сверху', pos: [0.3, 2.9, 0.2], target: [0, 0.2, -0.15], fov: 42 },
  },
  sides: ['Опорная — правая', 'Опорная — левая'],
  demo: [{ label: 'Перед собой', dur: 1.3 }, { label: 'В сторону', dur: 1.3 }],
  configure(ex) { st = stageOf(ex); },
  setup(m, scene, stage) {
    for (const k of Object.keys(labels)) delete labels[k];
    kit.setup(m, scene, stage, st);
    if (st.hold === 'hand') scene.add(wall({ front: WALL, width: 0.8 })); // узкая, чтобы спереди сбоку было видно ноги
    if (stage) labels.toe = stage.label('носок на себя');
  },
  pose(m, s) {
    const sx = s.side === 1 ? -1 : 1;
    const stand = sx > 0 ? 'R' : 'L';
    const free = sx > 0 ? 'L' : 'R';
    const y0 = kit.lift;
    kit.place(sx * 0.1, -0.03);
    m.reset();
    const hand = st.hold === 'hand';
    m.pelvis.position.set(sx * 0.05, 0.92 + y0, hand ? 0.02 : 0);
    m.pelvis.rotation.z = -sx * 2 * DEG;
    m.spine.rotation.x = -(hand ? 9 : 3) * DEG;
    m.leg(stand, v3(sx * 0.1, ANKLE_H + y0, 0));

    // крайние точки маха и нижняя точка между ними
    const across = v3(sx * 0.22, 0.24 + y0, -0.3);
    const out = v3(-sx * 0.46, 0.26 + y0, -0.02);
    const low = v3(-sx * 0.06, 0.06 + y0, -0.2);
    const u = ease(s.u);
    const foot = s.phase === 0 ? bezier(out, low, across, u) : bezier(across, low, out, u);
    // носок на себя ближе к крайним точкам
    const flex = Math.max(1 - smooth(0, 0.28, s.u), smooth(0.72, 1, s.u));
    m.leg(free, foot, { pitch: 25 * flex });

    for (const key of ['R', 'L']) {
      const kx = key === 'R' ? 1 : -1;
      if (hand) {
        m.arm(key, v3(kx * 0.22, 1.18, WALL + 0.02), { hand: palmOnWall(kx) });
        m.arms[key].hand.setFingers({ all: [6, 8, 4] });
      } else {
        m.arms[key].set({ shoulderAbd: 22, elbowFlex: 12 });
        m.arms[key].hand.setFingers({ all: [10, 14, 8] });
      }
      m.arms[key].hand.setThumb('open');
    }
    if (labels.toe) {
      labels.toe.set(footPoint(m.legs[free], 0, -0.04, -0.17));
      labels.toe.visible = flex > 0.6;
    }
    // носок свободной стопы подсвечиваем, когда он тянется на себя
    for (let i = 0; i < 5; i++) m.legs[free].foot.tintToe(i, flex > 0.6 ? m.materials.move : null);
    for (let i = 0; i < 5; i++) m.legs[stand].foot.tintToe(i, null);
    kit.eyes(m);
  },
};
