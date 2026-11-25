import type { SceneProps } from './scene-style';

export function SandboxesScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="-7" cy="35.4" r="83.4">
          <stop offset=".2" stopColor="#fff" />
          <stop offset=".9" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-gm0`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
          <rect x="-400" y="-400" width="800" height="800" fill={`url(#${id}-gg0)`} />
        </mask>
      </defs>
      <g className="ground">
        <path
          mask={`url(#${id}-gm0)`}
          d="M-69.9,31.8C-69.9,31 -67,30.3 -65.5,29.5C-64,28.8 -66.9,30.3 -61.1,27.3C-55.3,24.4 -40.9,17 -30.7,11.9C-20.5,6.8 -5.6,-1 0.1,-3.4C5.7,-5.8 2.3,-2.8 3.4,-2.4C4.5,-2.1 0.3,-4.5 6.7,-1.4C13.1,1.7 30.1,10.4 41.7,16.3C53.3,22.1 71.4,30.5 76.4,33.8C81.5,37.1 73.5,35.3 72,36C70.5,36.8 73.3,35.3 67.6,38.3C61.8,41.2 47.4,48.5 37.3,53.6C27.1,58.7 12.3,66.6 6.7,69C1,71.5 4.5,68.4 3.4,68.1C2.3,67.7 0.9,67.4 0.1,67.1C-0.7,66.8 -1,66.5 -1.5,66.3C-2.1,66 2,68.1 -3.2,65.5C-8.3,62.9 -22.7,55.7 -32.4,50.8C-42,46 -55.5,39 -61.1,36.2C-66.6,33.4 -64,34.8 -65.5,34C-67,33.3 -69.9,32.5 -69.9,31.8Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-63.6,22.8Q-63.6,20.6 -61.7,19.6L-2,-10.3Q0,-11.3 1.4,-10.5L1.7,-10.4Q3.2,-9.7 3.2,-7.5L3.2,-0.6Q3.2,1.6 1.2,2.6L-58.5,32.4Q-60.5,33.4 -61.9,32.7L-62.2,32.5Q-63.6,31.8 -63.6,29.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.2,-7.5Q-3.2,-9.7 -1.7,-10.4L-1.4,-10.5Q0,-11.3 2,-10.3L61.7,19.6Q63.6,20.6 63.6,22.8L63.6,29.6Q63.6,31.8 62.2,32.5L61.9,32.7Q60.5,33.4 58.5,32.4L-1.2,2.6Q-3.2,1.6 -3.2,-0.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-65.4,19.8Q-65.4,19.1 -63.4,18.1L-2,-12.7Q0,-13.6 2,-12.7L3.3,-12Q5.3,-11 5.3,-10.3L5.3,-10.2Q5.3,-9.5 3.3,-8.5L-58.1,22.2Q-60.1,23.2 -62.1,22.2L-63.4,21.6Q-65.4,20.6 -65.4,19.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-5.3,-10.3Q-5.3,-11 -3.3,-12L-2,-12.7Q0,-13.6 2,-12.7L63.4,18.1Q65.4,19.1 65.4,19.8L65.4,19.9Q65.4,20.6 63.4,21.6L62.1,22.2Q60.1,23.2 58.1,22.2L-3.3,-8.5Q-5.3,-9.5 -5.3,-10.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1.4,-3.6Q0,-4.3 -1.4,-3.6L-55.9,23.6Q-57.3,24.3 -55.9,25L-1.4,52.3Q0,53 1.4,52.3L55.9,25Q57.3,24.3 55.9,23.6Z"
        fill="color-mix(in oklab, var(--detail) 22%, var(--hole))"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M30.1,12.8Q30.1,18.1 40.7,20.8"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M23,12.8Q23.9,18.6 35.4,22.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.5,17.3Q-4.4,21.2 2.7,23"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-28.3,31.4Q-25.6,36.3 -16.8,38.9"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-23,30.5Q-20.8,34.7 -14.1,36.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="4.8" cy="0.5" r="0.5" fill="var(--detail)" />
      <circle cx="5.7" cy="2.7" r="0.3" fill="var(--detail)" />
      <circle cx="9.9" cy="3.2" r="0.3" fill="var(--line)" />
      <circle cx="12" cy="5.6" r="0.3" fill="var(--line)" />
      <circle cx="17.1" cy="7.6" r="0.3" fill="var(--detail)" />
      <circle cx="19" cy="9.8" r="0.5" fill="var(--detail)" />
      <circle cx="24.9" cy="11.2" r="0.3" fill="var(--detail)" />
      <circle cx="31.5" cy="14.9" r="0.5" fill="var(--detail)" />
      <circle cx="-4.6" cy="1.2" r="0.3" fill="var(--detail)" />
      <circle cx="0" cy="2.2" r="0.3" fill="var(--line)" />
      <circle cx="1.7" cy="3.7" r="0.5" fill="var(--line)" />
      <circle cx="7.6" cy="5.6" r="0.8" fill="var(--line)" />
      <circle cx="7.1" cy="6.8" r="0.5" fill="var(--line)" />
      <circle cx="10.2" cy="8.9" r="0.8" fill="var(--line)" />
      <circle cx="18.9" cy="13" r="0.3" fill="var(--detail)" />
      <circle cx="42.7" cy="23.5" r="0.3" fill="var(--detail)" />
      <circle cx="-7.6" cy="3" r="0.5" fill="var(--line)" />
      <circle cx="-0.2" cy="6.1" r="0.5" fill="var(--line)" />
      <circle cx="9.4" cy="11.3" r="0.3" fill="var(--detail)" />
      <circle cx="12.1" cy="11.2" r="0.3" fill="var(--line)" />
      <circle cx="16.3" cy="12.7" r="0.3" fill="var(--line)" />
      <circle cx="36.3" cy="24" r="0.3" fill="var(--detail)" />
      <circle cx="43.4" cy="26.9" r="0.3" fill="var(--detail)" />
      <circle cx="-8.7" cy="4.2" r="0.3" fill="var(--line)" />
      <circle cx="3.3" cy="11" r="0.3" fill="var(--detail)" />
      <circle cx="3.4" cy="11.7" r="0.3" fill="var(--detail)" />
      <circle cx="32.4" cy="24.5" r="0.5" fill="var(--line)" />
      <circle cx="35.3" cy="24.8" r="0.3" fill="var(--line)" />
      <circle cx="-12" cy="4.3" r="0.3" fill="var(--detail)" />
      <circle cx="-12.4" cy="7" r="0.5" fill="var(--line)" />
      <circle cx="-1" cy="10.3" r="0.3" fill="var(--line)" />
      <circle cx="0.3" cy="13" r="0.3" fill="var(--detail)" />
      <circle cx="3.3" cy="12.9" r="0.5" fill="var(--detail)" />
      <circle cx="6.1" cy="15.5" r="0.3" fill="var(--detail)" />
      <circle cx="31.7" cy="26.6" r="0.8" fill="var(--line)" />
      <circle cx="34.4" cy="30.2" r="0.3" fill="var(--detail)" />
      <circle cx="39.3" cy="31.1" r="0.3" fill="var(--line)" />
      <circle cx="-16.6" cy="7.1" r="0.5" fill="var(--detail)" />
      <circle cx="-10.5" cy="8.7" r="0.5" fill="var(--detail)" />
      <circle cx="-4.3" cy="12.3" r="0.3" fill="var(--line)" />
      <circle cx="2.3" cy="15.1" r="0.5" fill="var(--line)" />
      <circle cx="1.2" cy="15.9" r="0.3" fill="var(--detail)" />
      <circle cx="7" cy="17.1" r="0.3" fill="var(--detail)" />
      <circle cx="28.5" cy="29.5" r="0.5" fill="var(--detail)" />
      <circle cx="33.6" cy="30.2" r="0.3" fill="var(--detail)" />
      <circle cx="32.6" cy="32.1" r="0.3" fill="var(--detail)" />
      <circle cx="-17.6" cy="9" r="0.3" fill="var(--detail)" />
      <circle cx="-17.9" cy="10.2" r="0.5" fill="var(--line)" />
      <circle cx="-8.9" cy="12.2" r="0.3" fill="var(--detail)" />
      <circle cx="18.4" cy="28.6" r="0.3" fill="var(--detail)" />
      <circle cx="25" cy="31.2" r="0.3" fill="var(--line)" />
      <circle cx="-19.1" cy="10.2" r="0.3" fill="var(--line)" />
      <circle cx="-17.2" cy="13.4" r="0.3" fill="var(--detail)" />
      <circle cx="-4.5" cy="17.9" r="0.5" fill="var(--detail)" />
      <circle cx="-4.7" cy="19.8" r="0.5" fill="var(--line)" />
      <circle cx="0" cy="22.4" r="0.5" fill="var(--detail)" />
      <circle cx="3.1" cy="23.7" r="0.3" fill="var(--detail)" />
      <circle cx="16.3" cy="29.8" r="0.3" fill="var(--detail)" />
      <circle cx="23.9" cy="31.6" r="0.3" fill="var(--detail)" />
      <circle cx="28.1" cy="35.4" r="0.3" fill="var(--detail)" />
      <circle cx="-25.7" cy="11.5" r="0.5" fill="var(--detail)" />
      <circle cx="0.8" cy="25.1" r="0.5" fill="var(--line)" />
      <circle cx="7.7" cy="26.7" r="0.8" fill="var(--line)" />
      <circle cx="8.8" cy="29.1" r="0.8" fill="var(--line)" />
      <circle cx="16.1" cy="31.2" r="0.5" fill="var(--detail)" />
      <circle cx="19.5" cy="34.3" r="0.5" fill="var(--detail)" />
      <circle cx="20.3" cy="35.1" r="0.3" fill="var(--detail)" />
      <circle cx="-3.9" cy="26.3" r="0.3" fill="var(--detail)" />
      <circle cx="2.1" cy="27.1" r="0.3" fill="var(--detail)" />
      <circle cx="2.1" cy="28.7" r="0.3" fill="var(--line)" />
      <circle cx="9" cy="30.5" r="0.3" fill="var(--line)" />
      <circle cx="10.1" cy="33.3" r="0.3" fill="var(--line)" />
      <circle cx="13.3" cy="33.3" r="0.8" fill="var(--line)" />
      <circle cx="16.5" cy="35.9" r="0.8" fill="var(--line)" />
      <circle cx="19.9" cy="36.8" r="0.5" fill="var(--line)" />
      <circle cx="23.1" cy="37.7" r="0.3" fill="var(--detail)" />
      <circle cx="-32" cy="14.8" r="0.3" fill="var(--detail)" />
      <circle cx="-6.7" cy="26.6" r="0.5" fill="var(--detail)" />
      <circle cx="-5.5" cy="28.7" r="0.3" fill="var(--detail)" />
      <circle cx="6.1" cy="32.3" r="0.5" fill="var(--detail)" />
      <circle cx="5.9" cy="34.7" r="0.8" fill="var(--line)" />
      <circle cx="11.1" cy="35" r="0.8" fill="var(--line)" />
      <circle cx="13" cy="36.5" r="0.3" fill="var(--detail)" />
      <circle cx="18.3" cy="38.7" r="0.3" fill="var(--detail)" />
      <circle cx="-5.4" cy="31.2" r="0.5" fill="var(--line)" />
      <circle cx="-2.6" cy="33.6" r="0.3" fill="var(--detail)" />
      <circle cx="-37.5" cy="17.3" r="0.5" fill="var(--line)" />
      <circle cx="-17.2" cy="29.5" r="0.3" fill="var(--detail)" />
      <circle cx="-14.9" cy="30.9" r="0.3" fill="var(--detail)" />
      <circle cx="-9.2" cy="32.6" r="0.5" fill="var(--detail)" />
      <circle cx="-5.3" cy="34.1" r="0.3" fill="var(--detail)" />
      <circle cx="-2.2" cy="34.3" r="0.3" fill="var(--line)" />
      <circle cx="-42.3" cy="19.8" r="0.8" fill="var(--line)" />
      <circle cx="-9.7" cy="36.7" r="0.5" fill="var(--line)" />
      <circle cx="-44.2" cy="19.9" r="0.3" fill="var(--detail)" />
      <circle cx="-27.9" cy="30.8" r="0.3" fill="var(--line)" />
      <circle cx="-22.9" cy="33.2" r="0.3" fill="var(--detail)" />
      <circle cx="-18.2" cy="33.1" r="0.5" fill="var(--line)" />
      <circle cx="-14.6" cy="35.7" r="0.3" fill="var(--detail)" />
      <circle cx="-47.5" cy="22.8" r="0.5" fill="var(--detail)" />
      <circle cx="-38.7" cy="25.6" r="0.3" fill="var(--detail)" />
      <circle cx="-37.7" cy="28.1" r="0.5" fill="var(--detail)" />
      <circle cx="-25.2" cy="32.3" r="0.3" fill="var(--detail)" />
      <circle cx="-21.7" cy="36.6" r="0.3" fill="var(--detail)" />
      <circle cx="-18" cy="36.1" r="0.3" fill="var(--detail)" />
      <circle cx="-15.7" cy="38.9" r="0.3" fill="var(--line)" />
      <circle cx="-53.2" cy="24.1" r="0.3" fill="var(--line)" />
      <circle cx="-47.8" cy="25.2" r="0.8" fill="var(--line)" />
      <circle cx="-40" cy="30.9" r="0.8" fill="var(--line)" />
      <circle cx="-32.4" cy="33.8" r="0.5" fill="var(--detail)" />
      <circle cx="-28" cy="36.6" r="0.8" fill="var(--line)" />
      <circle cx="-24.6" cy="36.6" r="0.8" fill="var(--line)" />
      <circle cx="-23.2" cy="38.3" r="0.3" fill="var(--detail)" />
      <circle cx="-16.4" cy="40.6" r="0.3" fill="var(--detail)" />
      <circle cx="-15.1" cy="43.1" r="0.3" fill="var(--line)" />
      <circle cx="2.3" cy="49.6" r="0.3" fill="var(--line)" />
      <path
        d="M14.6,29.6Q17.7,26.8 20.8,29.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-43.2,27Q-40.7,24.6 -38.1,27"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M13.1,11.1Q15.9,8.5 18.7,11.1"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15.4,42Q17.7,39.9 19.9,42"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M36.2,9.8Q36.2,7.8 36.6,7.6L36.6,7.6Q37,7.4 38.7,8.3L40.9,9.4Q42.7,10.3 42.7,12.3L42.7,18.3Q42.7,20.3 42.4,20.5L42.3,20.5Q42,20.7 40.2,19.8L38,18.7Q36.2,17.8 36.2,15.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M38.6,-5.7Q38.6,-6.1 38.9,-6.2L38.9,-6.2Q39.2,-6.4 39.5,-6.2L40,-6Q40.3,-5.8 40.3,-5.4L40.3,8.8Q40.3,9.2 40.1,9.3L40,9.4Q39.8,9.5 39.4,9.3L39,9.1Q38.6,8.9 38.6,8.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M37,-8.1Q37,-8.7 37.4,-8.9L37.5,-9Q37.9,-9.2 38.5,-8.9L41.4,-7.4Q41.9,-7.2 41.9,-6.6L41.9,-5.8Q41.9,-5.2 41.5,-5L41.4,-4.9Q41,-4.7 40.5,-5L37.6,-6.4Q37,-6.7 37,-7.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M31.6,18.2C34.1,15.2 35.1,14.2 37.3,14.2C39.5,14.2 40.5,15.2 43.1,18.2A5.8 2.9 0 0 1 31.6,18.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="33.1" cy="17" r="0.35" fill="var(--line)" />
      <circle cx="37.1" cy="19.9" r="0.35" fill="var(--line)" />
      <circle cx="41.7" cy="19.1" r="0.35" fill="var(--line)" />
      <path
        d="M-33.8,0.4A10.8 5.4 0 0 1 -12.2,0.4L-10.5,21.7A12.5 6.3 0 0 1 -35.5,21.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="-23"
        cy="0.4"
        rx="10.8"
        ry="5.4"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-19.8,-5.2Q-19.8,-5.7 -19.4,-6L-17.6,-6.8Q-17.1,-7.1 -16.7,-6.8L-14.9,-6Q-14.5,-5.7 -14.5,-5.2L-14.5,-3Q-14.5,-2.5 -14.9,-2.3L-16.7,-1.4Q-17.1,-1.2 -17.6,-1.4L-19.4,-2.3Q-19.8,-2.5 -19.8,-3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-31.5,-5.2Q-31.5,-5.7 -31,-6L-29.3,-6.8Q-28.8,-7.1 -28.4,-6.8L-26.6,-6Q-26.2,-5.7 -26.2,-5.2L-26.2,-3Q-26.2,-2.5 -26.6,-2.3L-28.4,-1.4Q-28.8,-1.2 -29.3,-1.4L-31,-2.3Q-31.5,-2.5 -31.5,-3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-31.5,0.6Q-31.5,0.1 -31,-0.1L-29.3,-1Q-28.8,-1.2 -28.4,-1L-26.6,-0.1Q-26.2,0.1 -26.2,0.6L-26.2,2.8Q-26.2,3.3 -26.6,3.6L-28.4,4.4Q-28.8,4.7 -29.3,4.4L-31,3.6Q-31.5,3.3 -31.5,2.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-19.8,0.6Q-19.8,0.1 -19.4,-0.1L-17.6,-1Q-17.1,-1.2 -16.7,-1L-14.9,-0.1Q-14.5,0.1 -14.5,0.6L-14.5,2.8Q-14.5,3.3 -14.9,3.6L-16.7,4.4Q-17.1,4.7 -17.6,4.4L-19.4,3.6Q-19.8,3.3 -19.8,2.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-13.1,23.4Q-13.1,25 -14.5,25.7L-14.8,25.9Q-16.3,26.6 -16.3,25L-16.3,21.5Q-16.3,19.9 -14.8,19.2L-14.5,19Q-13.1,18.3 -13.1,19.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-23.7,-23.6Q-23.7,-25.8 -23.4,-26L-23.3,-26Q-23,-26.2 -22.7,-26L-22.6,-26Q-22.3,-25.8 -22.3,-23.6L-22.3,-1.8Q-22.3,0.4 -22.6,0.6L-22.7,0.6Q-23,0.8 -23.3,0.6L-23.4,0.6Q-23.7,0.4 -23.7,-1.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="acc">
          <path
            d="M11.4,7.9A8 4 0 0 1 27.4,7.9L29.9,21.7A10.5 5.3 0 0 1 8.9,21.7Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="19.4"
            cy="7.9"
            rx="8"
            ry="4"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="acc">
          <path
            className="sb-cloth"
            d="M-22.6,-25.7L-22.2,-25.4L-21.7,-25.2L-21.3,-25L-20.9,-24.8L-20.4,-24.5L-20,-24.3L-19.5,-24.1L-19.1,-23.9L-18.7,-23.7L-18.2,-23.4L-17.8,-23.2L-17.3,-23L-16.9,-22.8L-16.4,-22.6L-16,-22.3L-15.6,-22.1L-15.1,-21.9L-14.7,-21.7L-14.7,-14.2L-15.1,-14.4L-15.6,-14.6L-16,-14.8L-16.4,-15.1L-16.9,-15.3L-17.3,-15.5L-17.8,-15.7L-18.2,-15.9L-18.7,-16.2L-19.1,-16.4L-19.5,-16.6L-20,-16.8L-20.4,-17L-20.9,-17.3L-21.3,-17.5L-21.7,-17.7L-22.2,-17.9L-22.6,-18.2Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <g className="sb-mark">
            <path
              d="M4.49805 11.6934C6.98237 11.6934 8.99609 13.7081 8.99609 16.1924C8.9959 18.6765 6.98225 20.6904 4.49805 20.6904C2.01394 20.6903 0.000196352 18.6765 0 16.1924C0 13.7081 2.01382 11.6935 4.49805 11.6934ZM10.3867 0C12.8709 0 14.8846 2.01388 14.8848 4.49805C14.8848 4.8377 14.847 5.16846 14.7755 5.48643C14.4618 6.88139 14.1953 8.4633 14.9928 9.65L16.2575 11.5319C16.3363 11.6491 16.4727 11.7115 16.6137 11.703C16.7369 11.6957 16.8525 11.6343 16.9214 11.5318L18.1876 9.64717C18.9772 8.47198 18.7236 6.90783 18.4205 5.52484C18.3523 5.21392 18.3164 4.89094 18.3164 4.55957C18.3167 2.07546 20.3313 0.0615234 22.8154 0.0615234C25.2994 0.0617476 27.3132 2.0756 27.3135 4.55957C27.3135 4.93883 27.2665 5.30712 27.178 5.65896C26.8547 6.94441 26.5817 8.37932 27.2446 9.52714L28.459 11.6301C28.4819 11.6697 28.5245 11.6934 28.5703 11.6934C31.0545 11.6935 33.0684 13.7081 33.0684 16.1924C33.0682 18.6765 31.0544 20.6903 28.5703 20.6904C26.0861 20.6904 24.0725 18.6765 24.0723 16.1924C24.0723 15.8049 24.1212 15.4288 24.2133 15.0701C24.5458 13.7746 24.8298 12.3251 24.1609 11.1668L23.0044 9.16384C22.9656 9.09659 22.8931 9.05859 22.8154 9.05859C22.7983 9.05859 22.7824 9.06614 22.7728 9.08033L21.4896 10.9895C20.686 12.1851 20.9622 13.781 21.284 15.1851C21.3582 15.5089 21.3975 15.8461 21.3975 16.1924C21.3973 18.6764 19.3834 20.6902 16.8994 20.6904C14.4152 20.6904 12.4006 18.6765 12.4004 16.1924C12.4004 15.932 12.4226 15.6768 12.4651 15.4286C12.6859 14.14 12.8459 12.7122 12.1167 11.6271L11.2419 10.3253C10.6829 9.49347 9.71913 9.05932 8.78286 8.70188C7.0906 8.05584 5.88867 6.41734 5.88867 4.49805C5.88886 2.0139 7.90254 3.29835e-05 10.3867 0Z"
              fill="var(--line)"
              transform="matrix(0.156,0.078,0,0.22059,-21.3,-23.7)"
            />
          </g>
        </g>
        <g className="fx fx-sb-bucket">
          <path
            d="M-11.3,-1.6A11.3 5.6 0 0 1 11.3,-1.6L11.3,0A11.3 5.6 0 0 1 -11.3,0Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-8.3,-16.1A8.3 4.1 0 0 1 8.3,-16.1L10.8,-1.6A10.8 5.4 0 0 1 -10.8,-1.6Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="0"
            cy="-16.1"
            rx="8.3"
            ry="4.1"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-8.8,-10.8A8.8 4.4 0 0 0 8.8,-10.8"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-12.4,-3.6Q-12.4,-4 -12.1,-4.2L-11.7,-4.4Q-11.4,-4.5 -11,-4.4L-10.7,-4.2Q-10.3,-4 -10.3,-3.6L-10.3,-2.1Q-10.3,-1.7 -10.7,-1.6L-11,-1.4Q-11.4,-1.2 -11.7,-1.4L-12.1,-1.6Q-12.4,-1.7 -12.4,-2.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-11.4,-2.8L-13.8,-0.4"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M10.3,-3.6Q10.3,-4 10.7,-4.2L11,-4.4Q11.4,-4.5 11.7,-4.4L12.1,-4.2Q12.4,-4 12.4,-3.6L12.4,-2.1Q12.4,-1.7 12.1,-1.6L11.7,-1.4Q11.4,-1.2 11,-1.4L10.7,-1.6Q10.3,-1.7 10.3,-2.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M11.4,-2.8L13.8,-0.4"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-13.8,-0.4A13.8 6.9 0 0 0 13.8,-0.4"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g className="fail">
        <path
          d="M-22.9,-23.3Q-22.9,-25.5 -22.7,-25.6L-22.6,-25.7Q-22.4,-25.8 -20.4,-24.8L-16.4,-22.8Q-14.4,-21.8 -14.4,-19.6L-14.4,-16.5Q-14.4,-14.3 -14.7,-14.2L-14.7,-14.2Q-14.9,-14 -16.9,-15L-20.9,-17Q-22.9,-18 -22.9,-20.2Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M4.49805 11.6934C6.98237 11.6934 8.99609 13.7081 8.99609 16.1924C8.9959 18.6765 6.98225 20.6904 4.49805 20.6904C2.01394 20.6903 0.000196352 18.6765 0 16.1924C0 13.7081 2.01382 11.6935 4.49805 11.6934ZM10.3867 0C12.8709 0 14.8846 2.01388 14.8848 4.49805C14.8848 4.8377 14.847 5.16846 14.7755 5.48643C14.4618 6.88139 14.1953 8.4633 14.9928 9.65L16.2575 11.5319C16.3363 11.6491 16.4727 11.7115 16.6137 11.703C16.7369 11.6957 16.8525 11.6343 16.9214 11.5318L18.1876 9.64717C18.9772 8.47198 18.7236 6.90783 18.4205 5.52484C18.3523 5.21392 18.3164 4.89094 18.3164 4.55957C18.3167 2.07546 20.3313 0.0615234 22.8154 0.0615234C25.2994 0.0617476 27.3132 2.0756 27.3135 4.55957C27.3135 4.93883 27.2665 5.30712 27.178 5.65896C26.8547 6.94441 26.5817 8.37932 27.2446 9.52714L28.459 11.6301C28.4819 11.6697 28.5245 11.6934 28.5703 11.6934C31.0545 11.6935 33.0684 13.7081 33.0684 16.1924C33.0682 18.6765 31.0544 20.6903 28.5703 20.6904C26.0861 20.6904 24.0725 18.6765 24.0723 16.1924C24.0723 15.8049 24.1212 15.4288 24.2133 15.0701C24.5458 13.7746 24.8298 12.3251 24.1609 11.1668L23.0044 9.16384C22.9656 9.09659 22.8931 9.05859 22.8154 9.05859C22.7983 9.05859 22.7824 9.06614 22.7728 9.08033L21.4896 10.9895C20.686 12.1851 20.9622 13.781 21.284 15.1851C21.3582 15.5089 21.3975 15.8461 21.3975 16.1924C21.3973 18.6764 19.3834 20.6902 16.8994 20.6904C14.4152 20.6904 12.4006 18.6765 12.4004 16.1924C12.4004 15.932 12.4226 15.6768 12.4651 15.4286C12.6859 14.14 12.8459 12.7122 12.1167 11.6271L11.2419 10.3253C10.6829 9.49347 9.71913 9.05932 8.78286 8.70188C7.0906 8.05584 5.88867 6.41734 5.88867 4.49805C5.88886 2.0139 7.90254 3.29835e-05 10.3867 0Z"
          fill="var(--line)"
          transform="matrix(0.156,0.078,0,0.22059,-21.6,-23.6)"
        />
        <g className="fx fx-sb-pile">
          <g className="acc">
            <path
              d="M6.2,21.7C12.2,17 14.4,15.4 19.4,15.4C24.5,15.4 26.7,17 32.7,21.7A13.3 6.6 0 0 1 6.2,21.7Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sb-slump">
          <g className="acc">
            <path
              d="M11.4,7.9A8 4 0 0 1 27.4,7.9L29.9,21.7A10.5 5.3 0 0 1 8.9,21.7Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="19.4"
              cy="7.9"
              rx="8"
              ry="4"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M19.4,11.9L18.6,15.9L20.1,20.1L19.2,24.1"
              pathLength="1"
              strokeDasharray="1"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sb-grain0">
          <g className="acc">
            <path
              d="M0.9,-0.2Q1,0 0.9,0.2L0.8,0.2Q0.7,0.4 0.6,0.6L0.5,0.6Q0.4,0.8 0.2,0.7L0.1,0.7Q-0.1,0.7 -0.4,0.7L-0.4,0.7Q-0.7,0.7 -0.8,0.5L-0.8,0.4Q-0.8,0.2 -0.9,0L-0.9,0Q-0.9,-0.2 -0.7,-0.4L-0.7,-0.4Q-0.5,-0.5 -0.3,-0.7L-0.3,-0.7Q-0.1,-0.9 0.1,-0.8L0.1,-0.8Q0.4,-0.7 0.6,-0.6L0.6,-0.6Q0.8,-0.4 0.9,-0.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-0.6,-0.3L-0.1,0.1L0.3,-0.5M-0.2,0.6L0.1,0.1L0.6,0.3M-0.7,0.3L-0.3,0.2"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sb-grain1">
          <g className="acc">
            <path
              d="M1.3,-0.3Q1.5,0 1.3,0.3L1.2,0.3Q1,0.6 0.8,0.9L0.8,0.9Q0.6,1.2 0.3,1.1L0.2,1.1Q-0.2,1 -0.6,1.1L-0.6,1.1Q-1,1.1 -1.1,0.7L-1.1,0.7Q-1.2,0.3 -1.3,0L-1.3,0Q-1.4,-0.4 -1.1,-0.5L-1,-0.6Q-0.7,-0.8 -0.5,-1L-0.4,-1.1Q-0.2,-1.4 0.1,-1.2L0.2,-1.2Q0.5,-1.1 0.8,-0.9L0.9,-0.9Q1.2,-0.7 1.3,-0.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-0.8,-0.5L-0.2,0.1L0.5,-0.7M-0.3,0.8L0.1,0.2L0.9,0.4M-1,0.4L-0.4,0.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sb-grain2">
          <g className="acc">
            <path
              d="M0.9,-0.2Q1,0 0.9,0.2L0.8,0.2Q0.7,0.4 0.6,0.6L0.5,0.6Q0.4,0.8 0.2,0.7L0.1,0.7Q-0.1,0.7 -0.4,0.7L-0.4,0.7Q-0.7,0.7 -0.8,0.5L-0.8,0.4Q-0.8,0.2 -0.9,0L-0.9,0Q-0.9,-0.2 -0.7,-0.4L-0.7,-0.4Q-0.5,-0.5 -0.3,-0.7L-0.3,-0.7Q-0.1,-0.9 0.1,-0.8L0.1,-0.8Q0.4,-0.7 0.6,-0.6L0.6,-0.6Q0.8,-0.4 0.9,-0.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-0.6,-0.3L-0.1,0.1L0.3,-0.5M-0.2,0.6L0.1,0.1L0.6,0.3M-0.7,0.3L-0.3,0.2"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sb-grain3">
          <g className="acc">
            <path
              d="M1.3,-0.3Q1.5,0 1.3,0.3L1.2,0.3Q1,0.6 0.8,0.9L0.8,0.9Q0.6,1.2 0.3,1.1L0.2,1.1Q-0.2,1 -0.6,1.1L-0.6,1.1Q-1,1.1 -1.1,0.7L-1.1,0.7Q-1.2,0.3 -1.3,0L-1.3,0Q-1.4,-0.4 -1.1,-0.5L-1,-0.6Q-0.7,-0.8 -0.5,-1L-0.4,-1.1Q-0.2,-1.4 0.1,-1.2L0.2,-1.2Q0.5,-1.1 0.8,-0.9L0.9,-0.9Q1.2,-0.7 1.3,-0.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-0.8,-0.5L-0.2,0.1L0.5,-0.7M-0.3,0.8L0.1,0.2L0.9,0.4M-1,0.4L-0.4,0.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sb-grain4">
          <g className="acc">
            <path
              d="M0.9,-0.2Q1,0 0.9,0.2L0.8,0.2Q0.7,0.4 0.6,0.6L0.5,0.6Q0.4,0.8 0.2,0.7L0.1,0.7Q-0.1,0.7 -0.4,0.7L-0.4,0.7Q-0.7,0.7 -0.8,0.5L-0.8,0.4Q-0.8,0.2 -0.9,0L-0.9,0Q-0.9,-0.2 -0.7,-0.4L-0.7,-0.4Q-0.5,-0.5 -0.3,-0.7L-0.3,-0.7Q-0.1,-0.9 0.1,-0.8L0.1,-0.8Q0.4,-0.7 0.6,-0.6L0.6,-0.6Q0.8,-0.4 0.9,-0.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-0.6,-0.3L-0.1,0.1L0.3,-0.5M-0.2,0.6L0.1,0.1L0.6,0.3M-0.7,0.3L-0.3,0.2"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sb-dust0">
          <circle
            cx="19.1"
            cy="18.6"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-sb-dust1">
          <circle
            cx="16.8"
            cy="17.4"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-sb-dust2">
          <circle
            cx="14.5"
            cy="16.1"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-sb-bucket2">
          <path
            d="M-11.3,-1.6A11.3 5.6 0 0 1 11.3,-1.6L11.3,0A11.3 5.6 0 0 1 -11.3,0Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-8.3,-16.1A8.3 4.1 0 0 1 8.3,-16.1L10.8,-1.6A10.8 5.4 0 0 1 -10.8,-1.6Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="0"
            cy="-16.1"
            rx="8.3"
            ry="4.1"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-8.8,-10.8A8.8 4.4 0 0 0 8.8,-10.8"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-12.4,-3.6Q-12.4,-4 -12.1,-4.2L-11.7,-4.4Q-11.4,-4.5 -11,-4.4L-10.7,-4.2Q-10.3,-4 -10.3,-3.6L-10.3,-2.1Q-10.3,-1.7 -10.7,-1.6L-11,-1.4Q-11.4,-1.2 -11.7,-1.4L-12.1,-1.6Q-12.4,-1.7 -12.4,-2.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-11.4,-2.8L-13.8,-0.4"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M10.3,-3.6Q10.3,-4 10.7,-4.2L11,-4.4Q11.4,-4.5 11.7,-4.4L12.1,-4.2Q12.4,-4 12.4,-3.6L12.4,-2.1Q12.4,-1.7 12.1,-1.6L11.7,-1.4Q11.4,-1.2 11,-1.4L10.7,-1.6Q10.3,-1.7 10.3,-2.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M11.4,-2.8L13.8,-0.4"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-13.8,-0.4A13.8 6.9 0 0 0 13.8,-0.4"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <path
        d="M-63.6,21.2Q-63.6,20.6 -63.1,20.3L-61,19.3Q-60.5,19 -59.9,19.3L-0.5,48.9Q0,49.2 0,49.8L0,59.9Q0,60.5 -0.5,60.7L-2.6,61.8Q-3.2,62.1 -3.7,61.8L-63.1,32.1Q-63.6,31.8 -63.6,31.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.2,51.4Q-3.2,50.8 -2.6,50.5L59.9,19.3Q60.5,19 61,19.3L63.1,20.3Q63.6,20.6 63.6,21.2L63.6,31.2Q63.6,31.8 63.1,32.1L0.5,63.4Q0,63.6 -0.5,63.4L-2.6,62.3Q-3.2,62.1 -3.2,61.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-60.5,27.8L-3.2,56.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M63.6,26.2L0,58"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-28.3,49.5L-28.3,43.9M-44.2,35.9L-44.2,30.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M37.1,45.1L37.1,39.5M19.4,48.3L19.4,42.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="-29.5" cy="46.1" r="0.32" fill="var(--line)" />
      <circle cx="-27.1" cy="47.3" r="0.32" fill="var(--line)" />
      <circle cx="-45.4" cy="32.5" r="0.32" fill="var(--line)" />
      <circle cx="-43" cy="33.7" r="0.32" fill="var(--line)" />
      <circle cx="38.4" cy="41.7" r="0.32" fill="var(--line)" />
      <circle cx="35.9" cy="42.9" r="0.32" fill="var(--line)" />
      <circle cx="20.7" cy="44.9" r="0.32" fill="var(--line)" />
      <circle cx="18.2" cy="46.1" r="0.32" fill="var(--line)" />
      <path
        d="M-65.4,19.7Q-65.4,19.1 -64.9,18.8L-60.6,16.7Q-60.1,16.4 -59.6,16.7L0.2,46.6Q0.7,46.8 0.7,47.4L0.7,47.7Q0.7,48.3 0.2,48.6L-4.1,50.7Q-4.6,51 -5.1,50.7L-64.9,20.8Q-65.4,20.6 -65.4,20Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-5.3,49.7Q-5.3,49.1 -4.8,48.9L59.6,16.7Q60.1,16.4 60.6,16.7L64.9,18.8Q65.4,19.1 65.4,19.7L65.4,20Q65.4,20.6 64.9,20.8L0.5,53Q0,53.3 -0.5,53L-4.8,50.9Q-5.3,50.6 -5.3,50Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}
