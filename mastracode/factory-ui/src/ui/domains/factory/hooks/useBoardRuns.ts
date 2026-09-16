import { toast } from '@mastra/playground-ui/components/Toaster';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useStartFactoryRun } from '../../../../hooks/useStartFactoryRun';
import type { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { itemSessionSpec, itemThreadSession } from '../boardItems';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';

/** Opening the chat session a card carries, and minting one when it has none yet. */
export function useBoardRuns({
  factoryProjectId,
  refetchItems,
}: {
  factoryProjectId: string;
  refetchItems: ReturnType<typeof useWorkItemsQuery>['refetch'];
}) {
  const { start, enabled } = useStartFactoryRun();
  const navigate = useNavigate();

  // A card click refetches items before it can decide whether to open an
  // existing thread or mint a new session. That wait is a round trip long and
  // the mutation isn't pending yet, so without this the card sits completely
  // silent after the click.
  const [preparingItems, setPreparingItems] = useState<Record<string, string>>({});
  // Guarded by a ref, not by preparingItems: two clicks landing in the same
  // render both read the pre-click state, so the state value can't reject the
  // second one.
  const preparingRef = useRef<Set<string>>(new Set());
  const beginPreparingItem = (itemId: string, label: string) => {
    if (preparingRef.current.has(itemId)) return false;
    preparingRef.current.add(itemId);
    setPreparingItems(current => ({ ...current, [itemId]: label }));
    return true;
  };
  const clearPreparingItem = (itemId: string) => {
    preparingRef.current.delete(itemId);
    setPreparingItems(current => {
      if (!(itemId in current)) return current;
      const { [itemId]: _cleared, ...rest } = current;
      return rest;
    });
  };

  const openThread = async (session: WorkItemSessionRef) => {
    navigate(`/factories/${factoryProjectId}/workspaces/${session.sessionId}/threads/${session.threadId}`);
  };

  // Refetch failures here used to be silent: an expired auth cookie made every
  // board click a no-op with no feedback. Toast so the click never dies quietly.
  const refreshItem = async (itemId: string) => {
    const refreshedItems = await refetchItems();
    if (!refreshedItems.isSuccess) {
      const cause = refreshedItems.error;
      toast.error(cause instanceof Error ? cause.message : 'Failed to refresh the board — try reloading the page');
      return;
    }
    const item = refreshedItems.data.find(candidate => candidate.id === itemId);
    if (!item) {
      toast.error('This card no longer exists — the board may be out of date');
      return;
    }
    return item;
  };

  const openOrCreateSession = async (item: WorkItem) => {
    if (!beginPreparingItem(item.id, 'Preparing session…')) return;
    try {
      const refreshed = await refreshItem(item.id);
      if (!refreshed) return;
      const existingSession = itemThreadSession(refreshed.sessions);
      if (existingSession) {
        await openThread(existingSession);
        return;
      }
      const spec = itemSessionSpec(refreshed);
      await start.mutateAsync({
        branch: spec.branch,
        threadTitle: spec.threadTitle,
        workItem: {
          id: refreshed.id,
          role: 'chat',
          source: refreshed.source,
          sourceKey: refreshed.sourceKey,
          title: refreshed.title,
        },
      });
    } finally {
      clearPreparingItem(item.id);
    }
  };

  return {
    enabled,
    error: start.error,
    preparingFor: (itemId: string): string | undefined => preparingItems[itemId],
    openThread,
    refreshItem,
    openOrCreateSession,
  };
}
