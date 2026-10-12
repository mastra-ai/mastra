const HEIGHT = 24;
const BAR_GAP = 0.2;
const MIN_ERROR_HEIGHT = 4;

export function RunStrip({
  runsPerBucket,
  errorsPerBucket,
  label,
}: {
  runsPerBucket: number[];
  errorsPerBucket: number[];
  label: string;
}) {
  const peak = Math.max(1, ...runsPerBucket);
  const slot = 100 / Math.max(runsPerBucket.length, 1);
  const barWidth = slot * (1 - BAR_GAP);
  const heightOf = (count: number) => (count / peak) * HEIGHT;

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" className="h-6 w-full">
      {runsPerBucket.map((runs, index) => {
        const x = index * slot;
        const errors = Math.min(errorsPerBucket[index] ?? 0, runs);
        if (runs === 0) {
          return (
            <rect
              key={index}
              x={x}
              y={HEIGHT - 1}
              width={barWidth}
              height={1}
              fill="currentColor"
              className="text-border-strong"
            />
          );
        }
        const runsHeight = heightOf(runs);
        const errorsHeight = errors > 0 ? Math.min(Math.max(heightOf(errors), MIN_ERROR_HEIGHT), runsHeight) : 0;
        return (
          <g key={index}>
            <rect
              x={x}
              y={HEIGHT - runsHeight}
              width={barWidth}
              height={runsHeight - errorsHeight}
              fill="currentColor"
              className="text-chart-blue"
            />
            {errors > 0 && (
              <rect
                x={x}
                y={HEIGHT - errorsHeight}
                width={barWidth}
                height={errorsHeight}
                fill="currentColor"
                className="text-destructive-indicator"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
