// Схемы из прототипа (zaryadka-dlya-ikr-i-stop.html). Показываются, пока у упражнения нет 3D-анимации.
// Классы (.limb, .cue…) описаны в app.css, маркер стрелки #arr — в index.html.
export const FIGURES = {
  'wall-test': `<svg viewBox="0 0 320 262" role="img" aria-label="Человек стоит лицом к стене, переднее колено касается стены, пятка на полу, между носком и стеной отмерено расстояние">
  <line class="floor" x1="8" y1="226" x2="270" y2="226"/>
  <rect class="wall" x="270" y="10" width="20" height="216"/>
  <polyline class="limb far" points="196,110 150,160 118,206"/>
  <polyline class="limb far" points="112,203 146,220"/>
  <line class="limb" x1="196" y1="110" x2="214" y2="34"/>
  <circle class="head" cx="219" cy="17" r="12"/>
  <polyline class="limb" points="214,36 240,58 264,52"/>
  <polyline class="limb" points="196,110 263,150 204,215"/>
  <line class="limb" x1="196" y1="219" x2="240" y2="219"/>
  <circle class="cue" cx="264" cy="150" r="12"/>
  <circle class="cue-fill" cx="198" cy="219" r="4.5"/>
  <line class="cue" x1="242" y1="240" x2="270" y2="240"/>
  <line class="cue" x1="242" y1="233" x2="242" y2="247"/>
  <line class="cue" x1="270" y1="233" x2="270" y2="247"/>
  <text class="svg-label hot" x="256" y="259" text-anchor="middle">см</text>
  <text class="svg-label" x="198" y="246" text-anchor="middle">пятка</text>
</svg>`,
  'calf-straight': `<svg viewBox="0 0 320 258" role="img" aria-label="Растяжка икры у стены: задняя нога прямая, пятка на полу, руки на стене">
  <line class="floor" x1="8" y1="246" x2="272" y2="246"/>
  <rect class="wall" x="272" y="10" width="20" height="236"/>
  <line class="zone" x1="64" y1="227" x2="85" y2="187"/>
  <polyline class="limb far" points="127.5,104.8 173.6,160 172,236"/>
  <line class="limb far" x1="166" y1="240" x2="204" y2="240"/>
  <line class="limb" x1="127.5" y1="104.8" x2="60" y2="236"/>
  <line class="limb" x1="52" y1="240" x2="90" y2="240"/>
  <line class="limb" x1="127.5" y1="104.8" x2="165" y2="34"/>
  <circle class="head" cx="174.4" cy="16.5" r="12"/>
  <polyline class="limb" points="165,36 218,46 266,56"/>
  <line class="cue" x1="44" y1="206" x2="49" y2="232" marker-end="url(#arr)"/>
</svg>`,
  'calf-bent': `<svg viewBox="0 -8 320 264" role="img" aria-label="Растяжка нижней части икры: обе ноги согнуты, заднее колено подаётся вперёд и вниз, пятка на полу">
  <line class="floor" x1="8" y1="246" x2="272" y2="246"/>
  <rect class="wall" x="272" y="-6" width="20" height="252"/>
  <line class="zone" x1="105" y1="230" x2="122" y2="211"/>
  <polyline class="limb far" points="150,108 199.7,160.1 196,236"/>
  <line class="limb far" x1="188" y1="240" x2="226" y2="240"/>
  <polyline class="limb" points="150,108 149.8,180 100,236"/>
  <line class="limb" x1="92" y1="240" x2="130" y2="240"/>
  <line class="limb" x1="150" y1="108" x2="176" y2="32"/>
  <circle class="head" cx="182" cy="13" r="12"/>
  <polyline class="limb" points="176,34 222,48 266,58"/>
  <line class="cue" x1="160" y1="186" x2="178" y2="198" marker-end="url(#arr)"/>
  <line class="cue" x1="80" y1="208" x2="86" y2="232" marker-end="url(#arr)"/>
</svg>`,
  'short-foot': `<svg viewBox="0 0 340 182" role="img" aria-label="Две стопы сбоку: обычная и с поднятым куполом свода, подушечка подтянута к пятке, пальцы прямые">
  <g transform="translate(4,0)">
    <line class="floor" x1="0" y1="150" x2="160" y2="150"/>
    <path class="foot" d="M30 148 C16 148 10 134 12 120 C14 104 22 90 30 70 L52 64 C60 86 78 102 110 120 L146 132 C156 135 156 147 146 148 L112 148 C98 148 92 140 76 139 C60 138 48 148 30 148 Z"/>
    <text class="svg-label" x="80" y="176" text-anchor="middle">обычно</text>
  </g>
  <g transform="translate(174,0)">
    <line class="floor" x1="0" y1="150" x2="160" y2="150"/>
    <path class="foot" d="M30 148 C16 148 10 134 12 120 C14 104 22 90 30 70 L52 64 C60 86 78 100 106 116 L140 130 C150 134 150 147 140 148 L106 148 C96 148 92 128 74 127 C58 127 48 148 30 148 Z"/>
    <line class="cue" x1="74" y1="147" x2="74" y2="134" marker-end="url(#arr)"/>
    <line class="cue" x1="102" y1="161" x2="58" y2="161" marker-end="url(#arr)"/>
    <text class="svg-label hot" x="80" y="176" text-anchor="middle">купол</text>
  </g>
</svg>`,
  'toe-yoga': `<svg viewBox="0 0 340 180" role="img" aria-label="Пальцы стопы спереди. А: большой палец прижат, остальные подняты. Б: большой поднят, остальные прижаты">
  <g transform="translate(6,0)">
    <line class="floor" x1="0" y1="150" x2="160" y2="150"/>
    <path class="foot" d="M8 112 C8 74 38 58 80 58 C122 58 152 74 152 112 Z"/>
    <rect class="foot" x="16" y="104" width="32" height="44" rx="12"/>
    <rect class="foot" x="54" y="92" width="22" height="34" rx="9"/>
    <rect class="foot" x="80" y="92" width="20" height="34" rx="9"/>
    <rect class="foot" x="104" y="92" width="18" height="34" rx="8"/>
    <rect class="foot" x="126" y="92" width="16" height="34" rx="7"/>
    <line class="cue" x1="32" y1="66" x2="32" y2="94" marker-end="url(#arr)"/>
    <line class="cue" x1="65" y1="88" x2="65" y2="68" marker-end="url(#arr)"/>
    <line class="cue" x1="90" y1="88" x2="90" y2="68" marker-end="url(#arr)"/>
    <line class="cue" x1="113" y1="88" x2="113" y2="68" marker-end="url(#arr)"/>
    <line class="cue" x1="134" y1="88" x2="134" y2="70" marker-end="url(#arr)"/>
    <text class="svg-label hot" x="80" y="172" text-anchor="middle">А · большой вниз</text>
  </g>
  <g transform="translate(176,0)">
    <line class="floor" x1="0" y1="150" x2="160" y2="150"/>
    <path class="foot" d="M8 112 C8 74 38 58 80 58 C122 58 152 74 152 112 Z"/>
    <rect class="foot" x="16" y="92" width="32" height="34" rx="12"/>
    <rect class="foot" x="54" y="104" width="22" height="44" rx="9"/>
    <rect class="foot" x="80" y="104" width="20" height="44" rx="9"/>
    <rect class="foot" x="104" y="104" width="18" height="44" rx="8"/>
    <rect class="foot" x="126" y="104" width="16" height="44" rx="7"/>
    <line class="cue" x1="32" y1="88" x2="32" y2="66" marker-end="url(#arr)"/>
    <line class="cue" x1="65" y1="68" x2="65" y2="94" marker-end="url(#arr)"/>
    <line class="cue" x1="90" y1="68" x2="90" y2="94" marker-end="url(#arr)"/>
    <line class="cue" x1="113" y1="68" x2="113" y2="94" marker-end="url(#arr)"/>
    <line class="cue" x1="134" y1="70" x2="134" y2="94" marker-end="url(#arr)"/>
    <text class="svg-label" x="80" y="172" text-anchor="middle">Б · большой вверх</text>
  </g>
</svg>`,
  'toe-spread': `<svg viewBox="0 0 220 272" role="img" aria-label="Стопа сверху: пальцы разведены веером, пунктиром показано обычное положение">
  <path class="foot" d="M100 262 C72 262 62 240 64 214 C66 190 74 178 72 160 C70 140 56 128 56 108 C56 92 68 86 80 86 L150 90 C164 92 170 104 168 120 C166 150 154 178 146 214 C140 244 128 262 100 262 Z"/>
  <ellipse class="foot" cx="62" cy="64" rx="14" ry="20" transform="rotate(-16 62 64)"/>
  <ellipse class="foot" cx="100" cy="57" rx="10" ry="14" transform="rotate(-5 100 57)"/>
  <ellipse class="foot" cx="126" cy="60" rx="9" ry="13" transform="rotate(7 126 60)"/>
  <ellipse class="foot" cx="149" cy="68" rx="8" ry="12" transform="rotate(16 149 68)"/>
  <ellipse class="foot" cx="168" cy="80" rx="7" ry="10" transform="rotate(26 168 80)"/>
  <ellipse class="ghost" cx="76" cy="66" rx="14" ry="20"/>
  <ellipse class="ghost" cx="103" cy="62" rx="10" ry="14"/>
  <ellipse class="ghost" cx="123" cy="66" rx="9" ry="13"/>
  <ellipse class="ghost" cx="141" cy="73" rx="8" ry="12"/>
  <ellipse class="ghost" cx="156" cy="83" rx="7" ry="10"/>
  <line class="cue" x1="64" y1="34" x2="40" y2="30" marker-end="url(#arr)"/>
  <line class="cue" x1="172" y1="56" x2="194" y2="64" marker-end="url(#arr)"/>
</svg>`,
  'heel-raise': `<svg viewBox="0 0 340 232" role="img" aria-label="Слева: нога сбоку на носке, вес на большом пальце. Справа: нога спереди, колено над вторым пальцем, пунктиром показано неправильное положение колена внутрь">
  <line class="floor" x1="8" y1="210" x2="332" y2="210"/>
  <path class="foot" d="M98 30 C84 70 88 112 104 142 C98 156 100 166 110 172 C124 182 140 198 156 206 L184 208 C192 208 192 198 184 197 L166 194 C152 186 138 170 126 140 L120 30 Z"/>
  <line class="cue" x1="88" y1="204" x2="88" y2="170" marker-end="url(#arr)"/>
  <circle class="cue-fill" cx="168" cy="203" r="4.5"/>
  <polyline class="ghost leg" points="259,22 236,112 259,182"/>
  <text class="svg-label" x="230" y="117" text-anchor="end">внутрь — нет</text>
  <path class="foot" d="M226 196 C226 182 244 176 268 176 C292 176 312 182 312 196 Z"/>
  <rect class="foot" x="230" y="192" width="18" height="16" rx="6"/>
  <rect class="foot" x="252" y="192" width="13" height="16" rx="5"/>
  <rect class="foot" x="268" y="192" width="12" height="16" rx="5"/>
  <rect class="foot" x="283" y="192" width="11" height="16" rx="5"/>
  <rect class="foot" x="297" y="192" width="10" height="16" rx="4"/>
  <polyline class="limb" points="259,22 258.5,110 259,180"/>
  <line class="cue dash" x1="258.5" y1="120" x2="258.5" y2="190"/>
</svg>`,
  'balance': `<svg viewBox="0 0 200 252" role="img" aria-label="Человек стоит на одной ноге, вторая согнута, большой палец опорной ноги прижат к полу">
  <line class="floor" x1="30" y1="242" x2="170" y2="242"/>
  <polyline class="limb far" points="100,122 122,160 116,198"/>
  <polyline class="limb" points="100,122 100,180 100,232"/>
  <line class="limb" x1="90" y1="236" x2="112" y2="236"/>
  <line class="limb" x1="100" y1="122" x2="100" y2="52"/>
  <circle class="head" cx="100" cy="34" r="12"/>
  <polyline class="limb" points="100,56 80,88 74,120"/>
  <polyline class="limb" points="100,56 120,88 128,120"/>
  <circle class="cue-fill" cx="110" cy="236" r="4.5"/>
</svg>`,
};
