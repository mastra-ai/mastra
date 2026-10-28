import type { AgentSignalDataPart } from '../../agent/signals';

/** An individual execution's result, reported by its runtime (OBS-724). */
export const SPAN_OUTCOMES = [
  'success',
  'error',
  'abort',
  'interrupted',
  'suspend',
  'limit',
  'blocked',
  'unknown',
] as const;
export type SpanOutcome = (typeof SPAN_OUTCOMES)[number];

/** Supplemental facts for runtime/model failures; never used to infer an outcome. */
export interface SpanFailureContext {
  provider?: string;
  errorCode?: string;
  retryable?: boolean;
  message?: string;
}

/** Context for the initial OBS-724 reason codes. Runtime producers supply these facts. */
export interface SpanStopReasonContextMap {
  max_steps: { maxSteps?: number; completedSteps?: number };
  max_tokens: { maxTokens?: number };
  timeout: { timeoutMs?: number; timeoutType?: 'step' | 'total' | 'firstChunk' };
  runtime_error: SpanFailureContext;
  model_error: SpanFailureContext;
  caller_cancelled: { message?: string };
  signal_received: {};
  observer_failed: {
    observerSpanId?: string;
    /** Keep the observer's own result distinct from the interrupted primary execution. */
    cause: SpanTermination;
  };
  context_window_exceeded: SpanFailureContext & { model?: string; contextWindow?: number };
  guardrail: {};
  content_filter: { provider?: string; message?: string };
  approval_required: { toolCallId?: string; toolName?: string };
  stop_condition: {};
  iteration_hook: { feedbackCompleted?: boolean };
  delegation_bail: {};
  authentication: SpanFailureContext;
  authorization: SpanFailureContext;
}

export type SpanStopReason = keyof SpanStopReasonContextMap;

/** Exhaustive reason registry shared by runtime validation and storage consumers. */
export const SPAN_STOP_REASONS = {
  max_steps: true,
  max_tokens: true,
  timeout: true,
  runtime_error: true,
  model_error: true,
  caller_cancelled: true,
  signal_received: true,
  observer_failed: true,
  context_window_exceeded: true,
  guardrail: true,
  content_filter: true,
  approval_required: true,
  stop_condition: true,
  iteration_hook: true,
  delegation_bail: true,
  authentication: true,
  authorization: true,
} as const satisfies Record<SpanStopReason, true>;

/** The tripwire mechanism, separate from the semantic cause of termination. */
export interface SpanTripwireContext {
  processorId?: string;
  /** Existing human-readable tripwire explanation, not a machine stop reason. */
  reason?: string;
  retry?: boolean;
  metadata?: unknown;
}

/** Supplemental details shared by all stop reasons. */
export type SpanStopSupplementalContext = {
  tripwire?: SpanTripwireContext;
  /** Only signals that affected this execution, in their transport representation. */
  signals?: AgentSignalDataPart['data'][];
};

export type SpanStopReasonContext<Reason extends SpanStopReason = SpanStopReason> = SpanStopReasonContextMap[Reason] &
  SpanStopSupplementalContext;

/** Narrow this envelope by stopReason to access its cause-specific context. */
export type SpanTermination = { outcome: SpanOutcome } & (
  | {
      [Reason in SpanStopReason]: {
        stopReason: Reason;
        stopReasonContext?: SpanStopReasonContext<Reason> | null;
      };
    }[SpanStopReason]
  | { stopReason?: null; stopReasonContext?: null }
);

/** Native fields shared by live spans, snapshots, exports and lifecycle options. */
export interface SpanOutcomeFields {
  /** Explicit null means ongoing for an adopted producer. Absence means unavailable. */
  outcome?: SpanOutcome | null;
  /** Nullable machine-readable cause, supplied at the authoritative runtime boundary. */
  stopReason?: SpanStopReason | null;
  stopReasonContext?: SpanStopReasonContext | null;
}

/** Typed metadata retained when an OM processor interrupts its primary agent. */
export interface ObserverFailureMetadata {
  observerFailure: {
    observerSpanId?: string;
    cause: SpanTermination;
  };
}
