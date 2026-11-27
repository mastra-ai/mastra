import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import { useIntakeOrderQuery, useSaveIntakeOrder } from '../../../../../hooks/useIntakeOrder';

/**
 * The project's intake order with any unsaved reordering on top, and saving it. A board added or removed meanwhile
 * makes the draft stale: the saved order shows again.
 */
export function useOrderDraft(factoryId: string) {
  const query = useIntakeOrderQuery(factoryId);
  const save = useSaveIntakeOrder(factoryId);
  const [kept, setDraft] = useState<string[]>();

  const saved = query.data?.boards.map(board => board.boardKey) ?? [];
  const draft = kept && sameBoards(kept, saved) ? kept : undefined;
  const shown = draft ?? saved;
  const sortable = (query.data?.canEdit ?? false) && shown.length > 1;

  const move = (from: number, to: number) => {
    const next = [...shown];
    const [key] = next.splice(from, 1);
    if (key === undefined) return;
    next.splice(to, 0, key);
    setDraft(next);
  };
  const onSave = () =>
    save.mutate(shown, {
      onSuccess: () => {
        setDraft(undefined);
        toast.success('Intake order saved.');
      },
      onError: error => toast.error(error.message),
    });

  return {
    query,
    saved,
    /** The order on screen: the draft, else the saved one. */
    shown,
    changed: draft !== undefined && draft.some((key, index) => key !== saved[index]),
    /** The caller may change the order and there is more than one board. */
    sortable,
    /** Sortable and not mid-save. */
    movable: sortable && !save.isPending,
    saving: save.isPending,
    move,
    save: onSave,
    discard: () => setDraft(undefined),
  };
}

function sameBoards(draft: readonly string[], saved: readonly string[]): boolean {
  const keys = new Set(saved);
  return draft.length === saved.length && draft.every(key => keys.has(key));
}
