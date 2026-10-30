import type { DashboardQuery } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { skipToken, useQuery } from '@tanstack/react-query';
import type { DashboardPageContext } from '../lib/requests';
import { discoveredScorers, needsScorer, ownScorers } from '../lib/scores';

/** How many recent scores to read to find the scorers in the range (the API's page limit). */
const DISCOVERY_PAGE_SIZE = 100;

/**
 * The scorers to chart: the queries' own scorer, or, when they leave it out, every scorer among the
 * range's most recent scores, as the Scores card finds them (the API can't list scorers).
 */
export function useScorers(queries: DashboardQuery[], page: DashboardPageContext) {
  const client = useMastraClient();
  const discover = queries.some(needsScorer);
  const args = { filters: page.filters, pagination: { page: 0, perPage: DISCOVERY_PAGE_SIZE } };
  const recent = useQuery({
    queryKey: ['dashboards', 'listScores', args],
    queryFn: discover ? () => client.listScores(args) : skipToken,
  });
  const recentScores = (recent.data?.scores ?? []).map(s => ({
    scorerId: s.scorerId,
    scorerName: s.scorerName ?? undefined,
  }));
  const scorers = discover ? discoveredScorers(recentScores) : ownScorers(queries);
  return { recent, scorers };
}
