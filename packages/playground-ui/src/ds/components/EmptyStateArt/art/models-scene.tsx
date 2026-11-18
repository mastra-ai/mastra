import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function ModelsScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <pattern id={`${id}-gh`} patternUnits="userSpaceOnUse" width="1.8" height="1.8" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="1.8" stroke="var(--detail)" strokeOpacity=".42" strokeWidth=".34" />
        </pattern>
        <radialGradient id={`${id}-gg0`} gradientUnits="userSpaceOnUse" cx="21" cy="11.6" r="73.6">
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
          d="M-46.9,25.7C-46.1,21.6 -29.9,16 -21.3,11C-12.7,6.1 -2.9,0.1 4.5,-3.9C11.8,-7.9 16.7,-10.1 22.8,-13.1C28.8,-16.1 37.4,-20.6 40.9,-21.9C44.5,-23.2 43.1,-21.3 44.2,-20.9C45.3,-20.6 43.1,-22 47.5,-19.9C52,-17.7 63.1,-12 70.9,-8.1C78.6,-4.1 93.2,0.2 94.1,3.7C95,7.2 82.2,9.7 76.2,12.7C70.3,15.7 66.1,18 58.4,21.8C50.6,25.6 39.2,31 29.6,35.5C20,39.9 6.2,46.6 0.9,48.6C-4.5,50.7 -1.3,48 -2.4,47.6C-3.5,47.3 -1.7,48.5 -5.7,46.6C-9.7,44.7 -19.5,39.6 -26.4,36.1C-33.2,32.7 -47.8,29.9 -46.9,25.7Z"
          fill={`url(#${id}-gh)`}
        />
      </g>
      <path
        d="M10.6,-8.8Q10.6,-11 12.6,-12L38.7,-25.1Q40.7,-26.1 42.6,-25.1L79.4,-6.7Q81.3,-5.7 81.3,-3.5L81.3,-0.4Q81.3,1.8 79.4,2.8L53.2,15.8Q51.3,16.8 49.3,15.8L12.6,-2.6Q10.6,-3.5 10.6,-5.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M79.6,-4.8L53,8.4Q51.3,9.3 49.5,8.4L12.4,-10.2"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M42.4,-23.4L76,-6.6M36.7,-20.5L70.3,-3.7M30.9,-17.7L64.5,-0.9M25.2,-14.8L58.8,2M19.4,-11.9L53,4.9"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-40.7,10.3Q-40.7,8.1 -38.7,7.2L-5.5,-9.4Q-3.5,-10.4 -1.6,-9.4L29.9,6.3Q31.8,7.3 31.8,9.5L31.8,22.6Q31.8,24.8 29.9,25.7L-3.3,42.3Q-5.3,43.3 -7.3,42.3L-38.7,26.6Q-40.7,25.6 -40.7,23.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M30.1,8.1L-3.5,24.9Q-5.3,25.8 -7.1,24.9L-38.9,9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-37.1,18.7L-30.1,22.2M-37.1,22.4L-32.7,24.6"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <g className="mdlamp">
          <path
            d="M-17.7,28Q-17.7,29.6 -16.2,30.3L-15.6,30.7Q-14.1,31.4 -14.1,29.8L-14.1,29.2Q-14.1,27.6 -15.6,26.9L-16.2,26.6Q-17.7,25.9 -17.7,27.5Z"
            fill="var(--line)"
            stroke="none"
          />
        </g>
      </g>
      <path
        d="M-11.8,0.5Q-13.3,-0.3 -14.7,0.5L-17.1,1.7Q-18.6,2.4 -17.1,3.1L3,13.2Q4.4,13.9 5.9,13.2L8.3,11.9Q9.7,11.2 8.3,10.5Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <mask id={`${id}-md-mask`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
          <rect x="-400" y="-400" width="800" height="800" fill="white" />
          <path d="M-40.7,8.1L-23.9,-0.3L11.5,17.4L11.5,34.9L-5.3,43.3L-40.7,25.6Z" fill="black" />
          <path d="M-13.3,21.8L23.9,3.3L31.8,7.3L31.8,24.8L-5.3,43.3L-13.3,39.3Z" fill="black" />
        </mask>
        <g mask={`url(#${id}-md-mask)`}>
          <g
            className="acc cart"
            style={s({
              '--cart': '#3186FF',
              offsetPath: "path('M57,-13.9C57,-71.4 -4.4,-40.7 -4.4,-13.2L-4.4,14.3')",
              '--at': '0%',
              '--delay': '-11.2s',
              '--cycle': '12.5s',
            })}
          >
            <g>
              <path
                d="M-12.8,-34.5Q-12.8,-36.7 -10.9,-37.7L-10.4,-37.9Q-8.4,-38.9 -6.4,-37.9L10.9,-29.3Q12.8,-28.3 12.8,-26.1L12.8,2Q12.8,4.2 10.9,5.2L10.4,5.4Q8.4,6.4 6.4,5.4L-10.9,-3.2Q-12.8,-4.2 -12.8,-6.4Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M11.1,-27.4L10.2,-27Q8.4,-26.1 6.6,-27L-11.1,-35.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-6.2,-36.5L8,-29.4M-8,-35.6L6.2,-28.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10.2,-10.7Q-10.2,-9.1 -8.7,-8.4L4.3,-1.9Q5.7,-1.2 5.7,-2.8L5.7,-19.6Q5.7,-21.2 4.3,-21.9L-8.7,-28.4Q-10.2,-29.1 -10.2,-27.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
                fill="var(--line)"
                transform="matrix(0.36833,0.18417,0,0.52083,-6.6,-24.2)"
              />
            </g>
          </g>
          <g
            className="acc cart"
            style={s({
              '--cart': '#10A37F',
              offsetPath: "path('M51.3,-11C51.3,-68.5 -4.4,-40.7 -4.4,-13.2L-4.4,14.3')",
              '--at': '0%',
              '--delay': '-8.7s',
              '--cycle': '12.5s',
            })}
          >
            <g>
              <path
                d="M-12.8,-34.5Q-12.8,-36.7 -10.9,-37.7L-10.4,-37.9Q-8.4,-38.9 -6.4,-37.9L10.9,-29.3Q12.8,-28.3 12.8,-26.1L12.8,2Q12.8,4.2 10.9,5.2L10.4,5.4Q8.4,6.4 6.4,5.4L-10.9,-3.2Q-12.8,-4.2 -12.8,-6.4Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M11.1,-27.4L10.2,-27Q8.4,-26.1 6.6,-27L-11.1,-35.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-6.2,-36.5L8,-29.4M-8,-35.6L6.2,-28.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10.2,-10.7Q-10.2,-9.1 -8.7,-8.4L4.3,-1.9Q5.7,-1.2 5.7,-2.8L5.7,-19.6Q5.7,-21.2 4.3,-21.9L-8.7,-28.4Q-10.2,-29.1 -10.2,-27.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z"
                fill="var(--line)"
                transform="matrix(0.02763,0.01381,0,0.03906,-6.6,-24.2)"
              />
            </g>
          </g>
          <g
            className="acc cart"
            style={s({
              '--cart': '#E6E6E6',
              offsetPath: "path('M45.5,-8.2C45.5,-65.7 -4.4,-40.7 -4.4,-13.2L-4.4,14.3')",
              '--at': '0%',
              '--delay': '-6.2s',
              '--cycle': '12.5s',
            })}
          >
            <g>
              <path
                d="M-12.8,-34.5Q-12.8,-36.7 -10.9,-37.7L-10.4,-37.9Q-8.4,-38.9 -6.4,-37.9L10.9,-29.3Q12.8,-28.3 12.8,-26.1L12.8,2Q12.8,4.2 10.9,5.2L10.4,5.4Q8.4,6.4 6.4,5.4L-10.9,-3.2Q-12.8,-4.2 -12.8,-6.4Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M11.1,-27.4L10.2,-27Q8.4,-26.1 6.6,-27L-11.1,-35.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-6.2,-36.5L8,-29.4M-8,-35.6L6.2,-28.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10.2,-10.7Q-10.2,-9.1 -8.7,-8.4L4.3,-1.9Q5.7,-1.2 5.7,-2.8L5.7,-19.6Q5.7,-21.2 4.3,-21.9L-8.7,-28.4Q-10.2,-29.1 -10.2,-27.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z"
                fill="var(--line)"
                transform="matrix(0.36833,0.18417,0,0.52083,-6.6,-24.2)"
              />
            </g>
          </g>
          <g
            className="acc cart"
            style={s({
              '--cart': '#FF7000',
              offsetPath: "path('M39.8,-5.3C39.8,-62.8 -4.4,-40.7 -4.4,-13.2L-4.4,14.3')",
              '--at': '0%',
              '--delay': '-3.7s',
              '--cycle': '12.5s',
            })}
          >
            <g>
              <path
                d="M-12.8,-34.5Q-12.8,-36.7 -10.9,-37.7L-10.4,-37.9Q-8.4,-38.9 -6.4,-37.9L10.9,-29.3Q12.8,-28.3 12.8,-26.1L12.8,2Q12.8,4.2 10.9,5.2L10.4,5.4Q8.4,6.4 6.4,5.4L-10.9,-3.2Q-12.8,-4.2 -12.8,-6.4Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M11.1,-27.4L10.2,-27Q8.4,-26.1 6.6,-27L-11.1,-35.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-6.2,-36.5L8,-29.4M-8,-35.6L6.2,-28.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10.2,-10.7Q-10.2,-9.1 -8.7,-8.4L4.3,-1.9Q5.7,-1.2 5.7,-2.8L5.7,-19.6Q5.7,-21.2 4.3,-21.9L-8.7,-28.4Q-10.2,-29.1 -10.2,-27.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M15 8.0h32v32h-32zM143 8.0h32v32h-32zM15 40.0h32v32h-32zM47 40.0h32v32h-32zM111 40.0h32v32h-32zM143 40.0h32v32h-32zM15 72.0h32v32h-32zM47 72.0h32v32h-32zM79 72.0h32v32h-32zM111 72.0h32v32h-32zM143 72.0h32v32h-32zM15 104.0h32v32h-32zM79 104.0h32v32h-32zM143 104.0h32v32h-32zM15 136.0h32v32h-32zM143 136.0h32v32h-32zM63 104.0h16v32h-16zM95 40.0h16v32h-16zM127 8.0h16v32h-16zM127 104.0h16v64h-16z"
                fill="var(--line)"
                transform="matrix(0.05023,0.02511,0,0.07102,-6.6,-24.2)"
              />
            </g>
          </g>
          <g
            className="acc cart"
            style={s({
              '--cart': '#D97757',
              offsetPath: "path('M34,-2.4C34,-59.9 -4.4,-40.7 -4.4,-13.2L-4.4,14.3')",
              '--at': '100%',
              '--delay': '-1.2s',
              '--cycle': '12.5s',
            })}
          >
            <g>
              <path
                d="M-12.8,-34.5Q-12.8,-36.7 -10.9,-37.7L-10.4,-37.9Q-8.4,-38.9 -6.4,-37.9L10.9,-29.3Q12.8,-28.3 12.8,-26.1L12.8,2Q12.8,4.2 10.9,5.2L10.4,5.4Q8.4,6.4 6.4,5.4L-10.9,-3.2Q-12.8,-4.2 -12.8,-6.4Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M11.1,-27.4L10.2,-27Q8.4,-26.1 6.6,-27L-11.1,-35.8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-6.2,-36.5L8,-29.4M-8,-35.6L6.2,-28.5"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10.2,-10.7Q-10.2,-9.1 -8.7,-8.4L4.3,-1.9Q5.7,-1.2 5.7,-2.8L5.7,-19.6Q5.7,-21.2 4.3,-21.9L-8.7,-28.4Q-10.2,-29.1 -10.2,-27.5Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="m4.714 15.956 4.717-2.647.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.696-.0729-2.337-.0971-2.265-.1214-.5707-.1215-.5343-.7042.055-.3522.48-.3218.686.061 1.518.1032 2.277.1578 1.651.0972 2.447.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.836l-2.55-1.688-1.336-.9714-.7225-.4918-.3643-.4614-.1578-1.008.6557-.7225.88.607.225.607.893.686 1.906 1.475 2.489 1.834.3643.303.1457-.1032.018-.0728-.164-.2733-1.354-2.447-1.445-2.489-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.134 6.7 0l.9957.134.419.364.6192 1.415 1.002 2.228 1.554 3.03.4553.899.2429.832.091.255h.1579v-.1457l.1275-1.706.237-2.095.2307-2.696.0789-.7589.376-.9107.747-.4918.583.2793.48.686-.668.443-.2853 1.852-.5586 2.902-.3643 1.943h.2125l.2429-.2429.983-1.305 1.651-2.064.7286-.8196.85-.9046.546-.4311h1.032l.759 1.129-.34 1.166-1.063 1.348-.8804 1.141-1.263 1.7-.7893 1.36.073.1093.188-.0183 2.853-.607 1.542-.2794 1.84-.3157.832.3886.91.395-.3278.807-1.967.486-2.307.4614-3.436.8136-.425.03.486.061 1.548.1457.662.0364h1.621l3.018.2247.789.522.474.6376-.79.486-1.214.6193-1.639-.3886-3.825-.9107-1.311-.3279h-.1822v.1093l1.093 1.069 2.003 1.809 2.507 2.331.1275.577-.3218.455-.34-.0486-2.204-1.657-.85-.7468-1.925-1.621h-.1275v.17l.4432.65 2.344 3.521.1214 1.081-.17.352-.6071.212-.6679-.1214-1.372-1.925L14.38 17.959l-1.141-1.943-.1397.079-.674 7.255-.3156.37-.7286.279-.6071-.4614-.3218-.7468.322-1.475.3886-1.925.3157-1.53.285-1.9.17-.6314-.0121-.0425-.1397.018-1.433 1.967-2.18 2.945-1.724 1.846-.4128.164-.7164-.3704.067-.6618.401-.5889 2.386-3.036 1.439-1.882.929-1.087-.0062-.1579h-.0546l-6.338 4.116-1.129.1457-.4857-.4554.061-.7467.231-.2429 1.906-1.311Z"
                fill="var(--line)"
                transform="matrix(0.36833,0.18417,0,0.52083,-6.6,-24.2)"
              />
            </g>
          </g>
        </g>
      </g>
      <g className="fail">
        <path
          d="M44.2,-48.4Q44.2,-50.6 46.2,-51.6L46.7,-51.8Q48.6,-52.8 50.6,-51.8L67.9,-43.2Q69.8,-42.2 69.8,-40L69.8,-11.9Q69.8,-9.7 67.9,-8.7L67.4,-8.5Q65.4,-7.5 63.4,-8.5L46.2,-17.1Q44.2,-18.1 44.2,-20.3Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M68.1,-41.3L67.2,-40.9Q65.4,-40 63.6,-40.9L46,-49.7"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M50.8,-50.4L65,-43.3M49.1,-49.5L63.2,-42.4"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M46.9,-24.6Q46.9,-23 48.3,-22.3L61.3,-15.8Q62.8,-15.1 62.8,-16.7L62.8,-33.5Q62.8,-35.1 61.3,-35.8L48.3,-42.3Q46.9,-43 46.9,-41.4Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
          fill="var(--line)"
          transform="matrix(0.36833,0.18417,0,0.52083,50.4,-38.1)"
        />
        <path
          d="M38.5,-45.5Q38.5,-47.7 40.4,-48.7L40.9,-49Q42.9,-49.9 44.8,-49L62.1,-40.3Q64.1,-39.3 64.1,-37.1L64.1,-9Q64.1,-6.8 62.1,-5.9L61.6,-5.6Q59.7,-4.6 57.7,-5.6L40.4,-14.3Q38.5,-15.2 38.5,-17.4Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M62.3,-38.5L61.4,-38Q59.7,-37.1 57.9,-38L40.2,-46.9"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M45.1,-47.5L59.2,-40.4M43.3,-46.6L57.5,-39.6"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M41.1,-21.8Q41.1,-20.2 42.5,-19.4L55.6,-12.9Q57,-12.2 57,-13.8L57,-30.6Q57,-32.2 55.6,-32.9L42.5,-39.4Q41.1,-40.2 41.1,-38.6Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z"
          fill="var(--line)"
          transform="matrix(0.02763,0.01381,0,0.03906,44.6,-35.3)"
        />
        <path
          d="M32.7,-42.7Q32.7,-44.9 34.7,-45.8L35.2,-46.1Q37.1,-47.1 39.1,-46.1L56.4,-37.4Q58.3,-36.5 58.3,-34.3L58.3,-6.2Q58.3,-4 56.4,-3L55.9,-2.7Q53.9,-1.8 52,-2.7L34.7,-11.4Q32.7,-12.4 32.7,-14.6Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M56.6,-35.6L55.7,-35.1Q53.9,-34.3 52.2,-35.1L34.5,-44"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M39.3,-44.6L53.5,-37.6M37.6,-43.8L51.7,-36.7"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M35.4,-18.9Q35.4,-17.3 36.8,-16.6L49.8,-10Q51.3,-9.3 51.3,-10.9L51.3,-27.7Q51.3,-29.3 49.8,-30L36.8,-36.6Q35.4,-37.3 35.4,-35.7Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z"
          fill="var(--line)"
          transform="matrix(0.36833,0.18417,0,0.52083,38.9,-32.4)"
        />
        <path
          d="M27,-39.8Q27,-42 28.9,-43L29.4,-43.2Q31.4,-44.2 33.3,-43.2L50.6,-34.6Q52.6,-33.6 52.6,-31.4L52.6,-3.3Q52.6,-1.1 50.6,-0.1L50.1,0.1Q48.2,1.1 46.2,0.1L28.9,-8.5Q27,-9.5 27,-11.7Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M50.8,-32.7L49.9,-32.3Q48.2,-31.4 46.4,-32.3L28.7,-41.1"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M33.6,-41.8L47.7,-34.7M31.8,-40.9L46,-33.8"
          fill="none"
          stroke="var(--detail)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M29.6,-16Q29.6,-14.4 31,-13.7L44.1,-7.2Q45.5,-6.5 45.5,-8.1L45.5,-24.9Q45.5,-26.5 44.1,-27.2L31,-33.7Q29.6,-34.4 29.6,-32.8Z"
          fill="var(--face)"
          stroke="var(--line)"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M15 8.0h32v32h-32zM143 8.0h32v32h-32zM15 40.0h32v32h-32zM47 40.0h32v32h-32zM111 40.0h32v32h-32zM143 40.0h32v32h-32zM15 72.0h32v32h-32zM47 72.0h32v32h-32zM79 72.0h32v32h-32zM111 72.0h32v32h-32zM143 72.0h32v32h-32zM15 104.0h32v32h-32zM79 104.0h32v32h-32zM143 104.0h32v32h-32zM15 136.0h32v32h-32zM143 136.0h32v32h-32zM63 104.0h16v32h-16zM95 40.0h16v32h-16zM127 8.0h16v32h-16zM127 104.0h16v64h-16z"
          fill="var(--line)"
          transform="matrix(0.05023,0.02511,0,0.07102,33.1,-29.5)"
        />
        <mask id={`${id}-md-mask2`} maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="800">
          <rect x="-400" y="-400" width="800" height="800" fill="white" />
          <path d="M-40.7,8.1L-23.9,-0.3L11.5,17.4L11.5,34.9L-5.3,43.3L-40.7,25.6Z" fill="black" />
          <path d="M-13.3,21.8L23.9,3.3L31.8,7.3L31.8,24.8L-5.3,43.3L-13.3,39.3Z" fill="black" />
        </mask>
        <g mask={`url(#${id}-md-mask2)`}>
          <g className="fx fx-md-cart">
            <g className="acc">
              <path
                d="M-17.2,-20.2Q-17.2,-22.4 -15.3,-23.4L-14.8,-23.6Q-12.8,-24.6 -10.9,-23.6L6.4,-15Q8.4,-14 8.4,-11.8L8.4,16.3Q8.4,18.5 6.4,19.5L5.9,19.7Q4,20.7 2,19.7L-15.3,11.1Q-17.2,10.1 -17.2,7.9Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M6.6,-13.1L5.7,-12.7Q4,-11.8 2.2,-12.7L-15.5,-21.5"
                fill="none"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-10.6,-22.2L3.5,-15.1M-12.4,-21.3L1.8,-14.2"
                fill="none"
                stroke="var(--detail)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M-14.6,3.6Q-14.6,5.2 -13.2,5.9L-0.1,12.4Q1.3,13.1 1.3,11.5L1.3,-5.3Q1.3,-6.9 -0.1,-7.6L-13.2,-14.1Q-14.6,-14.8 -14.6,-13.2Z"
                fill="var(--face)"
                stroke="var(--line)"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="m4.714 15.956 4.717-2.647.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.696-.0729-2.337-.0971-2.265-.1214-.5707-.1215-.5343-.7042.055-.3522.48-.3218.686.061 1.518.1032 2.277.1578 1.651.0972 2.447.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.836l-2.55-1.688-1.336-.9714-.7225-.4918-.3643-.4614-.1578-1.008.6557-.7225.88.607.225.607.893.686 1.906 1.475 2.489 1.834.3643.303.1457-.1032.018-.0728-.164-.2733-1.354-2.447-1.445-2.489-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.134 6.7 0l.9957.134.419.364.6192 1.415 1.002 2.228 1.554 3.03.4553.899.2429.832.091.255h.1579v-.1457l.1275-1.706.237-2.095.2307-2.696.0789-.7589.376-.9107.747-.4918.583.2793.48.686-.668.443-.2853 1.852-.5586 2.902-.3643 1.943h.2125l.2429-.2429.983-1.305 1.651-2.064.7286-.8196.85-.9046.546-.4311h1.032l.759 1.129-.34 1.166-1.063 1.348-.8804 1.141-1.263 1.7-.7893 1.36.073.1093.188-.0183 2.853-.607 1.542-.2794 1.84-.3157.832.3886.91.395-.3278.807-1.967.486-2.307.4614-3.436.8136-.425.03.486.061 1.548.1457.662.0364h1.621l3.018.2247.789.522.474.6376-.79.486-1.214.6193-1.639-.3886-3.825-.9107-1.311-.3279h-.1822v.1093l1.093 1.069 2.003 1.809 2.507 2.331.1275.577-.3218.455-.34-.0486-2.204-1.657-.85-.7468-1.925-1.621h-.1275v.17l.4432.65 2.344 3.521.1214 1.081-.17.352-.6071.212-.6679-.1214-1.372-1.925L14.38 17.959l-1.141-1.943-.1397.079-.674 7.255-.3156.37-.7286.279-.6071-.4614-.3218-.7468.322-1.475.3886-1.925.3157-1.53.285-1.9.17-.6314-.0121-.0425-.1397.018-1.433 1.967-2.18 2.945-1.724 1.846-.4128.164-.7164-.3704.067-.6618.401-.5889 2.386-3.036 1.439-1.882.929-1.087-.0062-.1579h-.0546l-6.338 4.116-1.129.1457-.4857-.4554.061-.7467.231-.2429 1.906-1.311Z"
                fill="var(--line)"
                transform="matrix(0.36833,0.18417,0,0.52083,-11.1,-9.9)"
              />
            </g>
          </g>
        </g>
        <g className="fx fx-md-lamp">
          <g className="acc">
            <path
              d="M-17.7,28Q-17.7,29.6 -16.2,30.3L-15.6,30.7Q-14.1,31.4 -14.1,29.8L-14.1,29.2Q-14.1,27.6 -15.6,26.9L-16.2,26.6Q-17.7,25.9 -17.7,27.5Z"
              fill="var(--line)"
              stroke="none"
            />
          </g>
        </g>
      </g>
    </>
  );
}
