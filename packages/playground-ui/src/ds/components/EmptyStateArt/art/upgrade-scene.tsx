import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function UpgradeScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="-3.3" cy="34.7" r="75.6">
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
          d="M-78.7,29.1C-81,26.3 -72.1,25.8 -68.8,24.1C-65.5,22.5 -65.5,21.8 -58.9,19.1C-52.4,16.4 -39.4,11.6 -29.6,7.8C-19.8,4.1 -5.5,-1.7 0,-3.4C5.5,-5.1 2.2,-2.8 3.3,-2.4C4.4,-2.1 1.1,-4.1 6.6,-1.4C12.1,1.2 26.5,8.6 36.4,13.5C46.2,18.5 62.1,24.3 65.8,28.5C69.5,32.6 61.1,35.2 58.7,38.6C56.3,41.9 52.9,46.9 51.6,48.7C50.2,50.5 50.9,49.1 50.6,49.3C50.3,49.6 53.9,48.4 49.7,50C45.5,51.6 33.7,56.1 25.6,59.1C17.5,62.1 5.8,66.8 1.2,68.2C-3.4,69.5 -1,67.5 -2.1,67.2C-3.2,66.9 -2.6,67.5 -5.4,66.2C-8.2,64.9 -14.4,61.7 -18.9,59.4C-23.4,57.2 -26.2,55.7 -32.4,52.6C-38.5,49.5 -47.9,44.7 -55.6,40.8C-63.3,36.9 -76.5,31.9 -78.7,29.1Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-38.9,-28.4Q-38.9,-30.6 -36.9,-31.5L-2,-49Q0,-50 2,-49L51.1,-24.5Q53,-23.5 53,-21.3L53,24.3Q53,26.5 51.1,27.5L16.1,45Q14.1,46 12.2,45L-36.9,20.4Q-38.9,19.4 -38.9,17.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-37.1,-29.7L12.4,-4.9Q14.1,-4 15.9,-4.9L51.3,-22.6"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-19.4,-30.3Q-19.4,-30.9 -17.5,-31.9L-0.2,-40.5Q1.8,-41.5 3.7,-40.5L31.6,-26.6Q33.6,-25.6 33.6,-25L33.6,-24.9Q33.6,-24.4 31.6,-23.4L14.3,-14.7Q12.4,-13.8 10.4,-14.7L-17.5,-28.7Q-19.4,-29.7 -19.4,-30.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M-19.4,-29.7L12.4,-13.8L12.4,-27.4L-37.1,-52.2Z" fill="var(--face)" stroke="none" />
      <path d="M33.6,-24.4L12.4,-13.8L12.4,-27.4L51.3,-46.9Z" fill="var(--face)" stroke="none" />
      <path
        d="M-35.8,-50.4Q-37.1,-52.2 -35.2,-53.2L-0.2,-70.6Q1.8,-71.6 3.7,-70.6L49.3,-47.8Q51.3,-46.9 49.9,-45.1L35,-26.1Q33.6,-24.4 31.6,-23.4L14.3,-14.7Q12.4,-13.8 10.4,-14.7L-17.5,-28.7Q-19.4,-29.7 -20.8,-31.4Z"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0.3,-68.2Q1.8,-69 3.2,-68.2L44.5,-47.6Q46,-46.9 44.5,-46.1L13.8,-30.8Q12.4,-30.1 10.9,-30.8L-30.4,-51.5Q-31.8,-52.2 -30.4,-52.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-37.1,-52.2L12.4,-27.4M12.4,-27.4L51.3,-46.9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <path
          d="M-12.4,-53Q-12.4,-53.7 -10.4,-54.7L1.6,-60.6Q3.5,-61.6 5.5,-60.6L22.8,-52Q24.8,-51 24.8,-50.3L24.8,-50.2Q24.8,-49.5 22.8,-48.5L10.8,-42.5Q8.8,-41.6 6.9,-42.5L-10.4,-51.2Q-12.4,-52.2 -12.4,-52.8Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-10.6,-52.8L7.1,-43.9Q8.8,-43.1 10.6,-43.9L23,-50.1"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-6.2,-54Q-6.2,-54.7 -4.2,-55.7L7.8,-61.7Q9.7,-62.7 11.7,-61.7L29,-53.1Q30.9,-52.1 30.9,-51.4L30.9,-51.3Q30.9,-50.6 29,-49.6L17,-43.6Q15,-42.6 13.1,-43.6L-4.2,-52.2Q-6.2,-53.2 -6.2,-53.9Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-4.4,-53.8L13.3,-45Q15,-44.1 16.8,-45L29.2,-51.2"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M9.7,-59.1L22.1,-53M5.3,-56.9L14.1,-52.5"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M-26.5,-97.8Q-26.5,-98.7 -24.6,-99.7L-9,-107.4Q-7.1,-108.4 -5.1,-107.4L8.6,-100.5Q10.6,-99.6 10.6,-98.7L10.6,-98.5Q10.6,-97.7 8.6,-96.7L-6.9,-88.9Q-8.8,-88 -10.8,-88.9L-24.6,-95.8Q-26.5,-96.8 -26.5,-97.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-24.8,-97.8L-10.6,-90.7Q-8.8,-89.8 -7.1,-90.7L8.8,-98.7"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-23,-99.7Q-23,-100.5 -21,-101.5L-5.5,-109.3Q-3.5,-110.3 -1.6,-109.3L12.2,-102.4Q14.1,-101.4 14.1,-100.6L14.1,-100.4Q14.1,-99.6 12.2,-98.6L-3.3,-90.8Q-5.3,-89.8 -7.3,-90.8L-21,-97.7Q-23,-98.7 -23,-99.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-21.2,-99.7L-7.1,-92.6Q-5.3,-91.7 -3.5,-92.6L12.4,-100.5"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-4.4,-106.3L-15.9,-100.5M0,-104.1L-8,-100.1"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-10.6,-92.4C-9.4,-83.4 -1.3,-58.2 1.8,-56.4"
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
        style={s({
          offsetPath: "path('M-10.6,-92.4C-9.4,-83.4 -1.3,-58.2 1.8,-56.4')",
          '--at': '30%',
          '--delay': '0s',
        })}
      >
        <circle r="2.6" fill="var(--muted)" />
      </g>
      <g
        className="packet"
        style={s({
          offsetPath: "path('M-10.6,-92.4C-9.4,-83.4 -1.3,-58.2 1.8,-56.4')",
          '--at': '65%',
          '--delay': '-1.2s',
        })}
      >
        <circle r="2.6" fill="var(--muted)" />
      </g>
      <path
        d="M-33.6,10.5Q-33.6,12.1 -32.2,12.8L7.4,32.6Q8.8,33.3 8.8,31.7L8.8,22.4Q8.8,20.8 7.4,20.1L-32.2,0.3Q-33.6,-0.4 -33.6,1.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M46,-7.4L35.4,-2.1M46,0.1L38.9,3.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-72.5,21.4Q-72.5,19.2 -70.5,18.2L-60.3,13.1Q-58.3,12.1 -56.4,13.1L-46.2,18.2Q-44.2,19.2 -44.2,21.4L-44.2,27Q-44.2,29.2 -46.2,30.2L-56.4,35.3Q-58.3,36.2 -60.3,35.3L-70.5,30.2Q-72.5,29.2 -72.5,27Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-70.7,20.1L-60.1,25.4Q-58.3,26.2 -56.6,25.4L-46,20.1"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-59.8,14.6Q-58.3,13.9 -56.9,14.6L-49.2,18.5Q-47.7,19.2 -49.2,19.9L-56.9,23.8Q-58.3,24.5 -59.8,23.8L-67.5,19.9Q-69,19.2 -67.5,18.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="acc">
        <path
          d="M-62.7,16.3L-62.7,14.3A4.4 2.2 0 0 1 -53.9,14.3L-53.9,16.3A4.4 2.2 0 0 1 -62.7,16.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-58.3"
          cy="14.3"
          rx="4.4"
          ry="2.2"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-59.2,18.9L-59.2,16.9A4.4 2.2 0 0 1 -50.4,16.9L-50.4,18.9A4.4 2.2 0 0 1 -59.2,18.9Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-54.8"
          cy="16.9"
          rx="4.4"
          ry="2.2"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-66.3,18.9L-66.3,16.9A4.4 2.2 0 0 1 -57.5,16.9L-57.5,18.9A4.4 2.2 0 0 1 -66.3,18.9Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-61.9"
          cy="16.9"
          rx="4.4"
          ry="2.2"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M-46,34.6Q-46,32.4 -44,31.4L-33.8,26.3Q-31.8,25.4 -29.9,26.3L-19.6,31.4Q-17.7,32.4 -17.7,34.6L-17.7,40.2Q-17.7,42.4 -19.6,43.4L-29.9,48.5Q-31.8,49.5 -33.8,48.5L-44,43.4Q-46,42.4 -46,40.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-44.2,33.3L-33.6,38.6Q-31.8,39.5 -30.1,38.6L-19.4,33.3"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-33.3,27.8Q-31.8,27.1 -30.4,27.8L-22.6,31.7Q-21.2,32.4 -22.6,33.1L-30.4,37Q-31.8,37.7 -33.3,37L-41,33.1Q-42.4,32.4 -41,31.7Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="acc">
        <path
          d="M-38,28.4Q-38,27.5 -36,26.5L-33.8,25.4Q-31.8,24.4 -29.9,25.4L-27.6,26.5Q-25.6,27.5 -25.6,28.4L-25.6,28.6Q-25.6,29.5 -27.6,30.5L-29.9,31.6Q-31.8,32.6 -33.8,31.6L-36,30.5Q-38,29.5 -38,28.6Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-34.5,31.1Q-34.5,30.2 -32.5,29.2L-30.3,28.1Q-28.3,27.1 -26.3,28.1L-24.1,29.2Q-22.1,30.2 -22.1,31.1L-22.1,31.3Q-22.1,32.2 -24.1,33.2L-26.3,34.3Q-28.3,35.3 -30.3,34.3L-32.5,33.2Q-34.5,32.2 -34.5,31.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-41.5,31.1Q-41.5,30.2 -39.6,29.2L-37.3,28.1Q-35.4,27.1 -33.4,28.1L-31.1,29.2Q-29.2,30.2 -29.2,31.1L-29.2,31.3Q-29.2,32.2 -31.1,33.2L-33.4,34.3Q-35.4,35.3 -37.3,34.3L-39.6,33.2Q-41.5,32.2 -41.5,31.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M-19.4,47.9Q-19.4,45.7 -17.5,44.7L-7.3,39.6Q-5.3,38.6 -3.3,39.6L6.9,44.7Q8.8,45.7 8.8,47.9L8.8,53.5Q8.8,55.7 6.9,56.7L-3.3,61.8Q-5.3,62.8 -7.3,61.8L-17.5,56.7Q-19.4,55.7 -19.4,53.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-17.7,46.6L-7.1,51.9Q-5.3,52.8 -3.5,51.9L7.1,46.6"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.7,41.1Q-5.3,40.4 -3.9,41.1L3.9,45Q5.3,45.7 3.9,46.4L-3.9,50.3Q-5.3,51 -6.7,50.3L-14.5,46.4Q-15.9,45.7 -14.5,45Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="acc">
        <path
          d="M-8.1,36.5Q-8.1,34.3 -6.8,33.6L-6.6,33.5Q-5.3,32.9 -4,33.5L-3.8,33.6Q-2.5,34.3 -2.5,36.5L-2.5,40.8Q-2.5,43 -3.8,43.7L-4,43.8Q-5.3,44.5 -6.6,43.8L-6.8,43.7Q-8.1,43 -8.1,40.8Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-3.7,38.7Q-3.7,36.5 -2.4,35.9L-2.2,35.7Q-0.9,35.1 0.4,35.7L0.7,35.9Q1.9,36.5 1.9,38.7L1.9,43Q1.9,45.3 0.7,45.9L0.4,46Q-0.9,46.7 -2.2,46L-2.4,45.9Q-3.7,45.3 -3.7,43Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-12.6,38.7Q-12.6,36.5 -11.3,35.9L-11,35.7Q-9.7,35.1 -8.4,35.7L-8.2,35.9Q-6.9,36.5 -6.9,38.7L-6.9,43Q-6.9,45.3 -8.2,45.9L-8.4,46Q-9.7,46.7 -11,46L-11.3,45.9Q-12.6,45.3 -12.6,43Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-8.1,40.9Q-8.1,38.7 -6.8,38.1L-6.6,37.9Q-5.3,37.3 -4,37.9L-3.8,38.1Q-2.5,38.7 -2.5,40.9L-2.5,45.3Q-2.5,47.5 -3.8,48.1L-4,48.2Q-5.3,48.9 -6.6,48.2L-6.8,48.1Q-8.1,47.5 -8.1,45.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M-28.3,8.5C-28.3,12.3 -58.3,11.3 -58.3,15.4"
        fill="none"
        stroke="var(--line)"
        strokeDasharray="3 4"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g
        className="packet acc"
        style={s({ offsetPath: "path('M-28.3,8.5C-28.3,12.3 -58.3,11.3 -58.3,15.4')", '--at': '33%', '--delay': '0s' })}
      >
        <g>
          <path
            d="M-4.4,0L-4.4,-2A4.4 2.2 0 0 1 4.4,-2L4.4,0A4.4 2.2 0 0 1 -4.4,0Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="0"
            cy="-2"
            rx="4.4"
            ry="2.2"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g
        className="packet acc"
        style={s({
          offsetPath: "path('M-28.3,8.5C-28.3,12.3 -58.3,11.3 -58.3,15.4')",
          '--at': '67%',
          '--delay': '-1.2s',
        })}
      >
        <g>
          <path
            d="M-4.4,0L-4.4,-2A4.4 2.2 0 0 1 4.4,-2L4.4,0A4.4 2.2 0 0 1 -4.4,0Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="0"
            cy="-2"
            rx="4.4"
            ry="2.2"
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
        d="M-12.4,16.5C-12.4,23.2 -31.8,21.3 -31.8,28.7"
        fill="none"
        stroke="var(--line)"
        strokeDasharray="3 4"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g
        className="packet acc"
        style={s({
          offsetPath: "path('M-12.4,16.5C-12.4,23.2 -31.8,21.3 -31.8,28.7')",
          '--at': '33%',
          '--delay': '0s',
        })}
      >
        <g>
          <path
            d="M-6.2,-1.1Q-6.2,-2 -4.2,-3L-2,-4.1Q0,-5.1 2,-4.1L4.2,-3Q6.2,-2 6.2,-1.1L6.2,-0.9Q6.2,0 4.2,1L2,2.1Q0,3.1 -2,2.1L-4.2,1Q-6.2,0 -6.2,-0.9Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g
        className="packet acc"
        style={s({
          offsetPath: "path('M-12.4,16.5C-12.4,23.2 -31.8,21.3 -31.8,28.7')",
          '--at': '67%',
          '--delay': '-1.2s',
        })}
      >
        <g>
          <path
            d="M-6.2,-1.1Q-6.2,-2 -4.2,-3L-2,-4.1Q0,-5.1 2,-4.1L4.2,-3Q6.2,-2 6.2,-1.1L6.2,-0.9Q6.2,0 4.2,1L2,2.1Q0,3.1 -2,2.1L-4.2,1Q-6.2,0 -6.2,-0.9Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <path
        d="M3.5,24.4C3.5,34.1 -5.3,31.4 -5.3,41.9"
        fill="none"
        stroke="var(--line)"
        strokeDasharray="3 4"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g
        className="packet acc"
        style={s({ offsetPath: "path('M3.5,24.4C3.5,34.1 -5.3,31.4 -5.3,41.9')", '--at': '33%', '--delay': '0s' })}
      >
        <g>
          <path
            d="M-2.8,-6.5Q-2.8,-8.8 -1.5,-9.4L-1.3,-9.5Q0,-10.2 1.3,-9.5L1.5,-9.4Q2.8,-8.8 2.8,-6.5L2.8,-2.2Q2.8,0 1.5,0.6L1.3,0.8Q0,1.4 -1.3,0.8L-1.5,0.6Q-2.8,0 -2.8,-2.2Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g
        className="packet acc"
        style={s({ offsetPath: "path('M3.5,24.4C3.5,34.1 -5.3,31.4 -5.3,41.9')", '--at': '67%', '--delay': '-1.2s' })}
      >
        <g>
          <path
            d="M-2.8,-6.5Q-2.8,-8.8 -1.5,-9.4L-1.3,-9.5Q0,-10.2 1.3,-9.5L1.5,-9.4Q2.8,-8.8 2.8,-6.5L2.8,-2.2Q2.8,0 1.5,0.6L1.3,0.8Q0,1.4 -1.3,0.8L-1.5,0.6Q-2.8,0 -2.8,-2.2Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g className="fail">
        <g className="fx fx-srt-sheet">
          <g className="acc">
            <path
              d="M-23,-101.4Q-23,-102 -21,-103L-5.5,-110.8Q-3.5,-111.8 -1.6,-110.8L12.2,-103.9Q14.1,-102.9 14.1,-102.2L14.1,-102.1Q14.1,-101.4 12.2,-100.4L-3.3,-92.7Q-5.3,-91.7 -7.3,-92.7L-21,-99.6Q-23,-100.5 -23,-101.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-21.2,-101.2L-7.1,-94.1Q-5.3,-93.2 -3.5,-94.1L12.4,-102"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-srt-wad">
          <g className="acc">
            <path
              d="M13.5,-54.3Q14.1,-53.3 13.3,-52.3L12.6,-51.4Q11.9,-50.5 11.2,-49.5L10.6,-48.7Q9.9,-47.7 8.7,-47.9L7.5,-48.2Q6.3,-48.4 5.1,-48.4L3.5,-48.3Q2.3,-48.3 1.9,-49.4L1.6,-50.6Q1.3,-51.7 1.1,-52.9L0.9,-53.8Q0.7,-55 1.7,-55.6L2.7,-56.2Q3.7,-56.8 4.5,-57.7L5.3,-58.7Q6.1,-59.6 7.2,-59.2L8.5,-58.7Q9.6,-58.3 10.6,-57.6L11.5,-57.1Q12.5,-56.4 13,-55.3Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M3.2,-55.7L6.4,-52.9L9.5,-56.4M5.7,-49.4L7.4,-52.6L11.3,-51.5M2.5,-51.2L5.3,-51.9"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-srt-jam">
          <g className="acc">
            <path
              d="M10.5,-51.4L13.9,-50.8M9.3,-49.7L13,-45.7M7,-49L6.9,-46.1M4.8,-49.8L0.8,-46M3.6,-51.6L0.1,-51.1M4.1,-53.6L-1,-56.2M6,-54.9L4.8,-57.7M8.4,-54.8L10.5,-59.5M10.1,-53.4L13.2,-54.9"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-srt-lamp">
          <g className="acc">
            <path
              d="M31.8,-3.2Q31.8,-1.6 30.4,-0.9L29.7,-0.6Q28.3,0.1 28.3,-1.5L28.3,-2Q28.3,-3.6 29.7,-4.3L30.4,-4.7Q31.8,-5.4 31.8,-3.8Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
      </g>
      <path
        d="M29.1,30.5A6.3 3.1 0 0 1 41.7,30.5L41.7,44.2A6.3 3.1 0 0 1 29.1,44.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="35.4"
        cy="30.5"
        rx="6.3"
        ry="3.1"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="35.4"
        cy="30.5"
        rx="5"
        ry="2.5"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}
