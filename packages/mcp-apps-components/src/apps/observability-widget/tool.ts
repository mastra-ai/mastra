/** The app-only tool the observability widget calls, on the server that opened it, for every read. */
export const QUERY_OBSERVABILITY_TOOL = 'queryObservability';

/**
 * Every `MastraClient` method the app sends as a `queryObservability` action. All are reads; allow
 * these and nothing else (`z.enum(OBSERVABILITY_READ_ACTIONS)`).
 */
export const OBSERVABILITY_READ_ACTIONS = [
  'aggregateTraces',
  'aggregateSpans',
  'getMetricAggregate',
  'getMetricBreakdown',
  'getMetricTimeSeries',
  'getMetricPercentiles',
  'getScoreAggregate',
  'getScoreBreakdown',
  'getScoreTimeSeries',
  'getScorePercentiles',
  'listScores',
] as const;

export type ObservabilityReadAction = (typeof OBSERVABILITY_READ_ACTIONS)[number];

/** The windows the widget can show, ending when it opens; the same presets as Studio's metrics. */
export const OBSERVABILITY_DATE_PRESETS = ['24h', '3d', '7d', '14d', '30d'] as const;

export type ObservabilityDatePreset = (typeof OBSERVABILITY_DATE_PRESETS)[number];

/**
 * Host context key holding the ids of the widgets the host has pinned (`string[]`). The pin button
 * only shows when the host sends it and supports `updateModelContext.structuredContent`.
 */
export const OBSERVABILITY_WIDGET_PINNED_CONTEXT_KEY = 'mastra.ai/observability-widget-pinned';

/** `structuredContent` key of the model context update the app sends when the user (un)pins. */
export const OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY = 'mastra.ai/observability-widget-pin';

/** What the app sends under `OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY`: the state the user asked for. */
export type ObservabilityWidgetPin = {
  pinned: boolean;
  /** The stored dashboard widget, as the opening tool returned it. */
  widget: { id: string; [key: string]: unknown };
  datePreset: string;
  /** The dashboard's `defaults.filters` the widget was drawn under, when it has any. */
  filters?: unknown[];
};
