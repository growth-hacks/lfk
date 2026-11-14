// Общее для упражнений на голеностоп (2BFit): уровень из плеера и то, что от него зависит —
// подушка или круглая доска под опорной стопой, подпись «глаза закрыты», опора рукой.
import * as THREE from 'three';
import { balancePad, PAD_TOP, wobbleBoard, BOARD_TOP } from '../props.js';
import { v3 } from './_kit.js';

// Уровень упражнения (ex.stage из app.js; подушка вместо доски уже подставлена из profile.js).
export function stageOf(ex) {
  const s = ex?.stage || {};
  return { surface: s.surface || 'floor', eyes: s.eyes === 'closed', hold: s.hold || 'free', jump: s.jump || 0 };
}

export function ankleKit() {
  let support = null;
  let top = 0;
  let eyesLabel = null;
  let surfLabel = null;
  return {
    setup(m, scene, stage, st) {
      support = null;
      top = 0;
      eyesLabel = null;
      surfLabel = null;
      if (st.surface === 'pad') { support = balancePad(); top = PAD_TOP; }
      if (st.surface === 'board') { support = wobbleBoard(); top = BOARD_TOP; }
      if (support) scene.add(support);
      if (stage && st.eyes) eyesLabel = stage.label('глаза закрыты');
      if (stage && support) surfLabel = stage.label(st.surface === 'pad' ? 'подушка' : 'балансировочная доска');
    },
    // на сколько поднять опорную стопу
    get lift() { return top; },
    // поставить подушку под опорную стопу
    place(x, z) {
      if (!support) return;
      support.position.set(x, 0, z);
      if (surfLabel) surfLabel.set(v3(x, 0.05, z - 0.12));
    },
    eyes(m) {
      if (!eyesLabel) return;
      eyesLabel.set(m.head.getWorldPosition(new THREE.Vector3()).add(v3(0, 0.1, -0.08)));
    },
  };
}
