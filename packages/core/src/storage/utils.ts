import type { StoragePagination } from './types';

export function safelyParseJSON(input: any): any {
  // If already an object (and not null), return as-is
  if (input && typeof input === 'object') return input;
  if (input == null) return {};
  // If it's a string, try to parse
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  // For anything else (number, boolean, etc.), return empty object
  return {};
}

export function normalizePagination(pagination?: StoragePagination) {
  const page = Math.max(0, pagination?.page ?? 0);
  const perPage = Math.max(1, pagination?.perPage ?? 10);
  const offset = page * perPage;

  return {
    page,
    perPage,
    offset,
  };
}
