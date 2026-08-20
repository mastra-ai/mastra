import type { AggregateScoresResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { ScoreMetricsDateRange } from './use-score-metrics';

export type ScoreBucket = 'hour' | 'day' | 'week' | 'month';

export const useScoreMetadataKeys = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['scores', 'metadata-keys'],
    queryFn: () => client.getScoresMetadataKeys(),
    staleTime: 30_000,
  });
};

export interface UseScoreSegmentsArgs {
  bucket: ScoreBucket;
  /** 'scorerId', 'entityId', or 'metadata:<key>'; null disables grouping. */
  groupBy: string | null;
  dateRange?: ScoreMetricsDateRange;
}

export const useScoreSegments = ({ bucket, groupBy, dateRange }: UseScoreSegmentsArgs) => {
  const client = useMastraClient();

  return useQuery<AggregateScoresResponse>({
    queryKey: ['scores', 'segments', bucket, groupBy, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: () =>
      client.aggregateScores({
        bucket,
        groupBy: groupBy ? [groupBy] : undefined,
        startDate: dateRange?.start?.toISOString(),
        endDate: dateRange?.end?.toISOString(),
      }),
    staleTime: 0,
    gcTime: 0,
  });
};
