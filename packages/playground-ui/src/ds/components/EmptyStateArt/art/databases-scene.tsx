import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function DatabasesScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="-9" cy="26.7" r="38.8">
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
          d="M-40.7,35.5C-40.6,34.9 -40,34.3 -39.6,33.8C-39.3,33.2 -40.3,34.1 -38.5,32C-36.8,30 -32.3,24.9 -29.1,21.3C-26,17.8 -21.5,12.6 -19.5,10.6C-17.6,8.5 -18.2,9.6 -17.5,9.2C-16.8,8.7 -16.3,8.2 -15.5,7.8C-14.7,7.4 -13.6,7.1 -12.7,6.8C-11.7,6.4 -10.9,6 -9.9,5.7C-8.9,5.5 -7.7,5.4 -6.6,5.2C-5.5,5 -4.4,4.8 -3.3,4.7C-2.2,4.6 -1,4.7 0.1,4.7C1.3,4.7 2.5,4.6 3.6,4.7C4.7,4.8 5.8,5.1 6.9,5.3C7.9,5.5 9,5.6 10.1,5.8C11.2,6.1 12.3,6.5 13.4,6.9C14.5,7.2 15.7,7.6 16.7,7.9C17.7,8.3 18.5,8.6 19.5,9C20.4,9.3 21.4,9.6 22.2,10C23,10.4 23.5,10.9 24.2,11.4C24.9,11.8 25.7,12.3 26.2,12.8C26.7,13.3 26.9,13.9 27.3,14.4C27.6,14.9 28.1,15.5 28.3,16C28.5,16.6 28.3,17.2 28.3,17.7C28.3,18.3 28.5,18.9 28.3,19.5C28.2,20 27.6,20.5 27.3,21.1C26.9,21.6 27.8,20.6 26.3,22.7C24.7,24.8 20.8,30 18,33.7C15.2,37.4 11.3,42.7 9.5,44.7C7.7,46.8 8.1,45.7 7.3,46.2C6.6,46.7 6,47.3 5.2,47.7C4.3,48.1 3.2,48.4 2.2,48.8C1.3,49.1 0.4,49.6 -0.7,49.8C-1.8,50.1 -3,50.2 -4.2,50.4C-5.4,50.6 -6.5,50.9 -7.7,51C-8.9,51.1 -10.1,51 -11.3,50.9C-12.5,50.9 -13.8,51 -15,50.9C-16.1,50.8 -17.3,50.5 -18.4,50.3C-19.6,50.1 -20.7,50 -21.9,49.7C-23,49.5 -24.1,49.1 -25.2,48.7C-26.3,48.4 -27.4,48 -28.5,47.7C-29.5,47.3 -30.4,46.9 -31.4,46.6C-32.3,46.2 -33.4,45.9 -34.3,45.5C-35.1,45.1 -35.7,44.5 -36.4,44C-37.1,43.5 -38,43.1 -38.5,42.5C-39,42 -39.2,41.4 -39.6,40.8C-40,40.2 -40.5,39.7 -40.7,39.1C-40.9,38.5 -40.7,37.9 -40.7,37.3C-40.7,36.7 -40.9,36.1 -40.7,35.5Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-17.5,3.4A17.5 8.8 0 0 1 17.5,3.4L17.5,15.9A17.5 8.8 0 0 1 -17.5,15.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="0"
        cy="3.4"
        rx="17.5"
        ry="8.8"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-17.5,12.2A17.5 8.8 0 0 0 17.5,12.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-17.5,-9.1A17.5 8.8 0 0 1 17.5,-9.1L17.5,3.4A17.5 8.8 0 0 1 -17.5,3.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="0"
        cy="-9.1"
        rx="17.5"
        ry="8.8"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-17.5,-0.3A17.5 8.8 0 0 0 17.5,-0.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-17.5,-21.6A17.5 8.8 0 0 1 17.5,-21.6L17.5,-9.1A17.5 8.8 0 0 1 -17.5,-9.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="0"
        cy="-21.6"
        rx="17.5"
        ry="8.8"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="-17.7"
        cy="37.1"
        rx="18.8"
        ry="9.4"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-db-hole`}>
          <path d="M-36.4,-112.9L-35.8,-115.3L-33.9,-117.6L-30.9,-119.5L-27.1,-121L-22.5,-121.9L-17.7,-122.2L-12.8,-121.9L-8.3,-121L-4.4,-119.5L-1.4,-117.6L0.4,-115.3L1.1,-112.9L1.1,37.1L0.4,39.6L-1.4,41.8L-4.4,43.8L-8.3,45.2L-12.8,46.2L-17.7,46.5L-22.5,46.2L-27.1,45.2L-30.9,43.8L-33.9,41.8L-35.8,39.6L-36.4,37.1Z" />
        </clipPath>
        <g clipPath={`url(#${id}-db-hole)`}>
          <g className="acc created drawer" style={s({ '--shift': '0px -27.5px' })}>
            <path
              d="M-35.2,52.1A17.5 8.8 0 0 1 -0.2,52.1L-0.2,64.6A17.5 8.8 0 0 1 -35.2,64.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="-17.7"
              cy="52.1"
              rx="17.5"
              ry="8.8"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-35.2,60.9A17.5 8.8 0 0 0 -0.2,60.9"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-35.2,39.6A17.5 8.8 0 0 1 -0.2,39.6L-0.2,52.1A17.5 8.8 0 0 1 -35.2,52.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="-17.7"
              cy="39.6"
              rx="17.5"
              ry="8.8"
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
        <g className="acc">
          <ellipse
            cx="-17.7"
            cy="37.1"
            rx="18.8"
            ry="9.4"
            fill="var(--hole)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <clipPath id={`${id}-db-hole2`}>
          <path d="M-36.4,-112.9L-35.8,-115.3L-33.9,-117.6L-30.9,-119.5L-27.1,-121L-22.5,-121.9L-17.7,-122.2L-12.8,-121.9L-8.3,-121L-4.4,-119.5L-1.4,-117.6L0.4,-115.3L1.1,-112.9L1.1,37.1L0.4,39.6L-1.4,41.8L-4.4,43.8L-8.3,45.2L-12.8,46.2L-17.7,46.5L-22.5,46.2L-27.1,45.2L-30.9,43.8L-33.9,41.8L-35.8,39.6L-36.4,37.1Z" />
        </clipPath>
        <g clipPath={`url(#${id}-db-hole2)`}>
          <g className="fx fx-db-up">
            <g className="acc">
              <path
                d="M-35.2,52.1A17.5 8.8 0 0 1 -0.2,52.1L-0.2,64.6A17.5 8.8 0 0 1 -35.2,64.6Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-17.7"
                cy="52.1"
                rx="17.5"
                ry="8.8"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-35.2,60.9A17.5 8.8 0 0 0 -0.2,60.9"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-35.2,39.6A17.5 8.8 0 0 1 -0.2,39.6L-0.2,52.1A17.5 8.8 0 0 1 -35.2,52.1Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="-17.7"
                cy="39.6"
                rx="17.5"
                ry="8.8"
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
        <g className="fx fx-db-dust0">
          <circle
            cx="-19.8"
            cy="45.3"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-db-dust1">
          <circle
            cx="-22.1"
            cy="44"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-db-dust2">
          <circle
            cx="-24.4"
            cy="42.8"
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
