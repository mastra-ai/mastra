const repair = (value: string): string =>
  value
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
    .replaceAll('\0', '');

/** Serialize JSON values without emitting Unicode sequences PostgreSQL rejects. */
export function toPgJson(value: unknown): string {
  const normalized = new WeakMap<object, object>();
  return JSON.stringify(value, (_key, entry) => {
    if (typeof entry === 'string') return repair(entry);
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const existing = normalized.get(entry);
      if (existing) return existing;
      const copy = Object.fromEntries(Object.entries(entry).map(([key, item]) => [repair(key), item]));
      normalized.set(entry, copy);
      normalized.set(copy, copy);
      return copy;
    }
    return entry;
  });
}

/** Sanitize an already-serialized JSON string. Prefer toPgJson for original values. */
export function sanitizeJsonForPg(jsonString: string): string {
  return toPgJson(JSON.parse(jsonString.replace(/(^|[^\\])(\\(?!["\\/bfnrtu]))/g, '$1\\\\')));
}
