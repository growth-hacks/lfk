// Кисть перед собой, ладонью к лицу: большой палец, хват, эспандер с петлями, резинка на большой палец.
// Стоим ровно, работает левая кисть, правая рука висит.
//   thumb   — касаешься кончиком большого пальца каждого пальца, потом отводишь его в сторону (разминка)
//   grip    — сжимаешь мягкий мяч и держишь 3 с
//   fingers — эспандер с петлями: раскрываешь ладонь и разводишь пальцы против резинок
//   band    — резинка вокруг пальцев: отводишь большой палец в сторону против неё
import * as THREE from 'three';
import { ball } from '../props.js';
import { ease, holdLevel, mix, v3 } from './_kit.js';
import { WORK, WS, handQuat, hang } from './_hand.js';

const WRIST = v3(-0.1, 1.12, -0.3);
const EYES = v3(0, 1.6, -0.08);
const ORDER = ['index', 'middle', 'ring', 'pinky'];
const s = WS;

const Z = v3(0, 0, 1);
const OUT = 0.0058; // резинка лежит снаружи пальца: радиус резинки + зазор

// Точка снаружи фаланги: k — доля длины от начала, сторона — ладонная (+1) или тыльная (−1).
function onPhalanx(p, k, side = 1, extra = 0) {
  return p.a.clone().lerp(p.b, k).add(p.palmar.clone().multiplyScalar(side * (p.r + OUT + extra)));
}

// Трубка по точкам; старую убираем, чтобы не копились.
function retube(parent, old, points, closed, radius, mat) {
  if (old) { old.geometry.dispose(); old.parent?.remove(old); }
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, closed ? 160 : 60, radius, 8, closed), mat);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function makeFront(kind) {
  let theBall = null;
  let cords = [];
  let rings = [];
  let hub = null;
  let loop = null;
  let bandMat = null;
  return {
    legend: {
      thumb: 'Большой палец по очереди касается кончиков пальцев, потом отходит в сторону.',
      grip: 'Мяч в ладони: сжимаешь, держишь 3 секунды, отпускаешь. Мяч сплющивается.',
      fingers: 'Эспандер застёгнут на кисти, петли надеты на пальцы. Ладонь раскрывается, пальцы расходятся — резинки растягиваются.',
      band: 'Красная резинка восьмёркой: одна петля на четырёх пальцах, другая на большом. Большой палец уходит от остальных — резинка между ними натягивается.',
    }[kind],
    views: {
      fp: { label: 'Как видишь ты', pos: [EYES.x - 0.02, EYES.y, EYES.z], target: [-0.1, 1.2, -0.33], fov: 30, firstPerson: true },
      front: { label: 'Спереди', pos: [-0.12, 1.25, -1.05], target: [-0.1, 1.2, -0.3], fov: 26 },
      side: { label: 'Сбоку', pos: [-0.95, 1.25, -0.32], target: [-0.1, 1.2, -0.3], fov: 26 },
    },
    setup(m, scene) {
      // при повторном заходе на страницу всё создаём заново
      cords = [null, null, null, null, null];
      rings = [];
      loop = null;
      bandMat = new THREE.MeshStandardMaterial({ color: kind === 'band' ? 0xb8433a : 0x2f5f52, roughness: 0.55 });
      if (kind === 'grip') {
        theBall = ball(0.03);
        m.arms[WORK].hand.group.add(theBall);
      }
      if (kind === 'fingers') {
        // петли на ногтевых фалангах: чуть шире пальца, надеты на него
        const H = m.arms[WORK].hand;
        H.setFingers({ all: [0, 0, 0] });
        const radii = [...ORDER.map((n) => H.phalanx(n, 2).r), 0.0105];
        radii.forEach((r) => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.0026, 0.0024, 10, 28), bandMat);
          ring.castShadow = true;
          H.group.add(ring);
          rings.push(ring);
        });
        // ремешок на липучке вокруг ладони у запястья
        hub = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.006, 10, 40), bandMat);
        hub.rotation.x = Math.PI / 2;
        hub.scale.set(0.42, 1, 1);
        hub.position.set(0, -0.022, 0);
        m.arms[WORK].hand.group.add(hub);
      }
    },
    pose(m, st) {
      m.reset();
      hang(m, 'R');
      const H = m.arms[WORK].hand;
      // ладонь смотрит на глаза, пальцы вверх
      const palm = EYES.clone().sub(v3(-0.1, 1.2, -0.33)).normalize();
      m.arm(WORK, WRIST, { pole: v3(-0.6, 0.7, 0.1), hand: handQuat(s, v3(0.12, 1, -0.35), palm) });

      if (kind === 'thumb') {
        // фаза 0 (3 с): касания по очереди; фаза 1: отводим в сторону
        const relaxed = { all: [6, 8, 4] };
        if (st.phase === 0) {
          const x = Math.min(3.999, Math.max(0, Number.isFinite(st.u) ? st.u : 0) * 4);
          const i = Math.floor(x);
          const f = x - i;
          // палец, которого касаемся, сгибается навстречу
          const angles = { ...relaxed };
          const bend = Math.sin(Math.PI * Math.min(1, f * 1.25));
          angles[ORDER[i]] = [mix(6, 45 + i * 4, bend), mix(8, 55, bend), mix(4, 30, bend)];
          H.setFingers(angles);
          const tip = H.fingertip(ORDER[i]).add(v3(-s * 0.012, 0, 0));
          const prev = i === 0 ? v3(-s * 0.004, -0.06, -0.075) : H.fingertip(ORDER[i - 1]).add(v3(-s * 0.012, 0, 0));
          const e = ease(Math.min(1, f * 2));
          const target = prev.lerp(tip, e).add(v3(-s * 0.02 * Math.sin(Math.PI * e), 0, 0));
          H.thumbTo(target, { curl: 18 });
        } else {
          H.setFingers(relaxed);
          const from = H.fingertip('pinky').add(v3(-s * 0.012, 0, 0));
          const to = v3(-s * 0.004, -0.055, -0.1);
          H.thumbTo(from.lerp(to, ease(st.u)), { curl: 6 });
        }
      }

      if (kind === 'grip') {
        // мяч лежит в ладони, пальцы обхватывают его снаружи; при сжатии мяч сплющивается, а не проходит сквозь пальцы
        const k = holdLevel(st, { rise: 0.6, fall: 0.6, rest: 0 });
        H.setFingers({ all: [mix(40, 50, k), mix(50, 62, k), mix(30, 38, k)] });
        const sq = mix(1, 0.74, k);
        theBall.scale.set(sq, mix(1, 0.88, k), 1 + (1 - sq) * 0.45);
        theBall.position.set(-s * (0.015 + 0.03 * sq), -0.08, 0);
        H.thumbTo(v3(-s * (0.015 + 0.03 * sq), -0.072, -0.03 * (1 + (1 - sq) * 0.45) - 0.012), { curl: mix(12, 22, k) });
      }

      if (kind === 'fingers') {
        // натяжение — на раскрытии: резинки от ремешка у запястья к кончикам пальцев удлиняются
        const k = st.phase === 0 ? ease(st.u) : 1 - ease(st.u);
        H.setFingers({ all: [mix(38, 0, k), mix(48, 2, k), mix(26, 0, k)], spread: mix(0, 22, k) });
        H.thumbTo(v3(-s * mix(0.03, 0.004, k), mix(-0.07, -0.06, k), mix(-0.045, -0.1, k)), { curl: mix(22, 4, k) });
        // петля надета на ногтевую фалангу; резинка идёт от ремешка по ладони и по пальцу снаружи, не сквозь него
        const zs = [-0.03, -0.01, 0.01, 0.029];
        const palmSide = -s * 0.0225; // поверхность ладони + резинка
        ORDER.forEach((n, i) => {
          const p0 = H.phalanx(n, 0);
          const p1 = H.phalanx(n, 1);
          const p2 = H.phalanx(n, 2);
          const ringC = p2.a.clone().lerp(p2.b, 0.55);
          rings[i].position.copy(ringC);
          rings[i].quaternion.setFromUnitVectors(Z, p2.b.clone().sub(p2.a).normalize());
          const pts = [
            v3(palmSide, -0.024, zs[i]), v3(palmSide, -0.055, zs[i]), v3(palmSide + s * 0.002, -0.084, zs[i]),
            onPhalanx(p0, 0.4), onPhalanx(p0, 0.85), onPhalanx(p1, 0.4), onPhalanx(p1, 0.9), onPhalanx(p2, 0.3),
            ringC.clone().add(p2.palmar.clone().multiplyScalar(p2.r + 0.0026)),
          ];
          cords[i] = retube(H.group, cords[i], pts, false, 0.0021, bandMat);
        });
        // большой палец
        const t1 = H.thumbPhalanx(1);
        const t2 = H.thumbPhalanx(2);
        const tRing = t2.a.clone().lerp(t2.b, 0.55);
        rings[4].position.copy(tRing);
        rings[4].quaternion.setFromUnitVectors(Z, t2.b.clone().sub(t2.a).normalize());
        const tPts = [
          v3(palmSide, -0.024, -0.042), onPhalanx(t1, 0.2), onPhalanx(t1, 0.75), onPhalanx(t2, 0.3),
          tRing.clone().add(t2.palmar.clone().multiplyScalar(t2.r + 0.0026)),
        ];
        cords[4] = retube(H.group, cords[4], tPts, false, 0.0021, bandMat);
      }

      if (kind === 'band') {
        // канцелярская резинка восьмёркой: петля вокруг четырёх пальцев, петля вокруг большого, между ними — натяжение
        const k = st.phase === 0 ? ease(st.u) : 1 - ease(st.u);
        H.setFingers({ all: [4, 5, 3] });
        H.thumbTo(v3(-s * mix(0.006, 0.002, k), mix(-0.07, -0.058, k), mix(-0.05, -0.108, k)), { curl: 6 });
        // петля вокруг четырёх пальцев на середине основных фаланг — снаружи каждого пальца
        const P = ORDER.map((n) => H.phalanx(n, 0));
        const mid = (p) => p.a.clone().lerp(p.b, 0.5);
        const around = (p, dir, extra = 0) => mid(p).add(dir.clone().multiplyScalar(p.r + OUT + extra));
        const idx = P[0];
        const pk = P[3];
        const pts = [];
        pts.push(around(idx, idx.side.clone().negate(), 0.001)); // со стороны большого пальца
        P.forEach((p) => pts.push(around(p, p.palmar.clone().negate()))); // по тыльной стороне
        pts.push(around(pk, pk.side, 0.001)); // вокруг мизинца
        [...P].reverse().forEach((p) => pts.push(around(p, p.palmar))); // по ладонной стороне
        // переход к большому пальцу и петля вокруг его основной фаланги
        const t = H.thumbPhalanx(1);
        const tc = t.a.clone().lerp(t.b, 0.5);
        const axis = t.b.clone().sub(t.a).normalize();
        const toIdx = mid(idx).sub(tc);
        toIdx.sub(axis.clone().multiplyScalar(toIdx.dot(axis))).normalize();
        const bin = new THREE.Vector3().crossVectors(axis, toIdx).normalize();
        const tr = t.r + OUT + 0.001;
        for (let j = 1; j < 12; j++) {
          const a = (j / 12) * Math.PI * 2;
          pts.push(tc.clone().add(toIdx.clone().multiplyScalar(Math.cos(a) * tr)).add(bin.clone().multiplyScalar(Math.sin(a) * tr)));
        }
        loop = retube(H.group, loop, pts, true, 0.0026, bandMat);
      }
    },
  };
}
