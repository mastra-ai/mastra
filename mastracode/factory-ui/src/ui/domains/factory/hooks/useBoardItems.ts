import { useMemo, useRef, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import {
  useDeleteWorkItemMutation,
  useTransitionWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
  useWorkItemsQuery,
} from '../../../../hooks/useWorkItems';
import type { DragPayload } from '../boardDrag';
import { persistedSourceKeys } from '../boardItems';
import { belongsToBoard } from '../boardStages';
import type { BoardKind } from '../boardStages';
import { createWorkItemComment } from '../services/comments';
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

interface MoveOptions {
  /** What the server records as the reason for the move; a drag says so, a card button does not. */
  cause?: string;
  /** Hands-off: stamp the card as pre-approving its plans before the move queues a run. */
  preapprovePlans?: boolean;
}

/** The board's persisted cards: the query behind them and the moves that rewrite them. */
export function useBoardItems({
  factoryProjectId,
  kind,
  onFailure,
}: {
  factoryProjectId: string | undefined;
  kind: BoardKind;
  /** Where a failure goes when no card is on screen to carry it, e.g. the search palette. */
  onFailure?: (message: string) => void;
}) {
  const { baseUrl } = useApiConfig();
  const items = useWorkItemsQuery(factoryProjectId);
  const upsert = useUpsertWorkItemMutation(factoryProjectId);
  const update = useUpdateWorkItemMutation(factoryProjectId);
  const transition = useTransitionWorkItemMutation(factoryProjectId);
  const remove = useDeleteWorkItemMutation(factoryProjectId);
  const [transitionReasons, setTransitionReasons] = useState<Record<string, string>>({});
  const [dropError, setDropError] = useState<Error>();
  const movingRef = useRef<Set<string>>(new Set());

  const all = useMemo(() => items.data ?? [], [items.data]);
  const knownSourceKeys = useMemo(() => persistedSourceKeys(all), [all]);
  const visible = all.filter(item => belongsToBoard(item, kind)).sort(byNewest);

  const requestTransition = (item: WorkItem, toStage: string, options: MoveOptions = {}, onSettled?: () => void) => {
    setTransitionReasons(current => {
      if (!(item.id in current)) return current;
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    const refused = (reason: string) => {
      setTransitionReasons(current => ({ ...current, [item.id]: reason }));
      onFailure?.(reason);
    };
    // `mutateAsync`, because the search palette closes on select: react-query
    // drops the callbacks passed to `mutate` once the caller unmounts.
    void transition
      .mutateAsync({
        item,
        board: belongsToBoard(item, 'review') ? 'review' : 'work',
        stage: toStage,
        cause: options.cause ?? 'card_action',
        ...(item.stages.length === 1 && item.stages[0] === toStage ? { reenter: true } : {}),
      })
      .then(result => {
        if (result.status === 'rejected') refused(result.reason);
      })
      .catch(error => refused(error instanceof Error ? error.message : 'The transition could not be evaluated.'))
      .finally(onSettled);
  };

  const move = (id: string, toStage: string, options: MoveOptions = {}) => {
    const item = all.find(candidate => candidate.id === id);
    // Held in a ref, not in mutation state: two clicks land in the same render
    // and both read the pre-click state, so the hands-off patch would run twice
    // and queue two runs.
    if (!item || movingRef.current.has(id)) return;
    movingRef.current.add(id);
    const release = () => movingRef.current.delete(id);
    if (!options.preapprovePlans) {
      requestTransition(item, toStage, options, release);
      return;
    }
    // The patch bumps the revision, so the move has to ride the item it returned.
    void update
      .mutateAsync({ id, patch: { plansPreapproved: true } })
      .then(patched => requestTransition(patched, toStage, options, release))
      .catch(error => {
        release();
        onFailure?.(error instanceof Error ? error.message : 'The card could not be stamped hands-off.');
      });
  };

  const handleDrop = (payload: DragPayload, toStage: BoardStageId, cause = 'board_drag') => {
    if (payload.kind === 'work-item') {
      if (payload.fromStage === toStage) return;
      move(payload.id, toStage, { cause });
      return;
    }
    setDropError(undefined);
    const { source, sourceKey, title, url, metadata, customPrompt } = payload.candidate;
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
      // The kickoff reads the card's feed, so typed guidance reaches the run as a comment on it.
      if (customPrompt) {
        await createWorkItemComment(baseUrl, item.id, { body: customPrompt, clientToken: crypto.randomUUID() });
      }
      if (toStage !== 'intake') requestTransition(item, toStage, { cause });
    })().catch(error => {
      const failure = error instanceof Error ? error : new Error('The card could not be filed.');
      setDropError(failure);
      onFailure?.(failure.message);
    });
  };

  return {
    all,
    visible,
    knownSourceKeys,
    isPending: items.isPending,
    error: items.isError ? items.error : undefined,
    mutationError: [upsert, update, transition, remove].find(mutation => mutation.isError)?.error ?? dropError,
    evaluatingStages: new Map(transition.pendingTransitions.map(({ itemId, stage }) => [itemId, stage])),
    transitionReasons,
    refetch: items.refetch,
    move,
    remove: (id: string) => remove.mutate(id),
    handleDrop,
  };
}
