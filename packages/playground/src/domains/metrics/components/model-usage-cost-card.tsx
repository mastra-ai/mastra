import { ModelUsageCostCardView, useModelUsageCostMetrics } from '@mastra/playground-ui';

export function ModelUsageCostCard() {
  const { data, isLoading, isError } = useModelUsageCostMetrics();
  return <ModelUsageCostCardView rows={data} isLoading={isLoading} isError={isError} />;
}
