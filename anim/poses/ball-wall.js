// Мяч по стене: стоя, левая ладонь прижимает мяч к стене с лёгким давлением.
// Четыре части: круги по часовой, против часовой, восьмёрка влево, восьмёрка вправо — как видишь ты, глядя на стену.
import { wall, ball } from '../props.js';
import { v3, palmOnWall, ballPath, makeBlender, pathTrace } from './_kit.js';
import { WORK, WS, hang } from './_hand.js';

const WALL = -0.55;
const R = 0.04;
const C = v3(-0.24, 1.3, WALL);
let theBall = null;
let trace = null;
let tracePhase = -1;
const blend = makeBlender();

export default {
  legend: 'Ладонь прижимает мяч к стене. Оранжевый след со стрелкой — куда катится мяч, как видишь ты, глядя на стену.',
  views: {
    back: { label: 'Как видишь ты', pos: [-0.02, 1.6, -0.1], target: [-0.2, 1.3, WALL], fov: 40, firstPerson: true },
    side: { label: 'Сбоку', pos: [-1.2, 1.35, -0.25], target: [-0.2, 1.3, -0.45], fov: 32 },
  },
  setup(m, scene) {
    scene.add(wall({ front: WALL }));
    theBall = ball(R);
    scene.add(theBall);
    trace = pathTrace(scene, m.materials.cue);
    tracePhase = -1;
  },
  pose(m, s) {
    m.reset();
    hang(m, 'R');
    const ph = s.phase ?? 0;
    // на стене «вверх» — к потолку, то есть +Y
    if (ph !== tracePhase) {
      tracePhase = ph;
      const pts = [];
      for (let i = 0; i <= 80; i++) { const [x, up] = ballPath(ph, (3 * i) / 80, 0.07); pts.push(C.clone().add(v3(x, up, 0.003))); }
      trace(pts);
    }
    const [dx, up] = ballPath(ph, s.t ?? 0, 0.07);
    const c = blend(ph, s.t ?? 0, C.clone().add(v3(dx, up, R)));
    theBall.position.copy(c);
    theBall.rotation.set(-c.y / R, -c.x / R, 0);
    const H = m.arms[WORK].hand;
    // середина ладони — напротив центра мяча, ладонь касается мяча
    m.arm(WORK, c.clone().add(v3(0, -0.047, R + 0.017)), { hand: palmOnWall(WS), pole: v3(-0.7, 0.8, 0.3) });
    H.setFingers({ all: [14, 16, 8] });
    H.setThumb('open');
  },
};
