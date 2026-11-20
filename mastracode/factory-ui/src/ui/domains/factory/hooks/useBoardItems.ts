import { boardLoop, boardOf } from '../boardFlow';
import { useRef, useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useDeleteWorkItemMutation, useTransitionWorkItemMutation } from '../../../../hooks/useWorkItems';
import type { DragPayload } from '../boardDrag';
import { itemBoard, pullRequestMayEnter } from '../boardStages';
import type { BoardKind } from '../boardStages';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';

interface MoveOptions {
  /** What the server records as the reason for the move; a drag says so, a card button does not. */
  cause?: string;
}

/** The moves that rewrite a board's persisted cards, for a caller that holds the cards it acts on. */
export function useBoardItems({
  factoryProjectId,
  kind,
  currentUserId,
  onFailure,
  items: all,
}: {
  factoryProjectId: string | undefined;
  kind: BoardKind;
  /** The cards to act on: the ones the caller shows, and the ones holding a session. */
  items: readonly WorkItem[];
  currentUserId?: string;
  /** Where a failure goes when no card is on screen to carry it, e.g. the search palette. */
  onFailure?: (message: string) => void;
}) {
  const catalog = useBoardCatalog(factoryProjectId);
  const transition = useTransitionWorkItemMutation(factoryProjectId, currentUserId);
  const remove = useDeleteWorkItemMutation(factoryProjectId);
  const [transitionReasons, setTransitionReasons] = useState<Record<string, string>>({});
  const movingRef = useRef<Set<string>>(new Set());

  const requestTransition = (
    item: WorkItem,
    toBoard: string,
    toStage: string,
    options: MoveOptions = {},
    onSettled?: () => void,
  ) => {
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
        board: toBoard,
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
    // Held in a ref, not in mutation state: two clicks can land in the same render
    // and otherwise queue the same move twice.
    if (!item || movingRef.current.has(id)) return;
    const definition = boardOf(catalog.data, item);
    if (!pullRequestMayEnter(definition, item, toStage)) return;
    // Only a board without a pull request loop is held to its declared moves here; the server judges the rest.
    if (boardLoop(definition) === undefined) {
      const phase = definition?.phases.find(candidate => item.stages.includes(candidate.id));
      if (!phase || (phase.id !== toStage && !phase.transitions.some(target => target.to === toStage))) return;
    }
    movingRef.current.add(id);
    requestTransition(item, itemBoard(item), toStage, options, () => movingRef.current.delete(id));
  };

  /** Moves a card to a phase on another board; the server keeps its id, history, and sessions. */
  const moveToBoard = (id: string, toBoard: string, toStage: string) => {
    const item = all.find(candidate => candidate.id === id);
    if (!item || movingRef.current.has(id)) return;
    if (itemBoard(item) === toBoard) return move(id, toStage);
    // No declared-move gate here: the destination board's rules are the server's to judge.
    movingRef.current.add(id);
    requestTransition(item, toBoard, toStage, { cause: 'move_to_board' }, () => movingRef.current.delete(id));
  };

  const handleDrop = (payload: DragPayload, toStage: BoardStageId, cause = 'board_drag') => {
    const item = all.find(candidate => candidate.id === payload.id);
    if (!item || itemBoard(item) !== kind || payload.fromStage === toStage) return;
    move(payload.id, toStage, { cause });
  };

  return {
    mutationError: [transition, remove].find(mutation => mutation.isError)?.error,
    evaluatingStages: new Map(transition.pendingTransitions.map(({ itemId, stage }) => [itemId, stage])),
    transitionReasons,
    move,
    moveToBoard,
    remove: (id: string) => remove.mutate(id),
    handleDrop,
  };
}
