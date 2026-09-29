export function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(Math.round(tokens));
}

export function compressionRatio(inputTokens?: number, outputTokens?: number): number | undefined {
  return inputTokens && outputTokens ? Math.round(inputTokens / outputTokens) : undefined;
}

const hasExtractedValue = (value: unknown) => value !== undefined && value !== null && value !== '';

export function extractedValueEntries(values?: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(values ?? {}).filter(([, value]) => hasExtractedValue(value));
}

export function formatExtractedValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
