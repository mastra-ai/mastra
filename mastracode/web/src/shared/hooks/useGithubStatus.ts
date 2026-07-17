import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchGithubStatus } from '../../web/ui/domains/workspaces/services/github';

/**
 * GitHub feature/connection status through the shared React Query cache, so
 * every consumer dedupes to one `/web/github/status` request. The service
 * degrades to a disabled status (or `authRequired`) instead of throwing, so
 * consumers read `data`, never `error`. Pass `enabled: false` to gate the
 * request (e.g. until web auth has resolved).
 */
export function useGithubStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubStatus(),
    queryFn: () => fetchGithubStatus(baseUrl),
    enabled,
  });
}
