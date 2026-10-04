import type { CSSProperties } from 'react';

const hoverStyle: CSSProperties & { '--hover-transform': string } = {
  '--hover-transform': 'matrix(-0.766, -0.3214, 1.2856, -0.766, 0, 0)',
  transformOrigin: '60px 54.46px',
  transformBox: 'view-box',
};

export function RateLimitedArt() {
  return (
    <g strokeWidth="0.9">
      <path
        d="M18.4 54.46L18.6 52.42L19.2 50.4L20.19 48.42L21.57 46.5L23.31 44.65L25.41 42.9L27.84 41.26L30.58 39.75L33.61 38.38L36.89 37.17L40.39 36.12L44.08 35.24L47.92 34.56L51.88 34.06L55.92 33.76L60 33.66L64.08 33.76L68.12 34.06L72.08 34.56L75.92 35.24L79.61 36.12L83.11 37.17L86.39 38.38L89.42 39.75L92.16 41.26L94.59 42.9L96.69 44.65L98.43 46.5L99.81 48.42L100.8 50.4L101.4 52.42L101.6 54.46L101.6 65.55L101.4 67.58L100.8 69.6L99.81 71.58L98.43 73.5L96.69 75.35L94.59 77.1L92.16 78.74L89.42 80.25L86.39 81.62L83.11 82.84L79.61 83.89L75.92 84.76L72.08 85.45L68.12 85.95L64.08 86.24L60 86.35L55.92 86.24L51.88 85.95L47.92 85.45L44.08 84.76L40.39 83.89L36.89 82.84L33.61 81.62L30.58 80.25L27.84 78.74L25.41 77.1L23.31 75.35L21.57 73.5L20.19 71.58L19.2 69.6L18.6 67.58L18.4 65.55Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="M99.2 54.46L99.01 56.38L98.45 58.28L97.51 60.15L96.22 61.96L94.57 63.7L92.59 65.35L90.3 66.89L87.72 68.32L84.87 69.61L81.78 70.76L78.48 71.75L75 72.57L71.38 73.22L67.65 73.68L63.84 73.97L60 74.06L56.16 73.97L52.35 73.68L48.62 73.22L45 72.57L41.52 71.75L38.22 70.76L35.13 69.61L32.28 68.32L29.7 66.89L27.41 65.35L25.43 63.7L23.78 61.96L22.49 60.15L21.55 58.28L20.99 56.38L20.8 54.46"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="M32 54.46L26.4 54.46M35.05 48.1L30.06 46.83M43.54 43.13L40.25 40.87M55.62 40.63L54.74 37.87M68.65 41.15L70.38 38.48M79.8 44.56L83.76 42.58M86.63 50.13L91.96 49.27M87.66 56.65L93.19 57.09"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      <path
        d="M79.42 61.51L87.18 64.33M70.9 65.15L75.25 69.43M60 66.46L60 71.26"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g
        className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/illustration:[transform:var(--hover-transform)]"
        style={hoverStyle}
      >
        <path d="M60 54.46L68.76 66.49" stroke="currentColor" strokeLinecap="round" />
      </g>
      <path
        d="M55.2 51L55.36 50.37L55.84 49.8L56.61 49.3L57.6 48.92L58.76 48.68L60 48.6L61.24 48.68L62.4 48.92L63.39 49.3L64.16 49.8L64.64 50.37L64.8 51L64.8 54.46L64.64 55.08L64.16 55.66L63.39 56.16L62.4 56.54L61.24 56.78L60 56.86L58.76 56.78L57.6 56.54L56.61 56.16L55.84 55.66L55.36 55.08L55.2 54.46Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="M63.52 51L63.4 51.45L63.05 51.88L62.49 52.24L61.76 52.52L60.91 52.7L60 52.76L59.09 52.7L58.24 52.52L57.51 52.24L56.95 51.88L56.6 51.45L56.48 51"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
    </g>
  );
}
