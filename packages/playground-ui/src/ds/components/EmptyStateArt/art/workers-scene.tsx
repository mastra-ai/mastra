import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function WorkersScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="-25.7" cy="27.6" r="69.5">
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
          d="M-92.9,45.2C-90.6,41.2 -72.9,34.6 -62.8,29.2C-52.8,23.8 -40.3,16.8 -32.5,12.8C-24.7,8.7 -21.4,7.3 -15.9,4.6C-10.5,2 -2.9,-2.2 0.3,-3.3C3.6,-4.5 2.5,-2.6 3.6,-2.3C4.7,-1.9 3.4,-2.9 6.9,-1.3C10.5,0.4 18.9,4.8 24.9,7.9C30.9,10.9 42.5,14.1 42.8,16.9C43.1,19.8 32.1,22.3 26.7,25C21.4,27.7 18.7,29.2 10.6,33.2C2.5,37.2 -11,43.7 -21.8,48.7C-32.5,53.8 -48.1,61.3 -54,63.6C-59.9,65.9 -56.2,62.9 -57.3,62.6C-58.4,62.2 -57.3,63.1 -60.6,61.6C-63.8,60 -71.4,56.1 -76.7,53.4C-82.1,50.7 -95.2,49.3 -92.9,45.2Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-59.2,34.8Q-59.2,32.6 -57.3,31.6L-20.5,13.2Q-18.6,12.2 -16.6,13.2L-6.4,18.3Q-4.4,19.3 -4.4,21.5L-4.4,22.1Q-4.4,24.3 -6.4,25.3L-43.1,43.7Q-45.1,44.6 -47.1,43.7L-57.3,38.6Q-59.2,37.6 -59.2,35.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.2,20.2L-43.3,38.8Q-45.1,39.6 -46.9,38.8L-57.5,33.5"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-26.5,-22Q-26.5,-24.2 -24.6,-25.2L-2,-36.5Q0,-37.5 2,-36.5L28.1,-23.5Q30.1,-22.5 30.1,-20.3L30.1,12.8Q30.1,15 28.1,16L5.5,27.3Q3.5,28.3 1.6,27.3L-24.6,14.2Q-26.5,13.3 -26.5,11.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M28.3,-21.6L5.3,-10.1Q3.5,-9.2 1.8,-10.1L-24.8,-23.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-18.6,15.6Q-18.6,17.2 -17.1,18L-5.9,23.6Q-4.4,24.3 -4.4,22.7L-4.4,5.9Q-4.4,4.3 -5.9,3.6L-17.1,-2Q-18.6,-2.8 -18.6,-1.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,-32.2L19.4,-22.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="acc lamp4" style={s({ '--delay': '-6.4s' })}>
          <path
            d="M-20.3,-12.7Q-20.3,-11.1 -18.9,-10.4L-18.6,-10.3Q-17.2,-9.6 -17.2,-11.2L-17.2,-12.4Q-17.2,-14 -18.6,-14.7L-18.9,-14.8Q-20.3,-15.5 -20.3,-13.9Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc lamp4" style={s({ '--delay': '-4.8s' })}>
          <path
            d="M-15.5,-10.3Q-15.5,-8.7 -14.1,-8L-13.8,-7.9Q-12.4,-7.2 -12.4,-8.8L-12.4,-9.9Q-12.4,-11.5 -13.8,-12.2L-14.1,-12.4Q-15.5,-13.1 -15.5,-11.5Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc lamp4" style={s({ '--delay': '-3.2s' })}>
          <path
            d="M-10.6,-7.9Q-10.6,-6.3 -9.2,-5.6L-8.9,-5.4Q-7.5,-4.7 -7.5,-6.3L-7.5,-7.5Q-7.5,-9.1 -8.9,-9.8L-9.2,-10Q-10.6,-10.7 -10.6,-9.1Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc lamp4" style={s({ '--delay': '-1.6s' })}>
          <path
            d="M-5.7,-5.5Q-5.7,-3.9 -4.3,-3.1L-4.1,-3Q-2.7,-2.3 -2.7,-3.9L-2.7,-5.1Q-2.7,-6.7 -4.1,-7.4L-4.3,-7.5Q-5.7,-8.2 -5.7,-6.6Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <clipPath id={`${id}-wk-belt`}>
          <path d="M-18.6,-2.8L-4.4,4.3L-4.4,24.3L-18.6,17.2Z" />
          <path d="M-59.2,12.6L-18.6,-7.8L-4.4,-0.7L-4.4,24.3L-45.1,44.6L-59.2,37.6Z" />
        </clipPath>
        <g clipPath={`url(#${id}-wk-belt)`}>
          <g className="acc tick" style={s({ '--dur': '1.6s', '--step': '-11.5px 5.7px' })}>
            <path
              d="M4.4,-5.3Q4.4,-7.5 6.4,-8.5L9.5,-10Q11.5,-11 13.5,-10L18.4,-7.6Q20.3,-6.6 20.3,-4.4L20.3,1.2Q20.3,3.4 18.4,4.4L15.2,6Q13.3,6.9 11.3,6L6.4,3.5Q4.4,2.5 4.4,0.3Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M18.6,-5.7L15,-3.9Q13.3,-3.1 11.5,-3.9L6.2,-6.6"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-7.1,0.5Q-7.1,-1.7 -5.1,-2.7L-2,-4.3Q0,-5.3 2,-4.3L6.9,-1.8Q8.8,-0.9 8.8,1.3L8.8,6.9Q8.8,9.1 6.9,10.1L3.7,11.7Q1.8,12.7 -0.2,11.7L-5.1,9.2Q-7.1,8.3 -7.1,6.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M7.1,0L3.5,1.8Q1.8,2.7 0,1.8L-5.3,-0.9"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-18.6,6.2Q-18.6,4 -16.6,3L-13.5,1.5Q-11.5,0.5 -9.5,1.5L-4.6,3.9Q-2.7,4.9 -2.7,7.1L-2.7,12.7Q-2.7,14.9 -4.6,15.9L-7.8,17.4Q-9.7,18.4 -11.7,17.4L-16.6,15Q-18.6,14 -18.6,11.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-4.4,5.8L-8,7.5Q-9.7,8.4 -11.5,7.5L-16.8,4.9"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-30.1,12Q-30.1,9.8 -28.1,8.8L-25,7.2Q-23,6.2 -21,7.2L-16.1,9.7Q-14.1,10.6 -14.1,12.8L-14.1,18.4Q-14.1,20.6 -16.1,21.6L-19.2,23.2Q-21.2,24.2 -23.2,23.2L-28.1,20.7Q-30.1,19.8 -30.1,17.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-15.9,11.5L-19.4,13.3Q-21.2,14.2 -23,13.3L-28.3,10.6"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-41.5,17.7Q-41.5,15.5 -39.6,14.5L-36.4,12.9Q-34.5,12 -32.5,12.9L-27.6,15.4Q-25.6,16.4 -25.6,18.6L-25.6,24.2Q-25.6,26.4 -27.6,27.4L-30.7,28.9Q-32.7,29.9 -34.7,28.9L-39.6,26.5Q-41.5,25.5 -41.5,23.3Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-27.4,17.3L-30.9,19Q-32.7,19.9 -34.5,19L-39.8,16.4"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-53,23.4Q-53,21.2 -51.1,20.3L-47.9,18.7Q-46,17.7 -44,18.7L-39.1,21.1Q-37.1,22.1 -37.1,24.3L-37.1,29.9Q-37.1,32.1 -39.1,33.1L-42.2,34.7Q-44.2,35.7 -46.2,34.7L-51.1,32.2Q-53,31.2 -53,29Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-38.9,23L-42.4,24.8Q-44.2,25.7 -46,24.8L-51.3,22.1"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-64.5,29.2Q-64.5,27 -62.6,26L-59.4,24.4Q-57.5,23.5 -55.5,24.4L-50.6,26.9Q-48.6,27.9 -48.6,30.1L-48.6,35.7Q-48.6,37.9 -50.6,38.9L-53.7,40.4Q-55.7,41.4 -57.7,40.4L-62.6,38Q-64.5,37 -64.5,34.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-50.4,28.8L-53.9,30.5Q-55.7,31.4 -57.5,30.5L-62.8,27.9"
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
      <g className="fail">
        <g className="acc">
          <path
            d="M-42,17.9Q-42,15.7 -40,14.7L-36.9,13.2Q-34.9,12.2 -33,13.2L-28,15.6Q-26.1,16.6 -26.1,18.8L-26.1,24.4Q-26.1,26.6 -28,27.6L-31.2,29.2Q-33.1,30.1 -35.1,29.2L-40,26.7Q-42,25.7 -42,23.5Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-27.8,17.5L-31.4,19.3Q-33.1,20.1 -34.9,19.3L-40.2,16.6"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-53.5,23.7Q-53.5,21.5 -51.5,20.5L-48.4,18.9Q-46.4,17.9 -44.4,18.9L-39.5,21.4Q-37.6,22.3 -37.6,24.5L-37.6,30.1Q-37.6,32.3 -39.5,33.3L-42.7,34.9Q-44.6,35.9 -46.6,34.9L-51.5,32.4Q-53.5,31.5 -53.5,29.3Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-39.3,23.2L-42.9,25Q-44.6,25.9 -46.4,25L-51.7,22.3"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-wk-crate">
          <g className="acc">
            <path
              d="M-30.5,12.2Q-30.5,10 -28.5,9L-25.4,7.4Q-23.4,6.4 -21.5,7.4L-16.6,9.9Q-14.6,10.9 -14.6,13.1L-14.6,18.7Q-14.6,20.9 -16.6,21.8L-19.7,23.4Q-21.7,24.4 -23.6,23.4L-28.5,21Q-30.5,20 -30.5,17.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-16.4,11.7L-19.9,13.5Q-21.7,14.4 -23.4,13.5L-28.7,10.9"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-wk-l0">
          <g className="acc">
            <path
              d="M-20.3,-12.7Q-20.3,-11.1 -18.9,-10.4L-18.6,-10.3Q-17.2,-9.6 -17.2,-11.2L-17.2,-12.4Q-17.2,-14 -18.6,-14.7L-18.9,-14.8Q-20.3,-15.5 -20.3,-13.9Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-wk-l1">
          <g className="acc">
            <path
              d="M-15.5,-10.3Q-15.5,-8.7 -14.1,-8L-13.8,-7.9Q-12.4,-7.2 -12.4,-8.8L-12.4,-9.9Q-12.4,-11.5 -13.8,-12.2L-14.1,-12.4Q-15.5,-13.1 -15.5,-11.5Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-wk-l2">
          <g className="acc">
            <path
              d="M-10.6,-7.9Q-10.6,-6.3 -9.2,-5.6L-8.9,-5.4Q-7.5,-4.7 -7.5,-6.3L-7.5,-7.5Q-7.5,-9.1 -8.9,-9.8L-9.2,-10Q-10.6,-10.7 -10.6,-9.1Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-wk-l3">
          <g className="acc">
            <path
              d="M-5.7,-5.5Q-5.7,-3.9 -4.3,-3.1L-4.1,-3Q-2.7,-2.3 -2.7,-3.9L-2.7,-5.1Q-2.7,-6.7 -4.1,-7.4L-4.3,-7.5Q-5.7,-8.2 -5.7,-6.6Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-wk-smoke0">
          <circle
            cx="-10.1"
            cy="0.1"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-wk-smoke1">
          <circle
            cx="-12.4"
            cy="-1.2"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-wk-smoke2">
          <circle
            cx="-14.7"
            cy="-2.4"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-wk-dust0">
          <circle
            cx="-16.7"
            cy="39.3"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-wk-dust1">
          <circle
            cx="-19"
            cy="38.1"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-wk-dust2">
          <circle
            cx="-21.3"
            cy="36.8"
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
      <path
        d="M-86.6,17.3Q-86.6,15.1 -84.7,14.1L-65.6,4.6Q-63.6,3.6 -61.7,4.6L-39.1,15.9Q-37.1,16.9 -37.1,19.1L-37.1,44.7Q-37.1,46.9 -39.1,47.8L-58.1,57.4Q-60.1,58.3 -62.1,57.4L-84.7,46.1Q-86.6,45.1 -86.6,42.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-38.9,17.7L-58.3,27.5Q-60.1,28.3 -61.9,27.5L-84.9,16"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-81.3,27.7L-69,33.9M-81.3,32.7L-74.3,36.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-69,44.8Q-69,46.4 -67.5,47.1L-65.1,48.4Q-63.6,49.1 -63.6,47.5L-63.6,43.2Q-63.6,41.6 -65.1,40.9L-67.5,39.6Q-69,38.9 -69,40.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}
