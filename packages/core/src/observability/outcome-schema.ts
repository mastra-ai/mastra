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
const supplemental = { signals: z.array(signalData).optional() };

export const spanTerminationSchema: z.ZodType<SpanTermination> = z.lazy(() =>
  z.object({
    outcome: z.enum(SPAN_OUTCOMES),
    stopReason: z.enum(Object.keys(SPAN_STOP_REASONS) as [SpanStopReason, ...SpanStopReason[]]).nullish(),
    stopReasonContext: spanStopReasonContextSchema.nullish(),
  }),
);

/** Shared schema for the strongly typed supplemental context, including nested observer causes. */
export const spanStopReasonContextSchema: z.ZodType<SpanStopReasonContext> = z.lazy(() =>
  z.discriminatedUnion('reason', [
    z.object({
      reason: z.literal('max_steps'),
      maxSteps: z.number().optional(),
      completedSteps: z.number().optional(),
      ...supplemental,
    }),
    z.object({ reason: z.literal('max_tokens'), maxTokens: z.number().optional(), ...supplemental }),
    z.object({
      reason: z.literal('timeout'),
      timeoutMs: z.number().optional(),
      timeoutType: z.enum(['step', 'total', 'firstChunk']).optional(),
      ...supplemental,
    }),
    z.object({ reason: z.literal('runtime_error'), ...failure, ...supplemental }),
    z.object({ reason: z.literal('model_error'), ...failure, ...supplemental }),
    z.object({ reason: z.literal('caller_cancelled'), message: z.string().optional(), ...supplemental }),
    z.object({
      reason: z.literal('observer_failed'),
      observerSpanId: z.string().optional(),
      cause: spanTerminationSchema,
      ...supplemental,
    }),
    z.object({
      reason: z.literal('context_window_exceeded'),
      ...failure,
      model: z.string().optional(),
      contextWindow: z.number().optional(),
      ...supplemental,
    }),
    z.object({
      reason: z.literal('guardrail'),
      processorId: z.string().optional(),
      message: z.string().optional(),
      ...supplemental,
    }),
    z.object({
      reason: z.literal('content_filter'),
      provider: z.string().optional(),
      message: z.string().optional(),
      ...supplemental,
    }),
    z.object({
      reason: z.literal('approval_required'),
      toolCallId: z.string().optional(),
      toolName: z.string().optional(),
      ...supplemental,
    }),
    z.object({ reason: z.literal('signal_received'), ...supplemental }),
    z.object({ reason: z.literal('stop_condition'), ...supplemental }),
    z.object({ reason: z.literal('iteration_hook'), feedbackCompleted: z.boolean().optional(), ...supplemental }),
    z.object({ reason: z.literal('delegation_bail'), ...supplemental }),
    z.object({ reason: z.literal('authentication'), ...failure, ...supplemental }),
    z.object({ reason: z.literal('authorization'), ...failure, ...supplemental }),
  ]),
);
