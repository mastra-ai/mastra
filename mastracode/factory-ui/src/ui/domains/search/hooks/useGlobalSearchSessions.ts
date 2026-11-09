import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';

export function useGlobalSearchSessions(factoryId: string | undefined) {
  const query = useWorkspacesQuery(factoryId);

  return {
    repositories: query.data ? [query.data] : [],
    pending: query.isLoading,
    failed: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}
