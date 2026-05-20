export function isArrayOfRecords(value: unknown): value is Record<string, unknown>[] {
  return value !== null && value !== undefined && Array.isArray(value);
}

export function deserializeValue(value: unknown, type?: string): unknown {
  if (value === null || value === undefined) return null;

  if (type === 'date' && typeof value === 'string') {
    return new Date(value);
  }

  if (type === 'jsonb' && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}
