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
  function placeLabels() {
    if (labelLayer.hidden) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const cols = [[], []];
    for (const l of labels) {
      _p.copy(l.pos).project(camera);
      const on = l.visible && _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
      show(l, on);
      if (!on) continue;
      if (l.text !== l.el.textContent) { l.text = l.el.textContent; l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; }
      l.ax = ((_p.x + 1) / 2) * w;
      l.ay = ((1 - _p.y) / 2) * h;
      cols[l.ax < w / 2 ? 0 : 1].push(l);
    }
    const M = 8;
    cols.forEach((col, right) => {
      col.sort((a, b) => a.ay - b.ay);
      let floorY = M;
      for (const l of col) {
        const x = right ? w - M - l.w : M;
        // точка у самого края попала бы под подпись — тогда подпись встаёт над точкой (или под ней)
        const covers = l.ax > x - 10 && l.ax < x + l.w + 10;
        let y = covers ? l.ay - l.h - 16 : l.ay - l.h / 2;
        if (covers && y < M) y = l.ay + 16;
        y = Math.min(Math.max(y, floorY), h - M - l.h);
        floorY = y + l.h + 4;
        l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        const ex = covers ? Math.min(Math.max(l.ax, x + 8), x + l.w - 8) : (right ? x : x + l.w);
        const ey = covers ? (y > l.ay ? y : y + l.h) : y + l.h / 2;
        l.line.setAttribute('x1', l.ax.toFixed(1));
        l.line.setAttribute('y1', l.ay.toFixed(1));
        l.line.setAttribute('x2', ex.toFixed(1));
        l.line.setAttribute('y2', ey.toFixed(1));
        l.dot.setAttribute('cx', l.ax.toFixed(1));
        l.dot.setAttribute('cy', l.ay.toFixed(1));
      }
    });
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
