// Баланс на одной ноге: вторая нога согнута, стопа опорной ноги не заваливается внутрь, большой палец прижат.
// side 0 — стоим на правой ноге, side 1 — на левой.
import { ANKLE_H } from '../mannequin.js';
import { holdLevel, mix, v3, cueDot, footPoint } from './_kit.js';

const DEG = Math.PI / 180;
let dot = null;

export default {
  legend: 'Оранжевая точка: большой палец опорной ноги прижат к полу.',
  views: {
    front: { label: 'Спереди', pos: [0.35, 1.0, -2.6], target: [0, 0.78, -0.05], fov: 38 },
    side: { label: 'Сбоку', pos: [2.6, 1.0, -0.2], target: [0, 0.78, -0.05], fov: 38 },
  },
  setup(m, scene) {
    dot = cueDot(m.materials.cue, 0.012);
    scene.add(dot);
  },
  pose(m, s) {
    const k = holdLevel(s, { rise: 1.0, fall: 0.8, rest: 0 });
    const stand = s.side === 1 ? 'L' : 'R';
    const lift = stand === 'R' ? 'L' : 'R';
    const sx = stand === 'R' ? 1 : -1;
    m.reset();
    // таз смещается к опорной ноге
    m.pelvis.position.set(sx * 0.05 * k, 0.93, 0);
    m.pelvis.rotation.z = -sx * 2 * k * DEG;
    m.leg(stand, v3(sx * 0.10, ANKLE_H, 0));
    if (k < 0.02) m.leg(lift, v3(-sx * 0.10, ANKLE_H, 0));
    else {
      const L = m.legs[lift];
      L.hip.rotation.set(mix(0, 25, k) * DEG, 0, 0);
      L.knee.rotation.set(-mix(0, 85, k) * DEG, 0, 0);
      L.ankle.rotation.set(-mix(0, 25, k) * DEG, 0, 0);
    }
    for (const [key, side] of [['R', 1], ['L', -1]]) {
      m.arms[key].set({ shoulderAbd: mix(0, 14, k) });
      m.arms[key].hand.setFingers({ all: [10, 14, 8] });
      m.arms[key].hand.setThumb('open');
      void side;
    }
    dot.position.copy(footPoint(m.legs[stand], -0.033, -0.07, -0.128));
  },
};
