import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { coreFeatures } from '@mastra/core/features';

export const OBSERVABILITY_DELTA_POLLING_FEATURE = 'observability-delta-polling';

const LIVE_CURSOR_PREFIX = 'clickhouse:';
const LIVE_CURSOR_VERSION = 1;

export type ClickHouseDeltaCursorStrategy = 'serial' | 'tuple';

export type ClickHouseLiveCursor =
  | { version: 1; kind: 'serial'; cursorId: string }
  | { version: 1; kind: 'trace'; ingestedAt: string; startedAt: string; traceId: string; dedupeKey: string }
  | {
      version: 1;
      kind: 'branch';
      ingestedAt: string;
      spanType: string;
      startedAt: string;
      traceId: string;
      spanId: string;
      dedupeKey: string;
    }
  | { version: 1; kind: 'log'; ingestedAt: string; timestamp: string; logId: string }
  | { version: 1; kind: 'metric'; ingestedAt: string; name: string; timestamp: string; metricId: string }
  | { version: 1; kind: 'score'; ingestedAt: string; traceId: string; timestamp: string; scoreId: string }
  | { version: 1; kind: 'feedback'; ingestedAt: string; traceId: string; timestamp: string; feedbackId: string };

type TupleCursorColumn = {
  expr: string;
  param: string;
  type: string;
  value: string;
};

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

export function assertDeltaPollingSupported(
  strategy: ClickHouseDeltaCursorStrategy | null,
): asserts strategy is ClickHouseDeltaCursorStrategy {
  assertDeltaPollingEnabled();

  if (strategy !== null) {
    return;
  }

  throw new MastraError({
    id: 'OBSERVABILITY_DELTA_POLLING_NOT_SUPPORTED',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.SYSTEM,
    text: 'This storage provider does not support observability delta polling',
  });
}

export function normalizeCursorId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    if (!/^\d+$/.test(value)) {
      return null;
    }
    return BigInt(value).toString();
  }

  if (typeof value === 'bigint') {
    if (value < 0n) {
      return null;
    }
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      return null;
    }
    return BigInt(value).toString();
  }

  return null;
}

export function invalidLiveCursorError(): MastraError {
  return new MastraError({
    id: 'OBSERVABILITY_INVALID_LIVE_CURSOR',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.USER,
    text: 'Invalid observability live cursor',
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidLiveCursorError();
  }
  return value;
}

function decodeLiveCursorPayload(payload: unknown): ClickHouseLiveCursor {
  if (!isPlainObject(payload) || payload.v !== LIVE_CURSOR_VERSION || typeof payload.kind !== 'string') {
    throw invalidLiveCursorError();
  }

  switch (payload.kind) {
    case 'serial': {
      const cursorId = normalizeCursorId(payload.cursorId);
      if (cursorId === null) {
        throw invalidLiveCursorError();
      }
      return { version: 1, kind: 'serial', cursorId };
    }
    case 'trace':
      return {
        version: 1,
        kind: 'trace',
        ingestedAt: expectString(payload.ingestedAt),
        startedAt: expectString(payload.startedAt),
        traceId: expectString(payload.traceId),
        dedupeKey: expectString(payload.dedupeKey),
      };
    case 'branch':
      return {
        version: 1,
        kind: 'branch',
        ingestedAt: expectString(payload.ingestedAt),
        spanType: expectString(payload.spanType),
        startedAt: expectString(payload.startedAt),
        traceId: expectString(payload.traceId),
        spanId: expectString(payload.spanId),
        dedupeKey: expectString(payload.dedupeKey),
      };
    case 'log':
      return {
        version: 1,
        kind: 'log',
        ingestedAt: expectString(payload.ingestedAt),
        timestamp: expectString(payload.timestamp),
        logId: expectString(payload.logId),
      };
    case 'metric':
      return {
        version: 1,
        kind: 'metric',
        ingestedAt: expectString(payload.ingestedAt),
        name: expectString(payload.name),
        timestamp: expectString(payload.timestamp),
        metricId: expectString(payload.metricId),
      };
    case 'score':
      return {
        version: 1,
        kind: 'score',
        ingestedAt: expectString(payload.ingestedAt),
        traceId: expectString(payload.traceId),
        timestamp: expectString(payload.timestamp),
        scoreId: expectString(payload.scoreId),
      };
    case 'feedback':
      return {
        version: 1,
        kind: 'feedback',
        ingestedAt: expectString(payload.ingestedAt),
        traceId: expectString(payload.traceId),
        timestamp: expectString(payload.timestamp),
        feedbackId: expectString(payload.feedbackId),
      };
    default:
      throw invalidLiveCursorError();
  }
}

export function encodeLiveCursor(value: ClickHouseLiveCursor | null): string | null {
  if (value === null) {
    return null;
  }

  const payload =
    value.kind === 'serial'
      ? { v: LIVE_CURSOR_VERSION, kind: value.kind, cursorId: normalizeCursorId(value.cursorId) }
      : { v: LIVE_CURSOR_VERSION, ...value };

  if (payload.kind === 'serial' && payload.cursorId === null) {
    return null;
  }

  return `${LIVE_CURSOR_PREFIX}${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

export function decodeLiveCursor(cursor: string): ClickHouseLiveCursor {
  if (!cursor.startsWith(LIVE_CURSOR_PREFIX)) {
    throw invalidLiveCursorError();
  }

  const rawValue = cursor.slice(LIVE_CURSOR_PREFIX.length);
  const normalized = normalizeCursorId(rawValue);

  if (normalized !== null) {
    return { version: 1, kind: 'serial', cursorId: normalized };
  }

  try {
    const payload = JSON.parse(Buffer.from(rawValue, 'base64url').toString('utf8'));
    return decodeLiveCursorPayload(payload);
  } catch {
    throw invalidLiveCursorError();
  }
}

export function assertCursorKind<TKind extends ClickHouseLiveCursor['kind']>(
  cursor: ClickHouseLiveCursor,
  ...expectedKinds: TKind[]
): Extract<ClickHouseLiveCursor, { kind: TKind }> {
  if (expectedKinds.includes(cursor.kind as TKind)) {
    return cursor as Extract<ClickHouseLiveCursor, { kind: TKind }>;
  }
  throw invalidLiveCursorError();
}

export function buildTupleCursorFilter(columns: TupleCursorColumn[]): {
  clause: string;
  params: Record<string, string>;
} {
  return {
    clause: `(${columns.map(column => column.expr).join(', ')}) > (${columns.map(column => `{${column.param}:${column.type}}`).join(', ')})`,
    params: Object.fromEntries(columns.map(column => [column.param, column.value])),
  };
}
