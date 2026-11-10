/**
 * Most MCP clients cap a tool result at roughly 25k tokens (Claude Code drops larger results). Tools that
 * return lists keep their serialized result under this many characters.
 */
export const MAX_RESULT_CHARS = 40_000;

/** String lengths tried, longest first, when clipping a value that doesn't fit. */
const CLIP_LENGTHS = [10_000, 2_000, 500, 100];

/** Ids stay whole so the caller can still look the full item up (`id`, `spanId`, `trace_id`, ...). */
const isIdKey = (key: string) => key === 'id' || /(Id|_id)$/.test(key);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

const fits = (value: unknown) => JSON.stringify(value).length <= MAX_RESULT_CHARS;

/** Cuts every string longer than `max` to `max` characters plus a marker; keys, ids and other values stay. */
function clipStrings(value: unknown, max: number, detail?: string): unknown {
  if (typeof value === 'string') {
    if (value.length <= max) return value;
    const how = detail ? `, use ${detail} for the full value` : '';
    return `${value.slice(0, max)}[truncated ${value.length - max} chars${how}]`;
  }
  if (Array.isArray(value)) return value.map(item => clipStrings(item, max, detail));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, isIdKey(key) ? item : clipStrings(item, max, detail)]),
    );
  }
  return value;
}

/** `build` with its long strings clipped as little as it takes to fit (or down to 100 characters). */
function clipToFit(build: (clip: (value: unknown) => unknown) => unknown, detail?: string): unknown {
  let clipped: unknown;
  for (const max of CLIP_LENGTHS) {
    clipped = build(value => clipStrings(value, max, detail));
    if (fits(clipped)) break;
  }
  return clipped;
}

/**
 * Keeps a single-record result under {@link MAX_RESULT_CHARS} by clipping its long strings. `detail` names the
 * tool that returns full values, if there is one. Results that already fit pass through unchanged.
 */
export function fitValue(result: unknown, detail?: string): unknown {
  return fits(result) ? result : clipToFit(clip => clip(result), detail);
}

interface FitRowsOptions {
  /** Pagination fields (`page`, `hasMore`, ...): dropped when rows are cut, since they would skip those rows. */
  cursors?: string[];
  /** Other, unclipped views of the same rows (`uiMessages`): dropped whenever the result is cut or clipped. */
  views?: string[];
  /** Tool that returns full values, named in the marker of clipped strings. */
  detail?: string;
}

/**
 * Keeps a list result under {@link MAX_RESULT_CHARS} by dropping trailing rows of `key` and says how to page.
 * It always keeps at least one row: when the first row alone is too big, its long strings are clipped. Results
 * that already fit, or aren't a list, pass through unchanged.
 */
export function fitRows(
  result: unknown,
  key: string,
  hint: string,
  { cursors = [], views = [], detail }: FitRowsOptions = {},
): unknown {
  if (!isObject(result) || !Array.isArray(result[key]) || fits(result)) return result;
  const rows = result[key] as unknown[];
  const without = (fields: string[]) =>
    Object.fromEntries(Object.entries(result).filter(([field]) => field !== key && !fields.includes(field)));
  const rest = without([...cursors, ...views]);
  const build = (count: number) => ({
    ...rest,
    [key]: rows.slice(0, count),
    truncated: `Only the first ${count} of ${rows.length} ${key} fit in one result. ${hint}`,
  });
  // Largest prefix that fits.
  let low = 0;
  let high = rows.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(build(mid))) low = mid;
    else high = mid - 1;
  }
  if (low > 0 || rows.length === 0) return build(low);
  // Keep the first row, clipped. Cursors stay when that is every row: nothing was skipped.
  const kept = rows.length > 1 ? rest : without(views);
  return clipToFit(
    clip => ({
      ...kept,
      [key]: [clip(rows[0])],
      truncated:
        rows.length > 1
          ? `Only the first of ${rows.length} ${key} fits in one result, with its long values cut. ${hint}`
          : `Long values in the ${key} were cut to fit in one result.`,
    }),
    detail,
  );
}
