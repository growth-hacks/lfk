// Лента — Docherty 1998, постановка по Smith 2012. Четыре упражнения: носок к себе, от себя, стопа внутрь, наружу.
// Сидишь на полу, рабочая нога прямая. Петля ленты на стопе у основания пальцев, второй конец — на ножке стола.
// Для каждого направления стол стоит со своей стороны: лента тянет стопу в обратную сторону.
// Вторая нога согнута, стопа на полу, чтобы не мешать ленте. side 0 — работает правая нога, 1 — левая.
// Направление выбирает configure(ex) по id упражнения.
import * as THREE from 'three';
import { ANKLE_H } from '../mannequin.js';
import { setWorldQuat, quatFromAxes } from '../ik.js';
import { sideTable, floorTape } from '../props.js';
import { ease, mix, v3, palmDown } from './_kit.js';

const DEG = Math.PI / 180;
const ANKLE_Z = -0.8;
const TIE_H = 0.2; // на какой высоте лента привязана к ножке стола

// anchor — где ножка стола для правой ноги (для левой x зеркально).
// p — носок к себе (+) или от себя (−), e — подошва наружу (+) или внутрь (−); градусы, при 0/0 носок смотрит вверх.
const DIRS = {
  df: { anchor: [0.10, -1.45], from: { p: -25, e: 0 }, to: { p: 18, e: 0 }, view: 'side' },
  pf: { anchor: [0.5, 0.25], from: { p: 15, e: 0 }, to: { p: -35, e: 0 }, view: 'side' },
  in: { anchor: [0.64, -0.86], from: { p: 0, e: 10 }, to: { p: 0, e: -25 }, view: 'front' },
  ev: { anchor: [-0.5, -0.86], from: { p: 0, e: -10 }, to: { p: 0, e: 18 }, view: 'front' },
};

const VIEWS = {
  side: { label: 'Сбоку', pos: [2.9, 0.95, -0.5], target: [0.1, 0.22, -0.5], fov: 40 },
  front: { label: 'Спереди', pos: [0, 0.7, -2.5], target: [0, 0.2, -0.86], fov: 50 },
  close: { label: 'Стопа крупно', pos: [0.78, 0.32, -0.98], target: [0.08, 0.2, -0.88], fov: 34 },
  fp: { label: 'Как видишь ты', pos: [0.02, 0.8, 0.36], target: [0.1, 0.14, -0.86], fov: 26, firstPerson: true },
};

// Ориентация стопы: куда смотрят пальцы и подошва. Отведение носка идёт вместе с поворотом подошвы.
function footQuat(p, e, sx) {
  const pr = p * DEG;
  const er = e * DEG;
  const lat = v3(sx, 0, 0);
  const toe0 = v3(0, Math.cos(pr), Math.sin(pr));
  const sole0 = v3(0, Math.sin(pr), -Math.cos(pr));
  const ab = 0.35 * er;
  const toe = toe0.clone().multiplyScalar(Math.cos(ab)).add(lat.clone().multiplyScalar(Math.sin(ab))).normalize();
  const sole = sole0.clone().multiplyScalar(Math.cos(er)).add(lat.clone().multiplyScalar(Math.sin(er)));
  sole.sub(toe.clone().multiplyScalar(sole.dot(toe))).normalize();
  const Z = toe.clone().negate();
  const Y = sole.clone().negate();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  return { q: quatFromAxes(X, Y, Z), X, Y, Z };
}

// Петля ленты: скруглённый прямоугольник вокруг стопы у основания пальцев (в осях голеностопа).
const LOOP_C = v3(0, -0.0625, -0.112);
const LOOP_W = 0.058;
const LOOP_H = 0.027;
class LoopCurve extends THREE.Curve {
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return target.set(LOOP_W * Math.sign(c) * Math.sqrt(Math.abs(c)), LOOP_H * Math.sign(s) * Math.sqrt(Math.abs(s)), 0);
  }
}

let dir = DIRS.df;
let loop = null;
let strip = null;
let knot = null;
let table = null;
let tape = null;
let tapeMat = null;
let sceneRef = null;
let lastSide = -1;
const labels = {};

const pose = {
  legend: 'Синим — лента. Оранжевая линия на полу — метка: до неё растягиваешь ленту.',
  views: VIEWS,
  sides: ['Правая нога', 'Левая нога'],
  demo: [{ label: 'Тянешь', dur: 1.3 }, { label: 'Обратно', dur: 1.3 }],
  configure(ex) {
    const key = (ex?.id || '').replace('ankle-band-', '');
    dir = DIRS[key] || DIRS.df;
    // первым — ракурс, где стол не закрывает стопу
    const first = dir.view;
    pose.views = { [first]: VIEWS[first], ...Object.fromEntries(Object.entries(VIEWS).filter(([k]) => k !== first)) };
  },
  setup(m, scene, stage) {
    for (const k of Object.keys(labels)) delete labels[k];
    sceneRef = scene;
    lastSide = -1;
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xc8413a, roughness: 0.55 });
    tapeMat = m.materials.cue;
    loop = new THREE.Mesh(new THREE.TubeGeometry(new LoopCurve(), 72, 0.0045, 8, true), bandMat);
    loop.position.copy(LOOP_C);
    strip = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 1, 10), bandMat);
    knot = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 8, 24), bandMat);
    knot.rotation.x = Math.PI / 2;
    table = sideTable({ w: 0.5, d: 0.4, h: 0.7 });
    tape = null;
    scene.add(strip, knot, table);
    if (stage) {
      labels.band = stage.label('лента у основания пальцев');
      labels.mark = stage.label('метка: длина в покое + 70%');
    }
  },
  pose(m, s) {
    const sx = s.side === 1 ? -1 : 1;
    const work = sx > 0 ? 'R' : 'L';
    const bent = sx > 0 ? 'L' : 'R';
    const anchor = v3(sx * dir.anchor[0], TIE_H, dir.anchor[1]);
    const k = s.phase === 0 ? ease(s.u) : 1 - ease(s.u);
    m.reset();

    // Сидишь на полу, корпус откинут назад, ладони на полу позади.
    m.pelvis.position.set(0, 0.145, 0);
    m.spine.rotation.x = 35 * DEG;
    for (const [key, kx] of [['R', 1], ['L', -1]]) {
      m.arm(key, v3(kx * 0.24, 0.03, 0.3), { hand: palmDown(kx), pole: v3(kx * 0.8, 0.6, 0.7) });
      m.arms[key].hand.setFingers({ all: [8, 10, 6] });
      m.arms[key].hand.setThumb('open');
    }
    // вторая нога согнута, стопа на полу, колено отведено наружу — ленте не мешает
    m.leg(bent, v3(-sx * 0.22, ANKLE_H, -0.36), { pole: v3(-sx * 0.5, 1.2, -0.3) });

    // рабочая нога прямая, носок вверх; если пятка уходит в пол — нога чуть приподнимается
    const f = footQuat(mix(dir.from.p, dir.to.p, k), mix(dir.from.e, dir.to.e, k), sx);
    const heelY = Math.min(...[v3(0, -0.07, 0.06), v3(0, -0.035, 0.07), v3(0.03, -0.07, 0.05), v3(-0.03, -0.07, 0.05)]
      .map((h) => h.x * f.X.y + h.y * f.Y.y + h.z * f.Z.y));
    const ankle = v3(sx * 0.1, Math.max(0.072, 0.004 - heelY), ANKLE_Z);
    m.leg(work, ankle, { pole: v3(sx * 0.1, 1.2, -0.4) });
    setWorldQuat(m.legs[work].ankle, f.q);

    // при смене ноги — петля на другую стопу, стол и метка на другую сторону
    if (s.side !== lastSide) {
      lastSide = s.side;
      m.legs[work].ankle.add(loop);
      table.position.set(anchor.x, 0, anchor.z);
      knot.position.copy(anchor);
      if (tape) sceneRef.remove(tape);
      const A = m.legs[work].ankle;
      A.updateWorldMatrix(true, false);
      const under = A.localToWorld(LOOP_C.clone());
      tape = floorTape(v3(anchor.x, 0.002, anchor.z), v3(under.x, 0.002, under.z), tapeMat);
      sceneRef.add(tape);
      // подпись метки — рядом с линией, ближе к столу, чтобы не закрывать стопу
      const along = v3(anchor.x - under.x, 0, anchor.z - under.z);
      const side = v3(-along.z, 0, along.x).normalize().multiplyScalar(0.12);
      if (labels.mark) labels.mark.set(v3(under.x, 0.01, under.z).add(along.multiplyScalar(0.62)).add(side));
    }

    // лента от петли к ножке стола: выходит из петли с той стороны, где стол
    const A = m.legs[work].ankle;
    A.updateWorldMatrix(true, false);
    const local = A.worldToLocal(anchor.clone()).sub(LOOP_C);
    const ang = Math.atan2(local.y / LOOP_H, local.x / LOOP_W);
    const exit = A.localToWorld(new LoopCurve().getPoint(ang / (Math.PI * 2) + (ang < 0 ? 1 : 0)).add(LOOP_C));
    const to = anchor.clone().add(exit.clone().sub(anchor).setY(0).normalize().multiplyScalar(0.035));
    strip.position.copy(exit).add(to).multiplyScalar(0.5);
    strip.scale.set(1, exit.distanceTo(to), 1);
    strip.quaternion.setFromUnitVectors(v3(0, 1, 0), to.clone().sub(exit).normalize());
    if (labels.band) labels.band.set(exit.clone().lerp(to, 0.55));
  },
};

export default pose;
