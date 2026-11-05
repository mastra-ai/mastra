import { CHART_COLORS } from '../../metrics/lib/chart-colors';
import {
  formatAxisCount,
  formatAxisDuration,
  formatAxisUsd,
  formatCount,
  formatDuration,
  formatPercent,
  formatUsd,
} from '../../metrics/lib/chart-format';
import type { CHART_COLOR_NAMES, ValueFormat } from './values';

/** The formatters a format names: one for values and tooltips, a compact one for the y-axis. */
export const FORMATTERS: Record<ValueFormat, { value: (n: number) => string; axis?: (n: number) => string }> = {
  count: { value: formatCount, axis: formatAxisCount },
  usd: { value: formatUsd, axis: formatAxisUsd },
  duration: { value: formatDuration, axis: formatAxisDuration },
  percent: { value: formatPercent, axis: ratio => `${Math.round(ratio * 100)}%` },
  score: { value: score => score.toFixed(2), axis: score => String(+score.toFixed(2)) },
};

export const chartColor = (name: (typeof CHART_COLOR_NAMES)[number]) => CHART_COLORS[name];
