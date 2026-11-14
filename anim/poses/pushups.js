// Отжимания по ступеням (этап 3 плана кисти). Ступень берётся из упражнения: setup получает ex.level.
//   0 — от стены, 1 — четвереньки с переносом веса на левую руку, 2 — от стола, 3 — с колен, 4 — обычные
// Тело — прямая линия от опоры (стопы или колени) до плеч; кисти стоят на месте, сгибаются локти.
import * as THREE from 'three';
import { wall, sideTable } from '../props.js';
import { ANKLE_H } from '../mannequin.js';
import { ease, mix, v3, palmDown, palmOnWall, cueDot } from './_kit.js';

const DEG = Math.PI / 180;
const WALL = -0.75;
const TABLE_H = 0.74;
let level = 0;
let dot = null;
let leftLabel = null;

// Тело вдоль линии: опора A, угол от вертикали a (градусы), до таза dP, до плеч — дальше по линии.
function bodyLine(m, A, a, dP) {
  const dir = v3(0, Math.cos(a * DEG), -Math.sin(a * DEG));
  m.pelvis.position.copy(A).add(dir.clone().multiplyScalar(dP));
  m.pelvis.rotation.set(-a * DEG, 0, 0);
  m.spine.rotation.set(0, 0, 0);
  return dir;
}

export default {
  get legend() {
    return level === 1
      ? 'Вперёд — вес переходит на левую руку (оранжевая точка). Колени и ладони стоят на месте.'
      : 'Тело — прямая линия. Ладони стоят на месте, сгибаются локти.';
  },
  get views() {
    if (level === 0) return {
      side: { label: 'Сбоку', pos: [2.7, 1.15, -0.4], target: [0, 0.95, -0.4], fov: 36 },
      back: { label: 'Сзади', pos: [1.4, 1.6, 1.5], target: [0, 0.9, -0.4], fov: 38 },
    };
    if (level === 2) return {
      side: { label: 'Сбоку', pos: [2.8, 1.0, -0.6], target: [0, 0.7, -0.6], fov: 36 },
      back: { label: 'Сзади', pos: [1.5, 1.5, 1.3], target: [0, 0.6, -0.6], fov: 38 },
    };
    return {
      side: { label: 'Сбоку', pos: [3.0, 0.8, -0.75], target: [0, 0.32, -0.75], fov: 40 },
      front: { label: 'Спереди', pos: [1.0, 0.95, -2.6], target: [0, 0.32, -0.7], fov: 36 },
    };
  },
  // Вызывается до создания сцены: от ступени зависят ракурсы.
  configure(ex) { level = ex?.level ?? 0; },
  setup(m, scene, stage, ex) {
    level = ex?.level ?? 0;
    if (level === 0) scene.add(wall({ front: WALL }));
    if (level === 2) scene.add(sideTable({ x: 0, z: -1.05, w: 0.9, d: 0.5, h: TABLE_H }));
    if (level === 1) {
      dot = cueDot(m.materials.glow, 0.05);
      scene.add(dot);
      if (stage) leftLabel = stage.label('левая');
    }
  },
  pose(m, s) {
    m.reset();
    // фазы: 0 — вниз (или вперёд), 1 — вверх (или назад)
    const k = s.phase === 0 ? ease(s.u) : 1 - ease(s.u);
    const sides = [['R', 1], ['L', -1]];

    if (level === 0) {
      const a = mix(10, 22, k);
      bodyLine(m, v3(0, ANKLE_H, 0), a, 0.85);
      for (const [key, sx] of sides) {
        m.leg(key, v3(sx * 0.1, ANKLE_H, 0));
        m.arm(key, v3(sx * 0.24, 1.28, WALL + 0.02), { hand: palmOnWall(sx), pole: v3(sx * 0.9, 0.7, 0.2) });
        m.arms[key].hand.setFingers({ all: [4, 4, 2] });
        m.arms[key].hand.setThumb('open');
      }
    }

    if (level === 2) {
      const a = mix(30, 42, k);
      bodyLine(m, v3(0, ANKLE_H, 0), a, 0.85);
      for (const [key, sx] of sides) {
        m.leg(key, v3(sx * 0.1, ANKLE_H, 0));
        m.arm(key, v3(sx * 0.24, TABLE_H + 0.03, -0.86), { hand: palmDown(sx), pole: v3(sx * 0.8, 1.0, 0.0) });
        m.arms[key].hand.setFingers({ all: [3, 3, 2] });
        m.arms[key].hand.setThumb('open');
      }
    }

    if (level === 4 || level === 3) {
      // опора: стопы на носках (обычные) или колени (с колен); угол от горизонтали b
      const knees = level === 3;
      const b = knees ? mix(36, 16, k) : mix(21.7, 10, k);
      const A = knees ? v3(0, 0.055, 0) : v3(0, 0.11, 0);
      const dir = v3(0, Math.sin(b * DEG), -Math.cos(b * DEG));
      const dP = knees ? 0.43 : 0.85;
      m.pelvis.position.copy(A).add(dir.clone().multiplyScalar(dP));
      m.pelvis.rotation.set(-(90 - b) * DEG, 0, 0);
      for (const [key, sx] of sides) {
        if (knees) {
          m.leg(key, v3(sx * 0.1, 0.06, 0.41), { pitch: 180, pole: v3(sx * 0.1, -0.4, -0.1) });
        } else {
          m.leg(key, v3(sx * 0.1, A.y, 0), { pitch: -65, toesUp: 65, pole: v3(sx * 0.1, -0.5, -0.4) });
        }
        const wz = knees ? -0.8 : -1.25;
        m.arm(key, v3(sx * 0.24, 0.045, wz), { hand: palmDown(sx), pole: v3(sx * 0.7, 0.6, wz + 0.6) });
        m.arms[key].hand.setFingers({ all: [3, 3, 2] });
        m.arms[key].hand.setThumb('open');
      }
    }

    if (level === 1) {
      // четвереньки: колени под тазом, ладони под плечами; вперёд — таз вперёд и к левой руке
      m.pelvis.position.set(mix(0, -0.045, k), 0.5, mix(0, -0.09, k));
      m.pelvis.rotation.set(-84 * DEG, 0, 0);
      for (const [key, sx] of sides) {
        m.leg(key, v3(sx * 0.1, 0.06, 0.41), { pitch: 180, pole: v3(sx * 0.1, -0.4, -0.2) });
        m.arm(key, v3(sx * 0.22, 0.045, -0.52), { hand: palmDown(sx), pole: v3(sx * 0.7, 0.6, 0.2) });
        m.arms[key].hand.setFingers({ all: [3, 3, 2] });
        m.arms[key].hand.setThumb('open');
      }
      const lw = m.arms.L.wrist.getWorldPosition(new THREE.Vector3());
      dot.position.copy(lw).add(v3(0, 0.0, -0.04));
      dot.material.opacity = 0.2 + 0.5 * k;
      if (leftLabel) leftLabel.set(lw);
    }
  },
};
