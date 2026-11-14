// Общее для упражнений на кисть. Работает левая рука — та, которую восстанавливаем (личная программа).
import * as THREE from 'three';
import { quatFromAxes } from '../ik.js';
import { v3, palmDown } from './_kit.js';

export const WORK = 'L';
export const WS = -1; // знак рабочей руки: −1 — левая
export const DEG = Math.PI / 180;

// Ориентация кисти в мире: куда смотрят пальцы и куда смотрит ладонь.
export function handQuat(s, fingers, palm) {
  const y = fingers.clone().normalize().negate();
  const x = palm.clone().multiplyScalar(-s);
  x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return quatFromAxes(x, y, z);
}

// Кисть ладонью вниз, пальцы вперёд; e — разгибание вверх (+) или сгибание вниз (−), d — к большому пальцу (+) или к мизинцу (−).
export function palmDownQuat(s, e = 0, d = 0) {
  const E = e * DEG;
  const D = -s * d * DEG; // для левой руки большой палец справа (+X)
  const fingers = v3(Math.sin(D) * Math.cos(E), Math.sin(E), -Math.cos(D) * Math.cos(E));
  const lateral = v3(Math.cos(D), 0, Math.sin(D));
  const palm = new THREE.Vector3().crossVectors(fingers, lateral);
  return handQuat(s, fingers, palm);
}

// Кисть ладонью вверх, пальцы вперёд; f — сгибание вверх (+), к себе.
export function palmUpQuat(s, f = 0) {
  const F = f * DEG;
  return handQuat(s, v3(0, Math.sin(F), -Math.cos(F)), v3(0, Math.cos(F), Math.sin(F)));
}

// Сидим на табурете ровно.
export function sit(m, { z = -0.02, lean = 0 } = {}) {
  m.pelvis.position.set(0, 0.52, z);
  m.spine.rotation.x = lean * DEG;
  for (const [key, sx] of [['R', 1], ['L', -1]]) {
    m.leg(key, v3(sx * 0.13, 0.08, z - 0.42), { pole: v3(sx * 0.3, 1.2, -1.2) });
  }
}

// Свободная рука лежит на бедре.
export function restOnThigh(m, key, z = -0.02) {
  const sx = key === 'R' ? 1 : -1;
  m.arm(key, v3(sx * 0.15, 0.585, z - 0.2), { hand: palmDown(sx), pole: v3(sx * 0.7, 0.6, 0.4) });
  m.arms[key].hand.setFingers({ all: [8, 10, 6] });
  m.arms[key].hand.setThumb('open');
}

// Рука висит вдоль тела.
export function hang(m, key) {
  m.arms[key].set({});
  m.arms[key].hand.setFingers({ all: [10, 14, 8] });
  m.arms[key].hand.setThumb('open');
}
