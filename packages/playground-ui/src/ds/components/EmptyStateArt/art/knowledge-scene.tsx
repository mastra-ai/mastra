import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function KnowledgeScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="7.1" cy="21.2" r="55.5">
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
          d="M-41.6,17.6C-42.8,13.5 -27.9,10.7 -21,7.2C-14.2,3.7 -4.3,-1.8 -0.2,-3.4C3.8,-5 2,-2.7 3.1,-2.4C4.2,-2.1 1.1,-3.9 6.4,-1.4C11.7,1.1 25.3,8 34.6,12.7C43.9,17.4 61.1,22.7 62.3,26.8C63.4,30.9 48.6,33.8 41.7,37.3C34.8,40.8 24.9,46.2 20.9,47.8C16.9,49.4 18.7,47.2 17.6,46.8C16.5,46.5 19.5,48.4 14.2,45.9C9,43.3 -4.7,36.4 -14,31.7C-23.3,27 -40.4,21.7 -41.6,17.6Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-35.4,-60.1Q-35.4,-62.3 -33.4,-63.3L-2,-79Q0,-80 2,-79L47.5,-56.2Q49.5,-55.2 49.5,-53L49.5,22.6Q49.5,24.8 47.5,25.7L16.1,41.4Q14.1,42.4 12.2,41.4L-33.4,18.7Q-35.4,17.7 -35.4,15.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-33.6,-61.4L12.4,-38.5Q14.1,-37.6 15.9,-38.5L47.7,-54.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-31.8,-27.2Q-31.8,-25.6 -30.4,-24.8L9.2,-5.1Q10.6,-4.3 10.6,-5.9L10.6,-30.2Q10.6,-31.8 9.2,-32.6L-30.4,-52.3Q-31.8,-53.1 -31.8,-51.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-31.8,10.3Q-31.8,11.9 -30.4,12.7L9.2,32.4Q10.6,33.2 10.6,31.6L10.6,7.3Q10.6,5.7 9.2,4.9L-30.4,-14.8Q-31.8,-15.6 -31.8,-14Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-15.9,-0.1L-5.3,5.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-kn-bay`}>
          <path d="M-111.4,-13.3L-31.8,-53.1L10.6,-31.8L10.6,-4.3L-69,35.4L-111.4,14.2Z" />
        </clipPath>
        <g clipPath={`url(#${id}-kn-bay)`}>
          <g className="acc created hold" style={s({ '--shift': '-21.2px 10.6px' })}>
            <path
              d="M-31.8,-50.2Q-31.8,-52.4 -29.9,-53.4L-9,-63.8Q-7.1,-64.8 -5.1,-63.8L33.4,-44.6Q35.4,-43.6 35.4,-41.4L35.4,-19.5Q35.4,-17.3 33.4,-16.4L12.6,-5.9Q10.6,-5 8.6,-5.9L-29.9,-25.2Q-31.8,-26.2 -31.8,-28.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-8.5,-62.3Q-7.1,-63 -5.6,-62.3L30.4,-44.3Q31.8,-43.6 30.4,-42.9L12,-33.7Q10.6,-33 9.2,-33.7L-26.9,-51.7Q-28.3,-52.4 -26.9,-53.1Z"
              fill="var(--hole)"
              stroke="none"
            />
            <path
              d="M-9,-57.5Q-9,-59.7 -8.5,-59.9L-8.4,-60Q-8,-60.2 -6,-59.2L25.4,-43.5Q27.4,-42.5 27.4,-40.3L27.4,-36Q27.4,-33.8 26.9,-33.5L26.8,-33.5Q26.3,-33.2 24.4,-34.2L-7,-49.9Q-9,-50.9 -9,-53.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-13.4,-55.3Q-13.4,-57.5 -13,-57.7L-12.9,-57.7Q-12.4,-58 -10.4,-57L21,-41.3Q23,-40.3 23,-38.1L23,-33.8Q23,-31.6 22.5,-31.3L22.4,-31.3Q21.9,-31 20,-32L-11.5,-47.7Q-13.4,-48.7 -13.4,-50.9Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-17.9,-53Q-17.9,-55.2 -17.4,-55.5L-17.3,-55.5Q-16.8,-55.8 -14.8,-54.8L16.6,-39.1Q18.6,-38.1 18.6,-35.9L18.6,-31.6Q18.6,-29.4 18.1,-29.1L18,-29.1Q17.5,-28.8 15.5,-29.8L-15.9,-45.5Q-17.9,-46.5 -17.9,-48.7Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-22.3,-50.8Q-22.3,-53 -21.8,-53.3L-21.7,-53.3Q-21.2,-53.6 -19.2,-52.6L12.2,-36.9Q14.1,-35.9 14.1,-33.7L14.1,-29.3Q14.1,-27.1 13.7,-26.9L13.6,-26.9Q13.1,-26.6 11.1,-27.6L-20.3,-43.3Q-22.3,-44.3 -22.3,-46.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M6,-48.8Q6,-49.6 6.5,-49.9L6.6,-49.9Q7.1,-50.1 9,-49.2L12.2,-47.6Q14.1,-46.6 14.1,-45.8L14.1,-45.6Q14.1,-44.7 13.7,-44.5L13.6,-44.4Q13.1,-44.2 11.1,-45.2L8,-46.8Q6,-47.7 6,-48.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-31.8,-27.8Q-31.8,-26.2 -30.4,-25.5L9.2,-5.7Q10.6,-5 10.6,-6.6L10.6,-29.6Q10.6,-31.2 9.2,-31.9L-30.4,-51.7Q-31.8,-52.4 -31.8,-50.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-15.9,-35.1L-5.3,-29.8"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <mask id={`${id}-kn-mask`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
          <rect x="-400" y="-400" width="800" height="800" fill="white" />
          <path d="M-53,-15.6L-10.6,5.6L-10.6,-20.6L-53,-41.8Z" fill="black" />
          <path d="M14.1,-6.7L-10.6,5.6L-10.6,-20.6L14.1,-33Z" fill="black" />
        </mask>
        <g mask={`url(#${id}-kn-mask)`}>
          <g className="fx fx-kn-sheet">
            <g className="acc">
              <path
                d="M-60.1,-108.9Q-60.1,-109.2 -58.1,-110.2L-53.2,-112.6Q-51.3,-113.6 -49.3,-112.6L-33.8,-104.9Q-31.8,-103.9 -31.8,-103.6L-31.8,-103.5Q-31.8,-103.1 -33.8,-102.2L-38.7,-99.7Q-40.7,-98.7 -42.6,-99.7L-58.1,-107.5Q-60.1,-108.4 -60.1,-108.8Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-49.9,-110.7L-54.4,-108.5M-46.4,-109L-49.5,-107.4"
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
      </g>
      <g className="fail">
        <clipPath id={`${id}-kn-bay2`}>
          <path d="M-111.4,-13.3L-31.8,-53.1L10.6,-31.8L10.6,-4.3L-69,35.4L-111.4,14.2Z" />
        </clipPath>
        <g clipPath={`url(#${id}-kn-bay2)`}>
          <g
            style={s({
              translate: '-8.8px 4.4px',
              rotate: '-1.2deg',
              transformBox: 'view-box',
              transformOrigin: '-10.6px -15.6px',
            })}
          >
            <g className="acc">
              <path
                d="M-31.8,-50.2Q-31.8,-52.4 -29.9,-53.4L-9,-63.8Q-7.1,-64.8 -5.1,-63.8L33.4,-44.6Q35.4,-43.6 35.4,-41.4L35.4,-19.5Q35.4,-17.3 33.4,-16.4L12.6,-5.9Q10.6,-5 8.6,-5.9L-29.9,-25.2Q-31.8,-26.2 -31.8,-28.4Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-8.5,-62.3Q-7.1,-63 -5.6,-62.3L30.4,-44.3Q31.8,-43.6 30.4,-42.9L12,-33.7Q10.6,-33 9.2,-33.7L-26.9,-51.7Q-28.3,-52.4 -26.9,-53.1Z"
                fill="var(--hole)"
                stroke="none"
              />
              <path
                d="M-9,-57.5Q-9,-59.7 -8.5,-59.9L-8.4,-60Q-8,-60.2 -6,-59.2L25.4,-43.5Q27.4,-42.5 27.4,-40.3L27.4,-36Q27.4,-33.8 26.9,-33.5L26.8,-33.5Q26.3,-33.2 24.4,-34.2L-7,-49.9Q-9,-50.9 -9,-53.1Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-13.4,-55.3Q-13.4,-57.5 -13,-57.7L-12.9,-57.7Q-12.4,-58 -10.4,-57L21,-41.3Q23,-40.3 23,-38.1L23,-33.8Q23,-31.6 22.5,-31.3L22.4,-31.3Q21.9,-31 20,-32L-11.5,-47.7Q-13.4,-48.7 -13.4,-50.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-17.9,-53Q-17.9,-55.2 -17.4,-55.5L-17.3,-55.5Q-16.8,-55.8 -14.8,-54.8L16.6,-39.1Q18.6,-38.1 18.6,-35.9L18.6,-31.6Q18.6,-29.4 18.1,-29.1L18,-29.1Q17.5,-28.8 15.5,-29.8L-15.9,-45.5Q-17.9,-46.5 -17.9,-48.7Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-22.3,-50.8Q-22.3,-53 -21.8,-53.3L-21.7,-53.3Q-21.2,-53.6 -19.2,-52.6L12.2,-36.9Q14.1,-35.9 14.1,-33.7L14.1,-29.3Q14.1,-27.1 13.7,-26.9L13.6,-26.9Q13.1,-26.6 11.1,-27.6L-20.3,-43.3Q-22.3,-44.3 -22.3,-46.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M6,-48.8Q6,-49.6 6.5,-49.9L6.6,-49.9Q7.1,-50.1 9,-49.2L12.2,-47.6Q14.1,-46.6 14.1,-45.8L14.1,-45.6Q14.1,-44.7 13.7,-44.5L13.6,-44.4Q13.1,-44.2 11.1,-45.2L8,-46.8Q6,-47.7 6,-48.6Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-31.8,-27.8Q-31.8,-26.2 -30.4,-25.5L9.2,-5.7Q10.6,-5 10.6,-6.6L10.6,-29.6Q10.6,-31.2 9.2,-31.9L-30.4,-51.7Q-31.8,-52.4 -31.8,-50.8Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-15.9,-35.1L-5.3,-29.8"
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
        <g className="fx fx-kn-sheet2">
          <g className="acc">
            <path
              d="M-60.1,-108.9Q-60.1,-109.2 -58.1,-110.2L-53.2,-112.6Q-51.3,-113.6 -49.3,-112.6L-33.8,-104.9Q-31.8,-103.9 -31.8,-103.6L-31.8,-103.5Q-31.8,-103.1 -33.8,-102.2L-38.7,-99.7Q-40.7,-98.7 -42.6,-99.7L-58.1,-107.5Q-60.1,-108.4 -60.1,-108.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-49.9,-110.7L-54.4,-108.5M-46.4,-109L-49.5,-107.4"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-kn-hit">
          <g className="acc">
            <path
              d="M3.4,-15.9L6.9,-15.3M2.2,-14.2L5.9,-10.2M-0.1,-13.5L-0.2,-10.6M-2.3,-14.3L-6.3,-10.5M-3.5,-16.1L-6.9,-15.6M-3,-18.1L-8.1,-20.7M-1.1,-19.4L-2.2,-22.2M1.3,-19.3L3.5,-24M3.1,-18L6.1,-19.4"
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
