'use client';

import { useState } from 'react';

/** Selection over a page of results; results that are no longer loaded drop out of `selectedResults`. */
export function useResultsSelection<TResult extends { id: string }>(results: TResult[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleSelect = (resultId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      results.length > 0 && results.every(r => prev.has(r.id)) ? new Set() : new Set(results.map(r => r.id)),
    );
  };

  const deselect = (resultIds: Iterable<string>) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of resultIds) next.delete(id);
      return next;
    });
  };

  return {
    selectedIds,
    selectedResults: results.filter(r => selectedIds.has(r.id)),
    toggleSelect,
    toggleSelectAll,
    deselect,
    clearSelection: () => setSelectedIds(new Set()),
  };
}
