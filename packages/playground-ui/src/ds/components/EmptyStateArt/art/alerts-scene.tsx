import type { SceneProps } from './scene-style';

export function AlertsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="6.7" cy="3.9" r="40.6">
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
          d="M-14.2,1.2C-17,-0.4 -13.4,0.8 -13.1,0.6C-12.7,0.4 -12.6,0.4 -11.9,0C-11.2,-0.3 -10,-0.9 -9.1,-1.4C-8.1,-1.9 -7.5,-2.3 -6.2,-2.9C-4.9,-3.6 -3.1,-4.5 -1.5,-5.4C0.1,-6.2 1.9,-7.5 3.3,-7.8C4.6,-8 5.5,-7.1 6.6,-6.8C7.8,-6.5 6.4,-7.6 10,-5.8C13.7,-4.1 22.4,0.5 28.5,3.6C34.5,6.7 44.8,10.5 46.3,12.7C47.9,15 40.6,15.7 37.7,17.1C34.8,18.6 31,21 29.1,21.6C27.1,22.2 26.9,20.9 25.8,20.6C24.7,20.3 26.2,21.3 22.5,19.6C18.8,18 9.9,13.7 3.8,10.7C-2.3,7.6 -11.4,2.9 -14.2,1.2Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-5.7,-3.2Q-5.7,-6.1 -3,-7.4L0.9,-9.3Q3.5,-10.7 6.2,-9.3L30.9,3Q33.6,4.4 33.6,7.2L33.6,7.8Q33.6,10.6 30.9,11.9L27.1,13.9Q24.4,15.2 21.7,13.9L-3,1.5Q-5.7,0.2 -5.7,-2.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-3,-59.5Q-3,-63.5 -1.6,-64.2L-1.4,-64.3Q0,-65 3.6,-63.2L21.2,-54.4Q24.8,-52.6 24.8,-48.6L24.8,5.9Q24.8,9.9 23.4,10.6L23.1,10.7Q21.7,11.4 18.2,9.6L0.6,0.8Q-3,-1 -3,-5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-1.6,-6.9Q-1.6,-5.3 -0.2,-4.6L18.9,5Q20.3,5.7 20.3,4.1L20.3,-48.2Q20.3,-49.8 18.9,-50.5L-0.2,-60.1Q-1.6,-60.8 -1.6,-59.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M7.2,-54.3Q7.2,-53.7 8.6,-52.9L10.1,-52.2Q11.6,-51.5 11.6,-52.1L11.6,-52.3Q11.6,-53 10.1,-53.7L8.6,-54.4Q7.2,-55.2 7.2,-54.5Z"
        fill="var(--line)"
        stroke="none"
      />
      <circle cx="14.1" cy="-50.9" r="0.75" fill="var(--line)" />
      <path
        d="M24.2,-31.5Q24.2,-29.9 23.4,-29.5L23.3,-29.4Q22.5,-29 22.5,-30.6L22.5,-36.1Q22.5,-37.7 23.3,-38.1L23.4,-38.2Q24.2,-38.6 24.2,-37Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-8,-4.7Q-8,-6.7 -6.9,-7.2L-6.7,-7.3Q-5.7,-7.8 -3.9,-6.9L22.6,6.3Q24.4,7.2 24.4,9.2L24.4,13.2Q24.4,15.2 23.4,15.7L23.1,15.8Q22.1,16.4 20.3,15.5L-6.2,2.2Q-8,1.3 -8,-0.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M5.3,4.1Q5.3,4.7 6.7,5.4L7.4,5.8Q8.8,6.5 8.8,5.9L8.8,5.8Q8.8,5.2 7.4,4.5L6.7,4.2Q5.3,3.5 5.3,4Z"
        fill="var(--line)"
        stroke="none"
      />
      <g className="okonly">
        <clipPath id={`${id}-ph-screen`}>
          <path d="M-1.9,-59.9L-1.4,-60.2L20.2,-49.4L20.2,6.8L19.6,7.1L-1.9,-3.7Z" />
        </clipPath>
        <g clipPath={`url(#${id}-ph-screen)`}>
          <g className="fx fx-ph-banner">
            <g className="acc">
              <path
                d="M-0.2,-46.5Q-0.2,-44.9 1.3,-44.2L17.1,-36.3Q18.6,-35.5 18.6,-37.1L18.6,-42.4Q18.6,-44 17.1,-44.8L1.3,-52.7Q-0.2,-53.4 -0.2,-51.8Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M1,-47.3Q1,-45.7 2.4,-45L2.9,-44.8Q4.3,-44.1 4.3,-45.7L4.3,-48Q4.3,-49.6 2.9,-50.3L2.4,-50.5Q1,-51.2 1,-49.6Z"
                fill="var(--hole)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M5.7,-47.4L15.6,-42.4M5.7,-44.6L12.1,-41.4"
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
        <g className="fx fx-ph-ping0">
          <path
            className="acc"
            d="M24.5,-55.1A6 6 0 0 1 28.6,-48.5"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ph-ping1">
          <path
            className="acc"
            d="M25.9,-59.4A10.5 10.5 0 0 1 33,-47.9"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <g className="fail">
        <g className="fx fx-ph-card">
          <g className="acc">
            <path
              d="M-0.2,-46.5Q-0.2,-44.9 1.3,-44.2L17.1,-36.3Q18.6,-35.5 18.6,-37.1L18.6,-42.4Q18.6,-44 17.1,-44.8L1.3,-52.7Q-0.2,-53.4 -0.2,-51.8Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M1,-47.3Q1,-45.7 2.4,-45L2.9,-44.8Q4.3,-44.1 4.3,-45.7L4.3,-48Q4.3,-49.6 2.9,-50.3L2.4,-50.5Q1,-51.2 1,-49.6Z"
              fill="var(--hole)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M5.7,-47.4L15.6,-42.4M5.7,-44.6L12.1,-41.4"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-ph-hit">
          <g className="acc">
            <path
              d="M12.8,-54.8L16.2,-54.3M11.6,-53.1L15.3,-49.1M9.3,-52.4L9.2,-49.5M7.1,-53.2L3.1,-49.4M5.9,-55L2.4,-54.6M6.4,-57L1.3,-59.6M8.3,-58.3L7.1,-61.1M10.7,-58.2L12.8,-62.9M12.4,-56.9L15.5,-58.3"
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
