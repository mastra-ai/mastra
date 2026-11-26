import type { SceneProps } from './scene-style';

export function ServerErrorScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="4.8" cy="18.8" r="50.5">
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
          d="M-34.4,13.8C-37.8,11.4 -32,12.6 -30.8,12C-29.6,11.4 -30.1,11.6 -27.3,10.2C-24.4,8.8 -18.3,5.7 -13.8,3.4C-9.3,1.1 -3,-2.4 -0.2,-3.4C2.6,-4.4 2,-2.7 3.1,-2.4C4.2,-2.1 1.8,-3.7 6.5,-1.4C11.1,0.8 23,6.9 31.1,11C39.2,15.1 53.4,20.1 55.2,23.3C57,26.4 46.4,27.8 42,30.1C37.6,32.3 31.5,35.5 28.7,36.9C25.9,38.4 26.3,38.2 25.1,38.8C23.9,39.4 22.7,40.5 21.5,40.6C20.3,40.7 19.3,40 18.2,39.6C17.1,39.3 19.6,40.9 14.9,38.7C10.2,36.4 -1.9,30.3 -10.1,26.2C-18.3,22 -30.9,16.2 -34.4,13.8Z"
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
        d="M-23,12.3Q-23,11.5 -22.3,11.2L-21,10.5Q-20.3,10.2 -19.6,10.5L-18.4,11.2Q-17.7,11.5 -17.7,12.3L-17.7,12.5Q-17.7,13.3 -18.4,13.6L-19.6,14.2Q-20.3,14.6 -21,14.2L-22.3,13.6Q-23,13.3 -23,12.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M33.6,20.3Q33.6,19.5 34.3,19.1L35.5,18.5Q36.2,18.1 37,18.5L38.2,19.1Q38.9,19.5 38.9,20.3L38.9,20.4Q38.9,21.2 38.2,21.6L37,22.2Q36.2,22.5 35.5,22.2L34.3,21.6Q33.6,21.2 33.6,20.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M13.3,30.4Q13.3,29.6 14,29.3L15.2,28.7Q15.9,28.3 16.6,28.7L17.8,29.3Q18.6,29.6 18.6,30.4L18.6,30.6Q18.6,31.4 17.8,31.7L16.6,32.4Q15.9,32.7 15.2,32.4L14,31.7Q13.3,31.4 13.3,30.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-26.5,-2.5Q-26.5,-4.7 -24.6,-5.7L-2,-17Q0,-18 2,-17L40.5,2.2Q42.4,3.2 42.4,5.4L42.4,17.3Q42.4,19.5 40.5,20.4L17.9,31.7Q15.9,32.7 13.9,31.7L-24.6,12.5Q-26.5,11.5 -26.5,9.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M40.7,4.1L17.7,15.6Q15.9,16.5 14.1,15.6L-24.8,-3.9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-0.9,-14L34.5,3.7M4.4,6.3L19.4,-1.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-0.9,-10.5L-12.4,-4.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M6.2,-6.9L-5.3,-1.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M13.3,-3.4L1.8,2.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="0" cy="-15.7" r="0.45" fill="var(--line)" />
      <circle cx="37.8" cy="3.2" r="0.45" fill="var(--line)" />
      <circle cx="-21.9" cy="-4.7" r="0.45" fill="var(--line)" />
      <circle cx="15.9" cy="14.2" r="0.45" fill="var(--line)" />
      <path
        d="M-28.1,-2.6Q-28.1,-3.4 -27.5,-3.7L-27.3,-3.8Q-26.7,-4.1 -26,-3.7L-25.1,-3.3Q-24.4,-2.9 -24.4,-2.1L-24.4,11Q-24.4,11.8 -25,12.1L-25.2,12.2Q-25.8,12.5 -26.5,12.2L-27.4,11.7Q-28.1,11.4 -28.1,10.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="-27" cy="-0.3" r="0.45" fill="var(--line)" />
      <circle cx="-27" cy="9.5" r="0.45" fill="var(--line)" />
      <path
        d="M12.4,17.7Q12.4,16.9 13,16.6L13.1,16.5Q13.8,16.2 14.5,16.5L15.4,17Q16.1,17.3 16.1,18.1L16.1,31.3Q16.1,32.1 15.4,32.4L15.3,32.5Q14.7,32.8 14,32.4L13.1,32Q12.4,31.6 12.4,30.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="13.5" cy="19.9" r="0.45" fill="var(--line)" />
      <circle cx="13.5" cy="29.7" r="0.45" fill="var(--line)" />
      <path
        d="M-23.3,9.5Q-23.3,11.1 -21.9,11.8L-17.5,14Q-16.1,14.7 -16.1,13.1L-16.1,4.1Q-16.1,2.5 -17.5,1.8L-21.9,-0.4Q-23.3,-1.1 -23.3,0.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-15.4,13.5Q-15.4,15.1 -14,15.8L-9.6,18Q-8.1,18.7 -8.1,17.1L-8.1,8.1Q-8.1,6.5 -9.6,5.7L-14,3.5Q-15.4,2.8 -15.4,4.4Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-7.4,17.5Q-7.4,19.1 -6,19.8L-1.6,22Q-0.2,22.7 -0.2,21.1L-0.2,12Q-0.2,10.4 -1.6,9.7L-6,7.5Q-7.4,6.8 -7.4,8.4Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0.5,21.4Q0.5,23 2,23.8L6.3,25.9Q7.8,26.7 7.8,25.1L7.8,16Q7.8,14.4 6.3,13.7L2,11.5Q0.5,10.8 0.5,12.4Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8.8,25.4L11.5,26.8"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8.8,22.9L11.5,24.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8.8,20.4L11.5,21.8"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8.8,17.9L11.5,19.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g transform="matrix(0.884,0.442,0,1.25,11.8,18.7)">
        <circle
          r="1.5"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <path
        d="M-23.7,0.9Q-23.7,-0.1 -22.8,-0.6L-21.6,-1.2Q-20.7,-1.6 -19.8,-1.2L-15,1.2Q-14.1,1.6 -14.1,2.6L-14.1,11.9Q-14.1,12.9 -15,13.3L-16.3,14Q-17.1,14.4 -18,14L-22.8,11.6Q-23.7,11.1 -23.7,10.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-22.6,8.7L-18.6,10.7M-22.6,6.7L-18.6,8.7M-22.6,4.7L-18.6,6.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-22.8,2Q-22.8,2.6 -22,3L-21.8,3.1Q-21,3.5 -21,2.9L-21,2.8Q-21,2.2 -21.8,1.8L-22,1.7Q-22.8,1.3 -22.8,1.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-7.8,8.8Q-7.8,7.8 -6.9,7.4L-5.7,6.8Q-4.8,6.3 -3.9,6.8L0.9,9.2Q1.8,9.6 1.8,10.6L1.8,19.9Q1.8,20.9 0.9,21.3L-0.3,21.9Q-1.2,22.4 -2.1,21.9L-6.9,19.5Q-7.8,19.1 -7.8,18.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.7,16.6L-2.7,18.7M-6.7,14.6L-2.7,16.7M-6.7,12.6L-2.7,14.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.9,10Q-6.9,10.5 -6.1,10.9L-5.9,11Q-5.1,11.4 -5.1,10.8L-5.1,10.7Q-5.1,10.2 -5.9,9.8L-6.1,9.7Q-6.9,9.3 -6.9,9.8Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0.2,12.8Q0.2,11.8 1.1,11.4L2.3,10.8Q3.2,10.3 4.1,10.8L8.8,13.1Q9.7,13.6 9.7,14.6L9.7,23.8Q9.7,24.8 8.8,25.3L7.6,25.9Q6.7,26.3 5.8,25.9L1.1,23.5Q0.2,23.1 0.2,22.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1.2,20.6L5.3,22.6M1.2,18.6L5.3,20.6M1.2,16.6L5.3,18.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1.1,13.9Q1.1,14.5 1.9,14.9L2,15Q2.8,15.4 2.8,14.8L2.8,14.7Q2.8,14.1 2,13.7L1.9,13.7Q1.1,13.3 1.1,13.8Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <path
          d="M-15.7,4.9Q-15.7,3.9 -14.8,3.4L-13.6,2.8Q-12.7,2.4 -11.8,2.8L-7.1,5.2Q-6.2,5.6 -6.2,6.6L-6.2,15.9Q-6.2,16.9 -7.1,17.3L-8.3,17.9Q-9.2,18.4 -10.1,17.9L-14.8,15.6Q-15.7,15.1 -15.7,14.1Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-14.7,12.6L-10.6,14.7M-14.7,10.6L-10.6,12.7M-14.7,8.6L-10.6,10.7"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-14.9,6Q-14.9,6.6 -14,7L-13.9,7Q-13.1,7.4 -13.1,6.9L-13.1,6.8Q-13.1,6.2 -13.9,5.8L-14,5.7Q-14.9,5.3 -14.9,5.9Z"
          fill="var(--hole)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="fx fx-sv-led0">
          <g className="acc">
            <path
              d="M-22.9,2Q-22.9,2.6 -22.1,3L-21.9,3.1Q-21.1,3.5 -21.1,2.9L-21.1,2.8Q-21.1,2.3 -21.9,1.8L-22.1,1.8Q-22.9,1.4 -22.9,1.9Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-sv-led1">
          <g className="acc">
            <path
              d="M-14.9,6Q-14.9,6.6 -14.1,7L-14,7.1Q-13.2,7.5 -13.2,6.9L-13.2,6.8Q-13.2,6.2 -14,5.8L-14.1,5.7Q-14.9,5.3 -14.9,5.9Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-sv-led2">
          <g className="acc">
            <path
              d="M-7,10Q-7,10.6 -6.2,11L-6,11.1Q-5.2,11.5 -5.2,10.9L-5.2,10.8Q-5.2,10.2 -6,9.8L-6.2,9.7Q-7,9.3 -7,9.9Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-sv-led3">
          <g className="acc">
            <path
              d="M1,14Q1,14.6 1.8,15L1.9,15Q2.7,15.4 2.7,14.9L2.7,14.8Q2.7,14.2 1.9,13.8L1.8,13.7Q1,13.3 1,13.9Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-sv-pwr">
          <g className="acc">
            <g transform="matrix(0.884,0.442,0,1.25,11.8,18.7)">
              <circle r=".7" fill="var(--line)" />
            </g>
          </g>
        </g>
      </g>
      <g className="fail">
        <g className="acc">
          <path
            d="M-15.4,13.5Q-15.4,15.1 -14,15.8L-9.6,18Q-8.1,18.7 -8.1,17.1L-8.1,8.1Q-8.1,6.5 -9.6,5.7L-14,3.5Q-15.4,2.8 -15.4,4.4Z"
            fill="var(--hole)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <g transform="matrix(0.884,0.442,0,1.25,11.8,18.7)">
            <circle r=".7" fill="var(--line)" />
          </g>
        </g>
        <g className="fx fx-sv-drive">
          <g className="acc">
            <path
              d="M-15.7,4.9Q-15.7,3.9 -14.8,3.4L-13.6,2.8Q-12.7,2.4 -11.8,2.8L-7.1,5.2Q-6.2,5.6 -6.2,6.6L-6.2,15.9Q-6.2,16.9 -7.1,17.3L-8.3,17.9Q-9.2,18.4 -10.1,17.9L-14.8,15.6Q-15.7,15.1 -15.7,14.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-14.7,12.6L-10.6,14.7M-14.7,10.6L-10.6,12.7M-14.7,8.6L-10.6,10.7"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-14.9,6Q-14.9,6.6 -14,7L-13.9,7Q-13.1,7.4 -13.1,6.9L-13.1,6.8Q-13.1,6.2 -13.9,5.8L-14,5.7Q-14.9,5.3 -14.9,5.9Z"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-sv-smoke0">
          <circle
            cx="-11.3"
            cy="3.6"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-sv-smoke1">
          <circle
            cx="-13.6"
            cy="2.3"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-sv-smoke2">
          <circle
            cx="-15.9"
            cy="1.1"
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
