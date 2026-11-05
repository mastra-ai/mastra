/** The app-only tool the observability widget calls, on the server that opened it, for every read. */
export const QUERY_OBSERVABILITY_TOOL = 'queryObservability';

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
};
