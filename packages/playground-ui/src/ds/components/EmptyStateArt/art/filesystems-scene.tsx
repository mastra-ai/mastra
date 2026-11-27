import type { SceneProps } from './scene-style';

export function FilesystemsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="9.7" cy="16.2" r="38.6">
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
          d="M-27.5,10.5C-28.6,7.6 -18.5,5.9 -14,3.6C-9.4,1.3 -3.2,-2.3 -0.3,-3.3C2.5,-4.3 1.9,-2.7 3,-2.4C4.1,-2 2.2,-3.3 6.3,-1.4C10.4,0.5 20.6,5.6 27.5,9.1C34.5,12.7 46.3,17.1 48.1,19.7C50,22.3 41.7,23 38.5,24.6C35.3,26.3 31.2,28.4 28.9,29.6C26.6,30.8 26.2,31 24.9,31.6C23.6,32.3 22.1,33.5 20.9,33.7C19.7,33.8 18.7,33 17.6,32.7C16.4,32.4 18.3,33.7 14.2,31.7C10.1,29.8 0,24.5 -7,21C-13.9,17.4 -26.3,13.4 -27.5,10.5Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-21.2,9.2Q-21.2,8.1 -19.4,7.2L-1.8,-1.6Q0,-2.5 1.8,-1.6L33.6,14.3Q35.4,15.2 35.4,16.3L35.4,16.5Q35.4,17.7 33.6,18.6L15.9,27.4Q14.1,28.3 12.4,27.4L-19.4,11.5Q-21.2,10.6 -21.2,9.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-2.1,-9Q-2.1,-10.2 -1.2,-10.7L-1,-10.8Q0,-11.3 1.1,-10.7L34.3,5.9Q35.4,6.4 35.4,7.6L35.4,16.5Q35.4,17.7 34.4,18.2L34.2,18.3Q33.2,18.7 32.2,18.2L-1,1.6Q-2.1,1.1 -2.1,-0.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-21.2,0.6Q-21.2,-0.6 -20.1,-1.2L-1.1,-10.7Q0,-11.3 1,-10.8L1.2,-10.7Q2.1,-10.2 2.1,-9L2.1,-0.1Q2.1,1.1 1,1.6L-18,11.1Q-19.1,11.7 -20.1,11.2L-20.3,11.1Q-21.2,10.6 -21.2,9.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-2.3,-35.2Q-2.3,-36.2 -2.1,-36.3L-2,-36.3Q-1.8,-36.5 -0.9,-36L27.4,-21.9Q28.3,-21.4 28.3,-20.4L28.3,15.1Q28.3,16.1 28,16.2L28,16.2Q27.8,16.3 26.9,15.9L-1.4,1.7Q-2.3,1.3 -2.3,0.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M16.3,-29.5Q16.3,-30.7 16.5,-30.8L16.6,-30.8Q16.8,-30.9 17.9,-30.4L23.7,-27.5Q24.8,-27 24.8,-25.8L24.8,-23.9Q24.8,-22.7 24.5,-22.6L24.5,-22.6Q24.2,-22.4 23.1,-23L17.3,-25.9Q16.3,-26.4 16.3,-27.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M18,-24L21.6,-22.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.1,-30.4Q-3.1,-31.4 -2.9,-31.5L-2.8,-31.6Q-2.6,-31.7 -1.7,-31.2L26.6,-17.1Q27.5,-16.7 27.5,-15.7L27.5,15.5Q27.5,16.5 27.3,16.6L27.2,16.6Q27,16.7 26.1,16.3L-2.2,2.1Q-3.1,1.7 -3.1,0.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="fx fx-fs-mid">
          <g className="acc">
            <path
              d="M-7.6,-32.5Q-7.6,-33.5 -7.4,-33.7L-7.3,-33.7Q-7.1,-33.8 -6.2,-33.4L22.1,-19.2Q23,-18.8 23,-17.8L23,17.7Q23,18.7 22.7,18.8L22.7,18.9Q22.5,19 21.6,18.5L-6.7,4.4Q-7.6,4 -7.6,3Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-5.8,-35.2Q-5.8,-36.4 -5.6,-36.5L-5.5,-36.6Q-5.3,-36.7 -4.2,-36.1L1.6,-33.2Q2.7,-32.7 2.7,-31.5L2.7,-29.6Q2.7,-28.4 2.4,-28.3L2.4,-28.3Q2.1,-28.2 1,-28.7L-4.8,-31.6Q-5.8,-32.2 -5.8,-33.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-4.1,-29.8L-0.5,-28"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-8.4,-27.8Q-8.4,-28.8 -8.2,-28.9L-8.1,-28.9Q-7.9,-29 -7,-28.6L21.3,-14.5Q22.2,-14 22.2,-13L22.2,18.1Q22.2,19.1 21.9,19.2L21.9,19.3Q21.7,19.4 20.8,18.9L-7.5,4.8Q-8.4,4.4 -8.4,3.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <clipPath id={`${id}-fs-slot`}>
          <path d="M-7.1,-104.5L-5.7,-105.3L20.9,-92L20.9,-24.5L19.4,-23.8L-7.1,-37Z" />
        </clipPath>
        <g clipPath={`url(#${id}-fs-slot)`}>
          <g className="fx fx-fs-page">
            <g className="acc">
              <path
                d="M-0.5,-27.5Q-0.5,-29.7 -0.3,-29.9L-0.2,-29.9Q0,-30 2,-29L21,-19.5Q23,-18.5 23,-16.3L23,9.3Q23,11.5 22.7,11.6L22.7,11.6Q22.5,11.8 20.5,10.8L1.4,1.2Q-0.5,0.3 -0.5,-1.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M2.1,-20.9L17.1,-13.4M2.1,-15.9L13.6,-10.2M2.1,-10.9L15.4,-4.3"
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
      <path
        d="M-12.9,-22.4Q-12.9,-23.4 -12.7,-23.5L-12.6,-23.5Q-12.4,-23.7 -11.5,-23.2L16.8,-9.1Q17.7,-8.6 17.7,-7.6L17.7,20.4Q17.7,21.4 17.4,21.5L17.4,21.5Q17.1,21.6 16.3,21.2L-12,7.1Q-12.9,6.6 -12.9,5.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.2,-21.1Q-3.2,-22.3 -2.9,-22.4L-2.9,-22.4Q-2.7,-22.5 -1.6,-22L4.2,-19.1Q5.3,-18.6 5.3,-17.4L5.3,-15.5Q5.3,-14.3 5.1,-14.2L5,-14.2Q4.8,-14.1 3.7,-14.6L-2.1,-17.5Q-3.2,-18 -3.2,-19.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-1.4,-15.6L2.1,-13.9"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-13.7,-17.6Q-13.7,-18.6 -13.5,-18.7L-13.4,-18.8Q-13.2,-18.9 -12.3,-18.4L16,-4.3Q16.9,-3.9 16.9,-2.9L16.9,20.8Q16.9,21.8 16.6,21.9L16.6,21.9Q16.4,22 15.5,21.6L-12.8,7.5Q-13.7,7 -13.7,6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M12,17.2Q12,16 13.1,15.4L32.2,5.9Q33.2,5.4 34.2,5.9L34.4,5.9Q35.4,6.4 35.4,7.6L35.4,16.5Q35.4,17.7 34.3,18.2L15.2,27.8Q14.1,28.3 13.2,27.8L13,27.7Q12,27.2 12,26Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-21.2,4.3Q-21.2,3.1 -20.3,2.6L-20.1,2.5Q-19.1,2 -18,2.6L15.2,19.2Q16.3,19.7 16.3,20.9L16.3,26Q16.3,27.2 15.3,27.7L15.1,27.8Q14.1,28.3 13.1,27.8L-20.1,11.1Q-21.2,10.6 -21.2,9.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-8.8,13.2Q-8.8,14.8 -7.4,15.5L0.3,19.4Q1.8,20.1 1.8,18.5L1.8,18.2Q1.8,16.6 0.3,15.9L-7.4,12Q-8.8,11.3 -8.8,12.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-7.1,13.9L0,17.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="fail">
        <g className="fx fx-fs-mid2">
          <g className="acc">
            <path
              d="M-7.6,-32.5Q-7.6,-33.5 -7.4,-33.7L-7.3,-33.7Q-7.1,-33.8 -6.2,-33.4L22.1,-19.2Q23,-18.8 23,-17.8L23,17.7Q23,18.7 22.7,18.8L22.7,18.9Q22.5,19 21.6,18.5L-6.7,4.4Q-7.6,4 -7.6,3Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-5.8,-35.2Q-5.8,-36.4 -5.6,-36.5L-5.5,-36.6Q-5.3,-36.7 -4.2,-36.1L1.6,-33.2Q2.7,-32.7 2.7,-31.5L2.7,-29.6Q2.7,-28.4 2.4,-28.3L2.4,-28.3Q2.1,-28.2 1,-28.7L-4.8,-31.6Q-5.8,-32.2 -5.8,-33.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-4.1,-29.8L-0.5,-28"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-8.4,-27.8Q-8.4,-28.8 -8.2,-28.9L-8.1,-28.9Q-7.9,-29 -7,-28.6L21.3,-14.5Q22.2,-14 22.2,-13L22.2,18.1Q22.2,19.1 21.9,19.2L21.9,19.3Q21.7,19.4 20.8,18.9L-7.5,4.8Q-8.4,4.4 -8.4,3.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-fs-page2">
          <g className="acc">
            <path
              d="M-0.5,-27.5Q-0.5,-29.7 -0.3,-29.9L-0.2,-29.9Q0,-30 2,-29L21,-19.5Q23,-18.5 23,-16.3L23,9.3Q23,11.5 22.7,11.6L22.7,11.6Q22.5,11.8 20.5,10.8L1.4,1.2Q-0.5,0.3 -0.5,-1.9Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2.1,-20.9L17.1,-13.4M2.1,-15.9L13.6,-10.2M2.1,-10.9L15.4,-4.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-fs-hit">
          <g className="acc">
            <path
              d="M1.2,-42L4.7,-41.4M0,-40.2L3.7,-36.2M-2.3,-39.6L-2.4,-36.6M-4.5,-40.3L-8.5,-36.5M-5.7,-42.1L-9.1,-41.7M-5.2,-44.1L-10.3,-46.8M-3.3,-45.4L-4.4,-48.2M-0.9,-45.3L1.3,-50.1M0.9,-44L3.9,-45.4"
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
