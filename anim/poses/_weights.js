// Силовые с гантелью для левой кисти.
//   ext    — разгибание: предплечье на бедре ладонью вниз, кисть свисает, поднимаешь, опускаешь за 3 с
//   flex   — сгибание: то же ладонью вверх
//   hammer — «молотком»: стоя, рука вдоль тела, гантель как молоток, поднимаешь передний край за счёт кисти
import * as THREE from 'three';
import { stool } from '../props.js';
import { createDumbbell, GRIP } from '../mannequin.js';
import { ease, mix, v3 } from './_kit.js';
import { WORK, WS, DEG, palmDownQuat, palmUpQuat, sit, restOnThigh, hang } from './_hand.js';

export function makeWeights(kind) {
  let arc = null;
  return {
    legend: {
      ext: 'Предплечье лежит на бедре, двигается только кисть. Оранжевая дуга — путь гантели.',
      flex: 'Предплечье лежит на бедре ладонью вверх, двигается только кисть. Оранжевая дуга — путь гантели.',
      hammer: 'Рука висит вдоль тела, двигается только кисть: передний край гантели идёт вверх. Оранжевая дуга — его путь.',
    }[kind],
    views: kind === 'hammer'
      ? {
        side: { label: 'Сбоку', pos: [-1.45, 1.0, -0.15], target: [-0.2, 0.72, -0.02], fov: 34 },
        front: { label: 'Спереди', pos: [-0.35, 1.0, -1.7], target: [-0.2, 0.78, 0], fov: 34 },
      }
      : {
        side: { label: 'Сбоку', pos: [-1.1, 0.78, -0.5], target: [-0.12, 0.58, -0.5], fov: 32 },
        front: { label: 'Спереди', pos: [-0.2, 0.85, -1.45], target: [-0.12, 0.58, -0.45], fov: 32 },
      },
    setup(m, scene) {
      const H = m.arms[WORK].hand;
      H.group.add(createDumbbell(WS, m.materials, { centered: kind !== 'hammer' }));
      if (kind !== 'hammer') scene.add(stool({ seat: 0.44, z: 0.02 }));
      // дуга пути гантели
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        if (kind === 'hammer') {
          const a = (-52 + (50 * i) / 40) * DEG; // дальний диск вокруг запястья
          pts.push(v3(-0.2, 0.89 + Math.sin(a) * 0.17, -Math.cos(a) * 0.17));
        } else {
          const a = (-45 + (90 * i) / 40) * DEG;
          pts.push(v3(-0.13, 0.6 + Math.sin(a) * 0.13, -0.5 - Math.cos(a) * 0.13));
        }
      }
      arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 50, 0.0025, 8, false), m.materials.cue);
      scene.add(arc);
    },
    pose(m, s) {
      m.reset();
      const H = m.arms[WORK].hand;
      const k = s.phase === 0 ? ease(s.u) : 1 - ease(s.u); // 0 — внизу, 1 — вверху
      if (kind === 'hammer') {
        hang(m, 'R');
        m.arms[WORK].set({ wristDev: mix(-12, 30, k) });
      } else {
        sit(m, { lean: -52 });
        restOnThigh(m, 'R');
        const q = kind === 'ext' ? palmDownQuat(WS, mix(-45, 40, k), 0) : palmUpQuat(WS, mix(-40, 45, k));
        m.arm(WORK, v3(-0.13, 0.6, -0.5), { pole: v3(-0.4, 1.2, 0.2), hand: q });
      }
      H.setFingers(GRIP);
      H.setThumb('grip');
    },
  };
}
