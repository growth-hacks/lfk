// Повороты предплечья: локти прижаты к бокам и согнуты под 90°, ладони поворачиваются вверх и вниз.
// Источник: «План восстановления левой кисти» — этап 1 (без веса) и этап 2 (гантель за один конец).
// В плане сказано только «медленно», темп здесь задан для показа.

import * as THREE from 'three';
import { createDumbbell, GRIP, RELAXED, DEG } from '../mannequin.js';

const AMPLITUDE = 75; // градусов в каждую сторону от «большой палец сверху»
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);

export function makeForearmRotation({ dumbbell = true } = {}) {
  return {
    legend: 'Оранжевым — на что смотреть: кольцо на локте — локоть прижат к боку, дуга — путь движения.',
    period: 5, // для страницы-пробы: секунд на один повтор
    views: {
      fp: { label: 'От первого лица', pos: [0, 1.62, -0.1], target: [0, 1.04, -0.38], fov: 74, firstPerson: true },
      side: { label: 'Сбоку', pos: [1.75, 1.5, -0.85], target: [0, 1.26, -0.12], fov: 40 },
      front: { label: 'Спереди', pos: [0.35, 1.5, -2.05], target: [0, 1.27, -0.1], fov: 40 },
    },

    setup(m) {
      const cue = m.materials.cue;
      for (const arm of [m.arms.R, m.arms.L]) {
        let farPlate;
        if (dumbbell) {
          const db = createDumbbell(arm.s, m.materials);
          arm.hand.group.add(db);
          arm.hand.setFingers(GRIP);
          arm.hand.setThumb('grip');
          farPlate = db.userData.farPlate.clone();
        } else {
          arm.hand.setFingers(RELAXED);
          arm.hand.setThumb('open');
          farPlate = new THREE.Vector3(-arm.s * 0.02, -0.09, -0.056); // кончик большого пальца
        }

        // Оранжевое кольцо на локте: локоть прижат к боку.
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0045, 10, 48), cue);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.02;
        arm.elbow.add(ring);

        // Оранжевая дуга: путь дальнего диска гантели (или большого пальца). Стоит на месте, пока предплечье крутится.
        const far = farPlate;
        far.y += -0.25;
        const radius = Math.hypot(far.x, far.z) + (dumbbell ? 0.045 : 0.03);
        const base = Math.atan2(far.z, far.x);
        const span = AMPLITUDE - 12; // дуга короче хода, чтобы две дуги не сходились посередине
        const pts = [];
        for (let i = 0; i <= 48; i++) {
          const sup = -span + (2 * span * i) / 48;
          const a = base + arm.s * sup * DEG;
          pts.push(new THREE.Vector3(Math.cos(a) * radius, far.y, Math.sin(a) * radius));
        }
        const arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.0028, 8, false), cue);
        arm.elbow.add(arc);
        for (const [p, q] of [[pts[1], pts[0]], [pts[47], pts[48]]]) {
          const head = new THREE.Mesh(new THREE.ConeGeometry(0.0095, 0.026, 14), cue);
          head.position.copy(q);
          head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
          arm.elbow.add(head);
        }
      }
    },

    // Страница-проба: t — секунды с начала.
    apply(m, t) {
      const phase = (t % this.period) / this.period;
      const sup = Math.sin(phase * 2 * Math.PI) * AMPLITUDE;
      for (const arm of [m.arms.R, m.arms.L]) arm.set({ elbowFlex: 90, supination: sup });
      return { cue: Math.cos(phase * 2 * Math.PI) > 0 ? 'Ладонями вверх' : 'Ладонями вниз', rep: Math.floor(t / this.period) };
    },

    // Приложение: фаза 0 — ладонями вверх, фаза 1 — ладонями вниз; u — доля фазы от 0 до 1.
    pose(m, { phase = 0, u = 0 } = {}) {
      const k = ease(u);
      const sup = phase === 0 ? -AMPLITUDE + 2 * AMPLITUDE * k : AMPLITUDE - 2 * AMPLITUDE * k;
      for (const arm of [m.arms.R, m.arms.L]) arm.set({ elbowFlex: 90, supination: sup });
    },
  };
}

export default makeForearmRotation({ dumbbell: true });
