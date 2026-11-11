import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** @internal Transported with failures, never inferred from messages or error codes. */
export interface SpanErrorOrigin {
  traceId: string;
  spanId: string;
  occurrenceId: string;
  attemptId?: string;
}

const attempts = new AsyncLocalStorage<string>();
const origins = new WeakMap<object, SpanErrorOrigin>();
const key = '__mastraSpanErrorOrigin';

function retryScope(attemptId: string | undefined): string | undefined {
  const boundary = attemptId?.lastIndexOf(':attempt:') ?? -1;
  return boundary < 0 ? undefined : attemptId!.slice(0, boundary);
}

/** @internal An actual retry gets a new scope; durable replay uses the same scope. */
export function withSpanErrorAttempt<T>(attemptId: string, fn: () => T): T {
  return attempts.run(attemptId, fn);
}

/** @internal Read through wrappers without retaining errors or traversing span trees. */
export function getSpanErrorOrigin(error: unknown): SpanErrorOrigin | undefined {
  const seen = new Set<object>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current) && seen.size < 32) {
    seen.add(current);
    let candidate: unknown;
    try {
      candidate = origins.get(current) ?? (current as Record<string, unknown>)[key];
    } catch {
      return undefined;
    }
    if (candidate && typeof candidate === 'object') {
      const origin = candidate as SpanErrorOrigin;
      if (
        typeof origin.traceId === 'string' &&
        typeof origin.spanId === 'string' &&
        typeof origin.occurrenceId === 'string' &&
        (origin.attemptId === undefined || typeof origin.attemptId === 'string')
      )
        return origin;
    }
    try {
      current = (current as { cause?: unknown }).cause;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** @internal Keep origin available to both local forwarding and error serializers. */
export function setSpanErrorOrigin(error: object, origin: SpanErrorOrigin): void {
  origins.set(error, origin);
  try {
    Object.defineProperty(error, key, { value: origin, enumerable: true, configurable: true });
  } catch {
    // Frozen errors still work in process through the WeakMap.
  }
}

/** @internal Return an occurrence only to the span where it originated. */
export function claimSpanError(
  error: Error,
  traceId: string,
  spanId: string,
  options?: { occurrenceId?: string; origin?: 'new' | 'propagated' },
): string | undefined {
  if (options?.origin === 'propagated') return undefined;
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) return undefined;
  const attemptId = attempts.getStore();
  let origin = getSpanErrorOrigin(error);
  const scope = retryScope(attemptId);
  if (
    options?.origin === 'new' ||
    !origin ||
    origin.traceId !== traceId ||
    (scope !== undefined && scope === retryScope(origin.attemptId) && attemptId !== origin.attemptId) ||
    (origin.spanId === spanId &&
      options?.occurrenceId !== undefined &&
      origin.occurrenceId !== options.occurrenceId &&
      attemptId !== undefined &&
      origin.attemptId !== attemptId)
  ) {
    origin = {
      traceId,
      spanId,
      occurrenceId: options?.occurrenceId ?? randomUUID(),
      ...(attemptId !== undefined ? { attemptId } : {}),
    };
  }
  setSpanErrorOrigin(error, origin);
  return origin.spanId === spanId ? origin.occurrenceId : undefined;
}
