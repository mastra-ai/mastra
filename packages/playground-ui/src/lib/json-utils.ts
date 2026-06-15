const MAX_EXPAND_DEPTH = 5;

function expandNode(value: unknown, depth: number): unknown {
  if (depth >= MAX_EXPAND_DEPTH) return value;

  if (typeof value === 'string') {
    const trimmed = value.trimStart();
    if (trimmed[0] !== '{' && trimmed[0] !== '[') return value;
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        return expandNode(parsed, depth + 1);
      }
    } catch {
      // not valid JSON — leave as-is
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => expandNode(item, depth + 1));
  }

  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = expandNode(v, depth + 1);
    }
    return result;
  }

  return value;
}

/**
 * Walks a JSON string, replacing any string value whose content is valid JSON
 * with the parsed structure (up to MAX_EXPAND_DEPTH levels deep), then
 * re-serialises the whole thing. Returns the original string unchanged if the
 * top-level parse fails.
 */
export function expandEmbeddedJsonStrings(codeStr: string): string {
  if (!codeStr) return codeStr;
  try {
    const parsed: unknown = JSON.parse(codeStr);
    const expanded = expandNode(parsed, 0);
    return JSON.stringify(expanded, null, 2);
  } catch {
    return codeStr;
  }
}
