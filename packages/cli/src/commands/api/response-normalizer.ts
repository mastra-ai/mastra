const SCHEMA_KEY_PATTERN = /schema$/i;

/** Compacts schema-like values throughout API responses for CLI-friendly JSON output. */
export function normalizeResponse(value: unknown): unknown {
  return normalizeValue(value);
}

function normalizeValue(value: unknown, key?: string): unknown {
  const parsed = typeof value === 'string' && isSchemaKey(key) ? parseSchemaString(value) : value;

  if (Array.isArray(parsed)) return parsed.map(item => normalizeValue(item));
  if (!parsed || typeof parsed !== 'object') return parsed;

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>)
      .filter(([entryKey]) => entryKey !== '$schema')
      .map(([entryKey, entryValue]) => [entryKey, normalizeValue(entryValue, entryKey)]),
  );
}

function isSchemaKey(key: string | undefined): boolean {
  return key !== undefined && SCHEMA_KEY_PATTERN.test(key);
}

function parseSchemaString(value: string): unknown {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && 'json' in parsed ? (parsed as { json: unknown }).json : parsed;
  } catch {
    return value;
  }
}
