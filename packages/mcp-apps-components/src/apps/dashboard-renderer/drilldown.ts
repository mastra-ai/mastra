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
 * The chat message a drilldown sends to hosts that can't take model context, so the
 * conversation can carry on from the data the user clicked instead of opening a page the host
 * doesn't have.
 */
export function drilldownMessage(page: DrilldownPage, scope: DrilldownScope, preset: string): string {
  return `Show me ${describeSelection(page, scope, preset)}.`;
}

function describeSelection(page: DrilldownPage, scope: DrilldownScope, preset: string): string {
  const parts = describeScope(scope);
  if (!scope.window) parts.push(`over the last ${preset}`);
  return `the ${page} for ${parts.join(', ')}`;
}

/** The short chat message that follows a drilldown's model context. */
export function drilldownPrompt(page: DrilldownPage): string {
  return `Show me the ${page} for the selection I drilled into.`;
}

/**
 * The model context a drilldown hands the host before its chat message: the exact filters the
 * user clicked as structured data, with a readable summary for hosts that only pass text on.
 */
export function drilldownContext(page: DrilldownPage, scope: DrilldownScope, preset: string) {
  const { window, ...filters } = scope;
  const timeRange = window ? { from: window.from.toISOString(), to: window.to.toISOString() } : { preset };
  return {
    content: [{ type: 'text' as const, text: `The user drilled into ${describeSelection(page, scope, preset)}.` }],
    structuredContent: { drilldown: { page, filters, timeRange } },
  };
}
