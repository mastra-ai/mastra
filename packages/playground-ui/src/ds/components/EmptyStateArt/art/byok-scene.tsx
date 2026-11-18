import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function ByokScene({ id }: SceneProps) {
  return (
    <>
      <path
        d="M-49.5,21.2Q-49.5,19.4 -47.5,18.5L-2,-4.3Q0,-5.3 2,-4.3L44,16.7Q46,17.7 46,19.4L46,19.7Q46,21.4 44,22.4L-1.6,45.2Q-3.5,46.2 -5.5,45.2L-47.5,24.2Q-49.5,23.2 -49.5,21.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-26.5,-22Q-26.5,-24.2 -24.6,-25.2L-2,-36.5Q0,-37.5 2,-36.5L33.4,-20.8Q35.4,-19.8 35.4,-17.6L35.4,15.5Q35.4,17.7 33.4,18.7L10.8,30Q8.8,30.9 6.9,30L-24.6,14.2Q-26.5,13.3 -26.5,11.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M33.6,-18.9L10.6,-7.4Q8.8,-6.6 7.1,-7.4L-24.8,-23.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.9,-28.8Q-5.3,-29.5 -6.7,-28.8L-7.4,-28.5Q-8.8,-27.8 -7.4,-27.1L14.5,-16.1Q15.9,-15.4 17.3,-16.1L18,-16.5Q19.4,-17.2 18,-17.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-19.4,5.2Q-19.4,6.8 -18,7.5L0.3,16.7Q1.8,17.4 1.8,15.8L1.8,6.5Q1.8,4.9 0.3,4.2L-18,-5Q-19.4,-5.7 -19.4,-4.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-15.9,2.3L-1.8,9.4"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3.5,-4.3Q-3.5,-2.7 -2.1,-2L-1.4,-1.7Q0,-1 0,-2.6L0,-3.1Q0,-4.7 -1.4,-5.4L-2.1,-5.8Q-3.5,-6.5 -3.5,-4.9Z"
        fill="var(--line)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-bk-slot`}>
          <path d="M-8,-139.8L-4.4,-141.6L18.6,-130.1L18.6,-17.6L15,-15.8L-8,-27.3Z" />
        </clipPath>
        <g clipPath={`url(#${id}-bk-slot)`}>
          <g className="acc created drawer" style={s({ '--shift': '0px 17.5px' })}>
            <path
              d="M-5.8,-50.3Q-5.8,-52.5 -5.4,-52.8L-5.3,-52.8Q-4.8,-53 -2.8,-52.1L14.5,-43.4Q16.4,-42.4 16.4,-40.2L16.4,-7.1Q16.4,-4.9 16,-4.7L15.9,-4.6Q15.4,-4.4 13.4,-5.4L-3.9,-14Q-5.8,-15 -5.8,-17.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-3.2,-37.8Q-3.2,-36.2 -1.8,-35.5L0.7,-34.2Q2.1,-33.5 2.1,-35.1L2.1,-39.4Q2.1,-41 0.7,-41.7L-1.8,-43Q-3.2,-43.7 -3.2,-42.1Z"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M4.8,-37.2L12.7,-33.2M4.8,-33.5L10.1,-30.8"
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
        <clipPath id={`${id}-bk-slot2`}>
          <path d="M-8,-139.8L-4.4,-141.6L18.6,-130.1L18.6,-17.6L15,-15.8L-8,-27.3Z" />
        </clipPath>
        <g clipPath={`url(#${id}-bk-slot2)`}>
          <g className="fx fx-bk-card">
            <g className="acc">
              <path
                d="M-5.8,-50.3Q-5.8,-52.5 -5.4,-52.8L-5.3,-52.8Q-4.8,-53 -2.8,-52.1L14.5,-43.4Q16.4,-42.4 16.4,-40.2L16.4,-7.1Q16.4,-4.9 16,-4.7L15.9,-4.6Q15.4,-4.4 13.4,-5.4L-3.9,-14Q-5.8,-15 -5.8,-17.2Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-3.2,-37.8Q-3.2,-36.2 -1.8,-35.5L0.7,-34.2Q2.1,-33.5 2.1,-35.1L2.1,-39.4Q2.1,-41 0.7,-41.7L-1.8,-43Q-3.2,-43.7 -3.2,-42.1Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M4.8,-37.2L12.7,-33.2M4.8,-33.5L10.1,-30.8"
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
        <g className="fx fx-bk-lamp">
          <g className="acc">
            <path
              d="M-3.5,-4.3Q-3.5,-2.7 -2.1,-2L-1.4,-1.7Q0,-1 0,-2.6L0,-3.1Q0,-4.7 -1.4,-5.4L-2.1,-5.8Q-3.5,-6.5 -3.5,-4.9Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-bk-x">
          <g className="acc">
            <path
              d="M-15.9,6.1L-1.8,5.6"
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
              d="M-15.9,-1.4L-1.8,13.1"
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
    </>
  );
}
