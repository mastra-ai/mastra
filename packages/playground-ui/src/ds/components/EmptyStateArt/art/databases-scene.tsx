import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function DatabasesScene({ id }: SceneProps) {
  return (
    <>
      <path
        d="M-70.7,33.5Q-70.7,31.8 -68.8,30.8L-2,-2.6Q0,-3.5 2,-2.6L47.5,20.2Q49.5,21.2 49.5,22.9L49.5,23.3Q49.5,25 47.5,25.9L-19.2,59.3Q-21.2,60.3 -23.2,59.3L-68.8,36.6Q-70.7,35.6 -70.7,33.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
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
