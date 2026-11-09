import greetingHtml from '../apps-dist/greeting.html?raw';
import observabilityWidgetHtml from '../apps-dist/observability-widget.html?raw';

export {
  OBSERVABILITY_DATE_PRESETS,
  OBSERVABILITY_READ_ACTIONS,
  QUERY_OBSERVABILITY_TOOL,
} from './apps/observability-widget/tool';
export type { ObservabilityDatePreset, ObservabilityReadAction } from './apps/observability-widget/tool';
export {
  OBSERVABILITY_CATALOG_MAX_METRIC_NAMES,
  createObservabilityDashboardInputSchema,
  createObservabilityDraftSchemas,
  observabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
  toObservabilityDashboard,
  toObservabilityWidget,
} from './observability-dashboard';
export type {
  ObservabilityCatalog,
  ObservabilityDashboardDraft,
  ObservabilityDashboardInput,
  ObservabilityDashboardOpened,
  ObservabilityDraftOptions,
  ObservabilityDraftSchemas,
  ObservabilityWidgetDraft,
} from './observability-dashboard';

/** An MCP App resource: register it under a `ui://` URI in `MCPServer`'s `appResources`. */
export interface McpAppResource {
  name: string;
  description: string;
  html: string;
}

/**
 * Greets the `name` argument of the tool that opens it, fetching the greeting from the server's
 * app-only `getGreeting` tool, and lets the user post a reply to the conversation.
 */
export const greetingApp: McpAppResource = {
  name: 'Greeting',
  description: 'Greets someone by name',
  html: greetingHtml,
};

/**
 * Draws a Studio dashboard. The tool that opens it returns `{ dashboard, datePreset? }` as
 * structured content, where `dashboard` passes `dashboardDefinitionSchema` (build it with
 * `toObservabilityDashboard`); the app reads every metric, score and aggregate through the server's
 * app-only `queryObservability` tool (`{ action, args }` in, where `action` is one of
 * `OBSERVABILITY_READ_ACTIONS`, and `{ data }` out).
 */
export const observabilityDashboardApp: McpAppResource = {
  name: 'Observability dashboard',
  description: 'Draws an observability dashboard',
  html: observabilityWidgetHtml,
};
