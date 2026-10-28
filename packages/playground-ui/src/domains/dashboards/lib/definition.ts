import type {
  DashboardDefinition,
  DashboardDrilldown,
  DashboardDrilldownTarget,
  DashboardFilterNode,
  DashboardWidget,
  DashboardWidgetView,
} from '@mastra/client-js';
import type { DrilldownScope } from '../../metrics/drilldown';
import { isValidPreset } from '../../metrics/hooks/use-metrics';
import type { DatePreset } from '../../metrics/hooks/use-metrics';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

export type DashboardScope = 'org' | 'project';

/** Whether a widget, view or column tagged with `scope` shows at the page's scope. */
export const inScope = (item: { scope?: DashboardScope }, scope: DashboardScope) =>
  item.scope === undefined || item.scope === scope;

export type DashboardDrilldownPage = DashboardDrilldownTarget['page'];

/** Where a widget's button or a click leads; the page turns it into a URL. */
export type OnDashboardDrilldown = (page: DashboardDrilldownPage, scope: DrilldownScope) => void;

/** The view's drilldown over the widget's, target by target. */
export function viewDrilldown(widget: DashboardWidget, view: DashboardWidgetView): DashboardDrilldown {
  return { ...widget.drilldown, ...view.drilldown };
}

const SCOPE_FIELDS = new Set<string>([
  'rootEntityType',
  'entityName',
  'threadId',
  'resourceId',
  'environment',
  'sessionId',
  'userId',
  'model',
  'provider',
  'status',
  'projectId',
]);

/**
 * A target's filter chips as a drilldown scope. Only single-value chips on scope fields carry over;
 * nested groups have no scope equivalent.
 */
export function targetScope(target: DashboardDrilldownTarget): DrilldownScope {
  const scope: Record<string, string> = {};
  for (const node of target.filters ?? []) {
    if (!('fieldId' in node) || !SCOPE_FIELDS.has(node.fieldId)) continue;
    const value = Array.isArray(node.value) ? node.value[0] : node.value;
    if (value !== undefined) scope[node.fieldId] = value;
  }
  return scope;
}

const isToken = (node: DashboardFilterNode): node is Extract<DashboardFilterNode, { fieldId: string }> =>
  'fieldId' in node;

/**
 * The range and filters a page applies when its URL sets neither. The Metrics filter bar holds
 * chips, so only top-level chips carry over.
 */
export function dashboardDefaults(definition: Pick<DashboardDefinition, 'defaults'>): {
  preset?: DatePreset;
  filterTokens: PropertyFilterToken[];
} {
  const preset = definition.defaults?.datePreset;
  return {
    ...(isValidPreset(preset) ? { preset } : {}),
    filterTokens: (definition.defaults?.filters ?? [])
      .filter(isToken)
      .map(({ fieldId, value }) => ({ fieldId, value })),
  };
}
