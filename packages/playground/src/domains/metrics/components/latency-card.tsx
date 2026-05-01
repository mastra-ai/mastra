import { LatencyCardView, useLatencyMetrics } from '@mastra/playground-ui';

export function LatencyCard() {
  const { data, isLoading, isError } = useLatencyMetrics();
  return <LatencyCardView data={data} isLoading={isLoading} isError={isError} />;
}
