export type SortDirection = 'asc' | 'desc';

export type ListSort<K extends string = string> = { key: K; direction: SortDirection } | undefined;

export type SortValue = string | number | Date | null | undefined;

export type SortAccessors<T, K extends string = string> = Partial<Record<K, (item: T) => SortValue>>;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareValues(left: SortValue, right: SortValue): number {
  const leftEmpty = left === undefined || left === null;
  const rightEmpty = right === undefined || right === null;
  if (leftEmpty && rightEmpty) return 0;
  // Empty values always go last regardless of direction; handled by caller.
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() - new Date(right).getTime();
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return collator.compare(String(left), String(right));
}

/**
 * Sorts `items` by the accessor registered under `sort.key`. Returns the input
 * instance when there is nothing to sort by. Empty values (`undefined`/`null`)
 * are always placed last; ties are broken by `id` so the order is stable.
 */
export function sortBy<T extends { id: string }, K extends string>(
  items: T[],
  sort: ListSort<K>,
  accessors: SortAccessors<T, K>,
): T[] {
  if (!sort) return items;
  const getValue = accessors[sort.key];
  if (!getValue) return items;

  const multiplier = sort.direction === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = getValue(left);
    const rightValue = getValue(right);
    const leftEmpty = leftValue === undefined || leftValue === null;
    const rightEmpty = rightValue === undefined || rightValue === null;

    if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1;

    const comparison = compareValues(leftValue, rightValue) || left.id.localeCompare(right.id);
    return comparison * multiplier;
  });
}

export function toggleSort<K extends string>(current: ListSort<K>, key: K): ListSort<K> {
  if (current?.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}
