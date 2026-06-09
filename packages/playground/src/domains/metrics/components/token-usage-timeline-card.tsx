import { TokenUsageTimelineCardView, useTokenUsageTimeSeries } from '@mastra/playground-ui';

export function TokenUsageTimelineCard() {
  const { data, isLoading, isError } = useTokenUsageTimeSeries();

  return (
    <TokenUsageTimelineCardView data={data?.data} interval={data?.interval} isLoading={isLoading} isError={isError} />
  );
}
