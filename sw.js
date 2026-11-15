// Service worker: приложение открывается без интернета.
// Сначала пробуем сеть (чтобы видеть свежую версию), без сети — берём из кеша.
// При выкладке новой версии поменяй VERSION — старый кеш удалится.

const VERSION = 'lfk-v20';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './store.js',
  './timer.js',
  './day.js',
  './plan.js',
  './backup.js',
  './manifest.webmanifest',
  './data/exercises.js',
  './data/program.js',
  './data/profile.js',
  './data/sources.js',
  './data/figures.js',
  './data/rules.js',
  './data/equipment.js',
  './anim/stage.js',
  './anim/mannequin.js',
  './anim/ik.js',
  './anim/foot.js',
  './anim/props.js',
  './anim/poses/_kit.js',
  './anim/poses/_calf.js',
  './anim/poses/_seated.js',
  './anim/poses/forearm-rotation.js',
  './anim/poses/forearm-rotation-free.js',
  './anim/poses/calf-straight.js',
  './anim/poses/calf-bent.js',
  './anim/poses/wall-lunge.js',
  './anim/poses/heel-raise.js',
  './anim/poses/balance.js',
  './anim/poses/short-foot.js',
  './anim/poses/toe-yoga.js',
  './anim/poses/toe-spread.js',
  './anim/poses/_hand.js',
  './anim/poses/_table.js',
  './anim/poses/_front.js',
  './anim/poses/_weights.js',
  './anim/poses/ball-wall.js',
  './anim/poses/pushups.js',
  './anim/poses/wrist-flex-ext.js',
  './anim/poses/wrist-deviation.js',
  './anim/poses/angle-eyes-closed.js',
  './anim/poses/dart-throw.js',
  './anim/poses/ball-table.js',
  './anim/poses/thumb-mobility.js',
  './anim/poses/grip.js',
  './anim/poses/finger-ext.js',
  './anim/poses/thumb-band.js',
  './anim/poses/wrist-ext-weight.js',
  './anim/poses/wrist-flex-weight.js',
  './anim/poses/hammer.js',
  './anim/poses/_ankle.js',
  './anim/poses/ankle-split-squat.js',
  './anim/poses/ankle-step-raise.js',
  './anim/poses/ankle-stance.js',
  './anim/poses/ankle-runner.js',
  './anim/poses/ankle-leg-sway.js',
  './anim/poses/ankle-toe-walk.js',
  './anim/poses/ankle-band.js',
  './lib/three.module.min.js',
  './lib/addons/controls/OrbitControls.js',
  './lib/addons/geometries/RoundedBoxGeometry.js',
  './fonts/golos-text-cyrillic-400-normal.woff2',
  './fonts/golos-text-cyrillic-500-normal.woff2',
  './fonts/golos-text-cyrillic-600-normal.woff2',
  './fonts/golos-text-latin-400-normal.woff2',
  './fonts/golos-text-latin-500-normal.woff2',
  './fonts/golos-text-latin-600-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fromNetwork(req, 3500);
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
