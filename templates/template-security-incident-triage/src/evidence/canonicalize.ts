import { DomainError } from '../domain/errors.js';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return value.normalize('NFC');
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new DomainError('VALIDATION_FAILED');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort((left, right) => left.localeCompare(right, 'en'))
        .map(key => {
          const child = record[key];
          if (child === undefined) throw new DomainError('VALIDATION_FAILED');
          return [key.normalize('NFC'), normalize(child)];
        }),
    );
  }
  throw new DomainError('VALIDATION_FAILED');
}
