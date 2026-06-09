import {
  OpenInTracesButton,
  TokenUsageTimelineCardView,
  useDrilldown,
  useTokenUsageTimeSeries,
} from '@mastra/playground-ui';
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
