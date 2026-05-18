import type { EntityType } from '@mastra/core/observability';
import {
  LOGS_DATE_FROM_PARAM,
  LOGS_DATE_PRESET_PARAM,
  LOGS_DATE_TO_PARAM,
  LOGS_PROPERTY_FILTER_PARAM_BY_FIELD,
  LOGS_ROOT_ENTITY_TYPE_PARAM,
} from '../logs/log-filters';
import type { LogsDatePreset } from '../logs/log-filters';
import {
  TRACE_DATE_FROM_PARAM,
  TRACE_DATE_PRESET_PARAM,
  TRACE_DATE_TO_PARAM,
  TRACE_LIST_MODE_PARAM,
  TRACE_PROPERTY_FILTER_PARAM_BY_FIELD,
  TRACE_ROOT_ENTITY_TYPE_PARAM,
  TRACE_STATUS_PARAM,
} from '../traces/trace-filters';
import type { TraceDatePreset } from '../traces/types';
import type { DatePreset, DateRange } from './hooks/use-metrics';
import type { MetricsDimensionalFilter } from './metrics-filters';

/** Map the metrics date preset (`24h`, `3d`, …) to the equivalent traces /
 *  logs preset (`last-24h`, `last-3d`, …). `'custom'` is passed through and
 *  explicit from/to dates are serialized separately. Returns `undefined` for
 *  presets we can't translate — in that case we omit the date preset and rely
 *  on concrete `from`/`to` timestamps. */
function mapPreset(preset: DatePreset): TraceDatePreset | LogsDatePreset | undefined {
  switch (preset) {
    case '24h':
      return 'last-24h';
    case '3d':
      return 'last-3d';
    case '7d':
      return 'last-7d';
    case '14d':
      return 'last-14d';
    case '30d':
      return 'last-30d';
    case 'custom':
      return 'custom';
    default:
      return undefined;
  }
}

/** Narrow time window for a single chart node. Callers pass concrete start/end
 *  Dates (typically bucket boundaries); these bypass the preset. */
export type DrilldownWindow = {
  from: Date;
  to: Date;
};

/** Narrow a raw timestamp into the time-series bucket window that surrounds
 *  it. For a chart with `interval = 1h`, clicking a node at 14:37Z drills into
 *  14:00Z → 15:00Z. For `1d`, the corresponding UTC day. */
export function narrowWindowToBucket(tsMs: number, interval: '1h' | '1d'): DrilldownWindow {
  if (interval === '1h') {
    const from = new Date(tsMs);
    from.setUTCMinutes(0, 0, 0);
    const to = new Date(from.getTime() + 60 * 60 * 1000);
    return { from, to };
  }
  const from = new Date(tsMs);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Fields a card may use to scope the drilldown. Only the pieces the caller
 *  knows are attached; everything else falls through to the current dashboard
 *  filters. `status` is only valid for traces. */
export type DrilldownScope = {
  rootEntityType?: EntityType;
  entityName?: string;
  threadId?: string;
  resourceId?: string;
  model?: string;
  provider?: string;
  /** Trace-only. Valid for drill-downs from "errors" segments. */
  status?: 'running' | 'success' | 'error';
  /** Overrides date preset with explicit window bounds. */
  window?: DrilldownWindow;
};

type BuildArgs = {
  /** Current metrics dashboard preset. */
  preset: DatePreset;
  /** Current metrics dashboard custom range (only honoured when preset === 'custom'). */
  customRange?: DateRange;
  /** Dashboard-level dimensional filters (environment, serviceName, tags, etc.). */
  dashboardFilter: MetricsDimensionalFilter;
  /** Per-card scoping applied on top of dashboard filters. */
  scope: DrilldownScope;
  /** Override the Traces page base path. Defaults to `/observability` (mastra Studio). */
  tracesBasePath?: string;
  /** Override the Logs page base path. Defaults to `/logs` (mastra Studio). */
  logsBasePath?: string;
};

function applyDate(
  params: URLSearchParams,
  presetKey: string,
  fromKey: string,
  toKey: string,
  preset: DatePreset,
  customRange: DateRange | undefined,
  window: DrilldownWindow | undefined,
): void {
  // A concrete window always wins — it's a precise node-level drilldown.
  if (window) {
    params.set(presetKey, 'custom');
    params.set(fromKey, window.from.toISOString());
    params.set(toKey, window.to.toISOString());
    return;
  }
  if (preset === 'custom') {
    params.set(presetKey, 'custom');
    if (customRange?.from) params.set(fromKey, customRange.from.toISOString());
    if (customRange?.to) params.set(toKey, customRange.to.toISOString());
    return;
  }
  const mapped = mapPreset(preset);
  if (mapped) params.set(presetKey, mapped);
}

function setIfDefined(params: URLSearchParams, key: string, value: string | undefined | null): void {
  if (typeof value === 'string' && value.length > 0) {
    params.set(key, value);
  }
}

function appendArray(params: URLSearchParams, key: string, values: string[] | undefined): void {
  if (!Array.isArray(values) || values.length === 0) return;
  for (const v of values) if (v) params.append(key, v);
}

/** Build a relative URL to the Traces page pre-filtered by the dashboard
 *  filters + per-card scope. */
export function buildTracesDrilldownUrl({
  preset,
  customRange,
  dashboardFilter,
  scope,
  tracesBasePath = '/observability',
}: BuildArgs): string {
  const params = new URLSearchParams();
  params.set(TRACE_LIST_MODE_PARAM, 'branches');

  applyDate(
    params,
    TRACE_DATE_PRESET_PARAM,
    TRACE_DATE_FROM_PARAM,
    TRACE_DATE_TO_PARAM,
    preset,
    customRange,
    scope.window,
  );

  // Scope overrides dashboard filter when both are present.
  const rootEntityType = scope.rootEntityType ?? dashboardFilter.rootEntityType;
  if (rootEntityType) params.set(TRACE_ROOT_ENTITY_TYPE_PARAM, rootEntityType);

  if (scope.status) params.set(TRACE_STATUS_PARAM, scope.status);

  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.entityName, scope.entityName ?? dashboardFilter.entityName);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.threadId, scope.threadId ?? dashboardFilter.threadId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.resourceId, scope.resourceId ?? dashboardFilter.resourceId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.entityId, dashboardFilter.entityId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.runId, dashboardFilter.runId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.sessionId, dashboardFilter.sessionId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.requestId, dashboardFilter.requestId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.userId, dashboardFilter.userId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.organizationId, dashboardFilter.organizationId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.experimentId, dashboardFilter.experimentId);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.serviceName, dashboardFilter.serviceName);
  setIfDefined(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.environment, dashboardFilter.environment);
  appendArray(params, TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.tags, dashboardFilter.tags);

  const query = params.toString();
  return query ? `${tracesBasePath}?${query}` : tracesBasePath;
}

/** Build a relative URL to the Logs page pre-filtered by the dashboard filters
 *  + per-card scope. Useful for "View errors in logs" affordances. */
export function buildLogsDrilldownUrl({
  preset,
  customRange,
  dashboardFilter,
  scope,
  logsBasePath = '/logs',
}: BuildArgs): string {
  const params = new URLSearchParams();

  applyDate(
    params,
    LOGS_DATE_PRESET_PARAM,
    LOGS_DATE_FROM_PARAM,
    LOGS_DATE_TO_PARAM,
    preset,
    customRange,
    scope.window,
  );

  const rootEntityType = scope.rootEntityType ?? dashboardFilter.rootEntityType;
  if (rootEntityType) params.set(LOGS_ROOT_ENTITY_TYPE_PARAM, rootEntityType);

  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.entityName, scope.entityName ?? dashboardFilter.entityName);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.threadId, scope.threadId ?? dashboardFilter.threadId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.resourceId, scope.resourceId ?? dashboardFilter.resourceId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.runId, dashboardFilter.runId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.sessionId, dashboardFilter.sessionId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.requestId, dashboardFilter.requestId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.userId, dashboardFilter.userId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.organizationId, dashboardFilter.organizationId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.experimentId, dashboardFilter.experimentId);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.serviceName, dashboardFilter.serviceName);
  setIfDefined(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.environment, dashboardFilter.environment);
  appendArray(params, LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.tags, dashboardFilter.tags);

  // Error drill-ins always target log level=error. Status filter isn't valid
  // for logs, so we translate `status: 'error'` to `filterLevel=error`.
  if (scope.status === 'error') {
    params.append(LOGS_PROPERTY_FILTER_PARAM_BY_FIELD.level, 'error');
  }

  const query = params.toString();
  return query ? `${logsBasePath}?${query}` : logsBasePath;
}
