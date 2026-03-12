'use client';

import { useCallback, useState } from 'react';

export interface ItemSelectionState {
  /** Set of currently selected item IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectedCount: number;
  /** Toggle single item or range selection with shift key */
  toggle: (id: string, shiftKey: boolean, allIds: string[]) => void;
  /** Select all provided IDs */
  selectAll: (ids: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
}

/**
 * Hook for managing item selection state
 * Supports single toggle, shift-click range selection, and select all
 */
export function useItemSelection(): ItemSelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string, shiftKey: boolean, allIds: string[]) => {
      setSelectedIds(prev => {
        const next = new Set(prev);

        if (shiftKey && lastClickedId !== null) {
          // Range selection: find indices and select all between
          const lastIndex = allIds.indexOf(lastClickedId);
          const currentIndex = allIds.indexOf(id);

          if (lastIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);

            for (let i = start; i <= end; i++) {
              next.add(allIds[i]);
            }
          }
        } else {
          // Single toggle
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }

        return next;
      });

      // Always update last clicked ID
      setLastClickedId(id);
    },
    [lastClickedId],
  );

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedId(null);
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    selectAll,
    clearSelection,
  };
}
