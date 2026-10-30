import { useWorkItemsWithLookup } from '../../../../hooks/useWorkItems';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { missingSessionLookup } from '../../workspaces/services/sessionWorkItems';

/**
 * Board cards, which title the session results and are searchable on their own before a session exists,
 * plus the Done and Canceled cards of listed sessions the board lacks — the same lookup the sidebar makes.
 */
export function useGlobalSearchWorkItems(factoryId: string | undefined) {
  const workspaces = useWorkspacesQuery(factoryId);
  const query = useWorkItemsWithLookup(factoryId, cards =>
    missingSessionLookup(cards, workspaces.data?.workspaces ?? []),
  );

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
