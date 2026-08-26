const MAX_LENGTH = 160;

function clamp(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > MAX_LENGTH ? `${trimmed.slice(0, MAX_LENGTH)}…` : trimmed;
}

/**
 * Best-effort one-line summary of an arbitrary span payload.
 * Always degrades to `undefined` rather than throwing (decision 3).
 */
export function summarize(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return clamp(value) || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    const parts = value.map(summarize).filter(Boolean);
    return parts.length ? clamp(parts.join(', ')) : undefined;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['text', 'message', 'content', 'result', 'value']) {
      const nested = summarize(record[key]);
      if (nested) return nested;
    }
    try {
      const json = JSON.stringify(record);
      return json && json !== '{}' ? clamp(json) : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}
