import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function GatewayScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="28.3" cy="6.5" r="67.6">
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
          d="M-38.1,19.6C-36.9,15.4 -21,9.2 -12.4,3.9C-3.9,-1.3 7.5,-8.5 13.4,-11.9C19.2,-15.3 19.5,-15 22.6,-16.6C25.7,-18.1 29.7,-20.5 31.8,-21.1C33.9,-21.7 34,-20.4 35.2,-20.1C36.3,-19.8 35,-20.7 38.5,-19.1C41.9,-17.5 50,-13.3 55.8,-10.4C61.5,-7.5 68.7,-3.8 72.9,-1.7C77,0.5 78.2,1 80.8,2.4C83.5,3.7 89,5 88.8,6.4C88.6,7.8 82.8,9.4 79.8,11C76.8,12.5 77.6,12.7 70.7,15.6C63.9,18.5 49.3,24.2 38.5,28.4C27.7,32.6 12.1,38.8 6.1,40.7C0.2,42.5 3.9,40 2.9,39.6C1.8,39.3 3.3,40.4 -0.4,38.6C-4.1,36.8 -13,32.2 -19.3,29.1C-25.6,25.9 -39.2,23.7 -38.1,19.6Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M19.4,-21.8Q19.4,-24 21.4,-25L29.9,-29.2Q31.8,-30.2 33.8,-29.2L42.2,-25Q44.2,-24 44.2,-21.8L44.2,-13.7Q44.2,-11.5 42.2,-10.5L33.8,-6.3Q31.8,-5.3 29.9,-6.3L21.4,-10.5Q19.4,-11.5 19.4,-13.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M42.4,-23.1L33.6,-18.7Q31.8,-17.8 30.1,-18.7L21.2,-23.1"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M31.8,-26.6L37.1,-24"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M35.4,-13.8Q35.4,-16 37.3,-17L45.8,-21.2Q47.7,-22.2 49.7,-21.2L58.1,-17Q60.1,-16 60.1,-13.8L60.1,-5.7Q60.1,-3.5 58.1,-2.6L49.7,1.7Q47.7,2.7 45.8,1.7L37.3,-2.6Q35.4,-3.5 35.4,-5.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M58.3,-15.2L49.5,-10.7Q47.7,-9.8 46,-10.7L37.1,-15.2"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M47.7,-18.7L53,-16"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M51.3,-5.9Q51.3,-8.1 53.2,-9.1L61.7,-13.3Q63.6,-14.3 65.6,-13.3L74.1,-9.1Q76,-8.1 76,-5.9L76,2.2Q76,4.4 74.1,5.4L65.6,9.6Q63.6,10.6 61.7,9.6L53.2,5.4Q51.3,4.4 51.3,2.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M74.3,-7.2L65.4,-2.8Q63.6,-1.9 61.9,-2.8L53,-7.2"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M63.6,-10.7L69,-8.1"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8.8,0C10.5,-2.9 22.3,-13.9 25.6,-14.6"
        fill="none"
        stroke="var(--line)"
        strokeDasharray="3 4"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g
        className="packet"
        style={s({ offsetPath: "path('M8.8,0C10.5,-2.9 22.3,-13.9 25.6,-14.6')", '--at': '50%', '--delay': '0s' })}
      >
        <circle r="2.6" fill="var(--packet)" />
      </g>
      <path
        d="M8.8,0C13.7,0.3 47.7,1.2 57.5,1.3"
        fill="none"
        stroke="var(--line)"
        strokeDasharray="3 4"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g
        className="packet"
        style={s({ offsetPath: "path('M8.8,0C13.7,0.3 47.7,1.2 57.5,1.3')", '--at': '50%', '--delay': '0s' })}
      >
        <circle r="2.6" fill="var(--packet)" />
      </g>
      <g className="okonly">
        <path
          d="M8.8,0C12.1,-1.3 35,-6.4 41.5,-6.7"
          fill="none"
          stroke="var(--line)"
          strokeDasharray="3 4"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g
          className="packet"
          style={s({ offsetPath: "path('M8.8,0C12.1,-1.3 35,-6.4 41.5,-6.7')", '--at': '50%', '--delay': '0s' })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
      </g>
      <g className="fail">
        <g className="fx fx-gw-link">
          <g className="acc">
            <path
              d="M8.8,0C12.1,-1.3 35,-6.4 41.5,-6.7"
              fill="none"
              stroke="var(--line)"
              strokeDasharray="3 4"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-gw-s1">
          <g className="acc">
            <path
              d="M8.8,0C10.1,-0.5 18.7,-2.3 21.2,-2.4"
              fill="none"
              stroke="var(--line)"
              strokeDasharray="3 4"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-gw-s2">
          <g className="acc">
            <path
              d="M32.7,-3.5C33.6,-4.2 39.8,-6.5 41.5,-6.7"
              fill="none"
              stroke="var(--line)"
              strokeDasharray="3 4"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g
          className="fx fx-gw-pk"
          style={s({ offsetPath: "path('M8.8,0C12.1,-1.3 35,-6.4 41.5,-6.7')", offsetRotate: '0deg' })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
        <g className="fx fx-gw-snap">
          <g className="acc">
            <path
              d="M28.6,-2.1L32.1,-1.5M27.4,-0.4L31.1,3.6M25.1,0.3L25,3.2M22.9,-0.5L18.9,3.3M21.7,-2.3L18.3,-1.8M22.2,-4.3L17.1,-6.9M24.1,-5.6L23,-8.3M26.5,-5.5L28.7,-10.2M28.3,-4.1L31.3,-5.5"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-gw-smoke0">
          <circle
            cx="26.6"
            cy="-4.7"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-gw-smoke1">
          <circle
            cx="24.3"
            cy="-5.9"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-gw-smoke2">
          <circle
            cx="22"
            cy="-7.1"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <path
        d="M-31.8,6.6Q-31.8,4.4 -29.9,3.5L-2,-10.5Q0,-11.5 2,-10.5L29.9,3.5Q31.8,4.4 31.8,6.6L31.8,17.2Q31.8,19.4 29.9,20.4L2,34.4Q0,35.4 -2,34.4L-29.9,20.4Q-31.8,19.4 -31.8,17.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M30.1,5.3L1.8,19.5Q0,20.4 -1.8,19.5L-30.1,5.3"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-28.3,13.7L-19.4,18.1"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-17.7,15.4Q-17.7,16.5 -16.9,16.9L-16.7,17Q-15.9,17.4 -15.9,16.3L-15.9,16Q-15.9,14.9 -16.7,14.5L-16.9,14.4Q-17.7,14 -17.7,15.2Z"
        fill="var(--line)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-12.4,18Q-12.4,19.2 -11.6,19.6L-11.4,19.7Q-10.6,20.1 -10.6,18.9L-10.6,18.7Q-10.6,17.6 -11.4,17.2L-11.6,17.1Q-12.4,16.7 -12.4,17.8Z"
        fill="var(--line)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-7.1,20.7Q-7.1,21.8 -6.3,22.2L-6.1,22.3Q-5.3,22.7 -5.3,21.6L-5.3,21.3Q-5.3,20.2 -6.1,19.8L-6.3,19.7Q-7.1,19.3 -7.1,20.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="fail">
        <g className="fx fx-gw-lamp">
          <g className="acc">
            <path
              d="M-7.1,20.7Q-7.1,21.8 -6.3,22.2L-6.1,22.3Q-5.3,22.7 -5.3,21.6L-5.3,21.3Q-5.3,20.2 -6.1,19.8L-6.3,19.7Q-7.1,19.3 -7.1,20.5Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
      </g>
      <g className="acc">
        <path
          d="M-17.7,2.4Q-17.7,0.7 -15.7,-0.3L-2,-7.2Q0,-8.1 2,-7.2L15.7,-0.3Q17.7,0.7 17.7,2.4L17.7,2.7Q17.7,4.4 15.7,5.4L2,12.3Q0,13.3 -2,12.3L-15.7,5.4Q-17.7,4.4 -17.7,2.7Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M15.9,1.6L1.8,8.7Q0,9.5 -1.8,8.7L-15.9,1.6"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-1.8,-3.7L8.8,1.6M-7.1,-1.1L0,2.5"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M-46,37.4C-43,33.9 -21.9,20.8 -15.9,19.9"
        fill="none"
        stroke="var(--line)"
        strokeDasharray="3 4"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g
        className="packet"
        style={s({ offsetPath: "path('M-46,37.4C-43,33.9 -21.9,20.8 -15.9,19.9')", '--at': '35%', '--delay': '0s' })}
      >
        <circle r="2.6" fill="var(--packet)" />
      </g>
      <g
        className="packet"
        style={s({ offsetPath: "path('M-46,37.4C-43,33.9 -21.9,20.8 -15.9,19.9')", '--at': '70%', '--delay': '-1.2s' })}
      >
        <circle r="2.6" fill="var(--packet)" />
      </g>
    </>
  );
}
