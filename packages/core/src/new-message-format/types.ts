import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import type { AgentSignalAttributes, AgentSignalCategory, AgentStateSignalMode } from '../agent/signals';

/**
 * Fields shared by every action. Actions are append-only: once written they are never mutated.
 * State changes (tool results, approvals, ...) are new actions that reference earlier ones.
 */
export type ActionBase = {
  /** Monotonic ULID. Identity and sort order. */
  id: string;
  threadId: string;
  resourceId?: string;
  runId?: string;
  traceId?: string;
  createdAt: Date;
  /** User-owned, arbitrary. Mastra never reads or writes this. */
  metadata?: Record<string, unknown>;
  /** Provider-owned (AI SDK providerMetadata / providerOptions). */
  providerMetadata?: MastraProviderMetadata;
  /** Streamed to consumers but never written to storage. */
  transient?: boolean;
  /** Format version of the writer. Storage stamps `ACTION_FORMAT_VERSION` when unset. */
  formatVersion?: number;
  /**
   * A reader that doesn't know this action's type may skip it. Readers refuse unknown types without it.
   * Storage sets it for the types in `IGNORABLE_ACTION_TYPES`.
   */
  ignorable?: boolean;
};

type Role = 'user' | 'assistant' | 'system';

// Content

/** `contentId` links a streamed block to its transient deltas. */
/** `interrupted`: the stream stopped mid-block (abort or error); `text` is what arrived before it did. */
export type TextAction = ActionBase & {
  type: 'text';
  role: Role;
  text: string;
  contentId?: string;
  interrupted?: boolean;
};

export type ReasoningAction = ActionBase & {
  type: 'reasoning';
  role: 'assistant';
  text: string;
  contentId?: string;
  interrupted?: boolean;
};

export type FileAction = ActionBase & {
  type: 'file';
  role: Role;
  mediaType: string;
  /** URL or base64 data. */
  data: string;
  filename?: string;
};

/** A file produced inside the model's reasoning (e.g. a scratch image), not part of the answer. */
export type ReasoningFileAction = ActionBase & {
  type: 'reasoning-file';
  role: 'assistant';
  mediaType: string;
  data: string;
};

/** Recorded when a file could not be downloaded; replaces `metadata.mastra.unavailableAttachments`. */
export type FileUnavailableAction = ActionBase & { type: 'file-unavailable'; fileActionId: string; reason?: string };

export type SourceUrlAction = ActionBase & {
  type: 'source-url';
  role: 'assistant';
  sourceId: string;
  url: string;
  title?: string;
};

export type SourceDocumentAction = ActionBase & {
  type: 'source-document';
  role: 'assistant';
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
};

/** Custom `data-*` parts. */
export type DataAction = ActionBase & { type: `data-${string}`; role: Role; data: unknown };

// Turn lifecycle

export type TurnStartAction = ActionBase & { type: 'turn-start'; modelId?: string };

/** `interrupted`: the run stopped without finishing (abort, crash) and was closed by repair. */
export type FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'interrupted';

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

/** End of one model call. `modelId` is what the provider reports actually served the turn. */
export type TurnEndAction = ActionBase & {
  type: 'turn-end';
  finishReason: FinishReason;
  usage: Usage;
  modelId?: string;
  responseId?: string;
};

/** End of the run, after the last turn. `usage` is the total across turns. */
export type RunEndAction = ActionBase & { type: 'run-end'; finishReason: FinishReason; usage: Usage };

/** The run was cancelled (abort signal). Not an error. */
export type RunAbortedAction = ActionBase & { type: 'run-aborted'; reason?: string };

/** Settings in effect for a run. Every field is optional: a writer records what it knows. */
export type RunSettingsSnapshot = {
  thinkingLevel?: string;
  modeId?: string;
  maxSteps?: number;
  toolNames?: string[];
};

/** Start of a run: which agent ran it, with which model and settings. */
export type RunStartAction = ActionBase & {
  type: 'run-start';
  agentId: string;
  modelId: string;
  settings: RunSettingsSnapshot;
};

// Thread events: written between runs (by the lock holder) as well as during them.
// Current state is a fold: the latest `settings-changed` per setting, the latest `task-changed`,
// and a goal's state from its `goal-*` actions.

type ChangedBy = { kind: 'user' } | { kind: 'agent' } | { kind: 'processor'; processorId: string };

/** A setting other than the model changed. Subsequent turns use `value` until the next change. */
export type SettingsChangedAction = ActionBase & {
  type: 'settings-changed';
  setting: 'thinking-level' | 'mode';
  value: string;
  previousValue?: string;
  changedBy: ChangedBy;
};

export type ActionTaskItem = {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
};

/** The whole task list after a change (latest wins). */
export type TaskChangedAction = ActionBase & { type: 'task-changed'; tasks: ActionTaskItem[]; changedBy: ChangedBy };

export type GoalStatus = 'active' | 'paused' | 'done';

/** Goal options a caller can set at start and edit later. */
export type GoalOptions = { maxRuns?: number; judgeModelId?: string; prompt?: string };

export type GoalStartedAction = ActionBase & {
  type: 'goal-started';
  goalId: string;
  objective: string;
  options: GoalOptions;
};

/**
 * The goal's options or status changed outside an evaluation: options edited, paused, resumed.
 * Replacement semantics, so a fold never merges fields:
 * - `options`, when present, is the complete set of options after the change, not a patch.
 * - An action that sets `status` also replaces `pausedReason`: absent means the reason is cleared.
 *   `pausedReason` is meaningful only with `status: 'paused'`.
 * - An action without `status` leaves both status and reason untouched.
 * A goal reaches `done` only through `goal-ended` or a `completed` evaluation, never through this action.
 */
export type GoalChangedAction = ActionBase & {
  type: 'goal-changed';
  goalId: string;
  options?: GoalOptions;
  status?: Exclude<GoalStatus, 'done'>;
  pausedReason?: string;
  changedBy: ChangedBy;
};

/**
 * What a judge evaluation decided, in precedence order:
 * `judge-failed` → `completed` → `budget-exhausted` (only when not waiting) → `waiting-for-user` → `continue`.
 */
export type GoalEvaluationOutcome = 'judge-failed' | 'completed' | 'budget-exhausted' | 'waiting-for-user' | 'continue';

/**
 * One judge evaluation. Replaces the goal-judge signal message. A verdict superseded while the
 * judge ran (goal paused, cleared or replaced) is not written.
 * `shouldContinue` (`outcome === 'continue'`), `waitingForUser`, `judgeFailed` and the budget pause derive
 * from `outcome` and aren't stored. "Budget reached" alone is `iteration >= maxRuns`: it holds also when
 * the outcome is `waiting-for-user`.
 */
export type GoalEvaluatedAction = ActionBase & {
  type: 'goal-evaluated';
  goalId: string;
  outcome: GoalEvaluationOutcome;
  /** Evaluations consumed so far. A failed judge consumes none, so it doesn't advance this. */
  iteration: number;
  maxRuns: number;
  /** Goal status after this evaluation: `done` when completed, `paused` on judge failure or budget, else `active`. */
  status: GoalStatus;
  /** Set when this evaluation paused the goal. */
  pausedReason?: string;
  /** Judge feedback, or the pause reason when paused. */
  reason?: string;
};

/** The goal is over: met (`completed`), or removed by the user (`cleared`, also when replaced by a new goal). */
export type GoalEndedAction = ActionBase & {
  type: 'goal-ended';
  goalId: string;
  reason: 'completed' | 'cleared';
};

/** Provider-specific event with no Mastra equivalent (AI SDK `custom` part). Payload is in `providerMetadata`. */
export type ProviderEventAction = ActionBase & { type: 'provider-event'; kind: `${string}.${string}` };

/** Raw provider chunk, only emitted when raw chunks are requested. Debug only. */
export type RawChunkAction = ActionBase & { type: 'raw-chunk'; transient: true; rawValue: unknown };

/**
 * The model changed — either between turns (user picked a different model) or mid-run
 * (a processor swapped it). Subsequent turns use `modelId` until the next change.
 */
export type ModelChangedAction = ActionBase & {
  type: 'model-changed';
  modelId: string;
  previousModelId?: string;
  changedBy: { kind: 'user' } | { kind: 'processor'; processorId: string };
};

export type StructuredOutputAction = ActionBase & { type: 'structured-output'; object: unknown };

export type ThreadTitleChangedAction = ActionBase & {
  type: 'thread-title-changed';
  title: string;
  previousTitle?: string;
  changedBy: { kind: 'user' } | { kind: 'memory'; cycleId: string };
};

// Errors — persisted, and attributed to where they came from. Tool failures stay `tool-error`.

type MemoryOperation = 'observation' | 'reflection';
/** `sync` blocks the turn at the threshold; `buffered` runs in the background ahead of it. */
type MemoryMode = 'sync' | 'buffered';

export type ErrorSource =
  | { kind: 'agent' }
  | { kind: 'model'; modelId: string }
  | { kind: 'processor'; processorId: string }
  | {
      kind: 'memory';
      cycleId: string;
      operation: MemoryOperation;
      mode: MemoryMode;
      failurePolicy: 'abort' | 'continue';
      tokensAttempted: number;
      durationMs: number;
    };

export type ErrorAction = ActionBase & {
  type: 'error';
  error: { name: string; message: string };
  source: ErrorSource;
  /** Whether this error ended the run. */
  fatal: boolean;
  /** The same work is being retried; a later action supersedes this one. */
  retrying?: boolean;
};

// Observational memory — replaces the `data-om-*` parts. Start/end/error share a cycleId.
// `data-om-status` is transient UI state and is not persisted.

type MemoryConfigSnapshot = {
  messageTokens: number;
  observationTokens: number;
  scope: 'thread' | 'resource';
  activateAfterIdle?: number | 'auto';
};

export type MemoryCycleStartAction = ActionBase & {
  type: 'memory-cycle-start';
  cycleId: string;
  operation: MemoryOperation;
  mode: MemoryMode;
  recordId: string;
  /** All threads covered by this cycle (more than one when resource-scoped). */
  threadIds: string[];
  tokensIn: number;
  config: MemoryConfigSnapshot;
};

export type MemoryCycleEndAction = ActionBase & {
  type: 'memory-cycle-end';
  cycleId: string;
  operation: MemoryOperation;
  mode: MemoryMode;
  recordId: string;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  observations?: string;
  currentTask?: string;
  suggestedResponse?: string;
  extractedValues?: Record<string, unknown>;
  extractionFailures?: Array<{ slug: string; error: string }>;
  /**
   * Last action id this cycle covered; observed means `id <= lastObservedId`.
   * Set by observation cycles only: reflection doesn't move the cursor.
   */
  lastObservedId?: string;
};

/** Buffered memory moved into active context. */
export type MemoryActivatedAction = ActionBase & {
  type: 'memory-activated';
  cycleId: string;
  operation: MemoryOperation;
  recordId: string;
  generation: number;
  chunks: number;
  messages: number;
  /** Last action id covered by the activated chunks; the cursor after activation. */
  lastObservedId: string;
  tokensIn: number;
  tokensOut: number;
  observations?: string;
  config: MemoryConfigSnapshot;
  trigger:
    | { kind: 'threshold' }
    | { kind: 'idle'; lastActivityAt: number; idleExceededMs: number }
    | { kind: 'model-changed'; modelId: string; previousModelId: string };
};

// Tool lifecycle — every transition is its own action, linked by toolCallId

type ToolRef = { toolCallId: string; toolName: string };

export type ToolCallAction = ActionBase &
  ToolRef & { type: 'tool-call'; role: 'assistant'; input: unknown; providerExecuted?: boolean; title?: string };

/**
 * Execution began. Written before the tool's side effects, so repair can tell a call that never
 * ran from one whose outcome is unknown.
 */
export type ToolStartedAction = ActionBase & ToolRef & { type: 'tool-started' };

export type ToolApprovalRequestedAction = ActionBase &
  ToolRef & { type: 'tool-approval-requested'; approvalId: string };

export type ToolApprovalRespondedAction = ActionBase &
  ToolRef & { type: 'tool-approval-responded'; approvalId: string; approved: boolean; reason?: string };

export type ToolSuspendedAction = ActionBase & ToolRef & { type: 'tool-suspended'; payload?: unknown };

export type ToolResumedAction = ActionBase & ToolRef & { type: 'tool-resumed'; resumeData?: unknown };

export type ToolResultAction = ActionBase & ToolRef & { type: 'tool-result'; output: unknown; modelOutput?: unknown };

/**
 * Set when repair closed the call: `TOOL_OUTCOME_UNKNOWN` if it had started (it may have run; never retried
 * automatically), `TOOL_NOT_STARTED` if it had not.
 */
export type ToolErrorCode = 'TOOL_OUTCOME_UNKNOWN' | 'TOOL_NOT_STARTED';

/** Thrown in place of a tool's execute when the run can't record that it started (or was stopped first). */
export class ToolNotStartedError extends Error {
  constructor() {
    super('The run stopped before this tool started. It did not run.');
    this.name = 'ToolNotStartedError';
  }
}

export type ToolErrorAction = ActionBase & ToolRef & { type: 'tool-error'; errorText: string; code?: ToolErrorCode };

export type ToolDeniedAction = ActionBase & ToolRef & { type: 'tool-denied'; reason?: string };

// Delegation — a tool call that runs another agent or workflow. Its child run's
// actions carry `runId: childRunId`, so the full sub-transcript is recoverable by run.
export type ToolDelegatedAction = ActionBase &
  ToolRef & {
    type: 'tool-delegated';
    target: { kind: 'agent'; agentId: string } | { kind: 'workflow'; workflowId: string };
    childRunId: string;
  };

// Background tools — a separate family from tool-*. After `tool-call`, a backgrounded
// call never emits tool-suspended/resumed/result/error; its whole lifecycle is
// background-tool-*, keyed by taskId (and toolCallId back to the call). Later actions
// may land in a different run than the call.

type BackgroundRef = ToolRef & { taskId: string };

export type BackgroundToolDispatchedAction = ActionBase &
  BackgroundRef & {
    type: 'background-tool-dispatched';
    disposition: 'deferred' | 'awaited';
    timeoutMs: number;
    maxRetries: number;
  };

export type BackgroundToolStartedAction = ActionBase &
  BackgroundRef & { type: 'background-tool-started'; attempt: number };

export type BackgroundToolSuspendedAction = ActionBase &
  BackgroundRef & { type: 'background-tool-suspended'; payload?: unknown };

export type BackgroundToolResumedAction = ActionBase &
  BackgroundRef & { type: 'background-tool-resumed'; resumeData?: unknown };

export type BackgroundToolResultAction = ActionBase &
  BackgroundRef & { type: 'background-tool-result'; output: unknown; modelOutput?: unknown };

export type BackgroundToolErrorAction = ActionBase &
  BackgroundRef & { type: 'background-tool-error'; errorText: string; willRetry: boolean };

export type BackgroundToolEndedAction = ActionBase &
  BackgroundRef & { type: 'background-tool-ended'; status: 'cancelled' | 'timed_out' };

// Always transient — live UI state that is meaningless once the run ends

export type MemoryStatusAction = ActionBase & {
  type: 'memory-status';
  transient: true;
  recordId: string;
  generation: number;
  windows: {
    active: { tokens: number; threshold: number };
    buffered?: { tokens: number; threshold: number };
  };
};

export type BackgroundToolProgressAction = ActionBase &
  BackgroundRef & { type: 'background-tool-progress'; transient: true; output: unknown; elapsedMs: number };

// Streaming deltas. Each `*-start` id is the `contentId` shared by its deltas and the finished action.

export type TextStartAction = ActionBase & { type: 'text-start'; transient: true; contentId: string };
export type TextDeltaAction = ActionBase & { type: 'text-delta'; transient: true; contentId: string; delta: string };
export type ReasoningStartAction = ActionBase & { type: 'reasoning-start'; transient: true; contentId: string };
export type ReasoningDeltaAction = ActionBase & {
  type: 'reasoning-delta';
  transient: true;
  contentId: string;
  delta: string;
};
/** Linked to the finished `tool-call` by `toolCallId`. */
export type ToolInputStartAction = ActionBase & ToolRef & { type: 'tool-input-start'; transient: true };
export type ToolInputDeltaAction = ActionBase & ToolRef & { type: 'tool-input-delta'; transient: true; delta: string };
/** Preliminary tool output; the final `tool-result` is persisted. */
export type ToolOutputDeltaAction = ActionBase &
  ToolRef & { type: 'tool-output-delta'; transient: true; output: unknown };

// Signals

type SignalContent =
  { type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string; filename?: string };

type SignalBase = ActionBase & {
  type: 'signal';
  tagName?: string;
  contents: SignalContent[];
  attributes?: AgentSignalAttributes;
};

export type SignalAction =
  | (SignalBase & { category: Exclude<AgentSignalCategory, 'state'> })
  | (SignalBase & {
      category: 'state';
      cacheKey: string;
      mode: AgentStateSignalMode;
      version: number;
      value?: unknown;
      delta?: unknown;
    });

export type MastraAction =
  | TextAction
  | ReasoningAction
  | FileAction
  | ReasoningFileAction
  | FileUnavailableAction
  | SourceUrlAction
  | SourceDocumentAction
  | DataAction
  | TurnStartAction
  | TurnEndAction
  | RunStartAction
  | RunEndAction
  | RunAbortedAction
  | SettingsChangedAction
  | TaskChangedAction
  | GoalStartedAction
  | GoalChangedAction
  | GoalEvaluatedAction
  | GoalEndedAction
  | ProviderEventAction
  | RawChunkAction
  | ModelChangedAction
  | ThreadTitleChangedAction
  | MemoryCycleStartAction
  | MemoryCycleEndAction
  | MemoryActivatedAction
  | StructuredOutputAction
  | ErrorAction
  | ToolCallAction
  | ToolStartedAction
  | ToolApprovalRequestedAction
  | ToolApprovalRespondedAction
  | ToolSuspendedAction
  | ToolResumedAction
  | ToolResultAction
  | ToolErrorAction
  | ToolDeniedAction
  | ToolDelegatedAction
  | BackgroundToolDispatchedAction
  | BackgroundToolStartedAction
  | BackgroundToolSuspendedAction
  | BackgroundToolResumedAction
  | BackgroundToolResultAction
  | BackgroundToolErrorAction
  | BackgroundToolEndedAction
  | BackgroundToolProgressAction
  | MemoryStatusAction
  | TextStartAction
  | TextDeltaAction
  | ReasoningStartAction
  | ReasoningDeltaAction
  | ToolInputStartAction
  | ToolInputDeltaAction
  | ToolOutputDeltaAction
  | SignalAction;

export type MastraActionType = MastraAction['type'];

/** What storage accepts. Always-transient types are excluded at the type level;
 * optionally-transient actions are filtered at runtime with `isPersistable`. */
export type PersistableAction = Exclude<MastraAction, { transient: true }>;

export const isPersistable = (action: MastraAction): action is PersistableAction => !action.transient;

/** Current action format. Bump when a reader of an older version would misread new rows. */
export const ACTION_FORMAT_VERSION = 1;

/**
 * Types a reader may skip when it doesn't know them: skipping them doesn't change what the model should see.
 * The rule is what the model should see, not what the projection renders today: `goal-evaluated`
 * (judge feedback) and `background-tool-result`/`-error` (a backgrounded call's outcome) are model-visible.
 */
export const IGNORABLE_ACTION_TYPES: ReadonlySet<string> = new Set<MastraActionType>([
  'run-start',
  'turn-end',
  'run-end',
  'run-aborted',
  'settings-changed',
  'task-changed',
  'goal-started',
  'goal-changed',
  'goal-ended',
  'provider-event',
  'model-changed',
  'structured-output',
  'thread-title-changed',
  'error',
  'file-unavailable',
  'source-url',
  'source-document',
  'memory-cycle-start',
  'memory-cycle-end',
  'memory-activated',
  'tool-started',
  'tool-suspended',
  'tool-resumed',
  'tool-delegated',
  'background-tool-dispatched',
  'background-tool-started',
  'background-tool-suspended',
  'background-tool-resumed',
  'background-tool-ended',
]);

export const isIgnorableActionType = (type: string): boolean =>
  IGNORABLE_ACTION_TYPES.has(type) || type.startsWith('data-');

/** The row as stored: `formatVersion` stamped, `ignorable` set for skippable types. Every store writes through this. */
export function toStoredAction<A extends PersistableAction>(action: A): A {
  return {
    ...action,
    formatVersion: action.formatVersion ?? ACTION_FORMAT_VERSION,
    ...(action.ignorable || isIgnorableActionType(action.type) ? { ignorable: true } : {}),
  };
}

/**
 * Whether this reader can read a stored row. Rows from a newer format version (missing reads as 1) are
 * unreadable even when their type is known, because the fields may mean something else there.
 * Unreadable rows are skipped when `ignorable` and refused with `UnsupportedActionError` otherwise.
 * Unknown types are judged by the caller, which knows its own type set.
 */
export function isReadableAction(action: PersistableAction): boolean {
  if ((action.formatVersion ?? 1) <= ACTION_FORMAT_VERSION) return true;
  if (action.ignorable) return false;
  throw new UnsupportedActionError(action.type, action.formatVersion);
}

/** A stored action this reader can't read and that isn't marked ignorable. */
export class UnsupportedActionError extends Error {
  constructor(
    readonly actionType: string,
    readonly formatVersion: number | undefined,
  ) {
    super(
      `Unsupported action type "${actionType}" (format version ${formatVersion ?? 'unknown'}, ` +
        `this reader supports ${ACTION_FORMAT_VERSION}). Upgrade @mastra/core to read this thread.`,
    );
    this.name = 'UnsupportedActionError';
  }
}
