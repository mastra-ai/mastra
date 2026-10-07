import { OpenInTracesButton } from '@mastra/playground-ui/domains/metrics/components/card-action-buttons';
import { TokenUsageTimelineCardView } from '@mastra/playground-ui/domains/metrics/components/token-usage-timeline-card-view';
import { useDrilldown } from '@mastra/playground-ui/domains/metrics/hooks/use-drilldown';
import { useMetricsFilters } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics-filters';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useTokenUsageTimeSeries } from '@mastra/react/hooks/metrics';

export function TokenUsageTimelineCard() {
  const { data, isLoading, isError } = useTokenUsageTimeSeries(useMetricsFilters());
  const { getTracesHref } = useDrilldown();
  const { Link } = useLinkComponent();

  return (
    <TokenUsageTimelineCardView
      data={data?.data}
      interval={data?.interval}
      isLoading={isLoading}
      isError={isError}
      actions={<OpenInTracesButton href={getTracesHref()} LinkComponent={Link} />}
    />
  );
}
