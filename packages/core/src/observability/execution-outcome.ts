import { ensureSerializable } from '../utils/safe-stringify';
import { spanTerminationSchema } from './outcome-schema';
import type { SpanTermination, SpanTripwireContext } from './types/outcome';

/** Read a provider's structured code without inferring a cause from diagnostic text. */
function providerFailureCode(value: Record<string | symbol, unknown>): string | undefined {
  if (typeof value.code === 'string') return value.code;
  let data = value.data;
  if (data == null && typeof value.responseBody === 'string') {
    try {
      data = JSON.parse(value.responseBody);
    } catch {
      return undefined;
    }
  }
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  const error = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : record;
  return typeof error.code === 'string' ? error.code : undefined;
}

/** @internal Classify explicit failure facts, including wrapped/serialized causes. Never match error-message text. */
export function executionFailureTermination(
  error: unknown,
  layer: 'runtime_error' | 'model_error' = 'runtime_error',
): SpanTermination {
  const seen = new Set<unknown>();
  let current = error;
  let failure: Record<string, unknown> | undefined;
  let modelFailure = layer === 'model_error';
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const value = current as Record<string | symbol, unknown>;
    // Durable workflow transports wrap the original serialized error in a failed result.
    // The envelope itself has no diagnostic message or provider classification.
    if (value.status === 'failed' && value.error && typeof value.error === 'object') {
      current = value.error;
      continue;
    }
    // TripWire's serialized name distinguishes it from user errors with similar fields.
    // Durable transports may still report the public workflow status as `failed`.
    if (
      value.name === 'TripWire' &&
      (value.processorId === undefined || typeof value.processorId === 'string') &&
      value.options &&
      typeof value.options === 'object' &&
      typeof value.message === 'string'
    ) {
      const options = value.options as { retry?: boolean; metadata?: unknown };
      return tripwireTermination({ processorId: value.processorId, reason: value.message, ...options });
    }
    failure = value;
    if (value.name === 'MastraTimeoutError' && typeof value.timeoutMs === 'number') {
      return {
        outcome: 'limit',
        stopReason: 'timeout',
        stopReasonContext: {
          timeoutMs: value.timeoutMs,
          ...(value.timeoutType === 'step' || value.timeoutType === 'total' || value.timeoutType === 'firstChunk'
            ? { timeoutType: value.timeoutType }
            : {}),
        },
      };
    }
    if (value.name === 'FGADeniedError') {
      return { outcome: 'blocked', stopReason: 'authorization' };
    }
    const apiError = value[Symbol.for('vercel.ai.error.AI_APICallError')] === true || value.name === 'AI_APICallError';
    // The LLM domain also wraps user callbacks and runtime hooks; it alone
    // does not establish a provider failure.
    if (apiError) modelFailure = true;
    if (apiError && (value.statusCode === 401 || value.statusCode === 403)) {
      const reason = value.statusCode === 401 ? 'authentication' : 'authorization';
      return {
        outcome: 'blocked',
        stopReason: reason,
        stopReasonContext: {
          message: typeof value.message === 'string' ? value.message : undefined,
          errorCode: String(value.statusCode),
          provider: typeof value.provider === 'string' ? value.provider : undefined,
        },
      };
    }
    if (apiError) {
      const errorCode = providerFailureCode(value);
      if (errorCode === 'content_filter') {
        return {
          outcome: 'blocked',
          stopReason: 'content_filter',
          stopReasonContext: {
            message: typeof value.message === 'string' ? value.message : undefined,
          },
        };
      }
      if (errorCode === 'context_length_exceeded' || errorCode === 'context_window_exceeded') {
        return {
          outcome: 'limit',
          stopReason: 'context_window_exceeded',
          stopReasonContext: { errorCode },
        };
      }
    }
    current = value.cause;
  }
  const reason = modelFailure ? 'model_error' : 'runtime_error';
  return {
    outcome: 'error',
    stopReason: reason,
    stopReasonContext: {
      message: typeof failure?.message === 'string' ? failure.message : typeof error === 'string' ? error : undefined,
      errorCode:
        typeof failure?.code === 'string' ? failure.code : typeof failure?.id === 'string' ? failure.id : undefined,
      retryable: typeof failure?.isRetryable === 'boolean' ? failure.isRetryable : undefined,
    },
  };
}

/** Preserve the mechanism while keeping an observer's failure separate from the execution it interrupts. */
export function tripwireTermination(tripwire?: SpanTripwireContext): SpanTermination {
  const metadata = ensureSerializable(tripwire?.metadata);
  const detail: SpanTripwireContext | undefined = tripwire && {
    processorId: tripwire.processorId,
    reason: tripwire.reason,
    retry: tripwire.retry,
    ...(metadata === undefined ? {} : { metadata }),
  };
  const observer =
    metadata && typeof metadata === 'object' && 'observerFailure' in metadata ? metadata.observerFailure : undefined;
  if (observer && typeof observer === 'object' && 'cause' in observer) {
    const cause = spanTerminationSchema.safeParse(observer.cause);
    if (cause.success && !['success', 'suspend'].includes(cause.data.outcome)) {
      return {
        outcome: 'interrupted',
        stopReason: 'observer_failed',
        stopReasonContext: {
          observerSpanId:
            'observerSpanId' in observer && typeof observer.observerSpanId === 'string'
              ? observer.observerSpanId
              : undefined,
          cause: cause.data,
          tripwire: detail,
        },
      };
    }
  }
  return { outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { tripwire: detail } };
}
