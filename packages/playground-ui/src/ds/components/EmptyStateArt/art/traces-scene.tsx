import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function TracesScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="17.7" cy="32.1" r="61.1">
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
          d="M-41.6,17.5C-42.6,13.3 -27.9,10.6 -21,7.1C-14.1,3.6 -4.3,-1.8 -0.3,-3.3C3.7,-4.9 1.9,-2.7 3,-2.4C4.1,-2 2.5,-3.1 6.3,-1.4C10,0.3 19,4.8 25.3,8C31.7,11.1 38.8,14.4 44.5,17.6C50.2,20.8 54.6,23.9 59.6,27.1C64.6,30.3 74.4,33.8 74.6,36.5C74.9,39.2 65.7,41.1 61.2,43.3C56.7,45.6 51.6,49 47.7,50.2C43.8,51.4 41.1,50.5 37.8,50.6C34.5,50.7 29.7,50.9 27.8,50.9C25.8,51 26.7,51 26.1,51C25.6,51 25,51 24.5,51C23.9,50.9 23.4,50.8 22.9,50.7C22.4,50.6 22.1,50.7 21.3,50.5C20.5,50.3 19.1,49.8 17.9,49.5C16.8,49.1 15.3,48.7 14.6,48.4C13.8,48.2 13.7,48.1 13.2,47.9C12.8,47.8 16.6,50.1 11.9,47.4C7.2,44.8 -6.1,37.3 -15,32.3C-23.9,27.3 -40.6,21.7 -41.6,17.5Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-35.4,-7.6Q-35.4,-9.8 -33.4,-10.8L-2,-26.5Q0,-27.5 2,-26.5L29.9,-12.6Q31.8,-11.6 31.8,-9.4L31.8,13.7Q31.8,15.9 29.9,16.9L-1.6,32.6Q-3.5,33.6 -5.5,32.6L-33.4,18.7Q-35.4,17.7 -35.4,15.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M30.1,-10.7L-1.8,5.2Q-3.5,6.1 -5.3,5.2L-33.6,-8.9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-5.6,-18.8Q-7.1,-19.5 -8.5,-18.8L-10.9,-17.6Q-12.4,-16.9 -10.9,-16.2L9.2,-6.1Q10.6,-5.4 12,-6.1L14.5,-7.3Q15.9,-8.1 14.5,-8.8Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-30.1,2.8L-21.2,7.3M-30.1,7.8L-24.8,10.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-15.9,15.8Q-15.9,17.4 -14.5,18.1L-10.3,20.2Q-8.8,20.9 -8.8,19.3L-8.8,15Q-8.8,13.4 -10.3,12.7L-14.5,10.6Q-15.9,9.9 -15.9,11.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M12.4,5.6Q12.4,3.4 14.3,2.5L31.6,-6.2Q33.6,-7.2 35.6,-6.2L59.9,6Q61.9,7 61.9,9.2L61.9,32.3Q61.9,34.5 59.9,35.5L42.6,44.1Q40.7,45.1 38.7,44.1L14.3,31.9Q12.4,30.9 12.4,28.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M60.1,7.9L42.4,16.7Q40.7,17.6 38.9,16.7L14.1,4.3"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M35,-3.8Q33.6,-4.5 32.2,-3.8L19.1,2.7Q17.7,3.4 19.1,4.2L39.2,14.2Q40.7,14.9 42.1,14.2L55.1,7.7Q56.6,7 55.1,6.3Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <clipPath id={`${id}-tr-tray`}>
        <path d="M17.7,-144.1L33.6,-152L56.6,-140.5L56.6,7L40.7,14.9L17.7,3.4Z" />
      </clipPath>
      <g clipPath={`url(#${id}-tr-tray)`}>
        <path
          d="M32.2,-4Q32.2,-6.2 32.7,-6.4L32.8,-6.4Q33.2,-6.7 35.2,-5.7L49,1.2Q50.9,2.2 50.9,4.4L50.9,25Q50.9,27.2 50.4,27.4L50.3,27.4Q49.9,27.7 47.9,26.7L34.1,19.8Q32.2,18.8 32.2,16.6Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <g className="okonly">
        <clipPath id={`${id}-tr-feed`}>
          <path d="M-13.3,-164.8L-8,-167.5L53.9,-136.5L53.9,11L48.6,13.6L-13.3,-17.3Z" />
          <path d="M17.7,-144.1L33.6,-152L56.6,-140.5L56.6,7L40.7,14.9L17.7,3.4Z" />
        </clipPath>
        <g clipPath={`url(#${id}-tr-feed)`}>
          <g
            className="acc job"
            style={s({ '--up': '0px -37.5px', '--over': '35.4px -23.6px', '--in': '35.4px 28.9px' })}
          >
            <path
              d="M-8.5,-14.9Q-8.5,-17.1 -8,-17.3L-7.9,-17.4Q-7.4,-17.6 -5.5,-16.6L10.1,-8.9Q12,-7.9 12,-5.7L12,27.4Q12,29.6 11.5,29.9L11.4,29.9Q11,30.2 9,29.2L-6.5,21.4Q-8.5,20.4 -8.5,18.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-5.8,16.8L8.3,23.8M-5.8,11.3L4.8,16.6M-5.8,5.8L6.5,11.9M-5.8,0.3L3,4.7M-5.8,-5.2L8.3,1.8M-5.8,-10.7L4.8,-5.4"
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
      <clipPath id={`${id}-tr-tray2`}>
        <path d="M17.7,-144.1L33.6,-152L56.6,-140.5L56.6,7L40.7,14.9L17.7,3.4Z" />
      </clipPath>
      <g clipPath={`url(#${id}-tr-tray2)`}>
        <path
          d="M23.3,3Q23.3,0.8 23.8,0.5L23.9,0.5Q24.4,0.2 26.4,1.2L40.1,8.1Q42.1,9.1 42.1,11.3L42.1,29.4Q42.1,31.6 41.6,31.8L41.5,31.9Q41,32.1 39,31.1L25.3,24.2Q23.3,23.3 23.3,21.1Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M26,7.1L36.6,12.4M26,10.8L33.1,14.4"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <g className="fail">
        <mask id={`${id}-tr-m2`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
          <rect x="-400" y="-400" width="800" height="800" fill="black" />
          <path d="M-12.4,-164.4L-7.1,-167L15.9,-155.6L15.9,-8.1L10.6,-5.4L-12.4,-16.9Z" fill="white" />
        </mask>
        <g mask={`url(#${id}-tr-m2)`}>
          <g className="fx fx-tr-grow">
            <g className="acc">
              <path
                d="M-8.5,-14.9Q-8.5,-17.1 -8,-17.3L-7.9,-17.4Q-7.4,-17.6 -5.5,-16.6L10.1,-8.9Q12,-7.9 12,-5.7L12,27.4Q12,29.6 11.5,29.9L11.4,29.9Q11,30.2 9,29.2L-6.5,21.4Q-8.5,20.4 -8.5,18.2Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-5.8,16.8L8.3,23.8M-5.8,11.3L4.8,16.6M-5.8,5.8L6.5,11.9M-5.8,0.3L3,4.7M-5.8,-5.2L8.3,1.8M-5.8,-10.7L4.8,-5.4"
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
        <g className="fx fx-tr-wad">
          <g className="acc">
            <path
              d="M7.2,-18.5Q7.8,-17.5 7,-16.5L6.6,-16Q5.9,-15.1 5.2,-14.1L4.9,-13.7Q4.2,-12.7 3,-12.9L2.3,-13.1Q1.1,-13.3 -0.1,-13.3L-1.2,-13.2Q-2.4,-13.2 -2.7,-14.3L-2.9,-15Q-3.2,-16.2 -3.4,-17.3L-3.5,-17.7Q-3.7,-18.9 -2.7,-19.5L-2.2,-19.9Q-1.1,-20.5 -0.4,-21.4L0.1,-22Q0.9,-22.9 2,-22.5L2.8,-22.2Q4,-21.8 5,-21.1L5.4,-20.8Q6.4,-20.2 7,-19.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-1.5,-19.6L1.2,-17.2L3.9,-20.2M0.6,-14.2L2.1,-16.9L5.4,-16M-2.1,-15.7L0.3,-16.3"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-tr-lamp">
          <g className="acc">
            <path
              d="M-15.9,15.8Q-15.9,17.4 -14.5,18.1L-10.3,20.2Q-8.8,20.9 -8.8,19.3L-8.8,15Q-8.8,13.4 -10.3,12.7L-14.5,10.6Q-15.9,9.9 -15.9,11.5Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-tr-smoke0">
          <circle
            cx="3.2"
            cy="-23.2"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-tr-smoke1">
          <circle
            cx="0.9"
            cy="-24.4"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-tr-smoke2">
          <circle
            cx="-1.4"
            cy="-25.6"
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
        d="M13.1,29.6A6.3 3.1 0 0 1 25.7,29.6L25.7,43.3A6.3 3.1 0 0 1 13.1,43.3Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="19.4"
        cy="29.6"
        rx="6.3"
        ry="3.1"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="19.4"
        cy="29.6"
        rx="5"
        ry="2.5"
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
