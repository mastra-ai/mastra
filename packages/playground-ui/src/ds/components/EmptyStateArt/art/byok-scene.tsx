import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function ByokScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="4.4" cy="15.5" r="43.9">
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
          d="M-32.8,13.2C-33.5,10.1 -22.1,7.7 -16.6,5C-11.2,2.2 -3.5,-2.2 -0.2,-3.4C3.1,-4.6 2,-2.7 3.1,-2.4C4.2,-2.1 2.4,-3.4 6.5,-1.4C10.5,0.5 20.6,5.7 27.6,9.2C34.5,12.7 47.4,16.6 48.1,19.7C48.8,22.9 37.4,25.2 32,28C26.5,30.7 18.9,35.1 15.6,36.3C12.3,37.6 13.3,35.7 12.2,35.4C11.1,35 13,36.3 8.9,34.4C4.8,32.4 -5.3,27.2 -12.2,23.7C-19.2,20.2 -32,16.3 -32.8,13.2Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-26.5,-22Q-26.5,-24.2 -24.6,-25.2L-2,-36.5Q0,-37.5 2,-36.5L33.4,-20.8Q35.4,-19.8 35.4,-17.6L35.4,15.5Q35.4,17.7 33.4,18.7L10.8,30Q8.8,30.9 6.9,30L-24.6,14.2Q-26.5,13.3 -26.5,11.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M33.6,-18.9L10.6,-7.4Q8.8,-6.6 7.1,-7.4L-24.8,-23.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.9,-28.8Q-5.3,-29.5 -6.7,-28.8L-7.4,-28.5Q-8.8,-27.8 -7.4,-27.1L14.5,-16.1Q15.9,-15.4 17.3,-16.1L18,-16.5Q19.4,-17.2 18,-17.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-19.4,5.2Q-19.4,6.8 -18,7.5L0.3,16.7Q1.8,17.4 1.8,15.8L1.8,6.5Q1.8,4.9 0.3,4.2L-18,-5Q-19.4,-5.7 -19.4,-4.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-15.9,2.3L-1.8,9.4"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.5,-4.3Q-3.5,-2.7 -2.1,-2L-1.4,-1.7Q0,-1 0,-2.6L0,-3.1Q0,-4.7 -1.4,-5.4L-2.1,-5.8Q-3.5,-6.5 -3.5,-4.9Z"
        fill="var(--line)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-bk-slot`}>
          <path d="M-8,-139.8L-4.4,-141.6L18.6,-130.1L18.6,-17.6L15,-15.8L-8,-27.3Z" />
          <path d="M-19.4,-145.6L-15.9,-147.3L30.1,-124.4L30.1,-13.6L26.5,-11.8L-19.4,-34.8Z" />
        </clipPath>
        <g clipPath={`url(#${id}-bk-slot)`}>
          <g className="acc created drawer" style={s({ '--shift': '0px 17.5px' })}>
            <path
              d="M-5.8,-50.3Q-5.8,-52.5 -5.4,-52.8L-5.3,-52.8Q-4.8,-53 -2.8,-52.1L14.5,-43.4Q16.4,-42.4 16.4,-40.2L16.4,-7.1Q16.4,-4.9 16,-4.7L15.9,-4.6Q15.4,-4.4 13.4,-5.4L-3.9,-14Q-5.8,-15 -5.8,-17.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-3.2,-37.8Q-3.2,-36.2 -1.8,-35.5L0.7,-34.2Q2.1,-33.5 2.1,-35.1L2.1,-39.4Q2.1,-41 0.7,-41.7L-1.8,-43Q-3.2,-43.7 -3.2,-42.1Z"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M4.8,-37.2L12.7,-33.2M4.8,-33.5L10.1,-30.8"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
      </g>
      <g className="fail">
        <clipPath id={`${id}-bk-slot2`}>
          <path d="M-8,-139.8L-4.4,-141.6L18.6,-130.1L18.6,-17.6L15,-15.8L-8,-27.3Z" />
          <path d="M-19.4,-145.6L-15.9,-147.3L30.1,-124.4L30.1,-13.6L26.5,-11.8L-19.4,-34.8Z" />
        </clipPath>
        <g clipPath={`url(#${id}-bk-slot2)`}>
          <g className="fx fx-bk-card">
            <g className="acc">
              <path
                d="M-5.8,-50.3Q-5.8,-52.5 -5.4,-52.8L-5.3,-52.8Q-4.8,-53 -2.8,-52.1L14.5,-43.4Q16.4,-42.4 16.4,-40.2L16.4,-7.1Q16.4,-4.9 16,-4.7L15.9,-4.6Q15.4,-4.4 13.4,-5.4L-3.9,-14Q-5.8,-15 -5.8,-17.2Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-3.2,-37.8Q-3.2,-36.2 -1.8,-35.5L0.7,-34.2Q2.1,-33.5 2.1,-35.1L2.1,-39.4Q2.1,-41 0.7,-41.7L-1.8,-43Q-3.2,-43.7 -3.2,-42.1Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M4.8,-37.2L12.7,-33.2M4.8,-33.5L10.1,-30.8"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        </g>
        <g className="fx fx-bk-lamp">
          <g className="acc">
            <path
              d="M-3.5,-4.3Q-3.5,-2.7 -2.1,-2L-1.4,-1.7Q0,-1 0,-2.6L0,-3.1Q0,-4.7 -1.4,-5.4L-2.1,-5.8Q-3.5,-6.5 -3.5,-4.9Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-bk-x">
          <g className="acc">
            <path
              d="M-15.9,6.1L-1.8,5.6"
              pathLength="1"
              strokeDasharray="1"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-15.9,-1.4L-1.8,13.1"
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
      </g>
    </>
  );
}
