/** A tiny trend line for a table cell. Flat when every bucket is zero. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 64;
  const height = 16;
  const max = Math.max(...values, 0);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((value, i) => {
      const y = max > 0 ? height - 1 - (value / max) * (height - 2) : height - 1;
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="ml-auto h-4 w-16 text-(--chart-share-1)"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {values.length > 1 && (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
