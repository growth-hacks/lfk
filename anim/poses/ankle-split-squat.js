// Присед на передней ноге — 2BFit, упражнение A (Hupperets 2009, приложение к статье).
// Опорная нога впереди, вторая сзади примерно на длину голени и без веса. Опорное колено сгибается
// примерно до 110° между бедром и голенью и остаётся над подушечкой стопы. Противоположная рука идёт вперёд.
// На фото из приложения задняя нога на приседе согнута и не касается пола — так и показываем.
// Уровни: пол → глаза закрыты → подушка (или доска) под передней стопой. side 0 — опорная правая, 1 — левая.
import * as THREE from 'three';
import { ANKLE_H } from '../mannequin.js';
import { ease, mix, v3, mixV, footPoint } from './_kit.js';
import { stageOf, ankleKit } from './_ankle.js';

const DEG = Math.PI / 180;
const THIGH = 0.41;
const SHIN = 0.41;
const FOOT_X = 0.10;

const kit = ankleKit();
let st = stageOf(null);
let line = null;
const labels = {};

// 0 — стоишь, 1 — нижняя точка
function amount(s) {
  if (s.phase === 0) return 0;
  if (s.phase === 1) return ease(s.u);
  return 1 - ease(s.u);
}

// Голеностоп стопы, стоящей на подушечке: пятка поднята на pitch градусов (минус — пятка вверх).
function ankleOnBall(ball, pitch) {
  return ball.clone().add(v3(0, 0.078, 0.125).applyAxisAngle(v3(1, 0, 0), pitch * DEG));
}

export default {
  legend: 'Оранжевая линия: колено идёт над подушечкой стопы. Задняя нога без веса.',
  views: {
    side: { label: 'Сбоку', pos: [3.0, 0.85, -0.55], target: [0, 0.66, 0.0], fov: 40 },
    front: { label: 'Спереди', pos: [0.55, 0.85, -3.0], target: [0.05, 0.66, 0.02], fov: 40 },
    close: { label: 'Колено и стопа', pos: [1.0, 0.42, -1.1], target: [0.1, 0.24, -0.04], fov: 34 },
  },
  sides: ['Опорная — правая', 'Опорная — левая'],
  demo: [{ label: 'Стоишь', dur: 0.8 }, { label: 'Вниз', dur: 1.6 }, { label: 'Вверх', dur: 1.6 }],
  configure(ex) { st = stageOf(ex); },
  setup(m, scene, stage) {
    for (const k of Object.keys(labels)) delete labels[k];
    kit.setup(m, scene, stage, st);
    line = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 8), m.materials.glow);
    scene.add(line);
    if (stage) {
      labels.weight = stage.label('вес — на середину стопы');
      labels.back = stage.label('без веса');
    }
  },
  pose(m, s) {
    const k = amount(s);
    const sx = s.side === 1 ? -1 : 1;
    const stand = sx > 0 ? 'R' : 'L';
    const free = sx > 0 ? 'L' : 'R';
    const y0 = kit.lift;
    kit.place(sx * FOOT_X, -0.04);
    m.reset();

    // Опорная нога: голень наклоняется вперёд, колено идёт к подушечке; угол в колене от 176° до 110°.
    const beta = mix(3, 19, k) * DEG;
    const inner = mix(176, 110, k) * DEG;
    const ankle = v3(sx * FOOT_X, ANKLE_H + y0, 0);
    const knee = ankle.clone().add(v3(0, SHIN * Math.cos(beta), -SHIN * Math.sin(beta)));
    const a = beta + inner; // направление бедра от колена, считая от «вниз» в сторону «назад»
    const hip = knee.clone().add(v3(0, -THIGH * Math.cos(a), THIGH * Math.sin(a)));

    // Таз над опорной стопой и чуть назад, корпус наклоняется вперёд, чтобы вес остался на середине стопы.
    m.pelvis.position.set(sx * 0.045, hip.y + 0.03, hip.z);
    m.pelvis.rotation.set(-mix(0, 10, k) * DEG, 0, -sx * 2 * DEG);
    m.spine.rotation.x = -mix(3, 24, k) * DEG;
    m.leg(stand, ankle);

    // Задняя нога: в начале стоит сзади на подушечке без веса, на приседе отрывается и сгибается.
    const startBall = v3(-sx * FOOT_X, 0, 0.27);
    const start = ankleOnBall(startBall, -55);
    const end = v3(-sx * 0.08, 0.24 + y0, hip.z + 0.26);
    const fh = m.legs[free].hip.getWorldPosition(new THREE.Vector3());
    m.leg(free, mixV(start, end, k), { pitch: mix(-55, -22, k), toesUp: mix(55, 8, k), pole: fh.clone().add(v3(0, -0.4, -1)) });

    // Рука со стороны задней ноги идёт вперёд, вторая остаётся у бедра.
    m.arms[free].set({ shoulderFlex: mix(4, 100, k), shoulderAbd: 4, elbowFlex: mix(8, 14, k) });
    m.arms[stand].set({ shoulderFlex: mix(0, -12, k), shoulderAbd: 7, elbowFlex: 10 });
    for (const key of ['R', 'L']) {
      m.arms[key].hand.setFingers({ all: [10, 14, 8] });
      m.arms[key].hand.setThumb('open');
    }

    // Линия «колено над подушечкой».
    const leg = m.legs[stand];
    leg.knee.updateWorldMatrix(true, false);
    const kn = leg.knee.getWorldPosition(new THREE.Vector3()).add(v3(0, 0, -0.05));
    const ball = footPoint(leg, -0.005, -0.07, -0.125);
    line.position.copy(kn).add(ball).multiplyScalar(0.5);
    line.scale.set(1, kn.distanceTo(ball), 1);
    line.quaternion.setFromUnitVectors(v3(0, 1, 0), ball.clone().sub(kn).normalize());

    if (labels.weight) {
      // точки — прямо на стопах: сама подпись стоит сбоку сцены и тянет к точке линию
      labels.weight.set(footPoint(leg, 0, -0.05, -0.06));
      labels.back.set(footPoint(m.legs[free], 0, -0.04, -0.06));
    }
    kit.eyes(m);
  },
};
