import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { coreFeatures } from '@mastra/core/features';

export const OBSERVABILITY_DELTA_POLLING_FEATURE = 'observability-delta-polling';

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

export function encodeDeltaCursor(value: unknown): string {
  return String(value ?? 0);
}

export function validateCursorId(cursor: string): string {
  if (!/^\d+$/.test(cursor)) {
    throw new MastraError({
      id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.USER,
      text: 'Invalid observability delta cursor',
    });
  }

  return cursor;
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
