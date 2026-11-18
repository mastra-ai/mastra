import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function WorkspacesScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="26.2" cy="31.3" r="68.6">
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
          d="M-41.6,21.1C-45.1,15.9 -27.9,14.2 -21.1,10.7C-14.2,7.3 -4.4,1.8 -0.4,0.3C3.6,-1.3 1.8,0.9 2.9,1.3C3.9,1.6 1.1,-0.1 6.1,2.2C11.2,4.6 24.1,10.9 33.1,15.4C42.1,19.9 53.1,25.6 60.1,29.2C67.2,32.8 70.3,34.3 75.3,36.9C80.4,39.5 91.4,41.5 90.5,44.5C89.6,47.6 76.8,51.5 70,55C63.1,58.5 53.2,63.9 49.2,65.5C45.2,67 47.1,64.8 46,64.5C44.9,64.1 50.3,67.2 42.7,63.5C35,59.8 14.2,49.3 0.1,42.3C-13.9,35.2 -38.1,26.4 -41.6,21.1Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-35.4,-14.1Q-35.4,-16.3 -33.4,-17.3L-2,-33Q0,-34 2,-33L3.3,-32.3Q5.3,-31.3 5.3,-29.1L5.3,4Q5.3,6.2 3.3,7.2L-28.1,22.9Q-30.1,23.9 -32,22.9L-33.4,22.2Q-35.4,21.2 -35.4,19Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M17.7,12.4Q17.7,10.2 19.6,9.3L51.1,-6.5Q53,-7.4 55,-6.5L75.8,3.9Q77.8,4.9 77.8,7.1L77.8,40.2Q77.8,42.4 75.8,43.4L44.4,59.1Q42.4,60.1 40.5,59.1L19.6,48.7Q17.7,47.7 17.7,45.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M19.4,11.1L40.7,21.7Q42.4,22.6 44.2,21.7L76,5.8"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M20.3,24.1L39.8,33.8M25.6,20.5L34.5,24.9M25.6,36.7L34.5,41.1"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-42.4,-19.1Q-42.4,-21.3 -40.5,-22.3L-2,-41.5Q0,-42.5 2,-41.5L82.9,-1.1Q84.9,-0.1 84.9,2.1L84.9,2.7Q84.9,4.9 82.9,5.9L44.4,25.2Q42.4,26.1 40.5,25.2L-40.5,-15.3Q-42.4,-16.3 -42.4,-18.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-40.7,-20.4L40.7,20.3Q42.4,21.1 44.2,20.3L83.1,0.8"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="acc">
        <path
          d="M-5.3,-28.5Q-5.3,-29.3 -3.3,-30.3L1.6,-32.8Q3.5,-33.8 5.5,-32.8L15.7,-27.7Q17.7,-26.7 17.7,-25.8L17.7,-25.7Q17.7,-24.8 15.7,-23.8L10.8,-21.4Q8.8,-20.4 6.9,-21.4L-3.3,-26.5Q-5.3,-27.5 -5.3,-28.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M3.5,-31.3Q3.5,-33.5 4.7,-34.1L5,-34.2Q6.2,-34.8 7.8,-34L8.1,-33.8Q9.7,-33 9.7,-30.8L9.7,-30.2Q9.7,-28 8.5,-27.4L8.3,-27.3Q7.1,-26.7 5.5,-27.5L5.1,-27.7Q3.5,-28.5 3.5,-30.7Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-7.1,-73.2Q-7.1,-75.4 -5.5,-76.2L-5.1,-76.4Q-3.5,-77.2 -1.6,-76.2L26.3,-62.3Q28.3,-61.3 28.3,-59.1L28.3,-29.7Q28.3,-27.5 26.7,-26.7L26.4,-26.6Q24.8,-25.8 22.8,-26.7L-5.1,-40.7Q-7.1,-41.7 -7.1,-43.9Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-5.3,-74.5L23,-60.4Q24.8,-59.5 26.5,-60.4L26.5,-60.4"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-4.4,-45.7Q-4.4,-44.1 -3,-43.4L20.7,-31.6Q22.1,-30.8 22.1,-32.4L22.1,-55.5Q22.1,-57.1 20.7,-57.8L-3,-69.6Q-4.4,-70.4 -4.4,-68.8Z"
          fill="var(--hole)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-1.8,-50.3L0.9,-46.5M0.9,-46.5L-1.8,-45.3"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="cursor">
          <path
            d="M2.7,-43.1L7.1,-40.9"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="okonly">
          <clipPath id={`${id}-ws-screen`}>
            <path d="M-3.5,-68L21.2,-55.7L21.2,-41.3L-3.5,-53.7Z" />
          </clipPath>
          <g clipPath={`url(#${id}-ws-screen)`}>
            <g
              className="stream"
              style={s({ '--travel': '0px -20px', '--dur': '3.2s', '--delay': '0s', '--ease': 'steps(4,end)' })}
            >
              <path
                d="M-1.8,-32.8L12.4,-25.7M-1.8,-37.8L7.1,-33.4M-1.8,-42.8L17.7,-33.1M-1.8,-47.8L9.7,-42M-1.8,-52.8L12.4,-45.7M-1.8,-57.8L7.1,-53.4M-1.8,-62.8L17.7,-53.1M-1.8,-67.8L9.7,-62"
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
          d="M8.8,-2.3Q8.8,-3.5 10.8,-4.4L26.3,-12.2Q28.3,-13.2 30.3,-12.2L54.6,0Q56.6,1 56.6,2.1L56.6,2.3Q56.6,3.5 54.6,4.5L39.1,12.2Q37.1,13.2 35.2,12.2L10.8,0Q8.8,-1 8.8,-2.1Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M10.6,-2.6L35.4,9.8Q37.1,10.7 38.9,9.8L54.8,1.9"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M23.9,-12Q23.9,-12.8 25.8,-13.8L26.3,-14.1Q28.3,-15.1 30.3,-14.1L36,-11.2Q38,-10.2 38,-9.3L38,-9.2Q38,-8.3 36,-7.3L35.6,-7.1Q33.6,-6.1 31.6,-7.1L25.8,-10Q23.9,-11 23.9,-11.8Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M8.8,-1.3Q8.8,-2.4 10.8,-3.4L24.6,-10.3Q26.5,-11.3 28.5,-10.3L52.8,1.9Q54.8,2.9 54.8,4L54.8,4.3Q54.8,5.4 52.8,6.4L39.1,13.2Q37.1,14.2 35.2,13.2L10.8,1.1Q8.8,0.1 8.8,-1.1Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M10.6,-1.5L35.4,10.8Q37.1,11.7 38.9,10.8L53,3.8"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M24.8,-6.8L42.4,2M20.3,-4.6L32.7,1.6"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <g className="fail">
        <clipPath id={`${id}-ws-screen2`}>
          <path d="M-3.5,-68L21.2,-55.7L21.2,-41.3L-3.5,-53.7Z" />
        </clipPath>
        <g clipPath={`url(#${id}-ws-screen2)`}>
          <g className="fx fx-ws-lines">
            <g className="acc">
              <path
                d="M-1.8,-32.8L12.4,-25.7M-1.8,-37.8L7.1,-33.4M-1.8,-42.8L17.7,-33.1M-1.8,-47.8L9.7,-42M-1.8,-52.8L12.4,-45.7M-1.8,-57.8L7.1,-53.4M-1.8,-62.8L17.7,-53.1M-1.8,-67.8L9.7,-62M-1.8,-72.8L12.4,-65.7M-1.8,-77.8L7.1,-73.4"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-ws-err">
            <g className="acc">
              <path
                d="M-1.8,-54.7Q-1.8,-53.5 -0.3,-52.8L14.5,-45.4Q15.9,-44.7 15.9,-45.8L15.9,-46Q15.9,-47.2 14.5,-47.9L-0.3,-55.3Q-1.8,-56 -1.8,-54.9Z"
                fill="var(--line)"
                stroke="none"
              />
            </g>
          </g>
          <g className="fx fx-ws-x">
            <g className="acc">
              <path
                d="M4.4,-54.1L12.4,-58.8"
                pathLength="1"
                strokeDasharray="1"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M4.4,-62.8L12.4,-50.1"
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
        <g className="fx fx-ws-smoke0">
          <circle
            cx="28.6"
            cy="23.2"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ws-smoke1">
          <circle
            cx="30.9"
            cy="22"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ws-smoke2">
          <circle
            cx="33.2"
            cy="20.7"
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
