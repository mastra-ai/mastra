import { compactStopReasonContext } from './outcome-schema';
import { SPAN_OUTCOMES, SPAN_STOP_REASONS } from './types/outcome';
import type { SpanOutcome, SpanStopReason, SpanTermination, SpanTripwireContext } from './types/outcome';

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
  // Runs on failure paths: a throwing getter or Proxy trap must not replace the original error.
  try {
    const termination = classifyExecutionFailure(error, layer);
    return {
      ...termination,
      stopReasonContext: compactStopReasonContext(termination.stopReason, termination.stopReasonContext),
    } as SpanTermination;
  } catch {
    return { outcome: 'error', stopReason: layer };
  }
}

function classifyExecutionFailure(error: unknown, layer: 'runtime_error' | 'model_error'): SpanTermination {
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
          stopReasonContext: { provider: typeof value.provider === 'string' ? value.provider : undefined },
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
      provider: typeof failure?.provider === 'string' ? failure.provider : undefined,
      errorCode:
        typeof failure?.code === 'string' ? failure.code : typeof failure?.id === 'string' ? failure.id : undefined,
      retryable: typeof failure?.isRetryable === 'boolean' ? failure.isRetryable : undefined,
    },
  };
}

/** Link to the observer's diagnostics without copying its payload into the interrupted span. */
export function tripwireTermination(tripwire?: SpanTripwireContext): SpanTermination {
  try {
    const metadata = tripwire?.metadata;
    const observer =
      metadata && typeof metadata === 'object' && 'observerFailure' in metadata ? metadata.observerFailure : undefined;
    if (
      observer &&
      typeof observer === 'object' &&
      'cause' in observer &&
      observer.cause &&
      typeof observer.cause === 'object'
    ) {
      const cause = observer.cause as { outcome?: unknown; stopReason?: unknown };
      if (
        SPAN_OUTCOMES.includes(cause.outcome as SpanOutcome) &&
        cause.outcome !== 'success' &&
        cause.outcome !== 'suspend'
      ) {
        return {
          outcome: 'interrupted',
          stopReason: 'observer_failed',
          stopReasonContext: compactStopReasonContext('observer_failed', {
            observerSpanId: 'observerSpanId' in observer ? observer.observerSpanId : undefined,
            causeOutcome: cause.outcome,
            causeStopReason:
              typeof cause.stopReason === 'string' && Object.hasOwn(SPAN_STOP_REASONS, cause.stopReason)
                ? (cause.stopReason as SpanStopReason)
                : undefined,
          }),
        };
      }
    }
    return {
      outcome: 'blocked',
      stopReason: 'guardrail',
      stopReasonContext: compactStopReasonContext('guardrail', { processorId: tripwire?.processorId }),
    };
  } catch {
    return { outcome: 'blocked', stopReason: 'guardrail' };
  }
}
