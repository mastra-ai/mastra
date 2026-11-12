/**
 * Chart colors for the Metrics dashboard, from the chart tokens (tuned per theme).
 * Healthy volume is brand green; companions are sky, violet, teal and indigo; only problems are warm.
 * The plain hues (blue to purple) are for dashboards that pick their own colors.
 */
export const CHART_COLORS = {
  green: 'var(--chart-share-1)',
  sky: 'var(--chart-share-2)',
  violet: 'var(--chart-share-3)',
  teal: 'var(--chart-share-4)',
  indigo: 'var(--chart-share-5)',
  warning: 'var(--chart-amber)',
  error: 'var(--chart-red)',
  /** A quiet series beside the main one (e.g. 3xx, P99). */
  neutral: 'var(--muted-foreground)',
  blue: 'var(--chart-blue)',
  orange: 'var(--chart-orange)',
  pink: 'var(--chart-pink)',
  /** The series amber, so it stays apart from `warning`. */
  yellow: 'var(--chart-series-amber)',
  red: 'var(--chart-red)',
  purple: 'var(--chart-purple)',
} as const;
