import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function LogsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="14.1" cy="21.2" r="55.9">
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
          d="M-34.5,14.1C-36.9,10 -23.2,8.3 -17.5,5.4C-11.8,2.5 -3.8,-2 -0.3,-3.3C3.1,-4.6 1.8,-2.7 2.9,-2.3C4,-2 0.4,-4.2 6.2,-1.4C12.1,1.4 27.7,9.2 38.2,14.5C48.7,19.8 67,26.3 69.3,30.4C71.7,34.5 58,36.1 52.3,39C46.6,41.9 38.5,46.5 35.1,47.8C31.7,49 32.9,47.1 31.8,46.8C30.7,46.5 34.4,48.6 28.5,45.8C22.7,43 7.1,35.2 -3.4,29.9C-13.9,24.6 -32.2,18.1 -34.5,14.1Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-28.3,8.8Q-28.3,6.6 -26.3,5.7L-2,-6.5Q0,-7.5 2,-6.5L54.6,19.8Q56.6,20.8 56.6,23L56.6,26.1Q56.6,28.3 54.6,29.3L30.3,41.4Q28.3,42.4 26.3,41.4L-26.3,15.1Q-28.3,14.1 -28.3,11.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M54.8,21.7L30.1,34Q28.3,34.9 26.5,34L-26.5,7.5"
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
      <g className="okonly">
        <path
          d="M-14.7,4.1A13.8 6.9 0 0 1 12.9,4.1L12.9,5.3A13.8 6.9 0 0 1 -14.7,5.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-0.9"
          cy="4.1"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="acc">
          <path
            d="M-10.9,-0.9A10 5 0 0 1 9.1,-0.9L9.1,4.1A10 5 0 0 1 -10.9,4.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="-0.9"
            cy="-0.9"
            rx="10"
            ry="5"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-10.9,2.3A10 5 0 0 0 9.1,2.3"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-10.9,0.6A10 5 0 0 0 9.1,0.6"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <path
          d="M-14.7,-1.4A13.8 6.9 0 0 1 12.9,-1.4L12.9,-0.9A13.8 6.9 0 0 1 -14.7,-0.9Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-0.9"
          cy="-1.4"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-3.4,-3.2A2.5 1.3 0 0 1 1.6,-3.2L1.6,-1.4A2.5 1.3 0 0 1 -3.4,-1.4Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-0.9"
          cy="-3.2"
          rx="2.5"
          ry="1.3"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g transform="matrix(-0.884,0.442,0.884,0.442,-0.9,-3.2)">
          <g className="reelspin lg-sa">
            <circle
              cx="3.1"
              cy="5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="-6.2"
              cy="0"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="3.1"
              cy="-5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2.4,0L9.4,0M-1.2,2.1L-4.7,8.1M-1.2,-2.1L-4.7,-8.1"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="acc">
          <path d="M-8,7.1L23.9,23L23.9,19L-8,3.1Z" fill="var(--face)" stroke="none" />
          <path
            d="M-8,4.9Q-8,3.1 -6,4.1L21.9,18Q23.9,19 23.9,20.8L23.9,21.2Q23.9,23 21.9,22L-6,8.1Q-8,7.1 -8,5.3Z"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <clipPath id={`${id}-flow-tp`}>
            <path d="M-8,3.1L23.9,19L23.9,23L-8,7.1Z" />
          </clipPath>
          <g clipPath={`url(#${id}-flow-tp)`}>
            <g className="belt" style={s({ '--step': '5.3px 2.7px' })}>
              <path
                d="M-13.3,3.5L-13.3,1.5M-8,6.1L-8,4.1M-2.7,8.8L-2.7,6.8M2.7,11.4L2.7,9.4M8,14.1L8,12.1M13.3,16.7L13.3,14.7M18.6,19.4L18.6,17.4M23.9,22L23.9,20M29.2,24.7L29.2,22.7M34.5,27.3L34.5,25.3M39.8,30L39.8,28M45.1,32.6L45.1,30.6"
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
          d="M-3.9,5.5A1.8 0.9 0 0 1 -0.3,5.5L-0.3,13A1.8 0.9 0 0 1 -3.9,13Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-2.1"
          cy="5.5"
          rx="1.8"
          ry="0.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M13.8,14.3A1.8 0.9 0 0 1 17.4,14.3L17.4,21.8A1.8 0.9 0 0 1 13.8,21.8Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="15.6"
          cy="14.3"
          rx="1.8"
          ry="0.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-2.7,12Q-2.7,9.8 -0.7,8.8L0.7,8.2Q2.7,7.2 4.6,8.2L7.8,9.7Q9.7,10.7 9.7,12.9L9.7,17.3Q9.7,19.5 7.8,20.4L6.4,21.1Q4.4,22.1 2.5,21.1L-0.7,19.6Q-2.7,18.6 -2.7,16.4Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M8,11.6L6.2,12.5Q4.4,13.4 2.7,12.5L-0.9,10.7"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-0.9,15.4Q-0.9,17 0.5,17.7L1.2,18Q2.7,18.7 2.7,17.1L2.7,16.6Q2.7,15 1.2,14.3L0.5,13.9Q-0.9,13.2 -0.9,14.8Z"
          fill="var(--hole)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M17.1,20A13.8 6.9 0 0 1 44.7,20L44.7,21.2A13.8 6.9 0 0 1 17.1,21.2Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="30.9"
          cy="20"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="acc">
          <path
            d="M20.9,15A10 5 0 0 1 40.9,15L40.9,20A10 5 0 0 1 20.9,20Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="30.9"
            cy="15"
            rx="10"
            ry="5"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M20.9,18.2A10 5 0 0 0 40.9,18.2"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M20.9,16.5A10 5 0 0 0 40.9,16.5"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <path
          d="M17.1,14.5A13.8 6.9 0 0 1 44.7,14.5L44.7,15A13.8 6.9 0 0 1 17.1,15Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="30.9"
          cy="14.5"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M28.4,12.7A2.5 1.3 0 0 1 33.4,12.7L33.4,14.5A2.5 1.3 0 0 1 28.4,14.5Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="30.9"
          cy="12.7"
          rx="2.5"
          ry="1.3"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g transform="matrix(-0.884,0.442,0.884,0.442,30.9,12.7)">
          <g className="reelspin lg-sb">
            <circle
              cx="3.1"
              cy="5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="-6.2"
              cy="0"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="3.1"
              cy="-5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2.4,0L9.4,0M-1.2,2.1L-4.7,8.1M-1.2,-2.1L-4.7,-8.1"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <path
          d="M19.4,34.4Q19.4,35.3 20.9,36L21.6,36.3Q23,37 23,36.1L23,35.9Q23,35 21.6,34.3L20.9,34Q19.4,33.3 19.4,34.2Z"
          fill="var(--line)"
          stroke="none"
        />
      </g>
      <g className="fail">
        <path
          d="M-14.7,4.1A13.8 6.9 0 0 1 12.9,4.1L12.9,5.3A13.8 6.9 0 0 1 -14.7,5.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-0.9"
          cy="4.1"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="acc">
          <path
            d="M-10.9,-0.9A10 5 0 0 1 9.1,-0.9L9.1,4.1A10 5 0 0 1 -10.9,4.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="-0.9"
            cy="-0.9"
            rx="10"
            ry="5"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-10.9,2.3A10 5 0 0 0 9.1,2.3"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-10.9,0.6A10 5 0 0 0 9.1,0.6"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <path
          d="M-14.7,-1.4A13.8 6.9 0 0 1 12.9,-1.4L12.9,-0.9A13.8 6.9 0 0 1 -14.7,-0.9Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-0.9"
          cy="-1.4"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-3.4,-3.2A2.5 1.3 0 0 1 1.6,-3.2L1.6,-1.4A2.5 1.3 0 0 1 -3.4,-1.4Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-0.9"
          cy="-3.2"
          rx="2.5"
          ry="1.3"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g transform="matrix(-0.884,0.442,0.884,0.442,-0.9,-3.2)">
          <g className="fx fx-lg-fa">
            <circle
              cx="3.1"
              cy="5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="-6.2"
              cy="0"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="3.1"
              cy="-5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2.4,0L9.4,0M-1.2,2.1L-4.7,8.1M-1.2,-2.1L-4.7,-8.1"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-lg-tape">
          <g className="acc">
            <path d="M-8,7.1L23.9,23L23.9,19L-8,3.1Z" fill="var(--face)" stroke="none" />
            <path
              d="M-8,4.9Q-8,3.1 -6,4.1L21.9,18Q23.9,19 23.9,20.8L23.9,21.2Q23.9,23 21.9,22L-6,8.1Q-8,7.1 -8,5.3Z"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <clipPath id={`${id}-fx-tp`}>
              <path d="M-8,3.1L23.9,19L23.9,23L-8,7.1Z" />
            </clipPath>
            <g clipPath={`url(#${id}-fx-tp)`}>
              <g className="fx fx-lg-tk">
                <path
                  d="M-34.5,-7.2L-34.5,-9.2M-29.2,-4.5L-29.2,-6.5M-23.9,-1.9L-23.9,-3.9M-18.6,0.8L-18.6,-1.2M-13.3,3.5L-13.3,1.5M-8,6.1L-8,4.1M-2.7,8.8L-2.7,6.8M2.7,11.4L2.7,9.4M8,14.1L8,12.1M13.3,16.7L13.3,14.7M18.6,19.4L18.6,17.4M23.9,22L23.9,20"
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
          d="M-3.9,5.5A1.8 0.9 0 0 1 -0.3,5.5L-0.3,13A1.8 0.9 0 0 1 -3.9,13Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="-2.1"
          cy="5.5"
          rx="1.8"
          ry="0.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M13.8,14.3A1.8 0.9 0 0 1 17.4,14.3L17.4,21.8A1.8 0.9 0 0 1 13.8,21.8Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="15.6"
          cy="14.3"
          rx="1.8"
          ry="0.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-2.7,12Q-2.7,9.8 -0.7,8.8L0.7,8.2Q2.7,7.2 4.6,8.2L7.8,9.7Q9.7,10.7 9.7,12.9L9.7,17.3Q9.7,19.5 7.8,20.4L6.4,21.1Q4.4,22.1 2.5,21.1L-0.7,19.6Q-2.7,18.6 -2.7,16.4Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M8,11.6L6.2,12.5Q4.4,13.4 2.7,12.5L-0.9,10.7"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-0.9,15.4Q-0.9,17 0.5,17.7L1.2,18Q2.7,18.7 2.7,17.1L2.7,16.6Q2.7,15 1.2,14.3L0.5,13.9Q-0.9,13.2 -0.9,14.8Z"
          fill="var(--hole)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="fx fx-lg-e1">
          <g className="acc">
            <path
              d="M-2.7,7.8C-0.5,10.2 0.5,14.4 1.8,17.3"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-lg-e2">
          <g className="acc">
            <path
              d="M18.6,18.4C14.5,17.7 11.1,20.1 8,21.2"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-lg-snap">
          <g className="acc">
            <path
              d="M8.7,12.5L12.2,13.1M7.5,14.2L11.2,18.2M5.2,14.9L5.1,17.8M3,14.1L-1,17.9M1.8,12.3L-1.6,12.8M2.3,10.3L-2.8,7.7M4.2,9L3.1,6.2M6.6,9.1L8.8,4.4M8.4,10.5L11.5,9"
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
          d="M17.1,20A13.8 6.9 0 0 1 44.7,20L44.7,21.2A13.8 6.9 0 0 1 17.1,21.2Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="30.9"
          cy="20"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="acc">
          <path
            d="M20.9,15A10 5 0 0 1 40.9,15L40.9,20A10 5 0 0 1 20.9,20Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="30.9"
            cy="15"
            rx="10"
            ry="5"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M20.9,18.2A10 5 0 0 0 40.9,18.2"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M20.9,16.5A10 5 0 0 0 40.9,16.5"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <path
          d="M17.1,14.5A13.8 6.9 0 0 1 44.7,14.5L44.7,15A13.8 6.9 0 0 1 17.1,15Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="30.9"
          cy="14.5"
          rx="13.8"
          ry="6.9"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M28.4,12.7A2.5 1.3 0 0 1 33.4,12.7L33.4,14.5A2.5 1.3 0 0 1 28.4,14.5Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="30.9"
          cy="12.7"
          rx="2.5"
          ry="1.3"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g transform="matrix(-0.884,0.442,0.884,0.442,30.9,12.7)">
          <g className="fx fx-lg-fb">
            <circle
              cx="3.1"
              cy="5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="-6.2"
              cy="0"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx="3.1"
              cy="-5.4"
              r="2.3"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2.4,0L9.4,0M-1.2,2.1L-4.7,8.1M-1.2,-2.1L-4.7,-8.1"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-lg-lamp">
          <g className="acc">
            <path
              d="M19.4,34.4Q19.4,35.3 20.9,36L21.6,36.3Q23,37 23,36.1L23,35.9Q23,35 21.6,34.3L20.9,34Q19.4,33.3 19.4,34.2Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
      </g>
    </>
  );
}
