import type { SceneProps } from './scene-style';

export function RequestsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="0" cy="15" r="42.9">
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
          d="M-36.3,15C-36.3,12 -24.4,8.9 -18.4,5.8C-12.4,2.8 -3.7,-2 -0.1,-3.4C3.5,-4.8 2.1,-2.8 3.3,-2.4C4.4,-2.1 3,-3.1 6.6,-1.4C10.2,0.3 18.9,4.8 24.9,7.9C31,11 42.8,14 42.8,17C42.8,20.1 30.9,23.1 24.9,26.2C18.9,29.3 10.2,34.1 6.6,35.5C3,36.9 4.4,34.8 3.3,34.5C2.1,34.2 3.5,35.2 -0.1,33.5C-3.7,31.8 -12.4,27.2 -18.4,24.2C-24.5,21.1 -36.3,18.1 -36.3,15Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-30.1,12.8Q-30.1,11 -27.4,9.7L-2.7,-2.7Q0,-4 2.7,-2.7L27.4,9.7Q30.1,11 30.1,12.8L30.1,13.2Q30.1,15 27.4,16.4L2.7,28.7Q0,30.1 -2.7,28.7L-27.4,16.4Q-30.1,15 -30.1,13.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M28.3,11.9L1.8,25.2Q0,26.1 -1.8,25.2L-28.3,11.9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-27.4,14.6L-2.7,27"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M27.4,14.6L2.7,27"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-12.5,5.7A12.5 6.3 0 0 1 12.5,5.7L12.5,7.5A12.5 6.3 0 0 1 -12.5,7.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="0"
        cy="5.7"
        rx="12.5"
        ry="6.3"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-12.5,6.6A12.5 6.3 0 0 0 12.5,6.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-11.8,5.7C-6.5,-3.3 -4.5,-6.3 0,-6.3C4.5,-6.3 6.5,-3.3 11.8,5.7A11.8 5.9 0 0 1 -11.8,5.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-9.6,1.7A9.6 4.8 0 0 0 9.6,1.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.6,-4.7Q-7.6,-0.2 -7.4,1.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-9,18.2Q-9,17.8 -8.3,17.5L-2.3,14.5Q-1.6,14.1 -0.9,14.5L6.9,18.4Q7.6,18.7 7.6,19.1L7.6,19.2Q7.6,19.6 6.9,20L0.9,23Q0.2,23.3 -0.5,23L-8.3,19.1Q-9,18.7 -9,18.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-9.9,17.4Q-9.9,17 -9.2,16.6L-3.2,13.6Q-2.5,13.3 -1.8,13.6L6,17.5Q6.7,17.9 6.7,18.3L6.7,18.3Q6.7,18.7 6,19.1L0,22.1Q-0.7,22.4 -1.4,22.1L-9.2,18.2Q-9.9,17.8 -9.9,17.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-11,16.5Q-11,16.1 -10.2,15.7L-4.3,12.7Q-3.5,12.4 -2.8,12.7L4.9,16.6Q5.7,17 5.7,17.4L5.7,17.5Q5.7,17.9 4.9,18.2L-1.1,21.2Q-1.8,21.6 -2.5,21.2L-10.2,17.3Q-11,17 -11,16.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.2,14.1L2.8,17.1M-5,14.9L-0.7,17.1M-6.7,15.8L-1.4,18.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="fx fx-rb-plunger">
          <path
            d="M-1.1,-8.5A1.1 0.6 0 0 1 1.1,-8.5L1.1,-5.5A1.1 0.6 0 0 1 -1.1,-5.5Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <g className="acc">
            <path
              d="M-3.5,-10.1A3.5 1.8 0 0 1 3.5,-10.1L3.5,-8.5A3.5 1.8 0 0 1 -3.5,-8.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="0"
              cy="-10.1"
              rx="3.5"
              ry="1.8"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-3.5,-9.3A3.5 1.8 0 0 0 3.5,-9.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-rb-ring0">
          <path
            className="acc"
            d="M5.5,-13.7A7.5 6.5 0 0 1 7,-7M-7,-7A7.5 6.5 0 0 1 -5.5,-13.7"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-rb-ring1">
          <path
            className="acc"
            d="M8.8,-16.3A12 10.3 0 0 1 11.3,-5.7M-11.3,-5.7A12 10.3 0 0 1 -8.8,-16.3"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-rb-ring20">
          <path
            className="acc"
            d="M5.5,-13.7A7.5 6.5 0 0 1 7,-7M-7,-7A7.5 6.5 0 0 1 -5.5,-13.7"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-rb-ring21">
          <path
            className="acc"
            d="M8.8,-16.3A12 10.3 0 0 1 11.3,-5.7M-11.3,-5.7A12 10.3 0 0 1 -8.8,-16.3"
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
        <g className="acc">
          <path
            d="M-1.1,-8.5A1.1 0.6 0 0 1 1.1,-8.5L1.1,-5.5A1.1 0.6 0 0 1 -1.1,-5.5Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-rb-cap">
          <g className="acc">
            <path
              d="M-3.5,-10.1A3.5 1.8 0 0 1 3.5,-10.1L3.5,-8.5A3.5 1.8 0 0 1 -3.5,-8.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="0"
              cy="-10.1"
              rx="3.5"
              ry="1.8"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-3.5,-9.3A3.5 1.8 0 0 0 3.5,-9.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-rb-pop">
          <g className="acc">
            <path
              d="M3.4,-9.4L6.9,-8.8M2.2,-7.7L5.9,-3.7M-0.1,-7L-0.2,-4.1M-2.3,-7.8L-6.3,-4M-3.5,-9.6L-6.9,-9.1M-3,-11.6L-8.1,-14.2M-1.1,-12.9L-2.2,-15.6M1.3,-12.8L3.5,-17.5M3.1,-11.4L6.1,-12.9"
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
