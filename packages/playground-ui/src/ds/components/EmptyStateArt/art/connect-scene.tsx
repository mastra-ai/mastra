import { s } from './scene-style';
import type { SceneProps } from './scene-style';

export function ConnectScene({ id }: SceneProps) {
  return (
    <>
      <path
        d="M-65.4,29.1Q-65.4,27.4 -63.4,26.4L-2,-4.3Q0,-5.3 2,-4.3L44,16.7Q46,17.7 46,19.4L46,19.7Q46,21.4 44,22.4L-17.5,53.2Q-19.4,54.1 -21.4,53.2L-63.4,32.1Q-65.4,31.2 -65.4,29.4Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
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
        d="M-17.7,3.6Q-17.7,5.2 -16.2,5.9L-1.4,13.3Q0,14 0,12.4L0,-6.9Q0,-8.5 -1.4,-9.2L-16.2,-16.6Q-17.7,-17.3 -17.7,-15.7Z"
        fill="var(--face)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-13.3,-3Q-13.3,-1.4 -12.5,-1L-12.3,-0.9Q-11.5,-0.5 -11.5,-2.1L-11.5,-3.9Q-11.5,-5.5 -12.3,-5.9L-12.5,-6Q-13.3,-6.4 -13.3,-4.8Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-6.2,0.6Q-6.2,2.2 -5.4,2.6L-5.2,2.7Q-4.4,3.1 -4.4,1.5L-4.4,-0.3Q-4.4,-1.9 -5.2,-2.3L-5.4,-2.4Q-6.2,-2.8 -6.2,-1.2Z"
        fill="var(--hole)"
        stroke="var(--line)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M-15,-11L-2.7,-4.8"
        fill="none"
        stroke="var(--detail)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <g className="okonly">
        <clipPath id={`${id}-cn-15`}>
          <path d="M-57.5,15.7L-13.3,-6.4L-11.5,-5.5L-11.5,-0.5L-55.7,21.6L-57.5,20.7Z" />
        </clipPath>
        <g clipPath={`url(#${id}-cn-15)`}>
          <g className="acc created drawer" style={s({ '--shift': '7.1px -3.5px' })}>
            <path
              d="M-20.2,-0.4Q-20.2,-1.9 -18.2,-2.8L-17.7,-3.1Q-15.7,-4.1 -15.1,-3.7L-15,-3.7Q-14.3,-3.4 -14.3,-1.9L-14.3,-1.6Q-14.3,-0.1 -16.3,0.9L-16.8,1.1Q-18.7,2.1 -19.4,1.8L-19.5,1.7Q-20.2,1.4 -20.2,-0.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <clipPath id={`${id}-cn-23`}>
          <path d="M-50.4,19.3L-6.2,-2.8L-4.4,-1.9L-4.4,3.1L-48.6,25.2L-50.4,24.3Z" />
        </clipPath>
        <g clipPath={`url(#${id}-cn-23)`}>
          <g className="acc created drawer" style={s({ '--shift': '7.1px -3.5px' })}>
            <path
              d="M-13.1,3.2Q-13.1,1.7 -11.1,0.7L-10.6,0.4Q-8.7,-0.5 -8,-0.2L-7.9,-0.1Q-7.2,0.2 -7.2,1.6L-7.2,1.9Q-7.2,3.4 -9.2,4.4L-9.7,4.6Q-11.7,5.6 -12.3,5.3L-12.4,5.2Q-13.1,4.9 -13.1,3.4Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="acc created drawer" style={s({ '--shift': '7.1px -3.5px' })}>
          <path
            d="M-35.4,0.5Q-35.4,-1.7 -33.4,-2.7L-25,-6.9Q-23,-7.9 -21,-6.9L-10.8,-1.8Q-8.8,-0.8 -8.8,1.4L-8.8,12Q-8.8,14.2 -10.8,15.2L-19.2,19.4Q-21.2,20.4 -23.2,19.4L-33.4,14.3Q-35.4,13.3 -35.4,11.1Z"
            fill="var(--face)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-10.6,0.1L-19.4,4.5Q-21.2,5.4 -23,4.5L-33.6,-0.8"
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-31.8,7.6L-24.8,11.1"
            fill="none"
            stroke="var(--detail)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-28.3,9.3C-38.9,14.6 -31.8,34.9 -19.4,50.4"
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
        <g className="acc">
          <path
            d="M-13.3,-3Q-13.3,-1.4 -12.5,-1L-12.3,-0.9Q-11.5,-0.5 -11.5,-2.1L-11.5,-3.9Q-11.5,-5.5 -12.3,-5.9L-12.5,-6Q-13.3,-6.4 -13.3,-4.8Z"
            fill="var(--hole)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M-6.2,0.6Q-6.2,2.2 -5.4,2.6L-5.2,2.7Q-4.4,3.1 -4.4,1.5L-4.4,-0.3Q-4.4,-1.9 -5.2,-2.3L-5.4,-2.4Q-6.2,-2.8 -6.2,-1.2Z"
            fill="var(--hole)"
            stroke="var(--line)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <clipPath id={`${id}-cn2-15`}>
          <path d="M-58.3,12.8L-14.1,-9.3L-10.6,-7.5L-10.6,5L-54.8,27.1L-58.3,25.3Z" />
        </clipPath>
        <g clipPath={`url(#${id}-cn2-15)`}>
          <g className="fx fx-cn-p15">
            <g className="acc">
              <path
                d="M-20.2,-0.4Q-20.2,-1.9 -18.2,-2.8L-17.7,-3.1Q-15.7,-4.1 -15.1,-3.7L-15,-3.7Q-14.3,-3.4 -14.3,-1.9L-14.3,-1.6Q-14.3,-0.1 -16.3,0.9L-16.8,1.1Q-18.7,2.1 -19.4,1.8L-19.5,1.7Q-20.2,1.4 -20.2,-0.1Z"
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
        <clipPath id={`${id}-cn2-23`}>
          <path d="M-51.3,16.3L-7.1,-5.8L-3.5,-4L-3.5,8.5L-47.7,30.6L-51.3,28.8Z" />
        </clipPath>
        <g clipPath={`url(#${id}-cn2-23)`}>
          <g className="fx fx-cn-p23">
            <g className="acc">
              <path
                d="M-13.1,3.2Q-13.1,1.7 -11.1,0.7L-10.6,0.4Q-8.7,-0.5 -8,-0.2L-7.9,-0.1Q-7.2,0.2 -7.2,1.6L-7.2,1.9Q-7.2,3.4 -9.2,4.4L-9.7,4.6Q-11.7,5.6 -12.3,5.3L-12.4,5.2Q-13.1,4.9 -13.1,3.4Z"
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
        <g className="fx fx-cn-body">
          <g className="acc">
            <path
              d="M-35.4,0.5Q-35.4,-1.7 -33.4,-2.7L-25,-6.9Q-23,-7.9 -21,-6.9L-10.8,-1.8Q-8.8,-0.8 -8.8,1.4L-8.8,12Q-8.8,14.2 -10.8,15.2L-19.2,19.4Q-21.2,20.4 -23.2,19.4L-33.4,14.3Q-35.4,13.3 -35.4,11.1Z"
              fill="var(--face)"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-10.6,0.1L-19.4,4.5Q-21.2,5.4 -23,4.5L-33.6,-0.8"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-31.8,7.6L-24.8,11.1"
              fill="none"
              stroke="var(--detail)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M-28.3,9.3C-38.9,14.6 -31.8,34.9 -19.4,50.4"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-cn-arc">
          <g className="acc">
            <path
              d="M-5.4,-1.1L-2,-0.5M-6.7,0.7L-2.9,4.7M-8.9,1.3L-9,4.3M-11.2,0.6L-15.1,4.4M-12.3,-1.2L-15.8,-0.8M-11.8,-3.2L-16.9,-5.9M-10,-4.5L-11.1,-7.3M-7.6,-4.4L-5.4,-9.2M-5.8,-3.1L-2.7,-4.5"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-cn-arc2">
          <g className="acc">
            <path
              d="M-8.1,-6.1L-4.6,-5.5M-9.3,-4.4L-5.6,-0.4M-11.6,-3.7L-11.7,-0.8M-13.8,-4.5L-17.8,-0.7M-15,-6.3L-18.4,-5.8M-14.5,-8.3L-19.6,-10.9M-12.6,-9.6L-13.7,-12.4M-10.2,-9.5L-8,-14.2M-8.4,-8.2L-5.3,-9.6"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>
        <g className="fx fx-cn-smoke0">
          <circle
            cx="-7.4"
            cy="-6.1"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-cn-smoke1">
          <circle
            cx="-9.7"
            cy="-7.3"
            r="3"
            fill="none"
            stroke="var(--smoke)"
            strokeWidth="1"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g className="fx fx-cn-smoke2">
          <circle
            cx="-12"
            cy="-8.6"
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
