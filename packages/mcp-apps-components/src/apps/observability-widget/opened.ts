import { dashboardDefinitionSchema, dashboardDefaultsSchema } from '@mastra/core/storage/dashboards';
import type { DashboardDefinition, FilterNode } from '@mastra/core/storage/dashboards';
import { dashboardDefaults } from '@mastra/playground-ui/domains/dashboards';
import type { AggregateGateInput, DashboardEnvironment } from '@mastra/playground-ui/domains/dashboards';
import { buildSpanAggregateWhere } from '@mastra/playground-ui/domains/metrics/lib/span-aggregate';
import { buildTraceAggregateWhere } from '@mastra/playground-ui/domains/metrics/lib/trace-aggregate';
import { buildMetricsDimensionalFilter } from '@mastra/playground-ui/domains/metrics/metrics-filters';
import type { MetricsDimensionalFilter } from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { z } from 'zod';
import { OBSERVABILITY_DATE_PRESETS } from './tool';
import type { ObservabilityDatePreset, ObservabilityWidgetDateRange, ObservabilityWidgetView } from './tool';

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
  | {
      status: 'ready';
      dashboard: DashboardDefinition;
      datePreset: ObservabilityDatePreset | 'custom';
      /** The host's custom window, when `datePreset` is `custom`. */
      customRange: ObservabilityWidgetDateRange | undefined;
      /** The filters the widgets are drawn under: the host's, else the dashboard's `defaults.filters`. */
      filters: FilterNode[] | undefined;
      projectId: string | undefined;
      env: DashboardEnvironment;
    }
  | { status: 'error'; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The date as an ISO string, or `undefined` when it isn't one. */
const isoDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

/** The host's view, or what's wrong with it. */
export type HostView = { status: 'ok'; view: ObservabilityWidgetView } | { status: 'error'; message: string };

const hostError = (message: string): HostView => ({ status: 'error', message });

function readRange(value: unknown): ObservabilityWidgetDateRange | string {
  if (value === undefined) return {};
  if (!isRecord(value)) return "The host page sent a custom date range that isn't one.";
  const from = isoDate(value.from);
  const to = isoDate(value.to);
  if ((value.from !== undefined && !from) || (value.to !== undefined && !to)) {
    return 'The host page sent a custom date range with an invalid date.';
  }
  if (from && to && from > to) return 'The host page sent a custom date range that ends before it starts.';
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

/**
 * The host's `OBSERVABILITY_WIDGET_VIEW_CONTEXT_KEY` value. It comes over the wire, so a field that
 * is set but invalid fails the dashboard: drawing over anything else would show data the host page
 * didn't ask for.
 */
export function readView(value: unknown): HostView {
  if (value === undefined) return { status: 'ok', view: {} };
  if (!isRecord(value)) return hostError("The host page sent a view that isn't one.");
  const { datePreset, projectId } = value;
  if (datePreset !== undefined && !isPreset(datePreset) && datePreset !== 'custom') {
    return hostError(`The host page sent an unknown date preset: ${JSON.stringify(datePreset)}.`);
  }
  if (projectId !== undefined && (typeof projectId !== 'string' || !projectId)) {
    return hostError("The host page sent a project that isn't an id.");
  }
  const filters =
    value.filters === undefined ? undefined : dashboardDefaultsSchema.safeParse({ filters: value.filters });
  if (filters && !filters.success) {
    return hostError(`The host page's filters are invalid: ${z.prettifyError(filters.error)}`);
  }
  const customRange = datePreset === 'custom' ? readRange(value.customRange) : undefined;
  if (typeof customRange === 'string') return hostError(customRange);
  return {
    status: 'ok',
    view: {
      ...(datePreset ? { datePreset } : {}),
      ...(customRange ? { customRange } : {}),
      ...(filters?.data.filters ? { filters: filters.data.filters } : {}),
      ...(projectId ? { projectId } : {}),
    },
  };
}

const gate = <Where>(
  built: { supported: true; where: Where | undefined } | { supported: false; unsupportedFields: string[] },
): AggregateGateInput<Where> =>
  built.supported
    ? { status: 'ready', ...(built.where ? { where: built.where } : {}) }
    : { status: 'unsupported-filter', unsupportedFields: built.unsupportedFields };

/** The window as the Metrics page draws it: a preset ends at `now`; a custom range defaults to the last 24h. */
function windowOf(preset: ObservabilityDatePreset | 'custom', now: number, range: ObservabilityWidgetDateRange = {}) {
  if (preset !== 'custom') return { start: new Date(now - PRESET_HOURS[preset] * HOUR_MS), end: new Date(now) };
  return {
    start: range.from ? new Date(range.from) : new Date(now - 24 * HOUR_MS),
    end: range.to ? new Date(range.to) : new Date(now),
  };
}

/** Same wording as the Metrics page: `vs previous 7d`, or the custom window's length. */
function comparisonLabel(preset: ObservabilityDatePreset | 'custom', window: { start: Date; end: Date }) {
  if (preset !== 'custom') return `vs previous ${preset}`;
  const hours = Math.round((window.end.getTime() - window.start.getTime()) / HOUR_MS);
  return `vs previous ${hours > 24 && hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`}`;
}

/**
 * The window, filters and gates the dashboard is drawn over, frozen at `now`. `filter` applies to
 * every widget, as the Metrics page's filter bar does; trace and span aggregates it can't express
 * say so on their widget.
 */
export function environment(
  preset: ObservabilityDatePreset | 'custom',
  now: number,
  filter: MetricsDimensionalFilter = {},
  range?: ObservabilityWidgetDateRange,
): DashboardEnvironment {
  const window = windowOf(preset, now, range);
  return {
    window,
    filters: { ...filter, timestamp: window },
    comparisonLabel: comparisonLabel(preset, window),
    // The server decides the rest: aggregates it can't answer fail on the widget itself.
    gates: { trace: gate(buildTraceAggregateWhere(filter)), span: gate(buildSpanAggregateWhere(filter)) },
  };
}

/**
 * Reads the opening tool's result; a bad one becomes a message rather than a broken app. The window
 * is the host's `datePreset` (with its `customRange` when `custom`), else the result's, else the dashboard's `defaults.datePreset` when it
 * is one the widget shows, else `24h`. The host's `filters`, else the dashboard's top-level
 * `defaults.filters` chips, filter every widget.
 */
export function readOpened(
  structuredContent: unknown,
  now: number,
  host: HostView = { status: 'ok', view: {} },
): Opened {
  if (host.status === 'error') return host;
  const { view } = host;
  const opened = openedSchema.safeParse(structuredContent);
  if (!opened.success || opened.data.dashboard === undefined) {
    return { status: 'error', message: 'The tool returned no dashboard to show.' };
  }
  const dashboard = dashboardDefinitionSchema.safeParse(opened.data.dashboard);
  if (!dashboard.success) {
    return { status: 'error', message: `The dashboard is invalid: ${z.prettifyError(dashboard.error)}` };
  }
  const filters = view.filters ?? dashboard.data.defaults?.filters;
  const defaults = dashboardDefaults({ defaults: { datePreset: dashboard.data.defaults?.datePreset, filters } });
  const datePreset = view.datePreset ?? opened.data.datePreset ?? (isPreset(defaults.preset) ? defaults.preset : '24h');
  const customRange = datePreset === 'custom' ? view.customRange : undefined;
  const filter = buildMetricsDimensionalFilter(defaults.filterTokens);
  return {
    status: 'ready',
    dashboard: dashboard.data,
    datePreset,
    customRange,
    filters,
    projectId: view.projectId,
    env: environment(datePreset, now, filter, customRange),
  };
}
