import { useSessionHost } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';

export function useGlobalSearchSessions(factoryId: string | undefined) {
  const query = useSessionHost().data.useSessionList(factoryId);

  return {
    repositories: query.data ? [query.data] : [],
    pending: query.isLoading,
    failed: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}
