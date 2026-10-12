import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort, SortAccessors } from '@mastra/playground-ui/sort/sort-by';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function orderRoster<T extends { id: string; name: string }, K extends string>(
  rows: T[],
  { sort, accessors, isActive }: { sort: ListSort<K>; accessors: SortAccessors<T, K>; isActive: (row: T) => boolean },
) {
  const byName = (left: T, right: T) => collator.compare(left.name, right.name);
  const active = sortBy(rows.filter(isActive).toSorted(byName), sort, accessors);
  const idle = rows.filter(row => !isActive(row)).toSorted(byName);
  return [...active, ...idle];
}

export function matchesSearch(search: string, texts: (string | undefined)[]) {
  const query = search.trim().toLowerCase();
  return !query || texts.some(text => text?.toLowerCase().includes(query));
}
