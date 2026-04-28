const SCHEMA_FIELD_PATTERN = /(^schema$|schema$|^parameters$)/i;

export function normalizeResponse(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map(item => normalizeResponse(item, key));

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized = Object.fromEntries(
      Object.entries(record)
        .filter(([entryKey]) => entryKey !== '$schema')
        .map(([entryKey, entryValue]) => [entryKey, normalizeResponse(entryValue, entryKey)]),
    );

    if (key && isSchemaField(key) && Object.keys(normalized).length === 1 && Object.hasOwn(normalized, 'json')) {
      return normalized.json;
    }

    return normalized;
  }

  if (typeof value === 'string' && key && isSchemaField(key)) {
    return parseSchemaString(value);
  }

  return value;
}

function isSchemaField(key: string): boolean {
  return SCHEMA_FIELD_PATTERN.test(key);
}

function parseSchemaString(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return value;

  try {
    return normalizeResponse(JSON.parse(trimmed));
  } catch {
    return value;
  }
}
