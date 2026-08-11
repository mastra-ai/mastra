import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';

/** Board cards: they title the session results and are searchable on their own before a session exists. */
export function useGlobalSearchWorkItems(factoryId: string | undefined) {
  const query = useWorkItemsQuery(factoryId);

  return {
    items: query.data ?? [],
    refetch: query.refetch,
    pending: query.isLoading,
    failed: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}
