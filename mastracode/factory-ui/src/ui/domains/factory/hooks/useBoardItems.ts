import { useMemo, useState } from 'react';

import {
  useDeleteWorkItemMutation,
  useTransitionWorkItemMutation,
  useUpsertWorkItemMutation,
  useWorkItemsQuery,
} from '../../../../hooks/useWorkItems';
import type { DragPayload } from '../boardDrag';
import { persistedSourceKeys } from '../boardItems';
import { belongsToBoard } from '../boardStages';
import type { BoardKind } from '../boardStages';
import { inferredParentWorkItemId } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';

/**
 * Column order, stated here rather than inherited from the list endpoint: a
 * card must keep its place when a sync or a run touches it, and the board is
 * the surface that decides what "first" means.
 */
const byNewest = (left: WorkItem, right: WorkItem) =>
  right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);

/** The board's persisted cards: the query behind them and the moves that rewrite them. */
export function useBoardItems({ factoryProjectId, kind }: { factoryProjectId: string; kind: BoardKind }) {
  const items = useWorkItemsQuery(factoryProjectId);
  const upsert = useUpsertWorkItemMutation(factoryProjectId);
  const transition = useTransitionWorkItemMutation(factoryProjectId);
  const remove = useDeleteWorkItemMutation(factoryProjectId);
  const [transitionReasons, setTransitionReasons] = useState<Record<string, string>>({});

  const all = useMemo(() => items.data ?? [], [items.data]);
  const knownSourceKeys = useMemo(() => persistedSourceKeys(all), [all]);
  const visible = all.filter(item => belongsToBoard(item, kind)).sort(byNewest);

  const requestTransition = (item: WorkItem, toStage: string) => {
    setTransitionReasons(current => {
      if (!(item.id in current)) return current;
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    transition.mutate(
      { item, board: kind, stage: toStage },
      {
        onSuccess: result => {
          if (result.status !== 'rejected') return;
          setTransitionReasons(current => ({ ...current, [item.id]: result.reason }));
        },
        onError: error => {
          setTransitionReasons(current => ({
            ...current,
            [item.id]: error instanceof Error ? error.message : 'The transition could not be evaluated.',
          }));
        },
      },
    );
  };

  const move = (id: string, toStage: string) => {
    const item = visible.find(candidate => candidate.id === id);
    if (!item || (item.stages.length === 1 && item.stages[0] === toStage)) return;
    requestTransition(item, toStage);
  };

  const handleDrop = (payload: DragPayload, toStage: BoardStageId) => {
    if (payload.kind === 'work-item') {
      if (payload.fromStage === toStage) return;
      move(payload.id, toStage);
      return;
    }
    // Filing a candidate never starts a run — it only creates the card.
    const { source, sourceKey, title, url, metadata } = payload.candidate;
    const parentWorkItemId = source === 'github-pr' ? inferredParentWorkItemId(metadata, all) : undefined;
    void (async () => {
      const item = await upsert.mutateAsync({
        source,
        sourceKey,
        parentWorkItemId,
        title,
        url,
        stages: ['intake'],
        metadata,
      });
      if (toStage !== 'intake') requestTransition(item, toStage);
      // swallow only — the failure already reaches the UI through `mutationError`
    })().catch(() => {});
  };

  return {
    all,
    visible,
    knownSourceKeys,
    isPending: items.isPending,
    error: items.isError ? items.error : undefined,
    mutationError: [upsert, transition, remove].find(mutation => mutation.isError)?.error,
    evaluatingStages: new Map(transition.pendingTransitions.map(({ itemId, stage }) => [itemId, stage])),
    transitionReasons,
    refetch: items.refetch,
    move,
    remove: (id: string) => remove.mutate(id),
    handleDrop,
  };
}
