import type { SavedViewPage, SavedViewState } from '@mastra/core/storage';
import { SavedViewNameTakenError } from '../../saved-views-source';
import type { SavedViewRecord, SavedViewsSource } from '../../saved-views-source';

export type InMemorySavedViewsSource = SavedViewsSource & {
  /** Every request the views sent, in order. */
  calls: { method: 'list' | 'create' | 'update' | 'remove'; args: unknown[] }[];
  records: () => SavedViewRecord[];
};

/**
 * A `SavedViewsSource` that keeps views in memory with the rules of a real store: names are unique
 * per page (case-insensitively, a clash rejects with `SavedViewNameTakenError`) and lists are
 * newest-updated first.
 */
export function createInMemorySavedViewsSource(
  initial: { name: string; state: SavedViewState; scope?: SavedViewRecord['scope'] }[] = [],
): InMemorySavedViewsSource {
  let clock = Date.parse('2026-10-01T00:00:00.000Z');
  const tick = () => new Date((clock += 1000)).toISOString();
  let nextId = 1;
  let records: SavedViewRecord[] = initial.map(view => ({ ...view, id: `view-${nextId++}`, updatedAt: tick() }));
  const calls: InMemorySavedViewsSource['calls'] = [];

  const assertNameFree = (page: SavedViewPage, name: string, exceptId?: string) => {
    const taken = records.some(
      record =>
        record.id !== exceptId && record.state.page === page && record.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) throw new SavedViewNameTakenError();
  };

  return {
    calls,
    records: () => records,
    list: async page => {
      calls.push({ method: 'list', args: [page] });
      return records
        .filter(record => record.state.page === page)
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    create: async input => {
      calls.push({ method: 'create', args: [input] });
      assertNameFree(input.state.page, input.name);
      const record: SavedViewRecord = { id: `view-${nextId++}`, ...input, updatedAt: tick() };
      records = [...records, record];
      return record;
    },
    update: async (id, patch) => {
      calls.push({ method: 'update', args: [id, patch] });
      const current = records.find(record => record.id === id);
      if (!current) throw new Error(`No saved view ${id}`);
      if (patch.name !== undefined) assertNameFree(current.state.page, patch.name, id);
      const updated: SavedViewRecord = { ...current, ...patch, updatedAt: tick() };
      records = records.map(record => (record.id === id ? updated : record));
      return updated;
    },
    remove: async id => {
      calls.push({ method: 'remove', args: [id] });
      records = records.filter(record => record.id !== id);
    },
  };
}
