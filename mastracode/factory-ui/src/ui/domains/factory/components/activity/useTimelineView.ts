import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { EVERY_EVENT_PARAM } from '../../activity';
import { AUDIT_CATEGORIES } from '../../auditPresentation';
import type { AuditNamespace } from '../../auditPresentation';

export type ActivityGrouping = 'similar' | 'none';

const compactStore = createLocalStorageStore<boolean>({
  key: 'mastracode.activityTimeline.compact',
  defaultValue: false,
  parse: stored => {
    if (typeof stored !== 'boolean') throw new Error('Stored compact flag is not a boolean');
    return stored;
  },
});

/** Grouping lives in the URL so the old audit link can land ungrouped; density follows the person across visits. */
export function useTimelineView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const grouping: ActivityGrouping =
    searchParams.get(EVERY_EVENT_PARAM.key) === EVERY_EVENT_PARAM.value ? 'none' : 'similar';
  const compact = useLocalStorageStore(compactStore);
  const [categories, setCategories] = useState<ReadonlySet<AuditNamespace>>(() => new Set());

  const setGrouping = (next: ActivityGrouping) => {
    setSearchParams(
      current => {
        if (next === 'none') current.set(EVERY_EVENT_PARAM.key, EVERY_EVENT_PARAM.value);
        else current.delete(EVERY_EVENT_PARAM.key);
        return current;
      },
      { replace: true },
    );
  };

  const toggleCategory = (category: AuditNamespace) => {
    const next = new Set(categories);
    if (!next.delete(category)) next.add(category);
    setCategories(next.size === AUDIT_CATEGORIES.length ? new Set() : next);
  };
  const clearCategories = () => setCategories(new Set());

  const changedCount = [grouping !== 'similar', compact, categories.size > 0].filter(Boolean).length;

  return {
    grouping,
    compact,
    categories,
    changedCount,
    setGrouping,
    setCompact: (next: boolean) => compactStore.write(next),
    toggleCategory,
    clearCategories,
    reset: () => {
      setGrouping('similar');
      compactStore.write(false);
      clearCategories();
    },
  };
}
