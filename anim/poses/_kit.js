// Общие помощники для поз: плавность, уровень удержания, ориентации ладони, оранжевые подсказки.
import * as THREE from 'three';
import { quatFromAxes } from '../ik.js';

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(u));
export const mix = (a, b, k) => a + (b - a) * k;
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const mixV = (a, b, k) => new THREE.Vector3().lerpVectors(a, b, k);

// Насколько «включена» поза удержания: 0 — исходное положение, 1 — полностью в позе.
// Держи — плавно входим за rise секунд; Расслабь — частично выходим, чтобы следующий повтор начинался не с нуля.
export function holdLevel(s, { rise = 1.2, fall = 1.0, rest = 0.35 } = {}) {
  if (s.preview) rest = 0; // в показе выходим из позы полностью, чтобы круг замыкался
  if (s.kind === 'relax') return 1 - (1 - rest) * ease(s.t / fall);
  const k0 = s.rep > 0 ? rest : 0;
  return k0 + (1 - k0) * ease(s.t / rise);
}

// Ладонь на стене перед собой: пальцы вверх, ладонь смотрит в −Z.
export function palmOnWall(s) {
  return quatFromAxes(v3(0, 0, s), v3(0, -1, 0), v3(s, 0, 0));
}
// Ладонь лежит на бедре или столе: пальцы вперёд, ладонь вниз.
export function palmDown(s) {
  return quatFromAxes(v3(0, s, 0), v3(0, 0, 1), v3(s, 0, 0));
}

// Оранжевая стрелка-конус: ставится в мировые координаты и показывает направление.
export function cueArrow(mat, size = 1) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * size, 0.006 * size, 0.06 * size, 10), mat);
  shaft.position.y = -0.03 * size;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.016 * size, 0.035 * size, 14), mat);
  head.position.y = 0.0175 * size;
  g.add(shaft, head);
  g.renderOrder = 3;
  return g;
}
const UP = new THREE.Vector3(0, 1, 0);
export function pointArrow(arrow, tipWorld, dir) {
  const d = dir.clone().normalize();
  arrow.position.copy(tipWorld).sub(d.clone().multiplyScalar(0.035));
  arrow.quaternion.setFromUnitVectors(UP, d);
}

export function cueDot(mat, r = 0.012) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.renderOrder = 3;
  return m;
}

// Путь мяча: 0 — круги по часовой, 1 — против часовой, 2 — восьмёрка влево, 3 — восьмёрка вправо.
// Направление — как видит сам человек: [вправо, вверх] на столе (вверх = от себя) или на стене (вверх = к потолку).
// Все пути начинаются в одной точке (0, 0); круг — за 3 секунды.
export function ballPath(phase, t, r = 0.06, period = 3) {
  const w = (2 * Math.PI * t) / period;
  if (phase === 0) return [r - r * Math.cos(w), r * Math.sin(w)]; // слева → вверх → вправо → вниз: по часовой
  if (phase === 1) return [r - r * Math.cos(w), -r * Math.sin(w)];
  const dir = phase === 2 ? -1 : 1;
  return [dir * r * Math.sin(w), (r * Math.sin(2 * w)) / 2];
}

// Оранжевый след пути со стрелкой: показывает, куда катится мяч в текущей части.
export function pathTrace(scene, mat) {
  let tube = null;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.026, 14), mat);
  scene.add(head);
  return (points) => {
    if (tube) { tube.geometry.dispose(); scene.remove(tube); }
    tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 120, 0.0024, 8, false), mat);
    scene.add(tube);
    const i = Math.floor(points.length * 0.3);
    head.position.copy(points[i]);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), points[i + 1].clone().sub(points[i]).normalize());
  };
}

// Плавный переход при смене фазы: первые 0.4 с тянемся от прошлой точки к новой траектории.
export function makeBlender(dur = 0.4) {
  let last = null;
  let from = null;
  let phase = -1;
  return (ph, t, target) => {
    if (ph !== phase) { from = last ? last.clone() : null; phase = ph; }
    const out = from && t < dur ? from.clone().lerp(target, ease(t / dur)) : target.clone();
    last = out.clone();
    return out;
  };
}

// Мировая точка на стопе (координаты в системе голеностопа).
export function footPoint(leg, x, y, z) {
  leg.ankle.updateWorldMatrix(true, false);
  return leg.ankle.localToWorld(v3(leg.s * x, y, z));
}
