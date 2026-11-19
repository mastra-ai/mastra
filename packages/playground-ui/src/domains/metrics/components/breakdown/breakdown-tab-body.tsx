import type { SpanAggregateScope } from '../../hooks/use-metrics-span-aggregate';
import type { TraceAggregateScope } from '../../hooks/use-metrics-trace-aggregate';
import { isEntityTab } from '../../lib/breakdown';
import type { BreakdownTab } from '../../lib/breakdown';
import { BreakdownEntityTab } from './breakdown-entity-tab';
import { BreakdownFrame } from './breakdown-frame';
import type { BreakdownBodyProps, BreakdownFrameProps } from './breakdown-frame';
import { BreakdownModelsTab } from './breakdown-models-tab';
import { BreakdownTraceTab } from './breakdown-trace-tab';
import { MetricsCard } from '@/ds/components/MetricsCard';

export type BreakdownGate<Scope> =
  | { status: 'ready'; scope: Scope }
  | { status: 'unsupported-filter'; unsupportedFields: string[] };

const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
  tags: 'tags',
  provider: 'provider',
  model: 'model',
};

/**
 * The card with the open tab's body under its tabs. The frame stays mounted while the bodies swap,
 * each keyed by its tab so its rows, sort and page start fresh.
 */
export function BreakdownTabBody({
  tab,
  tabs,
  onTabChange,
  ...body
}: BreakdownFrameProps & {
  tab: BreakdownTab;
  traceGate: BreakdownGate<TraceAggregateScope>;
  spanGate: BreakdownGate<SpanAggregateScope>;
}) {
  return (
    <BreakdownFrame tab={tab} tabs={tabs} onTabChange={onTabChange}>
      <OpenTab tab={tab} {...body} />
    </BreakdownFrame>
  );
}

/** The open tab, on whichever aggregate answers it; a filter it can't apply says so. */
function OpenTab({
  tab,
  traceGate,
  spanGate,
  ...body
}: BreakdownBodyProps & {
  tab: BreakdownTab;
  traceGate: BreakdownGate<TraceAggregateScope>;
  spanGate: BreakdownGate<SpanAggregateScope>;
}) {
  // Metrics answer every page filter.
  if (tab === 'models') return <BreakdownModelsTab key={tab} {...body} />;
  const gate = isEntityTab(tab) ? spanGate : traceGate;
  if (gate.status === 'unsupported-filter') {
    return (
      <MetricsCard.NoData
        message={`Not available with a ${gate.unsupportedFields.map(f => FILTER_NAMES[f] ?? f).join(' or ')} filter.`}
      />
    );
  }
  if (isEntityTab(tab)) {
    return spanGate.status === 'ready' && <BreakdownEntityTab key={tab} {...body} tab={tab} scope={spanGate.scope} />;
  }
  return traceGate.status === 'ready' && <BreakdownTraceTab key={tab} {...body} tab={tab} scope={traceGate.scope} />;
}
