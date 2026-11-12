import type { FilterNode } from '@mastra/core/storage/dashboards';

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

/**
 * Host context key the host sets to `true` when it can configure a widget. The settings button only
 * shows when the host sends it and supports `updateModelContext.structuredContent`.
 */
export const OBSERVABILITY_WIDGET_CONFIGURABLE_CONTEXT_KEY = 'mastra.ai/observability-widget-configurable';

/** `structuredContent` key of the model context update the app sends when the user opens a widget's settings. */
export const OBSERVABILITY_WIDGET_CONFIGURE_CONTEXT_KEY = 'mastra.ai/observability-widget-configure';

/** Host context key holding what the host's page draws the widgets over (`ObservabilityWidgetView`). */
export const OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY = 'mastra.ai/observability-widget-view';

/** A custom window, as ISO date strings. A missing `from` is 24h before `to`; a missing `to` is now. */
export type ObservabilityWidgetDateRange = { from?: string; to?: string };

/**
 * What the host's page draws the widgets over, e.g. the Metrics page's date range and filter bar.
 * Each field the host sets wins over the opening tool's result and the dashboard's `defaults`.
 */
export type ObservabilityWidgetView = {
  /** One of the presets, or `custom` to draw over `customRange`. */
  datePreset?: ObservabilityDatePreset | 'custom';
  /** The window drawn when `datePreset` is `custom`, as the Metrics page's custom range. */
  customRange?: ObservabilityWidgetDateRange;
  /** Replaces the dashboard's `defaults.filters`; only top-level chips filter, as on the Metrics page. */
  filters?: FilterNode[];
  /** Sent with every `queryObservability` call, so the server reads that project's data. */
  projectId?: string;
};

/** What the app sends under `OBSERVABILITY_WIDGET_PIN_CONTEXT_KEY`: the state the user asked for. */
export type ObservabilityWidgetPin = {
  pinned: boolean;
  /** The stored dashboard widget, as the opening tool returned it. */
  widget: { id: string; [key: string]: unknown };
  datePreset: string;
  /** The window the widget was drawn over, when `datePreset` is `custom`. */
  customRange?: ObservabilityWidgetDateRange;
  /** The filters the widget was drawn under (the host's, else the dashboard's `defaults.filters`), when any. */
  filters?: unknown[];
};

/** What the app sends under `OBSERVABILITY_WIDGET_CONFIGURE_CONTEXT_KEY`: the widget as the user sees it. */
export type ObservabilityWidgetConfigure = Omit<ObservabilityWidgetPin, 'pinned'>;
