import { useQueries, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { FactoryProject } from '../ui/domains/workspaces/services/github';
import { listRepositoryIssues, listRepositoryPullRequests } from '../ui/domains/factory/services/factory';
import type { GithubIssuePage, GithubPullRequestPage } from '../ui/domains/factory/services/factory';
import { INTAKE_ERROR_POLL_MS, INTAKE_POLL_MS } from './useFactoryData';
import { useIntakeConfigQuery, useIntakeLabelRoutesQuery } from './useIntakeConfig';

/**
 * The visible candidate feed browses the first repository. Reading the remaining
 * repositories' feeds also ingests their events on the server, so their cards
 * appear in the project's persisted board without merging repository-local keys.
 */
export function useRepositoryIntakeSync(factory: FactoryProject, kind: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const config = useIntakeConfigQuery();
  const labelRoutes = useIntakeLabelRoutesQuery(kind === 'review' ? undefined : factory.id);
  const issueIntakeActive =
    kind === 'work' ||
    labelRoutes.isError ||
    labelRoutes.data?.some(route => route.integrationId === 'github' && route.board === kind);
  const repositories = factory.repositories
    .slice(1)
    .filter(
      repository =>
        repository.provider !== 'gitlab' &&
        (kind === 'review' ||
          (issueIntakeActive &&
            config.data?.github.enabled &&
            config.data.github.sourceIds?.includes(repository.slug))),
    );
  const results = useQueries({
    queries: repositories.map(repository => ({
      queryKey: queryKeys.repositoryIntake(baseUrl, factory.id, repository.projectRepositoryId, kind),
      queryFn: async ({ signal }) => {
        let page: number | null = 1;
        while (page !== null) {
          signal.throwIfAborted();
          const response: GithubIssuePage | GithubPullRequestPage =
            kind === 'review'
              ? await listRepositoryPullRequests(baseUrl, repository.projectRepositoryId, page)
              : await listRepositoryIssues(baseUrl, repository.projectRepositoryId, page);
          page = response.nextPage ?? null;
        }
        signal.throwIfAborted();
        await queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factory.id) });
        return null;
      },
      refetchInterval: (query: { state: { status: string } }) =>
        query.state.status === 'error' ? INTAKE_ERROR_POLL_MS : INTAKE_POLL_MS,
      refetchOnWindowFocus: true,
    })),
  });
  return {
    failedRepositories: repositories
      .filter((_repository, index) => results[index]?.isError)
      .map(repository => repository.slug),
    refetch: () => Promise.all(results.filter(result => result.isError).map(result => result.refetch())),
  };
}
