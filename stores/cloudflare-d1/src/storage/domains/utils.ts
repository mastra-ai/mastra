export function isArrayOfRecords(value: any): value is Record<string, any>[] {
  return value && Array.isArray(value) && value.length > 0;
}

export function deserializeValue(value: any, type?: string): any {
  if (value === null || value === undefined) return null;

  if (type === 'date' && typeof value === 'string') {
    return new Date(value);
  }

  if (type === 'jsonb' && typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return value;
    }
  }

  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      return JSON.parse(value) as Record<string, any>;
    } catch {
      return value;
    }
  }

  return value;
}
