import { z } from 'zod/v4';
import type { AgentSignalDataPart } from '../agent/signals';
import { SPAN_OUTCOMES, SPAN_STOP_REASONS } from './types/outcome';
import type { SpanStopReason, SpanStopReasonContext, SpanTermination } from './types/outcome';

const failure = {
  provider: z.string().optional(),
  errorCode: z.string().optional(),
  retryable: z.boolean().optional(),
  message: z.string().optional(),
};

// Signals reach observability through toDataPart(), which serializes file data
// to strings. Keep the concrete wire shape visible to generated API clients.
const providerOptions = z.record(z.string(), z.record(z.string(), z.json())).optional();
const signalData: z.ZodType<AgentSignalDataPart['data']> = z.looseObject({
  id: z.string(),
  type: z.enum(['user', 'state', 'reactive', 'notification']),
  tagName: z.string().optional(),
  createdAt: z.string(),
  acceptedAt: z.string().optional(),
  contents: z.union([
    z.string(),
    z.array(
      z.union([
        z.looseObject({ type: z.literal('text'), text: z.string(), providerOptions }),
        z.looseObject({
          type: z.literal('file'),
          data: z.string(),
          mediaType: z.string(),
          filename: z.string().optional(),
          providerOptions,
        }),
      ]),
    ),
  ]),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  author: z.looseObject({ id: z.string(), name: z.string().optional(), avatarUrl: z.string().optional() }).optional(),
  providerOptions,
  transient: z.boolean().optional(),
});
const supplemental = {
  signals: z.array(signalData).optional(),
  tripwire: z
    .object({
      processorId: z.string().optional(),
      reason: z.string().optional(),
      retry: z.boolean().optional(),
      metadata: z.json().optional(),
    })
    .optional(),
};

// Select cause-specific context using the envelope's stopReason, without a second discriminator.
const contexts = {
  max_steps: z.strictObject({
    maxSteps: z.number().optional(),
    completedSteps: z.number().optional(),
    ...supplemental,
  }),
  max_tokens: z.strictObject({ maxTokens: z.number().optional(), ...supplemental }),
  timeout: z.strictObject({
    timeoutMs: z.number().optional(),
    timeoutType: z.enum(['step', 'total', 'firstChunk']).optional(),
    ...supplemental,
  }),
  runtime_error: z.strictObject({ ...failure, ...supplemental }),
  model_error: z.strictObject({ ...failure, ...supplemental }),
  caller_cancelled: z.strictObject({ message: z.string().optional(), ...supplemental }),
  observer_failed: z.strictObject({
    observerSpanId: z.string().optional(),
    cause: z.lazy(() => spanTerminationSchema),
    ...supplemental,
  }),
  context_window_exceeded: z.strictObject({
    ...failure,
    model: z.string().optional(),
    contextWindow: z.number().optional(),
    ...supplemental,
  }),
  guardrail: z.strictObject({ ...supplemental }),
  content_filter: z.strictObject({ provider: z.string().optional(), message: z.string().optional(), ...supplemental }),
  approval_required: z.strictObject({
    toolCallId: z.string().optional(),
    toolName: z.string().optional(),
    ...supplemental,
  }),
  signal_received: z.strictObject({ ...supplemental }),
  stop_condition: z.strictObject({ ...supplemental }),
  iteration_hook: z.strictObject({ feedbackCompleted: z.boolean().optional(), ...supplemental }),
  delegation_bail: z.strictObject({ ...supplemental }),
  authentication: z.strictObject({ ...failure, ...supplemental }),
  authorization: z.strictObject({ ...failure, ...supplemental }),
} satisfies { [Reason in SpanStopReason]: z.ZodType<SpanStopReasonContext<Reason>> };

function termination<Reason extends SpanStopReason>(stopReason: Reason) {
  return z.object({
    outcome: z.enum(SPAN_OUTCOMES),
    stopReason: z.literal(stopReason),
    stopReasonContext: (contexts[stopReason] as z.ZodType<SpanStopReasonContext<Reason>>).nullish(),
  });
}

export const spanTerminationSchema: z.ZodType<SpanTermination> = z.lazy(
  () =>
    z.union([
      ...(Object.keys(SPAN_STOP_REASONS) as SpanStopReason[]).map(termination),
      z.object({
        outcome: z.enum(SPAN_OUTCOMES),
        stopReason: z.null().optional(),
        stopReasonContext: z.null().optional(),
      }),
    ]) as z.ZodType<SpanTermination>,
);
