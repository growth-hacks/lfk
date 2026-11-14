// Поза бегуна — 2BFit, упражнение D (Hupperets 2009, приложение к статье).
// Стопы в 5 см друг от друга. Бедро вперёд и вверх до параллели с полом, голень почти вертикально,
// противоположная рука вперёд, как при беге. Держать 8 секунд и спокойно поставить ногу.
// Уровни: пол → глаза закрыты → подушка (или доска). side 0 — опорная правая, 1 — левая.
import * as THREE from 'three';
import { ANKLE_H } from '../mannequin.js';
import { holdLevel, mix, v3 } from './_kit.js';
import { stageOf, ankleKit } from './_ankle.js';

const DEG = Math.PI / 180;
const FOOT_X = 0.07; // между стопами около 5 см
const kit = ankleKit();
let st = stageOf(null);
const labels = {};

export default {
  legend: 'Бедро — до параллели с полом, голень почти вертикально. Рука — как при беге.',
  views: {
    side: { label: 'Сбоку', pos: [3.2, 1.05, -0.6], target: [0, 0.82, -0.05], fov: 42 },
    front: { label: 'Спереди', pos: [0.5, 1.05, -3.2], target: [0, 0.82, -0.05], fov: 42 },
    close: { label: 'Стопа крупно', pos: [0.75, 0.34, -0.8], target: [0.07, 0.17, -0.04], fov: 32 },
  },
  configure(ex) { st = stageOf(ex); },
  setup(m, scene, stage) {
    for (const k of Object.keys(labels)) delete labels[k];
    kit.setup(m, scene, stage, st);
  },
  pose(m, s) {
    const k = holdLevel(s, { rise: 0.9, fall: 0.8, rest: 0 });
    const sx = s.side === 1 ? -1 : 1;
    const stand = sx > 0 ? 'R' : 'L';
    const up = sx > 0 ? 'L' : 'R';
    const y0 = kit.lift;
    kit.place(sx * 0.06, -0.03);
    m.reset();
    m.pelvis.position.set(sx * 0.045 * k, 0.93 + y0 - 0.02 * k, 0);
    m.pelvis.rotation.z = -sx * 2 * k * DEG;
    m.spine.rotation.x = -3 * k * DEG;
    m.leg(stand, v3(sx * FOOT_X, ANKLE_H + y0, 0));
    if (k < 0.02) {
      m.leg(up, v3(-sx * (y0 ? 0.2 : FOOT_X), ANKLE_H, 0));
    } else {
      const L = m.legs[up];
      L.hip.rotation.set(mix(0, 90, k) * DEG, 0, 0);
      L.knee.rotation.set(-mix(0, 90, k) * DEG, 0, 0);
      L.ankle.rotation.set(-mix(0, 15, k) * DEG, 0, 0);
    }
    // рука со стороны опорной ноги идёт вперёд (противоположная поднятому бедру), вторая — назад
    m.arms[stand].set({ shoulderFlex: mix(0, 60, k), shoulderAbd: 4, elbowFlex: mix(5, 85, k) });
    m.arms[up].set({ shoulderFlex: mix(0, -30, k), shoulderAbd: 6, elbowFlex: mix(5, 80, k) });
    for (const key of ['R', 'L']) {
      m.arms[key].hand.setFingers({ all: [30, 40, 20] });
      m.arms[key].hand.setThumb('open');
    }
    kit.eyes(m);
  },
};
