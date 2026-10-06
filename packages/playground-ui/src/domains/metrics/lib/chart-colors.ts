/**
 * Chart colors for the Metrics dashboard, from the chart tokens (tuned per theme).
 * Healthy volume is brand green; companions are sky and violet; only problems are warm.
 */
export const CHART_COLORS = {
  green: 'var(--chart-share-1)',
  sky: 'var(--chart-share-2)',
  violet: 'var(--chart-share-3)',
  warning: 'var(--chart-amber)',
  error: 'var(--chart-red)',
  /** A quiet series beside the main one (e.g. 3xx, P99). */
  neutral: 'var(--muted-foreground)',
} as const;
