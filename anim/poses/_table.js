// Упражнения для кисти у столика сидя: левое предплечье лежит на столе.
//   flexext   — кисть свисает с края, плавно вверх и вниз (разминка, этап 1)
//   deviation — ладонь на столе, скользит к большому пальцу и к мизинцу (разминка)
//   angle     — угол с закрытыми глазами (чувство положения)
//   dart      — «бросок дротика»: из «назад и к большому пальцу» в «вперёд и к мизинцу»
//   balltable — ладонь на мяче, мяч катается кругами и восьмёрками
import * as THREE from 'three';
import { sideTable, stool, ball } from '../props.js';
import { ease, v3, ballPath, makeBlender, pathTrace } from './_kit.js';
import { WORK, WS, DEG, palmDownQuat, sit, restOnThigh } from './_hand.js';

const TABLE_H = 0.70;
const WRIST = v3(-0.21, TABLE_H + 0.03, -0.38);

const VIEWS = {
  fp: { label: 'Как видишь ты', pos: [-0.03, 1.2, -0.12], target: [-0.21, 0.72, -0.47], fov: 36, firstPerson: true },
  side: { label: 'Сбоку', pos: [-1.3, 0.92, -0.36], target: [-0.2, 0.74, -0.36], fov: 34 },
  front: { label: 'Спереди', pos: [-0.1, 0.9, -1.25], target: [-0.2, 0.72, -0.42], fov: 30 },
};

export function makeTable(kind) {
  let arc = null;
  let theBall = null;
  let wedge = null;
  const blend = makeBlender();
  const BALL_R = 0.04;
  const BALL_C = v3(-0.23, TABLE_H, -0.5);
  let trace = null;
  let tracePhase = -1;
  const bigTable = kind === 'deviation' || kind === 'balltable';
  return {
    legend: {
      flexext: 'Оранжевая дуга — путь пальцев: вверх и вниз до лёгкого натяжения. Предплечье лежит на столе.',
      deviation: 'Оранжевая дуга — путь пальцев по столу: к большому пальцу и к мизинцу.',
      angle: 'Оранжевым — заданный угол. Глаза закрыты, кисть ставишь по ощущению, потом открываешь и сверяешь.',
      dart: 'Оранжевая дуга — путь кисти по диагонали, как при броске дротика.',
      balltable: 'Ладонь лежит на мяче сверху. Четыре части: круги по часовой, против часовой, восьмёрка влево, восьмёрка вправо.',
    }[kind],
    views: kind === 'deviation' || kind === 'balltable'
      ? { fp: VIEWS.fp, front: VIEWS.front, side: VIEWS.side }
      : { side: VIEWS.side, fp: VIEWS.fp, front: VIEWS.front },
    demo: kind === 'angle'
      ? [
        { label: 'Глаза закрыты: ставишь угол', dur: 2.2 },
        { label: 'Открыл глаза: сверяешь', dur: 1.6 },
        { label: 'Расслабь', dur: 1.2 },
      ]
      : null,
    setup(m, scene) {
      scene.add(stool({ seat: 0.44, z: 0.02 }));
      scene.add(bigTable
        ? sideTable({ x: -0.2, z: -0.38, w: 0.42, d: 0.62, h: TABLE_H })
        : sideTable({ x: -0.22, z: -0.2, w: 0.36, d: 0.34, h: TABLE_H }));
      const cue = m.materials.cue;
      const R = 0.17;
      const pts = [];
      if (kind === 'flexext' || kind === 'dart') {
        for (let i = 0; i <= 40; i++) {
          const e = (-50 + (100 * i) / 40) * DEG;
          const d = kind === 'dart' ? (-20 + (40 * i) / 40) * DEG : 0;
          pts.push(v3(WRIST.x + Math.sin(d) * R * 0.9, WRIST.y + Math.sin(e) * R, WRIST.z - Math.cos(e) * R));
        }
      }
      if (kind === 'deviation') {
        for (let i = 0; i <= 40; i++) {
          const d = (-25 + (50 * i) / 40) * DEG;
          pts.push(v3(WRIST.x + Math.sin(d) * R, TABLE_H + 0.004, WRIST.z - 0.02 - Math.cos(d) * R));
        }
      }
      if (pts.length) {
        arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0025, 8, false), cue);
        scene.add(arc);
      }
      if (kind === 'angle') {
        // «клин» заданного угла: от горизонтали до 30° вверх
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.absarc(0, 0, 0.16, 0, 30 * DEG, false);
        shape.lineTo(0, 0);
        const wedgeMat = m.materials.glow.clone();
        wedgeMat.side = THREE.DoubleSide;
        wedge = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), wedgeMat);
        wedge.rotation.y = Math.PI / 2;
        wedge.position.copy(WRIST).add(v3(0.002, 0, 0));
        scene.add(wedge);
      }
      if (kind === 'balltable') {
        theBall = ball(BALL_R);
        scene.add(theBall);
        trace = pathTrace(scene, m.materials.cue);
        tracePhase = -1;
      }
    },
    pose(m, s) {
      m.reset();
      sit(m);
      restOnThigh(m, 'R');
      const H = m.arms[WORK].hand;
      const pole = v3(-0.5, 0.55, 0.1);
      let q;
      let wrist = WRIST.clone();
      let fingers = { all: [6, 8, 4] };

      if (kind === 'flexext') {
        // фаза 0 — вверх, фаза 1 — вниз; от середины к краю и обратно
        const k = ease(s.u);
        const e = s.phase === 0 ? -40 + 85 * k : 45 - 85 * k;
        q = palmDownQuat(WS, e, 0);
      }
      if (kind === 'deviation') {
        const k = ease(s.u);
        const d = s.phase === 0 ? -20 + 45 * k : 25 - 45 * k;
        wrist = v3(WRIST.x, TABLE_H + 0.022, WRIST.z + 0.02);
        q = palmDownQuat(WS, -6, d); // ладонь лежит на столе
        fingers = { all: [4, 4, 2] };
      }
      if (kind === 'angle') {
        // 0 — поднимаем до «ощущения» 30°, 1 — держим и сверяем, 2 — опускаем
        const target = 26; // рука чуть промахнулась: так и видно, зачем сверяться
        const e = s.phase === 0 ? target * ease(s.u) : s.phase === 1 ? target : target * (1 - ease(s.u));
        q = palmDownQuat(WS, e, 0);
        if (wedge) wedge.material.opacity = s.phase === 1 ? 0.6 : 0.3;
      }
      if (kind === 'dart') {
        const k = ease(s.u);
        const t = s.phase === 0 ? 1 - k : k; // 0: назад-к большому, 1: вперёд-к мизинцу
        q = palmDownQuat(WS, 40 - 85 * t, 18 - 40 * t);
      }
      if (kind === 'balltable') {
        // фаза — часть упражнения: круги по часовой, против, восьмёрка влево, вправо
        // на столе «вверх» — от себя, то есть −Z
        const ph = s.phase ?? 0;
        if (ph !== tracePhase) {
          tracePhase = ph;
          const pts = [];
          for (let i = 0; i <= 80; i++) { const [x, up] = ballPath(ph, (3 * i) / 80); pts.push(BALL_C.clone().add(v3(x, 0.003, -up))); }
          trace(pts);
        }
        const [dx, up] = ballPath(ph, s.t ?? 0);
        const c = blend(ph, s.t ?? 0, BALL_C.clone().add(v3(dx, BALL_R, -up)));
        theBall.position.copy(c);
        theBall.rotation.set(-c.z / BALL_R, 0, c.x / BALL_R);
        // ладонь лежит на мяче сверху: середина ладони над центром мяча
        wrist = c.clone().add(v3(0, BALL_R + 0.017, 0.047));
        q = palmDownQuat(WS, 0, 0);
        fingers = { all: [28, 26, 14] };
      }
      m.arm(WORK, wrist, { pole, hand: q });
      H.setFingers(fingers);
      H.setThumb('open');
    },
  };
}
