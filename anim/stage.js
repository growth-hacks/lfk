// Сцена для анимации упражнения: рендер, свет, пол, камера с готовыми ракурсами и поворотом пальцем.
// Цвета фона и пола берутся из CSS-переменных контейнера (--stage, --floor), чтобы сцена жила в теме страницы.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createStage(container, { views = {}, view = Object.keys(views)[0] } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null; // WebGL нет — страница покажет запасную картинку
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.02, 20);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xbfae96, 1.5);
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(1.1, 3.2, 0.9);
  key.target.position.set(0, 1.0, -0.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -0.9, right: 0.9, top: 0.9, bottom: -0.9, near: 0.5, far: 6 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-1.6, 1.4, -1.4);
  scene.add(hemi, key, key.target, fill);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 72), new THREE.MeshStandardMaterial({ roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  function readTheme() {
    const cs = getComputedStyle(container);
    const bg = cs.getPropertyValue('--stage').trim() || '#e7eeea';
    const fl = cs.getPropertyValue('--floor').trim() || '#d3ddd8';
    scene.background = new THREE.Color(bg);
    floor.material.color.set(fl);
  }
  readTheme();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', readTheme);
  const themeObserver = new MutationObserver(readTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.7, zoomSpeed: 0.8, minDistance: 0.25, maxDistance: 3.2 });

  // Ракурсы: { pos: [x,y,z], target: [x,y,z], fov }
  let tween = null;
  let current = null;
  const viewListeners = [];
  // Камера может ехать вдоль X за тем, что двигается (доска на валике): сдвигаем камеру, цель и свет.
  const follow = new THREE.Vector3();
  function setFollow(x) {
    const d = x - follow.x;
    if (Math.abs(d) < 1e-6) return;
    follow.x = x;
    camera.position.x += d;
    controls.target.x += d;
    key.position.x += d;
    key.target.position.x += d;
    if (tween) { tween.fromPos.x += d; tween.fromTarget.x += d; tween.toPos.x += d; tween.toTarget.x += d; }
  }
  function setView(name, animate = true) {
    const v = views[name];
    if (!v) return;
    current = name;
    const toPos = new THREE.Vector3(...v.pos).add(follow);
    const toTarget = new THREE.Vector3(...v.target).add(follow);
    if (!animate) {
      camera.position.copy(toPos);
      controls.target.copy(toTarget);
      camera.fov = v.fov ?? 60;
      camera.updateProjectionMatrix();
      tween = null;
    } else {
      tween = { t: 0, dur: 0.7, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), fromFov: camera.fov, toPos, toTarget, toFov: v.fov ?? 60 };
    }
    viewListeners.forEach((fn) => fn(name));
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // Подписи-сноски: точка на теле или предмете, линия от неё к подписи у левого или правого края сцены.
  // Сама подпись не лежит на теле и не закрывает то, на что надо смотреть.
  const labelLayer = document.createElement('div');
  labelLayer.className = 'labels';
  container.appendChild(labelLayer);
  const SVG = 'http://www.w3.org/2000/svg';
  const leaders = document.createElementNS(SVG, 'svg');
  leaders.setAttribute('class', 'leaders');
  labelLayer.appendChild(leaders);
  const labels = [];
  const _p = new THREE.Vector3();
  function label(text) {
    const el = document.createElement('span');
    el.className = 'label3d';
    el.textContent = text;
    labelLayer.appendChild(el);
    const line = document.createElementNS(SVG, 'line');
    const dot = document.createElementNS(SVG, 'circle');
    dot.setAttribute('r', '3.5');
    leaders.append(line, dot);
    const l = { el, line, dot, w: 0, h: 0, text: '', pos: new THREE.Vector3(), visible: true, set(v) { this.pos.copy(v); return this; } };
    labels.push(l);
    return l;
  }
  const show = (l, on) => {
    const d = on ? '' : 'none';
    if (l.el.style.display === d) return;
    l.el.style.display = d;
    l.line.style.display = d;
    l.dot.style.display = d;
  };
  // Рамка вокруг человека на экране: подписи стараются лечь мимо неё — в свободную полосу под ним или над ним.
  // Кроме общей рамки — рамка каждой детали манекена: по ним видно, где у края сцены свободно.
  let subject = null;
  const _v = new THREE.Vector3();
  function subjectRects(w, h) {
    if (!subject) return null;
    const rects = [];
    const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    subject.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const { min, max } = o.geometry.boundingBox;
      const q = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
      for (let i = 0; i < 8; i += 1) {
        _v.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(o.matrixWorld).project(camera);
        if (_v.z > 1) continue;
        const x = ((_v.x + 1) / 2) * w;
        const y = ((1 - _v.y) / 2) * h;
        q.l = Math.min(q.l, x); q.r = Math.max(q.r, x); q.t = Math.min(q.t, y); q.b = Math.max(q.b, y);
      }
      if (q.l >= q.r) return;
      rects.push(q);
      box.l = Math.min(box.l, q.l); box.r = Math.max(box.r, q.r); box.t = Math.min(box.t, q.t); box.b = Math.max(box.b, q.b);
    });
    return rects.length ? { box, rects } : null;
  }
  const overlap = (x, y, l, rects) => {
    let s = 0;
    for (const q of rects) {
      const dx = Math.min(x + l.w, q.r) - Math.max(x, q.l);
      const dy = Math.min(y + l.h, q.b) - Math.max(y, q.t);
      if (dx > 0 && dy > 0) s += dx * dy;
    }
    return s;
  };

  const M = 8; // отступ от края сцены
  const TOP = 48; // сверху плашки фазы и стороны
  // Подписи в один-два ряда в полосе под человеком или над ним, каждая — под своей точкой, насколько можно.
  function placeInBand(list, box, w, h) {
    const rowH = Math.max(...list.map((l) => l.h)) + 4;
    const meanY = list.reduce((s, l) => s + l.ay, 0) / list.length;
    const bands = [
      { y0: box.b + 6, y1: h - M, down: true },
      { y0: TOP, y1: box.t - 6, down: false },
    ].filter((band) => band.y1 - band.y0 + 4 >= rowH)
      .sort((a, b) => Math.abs((a.y0 + a.y1) / 2 - meanY) - Math.abs((b.y0 + b.y1) / 2 - meanY));
    const sorted = [...list].sort((a, b) => a.ax - b.ax);
    for (const band of bands) {
      const nRows = Math.floor((band.y1 - band.y0 + 4) / rowH);
      const edge = band.down ? w - 56 : w - M; // внизу справа — значок паузы
      let row = 0;
      let right = M;
      for (const l of sorted) {
        const want = Math.min(Math.max(l.ax - l.w / 2, M), edge - l.w);
        let x = Math.max(want, right);
        if (x + l.w > edge) { row += 1; x = want; }
        l.x = x;
        l.row = row;
        right = x + l.w + 6;
      }
      if (row >= nRows) continue;
      for (const l of sorted) l.y = band.down ? band.y0 + l.row * rowH : band.y1 - (l.row + 1) * rowH + 4;
      return true;
    }
    return false;
  }
  // Запасной вариант, если полосы нет: подписи у левого и правого края. Высоту каждой подбираем так,
  // чтобы она меньше всего закрывала человека и точки, была поближе к своей точке и не прыгала от кадра к кадру.
  function placeInColumns(list, w, h, rects) {
    const dots = list.map((l) => ({ l: l.ax - 8, r: l.ax + 8, t: l.ay - 8, b: l.ay + 8 }));
    const paused = { l: w - 56, r: w, t: h - 60, b: h }; // значок паузы в правом нижнем углу
    const obstacles = rects.concat(dots, paused);
    const cols = [list.filter((l) => l.ax < w / 2), list.filter((l) => l.ax >= w / 2)];
    cols.forEach((col, right) => {
      col.sort((a, b) => a.ay - b.ay);
      let floorY = TOP;
      for (const l of col) {
        const x = right ? w - M - l.w : M;
        const hi = h - M - l.h;
        let best = Math.min(Math.max(l.ay - l.h / 2, floorY), hi);
        let bestCost = Infinity;
        for (let y = Math.min(floorY, hi); y <= hi; y += 3) {
          const cost = overlap(x, y, l, obstacles) + 4 * Math.abs(y + l.h / 2 - l.ay) + (l.y == null ? 0 : 3 * Math.abs(y - l.y));
          if (cost < bestCost) { bestCost = cost; best = y; }
        }
        floorY = best + l.h + 4;
        l.x = x;
        l.y = best;
      }
    });
  }
  function placeLabels() {
    if (labelLayer.hidden) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const list = [];
    for (const l of labels) {
      _p.copy(l.pos).project(camera);
      const on = l.visible && _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
      show(l, on);
      if (!on) continue;
      if (l.text !== l.el.textContent) { l.text = l.el.textContent; l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
      l.ax = ((_p.x + 1) / 2) * w;
      l.ay = ((1 - _p.y) / 2) * h;
      list.push(l);
    }
    if (!list.length) return;
    const s = subjectRects(w, h);
    if (!s || !placeInBand(list, s.box, w, h)) placeInColumns(list, w, h, s?.rects || []);
    for (const l of list) {
      l.el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
      // линия — от точки к ближайшему месту на краю подписи
      const ex = Math.min(Math.max(l.ax, l.x + 8), l.x + l.w - 8);
      const ey = Math.min(Math.max(l.ay, l.y), l.y + l.h);
      l.line.setAttribute('x1', l.ax.toFixed(1));
      l.line.setAttribute('y1', l.ay.toFixed(1));
      l.line.setAttribute('x2', ex.toFixed(1));
      l.line.setAttribute('y2', ey.toFixed(1));
      l.dot.setAttribute('cx', l.ax.toFixed(1));
      l.dot.setAttribute('cy', l.ay.toFixed(1));
    }
  }
  // Подписи нужны, пока разбираешься в упражнении; во время подхода их прячем.
  function setLabelsVisible(on) { labelLayer.hidden = !on; }

  const frameListeners = [];
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    frameListeners.forEach((fn) => fn(dt));
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const k = ease(tween.t);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
      camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * k;
      camera.updateProjectionMatrix();
      if (tween.t >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    if (labels.length) placeLabels();
  });

  if (view) setView(view, false);

  return {
    scene,
    camera,
    renderer,
    controls,
    setView,
    setFollow,
    get view() { return current; },
    label,
    setLabelsVisible,
    setSubject: (obj) => { subject = obj; },
    onFrame: (fn) => frameListeners.push(fn),
    onView: (fn) => viewListeners.push(fn),
    dispose() {
      renderer.setAnimationLoop(null);
      mq.removeEventListener?.('change', readTheme);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) [].concat(o.material).forEach((mat) => mat.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
