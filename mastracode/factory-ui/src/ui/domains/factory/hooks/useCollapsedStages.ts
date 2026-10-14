import { useState } from 'react';

import type { BoardStageId } from '../stages';

type CollapseRevealTarget = { itemId: string; commentId: string | undefined; stages: BoardStageId[] };

export function useCollapsedStages(revealTarget: CollapseRevealTarget | undefined) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<BoardStageId>>(() => new Set());
  const [revealedTargetKey, setRevealedTargetKey] = useState<string>();
  const targetKey =
    revealTarget && `${revealTarget.itemId}:${revealTarget.commentId ?? ''}:${revealTarget.stages.join(',')}`;

  if (targetKey !== revealedTargetKey) {
    setRevealedTargetKey(targetKey);
    if (revealTarget) {
      setCollapsed(current => new Set([...current].filter(stage => !revealTarget.stages.includes(stage))));
    }
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
