import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function EnvironmentsScene({ id }: SceneProps) {
  return (
    <>
      <path
        d="M-51.3,22Q-51.3,20.3 -49.3,19.3L-2,-4.3Q0,-5.3 2,-4.3L47.5,18.5Q49.5,19.4 49.5,21.2L49.5,21.5Q49.5,23.2 47.5,24.2L0.2,47.9Q-1.8,48.8 -3.7,47.9L-49.3,25.1Q-51.3,24.1 -51.3,22.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-35.4,-62.6Q-35.4,-64.8 -33.4,-65.8L-2,-81.5Q0,-82.5 2,-81.5L38.7,-63.2Q40.7,-62.2 40.7,-60L40.7,18.1Q40.7,20.3 38.7,21.3L7.3,37Q5.3,38 3.3,37L-33.4,18.7Q-35.4,17.7 -35.4,15.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M38.9,-61.3L7.1,-45.4Q5.3,-44.5 3.5,-45.4L-33.6,-63.9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-21.2,-66.6L8.8,-51.6M-15.9,-69.2L-1.8,-62.2"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M35.4,-44.5L14.1,-33.9M35.4,-39.5L23,-33.3"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-31.8,-39.7Q-31.8,-38.1 -30.4,-37.3L0.3,-22Q1.8,-21.3 1.8,-22.9L1.8,-34.7Q1.8,-36.3 0.3,-37L-30.4,-52.3Q-31.8,-53.1 -31.8,-51.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-31.8,-17.2Q-31.8,-15.6 -30.4,-14.8L0.3,0.5Q1.8,1.2 1.8,-0.4L1.8,-12.2Q1.8,-13.8 0.3,-14.5L-30.4,-29.8Q-31.8,-30.6 -31.8,-29Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-31.8,5.3Q-31.8,6.9 -30.4,7.7L0.3,23Q1.8,23.7 1.8,22.1L1.8,10.3Q1.8,8.7 0.3,8L-30.4,-7.3Q-31.8,-8.1 -31.8,-6.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-28.3,-21.3L-17.7,-16M-28.3,1.2L-21.2,4.8"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-env-bay`}>
          <path d="M-76,-30.3L-31.8,-52.4L1.8,-35.6L1.8,-21.9L-42.4,0.2L-76,-16.6Z" />
        </clipPath>
        <g clipPath={`url(#${id}-env-bay)`}>
          <g className="acc created drawer" style={s({ '--shift': '-14.1px 7.1px' })}>
            <path
              d="M-30.9,-48.3Q-30.9,-50.5 -29,-51.5L-9.9,-61Q-8,-62 -6,-61L20.1,-47.9Q22.1,-46.9 22.1,-44.7L22.1,-36.6Q22.1,-34.4 20.1,-33.5L1.1,-23.9Q-0.9,-22.9 -2.9,-23.9L-29,-37Q-30.9,-38 -30.9,-40.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M20.3,-46.1L0.9,-36.3Q-0.9,-35.4 -2.7,-36.3L-29.2,-49.6"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-25.6,-41.6L-9.7,-33.6"
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
      <g className="fail">
        <clipPath id={`${id}-env-bay2`}>
          <path d="M-76,-30.3L-31.8,-52.4L1.8,-35.6L1.8,-21.9L-42.4,0.2L-76,-16.6Z" />
          <path d="M-76,-31L-32.7,-52.6L0.9,-35.8L0.9,-8.3L-42.4,13.3L-76,-3.5Z" />
        </clipPath>
        <g clipPath={`url(#${id}-env-bay2)`}>
          <g className="fx fx-env-dr">
            <g className="acc">
              <path
                d="M-30.9,-48.3Q-30.9,-50.5 -29,-51.5L-9.9,-61Q-8,-62 -6,-61L20.1,-47.9Q22.1,-46.9 22.1,-44.7L22.1,-36.6Q22.1,-34.4 20.1,-33.5L1.1,-23.9Q-0.9,-22.9 -2.9,-23.9L-29,-37Q-30.9,-38 -30.9,-40.2Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M20.3,-46.1L0.9,-36.3Q-0.9,-35.4 -2.7,-36.3L-29.2,-49.6"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-25.6,-41.6L-9.7,-33.6"
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
        <g className="fx fx-env-hit">
          <g className="acc">
            <path
              d="M-11.6,-36.6L-8.2,-36M-12.8,-34.8L-9.1,-30.8M-15.1,-34.2L-15.2,-31.2M-17.3,-34.9L-21.3,-31.1M-18.5,-36.7L-22,-36.3M-18,-38.7L-23.1,-41.4M-16.1,-40L-17.3,-42.8M-13.7,-39.9L-11.6,-44.7M-12,-38.6L-8.9,-40"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-env-lamp">
          <g className="acc">
            <path
              d="M-6.2,-45.4Q-6.2,-44 -4.8,-43.3L-3.2,-42.5Q-1.8,-41.8 -1.8,-43.2L-1.8,-43.5Q-1.8,-44.9 -3.2,-45.6L-4.8,-46.4Q-6.2,-47.1 -6.2,-45.7Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-env-smoke0">
          <circle
            cx="-13.6"
            cy="-45.4"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-env-smoke1">
          <circle
            cx="-15.9"
            cy="-46.6"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-env-smoke2">
          <circle
            cx="-18.2"
            cy="-47.8"
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
