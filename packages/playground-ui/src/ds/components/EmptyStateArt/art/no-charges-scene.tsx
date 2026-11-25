import type { SceneProps } from './scene-style';

export function NoChargesScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="3.5" cy="13.3" r="39.5">
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
          d="M-29.2,11.4C-29.8,8.7 -19.7,6.5 -14.9,4.1C-10,1.6 -3.2,-2.3 -0.2,-3.4C2.8,-4.5 2,-2.7 3.1,-2.4C4.2,-2.1 2.9,-3.1 6.5,-1.4C10.1,0.3 18.9,4.8 24.9,7.9C31,11 42.2,14.3 42.8,17.1C43.4,19.8 33.3,22 28.4,24.4C23.6,26.9 16.8,30.8 13.8,31.9C10.8,33 11.6,31.3 10.5,30.9C9.3,30.6 10.7,31.7 7.1,29.9C3.4,28.2 -5.3,23.7 -11.4,20.6C-17.4,17.5 -28.7,14.2 -29.2,11.4Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-2.7,2.1Q-2.7,1.3 -1.9,1L-0.7,0.4Q0,0 0.7,0.4L1.9,1Q2.7,1.3 2.7,2.1L2.7,2.3Q2.7,3.1 1.9,3.5L0.7,4.1Q0,4.4 -0.7,4.1L-1.9,3.5Q-2.7,3.1 -2.7,2.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-19.4,10.5Q-19.4,9.7 -18.7,9.4L-17.5,8.8Q-16.8,8.4 -16.1,8.8L-14.9,9.4Q-14.1,9.7 -14.1,10.5L-14.1,10.7Q-14.1,11.5 -14.9,11.8L-16.1,12.5Q-16.8,12.8 -17.5,12.5L-18.7,11.8Q-19.4,11.5 -19.4,10.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M21.2,14.1Q21.2,13.3 21.9,12.9L23.2,12.3Q23.9,12 24.6,12.3L25.8,12.9Q26.5,13.3 26.5,14.1L26.5,14.2Q26.5,15 25.8,15.4L24.6,16Q23.9,16.4 23.2,16L21.9,15.4Q21.2,15 21.2,14.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M4.4,22.5Q4.4,21.7 5.1,21.3L6.4,20.7Q7.1,20.4 7.8,20.7L9,21.3Q9.7,21.7 9.7,22.5L9.7,22.6Q9.7,23.4 9,23.8L7.8,24.4Q7.1,24.8 6.4,24.4L5.1,23.8Q4.4,23.4 4.4,22.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-23,0.9Q-23,-1.5 -20.8,-2.6L-2.1,-11.9Q0,-13 2.1,-11.9L27.9,1Q30.1,2 30.1,4.4L30.1,10.9Q30.1,13.3 27.9,14.4L9.2,23.7Q7.1,24.8 4.9,23.7L-20.8,10.8Q-23,9.7 -23,7.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M28.3,2.9L8.8,12.6Q7.1,13.5 5.3,12.6L-21.2,-0.6"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-20.9,7.7Q-20.9,9.3 -19.4,10L3.5,21.5Q5,22.2 5,20.6L5,15.3Q5,13.7 3.5,13L-19.4,1.5Q-20.9,0.8 -20.9,2.4Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-16.4,-9Q-16.4,-11 -14.6,-11.9L-3.1,-17.6Q-1.3,-18.5 0.5,-17.6L24.3,-5.7Q26.1,-4.8 26.1,-2.8L26.1,0.7Q26.1,2.7 24.3,3.6L12.8,9.3Q11.1,10.2 9.3,9.3L-14.6,-2.6Q-16.4,-3.5 -16.4,-5.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M24.3,-3.9L12.8,1.8Q11.1,2.7 9.3,1.8L-14.6,-10.1"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-0.6,-15.5Q-1.8,-16.1 -3,-15.5L-3.2,-15.4Q-4.4,-14.8 -3.2,-14.2L-3,-14Q-1.8,-13.4 -0.6,-14L-0.3,-14.2Q0.9,-14.8 -0.3,-15.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M3.2,-13.6Q1.9,-14.2 0.7,-13.6L0.5,-13.5Q-0.7,-12.9 0.5,-12.3L0.7,-12.2Q1.9,-11.6 3.2,-12.2L3.4,-12.3Q4.6,-12.9 3.4,-13.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M6.9,-11.8Q5.7,-12.4 4.5,-11.8L4.2,-11.6Q3,-11 4.2,-10.4L4.5,-10.3Q5.7,-9.7 6.9,-10.3L7.1,-10.4Q8.3,-11 7.1,-11.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M10.6,-9.9Q9.4,-10.5 8.2,-9.9L7.9,-9.8Q6.7,-9.2 7.9,-8.6L8.2,-8.5Q9.4,-7.9 10.6,-8.5L10.8,-8.6Q12,-9.2 10.8,-9.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-4.3,-13.6Q-5.5,-14.2 -6.7,-13.6L-6.9,-13.5Q-8.1,-12.9 -6.9,-12.3L-6.7,-12.2Q-5.5,-11.6 -4.3,-12.2L-4,-12.3Q-2.8,-12.9 -4,-13.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-0.6,-11.8Q-1.8,-12.4 -3,-11.8L-3.2,-11.6Q-4.4,-11 -3.2,-10.4L-3,-10.3Q-1.8,-9.7 -0.6,-10.3L-0.3,-10.4Q0.9,-11 -0.3,-11.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M3.2,-9.9Q1.9,-10.5 0.7,-9.9L0.5,-9.8Q-0.7,-9.2 0.5,-8.6L0.7,-8.5Q1.9,-7.9 3.2,-8.5L3.4,-8.6Q4.6,-9.2 3.4,-9.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M6.9,-8.1Q5.7,-8.7 4.5,-8.1L4.2,-7.9Q3,-7.3 4.2,-6.7L4.5,-6.6Q5.7,-6 6.9,-6.6L7.1,-6.7Q8.3,-7.3 7.1,-7.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-8,-11.8Q-9.2,-12.4 -10.4,-11.8L-10.6,-11.6Q-11.8,-11 -10.6,-10.4L-10.4,-10.3Q-9.2,-9.7 -8,-10.3L-7.7,-10.4Q-6.5,-11 -7.7,-11.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-4.3,-9.9Q-5.5,-10.5 -6.7,-9.9L-6.9,-9.8Q-8.1,-9.2 -6.9,-8.6L-6.7,-8.5Q-5.5,-7.9 -4.3,-8.5L-4,-8.6Q-2.8,-9.2 -4,-9.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-0.6,-8.1Q-1.8,-8.7 -3,-8.1L-3.2,-7.9Q-4.4,-7.3 -3.2,-6.7L-3,-6.6Q-1.8,-6 -0.6,-6.6L-0.3,-6.7Q0.9,-7.3 -0.3,-7.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M3.2,-6.2Q1.9,-6.8 0.7,-6.2L0.5,-6.1Q-0.7,-5.5 0.5,-4.9L0.7,-4.7Q1.9,-4.1 3.2,-4.7L3.4,-4.9Q4.6,-5.5 3.4,-6.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14.5,-8Q13.3,-8.6 11.8,-7.9L4.6,-4.2Q3.2,-3.5 4.4,-2.9L4.6,-2.8Q5.8,-2.2 7.3,-2.9L14.5,-6.5Q15.9,-7.2 14.7,-7.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M11.1,-6Q11.1,-7.2 12.1,-7.8L17.9,-10.7Q19,-11.2 20.1,-10.7L24.6,-8.4Q25.6,-7.9 25.6,-6.7L25.6,-5.3Q25.6,-4.1 24.6,-3.6L18.8,-0.7Q17.7,-0.2 16.6,-0.7L12.1,-2.9Q11.1,-3.5 11.1,-4.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M15.9,-14.2Q15.9,-15 16.6,-15.4L17.8,-16Q18.6,-16.4 19.3,-16L22.7,-14.3Q23.4,-13.9 23.4,-13.1L23.4,-8.5Q23.4,-7.7 22.7,-7.3L21.5,-6.7Q20.8,-6.3 20.1,-6.7L16.6,-8.4Q15.9,-8.8 15.9,-9.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M11.1,-21.3Q11.1,-23.1 12.7,-23.9L17.4,-26.3Q19,-27.1 20.6,-26.3L25.4,-23.9Q27,-23.1 27,-21.3L27,-16.2Q27,-14.4 25.4,-13.6L20.6,-11.2Q19,-10.4 17.4,-11.2L12.7,-13.6Q11.1,-14.4 11.1,-16.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M25.2,-22.2L20.8,-20Q19,-19.1 17.2,-20L12.8,-22.2"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M12,-17.2Q12,-15.6 13.5,-14.9L16.6,-13.3Q18,-12.6 18,-14.2L18,-16.5Q18,-18.1 16.6,-18.8L13.5,-20.4Q12,-21.1 12,-19.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="fx fx-rg-digits">
          <g className="acc">
            <path
              d="M13,-17.8L14.5,-17.1M15,-16.9L16.4,-16.1M13,-16.6L16.4,-14.9"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <clipPath id={`${id}-rg-dr`}>
          <path d="M-68.6,24.4L-20.9,0.6L5,13.5L5,22.2L-42.8,46.1L-68.6,33.2Z" />
        </clipPath>
        <g clipPath={`url(#${id}-rg-dr)`}>
          <g className="fx fx-rg-drawer">
            <g className="acc">
              <path
                d="M-20.9,3.1Q-20.9,2.1 -20,1.6L-9.7,-3.5Q-8.8,-3.9 -7.9,-3.5L15,8Q15.9,8.4 15.9,9.4L15.9,14.7Q15.9,15.7 15,16.1L4.8,21.3Q3.9,21.7 3,21.3L-20,9.8Q-20.9,9.3 -20.9,8.3Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-7.9,-1.7Q-9.3,-2.4 -10.7,-1.7L-16.5,1.2Q-17.9,2 -16.5,2.7L-14.1,3.9Q-12.6,4.6 -11.2,3.9L-5.4,1Q-4,0.3 -5.4,-0.4Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-1.7,1.4Q-3.1,0.7 -4.5,1.4L-10.3,4.3Q-11.8,5 -10.3,5.8L-7.9,7Q-6.5,7.7 -5,7L0.8,4.1Q2.2,3.4 0.8,2.6Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M4.5,4.5Q3.1,3.8 1.7,4.5L-4.1,7.4Q-5.6,8.1 -4.1,8.9L-1.7,10.1Q-0.3,10.8 1.2,10.1L7,7.2Q8.4,6.5 7,5.7Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M10.7,7.6Q9.3,6.9 7.9,7.6L2,10.5Q0.6,11.2 2,11.9L4,12.9Q5.5,13.7 6.9,12.9L12.7,10Q14.1,9.3 12.7,8.6Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10,5.5A1.9 0.9 0 0 1 -6.2,5.5L-6.2,6.5A1.9 0.9 0 0 1 -10,6.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-8.1"
                cy="5.5"
                rx="1.9"
                ry="0.9"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-8.1,6.6A1.9 0.9 0 0 1 -4.3,6.6L-4.3,7.6A1.9 0.9 0 0 1 -8.1,7.6Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-6.2"
                cy="6.6"
                rx="1.9"
                ry="0.9"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-7,5A1.9 0.9 0 0 1 -3.2,5L-3.2,6A1.9 0.9 0 0 1 -7,6Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-5.1"
                cy="5"
                rx="1.9"
                ry="0.9"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-20,7.4Q-20,9 -18.5,9.7L1.6,19.8Q3,20.5 3,18.9L3,16.4Q3,14.8 1.6,14.1L-18.5,4Q-20,3.3 -20,4.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-11.2,10.8Q-11.2,11.5 -9.8,12.2L-7.4,13.4Q-5.9,14.1 -5.9,13.5L-5.9,13.3Q-5.9,12.6 -7.4,11.9L-9.8,10.7Q-11.2,10 -11.2,10.7Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-rg-coin">
            <g className="acc">
              <path
                d="M-2.4,8.7A2.3 1.1 0 0 1 2.2,8.7L2.2,9.8A2.3 1.1 0 0 1 -2.4,9.8Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-0.1"
                cy="8.7"
                rx="2.3"
                ry="1.1"
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
      </g>
      <g className="fail">
        <g className="acc">
          <path
            d="M12,-17.2Q12,-15.6 13.4,-14.9L16.6,-13.3Q18,-12.6 18,-14.2L18,-16.5Q18,-18.1 16.6,-18.8L13.4,-20.4Q12,-21.1 12,-19.5Z"
            fill="var(--hole)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M13.5,-15.8L16.5,-17.8M13.5,-19.3L16.5,-14.3"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <clipPath id={`${id}-rg-drf`}>
          <path d="M-68.6,24.4L-20.9,0.6L5,13.5L5,22.2L-42.8,46.1L-68.6,33.2Z" />
        </clipPath>
        <g clipPath={`url(#${id}-rg-drf)`}>
          <g className="fx fx-rg-jam">
            <g className="acc">
              <path
                d="M-20.9,3.1Q-20.9,2.1 -20,1.6L-9.7,-3.5Q-8.8,-3.9 -7.9,-3.5L15,8Q15.9,8.4 15.9,9.4L15.9,14.7Q15.9,15.7 15,16.1L4.8,21.3Q3.9,21.7 3,21.3L-20,9.8Q-20.9,9.3 -20.9,8.3Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-7.9,-1.7Q-9.3,-2.4 -10.7,-1.7L-16.5,1.2Q-17.9,2 -16.5,2.7L-14.1,3.9Q-12.6,4.6 -11.2,3.9L-5.4,1Q-4,0.3 -5.4,-0.4Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-1.7,1.4Q-3.1,0.7 -4.5,1.4L-10.3,4.3Q-11.8,5 -10.3,5.8L-7.9,7Q-6.5,7.7 -5,7L0.8,4.1Q2.2,3.4 0.8,2.6Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M4.5,4.5Q3.1,3.8 1.7,4.5L-4.1,7.4Q-5.6,8.1 -4.1,8.9L-1.7,10.1Q-0.3,10.8 1.2,10.1L7,7.2Q8.4,6.5 7,5.7Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M10.7,7.6Q9.3,6.9 7.9,7.6L2,10.5Q0.6,11.2 2,11.9L4,12.9Q5.5,13.7 6.9,12.9L12.7,10Q14.1,9.3 12.7,8.6Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10,5.5A1.9 0.9 0 0 1 -6.2,5.5L-6.2,6.5A1.9 0.9 0 0 1 -10,6.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-8.1"
                cy="5.5"
                rx="1.9"
                ry="0.9"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-8.1,6.6A1.9 0.9 0 0 1 -4.3,6.6L-4.3,7.6A1.9 0.9 0 0 1 -8.1,7.6Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-6.2"
                cy="6.6"
                rx="1.9"
                ry="0.9"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-7,5A1.9 0.9 0 0 1 -3.2,5L-3.2,6A1.9 0.9 0 0 1 -7,6Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-5.1"
                cy="5"
                rx="1.9"
                ry="0.9"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-20,7.4Q-20,9 -18.5,9.7L1.6,19.8Q3,20.5 3,18.9L3,16.4Q3,14.8 1.6,14.1L-18.5,4Q-20,3.3 -20,4.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-11.2,10.8Q-11.2,11.5 -9.8,12.2L-7.4,13.4Q-5.9,14.1 -5.9,13.5L-5.9,13.3Q-5.9,12.6 -7.4,11.9L-9.8,10.7Q-11.2,10 -11.2,10.7Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        </g>
        <g className="fx fx-rg-miss">
          <g className="acc">
            <path
              d="M-2.4,8.7A2.3 1.1 0 0 1 2.2,8.7L2.2,9.8A2.3 1.1 0 0 1 -2.4,9.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="-0.1"
              cy="8.7"
              rx="2.3"
              ry="1.1"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-rg-hit">
          <g className="acc">
            <path
              d="M-8.6,10.4L-5.2,11M-9.8,12.1L-6.1,16.1M-12.1,12.8L-12.2,15.7M-14.3,12L-18.3,15.8M-15.5,10.2L-18.9,10.7M-15,8.2L-20.1,5.6M-13.1,6.9L-14.2,4.1M-10.7,7L-8.5,2.3M-8.9,8.4L-5.9,6.9"
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
