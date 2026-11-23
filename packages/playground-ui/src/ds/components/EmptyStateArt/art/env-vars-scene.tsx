import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function EnvVarsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="12.4" cy="12.4" r="38.4">
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
          d="M-18.6,6.1C-20.7,3.5 -12.6,3 -9.6,1.4C-6.5,-0.1 -2.5,-2.6 -0.4,-3.3C1.7,-3.9 1.8,-2.6 2.9,-2.3C4,-2 1.9,-3.3 6.2,-1.3C10.4,0.7 21.2,6 28.5,9.7C35.8,13.4 47.8,18.1 49.9,20.7C51.9,23.3 43.8,23.8 40.8,25.3C37.8,26.9 33.7,29.4 31.7,30C29.6,30.6 29.5,29.4 28.4,29C27.3,28.7 29.3,30.1 25.1,28.1C20.8,26.1 10.1,20.7 2.8,17C-4.5,13.4 -16.6,8.7 -18.6,6.1Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M-12.4,-54.1Q-12.4,-56.3 -10.4,-57.3L-2,-61.5Q0,-62.5 2,-61.5L35.2,-44.9Q37.1,-43.9 37.1,-41.7L37.1,16.4Q37.1,18.6 35.2,19.5L26.7,23.8Q24.8,24.8 22.8,23.8L-10.4,7.2Q-12.4,6.2 -12.4,4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M35.4,-43.1L26.5,-38.6Q24.8,-37.7 23,-38.6L-10.6,-55.4"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-9.7,2.2Q-9.7,3.8 -8.3,4.5L20.7,19Q22.1,19.7 22.1,18.1L22.1,-33.7Q22.1,-35.3 20.7,-36L-8.3,-50.5Q-9.7,-51.2 -9.7,-49.6Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.2,-37.3Q-6.2,-35.7 -4.8,-35L-3.2,-34.2Q-1.8,-33.5 -1.8,-35.1L-1.8,-41.9Q-1.8,-43.5 -3.2,-44.2L-4.8,-45Q-6.2,-45.7 -6.2,-44.1Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,-33.9L4.4,-31.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8,-30.2Q8,-28.6 9.4,-27.9L10.9,-27.2Q12.4,-26.4 12.4,-28L12.4,-34.8Q12.4,-36.4 10.9,-37.2L9.4,-37.9Q8,-38.6 8,-37Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14.1,-26.8L18.6,-24.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.2,-22.3Q-6.2,-20.7 -4.8,-20L-3.2,-19.2Q-1.8,-18.5 -1.8,-20.1L-1.8,-26.9Q-1.8,-28.5 -3.2,-29.2L-4.8,-30Q-6.2,-30.7 -6.2,-29.1Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,-18.9L4.4,-16.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8,-15.2Q8,-13.6 9.4,-12.9L10.9,-12.2Q12.4,-11.4 12.4,-13L12.4,-19.8Q12.4,-21.4 10.9,-22.2L9.4,-22.9Q8,-23.6 8,-22Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14.1,-11.8L18.6,-9.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.2,-7.3Q-6.2,-5.7 -4.8,-5L-3.2,-4.2Q-1.8,-3.5 -1.8,-5.1L-1.8,-11.9Q-1.8,-13.5 -3.2,-14.2L-4.8,-15Q-6.2,-15.7 -6.2,-14.1Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,-3.9L4.4,-1.7"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M8,-0.2Q8,1.4 9.4,2.1L10.9,2.8Q12.4,3.6 12.4,2L12.4,-4.8Q12.4,-6.4 10.9,-7.2L9.4,-7.9Q8,-8.6 8,-7Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14.1,3.2L18.6,5.4"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="acc flip" style={s({ '--delay': '0s', '--shift': '0px -5px' })}>
          <path
            d="M-7.5,-37.5Q-7.5,-39.2 -6.5,-39.7L-6.3,-39.8Q-5.3,-40.3 -4.1,-39.7L-3.9,-39.6Q-2.7,-39 -2.7,-37.2L-2.7,-36.9Q-2.7,-35.2 -3.7,-34.7L-3.9,-34.6Q-4.9,-34.1 -6.1,-34.7L-6.3,-34.8Q-7.5,-35.4 -7.5,-37.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="acc lamp" style={s({ '--delay': '0s' })}>
          <path
            d="M0.9,-39.6Q0.9,-38.4 1.7,-38L1.8,-37.9Q2.7,-37.5 2.7,-38.7L2.7,-38.9Q2.7,-40 1.8,-40.4L1.7,-40.5Q0.9,-40.9 0.9,-39.8Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc flip" style={s({ '--delay': '0.6s', '--shift': '0px -5px' })}>
          <path
            d="M6.6,-30.4Q6.6,-32.1 7.6,-32.6L7.8,-32.7Q8.8,-33.2 10,-32.6L10.3,-32.5Q11.5,-31.9 11.5,-30.2L11.5,-29.8Q11.5,-28.1 10.5,-27.6L10.3,-27.5Q9.3,-27 8.1,-27.6L7.8,-27.7Q6.6,-28.3 6.6,-30.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="acc lamp" style={s({ '--delay': '0.6s' })}>
          <path
            d="M15,-32.5Q15,-31.4 15.8,-31L16,-30.9Q16.8,-30.5 16.8,-31.6L16.8,-31.8Q16.8,-33 16,-33.4L15.8,-33.5Q15,-33.9 15,-32.7Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc flip" style={s({ '--delay': '1.1s', '--shift': '0px -5px' })}>
          <path
            d="M-7.5,-22.5Q-7.5,-24.2 -6.5,-24.7L-6.3,-24.8Q-5.3,-25.3 -4.1,-24.7L-3.9,-24.6Q-2.7,-23.9 -2.7,-22.2L-2.7,-21.9Q-2.7,-20.2 -3.7,-19.7L-3.9,-19.6Q-4.9,-19.1 -6.1,-19.7L-6.3,-19.8Q-7.5,-20.4 -7.5,-22.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="acc lamp" style={s({ '--delay': '1.1s' })}>
          <path
            d="M0.9,-24.6Q0.9,-23.4 1.7,-23L1.8,-22.9Q2.7,-22.5 2.7,-23.7L2.7,-23.9Q2.7,-25 1.8,-25.4L1.7,-25.5Q0.9,-25.9 0.9,-24.8Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc flip" style={s({ '--delay': '1.7s', '--shift': '0px -5px' })}>
          <path
            d="M6.6,-15.4Q6.6,-17.1 7.6,-17.6L7.8,-17.7Q8.8,-18.2 10,-17.6L10.3,-17.5Q11.5,-16.9 11.5,-15.2L11.5,-14.8Q11.5,-13.1 10.5,-12.6L10.3,-12.5Q9.3,-12 8.1,-12.6L7.8,-12.7Q6.6,-13.3 6.6,-15.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="acc lamp" style={s({ '--delay': '1.7s' })}>
          <path
            d="M15,-17.5Q15,-16.4 15.8,-16L16,-15.9Q16.8,-15.5 16.8,-16.6L16.8,-16.8Q16.8,-18 16,-18.4L15.8,-18.5Q15,-18.9 15,-17.7Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc flip" style={s({ '--delay': '2.2s', '--shift': '0px -5px' })}>
          <path
            d="M-7.5,-7.5Q-7.5,-9.2 -6.5,-9.7L-6.3,-9.8Q-5.3,-10.3 -4.1,-9.7L-3.9,-9.6Q-2.7,-8.9 -2.7,-7.2L-2.7,-6.9Q-2.7,-5.2 -3.7,-4.7L-3.9,-4.6Q-4.9,-4.1 -6.1,-4.7L-6.3,-4.8Q-7.5,-5.4 -7.5,-7.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="acc lamp" style={s({ '--delay': '2.2s' })}>
          <path
            d="M0.9,-9.6Q0.9,-8.4 1.7,-8L1.8,-7.9Q2.7,-7.5 2.7,-8.7L2.7,-8.9Q2.7,-10 1.8,-10.4L1.7,-10.5Q0.9,-10.9 0.9,-9.8Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="acc flip" style={s({ '--delay': '2.8s', '--shift': '0px -5px' })}>
          <path
            d="M6.6,-0.4Q6.6,-2.1 7.6,-2.6L7.8,-2.7Q8.8,-3.2 10,-2.6L10.3,-2.5Q11.5,-1.9 11.5,-0.2L11.5,0.2Q11.5,1.9 10.5,2.4L10.3,2.5Q9.3,3 8.1,2.4L7.8,2.3Q6.6,1.7 6.6,-0.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="acc lamp" style={s({ '--delay': '2.8s' })}>
          <path
            d="M15,-2.5Q15,-1.4 15.8,-1L16,-0.9Q16.8,-0.5 16.8,-1.6L16.8,-1.8Q16.8,-3 16,-3.4L15.8,-3.5Q15,-3.9 15,-2.7Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
      </g>
      <g className="fail">
        <path
          d="M6.6,-15.4Q6.6,-17.1 7.6,-17.6L7.8,-17.7Q8.8,-18.2 10,-17.6L10.3,-17.5Q11.5,-16.9 11.5,-15.2L11.5,-14.8Q11.5,-13.1 10.5,-12.6L10.3,-12.5Q9.3,-12 8.1,-12.6L7.8,-12.7Q6.6,-13.3 6.6,-15.1Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M-7.5,-7.5Q-7.5,-9.2 -6.5,-9.7L-6.3,-9.8Q-5.3,-10.3 -4.1,-9.7L-3.9,-9.6Q-2.7,-8.9 -2.7,-7.2L-2.7,-6.9Q-2.7,-5.2 -3.7,-4.7L-3.9,-4.6Q-4.9,-4.1 -6.1,-4.7L-6.3,-4.8Q-7.5,-5.4 -7.5,-7.1Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M6.6,-0.4Q6.6,-2.1 7.6,-2.6L7.8,-2.7Q8.8,-3.2 10,-2.6L10.3,-2.5Q11.5,-1.9 11.5,-0.2L11.5,0.2Q11.5,1.9 10.5,2.4L10.3,2.5Q9.3,3 8.1,2.4L7.8,2.3Q6.6,1.7 6.6,-0.1Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <g className="fx fx-ev-s0">
          <path
            d="M-7.5,-37.5Q-7.5,-39.2 -6.5,-39.7L-6.3,-39.8Q-5.3,-40.3 -4.1,-39.7L-3.9,-39.6Q-2.7,-39 -2.7,-37.2L-2.7,-36.9Q-2.7,-35.2 -3.7,-34.7L-3.9,-34.6Q-4.9,-34.1 -6.1,-34.7L-6.3,-34.8Q-7.5,-35.4 -7.5,-37.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ev-l0">
          <path
            d="M0.9,-39.6Q0.9,-38.4 1.7,-38L1.8,-37.9Q2.7,-37.5 2.7,-38.7L2.7,-38.9Q2.7,-40 1.8,-40.4L1.7,-40.5Q0.9,-40.9 0.9,-39.8Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="fx fx-ev-s1">
          <path
            d="M6.6,-30.4Q6.6,-32.1 7.6,-32.6L7.8,-32.7Q8.8,-33.2 10,-32.6L10.3,-32.5Q11.5,-31.9 11.5,-30.2L11.5,-29.8Q11.5,-28.1 10.5,-27.6L10.3,-27.5Q9.3,-27 8.1,-27.6L7.8,-27.7Q6.6,-28.3 6.6,-30.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ev-l1">
          <path
            d="M15,-32.5Q15,-31.4 15.8,-31L16,-30.9Q16.8,-30.5 16.8,-31.6L16.8,-31.8Q16.8,-33 16,-33.4L15.8,-33.5Q15,-33.9 15,-32.7Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
        <g className="fx fx-ev-s2">
          <g className="acc">
            <path
              d="M-7.5,-22.5Q-7.5,-24.2 -6.5,-24.7L-6.3,-24.8Q-5.3,-25.3 -4.1,-24.7L-3.9,-24.6Q-2.7,-23.9 -2.7,-22.2L-2.7,-21.9Q-2.7,-20.2 -3.7,-19.7L-3.9,-19.6Q-4.9,-19.1 -6.1,-19.7L-6.3,-19.8Q-7.5,-20.4 -7.5,-22.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-ev-l2">
          <g className="acc">
            <path
              d="M0.9,-24.6Q0.9,-23.4 1.7,-23L1.8,-22.9Q2.7,-22.5 2.7,-23.7L2.7,-23.9Q2.7,-25 1.8,-25.4L1.7,-25.5Q0.9,-25.9 0.9,-24.8Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
        <g className="fx fx-ev-trip">
          <g className="acc">
            <path
              d="M-2.3,-21.9L1.1,-21.3M-3.6,-20.1L0.2,-16.2M-5.8,-19.5L-5.9,-16.5M-8.1,-20.2L-12,-16.4M-9.2,-22L-12.7,-21.6M-8.7,-24L-13.8,-26.7M-6.9,-25.3L-8,-28.1M-4.5,-25.3L-2.3,-30M-2.7,-23.9L0.4,-25.3"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-ev-smoke0">
          <circle
            cx="13.8"
            cy="-50.8"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ev-smoke1">
          <circle
            cx="11.5"
            cy="-52.1"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-ev-smoke2">
          <circle
            cx="9.2"
            cy="-53.3"
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
