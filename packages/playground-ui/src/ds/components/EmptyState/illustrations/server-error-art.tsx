import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-shift': string } = { '--hover-shift': '8.91px -4.45px' };

export function ServerErrorArt({ id }: { id: string }) {
  return (
    <g strokeWidth="0.9">
      <path
        d="M36.08 33.55L36.53 32.4L37.83 31.43L53.11 23.79L55.05 23.14L57.35 22.92L59.65 23.14L61.59 23.79L87.05 36.52L88.35 37.5L88.81 38.64L88.81 86.45L88.35 87.6L87.05 88.57L71.77 96.21L69.83 96.86L67.53 97.08L65.24 96.86L63.29 96.21L37.83 83.48L36.53 82.51L36.08 81.36Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="M87.13 38.64L86.8 39.47L85.86 40.17L70.59 47.81L69.19 48.28L67.53 48.44L65.88 48.28L64.48 47.81L39.02 35.08L38.09 34.38L37.76 33.55"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="M61.42 84.78L61.33 84.13L61.05 83.49L60.64 82.94L60.15 82.58L40.97 72.99L40.49 72.87L40.07 73L39.8 73.37L39.7 73.92L39.7 78.28L39.8 78.93L40.07 79.57L40.49 80.11L40.97 80.48L60.15 90.06L60.64 90.19L61.05 90.06L61.33 89.69L61.42 89.14ZM61.42 75.42L61.33 74.78L61.05 74.13L60.64 73.59L60.15 73.23L40.97 63.64L40.49 63.52L40.07 63.65L39.8 64.01L39.7 64.56L39.7 68.93L39.8 69.57L40.07 70.22L40.49 70.76L40.97 71.12L60.15 80.71L60.64 80.84L61.05 80.7L61.33 80.34L61.42 79.79ZM61.42 66.07L61.33 65.43L61.05 64.78L60.64 64.24L60.15 63.88L40.97 54.29L40.49 54.16L40.07 54.29L39.8 54.66L39.7 55.21L39.7 59.57L39.8 60.22L40.07 60.86L40.49 61.41L40.97 61.77L60.15 71.36L60.64 71.48L61.05 71.35L61.33 70.98L61.42 70.44ZM61.42 56.72L61.33 56.07L61.05 55.43L60.64 54.88L60.15 54.52L40.97 44.93L40.49 44.81L40.07 44.94L39.8 45.31L39.7 45.86L39.7 50.22L39.8 50.87L40.07 51.51L40.49 52.05L40.97 52.42L60.15 62L60.64 62.13L61.05 62L61.33 61.63L61.42 61.08Z"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <mask id={`${id}-slot-0`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 83.39L39.7 72.36L61.42 83.22L61.42 90.7L39.36 101.73L17.64 90.87Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-0)`}>
        <path
          d="M40.1 73.96L40.28 73.5L40.8 73.11L48.86 69.08L49.64 68.82L50.56 68.73L51.48 68.82L52.26 69.08L69.23 77.56L69.75 77.95L69.93 78.41L69.93 84.65L69.75 85.11L69.23 85.49L61.17 89.53L60.39 89.79L59.47 89.88L58.55 89.79L57.77 89.53L40.8 81.04L40.28 80.65L40.1 80.19Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        <path
          d="M68.97 78.41L68.86 78.69L68.55 78.92L60.49 82.95L60.02 83.11L59.47 83.16L58.92 83.11L58.45 82.95L41.48 74.47L41.17 74.23L41.06 73.96"
          stroke="currentColor"
          strokeOpacity="0.35"
        />
        <path d="M54.8 84.92L57.35 86.2" stroke="currentColor" strokeOpacity="0.7" strokeLinecap="round" />
      </g>
      <mask id={`${id}-slot-1`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 74.03L39.7 63L61.42 73.86L61.42 81.35L39.36 92.38L17.64 81.52Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-1)`}>
        <path
          d="M40.1 64.6L40.28 64.14L40.8 63.75L48.86 59.72L49.64 59.46L50.56 59.37L51.48 59.46L52.26 59.72L69.23 68.21L69.75 68.6L69.93 69.06L69.93 75.29L69.75 75.75L69.23 76.14L61.17 80.17L60.39 80.43L59.47 80.52L58.55 80.43L57.77 80.17L40.8 71.69L40.28 71.3L40.1 70.84Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        <path
          d="M68.97 69.06L68.86 69.33L68.55 69.57L60.49 73.6L60.02 73.75L59.47 73.81L58.92 73.75L58.45 73.6L41.48 65.11L41.17 64.88L41.06 64.6"
          stroke="currentColor"
          strokeOpacity="0.35"
        />
        <path d="M54.8 75.57L57.35 76.84" stroke="currentColor" strokeOpacity="0.7" strokeLinecap="round" />
      </g>
      <mask id={`${id}-slot-2`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 64.68L39.7 53.65L61.42 64.51L61.42 71.99L39.36 83.02L17.64 72.16Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-2)`}>
        <g
          className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/illustration:[translate:var(--hover-shift)]"
          style={hoverStyle}
        >
          <path
            d="M31.19 59.7L31.37 59.25L31.89 58.86L48.86 50.37L49.64 50.11L50.56 50.02L51.48 50.11L52.26 50.37L69.23 58.86L69.75 59.25L69.93 59.7L69.93 65.94L69.75 66.4L69.23 66.79L52.26 75.27L51.48 75.53L50.56 75.63L49.64 75.53L48.86 75.27L31.89 66.79L31.37 66.4L31.19 65.94Z"
            className="fill-background"
            stroke="currentColor"
          />
          <path
            d="M68.97 59.7L68.86 59.98L68.55 60.21L51.58 68.7L51.11 68.86L50.56 68.91L50.01 68.86L49.54 68.7L32.57 60.21L32.26 59.98L32.15 59.7"
            stroke="currentColor"
            strokeOpacity="0.35"
          />
          <path d="M45.89 70.67L48.44 71.94" stroke="currentColor" strokeLinecap="round" />
        </g>
      </g>
      <mask id={`${id}-slot-3`} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
        <path d="M17.64 55.33L39.7 44.3L61.42 55.16L61.42 62.64L39.36 73.67L17.64 62.81Z" fill="white" />
      </mask>
      <g mask={`url(#${id}-slot-3)`}>
        <path
          d="M40.1 45.9L40.28 45.44L40.8 45.05L48.86 41.02L49.64 40.76L50.56 40.67L51.48 40.76L52.26 41.02L69.23 49.5L69.75 49.89L69.93 50.35L69.93 56.59L69.75 57.05L69.23 57.44L61.17 61.47L60.39 61.73L59.47 61.82L58.55 61.73L57.77 61.47L40.8 52.98L40.28 52.59L40.1 52.13Z"
          className="fill-background"
          stroke="currentColor"
          strokeOpacity="0.7"
        />
        <path
          d="M68.97 50.35L68.86 50.63L68.55 50.86L60.49 54.89L60.02 55.05L59.47 55.1L58.92 55.05L58.45 54.89L41.48 46.41L41.17 46.17L41.06 45.9"
          stroke="currentColor"
          strokeOpacity="0.35"
        />
        <path d="M54.8 56.86L57.35 58.14" stroke="currentColor" strokeOpacity="0.7" strokeLinecap="round" />
      </g>
    </g>
  );
}
