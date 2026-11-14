// Ходьба на носках — 2BFit, упражнение F (Hupperets 2009, приложение к статье).
// 4 м на высоких носках носками вперёд, 4 м носками наружу, 4 м носками внутрь. Носки разворачиваются от бедра.
// Уровни: ходьба → прыжки (на двух ногах; на одной — личное усложнение из profile.js).
// В показе каждая часть — отрезок пути; на полу — линия дистанции.
import * as THREE from 'three';
import { floorTape } from '../props.js';
import { mix, v3 } from './_kit.js';
import { stageOf } from './_ankle.js';

const DEG = Math.PI / 180;
const PITCH = -40;   // высоко на носках
const SPAN = 1.3;    // сколько проходим за одну часть показа, м
const DUR = 3.2;
const YAW = 28;      // носки наружу и внутрь
let st = stageOf(null);
const labels = {};

// голеностоп над подушечкой: стопа на носке (pitch) и развёрнута (yaw)
function ankleFromBall(ball, pitch, yaw) {
  return ball.clone().add(v3(0, 0.078, 0.125).applyAxisAngle(v3(1, 0, 0), pitch * DEG).applyAxisAngle(v3(0, 1, 0), yaw * DEG));
}

export default {
  legend: 'На высоких носках. Носки наружу и внутрь — поворотом всей ноги от бедра.',
  views: {
    side: { label: 'Сбоку', pos: [3.0, 0.95, 0], target: [0, 0.5, 0], fov: 42 },
    // носки наружу и внутрь видно спереди и снизу: сверху стопы закрывает корпус
    front: { label: 'Спереди', pos: [0.7, 0.55, -2.6], target: [0, 0.3, 0], fov: 40 },
    feet: { label: 'Стопы крупно', pos: [1.0, 0.35, -1.3], target: [0, 0.08, -0.25], fov: 40 },
  },
  demo: [{ label: 'Носки вперёд', dur: DUR }, { label: 'Носки наружу', dur: DUR }, { label: 'Носки внутрь', dur: DUR }],
  configure(ex) { st = stageOf(ex); },
  setup(m, scene, stage) {
    for (const k of Object.keys(labels)) delete labels[k];
    scene.add(floorTape(v3(0.42, 0.002, SPAN / 2 + 0.2), v3(0.42, 0.002, -SPAN / 2 - 0.2), m.materials.cue));
    if (stage) {
      labels.dist = stage.label('дистанция 4 м');
      labels.dist.set(v3(0.42, 0.02, -SPAN / 2 - 0.3));
    }
  },
  pose(m, s) {
    const yaw = s.phase === 0 ? 0 : s.phase === 1 ? YAW : -YAW; // + — носки наружу
    const bz = SPAN / 2 - SPAN * s.u;
    const t = s.t;
    m.reset();
    const legYaw = { R: -yaw, L: yaw };

    if (!st.jump) {
      // ходьба: стопа на опоре стоит на месте, в переносе — идёт вперёд с небольшим подъёмом
      const T = 0.9;
      const L = (SPAN / DUR) * (T / 2);
      const phi = (t / T) % 1;
      let minY = 1;
      for (const [key, sx, shift] of [['R', 1, 0], ['L', -1, 0.5]]) {
        const f = (phi + shift) % 1;
        const stance = f < 0.5;
        const off = stance ? mix(-L / 2, L / 2, f / 0.5) : mix(L / 2, -L / 2, (f - 0.5) / 0.5);
        const up = stance ? 0 : 0.05 * Math.sin((Math.PI * (f - 0.5)) / 0.5);
        const ball = v3(sx * 0.09, up, bz + off - 0.06);
        const ank = ankleFromBall(ball, PITCH, legYaw[key]);
        minY = Math.min(minY, ank.y);
        m.legs[key].userData = { ank, stance };
      }
      m.pelvis.position.set(0, minY + 0.84 + 0.008 * Math.sin(4 * Math.PI * phi), bz);
      for (const [key] of [['R'], ['L']]) {
        const { ank, stance } = m.legs[key].userData;
        const hip = m.legs[key].hip.getWorldPosition(new THREE.Vector3());
        const pole = hip.clone().add(ank).multiplyScalar(0.5).add(v3(0, 0, -1).applyAxisAngle(v3(0, 1, 0), legYaw[key] * DEG));
        m.leg(key, ank, { pitch: PITCH, yaw: legYaw[key], toesUp: stance ? -PITCH : 20, pole });
        const sw = Math.sin(2 * Math.PI * (phi + (key === 'R' ? 0.5 : 0)));
        m.arms[key].set({ shoulderFlex: 18 * sw, shoulderAbd: 5, elbowFlex: 20 });
      }
    } else {
      // прыжки на носках тем же маршрутом: на двух ногах или на одной
      const T = 0.55;
      const psi = (t / T) % 1;
      const ground = psi < 0.35;
      const air = ground ? 0 : 0.07 * Math.sin((Math.PI * (psi - 0.35)) / 0.65);
      const dip = ground ? 0.035 * Math.sin((Math.PI * psi) / 0.35) : 0;
      const one = st.jump === 1;
      const keys = one ? [['R', 1]] : [['R', 1], ['L', -1]];
      let ankY = 0;
      for (const [key, sx] of keys) {
        const ank = ankleFromBall(v3(sx * 0.09, air, bz - 0.06), PITCH, legYaw[key]);
        ankY = ank.y;
        m.legs[key].userData = { ank };
      }
      m.pelvis.position.set(one ? 0.04 : 0, ankY + 0.84 - dip, bz);
      for (const [key] of keys) {
        const { ank } = m.legs[key].userData;
        const hip = m.legs[key].hip.getWorldPosition(new THREE.Vector3());
        const pole = hip.clone().add(ank).multiplyScalar(0.5).add(v3(0, 0, -1).applyAxisAngle(v3(0, 1, 0), legYaw[key] * DEG));
        m.leg(key, ank, { pitch: PITCH, yaw: legYaw[key], toesUp: ground ? -PITCH : 15, pole });
      }
      if (one) {
        const Lg = m.legs.L;
        Lg.hip.rotation.set(20 * DEG, 0, 0);
        Lg.knee.rotation.set(-80 * DEG, 0, 0);
        Lg.ankle.rotation.set(-20 * DEG, 0, 0);
      }
      for (const key of ['R', 'L']) m.arms[key].set({ shoulderAbd: one ? 18 : 8, shoulderFlex: 10, elbowFlex: 30 });
    }
    for (const key of ['R', 'L']) {
      m.arms[key].hand.setFingers({ all: [12, 16, 8] });
      m.arms[key].hand.setThumb('open');
    }
  },
};
