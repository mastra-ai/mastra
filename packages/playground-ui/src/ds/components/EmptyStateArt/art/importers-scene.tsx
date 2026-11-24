import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function ImportersScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="13.7" cy="10.1" r="55.9">
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
          d="M-41.6,17.7C-41.3,14.4 -28,10.9 -21.1,7.4C-14.2,3.9 -7.1,-0.9 -0.5,-3.2C6.2,-5.5 12.3,-5.5 18.6,-6.5C25,-7.6 33.8,-9.1 37.6,-9.4C41.3,-9.8 39.7,-8.7 40.8,-8.4C41.9,-8 42.8,-7.9 44.1,-7.4C45.4,-6.8 47.2,-5.8 48.8,-5C50.3,-4.2 53.3,-4.7 53.4,-2.6C53.4,-0.5 50.5,4.2 49,7.7C47.5,11.1 48.8,14.6 44.6,18.1C40.3,21.6 30.7,25.2 23.7,28.7C16.7,32.2 6.7,37.4 2.7,39C-1.4,40.5 0.5,38.3 -0.6,37.9C-1.7,37.6 -0.2,38.7 -3.9,36.9C-7.6,35.1 -16.5,30.5 -22.8,27.3C-29.1,24.1 -41.9,21.1 -41.6,17.7Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M33.6,-62.2Q33.6,-64.4 35.2,-65.2L35.5,-65.4Q37.1,-66.2 38.7,-65.4L39.1,-65.2Q40.7,-64.4 40.7,-62.2L40.7,-6.6Q40.7,-4.4 39.1,-3.6L38.7,-3.5Q37.1,-2.7 35.5,-3.5L35.2,-3.6Q33.6,-4.4 33.6,-6.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15.9,-78Q15.9,-80.2 17.9,-81.1L33.4,-88.9Q35.4,-89.9 37.3,-88.9L52.8,-81.1Q54.8,-80.2 54.8,-78L54.8,-64.9Q54.8,-62.7 52.8,-61.7L37.3,-53.9Q35.4,-52.9 33.4,-53.9L17.9,-61.7Q15.9,-62.7 15.9,-64.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M53,-79.3L37.1,-71.3Q35.4,-70.4 33.6,-71.3L17.7,-79.3"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M19.4,-67.5Q19.4,-65.9 20.9,-65.2L30.4,-60.4Q31.8,-59.7 31.8,-61.3L31.8,-68.1Q31.8,-69.7 30.4,-70.4L20.9,-75.2Q19.4,-75.9 19.4,-74.3Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M20.3,-66.7L-2.7,-36.5L8,-31.1L30.9,-61.4Z" fill="var(--face)" stroke="none" />
      <path
        d="M-0.7,-35.5Q-2.7,-36.5 -1.3,-38.2L19,-64.9Q20.3,-66.7 22.3,-65.7L29,-62.4Q30.9,-61.4 29.6,-59.6L9.3,-32.9Q8,-31.1 6,-32.1Z"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-35.4,-27.6Q-35.4,-29.8 -33.4,-30.8L-2,-46.5Q0,-47.5 2,-46.5L29.9,-32.6Q31.8,-31.6 31.8,-29.4L31.8,13.7Q31.8,15.9 29.9,16.9L-1.6,32.6Q-3.5,33.6 -5.5,32.6L-33.4,18.7Q-35.4,17.7 -35.4,15.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M30.1,-30.7L-1.8,-14.8Q-3.5,-13.9 -5.3,-14.8L-33.6,-28.9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-32.7,-13.5L-6.2,-0.2M-32.7,4L-6.2,17.3M-23,0.1L-15.9,3.7M-23,17.6L-15.9,21.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-0.3,-37.1Q-1.8,-37.8 -3.2,-37.1L-4.8,-36.3Q-6.2,-35.6 -4.8,-34.9L6.5,-29.2Q8,-28.5 9.4,-29.2L10.9,-30Q12.4,-30.7 10.9,-31.4Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-im-chute`}>
          <path d="M-2.7,-47.7L20.3,-77.9L30.9,-72.6L30.9,-61.4L8,-31.1L-2.7,-36.5Z" />
        </clipPath>
        <g clipPath={`url(#${id}-im-chute)`}>
          <g className="acc tick" style={s({ '--dur': '1.5s', '--step': '-7.8px 10.3px' })}>
            <path d="M37.7,-87.6L33.1,-81.6L40.2,-78L44.8,-84.1Z" fill="var(--face)" stroke="none" />
            <path
              d="M35.1,-80.6Q33.1,-81.6 34.5,-83.3L36.4,-85.9Q37.7,-87.6 39.7,-86.6L42.8,-85.1Q44.8,-84.1 43.5,-82.3L41.5,-79.8Q40.2,-78 38.2,-79Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M37.7,-87.6L39,-82.8L44.8,-84.1"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path d="M29.9,-77.3L25.3,-71.3L32.4,-67.8L37,-73.8Z" fill="var(--face)" stroke="none" />
            <path
              d="M27.3,-70.3Q25.3,-71.3 26.6,-73L28.6,-75.6Q29.9,-77.3 31.9,-76.4L35,-74.8Q37,-73.8 35.7,-72.1L33.7,-69.5Q32.4,-67.8 30.4,-68.7Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M29.9,-77.3L31.2,-72.5L37,-73.8"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path d="M22.1,-67.1L17.5,-61L24.6,-57.5L29.2,-63.5Z" fill="var(--face)" stroke="none" />
            <path
              d="M19.5,-60Q17.5,-61 18.8,-62.8L20.8,-65.3Q22.1,-67.1 24.1,-66.1L27.2,-64.5Q29.2,-63.5 27.8,-61.8L25.9,-59.2Q24.6,-57.5 22.6,-58.5Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M22.1,-67.1L23.3,-62.3L29.2,-63.5"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path d="M14.3,-56.8L9.7,-50.7L16.8,-47.2L21.4,-53.2Z" fill="var(--face)" stroke="none" />
            <path
              d="M11.7,-49.7Q9.7,-50.7 11,-52.5L13,-55Q14.3,-56.8 16.3,-55.8L19.4,-54.2Q21.4,-53.2 20,-51.5L18.1,-48.9Q16.8,-47.2 14.8,-48.2Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M14.3,-56.8L15.5,-52L21.4,-53.2"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path d="M6.5,-46.5L1.9,-40.4L8.9,-36.9L13.5,-43Z" fill="var(--face)" stroke="none" />
            <path
              d="M3.8,-39.5Q1.9,-40.4 3.2,-42.2L5.1,-44.7Q6.5,-46.5 8.4,-45.5L11.6,-43.9Q13.5,-43 12.2,-41.2L10.3,-38.7Q8.9,-36.9 7,-37.9Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M6.5,-46.5L7.7,-41.7L13.5,-43"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path d="M-1.3,-36.2L-5.9,-30.2L1.1,-26.6L5.7,-32.7Z" fill="var(--face)" stroke="none" />
            <path
              d="M-4,-29.2Q-5.9,-30.2 -4.6,-31.9L-2.7,-34.5Q-1.3,-36.2 0.6,-35.2L3.8,-33.7Q5.7,-32.7 4.4,-30.9L2.5,-28.4Q1.1,-26.6 -0.8,-27.6Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-1.3,-36.2L-0.1,-31.4L5.7,-32.7"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
      </g>
      <g className="fail">
        <clipPath id={`${id}-im-chute2`}>
          <path d="M-2.7,-47.7L20.3,-77.9L30.9,-72.6L30.9,-61.4L8,-31.1L-2.7,-36.5Z" />
        </clipPath>
        <g clipPath={`url(#${id}-im-chute2)`}>
          <g className="fx fx-im-e1">
            <g className="acc">
              <path d="M22.1,-67.1L17.5,-61L24.6,-57.5L29.2,-63.5Z" fill="var(--face)" stroke="none" />
              <path
                d="M19.5,-60Q17.5,-61 18.8,-62.8L20.8,-65.3Q22.1,-67.1 24.1,-66.1L27.2,-64.5Q29.2,-63.5 27.8,-61.8L25.9,-59.2Q24.6,-57.5 22.6,-58.5Z"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M22.1,-67.1L23.3,-62.3L29.2,-63.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-im-e2">
            <g className="acc">
              <path d="M22.1,-67.1L17.5,-61L24.6,-57.5L29.2,-63.5Z" fill="var(--face)" stroke="none" />
              <path
                d="M19.5,-60Q17.5,-61 18.8,-62.8L20.8,-65.3Q22.1,-67.1 24.1,-66.1L27.2,-64.5Q29.2,-63.5 27.8,-61.8L25.9,-59.2Q24.6,-57.5 22.6,-58.5Z"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M22.1,-67.1L23.3,-62.3L29.2,-63.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-im-e3">
            <g className="acc">
              <path d="M22.1,-67.1L17.5,-61L24.6,-57.5L29.2,-63.5Z" fill="var(--face)" stroke="none" />
              <path
                d="M19.5,-60Q17.5,-61 18.8,-62.8L20.8,-65.3Q22.1,-67.1 24.1,-66.1L27.2,-64.5Q29.2,-63.5 27.8,-61.8L25.9,-59.2Q24.6,-57.5 22.6,-58.5Z"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M22.1,-67.1L23.3,-62.3L29.2,-63.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        </g>
        <g className="fx fx-im-e3b">
          <g className="acc">
            <path d="M22.1,-67.1L17.5,-61L24.6,-57.5L29.2,-63.5Z" fill="var(--face)" stroke="none" />
            <path
              d="M19.5,-60Q17.5,-61 18.8,-62.8L20.8,-65.3Q22.1,-67.1 24.1,-66.1L27.2,-64.5Q29.2,-63.5 27.8,-61.8L25.9,-59.2Q24.6,-57.5 22.6,-58.5Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M22.1,-67.1L23.3,-62.3L29.2,-63.5"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-im-jam">
          <g className="acc">
            <path
              d="M6.1,-35.7L9.5,-35.1M4.8,-34L8.6,-30M2.6,-33.3L2.5,-30.3M0.3,-34L-3.6,-30.2M-0.8,-35.9L-4.3,-35.4M-0.3,-37.9L-5.5,-40.5M1.5,-39.1L0.4,-41.9M3.9,-39.1L6.1,-43.8M5.7,-37.7L8.8,-39.1"
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
