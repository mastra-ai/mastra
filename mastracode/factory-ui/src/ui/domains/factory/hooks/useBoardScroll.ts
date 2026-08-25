import { useEffect, useRef } from 'react';

import type { BoardCandidate } from '../boardCandidates';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';

// Positions the board once: at its first populated lane, or at the deeplinked card.
// A pointer or wheel gesture claims the position for the user.
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
    // The card hands its own control over as it mounts, whenever that is.
    registerCard: (itemId: string) => (element: HTMLElement | null) => {
      if (element === null || !targetReady || itemId !== targetItemId) return;
      const targetKey = `${boardKey}:${itemId}`;
      if (targetPositionedRef.current === targetKey) return;
      targetPositionedRef.current = targetKey;
      userPositionedRef.current = boardKey;
      element.scrollIntoView?.({ behavior: 'auto', block: 'center', inline: 'center' });
      element.focus({ preventScroll: true });
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
