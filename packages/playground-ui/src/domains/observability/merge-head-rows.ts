export type MergeHeadRowsOptions<Row> = {
  getId: (row: Row) => string;
  /** The list's own order: negative when `a` is listed before `b`. */
  compare: (a: Row, b: Row) => number;
  /** Rows sorting past the last loaded row are left for keyset pagination while more pages exist. */
  hasNextPage: boolean;
};

function shallowEqual<Row>(a: Row, b: Row): boolean {
  if (a === b) return true;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(key => Object.is(left[key], right[key]));
}

/**
 * Merges freshly polled head rows into the rendered list without touching page cursors.
 * A head row replaces the listed row with the same id; it moves when its sort value changed.
 * New rows are inserted at their sorted position, or skipped when they sort past the last
 * loaded row and the next page can still bring them. Returns `list` itself when nothing changes.
 */
export function mergeHeadRows<Row>(list: Row[], head: Row[], options: MergeHeadRowsOptions<Row>): Row[] {
  if (head.length === 0) return list;
  const { getId, compare, hasNextPage } = options;

  const headById = new Map(head.map(row => [getId(row), row]));
  let changed = false;

  const kept: Row[] = [];
  for (const row of list) {
    const id = getId(row);
    const next = headById.get(id);
    if (next === undefined) {
      kept.push(row);
      continue;
    }
    headById.delete(id);
    if (shallowEqual(row, next)) {
      kept.push(row);
    } else if (compare(row, next) === 0) {
      kept.push(next);
      changed = true;
    } else {
      // Its sort value moved: re-insert it below with the new rows.
      headById.set(id, next);
      changed = true;
    }
  }

  const pending = [...headById.values()].sort(compare);
  if (pending.length === 0) return changed ? kept : list;

  const last = kept[kept.length - 1];
  const merged: Row[] = [];
  let i = 0;
  for (const row of pending) {
    if (hasNextPage && (last === undefined || compare(row, last) >= 0)) break;
    for (let next = kept[i]; next !== undefined && compare(next, row) <= 0; next = kept[++i]) merged.push(next);
    merged.push(row);
    changed = true;
  }
  merged.push(...kept.slice(i));

  return changed ? merged : list;
}
