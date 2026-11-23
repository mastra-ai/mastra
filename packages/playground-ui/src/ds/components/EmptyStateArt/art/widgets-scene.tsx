import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function WidgetsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="19.4" cy="15.9" r="18.2">
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
          d="M7.9,15.9C7.9,14.9 11.5,13.9 13.4,12.9C15.3,11.9 17.6,10.2 19.2,9.9C20.7,9.5 21.5,10.5 22.7,10.8C23.9,11.2 24.7,11.2 26.3,11.9C27.9,12.6 30.1,14.1 32,15.1C33.9,16.1 37.5,17 37.5,18C37.5,18.9 33.9,19.9 32,20.9C30.1,21.9 27.8,23.6 26.2,23.9C24.7,24.3 23.9,23.3 22.7,23C21.5,22.7 20.6,22.6 19.1,21.9C17.5,21.2 15.2,19.8 13.4,18.8C11.5,17.8 7.9,16.8 7.9,15.9Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M14.1,8.1Q14.1,5.9 16.1,4.9L17.5,4.2Q19.4,3.3 21.4,4.2L22.8,4.9Q24.8,5.9 24.8,8.1L24.8,13.7Q24.8,15.9 22.8,16.9L21.4,17.6Q19.4,18.6 17.5,17.6L16.1,16.9Q14.1,15.9 14.1,13.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-7.1,-56.8Q-7.1,-59 -5.1,-59.9L-2,-61.5Q0,-62.5 2,-61.5L49.3,-37.8Q51.3,-36.9 51.3,-34.7L51.3,13.4Q51.3,15.6 49.3,16.6L46.2,18.2Q44.2,19.2 42.2,18.2L-5.1,-5.5Q-7.1,-6.5 -7.1,-8.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M49.5,-36L46,-34.2Q44.2,-33.3 42.4,-34.2L-5.3,-58.1"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.5,-31.3Q-3.5,-29.7 -2.1,-29L16.2,-19.8Q17.7,-19.1 17.7,-20.7L17.7,-40Q17.7,-41.6 16.2,-42.3L-2.1,-51.5Q-3.5,-52.2 -3.5,-50.6Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M21.2,-18.9Q21.2,-17.3 22.6,-16.6L39.2,-8.3Q40.7,-7.6 40.7,-9.2L40.7,-28.5Q40.7,-30.1 39.2,-30.8L22.6,-39.1Q21.2,-39.8 21.2,-38.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.5,-11.3Q-3.5,-9.7 -2.1,-9L16.2,0.2Q17.7,0.9 17.7,-0.7L17.7,-15Q17.7,-16.6 16.2,-17.3L-2.1,-26.5Q-3.5,-27.2 -3.5,-25.6Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M21.2,1.1Q21.2,2.7 22.6,3.4L39.2,11.7Q40.7,12.4 40.7,10.8L40.7,-3.5Q40.7,-5.1 39.2,-5.8L22.6,-14.1Q21.2,-14.8 21.2,-13.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-0.9,-43.4L12.4,-36.7M-0.9,-38.4L7.1,-34.4M23.9,-21L29.2,-25.8M29.2,-25.8L32.7,-19.1M32.7,-19.1L38,-25.2M-0.9,-20.9L15,-12.9M-0.9,-15.9L9.7,-10.6M-0.9,-12.1L12.4,-5.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-wd-scr`}>
          <path d="M21.2,-14.8L40.7,-5.1L40.7,12.4L21.2,2.7Z" />
        </clipPath>
        <g clipPath={`url(#${id}-wd-scr)`}>
          <g className="acc bob" style={s({ '--delay': '0s', '--dur': '1.8s', '--shift': '0px 7.5px' })}>
            <path
              d="M23,-8.4Q23,-10.6 23.4,-10.8L23.5,-10.8Q23.9,-11 25.1,-10.4L25.3,-10.3Q26.5,-9.7 26.5,-7.5L26.5,13.1Q26.5,15.3 26.1,15.5L26,15.6Q25.6,15.8 24.4,15.2L24.2,15.1Q23,14.4 23,12.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g className="acc bob" style={s({ '--delay': '-0.5s', '--dur': '2.2s', '--shift': '0px 3.8px' })}>
            <path
              d="M27.4,-6.1Q27.4,-8.3 27.8,-8.5L27.9,-8.6Q28.3,-8.8 29.5,-8.2L29.7,-8.1Q30.9,-7.5 30.9,-5.3L30.9,15.3Q30.9,17.5 30.5,17.7L30.5,17.8Q30.1,18 28.9,17.4L28.6,17.3Q27.4,16.7 27.4,14.5Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g className="acc bob" style={s({ '--delay': '-1.1s', '--dur': '1.6s', '--shift': '0px 8.8px' })}>
            <path
              d="M31.8,-3.9Q31.8,-6.1 32.2,-6.3L32.3,-6.4Q32.7,-6.6 33.9,-6L34.2,-5.9Q35.4,-5.2 35.4,-3L35.4,17.6Q35.4,19.8 35,20L34.9,20Q34.5,20.2 33.3,19.6L33,19.5Q31.8,18.9 31.8,16.7Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g className="acc bob" style={s({ '--delay': '-0.3s', '--dur': '2.4s', '--shift': '0px 5px' })}>
            <path
              d="M36.2,-1.7Q36.2,-3.9 36.6,-4.1L36.7,-4.2Q37.1,-4.4 38.3,-3.8L38.6,-3.6Q39.8,-3 39.8,-0.8L39.8,19.8Q39.8,22 39.4,22.2L39.3,22.2Q38.9,22.4 37.7,21.8L37.4,21.7Q36.2,21.1 36.2,18.9Z"
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
      <g className="fail">
        <clipPath id={`${id}-wd-scr2`}>
          <path d="M21.2,-14.8L40.7,-5.1L40.7,12.4L21.2,2.7Z" />
        </clipPath>
        <g clipPath={`url(#${id}-wd-scr2)`}>
          <g className="fx fx-wd-b0">
            <g className="acc">
              <path
                d="M23,-8.4Q23,-10.6 23.4,-10.8L23.5,-10.8Q23.9,-11 25.1,-10.4L25.3,-10.3Q26.5,-9.7 26.5,-7.5L26.5,13.1Q26.5,15.3 26.1,15.5L26,15.6Q25.6,15.8 24.4,15.2L24.2,15.1Q23,14.4 23,12.2Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-wd-b1">
            <g className="acc">
              <path
                d="M27.4,-6.1Q27.4,-8.3 27.8,-8.5L27.9,-8.6Q28.3,-8.8 29.5,-8.2L29.7,-8.1Q30.9,-7.5 30.9,-5.3L30.9,15.3Q30.9,17.5 30.5,17.7L30.5,17.8Q30.1,18 28.9,17.4L28.6,17.3Q27.4,16.7 27.4,14.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-wd-b2">
            <g className="acc">
              <path
                d="M31.8,-3.9Q31.8,-6.1 32.2,-6.3L32.3,-6.4Q32.7,-6.6 33.9,-6L34.2,-5.9Q35.4,-5.2 35.4,-3L35.4,17.6Q35.4,19.8 35,20L34.9,20Q34.5,20.2 33.3,19.6L33,19.5Q31.8,18.9 31.8,16.7Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-wd-b3">
            <g className="acc">
              <path
                d="M36.2,-1.7Q36.2,-3.9 36.6,-4.1L36.7,-4.2Q37.1,-4.4 38.3,-3.8L38.6,-3.6Q39.8,-3 39.8,-0.8L39.8,19.8Q39.8,22 39.4,22.2L39.3,22.2Q38.9,22.4 37.7,21.8L37.4,21.7Q36.2,21.1 36.2,18.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-wd-flat">
            <g className="acc">
              <path
                d="M22.1,0L39.8,8.8"
                pathLength="1"
                strokeDasharray="1"
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
        <g className="fx fx-wd-lamp">
          <g className="acc">
            <path
              d="M15.9,11.9Q15.9,13 16.7,13.4L16.9,13.5Q17.7,13.9 17.7,12.8L17.7,12.6Q17.7,11.4 16.9,11L16.7,10.9Q15.9,10.5 15.9,11.7Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
      </g>
    </>
  );
}
