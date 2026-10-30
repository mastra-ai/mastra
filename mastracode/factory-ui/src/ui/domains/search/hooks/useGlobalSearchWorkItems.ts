import { useWorkItemsWithHistory } from '../../../../hooks/useWorkItems';

/** Board cards: they title the session results and are searchable on their own before a session exists. */
export function useGlobalSearchWorkItems(factoryId: string | undefined) {
  // Search reaches every card, not just the board's recent ones.
  const query = useWorkItemsWithHistory(factoryId, true);

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
