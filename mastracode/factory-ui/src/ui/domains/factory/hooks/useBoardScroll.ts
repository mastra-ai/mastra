import { useEffect, useRef } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';

/**
 * Scrolls the board to its first populated lane once, on first paint, or to
 * the deeplinked card when there is one. A pointer or wheel gesture claims the
 * scroll position for the user and the board never repositions itself again
 * for that board.
 */
export function useBoardScroll({
  boardKey,
  settled,
  stages,
  workItems,
  candidates,
  targetItemId,
  targetReady,
}: {
  boardKey: string;
  settled: boolean;
  stages: ReadonlyArray<{ id: BoardStageId }>;
  workItems: readonly WorkItem[];
  candidates: readonly BoardCandidate[];
  targetItemId: string | undefined;
  targetReady: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<BoardStageId, HTMLElement>());
  const autoPositionedRef = useRef<string | undefined>(undefined);
  const userPositionedRef = useRef<string | undefined>(undefined);
  const targetPositionedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!settled || autoPositionedRef.current === boardKey || userPositionedRef.current === boardKey) return;

    const firstPopulatedStage = stages.find(
      stage =>
        workItems.some(item => item.stages.includes(stage.id)) ||
        candidates.some(candidate => candidate.column === stage.id),
    );
    const container = containerRef.current;
    const lane = firstPopulatedStage ? laneRefs.current.get(firstPopulatedStage.id) : undefined;
    if (!container || !lane) return;
    autoPositionedRef.current = boardKey;
    container.scrollTo?.({ left: Math.max(0, lane.offsetLeft - container.offsetLeft), behavior: 'auto' });
  }, [settled, boardKey, candidates, stages, workItems]);

  return {
    containerRef,
    /**
     * The deeplinked card positions the board as it mounts, whenever that is —
     * it hands its own node over instead of the board searching for it.
     */
    registerCard: (itemId: string) => (element: HTMLElement | null) => {
      if (element === null || !targetReady || itemId !== targetItemId) return;
      const targetKey = `${boardKey}:${itemId}`;
      if (targetPositionedRef.current === targetKey) return;
      targetPositionedRef.current = targetKey;
      userPositionedRef.current = boardKey;
      element.scrollIntoView?.({ behavior: 'auto', block: 'center', inline: 'center' });
      element.querySelector<HTMLElement>('a[href], button:not(:disabled)')?.focus({ preventScroll: true });
    },
    registerLane: (stage: BoardStageId) => (element: HTMLElement | null) => {
      if (element) laneRefs.current.set(stage, element);
      else laneRefs.current.delete(stage);
    },
    claimForUser: () => {
      userPositionedRef.current = boardKey;
    },
  };
}
