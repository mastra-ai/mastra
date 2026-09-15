import { OpenInTracesButton } from '@mastra/playground-ui/domains/metrics/components/card-action-buttons';
import { TokenUsageTimelineCardView } from '@mastra/playground-ui/domains/metrics/components/token-usage-timeline-card-view';
import { useDrilldown } from '@mastra/playground-ui/domains/metrics/hooks/use-drilldown';
import { useTokenUsageTimeSeries } from '@mastra/playground-ui/domains/metrics/hooks/use-token-usage-timeseries';
import { useLinkComponent } from '@/lib/framework';

export function TokenUsageTimelineCard() {
  const { data, isLoading, isError } = useTokenUsageTimeSeries();
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
