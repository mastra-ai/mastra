import { ChartCard } from '../../metrics/components/chart-card';
import { unsupportedMessage } from '../lib/chrome';
import type { ViewHeading } from '../lib/chrome';
import type { PendingGate } from './view-gate';
import { MetricsCard } from '@/ds/components/MetricsCard';

/** A chart widget while its aggregate gates aren't ready, as `TraceAggregateCard` shows it. */
export function PendingChartCard({ gate, heading }: { gate: PendingGate; heading: ViewHeading }) {
  return (
    <ChartCard {...heading}>
      {gate.status === 'loading' ? (
        <MetricsCard.Loading />
      ) : (
        <MetricsCard.NoData message={unsupportedMessage(gate.unsupportedFields)} />
      )}
    </ChartCard>
  );
}
