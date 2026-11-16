import { useMetrics } from '../../metrics/hooks/use-metrics';
import { useMetricsFilters } from '../../metrics/hooks/use-metrics-filters';
import { useSpanAggregateGate } from '../../metrics/hooks/use-metrics-span-aggregate';
import type { SpanAggregateGate } from '../../metrics/hooks/use-metrics-span-aggregate';
import { useTraceAggregateGate } from '../../metrics/hooks/use-metrics-trace-aggregate';
import type { TraceAggregateGate } from '../../metrics/hooks/use-metrics-trace-aggregate';
import type { DashboardEnvironment } from '../lib/gate';

type Gates = DashboardEnvironment['gates'];

const traceInput = (gate: TraceAggregateGate): Gates['trace'] =>
  gate.status === 'ready' ? { status: 'ready', where: gate.scope.where } : gate;
const spanInput = (gate: SpanAggregateGate): Gates['span'] =>
  gate.status === 'ready' ? { status: 'ready', where: gate.scope.where } : gate;

/** The page's window, filters and aggregate gates inside `MetricsProvider`, as plain data. */
export function useDashboardEnvironment(): DashboardEnvironment {
  const { filters, timestamp } = useMetricsFilters();
  const { comparisonLabel, scope } = useMetrics();
  const trace = useTraceAggregateGate();
  const span = useSpanAggregateGate();
  return {
    window: timestamp,
    filters,
    comparisonLabel,
    projectLabel: scope.projectLabel,
    gates: { trace: traceInput(trace), span: spanInput(span) },
  };
}

/** Never read: `widgetGate` consults the gates only for widgets with trace or span aggregates. */
const NO_GATES: Gates = { trace: { status: 'unavailable' }, span: { status: 'unavailable' } };

/**
 * The page's window and filters, for widgets without trace or span aggregates; it doesn't load the
 * server's capabilities, which only those aggregates wait on.
 */
export function useMetricsEnvironment(): DashboardEnvironment {
  const { filters, timestamp } = useMetricsFilters();
  const { comparisonLabel, scope } = useMetrics();
  return { window: timestamp, filters, comparisonLabel, projectLabel: scope.projectLabel, gates: NO_GATES };
}
