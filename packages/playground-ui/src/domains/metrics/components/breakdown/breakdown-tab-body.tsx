import type { SpanAggregateScope } from '../../hooks/use-metrics-span-aggregate';
import type { TraceAggregateScope } from '../../hooks/use-metrics-trace-aggregate';
import { isEntityTab } from '../../lib/breakdown';
import type { BreakdownTab } from '../../lib/breakdown';
import { BreakdownEntityTab } from './breakdown-entity-tab';
import { BreakdownFrame } from './breakdown-frame';
import type { BreakdownFrameProps } from './breakdown-frame';
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

/** The open tab, on whichever aggregate answers it; a filter it can't apply says so. */
export function BreakdownTabBody({
  tab,
  traceGate,
  spanGate,
  ...frame
}: BreakdownFrameProps & {
  tab: BreakdownTab;
  traceGate: BreakdownGate<TraceAggregateScope>;
  spanGate: BreakdownGate<SpanAggregateScope>;
}) {
  // Metrics answer every page filter.
  if (tab === 'models') return <BreakdownModelsTab key={tab} {...frame} />;
  const gate = isEntityTab(tab) ? spanGate : traceGate;
  if (gate.status === 'unsupported-filter') {
    return (
      <BreakdownFrame {...frame} tab={tab}>
        <MetricsCard.NoData
          message={`Not available with a ${gate.unsupportedFields.map(f => FILTER_NAMES[f] ?? f).join(' or ')} filter.`}
        />
      </BreakdownFrame>
    );
  }
  if (isEntityTab(tab)) {
    return spanGate.status === 'ready' && <BreakdownEntityTab key={tab} {...frame} tab={tab} scope={spanGate.scope} />;
  }
  return traceGate.status === 'ready' && <BreakdownTraceTab key={tab} {...frame} tab={tab} scope={traceGate.scope} />;
}
