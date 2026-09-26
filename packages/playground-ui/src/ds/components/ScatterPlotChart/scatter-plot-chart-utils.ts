import type { ScatterPlotChartFormatter } from './scatter-plot-chart';

export function getScatterPlotPointColor(point: Record<string, unknown>, colorKey?: string) {
  const color = colorKey ? point[colorKey] : undefined;
  return typeof color === 'string' && color.length > 0 ? color : 'var(--chart-1)';
}

export function getScatterPlotClickedPoint(payload: unknown) {
  return (payload as { payload?: Record<string, unknown> } | undefined)?.payload;
}

export function formatScatterPlotAxisTick(value: unknown, formatter?: ScatterPlotChartFormatter) {
  return (formatter?.(value, {}) ?? String(value)).replace(/\s+/g, '\u00A0');
}
