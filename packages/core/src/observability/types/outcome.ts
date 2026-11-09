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
export type SpanFailureContext = {
  provider?: string;
  errorCode?: string;
  retryable?: boolean;
};

/** Context for the initial OBS-724 reason codes. Runtime producers supply these facts. */
export interface SpanStopReasonContextMap {
  max_steps: { maxSteps?: number; completedSteps?: number };
  max_tokens: { maxTokens?: number };
  timeout: { timeoutMs?: number; timeoutType?: 'step' | 'total' | 'firstChunk' };
  runtime_error: SpanFailureContext;
  model_error: SpanFailureContext;
  caller_cancelled: Record<string, never>;
  signal_received: { signalId?: string; signalType?: 'user' | 'state' | 'reactive' | 'notification' };
  observer_failed: {
    observerSpanId?: string;
    /** Keep the observer's own result distinct from the interrupted primary execution. */
    causeOutcome?: SpanOutcome;
    causeStopReason?: SpanStopReason;
  };
  context_window_exceeded: { provider?: string; errorCode?: string; contextWindow?: number };
  guardrail: { processorId?: string };
  content_filter: { provider?: string };
  approval_required: { toolCallId?: string; toolName?: string };
  stop_condition: Record<string, never>;
  iteration_hook: { feedbackCompleted?: boolean };
  delegation_bail: { causeOutcome?: SpanOutcome; causeStopReason?: SpanStopReason };
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

/** @internal Runtime tripwire input. Its payload is never copied into exported stop-reason context. */
export interface SpanTripwireContext {
  processorId?: string;
  /** Existing human-readable tripwire explanation, not a machine stop reason. */
  reason?: string;
  retry?: boolean;
  metadata?: unknown;
}

/** Flat tooltip facts only: at most three scalar fields, with strings bounded to 128 characters. */
export type SpanStopReasonContext<Reason extends SpanStopReason = SpanStopReason> = SpanStopReasonContextMap[Reason];

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

/** Native fields shared by live spans, snapshots, exports and lifecycle options.
 * Custom producers retain arbitrary values; framework producers use SpanTermination.
 */
export interface SpanOutcomeFields {
  /** Null or absence means no recorded outcome. Use endTime to determine completion. */
  outcome?: string | null;
  /** Nullable machine-readable cause, supplied at the authoritative runtime boundary. */
  stopReason?: string | null;
  stopReasonContext?: Record<string, unknown> | null;
}

/** Typed metadata retained when an OM processor interrupts its primary agent. */
export interface ObserverFailureMetadata {
  observerFailure: {
    observerSpanId?: string;
    cause: SpanTermination;
  };
}
