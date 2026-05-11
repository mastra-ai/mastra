import type { LiveCursor } from '@mastra/core/storage';
import { DuckDBConnection } from '../../db/index';

/** Shorthand for {@link DuckDBConnection.sqlValue}. */
export const v = DuckDBConnection.sqlValue;

/** Serialize a value to JSON then SQL-escape it, or return 'NULL'. */
export function jsonV(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  return DuckDBConnection.sqlValue(JSON.stringify(val));
}

/** Coerce a value to a Date. Throws if value is nullish. */
export function toDate(val: unknown): Date {
  if (val === null || val === undefined) {
    throw new Error('Expected date value but received null/undefined');
  }
  const date = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(date.getTime())) {
    throw new Error('Expected valid date but received invalid date');
  }
  return date;
}

/** Coerce a value to a Date, returning null for nullish values. */
export function toDateOrNull(val: unknown): Date | null {
  if (val === null || val === undefined) return null;
  return val instanceof Date ? val : new Date(String(val));
}

/** Parse a JSON string, returning the original value if parsing fails. */
export function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** Parse a JSON string and return the result only if it is an array. */
export function parseJsonArray(value: unknown): unknown[] | null {
  if (value === null || value === undefined) return null;
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : null;
}

let lastIngestedAtMs = 0;

type IngestedAtCursorPayload = {
  ingestedAt: string;
  tieBreaker: string;
};

function encodeCursorPayload(payload: IngestedAtCursorPayload): string {
  return JSON.stringify(payload);
}

function decodeCursorPayload(cursor: LiveCursor): IngestedAtCursorPayload {
  const parsed = JSON.parse(cursor) as Partial<IngestedAtCursorPayload>;
  if (typeof parsed.ingestedAt !== 'string' || typeof parsed.tieBreaker !== 'string') {
    throw new Error('Invalid live cursor payload');
  }
  return {
    ingestedAt: parsed.ingestedAt,
    tieBreaker: parsed.tieBreaker,
  };
}

export function createIngestedAt(): Date {
  const nowMs = Date.now();
  const ingestedAtMs = nowMs <= lastIngestedAtMs ? lastIngestedAtMs + 1 : nowMs;
  lastIngestedAtMs = ingestedAtMs;
  return new Date(ingestedAtMs);
}

export function createSyntheticNowCursor(base = createIngestedAt()): LiveCursor {
  return encodeCursorPayload({
    ingestedAt: base.toISOString(),
    tieBreaker: '!',
  });
}

export function createLiveCursor(ingestedAt: unknown, tieBreaker: string): LiveCursor {
  return encodeCursorPayload({
    ingestedAt: toDate(ingestedAt).toISOString(),
    tieBreaker,
  });
}

export function getLiveCursorParts(cursor: LiveCursor): { ingestedAt: Date; tieBreaker: string } {
  const payload = decodeCursorPayload(cursor);
  return {
    ingestedAt: toDate(payload.ingestedAt),
    tieBreaker: payload.tieBreaker,
  };
}

export function compareLiveCursors(a: LiveCursor, b: LiveCursor): number {
  const aParts = getLiveCursorParts(a);
  const bParts = getLiveCursorParts(b);
  const timeDiff = aParts.ingestedAt.getTime() - bParts.ingestedAt.getTime();
  if (timeDiff !== 0) return timeDiff;
  return aParts.tieBreaker.localeCompare(bParts.tieBreaker);
}

export function isLiveCursorAfter(candidate: LiveCursor, after: LiveCursor): boolean {
  return compareLiveCursors(candidate, after) > 0;
}

export function maxLiveCursor(cursors: Iterable<LiveCursor>): LiveCursor | null {
  let maxCursor: LiveCursor | null = null;
  for (const cursor of cursors) {
    if (maxCursor === null || compareLiveCursors(cursor, maxCursor) > 0) {
      maxCursor = cursor;
    }
  }
  return maxCursor;
}

// TODO(2.0): Replace this local coercion layer with shared observability parsing once runtime core-version compatibility is no longer required.
type PaginationArgs = {
  page?: unknown;
  perPage?: unknown;
};

type ObservabilityListArgsLike<TFilters, TOrderBy> = {
  mode?: 'page' | 'delta';
  filters?: TFilters;
  pagination?: PaginationArgs;
  orderBy?: Partial<TOrderBy> | Record<string, unknown>;
  after?: LiveCursor | { value?: unknown };
  limit?: unknown;
};

type NormalizedObservabilityListArgs<TFilters, TOrderBy> = {
  mode: 'page' | 'delta';
  filters: TFilters | undefined;
  pagination: { page: number; perPage: number };
  orderBy: TOrderBy;
  after: LiveCursor | undefined;
  limit: number;
};

export function normalizeObservabilityListArgs<TFilters, TOrderBy extends Record<string, unknown>>(
  args: ObservabilityListArgsLike<TFilters, TOrderBy>,
  defaults: {
    orderBy: TOrderBy;
    pagination?: { page: number; perPage: number };
    limit?: number;
  },
): NormalizedObservabilityListArgs<TFilters, TOrderBy> {
  const paginationDefaults = defaults.pagination ?? { page: 0, perPage: 10 };
  const limitDefault = defaults.limit ?? 10;
  const pagination = args.pagination ?? {};
  const orderBy = args.orderBy ?? {};

  return {
    mode: args.mode === 'delta' ? 'delta' : 'page',
    filters: args.filters,
    pagination: {
      page:
        typeof pagination.page === 'number' && Number.isInteger(pagination.page) && pagination.page >= 0
          ? pagination.page
          : paginationDefaults.page,
      perPage:
        typeof pagination.perPage === 'number' &&
        Number.isInteger(pagination.perPage) &&
        pagination.perPage >= 1 &&
        pagination.perPage <= 100
          ? pagination.perPage
          : paginationDefaults.perPage,
    },
    orderBy: { ...defaults.orderBy, ...orderBy } as TOrderBy,
    after:
      typeof args.after === 'string'
        ? args.after
        : args.after && typeof args.after.value === 'string'
          ? args.after.value
          : undefined,
    limit:
      typeof args.limit === 'number' && Number.isInteger(args.limit) && args.limit >= 1 && args.limit <= 100
        ? args.limit
        : limitDefault,
  };
}
