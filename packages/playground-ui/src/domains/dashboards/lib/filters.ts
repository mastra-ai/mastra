type Filters = Record<string, unknown>;

/** Array filters where a row must carry every value, so ANDing two lists needs all of both. */
const ALL_OF = new Set(['tags']);
/** Object filters matched exactly per key (`labels`, `metadata`). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const CLASH = Symbol('clash');

function both(field: string, a: unknown, b: unknown): unknown {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    if (ALL_OF.has(field)) return [...new Set([...left, ...right])];
    const shared = left.filter(v => right.includes(v));
    return shared.length ? shared : CLASH;
  }
  if (isRecord(a) && isRecord(b)) {
    const merged = intersectFilters(a, b);
    return merged ?? CLASH;
  }
  return a === b ? a : CLASH;
}

/**
 * ANDs the page's metrics or scores filters with a widget's: a field set on one side is kept; set on
 * both, lists of alternatives intersect (`tags`, which must all match, combine), per-key maps merge, and
 * single values must be equal. `undefined` when the two contradict, so nothing can match.
 */
export function intersectFilters(page: Filters | undefined, widget: Filters | undefined): Filters | undefined {
  const merged: Filters = { ...page };
  for (const [field, value] of Object.entries(widget ?? {})) {
    if (value === undefined) continue;
    if (merged[field] === undefined) {
      merged[field] = value;
      continue;
    }
    const combined = both(field, merged[field], value);
    if (combined === CLASH) return undefined;
    merged[field] = combined;
  }
  return merged;
}
