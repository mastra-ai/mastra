import { EntityType } from '@mastra/core/observability';
import type { LatencyMetricsData, LatencyPoint, MetricsInterval } from '@mastra/react/hooks/metrics';

import { narrowWindowToBucket } from '../../drilldown';
import type { DrilldownScope } from '../../drilldown';

export type LatencyTab = 'agents' | 'workflows' | 'tools';

/**
 * Pure helpers behind the latency card. Kept apart from the component because
 * everything here is reached through recharts callbacks and legend rendering,
 * which lay out nothing under jsdom.
 */

export function isLatencyTab(value: string): value is LatencyTab {
  return value === 'agents' || value === 'workflows' || value === 'tools';
}

/**
 * Averages one percentile over the charted points, rounded to whole milliseconds.
 * The chart hands its aggregate untyped rows, so a bucket missing the percentile
 * counts as zero rather than turning the whole average into `NaN` on screen.
 */
export function averageLatency(data: Record<string, unknown>[], key: 'p50' | 'p95'): string {
  if (data.length === 0) return '0';
  const total = data.reduce((sum, point) => {
    const value = point[key];
    return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0);
  return `${Math.round(total / data.length)}`;
}

/**
 * A chart node only stands for a moment in time when recharts hands back a
 * payload carrying a usable timestamp — anything else must not drill down.
 */
export function isDrillablePoint(point: unknown): point is LatencyPoint {
  if (typeof point !== 'object' || point === null || !('tsMs' in point)) return false;
  return typeof point.tsMs === 'number' && Number.isFinite(point.tsMs);
}

const TAB_TO_ROOT_ENTITY: Record<LatencyTab, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

/** Drilldown scope for the "View in Traces" action of the active tab. */
export function latencyTracesScope(tab: LatencyTab): DrilldownScope {
  return { rootEntityType: TAB_TO_ROOT_ENTITY[tab] };
}

/** Drilldown scope for a clicked chart bucket: the tab entity type, narrowed to the bucket window. */
export function latencyBucketScope(tab: LatencyTab, tsMs: number, interval: MetricsInterval): DrilldownScope {
  return { rootEntityType: TAB_TO_ROOT_ENTITY[tab], window: narrowWindowToBucket(tsMs, interval) };
}

/** Keeps the selected tab while it has data, otherwise falls back to the first tab that does. */
export function resolveActiveTab(data: LatencyMetricsData, selected: LatencyTab): LatencyTab {
  const hasData: Record<LatencyTab, boolean> = {
    agents: data.agentData.length > 0,
    workflows: data.workflowData.length > 0,
    tools: data.toolData.length > 0,
  };
  if (hasData[selected]) return selected;
  if (hasData.agents) return 'agents';
  if (hasData.workflows) return 'workflows';
  if (hasData.tools) return 'tools';
  return 'agents';
}
