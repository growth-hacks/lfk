// Подъёмы на носки: вверх, вниз за 3 секунды. Вес через большой и второй пальцы, колено над вторым пальцем.
import * as THREE from 'three';
import { ANKLE_H } from '../mannequin.js';
import { ease, v3, cueDot, footPoint } from './_kit.js';

const RAISE = 26; // градусов подъёма пятки
const DEG = Math.PI / 180;
let dots = null;
let lines = null;

export default {
  legend: 'Оранжевым: вес на большом пальце, колено над вторым пальцем.',
  views: {
    close: { label: 'Крупно', pos: [0.62, 0.3, -0.82], target: [0, 0.14, -0.1], fov: 32 },
    front: { label: 'Спереди', pos: [0.3, 0.8, -2.7], target: [0, 0.6, -0.1], fov: 36 },
    side: { label: 'Сбоку', pos: [2.6, 0.8, -0.1], target: [0, 0.6, -0.1], fov: 36 },
  },
  setup(m, scene) {
    dots = { R: cueDot(m.materials.cue, 0.011), L: cueDot(m.materials.cue, 0.011) };
    lines = {};
    for (const k of ['R', 'L']) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 8), m.materials.glow);
      lines[k] = l;
      scene.add(dots[k], l);
    }
  },
  pose(m, s) {
    const k = s.phase === 0 ? ease(s.u) : 1 - ease(s.u);
    const p = -RAISE * k;
    m.reset();
    let ankleY = ANKLE_H;
    for (const [key, sx] of [['R', 1], ['L', -1]]) {
      // стопа поворачивается вокруг подушечки (плюсны), подушечка остаётся на полу
      const mtp = v3(sx * 0.10, 0, -0.145);
      const off = v3(0, 0.078, 0.125).applyAxisAngle(v3(1, 0, 0), p * DEG);
      const ankle = mtp.clone().add(off);
      ankleY = ankle.y;
      m.leg(key, v3(ankle.x, ankle.y + 0.002, ankle.z), { pitch: p, toesUp: -p });
    }
    m.pelvis.position.set(0, 0.93 + (ankleY - ANKLE_H), -0.02 * k);
    for (const [key, sx] of [['R', 1], ['L', -1]]) {
      const mtp = v3(sx * 0.10, 0, -0.145);
      const off = v3(0, 0.078, 0.125).applyAxisAngle(v3(1, 0, 0), p * DEG);
      m.leg(key, mtp.clone().add(off), { pitch: p, toesUp: -p });
      m.arms[key].hand.setFingers({ all: [10, 14, 8] });
      m.arms[key].hand.setThumb('open');
      const leg = m.legs[key];
      dots[key].position.copy(footPoint(leg, -0.033, -0.07, -0.128));
      // линия от колена ко второму пальцу
      leg.knee.updateWorldMatrix(true, false);
      const kn = leg.knee.getWorldPosition(new THREE.Vector3()).add(v3(0, 0, -0.055));
      const toe = footPoint(leg, -0.011, -0.06, -0.15);
      const mid = kn.clone().add(toe).multiplyScalar(0.5);
      lines[key].visible = s.view === 'front'; // линия «колено над вторым пальцем» читается только спереди
      lines[key].position.copy(mid);
      lines[key].scale.set(1, kn.distanceTo(toe), 1);
      lines[key].quaternion.setFromUnitVectors(v3(0, 1, 0), toe.clone().sub(kn).normalize());
    }
  },
};
