import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { coreFeatures } from '@mastra/core/features';

export const OBSERVABILITY_DELTA_POLLING_FEATURE = 'observability-delta-polling';

const DELTA_CURSOR_PREFIX = 'duckdb:';

export function deltaPollingFeatureEnabled(): boolean {
  return coreFeatures.has(OBSERVABILITY_DELTA_POLLING_FEATURE);
}

export function assertDeltaPollingEnabled(): void {
  if (deltaPollingFeatureEnabled()) {
    return;
  }

  throw new MastraError({
    id: 'OBSERVABILITY_DELTA_POLLING_NOT_SUPPORTED',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.SYSTEM,
    text: 'This storage provider does not support observability delta polling',
  });
}

export function normalizeCursorId(value: unknown): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'bigint') {
    if (value < 0n) {
      return null;
    }
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      return null;
    }
    return BigInt(value);
  }

  if (typeof value === 'string') {
    if (!/^\d+$/.test(value)) {
      return null;
    }
    return BigInt(value);
  }

  return null;
}

export function encodeDeltaCursor(value: unknown): string | null {
  const cursorId = normalizeCursorId(value);
  if (cursorId === null) {
    return null;
  }

  return `${DELTA_CURSOR_PREFIX}${cursorId.toString()}`;
}

export function decodeDeltaCursor(cursor: string): bigint {
  if (!cursor.startsWith(DELTA_CURSOR_PREFIX)) {
    throw new MastraError({
      id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.USER,
      text: 'Invalid observability delta cursor',
    });
  }

  const rawValue = cursor.slice(DELTA_CURSOR_PREFIX.length);
  if (!/^\d+$/.test(rawValue)) {
    throw new MastraError({
      id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.USER,
      text: 'Invalid observability delta cursor',
    });
  }

  return BigInt(rawValue);
}

export function extendWhereClause(baseClause: string, extraConditions: string[]): string {
  const conditions = extraConditions.filter(Boolean);
  if (conditions.length === 0) {
    return baseClause;
  }

  if (!baseClause) {
    return `WHERE ${conditions.join(' AND ')}`;
  }

  return `${baseClause} AND ${conditions.join(' AND ')}`;
}
