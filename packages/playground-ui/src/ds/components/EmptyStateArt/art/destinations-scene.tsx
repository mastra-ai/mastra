import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function DestinationsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="-3.5" cy="8.8" r="16.4">
          <stop offset=".2" stopColor="#fff" />
          <stop offset=".9" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-gm0`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
          <rect x="-400" y="-400" width="800" height="800" fill={`url(#${id}-gg0)`} />
        </mask>
        <radialGradient id={`${id}-gg1`} gradientUnits="userSpaceOnUse" cx="-19.4" cy="32.7" r="23.5">
          <stop offset=".2" stopColor="#fff" />
          <stop offset=".9" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-gm1`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
          <rect x="-400" y="-400" width="800" height="800" fill={`url(#${id}-gg1)`} />
        </mask>
      </defs>
      <g className="ground">
        <path
          mask={`url(#${id}-gm0)`}
          d="M-13.3,8.8C-13.3,8 -10.3,7.2 -8.7,6.3C-7.1,5.5 -5.2,4 -3.8,3.7C-2.4,3.4 -1.5,4.3 -0.3,4.6C0.9,5 2,5.2 3.4,5.8C4.8,6.4 6.6,7.6 8.2,8.4C9.7,9.3 12.8,10.1 12.8,10.9C12.7,11.7 9.7,12.5 8.1,13.4C6.5,14.2 4.7,15.7 3.3,16C1.9,16.2 0.9,15.4 -0.3,15C-1.5,14.7 -2.5,14.5 -3.9,13.9C-5.3,13.2 -7.2,12.1 -8.7,11.2C-10.3,10.4 -13.3,9.6 -13.3,8.8Z"
          fill={`url(#${id}-gh)`}
        />
        <path
          mask={`url(#${id}-gm1)`}
          d="M-36.3,32.7C-36.3,31.3 -30.9,29.8 -28.1,28.4C-25.4,27 -21.6,24.6 -19.6,24C-17.7,23.4 -17.4,24.6 -16.2,25C-15,25.3 -14.7,25.1 -12.7,26C-10.7,26.9 -7,29 -4.2,30.5C-1.5,31.9 3.9,33.3 3.9,34.7C3.9,36.2 -1.5,37.6 -4.3,39C-7,40.5 -10.8,42.8 -12.7,43.4C-14.7,44 -15,42.8 -16.2,42.4C-17.4,42.1 -17.7,42.3 -19.7,41.4C-21.7,40.5 -25.4,38.4 -28.2,36.9C-30.9,35.5 -36.3,34.1 -36.3,32.7Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-7.1,-31.5Q-7.1,-33.7 -5.5,-34.5L-5.1,-34.6Q-3.5,-35.4 -1.9,-34.6L-1.6,-34.5Q0,-33.7 0,-31.5L0,6.6Q0,8.8 -1.6,9.6L-1.9,9.8Q-3.5,10.6 -5.1,9.8L-5.5,9.6Q-7.1,8.8 -7.1,6.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-21.2,-29Q-21.2,-30.1 -19.2,-31.1L-3.7,-38.9Q-1.8,-39.8 0.2,-38.9L6.9,-35.5Q8.8,-34.5 8.8,-33.4L8.8,-33.2Q8.8,-32 6.9,-31.1L-8.6,-23.3Q-10.6,-22.3 -12.6,-23.3L-19.2,-26.6Q-21.2,-27.6 -21.2,-28.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-26.5,-42Q-26.5,-44.2 -26,-46.4L-25.9,-47Q-25.3,-49.2 -24.8,-49.8L-24.7,-49.9Q-24.2,-50.5 -23.6,-50.8L-23.5,-50.9Q-23,-51.1 -21,-52.1L1.6,-63.4Q3.5,-64.4 4.1,-64.5L4.2,-64.5Q4.7,-64.6 5.3,-64.5L5.4,-64.5Q5.9,-64.4 6.4,-64.2L6.5,-64.2Q7.1,-64 7.6,-63.6L7.7,-63.6Q8.3,-63.2 8.8,-62.8L8.9,-62.7Q9.4,-62.2 10,-61.6L10.1,-61.5Q10.6,-60.9 11.1,-60L11.3,-59.9Q11.8,-59.1 12.3,-57.9L12.4,-57.7Q13,-56.5 13.4,-54.4L13.7,-52.6Q14.1,-50.4 14.1,-48.2L14.1,-37.6Q14.1,-35.4 12.2,-34.4L-10.4,-23.2Q-12.4,-22.2 -14.3,-23.2L-24.6,-28.3Q-26.5,-29.2 -26.5,-31.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-26.5,-29.2L-12.4,-22.2L-12.4,-37.2L-13.6,-43.3L-14.7,-45.8L-15.9,-47.6L-17.1,-49L-18.3,-50L-19.4,-50.7L-20.6,-51.2L-21.8,-51.3L-23,-51.1L-24.2,-50.5L-25.3,-49.2L-26.5,-44.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-24.8,-30.9L-14.1,-25.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-23,-35.8Q-23,-35 -21.6,-34.3L-17.3,-32.2Q-15.9,-31.4 -15.9,-32.3L-15.9,-32.5Q-15.9,-33.3 -17.3,-34L-21.6,-36.1Q-23,-36.8 -23,-36Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-30.1,14.9Q-30.1,12.7 -28.1,11.7L-21.4,8.4Q-19.4,7.4 -17.5,8.4L-10.8,11.7Q-8.8,12.7 -8.8,14.9L-8.8,30.5Q-8.8,32.7 -10.8,33.7L-17.5,37Q-19.4,38 -21.4,37L-28.1,33.7Q-30.1,32.7 -30.1,30.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-10.6,13.6L-17.7,17.1Q-19.4,18 -21.2,17.1L-28.3,13.6"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-28.3,12.2Q-28.3,11.7 -26.3,10.7L-21.4,8.3Q-19.4,7.3 -17.5,8.3L-14.3,9.8Q-12.4,10.8 -12.4,11.3L-12.4,11.4Q-12.4,11.8 -14.3,12.8L-19.2,15.3Q-21.2,16.2 -23.2,15.3L-26.3,13.7Q-28.3,12.7 -28.3,12.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-28.3,11.6Q-28.3,11.1 -26.3,10.2L-21.4,7.7Q-19.4,6.7 -17.5,7.7L-14.3,9.3Q-12.4,10.3 -12.4,10.7L-12.4,10.8Q-12.4,11.3 -14.3,12.2L-19.2,14.7Q-21.2,15.7 -23.2,14.7L-26.3,13.1Q-28.3,12.1 -28.3,11.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g
          className="acc mbfly"
          style={s({ '--up': '0px -37.5px', '--over': '-4px -45.5px', '--mouth': '-4px -41.3px' })}
        >
          <path
            d="M-27.8,10.4Q-27.8,9.9 -25.9,8.9L-21,6.5Q-19,5.5 -17,6.5L-14.8,7.6Q-12.8,8.6 -12.8,9.1L-12.8,9.1Q-12.8,9.6 -14.8,10.6L-19.7,13Q-21.7,14 -23.6,13L-25.9,11.9Q-27.8,10.9 -27.8,10.5Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-19,5.5L-19.4,8.8M-19.4,8.8L-12.8,8.6"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <clipPath id={`${id}-mb-slot`}>
          <path d="M-67.2,-14.7L-23,-36.8L-15.9,-33.3L-15.9,-31.4L-60.1,-9.3L-67.2,-12.9Z" />
        </clipPath>
        <g clipPath={`url(#${id}-mb-slot)`}>
          <g className="acc mbin" style={s({ '--push': '9.7px -4.9px' })}>
            <path
              d="M-31.8,-30.9Q-31.8,-31.4 -29.9,-32.3L-25,-34.8Q-23,-35.8 -21,-34.8L-18.8,-33.7Q-16.8,-32.7 -16.8,-32.2L-16.8,-32.1Q-16.8,-31.7 -18.8,-30.7L-23.7,-28.2Q-25.6,-27.3 -27.6,-28.2L-29.9,-29.4Q-31.8,-30.4 -31.8,-30.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="acc mbflag" style={s({ transformOrigin: '8.4px -39.9px' })}>
          <path
            d="M-5.3,-33.5Q-5.3,-34.3 -3.3,-35.3L6.9,-40.4Q8.8,-41.4 9.2,-41.2L9.3,-41.2Q9.7,-41 9.7,-40.2L9.7,-40Q9.7,-39.2 7.8,-38.2L-2.5,-33.1Q-4.4,-32.1 -4.8,-32.3L-4.9,-32.4Q-5.3,-32.6 -5.3,-33.4Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-5.3,-38.4Q-5.3,-40.6 -3.7,-41.4L-3.4,-41.5Q-1.8,-42.3 -1.4,-42.1L-1.3,-42.1Q-0.9,-41.9 -0.9,-39.7L-0.9,-37.9Q-0.9,-35.7 -2.5,-34.9L-2.8,-34.7Q-4.4,-33.9 -4.8,-34.1L-4.9,-34.1Q-5.3,-34.3 -5.3,-36.5Z"
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
        <g className="fx fx-mb-letter">
          <g className="acc">
            <path
              d="M-27.8,10.4Q-27.8,9.9 -25.9,8.9L-21,6.5Q-19,5.5 -17,6.5L-14.8,7.6Q-12.8,8.6 -12.8,9.1L-12.8,9.1Q-12.8,9.6 -14.8,10.6L-19.7,13Q-21.7,14 -23.6,13L-25.9,11.9Q-27.8,10.9 -27.8,10.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-19,5.5L-19.4,8.8M-19.4,8.8L-12.8,8.6"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-mb-flag">
          <g className="acc">
            <path
              d="M-5.3,-33.5Q-5.3,-34.3 -3.3,-35.3L6.9,-40.4Q8.8,-41.4 9.2,-41.2L9.3,-41.2Q9.7,-41 9.7,-40.2L9.7,-40Q9.7,-39.2 7.8,-38.2L-2.5,-33.1Q-4.4,-32.1 -4.8,-32.3L-4.9,-32.4Q-5.3,-32.6 -5.3,-33.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-5.3,-38.4Q-5.3,-40.6 -3.7,-41.4L-3.4,-41.5Q-1.8,-42.3 -1.4,-42.1L-1.3,-42.1Q-0.9,-41.9 -0.9,-39.7L-0.9,-37.9Q-0.9,-35.7 -2.5,-34.9L-2.8,-34.7Q-4.4,-33.9 -4.8,-34.1L-4.9,-34.1Q-5.3,-34.3 -5.3,-36.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-mb-hit">
          <g className="acc">
            <path
              d="M-16,-33.9L-12.6,-33.3M-17.3,-32.1L-13.5,-28.1M-19.5,-31.5L-19.6,-28.5M-21.8,-32.2L-25.7,-28.4M-22.9,-34L-26.4,-33.6M-22.4,-36L-27.6,-38.7M-20.6,-37.3L-21.7,-40.1M-18.2,-37.2L-16,-42M-16.4,-35.9L-13.3,-37.3"
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
      <path
        d="M7,-41.1A1.5 0.8 0 0 1 10,-41.1L10,-39.8A1.5 0.8 0 0 1 7,-39.8Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="8.5"
        cy="-41.1"
        rx="1.5"
        ry="0.8"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}
