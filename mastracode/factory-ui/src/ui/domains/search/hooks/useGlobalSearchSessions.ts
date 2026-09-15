import { useFactoryWorkspacesQueries } from '../../../../hooks/useWorkspaces';

/** One query per linked repository, so one unreachable repository degrades to a notice, not empty results. */
export function useGlobalSearchSessions(projectRepositoryIds: string[]) {
  const queries = useFactoryWorkspacesQueries(projectRepositoryIds);
  const failed = queries.filter(query => query.isError);

  return {
    repositories: queries.flatMap(query => (query.data ? [query.data] : [])),
    pending: queries.some(query => query.isLoading),
    failedCount: failed.length,
    allFailed: queries.length > 0 && failed.length === queries.length,
    retry: () => {
      void Promise.all(failed.map(query => query.refetch()));
    },
  };
}
