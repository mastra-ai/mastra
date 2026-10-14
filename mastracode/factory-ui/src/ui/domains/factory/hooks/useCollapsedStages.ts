import { useState } from 'react';

import type { BoardStageId } from '../stages';

/**
 * The list groups a person folded. A deep-linked card unfolds the groups it sits in during the
 * render that first finds it, so the card's one-shot scroll lands on a visible row.
 */
export function useCollapsedStages(target: { itemId: string; stages: BoardStageId[] } | undefined) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<BoardStageId>>(() => new Set());
  const [revealedTargetKey, setRevealedTargetKey] = useState<string>();
  const targetKey = target && `${target.itemId}:${target.stages.join(',')}`;

  if (targetKey !== revealedTargetKey) {
    setRevealedTargetKey(targetKey);
    if (target) setCollapsed(current => new Set([...current].filter(stage => !target.stages.includes(stage))));
  }

  const setStageOpen = (stage: BoardStageId, open: boolean) =>
    setCollapsed(current => {
      const next = new Set(current);
      if (open) next.delete(stage);
      else next.add(stage);
      return next;
    });

  return { isStageOpen: (stage: BoardStageId) => !collapsed.has(stage), setStageOpen };
}
