// Растяжка икр у стены: прямое колено и согнутое колено. Источник техники — прототип и Radford 2006.
// side 0 — растягиваем правую ногу (она сзади), side 1 — левую.
import * as THREE from 'three';
import { wall, glowZone } from '../props.js';
import { ANKLE_H } from '../mannequin.js';
import { holdLevel, mix, v3, mixV, palmOnWall, cueArrow, pointArrow, footPoint } from './_kit.js';

const WALL = -0.64;

export function makeCalf({ bent }) {
  let arrows = null;
  let zones = null;
  const S = bent
    ? { back: 0.0, front: -0.30, p0: v3(0, 0.875, -0.12), p1: v3(0, 0.80, -0.17), lean0: -4, lean1: -7, wristY: [1.3, 1.25] }
    : { back: 0.30, front: -0.30, p0: v3(0, 0.87, 0.0), p1: v3(0, 0.83, -0.10), lean0: -8, lean1: -15, wristY: [1.33, 1.3] };

  return {
    legend: bent
      ? 'Оранжевым — где тянет: низ икры у ахилла. Стрелки: колено вперёд и вниз, пятка на полу.'
      : 'Оранжевым — где тянет: верх икры. Стрелка: пятка задней ноги прижата к полу.',
    views: {
      side: { label: 'Сбоку', pos: [2.5, 1.05, -0.2], target: [0, 0.78, -0.18], fov: 36 },
      back: { label: 'Сзади', pos: [1.25, 1.45, 1.95], target: [0, 0.75, -0.2], fov: 38 },
      other: { label: 'С другой стороны', pos: [-2.5, 1.05, -0.2], target: [0, 0.78, -0.18], fov: 36 },
    },
    setup(m, scene) {
      scene.add(wall({ front: WALL }));
      zones = {};
      arrows = { heel: cueArrow(m.materials.cue), knee: cueArrow(m.materials.cue) };
      for (const k of ['R', 'L']) {
        const z = bent ? glowZone(0.25, 0.36, 0.043, m.materials.glow) : glowZone(0.05, 0.19, 0.056, m.materials.glow);
        z.position.z = 0.008;
        m.legs[k].knee.add(z);
        zones[k] = z;
      }
      scene.add(arrows.heel, arrows.knee);
      arrows.knee.visible = bent;
    },
    pose(m, s) {
      const backKey = s.side === 1 ? 'L' : 'R';
      const frontKey = backKey === 'R' ? 'L' : 'R';
      const bx = backKey === 'R' ? 1 : -1;
      const k = holdLevel(s);
      m.reset();
      m.pelvis.position.copy(mixV(S.p0, S.p1, k));
      m.pelvis.rotation.x = mix(0, -0.05, k);
      m.spine.rotation.x = mix(S.lean0, S.lean1, k) * Math.PI / 180;
      const backAnkle = v3(bx * 0.11, ANKLE_H, S.back);
      const frontAnkle = v3(-bx * 0.11, ANKLE_H, S.front);
      m.leg(backKey, backAnkle);
      m.leg(frontKey, frontAnkle);
      const wy = mix(S.wristY[0], S.wristY[1], k);
      for (const [key, sx] of [['R', 1], ['L', -1]]) {
        m.arm(key, v3(sx * 0.21, wy, WALL + 0.02), { hand: palmOnWall(sx) });
        m.arms[key].hand.setFingers({ all: [4, 4, 2] });
        m.arms[key].hand.setThumb('open');
      }
      zones.R.visible = backKey === 'R';
      zones.L.visible = backKey === 'L';
      zones[backKey].material.opacity = 0.15 + 0.45 * k;
      const heel = footPoint(m.legs[backKey], 0, -0.02, 0.07);
      pointArrow(arrows.heel, heel.add(v3(0, 0.02, 0.045)), v3(0, -1, 0));
      if (bent) {
        m.legs[backKey].knee.updateWorldMatrix(true, false);
        const kn = m.legs[backKey].knee.getWorldPosition(new THREE.Vector3());
        pointArrow(arrows.knee, kn.add(v3(0, -0.02, -0.12)), v3(0, -0.5, -1));
      }
    },
  };
}
