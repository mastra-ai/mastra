import { ScoresCardView, useScoresMetrics } from '@mastra/playground-ui';

export function ScoresCard() {
  const { data, isLoading, isError } = useScoresMetrics();
  return <ScoresCardView data={data} isLoading={isLoading} isError={isError} />;
}
