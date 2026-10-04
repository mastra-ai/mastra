import type { CSSProperties } from 'react';

export function RateLimitedArt() {
  return (
    <g strokeWidth="0.9">
      <path
        d="M18.4 49.91L18.6 47.88L19.2 45.86L20.19 43.88L21.57 41.96L23.31 40.11L25.41 38.36L27.84 36.72L30.58 35.21L33.61 33.84L36.89 32.62L40.39 31.57L44.08 30.7L47.92 30.01L51.88 29.51L55.92 29.22L60 29.11L64.08 29.22L68.12 29.51L72.08 30.01L75.92 30.7L79.61 31.57L83.11 32.62L86.39 33.84L89.42 35.21L92.16 36.72L94.59 38.36L96.69 40.11L98.43 41.96L99.81 43.88L100.8 45.86L101.4 47.88L101.6 49.91L101.6 61L101.4 63.04L100.8 65.06L99.81 67.04L98.43 68.96L96.69 70.81L94.59 72.56L92.16 74.2L89.42 75.71L86.39 77.08L83.11 78.29L79.61 79.34L75.92 80.22L72.08 80.9L68.12 81.4L64.08 81.7L60 81.8L55.92 81.7L51.88 81.4L47.92 80.9L44.08 80.22L40.39 79.34L36.89 78.29L33.61 77.08L30.58 75.71L27.84 74.2L25.41 72.56L23.31 70.81L21.57 68.96L20.19 67.04L19.2 65.06L18.6 63.04L18.4 61Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="M99.2 49.91L99.01 51.84L98.45 53.74L97.51 55.6L96.22 57.42L94.57 59.15L92.59 60.8L90.3 62.35L87.72 63.77L84.87 65.07L81.78 66.21L78.48 67.2L75 68.02L71.38 68.67L67.65 69.14L63.84 69.42L60 69.51L56.16 69.42L52.35 69.14L48.62 68.67L45 68.02L41.52 67.2L38.22 66.21L35.13 65.07L32.28 63.77L29.7 62.35L27.41 60.8L25.43 59.15L23.78 57.42L22.49 55.6L21.55 53.74L20.99 51.84L20.8 49.91"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
      <path
        d="M32 49.91L26.4 49.91M35.05 43.56L30.06 42.29M43.54 38.59L40.25 36.32M55.62 36.09L54.74 33.32M68.65 36.6L70.38 33.94M79.8 40.02L83.76 38.04M86.63 45.59L91.96 44.72M87.66 52.1L93.19 52.54"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeLinecap="round"
      />
      <path
        d="M79.42 56.97L87.18 59.79M70.9 60.61L75.25 64.88M60 61.91L60 66.71"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g
        className="motion-safe:transition-[translate,transform] motion-safe:duration-slow motion-safe:ease-out-custom motion-safe:group-hover/illustration:[transform:var(--hover-transform)]"
        style={
          {
            '--hover-transform': 'matrix(-0.766, -0.3214, 1.2856, -0.766, 0, 0)',
            transformOrigin: '60px 49.91px',
            transformBox: 'view-box',
          } as CSSProperties
        }
      >
        <path d="M60 49.91L68.76 61.94" stroke="currentColor" strokeLinecap="round" />
      </g>
      <path
        d="M55.2 46.45L55.36 45.83L55.84 45.25L56.61 44.75L57.6 44.37L58.76 44.13L60 44.05L61.24 44.13L62.4 44.37L63.39 44.75L64.16 45.25L64.64 45.83L64.8 46.45L64.8 49.91L64.64 50.54L64.16 51.11L63.39 51.61L62.4 51.99L61.24 52.23L60 52.31L58.76 52.23L57.6 51.99L56.61 51.61L55.84 51.11L55.36 50.54L55.2 49.91Z"
        className="fill-background"
        stroke="currentColor"
        strokeOpacity="0.7"
      />
      <path
        d="M63.52 46.45L63.4 46.91L63.05 47.33L62.49 47.7L61.76 47.97L60.91 48.15L60 48.21L59.09 48.15L58.24 47.97L57.51 47.7L56.95 47.33L56.6 46.91L56.48 46.45"
        stroke="currentColor"
        strokeOpacity="0.35"
      />
    </g>
  );
}
