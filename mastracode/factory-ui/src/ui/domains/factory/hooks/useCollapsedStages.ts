import { useState } from 'react';

import type { BoardStageId } from '../stages';

type CollapseRevealTarget = { itemId: string; stages: BoardStageId[] };

/**
 * Which board groups are open. A group is open unless it is closed by default (a terminal phase),
 * and a closed-by-default group opens while the search shows cards in it. A hand toggle wins over
 * both until the search changes, when closed-by-default groups go back to that rule.
 */
export function useCollapsedStages({
  closedByDefault,
  searchKey,
  searchRevealed,
  revealTarget,
}: {
  closedByDefault: ReadonlySet<BoardStageId>;
  searchKey: string;
  searchRevealed: ReadonlySet<BoardStageId>;
  revealTarget: CollapseRevealTarget | undefined;
}) {
  const [overrides, setOverrides] = useState<ReadonlyMap<BoardStageId, boolean>>(() => new Map());
  const [revealedTargetKey, setRevealedTargetKey] = useState<string>();
  const [seenSearchKey, setSeenSearchKey] = useState(searchKey);
  const targetKey = revealTarget && `${revealTarget.itemId}:${revealTarget.stages.join(',')}`;

  if (searchKey !== seenSearchKey) {
    setSeenSearchKey(searchKey);
    setOverrides(current => new Map([...current].filter(([stage]) => !closedByDefault.has(stage))));
  }

  if (targetKey !== revealedTargetKey) {
    setRevealedTargetKey(targetKey);
    if (revealTarget) {
      setOverrides(current => new Map([...current, ...revealTarget.stages.map(stage => [stage, true] as const)]));
    }
  }

  const setStageOpen = (stage: BoardStageId, open: boolean) =>
    setOverrides(current => new Map(current).set(stage, open));

  const isStageOpen = (stage: BoardStageId) =>
    overrides.get(stage) ?? (!closedByDefault.has(stage) || searchRevealed.has(stage));

  return { isStageOpen, setStageOpen };
}
