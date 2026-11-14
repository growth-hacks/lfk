// Стойка на одной ноге — 2BFit, упражнение C (Hupperets 2009, приложение к статье).
// Опорная нога чуть согнута в колене, бедре и голеностопе, как при беге; вторая согнута в колене, стопа в воздухе.
// Уровни: пол → глаза закрыты → подушка (или доска). side 0 — опорная правая, 1 — левая.
import * as THREE from 'three';
import { ANKLE_H } from '../mannequin.js';
import { holdLevel, mix, v3 } from './_kit.js';
import { stageOf, ankleKit } from './_ankle.js';

const DEG = Math.PI / 180;
const kit = ankleKit();
let st = stageOf(null);
const labels = {};

export default {
  legend: 'Опорная нога чуть согнута — как в момент шага при беге, когда стопа на земле.',
  views: {
    front: { label: 'Спереди', pos: [0.45, 1.05, -3.2], target: [0, 0.82, 0], fov: 42 },
    side: { label: 'Сбоку', pos: [3.2, 1.05, -0.3], target: [0, 0.82, 0], fov: 42 },
    close: { label: 'Стопа крупно', pos: [0.75, 0.34, -0.8], target: [0.1, 0.17, -0.04], fov: 32 },
  },
  configure(ex) { st = stageOf(ex); },
  setup(m, scene, stage) {
    for (const k of Object.keys(labels)) delete labels[k];
    kit.setup(m, scene, stage, st);
  },
  pose(m, s) {
    const k = holdLevel(s, { rise: 1.0, fall: 0.8, rest: 0 });
    const sx = s.side === 1 ? -1 : 1;
    const stand = sx > 0 ? 'R' : 'L';
    const lift = sx > 0 ? 'L' : 'R';
    const y0 = kit.lift;
    kit.place(sx * 0.1, -0.03);
    m.reset();
    // таз над опорной ногой и чуть ниже: колено, бедро и голеностоп слегка согнуты
    m.pelvis.position.set(sx * 0.05 * k, 0.93 + y0 - 0.035 * k, 0.015 * k);
    m.pelvis.rotation.z = -sx * 2 * k * DEG;
    m.spine.rotation.x = -4 * k * DEG;
    m.leg(stand, v3(sx * 0.1, ANKLE_H + y0, 0));
    if (k < 0.02) {
      // в начале вторая стопа на полу рядом с подушкой
      m.leg(lift, v3(-sx * (y0 ? 0.18 : 0.1), ANKLE_H, 0));
    } else {
      const L = m.legs[lift];
      L.hip.rotation.set(mix(0, 20, k) * DEG, 0, 0);
      L.knee.rotation.set(-mix(0, 85, k) * DEG, 0, 0);
      L.ankle.rotation.set(-mix(0, 20, k) * DEG, 0, 0);
    }
    for (const key of ['R', 'L']) {
      m.arms[key].set({ shoulderAbd: mix(0, 12, k), elbowFlex: mix(0, 12, k) });
      m.arms[key].hand.setFingers({ all: [10, 14, 8] });
      m.arms[key].hand.setThumb('open');
    }
    kit.eyes(m);
  },
};
