/** Array filters where a row must carry every value, so ANDing two lists needs all of both. */
const ALL_OF = new Set(['tags']);
/** Object filters matched exactly per key (`labels`, `metadata`). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const CLASH = Symbol('clash');

/** Two values of one field ANDed: always built from that field's own values, so it keeps their type. */
function both(field: string, a: unknown, b: unknown): unknown {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left: unknown[] = Array.isArray(a) ? a : [a];
    const right: unknown[] = Array.isArray(b) ? b : [b];
    if (ALL_OF.has(field)) return [...new Set([...left, ...right])];
    const shared = left.filter(v => right.includes(v));
    return shared.length ? shared : CLASH;
  }
  if (isRecord(a) && isRecord(b)) return intersectFilters(a, b) ?? CLASH;
  return a === b ? a : CLASH;
}

/**
 * ANDs the page's metrics or scores filters with a widget's: a field set on one side is kept; set on
 * both, lists of alternatives intersect (`tags`, which must all match, combine), per-key maps merge, and
 * single values must be equal. `undefined` when the two contradict, so nothing can match.
 */
export function intersectFilters<F extends object>(
  page: F | undefined,
  widget: Partial<F> | undefined,
): Partial<F> | undefined {
  if (!page) return widget;
  if (!widget) return page;
  let merged: Partial<F> = page;
  for (const field in widget) {
    const value = widget[field];
    if (value === undefined) continue;
    const current = merged[field];
    const combined = current === undefined ? value : both(field, current, value);
    if (combined === CLASH) return undefined;
    merged = { ...merged, [field]: combined };
  }
  return merged;
}
