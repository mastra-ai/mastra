import type { SceneProps } from './scene-style';

export function LicenseScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="13.7" cy="20.6" r="48.7">
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
          d="M-34.5,14.1C-35.1,10.9 -23.2,8.3 -17.5,5.4C-11.8,2.5 -3.8,-2 -0.3,-3.3C3.1,-4.6 1.8,-2.7 2.9,-2.3C4,-2 2.2,-3.3 6.2,-1.4C10.3,0.5 20.4,5.5 27.4,9C34.4,12.5 43.8,17 48.1,19.6C52.5,22.3 51.7,23.2 53.4,25C55.2,26.8 59.6,28.6 58.7,30.4C57.8,32.2 51.5,34.1 47.9,35.9C44.3,37.8 40.7,40.9 37,41.5C33.2,42.1 29.2,40.1 25.3,39.4C21.4,38.7 16,37.8 13.4,37.2C10.9,36.7 11.2,36.5 10.1,36.2C8.9,35.8 10.7,37.1 6.7,35.1C2.7,33.2 -7.2,28 -14,24.5C-20.9,20.9 -34,17.2 -34.5,14.1Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-28.3,6.3Q-28.3,4.1 -26.3,3.2L-2,-9Q0,-10 2,-9L33.4,6.7Q35.4,7.7 35.4,9.9L35.4,15.5Q35.4,17.7 33.4,18.7L9,30.8Q7.1,31.8 5.1,30.8L-26.3,15.1Q-28.3,14.1 -28.3,11.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M33.6,8.6L8.8,20.9Q7.1,21.8 5.3,20.9L-26.5,5"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-24.8,10.9L-15.9,15.3M-24.8,12.9L-19.4,15.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M17.7,24.8Q17.7,22.6 19.6,21.6L31.6,15.6Q33.6,14.6 35.6,15.6L44,19.8Q46,20.8 46,23L46,26.1Q46,28.3 44,29.3L32,35.3Q30.1,36.2 28.1,35.3L19.6,31Q17.7,30.1 17.7,27.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M44.2,21.7L31.8,27.9Q30.1,28.7 28.3,27.9L19.4,23.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M35,17.1Q33.6,16.4 32.2,17.1L22.6,21.8Q21.2,22.6 22.6,23.3L28.6,26.3Q30.1,27 31.5,26.3L41,21.5Q42.4,20.8 41,20.1Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="acc">
          <path
            d="M23,21.3Q23,20.9 25,19.9L31.6,16.6Q33.6,15.6 35.6,16.6L40.5,19.1Q42.4,20 42.4,20.4L42.4,20.4Q42.4,20.8 40.5,21.8L33.8,25.1Q31.8,26.1 29.9,25.1L25,22.7Q23,21.7 23,21.3Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M33.6,17.4L37.1,19.2M31.8,18.3L34.5,19.6"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M29.7,21.2A2.6 1.3 0 0 1 34.9,21.2L34.9,21.6A2.6 1.3 0 0 1 29.7,21.6Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="32.3"
            cy="21.2"
            rx="2.6"
            ry="1.3"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M22.8,21Q22.8,20.6 24.8,19.6L31.4,16.3Q33.4,15.3 35.4,16.3L40.3,18.7Q42.3,19.7 42.3,20.1L42.3,20.1Q42.3,20.5 40.3,21.5L33.6,24.8Q31.6,25.8 29.7,24.8L24.8,22.3Q22.8,21.4 22.8,21Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M33.4,17.1L37,18.8M31.6,18L34.3,19.3"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M29.5,20.9A2.6 1.3 0 0 1 34.7,20.9L34.7,21.3A2.6 1.3 0 0 1 29.5,21.3Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="32.1"
            cy="20.9"
            rx="2.6"
            ry="1.3"
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
        <path
          d="M23,21.3Q23,20.9 25,19.9L31.6,16.6Q33.6,15.6 35.6,16.6L40.5,19.1Q42.4,20 42.4,20.4L42.4,20.4Q42.4,20.8 40.5,21.8L33.8,25.1Q31.8,26.1 29.9,25.1L25,22.7Q23,21.7 23,21.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M33.6,17.4L37.1,19.2M31.8,18.3L34.5,19.6"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M29.7,21.2A2.6 1.3 0 0 1 34.9,21.2L34.9,21.6A2.6 1.3 0 0 1 29.7,21.6Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="32.3"
          cy="21.2"
          rx="2.6"
          ry="1.3"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M22.8,21Q22.8,20.6 24.8,19.6L31.4,16.3Q33.4,15.3 35.4,16.3L40.3,18.7Q42.3,19.7 42.3,20.1L42.3,20.1Q42.3,20.5 40.3,21.5L33.6,24.8Q31.6,25.8 29.7,24.8L24.8,22.3Q22.8,21.4 22.8,21Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M33.4,17.1L37,18.8M31.6,18L34.3,19.3"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M29.5,20.9A2.6 1.3 0 0 1 34.7,20.9L34.7,21.3A2.6 1.3 0 0 1 29.5,21.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="32.1"
          cy="20.9"
          rx="2.6"
          ry="1.3"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M5.3,-45.6Q5.3,-47.8 7.3,-48.8L10.4,-50.3Q12.4,-51.3 14.3,-50.3L19.2,-47.9Q21.2,-46.9 21.2,-44.7L21.2,-1.6Q21.2,0.6 19.2,1.6L16.1,3.2Q14.1,4.1 12.2,3.2L7.3,0.7Q5.3,-0.3 5.3,-2.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M19.4,-46L15.9,-44.2Q14.1,-43.4 12.4,-44.2L7.1,-46.9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="fx fx-lc-card">
          <g className="acc">
            <path
              d="M-8,5.9Q-8,5.6 -6,4.6L0.7,1.3Q2.7,0.3 4.6,1.3L9.5,3.7Q11.5,4.7 11.5,5.1L11.5,5.1Q11.5,5.5 9.5,6.5L2.9,9.8Q0.9,10.8 -1.1,9.8L-6,7.3Q-8,6.4 -8,6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2.7,2.1L6.2,3.8M0.9,3L3.5,4.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <g className="fx fx-lc-seal">
              <path
                d="M-1.3,5.9A2.6 1.3 0 0 1 3.9,5.9L3.9,6.3A2.6 1.3 0 0 1 -1.3,6.3Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="1.3"
                cy="5.9"
                rx="2.6"
                ry="1.3"
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
        <clipPath id={`${id}-lc-rc`}>
          <path d="M-3.5,-34.1L1.8,-36.7L7.1,-34.1L7.1,40.9L1.8,43.6L-3.5,40.9Z" />
        </clipPath>
        <g clipPath={`url(#${id}-lc-rc)`}>
          <g className="fx fx-lc-rod">
            <path
              d="M-0.1,-54.1A1.9 0.9 0 0 1 3.7,-54.1L3.7,-21.6A1.9 0.9 0 0 1 -0.1,-21.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="1.8"
              cy="-54.1"
              rx="1.9"
              ry="0.9"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-lc-head">
          <path
            d="M-4.5,-21.6A6.3 3.1 0 0 1 8.1,-21.6L8.1,-14.1A6.3 3.1 0 0 1 -4.5,-14.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="1.8"
            cy="-21.6"
            rx="6.3"
            ry="3.1"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-4.5,-17.8A6.3 3.1 0 0 0 8.1,-17.8"
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
        <g className="fx fx-lc-card2">
          <g className="acc">
            <path
              d="M-8,5.9Q-8,5.6 -6,4.6L0.7,1.3Q2.7,0.3 4.6,1.3L9.5,3.7Q11.5,4.7 11.5,5.1L11.5,5.1Q11.5,5.5 9.5,6.5L2.9,9.8Q0.9,10.8 -1.1,9.8L-6,7.3Q-8,6.4 -8,6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2.7,2.1L6.2,3.8M0.9,3L3.5,4.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-lc-hit">
          <g className="acc">
            <path
              d="M0.8,1.8L4.2,2.4M-0.5,3.5L3.3,7.5M-2.7,4.2L-2.8,7.2M-5,3.5L-8.9,7.3M-6.1,1.6L-9.6,2.1M-5.6,-0.4L-10.8,-3M-3.8,-1.6L-4.9,-4.4M-1.4,-1.6L0.8,-6.3M0.4,-0.2L3.5,-1.6"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <clipPath id={`${id}-lc-rc2`}>
          <path d="M-3.5,-34.1L1.8,-36.7L7.1,-34.1L7.1,40.9L1.8,43.6L-3.5,40.9Z" />
        </clipPath>
        <g clipPath={`url(#${id}-lc-rc2)`}>
          <g className="fx fx-lc-rod2">
            <path
              d="M-0.1,-54.1A1.9 0.9 0 0 1 3.7,-54.1L3.7,-21.6A1.9 0.9 0 0 1 -0.1,-21.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="1.8"
              cy="-54.1"
              rx="1.9"
              ry="0.9"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-lc-head2">
          <g className="acc">
            <path
              d="M-4.5,-21.6A6.3 3.1 0 0 1 8.1,-21.6L8.1,-14.1A6.3 3.1 0 0 1 -4.5,-14.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="1.8"
              cy="-21.6"
              rx="6.3"
              ry="3.1"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-4.5,-17.8A6.3 3.1 0 0 0 8.1,-17.8"
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
      <path
        d="M-8,-36.8Q-8,-39 -6,-40L11.3,-48.6Q13.3,-49.6 15.2,-48.6L18.4,-47.1Q20.3,-46.1 20.3,-43.9L20.3,-42Q20.3,-39.8 18.4,-38.9L1.1,-30.2Q-0.9,-29.2 -2.9,-30.2L-6,-31.8Q-8,-32.8 -8,-35Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M18.6,-45.2L0.9,-36.4Q-0.9,-35.5 -2.7,-36.4L-6.2,-38.1"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}
