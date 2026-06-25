import type { ScatterPlotChartFormatter } from './scatter-plot-chart';
import { Colors } from '@/ds/tokens';

export function getScatterPlotPointColor(point: Record<string, unknown>, colorKey?: string) {
  const color = colorKey ? point[colorKey] : undefined;
  return typeof color === 'string' && color.length > 0 ? color : Colors.accent3;
}

export function getScatterPlotClickedPoint(payload: unknown) {
  return (payload as { payload?: Record<string, unknown> } | undefined)?.payload;
}

export function formatScatterPlotAxisTick(value: unknown, formatter?: ScatterPlotChartFormatter) {
  return (formatter?.(value, {}) ?? String(value)).replace(/\s+/g, '\u00A0');
}
