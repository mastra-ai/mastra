import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function DeploysScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="-27.9" cy="31.2" r="76.9">
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
          d="M-99.9,50.5C-97.6,46.2 -79.4,39 -69,33.2C-58.7,27.3 -46.3,20 -37.9,15.4C-29.5,10.9 -25,9.1 -18.6,6C-12.2,2.8 -3.4,-1.9 0.3,-3.3C4.1,-4.7 2.5,-2.6 3.6,-2.3C4.7,-2 2.9,-3.2 6.9,-1.3C10.9,0.6 20.7,5.7 27.6,9.2C34.4,12.7 47.8,16.3 48.1,19.6C48.4,22.9 35.6,25.9 29.4,29C23.1,32.2 19.6,34.3 10.6,38.5C1.7,42.8 -12.8,49.3 -24.4,54.5C-36.1,59.7 -53,67.4 -59.3,69.8C-65.7,72.2 -61.5,69.1 -62.6,68.8C-63.7,68.4 -62.5,69.4 -65.9,67.8C-69.3,66.1 -77.3,62 -82.9,59.1C-88.6,56.3 -102.3,54.9 -99.9,50.5Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-31.8,-39.4Q-31.8,-41.6 -29.9,-42.6L-2,-56.5Q0,-57.5 2,-56.5L33.4,-40.8Q35.4,-39.8 35.4,-37.6L35.4,15.5Q35.4,17.7 33.4,18.7L5.5,32.6Q3.5,33.6 1.6,32.6L-29.9,16.9Q-31.8,15.9 -31.8,13.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M33.6,-38.9L5.3,-24.8Q3.5,-23.9 1.8,-24.8L-30.1,-40.7"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M1.8,-51.3L23,-40.7M-3.5,-48.7L8.8,-42.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-23,18.7Q-23,20.3 -21.6,21L-6.7,28.5Q-5.3,29.2 -5.3,27.6L-5.3,0.8Q-5.3,-0.8 -6.7,-1.5L-21.6,-9Q-23,-9.7 -23,-8.1Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-67.2,41.4Q-67.2,39.2 -65.2,38.2L-23.2,17.2Q-21.2,16.2 -19.2,17.2L-9,22.3Q-7.1,23.3 -7.1,25.5L-7.1,26.1Q-7.1,28.3 -9,29.3L-51.1,50.3Q-53,51.3 -55,50.3L-65.2,45.2Q-67.2,44.2 -67.2,42Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-8.8,24.2L-51.3,45.4Q-53,46.3 -54.8,45.4L-65.4,40.1"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <clipPath id={`${id}-dp-belt`}>
        <path d="M-65.4,39.2L-21.2,17.1L-8.8,23.3L-53,45.4Z" />
      </clipPath>
      <g clipPath={`url(#${id}-dp-belt)`}>
        <g className="belt" style={s({ '--step': '-6.2px 3.1px' })}>
          <path
            d="M-16.8,14L-2.7,21.1M-23,17.1L-8.8,24.2M-29.2,20.2L-15,27.3M-35.4,23.3L-21.2,30.4M-41.5,26.4L-27.4,33.5M-47.7,29.5L-33.6,36.5M-53.9,32.6L-39.8,39.6M-60.1,35.7L-46,42.7M-66.3,38.8L-52.2,45.8M-72.5,41.9L-58.3,48.9"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g className="okonly">
        <clipPath id={`${id}-dp-door`}>
          <path d="M-132.6,45.1L-23,-9.7L-5.3,-0.8L-5.3,29.2L-114.9,84L-132.6,75.1Z" />
        </clipPath>
        <g clipPath={`url(#${id}-dp-door)`}>
          <g
            className="stream"
            style={s({ '--travel': '-72.5px 36.2px', '--dur': '4.1s', '--delay': '0s', '--ease': 'linear' })}
          >
            <g className="acc">
              <path
                d="M-4.4,-5.3Q-4.4,-7.5 -2.5,-8.5L6,-12.8Q8,-13.7 9.9,-12.8L18.4,-8.5Q20.3,-7.5 20.3,-5.3L20.3,6.5Q20.3,8.7 18.4,9.7L9.9,13.9Q8,14.9 6,13.9L-2.5,9.7Q-4.4,8.7 -4.4,6.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M18.6,-6.7L9.7,-2.2Q8,-1.4 6.2,-2.2L-2.7,-6.7"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M1.8,-10.6L14.1,-4.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-4.4,0.6L8,6.8"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g
            className="stream"
            style={s({ '--travel': '-72.5px 36.2px', '--dur': '4.1s', '--delay': '-2s', '--ease': 'linear' })}
          >
            <g className="acc">
              <path
                d="M-4.4,-5.3Q-4.4,-7.5 -2.5,-8.5L6,-12.8Q8,-13.7 9.9,-12.8L18.4,-8.5Q20.3,-7.5 20.3,-5.3L20.3,6.5Q20.3,8.7 18.4,9.7L9.9,13.9Q8,14.9 6,13.9L-2.5,9.7Q-4.4,8.7 -4.4,6.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M18.6,-6.7L9.7,-2.2Q8,-1.4 6.2,-2.2L-2.7,-6.7"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M1.8,-10.6L14.1,-4.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-4.4,0.6L8,6.8"
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
        d="M-93.7,15.1Q-93.7,12.9 -91.7,11.9L-72.7,2.4Q-70.7,1.4 -68.8,2.4L-44.4,14.6Q-42.4,15.5 -42.4,17.7L-42.4,50.8Q-42.4,53 -44.4,54L-63.4,63.5Q-65.4,64.5 -67.4,63.5L-91.7,51.4Q-93.7,50.4 -93.7,48.2Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-44.2,16.4L-63.6,26.1Q-65.4,27 -67.2,26.1L-91.9,13.8"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-70.7,6.7L-53,15.5M-76,9.4L-63.6,15.5"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-88.4,25.5L-79.6,30M-88.4,30.5L-83.1,33.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-76,32.6Q-76,34.2 -74.6,34.9L-72.2,36.2Q-70.7,36.9 -70.7,35.3L-70.7,33.5Q-70.7,31.9 -72.2,31.2L-74.6,29.9Q-76,29.2 -76,30.8Z"
        fill="var(--line)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="fail">
        <clipPath id={`${id}-dp-fall`}>
          <path d="M-132.6,45.1L-23,-9.7L-5.3,-0.8L-5.3,29.2L-114.9,84L-132.6,75.1Z" />
          <path d="M-65.4,13.2L-12.4,-13.3L7.1,-3.6L7.1,41.4L-46,67.9L-65.4,58.2Z" />
        </clipPath>
        <g clipPath={`url(#${id}-dp-fall)`}>
          <g className="fx fx-dp-box">
            <g className="acc">
              <path
                d="M-4.4,-5.3Q-4.4,-7.5 -2.5,-8.5L6,-12.8Q8,-13.7 9.9,-12.8L18.4,-8.5Q20.3,-7.5 20.3,-5.3L20.3,6.5Q20.3,8.7 18.4,9.7L9.9,13.9Q8,14.9 6,13.9L-2.5,9.7Q-4.4,8.7 -4.4,6.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M18.6,-6.7L9.7,-2.2Q8,-1.4 6.2,-2.2L-2.7,-6.7"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M1.8,-10.6L14.1,-4.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-4.4,0.6L8,6.8"
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
        <g className="fx fx-dp-snag">
          <g className="acc">
            <path
              d="M-4.5,15.9L-1.1,16.5M-5.8,17.7L-2,21.7M-8,18.3L-8.1,21.3M-10.3,17.6L-14.2,21.4M-11.4,15.8L-14.9,16.2M-10.9,13.8L-16.1,11.1M-9.1,12.5L-10.2,9.7M-6.7,12.6L-4.5,7.8M-4.9,13.9L-1.8,12.5"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-dp-lamp">
          <g className="acc">
            <path
              d="M-4.4,-5.7Q-4.4,-4.1 -3,-3.4L-2.3,-3.1Q-0.9,-2.4 -0.9,-4L-0.9,-4.5Q-0.9,-6.1 -2.3,-6.8L-3,-7.2Q-4.4,-7.9 -4.4,-6.3Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-dp-dust0">
          <circle
            cx="-19.8"
            cy="42.6"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-dp-dust1">
          <circle
            cx="-22.1"
            cy="41.4"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-dp-dust2">
          <circle
            cx="-24.4"
            cy="40.1"
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
