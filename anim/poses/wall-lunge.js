// Тест у стены (weight-bearing lunge test): колено касается стены, пятка на полу, меряем расстояние от большого пальца до стены.
import * as THREE from 'three';
import { wall, floorTape } from '../props.js';
import { ANKLE_H } from '../mannequin.js';
import { ease, mix, v3, palmOnWall, cueArrow, pointArrow, cueDot, footPoint } from './_kit.js';

const WALL = -0.62;
const SHIN = 0.41;
const THIGH = 0.41;
const DEG = Math.PI / 180;

let arrow = null;
let knee = null;

export default {
  legend: 'Оранжевым: колено касается стены, пятка прижата к полу. Линия на полу — расстояние, которое меряем.',
  demo: [
    { label: 'Колено к стене', dur: 2.2 },
    { label: 'Пятка на полу', dur: 1.6 },
    { label: 'Назад', dur: 1.8 },
  ],
  views: {
    side: { label: 'Сбоку', pos: [2.5, 1.0, -0.2], target: [0, 0.68, -0.25], fov: 38 },
    back: { label: 'Сзади', pos: [1.0, 1.4, 1.7], target: [0, 0.6, -0.35], fov: 38 },
  },
  setup(m, scene) {
    scene.add(wall({ front: WALL }));
    const front = v3(0.10, ANKLE_H, -0.32);
    const toe = front.clone().add(v3(-0.035, -ANKLE_H + 0.003, -0.205));
    scene.add(floorTape(toe, v3(toe.x, 0.003, WALL), m.materials.cue));
    arrow = cueArrow(m.materials.cue);
    knee = cueDot(m.materials.glow, 0.05);
    scene.add(arrow, knee);
  },
  pose(m, s) {
    // 0 → 1: колено идёт к стене; 1 — держим; потом назад
    const k = s.phase === 0 ? ease(s.u) : s.phase === 1 ? 1 : 1 - ease(s.u);
    m.reset();
    const A = v3(0.10, ANKLE_H, -0.32);           // проверяемая (правая) нога впереди
    const beta = mix(10, 37.6, k) * DEG;           // наклон голени вперёд
    const gamma = mix(12, 50, k) * DEG;            // бедро назад-вверх
    const K = A.clone().add(v3(0, SHIN * Math.cos(beta), -SHIN * Math.sin(beta)));
    const H = K.clone().add(v3(0, THIGH * Math.cos(gamma), THIGH * Math.sin(gamma)));
    m.pelvis.position.set(0, H.y + 0.03, H.z);
    m.spine.rotation.x = mix(-3, -6, k) * DEG;
    m.leg('R', A);
    m.leg('L', v3(-0.10, ANKLE_H, H.z + 0.56));
    root(m);
    m.legs.R.knee.updateWorldMatrix(true, false);
    const kw = m.legs.R.knee.getWorldPosition(new THREE.Vector3());
    knee.position.copy(kw).add(v3(0, 0, -0.03));
    knee.material.opacity = 0.15 + 0.5 * k;
    const heel = footPoint(m.legs.R, 0, -0.02, 0.07);
    pointArrow(arrow, heel.add(v3(0, 0.02, 0.045)), v3(0, -1, 0));
  },
};

function root(m) {
  const sh = m.pelvis.position.y + 0.02 + 0.47;
  for (const [key, sx] of [['R', 1], ['L', -1]]) {
    m.arm(key, v3(sx * 0.22, sh - 0.05, WALL + 0.02), { hand: palmOnWall(sx) });
    m.arms[key].hand.setFingers({ all: [4, 4, 2] });
    m.arms[key].hand.setThumb('open');
  }
}
