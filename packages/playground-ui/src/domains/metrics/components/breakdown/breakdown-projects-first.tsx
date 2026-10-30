import type { SpanAggregateScope } from '../../hooks/use-metrics-span-aggregate';
import type { TraceAggregateScope } from '../../hooks/use-metrics-trace-aggregate';
import { useMetricsTraceAggregate } from '../../hooks/use-metrics-trace-aggregate';
import { projectsAggregateRequest } from '../../lib/breakdown';
import type { BreakdownTab } from '../../lib/breakdown';
import type { BreakdownFrameProps } from './breakdown-frame';
import { BreakdownTabBody } from './breakdown-tab-body';
import type { BreakdownGate } from './breakdown-tab-body';

/**
 * An organization page asks for projects first, and opens on them only when there are at least
 * two to compare. The request is the Projects tab's own, so opening it costs nothing more.
 */
export function BreakdownProjectsFirst({
  chosen,
  traceScope,
  spanGate,
  ...frame
}: BreakdownFrameProps & {
  chosen?: BreakdownTab;
  traceScope: TraceAggregateScope;
  spanGate: BreakdownGate<SpanAggregateScope>;
}) {
  const projects = useMetricsTraceAggregate(projectsAggregateRequest(traceScope));
  const withData = projects.data?.rows.filter(r => (r.measures.count ?? 0) > 0).length;
  const tab = chosen ?? openingTab(withData);
  return (
    <BreakdownTabBody {...frame} tab={tab} traceGate={{ status: 'ready', scope: traceScope }} spanGate={spanGate} />
  );
}

/** Projects while they load, so the tab doesn't jump when they answer with two or more. */
function openingTab(projectsWithData: number | undefined): BreakdownTab {
  if (projectsWithData === undefined || projectsWithData >= 2) return 'projects';
  return 'agents';
}
