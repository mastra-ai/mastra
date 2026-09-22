import type { ScatterPlotChartFormatter } from './scatter-plot-chart';
import { ChartTooltip } from '@/ds/components/ChartTooltip';

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
    <ChartTooltip>
      {label !== undefined && <p className="mb-1 text-column text-foreground">{String(label)}</p>}
      <div className="grid gap-1 text-placeholder">
        <p>
          <span className="text-muted-foreground">X:</span>{' '}
          <span className="font-mono">{formatX ? formatX(xValue, point) : String(xValue)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Y:</span>{' '}
          <span className="font-mono">{formatY ? formatY(yValue, point) : String(yValue)}</span>
        </p>
      </div>
    </ChartTooltip>
  );
}
