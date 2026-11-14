// Подъёмы на носки с возвышения — 2BFit, упражнение B (Hupperets 2009, приложение к статье).
// Стоишь на двух ногах, пятки свисают с края. Начало — пятки внизу, в растяжении; колени прямые, но не запертые.
// Подъём на подушечки только в голеностопе, вниз — медленно. Ступеньки нет — стопка книг у стены.
// Уровни: держишься рукой за стену → без опоры.
import * as THREE from 'three';
import { wall, bookStack, BOOKS_H } from '../props.js';
import { ease, mix, v3, palmOnWall, footPoint } from './_kit.js';
import { stageOf } from './_ankle.js';

const DEG = Math.PI / 180;
const WALL = -0.4;      // стена перед тобой
const EDGE = 0.0;       // задний край книг, откуда свисают пятки
const LOW = 18;         // пятки ниже края, градусов
const HIGH = -26;       // на подушечках
let st = stageOf(null);
const labels = {};

export default {
  legend: 'На книгах только передняя часть стоп. Пятки опускаются ниже края.',
  views: {
    side: { label: 'Сбоку', pos: [3.1, 1.0, 0.25], target: [0, 0.72, -0.02], fov: 40 },
    close: { label: 'Пятки крупно', pos: [0.9, 0.32, 0.62], target: [0.06, 0.12, 0.04], fov: 30 },
    back: { label: 'Сзади', pos: [0.6, 0.95, 2.6], target: [0, 0.6, 0], fov: 38 },
  },
  demo: [{ label: 'Вверх', dur: 1.2 }, { label: 'Вниз, медленно', dur: 2.2 }],
  configure(ex) { st = stageOf(ex); },
  setup(m, scene, stage) {
    for (const k of Object.keys(labels)) delete labels[k];
    scene.add(bookStack({ back: EDGE }), wall({ front: WALL }));
    if (stage) {
      labels.heel = stage.label('пятки ниже края');
      labels.books = stage.label('стопка книг');
    }
  },
  pose(m, s) {
    const k = s.phase === 0 ? ease(s.u) : 1 - ease(s.u); // 1 — на подушечках
    const p = mix(LOW, HIGH, k);
    m.reset();
    let ankle = null;
    for (const [key, sx] of [['R', 1], ['L', -1]]) {
      // стопа поворачивается вокруг подушечки, подушечка — на краю книг
      const ball = v3(sx * 0.1, BOOKS_H, EDGE - 0.014);
      ankle = ball.clone().add(v3(0, 0.078, 0.125).applyAxisAngle(v3(1, 0, 0), p * DEG));
      m.pelvis.position.set(0, ankle.y + 0.845, ankle.z - 0.01);
      m.leg(key, ankle, { pitch: p, toesUp: -p });
    }
    // повторно, когда таз уже на месте: ноги прямые
    for (const [key, sx] of [['R', 1], ['L', -1]]) {
      const ball = v3(sx * 0.1, BOOKS_H, EDGE - 0.014);
      m.leg(key, ball.clone().add(v3(0, 0.078, 0.125).applyAxisAngle(v3(1, 0, 0), p * DEG)), { pitch: p, toesUp: -p });
      if (st.hold === 'hand') {
        m.arm(key, v3(sx * 0.2, 1.22, WALL + 0.02), { hand: palmOnWall(sx) });
        m.arms[key].hand.setFingers({ all: [6, 8, 4] });
      } else {
        m.arms[key].set({ shoulderAbd: 8, elbowFlex: 8 });
        m.arms[key].hand.setFingers({ all: [10, 14, 8] });
      }
      m.arms[key].hand.setThumb('open');
    }
    if (labels.heel) {
      // точка — на пятке, книги — спереди, у стены; подписи сбоку сцены
      labels.heel.set(footPoint(m.legs.R, 0.0, -0.07, 0.05));
      labels.heel.visible = k < 0.35;
      labels.books.set(v3(0, 0.0, EDGE - 0.3));
    }
  },
};
