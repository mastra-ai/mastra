import type { MastraMessagePart, AIV5Type } from '@mastra/core/agent/message-list';
import type { TripwirePayload } from '@mastra/core/stream';

export type MastraProviderMetadata = Record<string, Record<string, unknown>>;

/**
 * Tripwire metadata included when a processor triggers a tripwire.
 * Canonical shape sourced from core's `tripwire` stream-chunk payload.
 */
export type TripwireMetadata = TripwirePayload;

export type ToolApprovalArgs = Record<string, unknown>;

export type RequireApprovalEntry = {
  toolCallId: string;
  toolName: string;
  args: ToolApprovalArgs;
  runId?: string;
};

export type SuspendedToolEntry = {
  toolCallId: string;
  toolName: string;
  args: ToolApprovalArgs;
  suspendPayload: unknown;
  runId?: string;
};

export type PendingToolApprovalEntry = {
  toolCallId: string;
  toolName: string;
  args: ToolApprovalArgs;
  runId?: string;
};

export type BackgroundTaskEntry = {
  startedAt: Date;
  completedAt?: Date;
  suspendedAt?: Date;
  taskId: string;
};

export type CompletionResult = {
  passed: boolean;
  suppressFeedback?: boolean;
};

/**
 * Canonical metadata block stored under `MastraDBMessage.content.metadata`.
 *
 * Every UX hint the React accumulator needs to surface lives here. Mode-specific
 * fields are all optional so a single record can carry the union without forcing
 * narrowing on the consumer side.
 */
/**
 * Metadata key carrying a client-generated correlation id. The optimistic
 * pending user bubble and the outgoing `sendMessage` request both stamp this
 * id; the server echoes it back on the `data-user-message` data part so the
 * accumulator can reconcile the pending bubble deterministically (decoupled
 * from the server-assigned signal id). This is transient client state and is
 * stripped once the echo is reconciled and on reload.
 */
export const CLIENT_MESSAGE_ID_KEY = 'clientMessageId';

export type MastraDBMessageMetadata = {
  /** Which run mode produced this message. */
  mode?: 'generate' | 'stream' | 'network';
  /** Client-generated correlation id (see {@link CLIENT_MESSAGE_ID_KEY}). */
  clientMessageId?: string;
  /**
   * Streaming/abort/error/tripwire surface status. `'pending'` marks an
   * optimistically-appended user message that is awaiting its server signal
   * echo; it is cleared once the echo arrives and is stripped on reload.
   */
  status?: 'warning' | 'error' | 'tripwire' | 'pending';
  /** Reason recorded by the upstream stream when it finishes. */
  finishReason?: string;
  /** Tripwire metadata when status === 'tripwire'. */
  tripwire?: TripwireMetadata;
  /** Per-toolName approval requirements declared mid-stream. */
  requireApprovalMetadata?: Record<string, RequireApprovalEntry>;
  /** Per-toolName suspension records from suspended tool calls. */
  suspendedTools?: Record<string, SuspendedToolEntry>;
  /** Pending approvals keyed by toolCallId (for runtime resolution). */
  pendingToolApprovals?: Record<string, PendingToolApprovalEntry>;
  /** Per-toolCallId background-task bookkeeping. */
  backgroundTasks?: Record<string, BackgroundTaskEntry>;
  /** Number of background tasks currently executing for this message. */
  runningBackgroundTasksCount?: number;
  /** Task-completion result returned by the run (network mode). */
  completionResult?: CompletionResult;
  /**
   * Task-completion verdict from the supervisor `isTaskComplete` path. Shares
   * the `{ passed, suppressFeedback }` shape with `completionResult`; core
   * persists it as an object and reads it back as one (see `MessageMerger`).
   */
  isTaskCompleteResult?: CompletionResult;
  /** Signal-echo dedupe: signalId of the user message echoed back. */
  signalEchoIds?: string[];
  /** Network-mode bookkeeping. */
  from?: 'AGENT' | 'WORKFLOW' | 'TOOL';
  selectionReason?: string;
  agentInput?: string | object | Array<object>;
  hasMoreMessages?: boolean;
  /**
   * Structured decision emitted by the routing agent. Parsed from the
   * routing-agent text stream when it forms a balanced JSON object so the
   * raw payload never reaches the rendered thread.
   */
  routingDecision?: Record<string, unknown>;
  /**
   * Raw routing-agent text used when the stream did not parse as JSON. Kept
   * out of the visible parts but exposed for downstream UI (badge tooltips,
   * metadata dialogs, debugging).
   */
  routingDecisionText?: string;
  /**
   * Internal buffer for partial routing-agent text deltas. Cleared once the
   * buffer parses as JSON and is promoted to `routingDecision`.
   */
  routingDecisionBuffer?: string;
};

/**
 * Mastra-extended text part. Adds `textId` (per-stream identifier) and
 * `state` (streaming/done) on top of the V4 text part shape, mirroring the
 * `MastraStepStartPart` extension pattern in core.
 */
export type MastraTextPart = {
  type: 'text';
  text: string;
  textId?: string;
  state?: 'streaming' | 'done';
  providerMetadata?: MastraProviderMetadata;
  createdAt?: number;
};

/**
 * Mastra-extended reasoning part with per-stream identifier and streaming state.
 * `redacted: true` indicates the upstream provider redacted the reasoning content.
 */
export type MastraReasoningPart = {
  type: 'reasoning';
  reasoning: string;
  reasoningId?: string;
  state?: 'streaming' | 'done';
  redacted?: boolean;
  providerMetadata?: MastraProviderMetadata;
  createdAt?: number;
};

/**
 * Streaming buffer attached to a tool-invocation part while `tool-call-delta`
 * fragments arrive. The accumulator concatenates JSON chunks into `argsText`
 * and parses them on `tool-call-input-streaming-end`. Stored alongside the
 * canonical `args` so the persisted shape still satisfies `MastraDBMessage`.
 */
export type StreamingToolInvocationExtension = {
  argsText?: string;
};

/**
 * Custom `data-*` chunk part shape persisted on a `MastraDBMessage`. Mirrors
 * AI SDK v5 `DataUIPart` structurally so it is structurally compatible with
 * `MastraMessagePart`, while keeping the React-side accumulator independent
 * of the v5 type machinery.
 */
export type StreamingDataPart = {
  type: `data-${string}`;
  data: unknown;
  id?: string;
};

/**
 * Union of part types the accumulator emits. Compatible with `MastraMessagePart`
 * at runtime; the extended text/reasoning parts add optional fields that
 * downstream consumers (e.g. `AIV5Adapter.toUIMessage`) preserve via
 * providerMetadata round-tripping.
 *
 * `AIV5Type.SourceUrlUIPart` is the flat `type: 'source-url'` shape the
 * accumulator actually pushes for URL source citations (the typed
 * `MastraMessagePart` only models the nested `type: 'source'` shape), so it is
 * listed explicitly as a first-class member of the runtime union.
 */
export type AccumulatorPart =
  | MastraMessagePart
  | MastraTextPart
  | MastraReasoningPart
  | StreamingDataPart
  | AIV5Type.SourceUrlUIPart;
