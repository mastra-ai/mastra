/**
 * Soft neon halo: the source blurred, faded to `alpha`, and drawn under the crisp source.
 * Render inside a chart's `<defs>` and reference it with `filter="url(#id)"`.
 *
 * The region is sized to the whole chart (userSpaceOnUse), not the element: a flat line has a
 * zero-height bounding box, and a bounding-box-relative region would clip it out entirely.
 */
export function ChartGlowFilter({ id, blur, alpha }: { id: string; blur: number; alpha: number }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
      <feColorMatrix
        in="blur"
        type="matrix"
        values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${alpha} 0`}
        result="glow"
      />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}
