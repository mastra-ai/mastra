import type { MastraMessagePart } from '@mastra/core/agent/message-list';

type MastraProviderMetadata = Record<string, unknown>;

/**
 * Tripwire metadata included when a processor triggers a tripwire.
 */
export type TripwireMetadata = {
  /** Whether the agent should retry with feedback */
  retry?: boolean;
  /** Custom metadata from the processor */
  tripwirePayload?: unknown;
  /** ID of the processor that triggered the tripwire */
  processorId?: string;
};

export type RequireApprovalEntry = {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  runId?: string;
};

export type SuspendedToolEntry = {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  suspendPayload: any;
  runId?: string;
};

export type PendingToolApprovalEntry = {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
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
export type MastraDBMessageMetadata = {
  /** Which run mode produced this message. */
  mode?: 'generate' | 'stream' | 'network';
  /** Streaming/abort/error/tripwire surface status. */
  status?: 'warning' | 'error' | 'tripwire';
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
  /** Task-completion result returned by the run. */
  completionResult?: CompletionResult;
  /** Whether the run reported `isTaskComplete`. */
  isTaskCompleteResult?: boolean;
  /** Signal-echo dedupe: signalId of the user message echoed back. */
  signalEchoIds?: string[];
  /** Network-mode bookkeeping. */
  from?: 'AGENT' | 'WORKFLOW' | 'TOOL';
  selectionReason?: string;
  agentInput?: string | object | Array<object>;
  hasMoreMessages?: boolean;
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
 */
export type MastraReasoningPart = {
  type: 'reasoning';
  reasoning: string;
  reasoningId?: string;
  state?: 'streaming' | 'done';
  providerMetadata?: MastraProviderMetadata;
  createdAt?: number;
};

/**
 * Union of part types the accumulator emits. Compatible with `MastraMessagePart`
 * at runtime; the extended text/reasoning parts add optional fields that
 * downstream consumers (e.g. `AIV5Adapter.toUIMessage`) preserve via
 * providerMetadata round-tripping.
 */
export type AccumulatorPart = MastraMessagePart | MastraTextPart | MastraReasoningPart;
