const SPARKLINE_WIDTH = 100;
const SPARKLINE_HEIGHT = 20;

export function ThemeCompareSparkline({
  series,
  positions,
  markerIndexes,
}: {
  series: Array<number | undefined>;
  positions: number[];
  markerIndexes: number[];
}) {
  const loaded = series.flatMap((share, index) => (share === undefined ? [] : [{ share, index }]));
  if (loaded.length < 2) return null;

  const maxShare = Math.max(...loaded.map(point => point.share), 0.01);
  const pointFor = (point: { share: number; index: number }) => ({
    x: ((positions[point.index] ?? 0) / 100) * SPARKLINE_WIDTH,
    y: SPARKLINE_HEIGHT - 2 - (point.share / maxShare) * (SPARKLINE_HEIGHT - 4),
  });
  const segments: Array<Array<{ share: number; index: number }>> = [];
  for (const point of loaded) {
    const currentSegment = segments.at(-1);
    const previousPoint = currentSegment?.at(-1);
    if (!currentSegment || !previousPoint || point.index !== previousPoint.index + 1) {
      segments.push([point]);
    } else {
      currentSegment.push(point);
    }
  }
  const polylines = segments
    .filter(segment => segment.length > 1)
    .map(segment => segment.map(point => `${pointFor(point).x.toFixed(1)},${pointFor(point).y.toFixed(1)}`).join(' '));
  const markers = markerIndexes.flatMap(markerIndex => {
    const point = loaded.find(candidate => candidate.index === markerIndex);
    return point ? [point] : [];
  });

  return (
    <div aria-hidden="true" className="relative mt-1.5 h-5 w-full">
      <svg
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      >
        {polylines.map(points => (
          <polyline
            key={points}
            className="stroke-neutral3 fill-none"
            points={points}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {markers.map(point => (
        <span
          key={point.index}
          className="absolute size-2 -translate-1/2 rounded-full bg-green-400"
          style={{ left: `${positions[point.index]}%`, top: `${pointFor(point).y}px` }}
        />
      ))}
    </div>
  );
}
