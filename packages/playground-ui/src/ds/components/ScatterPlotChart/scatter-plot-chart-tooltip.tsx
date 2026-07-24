import type { ScatterPlotChartFormatter } from './scatter-plot-chart';

type ScatterTooltipPayload = Array<{
  color?: string;
  payload?: Record<string, unknown>;
}>;

export function ScatterPlotChartTooltip({
  active,
  payload,
  xKey,
  yKey,
  nameKey,
  formatX,
  formatY,
  formatTooltipLabel,
}: {
  active?: boolean;
  payload?: ScatterTooltipPayload;
  xKey: string;
  yKey: string;
  nameKey?: string;
  formatX?: ScatterPlotChartFormatter;
  formatY?: ScatterPlotChartFormatter;
  formatTooltipLabel?: (point: Record<string, unknown>) => string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const label = formatTooltipLabel?.(point) ?? (nameKey ? point[nameKey] : undefined);
  const xValue = point[xKey];
  const yValue = point[yKey];

  return (
    <div className="rounded-md border border-border1 bg-surface2 px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="text-icon6 mb-1 font-medium">{String(label)}</p>}
      <div className="text-icon2 grid gap-1">
        <p>
          <span className="text-neutral3">X:</span>{' '}
          <span className="font-mono">{formatX ? formatX(xValue, point) : String(xValue)}</span>
        </p>
        <p>
          <span className="text-neutral3">Y:</span>{' '}
          <span className="font-mono">{formatY ? formatY(yValue, point) : String(yValue)}</span>
        </p>
      </div>
    </div>
  );
}
