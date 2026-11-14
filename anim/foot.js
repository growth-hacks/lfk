// Стопа манекена: тело стопы собрано из сечений (как лодка из шпангоутов), пальцы — отдельные суставы.
// Свод на внутренней стороне можно поднять «куполом» (короткая стопа), пальцы — поднимать, прижимать и разводить.
// Система координат — как у голеностопа: стопа смотрит в −Z, подошва на y ≈ −0.078, внутренняя сторона — −s·X.

import * as THREE from 'three';

const RINGS = 34;
const SEG = 28;
const Z_HEEL = 0.068;
const Z_FRONT = -0.138;

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Профиль стопы вдоль длины: k = 0 у пятки, 1 у плюсны.
function profile(k) {
  const width = k < 0.12 ? lerp(0.040, 0.062, smooth(0, 0.12, k)) : lerp(0.062, 0.098, smooth(0.15, 0.95, k));
  const top = lerp(-0.008, -0.050, smooth(0.25, 1.0, k)) - (k < 0.1 ? (0.1 - k) * 0.35 : 0);
  const bottom = -0.078 + (k < 0.06 ? (0.06 - k) * 0.25 : 0) + (k > 0.97 ? (k - 0.97) * 0.6 : 0);
  return { width, top, bottom };
}
// Высота свода: на внутренней стороне в средней части стопы.
function archAt(k) { return smooth(0.18, 0.42, k) * (1 - smooth(0.62, 0.86, k)); }

export function createFoot(s, materials) {
  const group = new THREE.Group();
  const geom = new THREE.BufferGeometry();
  const count = RINGS * SEG + 2;
  const pos = new Float32Array(count * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let r = 0; r < RINGS - 1; r++) {
    for (let i = 0; i < SEG; i++) {
      const a = r * SEG + i;
      const b = r * SEG + ((i + 1) % SEG);
      const c = (r + 1) * SEG + i;
      const d = (r + 1) * SEG + ((i + 1) % SEG);
      idx.push(a, c, b, b, c, d);
    }
  }
  const heelC = RINGS * SEG;
  const frontC = heelC + 1;
  for (let i = 0; i < SEG; i++) {
    const a = i;
    const b = (i + 1) % SEG;
    idx.push(heelC, a, b);
    const c = (RINGS - 1) * SEG + i;
    const d = (RINGS - 1) * SEG + ((i + 1) % SEG);
    idx.push(frontC, d, c);
  }
  geom.setIndex(idx);
  const body = new THREE.Mesh(geom, materials.body);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  let dome = -1;
  function build(d) {
    for (let r = 0; r < RINGS; r++) {
      const k = r / (RINGS - 1);
      const z = lerp(Z_HEEL, Z_FRONT + 0.008 * d, k);
      const { width, top, bottom } = profile(k);
      const cx = -s * 0.006 * smooth(0.4, 1, k);
      const archBase = 0.010 + 0.032 * d; // обычный свод и «купол»
      const mid = (top + bottom) / 2;
      const hh = (top - bottom) / 2;
      for (let i = 0; i < SEG; i++) {
        const th = (i / SEG) * Math.PI * 2;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        let x = cx + (width / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.55);
        let y = mid + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 0.55);
        if (sn < 0) {
          const medial = Math.min(1, Math.max(0, (-s * (x - cx)) / (width / 2) + 0.15));
          y += archBase * archAt(k) * medial * Math.pow(Math.abs(sn), 0.4);
          y += 0.004 * d * archAt(k); // вся середина чуть выше
          y = Math.min(y, mid - 0.006); // свод не прорезает стопу насквозь
        }
        const o = (r * SEG + i) * 3;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
      }
    }
    const h = profile(0);
    pos.set([0, (h.top + h.bottom) / 2, Z_HEEL + 0.004], heelC * 3);
    const f = profile(1);
    pos.set([-s * 0.006, (f.top + f.bottom) / 2, Z_FRONT + 0.008 * d - 0.004], frontC * 3);
    geom.attributes.position.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
  }

  // Пальцы: от большого (внутренний край) к мизинцу.
  const TOES = [
    { x: -0.033, z: -0.128, lens: [0.030, 0.024], r: 0.0135 },
    { x: -0.011, z: -0.134, lens: [0.022, 0.016], r: 0.0088 },
    { x: 0.007, z: -0.130, lens: [0.020, 0.015], r: 0.0082 },
    { x: 0.023, z: -0.122, lens: [0.018, 0.014], r: 0.0076 },
    { x: 0.037, z: -0.110, lens: [0.016, 0.012], r: 0.0070 },
  ];
  // Палец лежит на полу: центр капсулы на высоте радиуса над подошвой, палец горизонтален.
  const SOLE = -0.078;
  function makeToe(t, mat) {
    const base = new THREE.Group();
    base.rotation.order = 'YXZ';
    base.position.set(s * t.x, SOLE + t.r + 0.0005, t.z);
    const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(t.r, t.lens[0], 5, 12), mat);
    seg1.position.y = -t.lens[0] / 2;
    const tip = new THREE.Group();
    tip.position.y = -t.lens[0];
    const r2 = t.r * 0.92;
    const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(r2, t.lens[1], 5, 12), mat);
    seg2.position.set(0, -t.lens[1] / 2, t.r - r2); // кончик тоже касается пола
    tip.add(seg2);
    base.add(seg1, tip);
    base.rotation.set(Math.PI / 2, 0, 0);
    return { base, tip, segs: [seg1, seg2], spec: t };
  }
  const toes = TOES.map((t) => {
    const toe = makeToe(t, materials.body);
    toe.segs.forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
    group.add(toe.base);
    return toe;
  });

  // up — подъём пальца вверх в градусах (вниз под пол палец не уходит), spread — развести в стороны.
  function setToe(i, { up = 0, spread = 0, curl = 0 } = {}) {
    const t = toes[i];
    const DEG = Math.PI / 180;
    t.base.position.z = t.spec.z + 0.008 * dome;
    t.base.rotation.set(Math.PI / 2 + Math.max(0, up) * DEG, s * spread * DEG, 0);
    t.tip.rotation.x = -curl * DEG;
  }

  // Цвет пальца: чтобы подсветить те, что двигаются.
  function tintToe(i, mat) { toes[i].segs.forEach((m) => { m.material = mat || materials.body; }); }

  // Полупрозрачные «призраки» пальцев в исходном положении — видно, куда палец ушёл.
  function addGhostToes(mat) {
    const g = new THREE.Group();
    TOES.forEach((t) => { const toe = makeToe(t, mat); toe.segs.forEach((m) => { m.renderOrder = 1; }); g.add(toe.base); });
    group.add(g);
    return g;
  }

  function setDome(d) {
    if (Math.abs(d - dome) < 1e-3) return;
    dome = d;
    build(d);
    toes.forEach((_, i) => { toes[i].base.position.z = toes[i].spec.z + 0.008 * d; });
  }

  setDome(0);
  for (let i = 0; i < 5; i++) setToe(i);

  // Полупрозрачная копия тела стопы в исходной форме — для сравнения с «куполом».
  function addGhostBody(mat) {
    const ghost = new THREE.Mesh(geom.clone(), mat);
    const saved = dome;
    // строим исходную форму во временную геометрию
    build(0);
    ghost.geometry.copy(geom);
    build(saved < 0 ? 0 : saved);
    ghost.renderOrder = 1;
    group.add(ghost);
    return ghost;
  }

  return { group, body, toes, setToe, setDome, tintToe, addGhostToes, addGhostBody };
}
