// Простая инверсная кинематика: ставим кисть или стопу в нужную точку, а плечо/бедро и локоть/колено
// поворачиваются сами. Так позы задаются точками (ладони на стене, стопа на полу), а не десятками углов.

import * as THREE from 'three';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

// Поворот группы так, чтобы в мире она была повёрнута на quatWorld.
export function setWorldQuat(group, quatWorld) {
  group.parent.updateWorldMatrix(true, false);
  group.parent.getWorldQuaternion(_q);
  group.quaternion.copy(_q.invert().multiply(quatWorld));
}

// Кватернион из трёх осей мира: куда должны смотреть локальные X, Y, Z.
export function quatFromAxes(x, y, z) {
  _m.makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

/**
 * Две кости: root (плечо или бедро) и mid (локоть или колено), сегменты идут вдоль локальной −Y.
 * target — куда поставить конец второй кости (мир), pole — в какую сторону выгибается сустав (мир).
 * bend = +1, если сустав сгибается поворотом mid.rotation.x > 0 (локоть), −1 — если < 0 (колено).
 */
export function twoBone(root, mid, target, pole, a, b, bend) {
  root.parent.updateWorldMatrix(true, false);
  const origin = root.getWorldPosition(new THREE.Vector3());
  const d = new THREE.Vector3().subVectors(target, origin);
  const L = Math.min(Math.max(d.length(), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const dn = d.clone().normalize();
  // направление к полюсу, перпендикулярное d
  const w = _v.copy(pole).sub(origin);
  w.sub(dn.clone().multiplyScalar(w.dot(dn)));
  if (w.lengthSq() < 1e-8) w.set(0, 0, -1).sub(dn.clone().multiplyScalar(-dn.z));
  w.normalize();
  const cosA = (a * a + L * L - b * b) / (2 * a * L);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const u = dn.clone().multiplyScalar(cosA).add(w.clone().multiplyScalar(sinA)); // направление первой кости
  const cosIn = (a * a + b * b - L * L) / (2 * a * b);
  const phi = Math.PI - Math.acos(Math.min(1, Math.max(-1, cosIn)));

  const yAxis = u.clone().negate();
  // вторая кость отклоняется от первой в сторону, противоположную полюсу
  const zAxis = w.clone().multiplyScalar(bend > 0 ? 1 : -1);
  zAxis.sub(yAxis.clone().multiplyScalar(zAxis.dot(yAxis))).normalize();
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
  setWorldQuat(root, quatFromAxes(xAxis, yAxis, zAxis));
  mid.rotation.set(bend * phi, 0, 0);
}
