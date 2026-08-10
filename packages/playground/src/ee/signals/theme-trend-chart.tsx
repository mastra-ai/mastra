import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';

import { formatSnapshotDate, traceLabel } from './signal-formatting';
import type { ThemeHistoryPoint } from './theme-trend-data';

const TREND_CHART_HEIGHT = 32;

function trendPointLabel(point: ThemeHistoryPoint) {
  return `${formatSnapshotDate(point.startedAt)} · ${traceLabel(point.traceCount)} (${Math.round(point.coverage * 100)}%)`;
}

/** Trace count over time for one theme, with absent stretches dropping to the baseline. */
export function ThemeTrendChart({ points, color }: { points: ThemeHistoryPoint[]; color: string }) {
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  if (!firstPoint || !lastPoint) return null;

  const firstTime = new Date(firstPoint.startedAt).getTime();
  const lastTime = new Date(lastPoint.startedAt).getTime();
  const timeSpan = lastTime - firstTime;
  const maxCount = Math.max(1, ...points.map(point => point.traceCount));
  const x = (point: ThemeHistoryPoint) =>
    timeSpan === 0 ? 50 : ((new Date(point.startedAt).getTime() - firstTime) / timeSpan) * 100;
  const y = (point: ThemeHistoryPoint) => (1 - point.traceCount / maxCount) * (TREND_CHART_HEIGHT - 4) + 2;
  const coordinates = points.map(point => `${x(point)},${y(point)}`);

  return (
    <div className="mt-3">
      <div className="relative h-8" data-testid="trend-chart">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full"
          preserveAspectRatio="none"
          viewBox={`0 0 100 ${TREND_CHART_HEIGHT}`}
        >
          <polygon
            fill={color}
            fillOpacity={0.14}
            points={[`0,${TREND_CHART_HEIGHT}`, ...coordinates, `100,${TREND_CHART_HEIGHT}`].join(' ')}
          />
          <polyline
            fill="none"
            stroke={color}
            strokeOpacity={0.7}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
            points={coordinates.join(' ')}
          />
        </svg>
        {points.map(point => {
          const label = trendPointLabel(point);
          return (
            <Tooltip key={point.snapshotId}>
              <TooltipTrigger
                aria-label={label}
                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 cursor-default rounded-full hover:brightness-125"
                style={{
                  left: `${x(point)}%`,
                  top: `${(y(point) / TREND_CHART_HEIGHT) * 100}%`,
                  backgroundColor: color,
                }}
              />
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="text-neutral3 mt-1 flex justify-between font-mono text-[11px]">
        <span>{formatSnapshotDate(firstPoint.startedAt)}</span>
        <span>{formatSnapshotDate(lastPoint.startedAt)}</span>
      </div>
    </div>
  );
}
