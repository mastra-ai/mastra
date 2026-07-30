import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { useFactoryWorkspacesQueries } from '../../../../hooks/useWorkspaces';
import { createSessionSearchGroups } from '../services/searchResults';

export function useGlobalSearchData(factoryId: string) {
  const factoriesQuery = useFactoriesQuery();
  const activeFactory = factoriesQuery.data?.find(factory => factory.id === factoryId);
  const repositoryIds = activeFactory?.repositories.map(repository => repository.projectRepositoryId) ?? [];
  const repositoryQueries = useFactoryWorkspacesQueries(repositoryIds);
  const workItemsQuery = useWorkItemsQuery(repositoryIds.length > 0 ? factoryId : undefined);
  const repositories = repositoryQueries.flatMap(query => (query.data ? [query.data] : []));
  const sessionGroups = createSessionSearchGroups({
    factoryId,
    repositories,
    workItems: workItemsQuery.data ?? [],
  });
  const failedRepositoryQueries = repositoryQueries.filter(query => query.isError);
  const sessionDataPending =
    repositoryIds.length > 0 && (repositoryQueries.some(query => query.isPending) || workItemsQuery.isPending);

  const retryFailedRepositories = () => {
    void Promise.all(failedRepositoryQueries.map(query => query.refetch()));
  };

  const retryWorkItems = () => {
    void workItemsQuery.refetch();
  };

  return {
    factories: factoriesQuery.data ?? [],
    sessionGroups,
    hasRepositories: repositoryIds.length > 0,
    sessionDataPending,
    failedRepositoryCount: failedRepositoryQueries.length,
    allRepositoriesFailed: repositoryIds.length > 0 && failedRepositoryQueries.length === repositoryQueries.length,
    workItemsFailed: workItemsQuery.isError,
    retryFailedRepositories,
    retryWorkItems,
  };
}
