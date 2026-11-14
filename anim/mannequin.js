// Манекен из простых объёмных деталей, как деревянный манекен художника.
// Единицы — метры. Человек стоит лицом к −Z, его правая сторона — +X, пол — y = 0.
// Внешние 3D-модели не нужны: всё собирается из капсул, сфер и сечений.
//
// Иерархия: root → pelvis (таз) → spine (корпус: грудь, плечи, шея, голова, руки) и бёдра → колени → голеностопы → стопы.
// Позы задаются точками через twoBone (ik.js): куда поставить стопу или кисть.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { twoBone, setWorldQuat } from './ik.js';
import { createFoot } from './foot.js';

const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

export const COLORS = {
  body: 0xe0ccb1,   // светлое дерево
  palm: 0xf4e9da,   // ладонь на тон светлее, как у настоящей руки: на раскрытой кисти видно, где ладонь
  metal: 0x3a4246,  // гантель
  cue: 0xe0761c,    // оранжевым — то, на что смотреть
};

function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...extra });
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sphere(r, mat) {
  return shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat));
}

// Капсула вдоль локальной −Y от сустава: так удобно вешать сегменты в цепочку.
function limbDown(length, r, mat) {
  const mesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r, length, 6, 16), mat));
  mesh.position.y = -length / 2;
  return mesh;
}

// Капсула между двумя точками (в координатах родителя).
export function capsuleBetween(a, b, r, mat) {
  const len = Math.max(a.distanceTo(b), 0.0001);
  const mesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat));
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return mesh;
}

// ---------- кисть ----------
// Система координат кисти (в нейтрали «большой палец сверху» при согнутом локте):
//   −Y — к кончикам пальцев, −Z — сторона большого и указательного пальцев,
//   ладонь смотрит в −s·X (к середине тела), тыльная сторона — в +s·X.
// s = +1 для правой руки, −1 для левой.

const FINGERS = [
  { name: 'index', z: -0.030, lens: [0.043, 0.026, 0.020], r: 0.0098 },
  { name: 'middle', z: -0.010, lens: [0.047, 0.028, 0.021], r: 0.0100 },
  { name: 'ring', z: 0.010, lens: [0.044, 0.027, 0.020], r: 0.0095 },
  { name: 'pinky', z: 0.029, lens: [0.035, 0.021, 0.018], r: 0.0085 },
];

function createHand(s, M) {
  const group = new THREE.Group();

  const palm = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.09, 0.084, 3, 0.012), M.body));
  palm.position.set(0, -0.047, 0);
  group.add(palm);

  // Ладонь светлее тыльной стороны. Накладка у основания ладони: его видно даже в кулаке.
  const pad = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.008, 0.07, 0.074, 2, 0.003), M.palm));
  pad.position.set(-s * 0.0135, -0.043, 0);
  group.add(pad);

  // Пальцы — цепочки суставов: костяшка → средний сустав → ногтевой.
  const fingers = {};
  for (const f of FINGERS) {
    const joints = [];
    let parent = group;
    let pos = new THREE.Vector3(s * 0.004, -0.088, f.z);
    f.lens.forEach((len, i) => {
      const j = new THREE.Group();
      j.position.copy(pos);
      j.add(limbDown(len, f.r * (1 - i * 0.07), M.body));
      parent.add(j);
      joints.push(j);
      parent = j;
      pos = new THREE.Vector3(0, -len, 0);
    });
    fingers[f.name] = joints;
  }

  // Большой палец: две готовые позы. «grip» — лежит поверх указательного и обхватывает ручку,
  // «open» — вытянут вдоль указательного, как у расслабленной раскрытой кисти.
  const THUMB = {
    grip: [[-0.004, -0.018, -0.036], [-0.030, -0.052, -0.047], [-0.050, -0.074, -0.047], [-0.049, -0.095, -0.045]],
    open: [[-0.004, -0.018, -0.036], [-0.014, -0.050, -0.052], [-0.020, -0.074, -0.056], [-0.022, -0.095, -0.057]],
  };
  const thumbR = [0.0135, 0.0115, 0.0105];
  const thumbs = {};
  for (const [name, raw] of Object.entries(THUMB)) {
    const pts = raw.map(([x, y, z]) => new THREE.Vector3(s * x, y, z));
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(capsuleBetween(pts[i], pts[i + 1], thumbR[i], M.body));
    g.visible = name === 'grip';
    group.add(g);
    thumbs[name] = g;
  }
  // «ik» — большой палец с суставами: ставится кончиком в любую точку (к пальцу, на мяч, в сторону).
  const thumbIK = new THREE.Group();
  thumbIK.visible = false;
  group.add(thumbIK);
  const tBase = new THREE.Group();
  tBase.position.set(-s * 0.004, -0.018, -0.036);
  tBase.add(limbDown(0.046, thumbR[0], M.body));
  const tMid = new THREE.Group();
  tMid.position.y = -0.046;
  tMid.add(limbDown(0.033, thumbR[1], M.body));
  const tTip = new THREE.Group();
  tTip.position.y = -0.033;
  tTip.add(limbDown(0.026, thumbR[2], M.body));
  tMid.add(tTip);
  tBase.add(tMid);
  thumbIK.add(tBase);
  thumbs.ik = thumbIK;

  function setThumb(name) {
    for (const [k, g] of Object.entries(thumbs)) g.visible = k === name;
  }

  // Кончик большого пальца — в точку target (координаты кисти). Сустав выгибается наружу, к тыльной стороне.
  function thumbTo(target, { curl = 10 } = {}) {
    setThumb('ik');
    group.updateWorldMatrix(true, true);
    const tw = group.localToWorld(target.clone());
    const pole = group.localToWorld(new THREE.Vector3(s * 0.05, -0.03, -0.07));
    tTip.rotation.set(curl * DEG, 0, 0);
    twoBone(tBase, tMid, tw, pole, 0.046, 0.057, 1);
  }

  // Сгибание пальцев, градусы: [костяшка, средний сустав, ногтевой]; spread — развести пальцы веером.
  const SPREAD = { index: 1, middle: 0.35, ring: -0.35, pinky: -1 };
  function setFingers(angles) {
    for (const f of FINGERS) {
      const a = angles[f.name] || angles.all || [0, 0, 0];
      fingers[f.name].forEach((j, i) => { j.rotation.set(0, 0, -s * a[i] * DEG); });
      fingers[f.name][0].rotation.x = (angles.spread || 0) * SPREAD[f.name] * DEG;
    }
  }

  // Кончик пальца в координатах кисти (подушечка, чуть к ладони).
  function fingertip(name) {
    const f = FINGERS.find((x) => x.name === name);
    const last = fingers[name][2];
    group.updateWorldMatrix(true, true);
    const w = last.localToWorld(new THREE.Vector3(-s * f.r * 0.8, -f.lens[2], 0));
    return group.worldToLocal(w);
  }

  // Сустав пальца (0 — костяшка, 1 — средний, 2 — ногтевой) в координатах кисти.
  function jointLocal(name, i) {
    group.updateWorldMatrix(true, true);
    return group.worldToLocal(fingers[name][i].getWorldPosition(new THREE.Vector3()));
  }
  // Кончик большого пальца (режим ik) в координатах кисти.
  function thumbTipLocal() {
    group.updateWorldMatrix(true, true);
    return group.worldToLocal(tTip.localToWorld(new THREE.Vector3(0, -0.026, 0)));
  }

  // Суставы большого пальца (0 — основание, 1 — средний, 2 — ногтевой) в координатах кисти.
  function thumbJointLocal(i) {
    group.updateWorldMatrix(true, true);
    return group.worldToLocal([tBase, tMid, tTip][i].getWorldPosition(new THREE.Vector3()));
  }

  // Фаланга пальца в координатах кисти: начало a, конец b, радиус r и направления —
  // palmar (к ладонной стороне фаланги) и side (к мизинцу). Для резинок и петель, чтобы они шли снаружи пальца.
  const toLocalDir = (obj, d) => {
    const p0 = group.worldToLocal(obj.getWorldPosition(new THREE.Vector3()));
    return group.worldToLocal(obj.localToWorld(d.clone())).sub(p0).normalize();
  };
  function phalanx(name, i) {
    const f = FINGERS.find((x) => x.name === name);
    const j = fingers[name][i];
    group.updateWorldMatrix(true, true);
    const a = group.worldToLocal(j.getWorldPosition(new THREE.Vector3()));
    const b = group.worldToLocal(j.localToWorld(new THREE.Vector3(0, -f.lens[i], 0)));
    return { a, b, r: f.r * (1 - i * 0.07), palmar: toLocalDir(j, new THREE.Vector3(-s, 0, 0)), side: toLocalDir(j, new THREE.Vector3(0, 0, 1)) };
  }
  const THUMB_LENS = [0.046, 0.033, 0.026];
  function thumbPhalanx(i) {
    const j = [tBase, tMid, tTip][i];
    group.updateWorldMatrix(true, true);
    const a = group.worldToLocal(j.getWorldPosition(new THREE.Vector3()));
    const b = group.worldToLocal(j.localToWorld(new THREE.Vector3(0, -THUMB_LENS[i], 0)));
    return { a, b, r: thumbR[i], palmar: toLocalDir(j, new THREE.Vector3(0, 0, -1)), side: toLocalDir(j, new THREE.Vector3(1, 0, 0)) };
  }

  return { group, palm, pad, fingers, setFingers, setThumb, thumbTo, fingertip, jointLocal, thumbTipLocal, thumbJointLocal, phalanx, thumbPhalanx };
}

// Кулак вокруг ручки гантели (ручка вдоль Z кисти).
export const GRIP = { all: [55, 80, 40] };
// Расслабленная раскрытая кисть.
export const RELAXED = { all: [12, 16, 8] };

// Гантель, которую держат за один конец: кулак у ближнего диска, дальний диск торчит над большим пальцем.
// centered: true — обычный хват посередине ручки. Ставится в систему координат кисти.
export function createDumbbell(s, M, { centered = false } = {}) {
  const g = new THREE.Group();
  g.position.set(-s * 0.03, -0.088, 0);
  if (centered) {
    const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.16, 16), M.metal));
    handle.rotation.x = Math.PI / 2;
    g.add(handle);
    for (const z of [0.08, -0.08]) {
      const plate = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.026, 6), M.metal));
      plate.rotation.x = Math.PI / 2;
      plate.position.z = z;
      g.add(plate);
    }
    return g;
  }
  const handleFrom = 0.052;  // у мизинца
  const handleTo = -0.13;    // над большим пальцем
  const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, handleFrom - handleTo, 16), M.metal));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = (handleFrom + handleTo) / 2;
  g.add(handle);
  for (const z of [0.066, -0.128]) {
    const plate = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.028, 6), M.metal));
    plate.rotation.x = Math.PI / 2;
    plate.position.z = z;
    g.add(plate);
  }
  // Центр дальнего диска в системе кисти — нужен, чтобы нарисовать дугу его пути.
  g.userData.farPlate = new THREE.Vector3(-s * 0.03, -0.088, -0.128);
  return g;
}

// ---------- рука ----------
const UPPER_ARM = 0.29;
const FOREARM = 0.25;

function createArm(s, M) {
  const shoulder = new THREE.Group();
  shoulder.position.set(s * 0.195, 0.48, 0);
  shoulder.add(sphere(0.054, M.body));
  shoulder.add(limbDown(UPPER_ARM, 0.043, M.body));

  const elbow = new THREE.Group();
  elbow.position.set(0, -UPPER_ARM, 0);
  elbow.add(sphere(0.041, M.body));
  shoulder.add(elbow);

  // Ось предплечья — локальная Y группы twist: вокруг неё и идёт поворот ладонью вверх и вниз.
  const twist = new THREE.Group();
  elbow.add(twist);
  const forearm = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.028, FOREARM, 20), M.body));
  forearm.position.y = -FOREARM / 2;
  twist.add(forearm);

  const wrist = new THREE.Group();
  wrist.position.set(0, -FOREARM, 0);
  wrist.add(sphere(0.027, M.body));
  twist.add(wrist);

  const hand = createHand(s, M);
  wrist.add(hand.group);

  // Поза в градусах. Ноль — рука висит вдоль тела, ладонь смотрит на бедро.
  // elbowFlex 90 — предплечье вперёд; supination +90 — ладонь вверх, −90 — ладонь вниз.
  function set({ shoulderFlex = 0, shoulderAbd = 0, shoulderIn = -3, elbowFlex = 0, supination = 0, wristFlex = 0, wristDev = 0 } = {}) {
    shoulder.rotation.set(shoulderFlex * DEG, 0, s * (shoulderAbd + shoulderIn) * DEG);
    elbow.rotation.set(elbowFlex * DEG, 0, 0);
    twist.rotation.set(0, -s * supination * DEG, 0);
    wrist.rotation.set(wristDev * DEG, 0, -s * wristFlex * DEG);
  }

  return { s, shoulder, elbow, twist, wrist, hand, set };
}

// ---------- нога ----------
const THIGH = 0.41;
const SHIN = 0.41;
export const ANKLE_H = 0.08; // высота голеностопа над полом, когда стопа стоит ровно

function createLeg(s, M) {
  const hip = new THREE.Group();
  hip.position.set(s * 0.092, -0.03, 0);
  hip.add(sphere(0.07, M.body));
  const thigh = limbDown(THIGH - 0.01, 0.062, M.body);
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.position.set(0, -THIGH, 0);
  knee.add(sphere(0.052, M.body));
  const shin = limbDown(SHIN - 0.01, 0.048, M.body);
  knee.add(shin);
  hip.add(knee);
  const ankle = new THREE.Group();
  ankle.position.set(0, -SHIN, 0);
  ankle.add(sphere(0.034, M.body));
  const foot = createFoot(s, M);
  ankle.add(foot.group);
  knee.add(ankle);
  return { s, hip, knee, ankle, foot, thigh, shin };
}

// ---------- весь манекен ----------
export function createMannequin() {
  const M = {
    body: material(COLORS.body),
    palm: material(COLORS.palm, { roughness: 0.8 }),
    metal: material(COLORS.metal, { roughness: 0.42, metalness: 0.3 }),
    cue: material(COLORS.cue, { roughness: 0.5, emissive: COLORS.cue, emissiveIntensity: 0.25 }),
    glow: new THREE.MeshStandardMaterial({ color: COLORS.cue, emissive: COLORS.cue, emissiveIntensity: 0.35, transparent: true, opacity: 0.5, depthWrite: false }),
    // светло-оранжевый — часть тела, которая двигается (пальцы в йоге, в разведении)
    move: material(0xf0a25c, { roughness: 0.6, emissive: 0xe0761c, emissiveIntensity: 0.12 }),
    // полупрозрачный «призрак» исходного положения
    ghost: new THREE.MeshStandardMaterial({ color: 0x56665e, transparent: true, opacity: 0.38, depthWrite: false, roughness: 1 }),
  };
  const root = new THREE.Group();

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.93, 0);
  root.add(pelvis);
  const pelvisMesh = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.05, 8, 24), M.body));
  pelvisMesh.scale.set(1, 1, 0.72);
  pelvis.add(pelvisMesh);

  const spine = new THREE.Group();
  spine.position.set(0, 0.02, 0);
  pelvis.add(spine);
  const torso = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.36, 8, 28), M.body));
  torso.scale.set(1, 1, 0.6);
  torso.position.set(0, 0.22, 0);
  const shoulders = capsuleBetween(new THREE.Vector3(-0.17, 0.485, 0), new THREE.Vector3(0.17, 0.485, 0), 0.058, M.body);
  shoulders.scale.set(1, 1, 0.8);
  const neck = capsuleBetween(new THREE.Vector3(0, 0.52, 0), new THREE.Vector3(0, 0.60, 0), 0.045, M.body);
  const head = sphere(0.105, M.body);
  head.scale.set(1, 1.12, 1.02);
  head.position.set(0, 0.70, 0);
  spine.add(torso, shoulders, neck, head);

  const arms = { R: createArm(1, M), L: createArm(-1, M) };
  spine.add(arms.R.shoulder, arms.L.shoulder);
  const legs = { R: createLeg(1, M), L: createLeg(-1, M) };
  pelvis.add(legs.R.hip, legs.L.hip);

  const m = { root, materials: M, pelvis, spine, torso, head, neck, arms, legs };

  // Вернуть всё в «стоит прямо, руки вдоль тела».
  m.reset = () => {
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    pelvis.position.set(0, 0.93, 0);
    pelvis.rotation.set(0, 0, 0);
    spine.rotation.set(0, 0, 0);
    for (const arm of Object.values(arms)) arm.set({});
    for (const leg of Object.values(legs)) {
      leg.hip.rotation.set(0, 0, 0);
      leg.knee.rotation.set(0, 0, 0);
      leg.ankle.rotation.set(0, 0, 0);
      for (let i = 0; i < 5; i++) leg.foot.setToe(i);
    }
  };

  // Поставить голеностоп в точку мира. pitch — наклон стопы (минус — пятка поднята), toesUp — пальцы относительно стопы.
  m.leg = (side, ankle, { pole, pitch = 0, yaw = 0, toesUp = 0 } = {}) => {
    const leg = legs[side];
    root.updateWorldMatrix(true, true);
    const hipW = leg.hip.getWorldPosition(new THREE.Vector3());
    const p = pole || hipW.clone().add(ankle).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, -1));
    twoBone(leg.hip, leg.knee, ankle, p, THIGH, SHIN, -1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * DEG, yaw * DEG, 0, 'YXZ'));
    setWorldQuat(leg.ankle, q);
    for (let i = 0; i < 5; i++) leg.foot.setToe(i, { up: toesUp });
  };

  // Поставить запястье в точку мира; pole — куда смотрит локоть.
  m.arm = (side, wrist, { pole, hand } = {}) => {
    const arm = arms[side];
    root.updateWorldMatrix(true, true);
    const shW = arm.shoulder.getWorldPosition(new THREE.Vector3());
    const p = pole || shW.clone().add(wrist).multiplyScalar(0.5).add(new THREE.Vector3(arm.s * 0.6, -0.6, 0.4));
    arm.twist.rotation.set(0, 0, 0);
    twoBone(arm.shoulder, arm.elbow, wrist, p, UPPER_ARM, FOREARM, 1);
    if (hand) setWorldQuat(arm.wrist, hand);
  };

  return m;
}

export { DEG };
