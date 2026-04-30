import { TokenUsageByAgentCardView, useTokenUsageByAgentMetrics } from '@mastra/playground-ui';

export function TokenUsageByAgentCard() {
  const { data, isLoading, isError } = useTokenUsageByAgentMetrics();
  return <TokenUsageByAgentCardView data={data} isLoading={isLoading} isError={isError} />;
}
