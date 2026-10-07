import { useLatencyMetrics } from '@mastra/react/hooks/metrics';
import { useState } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { OpenInTracesButton } from '../card-action-buttons';
import { LatencyCardContent } from './latency-card-content';
import { LatencyCardLayout } from './latency-card-layout';
import { LatencyCardSkeleton } from './latency-card-skeleton';
import { latencyBucketScope, latencyTracesScope, resolveActiveTab } from './latency-card.utils';
import type { LatencyTab } from './latency-card.utils';

export interface LatencyCardProps {
  /** Opens traces for the active tab entity type. No handler, no button. */
  onOpenTraces?: (scope: DrilldownScope) => void;
  /** Opens traces narrowed to a clicked chart bucket. No handler, no clickable nodes. */
  onBucketClick?: (scope: DrilldownScope) => void;
}

export function LatencyCard({ onOpenTraces, onBucketClick }: LatencyCardProps) {
  const { data, isLoading, isError } = useLatencyMetrics(useMetricsFilters());
  const [selectedTab, setSelectedTab] = useState<LatencyTab>('agents');

  if (isLoading) {
    return (
      <LatencyCardLayout description="p50 and p95 latency.">
        <LatencyCardSkeleton />
      </LatencyCardLayout>
    );
  }

  if (isError || !data) {
    return (
      <LatencyCardLayout description="p50 and p95 latency.">
        <MetricsCard.Error message="Failed to load latency data" className="h-64" />
      </LatencyCardLayout>
    );
  }

  const activeTab = resolveActiveTab(data, selectedTab);
  const interval = data.interval;

  return (
    <LatencyCardLayout
      description={interval === '1h' ? 'Hourly p50 and p95 latency.' : 'Daily p50 and p95 latency.'}
      actions={
        onOpenTraces ? <OpenInTracesButton onClick={() => onOpenTraces(latencyTracesScope(activeTab))} /> : undefined
      }
    >
      <LatencyCardContent
        data={data}
        activeTab={activeTab}
        onTabChange={setSelectedTab}
        onBucketClick={
          onBucketClick ? (tab, point) => onBucketClick(latencyBucketScope(tab, point.tsMs, interval)) : undefined
        }
      />
    </LatencyCardLayout>
  );
}
