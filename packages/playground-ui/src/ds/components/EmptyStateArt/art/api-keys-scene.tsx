import type { SceneProps } from './scene-style';

export function ApiKeysScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="14.1" cy="14.1" r="42.1">
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
          d="M-20.4,6.9C-22.7,4 -13.8,3.6 -10.4,1.9C-7.1,0.2 -2.6,-2.6 -0.4,-3.3C1.8,-4 1.8,-2.6 2.9,-2.3C4,-2 1.5,-3.5 6.2,-1.3C10.9,0.9 23,6.9 31.1,11C39.3,15.1 52.8,20.4 55.2,23.3C57.5,26.2 48.6,26.7 45.2,28.4C41.9,30.1 37.4,32.9 35.2,33.5C33,34.2 33,32.9 31.9,32.6C30.8,32.3 33.3,33.8 28.6,31.6C23.9,29.4 11.8,23.4 3.7,19.3C-4.5,15.2 -18,9.8 -20.4,6.9Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-14.1,-60.7Q-14.1,-62.9 -12.2,-63.9L-2,-69Q0,-70 2,-69L40.5,-49.8Q42.4,-48.8 42.4,-46.6L42.4,19Q42.4,21.2 40.5,22.2L30.3,27.3Q28.3,28.3 26.3,27.3L-12.2,8.1Q-14.1,7.1 -14.1,4.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M40.7,-47.9L30.1,-42.6Q28.3,-41.7 26.5,-42.6L-12.4,-62"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-10.6,2.2Q-10.6,3.8 -9.2,4.6L23.3,20.8Q24.8,21.5 24.8,19.9L24.8,-36.9Q24.8,-38.5 23.3,-39.2L-9.2,-55.4Q-10.6,-56.2 -10.6,-54.6Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.2,-43.7Q-6.2,-44.2 -5.2,-44.7L-5,-44.8Q-4,-45.3 -3.6,-45.1L-3.5,-45.1Q-3.1,-44.9 -3.1,-44.3L-3.1,-44.2Q-3.1,-43.7 -4.1,-43.2L-4.3,-43.1Q-5.3,-42.5 -5.7,-42.7L-5.8,-42.8Q-6.2,-43 -6.2,-43.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.2,-18.7Q-6.2,-19.2 -5.2,-19.7L-5,-19.8Q-4,-20.3 -3.6,-20.1L-3.5,-20.1Q-3.1,-19.9 -3.1,-19.3L-3.1,-19.2Q-3.1,-18.7 -4.1,-18.2L-4.3,-18.1Q-5.3,-17.5 -5.7,-17.7L-5.8,-17.8Q-6.2,-18 -6.2,-18.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M4.4,-38.4Q4.4,-38.9 5.4,-39.4L5.6,-39.5Q6.6,-40 7,-39.8L7.1,-39.8Q7.5,-39.6 7.5,-39L7.5,-38.9Q7.5,-38.3 6.5,-37.8L6.3,-37.7Q5.3,-37.2 4.9,-37.4L4.8,-37.5Q4.4,-37.7 4.4,-38.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M4.4,-13.4Q4.4,-13.9 5.4,-14.4L5.6,-14.5Q6.6,-15 7,-14.8L7.1,-14.8Q7.5,-14.6 7.5,-14L7.5,-13.9Q7.5,-13.3 6.5,-12.8L6.3,-12.7Q5.3,-12.2 4.9,-12.4L4.8,-12.5Q4.4,-12.7 4.4,-13.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15,-33.1Q15,-33.6 16,-34.1L16.2,-34.2Q17.2,-34.7 17.6,-34.5L17.7,-34.5Q18.1,-34.3 18.1,-33.7L18.1,-33.6Q18.1,-33 17.1,-32.5L16.9,-32.4Q15.9,-31.9 15.5,-32.1L15.4,-32.2Q15,-32.4 15,-33Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15,-8.1Q15,-8.6 16,-9.1L16.2,-9.2Q17.2,-9.7 17.6,-9.5L17.7,-9.5Q18.1,-9.3 18.1,-8.7L18.1,-8.6Q18.1,-8 17.1,-7.5L16.9,-7.4Q15.9,-6.9 15.5,-7.1L15.4,-7.2Q15,-7.4 15,-8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-8.1,-41.7Q-8.1,-43.9 -7.7,-44.1L-7.6,-44.2Q-7.1,-44.4 -5.1,-43.4L-2,-41.8Q0,-40.9 0,-38.7L0,-28.1Q0,-25.9 -0.5,-25.6L-0.6,-25.6Q-1.1,-25.3 -3,-26.3L-6.2,-27.9Q-8.1,-28.9 -8.1,-31.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-5.5,-39.3Q-5.5,-38.2 -4.7,-37.8L-4.5,-37.7Q-3.7,-37.3 -3.7,-38.4L-3.7,-38.6Q-3.7,-39.8 -4.5,-40.2L-4.7,-40.3Q-5.5,-40.7 -5.5,-39.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M2.5,-36.4Q2.5,-38.6 3,-38.8L3.1,-38.8Q3.5,-39.1 5.5,-38.1L8.6,-36.5Q10.6,-35.6 10.6,-33.4L10.6,-22.8Q10.6,-20.6 10.1,-20.3L10,-20.3Q9.5,-20 7.6,-21L4.4,-22.6Q2.5,-23.6 2.5,-25.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M5.1,-34Q5.1,-32.9 5.9,-32.5L6.1,-32.4Q6.9,-32 6.9,-33.1L6.9,-33.3Q6.9,-34.5 6.1,-34.9L5.9,-35Q5.1,-35.4 5.1,-34.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-8.1,-16.7Q-8.1,-18.9 -7.7,-19.1L-7.6,-19.2Q-7.1,-19.4 -5.1,-18.4L-2,-16.8Q0,-15.9 0,-13.7L0,-3.1Q0,-0.9 -0.5,-0.6L-0.6,-0.6Q-1.1,-0.3 -3,-1.3L-6.2,-2.9Q-8.1,-3.9 -8.1,-6.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-5.5,-14.3Q-5.5,-13.2 -4.7,-12.8L-4.5,-12.7Q-3.7,-12.3 -3.7,-13.4L-3.7,-13.6Q-3.7,-14.8 -4.5,-15.2L-4.7,-15.3Q-5.5,-15.7 -5.5,-14.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="acc swing">
          <path
            d="M13.1,-6.1Q13.1,-8.3 13.6,-8.5L13.7,-8.5Q14.1,-8.8 16.1,-7.8L19.2,-6.2Q21.2,-5.2 21.2,-3L21.2,7.6Q21.2,9.8 20.7,10L20.6,10Q20.2,10.3 18.2,9.3L15.1,7.7Q13.1,6.7 13.1,4.5Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M15.7,-3.7Q15.7,-2.6 16.5,-2.2L16.7,-2.1Q17.5,-1.7 17.5,-2.8L17.5,-3Q17.5,-4.2 16.7,-4.6L16.5,-4.7Q15.7,-5.1 15.7,-3.9Z"
            fill="var(--hole)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M14.9,1.4L18.4,3.1M14.9,3.9L17.5,5.2"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g className="fail">
        <g className="fx fx-ak-flat">
          <g className="acc">
            <path
              d="M-3.5,27.5Q-3.5,26.8 -1.6,25.8L5.1,22.5Q7.1,21.5 9,22.5L11.3,23.6Q13.3,24.6 13.3,25.3L13.3,25.4Q13.3,26.1 11.3,27.1L4.6,30.4Q2.7,31.4 0.7,30.4L-1.6,29.3Q-3.5,28.3 -3.5,27.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-2.2,27A4.4 2.2 0 0 1 6.6,27L6.6,28.5A4.4 2.2 0 0 1 -2.2,28.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="2.2"
              cy="27"
              rx="4.4"
              ry="2.2"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="2.2"
              cy="27"
              rx="1.3"
              ry="0.6"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-ak-key">
          <g className="acc">
            <path
              d="M13.1,-6.1Q13.1,-8.3 13.6,-8.5L13.7,-8.5Q14.1,-8.8 16.1,-7.8L19.2,-6.2Q21.2,-5.2 21.2,-3L21.2,7.6Q21.2,9.8 20.7,10L20.6,10Q20.2,10.3 18.2,9.3L15.1,7.7Q13.1,6.7 13.1,4.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M15.7,-3.7Q15.7,-2.6 16.5,-2.2L16.7,-2.1Q17.5,-1.7 17.5,-2.8L17.5,-3Q17.5,-4.2 16.7,-4.6L16.5,-4.7Q15.7,-5.1 15.7,-3.9Z"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M14.9,1.4L18.4,3.1M14.9,3.9L17.5,5.2"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-ak-dust0">
          <circle
            cx="6.3"
            cy="26.5"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ak-dust1">
          <circle
            cx="4"
            cy="25.2"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ak-dust2">
          <circle
            cx="1.7"
            cy="24"
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
    </>
  );
}
