import { z } from 'zod/v4';
import { SPAN_OUTCOMES, SPAN_STOP_REASONS } from './types/outcome';
import type { SpanStopReason, SpanStopReasonContext, SpanTermination } from './types/outcome';

const label = z.string().max(128).optional();
const reason = z.enum(Object.keys(SPAN_STOP_REASONS) as [SpanStopReason, ...SpanStopReason[]]);
const failure = { provider: label, errorCode: label, retryable: z.boolean().optional() };
const cause = { causeOutcome: z.enum(SPAN_OUTCOMES).optional(), causeStopReason: reason.optional() };

// Select a small, flat context using the envelope's stopReason. Never copy diagnostic payloads.
const contexts = {
  max_steps: z.strictObject({ maxSteps: z.number().optional(), completedSteps: z.number().optional() }),
  max_tokens: z.strictObject({ maxTokens: z.number().optional() }),
  timeout: z.strictObject({
    timeoutMs: z.number().optional(),
    timeoutType: z.enum(['step', 'total', 'firstChunk']).optional(),
  }),
  runtime_error: z.strictObject(failure),
  model_error: z.strictObject(failure),
  caller_cancelled: z.strictObject({}),
  observer_failed: z.strictObject({ observerSpanId: label, ...cause }),
  context_window_exceeded: z.strictObject({ provider: label, errorCode: label, contextWindow: z.number().optional() }),
  guardrail: z.strictObject({ processorId: label }),
  content_filter: z.strictObject({ provider: label }),
  approval_required: z.strictObject({ toolCallId: label, toolName: label }),
  signal_received: z.strictObject({
    signalId: label,
    signalType: z.enum(['user', 'state', 'reactive', 'notification']).optional(),
  }),
  stop_condition: z.strictObject({}),
  iteration_hook: z.strictObject({ feedbackCompleted: z.boolean().optional() }),
  delegation_bail: z.strictObject(cause),
  authentication: z.strictObject(failure),
  authorization: z.strictObject(failure),
} satisfies { [Reason in SpanStopReason]: z.ZodType<SpanStopReasonContext<Reason>> };

/** @internal Allowlist tooltip facts for framework producers, including untyped runtime inputs. */
export function compactStopReasonContext<Reason extends SpanStopReason>(
  stopReason: Reason | null | undefined,
  context: unknown,
): SpanStopReasonContext<Reason> | null {
  if (!stopReason || !Object.hasOwn(contexts, stopReason) || !context || typeof context !== 'object') return null;
  try {
    const result: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(contexts[stopReason].shape)) {
      const value = (context as Record<string, unknown>)[key];
      // Omit oversized identifiers rather than truncate them into broken links.
      const parsed = schema.safeParse(value);
      if (parsed.success && parsed.data !== undefined) result[key] = parsed.data;
    }
    return Object.keys(result).length ? (result as SpanStopReasonContext<Reason>) : null;
  } catch {
    // Optional observability details must never change execution behavior.
    return null;
  }
}

function termination<Reason extends SpanStopReason>(stopReason: Reason) {
  return z.object({
    outcome: z.enum(SPAN_OUTCOMES),
    stopReason: z.literal(stopReason),
    stopReasonContext: (contexts[stopReason] as z.ZodType<SpanStopReasonContext<Reason>>).nullish(),
  });
}

export const spanTerminationSchema = z.union([
  ...(Object.keys(SPAN_STOP_REASONS) as SpanStopReason[]).map(termination),
  z.object({ outcome: z.enum(SPAN_OUTCOMES), stopReason: z.null().optional(), stopReasonContext: z.null().optional() }),
]) as z.ZodType<SpanTermination>;
