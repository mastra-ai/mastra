import type { SceneProps } from './scene-style';

export function MemoryScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="15" cy="14.6" r="43">
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
          d="M-20.4,6.9C-22.9,4 -13.8,3.6 -10.4,1.9C-7.1,0.2 -2.6,-2.6 -0.4,-3.3C1.8,-3.9 1.8,-2.6 2.9,-2.3C4,-2 1.3,-3.6 6.2,-1.3C11,1 23.5,7.2 32,11.5C40.5,15.7 54.4,21.3 56.9,24.2C59.4,27.2 50.3,27.6 47,29.3C43.7,31 39.2,33.7 37,34.4C34.8,35.1 34.8,33.8 33.7,33.5C32.6,33.1 35.3,34.8 30.4,32.5C25.5,30.2 13,24 4.6,19.7C-3.9,15.5 -17.9,9.9 -20.4,6.9Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-14.1,-43.2Q-14.1,-45.4 -12.2,-46.4L-2,-51.5Q0,-52.5 2,-51.5L42.2,-31.4Q44.2,-30.4 44.2,-28.2L44.2,19.9Q44.2,22.1 42.2,23.1L32,28.2Q30.1,29.2 28.1,28.2L-12.2,8.1Q-14.1,7.1 -14.1,4.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M42.4,-29.5L31.8,-24.2Q30.1,-23.3 28.3,-24.2L-12.4,-44.5"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1.8,-49L37.1,-31.3M-1.8,-47.2L20.3,-36.1"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-11.5,1.8Q-11.5,3.4 -10.1,4.1L-2.3,8Q-0.9,8.7 -0.9,7.1L-0.9,-2.2Q-0.9,-3.8 -2.3,-4.5L-10.1,-8.4Q-11.5,-9.1 -11.5,-7.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-9.6,1.9L-1.7,5.9M-9.6,0.3L-1.7,4.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2.7,8.9Q2.7,10.5 4.1,11.2L11.8,15.1Q13.3,15.8 13.3,14.2L13.3,4.9Q13.3,3.3 11.8,2.6L4.1,-1.3Q2.7,-2 2.7,-0.4Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M4.5,9L12.5,13"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M16.8,15.9Q16.8,17.5 18.2,18.3L26,22.1Q27.4,22.8 27.4,21.2L27.4,11.9Q27.4,10.3 26,9.6L18.2,5.8Q16.8,5 16.8,6.6Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M18.7,16.1L26.6,20M18.7,14.4L26.6,18.4M18.7,12.8L26.6,16.8"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-11.5,-14.5Q-11.5,-12.9 -10.1,-12.1L-2.3,-8.3Q-0.9,-7.5 -0.9,-9.1L-0.9,-18.4Q-0.9,-20 -2.3,-20.8L-10.1,-24.6Q-11.5,-25.4 -11.5,-23.8Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-9.6,-14.3L-1.7,-10.4"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2.7,-7.4Q2.7,-5.8 4.1,-5.1L11.8,-1.2Q13.3,-0.5 13.3,-2.1L13.3,-11.4Q13.3,-13 11.8,-13.7L4.1,-17.6Q2.7,-18.3 2.7,-16.7Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M16.8,-0.3Q16.8,1.3 18.2,2L26,5.9Q27.4,6.6 27.4,5L27.4,-4.3Q27.4,-5.9 26,-6.6L18.2,-10.5Q16.8,-11.2 16.8,-9.6Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M18.7,-0.2L26.6,3.8M18.7,-1.8L26.6,2.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-11.5,-30.7Q-11.5,-29.1 -10.1,-28.4L-2.3,-24.5Q-0.9,-23.8 -0.9,-25.4L-0.9,-34.7Q-0.9,-36.3 -2.3,-37L-10.1,-40.9Q-11.5,-41.6 -11.5,-40Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-9.6,-30.6L-1.7,-26.6M-9.6,-32.2L-1.7,-28.2M-9.6,-33.8L-1.7,-29.9"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2.7,-23.6Q2.7,-22 4.1,-21.3L11.8,-17.4Q13.3,-16.7 13.3,-18.3L13.3,-27.6Q13.3,-29.2 11.8,-29.9L4.1,-33.8Q2.7,-34.5 2.7,-32.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M4.5,-23.5L12.5,-19.5M4.5,-25.1L12.5,-21.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M16.8,-16.6Q16.8,-15 18.2,-14.2L26,-10.4Q27.4,-9.7 27.4,-11.3L27.4,-20.6Q27.4,-22.2 26,-22.9L18.2,-26.7Q16.8,-27.5 16.8,-25.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M18.7,-16.4L26.6,-12.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="fx fx-mm-a0">
          <g className="acc">
            <path
              d="M-8.8,-16.8Q-8.8,-17.2 -6.9,-18.2L-0.2,-21.5Q1.8,-22.5 3.7,-21.5L8.6,-19Q10.6,-18.1 10.6,-17.7L10.6,-17.6Q10.6,-17.3 8.6,-16.3L2,-13Q0,-12 -2,-13L-6.9,-15.4Q-8.8,-16.4 -8.8,-16.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M0.9,-20.3L-4.4,-17.6M3.1,-19.2L-0.4,-17.4"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <clipPath id={`${id}-mm-c0`}>
          <path d="M-68.1,2.9L-11.5,-25.4L-0.9,-20L-0.9,-7.5L-57.5,20.7L-68.1,15.4Z" />
        </clipPath>
        <g clipPath={`url(#${id}-mm-c0)`}>
          <g className="fx fx-mm-b0">
            <g className="acc">
              <path
                d="M-8.8,-16.8Q-8.8,-17.2 -6.9,-18.2L-0.2,-21.5Q1.8,-22.5 3.7,-21.5L8.6,-19Q10.6,-18.1 10.6,-17.7L10.6,-17.6Q10.6,-17.3 8.6,-16.3L2,-13Q0,-12 -2,-13L-6.9,-15.4Q-8.8,-16.4 -8.8,-16.8Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M0.9,-20.3L-4.4,-17.6M3.1,-19.2L-0.4,-17.4"
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
        <g className="fx fx-mm-a1">
          <g className="acc">
            <path
              d="M19.4,-18.9Q19.4,-19.3 21.4,-20.3L28.1,-23.6Q30.1,-24.6 32,-23.6L36.9,-21.1Q38.9,-20.2 38.9,-19.8L38.9,-19.7Q38.9,-19.4 36.9,-18.4L30.3,-15.1Q28.3,-14.1 26.3,-15.1L21.4,-17.5Q19.4,-18.5 19.4,-18.9Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M29.2,-22.4L23.9,-19.7M31.4,-21.3L27.8,-19.5"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <clipPath id={`${id}-mm-c1`}>
          <path d="M-39.8,0.8L16.8,-27.5L27.4,-22.2L27.4,-9.7L-29.2,18.6L-39.8,13.3Z" />
        </clipPath>
        <g clipPath={`url(#${id}-mm-c1)`}>
          <g className="fx fx-mm-b1">
            <g className="acc">
              <path
                d="M19.4,-18.9Q19.4,-19.3 21.4,-20.3L28.1,-23.6Q30.1,-24.6 32,-23.6L36.9,-21.1Q38.9,-20.2 38.9,-19.8L38.9,-19.7Q38.9,-19.4 36.9,-18.4L30.3,-15.1Q28.3,-14.1 26.3,-15.1L21.4,-17.5Q19.4,-18.5 19.4,-18.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M29.2,-22.4L23.9,-19.7M31.4,-21.3L27.8,-19.5"
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
        <g className="fx fx-mm-a2">
          <g className="acc">
            <path
              d="M5.3,6.5Q5.3,6.2 7.3,5.2L13.9,1.8Q15.9,0.8 17.9,1.8L22.8,4.3Q24.8,5.3 24.8,5.6L24.8,5.7Q24.8,6 22.8,7L16.1,10.3Q14.1,11.3 12.2,10.3L7.3,7.9Q5.3,6.9 5.3,6.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M15,3.1L9.7,5.7M17.2,4.2L13.7,5.9"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <clipPath id={`${id}-mm-c2`}>
          <path d="M-53.9,26.3L2.7,-2L13.3,3.3L13.3,15.8L-43.3,44.1L-53.9,38.8Z" />
        </clipPath>
        <g clipPath={`url(#${id}-mm-c2)`}>
          <g className="fx fx-mm-b2">
            <g className="acc">
              <path
                d="M5.3,6.5Q5.3,6.2 7.3,5.2L13.9,1.8Q15.9,0.8 17.9,1.8L22.8,4.3Q24.8,5.3 24.8,5.6L24.8,5.7Q24.8,6 22.8,7L16.1,10.3Q14.1,11.3 12.2,10.3L7.3,7.9Q5.3,6.9 5.3,6.6Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M15,3.1L9.7,5.7M17.2,4.2L13.7,5.9"
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
        <g className="acc">
          <path
            d="M2.7,-7.4Q2.7,-5.8 4.1,-5.1L11.8,-1.2Q13.3,-0.5 13.3,-2.1L13.3,-11.4Q13.3,-13 11.8,-13.7L4.1,-17.6Q2.7,-18.3 2.7,-16.7Z"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <clipPath id={`${id}-mm-j`}>
          <path d="M-53.9,10L2.7,-18.3L13.3,-13L13.3,-0.5L-43.3,27.8L-53.9,22.5Z" />
        </clipPath>
        <g clipPath={`url(#${id}-mm-j)`}>
          <g className="acc">
            <path
              d="M-0.4,-5Q-0.4,-5.3 1.5,-6.3L8.2,-9.7Q10.2,-10.7 12.1,-9.7L17,-7.2Q19,-6.2 19,-5.9L19,-5.8Q19,-5.5 17,-4.5L10.4,-1.2Q8.4,-0.2 6.4,-1.2L1.5,-3.6Q-0.4,-4.6 -0.4,-4.9Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M1.4,-6.5Q1.4,-6.9 3.4,-7.9L10.1,-11.2Q12,-12.2 14,-11.2L18.9,-8.7Q20.9,-7.8 20.9,-7.4L20.9,-7.3Q20.9,-7 18.9,-6L12.2,-2.7Q10.3,-1.7 8.3,-2.7L3.4,-5.1Q1.4,-6.1 1.4,-6.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-1.7,-7Q-1.7,-7.3 0.3,-8.3L7,-11.7Q8.9,-12.6 10.9,-11.7L15.8,-9.2Q17.8,-8.2 17.8,-7.9L17.8,-7.8Q17.8,-7.5 15.8,-6.5L9.1,-3.1Q7.2,-2.2 5.2,-3.1L0.3,-5.6Q-1.7,-6.6 -1.7,-6.9Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M1.5,-9.2Q1.5,-9.5 3.5,-10.5L10.1,-13.8Q12.1,-14.8 14.1,-13.8L19,-11.4Q21,-10.4 21,-10.1L21,-10Q21,-9.7 19,-8.7L12.3,-5.3Q10.3,-4.3 8.4,-5.3L3.5,-7.8Q1.5,-8.8 1.5,-9.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-0.2,-9.8Q-0.2,-10.2 1.8,-11.1L8.5,-14.5Q10.4,-15.5 12.4,-14.5L17.3,-12Q19.3,-11 19.3,-10.7L19.3,-10.6Q19.3,-10.3 17.3,-9.3L10.6,-6Q8.7,-5 6.7,-6L1.8,-8.4Q-0.2,-9.4 -0.2,-9.7Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-mm-f">
          <g className="acc">
            <path
              d="M5.3,-8.4Q5.3,-8.7 7.3,-9.7L13.9,-13Q15.9,-14 17.9,-13L22.8,-10.6Q24.8,-9.6 24.8,-9.3L24.8,-9.2Q24.8,-8.9 22.8,-7.9L16.1,-4.5Q14.1,-3.6 12.2,-4.5L7.3,-7Q5.3,-8 5.3,-8.3Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M15,-11.8L9.7,-9.2M17.2,-10.7L13.7,-8.9"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-mm-hit">
          <g className="acc">
            <path
              d="M7,-7.8L10.4,-7.2M5.7,-6.1L9.5,-2.1M3.4,-5.4L3.4,-2.5M1.2,-6.2L-2.8,-2.4M0.1,-8L-3.4,-7.5M0.6,-10L-4.6,-12.6M2.4,-11.3L1.3,-14.1M4.8,-11.2L7,-15.9M6.6,-9.9L9.7,-11.3"
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
