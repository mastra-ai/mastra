import { useEffect, useRef, useState } from 'react';

import {
  useTransitionWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
} from '../../../../hooks/useWorkItems';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';

/** The inline "new card" composer: which lane owns it, where focus returns, and what a submit files. */
export function useBoardComposer(factoryProjectId: string) {
  const [stage, setStage] = useState<BoardStageId>();
  const triggerRefs = useRef(new Map<BoardStageId, HTMLButtonElement>());
  const pendingItemRef = useRef<{ stage: BoardStageId; title: string; item: WorkItem } | undefined>(undefined);
  const closedStageRef = useRef<BoardStageId | undefined>(undefined);

  const create = useUpsertWorkItemMutation(factoryProjectId);
  const update = useUpdateWorkItemMutation(factoryProjectId);
  const transition = useTransitionWorkItemMutation(factoryProjectId);

  useEffect(() => {
    const closedStage = closedStageRef.current;
    if (stage !== undefined || closedStage === undefined) return;
    closedStageRef.current = undefined;
    triggerRefs.current.get(closedStage)?.focus();
  }, [stage]);

  /**
   * Submits are re-entrant: a rejected transition keeps the composer open, so a
   * retry must update the card it already created instead of filing a duplicate.
   */
  const submit = async (forStage: BoardStageId, title: string) => {
    const pendingItem = pendingItemRef.current?.stage === forStage ? pendingItemRef.current : undefined;
    let item: WorkItem;
    if (pendingItem === undefined) {
      item = await create.mutateAsync({ source: 'manual', sourceKey: null, title, stages: ['intake'] });
      pendingItemRef.current = { stage: forStage, title, item };
    } else if (pendingItem.title !== title) {
      item = await update.mutateAsync({ id: pendingItem.item.id, patch: { title } });
      pendingItemRef.current = { stage: forStage, title, item };
    } else {
      item = pendingItem.item;
    }
    if (forStage !== 'intake') {
      const result = await transition.mutateAsync({ item, board: 'work', stage: forStage, cause: 'manual_creation' });
      if (result.status === 'rejected') throw new Error(result.reason);
    }
    pendingItemRef.current = undefined;
  };

  return {
    stage,
    open: setStage,
    close: (closing: BoardStageId) => {
      if (pendingItemRef.current?.stage === closing) pendingItemRef.current = undefined;
      closedStageRef.current = closing;
      setStage(current => (current === closing ? undefined : current));
    },
    registerTrigger: (forStage: BoardStageId) => (element: HTMLButtonElement | null) => {
      if (element) triggerRefs.current.set(forStage, element);
      else triggerRefs.current.delete(forStage);
    },
    submit,
  };
}
