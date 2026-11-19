import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function VaultScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="28.7" cy="27.6" r="63.1">
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
          d="M-32.8,13.1C-33.5,9.6 -22,7.7 -16.6,5C-11.2,2.2 -3.7,-2 -0.4,-3.2C2.8,-4.5 1.7,-2.6 2.8,-2.3C3.9,-1.9 0.8,-3.2 6.1,-1.3C11.4,0.6 25,5.5 34.4,9C43.9,12.5 56.8,17.4 62.8,19.8C68.7,22.2 67.6,22.3 70,23.5C72.5,24.7 77.4,25.5 77.3,27.2C77.2,28.9 72.1,31.6 69.5,33.8C66.9,36 63.2,39.2 61.7,40.5C60.3,41.7 61.1,40.9 60.7,41.2C60.4,41.4 60.1,41.7 59.7,41.9C59.3,42.1 58.8,42.2 58.4,42.4C57.9,42.5 59.5,42.3 57,42.9C54.5,43.5 47.9,44.9 43.3,45.9C38.7,46.8 32.3,48.4 29.4,48.7C26.5,49 27.2,48.1 26.1,47.7C24.9,47.4 24.5,47.5 22.7,46.7C20.9,45.9 17.7,44.2 15.3,42.9C12.8,41.7 12.6,41.9 7.9,39.1C3.3,36.3 -5.7,30.4 -12.4,26C-19.2,21.7 -32.1,16.6 -32.8,13.1Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-3.5,1.4Q-3.5,0.4 -2.6,0L-0.9,-0.9Q0,-1.4 0.9,-0.9L2.6,0Q3.5,0.4 3.5,1.4L3.5,2.5Q3.5,3.5 2.6,4L0.9,4.9Q0,5.3 -0.9,4.9L-2.6,4Q-3.5,3.5 -3.5,2.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-23,11.1Q-23,10.1 -22.1,9.7L-20.3,8.8Q-19.4,8.4 -18.6,8.8L-16.8,9.7Q-15.9,10.1 -15.9,11.1L-15.9,12.3Q-15.9,13.3 -16.8,13.7L-18.6,14.6Q-19.4,15 -20.3,14.6L-22.1,13.7Q-23,13.3 -23,12.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15.9,11.1Q15.9,10.1 16.8,9.7L18.6,8.8Q19.4,8.4 20.3,8.8L22.1,9.7Q23,10.1 23,11.1L23,12.3Q23,13.3 22.1,13.7L20.3,14.6Q19.4,15 18.6,14.6L16.8,13.7Q15.9,13.3 15.9,12.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.5,20.9Q-3.5,19.9 -2.6,19.4L-0.9,18.5Q0,18.1 0.9,18.5L2.6,19.4Q3.5,19.9 3.5,20.9L3.5,22Q3.5,23 2.6,23.4L0.9,24.3Q0,24.8 -0.9,24.3L-2.6,23.4Q-3.5,23 -3.5,22Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-26.5,-31.9Q-26.5,-34.9 -23.8,-36.2L-2.7,-46.8Q0,-48.1 2.7,-46.8L23.8,-36.2Q26.5,-34.9 26.5,-31.9L26.5,7.1Q26.5,10.1 23.8,11.5L2.7,22.1Q0,23.4 -2.7,22.1L-23.8,11.5Q-26.5,10.1 -26.5,7.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M24.8,-34L1.8,-22.5Q0,-21.6 -1.8,-22.5L-24.8,-34"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,-42.8L-15.9,-34.9"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="-23.9" cy="9" r="0.42" fill="var(--line)" />
      <circle cx="-19.1" cy="11.3" r="0.42" fill="var(--line)" />
      <circle cx="-14.3" cy="13.7" r="0.42" fill="var(--line)" />
      <circle cx="-9.5" cy="16.1" r="0.42" fill="var(--line)" />
      <circle cx="-4.8" cy="18.5" r="0.42" fill="var(--line)" />
      <circle cx="-23.9" cy="-31" r="0.42" fill="var(--line)" />
      <circle cx="-19.1" cy="-28.7" r="0.42" fill="var(--line)" />
      <circle cx="-14.3" cy="-26.3" r="0.42" fill="var(--line)" />
      <g transform="matrix(0.884,0.442,0,1.25,-16.4,-7.3)">
        <circle
          r="10.4"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          r="9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          r="6.8"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="7.9" cy="0" r=".45" fill="var(--line)" />
        <circle cx="6.4" cy="4.6" r=".45" fill="var(--line)" />
        <circle cx="2.4" cy="7.5" r=".45" fill="var(--line)" />
        <circle cx="-2.4" cy="7.5" r=".45" fill="var(--line)" />
        <circle cx="-6.4" cy="4.6" r=".45" fill="var(--line)" />
        <circle cx="-7.9" cy="0" r=".45" fill="var(--line)" />
        <circle cx="-6.4" cy="-4.6" r=".45" fill="var(--line)" />
        <circle cx="-2.4" cy="-7.5" r=".45" fill="var(--line)" />
        <circle cx="2.4" cy="-7.5" r=".45" fill="var(--line)" />
        <circle cx="6.4" cy="-4.6" r=".45" fill="var(--line)" />
        <circle
          r="5.4"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M1.1,1.1L3.8,3.8M-1.1,1.1L-3.8,3.8M-1.1,-1.1L-3.8,-3.8M1.1,-1.1L3.8,-3.8"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          r="1.6"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M-27.2,-6.1A1.5 0.8 0 0 1 -24.2,-6.1L-24.2,-1.1A1.5 0.8 0 0 1 -27.2,-1.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="-25.7"
        cy="-6.1"
        rx="1.5"
        ry="0.8"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-27.2,-21.1A1.5 0.8 0 0 1 -24.2,-21.1L-24.2,-16.1A1.5 0.8 0 0 1 -27.2,-16.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="-25.7"
        cy="-21.1"
        rx="1.5"
        ry="0.8"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g transform="matrix(0.884,0.442,0,1.25,-4.8,-17)">
        <circle
          r="5.2"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          r="3.6"
          fill="var(--hole)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <g className="acc">
        <g transform="matrix(0.884,0.442,0,1.25,-4.9,-16.9)">
          <circle
            r="2.2"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle r="0.9" fill="var(--line)" />
          <circle cx="1.2" cy="-1.2" r=".45" fill="var(--line)" />
        </g>
      </g>
      <path
        d="M21.9,4.3Q21.9,5.9 20.5,6.6L20.2,6.8Q18.7,7.5 18.7,5.9L18.7,4.6Q18.7,3 20.2,2.3L20.5,2.1Q21.9,1.4 21.9,3Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M22.6,-0.2L18,2.1"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14.9,7.9Q14.9,9.5 13.4,10.2L13.1,10.3Q11.7,11.1 11.7,9.5L11.7,8.2Q11.7,6.6 13.1,5.8L13.4,5.7Q14.9,5 14.9,6.6Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15.6,3.4L11,5.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M7.8,11.4Q7.8,13 6.3,13.7L6,13.9Q4.6,14.6 4.6,13L4.6,11.7Q4.6,10.1 6,9.4L6.3,9.2Q7.8,8.5 7.8,10.1Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8.5,6.9L3.9,9.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <path
          d="M20.8,4.7C24.2,8.7 39.5,13.1 54.8,13.5"
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
          style={s({ offsetPath: "path('M20.8,4.7C24.2,8.7 39.5,13.1 54.8,13.5')", '--at': '15%', '--delay': '0s' })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
        <g
          className="packet"
          style={s({ offsetPath: "path('M20.8,4.7C24.2,8.7 39.5,13.1 54.8,13.5')", '--at': '55%', '--delay': '-1.2s' })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
        <path
          d="M13.7,8.2C16.8,14.6 30.5,21.7 44.2,22.4"
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
          style={s({ offsetPath: "path('M13.7,8.2C16.8,14.6 30.5,21.7 44.2,22.4')", '--at': '15%', '--delay': '0s' })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
        <g
          className="packet"
          style={s({
            offsetPath: "path('M13.7,8.2C16.8,14.6 30.5,21.7 44.2,22.4')",
            '--at': '55%',
            '--delay': '-1.2s',
          })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
        <path
          d="M6.6,11.8C8.2,18.7 15.1,26.4 22.1,27.2"
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
          style={s({ offsetPath: "path('M6.6,11.8C8.2,18.7 15.1,26.4 22.1,27.2')", '--at': '15%', '--delay': '0s' })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
        <g
          className="packet"
          style={s({ offsetPath: "path('M6.6,11.8C8.2,18.7 15.1,26.4 22.1,27.2')", '--at': '55%', '--delay': '-1.2s' })}
        >
          <circle r="2.6" fill="var(--packet)" />
        </g>
        <clipPath id={`${id}-vt-scan-c`}>
          <path d="M-8.1,-18.5L-8,-19.4L-7.8,-20.1L-7.6,-20.7L-7.2,-21.2L-6.7,-21.6L-6.1,-21.7L-5.5,-21.6L-4.9,-21.4L-4.3,-21L-3.7,-20.5L-3.1,-19.8L-2.7,-19L-2.3,-18.1L-2,-17.2L-1.8,-16.2L-1.7,-15.3L-1.8,-14.5L-2,-13.7L-2.3,-13.1L-2.7,-12.6L-3.1,-12.3L-3.7,-12.2L-4.3,-12.2L-4.9,-12.4L-5.5,-12.8L-6.1,-13.4L-6.7,-14.1L-7.2,-14.9L-7.6,-15.7L-7.8,-16.7L-8,-17.6Z" />
        </clipPath>
        <g clipPath={`url(#${id}-vt-scan-c)`}>
          <g className="fx fx-vt-scan">
            <g className="acc">
              <path
                d="M-8.1,-23L-1.8,-19.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        </g>
      </g>
      <path
        d="M46.9,15.7Q46.9,13.9 48.5,13.1L54.1,10.3Q55.7,9.5 57.3,10.3L62.9,13.1Q64.5,13.9 64.5,15.7L64.5,23.4Q64.5,25.2 62.9,26L57.3,28.8Q55.7,29.6 54.1,28.8L48.5,26Q46.9,25.2 46.9,23.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M62.8,14.8L57.5,17.5Q55.7,18.4 53.9,17.5L48.6,14.8"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M49,18.8L53.6,21.1M49,21.8L52.5,23.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M38.3,29.3A6.8 3.4 0 0 1 51.9,29.3L51.9,35.8A6.8 3.4 0 0 1 38.3,35.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="45.1"
        cy="29.3"
        rx="6.8"
        ry="3.4"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M38.3,32.6A6.8 3.4 0 0 0 51.9,32.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M38.3,22.8A6.8 3.4 0 0 1 51.9,22.8L51.9,29.3A6.8 3.4 0 0 1 38.3,29.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="45.1"
        cy="22.8"
        rx="6.8"
        ry="3.4"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14.1,29.4Q14.1,27.6 15.8,26.8L21.4,24Q23,23.2 24.6,24L30.2,26.8Q31.8,27.6 31.8,29.4L31.8,37.1Q31.8,38.9 30.2,39.7L24.6,42.5Q23,43.3 21.4,42.5L15.8,39.7Q14.1,38.9 14.1,37.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M30.1,28.5L24.8,31.2Q23,32.1 21.2,31.2L15.9,28.5"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M16.3,32.5L20.9,34.8M16.3,35.5L19.8,37.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="fail">
        <path
          d="M20.8,4.7C24.2,8.7 39.5,13.1 54.8,13.5"
          fill="none"
          stroke="var(--line)"
          strokeDasharray="3 4"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M13.7,8.2C16.8,14.6 30.5,21.7 44.2,22.4"
          fill="none"
          stroke="var(--line)"
          strokeDasharray="3 4"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M6.6,11.8C8.2,18.7 15.1,26.4 22.1,27.2"
          fill="none"
          stroke="var(--line)"
          strokeDasharray="3 4"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <clipPath id={`${id}-vt-scan2-c`}>
          <path d="M-8.1,-18.5L-8,-19.4L-7.8,-20.1L-7.6,-20.7L-7.2,-21.2L-6.7,-21.6L-6.1,-21.7L-5.5,-21.6L-4.9,-21.4L-4.3,-21L-3.7,-20.5L-3.1,-19.8L-2.7,-19L-2.3,-18.1L-2,-17.2L-1.8,-16.2L-1.7,-15.3L-1.8,-14.5L-2,-13.7L-2.3,-13.1L-2.7,-12.6L-3.1,-12.3L-3.7,-12.2L-4.3,-12.2L-4.9,-12.4L-5.5,-12.8L-6.1,-13.4L-6.7,-14.1L-7.2,-14.9L-7.6,-15.7L-7.8,-16.7L-8,-17.6Z" />
        </clipPath>
        <g clipPath={`url(#${id}-vt-scan2-c)`}>
          <g className="fx fx-vt-scan2">
            <g className="acc">
              <path
                d="M-8.1,-23L-1.8,-19.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        </g>
        <clipPath id={`${id}-vt-slots`}>
          <path d="M18,2.1L22.6,-0.2L23.5,0.3L23.5,7L18.9,9.3L18,8.9Z" />
          <path d="M11,5.7L15.6,3.4L16.4,3.8L16.4,10.6L11.8,12.9L11,12.4Z" />
          <path d="M3.9,9.2L8.5,6.9L9.4,7.3L9.4,14.1L4.8,16.4L3.9,16Z" />
        </clipPath>
        <g clipPath={`url(#${id}-vt-slots)`}>
          <g className="fx fx-vt-shut">
            <g className="acc">
              <path
                d="M18.2,3.1Q18.2,2.5 18.7,2.3L21.9,0.7Q22.5,0.4 22.8,0.6L22.8,0.6Q23.2,0.8 23.2,1.4L23.2,6.2Q23.2,6.8 22.6,7L19.5,8.6Q18.9,8.9 18.6,8.7L18.5,8.7Q18.2,8.5 18.2,7.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M11.1,6.7Q11.1,6.1 11.7,5.8L14.8,4.2Q15.4,4 15.7,4.1L15.8,4.1Q16.1,4.3 16.1,4.9L16.1,9.7Q16.1,10.3 15.6,10.6L12.4,12.2Q11.8,12.4 11.5,12.3L11.5,12.2Q11.1,12.1 11.1,11.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M4.1,10.2Q4.1,9.6 4.6,9.3L7.8,7.8Q8.3,7.5 8.6,7.7L8.7,7.7Q9,7.8 9,8.4L9,13.2Q9,13.8 8.5,14.1L5.3,15.7Q4.8,16 4.5,15.8L4.4,15.8Q4.1,15.6 4.1,15Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        </g>
        <g className="fx fx-vt-hit">
          <g className="acc">
            <path
              d="M17.6,5.8L21,6.4M16.3,7.6L20.1,11.5M14.1,8.2L14,11.2M11.8,7.5L7.9,11.3M10.7,5.7L7.2,6.1M11.2,3.6L6,1M13,2.4L11.9,-0.4M15.4,2.4L17.6,-2.3M17.2,3.8L20.3,2.4"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
      </g>
    </>
  );
}
