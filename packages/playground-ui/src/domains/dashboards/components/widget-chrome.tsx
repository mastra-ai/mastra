import { ChartCard } from '../../metrics/components/chart-card';
import { unsupportedMessage } from '../lib/chrome';
import type { PendingGate } from './view-gate';
import { MetricsCard } from '@/ds/components/MetricsCard';

/** A chart widget while its aggregate gates aren't ready, as `TraceAggregateCard` shows it. */
export function PendingChartCard({
  gate,
  title,
  description,
}: {
  gate: PendingGate;
  title: string;
  description?: string;
}) {
  return (
    <ChartCard title={title} description={description}>
      {gate.status === 'loading' ? (
        <MetricsCard.Loading />
      ) : (
        <MetricsCard.NoData message={unsupportedMessage(gate.unsupportedFields)} />
      )}
    </ChartCard>
  );
}
