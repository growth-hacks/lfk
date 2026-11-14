// Предметы для упражнений: стена, стул, стол, мяч, оранжевые подсказки.
import * as THREE from 'three';

const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

export function propMaterial(color = 0xcfd8d3) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}

// Стена: передняя плоскость на z = front, человек стоит в +Z от неё.
export function wall({ front = -0.75, width = 1.8, height = 2.1 } = {}) {
  const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), propMaterial(0xd5ddd8)));
  m.position.set(0, height / 2, front - 0.04);
  return m;
}

// Табурет: сиденье на высоте seat, центр в (x, z).
export function stool({ seat = 0.44, z = 0.05, x = 0 } = {}) {
  const g = new THREE.Group();
  const mat = propMaterial(0xb9a588);
  const top = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 32), mat));
  top.position.y = seat - 0.0175;
  g.add(top);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, seat - 0.035, 10), mat));
    leg.position.set(Math.cos(a) * 0.13, (seat - 0.035) / 2, Math.sin(a) * 0.13);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  return g;
}

// Стол: столешница на высоте h, передний край на z = edge (ближе к человеку), уходит в −Z.
export function table({ h = 0.74, edge = -0.2, depth = 0.6, width = 1.1 } = {}) {
  const g = new THREE.Group();
  const mat = propMaterial(0xc9b394);
  const top = shadow(new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, depth), mat));
  top.position.set(0, h - 0.015, edge - depth / 2);
  g.add(top);
  for (const x of [-width / 2 + 0.05, width / 2 - 0.05]) for (const z of [edge - 0.05, edge - depth + 0.05]) {
    const leg = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.04, h - 0.03, 0.04), mat));
    leg.position.set(x, (h - 0.03) / 2, z);
    g.add(leg);
  }
  return g;
}

// Столик на одной ножке: центр столешницы в (x, z), размеры w × d, высота h. Одна ножка не мешает коленям.
export function sideTable({ x = 0, z = 0, w = 0.5, d = 0.4, h = 0.7 } = {}) {
  const g = new THREE.Group();
  const mat = propMaterial(0xc9b394);
  const top = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), mat));
  top.position.set(0, h - 0.015, 0);
  const column = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h - 0.03, 14), mat));
  column.position.y = (h - 0.03) / 2;
  const base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.02, 24), mat));
  base.position.y = 0.01;
  g.add(top, column, base);
  g.position.set(x, 0, z);
  return g;
}

// Балансировочная подушка: надувной диск с мягким краем. Центр в (x, z), верх — на высоте PAD_TOP.
export const PAD_TOP = 0.055;
export function balancePad({ x = 0, z = 0, r = 0.17 } = {}) {
  const pts = [[0, 0], [r - 0.02, 0], [r - 0.004, 0.012], [r, 0.028], [r - 0.006, 0.043], [r - 0.026, PAD_TOP], [0, PAD_TOP]]
    .map(([a, b]) => new THREE.Vector2(a, b));
  const m = shadow(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.7 })));
  m.position.set(x, 0, z);
  return m;
}

// Круглая балансировочная доска: диск на полусфере. Верх — на высоте BOARD_TOP.
export const BOARD_TOP = 0.08;
export function wobbleBoard({ x = 0, z = 0, r = 0.2 } = {}) {
  const g = new THREE.Group();
  const mat = propMaterial(0x6a8fb0);
  const disc = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 48), mat));
  disc.position.y = BOARD_TOP - 0.01;
  const dome = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat));
  dome.position.y = 0.07;
  g.add(disc, dome);
  g.position.set(x, 0, z);
  return g;
}

// Стопка из трёх толстых книг вместо ступеньки. Задний край (откуда свисают пятки) — на z = back.
export const BOOKS_H = 0.09;
export function bookStack({ back = 0, width = 0.42, depth = 0.24 } = {}) {
  const g = new THREE.Group();
  const colors = [0x8a5a44, 0x4d6b5e, 0xb08d57];
  colors.forEach((c, i) => {
    const b = shadow(new THREE.Mesh(new THREE.BoxGeometry(width - i * 0.012, 0.03, depth - (i % 2) * 0.01), propMaterial(c)));
    b.position.set((i - 1) * 0.004, 0.015 + i * 0.03, back - depth / 2 - (i % 2) * 0.004);
    g.add(b);
  });
  return g;
}

// Мягкий мяч.
export function ball(r = 0.036, color = 0x5f9c8c) {
  return shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.55 })));
}

// Оранжевая линия-рулетка по полу между двумя точками, с засечками на концах.
export function floorTape(a, b, mat) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, len), mat);
  bar.position.copy(a).add(b).multiplyScalar(0.5);
  bar.lookAt(b.x, bar.position.y, b.z);
  g.add(bar);
  for (const p of [a, b]) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.008), mat);
    tick.position.copy(p);
    tick.lookAt(b.x, p.y, b.z);
    g.add(tick);
  }
  return g;
}

// Полупрозрачная оранжевая «зона, где тянет» вдоль локальной −Y группы.
export function glowZone(from, to, r, mat) {
  const len = Math.max(0.001, to - from);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat);
  m.position.y = -(from + len / 2);
  m.renderOrder = 2;
  return m;
}
