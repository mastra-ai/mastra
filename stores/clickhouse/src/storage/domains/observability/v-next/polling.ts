import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { coreFeatures } from '@mastra/core/features';

export const OBSERVABILITY_DELTA_POLLING_FEATURE = 'observability-delta-polling';

export type ClickHouseDeltaCursorStrategy = 'serial' | 'fallback';

export function deltaPollingFeatureEnabled(): boolean {
  return coreFeatures.has(OBSERVABILITY_DELTA_POLLING_FEATURE);
}

export function deltaPollingSupported(
  strategy: ClickHouseDeltaCursorStrategy | null,
): strategy is ClickHouseDeltaCursorStrategy {
  return deltaPollingFeatureEnabled() && strategy !== null;
}

export function assertDeltaPollingSupported(
  strategy: ClickHouseDeltaCursorStrategy | null,
): asserts strategy is ClickHouseDeltaCursorStrategy {
  if (deltaPollingSupported(strategy)) {
    return;
  }

  throw new MastraError({
    id: 'OBSERVABILITY_DELTA_POLLING_NOT_SUPPORTED',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.SYSTEM,
    text: 'This storage provider does not support observability delta polling',
  });
}

export function validateCursorId(cursor: string): string {
  if (/^\d+$/.test(cursor)) {
    return cursor;
  }

  throw new MastraError({
    id: 'OBSERVABILITY_INVALID_DELTA_CURSOR',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.USER,
    text: 'Invalid observability delta cursor',
  });
}
