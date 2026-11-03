import type { OnDashboardDrilldown } from '@mastra/playground-ui/domains/dashboards';

type DrilldownPage = Parameters<OnDashboardDrilldown>[0];
type DrilldownScope = Parameters<OnDashboardDrilldown>[1];

function describeScope({ window, span, ...fields }: DrilldownScope): string[] {
  const parts = Object.entries(fields).flatMap(([key, value]) =>
    typeof value === 'string' && value ? [`${key} "${value}"`] : [],
  );
  if (span) {
    parts.push(`${span.status === 'error' ? 'failed ' : ''}${span.spanTypes.join('/')} spans of "${span.entityName}"`);
  }
  if (window) parts.push(`from ${window.from.toISOString()} to ${window.to.toISOString()}`);
  return parts;
}

/**
 * The chat message a drilldown sends to the host, so the conversation can carry on from the
 * data the user clicked instead of opening a page the host doesn't have.
 */
export function drilldownMessage(page: DrilldownPage, scope: DrilldownScope, preset: string): string {
  const parts = describeScope(scope);
  if (!scope.window) parts.push(`over the last ${preset}`);
  return `Show me the ${page} for ${parts.join(', ')}.`;
}
