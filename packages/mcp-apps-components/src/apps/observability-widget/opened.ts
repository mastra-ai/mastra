import { dashboardDefinitionSchema } from '@mastra/core/storage/dashboards';
import type { DashboardDefinition } from '@mastra/core/storage/dashboards';
import { dashboardDefaults } from '@mastra/playground-ui/domains/dashboards';
import type { AggregateGateInput, DashboardEnvironment } from '@mastra/playground-ui/domains/dashboards';
import { buildSpanAggregateWhere } from '@mastra/playground-ui/domains/metrics/lib/span-aggregate';
import { buildTraceAggregateWhere } from '@mastra/playground-ui/domains/metrics/lib/trace-aggregate';
import { buildMetricsDimensionalFilter } from '@mastra/playground-ui/domains/metrics/metrics-filters';
import type { MetricsDimensionalFilter } from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { z } from 'zod';
import { OBSERVABILITY_DATE_PRESETS } from './tool';
import type { ObservabilityDatePreset } from './tool';

const HOUR_MS = 60 * 60 * 1000;

const PRESET_HOURS: Record<ObservabilityDatePreset, number> = {
  '24h': 24,
  '3d': 72,
  '7d': 168,
  '14d': 336,
  '30d': 720,
};

const isPreset = (value: unknown): value is ObservabilityDatePreset =>
  (OBSERVABILITY_DATE_PRESETS as readonly unknown[]).includes(value);

/** What the opening tool returns as `structuredContent`: a stored dashboard and, optionally, its window. */
const openedSchema = z.object({
  dashboard: z.unknown(),
  datePreset: z.enum(OBSERVABILITY_DATE_PRESETS).optional(),
});

export type Opened =
  | { status: 'ready'; dashboard: DashboardDefinition; datePreset: ObservabilityDatePreset; env: DashboardEnvironment }
  | { status: 'error'; message: string };

const gate = <Where>(
  built: { supported: true; where: Where | undefined } | { supported: false; unsupportedFields: string[] },
): AggregateGateInput<Where> =>
  built.supported
    ? { status: 'ready', ...(built.where ? { where: built.where } : {}) }
    : { status: 'unsupported-filter', unsupportedFields: built.unsupportedFields };

/**
 * The window, filters and gates the dashboard is drawn over, frozen at `now`. `filter` applies to
 * every widget, as the Metrics page's filter bar does; trace and span aggregates it can't express
 * say so on their widget.
 */
export function environment(
  preset: ObservabilityDatePreset,
  now: number,
  filter: MetricsDimensionalFilter = {},
): DashboardEnvironment {
  const window = { start: new Date(now - PRESET_HOURS[preset] * HOUR_MS), end: new Date(now) };
  return {
    window,
    filters: { ...filter, timestamp: window },
    comparisonLabel: `vs previous ${preset}`,
    // The server decides the rest: aggregates it can't answer fail on the widget itself.
    gates: { trace: gate(buildTraceAggregateWhere(filter)), span: gate(buildSpanAggregateWhere(filter)) },
  };
}

/**
 * Reads the opening tool's result; a bad one becomes a message rather than a broken app. The window
 * is the result's `datePreset`, else the dashboard's `defaults.datePreset` when it is one the widget
 * shows, else `24h`. The dashboard's top-level `defaults.filters` chips filter every widget.
 */
export function readOpened(structuredContent: unknown, now: number): Opened {
  const opened = openedSchema.safeParse(structuredContent);
  if (!opened.success || opened.data.dashboard === undefined) {
    return { status: 'error', message: 'The tool returned no dashboard to show.' };
  }
  const dashboard = dashboardDefinitionSchema.safeParse(opened.data.dashboard);
  if (!dashboard.success) {
    return { status: 'error', message: `The dashboard is invalid: ${z.prettifyError(dashboard.error)}` };
  }
  const defaults = dashboardDefaults(dashboard.data);
  const datePreset = opened.data.datePreset ?? (isPreset(defaults.preset) ? defaults.preset : '24h');
  const filter = buildMetricsDimensionalFilter(defaults.filterTokens);
  return { status: 'ready', dashboard: dashboard.data, datePreset, env: environment(datePreset, now, filter) };
}
