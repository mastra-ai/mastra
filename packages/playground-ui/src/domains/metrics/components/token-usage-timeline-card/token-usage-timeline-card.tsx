import { useTokenUsageTimeSeries } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { OpenInTracesButton } from '../card-action-buttons';
import { TokenUsageTimelineCardContent } from './token-usage-timeline-card-content';
import { TokenUsageTimelineCardLayout } from './token-usage-timeline-card-layout';
import { TokenUsageTimelineCardSkeleton } from './token-usage-timeline-card-skeleton';

export interface TokenUsageTimelineCardProps {
  onOpenTraces?: (scope: DrilldownScope) => void;
}

const LOADING_DESCRIPTION = 'Input and output tokens over time.';

export function TokenUsageTimelineCard({ onOpenTraces }: TokenUsageTimelineCardProps) {
  const { data, isLoading, isError } = useTokenUsageTimeSeries(useMetricsFilters());

  if (isLoading) {
    return (
      <TokenUsageTimelineCardLayout description={LOADING_DESCRIPTION}>
        <TokenUsageTimelineCardSkeleton />
      </TokenUsageTimelineCardLayout>
    );
  }

  if (isError || !data) {
    return (
      <TokenUsageTimelineCardLayout description={LOADING_DESCRIPTION}>
        <MetricsCard.Error message="Failed to load token usage timeline" />
      </TokenUsageTimelineCardLayout>
    );
  }

  const description = `Input and output tokens per ${data.interval === '1d' ? 'day' : 'hour'}.`;
  const actions =
    onOpenTraces && data.data.length > 0 ? <OpenInTracesButton onClick={() => onOpenTraces({})} /> : undefined;

  return (
    <TokenUsageTimelineCardLayout description={description} actions={actions}>
      <TokenUsageTimelineCardContent points={data.data} />
    </TokenUsageTimelineCardLayout>
  );
}
