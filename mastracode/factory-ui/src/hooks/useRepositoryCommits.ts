import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchRepositoryCommits } from '../ui/domains/factory/services/commits';

/** GitHub is the source, not our database, so a poll here costs a rate-limited call — a page visit is enough. */
const COMMITS_STALE_MS = 60_000;

export function useRepositoryCommits(projectRepositoryId: string | undefined, limit: number) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubCommits(projectRepositoryId, limit),
    queryFn: projectRepositoryId
      ? ({ signal }) => fetchRepositoryCommits(baseUrl, projectRepositoryId, { limit, signal })
      : skipToken,
    staleTime: COMMITS_STALE_MS,
  });
}
