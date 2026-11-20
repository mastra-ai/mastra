import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function ProjectsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="-6.7" cy="19.2" r="54.8">
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
          d="M-36.3,25.7C-37.5,23.9 -35.1,21.5 -34.5,19.4C-34,17.3 -35.8,15.6 -32.8,13.1C-29.7,10.7 -22,7.5 -16.5,4.8C-11,2 -3.2,-2.2 0.1,-3.4C3.4,-4.6 2.3,-2.7 3.4,-2.4C4.5,-2.1 2.7,-3.3 6.8,-1.4C10.8,0.6 20.7,5.7 27.6,9.2C34.5,12.7 47.4,16.6 48.1,19.7C48.9,22.8 37.4,25.1 32,27.9C26.6,30.6 20.8,34.7 15.8,36.2C10.8,37.6 6.8,36.6 2.3,36.8C-2.3,37 -8.6,37.3 -11.4,37.2C-14.3,37.1 -13.7,36.5 -14.8,36.1C-15.9,35.8 -16,36 -18.1,35.1C-20.2,34.1 -24.2,31.9 -27.2,30.4C-30.3,28.8 -35.1,27.6 -36.3,25.7Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-26.5,-27Q-26.5,-29.2 -24.6,-30.2L-2,-41.5Q0,-42.5 2,-41.5L33.4,-25.8Q35.4,-24.8 35.4,-22.6L35.4,15.5Q35.4,17.7 33.4,18.7L10.8,30Q8.8,30.9 6.9,30L-24.6,14.2Q-26.5,13.3 -26.5,11.1Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M33.6,-23.9L10.6,-12.4Q8.8,-11.6 7.1,-12.4L-24.8,-28.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-22.1,6.4Q-22.1,8 -20.7,8.7L-16.5,10.8Q-15,11.5 -15,9.9L-15,4.4Q-15,2.8 -16.5,2L-20.7,-0.1Q-22.1,-0.8 -22.1,0.8Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-22.1,-8.6Q-22.1,-7 -20.7,-6.3L-16.5,-4.2Q-15,-3.5 -15,-5.1L-15,-10.6Q-15,-12.2 -16.5,-13L-20.7,-15.1Q-22.1,-15.8 -22.1,-14.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-12.4,11.2Q-12.4,12.8 -10.9,13.5L-6.7,15.7Q-5.3,16.4 -5.3,14.8L-5.3,9.2Q-5.3,7.6 -6.7,6.9L-10.9,4.8Q-12.4,4.1 -12.4,5.7Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-12.4,-3.8Q-12.4,-2.2 -10.9,-1.5L-6.7,0.7Q-5.3,1.4 -5.3,-0.2L-5.3,-5.8Q-5.3,-7.4 -6.7,-8.1L-10.9,-10.2Q-12.4,-10.9 -12.4,-9.3Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-2.7,16.1Q-2.7,17.7 -1.2,18.4L3,20.5Q4.4,21.2 4.4,19.6L4.4,14.1Q4.4,12.5 3,11.8L-1.2,9.7Q-2.7,8.9 -2.7,10.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-2.7,1.1Q-2.7,2.7 -1.2,3.4L3,5.5Q4.4,6.2 4.4,4.6L4.4,-0.9Q4.4,-2.5 3,-3.2L-1.2,-5.3Q-2.7,-6.1 -2.7,-4.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-1.8,-51Q-1.8,-53.2 -1,-53.6L-0.8,-53.7Q0,-54.1 0.8,-53.7L1,-53.6Q1.8,-53.2 1.8,-51L1.8,-42.9Q1.8,-40.7 1,-40.3L0.8,-40.2Q0,-39.8 -0.8,-40.2L-1,-40.3Q-1.8,-40.7 -1.8,-42.9Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-24.8,-39.5Q-24.8,-41.7 -23.9,-42.1L-23.8,-42.2Q-23,-42.6 -22.2,-42.2L-22,-42.1Q-21.2,-41.7 -21.2,-39.5L-21.2,-31.4Q-21.2,-29.2 -22,-28.8L-22.2,-28.8Q-23,-28.4 -23.8,-28.8L-23.9,-28.8Q-24.8,-29.2 -24.8,-31.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M30.1,-35.1Q30.1,-37.3 30.9,-37.7L31,-37.8Q31.8,-38.2 32.6,-37.8L32.8,-37.7Q33.6,-37.3 33.6,-35.1L33.6,-27Q33.6,-24.8 32.8,-24.4L32.6,-24.3Q31.8,-23.9 31,-24.3L30.9,-24.4Q30.1,-24.8 30.1,-27Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M7.1,-23.6Q7.1,-25.8 7.9,-26.2L8,-26.3Q8.8,-26.7 9.6,-26.3L9.8,-26.2Q10.6,-25.8 10.6,-23.6L10.6,-15.5Q10.6,-13.3 9.8,-12.9L9.6,-12.8Q8.8,-12.4 8,-12.8L7.9,-12.9Q7.1,-13.3 7.1,-15.5Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-22.8,-40.8Q-24.8,-41.7 -22.8,-42.7L-2,-53.1Q0,-54.1 2,-53.1L31.6,-38.3Q33.6,-37.3 31.6,-36.3L10.8,-25.9Q8.8,-24.9 6.9,-25.9Z"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-30.1,-44.7Q-30.1,-46.9 -28.1,-47.8L-21.4,-51.2Q-19.4,-52.2 -17.5,-51.2L-9,-47Q-7.1,-46 -7.1,-43.8L-7.1,24.3Q-7.1,26.5 -9,27.5L-15.7,30.8Q-17.7,31.8 -19.6,30.8L-28.1,26.6Q-30.1,25.6 -30.1,23.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-8.8,-45.1L-15.9,-41.6Q-17.7,-40.7 -19.4,-41.6L-28.3,-46"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-28.3,-48.9Q-28.3,-50.6 -26.3,-51.6L-21.4,-54.1Q-19.4,-55 -17.5,-54.1L-10.8,-50.7Q-8.8,-49.7 -8.8,-48L-8.8,-47.7Q-8.8,-46 -10.8,-45L-15.7,-42.5Q-17.7,-41.6 -19.6,-42.5L-26.3,-45.9Q-28.3,-46.9 -28.3,-48.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-27.4,20.4Q-27.4,22 -26,22.7L-21.8,24.8Q-20.3,25.5 -20.3,23.9L-20.3,-35.4Q-20.3,-37 -21.8,-37.7L-26,-39.8Q-27.4,-40.5 -27.4,-38.9Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-pj-win`}>
          <path d="M-27.4,-40.5L-20.3,-37L-20.3,25.5L-27.4,22Z" />
        </clipPath>
        <g clipPath={`url(#${id}-pj-win)`}>
          <g className="acc tick" style={s({ '--dur': '1.6s', '--step': '0px -15px' })}>
            <path
              d="M-24.8,40.2Q-24.8,39 -22.8,38L-20.5,36.9Q-18.6,35.9 -16.6,36.9L-15.2,37.6Q-13.3,38.6 -13.3,39.7L-13.3,39.9Q-13.3,41.1 -15.2,42.1L-17.5,43.2Q-19.4,44.2 -21.4,43.2L-22.8,42.5Q-24.8,41.5 -24.8,40.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-24.8,25.2Q-24.8,24 -22.8,23L-20.5,21.9Q-18.6,20.9 -16.6,21.9L-15.2,22.6Q-13.3,23.6 -13.3,24.7L-13.3,24.9Q-13.3,26.1 -15.2,27.1L-17.5,28.2Q-19.4,29.2 -21.4,28.2L-22.8,27.5Q-24.8,26.5 -24.8,25.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-24.8,10.2Q-24.8,9 -22.8,8L-20.5,6.9Q-18.6,5.9 -16.6,6.9L-15.2,7.6Q-13.3,8.6 -13.3,9.7L-13.3,9.9Q-13.3,11.1 -15.2,12.1L-17.5,13.2Q-19.4,14.2 -21.4,13.2L-22.8,12.5Q-24.8,11.5 -24.8,10.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-24.8,-4.8Q-24.8,-6 -22.8,-7L-20.5,-8.1Q-18.6,-9.1 -16.6,-8.1L-15.2,-7.4Q-13.3,-6.4 -13.3,-5.3L-13.3,-5.1Q-13.3,-3.9 -15.2,-2.9L-17.5,-1.8Q-19.4,-0.8 -21.4,-1.8L-22.8,-2.5Q-24.8,-3.5 -24.8,-4.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-24.8,-19.8Q-24.8,-21 -22.8,-22L-20.5,-23.1Q-18.6,-24.1 -16.6,-23.1L-15.2,-22.4Q-13.3,-21.4 -13.3,-20.3L-13.3,-20.1Q-13.3,-18.9 -15.2,-17.9L-17.5,-16.8Q-19.4,-15.8 -21.4,-16.8L-22.8,-17.5Q-24.8,-18.5 -24.8,-19.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-24.8,-34.8Q-24.8,-36 -22.8,-37L-20.5,-38.1Q-18.6,-39.1 -16.6,-38.1L-15.2,-37.4Q-13.3,-36.4 -13.3,-35.3L-13.3,-35.1Q-13.3,-33.9 -15.2,-32.9L-17.5,-31.8Q-19.4,-30.8 -21.4,-31.8L-22.8,-32.5Q-24.8,-33.5 -24.8,-34.6Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-24.8,-49.8Q-24.8,-51 -22.8,-52L-20.5,-53.1Q-18.6,-54.1 -16.6,-53.1L-15.2,-52.4Q-13.3,-51.4 -13.3,-50.3L-13.3,-50.1Q-13.3,-48.9 -15.2,-47.9L-17.5,-46.8Q-19.4,-45.8 -21.4,-46.8L-22.8,-47.5Q-24.8,-48.5 -24.8,-49.6Z"
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
        <clipPath id={`${id}-pj-win2`}>
          <path d="M-27.4,-40.5L-20.3,-37L-20.3,25.5L-27.4,22Z" />
        </clipPath>
        <g clipPath={`url(#${id}-pj-win2)`}>
          <g className="fx fx-pj-cable">
            <g className="acc">
              <path
                d="M-19,-45L-19,18.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
          <g className="fx fx-pj-car">
            <g className="acc">
              <path
                d="M-24.8,20.2Q-24.8,19 -22.8,18L-20.5,16.9Q-18.6,15.9 -16.6,16.9L-15.2,17.6Q-13.3,18.6 -13.3,19.7L-13.3,19.9Q-13.3,21.1 -15.2,22.1L-17.5,23.2Q-19.4,24.2 -21.4,23.2L-22.8,22.5Q-24.8,21.5 -24.8,20.4Z"
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
        <g className="acc">
          <path
            d="M35.4,13.4Q35.4,11.2 36.2,10.8L36.3,10.7Q37.1,10.3 37.9,10.7L38.1,10.8Q38.9,11.2 38.9,13.4L38.9,19Q38.9,21.2 38.1,21.6L37.9,21.7Q37.1,22.1 36.3,21.7L36.2,21.6Q35.4,21.2 35.4,19Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M14.1,24Q14.1,21.8 14.9,21.4L15.1,21.3Q15.9,20.9 16.7,21.3L16.9,21.4Q17.7,21.8 17.7,24L17.7,29.6Q17.7,31.8 16.9,32.2L16.7,32.3Q15.9,32.7 15.1,32.3L14.9,32.2Q14.1,31.8 14.1,29.6Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M12.4,21.2Q12.4,19 14.3,18L36.9,6.7Q38.9,5.7 39.4,5.9L39.5,6Q40,6.2 40,8.4L40,9Q40,11.2 38,12.2L15.4,23.5Q13.4,24.5 13,24.2L12.9,24.2Q12.4,24 12.4,21.8Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M38.2,12.1L35.5,8.4M32.9,14.8L30.2,11.1M27.6,17.4L24.9,13.7M22.3,20.1L19.6,16.4M17,22.7L14.3,19"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-pj-beacon">
          <g className="acc">
            <path
              d="M-21.1,-53.3A2.5 1.3 0 0 1 -16.1,-53.3L-16.1,-50.2A2.5 1.3 0 0 1 -21.1,-50.2Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <ellipse
              cx="-18.6"
              cy="-53.3"
              rx="2.5"
              ry="1.3"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-pj-dust0">
          <circle
            cx="-22.5"
            cy="21.8"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-pj-dust1">
          <circle
            cx="-24.8"
            cy="20.5"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-pj-dust2">
          <circle
            cx="-27.1"
            cy="19.3"
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
