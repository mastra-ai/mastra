/**
 * Harness v1 — runtime Session class.
 *
 * This is the in-memory authority for a single SessionRecord (§5.4). The
 * Harness creates one instance per live session and routes all writes to
 * the underlying record through it. The full surface is described in §4.2.
 *
 * The current local surface includes message/signal/queue turns, mode/model
 * and state mutation, display snapshots, message listing, pending inbox
 * responses, permissions, code/workspace skills, subagents, goals, event
 * forwarding, abort, idle waiting, wakeup queue admission, and the core
 * admission/mutation primitives used by remote routes, plus request-context
 * `registerQuestion` / `registerPlanApproval` / `registerSandboxAccess`
 * pending registration. Remote SDKs and full channel routing remain
 * follow-up lanes.
 *
 * Lifecycle states tracked here:
 *   - 'live'    — session is in the harness's live map and holds the lease.
 *   - 'closing' — the durable close marker has committed; new work is rejected
 *                 while previously admitted turns drain until the close deadline.
 *   - 'closed'  — `close()` has run; record has `closedAt` set in storage.
 *   - 'deleted' — the session row has been hard-deleted from storage.
 *   - 'evicted' — flushed to storage and dropped from live map; the record
 *                 remains active and the session can be re-hydrated after
 *                 fail-closed lease loss.
 *
 * Once a Session leaves 'live', every method except identity reads throws.
 * Callers must re-resolve via `harness.session(...)` to get a fresh instance.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { Agent } from '../../agent';
import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import {
  AGENT_EXECUTION_OPTION_COMPOSERS,
  AGENT_RESPONSE_RECOVERY_CONTINUATION,
  AGENT_RESPONSE_RECOVERY_STEP,
  type AgentExecutionOptionComposers,
} from '../../agent/merge-execution-options';
import { normalizeLogicalMessageInputIdentity, normalizeLogicalMessageIdentity } from '../../agent/message-list';
import type { LogicalMessageIdentity, LogicalMessageSignalIdentity } from '../../agent/message-list';
import { createSignal } from '../../agent/signals';
import type { AgentSignalContents, CreatedAgentSignal } from '../../agent/signals';
import {
  AgentThreadOutputDrainError,
  AgentThreadSignalAdmissionError,
  isAgentThreadOutputDrainTeardownError,
} from '../../agent/thread-stream-runtime';
import { parseToolApprovalDecision } from '../../agent/tool-call-identity';
import type { ToolApprovalDecision } from '../../agent/tool-call-identity';
import { TOOL_PERMISSION_POLICY_KEY, TOOL_PERMISSION_POLICY_STABLE_KEY } from '../../agent/tool-permission-prefilter';
import {
  captureSuspendedToolSurfaceFenceLease,
  clearSuspendedToolSurfaceFence,
  createToolSurfaceFence,
  materializeToolSurfaceFence,
  readToolSurfaceFence,
  stageToolSurfaceFenceRestore,
} from '../../agent/tool-surface-fence';
import type { ToolSurfaceFence } from '../../agent/tool-surface-fence';
import type { AgentThreadSubscription, ToolsInput } from '../../agent/types';
import { ModelRouterLanguageModel } from '../../llm/model/router';
import { PrefillErrorHandler, ProviderHistoryCompat, StreamErrorRetryProcessor } from '../../processors';
import { RequestContext } from '../../request-context';
import {
  HarnessStorageAdmissionConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageSessionEventReplayUnsupportedError,
  HarnessStorageVersionConflictError,
} from '../../storage/domains/harness';
import type {
  GoalJudgeDecision,
  GoalState,
  AgentSignalDispatchState,
  AgentSignalResultEvidence,
  AgentSignalResultStatus,
  HarnessAssistantDraft,
  HarnessPlanTask,
  HarnessPlanTaskStatus,
  HarnessRunSummary,
  HarnessStorage,
  HarnessStorageAttachmentUnavailableError,
  HarnessRuntimeDependencyRefs,
  InboxResponseReceipt,
  PendingInteractionExpiryGeneration,
  QueueAdmissionReceipt,
  PendingResume,
  PermissionRules,
  PersistedAttachment,
  OperationAdmissionTombstone,
  PersistedRequestContextInput,
  QueuedItem,
  SaveAttachmentReferenceInput,
  SessionGrants,
  SessionRecord,
  SessionSummary,
} from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';

import { ASK_USER_TOOL_ID, SUBMIT_PLAN_TOOL_ID } from '../../tools/builtin';
import { getTransformedToolPayload, hasTransformedToolPayload } from '../../tools/payload-transform';
import type { Workspace } from '../../workspace';

// §5.1 stable-hash canonicalization (centralized in ./canonical-json). Admission hashing here
// always validates caller-reachable input, so the checked variant is bound to the local name.
import { activityTimelineMessageReadBound, buildActivityTimeline } from './activity-timeline';
import type { ActivityTimelineSessionInput } from './activity-timeline';
import {
  assertJsonValue,
  canonicalJson,
  jsonValuesEqual,
  sha256CanonicalJsonChecked as sha256CanonicalJson,
} from './canonical-json';
// §5.1k / §6.4 plan-task session operations (TM-3/TM-4): the live session is the
// serialized writer for its plan tree; these helpers own rollup/cycle/in-progress.
// §4.4c caller request-context validation + the durable-DTO mapping used by admission hashing
// and the tool-visible context.
import { toHarnessDisplayStateSnapshotV1 } from './display-state';
import type { HarnessDisplayStateSnapshotV1 } from './display-state';
import {
  HarnessAbortedError,
  HarnessAdmissionConflictError,
  HarnessAttachmentUnavailableError,
  HarnessBusyError,
  HarnessConfigError,
  HarnessError,
  HarnessInboxItemNotFoundError,
  HarnessInboxResponseConflictError,
  HarnessOutputGenerationError,
  HarnessOverrideConflictError,
  HarnessPendingInteractionExpiredError,
  HarnessQueueFullDroppedError,
  HarnessQueueFullError,
  HarnessQueueItemExpiredError,
  HarnessSessionCancelledError,
  HarnessSessionClosedError,
  HarnessSessionCorruptError,
  harnessSessionClosingError,
  HarnessSessionDeletedError,
  HarnessSessionLockedError,
  HarnessStateConflictError,
  HarnessStateSerializationError,
  HarnessStorageError,
  HarnessSkillArgsValidationError,
  HarnessSkillNotFoundError,
  HarnessSubagentConcurrencyLimitError,
  HarnessSubagentDepthExceededError,
  HarnessValidationError,
  HarnessWorkspaceLostError,
  redactPublicBoundaryRejection,
} from './errors';
import type { HarnessAbortReason, HarnessOutputGenerationReason } from './errors';
import {
  assertCustomEventType,
  assertJsonSerializable,
  EventEmitter,
  parseHarnessEventId,
  projectHarnessPublicError,
  projectToolEventPayloadForJson,
  snapshotHarnessEventForJson,
} from './events';
import type {
  EmitInput,
  HarnessEvent,
  HarnessEventListener,
  HarnessEventUnsubscribe,
  RunCompletedEvent,
  RunCompletedStatus,
  RunToolRollup,
  SubagentEndEvent,
  SubagentReasoningDeltaEvent,
  SubagentStartEvent,
  SubagentTextDeltaEvent,
  SubagentToolEndEvent,
  SubagentToolStartEvent,
} from './events';
import type { Harness } from './harness';
import type { StoredMessageRow } from './message-conversion';
import { convertStoredMessageToHarnessMessage } from './message-conversion';
import { TERMINAL_PLAN_TASK_STATUSES } from './plan-task-hierarchy';
import type {
  AddTaskInput,
  CheckInput,
  DecomposeChildInput,
  DelegatedSubagentOutcome,
  PlanTaskSessionPort,
  PlanTaskSummary,
  PlanTaskView,
  ResetPlanTasksResult,
  UpdateTaskInput,
} from './plan-task-session';
import {
  capturePlanTaskDelegationScope,
  planTaskAdd,
  planTaskCheck,
  planTaskComplete,
  planTaskDecompose,
  planTaskDelegate,
  planTaskReconcileDelegation,
  planTaskReparent,
  planTaskReset,
  planTaskUpdate,
  PLAN_TASK_MAX_NODES,
  PLAN_TASK_UPDATED_EVENT,
  readDelegationAttemptMetadata,
} from './plan-task-session';
import { createPlanTaskTools } from './plan-task-tool';
import {
  callerRequestContextToPersisted,
  projectInheritedRequestContextApp,
  projectInheritedRequestContextAppBag,
  validateCallerRequestContext,
} from './request-context-input';
import { createSpawnSubagentTool, SPAWN_SUBAGENT_TOOL_ID } from './spawn-subagent-tool';
import { createSubagentOutcomeReportTool } from './subagent-outcome-tool';
import type {
  HarnessSubagentDirectAnswer,
  HarnessSubagentResultSummary,
  HarnessSubagentToolReceipt,
} from './terminal-subagent-result';
import {
  HARNESS_SUBAGENT_OUTCOME_REPORT_TOOL_ID,
  materializeHarnessTerminalText,
  parseHarnessSubagentOutcomeReport,
  parseHarnessSubagentTerminalResult,
  parseHarnessTerminalToolResultText,
  summarizeHarnessSubagentEventResult,
  summarizeHarnessSubagentResult,
  verifyHarnessSubagentTerminalCompletion,
  withHarnessSubagentToolReceipts,
} from './terminal-subagent-result';
import type {
  AgentResult,
  AgentStream,
  AttachmentRef,
  GoalOptions,
  HarnessActionCatalogEntry,
  HarnessActionCatalogListOptions,
  HarnessActionCatalogSourceKind,
  HarnessActionCatalogUnavailableReason,
  HarnessMcpServerDescriptor,
  HarnessMcpToolDescriptor,
  HarnessMessage,
  HarnessMode,
  InboxResponseOptions,
  InboxResponseResult,
  HarnessCustomEventInput,
  HarnessRequestContext,
  HarnessSkill,
  HarnessSkillActionMetadata,
  UseSkillOptions,
  ListMessagesOptions,
  MessageAdmissionResult,
  MessageOptions,
  MessageOptionsDefault,
  MessageOptionsStream,
  MessageOptionsStructured,
  ModelAuthStatus,
  PermissionPolicy,
  QueueAdmissionResult,
  QueueOptions,
  RegisterPlanApprovalParams,
  RegisterQuestionParams,
  RegisterSandboxAccessParams,
  SessionInjectSystemReminderOptions,
  SessionInjectSystemReminderResult,
  SessionSignalOptions,
  SessionSignalResult,
  SetStateOptions,
  ToolCategory,
  ActivityTimelineOptions,
  SessionActivityTimeline,
  MessageAdmissionPhase,
} from './types';

type MessageAdmissionIdentity = {
  signalId: string;
  runId: string;
};

type SignalAdmissionIdentity = {
  signalId: string;
  idleRunId: string;
};

type SignalAdmission = {
  admissionId: string;
  admissionHash: string;
  modeId: string;
  modelId: string;
  identity: SignalAdmissionIdentity;
  createdAt: number;
  dispatch: AgentSignalDispatchState;
};

type SignalDispatchingState = Extract<AgentSignalDispatchState, { state: 'dispatching' }>;
type SignalAcceptedDispatchState = Extract<AgentSignalDispatchState, { state: 'accepted' }>;
type SignalSettlementAdmission = Pick<
  SignalAdmission,
  'admissionId' | 'admissionHash' | 'modeId' | 'modelId' | 'dispatch'
>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function harnessDisplayToolPayload(
  metadata: unknown,
  phase: 'input-delta' | 'input-available' | 'output-available' | 'error',
  fallback: unknown,
): unknown {
  const transformed = getTransformedToolPayload(metadata, 'display', phase);
  if (hasTransformedToolPayload(transformed)) return transformed.transformed;
  // A display policy may intentionally suppress a payload. Never fall back to
  // the raw value in that case, because Harness events are durable/replayable
  // display records rather than the model's private transcript.
  if (transformed?.suppress === true) return { suppressed: true };
  return fallback;
}

/**
 * §S4.1 — a pending event-ledger append awaiting transient-failure retry. Everything
 * except `storedAt` is captured at enqueue time; `storedAt` is stamped at write time so
 * each retry records its own persistence timestamp.
 */
type PendingEventAppend = {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  eventId: string;
  epoch: string;
  sequence: number;
  event: JsonValue;
  emittedAt: number;
};

type MessageAdmissionStart = {
  admissionHash: string;
  modeId: string;
  modelId: string;
  promise: Promise<AgentSignalResultEvidence | OperationAdmissionTombstone>;
  /**
   * Set when the reservation write resolved this start as a duplicate of
   * existing durable evidence (PF-2250 §1: the duplicate fast-path read no
   * longer blocks admission, so a duplicate briefly registers a start entry
   * before the reservation discovers the existing row). Readers polling the
   * start map must treat such an entry as a duplicate admission, not a fresh
   * dispatch.
   */
  duplicate?: boolean;
};

type MessageAdmissionHashes = {
  primary: string;
  legacyCompatible: readonly string[];
};

type QueueResumeRecoveryResult =
  | { status: 'none' }
  | { status: 'completed'; result: AgentResult }
  | { status: 'stale' };

type ResumeResponseMode = 'agent-result' | 'inbox-receipt';
type InboxReceiptResponseOptions = Extract<InboxResponseOptions, { responseId: string }>;
type LegacyInboxResponseOptions = Extract<InboxResponseOptions, { responseId?: undefined }>;
type ActionCatalogSkillDescriptor = Pick<
  HarnessSkill,
  'name' | 'description' | 'filePath' | 'category' | 'action' | 'metadata'
>;
type ActionCatalogMcpCacheEntry = {
  entries: HarnessActionCatalogEntry[];
  expiresAt?: number;
  successful?: boolean;
};
type ActionCatalogMcpTimedOutWork = {
  work: Promise<HarnessActionCatalogEntry[]>;
  retryAfter: number;
  retryCount: number;
};

/**
 * Tool IDs the harness translates from `tool-call-approval` /
 * `tool-call-suspended` events into `question` / `plan-approval` `kind`s.
 * Shared with the built-in `askUser` / `submitPlan` tools so the contract
 * lives in a single place (`packages/core/src/tools/builtin`).
 */
/** Defensive cap on the synthetic-tool-terminal tombstone set (§10.2 / S1). */
const MAX_ABORTED_TOOL_TOMBSTONES = 4096;
/** Defensive cap on exact-once tool-terminal observations across resumed segments. */
const MAX_EMITTED_TOOL_TERMINALS = 4096;
/** One session can expose only one pending interaction at a time; keep a small
 * durable tail so late reconnect responses receive an exact expiry result
 * without allowing tombstones to grow without bound. */
const MAX_EXPIRED_PENDING_INTERACTIONS = 100;

// Step ceiling for every harness-driven agent turn. Without an explicit
// `maxSteps`, `agent.stream()`/`agent.generate()` fall back to the agent's
// small default (5), and a tool-heavy turn terminates CLEANLY at the step
// boundary with no synthesis text — live-diagnosed as a silent empty chat
// turn: 5 tool-only steps, `finish-step`×5, `finish`, zero text deltas
// (models that batch small parallel tool calls burn the budget fastest).
// agent-controller.ts centralizes the same guarantee for CLI-harness runs
// (CONTROLLER_MAX_STEPS); the harness governs runaway turns through its own
// budgets and abort lanes, so this is an escape-proof ceiling, not pacing.
const HARNESS_SESSION_MAX_STEPS = 1000;
type HarnessIterationCompleteHandler = NonNullable<AgentExecutionOptionsBase<unknown>['onIterationComplete']>;
type HarnessPrepareStep = NonNullable<AgentExecutionOptionsBase<unknown>['prepareStep']>;
type HarnessExecutionHookErrorReporter = (hook: 'onIterationComplete' | 'prepareStep', error: unknown) => void;

/**
 * Empty-final-synthesis nudge. Live-diagnosed twice on the same day (a chat
 * turn whose approved create tool succeeded, and a scripted journey whose
 * create ran un-gated): some models execute action tools successfully and
 * then finish the turn with zero visible text, so the user gets a mutation
 * and silence. When the final iteration has no text after completed tools,
 * force exactly ONE response-only continuation step so the model states the
 * outcome. Text from an earlier tool-call iteration is not a terminal answer
 * and must not suppress synthesis. The continuation has no active tools and
 * uses toolChoice `none`, so this remains true even if the model ignores the
 * feedback and attempts to repeat an action. One nudge per run segment — a
 * model that stays silent twice is allowed to finish (never loop). The loop
 * ignores continuation results for terminal tool delivery, and error, abort,
 * safety, and output-length finishes are left alone.
 */
function createHarnessEmptySynthesisOptions(reportConfiguredHookError: HarnessExecutionHookErrorReporter): {
  [AGENT_EXECUTION_OPTION_COMPOSERS]: () => AgentExecutionOptionComposers;
} {
  return {
    [AGENT_EXECUTION_OPTION_COMPOSERS]: () => {
      let nudged = false;
      let segmentHasToolResults = false;
      let responseOnly = false;
      let responseOnlyReservedAtIteration: number | undefined;
      let responseOnlyPrepared = false;
      let ordinaryBudgetExhausted = false;
      return {
        recoveryMaxSteps: 1,
        onIterationComplete: existing => {
          const configured = existing as HarnessIterationCompleteHandler | undefined;
          return async (context: Parameters<HarnessIterationCompleteHandler>[0]) => {
            // The recovery phase gets one provider response, even if that
            // response tries to call a tool that prepareStep hid. Configured
            // observers still see this iteration, but cannot reopen it.
            if (responseOnly) {
              // Durable loop predicates may be replayed before the transition
              // commits. Return the same reservation for the same terminal
              // iteration; only an actual later iteration closes recovery.
              if (context.iteration === responseOnlyReservedAtIteration) {
                return {
                  continue: true,
                  [AGENT_RESPONSE_RECOVERY_CONTINUATION]: true,
                };
              }
              try {
                await configured?.(context);
              } catch (error) {
                reportConfiguredHookError('onIterationComplete', error);
              }
              return { continue: false };
            }

            if (context.toolResults.length > 0) segmentHasToolResults = true;
            ordinaryBudgetExhausted ||= context.iteration >= HARNESS_SESSION_MAX_STEPS;
            const needsRecovery =
              context.isFinal &&
              !nudged &&
              context.text.trim() === '' &&
              segmentHasToolResults &&
              context.finishReason !== 'error' &&
              context.finishReason !== 'abort' &&
              context.finishReason !== 'tripwire' &&
              context.finishReason !== 'content-filter' &&
              context.finishReason !== 'length';
            let configuredResult: Awaited<ReturnType<HarnessIterationCompleteHandler>>;
            try {
              configuredResult = await configured?.(context);
            } catch (error) {
              // Keep the framework's established callback-error behavior for
              // ordinary iterations. On the exact silent terminal that needs
              // recovery, however, rethrowing would make the loop swallow the
              // error and strand a completed mutation with no user response.
              if (!needsRecovery) throw error;
              reportConfiguredHookError('onIterationComplete', error);
              configuredResult = undefined;
            }

            if (!needsRecovery) {
              // The ordinary Harness budget is a hard ceiling even when the
              // model, a scorer, a background-task wakeup, or an application
              // hook asks to continue. Only the exact response-only recovery
              // below may spend a provider call after this point.
              if (ordinaryBudgetExhausted) return { ...(configuredResult ?? {}), continue: false };
              return configuredResult;
            }

            // An application-level explicit stop/continue decision owns this
            // iteration before the ordinary budget is exhausted. At the exact
            // ceiling, `continue: true` is ordinary work and cannot consume the
            // reserved response-only call; the Harness still recovers silence.
            if (configuredResult?.continue !== undefined && !ordinaryBudgetExhausted) return configuredResult;
            if (configuredResult?.continue === false) return configuredResult;

            nudged = true;
            responseOnly = true;
            responseOnlyReservedAtIteration = context.iteration;
            const recoveryFeedback =
              'You received tool results but sent the user no reply. In one or two short sentences, ' +
              'report the result accurately, including whether the action succeeded, failed, or was denied. ' +
              'Do not claim an action ran unless its result confirms that. Do not call any more tools.';
            return {
              ...(configuredResult ?? {}),
              continue: true,
              [AGENT_RESPONSE_RECOVERY_CONTINUATION]: true,
              // Bare regeneration is not enough for models that habitually stop
              // after tool use (live-verified). Feedback is a suppressed assistant
              // note, so the model sees it but transcripts stay clean.
              feedback: configuredResult?.feedback
                ? `${configuredResult.feedback}\n\n${recoveryFeedback}`
                : recoveryFeedback,
            };
          };
        },
        prepareStep: existing => {
          const configured = existing as HarnessPrepareStep | undefined;
          return async (args: Parameters<HarnessPrepareStep>[0]) => {
            // `prepareStep` runs before the provider call. Once the 0-based
            // step index reaches the public ceiling, ordinary execution must
            // fail closed unless the preceding terminal iteration explicitly
            // armed the one response-only recovery call.
            const stepNumber = (args as { stepNumber?: number } | undefined)?.stepNumber;
            if (
              !responseOnly &&
              (ordinaryBudgetExhausted || (typeof stepNumber === 'number' && stepNumber >= HARNESS_SESSION_MAX_STEPS))
            ) {
              throw new HarnessOrdinaryStepBudgetExhaustedError();
            }
            if (responseOnly && responseOnlyPrepared) {
              throw new HarnessResponseRecoveryAlreadyPreparedError();
            }
            if (responseOnly) responseOnlyPrepared = true;

            let configuredResult: Awaited<ReturnType<HarnessPrepareStep>>;
            try {
              configuredResult = await configured?.(args);
            } catch (error) {
              // Keep configured prepareStep failures fatal during ordinary
              // execution, but never let an optional observer strand completed
              // tool work or bypass the response-only recovery fence.
              if (!responseOnly) throw error;
              reportConfiguredHookError('prepareStep', error);
              configuredResult = undefined;
            }
            if (!responseOnly) return configuredResult;
            return {
              ...(configuredResult ?? {}),
              activeTools: [],
              toolChoice: 'none',
              [AGENT_RESPONSE_RECOVERY_STEP]: true,
            };
          };
        },
      };
    },
  };
}

class HarnessResponseRecoveryAlreadyPreparedError extends Error {
  constructor() {
    super('Harness response recovery has already admitted its one provider attempt');
    this.name = 'HarnessResponseRecoveryAlreadyPreparedError';
  }
}

class HarnessOrdinaryStepBudgetExhaustedError extends Error {
  constructor() {
    super(`Harness ordinary step budget exhausted at ${HARNESS_SESSION_MAX_STEPS} steps`);
    this.name = 'HarnessOrdinaryStepBudgetExhaustedError';
  }
}

// §10.2 receipts stay bounded on BOTH axes (PF-2250, live-diagnosed): the map
// itself is idempotency state, so only a recent window is needed, and a stored
// result must never carry provider payloads large enough to push the session
// record past a storage document limit (Azure Responses reasoning blobs made a
// single applied receipt ~400KB and broke every later saveSession with an
// HTTP 500).
const MAX_INBOX_RESPONSE_RECEIPTS = 64;
const MAX_INBOX_RECEIPT_RESULT_BYTES = 64_000;

function boundInboxReceiptResult(full: unknown): unknown {
  try {
    const serialized = JSON.stringify(full);
    if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') <= MAX_INBOX_RECEIPT_RESULT_BYTES) {
      return full;
    }
  } catch {
    // Unserializable results cannot be persisted faithfully either way.
  }
  const source = (full ?? {}) as { finishReason?: unknown; text?: unknown; usage?: unknown };
  return {
    truncated: true,
    ...(source.finishReason === undefined ? {} : { finishReason: source.finishReason }),
    ...(typeof source.text === 'string' ? { text: source.text.slice(0, 8_000) } : {}),
    ...(source.usage === undefined ? {} : { usage: source.usage }),
  };
}

function queueReceiptRecency(receipt: QueueAdmissionReceipt): number {
  return (
    receipt.completedAt ?? receipt.failedAt ?? receipt.acceptedAt ?? receipt.admittingAt ?? receipt.enqueuedAt ?? 0
  );
}

function pruneQueueAdmissionReceipts(
  receipts: Record<string, QueueAdmissionReceipt>,
): Record<string, QueueAdmissionReceipt> {
  const entries = Object.entries(receipts);
  if (entries.length <= MAX_INBOX_RESPONSE_RECEIPTS) return receipts;
  entries.sort((left, right) => queueReceiptRecency(right[1]) - queueReceiptRecency(left[1]));
  return Object.fromEntries(entries.slice(0, MAX_INBOX_RESPONSE_RECEIPTS));
}

// Just under Convex's ~1MiB document limit, leaving headroom for envelope
// fields the adapter adds around the record.
const SESSION_RECORD_SIZE_BUDGET_BYTES = 900_000;

function safeSerializedSize(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function topRecordFieldSizes(record: SessionRecord): Array<[string, number]> {
  return Object.entries(record as unknown as Record<string, unknown>)
    .map(([key, value]) => [key, safeSerializedSize(value)] as [string, number])
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
}

function pruneInboxResponseReceipts(
  receipts: Record<string, InboxResponseReceipt>,
): Record<string, InboxResponseReceipt> {
  const entries = Object.entries(receipts);
  if (entries.length <= MAX_INBOX_RESPONSE_RECEIPTS) return receipts;
  entries.sort((left, right) => (right[1].updatedAt ?? 0) - (left[1].updatedAt ?? 0));
  return Object.fromEntries(entries.slice(0, MAX_INBOX_RESPONSE_RECEIPTS));
}

const ASK_USER_TOOL_NAME = ASK_USER_TOOL_ID;
const SUBMIT_PLAN_TOOL_NAME = SUBMIT_PLAN_TOOL_ID;
const MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS = 30_000;
const MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS = 100;
const SIGNAL_DISPATCH_CLAIM_TTL_MS = 30_000;
const SIGNAL_DISPATCH_CLAIM_RENEW_MS = 10_000;
const SIGNAL_ACCEPTED_RECOVERY_STALE_MS = 30_000;
const SIGNAL_NATIVE_ACCEPT_TIMEOUT_MS = 30_000;
const MESSAGE_RESULT_EVIDENCE_BACKGROUND_OBSERVE_TIMEOUT_MS = 5_000;
const QUEUE_ACCEPTED_RECOVERY_STALE_MS = 30_000;
const QUEUE_POST_RUN_FINALIZATION_RETRY_MS = 1_000;
/**
 * §S4.1 — max transiently-failed event-ledger appends retained for retry before
 * fail-stop. A transient `appendSessionEvent` failure no longer permanently latches
 * the durable log: the failed slot is backlogged and retried (in order) ahead of any
 * later sequence on the next append, preserving ledger contiguity. Past this bound we
 * can no longer guarantee retry without unbounded memory, so we hard-latch and let a
 * reconnect recover via the §10.5 snapshot path.
 */
const MAX_PENDING_FAILED_EVENT_APPENDS = 256;
/** TM-6 reconcile-on-rehydrate retry (transient/CAS/locked failures). */
const DELEGATION_RECONCILE_RETRY_BASE_MS = 500;
const DELEGATION_RECONCILE_RETRY_MAX_MS = 30_000;
/**
 * TM-6 `includeSubtree` transfers the complete valid plan. The plan writer
 * already enforces this bound, so a normal delegated child never receives a
 * partial execution unit that the parent would later settle as complete.
 */
const DELEGATED_SUBTREE_MAX_NODES = PLAN_TASK_MAX_NODES;
const ACTION_CATALOG_DEFAULT_LIMIT = 100;
const ACTION_CATALOG_MAX_LIMIT = 500;
const ACTION_CATALOG_MCP_LIST_TIMEOUT_MS = 2_000;
// Cap explicit extensions to one day so a lost worker cannot pin a session indefinitely.
const MAX_LEASE_EXTENSION_MS = 24 * 60 * 60 * 1_000;
const ACTION_CATALOG_MCP_SUCCESS_CACHE_MS = 5_000;
const ACTION_CATALOG_MCP_FAILURE_CACHE_MS = 30_000;
const ACTION_CATALOG_MCP_MAX_TIMEOUT_RETRIES = 1;
const ACTION_CATALOG_SOURCE_KINDS: readonly HarnessActionCatalogSourceKind[] = ['skill', 'mcp-server', 'mcp-tool'];
const ACTION_CATALOG_SOURCE_ORDER: Record<HarnessActionCatalogSourceKind, number> = {
  skill: 0,
  'mcp-server': 1,
  'mcp-tool': 2,
};
const SUPPORTED_SKILL_ARG_SCHEMA_KEYS = new Set([
  'required',
  'properties',
  'type',
  'enum',
  'items',
  'additionalProperties',
]);
const RESERVED_MCP_SERVER_KEYS = new Set([...Object.getOwnPropertyNames(Object.prototype), '__proto__']);

function isPlainStateObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * §10.2 state_changed sentinel for a whole-root change. `session.state` is
 * `unknown` — it may legitimately be a scalar, array, or plain object root (see
 * `firstNonJsonStatePath`, which explicitly allows scalar/array roots). When
 * the root itself is not a plain object on both sides, there are no top-level
 * keys to diff, so a genuine root change is reported under this sentinel key,
 * matching the `$`-for-root path convention used elsewhere in this module.
 */
const STATE_ROOT_SENTINEL = '$';

/**
 * §10.2 state_changed: the keys whose value changed between two durable
 * `session.state` snapshots.
 *
 * When BOTH snapshots are plain objects, the result is the set of top-level
 * keys that were added, removed, or mutated. Reference-equal values
 * short-circuit (the common `setState` spread keeps unchanged value refs
 * intact), so only genuinely-changed keys are reported; a canonical
 * (key-order-independent) JSON compare confirms changed references.
 *
 * When the root is NOT a plain object on both sides (e.g. a scalar->scalar,
 * array->array, or scalar<->object transition), there are no top-level keys to
 * diff. A genuine change is then reported under the `'$'` root sentinel so the
 * state_changed signal still fires; consumers read the full new root from the
 * event's `state` field. Equal roots (canonical JSON) report no change.
 */
function diffStateKeys(prev: unknown, next: unknown): string[] {
  if (!isPlainStateObject(prev) || !isPlainStateObject(next)) {
    if (prev === next) return [];
    if (jsonValuesEqual(prev as JsonValue | undefined, next as JsonValue | undefined)) return [];
    return [STATE_ROOT_SENTINEL];
  }
  const a = prev;
  const b = next;
  const changed: string[] = [];
  for (const key of new Set<string>([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[key];
    const bv = b[key];
    if (av === bv) continue;
    if (jsonValuesEqual(av as JsonValue | undefined, bv as JsonValue | undefined)) continue;
    changed.push(key);
  }
  return changed;
}

/**
 * §5.1 state-shape validation. Returns the dotted path (`$` for the root) of the
 * FIRST value in a candidate `session.state` that cannot round-trip through
 * `JSON.stringify`/`JSON.parse` as plain JSON, or `undefined` when the whole
 * value is valid. Valid = `null`, string, boolean, FINITE number, plain array,
 * or PLAIN object whose values are all valid.
 *
 * The check is descriptor-STRICT — it rejects everything `JSON.stringify` would
 * silently DROP or TRANSFORM, not just obviously-bad scalar values:
 *   - scalar: `undefined`, `function`, `symbol`, `bigint`, `NaN`/`Infinity`
 *   - circular references
 *   - non-plain objects (`Date`/`Map`/`Set`/`RegExp`/class instances) — these
 *     either throw, serialize as `{}`, or transform via `toJSON`
 *   - symbol-keyed properties (dropped by JSON)
 *   - non-enumerable own properties (dropped by JSON)
 *   - accessor properties (getters/setters) — not data, and a getter would run
 *     arbitrary/throwing code; we reject WITHOUT invoking it
 *   - arrays with non-index own properties or sparse holes (dropped / become null)
 * Traversal is deterministic (`Reflect.ownKeys` order) so the reported path is
 * stable, and a data value is only READ after its descriptor is confirmed safe.
 */
function firstNonJsonStatePath(value: unknown, path: string, seen: Set<object>): string | undefined {
  if (value === null) return undefined;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return undefined;
  if (t === 'number') return Number.isFinite(value as number) ? undefined : path;
  if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') return path;
  if (t !== 'object') return path;
  const obj = value as object;
  if (seen.has(obj)) return path; // circular reference

  if (Array.isArray(obj)) {
    seen.add(obj);
    const len = obj.length;
    // Reject any own key that isn't a dense [0, len) index (extra props +
    // accessors are dropped/transformed by JSON; `length` is intrinsic).
    for (const key of Reflect.ownKeys(obj)) {
      if (key === 'length') continue;
      if (typeof key === 'symbol') return done(seen, obj, path);
      // Only CANONICAL dense indices are real array elements; `"01"`/`"1.0"`/
      // `""`/`" "` etc. coerce into range but are non-index props JSON drops.
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx >= len || String(idx) !== key) return done(seen, obj, path);
      const desc = Object.getOwnPropertyDescriptor(obj, key);
      if (desc === undefined || desc.get !== undefined || desc.set !== undefined) {
        return done(seen, obj, path === '$' ? String(idx) : `${path}.${idx}`);
      }
    }
    for (let i = 0; i < len; i++) {
      const childPath = path === '$' ? String(i) : `${path}.${i}`;
      if (!(i in obj)) return done(seen, obj, childPath); // sparse hole (JSON → null)
      const r = firstNonJsonStatePath((obj as unknown[])[i], childPath, seen);
      if (r !== undefined) return done(seen, obj, r);
    }
    seen.delete(obj);
    return undefined;
  }

  // Only plain objects (Object.prototype or null prototype) are valid JSON
  // containers; Date/Map/Set/class instances etc. are not round-trippable.
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) return path;
  seen.add(obj);
  for (const key of Reflect.ownKeys(obj)) {
    if (typeof key === 'symbol') return done(seen, obj, path); // symbol-keyed prop (dropped)
    const childPath = path === '$' ? key : `${path}.${key}`;
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc === undefined) return done(seen, obj, childPath);
    if (!desc.enumerable) return done(seen, obj, childPath); // dropped by JSON
    if (desc.get !== undefined || desc.set !== undefined) return done(seen, obj, childPath); // accessor — never invoked
    const r = firstNonJsonStatePath((obj as Record<string, unknown>)[key], childPath, seen);
    if (r !== undefined) return done(seen, obj, r);
  }
  seen.delete(obj);
  return undefined;
}

/** Pop the circular-tracking frame and return the offending path. */
function done(seen: Set<object>, obj: object, path: string): string {
  seen.delete(obj);
  return path;
}

function cloneMcpCatalogValue(value: unknown): unknown | undefined {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as unknown;
    } catch {
      return undefined;
    }
  }
}

function isPlainMcpCatalogObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneMcpCatalogRecord(value: unknown): Record<string, unknown> | undefined {
  const cloned = cloneMcpCatalogValue(value);
  return isPlainMcpCatalogObject(cloned) ? cloned : undefined;
}

function cloneMcpCatalogRecordArray(value: unknown): readonly Record<string, unknown>[] | undefined {
  const cloned = cloneMcpCatalogValue(value);
  if (!Array.isArray(cloned) || cloned.some(item => !isPlainMcpCatalogObject(item))) {
    return undefined;
  }
  return cloned as Record<string, unknown>[];
}

function cloneMcpSchemaLike(value: unknown): unknown | undefined {
  if (value && typeof value === 'object' && 'jsonSchema' in value) {
    return cloneMcpCatalogValue((value as { jsonSchema?: unknown }).jsonSchema);
  }
  return cloneMcpCatalogValue(value);
}

function encodeActionCatalogIdPart(value: string): string {
  return encodeURIComponent(value);
}

function compareActionCatalogIds(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function cloneActionCatalogEntry(entry: HarnessActionCatalogEntry): HarnessActionCatalogEntry {
  const cloned = cloneMcpCatalogValue(entry);
  if (cloned === undefined) {
    throw new HarnessValidationError(
      'actions.list()',
      `could not clone action catalog entry ${JSON.stringify(entry.id)}`,
    );
  }
  return cloned as HarnessActionCatalogEntry;
}

function cloneActionCatalogStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.length === 0)) {
    return undefined;
  }
  return [...value];
}

function cloneActionCatalogShortcuts(value: unknown): HarnessSkillActionMetadata['shortcuts'] | undefined {
  if (!Array.isArray(value)) return undefined;
  const shortcuts = value.map(item => {
    if (!isPlainMcpCatalogObject(item) || typeof item.id !== 'string' || item.id.length === 0) return undefined;
    const keys = cloneActionCatalogStringArray(item.keys);
    if (item.keys !== undefined && !keys) return undefined;
    if (item.label !== undefined && typeof item.label !== 'string') return undefined;
    return {
      id: item.id,
      ...(item.label ? { label: item.label } : {}),
      ...(keys ? { keys } : {}),
    };
  });
  return shortcuts.some(shortcut => !shortcut) ? undefined : (shortcuts as HarnessSkillActionMetadata['shortcuts']);
}

function cloneActionCatalogPermissions(value: unknown): HarnessSkillActionMetadata['permissions'] | undefined {
  if (!isPlainMcpCatalogObject(value)) return undefined;
  const tools = cloneActionCatalogStringArray(value.tools);
  const fileScopes = cloneActionCatalogStringArray(value.fileScopes);
  const networkScopes = cloneActionCatalogStringArray(value.networkScopes);
  const mcpScopes = cloneActionCatalogStringArray(value.mcpScopes);
  if (
    (value.tools !== undefined && !tools) ||
    (value.fileScopes !== undefined && !fileScopes) ||
    (value.networkScopes !== undefined && !networkScopes) ||
    (value.mcpScopes !== undefined && !mcpScopes)
  ) {
    return undefined;
  }
  return {
    ...(tools ? { tools } : {}),
    ...(fileScopes ? { fileScopes } : {}),
    ...(networkScopes ? { networkScopes } : {}),
    ...(mcpScopes ? { mcpScopes } : {}),
  };
}

function cloneActionMetadataLike(value: unknown): HarnessSkillActionMetadata | undefined {
  if (!isPlainMcpCatalogObject(value)) return undefined;
  if (value.displayName !== undefined && typeof value.displayName !== 'string') return undefined;
  if (value.icon !== undefined && typeof value.icon !== 'string') return undefined;
  const shortcuts = cloneActionCatalogShortcuts(value.shortcuts);
  const inputSchema = cloneMcpCatalogRecord(value.inputSchema);
  const outputSchema = cloneMcpCatalogRecord(value.outputSchema);
  const artifactTypes = cloneActionCatalogStringArray(value.artifactTypes);
  const permissions = cloneActionCatalogPermissions(value.permissions);
  if (
    (value.shortcuts !== undefined && !shortcuts) ||
    (value.inputSchema !== undefined && !inputSchema) ||
    (value.outputSchema !== undefined && !outputSchema) ||
    (value.artifactTypes !== undefined && !artifactTypes) ||
    (value.permissions !== undefined && !permissions)
  ) {
    return undefined;
  }
  return {
    ...(value.displayName ? { displayName: value.displayName } : {}),
    ...(value.icon ? { icon: value.icon } : {}),
    ...(shortcuts ? { shortcuts } : {}),
    ...(inputSchema ? { inputSchema } : {}),
    ...(outputSchema ? { outputSchema } : {}),
    ...(artifactTypes ? { artifactTypes } : {}),
    ...(permissions ? { permissions } : {}),
  };
}

class ActionCatalogMcpListTimeoutError extends Error {
  constructor() {
    super(`MCP tool catalog did not resolve within ${ACTION_CATALOG_MCP_LIST_TIMEOUT_MS}ms`);
    this.name = 'ActionCatalogMcpListTimeoutError';
  }
}

function startActionCatalogMcpListWithTimeout<T>(
  run: (abortSignal: AbortSignal) => Promise<T>,
  onTimeout?: (work: Promise<T>) => void,
): {
  pending: Promise<T>;
  work: Promise<T>;
  didTimeout: () => boolean;
} {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const work = run(controller.signal);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const timeoutError = new ActionCatalogMcpListTimeoutError();
      timedOut = true;
      onTimeout?.(work);
      controller.abort(timeoutError);
      reject(timeoutError);
    }, ACTION_CATALOG_MCP_LIST_TIMEOUT_MS);
  });
  const pending = Promise.race([work, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
  return {
    pending,
    work,
    didTimeout: () => timedOut,
  };
}

const DELEGATION_DEADLINE_REACHED = Symbol('delegation-deadline-reached');

/** Race one durable delegation result against its persisted absolute deadline. */
async function waitForDelegationResult<T>(
  promise: Promise<T>,
  deadlineAt: number,
): Promise<T | typeof DELEGATION_DEADLINE_REACHED> {
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  if (remainingMs === 0) return DELEGATION_DEADLINE_REACHED;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof DELEGATION_DEADLINE_REACHED>(resolve => {
    timer = setTimeout(() => resolve(DELEGATION_DEADLINE_REACHED), remainingMs);
    if (typeof timer.unref === 'function') timer.unref();
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function summarizeDelegationDeadline(deadlineAt: number): HarnessSubagentResultSummary {
  const summary = summarizeHarnessSubagentEventResult(
    summarizeHarnessSubagentResult(undefined, {
      isError: true,
      error: {
        code: 'harness.delegation_timeout',
        message: `The delegated subagent did not complete before its durable deadline (${deadlineAt})`,
      },
    }),
  );
  return { ...summary, outcome: 'failed' };
}

export type SessionLifecycleState = 'live' | 'closing' | 'closed' | 'deleted' | 'evicted';

interface QueueBackpressureDrop {
  queuedItemId: string;
  admissionId?: string;
  replacementQueuedItemId?: string;
  replacementAdmissionId?: string;
  maxQueueDepth: number;
  source: 'queue' | 'goal';
  goalId?: string;
}

/**
 * System prompt for the goal judge. Lifted verbatim from
 * mastracode/src/tui/goal-manager.ts so the harness-native judge produces
 * the same verdicts as the TUI implementation. The wording matters — the
 * "don't wait for yourself" rule and the asked-question-vs-checkpoint
 * distinction prevent the loop from flip-flopping.
 */
const JUDGE_SYSTEM_PROMPT = `You are the goal judge. Your decision directly controls whether the assistant continues working toward the goal.

Given a goal and the assistant's latest response, reason about whether the goal's requirements have been satisfied. Compare what the goal asks for against what the assistant has actually produced. Focus on substance, not phrasing.

Use "done" when the goal is fully achieved.
Use "waiting" only when the goal explicitly requires a user checkpoint, user feedback, human verification, human confirmation, or another external event outside the goal-judge loop before the assistant should continue, and the assistant has correctly stopped at that checkpoint. Do not use "waiting" merely because the assistant asked a question or could benefit from user input.
Use "continue" when the goal is not done and the assistant should keep working autonomously, including when it asked for input that the goal did not explicitly require.
If your previous decision was "waiting" for an explicit user checkpoint, keep choosing "waiting" when the user's latest response asks a question, requests clarification, or otherwise does not satisfy the checkpoint. Do not continue until the required user feedback/confirmation/verification has actually been provided.
If the goal says to wait for the goal judge, judge, evaluator, or you to respond, approve, verify, validate, tell the assistant to continue, or otherwise provide the next signal, treat your own decision as that judge response. Verification can be performed by you unless the goal explicitly says it needs human/user verification. Choose "continue" when the assistant should proceed to the next step. Do not choose "waiting" for judge-controlled checkpoints, because that would mean waiting for yourself.

Your "reason" field is sent back to the assistant as guidance when the goal is not yet done — be specific about what still needs to be accomplished. When choosing "continue", write the reason as an instruction for what the assistant should do next. When choosing "waiting", explain what specific user checkpoint is still outstanding.`;

/** Structured-output schema used by the goal judge call (§4.7). */
const GoalJudgeSchema = z.object({
  decision: z
    .enum(['done', 'continue', 'waiting'])
    .describe(
      'Whether the goal is done, should continue autonomously, or is at an explicit user checkpoint required by the goal',
    ),
  reason: z.string().describe('Brief explanation of what was accomplished or what remains to be done'),
});

/** Per-message cap on judge-context strings to keep judge latency bounded. */
const JUDGE_TRUNCATE_LIMIT = 4000;

// ---------------------------------------------------------------------------
// Permission helpers (§4.2e). Tiny shape validators kept module-scoped so the
// session methods stay focused on persistence + event emission.
// ---------------------------------------------------------------------------

const TOOL_CATEGORIES: readonly ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];
const PERMISSION_POLICIES: readonly PermissionPolicy[] = ['allow', 'ask', 'deny'];

/**
 * Harness-owned control tools that must remain callable for the protocol itself
 * to make progress. `ask_user` / `submit_plan` are the suspension boundary and
 * `report_subagent_outcome` is the child session's mandatory terminal envelope.
 *
 * Plan mutation/check/delegation tools and `spawn_subagent` are intentionally
 * absent: they mutate durable state or expand execution capability, so they obey
 * the same permission policy and subagent capability allowlist as application
 * tools. Kept in sync with `_buildToolSurface`.
 */
const UNGATED_HARNESS_BUILTIN_TOOL_IDS: ReadonlySet<string> = new Set<string>([
  HARNESS_SUBAGENT_OUTCOME_REPORT_TOOL_ID,
  ASK_USER_TOOL_ID,
  SUBMIT_PLAN_TOOL_ID,
]);

function assertToolCategory(method: string, value: unknown): asserts value is ToolCategory {
  if (typeof value !== 'string' || !TOOL_CATEGORIES.includes(value as ToolCategory)) {
    throw new HarnessValidationError(method, `unknown ToolCategory ${JSON.stringify(value)}`);
  }
}

function assertToolName(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'toolName must be a non-empty string');
  }
}

function assertAgentType(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'agentType must be a non-empty string');
  }
}

function assertModelId(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'model must be a non-empty string');
  }
}

function assertPolicy(method: string, value: unknown): asserts value is PermissionPolicy {
  if (typeof value !== 'string' || !PERMISSION_POLICIES.includes(value as PermissionPolicy)) {
    throw new HarnessValidationError(method, `policy must be one of ${PERMISSION_POLICIES.join(' | ')}`);
  }
}

function isStorageAttachmentUnavailableError(err: unknown): err is HarnessStorageAttachmentUnavailableError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'harness.storage.attachment_unavailable' &&
    typeof (err as { sessionId?: unknown }).sessionId === 'string' &&
    typeof (err as { attachmentId?: unknown }).attachmentId === 'string'
  );
}

function truncateForJudge(value: string): string {
  return value.length > JUDGE_TRUNCATE_LIMIT ? value.slice(0, JUDGE_TRUNCATE_LIMIT) + '\n...[truncated]' : value;
}

function escapeGoalXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Continuation prompts. The wording matters — these are lifted verbatim
 * from `mastracode/src/tui/goal-manager.ts` + `commands/goal.ts` so the
 * harness-native goal API produces byte-identical kickoff/resume/judge-
 * continue messages.
 */

/** Kickoff sent by `setGoal` (parity with TUI's `createGoalReminderXml`). */
function buildKickoffContinuation(objective: string): string {
  return `<system-reminder type="goal">${escapeGoalXml(objective)}</system-reminder>`;
}

/** Continuation sent by `resumeGoal` (parity with TUI's `/goal resume`). */
function buildResumeContinuation(objective: string): string {
  return `Continue working toward the goal: ${objective}`;
}

/**
 * Continuation sent after a judge `continue` verdict (parity with TUI's
 * `GoalManager.buildContinuationPrompt`).
 */
function buildJudgeContinuation(opts: { turn: number; max: number; objective: string; judgeReason: string }): string {
  const message = `[Goal attempt ${opts.turn}/${opts.max}] The goal is not yet complete. Judge feedback: ${opts.judgeReason}\n\nContinue working toward the goal: ${opts.objective}`;
  return `<system-reminder type="goal-judge">${escapeGoalXml(message)}</system-reminder>`;
}

/**
 * Defensive cap on `inProgressTaskIds` in the lazily-seeded plan-task summary
 * (§5.1k / TM-5). The single-in-progress-per-root rule keeps this naturally
 * small; the cap bounds a degenerate tree from materializing an unbounded id
 * list into the display snapshot.
 */
const PLAN_TASK_SUMMARY_IN_PROGRESS_CAP = 100;

/**
 * Active-tool tracking for `SessionDisplayState.activeTools`. One entry per
 * `tool_start` that has not yet been settled by a matching `tool_end`. Drops
 * out on `tool_end` regardless of `isError`.
 */
export interface ActiveToolState {
  toolCallId: string;
  toolName: string;
  args: unknown;
  startedAt: number;
  /** Set when this tool call came from a spawned subagent, not the parent. */
  subagentSessionId?: string;
}

/**
 * Active-subagent tracking for `SessionDisplayState.activeSubagents`. Keyed
 * on the parent's `spawn_subagent` tool call id. Dropped on subagent close.
 */
export interface ActiveSubagentState {
  subagentSessionId: string;
  agentType: string;
  task: string;
  parentToolCallId: string;
  startedAt: number;
  /**
   * Live child-run progress for the parent's display snapshot (§SA2). Lets a
   * polling / reconnecting / display-state consumer see a subagent's inner
   * progress from the PARENT snapshot alone (streaming consumers can still read
   * the `subagent_*` event family). Best-effort + in-memory: updated as the
   * child's bridged events arrive; absent fields mean "not yet observed".
   */
  status?: 'running' | 'awaiting_input' | 'completed' | 'failed';
  /** The child's currently-executing tool, if one is in flight; cleared when it ends. */
  currentToolName?: string;
  /** Count of child tool calls observed so far. */
  toolCalls?: number;
  /** The child run's token usage, populated at the child's terminal. */
  usage?: TokenUsage;
  /** Last time this projection was updated from a child event. */
  updatedAt?: number;
}

/** Cumulative token usage for the session's thread. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Internal: outstanding `waitForIdle()` waiter. `check()` re-evaluates
 * `isBusy()` and resolves the underlying Promise if idle (returns `true`
 * when the waiter is satisfied); `reject()` finalises with an error
 * (close/timeout); `cleanup()` disposes timers + removes the waiter from
 * `_idleWaiters`.
 */
interface IdleWaiter {
  check: () => boolean;
  reject: (err: unknown) => void;
  cleanup: () => void;
}

interface ActiveTurnWaiter {
  promise: Promise<never>;
  controller?: AbortController;
  reject: (err: unknown) => void;
  cleanup: () => void;
}

/**
 * Point-in-time snapshot returned by `getDisplayState()` (§4.2). Reads off
 * the in-memory `SessionRecord` plus a few transient run-only fields.
 *
 * Persistent thread-level aggregates (task lists, modified-file ledgers, OM
 * progress) deliberately live in `session.state`, not here — see the
 * `getDisplayState()` doc-comment for the split rationale. All `Record<>`
 * collections returned here are fresh on every call; do not mutate them.
 */
// ---------------------------------------------------------------------------
// Run projection (§5.1b SessionRunProjection). A bounded read-model view of the
// active run for the session list/detail UI — NOT the durable
// HarnessRunOperationalState recovery record. Populated from live session state;
// `getDisplayState().currentRun` is present only while a run is in flight.
// ---------------------------------------------------------------------------
export type HarnessRunStatus = 'starting' | 'running' | 'waiting' | 'resuming' | 'completed' | 'failed' | 'interrupted';

export type HarnessRunOperationRefKind = 'signal' | 'queue' | 'sync-generate' | 'use-skill' | 'inbox-response';

export interface SessionRunProjection {
  runId: string;
  traceId?: string;
  status: HarnessRunStatus;
  operation: {
    kind: HarnessRunOperationRefKind;
    signalId?: string;
    queuedItemId?: string;
    itemId?: string;
    responseId?: string;
    skillName?: string;
  };
  modeId: string;
  modelId: string;
  agentId: string;
  startedAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Span-summary (S3/S4/O1/O2/O6) — per-run span tracking for the canonical
// `run_completed` event + the durable run summary. An OpenRunSpan is opened at
// the run's FIRST `agent_start` (agent_start is emitted ONCE per run; a resume
// reuses the runId and emits only the terminal `agent_end`) and finalized +
// removed at the run's terminal `agent_end`. It is intentionally NOT cleared by
// `_resetTurnTracking`/`_endTurn`, so it survives an in-process suspend/resume
// and the duration spans the whole run (including any HITL wait). A run whose
// original start was lost to a process restart has NO OpenRunSpan when its
// terminal fires post-restart → the summary is marked `reconstructed` and omits
// the start/duration/rollup rather than publishing falsely precise metrics.
// ---------------------------------------------------------------------------

/** @internal — captured run identity for a run summary (mirrors the live projection's effective identity). */
interface RunSpanIdentity {
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  agentId: string;
  modeId: string;
  modelId: string;
  traceId?: string;
  operationKind?: HarnessRunOperationRefKind;
}

/** @internal — in-memory accumulator for one in-flight run's span + tool rollup. */
interface OpenRunSpan {
  startedAt: number;
  identity: RunSpanIdentity;
  /** Per-tool-call start times (runId-scoped), used to compute `tool_end.durationMs` even across an in-process suspend. */
  activeToolStarts: Map<string, { toolName: string; startedAt: number }>;
  rollup: {
    count: number;
    errors: number;
    totalDurationMs: number;
    maxDurationMs: number;
    perTool: Map<string, { count: number; errors: number; totalDurationMs: number }>;
  };
}

/** Bound on the finalized-runId dedup set (oldest entries dropped wholesale; re-finalizing an ancient runId is impossible in practice). */
const MAX_FINALIZED_RUN_IDS = 4096;
const MAX_DELIVERED_TERMINAL_SUBAGENT_ANSWERS = 4096;
/** Bounded safe receipt evidence retained per run for subagent settlement. */
const MAX_HARNESS_RUN_TOOL_RECEIPTS = 256;
const MAX_HARNESS_RUN_TOOL_RECEIPT_BYTES = 64 * 1024;
const MAX_HARNESS_RUN_TOOL_RECEIPT_SETS = 64;
/**
 * Drafts share the parent SessionRecord with queues, receipts, policy and run
 * state. Bound both each streamed field and the whole draft projection in
 * UTF-8 bytes so multibyte output cannot silently exceed a storage adapter's
 * document limit (Convex, for example, caps a document at 1 MiB).
 */
const MAX_ASSISTANT_DRAFT_FIELD_BYTES = 128_000;
const MAX_PERSISTED_ASSISTANT_DRAFT_BYTES = 384 * 1024;
const MAX_PERSISTED_ASSISTANT_DRAFTS = 8;
const ASSISTANT_DRAFT_FLUSH_DELAY_MS = 250;
const ASSISTANT_DRAFT_TEXT_ENCODER = new TextEncoder();
const ASSISTANT_DRAFT_TEXT_DECODER = new TextDecoder();

export interface SessionDisplayState {
  // Identity
  sessionId: string;
  threadId: string;
  resourceId: string;
  parentSessionId?: string;
  lifecycleState: SessionLifecycleState;
  modeId: string;
  modelId: string;
  createdAt: number;
  lastActivityAt: number;

  // Run
  isRunning: boolean;
  currentRunId?: string;
  currentMessageId?: string;
  currentTraceId?: string;
  // §5.1b structured projection of the in-flight run (present only while a run
  // is active). Consolidates the loose currentRun* fields above into the spec
  // SessionRunProjection shape for the session list/detail UI.
  currentRun?: SessionRunProjection;

  // Activity
  activeTools: Record<string, ActiveToolState>;
  toolInputBuffers: Record<string, { toolName: string; text: string }>;
  activeSubagents: Record<string, ActiveSubagentState>;
  assistantDrafts?: Record<string, HarnessAssistantDraft>;

  // Tokens
  tokenUsage: TokenUsage;

  // Pending interrupt (full UX payload, not recovery-only metadata)
  pending: SessionDisplayPending | null;

  // Queue
  queueDepth: number;
  currentQueuedItemId?: string;

  // Goal
  goal?: SessionRecord['goal'];

  // Plan tasks (§5.1k / TM-5): a BOUNDED summary — counts + active in_progress
  // ids + root count — NOT the full tree. UIs drive detail off the
  // `papersflow.plan_task.updated` event deltas + the bounded `plan_task_check`
  // read. Absent until the session has observed its plan tree.
  planTasks?: PlanTaskSummary;
}

export type SessionDisplayPending = Omit<
  NonNullable<SessionRecord['pendingResume']>,
  'runtimeDependencies' | 'requestContext' | 'toolSurfaceFence' | 'toolReceipts' | 'toolReceiptsOverflow' | 'expiresAt'
> & { expiresAt: number };

function pendingResumeForDisplay(pending: SessionRecord['pendingResume']): SessionDisplayPending | null {
  if (!pending) return null;
  // Strip storage-internal recovery fields and the caller app bag. Receipt
  // identities authenticate a terminal report after restart; they are not the
  // UI's activity feed (tool events already provide that public projection).
  const {
    runtimeDependencies: _runtimeDependencies,
    requestContext: _requestContext,
    toolSurfaceFence: _toolSurfaceFence,
    toolReceipts: _toolReceipts,
    toolReceiptsOverflow: _toolReceiptsOverflow,
    ...displayPending
  } = pending;
  return {
    ...displayPending,
    expiresAt: pending.expiresAt,
  };
}

/**
 * Internal handle the Harness uses to construct + tear down a Session
 * without exposing those operations on the public API. Plain object so
 * tests can construct a Session in isolation if needed.
 */
export interface SessionInternals {
  harness: Harness;
  storage: HarnessStorage;
  ownerId: string;
  /** Initial record loaded under the lease. The Session takes ownership. */
  record: SessionRecord;
  /** Lease TTL the Harness acquired the lease for. */
  leaseExpiresAt: number;
  /** Durable event replay cursor seed from the previous live owner, if any. */
  eventReplaySeed?: { epoch: string; nextSequence: number };
  /**
   * §10.5: when false, transient streaming deltas (`text_delta`,
   * `reasoning_delta`, `subagent_text_delta`, `subagent_reasoning_delta`) are NOT persisted to the durable session-event log
   * (live subscribers still receive them). Defaults to true.
   */
  persistTransientStreamingEvents?: boolean;
}

function normalizeSessionLogicalMessageIdentity(
  value: LogicalMessageIdentity | undefined,
  methodName: string,
): LogicalMessageIdentity | undefined {
  try {
    return normalizeLogicalMessageIdentity(value);
  } catch (error) {
    throw new HarnessValidationError(
      `${methodName}.logicalMessageIdentity`,
      error instanceof Error ? error.message : 'must contain valid input and response ids',
    );
  }
}

function normalizeSessionLogicalMessageInputIdentity(
  value: LogicalMessageSignalIdentity | undefined,
  methodName: string,
): LogicalMessageSignalIdentity | undefined {
  try {
    return normalizeLogicalMessageInputIdentity(value);
  } catch (error) {
    throw new HarnessValidationError(
      `${methodName}.logicalMessageIdentity`,
      error instanceof Error ? error.message : 'must contain a valid input id',
    );
  }
}

export class Session {
  /** Stable identity. Frozen at construction. */
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly subagentDepth: number;
  readonly createdAt: number;

  private _record: SessionRecord;
  private _state: SessionLifecycleState = 'live';
  private readonly _harness: Harness;
  private readonly _storage: HarnessStorage;
  private readonly _ownerId: string;
  private readonly _emitter: EventEmitter;

  /**
   * In-process, NON-persisted display-refresh listeners. Distinct from the
   * `_emitter` event pool: a ping here recomputes the display snapshot for any
   * `subscribeDisplayState` listener WITHOUT emitting a persisted §10.2 event or
   * touching SSE/`harness.subscribe` consumers. Used to surface a freshly-seeded
   * plan-task summary (TM-5) that reflects already-durable state.
   */
  private readonly _displayRefreshListeners = new Set<() => void>();

  /**
   * Queue resolvers indexed by `queuedItem.id`. Set in `queue()` so the
   * caller's promise settles when the head turn completes (or rejects on
   * permanent failure). Cleared after settle. Items recovered from
   * `pendingQueue` on hydration have no resolver — `queue_item_replayed` is
   * emitted instead and the turn runs purely for its side-effects.
   */
  private readonly _queueResolvers = new Map<
    string,
    { promise: Promise<AgentResult>; resolve: (result: AgentResult) => void; reject: (err: unknown) => void }
  >();
  /** `queuedItem.id` of the turn currently running (live or suspended). */
  private _currentQueuedItemId?: string;
  /**
   * `yolo` of the turn currently running. Set at drain-begin from the queued
   * item so suspend-capture can persist it onto `pendingResume` and a resumed
   * run keeps auto-granting tool approvals (§4.2e). Cleared with the turn.
   */
  private _currentTurnYolo = false;
  /** `queuedItem.source` of the turn currently running. Used by the goal
   *  judge loop to skip re-judging on goal-driven continuation turns. */
  private _currentQueuedItemSource?: 'user' | 'goal';
  /** Fresh remote queue admissions have no local promise resolver but are not crash replays. */
  private readonly _liveAdmittedQueuedItemIds = new Set<string>();
  /** True while `_maybeDrainQueue` is running so re-entrant kicks are no-ops. */
  private _draining = false;
  private _queueWakeTimer?: ReturnType<typeof setTimeout>;
  private _queueWakeAt?: number;
  private _queuedResumeRecoveryTimer?: ReturnType<typeof setTimeout>;
  private _pendingInteractionExpiryTimer?: ReturnType<typeof setTimeout>;
  private _pendingInteractionExpiryAt?: number;
  /**
   * Tracks the AbortController for the currently-running turn (message or
   * queued). Set when a turn begins, cleared on terminal completion or
   * suspension. `session.abort()` calls `abort()` on this controller. Also
   * powers `session.isRunning()` — non-undefined means a turn is in-flight.
   */
  private _currentTurnAbortController?: AbortController;
  /**
   * Transient per-turn tracking surfaced via `getDisplayState()`. Reset at
   * the start of every turn (in `_beginTurn` via `_resetTurnTracking`) and
   * mutated from `_drainStreamToEvents`, `_maybeCaptureSuspend`, and the
   * `_resume` path. Not persisted — these are run-only fields.
   */
  private _currentRunId?: string;
  private readonly _currentAssistantDraftRunIds = new Set<string>();
  /** §5.1b run-start time for the SessionRunProjection; set at agent_start, cleared on turn reset. */
  private _currentRunStartedAt?: number;
  /**
   * §5.1b effective per-run mode/model for the SessionRunProjection. Captured in
   * `message()` (the single turn runner for live signal/stream/sync/queue-drain/
   * useSkill paths) so the projection reports the run's EFFECTIVE identity (a
   * per-turn `mode`/`model` override), not just the session default. Read only
   * while `_currentRunId` is set; cleared on turn reset.
   */
  private _currentRunModeId?: string;
  private _currentRunModelId?: string;
  /**
   * §5.1b: the originating signalId of the live run, when it is signal-backed.
   * Lets the live SessionRunProjection report `operation: { kind: 'signal',
   * signalId }` (symmetric with the pending-resume branch) so a UI can link the
   * running turn to its durable signal row. Undefined for queue-backed runs (the
   * queuedItemId discriminates those) and for paths with no originating signal.
   */
  private _currentRunSignalId?: string;
  /**
   * §5.1 — the active turn's caller request context (the `app` metadata bag +
   * trusted `channel` projection). Stashed in `_buildRequestContext` so a
   * suspension can persist it on `PendingResume` and a `respondTo*` resume can
   * rebuild the SAME context (queued drains already carry it via
   * `item.requestContext`; resume previously dropped it). Cleared per turn.
   */
  private _currentTurnRequestContext?: PersistedRequestContextInput;
  /** Live Agent RequestContext for capturing internal per-turn fences on suspend. */
  private _currentAgentRequestContext?: RequestContext;
  /** Process-local canonical replacement toolsets for the active turn. */
  private _currentTurnReplacementToolSurface?: {
    toolSurface: Pick<AgentExecutionOptionsBase<unknown>, 'toolsets' | 'toolsetsMode'>;
    fence: ToolSurfaceFence;
  };
  /** At most one process-local replacement snapshot per Session pending slot. */
  private readonly _pendingReplacementToolSurfaces = new Map<string, ToolSurfaceFence>();
  private _currentMessageId?: string;
  private _currentTraceId?: string;
  /**
   * Span-summary — in-flight run span accumulators, keyed by runId. Opened at a
   * run's first `agent_start`, finalized + deleted at its terminal `agent_end`.
   * NOT reset per turn, so it survives an in-process suspend/resume. See
   * {@link OpenRunSpan}.
   */
  private readonly _openRuns = new Map<string, OpenRunSpan>();
  /** Span-summary — runIds whose `run_completed` was already emitted, so duplicate terminal `agent_end` paths finalize at most once. Bounded by {@link MAX_FINALIZED_RUN_IDS}. */
  private readonly _finalizedRunIds = new Set<string>();
  /** Span-summary — tail promise serializing best-effort durable run-summary writes (Slice B). */
  private _runSummaryPersistence: Promise<void> = Promise.resolve();
  private readonly _activeTurnWaiters = new Set<ActiveTurnWaiter>();
  private readonly _turnAbortSignalCleanups = new WeakMap<AbortController, () => void>();
  private readonly _operationEvidenceSignalIds = new Set<string>();
  private readonly _activeTools = new Map<string, ActiveToolState>();
  /**
   * `${runId}:${toolCallId}` values whose `tool_end` reached the Harness event
   * emitter. Registration publication can fail after an in-process subscriber
   * already drained the resumed segment, so the publication result alone cannot
   * decide whether a synthetic terminal is still needed. This bounded set is
   * intentionally turn-independent: a suspended tool starts in one turn and
   * settles in a later resume that reuses the same run id.
   */
  private readonly _emittedToolTerminals = new Set<string>();
  /**
   * `${runId}:${toolCallId}` of tools for which a SYNTHETIC `tool_end` was
   * emitted (§10.2). A late real `tool-result`/`tool-error` chunk for the same
   * key (turn teardown or registration failure can race the buffered result) is
   * suppressed ONCE so the consumer never sees two terminals for one tool.
   */
  private readonly _abortedToolTombstones = new Set<string>();
  private readonly _toolInputBuffers = new Map<string, { toolName: string; text: string }>();
  private readonly _runToolReceipts = new Map<
    string,
    {
      receipts: HarnessSubagentToolReceipt[];
      exact: Set<string>;
      bytes: number;
      overflow: boolean;
    }
  >();
  private readonly _activeSubagents = new Map<string, ActiveSubagentState>();
  /** Exact child ids claimed by either a new delegation or its recovery driver. */
  private readonly _delegationDriverClaims = new Set<string>();
  /** Framework-staged direct answers, held until the matching authoritative step-finish supplies the message id. */
  private readonly _pendingTerminalSubagentAnswers = new Map<
    string,
    { partId: string; answer: HarnessSubagentDirectAnswer }
  >();
  /** `${runId}:${partId}` deduplication for duplicate/replayed terminal frames. */
  private readonly _deliveredTerminalSubagentAnswers = new Set<string>();
  private readonly _assistantDrafts = new Map<string, HarnessAssistantDraft>();
  private _assistantDraftFlushTimer: ReturnType<typeof setTimeout> | undefined;
  private _assistantDraftFlushDirty = false;
  private _assistantDraftFlushUrgent = false;
  /** At most one draft checkpoint may be queued/running on the session CAS chain. */
  private _assistantDraftFlushInFlight: Promise<void> | undefined;
  /**
   * §SA3 — shared parent-local reservation count for inline `spawn_subagent`
   * and durable `task_delegate` work. It includes the create/link window so two
   * parallel tool calls cannot both observe a free final slot.
   */
  private _subagentExecutionsInFlight = 0;
  /**
   * Same-owner admission fence for destructive Stop/revision operations. A
   * turn or resume captures the epoch before asynchronous preflight; Stop bumps
   * it synchronously, so work that was admitted against the old branch cannot
   * create/link a child or begin a resume afterward.
   */
  private _activeWorkAdmissionEpoch = 0;
  private _activeWorkInvalidationsInFlight = 0;
  /** TM-6 reconcile-on-rehydrate pending retry timers (cleared on close). */
  private readonly _delegationReconcileRetryTimers = new Set<ReturnType<typeof setTimeout>>();
  /** Concurrent hydrate/retry callers join one recovery scan. */
  private _delegationReconcileInFlight: Promise<void> | undefined;
  /** A recovery request arrived while the current scan was still running. */
  private _delegationReconcileRerunRequested = false;
  /** A hydrate scan found durable delegated work but no shared execution slot. */
  private _delegationReconcileCapacityBlocked = false;
  /**
   * §5.1k / TM-5 bounded plan-task summary for `getDisplayState()`. Kept in
   * memory and refreshed for FREE on every plan-task mutation (the mutator
   * already holds the post-image), so a display snapshot never loads the tree.
   * Seeded lazily once (`_planTaskSummarySeeded`) for a hydrated session that has
   * pre-existing tasks but hasn't mutated yet; `undefined` until first observed.
   */
  private _planTaskSummary: PlanTaskSummary | undefined;
  private _planTaskSummarySeeded = false;
  /** Single-flight for the one authoritative summary seed used by display and turn instructions. */
  private _planTaskSummarySeedPromise: Promise<PlanTaskSummary | undefined> | undefined;
  /**
   * Cumulative usage for the session's thread. Live counter, single source of
   * truth in-process. Seeded from `internals.record.tokenUsage` in the
   * constructor so reopens carry the persisted aggregate; flushed back into
   * `_record.tokenUsage` on every `_flushUpdate` so the next reopen sees the
   * latest value.
   */
  private _tokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private _leaseExtensionDeadline?: number;
  private _leaseRenewalChain: Promise<void> = Promise.resolve();
  /**
   * Outstanding `waitForIdle()` callers. On close/evict each waiter is
   * rejected so callers don't hang on a dead session.
   */
  private readonly _idleWaiters = new Set<IdleWaiter>();
  /**
   * In-process serialization for `_flushUpdate`. Concurrent setters chain
   * onto this so each CAS write reads the latest in-memory version. Without
   * this, two parallel callers both observe `version=N`, both attempt
   * `ifVersion: N`, and the loser hits a `HarnessStorageVersionConflictError`.
   */
  private _flushChain: Promise<void> = Promise.resolve();

  /** Cached workspace handle. Resolves lazily on first `getWorkspace()` call. */
  private _workspace?: Workspace;
  /** Dedup promise so concurrent `getWorkspace()` calls share one provision attempt. */
  private _workspaceResolving?: Promise<Workspace>;
  /**
   * True when a non-resumable per-session workspace was found in storage on
   * rehydrate. Set by `_publish` via {@link _markWorkspaceLost}. The first
   * `getWorkspace()` call throws {@link HarnessWorkspaceLostError}; callers
   * can drop the marker and reprovision by calling `clearWorkspaceLost()`.
   */
  private _workspaceLost = false;

  // -------------------------------------------------------------------------
  // Skill discovery cache (§4.6).
  //
  // Workspace skill discovery is async and lazy. We cache the merged code +
  // workspace catalog for the lifetime of this in-memory Session instance.
  // Concurrent `skills.list` / `skills.get` calls during a generation build
  // share the same in-flight promise (single-flight), avoiding duplicate
  // discovery work. `skills.refresh()` clears the cache so the next read
  // re-runs discovery through the workspace skill source.
  // -------------------------------------------------------------------------
  private _skillsCache?: HarnessSkill[];
  private _skillsResolving?: Promise<HarnessSkill[]>;
  private _actionsSkillEntriesCache?: HarnessActionCatalogEntry[];
  private _actionsSkillEntriesResolving?: Promise<HarnessActionCatalogEntry[]>;
  private _actionsMcpEntriesCacheByServer = new Map<string, ActionCatalogMcpCacheEntry>();
  private _actionsMcpEntriesResolvingByServer = new Map<string, Promise<HarnessActionCatalogEntry[]>>();
  private _actionsMcpTimedOutWorkByServer = new Map<string, ActionCatalogMcpTimedOutWork>();
  private _actionsMcpCatalogGeneration = 0;

  // -------------------------------------------------------------------------
  // Thread subscription — §4.2 signal routing.
  //
  // One AgentThreadSubscription per Session, lazy-acquired on the first
  // signal-routed `message()` call. The subscription multiplexes every run
  // on the (resource, thread) tuple — idle-start wakes, mid-flight signal
  // deliveries, resume runs, queue drains — so a single drain loop owns
  // chunk → harness event translation for the whole session lifetime.
  //
  // Subscription lifetime ends with `close()` (explicit) or session
  // eviction (the new Session that rehydrates will lazy-open its own).
  // Cross-agent mode switches re-open against the new agent — see
  // `_ensureThreadSubscription` for the teardown contract.
  // -------------------------------------------------------------------------

  /** Cached thread subscription. Lazy. One per Session at a time. */
  private _threadSubscription?: AgentThreadSubscription<any>;
  /** Agent the current subscription was opened against. Used to detect
   *  cross-agent mode switches that require re-opening. */
  private _threadSubscriptionAgent?: Agent;
  /** Handle to the running drain loop, awaited by `close()`. */
  private _threadSubscriptionDrain?: Promise<void>;
  /** True once the subscription has been torn down (by close or eviction).
   *  Guards re-opens and re-entrant teardown. */
  private _threadSubscriptionClosed = false;
  /**
   * Per-run completion promises, keyed by `runId`. `_watchRunCompletion()`
   * resolves or rejects the matching entry after the runtime output finishes.
   * Entries left over on `close()` are rejected so callers don't hang.
   */
  private readonly _runCompletionPromises = new Map<
    string,
    {
      promise: Promise<FullOutput<unknown>>;
      resolve: (full: FullOutput<unknown>) => void;
      reject: (err: unknown) => void;
    }
  >();
  /**
   * Runs whose model output has reached its terminal boundary but whose
   * subscription events are still draining. Closing the subscription must not
   * replace their already-determined result with a generic close error; the
   * watcher can finish from the captured output after unsubscribe wakes the
   * event-drain barrier.
   */
  private readonly _modelTerminalRunsPendingEventDrain = new Set<string>();
  /**
   * Cache of run completion results that landed before any caller had a chance
   * to register a waiter. `sendSignal()` returns synchronously and the runtime
   * can drive the entire run to completion in the same microtask tick, so by
   * the time `_awaitRunCompletion(runId)` runs the terminal chunk may already
   * have been processed. Entries are retained so duplicate admission waiters
   * that converge on the same run can all observe the terminal result.
   */
  private readonly _completedRuns = new Map<
    string,
    { ok: true; full: FullOutput<unknown> } | { ok: false; err: unknown }
  >();
  /**
   * Message admission retries can observe `_completedRuns` before the original
   * message continuation has accounted usage. Track run ids accounted through
   * either path so the retry can persist before writing evidence without the
   * original continuation double-counting later.
   */
  private readonly _messageTokenAccountedRunIds = new Set<string>();
  private readonly _messageTokenAccountingRunIds = new Set<string>();
  /** §10.5: when false, transient streaming deltas are not persisted (live-only). */
  private readonly _persistTransientStreamingEvents: boolean;
  private readonly _messageTokenAccountingReservations = new Map<string, Deferred<void>>();
  private readonly _messageAdmissionStarts = new Map<string, MessageAdmissionStart>();
  /** Serializes terminal evidence + event projection for one admitted signal. */
  private readonly _signalResultSettlements = new Map<string, Promise<AgentSignalResultEvidence | undefined>>();
  private _eventPersistenceTail: Promise<void> = Promise.resolve();
  /** HARD latch — unrecoverable durable-log failure (id unparseable, or §S4.1 backlog overflow). */
  private _eventPersistenceError: unknown;
  /**
   * §S4.1 — ordered backlog of event-ledger appends that failed transiently, awaiting
   * retry. Retried FIFO ahead of any later sequence on the next append so the durable
   * log stays contiguous (no skipped slot → no undetected replay gap).
   */
  private readonly _failedEventAppends: PendingEventAppend[] = [];
  /** Original append failure for the active degraded episode. */
  private _eventPersistenceDegradedCause: unknown;
  /**
   * §S4.1 — true once a transient append failure has been surfaced live (one
   * `storage_error` per degraded episode). Reset when the backlog fully drains.
   */
  private _eventPersistenceDegraded = false;
  private readonly _backgroundTurnCompletions = new Set<Promise<unknown>>();

  /** @internal — constructed by the Harness, not directly. */
  constructor(internals: SessionInternals) {
    this.id = internals.record.id;
    this.resourceId = internals.record.resourceId;
    this.threadId = internals.record.threadId;
    this.parentSessionId = internals.record.parentSessionId;
    this.subagentDepth = internals.record.subagentDepth ?? 0;
    this.createdAt = internals.record.createdAt;

    this._record = internals.record;
    for (const [runId, draft] of Object.entries(internals.record.assistantDrafts ?? {})) {
      this._assistantDrafts.set(runId, { ...draft });
    }
    // Seed the live token-usage counter from the persisted aggregate so reopens
    // (after eviction / process restart) continue accumulating instead of
    // restarting at zero. Accept only non-negative integer fields because rows
    // written before tokenUsage durability shipped may carry partially-populated
    // or malformed objects; a bad component would otherwise poison the
    // aggregate.
    {
      const persisted = internals.record.tokenUsage as Partial<TokenUsage> | undefined;
      const promptTokens =
        typeof persisted?.promptTokens === 'number' &&
        Number.isInteger(persisted.promptTokens) &&
        persisted.promptTokens >= 0
          ? persisted.promptTokens
          : 0;
      const completionTokens =
        typeof persisted?.completionTokens === 'number' &&
        Number.isInteger(persisted.completionTokens) &&
        persisted.completionTokens >= 0
          ? persisted.completionTokens
          : 0;
      const derivedTotalTokens = promptTokens + completionTokens;
      const totalTokens =
        typeof persisted?.totalTokens === 'number' &&
        Number.isInteger(persisted.totalTokens) &&
        persisted.totalTokens >= 0
          ? persisted.totalTokens < derivedTotalTokens
            ? derivedTotalTokens
            : persisted.totalTokens
          : derivedTotalTokens;
      this._tokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens,
      };
    }
    if (this._record.closedAt !== undefined) {
      this._state = 'closed';
    } else if (this._record.closingAt !== undefined) {
      this._state = 'closing';
    }
    this._harness = internals.harness;
    this._storage = internals.storage;
    this._ownerId = internals.ownerId;
    this._persistTransientStreamingEvents = internals.persistTransientStreamingEvents ?? true;
    this._emitter = new EventEmitter(
      { sessionId: this.id },
      {
        onEvent: event => this._enqueueSessionEventPersistence(event),
        epoch: internals.eventReplaySeed?.epoch,
        nextSequence: internals.eventReplaySeed?.nextSequence,
        // §10.3 / §13.x — bound an oversized CUSTOM-event payload at emit with the
        // SAME projection + sentinel the tool-event sites use, read at emit time so
        // The cap tracks `files.maxEventPayloadBytes` (Harness defaults it to 64 KiB).
        maxCustomEventPayloadBytes: () => this._harness._internalMaxEventPayloadBytes,
      },
    );
  }

  private _createEmptySynthesisOptions() {
    return createHarnessEmptySynthesisOptions((hook, error) => {
      try {
        this._harness.mastra.getLogger().error(`Error in ${hook} hook:`, error);
      } catch {
        // Diagnostics must never suppress the caller-visible recovery.
      }
    });
  }

  // -------------------------------------------------------------------------
  // Events — §10.
  // -------------------------------------------------------------------------

  /**
   * Subscribe to events emitted on this session. Returns an unsubscribe
   * function. Listeners see only events emitted after `subscribe()` returns;
   * there is no automatic backfill (use `listMessages()` for history).
   *
   * Listener exceptions and rejected promises are isolated — they will not
   * disrupt the producer or other listeners.
   */
  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    this._assertLive('subscribe()');
    return this._emitter.subscribe(listener);
  }

  async lookupMessageResult(signalId: string): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null> {
    this._assertLive('lookupMessageResult()');
    if (signalId.length === 0) {
      throw new HarnessValidationError('lookupMessageResult().signalId', 'signalId must be a non-empty string');
    }
    const record = this.getRecord();
    return this._storage.loadMessageResultEvidence({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      threadId: record.threadId,
      signalId,
    });
  }

  async lookupQueueResult(queuedItemId: string): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null> {
    this._assertLive('lookupQueueResult()');
    if (queuedItemId.length === 0) {
      throw new HarnessValidationError('lookupQueueResult().queuedItemId', 'queuedItemId must be a non-empty string');
    }
    const record = this.getRecord();
    return this._storage.loadQueueResultEvidence({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      queuedItemId,
    });
  }

  async getEventReplayState() {
    this._assertLive('getEventReplayState()');
    await this._flushEventPersistence();
    const record = this.getRecord();
    return this._storage.getSessionEventReplayState({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      threadId: record.threadId,
    });
  }

  async listEventsAfter(opts: { epoch: string; afterSequence: number; limit: number }) {
    this._assertLive('listEventsAfter()');
    if (opts.epoch.length === 0) {
      throw new HarnessValidationError('listEventsAfter().epoch', 'epoch must be a non-empty string');
    }
    if (!Number.isSafeInteger(opts.afterSequence) || opts.afterSequence < 0) {
      throw new HarnessValidationError(
        'listEventsAfter().afterSequence',
        'afterSequence must be a non-negative safe integer',
      );
    }
    if (!Number.isSafeInteger(opts.limit) || opts.limit < 1) {
      throw new HarnessValidationError('listEventsAfter().limit', 'limit must be a positive safe integer');
    }
    await this._flushEventPersistence();
    const record = this.getRecord();
    return this._storage.listSessionEvents({
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      threadId: record.threadId,
      epoch: opts.epoch,
      afterSequence: opts.afterSequence,
      limit: opts.limit,
    });
  }

  /** @internal — used by the Harness to publish events on this session's emitter. */
  _emit(event: EmitInput): HarnessEvent {
    return this._emitter.emit(event);
  }

  /**
   * §6.1/§6.3/§10.2: tool-authored custom event emission (`ctx.emitCustomEvent`).
   * Validates the type (dotted custom prefix, not a reserved built-in family) and
   * the payload (JSON-serializable) at call time — both throw `HarnessValidationError`
   * / `HarnessEventSerializationError` before anything is dispatched. The harness
   * stamps id/timestamp/sessionId via `_emit` and attributes the event to the live
   * run when one is active.
   */
  _emitCustomEvent(input: HarnessCustomEventInput): void {
    this._assertOpenForTurn('ctx.emitCustomEvent');
    if (input === null || typeof input !== 'object') {
      throw new HarnessValidationError('ctx.emitCustomEvent', 'expects an object with `type` and optional `payload`');
    }
    if (typeof input.type !== 'string') {
      throw new HarnessValidationError('ctx.emitCustomEvent.type', 'must be a string');
    }
    // §10.3: the input carries only `type` + optional `payload`; the harness owns
    // every envelope field (id/timestamp/sessionId/runId). Reject extra top-level
    // keys so a tool cannot smuggle reserved envelope fields.
    for (const key of Object.keys(input)) {
      if (key !== 'type' && key !== 'payload') {
        throw new HarnessValidationError(
          'ctx.emitCustomEvent',
          `unexpected field "${key}" — only "type" and "payload" are allowed`,
        );
      }
    }
    assertCustomEventType(input.type);
    // §6.1: tool-context custom events may only be emitted while a turn is in
    // flight. The gate is the active-turn marker, NOT `_currentRunId`: the
    // structured sync `message({ sync, output })` path runs `agent.generate(...)`
    // atomically and only learns its runId when generate returns, yet tools
    // execute mid-generate — so requiring a known run id would wrongly reject a
    // legitimate in-run emit. A cleared turn controller means a stale/post-turn or
    // evicted context (both clear it via `_endTurn`).
    if (this._currentTurnAbortController === undefined) {
      throw new HarnessValidationError(
        'ctx.emitCustomEvent',
        'no active turn — custom events may only be emitted during a run',
      );
    }
    // Payload is optional; only validate JSON-serializability when one is present
    // (the walker treats a bare `undefined` as non-serializable).
    if (input.payload !== undefined) {
      assertJsonSerializable(input.type, this.id, input.payload);
    }
    this._emit({
      type: input.type as `${string}.${string}`,
      // §10.3: the harness fills the session identity fields. `sessionId` is
      // stamped by the emitter; `resourceId` / `threadId` are stamped here so a
      // custom event routes by the same (resourceId, threadId) tuple as built-in
      // session-scoped events.
      resourceId: this.resourceId,
      threadId: this.threadId,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      // Attribute to the run when known; the structured-sync window before
      // agent_start has no runId yet, which is acceptable (sessionId still anchors it).
      ...(this._currentRunId !== undefined ? { runId: this._currentRunId } : {}),
    });
  }

  /** @internal — waits for prior event ledger writes before replay decisions. */
  async _flushEventPersistence(): Promise<void> {
    // §S4.1 — give a transient backlog one retry so a QUIET session (no new events
    // arriving to drive the on-append retry) can still recover its durable log before
    // a replay decision is made.
    if (this._failedEventAppends.length > 0 && this._eventPersistenceError === undefined) {
      this._eventPersistenceTail = this._eventPersistenceTail
        .catch(() => undefined)
        .then(() => this._processEventPersistence(undefined));
    }
    await this._eventPersistenceTail;
    if (this._eventPersistenceError !== undefined) {
      throw this._eventPersistenceError;
    }
    // §S4.1 — an un-drained backlog means the ledger is NOT yet contiguous; replaying
    // it now would silently miss the queued tail. Surface a retryable storage error so
    // the caller falls back to the §10.5 snapshot path instead of replaying a gap.
    if (this._failedEventAppends.length > 0) {
      throw new HarnessStorageError({
        operation: 'session_event_append',
        cause: this._eventPersistenceDegradedCause,
        retryable: true,
        sessionId: this._record.id,
        resourceId: this._record.resourceId,
        threadId: this._record.threadId,
        harnessName: this._record.harnessName,
      });
    }
    await this._flushAssistantDraftsNow();
  }

  private _enqueueSessionEventPersistence(event: HarnessEvent): void {
    if (this._eventPersistenceError !== undefined) return;
    // §10.5: high-volume transient streaming deltas are live-subscriber-only when
    // persistence is disabled — skip the durable `appendSessionEvent` (live dispatch
    // already delivered them). The emitter seq still advanced, so a reconnect whose
    // `Last-Event-ID` precedes a skipped delta gets a 412 `unreplayable_gap` and
    // recovers via the §10.5 snapshot/message path. Removes per-token write amplification.
    if (
      !this._persistTransientStreamingEvents &&
      (event.type === 'text_delta' ||
        event.type === 'subagent_text_delta' ||
        event.type === 'reasoning_delta' ||
        event.type === 'subagent_reasoning_delta')
    ) {
      return;
    }
    let parsed: ReturnType<typeof parseHarnessEventId>;
    try {
      parsed = parseHarnessEventId(event.id);
    } catch (err) {
      // The event id encodes the ledger slot (epoch:sequence). If it cannot be
      // parsed we cannot place a contiguity-preserving sentinel, so fail-stop.
      this._eventPersistenceError = err;
      console.error('[harness/v1] session event id parse failed:', err);
      return;
    }
    let storedEvent: JsonValue;
    try {
      storedEvent = snapshotHarnessEventForJson(event);
    } catch (err) {
      // §S4.2 — ONE unserializable event must not poison the whole durable log.
      // The live subscriber already received the real event; substitute a JSON-safe
      // `storage_error` SENTINEL at the SAME (epoch, sequence) so the ledger stays
      // CONTIGUOUS (the slot is filled, not skipped → no undetected replay gap) and
      // later events keep persisting normally. A reconnect replaying this slot sees
      // the sentinel instead of the lost event.
      console.error('[harness/v1] session event serialization failed; storing replay sentinel:', err);
      storedEvent = {
        id: event.id,
        type: 'storage_error',
        timestamp: event.timestamp,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        operation: 'session_event_append',
        retryable: false,
        error: {
          code: 'harness.event_serialization',
          message: `event serialization failed; original "${(event as { type?: string }).type ?? 'unknown'}" event omitted from the durable log`,
        },
      } as unknown as JsonValue;
    }
    const record = this._record;
    const next: PendingEventAppend = {
      harnessName: record.harnessName,
      sessionId: record.id,
      resourceId: record.resourceId,
      threadId: record.threadId,
      eventId: event.id,
      epoch: parsed.epoch,
      sequence: parsed.sequence,
      event: storedEvent,
      emittedAt: event.timestamp,
    };
    // Serialize all ledger work on the tail so appends + backlog retries stay ordered.
    this._eventPersistenceTail = this._eventPersistenceTail
      .catch(() => undefined)
      .then(() => this._processEventPersistence(next));
  }

  /**
   * §S4.1 — durable event-ledger writer. Runs serialized on `_eventPersistenceTail`.
   * Drains any transiently-failed backlog FIFO, then appends `next` (when provided).
   * Never throws: a re-failed append is re-queued for the next attempt, and an
   * unbounded backlog hard-latches. Contiguity is preserved — `next` never jumps ahead
   * of an earlier un-persisted slot.
   */
  private async _processEventPersistence(next: PendingEventAppend | undefined): Promise<void> {
    if (this._eventPersistenceError !== undefined) return; // hard latch (id-parse / overflow)

    // 1) Retry the backlog in order; STOP at the first re-failure so a later sequence
    //    never persists ahead of an earlier failed one.
    while (this._failedEventAppends.length > 0) {
      const head = this._failedEventAppends[0]!;
      try {
        await this._storage.appendSessionEvent({ ...head, storedAt: Date.now() });
        this._failedEventAppends.shift();
      } catch (err) {
        if (err instanceof HarnessStorageSessionEventReplayUnsupportedError) {
          // Storage has no event ledger at all → nothing to retry; drop the backlog.
          this._failedEventAppends.length = 0;
          this._eventPersistenceDegraded = false;
          this._eventPersistenceDegradedCause = undefined;
          return;
        }
        if (next) this._backlogFailedAppend(next, err);
        return;
      }
    }
    // Backlog fully drained → durable log is contiguous again.
    if (this._eventPersistenceDegraded) {
      this._eventPersistenceDegraded = false;
      this._eventPersistenceDegradedCause = undefined;
    }

    if (!next) return;

    // 2) Append the new event.
    try {
      await this._storage.appendSessionEvent({ ...next, storedAt: Date.now() });
    } catch (err) {
      if (err instanceof HarnessStorageSessionEventReplayUnsupportedError) return;
      this._backlogFailedAppend(next, err);
    }
  }

  /**
   * §S4.1 — queue a failed append for retry. Surfaces a live `storage_error` once per
   * degraded episode (so subscribers learn the log is lagging in real time), and
   * hard-latches if the backlog exceeds {@link MAX_PENDING_FAILED_EVENT_APPENDS}.
   */
  private _backlogFailedAppend(args: PendingEventAppend, err: unknown): void {
    this._failedEventAppends.push(args);
    if (!this._eventPersistenceDegraded) {
      this._eventPersistenceDegraded = true;
      this._eventPersistenceDegradedCause = err;
      console.error('[harness/v1] session event persistence failed; backlogged for retry:', err);
      // §10.2: the durable log is lagging. Emit a live, RETRYABLE storage_error so
      // subscribers learn now (vs only discovering the lag on reconnect). The degraded
      // flag is already set, so this event's own append — queued behind the backlog —
      // does not re-trigger this emit.
      const isStorageErr = err instanceof HarnessStorageError;
      this._emitter.emit({
        type: 'storage_error',
        operation: 'session_event_append',
        retryable: true,
        error: {
          code: 'harness.storage',
          message: isStorageErr ? err.message : 'session event persistence failed',
        },
        resourceId: this._record.resourceId,
        threadId: this._record.threadId,
        harnessName: this._record.harnessName,
      } as EmitInput);
    }
    if (this._failedEventAppends.length > MAX_PENDING_FAILED_EVENT_APPENDS) {
      // Past the bound we cannot keep retrying without unbounded memory → fail-stop.
      // Reconnect past the gap recovers via the §10.5 snapshot path.
      const overflow = new HarnessStorageError({
        operation: 'session_event_append',
        cause: err,
        retryable: false,
        sessionId: this._record.id,
        resourceId: this._record.resourceId,
        threadId: this._record.threadId,
        harnessName: this._record.harnessName,
      });
      this._eventPersistenceError = overflow;
      this._failedEventAppends.length = 0;
      this._eventPersistenceDegradedCause = undefined;
      console.error(
        `[harness/v1] session event backlog exceeded ${MAX_PENDING_FAILED_EVENT_APPENDS}; durable log fail-stop:`,
        err,
      );
      // The earlier retryable storage_error promised retries we can no longer make;
      // emit a terminal NON-retryable one so subscribers fall back to snapshot recovery.
      this._emitter.emit({
        type: 'storage_error',
        operation: 'session_event_append',
        retryable: false,
        error: {
          code: 'harness.storage',
          message: 'session event persistence backlog overflow; durable log degraded',
        },
        resourceId: this._record.resourceId,
        threadId: this._record.threadId,
        harnessName: this._record.harnessName,
      } as EmitInput);
    }
  }

  /**
   * Emit an event that belongs to a turn (agent_*, message_*, tool_*,
   * suspension_*). Auto-stamps `queuedItemId` from `_currentQueuedItemId`
   * when a queued turn is running so subscribers can correlate every event
   * back to its `queue()` item.
   */
  private _emitTurnEvent(event: EmitInput): HarnessEvent {
    // Span-summary: enrich `tool_end` with durationMs + accumulate the run's
    // tool rollup BEFORE emit, so the live subscriber and the durable row carry
    // the same value. Returns the (possibly enriched) event to emit.
    const toEmit = this._trackRunSpanPreEmit(event);
    let emitted: HarnessEvent;
    if (this._currentQueuedItemId !== undefined && (toEmit as { queuedItemId?: string }).queuedItemId === undefined) {
      emitted = this._emitter.emit({ ...toEmit, queuedItemId: this._currentQueuedItemId } as EmitInput);
    } else {
      emitted = this._emitter.emit(toEmit);
    }
    if (emitted.type === 'tool_end') {
      this._rememberEmittedToolTerminal(emitted.runId, emitted.toolCallId);
    }
    // Span-summary: open the run span on `agent_start`; finalize (emit
    // `run_completed`) on a terminal `agent_end`. Runs AFTER emit so
    // `run_completed` follows its `agent_end`.
    this._trackRunSpanPostEmit(emitted);
    if (
      emitted.type === 'agent_end' &&
      (emitted.finishReason === 'complete' ||
        emitted.finishReason === 'aborted' ||
        emitted.finishReason === 'error' ||
        emitted.finishReason === 'suspended')
    ) {
      this._terminalizeAssistantDraft(emitted.runId, emitted.finishReason);
    }
    return emitted;
  }

  private _toolTerminalKey(runId: string, toolCallId: string): string {
    return `${runId}:${toolCallId}`;
  }

  private _rememberEmittedToolTerminal(runId: string, toolCallId: string): void {
    const key = this._toolTerminalKey(runId, toolCallId);
    // Refresh insertion order so the bounded set retains the most recently
    // observed terminal when a duplicate path checks the same key.
    this._emittedToolTerminals.delete(key);
    this._emittedToolTerminals.add(key);
    while (this._emittedToolTerminals.size > MAX_EMITTED_TOOL_TERMINALS) {
      const oldest = this._emittedToolTerminals.values().next().value;
      if (oldest === undefined) return;
      this._emittedToolTerminals.delete(oldest);
    }
  }

  private _hasEmittedToolTerminal(runId: string, toolCallId: string): boolean {
    return this._emittedToolTerminals.has(this._toolTerminalKey(runId, toolCallId));
  }

  private _rememberSyntheticToolTerminalTombstone(runId: string, toolCallId: string): void {
    // A synthetic terminal can race one already-buffered real result. Suppress
    // that late result once, while retaining the existing behavior for any
    // subsequent duplicate provider chunks.
    if (this._abortedToolTombstones.size >= MAX_ABORTED_TOOL_TOMBSTONES) {
      this._abortedToolTombstones.clear();
    }
    this._abortedToolTombstones.add(this._toolTerminalKey(runId, toolCallId));
  }

  /**
   * Span-summary pre-emit hook. On `tool_start`, records the call's start in the
   * open run span. On `tool_end`, computes `durationMs` from that start (when
   * known) and folds the call into the run's tool rollup, returning an event
   * carrying `durationMs`. All other events pass through unchanged. Counting
   * happens HERE — the single emit choke — so a suppressed/never-emitted
   * `tool_end` (e.g. a late real result dropped by the aborted-tool tombstone)
   * cannot double-count, and a synthetic aborted `tool_end` counts exactly once.
   */
  private _trackRunSpanPreEmit(event: EmitInput): EmitInput {
    const type = (event as { type?: string }).type;
    if (type === 'tool_start') {
      const e = event as { runId?: string; toolCallId?: string; toolName?: string };
      const span = e.runId !== undefined ? this._openRuns.get(e.runId) : undefined;
      if (span && e.toolCallId !== undefined) {
        span.activeToolStarts.set(e.toolCallId, { toolName: e.toolName ?? 'unknown', startedAt: Date.now() });
      }
      return event;
    }
    if (type === 'tool_end') {
      const e = event as {
        runId?: string;
        toolCallId?: string;
        toolName?: string;
        isError?: boolean;
        durationMs?: number;
      };
      const span = e.runId !== undefined ? this._openRuns.get(e.runId) : undefined;
      if (!span) return event;
      const toolName = e.toolName ?? 'unknown';
      const start = e.toolCallId !== undefined ? span.activeToolStarts.get(e.toolCallId) : undefined;
      let durationMs: number | undefined = e.durationMs;
      if (durationMs === undefined && start) durationMs = Math.max(0, Date.now() - start.startedAt);
      if (e.toolCallId !== undefined) span.activeToolStarts.delete(e.toolCallId);
      // Fold into the rollup (count every emitted terminal; duration only when known).
      const r = span.rollup;
      r.count += 1;
      const isError = e.isError === true;
      if (isError) r.errors += 1;
      if (durationMs !== undefined) {
        r.totalDurationMs += durationMs;
        if (durationMs > r.maxDurationMs) r.maxDurationMs = durationMs;
      }
      const per = r.perTool.get(toolName) ?? { count: 0, errors: 0, totalDurationMs: 0 };
      per.count += 1;
      if (isError) per.errors += 1;
      if (durationMs !== undefined) per.totalDurationMs += durationMs;
      r.perTool.set(toolName, per);
      return durationMs !== undefined ? ({ ...event, durationMs } as EmitInput) : event;
    }
    return event;
  }

  /**
   * Span-summary post-emit hook. Opens the run span on the run's first
   * `agent_start`; on a terminal (non-suspended) `agent_end`, finalizes the run
   * exactly once (emits `run_completed`, persists the durable summary).
   */
  private _trackRunSpanPostEmit(event: HarnessEvent): void {
    if (event.type === 'agent_start') {
      const runId = event.runId;
      if (runId !== undefined && !this._openRuns.has(runId)) {
        this._openRuns.set(runId, {
          startedAt: this._currentRunStartedAt ?? event.timestamp,
          identity: this._captureRunSpanIdentity(),
          activeToolStarts: new Map(),
          rollup: { count: 0, errors: 0, totalDurationMs: 0, maxDurationMs: 0, perTool: new Map() },
        });
      }
      return;
    }
    if (event.type === 'agent_end' && event.finishReason !== 'suspended') {
      this._finalizeRunSpan(event.runId, event.finishReason, event.usage, event.timestamp);
    }
  }

  /** Capture the run's effective identity (mirrors {@link _buildCurrentRunProjection}'s live branch). */
  private _captureRunSpanIdentity(): RunSpanIdentity {
    const rec = this._record;
    const modeId = this._currentRunModeId ?? rec.modeId;
    const identity: RunSpanIdentity = {
      resourceId: rec.resourceId,
      threadId: rec.threadId,
      agentId: this._modeAgentId(modeId),
      modeId,
      modelId: this._currentRunModelId ?? rec.modelId,
      operationKind: this._currentQueuedItemId !== undefined ? 'queue' : 'signal',
    };
    if (rec.parentSessionId !== undefined) identity.parentSessionId = rec.parentSessionId;
    if (this._currentTraceId !== undefined) identity.traceId = this._currentTraceId;
    return identity;
  }

  /**
   * Emit the canonical `run_completed` event for a terminal run, exactly once.
   * A run with a live {@link OpenRunSpan} reports trusted start/duration/rollup;
   * a run whose start was lost to a restart is marked `reconstructed` and omits
   * those (usage + identity + finishReason are still reported).
   */
  private _finalizeRunSpan(runId: string, finishReason: string, usage: TokenUsage, completedAt: number): void {
    if (this._finalizedRunIds.has(runId)) return;
    if (this._finalizedRunIds.size >= MAX_FINALIZED_RUN_IDS) this._finalizedRunIds.clear();
    this._finalizedRunIds.add(runId);

    const span = this._openRuns.get(runId);
    const reconstructed = span === undefined;
    const identity = span?.identity ?? this._captureRunSpanIdentity();
    const status: RunCompletedStatus =
      finishReason === 'complete' ? 'completed' : finishReason === 'error' ? 'failed' : 'interrupted';

    const event: Omit<RunCompletedEvent, 'id' | 'timestamp' | 'sessionId'> = {
      type: 'run_completed',
      runId,
      status,
      finishReason,
      usage,
      completedAt,
      resourceId: identity.resourceId,
      threadId: identity.threadId,
      agentId: identity.agentId,
      modeId: identity.modeId,
      modelId: identity.modelId,
      ...(identity.parentSessionId !== undefined ? { parentSessionId: identity.parentSessionId } : {}),
      ...(identity.traceId !== undefined ? { traceId: identity.traceId } : {}),
      ...(identity.operationKind !== undefined ? { operationKind: identity.operationKind } : {}),
    };
    if (reconstructed) {
      event.reconstructed = true;
    } else {
      event.startedAt = span!.startedAt;
      event.durationMs = Math.max(0, completedAt - span!.startedAt);
      event.toolRollup = this._materializeToolRollup(span!.rollup);
    }
    this._openRuns.delete(runId);

    // Emit on the turn-event choke (re-enters `_emitTurnEvent`, but `run_completed`
    // is neither `agent_*` nor `tool_*` so it triggers no further span tracking).
    this._emitTurnEvent(event as EmitInput);

    // Slice B (durable run summary) is wired here.
    this._persistRunSummary(event, status, reconstructed);
  }

  /** Convert the in-memory rollup (Maps) into the JSON-safe {@link RunToolRollup}. */
  private _materializeToolRollup(rollup: OpenRunSpan['rollup']): RunToolRollup {
    const perTool: RunToolRollup['perTool'] = {};
    for (const [name, v] of rollup.perTool) {
      perTool[name] = { count: v.count, errors: v.errors, totalDurationMs: v.totalDurationMs };
    }
    return {
      count: rollup.count,
      errors: rollup.errors,
      totalDurationMs: rollup.totalDurationMs,
      maxDurationMs: rollup.maxDurationMs,
      perTool,
    };
  }

  /**
   * Span-summary Slice B — persist the durable run summary (one row per run,
   * idempotent first-terminal-wins). Best-effort and OFF the turn's critical
   * path: a failed write logs once and never throws (the `run_completed` event
   * itself is already emitted + persisted in the event log, so the summary table
   * is a secondary projection). Writes are chained on a tail so tests can flush.
   */
  private _persistRunSummary(
    event: Omit<RunCompletedEvent, 'id' | 'timestamp' | 'sessionId'>,
    status: RunCompletedStatus,
    reconstructed: boolean,
  ): void {
    const summary: HarnessRunSummary = {
      harnessName: this._record.harnessName,
      runId: event.runId,
      sessionId: this.id,
      resourceId: event.resourceId,
      threadId: event.threadId,
      agentId: event.agentId,
      modeId: event.modeId,
      modelId: event.modelId,
      status,
      finishReason: event.finishReason,
      reconstructed,
      completedAt: event.completedAt,
      usage: event.usage,
      createdAt: event.completedAt,
      ...(event.parentSessionId !== undefined ? { parentSessionId: event.parentSessionId } : {}),
      ...(event.traceId !== undefined ? { traceId: event.traceId } : {}),
      ...(event.operationKind !== undefined ? { operationKind: event.operationKind } : {}),
      ...(event.startedAt !== undefined ? { startedAt: event.startedAt } : {}),
      ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
      ...(event.toolRollup !== undefined ? { toolRollup: event.toolRollup } : {}),
    };
    this._runSummaryPersistence = this._runSummaryPersistence
      .then(() => this._storage.saveRunSummary({ summary }))
      .then(
        () => undefined,
        err => {
          console.error('[harness/v1] run summary persistence failed:', err);
        },
      );
  }

  /** @internal — await all in-flight run-summary writes (tests). */
  async _internalFlushRunSummaries(): Promise<void> {
    await this._runSummaryPersistence;
  }

  /**
   * @internal — publish a `subagent_*` event on this session's emitter.
   * Called by the spawn-subagent bridge when forwarding a child session's
   * own `agent_start` / `text_delta` / `tool_start` / `tool_end` /
   * `agent_end` into the parent's subscriber stream as the corresponding
   * `subagent_*` event (§10.6).
   *
   * Auto-stamps `parentId` (this session's id) and `queuedItemId` from
   * `_currentQueuedItemId` so a subscriber can correlate every nested
   * event back to the parent's `queue()` item that spawned it. Callers
   * supply `depth` (child's depth in the subagent tree) and the rest of
   * the event payload.
   */
  _emitSubagentEvent(
    event:
      | Omit<SubagentStartEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentTextDeltaEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentReasoningDeltaEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentToolStartEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentToolEndEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>
      | Omit<SubagentEndEvent, 'id' | 'timestamp' | 'sessionId' | 'parentId'>,
  ): HarnessEvent {
    const stamped = { ...event, parentId: this.id } as EmitInput;
    if (this._currentQueuedItemId !== undefined && (stamped as { queuedItemId?: string }).queuedItemId === undefined) {
      return this._emitter.emit({ ...stamped, queuedItemId: this._currentQueuedItemId } as EmitInput);
    }
    return this._emitter.emit(stamped);
  }

  /**
   * @internal — §SA2: fold a bridged CHILD turn event into the parent's
   * `_activeSubagents` display projection so a polling/reconnecting consumer can
   * see the subagent's live inner progress (status / current tool / tool count /
   * usage) from the parent snapshot alone. Best-effort: a no-op if the key was
   * already cleared (child closed). `key` is the spawn `toolCallId` or the
   * delegate `delegate:<childId>` key.
   */
  _internalUpdateSubagentProgress(key: string, event: HarnessEvent): void {
    const entry = this._activeSubagents.get(key);
    if (!entry) return;
    switch (event.type) {
      case 'agent_start':
        entry.status = 'running';
        break;
      case 'tool_approval_required':
      case 'tool_suspension_required':
      case 'question_pending':
      case 'plan_approval_required':
        entry.status = 'awaiting_input';
        break;
      case 'tool_start':
        entry.currentToolName = event.toolName;
        entry.toolCalls = (entry.toolCalls ?? 0) + 1;
        break;
      case 'tool_end':
        // Best-effort clear: only when the ending tool is the one we last showed
        // (concurrent inner tools just leave the most-recent name until it ends).
        if (entry.currentToolName === event.toolName) entry.currentToolName = undefined;
        break;
      case 'agent_end':
        entry.status =
          event.finishReason === 'error' || event.finishReason === 'aborted'
            ? 'failed'
            : event.finishReason === 'complete'
              ? 'completed'
              : entry.status;
        entry.usage = event.usage;
        break;
      default:
        return; // text/reasoning deltas don't change the projection
    }
    entry.updatedAt = Date.now();
    this._notifyDisplayRefresh();
  }

  /**
   * @internal — mirror a delegated child's pending interaction onto the
   * PARENT event stream. The owning inbox remains the child session; the
   * bridged event only supplies parent activity/replay consumers with the
   * correlation needed to render the wait and route the response correctly.
   */
  private _emitDelegatedSubagentPendingEvent(
    event: Extract<
      HarnessEvent,
      {
        type: 'tool_approval_required' | 'tool_suspension_required' | 'question_pending' | 'plan_approval_required';
      }
    >,
    correlation: { parentToolCallId: string; subagentSessionId: string },
  ): void {
    const { id: _id, timestamp: _timestamp, sessionId: _sessionId, source: _source, ...payload } = event;
    // SuspensionSource is a discriminated union: parent events do not declare
    // the child-only correlation keys, so strip them from a widened copy rather
    // than destructuring properties that are absent on one union member.
    const bridgedPayload = { ...payload } as Record<string, unknown>;
    delete bridgedPayload.subagentToolCallId;
    delete bridgedPayload.subagentSessionId;
    this._emitter.emit({
      ...bridgedPayload,
      source: 'subagent',
      subagentToolCallId: correlation.parentToolCallId,
      subagentSessionId: correlation.subagentSessionId,
    } as EmitInput);
  }

  /**
   * @internal — capture the conversation-work epoch for an inline subagent
   * spawn. The built-in tool lives in a separate module, so it uses this narrow
   * facade instead of reaching into the private revision fence directly.
   */
  _internalCaptureSubagentAdmission(): number {
    return this._captureActiveWorkAdmission('spawn_subagent');
  }

  /** @internal — recheck an inline spawn against edit/retry/Stop invalidation. */
  _internalAssertSubagentAdmission(epoch: number, signal?: AbortSignal): void {
    this._assertActiveWorkAdmission(epoch, 'spawn_subagent', signal);
  }

  /**
   * @internal — atomically reserve one parent-local subagent execution slot.
   * JavaScript runs this read/increment without an await boundary, so parallel
   * inline and durable tool calls cannot both claim the last slot.
   */
  _internalTryReserveSubagentExecution():
    | { reserved: true; inFlight: number; maxConcurrent?: number }
    | { reserved: false; inFlight: number; maxConcurrent: number } {
    const maxConcurrent = this._harness._getSubagentMaxConcurrent();
    if (maxConcurrent !== undefined && this._subagentExecutionsInFlight >= maxConcurrent) {
      return { reserved: false, inFlight: this._subagentExecutionsInFlight, maxConcurrent };
    }
    this._subagentExecutionsInFlight += 1;
    return {
      reserved: true,
      inFlight: this._subagentExecutionsInFlight,
      ...(maxConcurrent !== undefined ? { maxConcurrent } : {}),
    };
  }

  /** @internal — release a slot previously returned by the reservation method. */
  _internalReleaseSubagentExecution(): void {
    // Every caller releases in a `finally`. Clamp defensively so a late cleanup
    // can never turn an accidental duplicate release into an unlimited bypass.
    this._subagentExecutionsInFlight = Math.max(0, this._subagentExecutionsInFlight - 1);
    if (this._delegationReconcileCapacityBlocked && this._state === 'live') {
      this._delegationReconcileCapacityBlocked = false;
      this._scheduleDelegationReconcileRetry(0);
    }
    this._notifyMaybeIdle();
  }

  /** @internal — current shared count, exposed only for deterministic tests. */
  get _internalSubagentExecutionsInFlight(): number {
    return this._subagentExecutionsInFlight;
  }

  /** @internal — number of registered listeners (for tests). */
  get _internalListenerCount(): number {
    return this._emitter.listenerCount;
  }

  /**
   * Mark a turn as in-flight and mint the AbortController the agent run will
   * use. `session.abort()` aborts this controller. If the caller supplied
   * their own `AbortSignal`, we forward it into the session controller so a
   * single signal reaches the agent.
   *
   * Returns the controller so the calling path can hand `controller.signal`
   * to `agent.stream` / `agent.generate` / `agent.resumeStream`.
   */
  private _beginTurn(
    callerSignal: AbortSignal | undefined,
    runIdentity?: { modeId?: string; modelId?: string },
  ): AbortController {
    const controller = new AbortController();
    this._currentTurnAbortController = controller;
    this._resetTurnTracking();
    // §5.1b: stamp the run's EFFECTIVE identity AFTER the reset above, so the
    // SessionRunProjection reports a per-turn `mode`/`model` override (or a queued
    // item's own mode/model) for the live run rather than the session default.
    this._currentRunModeId = runIdentity?.modeId;
    this._currentRunModelId = runIdentity?.modelId;
    controller.signal.addEventListener('abort', () => this._scheduleActiveTurnAbort(controller), { once: true });
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort(this._forwardCallerAbortReason(callerSignal));
      } else {
        const forwardAbort = () => controller.abort(this._forwardCallerAbortReason(callerSignal));
        callerSignal.addEventListener('abort', forwardAbort, { once: true });
        this._turnAbortSignalCleanups.set(controller, () => callerSignal.removeEventListener('abort', forwardAbort));
      }
    }
    return controller;
  }

  /**
   * Clear per-turn transient display-state fields. Cumulative aggregates
   * (`_tokenUsage`) intentionally persist across turns within a session.
   */
  private _resetTurnTracking(): void {
    if (this._currentRunId !== undefined) this._pendingTerminalSubagentAnswers.delete(this._currentRunId);
    this._currentRunId = undefined;
    this._currentAssistantDraftRunIds.clear();
    this._currentRunStartedAt = undefined;
    this._currentRunModeId = undefined;
    this._currentRunModelId = undefined;
    this._currentRunSignalId = undefined;
    this._currentTurnRequestContext = undefined;
    this._currentAgentRequestContext = undefined;
    this._currentTurnReplacementToolSurface = undefined;
    this._currentMessageId = undefined;
    this._currentTraceId = undefined;
    // Default OFF each turn; queued-drain / resume re-arm it from the item /
    // captured pendingResume below so non-yolo turns never inherit a stale value.
    this._currentTurnYolo = false;
    this._activeTools.clear();
    this._toolInputBuffers.clear();
    // `_activeSubagents` is keyed by parent tool call id and naturally drops
    // entries on subagent close; do not clear here so a long-running subagent
    // spanning multiple parent turns still renders.
  }

  /**
   * Clear the in-flight turn marker so `isRunning()` reports false and the
   * next `session.abort()` is a no-op. Run-only display fields (`currentRunId`,
   * active-tool map, input buffers) clear too so an idle session reports
   * idle state. Cumulative aggregates (`_tokenUsage`) are preserved.
   */
  private _endTurn(controller: AbortController): void {
    this._turnAbortSignalCleanups.get(controller)?.();
    this._turnAbortSignalCleanups.delete(controller);
    if (this._currentTurnAbortController === controller) {
      this._currentTurnAbortController = undefined;
      // §10.2 — any tool still in the active set when the turn ends produced no
      // tool-result/error chunk (the turn aborted/errored/closed before it
      // settled). Emit a synthetic aborted `tool_end` for each BEFORE clearing so
      // a streaming consumer always gets a terminal for every `tool_start`. On a
      // normal turn the drain already removed every tool, so this is a no-op.
      this._emitAbortedToolEnds();
      if (this._currentRunId !== undefined) this._pendingTerminalSubagentAnswers.delete(this._currentRunId);
      this._currentRunId = undefined;
      this._currentRunStartedAt = undefined;
      this._currentRunModeId = undefined;
      this._currentRunModelId = undefined;
      this._currentRunSignalId = undefined;
      this._currentTurnRequestContext = undefined;
      this._currentAgentRequestContext = undefined;
      this._currentTurnReplacementToolSurface = undefined;
      this._currentMessageId = undefined;
      this._currentTraceId = undefined;
      this._activeTools.clear();
      this._toolInputBuffers.clear();
    }
    this._notifyMaybeIdle();
  }

  private _assistantDraftSnapshot(): Record<string, HarnessAssistantDraft> {
    return Object.fromEntries(
      Array.from(this._assistantDrafts.entries()).map(([runId, draft]) => [runId, { ...draft }]),
    );
  }

  private _persistedAssistantDrafts(snapshot: Record<string, HarnessAssistantDraft>): SessionRecord['assistantDrafts'] {
    return Object.keys(snapshot).length > 0 ? snapshot : undefined;
  }

  private _appendBoundedDraftText(previous: string | undefined, delta: string): { text: string; truncated: boolean } {
    const next = `${previous ?? ''}${delta}`;
    const encoded = ASSISTANT_DRAFT_TEXT_ENCODER.encode(next);
    if (encoded.byteLength <= MAX_ASSISTANT_DRAFT_FIELD_BYTES) {
      return { text: next, truncated: false };
    }
    let start = encoded.byteLength - MAX_ASSISTANT_DRAFT_FIELD_BYTES;
    // Keep the newest tail without starting inside a UTF-8 continuation byte.
    while (start < encoded.byteLength && (encoded[start]! & 0xc0) === 0x80) start += 1;
    return {
      text: ASSISTANT_DRAFT_TEXT_DECODER.decode(encoded.subarray(start)),
      truncated: true,
    };
  }

  private _pruneAssistantDrafts(): void {
    const ordered = Array.from(this._assistantDrafts.values())
      .map((draft, insertionIndex) => ({ draft, insertionIndex }))
      .sort((a, b) => b.draft.updatedAt - a.draft.updatedAt || b.insertionIndex - a.insertionIndex)
      .slice(0, MAX_PERSISTED_ASSISTANT_DRAFTS);
    const kept: Record<string, HarnessAssistantDraft> = {};
    for (const { draft } of ordered) {
      const candidate = { ...kept, [draft.runId]: draft };
      const candidateBytes = ASSISTANT_DRAFT_TEXT_ENCODER.encode(JSON.stringify(candidate)).byteLength;
      // A pathologically large identity/metadata field must not make the
      // entire SessionRecord unwriteable. Normal drafts always fit at least
      // one entry because their two streamed fields are independently bound.
      if (candidateBytes <= MAX_PERSISTED_ASSISTANT_DRAFT_BYTES) kept[draft.runId] = draft;
    }
    const keep = new Set(Object.keys(kept));
    for (const runId of this._assistantDrafts.keys()) {
      if (!keep.has(runId)) this._assistantDrafts.delete(runId);
    }
  }

  private _scheduleAssistantDraftFlush(delayMs = ASSISTANT_DRAFT_FLUSH_DELAY_MS): void {
    if (this._state === 'closed' || this._state === 'deleted' || this._state === 'evicted') return;
    this._assistantDraftFlushDirty = true;
    if (delayMs <= 0) this._assistantDraftFlushUrgent = true;
    // A slow adapter must never accumulate one full-session CAS write for
    // every debounce interval. The active checkpoint's completion schedules
    // exactly one trailing snapshot when newer deltas made the state dirty.
    if (this._assistantDraftFlushInFlight !== undefined) return;
    if (this._assistantDraftFlushTimer !== undefined) {
      if (delayMs > 0) return;
      clearTimeout(this._assistantDraftFlushTimer);
      this._assistantDraftFlushTimer = undefined;
    }
    this._assistantDraftFlushTimer = setTimeout(() => {
      this._assistantDraftFlushTimer = undefined;
      this._assistantDraftFlushUrgent = false;
      void this._startAssistantDraftFlush().catch(() => {});
    }, delayMs);
    this._assistantDraftFlushTimer.unref?.();
  }

  private _startAssistantDraftFlush(): Promise<void> {
    if (this._assistantDraftFlushInFlight !== undefined) return this._assistantDraftFlushInFlight;
    if (!this._assistantDraftFlushDirty) return Promise.resolve();
    this._assistantDraftFlushDirty = false;
    this._assistantDraftFlushUrgent = false;
    const assistantDrafts = this._persistedAssistantDrafts(this._assistantDraftSnapshot());

    let run!: Promise<void>;
    run = (async () => {
      try {
        await this._flushUpdate(prev => ({ ...prev, assistantDrafts }));
      } catch (err) {
        if (this._state !== 'closed' && this._state !== 'deleted' && this._state !== 'evicted') {
          this._assistantDraftFlushDirty = true;
        }
        throw err;
      } finally {
        if (this._assistantDraftFlushInFlight === run) this._assistantDraftFlushInFlight = undefined;
        if (
          this._assistantDraftFlushDirty &&
          this._state !== 'closed' &&
          this._state !== 'deleted' &&
          this._state !== 'evicted'
        ) {
          this._scheduleAssistantDraftFlush(this._assistantDraftFlushUrgent ? 0 : ASSISTANT_DRAFT_FLUSH_DELAY_MS);
        }
      }
    })();
    this._assistantDraftFlushInFlight = run;
    return run;
  }

  /** Terminal/shutdown barrier: persist the latest dirty generation. */
  private async _flushAssistantDraftsNow(): Promise<void> {
    while (true) {
      if (this._assistantDraftFlushTimer !== undefined) {
        clearTimeout(this._assistantDraftFlushTimer);
        this._assistantDraftFlushTimer = undefined;
      }
      const inFlight = this._assistantDraftFlushInFlight;
      if (inFlight !== undefined) {
        await inFlight;
        continue;
      }
      if (!this._assistantDraftFlushDirty) return;
      await this._startAssistantDraftFlush();
    }
  }

  private _recordAssistantDraftDelta(opts: {
    runId: string;
    kind: 'text' | 'reasoning';
    delta: string;
    messageId?: string;
  }): void {
    // Reasoning remains a live stream event for consumers that explicitly
    // support it, but it is never copied into the durable assistant-answer
    // recovery projection. A reasoning-only run must not become visible as an
    // assistant answer after restart.
    if (opts.kind !== 'text' || opts.delta.length === 0) return;
    const now = Date.now();
    this._currentAssistantDraftRunIds.add(opts.runId);
    const previous = this._assistantDrafts.get(opts.runId);
    const text = this._appendBoundedDraftText(previous?.text, opts.delta);
    const previousIsTerminal =
      previous?.status === 'completed' || previous?.status === 'interrupted' || previous?.status === 'failed';
    const draft: HarnessAssistantDraft = {
      runId: opts.runId,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      ...(this._currentRunSignalId !== undefined ? { signalId: this._currentRunSignalId } : {}),
      ...(this._currentQueuedItemId !== undefined ? { queuedItemId: this._currentQueuedItemId } : {}),
      ...((opts.messageId ?? previous?.messageId) ? { messageId: opts.messageId ?? previous?.messageId } : {}),
      text: text.text,
      status: previousIsTerminal ? previous.status : 'streaming',
      startedAt: previous?.startedAt ?? this._currentRunStartedAt ?? now,
      updatedAt: now,
      ...(previousIsTerminal && previous.terminalAt !== undefined ? { terminalAt: previous.terminalAt } : {}),
      ...(previousIsTerminal && previous.finishReason !== undefined ? { finishReason: previous.finishReason } : {}),
      truncated: previous?.truncated === true || text.truncated || undefined,
    };
    this._assistantDrafts.set(opts.runId, draft);
    this._pruneAssistantDrafts();
    this._notifyDisplayRefresh();
    this._scheduleAssistantDraftFlush();
  }

  private _setAssistantDraftMessageId(runId: string | undefined, messageId: string | undefined): void {
    if (runId === undefined || messageId === undefined) return;
    const previous = this._assistantDrafts.get(runId);
    if (previous === undefined || previous.messageId === messageId) return;
    this._assistantDrafts.set(runId, { ...previous, messageId, updatedAt: Date.now() });
    this._notifyDisplayRefresh();
    this._scheduleAssistantDraftFlush();
  }

  private _terminalizeAssistantDraft(
    runId: string | undefined,
    finishReason: 'complete' | 'aborted' | 'error' | 'suspended',
  ): void {
    if (runId === undefined || finishReason === 'suspended') return;
    const draftRunId = this._assistantDrafts.has(runId)
      ? runId
      : this._currentAssistantDraftRunIds.size === 1
        ? this._currentAssistantDraftRunIds.values().next().value
        : undefined;
    if (draftRunId === undefined) return;
    const previous = this._assistantDrafts.get(draftRunId);
    if (previous === undefined) return;
    const now = Date.now();
    const status: HarnessAssistantDraft['status'] =
      finishReason === 'complete' ? 'completed' : finishReason === 'aborted' ? 'interrupted' : 'failed';
    this._assistantDrafts.set(draftRunId, {
      ...previous,
      status,
      finishReason,
      updatedAt: now,
      terminalAt: now,
    });
    this._pruneAssistantDrafts();
    this._notifyDisplayRefresh();
    this._scheduleAssistantDraftFlush(0);
  }

  /**
   * Emit a synthetic aborted `tool_end` for every tool still in the active set —
   * tools whose turn ended before they produced a result/error chunk. Keeps the
   * `tool_start` → `tool_end` pairing complete for streaming consumers. Skips when
   * the run id is unknown (cannot attribute the terminal). Best-effort: emitted on
   * the live subscriber stream like any other turn event.
   */
  private _emitAbortedToolEnds({ force = false }: { force?: boolean } = {}): void {
    if (this._activeTools.size === 0) return;
    // A turn that PARKED for resume (suspend / tool-approval / question /
    // plan-approval) is NOT abandoned — the parked tool resumes and emits its own
    // real tool_end. Only synthesize for genuinely terminal turns (abort / error /
    // complete-with-dangling-tool); never tombstone a tool that will resume.
    if (!force && this._record.pendingResume !== undefined) return;
    const runId = this._currentRunId;
    if (runId === undefined) return;
    for (const tool of this._activeTools.values()) {
      this._recordRunToolReceipt(runId, {
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        status: 'error',
      });
      this._emitTurnEvent({
        type: 'tool_end',
        runId,
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        output: { aborted: true, reason: 'turn ended before the tool produced a result' },
        isError: true,
      } as EmitInput);
      // Suppress a late real terminal for this tool (the drain may still deliver
      // its tool-result/tool-error after this turn ended).
      this._rememberSyntheticToolTerminalTombstone(runId, tool.toolCallId);
      // Make the helper idempotent within a turn. Some terminal-failure paths
      // must close dangling tools before emitting agent_end so the run rollup is
      // complete; the later generic turn teardown must not emit them again.
      this._activeTools.delete(tool.toolCallId);
    }
  }

  /**
   * A resumed segment is broadcast only after its `run-registered` publication
   * succeeds. If that registration rejects, the provider can still finish and
   * return a concrete FullOutput, but subscribers never see the segment's
   * `tool-result`. Project the consumed pending tool's real result directly so
   * the `tool_start` emitted before suspension still has exactly one terminal.
   *
   * Other drain failures happen after registration and may already have
   * delivered the result, so they must continue through the normal stream path
   * to avoid duplicate `tool_end` events.
   */
  private _emitUndeliveredResumedToolEnd(
    pending: PendingResume,
    full: FullOutput<unknown>,
    error: AgentThreadOutputDrainError,
  ): void {
    if (error.reason !== 'registration-publish-failed') return;
    // EventEmitter-style PubSub delivery is synchronous and can reach this
    // session before a later subscriber throws. In that partial-publication
    // case the subscription already emitted the real terminal even though the
    // registration promise rejects. Never synthesize a second one.
    if (this._hasEmittedToolTerminal(pending.runId, pending.toolCallId)) return;
    const resultChunk = full.toolResults.find(chunk => chunk.payload.toolCallId === pending.toolCallId);
    const result = resultChunk?.payload;
    const toolName = result?.toolName ?? pending.toolName;
    if (toolName === undefined) return;

    this._emitTurnEvent({
      type: 'tool_end',
      runId: pending.runId,
      toolCallId: pending.toolCallId,
      toolName,
      output: projectToolEventPayloadForJson(
        result !== undefined
          ? harnessDisplayToolPayload(resultChunk?.metadata, 'output-available', result.result)
          : {
              unavailable: true,
              reason: 'resumed tool result was unavailable after run registration failed',
            },
        'tool_end.output',
        this._harness._internalMaxEventPayloadBytes,
      ),
      isError: result?.isError ?? result === undefined,
    });
    // If the subscription drain races this fallback and delivers the already-
    // buffered real terminal afterwards, suppress that late copy once.
    this._rememberSyntheticToolTerminalTombstone(pending.runId, pending.toolCallId);
  }

  private _createActiveTurnWaiter(): ActiveTurnWaiter {
    let reject!: (err: unknown) => void;
    const activeTurn = this._currentTurnAbortController;
    const waiter: ActiveTurnWaiter = {
      promise: new Promise<never>((_, rej) => {
        reject = rej;
      }),
      controller: activeTurn,
      reject: err => reject(err),
      cleanup: () => {
        this._activeTurnWaiters.delete(waiter);
      },
    };
    this._activeTurnWaiters.add(waiter);
    if (this._state === 'deleted') {
      this._activeTurnWaiters.delete(waiter);
      waiter.reject(new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId));
    }
    if (activeTurn?.signal.aborted) {
      this._activeTurnWaiters.delete(waiter);
      waiter.reject(this._activeTurnAbortError(activeTurn));
    }
    return waiter;
  }

  private _rejectActiveTurnWaiters(reason: unknown, waiters?: ActiveTurnWaiter[]): void {
    const selectedWaiters = waiters ?? Array.from(this._activeTurnWaiters);
    if (selectedWaiters.length === 0) return;
    if (waiters) {
      for (const waiter of selectedWaiters) {
        this._activeTurnWaiters.delete(waiter);
      }
    } else {
      this._activeTurnWaiters.clear();
    }
    for (const waiter of selectedWaiters) {
      waiter.reject(reason);
    }
  }

  private _activeTurnAbortError(controller: AbortController): Error {
    const reason = (controller.signal as { reason?: unknown }).reason;
    const message = typeof reason === 'string' && reason.length > 0 ? reason : 'session_aborted';
    return reason instanceof Error ? reason : new HarnessSessionCancelledError(this.id, message);
  }

  private _scheduleActiveTurnAbort(controller: AbortController): void {
    const err = this._activeTurnAbortError(controller);
    const waiters = Array.from(this._activeTurnWaiters).filter(waiter => waiter.controller === controller);
    setTimeout(() => {
      if (!controller.signal.aborted) return;
      this._rejectActiveTurnWaiters(err, waiters);
    }, 0);
  }

  private _agentEndReasonForFullOutput(full: FullOutput<unknown>): 'complete' | 'aborted' | 'error' | 'suspended' {
    if (full.finishReason === 'suspended') return 'suspended';
    if (full.finishReason === 'aborted') return 'aborted';
    if (full.finishReason === 'error') return 'error';
    return 'complete';
  }

  /**
   * §4.5 `HarnessOutputGenerationError`: classify a non-suspended structured
   * sync-generate result that cannot yield a successful public typed value.
   * Returns `undefined` when the result carries a valid object.
   */
  private _classifyStructuredOutputFailure(full: FullOutput<unknown>): HarnessOutputGenerationReason | undefined {
    // An output processor rejected the response (tripwire) — object is absent by
    // construction, so check this before the missing-object case.
    if (full.tripwire !== undefined) return 'tripwire';
    // Schema-bearing sync form but the model produced no structured object.
    if (full.object === undefined) return 'structured_output_missing_object';
    return undefined;
  }

  /**
   * §4.5: normalize an error thrown out of the structured sync-generate path.
   * Aborts and harness-domain errors propagate with their own type; an already-
   * typed generation error passes through; anything else is an opaque agent/
   * runtime failure wrapped as `model_error`. Harness errors are detected by the
   * `Harness…Error` name they all carry — not every one exposes a `harness.*`
   * code (e.g. `HarnessSessionDeletedError`/`HarnessSessionLockedError`, which
   * the active-turn waiter rejects with), so the code alone is not sufficient.
   */
  private _asStructuredOutputError(err: unknown, runId: string | undefined, abortSignal: AbortSignal): unknown {
    if (err instanceof HarnessOutputGenerationError) return err;
    if (abortSignal.aborted) return err;
    if (err instanceof Error && err.name.startsWith('Harness')) return err;
    // §4.5: the agent layer surfaces structured-output schema validation as a
    // MastraError carrying this stable id (stream/base/output-format-handlers.ts);
    // distinguish it from an opaque model failure so callers see the precise reason.
    const reason: HarnessOutputGenerationReason =
      (err as { id?: unknown } | null | undefined)?.id === 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED'
        ? 'structured_output_validation_failed'
        : 'model_error';
    return new HarnessOutputGenerationError(this.id, reason, runId, { cause: err });
  }

  /** §10.2 `agent_end.usage`: the run's token usage (zero when unavailable, e.g. an error path with no terminal output). */
  private _runUsage(full?: FullOutput<unknown>): TokenUsage {
    const delta = full ? this._tokenUsageDeltaFromFullOutput(full) : undefined;
    return delta ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  /**
   * §10.2 agent_start/agent_end require a `runId`. The run id is coalesced from
   * the explicit dispatch/full id and the captured `_currentRunId`; when no run
   * id exists at all (a turn that failed before a run was reserved), no
   * lifecycle event is emitted — there was no run to start or end.
   */
  private _emitAgentStart(runId: string | undefined, signalId?: string): void {
    const id = runId ?? this._currentRunId;
    if (id === undefined) return;
    // Stamp the active run id at agent_start so subsequent streamed chunks —
    // which (for the long-lived thread subscription) do NOT carry their own
    // runId — can be attributed to this run by `_emitForChunk` (§10.2
    // text_delta/tool_start/tool_end all require a runId).
    if (this._currentRunId === undefined) {
      this._currentRunId = id;
      // §5.1b: stamp the run-start time for the SessionRunProjection. agent_start
      // is the canonical run-start choke for all entry paths.
      this._currentRunStartedAt = Date.now();
      // §5.1b: a signal-backed run records its originating signalId so the live
      // projection's `operation` can link to the durable signal row.
      this._currentRunSignalId = signalId;
    }
    this._emitTurnEvent({ type: 'agent_start', runId: id });
  }

  private _emitAgentEnd(opts: {
    runId: string | undefined;
    finishReason: 'complete' | 'aborted' | 'error' | 'suspended';
    full?: FullOutput<unknown>;
  }): void {
    const id = opts.runId ?? this._currentRunId;
    if (id === undefined) return;
    this._emitTurnEvent({
      type: 'agent_end',
      runId: id,
      finishReason: opts.finishReason,
      usage: this._runUsage(opts.full),
    });
  }

  private _pendingInteractionExpiresAt(pending: PendingResume): number {
    if (
      !Number.isSafeInteger(pending.expiresAt) ||
      pending.expiresAt < 0 ||
      !Number.isSafeInteger(pending.requestedAt) ||
      pending.requestedAt < 0 ||
      pending.expiresAt < pending.requestedAt
    ) {
      throw new HarnessSessionCorruptError({
        reason: 'pending_state_corrupt',
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
      });
    }
    return pending.expiresAt;
  }

  private _pendingInteractionDueAt(pending: PendingResume): number {
    if (pending.resumedAt === undefined) return this._pendingInteractionExpiresAt(pending);
    if (pending.resumeRecoveryAt === undefined) {
      // At-least-once resume marker without a recovery stamp: rows written by
      // builds that predate `resumeRecoveryAt` (the admission CAS now stamps
      // both fields atomically, so current code can no longer produce this
      // shape). The marker stays RECOVERABLE — its effective deadline is the
      // admission time plus the accepted-recovery stale window, exactly what
      // the stamping writer would have persisted. Classifying it corrupt would
      // permanently wedge the session on hydrate, the precise outcome the
      // crash-mid-resume recovery contract forbids (queue not parked).
      if (!Number.isSafeInteger(pending.resumedAt) || pending.resumedAt < 0) {
        throw new HarnessSessionCorruptError({
          reason: 'pending_state_corrupt',
          sessionId: this.id,
          resourceId: this.resourceId,
          threadId: this.threadId,
        });
      }
      return pending.resumedAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS;
    }
    if (!Number.isSafeInteger(pending.resumeRecoveryAt) || pending.resumeRecoveryAt < pending.resumedAt) {
      throw new HarnessSessionCorruptError({
        reason: 'pending_state_corrupt',
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
      });
    }
    return pending.resumeRecoveryAt;
  }

  private _pendingInteractionGeneration(pending: PendingResume): PendingInteractionExpiryGeneration {
    const dueAt = this._pendingInteractionDueAt(pending);
    return {
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      kind: pending.kind,
      itemId: pending.itemId ?? pending.toolCallId,
      runId: pending.runId,
      toolCallId: pending.toolCallId,
      requestedAt: pending.requestedAt,
      dueAt,
      expiresAt: pending.expiresAt,
      ...(pending.expiryStartedAt !== undefined ? { expiryStartedAt: pending.expiryStartedAt } : {}),
      ...(pending.resumedAt !== undefined ? { resumedAt: pending.resumedAt } : {}),
      ...(pending.resumeRecoveryAt !== undefined ? { resumeRecoveryAt: pending.resumeRecoveryAt } : {}),
      ...(pending.resumeRecoveryStartedAt !== undefined
        ? { resumeRecoveryStartedAt: pending.resumeRecoveryStartedAt }
        : {}),
    };
  }

  /**
   * Freeze this interaction's deadline onto the pending row. The TTL is
   * resolved per kind (`sessions.pendingInteractionTtlMsByKind`, falling back
   * to `sessions.pendingInteractionTtlMs`) at capture time only, so a later
   * config change never moves an already-parked interaction's deadline and a
   * restart reads the same `expiresAt` back out of storage.
   */
  private _newPendingInteractionTiming(kind: PendingResume['kind']): Pick<PendingResume, 'requestedAt' | 'expiresAt'> {
    const requestedAt = Date.now();
    return {
      requestedAt,
      expiresAt: requestedAt + this._harness._internalPendingInteractionTtlMsForKind(kind),
    };
  }

  private _clearPendingInteractionExpiryTimer(): void {
    if (this._pendingInteractionExpiryTimer !== undefined) {
      clearTimeout(this._pendingInteractionExpiryTimer);
      this._pendingInteractionExpiryTimer = undefined;
    }
    this._pendingInteractionExpiryAt = undefined;
  }

  /**
   * The timer is only a liveness wake-up. The callback re-checks the exact
   * pending identity inside `_flushUpdate`, which is the authority for an
   * expiry-vs-response race and remains correct after a restart.
   */
  private _syncPendingInteractionExpiryTimer(): void {
    const pending = this._record.pendingResume;
    if (this._state !== 'live' || pending === undefined) {
      this._clearPendingInteractionExpiryTimer();
      return;
    }
    const dueAt = this._pendingInteractionDueAt(pending);
    if (this._pendingInteractionExpiryTimer !== undefined && this._pendingInteractionExpiryAt === dueAt) return;
    this._clearPendingInteractionExpiryTimer();
    this._pendingInteractionExpiryAt = dueAt;
    const identity = this._pendingInteractionGeneration(pending);
    this._pendingInteractionExpiryTimer = setTimeout(
      () => {
        this._pendingInteractionExpiryTimer = undefined;
        this._pendingInteractionExpiryAt = undefined;
        void this._reconcilePendingInteractionDeadlineGeneration(identity).catch(err => {
          console.error('[harness/v1] pending interaction expiry persistence failed:', err);
          if (this._state !== 'live') return;
          this._emitter.emit({
            type: 'storage_error',
            operation: 'session_save',
            retryable: true,
            error: { code: 'harness.storage', message: 'pending interaction expiry persistence failed' },
            resourceId: this.resourceId,
            threadId: this.threadId,
            harnessName: this._record.harnessName,
          } as EmitInput);
          // A transient save failure must retry without requiring another user
          // action. Back off before re-arming: the persisted deadline is now in
          // the past, so an immediate `_sync` would otherwise create a hot
          // zero-delay retry loop while storage remains unavailable.
          this._pendingInteractionExpiryAt = dueAt;
          this._pendingInteractionExpiryTimer = setTimeout(() => {
            this._pendingInteractionExpiryTimer = undefined;
            this._pendingInteractionExpiryAt = undefined;
            this._syncPendingInteractionExpiryTimer();
          }, 1_000);
          this._pendingInteractionExpiryTimer.unref?.();
        });
      },
      pending.expiryStartedAt !== undefined || pending.resumeRecoveryStartedAt !== undefined
        ? 1_000
        : Math.max(0, dueAt - Date.now()),
    );
    this._pendingInteractionExpiryTimer.unref?.();
  }

  /** @internal — called after the Harness has installed its event bridge. */
  async _reconcilePendingInteractionExpiryOnHydrate(): Promise<void> {
    const pending = this._record.pendingResume;
    if (pending === undefined) {
      this._clearPendingInteractionExpiryTimer();
      return;
    }
    if (pending.resumedAt !== undefined) {
      const recovery = await this._maybeRecoverStaleQueuedResume({ kickDrainOnStale: false });
      if (recovery.status !== 'none') return;
      if (pending.resumeRecoveryAt === undefined) {
        // Legacy at-least-once marker (no recovery stamp): resolution belongs
        // to the interactive lanes — the next respond surfaces the
        // deterministic `harness.resume_recovery_stale` outcome and durably
        // clears the marker. Hydration only adopts; it neither terminalizes
        // the marker nor races the caller's next respond with an expiry timer.
        return;
      }
    }
    const dueAt = this._pendingInteractionDueAt(pending);
    if (Date.now() < dueAt) {
      this._syncPendingInteractionExpiryTimer();
      return;
    }
    await this._reconcilePendingInteractionDeadlineGeneration(this._pendingInteractionGeneration(pending));
  }

  /**
   * @internal — cold-row expiry entrypoint used by the Harness storage sweep.
   * The storage projection is discovery evidence only: every generation field
   * is rechecked by `_expirePendingInteraction` inside the session CAS. Cold
   * sweep sessions suppress queue draining; any surviving backlog starts on a
   * later normal hydration after the expired pending row has been cleared.
   */
  async _internalExpirePendingInteractionGeneration(
    expected: PendingInteractionExpiryGeneration,
    opts: { drainQueue?: boolean } = {},
  ): Promise<boolean> {
    if (
      expected.harnessName !== this._record.harnessName ||
      expected.sessionId !== this.id ||
      expected.resourceId !== this.resourceId
    ) {
      return false;
    }
    return this._reconcilePendingInteractionDeadlineGeneration(expected, opts);
  }

  private async _reconcilePendingInteractionDeadlineGeneration(
    expected: PendingInteractionExpiryGeneration,
    opts: { drainQueue?: boolean } = {},
  ): Promise<boolean> {
    if (expected.resumedAt !== undefined) {
      return this._recoverStaleResumeAdmission(expected, opts);
    }
    return this._expirePendingInteraction(
      {
        kind: expected.kind,
        itemId: expected.itemId,
        runId: expected.runId,
        toolCallId: expected.toolCallId,
        requestedAt: expected.requestedAt,
        expiresAt: expected.expiresAt,
      },
      opts,
    );
  }

  private async _expirePendingInteraction(
    expected: {
      kind: PendingResume['kind'];
      itemId: string;
      runId: string;
      toolCallId: string;
      requestedAt: number;
      expiresAt: number;
    },
    opts: { drainQueue?: boolean } = {},
  ): Promise<boolean> {
    if (this._state !== 'live') return false;
    const expiredAt = Date.now();
    if (expiredAt < expected.expiresAt) {
      this._syncPendingInteractionExpiryTimer();
      return false;
    }
    const expiryError = new HarnessPendingInteractionExpiredError(this.id, expected.itemId, expected.expiresAt);
    const projectedError = projectHarnessPublicError(expiryError);
    const generationKey = pendingInteractionGenerationKey(expected);
    let expiryStarted = false;
    let expiredPending: PendingResume | undefined;
    let failedQueueReceipt: QueueAdmissionReceipt | undefined;

    await this._flushUpdate(prev => {
      expiryStarted = false;
      expiredPending = undefined;
      failedQueueReceipt = undefined;
      const current = prev.pendingResume;
      if (
        current === undefined ||
        (current.resumedAt !== undefined && current.expiryStartedAt === undefined) ||
        current.kind !== expected.kind ||
        current.runId !== expected.runId ||
        current.toolCallId !== expected.toolCallId ||
        (current.itemId ?? current.toolCallId) !== expected.itemId ||
        current.requestedAt !== expected.requestedAt ||
        this._pendingInteractionExpiresAt(current) !== expected.expiresAt
      ) {
        return prev;
      }

      expiryStarted = true;
      const expiryStartedAt = current.expiryStartedAt ?? expiredAt;
      expiredPending = { ...current, expiryStartedAt };
      const next: SessionRecord = { ...prev, pendingResume: expiredPending };
      next.expiredPendingInteractions = appendExpiredPendingInteraction(prev.expiredPendingInteractions, {
        generationKey,
        itemId: expected.itemId,
        kind: expected.kind,
        runId: expected.runId,
        toolCallId: expected.toolCallId,
        requestedAt: expected.requestedAt,
        expiresAt: expected.expiresAt,
        expiredAt: expiryStartedAt,
        error: projectedError,
      });

      for (const [responseId, receipt] of Object.entries(prev.inboxResponseReceipts ?? {})) {
        if (
          receipt.itemId !== expected.itemId ||
          receipt.kind !== expected.kind ||
          receipt.runId !== expected.runId ||
          receipt.toolCallId !== expected.toolCallId ||
          receipt.pendingRequestedAt !== expected.requestedAt ||
          receipt.status !== 'failed' ||
          receipt.retryable !== true
        ) {
          continue;
        }
        next.inboxResponseReceipts = {
          ...(next.inboxResponseReceipts ?? prev.inboxResponseReceipts ?? {}),
          [responseId]: {
            ...receipt,
            status: 'failed',
            error: projectedError,
            retryable: false,
            failedAt: receipt.failedAt ?? expiryStartedAt,
            updatedAt: expiryStartedAt,
          },
        };
      }

      if (current.queuedItemId !== undefined) {
        next.pendingQueue = (prev.pendingQueue ?? []).filter(item => item.id !== current.queuedItemId);
        const receipt = prev.queueAdmissionReceipts?.[current.queuedItemId];
        failedQueueReceipt = receipt;
        if (receipt && receipt.status !== 'completed' && receipt.status !== 'failed' && receipt.status !== 'dead') {
          failedQueueReceipt = {
            ...receipt,
            status: 'failed',
            error: projectedError,
            failedAt: receipt.failedAt ?? expiredAt,
            updatedAt: expiredAt,
          };
          next.queueAdmissionReceipts = {
            ...(prev.queueAdmissionReceipts ?? {}),
            [current.queuedItemId]: failedQueueReceipt,
          };
        }
      }
      return next;
    });

    if (!expiryStarted || expiredPending === undefined) return false;
    this._pendingReplacementToolSurfaces.delete(expiredPending.runId);
    const activeController = this._currentTurnAbortController;
    if (activeController !== undefined) activeController.abort(expiryError);

    const queuedItemId = expiredPending.queuedItemId;
    if (queuedItemId !== undefined) {
      const settledReceipt = this._record.queueAdmissionReceipts?.[queuedItemId] ?? failedQueueReceipt;
      if (settledReceipt?.signalId !== undefined) {
        await this._writeQueueSignalResultEvidence({
          status: 'failed',
          signalId: settledReceipt.signalId,
          runId: settledReceipt.runId,
          error: projectedError,
        });
      }
      const resolver = this._queueResolvers.get(queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(queuedItemId);
        resolver.reject(expiryError);
      }
      if (this._currentQueuedItemId === queuedItemId) {
        this._currentQueuedItemId = undefined;
        this._currentQueuedItemSource = undefined;
      }
    }

    if (expiredPending.originSignalId !== undefined) {
      await this._settleSignalResult(expiredPending.originSignalId, {
        status: 'failed',
        runId: expiredPending.runId,
        error: projectedError,
      });
    }

    // Phase two clears the still-discoverable pending row only after every
    // durable queue/signal settlement has succeeded. A crash or storage error
    // before this CAS leaves `expiryStartedAt` indexed for hydrate/sweep retry.
    let finalized = false;
    await this._flushUpdate(prev => {
      finalized = false;
      const current = prev.pendingResume;
      if (
        current === undefined ||
        current.kind !== expected.kind ||
        current.runId !== expected.runId ||
        current.toolCallId !== expected.toolCallId ||
        (current.itemId ?? current.toolCallId) !== expected.itemId ||
        current.requestedAt !== expected.requestedAt ||
        current.expiresAt !== expected.expiresAt ||
        current.expiryStartedAt !== expiredPending!.expiryStartedAt
      ) {
        return prev;
      }
      finalized = true;
      const next: SessionRecord = { ...prev };
      delete next.pendingResume;
      return next;
    });
    if (!finalized) return false;

    if (queuedItemId !== undefined) {
      const settledReceipt = this._record.queueAdmissionReceipts?.[queuedItemId] ?? failedQueueReceipt;
      this._emit({
        type: 'queue_failed',
        queuedItemId,
        ...(settledReceipt?.runId ? { runId: settledReceipt.runId } : {}),
        ...(settledReceipt?.signalId ? { signalId: settledReceipt.signalId } : {}),
        ...(settledReceipt?.admissionId ? { admissionId: settledReceipt.admissionId } : {}),
        error: projectedError,
      });
    }
    this._emitAbortedToolEnds({ force: true });
    this._emitTurnEvent({
      type: 'resume_failed',
      runId: expiredPending.runId,
      retryable: false,
      error: projectedError,
    });
    // An already-running pre-registered ask/plan tool owns its terminal event;
    // the abort above makes that path finish. A parked suspension has no live
    // owner, so expiry closes its run here.
    if (activeController === undefined) {
      this._emitAgentEnd({ runId: expiredPending.runId, finishReason: 'error' });
    }
    this._notifyMaybeIdle();
    if (this._state === 'live' && opts.drainQueue !== false) void this._maybeDrainQueue();
    return true;
  }

  /**
   * Resolve a response admission whose owner disappeared after persisting
   * `resumedAt` but before committing terminal provider evidence. Re-dispatch
   * is intentionally forbidden: the provider/tool may already have performed
   * side effects. Instead, a two-phase exact-generation transition fails all
   * related receipts/signals and terminalizes the abandoned run.
   */
  private async _recoverStaleResumeAdmission(
    expected: PendingInteractionExpiryGeneration,
    opts: { drainQueue?: boolean } = {},
  ): Promise<boolean> {
    if (expected.resumedAt === undefined) return false;
    // Legacy at-least-once markers carry no recovery stamp; their effective
    // deadline is the synthesized one `_pendingInteractionDueAt` folded into
    // `dueAt` (admission + stale window). Stamped rows keep the exact-identity
    // requirement between the generation's dueAt and the persisted stamp.
    const expectedRecoveryDueAt = expected.resumeRecoveryAt ?? expected.resumedAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS;
    if (expected.dueAt !== expectedRecoveryDueAt) {
      return false;
    }
    const currentPending = this._record.pendingResume;
    let expectedQueuedItemId: string | undefined;
    if (
      currentPending?.resumedAt === expected.resumedAt &&
      currentPending.runId === expected.runId &&
      currentPending.toolCallId === expected.toolCallId
    ) {
      const queuedItemId = this._queuedItemIdForPendingResume(currentPending);
      expectedQueuedItemId = queuedItemId;
      if (queuedItemId !== undefined && this._record.queueAdmissionReceipts?.[queuedItemId]?.status === 'completed') {
        const recovery = await this._maybeRecoverStaleQueuedResume({ kickDrainOnStale: opts.drainQueue !== false });
        return recovery.status === 'completed';
      }
    }
    if (Date.now() < expectedRecoveryDueAt) {
      this._syncPendingInteractionExpiryTimer();
      return false;
    }
    // A legitimately slow resume still owns this live session. Only a cold
    // owner (or a hydrated session with no active turn) may classify the
    // persisted admission as abandoned.
    if (this._currentTurnAbortController !== undefined) {
      this._pendingInteractionExpiryAt = expectedRecoveryDueAt;
      this._pendingInteractionExpiryTimer = setTimeout(() => {
        this._pendingInteractionExpiryTimer = undefined;
        this._pendingInteractionExpiryAt = undefined;
        this._syncPendingInteractionExpiryTimer();
      }, 1_000);
      this._pendingInteractionExpiryTimer.unref?.();
      return false;
    }

    const recoveryError = new ResumeRecoveryStaleError();
    const projectedError = projectHarnessPublicError(recoveryError);
    const recoveryAt = Date.now();
    let recoveryStarted = false;
    let recoveringPending: PendingResume | undefined;
    let recoveringQueuedItemId: string | undefined;
    let failedQueueReceipt: QueueAdmissionReceipt | undefined;

    await this._flushUpdate(prev => {
      recoveryStarted = false;
      recoveringPending = undefined;
      recoveringQueuedItemId = undefined;
      failedQueueReceipt = undefined;
      const current = prev.pendingResume;
      if (
        current === undefined ||
        current.kind !== expected.kind ||
        current.runId !== expected.runId ||
        current.toolCallId !== expected.toolCallId ||
        (current.itemId ?? current.toolCallId) !== expected.itemId ||
        current.requestedAt !== expected.requestedAt ||
        current.expiresAt !== expected.expiresAt ||
        current.expiryStartedAt !== expected.expiryStartedAt ||
        current.resumedAt !== expected.resumedAt ||
        current.resumeRecoveryAt !== expected.resumeRecoveryAt ||
        current.resumeRecoveryStartedAt !== expected.resumeRecoveryStartedAt
      ) {
        return prev;
      }

      recoveryStarted = true;
      const resumeRecoveryStartedAt = current.resumeRecoveryStartedAt ?? recoveryAt;
      recoveringPending = { ...current, resumeRecoveryStartedAt };
      const next: SessionRecord = { ...prev, pendingResume: recoveringPending };

      for (const [responseId, receipt] of Object.entries(prev.inboxResponseReceipts ?? {})) {
        if (
          receipt.itemId !== expected.itemId ||
          receipt.kind !== expected.kind ||
          receipt.runId !== expected.runId ||
          receipt.toolCallId !== expected.toolCallId ||
          receipt.pendingRequestedAt !== expected.requestedAt ||
          receipt.status !== 'accepted'
        ) {
          continue;
        }
        next.inboxResponseReceipts = {
          ...(next.inboxResponseReceipts ?? prev.inboxResponseReceipts ?? {}),
          [responseId]: {
            ...receipt,
            status: 'failed',
            error: projectedError,
            retryable: false,
            failedAt: receipt.failedAt ?? resumeRecoveryStartedAt,
            updatedAt: resumeRecoveryStartedAt,
          },
        };
      }

      recoveringQueuedItemId =
        current.queuedItemId ??
        (prev.pendingQueue ?? []).find(item => {
          const receipt = prev.queueAdmissionReceipts?.[item.id];
          return (receipt?.status === 'accepted' || receipt?.status === 'completed') && receipt.runId === current.runId;
        })?.id;
      if (recoveringQueuedItemId !== undefined) {
        next.pendingQueue = (prev.pendingQueue ?? []).filter(item => item.id !== recoveringQueuedItemId);
        const receipt = prev.queueAdmissionReceipts?.[recoveringQueuedItemId];
        if (receipt && receipt.status !== 'completed' && receipt.status !== 'failed' && receipt.status !== 'dead') {
          failedQueueReceipt = {
            ...receipt,
            status: 'failed',
            error: projectedError,
            failedAt: receipt.failedAt ?? resumeRecoveryStartedAt,
            updatedAt: resumeRecoveryStartedAt,
          };
          next.queueAdmissionReceipts = {
            ...(prev.queueAdmissionReceipts ?? {}),
            [recoveringQueuedItemId]: failedQueueReceipt,
          };
        }
      }
      return next;
    });

    if (!recoveryStarted || recoveringPending === undefined) {
      if (
        expectedQueuedItemId !== undefined &&
        this._currentQueuedItemId === expectedQueuedItemId &&
        this._record.pendingResume?.queuedItemId !== expectedQueuedItemId &&
        !this._record.pendingQueue.some(item => item.id === expectedQueuedItemId)
      ) {
        this._currentQueuedItemId = undefined;
        this._currentQueuedItemSource = undefined;
        this._notifyMaybeIdle();
      }
      return false;
    }

    if (recoveringQueuedItemId !== undefined) {
      const settledReceipt = this._record.queueAdmissionReceipts?.[recoveringQueuedItemId] ?? failedQueueReceipt;
      if (settledReceipt?.signalId !== undefined) {
        await this._writeQueueSignalResultEvidence({
          status: 'failed',
          signalId: settledReceipt.signalId,
          runId: settledReceipt.runId,
          error: projectedError,
        });
      }
    }
    if (recoveringPending.originSignalId !== undefined) {
      await this._settleSignalResult(recoveringPending.originSignalId, {
        status: 'failed',
        runId: recoveringPending.runId,
        error: projectedError,
      });
    }

    let finalized = false;
    await this._flushUpdate(prev => {
      finalized = false;
      const current = prev.pendingResume;
      if (
        current === undefined ||
        current.kind !== expected.kind ||
        current.runId !== expected.runId ||
        current.toolCallId !== expected.toolCallId ||
        (current.itemId ?? current.toolCallId) !== expected.itemId ||
        current.requestedAt !== expected.requestedAt ||
        current.expiresAt !== expected.expiresAt ||
        current.resumedAt !== expected.resumedAt ||
        current.resumeRecoveryAt !== expected.resumeRecoveryAt ||
        current.resumeRecoveryStartedAt !== recoveringPending!.resumeRecoveryStartedAt
      ) {
        return prev;
      }
      finalized = true;
      const next: SessionRecord = { ...prev };
      delete next.pendingResume;
      return next;
    });
    if (!finalized) return false;

    this._pendingReplacementToolSurfaces.delete(recoveringPending.runId);
    if (recoveringQueuedItemId !== undefined) {
      const settledReceipt = this._record.queueAdmissionReceipts?.[recoveringQueuedItemId] ?? failedQueueReceipt;
      this._emit({
        type: 'queue_failed',
        queuedItemId: recoveringQueuedItemId,
        ...(settledReceipt?.runId ? { runId: settledReceipt.runId } : {}),
        ...(settledReceipt?.signalId ? { signalId: settledReceipt.signalId } : {}),
        ...(settledReceipt?.admissionId ? { admissionId: settledReceipt.admissionId } : {}),
        error: projectedError,
      });
      const resolver = this._queueResolvers.get(recoveringQueuedItemId);
      if (resolver) {
        this._queueResolvers.delete(recoveringQueuedItemId);
        resolver.reject(recoveryError);
      }
      if (this._currentQueuedItemId === recoveringQueuedItemId) {
        this._currentQueuedItemId = undefined;
        this._currentQueuedItemSource = undefined;
      }
    }
    this._emitAbortedToolEnds({ force: true });
    this._emitTurnEvent({
      type: 'resume_failed',
      runId: recoveringPending.runId,
      retryable: false,
      error: projectedError,
    });
    this._emitAgentEnd({ runId: recoveringPending.runId, finishReason: 'error' });
    this._notifyMaybeIdle();
    if (this._state === 'live' && opts.drainQueue !== false) void this._maybeDrainQueue();
    return true;
  }

  /**
   * §10.2 suspension event: project a captured `PendingResume` into the matching
   * pending shape (tool_approval_required / tool_suspension_required /
   * question_pending / plan_approval_required). Sandbox/path-access prompts
   * project to `question_pending` (§10.2 defines no dedicated sandbox event).
   * Emitted after the durable-parking barrier so subscribers can reconstruct
   * the pending state from storage.
   */
  private _emitPendingEvent(pending: PendingResume): void {
    const sourceFields =
      pending.source === 'subagent'
        ? {
            source: 'subagent' as const,
            subagentToolCallId: pending.subagentToolCallId ?? '',
            subagentSessionId: this.id,
          }
        : { source: 'parent' as const };
    const base = {
      runId: pending.runId,
      itemId: pending.itemId ?? '',
      requestedAt: pending.requestedAt,
      expiresAt: this._pendingInteractionExpiresAt(pending),
      toolCallId: pending.toolCallId,
      ...sourceFields,
    };
    const p = pending.payload ?? {};
    switch (pending.kind) {
      case 'tool-approval':
        this._emitTurnEvent({
          type: 'tool_approval_required',
          ...base,
          toolName: pending.toolName ?? '',
          ...(p.toolCategory !== undefined ? { toolCategory: p.toolCategory } : {}),
          approvalReasons: p.approvalReasons ?? [],
          // §10.2 (events.ts:202 "Public payloads are JSON-safe projections"):
          // `p.input` is the raw runtime `payload.args` from the suspended
          // output (Date/Map/class/bigint). Project it at emit so the first
          // live subscriber and the durable/replayed row carry the identical
          // value — the same live===replay guarantee as tool_start/tool_end.
          input: projectToolEventPayloadForJson(
            p.input,
            'tool_approval_required.input',
            this._harness._internalMaxEventPayloadBytes,
          ),
        } as EmitInput);
        return;
      case 'tool-suspension':
        this._emitTurnEvent({
          type: 'tool_suspension_required',
          ...base,
          toolName: pending.toolName ?? '',
          // §10.2: `suspendData` is the tool's raw `suspendPayload` and can hold
          // runtime objects, so project it at emit for live===replay parity.
          suspendData: projectToolEventPayloadForJson(
            p.suspendData,
            'tool_suspension_required.suspendData',
            this._harness._internalMaxEventPayloadBytes,
          ),
        } as EmitInput);
        return;
      case 'question':
        this._emitTurnEvent({
          type: 'question_pending',
          ...base,
          question: p.question ?? '',
          ...(p.options !== undefined ? { options: p.options } : {}),
          ...(p.selectionMode !== undefined ? { selectionMode: p.selectionMode } : {}),
        } as EmitInput);
        return;
      case 'plan-approval':
        this._emitTurnEvent({
          type: 'plan_approval_required',
          ...base,
          title: p.title ?? '',
          plan: p.plan ?? '',
        } as EmitInput);
        return;
      case 'sandbox-access':
        // §10.2: sandbox/path-access prompts project to question_pending.
        this._emitTurnEvent({
          type: 'question_pending',
          ...base,
          question: p.sandboxAccess?.reason ?? `Allow ${p.sandboxAccess?.semanticType ?? 'sandbox'} access?`,
        } as EmitInput);
        return;
    }
  }

  private _raceActiveTurnWaiter<T>(promise: Promise<T>, activeTurnWaiter?: Promise<never>): Promise<T> {
    return activeTurnWaiter ? Promise.race([promise, activeTurnWaiter]) : promise;
  }

  private _trackBackgroundTurnCompletion<T>(promise: Promise<T>): Promise<T> {
    this._backgroundTurnCompletions.add(promise);
    void promise
      .finally(() => {
        this._backgroundTurnCompletions.delete(promise);
      })
      .catch(() => {});
    return promise;
  }

  private _shouldWriteTurnFailureEvidence(err: unknown): boolean {
    return this._state !== 'deleted' && !(err instanceof HarnessSessionDeletedError);
  }

  private async _withActiveDeletedWaiter<T>(fn: (activeTurnWaiter: Promise<never>) => Promise<T>): Promise<T> {
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    try {
      return await fn(activeTurnWaiter.promise);
    } finally {
      activeTurnWaiter.cleanup();
    }
  }

  /** Capture the first run id for the active turn display state. */
  private _captureTurnRunId(full: FullOutput<unknown>): void {
    if (this._currentTurnAbortController === undefined) return;
    if (full.runId && this._currentRunId === undefined) {
      this._currentRunId = full.runId;
    }
  }

  private _tokenUsageDeltaFromFullOutput(
    full: FullOutput<unknown>,
    accountedCumulative?: TokenUsage,
  ): TokenUsage | undefined {
    const usage = (full as { totalUsage?: unknown; usage?: unknown }).totalUsage ?? (full as { usage?: unknown }).usage;
    if (usage && typeof usage === 'object') {
      const u = usage as {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
      };
      const prompt = u.promptTokens ?? u.inputTokens;
      const completion = u.completionTokens ?? u.outputTokens;
      const promptNumber = typeof prompt === 'number' && Number.isInteger(prompt) && prompt >= 0 ? prompt : undefined;
      const completionNumber =
        typeof completion === 'number' && Number.isInteger(completion) && completion >= 0 ? completion : undefined;
      const delta: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      const incremented =
        promptNumber !== undefined ||
        completionNumber !== undefined ||
        (typeof u.totalTokens === 'number' && Number.isInteger(u.totalTokens) && u.totalTokens >= 0);
      if (promptNumber !== undefined) delta.promptTokens += promptNumber;
      if (completionNumber !== undefined) delta.completionTokens += completionNumber;
      const derivedTotalTokens = (promptNumber ?? 0) + (completionNumber ?? 0);
      if (typeof u.totalTokens === 'number' && Number.isInteger(u.totalTokens) && u.totalTokens >= 0) {
        delta.totalTokens += u.totalTokens < derivedTotalTokens ? derivedTotalTokens : u.totalTokens;
      } else if (promptNumber !== undefined || completionNumber !== undefined) {
        // Providers that only emit `inputTokens`/`outputTokens` leave `totalTokens`
        // off; derive it so the aggregate stays consistent with its parts.
        delta.totalTokens += derivedTotalTokens;
      }
      if (!incremented) return undefined;
      if (accountedCumulative === undefined) return delta;

      // A resumed Mastra stream restores its prior usage counter, so FullOutput
      // is cumulative across suspend boundaries. Subtract the durable baseline
      // component-wise. If a provider resets a counter, treat the new value as
      // this segment's usage rather than producing a negative delta.
      const promptTokens =
        delta.promptTokens >= accountedCumulative.promptTokens
          ? delta.promptTokens - accountedCumulative.promptTokens
          : delta.promptTokens;
      const completionTokens =
        delta.completionTokens >= accountedCumulative.completionTokens
          ? delta.completionTokens - accountedCumulative.completionTokens
          : delta.completionTokens;
      const rawTotalTokens =
        delta.totalTokens >= accountedCumulative.totalTokens
          ? delta.totalTokens - accountedCumulative.totalTokens
          : delta.totalTokens;
      const resumedDelta = {
        promptTokens,
        completionTokens,
        totalTokens: Math.max(rawTotalTokens, promptTokens + completionTokens),
      };
      return resumedDelta.promptTokens === 0 && resumedDelta.completionTokens === 0 && resumedDelta.totalTokens === 0
        ? undefined
        : resumedDelta;
    }
    return undefined;
  }

  private _applyTokenUsageDelta(delta: TokenUsage | undefined): void {
    if (delta === undefined) return;
    this._tokenUsage = {
      promptTokens: this._tokenUsage.promptTokens + delta.promptTokens,
      completionTokens: this._tokenUsage.completionTokens + delta.completionTokens,
      totalTokens: this._tokenUsage.totalTokens + delta.totalTokens,
    };
    // §10.2 StateEvent: emit the new cumulative session total whenever a turn
    // commits a usage delta (covers message / signal / queue turn paths, which
    // all funnel through here).
    this._emit({ type: 'token_usage_changed', usage: { ...this._tokenUsage } });
  }

  private _clearPendingTokenUsageFlushErrorIfSaved(tokenUsage: TokenUsage | undefined): void {
    if (
      tokenUsage !== undefined &&
      tokenUsage.promptTokens === this._tokenUsage.promptTokens &&
      tokenUsage.completionTokens === this._tokenUsage.completionTokens &&
      tokenUsage.totalTokens === this._tokenUsage.totalTokens
    ) {
      this._pendingTokenUsageFlushError = undefined;
      if (this._pendingDurableTurnFlushError?.pendingResume === undefined) {
        this._pendingDurableTurnFlushError = undefined;
      }
    }
  }

  private _latchDurableTurnFlushError(err: unknown, full?: FullOutput<unknown>): void {
    if (!this._isExpectedFlushLifecycleError(err)) {
      this._pendingDurableTurnFlushError ??= { error: err, pendingResume: this._pendingResumeKeyFromOutput(full) };
    }
  }

  private _pendingResumeKeyFromOutput(
    full: FullOutput<unknown> | undefined,
  ): { runId: string; toolCallId: string } | undefined {
    if (!full?.runId || full.finishReason !== 'suspended') return undefined;
    const payload = full.suspendPayload as { toolCallId?: unknown } | undefined;
    return typeof payload?.toolCallId === 'string' ? { runId: full.runId, toolCallId: payload.toolCallId } : undefined;
  }

  private _clearPendingDurableTurnFlushErrorIfRepaired(full?: FullOutput<unknown>): void {
    const latched = this._pendingDurableTurnFlushError;
    if (latched === undefined) return;
    const latchedPending = latched.pendingResume;
    if (latchedPending === undefined) {
      this._pendingDurableTurnFlushError = undefined;
      return;
    }
    const repairedPending = this._pendingResumeKeyFromOutput(full);
    if (
      repairedPending?.runId === latchedPending.runId &&
      repairedPending.toolCallId === latchedPending.toolCallId &&
      this._record.pendingResume?.runId === latchedPending.runId &&
      this._record.pendingResume.toolCallId === latchedPending.toolCallId
    ) {
      this._pendingDurableTurnFlushError = undefined;
    }
  }

  private _recordTokenUsageMatchesLive(opts: { tolerateInvalidZero?: boolean } = {}): boolean {
    const stored = this._record.tokenUsage;
    const liveIsZero =
      this._tokenUsage.promptTokens === 0 &&
      this._tokenUsage.completionTokens === 0 &&
      this._tokenUsage.totalTokens === 0;
    if (
      stored === undefined ||
      !this._isValidTokenCount(stored.promptTokens) ||
      !this._isValidTokenCount(stored.completionTokens) ||
      !this._isValidTokenCount(stored.totalTokens)
    ) {
      return opts.tolerateInvalidZero === true && liveIsZero;
    }
    return (
      stored.promptTokens === this._tokenUsage.promptTokens &&
      stored.completionTokens === this._tokenUsage.completionTokens &&
      stored.totalTokens === this._tokenUsage.totalTokens
    );
  }

  private _isValidTokenCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  private _recordTurnCompletion(
    full: FullOutput<unknown>,
    opts: { persist?: boolean; accountedCumulative?: TokenUsage } = {},
  ): TokenUsage | undefined {
    this._captureTurnRunId(full);
    const delta = this._tokenUsageDeltaFromFullOutput(full, opts.accountedCumulative);
    this._applyTokenUsageDelta(delta);
    if (delta !== undefined && opts.persist !== false) this._schedulePersistTokenUsage();
    return delta;
  }

  private _recordMessageTurnCompletion(
    full: FullOutput<unknown>,
    opts: { persist?: boolean } = {},
  ): { tokenUsageDelta?: TokenUsage; tokenUsageAccounted: boolean } {
    this._captureTurnRunId(full);
    if (full.runId && this._messageTokenAccountedRunIds.has(full.runId)) {
      return { tokenUsageAccounted: true };
    }
    const tokenUsageDelta = this._tokenUsageDeltaFromFullOutput(full);
    this._applyTokenUsageDelta(tokenUsageDelta);
    if (tokenUsageDelta !== undefined) {
      if (full.runId) this._messageTokenAccountedRunIds.add(full.runId);
      if (opts.persist !== false) this._schedulePersistTokenUsage();
      return { tokenUsageDelta, tokenUsageAccounted: true };
    }
    return { tokenUsageAccounted: false };
  }

  private _messageSuspendedTokenUsageDelta(full: FullOutput<unknown>): TokenUsage | undefined {
    if (
      full.runId &&
      (this._messageTokenAccountedRunIds.has(full.runId) || this._messageTokenAccountingRunIds.has(full.runId))
    ) {
      return undefined;
    }
    return this._tokenUsageDeltaFromFullOutput(full);
  }

  private _reserveMessageSuspendedTokenUsage(full: FullOutput<unknown>): {
    tokenUsageDelta?: TokenUsage;
    reservedRunId?: string;
    reservation?: Deferred<void>;
  } {
    const tokenUsageDelta = this._messageSuspendedTokenUsageDelta(full);
    if (tokenUsageDelta !== undefined && full.runId) {
      const reservation = createDeferred<void>();
      this._messageTokenAccountingRunIds.add(full.runId);
      this._messageTokenAccountingReservations.set(full.runId, reservation);
      void reservation.promise.catch(() => {});
      return { tokenUsageDelta, reservedRunId: full.runId, reservation };
    }
    return { tokenUsageDelta };
  }

  private _commitMessageSuspendedTokenUsage(
    full: FullOutput<unknown>,
    reservation: { tokenUsageDelta?: TokenUsage; reservedRunId?: string; reservation?: Deferred<void> },
  ): void {
    if (reservation.reservedRunId !== undefined) {
      this._messageTokenAccountingRunIds.delete(reservation.reservedRunId);
      if (this._messageTokenAccountingReservations.get(reservation.reservedRunId) === reservation.reservation) {
        this._messageTokenAccountingReservations.delete(reservation.reservedRunId);
      }
      this._messageTokenAccountedRunIds.add(reservation.reservedRunId);
      reservation.reservation?.resolve();
    } else if (reservation.tokenUsageDelta !== undefined && full.runId) {
      this._messageTokenAccountedRunIds.add(full.runId);
    }
  }

  private _rollbackMessageSuspendedTokenUsage(reservation: {
    reservedRunId?: string;
    reservation?: Deferred<void>;
  }): void {
    if (reservation.reservedRunId !== undefined) {
      this._messageTokenAccountingRunIds.delete(reservation.reservedRunId);
      if (this._messageTokenAccountingReservations.get(reservation.reservedRunId) === reservation.reservation) {
        this._messageTokenAccountingReservations.delete(reservation.reservedRunId);
      }
      reservation.reservation?.resolve();
    }
  }

  private async _waitForMessageSuspendedTokenUsageOwner(
    full: FullOutput<unknown>,
    activeTurnWaiter?: Promise<never>,
  ): Promise<void> {
    if (!full.runId) return;
    while (!this._messageTokenAccountedRunIds.has(full.runId)) {
      const reservation = this._messageTokenAccountingReservations.get(full.runId);
      if (reservation === undefined) return;
      await this._raceActiveTurnWaiter(reservation.promise, activeTurnWaiter);
    }
  }

  private async _captureMessageSuspendWithTokenUsage(
    full: FullOutput<unknown>,
    queuedItemId: string | undefined,
    modeId: string,
    modelId: string,
    activeTurnWaiter?: Promise<never>,
  ): Promise<void> {
    await this._waitForMessageSuspendedTokenUsageOwner(full, activeTurnWaiter);
    const reservation = this._reserveMessageSuspendedTokenUsage(full);
    try {
      await this._raceActiveTurnWaiter(
        this._maybeCaptureSuspend(full, queuedItemId, modeId, modelId, {
          tokenUsageDelta: reservation.tokenUsageDelta,
        }),
        activeTurnWaiter,
      );
      this._commitMessageSuspendedTokenUsage(full, reservation);
    } catch (err) {
      this._rollbackMessageSuspendedTokenUsage(reservation);
      throw err;
    }
  }

  /**
   * Trigger a no-op `_flushUpdate` so the latest `_tokenUsage` is overlaid into
   * `SessionRecord.tokenUsage` on disk. Fire-and-forget — serialized via
   * `_flushChain` so it never races concurrent setters, and skipped when the
   * session is no longer in a state that accepts writes. Non-lifecycle storage
   * failures are latched onto `_pendingTokenUsageFlushError` so
   * `_internalAwaitFlushChain()` can surface them to shutdown/test callers.
   */
  private _schedulePersistTokenUsage(): void {
    if (this._state !== 'live' && this._state !== 'closing') return;
    void this._persistTokenUsageOrLatch().catch(err => {
      if (this._isExpectedFlushLifecycleError(err)) return;
      this._pendingTokenUsageFlushError ??= err;
    });
  }

  private _persistTokenUsage(): Promise<void> {
    if (this._state !== 'live' && this._state !== 'closing') return Promise.resolve();
    return this._flushUpdate(prev => prev);
  }

  private async _persistTokenUsageOrLatch(): Promise<void> {
    try {
      await this._persistTokenUsage();
    } catch (err) {
      if (!this._isExpectedFlushLifecycleError(err)) this._pendingTokenUsageFlushError ??= err;
      throw err;
    }
  }

  async _internalPersistTokenUsageForShutdown(opts: { deadlineAt?: number } = {}): Promise<void> {
    const timeoutMs = opts.deadlineAt === undefined ? undefined : Math.max(0, opts.deadlineAt - Date.now());
    if (
      this._pendingTokenUsageFlushError === undefined &&
      this._recordTokenUsageMatchesLive({ tolerateInvalidZero: timeoutMs === 0 })
    ) {
      return;
    }
    const persist = this._persistTokenUsageOrLatch();
    void persist.catch(() => {});
    if (timeoutMs === undefined) {
      await persist;
      return;
    }
    if (timeoutMs === 0) {
      throw new HarnessValidationError('shutdown()', 'Session token usage did not flush before shutdown deadline');
    }
    const timedOut = Symbol('harness-token-usage-timeout');
    const result = await Promise.race([persist.then(() => undefined), delay(timeoutMs).then(() => timedOut)]);
    if (result === timedOut) {
      throw new HarnessValidationError('shutdown()', 'Session token usage did not flush before shutdown deadline');
    }
  }

  private _persistTokenUsageDelta(delta: TokenUsage | undefined): Promise<void> {
    if (delta === undefined) return Promise.resolve();
    if (this._state !== 'live' && this._state !== 'closing') return Promise.resolve();
    return this._flushUpdate(prev => prev, { tokenUsageDelta: delta });
  }

  private _isExpectedFlushLifecycleError(err: unknown): boolean {
    return (
      err instanceof HarnessSessionClosedError ||
      err instanceof HarnessSessionDeletedError ||
      err instanceof HarnessStateConflictError
    );
  }

  /**
   * Wait for any in-flight `_flushUpdate` writes (including the trailing
   * persist scheduled by `_recordTurnCompletion`) to settle. Throws if a
   * scheduled token-usage flush hit a non-lifecycle storage error so shutdown
   * and tests surface durability gaps instead of silently dropping them.
   *
   * @internal
   */
  async _internalAwaitFlushChain(opts: { deadlineAt?: number } = {}): Promise<void> {
    const waitUntilDeadline = async (promise: Promise<unknown>): Promise<boolean> => {
      if (opts.deadlineAt === undefined) {
        await promise;
        return true;
      }
      const timeoutMs = Math.max(0, opts.deadlineAt - Date.now());
      const timedOut = Symbol('harness-flush-timeout');
      const result = await Promise.race([promise.then(() => undefined), delay(timeoutMs).then(() => timedOut)]);
      return result !== timedOut;
    };

    while (true) {
      const backgroundTurnCompletions = Array.from(this._backgroundTurnCompletions);
      if (backgroundTurnCompletions.length > 0) {
        const completed = await waitUntilDeadline(Promise.allSettled(backgroundTurnCompletions));
        if (!completed) {
          throw new HarnessValidationError(
            'shutdown()',
            'Session background work did not flush before shutdown deadline',
          );
        }
      }
      const chain = this._flushChain;
      const completed = await waitUntilDeadline(chain);
      if (!completed) {
        throw new HarnessValidationError('shutdown()', 'Session storage writes did not flush before shutdown deadline');
      }
      const assistantDraftFlush = this._flushAssistantDraftsNow();
      const assistantDraftsCompleted = await waitUntilDeadline(assistantDraftFlush);
      if (!assistantDraftsCompleted) {
        throw new HarnessValidationError(
          'shutdown()',
          'Session assistant drafts did not flush before shutdown deadline',
        );
      }
      if (this._flushChain === chain && this._backgroundTurnCompletions.size === 0) break;
    }
    const latched = this._pendingTokenUsageFlushError;
    if (latched !== undefined) {
      this._pendingTokenUsageFlushError = undefined;
      throw latched;
    }
    const durableTurnLatched = this._pendingDurableTurnFlushError;
    if (durableTurnLatched !== undefined) {
      if (
        durableTurnLatched.pendingResume !== undefined &&
        this._record.pendingResume?.runId === durableTurnLatched.pendingResume.runId &&
        this._record.pendingResume.toolCallId === durableTurnLatched.pendingResume.toolCallId
      ) {
        this._pendingDurableTurnFlushError = undefined;
        return;
      }
      throw durableTurnLatched.error;
    }
  }

  /** Latched storage error from a scheduled token-usage persist; surfaced by
   * `_internalAwaitFlushChain()` so shutdown and tests can act on it. */
  private _pendingTokenUsageFlushError: unknown;
  private _pendingDurableTurnFlushError:
    | { error: unknown; pendingResume?: { runId: string; toolCallId: string } }
    | undefined;

  /**
   * True while a turn (message or queued) is in flight against the agent.
   * Goes back to false on terminal completion, suspension, or abort.
   * Subscribers should drive UI affordances (e.g. spinner, ESC-to-cancel)
   * from this signal in combination with `lifecycleState`.
   */
  isRunning(): boolean {
    return this._currentTurnAbortController !== undefined;
  }

  /**
   * True when the session has any pending work — an in-flight turn, an
   * active queue drain, a queued item awaiting its turn, a pending
   * `respondTo*` suspension, or an inline/detached subagent execution. False
   * only when the complete owned work graph is idle.
   *
   * Broader than `isRunning()`: a session can be `!isRunning()` but still
   * `isBusy()` (queue items not yet drained, awaiting `respondToQuestion`,
   * etc.). UI affordances that care about "anything happening at all"
   * (e.g. "session is working" indicators) should read this; affordances
   * tied to a single live turn (spinner, abort button) should read
   * `isRunning()`.
   */
  isBusy(): boolean {
    if (this._currentTurnAbortController !== undefined) return true;
    if (this._draining) return true;
    if (this._currentQueuedItemId !== undefined) return true;
    if ((this._record.pendingQueue?.length ?? 0) > 0) return true;
    if (this._record.pendingResume !== undefined && this._record.cancelRequest === undefined) return true;
    if (this._subagentExecutionsInFlight > 0) return true;
    return false;
  }

  /** Classify why the session is busy for `HarnessBusyError` (§4.5a). */
  private _busyReason(): 'in_flight' | 'pending_approval' | 'pending_suspension' | 'pending_question' | 'pending_plan' {
    const pending = this._record.pendingResume;
    if (pending !== undefined && this._record.cancelRequest === undefined) {
      switch (pending.kind) {
        case 'tool-suspension':
          return 'pending_suspension';
        case 'question':
          return 'pending_question';
        case 'plan-approval':
          return 'pending_plan';
        // 'tool-approval' and 'sandbox-access' are both approval-style gates.
        default:
          return 'pending_approval';
      }
    }
    return 'in_flight';
  }

  private _isShutdownDrainBusy(): boolean {
    if (this._currentTurnAbortController !== undefined) return true;
    // Inline spawn and detached delegation reserve a parent-local execution
    // slot before child creation and release it only after the complete child
    // lifecycle settles. Closing the parent while that slot is held would
    // otherwise terminalize the subtree underneath a still-running tool/driver.
    // Keep this before the parked-HITL shortcut: a parent can be durably parked
    // while it still owns independent child work that must drain or hit the
    // shared close deadline.
    if (this._subagentExecutionsInFlight > 0) return true;
    if (this._record.pendingResume !== undefined) return false;
    if (this._draining) return true;
    if (this._currentQueuedItemId !== undefined) return true;
    return (this._record.pendingQueue?.length ?? 0) > 0;
  }

  /**
   * Number of items currently waiting in `pendingQueue` (excluding any
   * queued item already drained into a live turn — that one is tracked
   * via `_currentQueuedItemId`). Cheap, synchronous, safe to poll from UI.
   */
  getQueueDepth(): number {
    return this._record.pendingQueue?.length ?? 0;
  }

  /**
   * §4.2c: the in-flight run's id, or `null` when no run is active. Reads the
   * live run marker stamped at `agent_start`. Spec also allows a reconciled
   * `SessionRecord.currentRun` snapshot fallback, but v1 does not yet persist
   * `currentRun` (that durable read-model is a separate lane), so this is
   * live-best-effort: a rehydrated idle session reports `null`.
   */
  getCurrentRunId(): string | null {
    return this._currentRunId ?? null;
  }

  /** §4.2c: the in-flight run's trace id, or `null` when absent (live-best-effort, see {@link getCurrentRunId}). */
  getCurrentTraceId(): string | null {
    return this._currentTraceId ?? null;
  }

  /**
   * Cumulative token usage for this session, accumulated across every
   * completed turn (manual or queued). Returns a fresh shallow copy so
   * callers can't mutate the running aggregate.
   *
   * Durable across rehydration: counters are persisted into
   * `SessionRecord.tokenUsage` on every save and seeded from there on
   * construction, so reopens after eviction or process restart carry the
   * accumulated value instead of resetting to zero.
   */
  getTokenUsage(): TokenUsage {
    return { ...this._tokenUsage };
  }

  async extendLease(opts: { ttlMs: number }): Promise<void> {
    if (this._state === 'deleted') {
      throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
    }
    if (this._state !== 'live' && this._state !== 'closing') {
      throw new HarnessSessionClosedError(this.id);
    }
    if (!Number.isFinite(opts.ttlMs) || !Number.isInteger(opts.ttlMs) || opts.ttlMs <= 0) {
      throw new HarnessValidationError('extendLease().ttlMs', 'ttlMs must be a positive integer in milliseconds');
    }
    if (opts.ttlMs > MAX_LEASE_EXTENSION_MS) {
      throw new HarnessValidationError(
        'extendLease().ttlMs',
        `ttlMs must be at most ${MAX_LEASE_EXTENSION_MS}ms (24h)`,
      );
    }

    const effectiveTtl = Math.max(opts.ttlMs, this._harness._internalLeaseTtlMs);
    // §5.8: a child has no separately-renewable lease, so `extendLease` extends
    // the whole subtree through the root (capped at the root, never shrinking
    // it). The helper resolves the live root, serializes on the ROOT's lease
    // chain (so it can't race the background sweep), renews root + active
    // descendants atomically, advances the ROOT's extension deadline so the next
    // sweep keeps the extension, and fences the subtree (throwing locked/not-
    // found) if ownership can't be proven. We do NOT wrap this in the calling
    // session's own renewal chain: the helper already serializes on the root
    // chain, and a second wrap would deadlock when the caller IS the root.
    await this._harness._internalRenewProveSubtree(this, effectiveTtl, { propagateRootDeadline: true });
  }

  async withExtendedLease<T>(fn: () => Promise<T>, opts: { ttlMs: number }): Promise<T> {
    await this.extendLease(opts);
    return fn();
  }

  _getEffectiveLeaseTtlMs(defaultTtlMs: number): number {
    const deadline = this._leaseExtensionDeadline;
    if (deadline === undefined || !Number.isFinite(deadline)) return defaultTtlMs;
    const remaining = deadline - Date.now();
    return remaining > defaultTtlMs ? remaining : defaultTtlMs;
  }

  /**
   * @internal §5.8 — advance the root's effective-TTL deadline after a subtree
   * renewal so the next background sweep keeps the extension instead of
   * shortening it back to the default TTL. Advance-only.
   */
  _setLeaseExtensionDeadline(deadline: number): void {
    if (this._leaseExtensionDeadline === undefined || deadline > this._leaseExtensionDeadline) {
      this._leaseExtensionDeadline = deadline;
    }
  }

  _enqueueLeaseRenewal(run: () => Promise<void>): Promise<void> {
    const guardedRun = async () => {
      if (this._state !== 'live' && this._state !== 'closing') return;
      await run();
    };
    const next = this._leaseRenewalChain.then(guardedRun, guardedRun);
    this._leaseRenewalChain = next.catch(() => {});
    return next;
  }

  /**
   * Resolve when the session goes fully idle (`!isBusy()`). If the session
   * is already idle when called, resolves on the next microtask.
   *
   * Rejects with `HarnessValidationError` if `timeoutMs` is provided and
   * elapses before the session becomes idle. Rejects with
   * `HarnessSessionClosingError` if close starts while waiting,
   * `HarnessSessionClosedError` if the session closes first, or
   * `HarnessSessionDeletedError` if hard-delete removes the session first.
   *
   * Useful in tests and TUI flows that want to await a clean boundary
   * before tearing down or asserting final state.
   */
  waitForIdle(opts?: { timeoutMs?: number }): Promise<void> {
    this._assertLive('waitForIdle()');
    if (opts?.timeoutMs !== undefined && (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 0)) {
      throw new HarnessValidationError('waitForIdle().timeoutMs', 'timeoutMs must be a finite non-negative number');
    }
    if (!this.isBusy()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiter: IdleWaiter = {
        check: () => {
          if (!this.isBusy()) {
            cleanup();
            resolve();
            return true;
          }
          return false;
        },
        reject,
        cleanup: () => {},
      };
      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        this._idleWaiters.delete(waiter);
      };
      waiter.cleanup = cleanup;
      this._idleWaiters.add(waiter);
      if (opts?.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          cleanup();
          reject(new HarnessValidationError('waitForIdle()', `session did not become idle within ${opts.timeoutMs}ms`));
        }, opts.timeoutMs);
      }
    });
  }

  /**
   * Re-check every idle/drain waiter whose predicate is now satisfied. Cheap
   * when there are no waiters (common case). Called from every state
   * transition that might tip the session idle or durably parked: `_endTurn`,
   * queue drain shutdown, queued-turn settlement, suspension parking.
   */
  private _notifyMaybeIdle(): void {
    if (this._idleWaiters.size === 0) return;
    const waiters = Array.from(this._idleWaiters);
    for (const w of waiters) w.check();
  }

  /** @internal — close uses this after the durable closing marker commits. */
  _waitForCloseDrain(closeDeadlineAt: number): Promise<void> {
    void this._maybeDrainQueue();
    // A durably parked HITL interaction has no cooperative process-local work
    // left to drain. It also cannot be answered while the session is closing,
    // so waiting for `pendingResume` here can only burn the entire close
    // deadline. Keep the durable record for lifecycle/recovery handling, but
    // use the shutdown-drain predicate for the live-work wait.
    if (!this._isShutdownDrainBusy()) return Promise.resolve();
    const timeoutMs = Math.max(0, closeDeadlineAt - Date.now());

    return new Promise<void>(resolve => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const resolveAfter = (settle?: Promise<void>) => {
        cleanup();
        if (settle) {
          void settle.finally(resolve);
          return;
        }
        resolve();
      };
      const waiter: IdleWaiter = {
        check: () => {
          if (!this._isShutdownDrainBusy()) {
            resolveAfter();
            return true;
          }
          return false;
        },
        reject: () => {
          resolveAfter();
        },
        cleanup: () => {},
      };
      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        this._idleWaiters.delete(waiter);
      };
      waiter.cleanup = cleanup;
      this._idleWaiters.add(waiter);
      if (timeoutMs === 0) {
        this._abortActiveTurn('session_closed');
        resolveAfter(this._failPendingQueueForClose(harnessSessionClosingError(this)));
      } else {
        timer = setTimeout(() => {
          timer = undefined;
          this._abortActiveTurn('session_closed');
          resolveAfter(this._failPendingQueueForClose(harnessSessionClosingError(this)));
        }, timeoutMs);
      }
    });
  }

  /** @internal — shutdown waits for admitted work without turning queued items into close failures. */
  _waitForShutdownDrain(drainDeadlineAt: number): Promise<void> {
    void this._maybeDrainQueue();
    if (!this._isShutdownDrainBusy()) return Promise.resolve();
    const timeoutMs = Math.max(0, drainDeadlineAt - Date.now());

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let waiter!: IdleWaiter;
      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        this._idleWaiters.delete(waiter);
      };
      const resolveAfter = () => {
        cleanup();
        resolve();
      };
      waiter = {
        check: () => {
          if (!this._isShutdownDrainBusy()) {
            resolveAfter();
            return true;
          }
          return false;
        },
        reject: () => {
          resolveAfter();
        },
        cleanup,
      };
      this._idleWaiters.add(waiter);
      if (waiter.check()) return;
      const rejectAfterTimeout = () => {
        this._abortActiveTurn('process_restart');
        cleanup();
        reject(new HarnessValidationError('shutdown()', 'Session did not drain before shutdown deadline'));
      };
      if (timeoutMs === 0) {
        rejectAfterTimeout();
      } else {
        timer = setTimeout(() => {
          timer = undefined;
          rejectAfterTimeout();
        }, timeoutMs);
      }
    });
  }

  /**
   * Cancel the in-flight turn (if any). The agent receives the abort signal and
   * unwinds. No-op when no turn is running.
   *
   * §6.2: the tool-visible `abortSignal.reason` is always a typed
   * `HarnessAbortedError`. Public `abort()` is ordinary agent-layer cancellation
   * → `agent_aborted`. The optional `reason` string is accepted for source
   * compatibility but is NOT a structured reason — the harness owns the typed
   * `HarnessAbortReason`, so a caller cannot mislabel a lifecycle cause.
   */
  abort(_opts?: { reason?: string }): void {
    this._abortActiveTurn('agent_aborted');
  }

  private _captureActiveWorkAdmission(operation: string): number {
    if (this._activeWorkInvalidationsInFlight > 0) {
      void operation;
      throw new HarnessBusyError(this.id, 'in_flight');
    }
    return this._activeWorkAdmissionEpoch;
  }

  private _activeWorkAdmissionIsCurrent(epoch: number): boolean {
    return this._activeWorkInvalidationsInFlight === 0 && this._activeWorkAdmissionEpoch === epoch;
  }

  private _assertActiveWorkAdmission(epoch: number, operation: string, signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new HarnessAbortedError(this.id, 'agent_aborted');
    }
    if (!this._activeWorkAdmissionIsCurrent(epoch)) {
      void operation;
      throw new HarnessBusyError(this.id, 'in_flight');
    }
  }

  /** Begin a synchronous admission barrier; the returned closure is idempotent. */
  private _beginActiveWorkInvalidation(): () => void {
    this._activeWorkAdmissionEpoch += 1;
    this._activeWorkInvalidationsInFlight += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this._activeWorkInvalidationsInFlight = Math.max(0, this._activeWorkInvalidationsInFlight - 1);
    };
  }

  /**
   * Abort the current parent turn AND durably cancel every active/detached
   * subagent owned by its plan. Unlike `cancel()`, this keeps the parent session
   * reusable for a later user message. Product "Stop" controls should prefer
   * this operation so a detached `task_delegate` cannot continue consuming
   * provider tokens after the visible root response stops.
   */
  async abortActiveWork(opts?: {
    reason?: string;
    discardPendingInteraction?: boolean;
    settleTimeoutMs?: number;
  }): Promise<{ cancelledSubagentSessionIds: string[] }> {
    this._assertLive('abortActiveWork()');
    if (opts?.settleTimeoutMs !== undefined && (!Number.isFinite(opts.settleTimeoutMs) || opts.settleTimeoutMs < 0)) {
      throw new HarnessValidationError(
        'abortActiveWork().settleTimeoutMs',
        'settleTimeoutMs must be a finite non-negative number',
      );
    }
    const releaseInvalidation = this._beginActiveWorkInvalidation();
    try {
      const settleDeadlineAt = opts?.settleTimeoutMs === undefined ? undefined : Date.now() + opts.settleTimeoutMs;
      const activeIds = Array.from(this._activeSubagents.values(), state => state.subagentSessionId);
      // Abort the visible/root provider immediately; storage discovery must not
      // add latency to the user's Stop action.
      this._abortActiveTurn('agent_aborted');

      let delegatedIds: string[] = [];
      let discoveryError: unknown;
      try {
        delegatedIds = await this._listDelegatedSubagentSessionIds();
      } catch (error) {
        discoveryError = error;
      }
      const cancellation = await this._cancelOwnedSubagentSessions(
        [...activeIds, ...delegatedIds],
        opts?.reason ?? 'parent_work_aborted',
      );
      if (opts?.discardPendingInteraction !== false) {
        await this._discardPendingInteractionForAbort(opts?.reason ?? 'parent_work_aborted');
      }
      // Catch a resume controller that was admitted immediately before the
      // invalidation epoch changed but became visible after the first abort.
      this._abortActiveTurn('agent_aborted');
      if (discoveryError !== undefined) throw discoveryError;
      if (cancellation.unavailable.length > 0) {
        throw new HarnessValidationError(
          'abortActiveWork()',
          `could not cancel owned subagent sessions: ${cancellation.unavailable.join(', ')}`,
        );
      }
      if (settleDeadlineAt !== undefined) {
        // Destructive conversation revisions need more than an abort request:
        // wait until the provider turn unwinds and every background/session write
        // reaches a durable boundary before callers prune MessageHistory.
        await this.waitForIdle({ timeoutMs: Math.max(0, settleDeadlineAt - Date.now()) });
        await this._internalAwaitFlushChain({ deadlineAt: settleDeadlineAt });
      }
      return { cancelledSubagentSessionIds: cancellation.cancelled };
    } finally {
      releaseInvalidation();
    }
  }

  /**
   * §6.2: abort the in-flight turn's controller with a typed `HarnessAbortedError`
   * so tools observe `abortSignal.reason instanceof HarnessAbortedError`. All
   * harness-internal abort sources (public abort, cancel, close/shutdown drain
   * timeout, eviction, parent propagation) route here. No-op when idle. Abort is
   * idempotent — the first selected reason wins (§6.2 "not replaced").
   */
  private _abortActiveTurn(reason: HarnessAbortReason, opts?: { parentSessionId?: string }): void {
    const controller = this._currentTurnAbortController;
    if (!controller) return;
    controller.abort(new HarnessAbortedError(this.id, reason, opts?.parentSessionId));
  }

  /**
   * §6.2: select the typed `HarnessAbortedError` to stamp on this turn's
   * controller when an external caller `AbortSignal` fires. A signal already
   * carrying THIS session's typed abort is forwarded unchanged (the harness-owned
   * reason "is not replaced by a later source"). A parent run's abort propagating
   * into a live subagent (built-in subagents share the parent tool's abort signal)
   * becomes child-local `parent_aborted`; a caller abort while this session is in
   * the close lifecycle is `session_closed`; any other external/raw caller abort
   * is ordinary `agent_aborted`.
   */
  private _forwardCallerAbortReason(callerSignal: AbortSignal): HarnessAbortedError {
    const callerReason = (callerSignal as { reason?: unknown }).reason;
    if (callerReason instanceof HarnessAbortedError && callerReason.sessionId === this.id) {
      return callerReason;
    }
    if (
      this.parentSessionId !== undefined &&
      callerReason instanceof HarnessAbortedError &&
      callerReason.sessionId === this.parentSessionId &&
      !this.isClosing
    ) {
      return new HarnessAbortedError(this.id, 'parent_aborted', this.parentSessionId);
    }
    if (this.isClosing) {
      return new HarnessAbortedError(this.id, 'session_closed');
    }
    return new HarnessAbortedError(this.id, 'agent_aborted');
  }

  private _currentCancelRequest(): SessionRecord['cancelRequest'] {
    return this._record.cancelRequest;
  }

  /**
   * Durably cancel this session. The first cancel request wins, aborts
   * in-flight work, drops queued items, and emits audit events. A queued item
   * that already started is failed durably here too; its live turn still
   * receives the abort signal and unwinds through the normal turn cleanup path.
   */
  async cancel(opts?: { reason?: string; requestedBy?: string }): Promise<void> {
    // Public entry: never parent-originated. The §6.2 `parent_aborted` source is
    // harness-owned — only the internal subagent cascade may select it (passing
    // the real parent id), so a caller cannot mislabel the abort by supplying a
    // matching `requestedBy`.
    const cascade = await this._cancelInternal(opts, undefined);
    if (cascade.unavailable.length > 0) {
      throw new HarnessValidationError(
        'cancel()',
        `session cancellation committed but descendant propagation is incomplete: ${cascade.unavailable.join(', ')}`,
      );
    }
  }

  /**
   * §SA1 — cancel ONE in-flight subagent of this session by its session id,
   * without cancelling this parent or its siblings. The target must be an active
   * subagent of THIS session (`getDisplayState().activeSubagents` /
   * `subagent_*` events expose the id); a non-child id, an already-settled child,
   * or a child not live in this process is a safe no-op.
   *
   * Cancellation reaches the child via the same harness-owned parent-origin
   * cascade as a full `cancel()` does for all children — so an inline
   * `spawn_subagent` child aborts its turn (the spawn tool's `finally` then closes
   * it), and a detached `task_delegate` child aborts + the delegation driver rolls
   * its plan task up to `failed` (its `cancelRequest` is also honored by
   * reconcile-on-rehydrate). Same-process only: a child owned by another live
   * instance is not reachable here.
   */
  async cancelSubagent(opts: { subagentSessionId: string; reason?: string }): Promise<void> {
    this._assertNotDeleted();
    // Ownership guard: only cancel a subagent THIS session is actively running.
    const isOwnChild = Array.from(this._activeSubagents.values()).some(
      s => s.subagentSessionId === opts.subagentSessionId,
    );
    if (!isOwnChild) return;
    const child = this._harness._internalGetLiveSession(opts.subagentSessionId);
    if (!child) return; // not live in this process — best-effort no-op
    try {
      await child._cancelInternal({ reason: opts.reason ?? 'subagent_cancelled', requestedBy: this.id }, this.id);
    } catch {
      // Best-effort: a late race (child already settling/closed) must not throw.
    }
  }

  /** Read every durable delegation link in this session's plan forest. */
  private async _listDelegatedSubagentSessionIds(): Promise<string[]> {
    const ids = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      const page = await this._storage.listPlanTasks({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        limit: 500,
        cursor,
      });
      for (const task of page.tasks) {
        if (task.delegatedSubagentSessionId !== undefined) ids.add(task.delegatedSubagentSessionId);
      }
      if (!page.cursor || page.tasks.length === 0) break;
      cursor = page.cursor;
    }
    return Array.from(ids);
  }

  /**
   * Cancel child sessions whose ownership was established by the parent's live
   * projection or durable plan link. A cold child is hydrated by exact id after
   * re-checking `parentSessionId`; closed/deleted children are terminal. An
   * already-cancelled child is still hydrated so a crash-interrupted descendant
   * cascade can resume. Descendant cancellation flows through the child's
   * normal durable `cancel()` path.
   */
  private async _cancelOwnedSubagentSessions(
    subagentSessionIds: Iterable<string>,
    reason: string,
  ): Promise<{ cancelled: string[]; unavailable: string[] }> {
    const cancelled: string[] = [];
    const unavailable: string[] = [];
    for (const childId of new Set(subagentSessionIds)) {
      if (childId === this.id) {
        unavailable.push(childId);
        continue;
      }
      let child = this._harness._internalGetLiveSession(childId);
      if (child === undefined) {
        let stored: SessionRecord | null;
        try {
          stored = await this._storage.loadSession({
            harnessName: this._record.harnessName,
            sessionId: childId,
          });
        } catch {
          unavailable.push(childId);
          continue;
        }
        if (stored === null || stored.closedAt !== undefined || stored.closingAt !== undefined) {
          continue;
        }
        if (stored.parentSessionId !== this.id || stored.resourceId !== this.resourceId) {
          unavailable.push(childId);
          continue;
        }
        try {
          child = await this._harness.session({ sessionId: childId, resourceId: this.resourceId });
        } catch {
          unavailable.push(childId);
          continue;
        }
      }
      if (child.parentSessionId !== this.id || child.resourceId !== this.resourceId) {
        unavailable.push(childId);
        continue;
      }
      try {
        const alreadyCancelled = child.getRecord().cancelRequest !== undefined;
        const nested = await child._cancelInternal({ reason, requestedBy: this.id }, this.id);
        if (!alreadyCancelled) cancelled.push(childId);
        unavailable.push(...nested.unavailable);
      } catch {
        unavailable.push(childId);
      }
    }
    return { cancelled: Array.from(new Set(cancelled)), unavailable: Array.from(new Set(unavailable)) };
  }

  private async _cancelInternal(
    opts?: { reason?: string; requestedBy?: string },
    parentOrigin?: string,
  ): Promise<{ unavailable: string[] }> {
    this._assertNotDeleted();
    const existingCancel = this._currentCancelRequest();
    if (existingCancel !== undefined) {
      await this._settlePendingInteractionCancellation(existingCancel.reason ?? opts?.reason);
      return this._cascadeCancellationToOwnedSubagents(existingCancel.reason ?? opts?.reason ?? 'parent_cancelled');
    }

    const reason = opts?.reason;
    const requestedBy = opts?.requestedBy;
    const requestedAt = Date.now();
    const removedItems: { queuedItemId: string; admissionId?: string }[] = [];
    const completedItems: { queuedItemId: string; result: AgentResult }[] = [];
    const completedUnfinalizedItems: { item: QueuedItem; result: FullOutput<unknown>; modeId: string }[] = [];
    const cancelErrorForReceipt = new HarnessSessionCancelledError(this.id, reason);
    let attemptedWrite = false;

    await this._flushUpdate(prev => {
      if (prev.cancelRequest !== undefined) return prev;

      attemptedWrite = true;
      const existingReceipts = prev.queueAdmissionReceipts ?? {};
      const nextReceipts: Record<string, QueueAdmissionReceipt> = { ...existingReceipts };

      for (const item of prev.pendingQueue ?? []) {
        const receipt = existingReceipts[item.id];
        if (receipt?.status === 'completed' && receipt.result !== undefined) {
          if (receipt.postRunFinalizedAt !== undefined) {
            completedItems.push({ queuedItemId: item.id, result: receipt.result as AgentResult });
          } else {
            completedUnfinalizedItems.push({
              item,
              result: receipt.result as FullOutput<unknown>,
              modeId: receipt.modeId ?? item.mode ?? prev.modeId,
            });
          }
          continue;
        }

        removedItems.push({ queuedItemId: item.id, admissionId: item.admissionId });
        if (receipt && receipt.status !== 'completed' && receipt.status !== 'failed' && receipt.status !== 'dead') {
          nextReceipts[item.id] = {
            ...receipt,
            status: 'failed',
            error: projectHarnessPublicError(cancelErrorForReceipt),
            failedAt: receipt.failedAt ?? requestedAt,
            updatedAt: requestedAt,
          };
        }
      }

      const next: SessionRecord = {
        ...prev,
        cancelRequest: {
          requestedAt,
          ...(reason !== undefined ? { reason } : {}),
          ...(requestedBy !== undefined ? { requestedBy } : {}),
        },
        pendingQueue: completedUnfinalizedItems.map(completed => completed.item),
      };
      if (Object.keys(nextReceipts).length > 0) {
        next.queueAdmissionReceipts = nextReceipts;
      }
      return next;
    });

    const committedCancel = this._currentCancelRequest();
    if (committedCancel === undefined) return { unavailable: [] };
    if (!attemptedWrite || committedCancel.requestedAt !== requestedAt) {
      return this._cascadeCancellationToOwnedSubagents(committedCancel.reason ?? reason ?? 'parent_cancelled');
    }
    const durableReason = committedCancel.reason;
    this._clearQueueWakeTimer();

    // §10.2: cancellation/queue-drop are not public HarnessEventV1 events. The
    // observable effect is the rejected operation promises + cleared queue +
    // updated display snapshot below.
    for (const dropped of removedItems) {
      const resolver = this._queueResolvers.get(dropped.queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(dropped.queuedItemId);
        resolver.reject(new HarnessSessionCancelledError(this.id, durableReason));
      }
    }
    for (const completed of completedItems) {
      const resolver = this._queueResolvers.get(completed.queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(completed.queuedItemId);
        resolver.resolve(completed.result);
      }
    }
    if (
      this._currentTurnAbortController === undefined &&
      this._currentQueuedItemId !== undefined &&
      removedItems.some(item => item.queuedItemId === this._currentQueuedItemId)
    ) {
      this._currentQueuedItemId = undefined;
      this._currentQueuedItemSource = undefined;
    }
    // §6.2: the tool-visible abort reason is typed. A cancel cascaded from this
    // session's parent (harness-owned `parentOrigin`, matching this child's
    // parentSessionId) surfaces `parent_aborted` with the parent id; any other
    // cancel is ordinary `agent_aborted`. The durable `cancelRequest.reason` string
    // is preserved separately on the record; the caller-supplied `requestedBy` is an
    // audit field and is NOT the abort-source authority.
    if (parentOrigin !== undefined && parentOrigin === this.parentSessionId) {
      this._abortActiveTurn('parent_aborted', { parentSessionId: this.parentSessionId });
    } else {
      this._abortActiveTurn('agent_aborted');
    }

    for (const completed of completedUnfinalizedItems) {
      await this._settleCompletedQueuedItemAfterCancellation(completed.item, completed.result, completed.modeId);
    }

    await this._settlePendingInteractionCancellation(durableReason);
    this._notifyMaybeIdle();

    return this._cascadeCancellationToOwnedSubagents(reason ?? 'parent_cancelled');
  }

  /**
   * A suspended signal remains in `pendingResume` as immutable audit/recovery
   * evidence after session cancellation, but its durable signal result must be
   * failed immediately. Otherwise `signal()` callers (including detached task
   * delegation drivers) wait until the interaction TTL and retain concurrency
   * reservations for up to ten minutes.
   */
  private async _settlePendingInteractionCancellation(reason?: string): Promise<void> {
    const pending = this._record.pendingResume;
    if (pending === undefined) return;
    const cancellationError = new HarnessSessionCancelledError(this.id, reason);
    const projectedError = projectHarnessPublicError(cancellationError);
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    if (queuedItemId !== undefined) {
      const receipt = this._record.queueAdmissionReceipts?.[queuedItemId];
      if (receipt?.signalId !== undefined) {
        await this._writeQueueSignalResultEvidence({
          status: 'failed',
          signalId: receipt.signalId,
          runId: receipt.runId,
          error: projectedError,
        });
      }
    }
    if (pending.originSignalId !== undefined) {
      await this._settleSignalResult(pending.originSignalId, {
        status: 'failed',
        runId: pending.runId,
        error: projectedError,
      });
    }
  }

  /**
   * Abort/branch-revision counterpart to cancellation settlement. The pending
   * interaction is terminalized and removed without setting a parent
   * `cancelRequest`, so the conversation session remains reusable. Durable
   * signal evidence is failed before the exact-generation clear; a crash in
   * between leaves the pending row visible and safely retryable.
   */
  private async _discardPendingInteractionForAbort(reason: string): Promise<boolean> {
    const pending = this._record.pendingResume;
    if (pending === undefined) return false;
    const abortError = new HarnessSessionCancelledError(this.id, reason);
    const projectedError = projectHarnessPublicError(abortError);
    const failedAt = Date.now();
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    const queueReceipt = queuedItemId === undefined ? undefined : this._record.queueAdmissionReceipts?.[queuedItemId];

    // First win a durable waiting/resuming -> terminalizing transition. Resume
    // admission rejects any generation carrying expiryStartedAt, so evidence is
    // never failed for a response that can still proceed. If the process dies
    // after this claim, the ordinary pending-deadline recovery finishes it.
    let discardClaimed = false;
    await this._flushUpdate(prev => {
      discardClaimed = false;
      const current = prev.pendingResume;
      if (
        current === undefined ||
        current.kind !== pending.kind ||
        current.runId !== pending.runId ||
        current.toolCallId !== pending.toolCallId ||
        (current.itemId ?? current.toolCallId) !== (pending.itemId ?? pending.toolCallId) ||
        current.requestedAt !== pending.requestedAt ||
        current.expiresAt !== pending.expiresAt ||
        current.resumedAt !== pending.resumedAt ||
        current.expiryStartedAt !== undefined
      ) {
        return prev;
      }
      discardClaimed = true;
      return {
        ...prev,
        pendingResume: { ...current, expiryStartedAt: failedAt },
      };
    });
    if (!discardClaimed) return false;

    if (queueReceipt?.signalId !== undefined) {
      await this._writeQueueSignalResultEvidence({
        status: 'failed',
        signalId: queueReceipt.signalId,
        runId: queueReceipt.runId,
        error: projectedError,
      });
    }
    if (pending.originSignalId !== undefined) {
      await this._settleSignalResult(pending.originSignalId, {
        status: 'failed',
        runId: pending.runId,
        error: projectedError,
      });
    }

    let discarded = false;
    await this._flushUpdate(prev => {
      discarded = false;
      const current = prev.pendingResume;
      if (
        current === undefined ||
        current.kind !== pending.kind ||
        current.runId !== pending.runId ||
        current.toolCallId !== pending.toolCallId ||
        (current.itemId ?? current.toolCallId) !== (pending.itemId ?? pending.toolCallId) ||
        current.requestedAt !== pending.requestedAt ||
        current.expiresAt !== pending.expiresAt ||
        current.resumedAt !== pending.resumedAt ||
        current.expiryStartedAt !== failedAt
      ) {
        return prev;
      }
      discarded = true;
      const next: SessionRecord = { ...prev };
      delete next.pendingResume;
      // A response may have durably won admission (`resumedAt` + accepted
      // inbox receipt) immediately before Stop invalidated the branch. Because
      // no provider resume is allowed to start afterward, terminalize every
      // accepted receipt for this exact pending generation instead of leaving a
      // permanent "accepted" receipt that a reconnect could mistake for work
      // still in flight.
      const inboxResponseReceipts = { ...(prev.inboxResponseReceipts ?? {}) };
      let inboxReceiptsChanged = false;
      for (const [responseId, receipt] of Object.entries(inboxResponseReceipts)) {
        if (
          receipt.status === 'accepted' &&
          receipt.kind === pending.kind &&
          receipt.runId === pending.runId &&
          receipt.toolCallId === pending.toolCallId &&
          receipt.pendingRequestedAt === pending.requestedAt
        ) {
          inboxResponseReceipts[responseId] = {
            ...receipt,
            status: 'failed',
            error: projectedError,
            failedAt: receipt.failedAt ?? failedAt,
            updatedAt: failedAt,
            retryable: false,
          };
          inboxReceiptsChanged = true;
        }
      }
      if (inboxReceiptsChanged) next.inboxResponseReceipts = inboxResponseReceipts;
      if (queuedItemId !== undefined) {
        next.pendingQueue = (prev.pendingQueue ?? []).filter(item => item.id !== queuedItemId);
        const receipt = prev.queueAdmissionReceipts?.[queuedItemId];
        if (receipt && receipt.status !== 'completed' && receipt.status !== 'failed' && receipt.status !== 'dead') {
          next.queueAdmissionReceipts = {
            ...(prev.queueAdmissionReceipts ?? {}),
            [queuedItemId]: {
              ...receipt,
              status: 'failed',
              error: projectedError,
              failedAt: receipt.failedAt ?? failedAt,
              updatedAt: failedAt,
            },
          };
        }
      }
      return next;
    });
    if (!discarded) return false;

    this._clearPendingInteractionExpiryTimer();
    this._pendingReplacementToolSurfaces.delete(pending.runId);
    if (queuedItemId !== undefined) {
      const resolver = this._queueResolvers.get(queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(queuedItemId);
        resolver.reject(abortError);
      }
      if (this._currentQueuedItemId === queuedItemId) {
        this._currentQueuedItemId = undefined;
        this._currentQueuedItemSource = undefined;
      }
      this._emit({
        type: 'queue_failed',
        queuedItemId,
        ...(queueReceipt?.runId ? { runId: queueReceipt.runId } : {}),
        ...(queueReceipt?.signalId ? { signalId: queueReceipt.signalId } : {}),
        ...(queueReceipt?.admissionId ? { admissionId: queueReceipt.admissionId } : {}),
        error: projectedError,
      });
    }
    this._emitAbortedToolEnds({ force: true });
    this._emitTurnEvent({
      type: 'resume_failed',
      runId: pending.runId,
      retryable: false,
      error: projectedError,
    });
    if (this._currentTurnAbortController === undefined) {
      this._emitAgentEnd({ runId: pending.runId, finishReason: 'error' });
    }
    this._notifyMaybeIdle();
    return true;
  }

  /**
   * Continue a durable cancellation through every owned delegation edge. This
   * remains callable after `cancelRequest` committed so a restart between the
   * parent CAS and descendant propagation can safely resume the cascade.
   */
  private async _cascadeCancellationToOwnedSubagents(reason: string): Promise<{ unavailable: string[] }> {
    const activeChildIds = Array.from(this._activeSubagents.values(), state => state.subagentSessionId);
    let delegatedChildIds: string[] = [];
    let discoveryFailed = false;
    try {
      // A restarted parent may have no process-local `_activeSubagents` entry
      // even though its plan still durably owns detached descendants. Discover
      // those links before cascading so cancellation reaches the whole cold
      // delegation tree rather than only whichever generation happened to be
      // hydrated first.
      delegatedChildIds = await this._listDelegatedSubagentSessionIds();
    } catch {
      // Mark this session as incomplete: its caller must preserve the ownership
      // edge and retry because we cannot prove that every descendant was found.
      discoveryFailed = true;
    }
    const cancellation = await this._cancelOwnedSubagentSessions([...activeChildIds, ...delegatedChildIds], reason);
    return {
      unavailable: Array.from(new Set([...(discoveryFailed ? [this.id] : []), ...cancellation.unavailable])),
    };
  }

  /**
   * Cancel a single queued turn before it starts. Unknown ids and active queue
   * heads are no-ops; active work is settled by session-level cancel.
   */
  async cancelQueuedItem(opts: { queuedItemId: string; reason?: string }): Promise<void> {
    this._assertNotDeleted();
    const targetId = opts.queuedItemId;
    if (!targetId) {
      throw new HarnessValidationError('cancelQueuedItem().queuedItemId', 'queuedItemId must be a non-empty string');
    }

    const reason = opts.reason;
    const now = Date.now();
    const cancelErrorForReceipt = new HarnessSessionCancelledError(this.id, reason);
    let removed: { queuedItemId: string; admissionId?: string } | undefined;

    await this._flushUpdate(prev => {
      const queue = prev.pendingQueue ?? [];
      const idx = queue.findIndex(item => item.id === targetId);
      const activeResumeId =
        prev.pendingResume !== undefined ? this._queuedItemIdForPendingResume(prev.pendingResume) : undefined;
      if (idx <= 0 || this._currentQueuedItemId === targetId || activeResumeId === targetId) return prev;

      const item = queue[idx]!;
      const receipts = prev.queueAdmissionReceipts ?? {};
      const receipt = receipts[item.id];
      if (
        receipt?.status === 'completed' ||
        receipt?.status === 'failed' ||
        receipt?.status === 'dead' ||
        receipt?.status === 'admission_failed'
      ) {
        return prev;
      }

      removed = { queuedItemId: item.id, admissionId: item.admissionId };
      const next: SessionRecord = {
        ...prev,
        pendingQueue: queue.slice(0, idx).concat(queue.slice(idx + 1)),
      };

      if (receipt) {
        next.queueAdmissionReceipts = {
          ...receipts,
          [item.id]: {
            ...receipt,
            status: 'admission_failed',
            error: projectHarnessPublicError(cancelErrorForReceipt),
            failedAt: receipt.failedAt ?? now,
            updatedAt: now,
          },
        };
      }
      return next;
    });

    if (!removed) return;

    // §10.2: queue-item cancellation is not a public event — the observable
    // effect is the rejected operation promise below + the cleared queue.
    const resolver = this._queueResolvers.get(removed.queuedItemId);
    if (resolver) {
      this._queueResolvers.delete(removed.queuedItemId);
      resolver.reject(new HarnessSessionCancelledError(this.id, reason));
    }
    if ((this._record.pendingQueue?.length ?? 0) > 0) {
      this._scheduleQueueWakeupForPendingQueue();
    } else {
      this._clearQueueWakeTimer();
    }
    this._notifyMaybeIdle();
  }

  /** @internal — emitter epoch (for tests). */
  get _internalEmitterEpoch(): string {
    return this._emitter.epochId;
  }

  // -------------------------------------------------------------------------
  // Identity / inspection — usable in any lifecycle state.
  // -------------------------------------------------------------------------

  /** Last-known `lastActivityAt`. Updated whenever the record is flushed. */
  get lastActivityAt(): number {
    return this._record.lastActivityAt;
  }

  /** Current lifecycle state. */
  get lifecycleState(): SessionLifecycleState {
    return this._state;
  }

  /** True once the session has reached a terminal local state. */
  get isClosed(): boolean {
    return this._state === 'closed' || this._state === 'deleted';
  }

  /** True while close is draining admitted flushes or after the durable closing marker commits. */
  get isClosing(): boolean {
    return this._state === 'closing' || (this._record.closingAt !== undefined && this._record.closedAt === undefined);
  }

  /**
   * True while a pending interaction (tool approval/suspension, question, plan)
   * parks the session, pinning it in memory so pressure/idle eviction skips it
   * (§5.4). The pin lifts when the prompt is answered or the session closes.
   */
  isPinned(): boolean {
    return this._record.pendingResume !== undefined && this._record.cancelRequest === undefined;
  }

  /** Epoch-ms when this session entered closing, if it has. Used to build `HarnessSessionClosingError` (§4.5b). */
  get closingAt(): number | undefined {
    return this._record.closingAt;
  }

  /** Epoch-ms close deadline for this session, if closing. Used to build `HarnessSessionClosingError` (§4.5b). */
  get closeDeadlineAt(): number | undefined {
    return this._record.closeDeadlineAt;
  }

  /** Read-only snapshot of the underlying record. */
  getRecord(): Readonly<SessionRecord> {
    return this._record;
  }

  // -------------------------------------------------------------------------
  // Lifecycle.
  // -------------------------------------------------------------------------

  /**
   * Soft-close: persist `closingAt`, reject new work, drain admitted turns
   * until the close deadline, terminalize descendants, set `closedAt`, release
   * the lease, and drop from the live map. The session remains **reopenable**
   * (§5.3): a later `harness.session({ sessionId })` or `{ threadId, resourceId }`
   * resolve transitions it Closed -> Active. Idempotent: a second call is a
   * no-op once `closed`. The cascade through descendants (§5.5) is driven by
   * the Harness, not by this method directly.
   */
  async close(): Promise<void> {
    if (this._state === 'closed') return;
    await this._harness._closeSession(this);
  }

  /**
   * Session-first delete (§4.1): removes this session and the durable
   * conversation/artifacts it owns, subject to ownership and safety guards.
   * This is the normal product destructive path; it delegates to the Harness
   * so the descendant cascade (§5.5) is enforced in one place. This is the
   * guarded delete: it fails with `HarnessSessionDeleteBlockedError` if the
   * session still has non-terminal dependents. The operator force-delete path
   * is intentionally NOT exposed here (§4.1) — operators call
   * `harness.deleteSession({ force: true })` directly.
   */
  async delete(): Promise<void> {
    await this._harness.deleteSession({ sessionId: this.id, resourceId: this.resourceId });
  }

  /**
   * Session-first rename (§4.1 / §13.3c): update the title of this session's
   * backing thread, authorized through the live session (it holds the write
   * lease). Asserts the session is live first so a closed/closing/deleted
   * session is rejected rather than mutating the thread out from under the
   * session lifecycle; reopen first to rename a closed conversation.
   */
  async rename(opts: { title: string }): Promise<void> {
    this._assertLive('rename()');
    await this._harness._threadOps.rename({ resourceId: this.resourceId, threadId: this.threadId, title: opts.title });
  }

  /**
   * Session-first clone (§4.2 / §2.2): copy this conversation into a new usable
   * session. Copies committed message history and, when `copyAppMetadata` is
   * requested, app-owned thread metadata only. Per §5.2a it copies NO
   * `SessionRecord` (no mode/model/grants/state/pending/run/goal/workspace/
   * channel rows) and never copies the lease, live process handles, active
   * streams, or in-flight tool execution ownership. The new session owns its
   * cloned thread and starts fresh from harness defaults.
   */
  async clone(opts?: { title?: string; copyAppMetadata?: boolean }): Promise<Session> {
    return this._harness._cloneSession(this, opts);
  }

  // -------------------------------------------------------------------------
  // Workspace — §2.7 / §4.2.
  // -------------------------------------------------------------------------

  /**
   * Resolve this session's workspace. Returns `undefined` when the harness
   * has no workspace configured. Caches the result for the lifetime of the
   * Session (the workspace is released on `close()` per the ownership model).
   *
   * Throws {@link HarnessWorkspaceLostError} when the session's
   * `per-session` workspace was provisioned by a non-resumable provider
   * and a process restart has dropped the underlying state. Callers can
   * decide whether to surface the error or call `clearWorkspaceLost()` and
   * try again with a fresh workspace.
   */
  async getWorkspace(): Promise<Workspace | undefined> {
    this._assertLive('getWorkspace()');
    return this._getWorkspaceUnchecked();
  }

  // ---------------------------------------------------------------------------
  // §4.2 / §6.1 workspace access primitives. These mirror the tool-facing
  // `HarnessRequestContext` accessors. The split lets a turn avoid cloud-sandbox
  // cold starts: `hasWorkspace()`/`isWorkspaceReady()`/`peekWorkspace()` are
  // sync, NON-materializing reads; `resolveWorkspace()` is the explicit async
  // materialize/resume path. NOTE: the legacy `getWorkspace()` above is async +
  // materializing (kept for its established callers/tests); `resolveWorkspace()`
  // is its spec-named alias. (Migrating `getWorkspace()` itself to a sync read is
  // a separate, larger §4.2 reconciliation — ~25 call sites — left as follow-up.)
  // ---------------------------------------------------------------------------

  /** §6.1: is a workspace CONFIGURED for this harness (regardless of whether it
   * has been materialized)? Sync, non-materializing. */
  hasWorkspace(): boolean {
    return this._harness._workspaceKind !== undefined;
  }

  /** §6.1: is a usable workspace handle already materialized (warm/cached)? Sync,
   * non-materializing — `false` does not mean "no workspace", only "not yet
   * resolved" (or lost). A workspace marked lost is NOT ready even if a stale
   * handle lingers. */
  isWorkspaceReady(): boolean {
    return this._workspace !== undefined && !this._workspaceLost;
  }

  /** §6.1: the already-materialized workspace handle, or `undefined` if it has not
   * been resolved yet (or was lost). Sync and NON-materializing — never triggers a
   * cold start and never throws; `resolveWorkspace()` surfaces a lost workspace. */
  peekWorkspace(): Workspace | undefined {
    return this._workspaceLost ? undefined : this._workspace;
  }

  /** §6.1: explicitly materialize/resume the workspace (a cloud sandbox cold start
   * may happen here). Throws `HarnessWorkspaceLostError` if the workspace was lost
   * across restart, or a validation error if no workspace is configured. */
  async resolveWorkspace(): Promise<Workspace> {
    const workspace = await this.getWorkspace();
    if (workspace === undefined) {
      throw new HarnessValidationError(
        'resolveWorkspace()',
        'no workspace is configured for this harness (set `workspace.kind` in HarnessConfig)',
      );
    }
    return workspace;
  }

  private async _getWorkspaceUnchecked(): Promise<Workspace | undefined> {
    if (this._workspace) return this._workspace;
    if (this._workspaceResolving) return this._workspaceResolving;

    const kind = this._harness._workspaceKind;
    if (!kind) return undefined;

    if (this._workspaceLost) {
      throw new HarnessWorkspaceLostError(this.id, {
        reason: 'restart',
        providerId: this._harness._workspaceRegistry.providerId,
      });
    }

    const resolve = async (): Promise<Workspace> => {
      if (kind === 'shared') {
        return this._harness._workspaceRegistry.acquireShared();
      }
      if (kind === 'per-resource') {
        return this._harness._workspaceRegistry.acquirePerResource({ resourceId: this.resourceId });
      }
      // kind === 'per-session'
      // Subagent sessions with `workspace: 'inherit'` reuse the parent's entry.
      // The spawn tool flips `_subagentFreshWorkspace` for the `fresh` case so
      // we don't accidentally inherit when a fresh workspace is requested.
      if (this.parentSessionId && this._subagentInheritWorkspace) {
        // §6.2 strict-lazy: a lazy parent turn may not have materialized its
        // workspace yet, but inheriting requires the parent's entry to exist.
        // Resolve the (live) parent's workspace first (idempotent).
        await this._harness._internalEnsureParentWorkspaceForInherit(this.parentSessionId);
        return this._harness._workspaceRegistry.inheritPerSession({
          parentSessionId: this.parentSessionId,
          childSessionId: this.id,
          resourceId: this.resourceId,
        });
      }
      const storedProviderId = this._record.workspace?.providerId;
      const storedState = this._record.workspace?.state;
      return this._harness._workspaceRegistry.acquirePerSession({
        resourceId: this.resourceId,
        sessionId: this.id,
        ...(this.parentSessionId ? { parentSessionId: this.parentSessionId } : {}),
        ...(storedProviderId ? { storedProviderId } : {}),
        ...(storedState !== undefined ? { storedState } : {}),
        onStateUpdate: async state => {
          await this._persistWorkspaceState(state);
        },
      });
    };

    this._workspaceResolving = resolve();
    try {
      this._workspace = await this._workspaceResolving;
      return this._workspace;
    } finally {
      this._workspaceResolving = undefined;
    }
  }

  /**
   * @internal — used by the harness during hydration when the stored record
   * carries workspace state but the configured provider is non-resumable.
   */
  _markWorkspaceLost(): void {
    this._workspaceLost = true;
  }

  /**
   * @internal — set by the spawn-subagent tool flow to indicate the child
   * session should inherit its parent's workspace rather than provisioning
   * a fresh one. `undefined` for top-level sessions; defaults to `true` for
   * subagent sessions unless the spawn definition opts into `'fresh'`.
   */
  _subagentInheritWorkspace?: boolean;

  /**
   * @internal — `SubagentDefinition.tools` for a spawned subagent session, set at
   * spawn/delegate time. Layered onto the subagent's tool surface in
   * `_buildToolSurface` (§9). Undefined for non-subagent sessions.
   */
  _subagentToolsOverride?: ToolsInput;

  /**
   * @internal — `SubagentDefinition.toolAllowlist` for a spawned/delegated subagent
   * session (M4): the hard name-scope this subagent may call. Composed into the
   * §4.2e permission resolver so a non-listed tool is denied (removed pre-exposure).
   * Undefined ⇒ no allowlist scope. Set at spawn/delegate; restored on a delegated
   * child's reattach from `delegatedSubagentTypeId`.
   */
  _subagentToolAllowlist?: readonly string[];

  /**
   * @internal — parent-side invocation correlation for a spawned/delegated
   * child. Set before the child's turn starts (and restored by delegated
   * reattachment) so a pending interaction is durably attributed to the parent
   * tool/delegation that owns it. It is intentionally process-local: once a
   * pending interaction is captured, the correlation lives on `PendingResume`.
   */
  _subagentParentToolCallId?: string;

  /** @internal — writes the latest opaque workspace state into the session record. */
  private async _persistWorkspaceState(state: unknown): Promise<void> {
    const providerId = this._harness._workspaceRegistry.providerId;
    if (!providerId) return;
    await this._flushUpdate(record => ({
      ...record,
      workspace: { providerId, state },
    }));
  }

  // -------------------------------------------------------------------------
  // Skills — §4.6.
  //
  // Code-registered skills are merged ahead of workspace-discovered skills.
  // Workspace-discovered entries are projected from the configured
  // `WorkspaceSkills` source into `HarnessSkill` descriptors. Discovery runs
  // asynchronously on the first `list` / `get` / `use` call per in-memory
  // Session instance and the merged result is cached for the session's
  // lifetime. Concurrent calls during a generation share a single-flight
  // promise. `refresh()` drops the cache so the next call re-runs discovery.
  //
  // `use(ref, opts?)` resolves a code-registered or workspace skill by name
  // or relative path, validates declared args, appends a JSON code block
  // carrying the validated args to the skill body, and delegates to the
  // signal-driven message path. The returned `AgentResult` is the underlying
  // turn's result.
  // -------------------------------------------------------------------------

  /**
   * Skill discovery, inspection, and programmatic execution — see §4.6
   * and §4.2c.
   *
   * Code-registered skills are merged ahead of workspace-discovered skills.
   * Workspace-discovered skills are projected into `HarnessSkill`
   * descriptors. Discovery runs asynchronously on the first `list` /
   * `get` / `use` call per in-memory Session instance and is cached for
   * the session's lifetime. Concurrent callers share a single-flight
   * promise. `refresh()` drops the cache so the next call re-runs
   * discovery.
   */
  readonly skills = Object.freeze({
    /**
     * List skills available to this session.
     *
     * Returns code-registered skills plus workspace-discovered skills.
     * If the session has no workspace configured, only code-registered
     * skills are returned.
     */
    list: (): Promise<HarnessSkill[]> => this._skillsList(),
    /**
     * Look up a skill by name. Returns `undefined` when the name does not
     * resolve in the code or workspace catalogues.
     */
    get: (name: string): Promise<HarnessSkill | undefined> => this._skillsGet(name),
    /**
     * Drop the cached workspace-discovery result. The next `list` / `get`
     * / `use` call re-runs discovery through the configured workspace
     * skill source. Local-only — absent from `RemoteSession` (§13.5).
     */
    refresh: (): Promise<void> => this._skillsRefresh(),
    /**
     * Resolve a code-registered skill by name, or a workspace skill by name
     * or relative path, optionally validate provided arguments against the
     * skill's declared args schema, append a JSON code block of the validated
     * args to the skill instructions, and dispatch the result
     * through the signal-driven message path as a single turn. Resolves
     * to the underlying turn's `AgentResult`.
     *
     * Throws {@link HarnessSkillNotFoundError} when `ref` does not match
     * any skill, and {@link HarnessSkillArgsValidationError} when declared
     * args are invalid.
     */
    use: (ref: string, opts?: UseSkillOptions): Promise<AgentResult> => this._skillsUse(ref, opts),
  });

  // -------------------------------------------------------------------------
  // MCP catalog — PF-562 / PF-552 desktop integration inventory.
  //
  // This is an inventory snapshot over MCP servers registered on the Harness
  // Mastra instance. Tool descriptors use MCPServerBase.getToolListInfo() so
  // lazy MCP client proxies can populate remote tool catalogs on demand.
  // Execution permission remains enforced by the MCP tool runtime; this
  // catalog only lets desktop hosts render integrations.
  // -------------------------------------------------------------------------

  readonly mcp = Object.freeze({
    /** List MCP servers registered on the Harness Mastra instance. */
    listServers: (): HarnessMcpServerDescriptor[] => this._mcpListServers(),
    /** Look up one MCP server by Mastra registration key. */
    getServer: (key: string): HarnessMcpServerDescriptor | undefined => this._mcpGetServer(key),
    /** List MCP tool descriptors for one registered server key. */
    listTools: (key: string): Promise<HarnessMcpToolDescriptor[] | undefined> => {
      this._assertLive('mcp.listTools()');
      this._assertMcpServerKey('mcp.listTools()', key);
      return this._mcpListTools(key);
    },
  });

  // -------------------------------------------------------------------------
  // Action catalog — PF-576 / PF-552 desktop palette inventory.
  //
  // This is a read-only aggregate over skill action metadata and MCP tool
  // descriptors. It intentionally exposes no execution or lifecycle controls;
  // callers use the source surfaces referenced by each entry.
  // -------------------------------------------------------------------------

  readonly actions = Object.freeze({
    /** List/search local desktop action catalog entries. */
    list: (options?: HarnessActionCatalogListOptions): Promise<HarnessActionCatalogEntry[]> =>
      this._actionsList(options),
    /** Convenience wrapper for `list({ query, ...options })`. */
    search: (
      query: string,
      options?: Omit<HarnessActionCatalogListOptions, 'query'>,
    ): Promise<HarnessActionCatalogEntry[]> => this._actionsSearch(query, options),
    /** Refresh already-materialized workspace skills and clear cached action catalog discovery. */
    refresh: (): Promise<void> => this._actionsRefresh(),
  });

  private _mcpListServers(): HarnessMcpServerDescriptor[] {
    this._assertLive('mcp.listServers()');
    return this._harness._listMcpServers().map(([key, server]) => this._projectMcpServer(key, server));
  }

  private _mcpGetServer(key: string): HarnessMcpServerDescriptor | undefined {
    this._assertLive('mcp.getServer()');
    this._assertMcpServerKey('mcp.getServer()', key);
    const server = this._harness._getMcpServer(key);
    return server ? this._projectMcpServer(key, server) : undefined;
  }

  private async _mcpListTools(
    key: string,
    abortSignal: AbortSignal = new AbortController().signal,
    opts: { resolveWorkspace?: boolean } = {},
  ): Promise<HarnessMcpToolDescriptor[] | undefined> {
    const server = this._harness._getMcpServer(key);
    if (!server) return undefined;
    const requestContext = await this._buildRequestContext({
      modeId: this._record.modeId,
      modelId: this._record.modelId,
      abortSignal,
      resolveWorkspace: opts.resolveWorkspace,
    });
    const toolList = await server.getToolListInfo(requestContext);
    const convertedTools = server.tools();
    return toolList.tools.map(toolInfo => {
      const infoWithId = toolInfo as typeof toolInfo & { id?: unknown };
      const toolName = typeof infoWithId.id === 'string' && infoWithId.id.length > 0 ? infoWithId.id : toolInfo.name;
      const convertedTool = convertedTools[toolName];
      const inputSchema = cloneMcpSchemaLike(toolInfo.inputSchema ?? convertedTool?.parameters);
      const outputSchema = cloneMcpSchemaLike(toolInfo.outputSchema ?? convertedTool?.outputSchema);
      const meta = cloneMcpCatalogRecord(toolInfo._meta ?? convertedTool?.mcp?._meta);
      const toolType = toolInfo.toolType ?? convertedTool?.mcp?.toolType;
      return {
        serverKey: key,
        name: toolName,
        ...(toolInfo.description ? { description: toolInfo.description } : {}),
        ...(inputSchema !== undefined ? { inputSchema } : {}),
        ...(outputSchema !== undefined ? { outputSchema } : {}),
        ...(toolType ? { toolType } : {}),
        ...(meta ? { meta } : {}),
        ...(convertedTool?.strict !== undefined ? { strict: convertedTool.strict } : {}),
      };
    });
  }

  private _assertMcpServerKey(method: string, key: unknown): asserts key is string {
    if (typeof key !== 'string' || key.length === 0) {
      throw new HarnessValidationError(method, 'key must be a non-empty string');
    }
    if (RESERVED_MCP_SERVER_KEYS.has(key)) {
      throw new HarnessValidationError(method, 'key must not be a reserved object property name');
    }
  }

  private _projectMcpServer(
    key: string,
    server: NonNullable<ReturnType<Harness['_getMcpServer']>>,
  ): HarnessMcpServerDescriptor {
    const repository = cloneMcpCatalogRecord(server.repository);
    const packages = cloneMcpCatalogRecordArray(server.packages);
    const remotes = cloneMcpCatalogRecordArray(server.remotes);
    return {
      key,
      id: server.id,
      name: server.name,
      version: server.version,
      ...(server.description ? { description: server.description } : {}),
      ...(server.instructions ? { instructions: server.instructions } : {}),
      releaseDate: server.releaseDate,
      isLatest: server.isLatest,
      ...(repository ? { repository } : {}),
      ...(server.packageCanonical ? { packageCanonical: server.packageCanonical } : {}),
      ...(packages ? { packages } : {}),
      ...(remotes ? { remotes } : {}),
    };
  }

  private async _actionsSearch(
    query: string,
    options?: Omit<HarnessActionCatalogListOptions, 'query'>,
  ): Promise<HarnessActionCatalogEntry[]> {
    this._assertLive('actions.search()');
    if (typeof query !== 'string') {
      throw new HarnessValidationError('actions.search()', 'query must be a string');
    }
    if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
      throw new HarnessValidationError('actions.search()', 'options must be an object');
    }
    return this._actionsList({ ...options, query });
  }

  private async _actionsList(options?: HarnessActionCatalogListOptions): Promise<HarnessActionCatalogEntry[]> {
    this._assertLive('actions.list()');
    const normalized = this._normalizeActionCatalogOptions(options);
    if (normalized.limit === 0) return [];
    const entries = await this._buildActionCatalogEntries(normalized.source);
    const filtered = entries.filter(entry => this._matchesActionCatalogOptions(entry, normalized));
    return filtered
      .sort((a, b) => {
        const sourceOrder = ACTION_CATALOG_SOURCE_ORDER[a.source.kind] - ACTION_CATALOG_SOURCE_ORDER[b.source.kind];
        return sourceOrder === 0 ? compareActionCatalogIds(a.id, b.id) : sourceOrder;
      })
      .slice(normalized.offset, normalized.offset + normalized.limit)
      .map(entry => cloneActionCatalogEntry(entry));
  }

  private async _actionsRefresh(): Promise<void> {
    this._assertLive('actions.refresh()');
    this._clearSkillAndActionCatalogCaches();
    try {
      await this._workspace?.skills?.refresh();
    } finally {
      this._clearSkillAndActionCatalogCaches();
    }
  }

  private _clearSkillAndActionCatalogCaches(): void {
    this._skillsCache = undefined;
    this._skillsResolving = undefined;
    this._actionsSkillEntriesCache = undefined;
    this._actionsSkillEntriesResolving = undefined;
    this._actionsMcpEntriesCacheByServer.clear();
    this._actionsMcpEntriesResolvingByServer.clear();
    this._actionsMcpTimedOutWorkByServer.clear();
    this._actionsMcpCatalogGeneration++;
  }

  private _normalizeActionCatalogOptions(options?: HarnessActionCatalogListOptions): {
    query: string;
    source?: HarnessActionCatalogSourceKind;
    limit: number;
    offset: number;
  } {
    if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
      throw new HarnessValidationError('actions.list()', 'options must be an object');
    }
    const query = options?.query ?? '';
    if (typeof query !== 'string') {
      throw new HarnessValidationError('actions.list()', 'query must be a string');
    }
    const source = options?.source;
    if (source !== undefined && !ACTION_CATALOG_SOURCE_KINDS.includes(source)) {
      throw new HarnessValidationError(
        'actions.list()',
        `source must be one of ${ACTION_CATALOG_SOURCE_KINDS.join(' | ')}`,
      );
    }
    const limit = options?.limit ?? ACTION_CATALOG_DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 0 || limit > ACTION_CATALOG_MAX_LIMIT) {
      throw new HarnessValidationError(
        'actions.list()',
        `limit must be an integer between 0 and ${ACTION_CATALOG_MAX_LIMIT}`,
      );
    }
    const offset = options?.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0) {
      throw new HarnessValidationError('actions.list()', 'offset must be a non-negative integer');
    }
    return { query: query.trim().toLowerCase(), source, limit, offset };
  }

  private _matchesActionCatalogOptions(
    entry: HarnessActionCatalogEntry,
    options: { query: string; source?: HarnessActionCatalogSourceKind; limit: number; offset: number },
  ): boolean {
    if (options.source !== undefined && entry.source.kind !== options.source) return false;
    if (options.query.length === 0) return true;
    const haystack = this._actionCatalogSearchText(entry).toLowerCase();
    return haystack.includes(options.query);
  }

  private _actionCatalogSearchText(entry: HarnessActionCatalogEntry): string {
    const parts = [entry.id, entry.label, entry.description, entry.category, entry.status, entry.statusReason];
    if (entry.source.kind === 'skill') {
      parts.push(entry.source.skillName, entry.source.filePath);
    } else if (entry.source.kind === 'mcp-server') {
      parts.push(entry.source.serverKey, entry.mcp?.serverName);
    } else {
      parts.push(entry.source.serverKey, entry.source.toolName, entry.mcp?.serverName);
    }
    if (entry.shortcuts) {
      for (const shortcut of entry.shortcuts) {
        parts.push(shortcut.id, shortcut.label, ...(shortcut.keys ?? []));
      }
    }
    return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join('\n');
  }

  private async _buildActionCatalogEntries(
    source?: HarnessActionCatalogSourceKind,
  ): Promise<HarnessActionCatalogEntry[]> {
    const skillEntries =
      source === 'mcp-tool' || source === 'mcp-server' ? [] : await this._resolveSkillActionCatalogEntries();
    const mcpEntries: HarnessActionCatalogEntry[] = [];
    if (source !== 'skill') {
      mcpEntries.push(...(await this._resolveMcpActionCatalogEntries()));
    }
    return [...skillEntries, ...mcpEntries];
  }

  private async _resolveSkillActionCatalogEntries(): Promise<HarnessActionCatalogEntry[]> {
    if (this._actionsSkillEntriesCache) return this._actionsSkillEntriesCache;
    if (this._actionsSkillEntriesResolving) return this._actionsSkillEntriesResolving;

    const build = async (): Promise<HarnessActionCatalogEntry[]> => {
      const codeSkills = this._harness._listCodeSkills();
      const entries: ActionCatalogSkillDescriptor[] = [...codeSkills];
      let workspace: Workspace | undefined;
      try {
        workspace = await this.getWorkspace();
      } catch (error) {
        if (!(error instanceof HarnessWorkspaceLostError)) {
          throw error;
        }
      }
      const workspaceSkills = workspace?.skills;
      if (workspaceSkills) {
        const workspaceEntries = await workspaceSkills.list();
        const codeActionNames = new Set(
          codeSkills.filter(skill => this._projectSkillActionCatalogEntry(skill).length > 0).map(skill => skill.name),
        );
        for (const meta of workspaceEntries) {
          if (codeActionNames.has(meta.name) && !meta.path) continue;
          entries.push({
            name: meta.name,
            description: meta.description,
            ...(meta.path ? { filePath: meta.path } : {}),
            ...(meta.metadata ? { metadata: meta.metadata } : {}),
          });
        }
      }
      return entries.flatMap(skill => this._projectSkillActionCatalogEntry(skill));
    };

    const pending = build();
    this._actionsSkillEntriesResolving = pending;
    try {
      const result = await pending;
      if (this._actionsSkillEntriesResolving === pending) {
        this._actionsSkillEntriesCache = result;
      }
      return result;
    } finally {
      if (this._actionsSkillEntriesResolving === pending) {
        this._actionsSkillEntriesResolving = undefined;
      }
    }
  }

  private _projectSkillActionCatalogEntry(skill: ActionCatalogSkillDescriptor): HarnessActionCatalogEntry[] {
    const action = skill.action ?? cloneActionMetadataLike(skill.metadata?.action);
    if (!action) return [];
    const idSource = skill.filePath ?? skill.name;
    return [
      {
        id: `skill:${encodeActionCatalogIdPart(idSource)}`,
        source: {
          kind: 'skill',
          ref: skill.filePath ?? skill.name,
          skillName: skill.name,
          ...(skill.filePath ? { filePath: skill.filePath } : {}),
        },
        status: 'available',
        label: action.displayName ?? skill.name,
        description: skill.description,
        ...(skill.category ? { category: skill.category } : {}),
        ...(action.icon ? { icon: action.icon } : {}),
        ...(action.shortcuts
          ? { shortcuts: cloneMcpCatalogValue(action.shortcuts) as HarnessActionCatalogEntry['shortcuts'] }
          : {}),
        ...(action.inputSchema ? { inputSchema: cloneMcpCatalogValue(action.inputSchema) } : {}),
        ...(action.outputSchema ? { outputSchema: cloneMcpCatalogValue(action.outputSchema) } : {}),
        ...(action.artifactTypes ? { artifactTypes: [...action.artifactTypes] } : {}),
        ...(action.permissions
          ? { permissions: cloneMcpCatalogValue(action.permissions) as HarnessActionCatalogEntry['permissions'] }
          : {}),
      },
    ];
  }

  private _projectMcpToolActionCatalogEntry(
    server: HarnessMcpServerDescriptor,
    tool: HarnessMcpToolDescriptor,
  ): HarnessActionCatalogEntry {
    return {
      id: `mcp-tool:${encodeActionCatalogIdPart(server.key)}:${encodeActionCatalogIdPart(tool.name)}`,
      source: { kind: 'mcp-tool', serverKey: server.key, toolName: tool.name },
      status: 'available',
      label: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      ...(tool.inputSchema !== undefined ? { inputSchema: cloneMcpCatalogValue(tool.inputSchema) } : {}),
      ...(tool.outputSchema !== undefined ? { outputSchema: cloneMcpCatalogValue(tool.outputSchema) } : {}),
      permissions: { mcpScopes: [server.key] },
      mcp: {
        serverName: server.name,
        serverVersion: server.version,
        ...(tool.toolType ? { toolType: tool.toolType } : {}),
        ...(tool.strict !== undefined ? { strict: tool.strict } : {}),
        ...(tool.meta ? { meta: cloneMcpCatalogValue(tool.meta) as Record<string, unknown> } : {}),
      },
    };
  }

  private _projectUnavailableMcpActionCatalogEntry(
    server: HarnessMcpServerDescriptor,
    reason: HarnessActionCatalogUnavailableReason,
  ): HarnessActionCatalogEntry {
    const statusMessage =
      reason === 'mcp_tool_catalog_timeout'
        ? 'MCP tool catalog timed out'
        : reason === 'mcp_tool_catalog_retry_suppressed'
          ? 'MCP tool catalog retry delayed'
          : 'MCP tool catalog unavailable';
    return {
      id: `mcp-server:${encodeActionCatalogIdPart(server.key)}`,
      source: { kind: 'mcp-server', serverKey: server.key },
      status: 'unavailable',
      statusReason: reason,
      statusMessage,
      label: server.name,
      ...(server.description ? { description: server.description } : {}),
      permissions: { mcpScopes: [server.key] },
      mcp: {
        serverName: server.name,
        serverVersion: server.version,
      },
    };
  }

  private _actionMcpCatalogCacheKey(server: HarnessMcpServerDescriptor, workspaceId: string): string {
    // canonicalJson is NUL-/sentinel-safe: every byte (incl. the historical '\0'
    // separator) is JSON-escaped, so distinct (serverKey, modeId, modelId,
    // workspaceId) tuples — any of which can carry arbitrary strings — never
    // collide the way a single-char `join` could.
    return canonicalJson([server.key, this._record.modeId, this._record.modelId ?? null, workspaceId]);
  }

  private _currentMcpActionCatalogWorkspaceId(): string {
    // MCP catalog reads pass `resolveWorkspace: false`; key only by a workspace
    // that was already materialized so catalog reads never provision one.
    return this._workspace?.id ?? '';
  }

  private _getCachedMcpActionCatalogEntries(cacheKey: string): HarnessActionCatalogEntry[] | undefined {
    const cached = this._actionsMcpEntriesCacheByServer.get(cacheKey);
    if (!cached) return undefined;
    if (cached.expiresAt === undefined || cached.expiresAt > Date.now()) {
      return cached.entries;
    }
    this._actionsMcpEntriesCacheByServer.delete(cacheKey);
    return undefined;
  }

  private async _resolveMcpActionCatalogEntries(): Promise<HarnessActionCatalogEntry[]> {
    const results = await Promise.all(
      this._mcpListServers().map(server => this._resolveMcpActionCatalogEntriesForServer(server)),
    );
    return results.flat();
  }

  private _startMcpActionCatalogEntriesForServer(
    server: HarnessMcpServerDescriptor,
    cacheKey: string,
    retryCount = 0,
  ): Promise<HarnessActionCatalogEntry[]> {
    const catalogGeneration = this._actionsMcpCatalogGeneration;
    let pending: Promise<HarnessActionCatalogEntry[]>;
    const started = startActionCatalogMcpListWithTimeout(
      async abortSignal => {
        const tools = await this._mcpListTools(server.key, abortSignal, { resolveWorkspace: false });
        return (tools ?? []).map(tool => this._projectMcpToolActionCatalogEntry(server, tool));
      },
      work => {
        if (this._actionsMcpEntriesResolvingByServer.get(cacheKey) === pending) {
          this._actionsMcpTimedOutWorkByServer.set(cacheKey, {
            work,
            retryAfter: Date.now() + ACTION_CATALOG_MCP_FAILURE_CACHE_MS,
            retryCount,
          });
        }
      },
    );
    pending = started.pending;
    const { work, didTimeout } = started;
    pending.catch(() => {
      // `pending` is observed below for cache/single-flight cleanup; attach
      // this noop handler immediately so timeout rejection is never unhandled.
    });
    this._actionsMcpEntriesResolvingByServer.set(cacheKey, pending);

    pending
      .then(entries => {
        if (this._actionsMcpEntriesResolvingByServer.get(cacheKey) === pending) {
          this._actionsMcpEntriesCacheByServer.set(cacheKey, {
            entries,
            expiresAt: Date.now() + ACTION_CATALOG_MCP_SUCCESS_CACHE_MS,
            successful: true,
          });
          this._actionsMcpEntriesResolvingByServer.delete(cacheKey);
        }
      })
      .catch(error => {
        if (this._actionsMcpEntriesResolvingByServer.get(cacheKey) !== pending) return;
        const timeoutWorkStillTracked = this._actionsMcpTimedOutWorkByServer.get(cacheKey)?.work === work;
        const didCatalogTimeout =
          error instanceof ActionCatalogMcpListTimeoutError || (didTimeout() && timeoutWorkStillTracked);
        const existingCache = this._actionsMcpEntriesCacheByServer.get(cacheKey);
        const hasSuccessfulTimedOutResult = existingCache?.successful === true;
        if ((!didCatalogTimeout || timeoutWorkStillTracked) && !hasSuccessfulTimedOutResult) {
          const reason: HarnessActionCatalogUnavailableReason = didCatalogTimeout
            ? 'mcp_tool_catalog_timeout'
            : 'mcp_tool_catalog_failed';
          this._actionsMcpEntriesCacheByServer.set(cacheKey, {
            entries: [this._projectUnavailableMcpActionCatalogEntry(server, reason)],
            expiresAt: Date.now() + ACTION_CATALOG_MCP_FAILURE_CACHE_MS,
          });
        }
        this._actionsMcpEntriesResolvingByServer.delete(cacheKey);
      });

    work
      .then(entries => {
        if (didTimeout() && this._actionsMcpCatalogGeneration === catalogGeneration) {
          this._actionsMcpEntriesCacheByServer.set(cacheKey, {
            entries,
            expiresAt: Date.now() + ACTION_CATALOG_MCP_SUCCESS_CACHE_MS,
            successful: true,
          });
        }
      })
      .catch(() => {
        if (didTimeout() && this._actionsMcpTimedOutWorkByServer.get(cacheKey)?.work === work) {
          this._actionsMcpEntriesCacheByServer.set(cacheKey, {
            entries: [this._projectUnavailableMcpActionCatalogEntry(server, 'mcp_tool_catalog_timeout')],
            expiresAt: Date.now() + ACTION_CATALOG_MCP_FAILURE_CACHE_MS,
          });
        }
      })
      .finally(() => {
        if (didTimeout() && this._actionsMcpTimedOutWorkByServer.get(cacheKey)?.work === work) {
          this._actionsMcpTimedOutWorkByServer.delete(cacheKey);
        }
      });

    return pending;
  }

  private async _resolveMcpActionCatalogEntriesForServer(
    server: HarnessMcpServerDescriptor,
  ): Promise<HarnessActionCatalogEntry[]> {
    const cacheKey = this._actionMcpCatalogCacheKey(server, this._currentMcpActionCatalogWorkspaceId());
    const cached = this._getCachedMcpActionCatalogEntries(cacheKey);
    if (cached) return cached;

    const timedOutWork = this._actionsMcpTimedOutWorkByServer.get(cacheKey);
    if (
      timedOutWork &&
      (timedOutWork.retryAfter > Date.now() || timedOutWork.retryCount >= ACTION_CATALOG_MCP_MAX_TIMEOUT_RETRIES)
    ) {
      const entries = [this._projectUnavailableMcpActionCatalogEntry(server, 'mcp_tool_catalog_retry_suppressed')];
      this._actionsMcpEntriesCacheByServer.set(cacheKey, {
        entries,
        expiresAt:
          timedOutWork.retryAfter > Date.now()
            ? timedOutWork.retryAfter
            : Date.now() + ACTION_CATALOG_MCP_FAILURE_CACHE_MS,
      });
      return entries;
    }
    if (timedOutWork) {
      this._actionsMcpTimedOutWorkByServer.delete(cacheKey);
    }

    const pending =
      this._actionsMcpEntriesResolvingByServer.get(cacheKey) ??
      this._startMcpActionCatalogEntriesForServer(server, cacheKey, (timedOutWork?.retryCount ?? -1) + 1);
    try {
      return await pending;
    } catch (error) {
      const reason: HarnessActionCatalogUnavailableReason =
        error instanceof ActionCatalogMcpListTimeoutError ? 'mcp_tool_catalog_timeout' : 'mcp_tool_catalog_failed';
      return [this._projectUnavailableMcpActionCatalogEntry(server, reason)];
    }
  }

  private async _skillsList(): Promise<HarnessSkill[]> {
    this._assertLive('skills.list()');
    return this._resolveSkills();
  }

  private async _skillsGet(name: string): Promise<HarnessSkill | undefined> {
    this._assertLive('skills.get()');
    if (typeof name !== 'string' || name.length === 0) {
      throw new HarnessValidationError('skills.get()', 'name must be a non-empty string');
    }
    const codeSkill = this._harness._getCodeSkill(name);
    if (codeSkill) return codeSkill;
    const skills = await this._resolveSkills();
    return skills.find(s => s.name === name);
  }

  private async _skillsRefresh(): Promise<void> {
    this._assertLive('skills.refresh()');
    this._clearSkillAndActionCatalogCaches();
    try {
      await this._workspace?.skills?.refresh();
    } finally {
      this._clearSkillAndActionCatalogCaches();
    }
  }

  /**
   * Resolve a code-registered skill by name, or a workspace skill by name or
   * relative path, validate any declared args schema, inject the validated
   * args as a JSON code block into the skill instructions, and dispatch the
   * result through `message()` as a single turn. Returns the underlying
   * `AgentResult`.
   *
   * Reference resolution mirrors Flue's workspace `session.skill(ref, ...)`
   * behavior for explicit workspace paths, then checks the static code
   * registry by name, then falls back to workspace skill names. A code skill
   * owns its name, but does not hide an otherwise shadowed workspace skill's
   * explicit path reference.
   */
  private _isExplicitWorkspaceSkillRef(ref: string): boolean {
    return (
      ref.includes('/') || ref.startsWith('./') || ref.startsWith('../') || /\.(?:md|mdx|txt|yaml|yml)$/i.test(ref)
    );
  }

  private async _skillsUse(ref: string, opts?: UseSkillOptions): Promise<AgentResult> {
    this._assertLive('skills.use()');
    if (typeof ref !== 'string' || ref.length === 0) {
      throw new HarnessValidationError('skills.use()', 'ref must be a non-empty string');
    }
    // §3: useSkill is a fail-fast operation — it must refuse on a busy session
    // rather than interleaving/queuing like a default message.
    if (this.isBusy()) {
      throw new HarnessBusyError(this.id, this._busyReason());
    }

    // §4.4c: validate caller request context before skill resolution so a bad
    // app bag fails fast (attributed to skills.use()); the normalized value is
    // forwarded to the delegated message() turn (which re-validates idempotently).
    const callerRequestContext = validateCallerRequestContext(opts?.requestContext, 'skills.use()');

    const tryWorkspaceSkill = async () => {
      const workspace = await this.getWorkspace();
      const skills = workspace?.skills;
      return skills ? skills.get(ref) : undefined;
    };

    if (this._isExplicitWorkspaceSkillRef(ref)) {
      const skill = await tryWorkspaceSkill();
      if (skill) {
        const args = opts?.args;
        this._validateSkillArgs(skill.name, skill.metadata, args);
        const expandedContent = this._buildSkillPrompt(skill.instructions, args);
        return this.message({
          content: expandedContent,
          ...(opts?.modelOverride ? { model: opts.modelOverride } : {}),
          ...(callerRequestContext ? { requestContext: callerRequestContext } : {}),
        });
      }
    }

    const codeSkill = this._harness._getCodeSkill(ref);
    if (codeSkill) {
      this._validateSkillArgs(codeSkill.name, codeSkill.metadata, opts?.args);
      const expandedContent = this._buildSkillPrompt(codeSkill.instructions, opts?.args);
      return this.message({
        content: expandedContent,
        ...(opts?.modelOverride ? { model: opts.modelOverride } : {}),
        ...(callerRequestContext ? { requestContext: callerRequestContext } : {}),
      });
    }

    // Force workspace materialization. Unlike `list` / `get`, `use` must
    // produce a definitive answer (start a turn or refuse with a typed
    // not-found error).
    const workspace = await this.getWorkspace();
    const skills = workspace?.skills;
    if (!skills) {
      throw new HarnessSkillNotFoundError(ref, ['code-registered']);
    }

    // `WorkspaceSkills.get` accepts either the frontmatter `name` or a
    // relative path under the configured skill source.
    const skill = await skills.get(ref);
    if (!skill) {
      throw new HarnessSkillNotFoundError(ref, ['code-registered', 'workspace']);
    }
    const args = opts?.args;
    this._validateSkillArgs(skill.name, skill.metadata, args);

    // Build the expanded prompt: skill instructions + (optional) JSON
    // code block carrying validated args. Skill authors reference the
    // args naturally in Markdown.
    const expandedContent = this._buildSkillPrompt(skill.instructions, args);

    return this.message({
      content: expandedContent,
      ...(opts?.modelOverride ? { model: opts.modelOverride } : {}),
      ...(callerRequestContext ? { requestContext: callerRequestContext } : {}),
    });
  }

  /**
   * Validate `metadata.args` as a small JSON-schema-ish object. The harness
   * supports the common prompt-arg fields used by workspace frontmatter:
   * `required`, `properties`, `type`, `enum`, `items`, and
   * `additionalProperties`. Unsupported or malformed schema shapes fail
   * before a skill turn starts.
   */
  private _validateSkillArgs(
    skillName: string,
    metadata: Record<string, unknown> | undefined,
    args: Record<string, unknown> | undefined,
  ): void {
    if (args !== undefined && (!args || typeof args !== 'object' || Array.isArray(args))) {
      throw new HarnessSkillArgsValidationError(skillName, ['args must be an object']);
    }

    const issues: string[] = [];
    if (args !== undefined) {
      this._validateJsonSerializableSkillArg('$', args, new WeakSet(), issues);
    }
    if (!metadata || typeof metadata !== 'object') {
      if (issues.length > 0) throw new HarnessSkillArgsValidationError(skillName, issues);
      return;
    }
    const argsField = (metadata as Record<string, unknown>).args;
    if (argsField === undefined) {
      if (issues.length > 0) throw new HarnessSkillArgsValidationError(skillName, issues);
      return;
    }
    if (!this._isPlainRecord(argsField)) {
      throw new HarnessSkillArgsValidationError(skillName, ['unsupported args schema: expected object']);
    }

    const issueCountBeforeSchemaShape = issues.length;
    this._validateSkillArgSchemaShape('$', argsField, issues, new WeakSet());
    if (issues.length > issueCountBeforeSchemaShape) {
      throw new HarnessSkillArgsValidationError(skillName, issues);
    }

    this._validateSkillArgSchemaValue('$', args ?? {}, argsField, issues);
    if (issues.length > 0) {
      throw new HarnessSkillArgsValidationError(skillName, issues);
    }
  }

  private _validateSkillArgSchemaShape(
    path: string,
    schema: Record<string, unknown>,
    issues: string[],
    seen: WeakSet<object>,
  ): void {
    if (seen.has(schema)) {
      issues.push(`${path} must not contain circular args schema references`);
      return;
    }
    seen.add(schema);

    for (const key of Object.keys(schema)) {
      if (!SUPPORTED_SKILL_ARG_SCHEMA_KEYS.has(key)) {
        issues.push(`${path}.${key} is not a supported args schema field`);
      }
    }

    const required = schema.required;
    if (
      required !== undefined &&
      (!Array.isArray(required) || required.some(k => typeof k !== 'string' || k.length === 0))
    ) {
      issues.push(`${path}.required must be an array of non-empty strings`);
    }

    const enumValues = schema.enum;
    if (enumValues !== undefined) {
      if (!Array.isArray(enumValues)) {
        issues.push(`${path}.enum must be an array`);
      } else {
        enumValues.forEach((candidate, index) => {
          this._validateJsonSerializableSkillArg(`${path}.enum[${index}]`, candidate, new WeakSet(), issues);
        });
      }
    }

    const declaredType = schema.type;
    if (declaredType !== undefined) {
      this._validateSkillArgDeclaredType(path, declaredType, issues);
    }

    const properties = schema.properties;
    if (properties !== undefined) {
      if (!this._isPlainRecord(properties)) {
        issues.push(`${path}.properties must be an object`);
      } else {
        for (const [key, childSchema] of Object.entries(properties)) {
          if (!this._isPlainRecord(childSchema)) {
            issues.push(`${path}.properties.${key} must be an object`);
            continue;
          }
          this._validateSkillArgSchemaShape(path === '$' ? key : `${path}.${key}`, childSchema, issues, seen);
        }
      }
    }

    const additionalProperties = schema.additionalProperties;
    if (additionalProperties !== undefined && additionalProperties !== true && additionalProperties !== false) {
      issues.push(`${path}.additionalProperties must be boolean`);
    }

    const items = schema.items;
    if (items !== undefined) {
      if (!this._isPlainRecord(items)) {
        issues.push(`${path}.items must be an object`);
      } else {
        this._validateSkillArgSchemaShape(`${path}[]`, items, issues, seen);
      }
    }

    seen.delete(schema);
  }

  private _validateSkillArgSchemaValue(
    path: string,
    value: unknown,
    schema: Record<string, unknown>,
    issues: string[],
  ): void {
    const required = schema.required;
    if (Array.isArray(required) && this._isPlainRecord(value)) {
      for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) {
          issues.push(`missing required arg: "${path === '$' ? key : `${path}.${key}`}"`);
        }
      }
    }

    const enumValues = schema.enum;
    if (Array.isArray(enumValues) && !enumValues.some(candidate => this._skillArgValuesEqual(candidate, value))) {
      issues.push(`${path} must be one of ${JSON.stringify(enumValues)}`);
    }

    const declaredType = schema.type;
    if (declaredType !== undefined && !this._matchesSkillArgType(value, declaredType, path, issues)) return;

    const properties = schema.properties;
    const additionalProperties = schema.additionalProperties;
    if (this._isPlainRecord(properties) && this._isPlainRecord(value)) {
      for (const [key, childSchema] of Object.entries(properties)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (!this._isPlainRecord(childSchema)) continue;
        this._validateSkillArgSchemaValue(path === '$' ? key : `${path}.${key}`, value[key], childSchema, issues);
      }
    }
    if (additionalProperties === false && this._isPlainRecord(value)) {
      const allowedKeys = this._isPlainRecord(properties) ? new Set(Object.keys(properties)) : new Set<string>();
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) issues.push(`unsupported arg: "${path === '$' ? key : `${path}.${key}`}"`);
      }
    }

    const items = schema.items;
    if (this._isPlainRecord(items) && Array.isArray(value)) {
      value.forEach((item, index) => {
        this._validateSkillArgSchemaValue(`${path}[${index}]`, item, items, issues);
      });
    }
  }

  private _validateSkillArgDeclaredType(path: string, declaredType: unknown, issues: string[]): void {
    const allowedTypes = Array.isArray(declaredType) ? declaredType : [declaredType];
    const supported = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
    if (allowedTypes.some(type => typeof type !== 'string' || !supported.has(type))) {
      issues.push(`${path}.type must be a supported JSON schema type`);
    }
  }

  private _matchesSkillArgType(value: unknown, declaredType: unknown, path: string, issues: string[]): boolean {
    const allowedTypes = Array.isArray(declaredType) ? declaredType : [declaredType];
    const supported = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
    if (allowedTypes.some(type => typeof type !== 'string' || !supported.has(type))) {
      issues.push(`${path}.type must be a supported JSON schema type`);
      return false;
    }

    const actualMatches = allowedTypes.some(type => {
      switch (type) {
        case 'string':
          return typeof value === 'string';
        case 'number':
          return typeof value === 'number' && Number.isFinite(value);
        case 'integer':
          return Number.isInteger(value);
        case 'boolean':
          return typeof value === 'boolean';
        case 'object':
          return this._isPlainRecord(value);
        case 'array':
          return Array.isArray(value);
        case 'null':
          return value === null;
        default:
          return false;
      }
    });
    if (!actualMatches) {
      issues.push(`${path} must be ${allowedTypes.join(' | ')}`);
    }
    return actualMatches;
  }

  private _isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  private _skillArgValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
      return (
        left.length === right.length && left.every((value, index) => this._skillArgValuesEqual(value, right[index]))
      );
    }
    if (this._isPlainRecord(left) && this._isPlainRecord(right)) {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      return leftKeys.every(
        key => Object.prototype.hasOwnProperty.call(right, key) && this._skillArgValuesEqual(left[key], right[key]),
      );
    }
    return false;
  }

  private _validateJsonSerializableSkillArg(
    path: string,
    value: unknown,
    seen: WeakSet<object>,
    issues: string[],
  ): void {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) issues.push(`${path} must be JSON-serializable`);
      return;
    }
    if (value === undefined || typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
      issues.push(`${path} must be JSON-serializable`);
      return;
    }
    if (typeof value !== 'object') return;
    if (
      Object.prototype.hasOwnProperty.call(value, 'toJSON') &&
      typeof (value as { toJSON?: unknown }).toJSON === 'function'
    ) {
      issues.push(`${path}.toJSON is not supported in skill args`);
      return;
    }
    if (seen.has(value)) {
      issues.push(`${path} must not contain circular references`);
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => this._validateJsonSerializableSkillArg(`${path}[${index}]`, item, seen, issues));
    } else if (this._isPlainRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        this._validateJsonSerializableSkillArg(path === '$' ? key : `${path}.${key}`, child, seen, issues);
      }
    } else {
      issues.push(`${path} must be JSON-serializable`);
    }
    seen.delete(value);
  }

  /**
   * Compose the skill prompt body. When args are supplied, append a JSON
   * code block carrying them. No delimiters beyond the Markdown fence —
   * skill authors reference args inline in their instructions.
   */
  private _buildSkillPrompt(instructions: string, args: Record<string, unknown> | undefined): string {
    if (!args || Object.keys(args).length === 0) return instructions;
    const json = JSON.stringify(args, null, 2);
    return `${instructions}\n\n\`\`\`json\n${json}\n\`\`\``;
  }

  /**
   * Internal: resolve the skill catalog for this session, sharing a
   * single-flight promise across concurrent callers.
   */
  private async _resolveSkills(): Promise<HarnessSkill[]> {
    if (this._skillsCache) return this._skillsCache;
    if (this._skillsResolving) return this._skillsResolving;

    const build = async (): Promise<HarnessSkill[]> => {
      const codeSkills = this._harness._listCodeSkills();
      const workspace = await this.getWorkspace();
      const workspaceSkills = workspace?.skills;
      if (!workspaceSkills) {
        // No workspace, or workspace has no skill source configured.
        return codeSkills;
      }
      const entries = await workspaceSkills.list();
      const codeNames = new Set(codeSkills.map(skill => skill.name));
      const projected = await Promise.all(
        entries
          .filter(meta => !codeNames.has(meta.name))
          .map(async meta => {
            const skill = await workspaceSkills.get(meta.path ?? meta.name);
            return {
              name: meta.name,
              description: meta.description,
              instructions: skill?.instructions ?? '',
              ...(meta.path ? { filePath: meta.path } : {}),
              // Pass through arbitrary skill frontmatter metadata so callers can
              // discover skill-level flags (e.g. `metadata.goal === true` for
              // goal-mode skills). Workspace's `SkillMetadata.metadata` is
              // typed `Record<string, unknown>` and is already JSON-serialisable.
              ...(meta.metadata ? { metadata: meta.metadata } : {}),
            };
          }),
      );
      return [...codeSkills, ...projected];
    };

    const pending = build();
    this._skillsResolving = pending;
    try {
      const result = await pending;
      // Only populate the cache when our own promise is still the
      // session-tracked one. If `skills.refresh()` ran while we were
      // resolving, `_skillsResolving` was cleared (or replaced by a
      // newer build) and we must not stomp it.
      if (this._skillsResolving === pending) {
        this._skillsCache = result;
      }
      return result;
    } finally {
      if (this._skillsResolving === pending) {
        this._skillsResolving = undefined;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Signal-routing helpers (§4.2). One long-lived thread subscription per
  // Session multiplexes every run on the thread into a single chunk
  // stream. `message()` calls `agent.sendSignal()`, gets a `runId` back,
  // and awaits the matching entry in `_runCompletionPromises`. Completion
  // settlement is handled by `_watchRunCompletion()`; the drain loop only
  // emits harness events from stream chunks.
  // -------------------------------------------------------------------------

  /**
   * Lazy-acquire the thread subscription against the given agent. Idempotent
   * when called with the same agent. If the agent changed (cross-agent mode
   * switch on the same thread), tears down the existing subscription and
   * opens a new one against the new agent so the chunk stream stays in
   * sync with the run the next `sendSignal()` will land on.
   */
  private async _ensureThreadSubscription(agent: Agent): Promise<AgentThreadSubscription<any>> {
    if (this._threadSubscriptionClosed) {
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
      }
      if (this._state === 'closed' || this._state === 'evicted') {
        throw new HarnessSessionClosedError(this.id);
      }
      throw new HarnessValidationError(
        '_ensureThreadSubscription()',
        'Session is closed; cannot re-open thread subscription.',
      );
    }
    if (this._threadSubscription && this._threadSubscriptionAgent?.id === agent.id) {
      return this._threadSubscription;
    }
    if (this._threadSubscription) {
      // Cross-agent mode switch: tear down the old subscription so we don't
      // mix chunks from two agents on the same thread.
      this._threadSubscription.unsubscribe();
      if (this._threadSubscriptionDrain) {
        await this._threadSubscriptionDrain.catch(() => {});
      }
      this._threadSubscription = undefined;
      this._threadSubscriptionAgent = undefined;
      this._threadSubscriptionDrain = undefined;
    }
    const sub = await agent.subscribeToThread({ resourceId: this.resourceId, threadId: this.threadId });
    if (this._threadSubscriptionClosed) {
      try {
        sub.unsubscribe();
      } catch {
        // Best-effort — hard-delete or close won while subscribeToThread was pending.
      }
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
      }
      if (this._state === 'closed' || this._state === 'evicted') {
        throw new HarnessSessionClosedError(this.id);
      }
      throw new HarnessValidationError(
        '_ensureThreadSubscription()',
        'Session is closed; cannot install thread subscription.',
      );
    }
    this._threadSubscription = sub;
    this._threadSubscriptionAgent = agent;
    this._threadSubscriptionDrain = this._drainSubscriptionStream(sub);
    // Surface drain rejections to outstanding awaiters; the drain loop itself
    // swallows them in its `finally` block.
    void this._threadSubscriptionDrain.catch(() => {});
    return sub;
  }

  private async _ensureThreadSubscriptionOrDeleted(agent: Agent): Promise<AgentThreadSubscription<any>> {
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    try {
      return await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeTurnWaiter.promise);
    } finally {
      activeTurnWaiter.cleanup();
    }
  }

  /**
   * Returns a Promise that resolves with a synthetic `FullOutput` when the
   * run with the given id terminates. The drain loop resolves (or rejects)
   * the entry. If `close()` runs while the entry is pending, the entry is
   * rejected with a typed error.
   */
  private _awaitRunCompletion(runId: string): Promise<FullOutput<unknown>> {
    // Fast path: the run may have already terminated before this call ran.
    // Keep the cached result reusable so duplicate admission callers that
    // converge on the same runId can still observe the terminal output even
    // if another waiter arrived first.
    const cached = this._completedRuns.get(runId);
    if (cached) {
      return cached.ok ? Promise.resolve(cached.full) : Promise.reject(cached.err);
    }
    // Multiple callers can await the same run (e.g. `message()` followed by
    // an active-delivery `signal()` that drains into the same run). Memoize
    // the promise so they all see the same resolution.
    const existing = this._runCompletionPromises.get(runId);
    if (existing) return existing.promise;
    let resolve!: (full: FullOutput<unknown>) => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<FullOutput<unknown>>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this._runCompletionPromises.set(runId, { promise, resolve, reject });
    // Single canonical settler: wait for the runtime to register the run's
    // `MastraModelOutput`, then await its `_waitUntilFinished()`. The drain
    // loop emits events from chunks; it does NOT settle completion. This
    // keeps event emission and completion delivery on independent paths and
    // is robust to runs that finish without emitting an explicit terminal
    // chunk in `fullStream` (test doubles, abort-before-first-chunk, etc.).
    void this._watchRunCompletion(runId);
    return promise;
  }

  /**
   * Canonical completion watcher. Acquires the run's `MastraModelOutput`
   * from the runtime via `waitForRunOutput()` (event-driven — no polling),
   * awaits `_waitUntilFinished()`, then settles the outstanding completion
   * promise (or stashes the result in `_completedRuns` if the waiter has not
   * been registered yet, e.g. for very fast runs).
   *
   * The captured `out` reference is threaded through to `_handleRunTerminal`
   * because the runtime drops the record from `getRunOutput()` after
   * `_waitUntilFinished()` resolves.
   */
  private async _watchRunCompletion(runId: string): Promise<void> {
    const agent = this._threadSubscriptionAgent;
    if (!agent) return;
    let out: MastraModelOutput<unknown> & { _waitUntilFinished?: () => Promise<void> };
    try {
      out = (await agent.waitForRunOutput(runId)) as MastraModelOutput<unknown> & {
        _waitUntilFinished?: () => Promise<void>;
      };
    } catch (err) {
      const waiter = this._runCompletionPromises.get(runId);
      this._runCompletionPromises.delete(runId);
      this._rememberCompletedRun(runId, { ok: false, err });
      waiter?.reject(err);
      return;
    }
    try {
      if (typeof out._waitUntilFinished === 'function') {
        await out._waitUntilFinished();
      }
    } catch {
      // Ignore — settlement happens via `_handleRunTerminal` below, which
      // will pick up the run's own error state via `getFullOutput()`.
    }
    this._modelTerminalRunsPendingEventDrain.add(runId);
    try {
      const outputDrain = this._threadSubscription?._waitForOutputDrain?.(out);
      if (outputDrain) {
        try {
          await outputDrain;
        } catch (error) {
          if (!isAgentThreadOutputDrainTeardownError(error)) {
            let terminalError = error;
            try {
              await this._discardPreRegisteredPendingAfterTerminalFailure(runId);
            } catch (cleanupError) {
              terminalError = cleanupError;
            }
            if (this._currentAgentRequestContext) {
              const lease = captureSuspendedToolSurfaceFenceLease(this._currentAgentRequestContext, runId);
              if (lease) clearSuspendedToolSurfaceFence(this._currentAgentRequestContext, runId, lease);
            }
            const waiter = this._runCompletionPromises.get(runId);
            this._runCompletionPromises.delete(runId);
            this._rememberCompletedRun(runId, { ok: false, err: terminalError });
            waiter?.reject(terminalError);
            return;
          }
          // Subscription teardown wakes the barrier. Since the model output is
          // already terminal, preserve that result instead of replacing it with
          // a generic close error.
        }
      }
      await this._handleRunTerminal(runId, out as MastraModelOutput<unknown>);
    } finally {
      this._modelTerminalRunsPendingEventDrain.delete(runId);
    }
  }

  /**
   * `ask_user`, `submit_plan`, and sandbox access persist their HITL record from
   * inside the tool before the agent publishes its suspended terminal. If that
   * terminal cannot be published/delivered, the thread runtime discards the run
   * and there is nothing valid to resume. Remove only a matching pre-registered
   * record; ordinary approval/suspension records are created later by
   * `_handleRunTerminal` and therefore cannot be present on this path.
   */
  private async _discardPreRegisteredPendingAfterTerminalFailure(runId: string): Promise<void> {
    let cleared = false;
    await this._flushUpdate(prev => {
      const pending = prev.pendingResume;
      if (
        pending?.runId !== runId ||
        pending.resumedAt !== undefined ||
        pending.expiryStartedAt !== undefined ||
        (pending.kind !== 'question' && pending.kind !== 'plan-approval' && pending.kind !== 'sandbox-access')
      ) {
        return prev;
      }
      cleared = true;
      const next: SessionRecord = { ...prev };
      delete next.pendingResume;
      return next;
    });
    if (cleared) this._pendingReplacementToolSurfaces.delete(runId);
  }

  private _rejectNonTerminalRunCompletions(reason: unknown): void {
    for (const [runId, entry] of this._runCompletionPromises) {
      if (this._modelTerminalRunsPendingEventDrain.has(runId)) continue;
      this._runCompletionPromises.delete(runId);
      entry.reject(reason);
    }
  }

  /**
   * Drain the long-lived subscription stream. The drain is the **sole event
   * emitter** for the session — each chunk is translated into the matching
   * harness event(s) via `_emitForChunk`. Completion delivery is handled
   * elsewhere (`_watchRunCompletion` driven by `_waitUntilFinished()`); this
   * loop deliberately does not inspect terminal chunks.
   *
   * On drain shutdown (stream end or unhandled error) every outstanding
   * completion promise is rejected so callers don't hang.
   */
  private async _drainSubscriptionStream(sub: AgentThreadSubscription<any>): Promise<void> {
    try {
      for await (const chunk of sub.stream) {
        const runId = (chunk as { runId?: string }).runId;
        if (runId && this._currentRunId === undefined) {
          // First chunk for a run marks our "current run" for getDisplayState().
          this._currentRunId = runId;
        }
        this._emitForChunk(chunk);
      }
    } catch (err) {
      this._rejectNonTerminalRunCompletions(err);
    } finally {
      // Stream ended normally — any caller still waiting for a runId whose
      // completion we never observed would hang forever otherwise.
      this._rejectNonTerminalRunCompletions(
        new HarnessValidationError('_drainSubscriptionStream()', 'Thread subscription closed before run completion'),
      );
    }
  }

  /**
   * Settle the outstanding completion waiter for `runId` with the bundled
   * `FullOutput`. Always called from `_watchRunCompletion` with the output
   * reference captured at registration time (runtime cleanup may have
   * already dropped it from `getRunOutput()` by now).
   *
   * If no waiter is registered yet (very fast run), the result is stashed
   * in `_completedRuns` so later `_awaitRunCompletion(runId)` calls can
   * observe it.
   */
  private async _handleRunTerminal(runId: string, out: MastraModelOutput<unknown>): Promise<void> {
    const waiter = this._runCompletionPromises.get(runId);
    this._runCompletionPromises.delete(runId);
    const cached = this._completedRuns.get(runId);
    if (cached && !cached.ok) {
      this._runToolReceipts.delete(runId);
      if (waiter) waiter.reject(cached.err);
      return;
    }
    try {
      const rawFull = (await out.getFullOutput()) as FullOutput<unknown>;
      // Close dangling tools while their receipt state can still be attached to
      // this run's output. Suspended tools remain parked for their real terminal.
      if (rawFull.finishReason !== 'suspended' && this._currentRunId === runId) {
        this._emitAbortedToolEnds();
      }
      const full = this._materializeHarnessRunOutput(runId, rawFull);
      this._rememberCompletedRun(runId, { ok: true, full });
      if (waiter) waiter.resolve(full);
    } catch (err) {
      this._runToolReceipts.delete(runId);
      this._rememberCompletedRun(runId, { ok: false, err });
      if (waiter) waiter.reject(err);
    }
  }

  private _rememberCompletedRun(
    runId: string,
    entry: { ok: true; full: FullOutput<unknown> } | { ok: false; err: unknown },
  ): void {
    if (this._completedRuns.has(runId)) return;
    this._completedRuns.set(runId, entry);
    while (this._completedRuns.size > 64) {
      const oldest = this._completedRuns.keys().next().value;
      if (oldest === undefined) return;
      this._completedRuns.delete(oldest);
      this._messageTokenAccountedRunIds.delete(oldest);
      this._messageTokenAccountingRunIds.delete(oldest);
      this._messageTokenAccountingReservations.delete(oldest);
      this._runToolReceipts.delete(oldest);
    }
  }

  /**
   * Capture only tool receipt identity/status from the authoritative stream.
   * Failed local tools are absent from Mastra FullOutput.toolResults, so this
   * bounded side channel is required for truthful blocked/failed reports and
   * durable recovery verification.
   */
  private _recordRunToolReceipt(runId: string, receipt: HarnessSubagentToolReceipt): void {
    if (
      receipt.toolCallId.length === 0 ||
      receipt.toolCallId.length > 1_024 ||
      receipt.toolName.length === 0 ||
      receipt.toolName.length > 256 ||
      receipt.toolName === HARNESS_SUBAGENT_OUTCOME_REPORT_TOOL_ID
    ) {
      return;
    }
    const state = this._getOrCreateRunToolReceiptState(runId);
    const key = `${receipt.toolCallId}\0${receipt.toolName}\0${receipt.status}`;
    if (state.exact.has(key)) return;
    const bytes = new TextEncoder().encode(JSON.stringify(receipt)).byteLength;
    if (
      state.receipts.length >= MAX_HARNESS_RUN_TOOL_RECEIPTS ||
      state.bytes + bytes > MAX_HARNESS_RUN_TOOL_RECEIPT_BYTES
    ) {
      state.overflow = true;
      return;
    }
    state.exact.add(key);
    state.receipts.push({ ...receipt });
    state.bytes += bytes;
  }

  private _getOrCreateRunToolReceiptState(runId: string): {
    receipts: HarnessSubagentToolReceipt[];
    exact: Set<string>;
    bytes: number;
    overflow: boolean;
  } {
    const existing = this._runToolReceipts.get(runId);
    if (existing !== undefined) return existing;
    while (this._runToolReceipts.size >= MAX_HARNESS_RUN_TOOL_RECEIPT_SETS) {
      const oldest = this._runToolReceipts.keys().next().value;
      if (oldest === undefined) break;
      this._runToolReceipts.delete(oldest);
    }
    const state = { receipts: [], exact: new Set<string>(), bytes: 0, overflow: false };
    this._runToolReceipts.set(runId, state);
    return state;
  }

  private _materializeHarnessRunOutput(runId: string, rawFull: FullOutput<unknown>): FullOutput<unknown> {
    const receiptState = this._runToolReceipts.get(runId);
    const full = materializeHarnessTerminalText(
      withHarnessSubagentToolReceipts(rawFull, receiptState?.receipts ?? [], receiptState?.overflow ?? false),
    );
    if (full.finishReason !== 'suspended') this._runToolReceipts.delete(runId);
    return full;
  }

  private _pendingRunToolReceiptProjection(
    runId: string,
  ): Pick<PendingResume, 'toolReceipts' | 'toolReceiptsOverflow'> {
    const state = this._runToolReceipts.get(runId);
    if (state === undefined) return {};
    return {
      ...(state.receipts.length > 0 ? { toolReceipts: state.receipts.map(receipt => ({ ...receipt })) } : {}),
      ...(state.overflow ? { toolReceiptsOverflow: true } : {}),
    };
  }

  private _restorePendingRunToolReceipts(pending: PendingResume): void {
    const persisted = Array.isArray(pending.toolReceipts) ? pending.toolReceipts : [];
    for (const receipt of persisted.slice(0, MAX_HARNESS_RUN_TOOL_RECEIPTS)) {
      if (
        receipt !== null &&
        typeof receipt === 'object' &&
        typeof receipt.toolCallId === 'string' &&
        typeof receipt.toolName === 'string' &&
        (receipt.status === 'success' || receipt.status === 'error')
      ) {
        this._recordRunToolReceipt(pending.runId, receipt);
      }
    }
    if (pending.toolReceiptsOverflow === true || persisted.length > MAX_HARNESS_RUN_TOOL_RECEIPTS) {
      this._getOrCreateRunToolReceiptState(pending.runId).overflow = true;
    }
  }

  /**
   * Translate a single fullStream chunk into the matching harness event(s).
   * Extracted from `_drainStreamToEvents` so the long-lived subscription
   * drain is the single consumer of chunks.
   */
  private _emitForChunk(chunk: {
    type: string;
    id?: string;
    payload?: unknown;
    data?: unknown;
    runId?: string;
    metadata?: unknown;
  }): void {
    // §10.2 TurnEvent/ToolEvent — runId identifies the streaming run. Mid-run
    // chunks carry it; fall back to the session's current run id.
    const runId = chunk.runId ?? this._currentRunId;
    switch (chunk.type) {
      case 'text-start': {
        // §10.2 defines no message-boundary event; we still track the in-flight
        // message id for the display snapshot.
        const payload = chunk.payload as { id: string };
        this._currentMessageId = payload.id;
        this._setAssistantDraftMessageId(runId, payload.id);
        return;
      }
      case 'text-delta': {
        const payload = chunk.payload as { id: string; text?: string };
        if (runId !== undefined && typeof payload?.text === 'string' && payload.text.length > 0) {
          this._recordAssistantDraftDelta({
            runId,
            kind: 'text',
            delta: payload.text,
            ...(typeof payload.id === 'string' ? { messageId: payload.id } : {}),
          });
          this._emitTurnEvent({ type: 'text_delta', runId, delta: payload.text });
        }
        return;
      }
      case 'text-end': {
        const payload = chunk.payload as { id: string };
        if (this._currentMessageId === payload.id) {
          this._currentMessageId = undefined;
        }
        return;
      }
      case 'reasoning-delta': {
        // §10.2 streaming reasoning. Mirrors `text-delta`: emit one
        // `reasoning_delta` per chunk that carries real reasoning text (gate on
        // non-empty + a known runId). `reasoning-start`/`reasoning-end` carry no
        // text and define no message boundary, so they emit nothing (default
        // case). The AI-SDK chunk is `{ type:'reasoning-delta', payload:{ text } }`
        // (stream/types.ts ReasoningDeltaPayload; aisdk/v5/transform.ts maps the
        // provider `reasoning-delta.delta` into `payload.text`).
        const payload = chunk.payload as { id: string; text?: string };
        if (runId !== undefined && typeof payload?.text === 'string' && payload.text.length > 0) {
          this._recordAssistantDraftDelta({
            runId,
            kind: 'reasoning',
            delta: payload.text,
          });
          this._emitTurnEvent({ type: 'reasoning_delta', runId, delta: payload.text });
        }
        return;
      }
      case 'data-terminal-tool-result': {
        if (runId === undefined || typeof chunk.id !== 'string') return;
        const answer = parseHarnessSubagentTerminalResult(chunk.data);
        if (!answer) return;
        const deliveryKey = `${runId}:${chunk.id}`;
        if (this._deliveredTerminalSubagentAnswers.has(deliveryKey)) return;
        const pending = this._pendingTerminalSubagentAnswers.get(runId);
        if (pending && pending.partId !== chunk.id) {
          // More than one candidate for a run is ambiguous. The framework
          // protocol will fail the run; Harness must not guess which to render.
          this._pendingTerminalSubagentAnswers.delete(runId);
          return;
        }
        this._pendingTerminalSubagentAnswers.set(runId, { partId: chunk.id, answer });
        return;
      }
      case 'step-finish': {
        if (runId === undefined) return;
        const pending = this._pendingTerminalSubagentAnswers.get(runId);
        if (!pending) return;
        this._pendingTerminalSubagentAnswers.delete(runId);
        const payload = chunk.payload as { messageId?: unknown; terminalToolResult?: unknown } | undefined;
        const authoritative = parseHarnessSubagentTerminalResult(payload?.terminalToolResult);
        if (
          !authoritative ||
          authoritative.kind !== pending.answer.kind ||
          authoritative.subagentSessionId !== pending.answer.subagentSessionId ||
          authoritative.text !== pending.answer.text
        ) {
          return;
        }
        const deliveryKey = `${runId}:${pending.partId}`;
        if (this._deliveredTerminalSubagentAnswers.has(deliveryKey)) return;
        this._deliveredTerminalSubagentAnswers.add(deliveryKey);
        while (this._deliveredTerminalSubagentAnswers.size > MAX_DELIVERED_TERMINAL_SUBAGENT_ANSWERS) {
          const oldest = this._deliveredTerminalSubagentAnswers.values().next().value;
          if (oldest === undefined) break;
          this._deliveredTerminalSubagentAnswers.delete(oldest);
        }
        this._recordAssistantDraftDelta({
          runId,
          kind: 'text',
          delta: authoritative.text,
          ...(typeof payload?.messageId === 'string' ? { messageId: payload.messageId } : {}),
        });
        this._emitTurnEvent({ type: 'text_delta', runId, delta: authoritative.text });
        return;
      }
      case 'finish': {
        if (runId !== undefined) this._pendingTerminalSubagentAnswers.delete(runId);
        return;
      }
      case 'tool-call-input-streaming-start': {
        // §10.2 has no tool-input-streaming events; keep the buffer for the
        // display snapshot of in-flight args, but emit nothing.
        const payload = chunk.payload as { toolCallId: string; toolName: string };
        this._toolInputBuffers.set(payload.toolCallId, { toolName: payload.toolName, text: '' });
        return;
      }
      case 'tool-call-delta': {
        const payload = chunk.payload as { toolCallId: string; argsTextDelta: string; toolName?: string };
        const prev = this._toolInputBuffers.get(payload.toolCallId);
        const toolName = prev?.toolName ?? payload.toolName ?? '';
        const displayedDelta = harnessDisplayToolPayload(chunk.metadata, 'input-delta', payload.argsTextDelta);
        this._toolInputBuffers.set(payload.toolCallId, {
          toolName,
          text: (prev?.text ?? '') + (typeof displayedDelta === 'string' ? displayedDelta : ''),
        });
        return;
      }
      case 'tool-call-input-streaming-end': {
        const payload = chunk.payload as { toolCallId: string };
        this._toolInputBuffers.delete(payload.toolCallId);
        return;
      }
      case 'tool-call': {
        const payload = chunk.payload as { toolCallId: string; toolName: string; args: unknown };
        this._activeTools.set(payload.toolCallId, {
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          args: payload.args,
          startedAt: Date.now(),
        });
        this._toolInputBuffers.delete(payload.toolCallId);
        if (runId !== undefined) {
          // §10.2: project `input` to its JSON-safe replay shape AT EMIT so the
          // live subscriber and the durable/replayed row carry the identical
          // value (the raw `args` may hold Date/Map/Set/class/bigint/cycles).
          this._emitTurnEvent({
            type: 'tool_start',
            runId,
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            input: projectToolEventPayloadForJson(
              harnessDisplayToolPayload(chunk.metadata, 'input-available', payload.args),
              'tool_start.input',
              this._harness._internalMaxEventPayloadBytes,
            ),
          });
        }
        return;
      }
      case 'tool-result': {
        const payload = chunk.payload as { toolCallId: string; toolName?: string; result: unknown; isError?: boolean };
        // §10.4: the resume segment replays the approved tool's `tool-result`
        // WITHOUT a preceding `tool-call` in this segment, so `_activeTools` (seeded
        // only by `tool-call`) misses on resume and `tool_end.toolName` would be ''.
        // The chunk payload itself carries the required `toolName` (ToolResultPayload,
        // stream/types.ts) on BOTH the initial and resume paths, so prefer it; fall
        // back to the `_activeTools` entry for any chunk shape that omits it.
        const toolName = payload.toolName || this._activeTools.get(payload.toolCallId)?.toolName || '';
        this._activeTools.delete(payload.toolCallId);
        // Suppress a real terminal that arrives AFTER a synthetic aborted tool_end
        // was already emitted for this (runId, toolCallId) — one-shot (S1).
        if (runId !== undefined && this._abortedToolTombstones.delete(`${runId}:${payload.toolCallId}`)) {
          return;
        }
        if (runId !== undefined) {
          this._recordRunToolReceipt(runId, {
            toolCallId: payload.toolCallId,
            toolName,
            status: payload.isError === true ? 'error' : 'success',
          });
          // Project `output` at emit so live === replay (§10.2). Shared/aliased
          // refs are split into copies, Date->ISO, Map/Set->{}, class->plain.
          this._emitTurnEvent({
            type: 'tool_end',
            runId,
            toolCallId: payload.toolCallId,
            toolName,
            output: projectToolEventPayloadForJson(
              harnessDisplayToolPayload(chunk.metadata, 'output-available', payload.result),
              'tool_end.output',
              this._harness._internalMaxEventPayloadBytes,
            ),
            isError: payload.isError ?? false,
          });
        }
        return;
      }
      case 'tool-error': {
        const payload = chunk.payload as { toolCallId: string; toolName?: string; error: unknown };
        // Same resume gap as `tool-result`: prefer the payload's own `toolName`
        // (ToolErrorPayload, stream/types.ts) so a resumed/replayed `tool-error`
        // carries the real name; fall back to `_activeTools` for chunk shapes
        // that omit it.
        const toolName = payload.toolName || this._activeTools.get(payload.toolCallId)?.toolName || '';
        this._activeTools.delete(payload.toolCallId);
        // One-shot suppression of a late real terminal after a synthetic abort (S1).
        if (runId !== undefined && this._abortedToolTombstones.delete(`${runId}:${payload.toolCallId}`)) {
          return;
        }
        if (runId !== undefined) {
          this._recordRunToolReceipt(runId, {
            toolCallId: payload.toolCallId,
            toolName,
            status: 'error',
          });
          // §13.3f.1: a tool's OWN error is faithfully preserved (the shared
          // `harnessEventJsonReplacer` keeps name/code/message — NOT flattened
          // into `harness.internal`), and projected at emit so the raw thrown
          // Error (stack/cause/prototype) never reaches a live subscriber while
          // replay sees only {name,code,message}.
          this._emitTurnEvent({
            type: 'tool_end',
            runId,
            toolCallId: payload.toolCallId,
            toolName,
            output: projectToolEventPayloadForJson(
              harnessDisplayToolPayload(chunk.metadata, 'error', payload.error),
              'tool_end.output',
              this._harness._internalMaxEventPayloadBytes,
            ),
            isError: true,
          });
        }
        return;
      }
      default: {
        // §10.2 defines no tool-progress / shell-output / task-update built-in
        // events. Tool authors surface progress via §10.3 custom events
        // (dotted `${string}.${string}` types), which flow through the custom
        // event path — the harness does not synthesize built-ins from `data-*`
        // writer chunks.
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // message() — §4.2.
  //
  // Always-accept signal-driven entry point. Three return shapes:
  //
  //   * default                          → AgentResult (await everything)
  //   * { stream: true }                 → live MastraModelOutput
  //   * { output: schema, sync: true }   → fail-fast structured object
  //
  // Default + stream paths route through `agent.sendSignal()` (Slice A).
  // Structured + sync path stays on `agent.generate()` so typed-output
  // turn boundaries remain fail-fast and uncoupled from the subscription
  // multiplexer.
  // -------------------------------------------------------------------------

  /** Default: bundle the full agent output and return when the run finishes. */
  async message(opts: MessageOptionsDefault): Promise<AgentResult>;
  /** Streaming: hand the live `MastraModelOutput` back to the caller. */
  async message(opts: MessageOptionsStream): Promise<AgentStream>;
  /** Structured + sync: fail-fast typed object output. */
  async message<S extends z.ZodTypeAny>(opts: MessageOptionsStructured<S>): Promise<z.infer<S>>;
  async message(opts: MessageOptions): Promise<AgentResult | AgentStream | unknown> {
    this._assertLive('message()');
    this._assertOpenForTurn('message()');
    const logicalMessageIdentity = normalizeSessionLogicalMessageIdentity(opts.logicalMessageIdentity, 'message()');
    const admittedOpts = {
      ...opts,
      ...(logicalMessageIdentity === undefined ? {} : { logicalMessageIdentity }),
    };

    if (opts.stream === true && opts.output !== undefined) {
      throw new HarnessConfigError('message()', '`stream: true` and `output` are mutually exclusive');
    }
    if (opts.output !== undefined && opts.sync !== true) {
      throw new HarnessConfigError('message()', 'structured `output` requires `sync: true` (typed turn boundary)');
    }
    if (opts.admissionId !== undefined && opts.output !== undefined) {
      throw new HarnessValidationError(
        'message().admissionId',
        'admissionId is not supported with sync structured output',
      );
    }
    if (opts.admissionId !== undefined && opts.additionalTools !== undefined) {
      throw new HarnessValidationError('message().admissionId', 'admissionId cannot be combined with additionalTools');
    }
    if (opts.admissionId !== undefined && opts.admissionId.length === 0) {
      throw new HarnessValidationError('message().admissionId', 'admissionId must be a non-empty string');
    }

    // §3 / §4.4a: the sync structured-output form is the one fail-fast signal
    // form — it needs a clean turn boundary, so refuse on a busy session rather
    // than launching a concurrent generate. Default message()/signal()/queue()
    // stay busy-independent.
    if (opts.output !== undefined && opts.sync === true && this.isBusy()) {
      throw new HarnessBusyError(this.id, this._busyReason());
    }

    // §4.4c: validate caller-supplied request context before any admission
    // side-effect (hash, evidence reservation, dispatch). Only `app` is allowed;
    // reserved/infrastructure keys are rejected here with HarnessValidationError.
    const callerRequestContext = validateCallerRequestContext(opts.requestContext, 'message()');
    // When a turn is already in flight, the signal-routed path interleaves into
    // that active run and its streamOptions (which carry the request context)
    // are ignored, so a caller `app` could never reach the running tools. Reject
    // rather than silently drop it. We key off an already-active turn — NOT the
    // broader isBusy() (which also covers a pending queue / pending resume with
    // no active run, where this message wakes a fresh run that DOES receive the
    // context). This guard runs before this turn's own _beginTurn, so the
    // controller here reflects a pre-existing active turn. (The structured+sync
    // form already rejected busy above.)
    if (callerRequestContext !== undefined && this._currentTurnAbortController !== undefined) {
      throw new HarnessConfigError(
        'message().requestContext',
        'cannot be supplied while a run is active on this thread — it would interleave into the running execution and could not reach its tools',
      );
    }
    const persistedRequestContext = callerRequestContextToPersisted(callerRequestContext);

    // Observability-only pre-stream phase marks (PF-2246). Callers use these
    // to decompose admission latency; failures never affect turn semantics.
    const messageAdmissionStartedAtMs = Date.now();
    const reportAdmissionPhase = (phase: MessageAdmissionPhase) => {
      if (opts.onPhase === undefined) return;
      try {
        opts.onPhase(phase, Date.now() - messageAdmissionStartedAtMs);
      } catch {
        // Swallow: the callback is observability-only.
      }
    };

    // Resolve the effective mode (per-call override wins, else session's).
    const effectiveModeId = opts.mode ?? this._record.modeId;
    const effectiveModelId = opts.model ?? this._record.modelId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);
    const admissionHashes =
      opts.admissionId !== undefined
        ? this._computeMessageAdmissionHashes(
            admittedOpts,
            {
              modeId: effectiveModeId,
              modelId: effectiveModelId,
            },
            persistedRequestContext,
          )
        : undefined;
    const admissionHash = admissionHashes?.primary;
    const compatibleAdmissionHashes = admissionHashes?.legacyCompatible;
    // PF-2250 §1 — the duplicate fast-path read runs CONCURRENTLY with the
    // admission interior: the reservation write below detects duplicates and
    // tombstones transactionally (created:false ⇒ resolve-or-conflict), so the
    // warm path never blocks on this read. Its result is awaited only where it
    // changes behavior the reservation cannot express: an idempotent retry
    // arriving in the §4.4c active-delivery window must return the duplicate
    // instead of the active-delivery rejection.
    const duplicateProbe =
      opts.admissionId !== undefined
        ? this._resolveMessageAdmissionDuplicate({
            admissionId: opts.admissionId,
            admissionHash: admissionHash!,
            compatibleAdmissionHashes,
          })
        : undefined;
    if (duplicateProbe !== undefined) void duplicateProbe.catch(() => {});
    reportAdmissionPhase('admission_duplicate_resolved');
    const admissionIdentity =
      opts.admissionId !== undefined ? this._messageAdmissionIdentity(opts.admissionId) : undefined;

    // Per-turn additionalTools merge with the mode's surface, never replace.
    const toolSurface = this._buildToolSurface(mode, opts.additionalTools);
    reportAdmissionPhase('tool_surface_built');

    const admissionStart =
      opts.admissionId !== undefined
        ? createDeferred<AgentSignalResultEvidence | OperationAdmissionTombstone>()
        : undefined;
    if (admissionStart) void admissionStart.promise.catch(() => {});
    if (admissionIdentity !== undefined && admissionHash !== undefined && admissionStart !== undefined) {
      const existingStart = this._messageAdmissionStarts.get(opts.admissionId!);
      if (existingStart) {
        if (existingStart.admissionHash !== admissionHash) {
          throw new HarnessAdmissionConflictError(
            this.id,
            opts.admissionId!,
            existingStart.admissionHash,
            admissionHash,
          );
        }
        const evidence = await existingStart.promise;
        return this._returnDuplicateMessageResult(evidence, opts);
      }
      this._messageAdmissionStarts.set(opts.admissionId!, {
        admissionHash,
        modeId: effectiveModeId,
        modelId: effectiveModelId,
        promise: admissionStart.promise,
      });
    }

    // Every turn runs under a session-owned AbortController so
    // `session.abort()` can cancel the in-flight run. If the caller passes
    // their own AbortSignal, we forward it into the session controller so
    // both paths converge on a single signal handed to the agent.
    const turnAbortController = this._beginTurn(opts.abortSignal, {
      modeId: effectiveModeId,
      modelId: effectiveModelId,
    });
    this._setCurrentTurnReplacementToolSurface(toolSurface);
    const turnAbortSignal = turnAbortController.signal;
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    const finishOwnedMessageTurn = () => {
      activeTurnWaiter.cleanup();
      this._endTurn(turnAbortController);
    };
    const failOwnedMessageTurnBeforeDispatch = (err: unknown) => {
      finishOwnedMessageTurn();
      admissionStart?.reject(err);
      if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
    };
    const assertOwnedMessageTurnNotDeleted = () => {
      if (this._state === 'deleted') {
        const err = new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
        failOwnedMessageTurnBeforeDispatch(err);
        throw err;
      }
    };
    try {
      this._assertOpenForTurn('message()');
    } catch (err) {
      failOwnedMessageTurnBeforeDispatch(err);
      throw err;
    }
    let requestContext;
    let turnInstructions: string | undefined;
    try {
      [requestContext, turnInstructions] = await Promise.race([
        Promise.all([
          this._buildRequestContext({
            modeId: effectiveModeId,
            modelId: effectiveModelId,
            abortSignal: turnAbortSignal,
            ...(persistedRequestContext ? { persistedRequestContext } : {}),
          }),
          this._turnInstructions(mode.instructions),
        ]),
        activeTurnWaiter.promise,
      ]);
    } catch (err) {
      failOwnedMessageTurnBeforeDispatch(err);
      // §13.3f.1 — message() is a public §4.2b boundary; _buildRequestContext can
      // reject with a raw provider/storage/runtime error (workspace materialization,
      // persistence). Redact before rejecting the caller's promise.
      throw redactPublicBoundaryRejection(err);
    }
    reportAdmissionPhase('request_context_ready');
    assertOwnedMessageTurnNotDeleted();

    const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
      memory: { thread: this.threadId, resource: this.resourceId },
      abortSignal: turnAbortSignal,
      requestContext,
      maxSteps: HARNESS_SESSION_MAX_STEPS,
      ...toolSurface,
      ...(turnInstructions ? { instructions: turnInstructions } : {}),
      // §9 per-turn override: caller-supplied model generation settings
      // (temperature, maxOutputTokens, …) layered onto the structured generate
      // turn. Omitted → model/provider defaults, so existing turns are unchanged.
      ...(opts.modelSettings ? { modelSettings: opts.modelSettings } : {}),
      ...(logicalMessageIdentity ? { logicalMessageIdentity } : {}),
    };

    // Structured + sync path: agent.generate with structuredOutput.
    if (opts.output !== undefined && opts.sync === true) {
      let agentEndEmitted = false;
      let agentStartRunId: string | undefined;
      // Hoisted so the catch can emit `agent_end.usage` from the run's actual
      // output when a usable result existed but turned out to be a generation
      // failure (tripwire / missing object). Undefined when generate threw.
      let observedFull: FullOutput<unknown> | undefined;
      try {
        const result = await Promise.race([
          agent.generate(opts.content, {
            ...baseExecOptions,
            structuredOutput: { schema: opts.output as never },
          }),
          activeTurnWaiter.promise,
        ]);
        const full = result as FullOutput<unknown>;
        observedFull = full;
        // §10.2 agent_start carries the runId; generate is atomic, so we learn
        // the runId only once it returns. (If generate threw, no run terminal
        // was observed — no agent_start/agent_end, per §10.2's runId rule.)
        agentStartRunId = full.runId;
        this._emitAgentStart(full.runId);
        if (full.finishReason === 'suspended') {
          await this._captureMessageSuspendWithTokenUsage(
            full,
            undefined,
            effectiveModeId,
            effectiveModelId,
            activeTurnWaiter.promise,
          );
        } else {
          // Account token usage for the run regardless of whether it produced a
          // usable object — the model consumed tokens either way. This runs before
          // the §4.5 failure throw so a tripwire/missing-object turn is not dropped
          // from the durable counter.
          const tokenUsageDelta = this._recordTurnCompletion(full, { persist: false });
          if (tokenUsageDelta !== undefined) {
            await Promise.race([this._persistTokenUsageOrLatch(), activeTurnWaiter.promise]);
          }
          // §4.5: a non-suspended structured result that carries no usable object
          // (or was rejected by a processor tripwire) is a generation failure. Throw
          // after accounting but before emitting a terminal so the catch below
          // surfaces an `error` agent_end rather than a spurious `complete`.
          const outputFailure = this._classifyStructuredOutputFailure(full);
          if (outputFailure !== undefined) {
            throw new HarnessOutputGenerationError(this.id, outputFailure, full.runId);
          }
        }
        this._emitAgentEnd({ runId: full.runId, finishReason: this._agentEndReasonForFullOutput(full), full });
        agentEndEmitted = true;
        await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
        return full.object;
      } catch (err) {
        if (!agentEndEmitted && agentStartRunId !== undefined) {
          this._emitTurnEvent({
            type: 'agent_end',
            runId: agentStartRunId,
            finishReason: turnAbortSignal.aborted ? 'aborted' : 'error',
            usage: this._runUsage(observedFull),
          });
        }
        throw this._asStructuredOutputError(err, agentStartRunId, turnAbortSignal);
      } finally {
        finishOwnedMessageTurn();
      }
    }

    // Signal-routed path: every non-structured message goes through
    // `agent.sendSignal()`. The long-lived thread subscription is the
    // single chunk consumer for this Session; the drain loop emits
    // per-chunk harness events and resolves `_runCompletionPromises[runId]`
    // when the run terminates.
    //
    // On an idle thread the agent starts a fresh run with
    // `agent.stream(signal, streamOptions)`; on an active same-agent run
    // the signal drains mid-flight into the running execution loop. Both
    // paths surface chunks through the same subscription stream.
    let sub;
    try {
      sub = await Promise.race([this._ensureThreadSubscription(agent), activeTurnWaiter.promise]);
    } catch (err) {
      failOwnedMessageTurnBeforeDispatch(err);
      // §13.3f.1 — message() is a public §4.2b boundary; subscribeToThread can
      // reject with a raw runtime error. Redact before rejecting the caller.
      throw redactPublicBoundaryRejection(err);
    }
    assertOwnedMessageTurnNotDeleted();

    // §4.4c: authoritative active-delivery check, using the same `sub.activeRunId()` predicate
    // signal() relies on, now that the live subscription is open. The early
    // `_currentTurnAbortController` guard is a cheap fast path; this catches a run that started
    // during the intervening request-context/admission awaits (where an interleaving signal would
    // ignore the streamOptions carrying the caller `app`). It runs BEFORE the durable admission
    // reservation below, so rejecting here writes nothing durable and the owned-turn cleanup
    // suffices — and, crucially, it does NOT poison an idempotent retry with a spurious `failed`
    // evidence row. The single residual window is the awaited reservation itself (admissionId
    // path only): a run starting precisely during that write is admission-scoped only and is not
    // delivered to the interleaved run, matching how `abortSignal` behaves on active-delivery —
    // we deliberately do not reject post-reservation, because that would poison the retry.
    if (callerRequestContext !== undefined && sub.activeRunId() !== null) {
      // The probe (in flight since admission entry) preserves the idempotent
      // retry: a duplicate of an actively-delivering admission attaches to the
      // running turn instead of surfacing the active-delivery rejection.
      const duplicate = duplicateProbe !== undefined ? await duplicateProbe.catch(() => undefined) : undefined;
      if (duplicate) {
        if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
        admissionStart?.resolve(duplicate);
        try {
          return await this._returnDuplicateMessageResult(duplicate, opts);
        } finally {
          finishOwnedMessageTurn();
        }
      }
      const err = new HarnessConfigError(
        'message().requestContext',
        'cannot be supplied while a run is active on this thread — it would interleave into the running execution and could not reach its tools',
      );
      failOwnedMessageTurnBeforeDispatch(err);
      throw err;
    }

    // A full logical pair owns a fresh response stream. If an active run
    // appears before the durable reservation, fail at the boundary instead of
    // letting the native default active-delivery policy silently drop the
    // response identity. Idempotent retries still attach to their durable
    // duplicate before this guard rejects new work.
    if (logicalMessageIdentity !== undefined && sub.activeRunId() !== null) {
      const duplicate = duplicateProbe !== undefined ? await duplicateProbe.catch(() => undefined) : undefined;
      if (duplicate) {
        if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
        admissionStart?.resolve(duplicate);
        try {
          return await this._returnDuplicateMessageResult(duplicate, opts);
        } finally {
          finishOwnedMessageTurn();
        }
      }
      const err = new HarnessConfigError(
        'message().logicalMessageIdentity',
        'a full logical message identity cannot be delivered into an active run',
      );
      failOwnedMessageTurnBeforeDispatch(err);
      throw err;
    }

    if (admissionIdentity !== undefined && admissionHash !== undefined && admissionStart !== undefined) {
      try {
        const reservation = await Promise.race([
          this._writeMessageResultEvidence(
            {
              status: 'pending',
              signalId: admissionIdentity.signalId,
              runId: admissionIdentity.runId,
              modeId: effectiveModeId,
              modelId: effectiveModelId,
              operationKind: 'message',
              admissionId: opts.admissionId!,
              admissionHash,
            },
            { compatibleAdmissionHashes },
          ),
          activeTurnWaiter.promise,
        ]);
        if (!reservation.created) {
          const registeredStart = this._messageAdmissionStarts.get(opts.admissionId!);
          if (registeredStart !== undefined) registeredStart.duplicate = true;
          this._messageAdmissionStarts.delete(opts.admissionId!);
          const existing =
            reservation.evidence ??
            (await this._resolveMessageAdmissionDuplicate({
              admissionId: opts.admissionId!,
              admissionHash,
              compatibleAdmissionHashes,
            }));
          if (existing) {
            admissionStart.resolve(existing);
            try {
              return await this._returnDuplicateMessageResult(existing, opts);
            } finally {
              finishOwnedMessageTurn();
            }
          }
          const conflict = new HarnessAdmissionConflictError(this.id, opts.admissionId!, '', admissionHash);
          admissionStart.reject(conflict);
          throw conflict;
        }
      } catch (err) {
        failOwnedMessageTurnBeforeDispatch(err);
        // §13.3f.1 — message() is a public §4.2b boundary; the admission
        // reservation write can reject with a raw storage error. Redact before
        // rejecting the caller (the conflict/deleted Harness errors pass through).
        throw redactPublicBoundaryRejection(err);
      }
      assertOwnedMessageTurnNotDeleted();
    }
    reportAdmissionPhase('evidence_reserved');

    let signal;
    let nativeDispatchStarted = false;
    let nativeAccepted = false;
    let nativeRejected = false;
    try {
      signal = agent.sendSignal(
        {
          ...(admissionIdentity ? { id: admissionIdentity.signalId } : {}),
          type: 'user-message',
          contents: opts.content as never,
          ...(logicalMessageIdentity ? { metadata: { logicalMessageId: logicalMessageIdentity.input } } : {}),
        },
        {
          ...(admissionIdentity ? { runId: admissionIdentity.runId } : {}),
          resourceId: this.resourceId,
          threadId: this.threadId,
          ...(logicalMessageIdentity ? { ifActive: { behavior: 'discard' } } : {}),
          ifIdle: {
            behavior: 'wake',
            // The wake branch starts a REAL streamed turn; carry the silent-turn nudge.
            streamOptions: {
              ...baseExecOptions,
              ...this._createEmptySynthesisOptions(),
            } as never,
          },
        },
      );
      if (logicalMessageIdentity !== undefined) {
        nativeDispatchStarted = true;
        const accepted = await this._awaitSignalNativeAcceptance(
          signal.accepted,
          turnAbortSignal,
          activeTurnWaiter.promise,
        );
        if (accepted.action === 'discard') {
          nativeRejected = true;
          throw new HarnessConfigError(
            'message().logicalMessageIdentity',
            'a full logical message identity cannot be delivered into an active run',
          );
        }
        nativeAccepted = true;
      }
    } catch (err) {
      let thrown = err;
      if (
        admissionIdentity !== undefined &&
        admissionHash !== undefined &&
        (!nativeDispatchStarted || nativeAccepted || nativeRejected)
      ) {
        try {
          await Promise.race([
            this._writeMessageResultEvidence(
              {
                status: 'failed',
                signalId: admissionIdentity.signalId,
                runId: admissionIdentity.runId,
                modeId: effectiveModeId,
                modelId: effectiveModelId,
                operationKind: 'message',
                admissionId: opts.admissionId!,
                admissionHash,
                error: projectHarnessPublicError(err),
              },
              { compatibleAdmissionHashes },
            ).catch(() => {}),
            activeTurnWaiter.promise,
          ]);
        } catch (evidenceErr) {
          if (evidenceErr instanceof HarnessSessionDeletedError) thrown = evidenceErr;
        }
      }
      failOwnedMessageTurnBeforeDispatch(thrown);
      // §13.3f.1 — message() is a public §4.2b boundary; agent.sendSignal() can
      // throw a raw runtime error. Redact before rejecting the caller's promise
      // (a HarnessSessionDeletedError from the evidence write passes through).
      throw redactPublicBoundaryRejection(thrown);
    }

    // §10.2 agent_start carries the runId — emit it now that the run is
    // dispatched (signal.runId known) and before the drain surfaces any chunk.
    // signal.signal.id is the originating signalId — stamped for the run projection.
    this._emitAgentStart(signal.runId, signal.signal.id);

    // Register the completion waiter BEFORE the drain has a chance to see
    // a terminal chunk for this runId (the run can start synchronously on
    // the wake path).
    const completion = this._awaitRunCompletion(signal.runId);
    void completion.catch(() => {});
    let admissionStartSettled = false;
    const resolveMessageAdmissionStart = () => {
      if (
        admissionStartSettled ||
        admissionStart === undefined ||
        admissionIdentity === undefined ||
        admissionHash === undefined
      ) {
        return;
      }
      admissionStartSettled = true;
      const now = Date.now();
      admissionStart.resolve({
        status: 'pending',
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId: signal.signal.id,
        runId: signal.runId,
        modeId: effectiveModeId,
        modelId: effectiveModelId,
        operationKind: 'message',
        admissionId: opts.admissionId!,
        admissionHash,
        createdAt: now,
        updatedAt: now,
      });
    };
    const rejectMessageAdmissionStart = (err: unknown) => {
      if (admissionStartSettled || admissionStart === undefined) return;
      admissionStartSettled = true;
      admissionStart.reject(err);
    };

    reportAdmissionPhase('agent_dispatched');
    // PF-2250 §1 — no post-dispatch 'pending' refresh: the pre-dispatch
    // reservation already wrote this exact row (signalId/runId are
    // admission-derived and handed to sendSignal unchanged), so the refresh was
    // a byte-identical durable write awaited on the first-token path. The
    // reservation is the durable admission barrier.

    const failDispatchedMessageTurn = async (err: unknown) => {
      turnAbortController.abort(err);
      finishOwnedMessageTurn();
      rejectMessageAdmissionStart(err);
      void completion.catch(() => {});
      const waiter = this._runCompletionPromises.get(signal.runId);
      this._runCompletionPromises.delete(signal.runId);
      this._rememberCompletedRun(signal.runId, { ok: false, err });
      waiter?.reject(err);
      if (admissionIdentity !== undefined && this._shouldWriteTurnFailureEvidence(err)) {
        this._writeMessageResultEvidenceBestEffortInBackground(
          {
            status: 'failed',
            signalId: signal.signal.id,
            runId: signal.runId,
            modeId: effectiveModeId,
            modelId: effectiveModelId,
            operationKind: 'message',
            error: projectHarnessPublicError(err),
            admissionId: opts.admissionId!,
            admissionHash: admissionHash!,
          },
          { compatibleAdmissionHashes },
        );
      }
      if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
      void this._maybeDrainQueue();
    };

    const awaitPendingMessageEvidence = async () => {
      resolveMessageAdmissionStart();
    };

    // Streaming path: hand the live `MastraModelOutput` back. The drain
    // loop is responsible for harness events; we still keep the turn
    // in-flight (so `isRunning()` reports true) until the run completes.
    if (opts.stream === true) {
      let out = agent.getRunOutput(signal.runId) as MastraModelOutput<unknown> | undefined;
      if (!out && (signal.output || admissionIdentity !== undefined)) {
        try {
          await awaitPendingMessageEvidence();
        } catch (err) {
          await failDispatchedMessageTurn(err);
          // §13.3f.1 — message({ stream: true }) is a public §4.2b boundary; the
          // pending-evidence wait can reject with a raw storage error. Redact
          // before rejecting the caller (internal waiters keep the raw err).
          throw redactPublicBoundaryRejection(err);
        }
        try {
          out = signal.output
            ? ((await Promise.race([signal.output, activeTurnWaiter.promise])) as MastraModelOutput<unknown>)
            : ((await Promise.race([
                agent.waitForRunOutput(signal.runId) as Promise<MastraModelOutput<unknown>>,
                activeTurnWaiter.promise,
                completion.then(
                  () => undefined,
                  () => undefined,
                ),
                delay(MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS).then(() => undefined),
              ])) as MastraModelOutput<unknown> | undefined);
        } catch (err) {
          finishOwnedMessageTurn();
          void completion.catch(() => {});
          const waiter = this._runCompletionPromises.get(signal.runId);
          this._runCompletionPromises.delete(signal.runId);
          this._rememberCompletedRun(signal.runId, { ok: false, err });
          waiter?.reject(err);
          if (admissionIdentity !== undefined && this._shouldWriteTurnFailureEvidence(err)) {
            this._writeMessageResultEvidenceBestEffortInBackground(
              {
                status: 'failed',
                signalId: signal.signal.id,
                runId: signal.runId,
                modeId: effectiveModeId,
                modelId: effectiveModelId,
                operationKind: 'message',
                error: projectHarnessPublicError(err),
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            );
          }
          if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
          void this._maybeDrainQueue();
          // §13.3f.1 — message({ stream: true }) is a public §4.2b boundary; the
          // run-output wait can reject with a raw provider/runtime error. Redact
          // before rejecting the caller (internal waiters keep the raw err).
          throw redactPublicBoundaryRejection(err);
        }
      }
      if (!out) {
        const err = new HarnessConfigError('message()', 'agent did not register a run for the dispatched signal');
        // Drop the completion waiter so duplicate retries do not treat an
        // unregistered run as live forever.
        await failDispatchedMessageTurn(err);
        // §13.3f.1 — public §4.2b boundary. `err` here is a construction-safe
        // HarnessConfigError, so the wrap is a pass-through; applied for parity
        // with the other stream-setup throws.
        throw redactPublicBoundaryRejection(err);
      }
      try {
        await awaitPendingMessageEvidence();
      } catch (err) {
        await failDispatchedMessageTurn(err);
        // §13.3f.1 — public §4.2b boundary; the pending-evidence wait can reject
        // with a raw storage error. Redact before rejecting the caller.
        throw redactPublicBoundaryRejection(err);
      }
      reportAdmissionPhase('output_registered');
      let streamCompletedEvidenceWriteFailed = false;
      let streamAgentEndEmitted = false;
      const streamBookkeeping = Promise.race([completion, activeTurnWaiter.promise])
        .then(async full => {
          try {
            if (full.finishReason === 'suspended') {
              await this._captureMessageSuspendWithTokenUsage(
                full,
                undefined,
                effectiveModeId,
                effectiveModelId,
                activeTurnWaiter.promise,
              );
            } else {
              const { tokenUsageAccounted } = this._recordMessageTurnCompletion(full, { persist: false });
              if (tokenUsageAccounted) {
                await Promise.race([this._persistTokenUsageOrLatch(), activeTurnWaiter.promise]);
              }
            }
          } catch (err) {
            this._latchDurableTurnFlushError(err, full);
            throw err;
          }
          if (admissionIdentity === undefined) return full;
          await Promise.race([
            this._writeMessageResultEvidence(
              {
                status: 'completed',
                signalId: signal.signal.id,
                runId: signal.runId,
                modeId: effectiveModeId,
                modelId: effectiveModelId,
                operationKind: 'message',
                result: full,
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            ).catch(err => {
              streamCompletedEvidenceWriteFailed = true;
              throw err;
            }),
            activeTurnWaiter.promise,
          ]);
          return full;
        })
        .then(async full => {
          this._emitAgentEnd({ runId: full.runId, finishReason: this._agentEndReasonForFullOutput(full), full });
          streamAgentEndEmitted = true;
          await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
        })
        .catch(err => {
          if (
            admissionIdentity !== undefined &&
            !streamCompletedEvidenceWriteFailed &&
            this._shouldWriteTurnFailureEvidence(err)
          ) {
            void this._writeMessageResultEvidence(
              {
                status: 'failed',
                signalId: signal.signal.id,
                runId: signal.runId,
                modeId: effectiveModeId,
                modelId: effectiveModelId,
                operationKind: 'message',
                error: projectHarnessPublicError(err),
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            ).catch(() => {});
          }
          if (!streamAgentEndEmitted) {
            this._emitTurnEvent({
              type: 'agent_end',
              finishReason: turnAbortSignal.aborted ? 'aborted' : 'error',
              runId: signal.runId,
              usage: this._runUsage(),
            });
          }
          // The caller owns the visible stream; swallow drain-side errors.
        })
        .finally(() => {
          if (opts.admissionId !== undefined) this._deleteMessageAdmissionStartSoon(opts.admissionId);
          finishOwnedMessageTurn();
          void this._maybeDrainQueue();
        });
      void this._trackBackgroundTurnCompletion(streamBookkeeping);
      return out;
    }

    // Default path: wait for stream startup and the completion watcher to
    // deliver this run's bundled `FullOutput`, then run post-turn bookkeeping.
    let streamStarted = signal.output === undefined;
    let completedEvidenceWriteFailed = false;
    let agentEndEmitted = false;
    try {
      // The pre-dispatch reservation is the durable admission barrier here;
      // completion evidence remains the authoritative default-path result.
      resolveMessageAdmissionStart();
      if (signal.output) {
        await Promise.race([signal.output, activeTurnWaiter.promise]);
        streamStarted = true;
      }
      const full = await Promise.race([completion, activeTurnWaiter.promise]);
      try {
        if (full.finishReason === 'suspended') {
          await this._captureMessageSuspendWithTokenUsage(
            full,
            undefined,
            effectiveModeId,
            effectiveModelId,
            activeTurnWaiter.promise,
          );
        } else {
          const { tokenUsageAccounted } = this._recordMessageTurnCompletion(full, { persist: false });
          if (tokenUsageAccounted) {
            await Promise.race([this._persistTokenUsageOrLatch(), activeTurnWaiter.promise]);
          }
        }
        if (admissionIdentity !== undefined) {
          await Promise.race([
            this._writeMessageResultEvidenceBestEffort(
              {
                status: 'completed',
                signalId: signal.signal.id,
                runId: signal.runId,
                modeId: effectiveModeId,
                modelId: effectiveModelId,
                operationKind: 'message',
                result: full,
                admissionId: opts.admissionId!,
                admissionHash: admissionHash!,
              },
              { compatibleAdmissionHashes },
            ).catch(err => {
              completedEvidenceWriteFailed = true;
              throw err;
            }),
            activeTurnWaiter.promise,
          ]);
        }
      } catch (err) {
        throw err;
      }
      this._emitAgentEnd({ runId: full.runId, finishReason: this._agentEndReasonForFullOutput(full), full });
      agentEndEmitted = true;
      await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
      return full;
    } catch (err) {
      if (!streamStarted) {
        void completion.catch(() => {});
        const waiter = this._runCompletionPromises.get(signal.runId);
        this._runCompletionPromises.delete(signal.runId);
        this._rememberCompletedRun(signal.runId, { ok: false, err });
        waiter?.reject(err);
      }
      if (
        admissionIdentity !== undefined &&
        !completedEvidenceWriteFailed &&
        this._shouldWriteTurnFailureEvidence(err)
      ) {
        await Promise.race([
          this._writeMessageResultEvidence(
            {
              status: 'failed',
              signalId: signal.signal.id,
              runId: signal.runId,
              modeId: effectiveModeId,
              modelId: effectiveModelId,
              operationKind: 'message',
              error: projectHarnessPublicError(err),
              admissionId: opts.admissionId!,
              admissionHash: admissionHash!,
            },
            { compatibleAdmissionHashes },
          ).catch(() => {}),
          activeTurnWaiter.promise,
        ]);
      }
      if (!agentEndEmitted) {
        this._emitTurnEvent({
          type: 'agent_end',
          finishReason: turnAbortSignal.aborted ? 'aborted' : 'error',
          runId: signal.runId,
          usage: this._runUsage(),
        });
      }
      // §13.3f.1 — `message()` is a public §4.2b boundary; its promise
      // rejection must not leak raw provider/driver/SQL/path text. Redact a raw
      // cause into a `HarnessExecutionError` (safe `.message`, raw `.cause`
      // local-only); Harness-own errors pass through with their typed message.
      // The wire/event/durable surfaces are unchanged (they already project via
      // `projectHarnessPublicError`, which maps both shapes to `harness.internal`).
      throw redactPublicBoundaryRejection(err);
    } finally {
      if (opts.admissionId !== undefined) this._messageAdmissionStarts.delete(opts.admissionId);
      finishOwnedMessageTurn();
      // Now that the manual turn has cleared the in-flight guard, kick
      // the queue drain so any item that was admitted mid-turn can run.
      void this._maybeDrainQueue();
    }
  }

  /**
   * Admit a default message turn and return the durable signal identity
   * without awaiting the eventual AgentResult. Remote HTTP routes use this
   * surface to preserve local `message(...)` promise semantics in the SDK:
   * the POST only proves admission, and SSE/result lookup settle the result.
   */
  async admitMessage(opts: MessageOptionsDefault): Promise<MessageAdmissionResult> {
    this._assertLive('admitMessage()');
    const logicalMessageIdentity = normalizeSessionLogicalMessageIdentity(
      opts.logicalMessageIdentity,
      'admitMessage()',
    );
    const admittedOpts = {
      ...opts,
      ...(logicalMessageIdentity === undefined ? {} : { logicalMessageIdentity }),
    };
    if (opts.admissionId === undefined || opts.admissionId.length === 0) {
      throw new HarnessValidationError('admitMessage().admissionId', 'admissionId must be a non-empty string');
    }
    if (opts.output !== undefined || opts.sync !== undefined || opts.stream !== undefined) {
      throw new HarnessConfigError('admitMessage()', 'admitMessage only accepts default message options');
    }
    if (opts.additionalTools !== undefined) {
      throw new HarnessValidationError(
        'admitMessage().admissionId',
        'admissionId cannot be combined with additionalTools',
      );
    }

    const effectiveModeId = opts.mode ?? this._record.modeId;
    const admissionHashes = this._computeMessageAdmissionHashes(admittedOpts, {
      modeId: effectiveModeId,
      modelId: opts.model ?? this._record.modelId,
    });
    const duplicate = await this._resolveMessageAdmissionDuplicate({
      admissionId: opts.admissionId,
      admissionHash: admissionHashes.primary,
      compatibleAdmissionHashes: admissionHashes.legacyCompatible,
    });
    if (duplicate) {
      this._assertOpenForTurn('admitMessage()');
      const signalId = duplicate.signalId;
      if (signalId === undefined) {
        throw new HarnessValidationError('admitMessage().admissionId', 'duplicate message result evidence has expired');
      }
      return {
        accepted: true,
        signalId,
        ...(duplicate.runId !== undefined ? { runId: duplicate.runId } : {}),
        duplicate: true,
      };
    }

    const existingStart = this._messageAdmissionStarts.get(opts.admissionId);
    if (existingStart) {
      if (existingStart.admissionHash !== admissionHashes.primary) {
        throw new HarnessAdmissionConflictError(
          this.id,
          opts.admissionId,
          existingStart.admissionHash,
          admissionHashes.primary,
        );
      }
      const evidence = await existingStart.promise;
      const signalId = evidence.signalId;
      if (signalId === undefined) {
        throw new HarnessValidationError('admitMessage().admissionId', 'message admission evidence has expired');
      }
      return {
        accepted: true,
        signalId,
        ...(evidence.runId !== undefined ? { runId: evidence.runId } : {}),
        duplicate: true,
      };
    }

    const streamPromise = this.message({ ...admittedOpts, stream: true });
    void streamPromise.catch(() => {});
    const admissionStart = await this._waitForMessageAdmissionStart(opts.admissionId, streamPromise);
    const evidence =
      admissionStart.started !== undefined
        ? await admissionStart.started.promise
        : await this._resolveMessageAdmissionDuplicate({
            admissionId: opts.admissionId,
            admissionHash: admissionHashes.primary,
            compatibleAdmissionHashes: admissionHashes.legacyCompatible,
          });
    if (evidence === undefined && admissionStart.streamError !== undefined) {
      throw admissionStart.streamError;
    }
    if (evidence === undefined) {
      throw new HarnessConfigError('admitMessage()', 'message admission evidence was not recorded');
    }
    const signalId = evidence.signalId;
    if (signalId === undefined) {
      throw new HarnessValidationError('admitMessage().admissionId', 'message admission evidence has expired');
    }
    return {
      accepted: true,
      signalId,
      ...(evidence.runId !== undefined ? { runId: evidence.runId } : {}),
      duplicate: admissionStart.started === undefined || admissionStart.started.duplicate === true,
    };
  }

  private async _waitForMessageAdmissionStart(
    admissionId: string,
    streamPromise: Promise<unknown>,
  ): Promise<{ started?: MessageAdmissionStart; streamError?: unknown }> {
    const settled: { status: 'pending' | 'fulfilled' | 'rejected'; error?: unknown } = { status: 'pending' };
    void streamPromise.then(
      () => {
        settled.status = 'fulfilled';
      },
      error => {
        settled.status = 'rejected';
        settled.error = error;
      },
    );

    while (true) {
      const started = this._messageAdmissionStarts.get(admissionId);
      if (started) return { started };
      if (settled.status === 'rejected') return { streamError: settled.error };
      if (settled.status === 'fulfilled') {
        return {};
      }
      await delay(0);
    }
  }

  private _deleteMessageAdmissionStartSoon(admissionId: string): void {
    const timer = setTimeout(() => {
      this._messageAdmissionStarts.delete(admissionId);
    }, 0);
    timer.unref?.();
  }

  private async _resolveMessageAdmissionDuplicate({
    admissionId,
    admissionHash,
    compatibleAdmissionHashes,
  }: {
    admissionId: string;
    admissionHash: string;
    compatibleAdmissionHashes?: readonly string[];
  }): Promise<AgentSignalResultEvidence | OperationAdmissionTombstone | undefined> {
    const resolved = await this._storage.resolveOperationAdmissionEvidence({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      kind: 'signal',
      admissionId,
      attemptedAdmissionHash: admissionHash,
    });
    if (resolved.status === 'none') return undefined;
    if (resolved.status === 'conflict') {
      if (
        resolved.storedAdmissionHash !== undefined &&
        compatibleAdmissionHashes?.includes(resolved.storedAdmissionHash)
      ) {
        return resolved.evidence as AgentSignalResultEvidence | OperationAdmissionTombstone | undefined;
      }
      throw new HarnessAdmissionConflictError(this.id, admissionId, resolved.storedAdmissionHash ?? '', admissionHash);
    }
    return resolved.evidence as AgentSignalResultEvidence | OperationAdmissionTombstone | undefined;
  }

  private async _returnDuplicateMessageResult(
    evidence: AgentSignalResultEvidence | OperationAdmissionTombstone,
    opts: MessageOptions,
  ): Promise<AgentResult | AgentStream | unknown> {
    return this._withActiveDeletedWaiter(async activeDeleted => {
      if ('status' in evidence) {
        if (opts.stream === true) {
          if (evidence.status === 'pending') {
            const duplicateModeId = this._messageDuplicateModeId(evidence, opts);
            const duplicateModelId = this._messageDuplicateModelId(evidence, opts);
            const agent = this._harness.getAgentForMode(duplicateModeId);
            await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeDeleted);
            const runId = await this._pendingMessageRunId(evidence);
            if (runId && this._completedRuns.has(runId)) {
              const cached = this._completedRuns.get(runId);
              if (cached?.ok && evidence.admissionId !== undefined && evidence.admissionHash !== undefined) {
                await this._prepareCachedDuplicateMessageCompletion(cached.full, evidence, opts, activeDeleted);
                await this._writeMessageResultEvidenceBestEffort({
                  status: 'completed',
                  signalId: evidence.signalId,
                  runId,
                  modeId: duplicateModeId,
                  modelId: duplicateModelId,
                  operationKind: 'message',
                  result: cached.full,
                  admissionId: evidence.admissionId,
                  admissionHash: evidence.admissionHash,
                });
              }
              throw new HarnessValidationError('message().admissionId', 'duplicate stream is no longer live');
            }
            let output = runId ? (agent.getRunOutput(runId) as AgentStream | undefined) : undefined;
            let retainedCompletedOutput = false;
            if (
              output &&
              (output as { status?: string }).status !== undefined &&
              (output as { status?: string }).status !== 'running'
            ) {
              retainedCompletedOutput = true;
              output = undefined;
            }
            if (runId && !output && !retainedCompletedOutput) {
              const waitAbortController = new AbortController();
              const completion = this._runCompletionPromises.get(runId)?.promise.then(
                () => undefined,
                () => undefined,
              );
              try {
                output = (await Promise.race([
                  this._raceActiveTurnWaiter(
                    (
                      agent.waitForRunOutput(runId, { abortSignal: waitAbortController.signal }) as Promise<AgentStream>
                    ).catch(() => undefined),
                    activeDeleted,
                  ),
                  ...(completion ? [completion] : []),
                  delay(MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS, waitAbortController.signal).then(
                    () => undefined,
                    () => undefined,
                  ),
                ])) as AgentStream | undefined;
              } finally {
                waitAbortController.abort(
                  new HarnessValidationError('message().admissionId', 'duplicate stream wait ended'),
                );
              }
            }
            if (output) return output;
          }
          throw new HarnessValidationError('message().admissionId', 'duplicate stream is no longer live');
        }
        if (evidence.status === 'completed') return evidence.result as AgentResult;
        if (evidence.status === 'failed') throw publicErrorProjectionToError(evidence.error);
        const runId = await this._pendingMessageRunId(evidence);
        if (runId) {
          const duplicateModeId = this._messageDuplicateModeId(evidence, opts);
          const duplicateModelId = this._messageDuplicateModelId(evidence, opts);
          const agent = this._harness.getAgentForMode(duplicateModeId);
          await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeDeleted);
          const cached = this._completedRuns.get(runId);
          if (cached) {
            if (!cached.ok) throw cached.err;
            if (evidence.admissionId !== undefined && evidence.admissionHash !== undefined) {
              await this._prepareCachedDuplicateMessageCompletion(cached.full, evidence, opts, activeDeleted);
              await this._writeMessageResultEvidenceBestEffort({
                status: 'completed',
                signalId: evidence.signalId,
                runId,
                modeId: duplicateModeId,
                modelId: duplicateModelId,
                operationKind: 'message',
                result: cached.full,
                admissionId: evidence.admissionId,
                admissionHash: evidence.admissionHash,
              });
            }
            return cached.full;
          }
          if (!this._hasLiveMessageRun(agent, runId)) {
            return this._raceActiveTurnWaiter(this._awaitDurableMessageResult(evidence, opts), activeDeleted);
          }
          return this._raceActiveTurnWaiter(this._awaitRunCompletion(runId), activeDeleted);
        }
      }
      throw new HarnessValidationError('message().admissionId', 'duplicate message result evidence has expired');
    });
  }

  private async _prepareCachedDuplicateMessageCompletion(
    full: FullOutput<unknown>,
    evidence: AgentSignalResultEvidence,
    opts: MessageOptions,
    activeDeleted?: Promise<never>,
  ): Promise<void> {
    if (full.finishReason === 'suspended') {
      await this._captureMessageSuspendWithTokenUsage(
        full,
        undefined,
        this._messageDuplicateModeId(evidence, opts),
        this._messageDuplicateModelId(evidence, opts),
        activeDeleted,
      );
      return;
    }

    const { tokenUsageAccounted } = this._recordMessageTurnCompletion(full, { persist: false });
    if (tokenUsageAccounted) {
      await this._raceActiveTurnWaiter(this._persistTokenUsageOrLatch(), activeDeleted);
    }
  }

  private async _pendingMessageRunId(evidence: AgentSignalResultEvidence): Promise<string | undefined> {
    if (evidence.status !== 'pending') return evidence.runId;
    const starting = evidence.admissionId ? this._messageAdmissionStarts.get(evidence.admissionId) : undefined;
    if (!starting) return evidence.runId;
    try {
      const startingEvidence = await starting.promise;
      return startingEvidence.runId ?? evidence.runId;
    } catch {
      return evidence.runId;
    }
  }

  private _messageDuplicateModeId(evidence: AgentSignalResultEvidence, opts: MessageOptions): string {
    const starting = evidence.admissionId ? this._messageAdmissionStarts.get(evidence.admissionId) : undefined;
    return starting?.modeId ?? evidence.modeId ?? opts.mode ?? this._record.modeId;
  }

  private _messageDuplicateModelId(evidence: AgentSignalResultEvidence, opts: MessageOptions): string {
    const starting = evidence.admissionId ? this._messageAdmissionStarts.get(evidence.admissionId) : undefined;
    return starting?.modelId ?? evidence.modelId ?? opts.model ?? this._record.modelId;
  }

  private _hasLiveMessageRun(agent: Agent, runId: string): boolean {
    return Boolean(
      agent.getRunOutput(runId) || this._runCompletionPromises.has(runId) || this._completedRuns.has(runId),
    );
  }

  private async _awaitDurableMessageResult(
    evidence: AgentSignalResultEvidence,
    opts: MessageOptions,
  ): Promise<AgentResult> {
    const deadline = Date.now() + MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS;
    while (true) {
      throwIfAborted(opts.abortSignal, 'message().admissionId');
      const latest = await this._storage.loadMessageResultEvidence({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId: evidence.signalId,
      });
      if (!latest) {
        throw new HarnessValidationError('message().admissionId', 'duplicate message result evidence has expired');
      }
      if ('status' in latest) {
        if (latest.status === 'completed') return latest.result as AgentResult;
        if (latest.status === 'failed') throw publicErrorProjectionToError(latest.error);
      } else {
        throw new HarnessValidationError('message().admissionId', 'duplicate message result evidence has expired');
      }
      if (Date.now() >= deadline) {
        throw new HarnessValidationError('message().admissionId', 'pending message admission is not live');
      }
      await delay(MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS, opts.abortSignal);
    }
  }

  private _messageAdmissionIdentity(admissionId: string): MessageAdmissionIdentity {
    const digest = sha256CanonicalJson({
      kind: 'message-admission',
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      admissionId,
    });
    return {
      signalId: `harness-message-${digest.slice(0, 32)}`,
      runId: `harness-message-${digest.slice(32, 64)}`,
    };
  }

  /**
   * Deterministic identity for a caller-admitted `signal()` operation. Active
   * delivery reuses the already-running run id; an idle wake uses `idleRunId`.
   * Keeping both values deterministic lets a retry distinguish the two routing
   * shapes from durable evidence without adding another receipt store.
   *
   * The signal-id prefix predates the public admission surface and is retained
   * so channel-ingress retries admitted by older processes resolve the same row.
   */
  private _signalAdmissionIdentity(admissionId: string): SignalAdmissionIdentity {
    const digest = sha256CanonicalJson({
      kind: 'channel-signal-admission',
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      admissionId,
    });
    return {
      signalId: `harness-channel-signal-${digest.slice(0, 32)}`,
      idleRunId: `harness-channel-wake-${digest.slice(32, 64)}`,
    };
  }

  private async _writeMessageResultEvidence(
    status: AgentSignalResultStatus & { admissionId?: string; admissionHash?: string },
    options?: { compatibleAdmissionHashes?: readonly string[] },
  ): Promise<{
    created: boolean;
    applied: boolean;
    evidence?: AgentSignalResultEvidence | OperationAdmissionTombstone;
  }> {
    if (status.admissionId !== undefined && status.admissionHash !== undefined && status.operationKind === undefined) {
      throw new Error(
        `Invalid Harness admission evidence for session "${this.id}" signal "${status.signalId}": operationKind is required`,
      );
    }
    const now = Date.now();
    this._operationEvidenceSignalIds.add(status.signalId);
    try {
      const evidence: AgentSignalResultEvidence = {
        ...status,
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        createdAt: now,
        updatedAt: now,
      };
      const result = await this._storage.writeMessageResultEvidence(evidence);
      await this._cleanupOperationEvidenceIfDeleted(status);
      return result.created ? { created: true, applied: result.applied, evidence } : result;
    } catch (err) {
      if (err instanceof HarnessStorageAdmissionConflictError && status.admissionId && status.admissionHash) {
        const duplicate = await this._resolveMessageAdmissionDuplicate({
          admissionId: status.admissionId,
          admissionHash: status.admissionHash,
          compatibleAdmissionHashes: options?.compatibleAdmissionHashes,
        });
        if (duplicate) return { created: false, applied: false, evidence: duplicate };
        throw new HarnessAdmissionConflictError(this.id, status.admissionId, '', status.admissionHash);
      }
      throw err;
    }
  }

  private async _cleanupOperationEvidenceIfDeleted(status: { signalId: string }): Promise<void> {
    if (this._state !== 'deleted') return;
    await this._storage
      .deleteOperationAdmissionTombstonesForSession({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId: status.signalId,
      })
      .catch(() => {});
  }

  private async _writeMessageResultEvidenceBestEffort(
    status: AgentSignalResultStatus & { admissionId?: string; admissionHash?: string },
    options?: { compatibleAdmissionHashes?: readonly string[] },
  ): Promise<
    | {
        created: boolean;
        applied: boolean;
        evidence?: AgentSignalResultEvidence | OperationAdmissionTombstone;
      }
    | undefined
  > {
    try {
      return await this._writeMessageResultEvidence(status, options);
    } catch (err) {
      if (status.admissionId !== undefined) throw err;
      // The initial pre-dispatch admission reservation is the durable barrier.
      // Non-idempotent callers have no durable replay contract, so storage
      // evidence is only best-effort for them.
    }
  }

  private _writeMessageResultEvidenceBestEffortInBackground(
    status: AgentSignalResultStatus & { admissionId?: string; admissionHash?: string },
    options?: { compatibleAdmissionHashes?: readonly string[] },
  ): void {
    const write = this._writeMessageResultEvidenceBestEffort(status, options);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>(resolve => {
      timer = setTimeout(resolve, MESSAGE_RESULT_EVIDENCE_BACKGROUND_OBSERVE_TIMEOUT_MS);
      timer.unref?.();
    });
    void Promise.race([write, timeout])
      .catch(() => {})
      .finally(() => {
        if (timer !== undefined) clearTimeout(timer);
      });
  }

  /**
   * §4.2f / §10.2 signal-result boundary. Settle the durable per-`signalId`
   * result evidence and project the matching OperationEvent. Owned-turn (1:1)
   * signals call this from the run terminal — the run's output IS the answer
   * attributable to that signal, so `agent_end` is *not* the settlement
   * boundary; `signal_completed` / `signal_failed` are. Evidence is best-effort
   * for non-`admissionId` callers (the run terminal is the live settlement and
   * `lookupMessageResult(signalId)` is the durable recovery path).
   *
   * Interleaved active-run signals ALSO settle through this helper, but with a
   * documented caveat: a run can answer several drained signals, so each
   * interleaved `signalId` is currently settled from the SHARED run terminal
   * (a run-aggregate result, not a per-segment distinct answer). This is the
   * interim until the runtime emits per-signal terminal markers
   * (`AgentThreadStreamRuntime` per-segment attribution); the alternative —
   * leaving interleaved evidence `pending` forever — is worse for recovery, so
   * the shared-run terminal is used as the best available answer. See the
   * call-site comment in `signal()`'s active-delivery path.
   */
  private _settleSignalResult(
    signalId: string,
    outcome:
      | { status: 'completed'; runId: string; result: AgentResult }
      | { status: 'failed'; runId?: string; error: { code: string; message: string } },
    admission?: SignalSettlementAdmission,
  ): Promise<AgentSignalResultEvidence | undefined> {
    const inFlight = this._signalResultSettlements.get(signalId);
    if (inFlight !== undefined) return inFlight;
    const settlement = this._settleSignalResultOnce(signalId, outcome, admission).finally(() => {
      if (this._signalResultSettlements.get(signalId) === settlement) {
        this._signalResultSettlements.delete(signalId);
      }
    });
    this._signalResultSettlements.set(signalId, settlement);
    return settlement;
  }

  private async _settleSignalResultOnce(
    signalId: string,
    outcome:
      | { status: 'completed'; runId: string; result: AgentResult }
      | { status: 'failed'; runId?: string; error: { code: string; message: string } },
    admission?: SignalSettlementAdmission,
  ): Promise<AgentSignalResultEvidence | undefined> {
    // A signal-owned run can suspend and later resume through a rehydrated
    // Session. `PendingResume` intentionally carries only the public
    // correlation signal id, so recover the private admission identity from
    // its durable evidence before terminalizing. Without this, the storage
    // identity fence rejects the terminal update and the admitted row remains
    // pending forever. Non-admitted signal ids keep their historical
    // best-effort behavior.
    let retainedAdmission = admission;
    if (retainedAdmission === undefined) {
      const retained = await this._storage.loadMessageResultEvidence({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId,
      });
      if (retained && 'status' in retained) {
        if (retained.status === 'completed' || retained.status === 'failed') {
          return retained as AgentSignalResultEvidence;
        }
        const admitted = retained as AgentSignalResultEvidence;
        if (admitted.admissionId !== undefined && admitted.admissionHash !== undefined) {
          const identity = this._signalAdmissionIdentity(admitted.admissionId);
          retainedAdmission = {
            admissionId: admitted.admissionId,
            admissionHash: admitted.admissionHash,
            modeId: admitted.modeId ?? this._record.modeId,
            modelId: admitted.modelId ?? this._record.modelId,
            dispatch: this._signalDispatchState(admitted, identity),
          };
        }
      }
    }
    if (retainedAdmission !== undefined) {
      // Reserved admissions and synchronous pre-dispatch failures remain
      // retryable. Only a concrete dispatch attempt can own terminal evidence.
      if (retainedAdmission.dispatch.state === 'reserved') {
        const retained = await this._storage.loadMessageResultEvidence({
          harnessName: this._record.harnessName,
          sessionId: this.id,
          resourceId: this.resourceId,
          threadId: this.threadId,
          signalId,
        });
        return retained && 'status' in retained ? (retained as AgentSignalResultEvidence) : undefined;
      }
      const terminal =
        outcome.status === 'completed'
          ? {
              status: 'completed' as const,
              signalId,
              runId: outcome.runId,
              result: outcome.result,
              modeId: retainedAdmission.modeId,
              modelId: retainedAdmission.modelId,
            }
          : {
              status: 'failed' as const,
              signalId,
              ...(outcome.runId !== undefined ? { runId: outcome.runId } : {}),
              error: outcome.error,
              modeId: retainedAdmission.modeId,
              modelId: retainedAdmission.modelId,
            };
      const write = await this._storage.compareAndSwapSignalTerminal({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId,
        admissionId: retainedAdmission.admissionId,
        admissionHash: retainedAdmission.admissionHash,
        expected: retainedAdmission.dispatch,
        terminal,
        updatedAt: Date.now(),
      });
      await this._cleanupOperationEvidenceIfDeleted({ signalId });
      // The loser adopts the durable winner by returning without rewriting or
      // projecting its stale run/result as the operation terminal.
      if (!write.applied) return write.evidence;
      if (outcome.status === 'completed') {
        this._emit({ type: 'signal_completed', runId: outcome.runId, signalId, result: outcome.result });
      } else {
        this._emit({
          type: 'signal_failed',
          signalId,
          ...(outcome.runId !== undefined ? { runId: outcome.runId } : {}),
          error: outcome.error,
        });
      }
      return write.evidence;
    } else if (outcome.status === 'completed') {
      await this._writeMessageResultEvidenceBestEffort({
        status: 'completed',
        signalId,
        runId: outcome.runId,
        result: outcome.result,
      });
    } else {
      await this._writeMessageResultEvidenceBestEffort({
        status: 'failed',
        signalId,
        ...(outcome.runId !== undefined ? { runId: outcome.runId } : {}),
        error: outcome.error,
      });
    }
    if (outcome.status === 'completed') {
      this._emit({ type: 'signal_completed', runId: outcome.runId, signalId, result: outcome.result });
      return;
    }
    this._emit({
      type: 'signal_failed',
      signalId,
      ...(outcome.runId !== undefined ? { runId: outcome.runId } : {}),
      error: outcome.error,
    });
    return undefined;
  }

  /** Resolve every local handle from the terminal evidence that won durable CAS. */
  private async _adoptSignalSettlement(
    signalId: string,
    evidence: AgentSignalResultEvidence | undefined,
    local: { status: 'completed'; result: AgentResult } | { status: 'failed'; error: unknown },
    abortSignal?: AbortSignal,
  ): Promise<AgentResult> {
    if (evidence === undefined) {
      if (local.status === 'completed') return local.result;
      throw local.error;
    }
    if (evidence.status === 'completed') return evidence.result as AgentResult;
    if (evidence.status === 'failed') throw publicErrorProjectionToError(evidence.error);
    return this._awaitDurableSignalResult({ signalId }, abortSignal, { waitIndefinitely: true });
  }

  private _computeMessageAdmissionHashes(
    opts: MessageOptions,
    stable: { modeId: string; modelId: string },
    persistedRequestContext?: PersistedRequestContextInput,
  ): MessageAdmissionHashes {
    const primary = sha256CanonicalJson(
      this._messageAdmissionHashInput(opts, undefined, { hashVersion: 2 }, persistedRequestContext),
    );
    // Pre-v2 evidence hashed the effective mode/model. Keep compatibility
    // candidates for the current effective tuple only; old evidence does not
    // persist enough metadata to safely infer previous defaults after drift.
    const legacyCompatible = [
      sha256CanonicalJson(this._messageAdmissionHashInput(opts, stable, undefined, persistedRequestContext)),
      sha256CanonicalJson(
        this._messageAdmissionHashInput(opts, stable, { includeAttachmentMetadata: false }, persistedRequestContext),
      ),
    ];
    return {
      primary,
      legacyCompatible: [...new Set(legacyCompatible)].filter(hash => hash !== primary),
    };
  }

  private _messageAdmissionHashInput(
    opts: MessageOptions,
    stable?: { modeId: string; modelId: string },
    options?: { hashVersion?: number; includeAttachmentMetadata?: boolean },
    persistedRequestContext?: PersistedRequestContextInput,
  ) {
    return {
      // Operation-kind discriminator in the admission hash (signal vs queue);
      // §5.1d token is `'signal'`. Distinct from the queue path's `kind: 'queue'`.
      kind: 'signal',
      ...(options?.hashVersion !== undefined ? { hashVersion: options.hashVersion } : {}),
      content: opts.content,
      ...(stable !== undefined
        ? { mode: stable.modeId, model: stable.modelId }
        : {
            ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
            ...(opts.model !== undefined ? { model: opts.model } : {}),
          }),
      ...(opts.modelSettings !== undefined ? { modelSettings: opts.modelSettings } : {}),
      ...(opts.logicalMessageIdentity !== undefined
        ? { logicalMessageIdentity: { ...opts.logicalMessageIdentity } }
        : {}),
      attachments: (opts.attachments ?? []).map(attachment => ({
        attachmentId: attachment.attachmentId,
        resourceId: attachment.resourceId,
        ...(attachment.ownerSessionId !== undefined ? { ownerSessionId: attachment.ownerSessionId } : {}),
        ...(attachment.bytes !== undefined ? { bytes: attachment.bytes } : {}),
        ...(attachment.sha256 !== undefined ? { sha256: attachment.sha256 } : {}),
        ...(attachment.source !== undefined ? { source: attachment.source } : {}),
        ...(options?.includeAttachmentMetadata !== false
          ? {
              ...(attachment.kind !== undefined ? { kind: attachment.kind } : {}),
              ...(attachment.name !== undefined ? { name: attachment.name } : {}),
              ...(attachment.mimeType !== undefined ? { mimeType: attachment.mimeType } : {}),
              ...(attachment.primitiveType !== undefined ? { primitiveType: attachment.primitiveType } : {}),
              ...(attachment.elementType !== undefined ? { elementType: attachment.elementType } : {}),
              ...(attachment.renderer !== undefined ? { renderer: attachment.renderer } : {}),
              ...(attachment.schemaId !== undefined ? { schemaId: attachment.schemaId } : {}),
              ...(attachment.metadata !== undefined ? { metadata: cloneAttachmentMetadata(attachment.metadata) } : {}),
              ...(attachment.object !== undefined ? { object: attachment.object } : {}),
            }
          : {}),
      })),
      // §4.4c / §5.1: caller request context is part of admission identity when
      // present. Absent => omitted => the hash is byte-identical to pre-feature
      // evidence (backward-compatible). Mirrors the queue path's requestContext.
      ...(persistedRequestContext ? { requestContext: clonePersistedRequestContext(persistedRequestContext) } : {}),
    };
  }

  private _computeSignalAdmissionHash(
    opts: Pick<SessionSignalOptions, 'content' | 'mode' | 'logicalMessageIdentity'>,
    attachments: PersistedAttachment[],
    requestContext?: PersistedRequestContextInput,
  ): string {
    return sha256CanonicalJson({
      kind: 'signal',
      content: opts.content,
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.logicalMessageIdentity !== undefined
        ? { logicalMessageIdentity: { ...opts.logicalMessageIdentity } }
        : {}),
      attachments: attachments.map(attachment => ({
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        ...(attachment.kind === 'ref'
          ? {
              attachmentId: attachment.attachmentId,
              resourceId: this.resourceId,
              ownerSessionId: attachment.ownerSessionId,
              bytes: attachment.bytes,
              sha256: attachment.sha256,
              source: attachment.source,
              attachmentKind: attachment.attachmentKind ?? 'file',
              ...(attachment.primitiveType ? { primitiveType: attachment.primitiveType } : {}),
              ...(attachment.elementType ? { elementType: attachment.elementType } : {}),
              ...(attachment.renderer ? { renderer: attachment.renderer } : {}),
              ...(attachment.schemaId ? { schemaId: attachment.schemaId } : {}),
              ...(attachment.metadata ? { metadata: cloneAttachmentMetadata(attachment.metadata) } : {}),
              ...(attachment.object ? { object: attachment.object } : {}),
            }
          : { url: attachment.url }),
      })),
      ...(requestContext ? { requestContext: clonePersistedRequestContext(requestContext) } : {}),
    });
  }

  private _signalAdmissionCanRedispatch(
    evidence: AgentSignalResultEvidence | OperationAdmissionTombstone | undefined,
  ): boolean {
    // Every non-terminal receipt re-enters the durable dispatch state machine.
    // `dispatching` receipts wait/reclaim by claim expiry; `accepted` receipts
    // attach to a live run or take the explicit idle-recovery/active-loss path.
    // Neither state is exposed as accepted merely because it carries a run id.
    return evidence !== undefined && 'status' in evidence && evidence.status === 'pending';
  }

  private _signalDispatchState(
    evidence: AgentSignalResultEvidence,
    identity: SignalAdmissionIdentity,
  ): AgentSignalDispatchState {
    if (evidence.dispatch !== undefined) return evidence.dispatch;
    if (evidence.runId !== undefined) {
      // Rows written before durable dispatch fencing already treated a persisted
      // run id as accepted. Preserve that recovery meaning without allowing new
      // unfenced writes to take this compatibility path.
      return {
        state: 'accepted',
        attemptId: 'legacy',
        delivery: evidence.runId === identity.idleRunId ? 'idle' : 'active',
        runId: evidence.runId,
        acceptedAt: evidence.updatedAt,
      };
    }
    return { state: 'reserved' };
  }

  private async _compareAndSwapSignalDispatch(
    admission: SignalAdmission,
    expected: AgentSignalDispatchState,
    next: AgentSignalDispatchState,
  ): Promise<{ applied: boolean; evidence: AgentSignalResultEvidence }> {
    const result = await this._storage.compareAndSwapSignalDispatch({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      signalId: admission.identity.signalId,
      admissionId: admission.admissionId,
      admissionHash: admission.admissionHash,
      expected,
      next,
      updatedAt: Date.now(),
    });
    admission.dispatch = this._signalDispatchState(result.evidence, admission.identity);
    return result;
  }

  private async _loadSignalAdmissionEvidence(admission: SignalAdmission): Promise<AgentSignalResultEvidence> {
    const loaded = await this._storage.loadMessageResultEvidence({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      signalId: admission.identity.signalId,
    });
    if (!loaded || !('status' in loaded)) {
      throw new HarnessValidationError('signal().admissionId', 'signal admission evidence has expired');
    }
    const evidence = loaded as AgentSignalResultEvidence;
    admission.dispatch = this._signalDispatchState(evidence, admission.identity);
    return evidence;
  }

  private async _claimSignalDispatch(
    admission: SignalAdmission,
    planned: { delivery: 'idle' | 'active'; runId: string },
    canAttachRun: (runId: string) => boolean,
    isRunActive: (runId: string) => boolean,
    abortSignal?: AbortSignal,
  ): Promise<
    | { kind: 'owned'; dispatch: SignalDispatchingState; recoveringAccepted: boolean }
    | { kind: 'duplicate'; evidence: AgentSignalResultEvidence }
    | { kind: 'active-lost'; dispatch: SignalDispatchingState }
  > {
    let evidence = await this._loadSignalAdmissionEvidence(admission);
    while (true) {
      throwIfAborted(abortSignal, 'signal().admissionId');
      if (evidence.status !== 'pending') return { kind: 'duplicate', evidence };
      const dispatch = this._signalDispatchState(evidence, admission.identity);
      if (dispatch.state === 'accepted') {
        if (canAttachRun(dispatch.runId)) return { kind: 'duplicate', evidence };
        const recoverAt = dispatch.acceptedAt + SIGNAL_ACCEPTED_RECOVERY_STALE_MS;
        if (Date.now() < recoverAt) {
          await delay(Math.min(MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS, recoverAt - Date.now()), abortSignal);
          evidence = await this._loadSignalAdmissionEvidence(admission);
          continue;
        }
        const reclaimed: SignalDispatchingState = {
          state: 'dispatching',
          attemptId: `signal-dispatch-${randomUUID()}`,
          claimExpiresAt: Date.now() + SIGNAL_DISPATCH_CLAIM_TTL_MS,
          delivery: dispatch.delivery,
          runId: dispatch.runId,
        };
        const swapped = await this._compareAndSwapSignalDispatch(admission, dispatch, reclaimed);
        if (swapped.evidence.status !== 'pending') return { kind: 'duplicate', evidence: swapped.evidence };
        if (!swapped.applied) {
          evidence = swapped.evidence;
          continue;
        }
        return dispatch.delivery === 'active'
          ? { kind: 'active-lost', dispatch: reclaimed }
          : { kind: 'owned', dispatch: reclaimed, recoveringAccepted: true };
      }
      if (dispatch.state === 'dispatching' && dispatch.claimExpiresAt > Date.now()) {
        await delay(
          Math.min(MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS, dispatch.claimExpiresAt - Date.now()),
          abortSignal,
        );
        evidence = await this._loadSignalAdmissionEvidence(admission);
        continue;
      }
      const next: SignalDispatchingState = {
        state: 'dispatching',
        attemptId: `signal-dispatch-${randomUUID()}`,
        claimExpiresAt: Date.now() + SIGNAL_DISPATCH_CLAIM_TTL_MS,
        delivery: dispatch.state === 'dispatching' ? dispatch.delivery : planned.delivery,
        runId: dispatch.state === 'dispatching' ? dispatch.runId : planned.runId,
      };
      const swapped = await this._compareAndSwapSignalDispatch(admission, dispatch, next);
      if (swapped.evidence.status !== 'pending') return { kind: 'duplicate', evidence: swapped.evidence };
      if (!swapped.applied) {
        evidence = swapped.evidence;
        continue;
      }
      if (dispatch.state === 'dispatching' && next.delivery === 'active' && !isRunActive(next.runId)) {
        return { kind: 'active-lost', dispatch: next };
      }
      return { kind: 'owned', dispatch: next, recoveringAccepted: false };
    }
  }

  private _startSignalDispatchClaimHeartbeat(
    admission: SignalAdmission,
    initial: SignalDispatchingState,
  ): {
    stop: () => Promise<SignalDispatchingState>;
  } {
    let current = initial;
    let failure: unknown;
    let tail = Promise.resolve();
    const interval = setInterval(() => {
      tail = tail.then(async () => {
        if (failure !== undefined) return;
        const renewed: SignalDispatchingState = {
          ...current,
          claimExpiresAt: Date.now() + SIGNAL_DISPATCH_CLAIM_TTL_MS,
        };
        try {
          const swapped = await this._compareAndSwapSignalDispatch(admission, current, renewed);
          if (!swapped.applied) {
            failure = new HarnessConfigError('signal()', 'durable signal dispatch claim was lost');
            return;
          }
          current = renewed;
        } catch (error) {
          failure = error;
        }
      });
    }, SIGNAL_DISPATCH_CLAIM_RENEW_MS);
    interval.unref?.();
    return {
      stop: async () => {
        clearInterval(interval);
        await tail;
        if (failure !== undefined) throw failure;
        return current;
      },
    };
  }

  private async _acceptSignalDispatch(
    admission: SignalAdmission,
    dispatching: SignalDispatchingState,
  ): Promise<AgentSignalResultEvidence> {
    const accepted: SignalAcceptedDispatchState = {
      state: 'accepted',
      attemptId: dispatching.attemptId,
      delivery: dispatching.delivery,
      runId: dispatching.runId,
      acceptedAt: Date.now(),
    };
    const swapped = await this._compareAndSwapSignalDispatch(admission, dispatching, accepted);
    if (!swapped.applied) {
      const current = this._signalDispatchState(swapped.evidence, admission.identity);
      if (
        current.state !== 'accepted' ||
        current.attemptId !== accepted.attemptId ||
        current.delivery !== accepted.delivery ||
        current.runId !== accepted.runId
      ) {
        throw new HarnessConfigError('signal()', 'durable signal acceptance lost its dispatch claim');
      }
    }
    return swapped.evidence;
  }

  private _awaitSignalNativeAcceptance<T>(
    accepted: Promise<T>,
    abortSignal?: AbortSignal,
    interrupted?: Promise<never>,
  ): Promise<T> {
    throwIfAborted(abortSignal, 'signal().admissionId');
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        abortSignal?.removeEventListener('abort', onAbort);
        callback();
      };
      const onAbort = () =>
        finish(() => reject(abortSignal?.reason ?? new HarnessValidationError('signal()', 'operation aborted')));
      const timer = setTimeout(() => {
        finish(() => reject(new HarnessValidationError('signal().admissionId', 'native signal acceptance timed out')));
      }, SIGNAL_NATIVE_ACCEPT_TIMEOUT_MS);
      timer.unref?.();
      abortSignal?.addEventListener('abort', onAbort, { once: true });
      accepted.then(
        value => finish(() => resolve(value)),
        error => finish(() => reject(error)),
      );
      interrupted?.then(
        value => finish(() => resolve(value)),
        error => finish(() => reject(error)),
      );
    });
  }

  private _signalFromAdmissionEvidence(
    evidence: AgentSignalResultEvidence,
    opts: SessionSignalOptions,
  ): CreatedAgentSignal {
    const createdAt = Number.isFinite(evidence.createdAt) ? new Date(evidence.createdAt) : new Date();
    return createSignal({
      id: evidence.signalId,
      type: 'user-message',
      contents: opts.content,
      ...(opts.logicalMessageIdentity ? { metadata: { logicalMessageId: opts.logicalMessageIdentity.input } } : {}),
      createdAt,
      acceptedAt: createdAt,
    });
  }

  private async _awaitDurableSignalResult(
    evidence: Pick<AgentSignalResultEvidence, 'signalId'>,
    abortSignal?: AbortSignal,
    options: { waitIndefinitely?: boolean } = {},
  ): Promise<AgentResult> {
    const deadline = options.waitIndefinitely ? undefined : Date.now() + MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS;
    while (true) {
      throwIfAborted(abortSignal, 'signal().admissionId');
      const latest = await this._storage.loadMessageResultEvidence({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        resourceId: this.resourceId,
        threadId: this.threadId,
        signalId: evidence.signalId,
      });
      if (!latest || !('status' in latest)) {
        throw new HarnessValidationError('signal().admissionId', 'duplicate signal result evidence has expired');
      }
      if (latest.status === 'completed') return latest.result as AgentResult;
      if (latest.status === 'failed') throw publicErrorProjectionToError(latest.error);
      if (deadline !== undefined && Date.now() >= deadline) {
        throw new HarnessValidationError('signal().admissionId', 'pending signal admission is not live');
      }
      await delay(MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS, abortSignal);
    }
  }

  private async _returnDuplicateSignalResult(
    evidence: AgentSignalResultEvidence | OperationAdmissionTombstone,
    opts: SessionSignalOptions,
    identity: SignalAdmissionIdentity,
  ): Promise<SessionSignalResult> {
    if (!('status' in evidence)) {
      throw new HarnessValidationError('signal().admissionId', 'duplicate signal result evidence has expired');
    }
    if (evidence.status === 'pending' && this._signalDispatchState(evidence, identity).state !== 'accepted') {
      throw new HarnessValidationError(
        'signal().admissionId',
        'pending signal admission has not crossed durable native acceptance',
      );
    }
    if (evidence.runId === undefined) {
      if (evidence.status === 'failed') throw publicErrorProjectionToError(evidence.error);
      throw new HarnessValidationError('signal().admissionId', 'pending signal admission was not dispatched');
    }

    let result: Promise<AgentResult>;
    if (evidence.status === 'completed') {
      result = Promise.resolve(evidence.result as AgentResult);
    } else if (evidence.status === 'failed') {
      result = Promise.reject(publicErrorProjectionToError(evidence.error));
    } else {
      const duplicateModeId = evidence.modeId ?? opts.mode ?? this._record.modeId;
      const agent = this._harness.getAgentForMode(duplicateModeId);
      const subscription = await this._ensureThreadSubscription(agent);
      const cached = this._completedRuns.get(evidence.runId);
      if (cached) {
        const admission =
          evidence.admissionId !== undefined && evidence.admissionHash !== undefined
            ? {
                admissionId: evidence.admissionId,
                admissionHash: evidence.admissionHash,
                modeId: duplicateModeId,
                modelId: evidence.modelId ?? this._record.modelId,
                dispatch: this._signalDispatchState(evidence, identity),
              }
            : undefined;
        if (cached.ok) {
          result =
            cached.full.finishReason === 'suspended'
              ? this._awaitDurableSignalResult(evidence, opts.abortSignal, { waitIndefinitely: true })
              : (async () => {
                  const settled = await this._settleSignalResult(
                    evidence.signalId,
                    {
                      status: 'completed',
                      runId: evidence.runId!,
                      result: cached.full as AgentResult,
                    },
                    admission,
                  );
                  return this._adoptSignalSettlement(
                    evidence.signalId,
                    settled,
                    { status: 'completed', result: cached.full as AgentResult },
                    opts.abortSignal,
                  );
                })();
        } else {
          result = (async () => {
            const settled = await this._settleSignalResult(
              evidence.signalId,
              {
                status: 'failed',
                runId: evidence.runId,
                error: projectHarnessPublicError(cached.err),
              },
              admission,
            );
            return this._adoptSignalSettlement(
              evidence.signalId,
              settled,
              { status: 'failed', error: cached.err },
              opts.abortSignal,
            );
          })();
        }
      } else if (this._runCompletionPromises.has(evidence.runId)) {
        const admission =
          evidence.admissionId !== undefined && evidence.admissionHash !== undefined
            ? {
                admissionId: evidence.admissionId,
                admissionHash: evidence.admissionHash,
                modeId: duplicateModeId,
                modelId: evidence.modelId ?? this._record.modelId,
                dispatch: this._signalDispatchState(evidence, identity),
              }
            : undefined;
        result = this._awaitRunCompletion(evidence.runId).then(
          async full => {
            if (full.finishReason === 'suspended') {
              return this._awaitDurableSignalResult(evidence, opts.abortSignal, { waitIndefinitely: true });
            }
            const settled = await this._settleSignalResult(
              evidence.signalId,
              { status: 'completed', runId: evidence.runId!, result: full as AgentResult },
              admission,
            );
            return this._adoptSignalSettlement(
              evidence.signalId,
              settled,
              { status: 'completed', result: full as AgentResult },
              opts.abortSignal,
            );
          },
          async err => {
            const settled = await this._settleSignalResult(
              evidence.signalId,
              { status: 'failed', runId: evidence.runId, error: projectHarnessPublicError(err) },
              admission,
            );
            return this._adoptSignalSettlement(
              evidence.signalId,
              settled,
              { status: 'failed', error: err },
              opts.abortSignal,
            );
          },
        );
      } else if (agent.getRunOutput(evidence.runId) || subscription.activeRunId() === evidence.runId) {
        // Rehydrated accepted run: this Session has no original continuation to
        // terminalize the signal evidence. Attach one to the recovered run so a
        // restart does not leave a durable admitted row pending forever.
        const admission =
          evidence.admissionId !== undefined && evidence.admissionHash !== undefined
            ? {
                admissionId: evidence.admissionId,
                admissionHash: evidence.admissionHash,
                modeId: duplicateModeId,
                modelId: evidence.modelId ?? this._record.modelId,
                dispatch: this._signalDispatchState(evidence, identity),
              }
            : undefined;
        result = this._awaitRunCompletion(evidence.runId).then(
          async full => {
            if (full.finishReason !== 'suspended') {
              const settled = await this._settleSignalResult(
                evidence.signalId,
                {
                  status: 'completed',
                  runId: evidence.runId!,
                  result: full as AgentResult,
                },
                admission,
              );
              return this._adoptSignalSettlement(
                evidence.signalId,
                settled,
                { status: 'completed', result: full as AgentResult },
                opts.abortSignal,
              );
            }
            return this._awaitDurableSignalResult(evidence, opts.abortSignal, { waitIndefinitely: true });
          },
          async err => {
            const settled = await this._settleSignalResult(
              evidence.signalId,
              {
                status: 'failed',
                runId: evidence.runId,
                error: projectHarnessPublicError(err),
              },
              admission,
            );
            return this._adoptSignalSettlement(
              evidence.signalId,
              settled,
              { status: 'failed', error: err },
              opts.abortSignal,
            );
          },
        );
      } else {
        result = this._awaitDurableSignalResult(evidence, opts.abortSignal, {
          waitIndefinitely: this._record.pendingResume?.originSignalId === evidence.signalId,
        });
      }
    }
    result = result.catch(err => {
      throw redactPublicBoundaryRejection(err);
    });
    void result.catch(() => {});

    const signal = this._signalFromAdmissionEvidence(evidence, opts);
    return {
      id: evidence.signalId,
      runId: evidence.runId,
      willInterleave: evidence.runId !== identity.idleRunId,
      accepted: true,
      signal,
      result,
    };
  }

  // -------------------------------------------------------------------------
  // signal() — §4.2.
  //
  // Optimistic user-message primitive. Without `admissionId`, resolves with the
  // routing decision (`id`, `runId`, `willInterleave`) on the first await tick.
  // An admitted call first awaits its durable reservation and authoritative
  // native acceptance. Neither form awaits run completion; callers await
  // `result` for the eventual `AgentResult`.
  //
  // Two delivery shapes:
  //
  //   * Idle thread → wakes a fresh run. This call owns the turn:
  //     `_beginTurn`, `agent_start`, await completion in a background
  //     continuation, `agent_end` + judge + `_endTurn` + drain.
  //
  //   * Active-delivery → an existing run is in flight on this thread.
  //     The signal drains mid-flight into the running execution loop;
  //     no new turn boundary, no `agent_start`/`agent_end`. `result`
  //     resolves with the existing run's `AgentResult`.
  //
  // Per-turn overrides (`mode`, `additionalTools`) on an active-delivery
  // dispatch reject at admission with `HarnessOverrideConflictError` —
  // the in-flight run's surface was committed when it started and cannot
  // be changed mid-flight.
  // -------------------------------------------------------------------------
  async signal(
    opts: SessionSignalOptions,
    /**
     * @internal §14.2 channel-ingress trusted hook. The channel bridge supplies
     * a pre-built trusted `requestContext.channel` projection (NOT caller input —
     * it bypasses {@link validateCallerRequestContext}) and the already-persisted
     * inbox attachments. On idle-wake the trusted context rides the fresh run; on
     * active-delivery (§21 shared terminal) the content interleaves and the
     * in-flight run's committed context stands — the channel context cannot reach
     * the in-flight run's already-committed tools, so it is intentionally not
     * re-applied there. No SDK caller supplies both `opts.requestContext` and
     * this (channel ingress has no caller app bag).
     */
    internal?: {
      persistedRequestContext?: PersistedRequestContextInput;
      attachments?: PersistedAttachment[];
      /**
       * §14.2 channel-ingress idempotency: the durable per-`admissionId` signal
       * id minted by {@link _admitChannelSignalTurn}. Stamping the dispatched
       * signal with this deterministic id (instead of a fresh random one) ties
       * the in-flight run to the reservation written before dispatch, so a
       * recovery replay short-circuits to the SAME run instead of firing a
       * second interleave/wake. No SDK caller supplies this — only channel
       * ingress.
       */
      signalId?: string;
      /**
       * Durable channel-inbox hash computed before runtime admission. Public
       * callers never supply it; the signal path recomputes the normalized hash
       * and fails closed if recovery input drifted.
       */
      expectedAdmissionHash?: string;
    },
  ): Promise<SessionSignalResult> {
    this._assertLive('signal()');
    this._assertOpenForTurn('signal()');
    const logicalMessageIdentity = normalizeSessionLogicalMessageInputIdentity(opts.logicalMessageIdentity, 'signal()');
    const responseLogicalMessageIdentity =
      logicalMessageIdentity !== undefined && 'response' in logicalMessageIdentity ? logicalMessageIdentity : undefined;
    const admittedOpts = {
      ...opts,
      ...(logicalMessageIdentity === undefined ? {} : { logicalMessageIdentity }),
    };
    if (typeof opts.content !== 'string') {
      throw new HarnessValidationError('signal()', '`content` must be a string');
    }
    if (opts.admissionId !== undefined && opts.admissionId.length === 0) {
      throw new HarnessValidationError('signal().admissionId', 'admissionId must be a non-empty string');
    }
    if (opts.admissionId !== undefined && opts.additionalTools !== undefined) {
      throw new HarnessValidationError('signal().admissionId', 'admissionId cannot be combined with additionalTools');
    }

    // §4.4c: validate caller request context before the thread subscription
    // (an observable side effect) and before the routing decision. The trusted
    // channel projection (internal) is a top-level sibling of the caller `app`
    // bag — combine, never deep-merge (mirrors `_admitQueue`).
    const callerRequestContext = validateCallerRequestContext(opts.requestContext, 'signal()');
    const callerPersistedRequestContext = callerRequestContextToPersisted(callerRequestContext);
    const persistedRequestContext: PersistedRequestContextInput | undefined =
      internal?.persistedRequestContext !== undefined || callerPersistedRequestContext !== undefined
        ? { ...(internal?.persistedRequestContext ?? {}), ...(callerPersistedRequestContext ?? {}) }
        : undefined;

    // Resolve an already-admitted retry before consulting today's active-run
    // topology. The original receipt owns routing identity: a completed idle
    // wake must not become an override conflict merely because another run is
    // active when the caller retries it.
    const signalAdmissionHash =
      opts.admissionId !== undefined
        ? this._computeSignalAdmissionHash(admittedOpts, internal?.attachments ?? [], persistedRequestContext)
        : undefined;
    const signalAdmissionIdentity =
      opts.admissionId !== undefined ? this._signalAdmissionIdentity(opts.admissionId) : undefined;
    let redispatchEvidence: AgentSignalResultEvidence | undefined;
    if (
      signalAdmissionHash !== undefined &&
      internal?.expectedAdmissionHash !== undefined &&
      internal.expectedAdmissionHash !== signalAdmissionHash
    ) {
      throw new HarnessAdmissionConflictError(
        this.id,
        opts.admissionId!,
        internal.expectedAdmissionHash,
        signalAdmissionHash,
      );
    }
    if (opts.admissionId !== undefined && signalAdmissionHash !== undefined && signalAdmissionIdentity !== undefined) {
      try {
        const existing = await this._resolveMessageAdmissionDuplicate({
          admissionId: opts.admissionId,
          admissionHash: signalAdmissionHash,
        });
        if (existing !== undefined && !this._signalAdmissionCanRedispatch(existing)) {
          this._assertOpenForTurn('signal()');
          return await this._returnDuplicateSignalResult(existing, admittedOpts, signalAdmissionIdentity);
        }
        if (existing !== undefined && 'status' in existing && this._signalAdmissionCanRedispatch(existing)) {
          redispatchEvidence = existing;
        }
        const inFlight = this._messageAdmissionStarts.get(opts.admissionId);
        if (inFlight !== undefined) {
          if (inFlight.admissionHash !== signalAdmissionHash) {
            throw new HarnessAdmissionConflictError(
              this.id,
              opts.admissionId,
              inFlight.admissionHash,
              signalAdmissionHash,
            );
          }
          const admitted = await inFlight.promise;
          return await this._returnDuplicateSignalResult(admitted, admittedOpts, signalAdmissionIdentity);
        }
      } catch (err) {
        throw internal === undefined ? redactPublicBoundaryRejection(err) : err;
      }
    }

    // Terminal duplicates return above without consulting mutable runtime
    // registration. New work and pending/live recovery still require the
    // currently registered mode + agent.
    const effectiveModeId = redispatchEvidence?.modeId ?? opts.mode ?? this._record.modeId;
    const effectiveModelId = redispatchEvidence?.modelId ?? this._record.modelId;
    const redispatchPreservesIdleDelivery =
      redispatchEvidence !== undefined &&
      signalAdmissionIdentity !== undefined &&
      (() => {
        const dispatch = this._signalDispatchState(redispatchEvidence, signalAdmissionIdentity);
        return dispatch.state !== 'reserved' && dispatch.delivery === 'idle';
      })();
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    // Open the thread subscription before reading `activeRunId()` so the
    // routing decision sees the live runtime state.
    const subscriptionWaiter = this._createActiveTurnWaiter();
    void subscriptionWaiter.promise.catch(() => {});
    let sub: Awaited<ReturnType<Session['_ensureThreadSubscription']>>;
    try {
      const subscription = this._ensureThreadSubscription(agent);
      void subscription.catch(() => {});
      sub = await Promise.race([subscription, subscriptionWaiter.promise]);
    } catch (err) {
      throw internal === undefined ? redactPublicBoundaryRejection(err) : err;
    } finally {
      subscriptionWaiter.cleanup();
    }
    this._assertLive('signal()');
    this._assertOpenForTurn('signal()');

    let activeRunId = sub.activeRunId();
    let willInterleave = activeRunId !== null;

    // Active-delivery + per-turn overrides → reject at admission.
    const assertActiveSignalOverrides = (runId: string) => {
      // §3 / §4.5a: the in-flight run's surface (mode/model/tools) is committed
      // at start, so a signal that *carries* a per-turn mode override and drains
      // into the active run is rejected regardless of the override's value —
      // keying off `opts.mode` presence, not whether it differs from the session
      // default. (The session-default comparison missed the case where the
      // active run itself started with a per-turn mode override.)
      if (opts.mode !== undefined) {
        throw new HarnessOverrideConflictError(this.id, runId, ['mode']);
      }
      if (opts.additionalTools !== undefined) {
        throw new HarnessOverrideConflictError(this.id, runId, ['addTools']);
      }
      // Request context cannot reach an in-flight run's tools (its streamOptions
      // were committed at start), so reject rather than silently drop the app bag.
      if (callerRequestContext !== undefined) {
        throw new HarnessConfigError(
          'signal().requestContext',
          'cannot be supplied on an active-delivery signal — the in-flight run already committed its request context and could not receive a new app bag',
        );
      }
    };
    if (activeRunId !== null) {
      assertActiveSignalOverrides(activeRunId);
    }

    let signalAdmission: SignalAdmission | undefined;
    let signalAdmissionStart: Deferred<AgentSignalResultEvidence | OperationAdmissionTombstone> | undefined;
    if (opts.admissionId !== undefined && signalAdmissionHash !== undefined && signalAdmissionIdentity !== undefined) {
      const admissionHash = signalAdmissionHash;
      const identity = signalAdmissionIdentity;
      try {
        const existing = await this._resolveMessageAdmissionDuplicate({
          admissionId: opts.admissionId,
          admissionHash,
        });
        if (existing !== undefined && !this._signalAdmissionCanRedispatch(existing)) {
          this._assertOpenForTurn('signal()');
          return await this._returnDuplicateSignalResult(existing, admittedOpts, identity);
        }

        const inFlight = this._messageAdmissionStarts.get(opts.admissionId);
        if (inFlight !== undefined) {
          if (inFlight.admissionHash !== admissionHash) {
            throw new HarnessAdmissionConflictError(this.id, opts.admissionId, inFlight.admissionHash, admissionHash);
          }
          const admitted = await inFlight.promise;
          return await this._returnDuplicateSignalResult(admitted, admittedOpts, identity);
        }

        signalAdmissionStart = createDeferred<AgentSignalResultEvidence | OperationAdmissionTombstone>();
        void signalAdmissionStart.promise.catch(() => {});
        this._messageAdmissionStarts.set(opts.admissionId, {
          admissionHash,
          modeId: effectiveModeId,
          modelId: effectiveModelId,
          promise: signalAdmissionStart.promise,
        });

        const reserved =
          existing !== undefined && 'status' in existing
            ? { created: false, evidence: existing }
            : await this._writeMessageResultEvidence({
                status: 'pending',
                signalId: identity.signalId,
                modeId: effectiveModeId,
                modelId: effectiveModelId,
                operationKind: 'signal',
                admissionId: opts.admissionId,
                admissionHash,
                dispatch: { state: 'reserved' },
              });
        const reservedEvidence =
          reserved.evidence ??
          (!reserved.created
            ? await this._resolveMessageAdmissionDuplicate({
                admissionId: opts.admissionId,
                admissionHash,
              })
            : undefined);
        if (
          !reserved.created &&
          reservedEvidence !== undefined &&
          !this._signalAdmissionCanRedispatch(reservedEvidence)
        ) {
          signalAdmissionStart.resolve(reservedEvidence);
          this._messageAdmissionStarts.delete(opts.admissionId);
          return await this._returnDuplicateSignalResult(reservedEvidence, admittedOpts, identity);
        }
        signalAdmission = {
          admissionId: opts.admissionId,
          admissionHash,
          modeId: effectiveModeId,
          modelId: effectiveModelId,
          identity,
          createdAt:
            reservedEvidence !== undefined && 'status' in reservedEvidence ? reservedEvidence.createdAt : Date.now(),
          dispatch:
            reservedEvidence !== undefined && 'status' in reservedEvidence
              ? this._signalDispatchState(reservedEvidence, identity)
              : { state: 'reserved' },
        };
      } catch (err) {
        signalAdmissionStart?.reject(err);
        this._messageAdmissionStarts.delete(opts.admissionId);
        throw internal === undefined ? redactPublicBoundaryRejection(err) : err;
      }
    }

    let signalAdmissionNativeAccepted = false;
    let signalAdmissionNativeDispatchStarted = false;

    const resolveSignalAdmissionStart = (evidence: AgentSignalResultEvidence | OperationAdmissionTombstone) => {
      if (signalAdmission === undefined) return;
      signalAdmissionStart?.resolve(evidence);
      this._messageAdmissionStarts.delete(signalAdmission.admissionId);
    };

    const rejectSignalAdmissionStart = (err: unknown) => {
      if (signalAdmission === undefined) return;
      signalAdmissionStart?.reject(err);
      this._messageAdmissionStarts.delete(signalAdmission.admissionId);
    };

    const recordSignalAdmissionDispatch = async (dispatching: SignalDispatchingState) => {
      if (signalAdmission === undefined) return;
      try {
        const evidence = await this._acceptSignalDispatch(signalAdmission, dispatching);
        resolveSignalAdmissionStart(evidence);
      } catch (err) {
        rejectSignalAdmissionStart(err);
        throw err;
      }
    };

    const releaseSignalDispatch = async (dispatching: SignalDispatchingState) => {
      if (signalAdmission === undefined) return;
      const released = await this._compareAndSwapSignalDispatch(signalAdmission, dispatching, { state: 'reserved' });
      if (!released.applied) {
        throw new HarnessConfigError('signal()', 'durable signal dispatch claim could not be released');
      }
    };

    const failSignalAdmissionBeforeDispatch = async (err: unknown) => {
      if (signalAdmission === undefined) return;
      // No native acceptance means no actor owns a terminal write. Keep the
      // reservation retryable and only release same-process waiters.
      rejectSignalAdmissionStart(err);
    };

    const settleLineagedSignalDispatchRejection = async (runId: string, err: unknown) => {
      if (signalAdmission === undefined || responseLogicalMessageIdentity === undefined) return;
      const settled = await this._settleSignalResult(
        signalAdmission.identity.signalId,
        {
          status: 'failed',
          runId,
          error: projectHarnessPublicError(err),
        },
        signalAdmission,
      );
      if (settled === undefined) {
        throw new HarnessConfigError(
          'signal().logicalMessageIdentity',
          'native rejection did not produce durable signal outcome',
        );
      }
      resolveSignalAdmissionStart(settled);
    };

    const isSignalRunActive = (runId: string) => {
      const pendingResume = this._record.pendingResume;
      return (
        this._runCompletionPromises.has(runId) ||
        sub.activeRunId() === runId ||
        (pendingResume !== undefined &&
          pendingResume.originSignalId === signalAdmission?.identity.signalId &&
          pendingResume.runId === runId)
      );
    };
    const canAttachSignalRun = (runId: string) =>
      isSignalRunActive(runId) || this._completedRuns.has(runId) || agent.getRunOutput(runId) !== undefined;

    const returnClaimOutcome = async (
      claim:
        | { kind: 'duplicate'; evidence: AgentSignalResultEvidence }
        | { kind: 'active-lost'; dispatch: SignalDispatchingState },
    ): Promise<SessionSignalResult> => {
      if (claim.kind === 'duplicate') {
        resolveSignalAdmissionStart(claim.evidence);
        return this._returnDuplicateSignalResult(claim.evidence, admittedOpts, signalAdmission!.identity);
      }

      const err = new HarnessConfigError(
        'signal().admissionId',
        `accepted active signal run "${claim.dispatch.runId}" is no longer live; refusing to reroute the admitted signal to a different run`,
      );
      await this._settleSignalResult(
        signalAdmission!.identity.signalId,
        {
          status: 'failed',
          runId: claim.dispatch.runId,
          error: projectHarnessPublicError(err),
        },
        signalAdmission,
      );
      const evidence = await this._loadSignalAdmissionEvidence(signalAdmission!);
      resolveSignalAdmissionStart(evidence);
      return this._returnDuplicateSignalResult(evidence, admittedOpts, signalAdmission!.identity);
    };

    // The awaited durable reservation can outlive the run observed above.
    // Re-read the authoritative subscription immediately afterward so a signal
    // never reports/interprets an interleave after that run already ended (or
    // owns an idle turn after a new run appeared during admission). This closes
    // the routing window introduced specifically by durable admission I/O.
    const admittedActiveRunId = sub.activeRunId();
    if (admittedActiveRunId !== activeRunId) {
      activeRunId = admittedActiveRunId;
      willInterleave = activeRunId !== null;
      if (activeRunId !== null) {
        try {
          assertActiveSignalOverrides(activeRunId);
        } catch (err) {
          let thrown = err;
          try {
            await failSignalAdmissionBeforeDispatch(err);
          } catch (evidenceErr) {
            thrown = evidenceErr;
          }
          throw internal === undefined ? redactPublicBoundaryRejection(thrown) : thrown;
        }
      }
    }

    const returnInterleavedSignalResult = async (
      dispatched: { signal: CreatedAgentSignal },
      runId: string,
      willInterleaveResult = true,
    ): Promise<SessionSignalResult> => {
      const signalId = dispatched.signal.id;
      if (signalAdmission === undefined) {
        this._writeMessageResultEvidenceBestEffortInBackground({
          status: 'pending',
          signalId,
          runId,
        });
      }

      const completion = this._awaitRunCompletion(runId);
      void completion.catch(() => {});
      const runResult = this._trackBackgroundTurnCompletion(
        completion.then(
          async full => {
            if (full.finishReason === 'suspended') return full as AgentResult;
            const settled = await this._settleSignalResult(
              signalId,
              {
                status: 'completed',
                runId,
                result: full as AgentResult,
              },
              signalAdmission,
            );
            return this._adoptSignalSettlement(
              signalId,
              settled,
              { status: 'completed', result: full as AgentResult },
              opts.abortSignal,
            );
          },
          async err => {
            const settled = await this._settleSignalResult(
              signalId,
              {
                status: 'failed',
                runId,
                error: projectHarnessPublicError(err),
              },
              signalAdmission,
            );
            return this._adoptSignalSettlement(signalId, settled, { status: 'failed', error: err }, opts.abortSignal);
          },
        ),
      );
      const result =
        signalAdmission === undefined
          ? runResult
          : runResult.then(full =>
              full.finishReason === 'suspended'
                ? this._awaitDurableSignalResult({ signalId }, opts.abortSignal, { waitIndefinitely: true })
                : full,
            );
      void result.catch(() => {});
      return {
        id: signalId,
        runId,
        willInterleave: willInterleaveResult,
        accepted: true,
        signal: dispatched.signal,
        result,
      };
    };

    const dispatchAdmittedActiveSignal = async (
      contents: AgentSignalContents,
      runId: string,
      ownedClaim?: { kind: 'owned'; dispatch: SignalDispatchingState; recoveringAccepted: boolean },
    ): Promise<SessionSignalResult | undefined> => {
      const admission = signalAdmission!;
      const claim =
        ownedClaim ??
        (await this._claimSignalDispatch(
          admission,
          { delivery: 'active', runId },
          canAttachSignalRun,
          isSignalRunActive,
          opts.abortSignal,
        ));
      if (claim.kind !== 'owned') return returnClaimOutcome(claim);

      // An expired idle attempt keeps its deterministic idle identity even if a
      // different run happens to be active during recovery. Hand it back to the
      // owned-turn path; that path will reclaim and replay the same idle run id.
      if (claim.dispatch.delivery === 'idle') {
        await releaseSignalDispatch(claim.dispatch);
        return undefined;
      }

      let dispatching = claim.dispatch;
      const heartbeat = this._startSignalDispatchClaimHeartbeat(admission, dispatching);
      let heartbeatStopped = false;
      let claimOwned = true;
      let idleSignalDiscarded = false;
      const stopHeartbeat = async () => {
        if (heartbeatStopped) return dispatching;
        heartbeatStopped = true;
        try {
          dispatching = await heartbeat.stop();
          return dispatching;
        } catch (err) {
          claimOwned = false;
          throw err;
        }
      };

      try {
        const dispatched = agent.sendSignal(
          {
            id: admission.identity.signalId,
            createdAt: new Date(admission.createdAt),
            acceptedAt: new Date(admission.createdAt),
            type: 'user-message',
            contents: contents as never,
            ...(logicalMessageIdentity ? { metadata: { logicalMessageId: logicalMessageIdentity.input } } : {}),
          },
          {
            runId: dispatching.runId,
            resourceId: this.resourceId,
            threadId: this.threadId,
            ...(responseLogicalMessageIdentity ? { ifActive: { behavior: 'discard' } } : {}),
            ifIdle: {
              behavior: 'discard',
              streamOptions: {} as never,
              _onThreadStreamSignalDiscarded: () => {
                idleSignalDiscarded = true;
              },
            },
            _signalAdmissionAttemptId: dispatching.attemptId,
          } as never,
        );
        // Once sendSignal returns, a rejected/lost `accepted` acknowledgement is
        // ambiguous: the native runtime or broker may already have accepted the
        // exact fenced signal. Keep the dispatching claim for expiry recovery;
        // only a synchronous pre-send throw or an explicit non-acceptance action
        // below proves it is safe to release.
        signalAdmissionNativeDispatchStarted = true;
        const accepted = await this._awaitSignalNativeAcceptance(dispatched.accepted, opts.abortSignal);
        if (accepted.action === 'discard') {
          await stopHeartbeat();
          if (idleSignalDiscarded) {
            await releaseSignalDispatch(dispatching);
            claimOwned = false;
            signalAdmissionNativeDispatchStarted = false;
            return undefined;
          }
          if (responseLogicalMessageIdentity !== undefined) {
            const err = new HarnessConfigError(
              'signal().logicalMessageIdentity',
              'a full logical message identity cannot be delivered into an active run',
            );
            await settleLineagedSignalDispatchRejection(dispatching.runId, err);
            claimOwned = false;
            throw err;
          }
          await releaseSignalDispatch(dispatching);
          signalAdmissionNativeDispatchStarted = false;
          return undefined;
        }
        if (accepted.action === 'blocked') {
          await stopHeartbeat();
          await releaseSignalDispatch(dispatching);
          claimOwned = false;
          signalAdmissionNativeDispatchStarted = false;
          throw new HarnessConfigError('signal()', 'signal delivery was blocked by a suspended thread');
        }
        if (accepted.action !== 'deliver') {
          throw new HarnessConfigError('signal()', `active signal delivery was not accepted (${accepted.action})`);
        }

        signalAdmissionNativeAccepted = true;
        if (accepted.runId !== dispatching.runId) {
          throw new HarnessConfigError(
            'signal()',
            `active signal was accepted by run "${accepted.runId}" instead of its fenced run "${dispatching.runId}"`,
          );
        }
        await stopHeartbeat();
        await recordSignalAdmissionDispatch(dispatching);
        return returnInterleavedSignalResult(dispatched, accepted.runId);
      } catch (err) {
        let thrown = err;
        if (!heartbeatStopped) {
          try {
            await stopHeartbeat();
          } catch (heartbeatErr) {
            thrown = heartbeatErr;
          }
        }
        if (!signalAdmissionNativeDispatchStarted && !signalAdmissionNativeAccepted && claimOwned) {
          try {
            await releaseSignalDispatch(dispatching);
          } catch (releaseErr) {
            thrown = releaseErr;
          }
        }
        throw thrown;
      }
    };

    const dispatchOwnedSignal = async (): Promise<SessionSignalResult> => {
      // Owned-turn path: same bookkeeping as the message() default path.
      // `signal()` supports a per-turn `mode` override but not `model`, so the
      // effective model is the session default.
      const turnAbortController = this._beginTurn(opts.abortSignal, {
        modeId: effectiveModeId,
        modelId: effectiveModelId,
      });
      const turnAbortSignal = turnAbortController.signal;
      const activeTurnWaiter = this._createActiveTurnWaiter();
      void activeTurnWaiter.promise.catch(() => {});
      const finishOwnedSignalTurn = () => {
        activeTurnWaiter.cleanup();
        this._endTurn(turnAbortController);
      };
      const assertOwnedSignalTurnNotDeleted = () => {
        if (this._state === 'deleted') {
          throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
        }
      };
      let dispatched!: ReturnType<typeof agent.sendSignal>;
      let ownedRunId!: string;
      let admittedDeliveryRunId: string | undefined;
      try {
        const toolSurface = this._buildToolSurface(mode, opts.additionalTools);
        this._setCurrentTurnReplacementToolSurface(toolSurface);
        const [requestContext, turnInstructions] = await Promise.race([
          Promise.all([
            this._buildRequestContext({
              modeId: effectiveModeId,
              modelId: effectiveModelId,
              abortSignal: turnAbortSignal,
              ...(persistedRequestContext ? { persistedRequestContext } : {}),
            }),
            this._turnInstructions(mode.instructions),
          ]),
          activeTurnWaiter.promise,
        ]);
        const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
          memory: { thread: this.threadId, resource: this.resourceId },
          abortSignal: turnAbortSignal,
          requestContext,
          maxSteps: HARNESS_SESSION_MAX_STEPS,
          ...this._createEmptySynthesisOptions(),
          ...toolSurface,
          ...(turnInstructions ? { instructions: turnInstructions } : {}),
          ...(responseLogicalMessageIdentity ? { logicalMessageIdentity: responseLogicalMessageIdentity } : {}),
        };
        assertOwnedSignalTurnNotDeleted();
        this._assertOpenForTurn('signal()');

        // §13.7/§14.2: attach persisted attachment bytes as model file-parts on
        // the idle-wake run. No attachments → bare `opts.content` (unchanged).
        const signalContents = await Promise.race([
          this._buildSignalContentsWithAttachments(opts.content, internal?.attachments),
          activeTurnWaiter.promise,
        ]);
        assertOwnedSignalTurnNotDeleted();
        this._assertOpenForTurn('signal()');
        if (signalAdmission === undefined) {
          dispatched = agent.sendSignal(
            {
              ...(internal?.signalId !== undefined ? { id: internal.signalId } : {}),
              type: 'user-message',
              contents: signalContents as never,
              ...(logicalMessageIdentity ? { metadata: { logicalMessageId: logicalMessageIdentity.input } } : {}),
            },
            {
              resourceId: this.resourceId,
              threadId: this.threadId,
              ...(responseLogicalMessageIdentity ? { ifActive: { behavior: 'discard' } } : {}),
              ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
            },
          );
          if (responseLogicalMessageIdentity !== undefined) {
            const accepted = await this._awaitSignalNativeAcceptance(
              dispatched.accepted,
              turnAbortSignal,
              activeTurnWaiter.promise,
            );
            if (accepted.action === 'discard') {
              throw new HarnessConfigError(
                'signal().logicalMessageIdentity',
                'a full logical message identity cannot be delivered into an active run',
              );
            }
          }
          // Preserve the historical optimistic boundary for ordinary signals:
          // callers receive the handle without waiting for distributed lease or
          // provider preflight.
          ownedRunId = dispatched.runId;
        } else {
          while (true) {
            const finalActiveRunId = sub.activeRunId();
            const recoveringOriginalIdleDelivery =
              redispatchPreservesIdleDelivery ||
              (signalAdmission.dispatch.state !== 'reserved' && signalAdmission.dispatch.delivery === 'idle');
            if (finalActiveRunId !== null && !recoveringOriginalIdleDelivery) {
              assertActiveSignalOverrides(finalActiveRunId);
              const activeResult = await dispatchAdmittedActiveSignal(signalContents, finalActiveRunId);
              if (activeResult !== undefined) {
                finishOwnedSignalTurn();
                return activeResult;
              }
            }

            const claim = await this._claimSignalDispatch(
              signalAdmission,
              { delivery: 'idle', runId: signalAdmission.identity.idleRunId },
              canAttachSignalRun,
              isSignalRunActive,
              opts.abortSignal,
            );
            if (claim.kind !== 'owned') {
              finishOwnedSignalTurn();
              return returnClaimOutcome(claim);
            }
            if (claim.dispatch.delivery === 'active') {
              const activeResult = await dispatchAdmittedActiveSignal(signalContents, claim.dispatch.runId, claim);
              if (activeResult !== undefined) {
                finishOwnedSignalTurn();
                return activeResult;
              }
              continue;
            }

            let dispatching = claim.dispatch;
            const heartbeat = this._startSignalDispatchClaimHeartbeat(signalAdmission, dispatching);
            let heartbeatStopped = false;
            let claimOwned = true;
            const stopHeartbeat = async () => {
              if (heartbeatStopped) return dispatching;
              heartbeatStopped = true;
              try {
                dispatching = await heartbeat.stop();
                return dispatching;
              } catch (err) {
                claimOwned = false;
                throw err;
              }
            };
            try {
              dispatched = agent.sendSignal(
                {
                  id: signalAdmission.identity.signalId,
                  createdAt: new Date(signalAdmission.createdAt),
                  acceptedAt: new Date(signalAdmission.createdAt),
                  type: 'user-message',
                  contents: signalContents as never,
                  ...(logicalMessageIdentity ? { metadata: { logicalMessageId: logicalMessageIdentity.input } } : {}),
                },
                {
                  runId: dispatching.runId,
                  resourceId: this.resourceId,
                  threadId: this.threadId,
                  ...(responseLogicalMessageIdentity ? { ifActive: { behavior: 'discard' } } : {}),
                  _signalAdmissionAttemptId: dispatching.attemptId,
                  ifIdle: {
                    behavior: 'wake',
                    streamOptions: baseExecOptions as never,
                    _failClosedOnLeaseError: true,
                  } as never,
                } as never,
              );
              signalAdmissionNativeDispatchStarted = true;
              const accepted = await this._awaitSignalNativeAcceptance(
                dispatched.accepted,
                turnAbortSignal,
                activeTurnWaiter.promise,
              );
              if (accepted.action === 'blocked' || accepted.action === 'discard' || accepted.action === 'persist') {
                await stopHeartbeat();
                const err = new HarnessConfigError(
                  'signal()',
                  accepted.action === 'blocked'
                    ? 'signal delivery was blocked by a suspended thread'
                    : `signal delivery was not accepted (${accepted.action})`,
                );
                if (accepted.action === 'discard' && responseLogicalMessageIdentity !== undefined) {
                  await settleLineagedSignalDispatchRejection(dispatching.runId, err);
                  claimOwned = false;
                  throw err;
                }
                await releaseSignalDispatch(dispatching);
                claimOwned = false;
                signalAdmissionNativeDispatchStarted = false;
                throw err;
              }
              signalAdmissionNativeAccepted = true;
              if (accepted.runId !== dispatching.runId) {
                throw new HarnessConfigError(
                  'signal()',
                  `idle signal was accepted by run "${accepted.runId}" instead of its fenced run "${dispatching.runId}"`,
                );
              }
              await stopHeartbeat();
              await recordSignalAdmissionDispatch(dispatching);
              ownedRunId = accepted.runId;
              if (accepted.action === 'deliver') admittedDeliveryRunId = accepted.runId;
              break;
            } catch (err) {
              let thrown = err;
              if (!heartbeatStopped) {
                try {
                  await stopHeartbeat();
                } catch (heartbeatErr) {
                  thrown = heartbeatErr;
                }
              }
              if (!signalAdmissionNativeDispatchStarted && !signalAdmissionNativeAccepted && claimOwned) {
                try {
                  await releaseSignalDispatch(dispatching);
                } catch (releaseErr) {
                  thrown = releaseErr;
                }
              }
              throw thrown;
            }
          }
        }
      } catch (err) {
        finishOwnedSignalTurn();
        let thrown = err;
        if ((signalAdmissionNativeAccepted || signalAdmissionNativeDispatchStarted) && signalAdmission !== undefined) {
          // Native/broker acceptance crossed the execution boundary. A failed
          // durable accept CAS must leave the dispatching fence recoverable;
          // terminalizing it here would falsely claim the side effect failed.
          rejectSignalAdmissionStart(err);
        } else if (err instanceof AgentThreadSignalAdmissionError && signalAdmission !== undefined) {
          // Strict admitted wakes have not crossed the execution boundary when
          // the lease backend rejects acquisition. Keep their durable no-run
          // reservation redispatchable, but release same-process waiters so a
          // later retry can make a fresh admission attempt.
          rejectSignalAdmissionStart(err);
        } else {
          try {
            await failSignalAdmissionBeforeDispatch(err);
          } catch (evidenceErr) {
            thrown = evidenceErr;
          }
        }
        // §13.3f.1 — signal() is a public §4.2b boundary; the dispatch setup
        // (_buildRequestContext / _buildSignalContentsWithAttachments /
        // agent.sendSignal) can reject with a raw provider/storage/runtime error.
        // Redact before rejecting the caller (Harness-own deleted/closing errors
        // pass through unchanged). The trusted `internal` channel-ingress hook is
        // NOT a public §4.2b caller — the recovery worker needs the concrete
        // error for failure classification / re-dispatch, so it is exempt.
        throw internal === undefined ? redactPublicBoundaryRejection(thrown) : thrown;
      }

      if (admittedDeliveryRunId !== undefined) {
        finishOwnedSignalTurn();
        // A distributed duplicate of the same deterministic idle wake loses the
        // lease and is reported by the native runtime as `deliver`, even though it
        // landed on the operation's original idle run. Preserve the durable
        // receipt's routing semantics instead of misreporting an active interleave.
        return returnInterleavedSignalResult(
          dispatched,
          admittedDeliveryRunId,
          admittedDeliveryRunId !== signalAdmission?.identity.idleRunId,
        );
      }

      // §10.2 agent_start carries the runId — emit it now the run is dispatched.
      // dispatched.signal.id is the originating signalId — stamped for the run projection.
      this._emitAgentStart(ownedRunId, dispatched.signal.id);

      // §4.2f: record durable per-`signalId` pending evidence on acceptance so
      // `lookupMessageResult(signalId)` can answer across restarts. Best-effort
      // for this non-`admissionId` path — the run terminal below is the live
      // settlement.
      const ownedSignalId = dispatched.signal.id;
      if (signalAdmission === undefined) {
        this._writeMessageResultEvidenceBestEffortInBackground({
          status: 'pending',
          signalId: ownedSignalId,
          runId: ownedRunId,
        });
      }

      // Register the completion waiter before any terminal chunks land.
      const completion = this._awaitRunCompletion(ownedRunId);
      const completionOrDelete = Promise.race([completion, activeTurnWaiter.promise]);
      let agentEndEmitted = false;
      let signalSettled = false;
      let signalSettlementEvidence: AgentSignalResultEvidence | undefined;
      let settledLocalResult: AgentResult | undefined;

      // Background continuation runs the post-turn bookkeeping so the
      // caller's `result` promise resolves with the final AgentResult.
      const runResult: Promise<AgentResult> = this._trackBackgroundTurnCompletion(
        completionOrDelete
          .then(async full => {
            const tokenUsageDelta =
              full.finishReason === 'suspended'
                ? this._tokenUsageDeltaFromFullOutput(full)
                : this._recordTurnCompletion(full, { persist: false });
            await Promise.race([
              this._maybeCaptureSuspend(full, undefined, effectiveModeId, effectiveModelId, {
                tokenUsageDelta: full.finishReason === 'suspended' ? tokenUsageDelta : undefined,
                originSignalId: ownedSignalId,
              }).catch(err => {
                this._latchDurableTurnFlushError(err, full);
                throw err;
              }),
              activeTurnWaiter.promise,
            ]);
            if (tokenUsageDelta !== undefined && full.finishReason !== 'suspended') {
              await Promise.race([
                this._persistTokenUsageOrLatch().catch(err => {
                  if (!this._isExpectedFlushLifecycleError(err)) this._pendingTokenUsageFlushError ??= err;
                  throw err;
                }),
                activeTurnWaiter.promise,
              ]);
            }
            this._emitAgentEnd({ runId: full.runId, finishReason: this._agentEndReasonForFullOutput(full), full });
            agentEndEmitted = true;
            // §4.2f/§10.2 — the owned run's terminal IS this signal's answer
            // (1:1). Settle the durable per-`signalId` evidence and project
            // `signal_completed` (the promise/SDK boundary, not `agent_end`).
            //
            // A SUSPENDED turn is parked (pendingResume + suspension_required),
            // NOT answered — leave the evidence `pending` until resume
            // terminalizes; do not write completed evidence or emit
            // `signal_completed`. Settle BEFORE the interruptible goal judge so a
            // goal-judge / active-turn-waiter rejection cannot flip an already
            // answered signal to `signal_failed`.
            if (full.finishReason !== 'suspended') {
              signalSettlementEvidence = await this._settleSignalResult(
                ownedSignalId,
                {
                  status: 'completed',
                  runId: ownedRunId,
                  result: full as AgentResult,
                },
                signalAdmission,
              );
              settledLocalResult = full as AgentResult;
              signalSettled = true;
            }
            await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
            return signalSettled
              ? this._adoptSignalSettlement(
                  ownedSignalId,
                  signalSettlementEvidence,
                  { status: 'completed', result: settledLocalResult! },
                  opts.abortSignal,
                )
              : (full as AgentResult);
          })
          .catch(async err => {
            if (!agentEndEmitted) {
              this._emitTurnEvent({
                type: 'agent_end',
                finishReason: turnAbortSignal.aborted ? 'aborted' : 'error',
                runId: ownedRunId,
                usage: this._runUsage(),
              });
            }
            // Don't re-settle a signal already answered as completed (a post-run
            // goal-judge/abort rejection must not flip a terminal result).
            if (signalSettled) {
              try {
                return await this._adoptSignalSettlement(
                  ownedSignalId,
                  signalSettlementEvidence,
                  { status: 'completed', result: settledLocalResult! },
                  opts.abortSignal,
                );
              } catch (winnerError) {
                throw redactPublicBoundaryRejection(winnerError);
              }
            }
            let thrown = err;
            try {
              const settled = await this._settleSignalResult(
                ownedSignalId,
                {
                  status: 'failed',
                  runId: ownedRunId,
                  error: projectHarnessPublicError(err),
                },
                signalAdmission,
              );
              return await this._adoptSignalSettlement(
                ownedSignalId,
                settled,
                { status: 'failed', error: err },
                opts.abortSignal,
              );
            } catch (evidenceErr) {
              thrown = evidenceErr;
            }
            // §13.3f.1 — `handle.result` is a public §4.2b boundary; redact a raw
            // cause before rejecting it (safe `.message`, raw `.cause`
            // local-only). The durable `signal_failed` evidence above is already
            // projected via `projectHarnessPublicError`, so only the in-process
            // promise rejection changes.
            throw redactPublicBoundaryRejection(thrown);
          })
          .finally(() => {
            finishOwnedSignalTurn();
            void this._maybeDrainQueue();
          }),
      );
      const result =
        signalAdmission === undefined
          ? runResult
          : runResult.then(full =>
              full.finishReason === 'suspended'
                ? this._awaitDurableSignalResult({ signalId: ownedSignalId }, opts.abortSignal, {
                    waitIndefinitely: true,
                  })
                : full,
            );

      // Swallow `result` rejections at the inner level so the
      // background continuation doesn't surface as an unhandled
      // rejection if the caller never awaits `result`. The caller's
      // copy still rejects.
      void result.catch(() => {});

      return {
        id: dispatched.signal.id,
        runId: ownedRunId,
        willInterleave: false,
        accepted: true,
        signal: dispatched.signal,
        result,
      };
    };

    if (willInterleave && signalAdmission === undefined) {
      let dispatched: ReturnType<typeof agent.sendSignal>;
      try {
        this._assertOpenForTurn('signal()');
        const interleavedContents = await this._buildSignalContentsWithAttachments(opts.content, internal?.attachments);
        this._assertOpenForTurn('signal()');
        dispatched = agent.sendSignal(
          {
            ...(internal?.signalId !== undefined ? { id: internal.signalId } : {}),
            type: 'user-message',
            contents: interleavedContents as never,
            ...(logicalMessageIdentity ? { metadata: { logicalMessageId: logicalMessageIdentity.input } } : {}),
          },
          {
            resourceId: this.resourceId,
            threadId: this.threadId,
            ...(responseLogicalMessageIdentity ? { ifActive: { behavior: 'discard' } } : {}),
            // The interleave path ignores streamOptions (they cannot reach an
            // active run), but the ifIdle wake fallback starts a REAL turn —
            // without the ceiling it would die at the agent's 5-step default.
            ifIdle: {
              behavior: 'wake',
              streamOptions: {
                maxSteps: HARNESS_SESSION_MAX_STEPS,
                ...this._createEmptySynthesisOptions(),
                ...(responseLogicalMessageIdentity ? { logicalMessageIdentity: responseLogicalMessageIdentity } : {}),
              } as never,
            },
          },
        );
        if (responseLogicalMessageIdentity !== undefined) {
          const accepted = await this._awaitSignalNativeAcceptance(dispatched.accepted, opts.abortSignal);
          if (accepted.action === 'discard') {
            throw new HarnessConfigError(
              'signal().logicalMessageIdentity',
              'a full logical message identity cannot be delivered into an active run',
            );
          }
        }
      } catch (err) {
        let thrown = err;
        try {
          await failSignalAdmissionBeforeDispatch(err);
        } catch (evidenceErr) {
          thrown = evidenceErr;
        }
        throw internal === undefined ? redactPublicBoundaryRejection(thrown) : thrown;
      }
      // Non-admitted signals intentionally preserve the optimistic first-tick
      // behavior: the native synchronous route/run id is the public receipt.
      return returnInterleavedSignalResult(dispatched, dispatched.runId);
    }

    if (willInterleave) {
      try {
        this._assertOpenForTurn('signal()');
        const interleavedContents = await this._buildSignalContentsWithAttachments(opts.content, internal?.attachments);
        this._assertOpenForTurn('signal()');

        // Attachment resolution can outlive the observed active run. Native
        // admission is authoritative: discard if it became idle, then reroute
        // through the fully prepared owned-turn path below.
        const finalActiveRunId = sub.activeRunId();
        if (finalActiveRunId !== null) {
          assertActiveSignalOverrides(finalActiveRunId);
          const delivered = await dispatchAdmittedActiveSignal(interleavedContents, finalActiveRunId);
          if (delivered !== undefined) return delivered;
        }
      } catch (err) {
        let thrown = err;
        if (signalAdmissionNativeAccepted || signalAdmissionNativeDispatchStarted) {
          rejectSignalAdmissionStart(err);
        } else {
          try {
            await failSignalAdmissionBeforeDispatch(err);
          } catch (evidenceErr) {
            thrown = evidenceErr;
          }
        }
        throw internal === undefined ? redactPublicBoundaryRejection(thrown) : thrown;
      }
      return dispatchOwnedSignal();
    }

    return dispatchOwnedSignal();
  }

  // -------------------------------------------------------------------------
  // injectSystemReminder() — §4.2.
  //
  // System-reminder injection primitive used by goal-judge continuations
  // and other harness-internal nudges. Behaves like `signal()` but with
  // signal type `'system-reminder'` and no exposed `result` promise — the
  // caller doesn't await the run's `AgentResult`. When the reminder wakes
  // an idle thread, full turn bookkeeping still runs in the background
  // (`agent_start`/`agent_end` are emitted, the judge runs, etc.). When
  // it drains into an active run, the active run's lifecycle absorbs it.
  // -------------------------------------------------------------------------
  async injectSystemReminder(
    content: string,
    opts?: SessionInjectSystemReminderOptions,
  ): Promise<SessionInjectSystemReminderResult> {
    this._assertLive('injectSystemReminder()');
    this._assertOpenForTurn('injectSystemReminder()');
    if (typeof content !== 'string' || content.length === 0) {
      throw new HarnessValidationError('injectSystemReminder()', '`content` must be a non-empty string');
    }

    const effectiveModeId = this._record.modeId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    const subscriptionWaiter = this._createActiveTurnWaiter();
    void subscriptionWaiter.promise.catch(() => {});
    const subscription = this._ensureThreadSubscription(agent);
    void subscription.catch(() => {});
    const sub = await Promise.race([subscription, subscriptionWaiter.promise]).finally(() => {
      subscriptionWaiter.cleanup();
    });
    this._assertLive('injectSystemReminder()');
    this._assertOpenForTurn('injectSystemReminder()');
    const activeRunId = sub.activeRunId();
    const willInterleave = activeRunId !== null;

    if (!willInterleave) {
      // Owned-turn path: full turn bookkeeping in a background
      // continuation. Caller doesn't get a result handle.
      const turnAbortController = this._beginTurn(undefined);
      const turnAbortSignal = turnAbortController.signal;
      const activeTurnWaiter = this._createActiveTurnWaiter();
      void activeTurnWaiter.promise.catch(() => {});
      const finishOwnedReminderTurn = () => {
        activeTurnWaiter.cleanup();
        this._endTurn(turnAbortController);
      };
      const assertOwnedReminderTurnNotDeleted = () => {
        if (this._state === 'deleted') {
          throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
        }
      };
      let dispatched;
      try {
        const toolSurface = this._buildToolSurface(mode, undefined);
        this._setCurrentTurnReplacementToolSurface(toolSurface);
        const [requestContext, turnInstructions] = await Promise.race([
          Promise.all([
            this._buildRequestContext({
              modeId: effectiveModeId,
              modelId: this._record.modelId,
              abortSignal: turnAbortSignal,
            }),
            this._turnInstructions(mode.instructions),
          ]),
          activeTurnWaiter.promise,
        ]);
        const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
          memory: { thread: this.threadId, resource: this.resourceId },
          abortSignal: turnAbortSignal,
          requestContext,
          maxSteps: HARNESS_SESSION_MAX_STEPS,
          ...this._createEmptySynthesisOptions(),
          ...toolSurface,
          ...(turnInstructions ? { instructions: turnInstructions } : {}),
        };
        assertOwnedReminderTurnNotDeleted();
        this._assertOpenForTurn('injectSystemReminder()');

        dispatched = agent.sendSignal(
          {
            type: 'system-reminder',
            contents: content,
            ...(opts?.attributes ? { attributes: opts.attributes } : {}),
            ...(opts?.metadata ? { metadata: opts.metadata } : {}),
          },
          {
            resourceId: this.resourceId,
            threadId: this.threadId,
            ifIdle: { behavior: 'wake', streamOptions: baseExecOptions as never },
          },
        );
      } catch (err) {
        finishOwnedReminderTurn();
        throw err;
      }

      // §10.2 agent_start carries the runId — emit it now the run is dispatched.
      // dispatched.signal.id is the originating signalId — stamped for the run projection.
      this._emitAgentStart(dispatched.runId, dispatched.signal.id);

      const completion = this._awaitRunCompletion(dispatched.runId);
      const completionOrDelete = Promise.race([completion, activeTurnWaiter.promise]);
      let agentEndEmitted = false;
      const result = this._trackBackgroundTurnCompletion(
        completionOrDelete
          .then(async full => {
            const tokenUsageDelta =
              full.finishReason === 'suspended'
                ? this._tokenUsageDeltaFromFullOutput(full)
                : this._recordTurnCompletion(full, { persist: false });
            await Promise.race([
              this._maybeCaptureSuspend(full, undefined, effectiveModeId, this._record.modelId, {
                tokenUsageDelta: full.finishReason === 'suspended' ? tokenUsageDelta : undefined,
              }).catch(err => {
                this._latchDurableTurnFlushError(err, full);
                throw err;
              }),
              activeTurnWaiter.promise,
            ]);
            if (tokenUsageDelta !== undefined && full.finishReason !== 'suspended') {
              await Promise.race([
                this._persistTokenUsageOrLatch().catch(err => {
                  if (!this._isExpectedFlushLifecycleError(err)) this._pendingTokenUsageFlushError ??= err;
                  throw err;
                }),
                activeTurnWaiter.promise,
              ]);
            }
            this._emitAgentEnd({ runId: full.runId, finishReason: this._agentEndReasonForFullOutput(full), full });
            agentEndEmitted = true;
            await Promise.race([this._runGoalJudge(full, false), activeTurnWaiter.promise]);
          })
          .catch(err => {
            if (!agentEndEmitted) {
              this._emitTurnEvent({
                type: 'agent_end',
                finishReason: turnAbortSignal.aborted ? 'aborted' : 'error',
                runId: dispatched.runId,
                usage: this._runUsage(),
              });
            }
            throw err;
          })
          .finally(() => {
            finishOwnedReminderTurn();
            void this._maybeDrainQueue();
          }),
      );
      void result.catch(() => {});

      return {
        id: dispatched.signal.id,
        runId: dispatched.runId,
        willInterleave: false,
        accepted: true,
        signal: dispatched.signal,
      };
    }

    // Active-delivery path: drain into the live run.
    this._assertOpenForTurn('injectSystemReminder()');
    const dispatched = agent.sendSignal(
      {
        type: 'system-reminder',
        contents: content,
        ...(opts?.attributes ? { attributes: opts.attributes } : {}),
        ...(opts?.metadata ? { metadata: opts.metadata } : {}),
      },
      {
        resourceId: this.resourceId,
        threadId: this.threadId,
        ifIdle: {
          behavior: 'wake',
          // The active-delivery race can still land idle; a wake here starts a
          // REAL streamed turn, so it must carry the step ceiling and the
          // silent-turn nudge like every other wake site — empty options ran
          // the turn at the provider's 5-step default with no memory identity.
          streamOptions: {
            memory: { thread: this.threadId, resource: this.resourceId },
            maxSteps: HARNESS_SESSION_MAX_STEPS,
            ...this._createEmptySynthesisOptions(),
          } as never,
        },
      },
    );

    return {
      id: dispatched.signal.id,
      runId: dispatched.runId,
      willInterleave: true,
      accepted: true,
      signal: dispatched.signal,
    };
  }

  /**
   * If the agent run finished suspended, persist a `PendingResume` pointer
   * derived from `FullOutput.suspendPayload` + `runId`. Subsequent calls to
   * `respondTool*` use this pointer to call `agent.resumeStream(...)`.
   *
   * Maps the agent's `tool-call-approval` / `tool-call-suspended` chunks to
   * the four harness-layer kinds:
   *   - tool name `ask_user`     → 'question'
   *   - tool name `submit_plan`  → 'plan-approval'
   *   - payload has `suspendPayload` → 'tool-suspension'
   *   - else                          → 'tool-approval'
   *
   * No-op when the run did not suspend.
   */
  private async _maybeCaptureSuspend(
    full: FullOutput<unknown>,
    queuedItemId = this._currentQueuedItemId,
    modeId = this._record.modeId,
    modelId = this._modelIdForQueuedItem(queuedItemId),
    opts: { tokenUsageDelta?: TokenUsage; originSignalId?: string } = {},
  ): Promise<void> {
    if (full.finishReason !== 'suspended') return;
    this._captureTurnRunId(full);
    const payload = full.suspendPayload as
      | { toolCallId: string; toolName: string; args?: unknown; suspendPayload?: unknown; approvalReasons?: string[] }
      | undefined;
    if (!payload || !full.runId) {
      await this._persistTokenUsageDelta(opts.tokenUsageDelta);
      this._clearPendingDurableTurnFlushErrorIfRepaired(full);
      return;
    }

    const pending = this._pendingResumeFromSuspendedOutput(
      full,
      payload,
      queuedItemId,
      modeId,
      modelId,
      opts.originSignalId,
    );
    if (pending === undefined) return;
    const suspendedFenceLease = this._currentAgentRequestContext
      ? captureSuspendedToolSurfaceFenceLease(this._currentAgentRequestContext, full.runId)
      : undefined;
    const existing = this._record.pendingResume;
    if (existing && existing.runId === full.runId && existing.toolCallId === payload.toolCallId) {
      if (pending.toolSurfaceFence !== undefined) this._retainCurrentReplacementToolSurface(full.runId);
      await this._flushUpdate(
        prev => {
          const current = prev.pendingResume;
          if (
            current === undefined ||
            current.runId !== full.runId ||
            current.toolCallId !== payload.toolCallId ||
            (pending.accountedTokenUsage === undefined &&
              pending.toolReceipts === undefined &&
              pending.toolReceiptsOverflow !== true)
          ) {
            return prev;
          }
          return {
            ...prev,
            pendingResume: {
              ...current,
              ...(pending.accountedTokenUsage !== undefined
                ? { accountedTokenUsage: pending.accountedTokenUsage }
                : {}),
              ...(pending.toolReceipts !== undefined ? { toolReceipts: pending.toolReceipts } : {}),
              ...(pending.toolReceiptsOverflow === true ? { toolReceiptsOverflow: true } : {}),
            },
          };
        },
        { tokenUsageDelta: opts.tokenUsageDelta },
      );
      if (this._currentAgentRequestContext && suspendedFenceLease) {
        clearSuspendedToolSurfaceFence(this._currentAgentRequestContext, full.runId, suspendedFenceLease);
      }
      this._clearPendingDurableTurnFlushErrorIfRepaired(full);
      return;
    }
    await this._flushUpdate(prev => ({ ...prev, pendingResume: pending }), { tokenUsageDelta: opts.tokenUsageDelta });
    if (this._currentAgentRequestContext && suspendedFenceLease) {
      clearSuspendedToolSurfaceFence(this._currentAgentRequestContext, full.runId, suspendedFenceLease);
    }
    this._clearPendingDurableTurnFlushErrorIfRepaired(full);

    // Emit the §10.2 pending event AFTER the durable-parking barrier (§5.4) so
    // any subscriber observing it can reconstruct the pending state from storage.
    this._emitPendingEvent(pending);
  }

  private _pendingResumeFromSuspendedOutput(
    full: FullOutput<unknown>,
    payload: {
      toolCallId: string;
      toolName: string;
      args?: unknown;
      suspendPayload?: unknown;
      approvalReasons?: string[];
    },
    queuedItemId = this._currentQueuedItemId,
    modeId = this._record.modeId,
    modelId = this._modelIdForQueuedItem(queuedItemId),
    originSignalId?: string,
  ): PendingResume | undefined {
    if (!full.runId) return undefined;
    const kind = this._classifyResumeKind(payload);
    const accountedTokenUsage = this._tokenUsageDeltaFromFullOutput(full);
    const toolReceiptProjection = this._pendingRunToolReceiptProjection(full.runId);
    const pending: PendingResume = {
      kind,
      itemId: `${kind}:${payload.toolCallId}`,
      runId: full.runId,
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      ...this._pendingResumeSourceFields(),
      ...this._newPendingInteractionTiming(kind),
      ...(queuedItemId !== undefined ? { queuedItemId } : {}),
      ...(originSignalId !== undefined ? { originSignalId } : {}),
      modeId,
      // §4.2e — carry the active turn's yolo so the resumed run keeps auto-granting.
      ...(this._currentTurnYolo ? { yolo: true } : {}),
      runtimeDependencies: this._harness._runtimeDependenciesForMode(modeId, modelId),
      // §5.1 — persist the suspended turn's caller app bag so a resume rebuilds the
      // SAME context (a re-suspend re-captures it because resume re-stashes it).
      ...(this._currentTurnRequestContext
        ? { requestContext: clonePersistedRequestContext(this._currentTurnRequestContext) }
        : {}),
      ...(this._currentToolSurfaceFenceSnapshot(full.runId)
        ? { toolSurfaceFence: this._currentToolSurfaceFenceSnapshot(full.runId) }
        : {}),
      ...(accountedTokenUsage ? { accountedTokenUsage } : {}),
      ...toolReceiptProjection,
      payload: this._buildResumePayload(kind, payload),
    };

    if (pending.toolSurfaceFence !== undefined) this._retainCurrentReplacementToolSurface(full.runId);

    if (kind === 'plan-approval') {
      const mode = this._harness._getMode(modeId);
      if (mode.transitionsTo) pending.transitionModeId = mode.transitionsTo;
    }
    return pending;
  }

  /** Correlate child-side pending interactions with their parent invocation. */
  private _pendingResumeSourceFields(): Pick<PendingResume, 'source' | 'subagentToolCallId'> {
    if (this.subagentDepth <= 0) return { source: 'parent' };
    return {
      source: 'subagent',
      ...(this._subagentParentToolCallId !== undefined ? { subagentToolCallId: this._subagentParentToolCallId } : {}),
    };
  }

  private _classifyResumeKind(payload: { toolName: string; suspendPayload?: unknown }): PendingResume['kind'] {
    if (payload.toolName === ASK_USER_TOOL_NAME) return 'question';
    if (payload.toolName === SUBMIT_PLAN_TOOL_NAME) return 'plan-approval';
    if ('suspendPayload' in payload && payload.suspendPayload !== undefined) return 'tool-suspension';
    return 'tool-approval';
  }

  private _buildResumePayload(
    kind: PendingResume['kind'],
    payload: { args?: unknown; suspendPayload?: unknown; approvalReasons?: string[] },
  ): PendingResume['payload'] {
    switch (kind) {
      case 'tool-approval':
        return {
          input: payload.args,
          ...(payload.approvalReasons !== undefined ? { approvalReasons: payload.approvalReasons } : {}),
        };
      case 'tool-suspension':
        return { input: payload.args, suspendData: payload.suspendPayload };
      case 'question': {
        const args = (payload.args ?? {}) as {
          question?: string;
          options?: { label: string; description?: string }[];
          selectionMode?: 'single_select' | 'multi_select';
        };
        return {
          question: args.question,
          options: args.options,
          selectionMode: args.selectionMode,
        };
      }
      case 'plan-approval': {
        const args = (payload.args ?? {}) as { title?: string; plan?: string };
        return { title: args.title, plan: args.plan };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Mode / model getters + setters — §4.2.
  //
  // The session is the local authority for the active mode/model id; the
  // backing agent is selected via Harness lookup. Setters CAS-write through
  // storage so a concurrent harness instance that holds the lease cannot
  // observe a stale value.
  // -------------------------------------------------------------------------

  /** §4.2a: the session's current mode id (the durable default modeId). */
  getCurrentModeId(): string {
    this._assertLive('getCurrentModeId()');
    return this._record.modeId;
  }

  /** Resolved active mode (per the session record). */
  getCurrentMode(): HarnessMode {
    this._assertLive('getCurrentMode()');
    return this._harness._getMode(this._record.modeId);
  }

  /**
   * Switch the active mode for subsequent turns. The backing agent flips
   * with the next `message()`/`queue()` call. Throws if the mode id is
   * unknown.
   */
  async switchMode(opts: { mode: string }): Promise<void> {
    this._assertLive('switchMode()');
    // Validates and throws on unknown id.
    this._harness._getMode(opts.mode);
    const previousModeId = this._record.modeId;
    if (previousModeId === opts.mode) return;
    // §4.2e — entering a mode re-establishes its base permission policy when it
    // declares one (the mode owns the base; runtime grants/setPolicy overlay it).
    // A mode that declares no `permissions` leaves the existing rules untouched.
    const seededRules = this._harness._modePermissionRules(opts.mode);
    await this._flushUpdate(prev => ({
      ...prev,
      modeId: opts.mode,
      ...(seededRules !== undefined
        ? { permissionRules: seededRules, permissionRulesSeedHash: sha256CanonicalJson(seededRules) }
        : {}),
    }));
    this._emitter.emit({ type: 'mode_changed', modeId: opts.mode, previousModeId });
  }

  /**
   * Session model namespace (§4.2a). Surfaced as a namespace for symmetry
   * with `harness.models.*` (§9). Mutators write under the session lease
   * and resolve only after the durable transition commits.
   */
  readonly models = Object.freeze({
    current: (): string => this._modelsCurrent(),
    hasSelected: (): boolean => this._modelsHasSelected(),
    currentAuthStatus: (): Promise<ModelAuthStatus> => this._modelsCurrentAuthStatus(),
    switch: (opts: { model: string }): Promise<void> => this._modelsSwitch(opts),
    setSubagent: (opts: { agentType: string; model: string }): Promise<void> => this._modelsSetSubagent(opts),
    getSubagent: (opts: { agentType: string }): string | null => this._modelsGetSubagent(opts),
  });

  /** Resolved model id for the next turn. Falls back to `''` when nothing has been selected. */
  private _modelsCurrent(): string {
    this._assertLive('models.current()');
    return this._record.modelId;
  }

  /**
   * True once any model has been chosen for this session — either an
   * explicit `models.switch()` call or a `models.setSubagent()` pin. Useful
   * for boot flows that want to gate UI on "has the user picked yet?"
   * without inspecting raw record fields.
   */
  private _modelsHasSelected(): boolean {
    this._assertLive('models.hasSelected()');
    if (this._record.modelId && this._record.modelId.length > 0) return true;
    if (Object.keys(this._record.subagentModelOverrides ?? {}).length > 0) return true;
    return false;
  }

  /**
   * Auth status for the currently resolved model. Routed through
   * `harness.models.getAuthStatus()` when the current model is in the
   * catalog; returns `'unknown'` when no model is selected or the model
   * isn't registered (we don't want the auth-status check to throw on a
   * free-form id the agent layer will accept anyway).
   */
  private async _modelsCurrentAuthStatus(): Promise<ModelAuthStatus> {
    this._assertLive('models.currentAuthStatus()');
    const modelId = this._record.modelId;
    if (!modelId) return 'unknown';
    const entry = await this._harness.models.get(modelId);
    if (!entry) return 'unknown';
    return this._harness.models.getAuthStatus(modelId);
  }

  /** Switch the session's default model id. Free-form string — validated by the agent layer. */
  private async _modelsSwitch(opts: { model: string }): Promise<void> {
    this._assertLive('models.switch()');
    assertModelId('models.switch', opts.model);
    const previousModelId = this._record.modelId;
    if (previousModelId === opts.model) return;
    await this._flushUpdate(prev => ({ ...prev, modelId: opts.model }));
    this._emitter.emit({ type: 'model_changed', modelId: opts.model, previousModelId });
  }

  /**
   * Pin a model for spawned subagents of a given `agentType`. Override is
   * persisted in `SessionRecord.subagentModelOverrides` and read back by
   * the spawn machinery via `models.getSubagent()`. Emits
   * `model_override_set`. No-op when the same mapping is already set.
   */
  private async _modelsSetSubagent(opts: { agentType: string; model: string }): Promise<void> {
    this._assertLive('models.setSubagent()');
    assertAgentType('models.setSubagent', opts.agentType);
    assertModelId('models.setSubagent', opts.model);
    const previousModelId = this._record.subagentModelOverrides?.[opts.agentType] ?? null;
    if (previousModelId === opts.model) return;
    await this._flushUpdate(prev => ({
      ...prev,
      subagentModelOverrides: {
        ...(prev.subagentModelOverrides ?? {}),
        [opts.agentType]: opts.model,
      },
    }));
    // §10.2: subagent model overrides are not a public event — the override is
    // reflected in `SessionRecord.subagentModelOverrides` and the display
    // snapshot (the StateEvent set has only the session-level `model_changed`).
  }

  /** Read the pinned subagent model for an `agentType`, or `null` when unset. */
  private _modelsGetSubagent(opts: { agentType: string }): string | null {
    this._assertLive('models.getSubagent()');
    assertAgentType('models.getSubagent', opts.agentType);
    return this._record.subagentModelOverrides?.[opts.agentType] ?? null;
  }

  // -------------------------------------------------------------------------
  // Custom state (§4.2 / §6.1).
  //
  // The session holds an opaque typed state blob persisted alongside the
  // SessionRecord. The two write forms are equivalent surfaces, but the
  // functional form gives tools an atomic read-modify-write that doesn't
  // stomp concurrent writes from earlier in the same turn.
  // -------------------------------------------------------------------------

  /** Returns the current state. Always resolves with the latest persisted value. */
  async getState<TState = unknown>(): Promise<TState> {
    this._assertLive('getState()');
    return (this._record.state ?? {}) as TState;
  }

  /**
   * Replace or merge the session state. The object form does a shallow merge;
   * the functional form atomically reads the current state, runs the updater,
   * and writes the result. The functional form is the right choice for tools
   * that bump counters or otherwise depend on the previous value.
   */
  setState<TState = unknown>(updates: Partial<TState>, opts?: SetStateOptions): Promise<void>;
  setState<TState = unknown>(updater: (prev: TState) => TState, opts?: SetStateOptions): Promise<void>;
  async setState<TState = unknown>(
    updatesOrUpdater: Partial<TState> | ((prev: TState) => TState),
    opts?: SetStateOptions,
  ): Promise<void> {
    this._assertLive('setState()');
    await this._flushUpdate(prev => {
      const current = (prev.state ?? {}) as TState;
      const next =
        typeof updatesOrUpdater === 'function'
          ? (updatesOrUpdater as (prev: TState) => TState)(current)
          : ({ ...(current as object), ...(updatesOrUpdater as object) } as TState);
      // §5.1: reject non-JSON-serializable state BEFORE the durable commit so a
      // function/bigint/Date/circular value never silently corrupts the row.
      const badPath = firstNonJsonStatePath(next, '$', new Set());
      if (badPath !== undefined) throw new HarnessStateSerializationError(this.id, badPath);
      return { ...prev, state: next };
    }, opts);
  }

  // -------------------------------------------------------------------------
  // getDisplayState — §4.2.
  //
  // Point-in-time snapshot used by TUIs / Studio. Reads off the in-memory
  // `SessionRecord` plus transient per-turn tracking (`_currentRunId`,
  // `_activeTools`, `_toolInputBuffers`, `_activeSubagents`, `_tokenUsage`).
  // Doesn't touch storage. Returned Record/Map projections are fresh on
  // every call — do not mutate them.
  //
  // Persistent thread-level aggregates (task lists, modified-file ledgers,
  // OM progress) live in `session.state`, not here — see the spec doc-comment
  // in §4.2 for the split rationale.
  // -------------------------------------------------------------------------

  /**
   * §4.2e — upload a raw-bytes file attachment scoped to this session. A flat
   * convenience over the kind-based {@link Harness.attachments}`.upload`: the caller
   * supplies a simple `{ name, mimeType, data }` form (always `kind: 'file'`) and the
   * session's own `sessionId`/`resourceId` are supplied automatically. Returns the
   * stable attachment id. `onProgress`, when provided, is invoked once on success with
   * `(byteLength, byteLength)` — the in-process upload completes atomically, so there is
   * no incremental progress to report.
   */
  async uploadAttachment(opts: {
    name: string;
    mimeType: string;
    data: Uint8Array;
    onProgress?: (loaded: number, total: number) => void;
  }): Promise<{ attachmentId: string }> {
    this._assertLive('uploadAttachment()');
    const ref = await this._harness.attachments.upload({
      sessionId: this.id,
      resourceId: this.resourceId,
      kind: 'file',
      filename: opts.name,
      contentType: opts.mimeType,
      data: opts.data,
    });
    opts.onProgress?.(opts.data.byteLength, opts.data.byteLength);
    return { attachmentId: ref.attachmentId };
  }

  /**
   * §4.2e — delete a session-scoped attachment by id. A flat convenience over
   * {@link Harness.attachments}`.delete` that supplies this session's identity.
   */
  async deleteAttachment(opts: { attachmentId: string }): Promise<void> {
    this._assertLive('deleteAttachment()');
    await this._harness.attachments.delete({
      sessionId: this.id,
      resourceId: this.resourceId,
      attachmentId: opts.attachmentId,
    });
  }

  /**
   * §4.2d — set a single application-owned thread setting. Writes ONLY to
   * `HarnessThread.metadata.app[key]` (the one public thread-metadata extension point);
   * it never touches a raw top-level thread-metadata key, and the harness never reads
   * `metadata.app` for any runtime decision. `key` must match the storage-safe grammar
   * `^[A-Za-z_][A-Za-z0-9_]{0,127}$` and must not be a prototype-pollution name
   * (`__proto__` / `prototype` / `constructor`) or a reserved Harness/Mastra namespace
   * (`__mastra*` / `mastra__*`); `value` must be canonical JSON. Invalid input throws
   * {@link HarnessValidationError} before any storage access. Concurrent writes are
   * read-merge-write (last-writer-wins). Like the other thread-metadata operations
   * (e.g. thread rename), this requires the session's thread to already exist in storage —
   * a brand-new thread is persisted on first activity; otherwise `HarnessThreadNotFoundError`.
   */
  async setThreadSetting(opts: { key: string; value: JsonValue }): Promise<void> {
    this._assertLive('setThreadSetting()');
    const { key } = opts;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)) {
      throw new HarnessValidationError('setThreadSetting().key', 'must match ^[A-Za-z_][A-Za-z0-9_]{0,127}$');
    }
    if (
      key === '__proto__' ||
      key === 'prototype' ||
      key === 'constructor' ||
      key.startsWith('__mastra') ||
      key.startsWith('mastra__')
    ) {
      throw new HarnessValidationError(
        'setThreadSetting().key',
        `key "${key}" is reserved (prototype-pollution or Harness/Mastra namespace)`,
      );
    }
    // Validate + normalize to canonical JSON before touching storage (drops undefined props).
    const normalized = assertJsonValue(opts.value, 'setThreadSetting().value');
    const settings = await this._harness._threadOps.getSettings({
      resourceId: this.resourceId,
      threadId: this.threadId,
    });
    const rawApp = (settings as { app?: unknown }).app;
    const currentApp =
      rawApp !== null && typeof rawApp === 'object' && !Array.isArray(rawApp)
        ? (rawApp as Record<string, JsonValue>)
        : {};
    await this._harness._threadOps.setSettings({
      resourceId: this.resourceId,
      threadId: this.threadId,
      patch: { app: { ...currentApp, [key]: normalized } },
    });
  }

  /**
   * §4.2d — in-process convenience subscription to the wire-safe
   * {@link HarnessDisplayStateSnapshotV1}. Emits the current snapshot immediately, then a new
   * snapshot whenever a session event changes it (recomputed per event and de-duplicated against
   * the last emitted snapshot). With `windowMs > 0` it throttles with trailing coalescing: the
   * first change in a window emits immediately (leading edge), further changes coalesce into one
   * pending snapshot flushed at the window's end. Listener exceptions are isolated. The returned
   * unsubscribe clears any pending timer and stops all further emits. No terminal "closed"
   * snapshot is delivered — `getDisplayState()` is only available while the session is live.
   */
  subscribeDisplayState(
    listener: (state: HarnessDisplayStateSnapshotV1) => void,
    opts?: { windowMs?: number },
  ): () => void {
    this._assertLive('subscribeDisplayState()');
    const windowMs = opts?.windowMs !== undefined && opts.windowMs > 0 ? opts.windowMs : 0;
    let stopped = false;
    let lastEmitted: string | undefined;
    let pending: { snap: HarnessDisplayStateSnapshotV1; serialized: string } | undefined;
    let windowTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeRaw: HarnessEventUnsubscribe | undefined;

    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      if (windowTimer !== undefined) {
        clearTimeout(windowTimer);
        windowTimer = undefined;
      }
      pending = undefined;
      unsubscribeRaw?.();
      this._displayRefreshListeners.delete(onEvent);
    };

    const emit = (snap: HarnessDisplayStateSnapshotV1, serialized: string): void => {
      lastEmitted = serialized;
      try {
        listener(snap);
      } catch {
        // Isolate listener exceptions — they must not disrupt the producer or other listeners.
      }
    };

    const compute = (): { snap: HarnessDisplayStateSnapshotV1; serialized: string } | undefined => {
      let snap: HarnessDisplayStateSnapshotV1;
      try {
        snap = toHarnessDisplayStateSnapshotV1(this.getDisplayState());
      } catch {
        // Session is closing/closed/deleted — no further snapshots are available.
        stop();
        return undefined;
      }
      return { snap, serialized: JSON.stringify(snap) };
    };

    const flushWindow = (): void => {
      windowTimer = undefined;
      if (stopped) return;
      if (pending !== undefined && pending.serialized !== lastEmitted) {
        emit(pending.snap, pending.serialized);
      }
      pending = undefined;
    };

    const onEvent = (): void => {
      if (stopped) return;
      const computed = compute();
      if (computed === undefined || computed.serialized === lastEmitted) return; // dedupe
      if (windowMs === 0) {
        emit(computed.snap, computed.serialized);
        return;
      }
      if (windowTimer === undefined) {
        emit(computed.snap, computed.serialized); // leading edge
        windowTimer = setTimeout(flushWindow, windowMs);
      } else {
        pending = computed; // coalesce latest within the open window
      }
    };

    // Immediate initial emit so a fresh subscriber has current state, BEFORE wiring the raw
    // event stream (so we never double-emit the same snapshot).
    const initial = compute();
    if (initial !== undefined) emit(initial.snap, initial.serialized);
    if (stopped) return stop;
    unsubscribeRaw = this.subscribe(onEvent);
    // Also wake on in-process display-only refreshes (e.g. the lazy plan-task
    // summary seed) that carry no persisted event.
    this._displayRefreshListeners.add(onEvent);
    return stop;
  }

  /**
   * Ping `subscribeDisplayState` listeners to recompute their snapshot WITHOUT
   * emitting a persisted §10.2 event. Used when an in-process, display-only
   * derived value changes for already-durable state (the TM-5 plan-task summary
   * seed). The per-subscriber dedupe (`serialized !== lastEmitted`) drops the
   * ping when nothing actually changed.
   */
  private _notifyDisplayRefresh(): void {
    for (const listener of this._displayRefreshListeners) {
      try {
        listener();
      } catch {
        // Isolate listener exceptions — they must not disrupt other listeners.
      }
    }
  }

  getDisplayState(): SessionDisplayState {
    this._assertLive('getDisplayState()');
    const rec = this._record;
    const snapshot: SessionDisplayState = {
      // Identity
      sessionId: this.id,
      threadId: this.threadId,
      resourceId: this.resourceId,
      lifecycleState: this._state,
      modeId: rec.modeId,
      modelId: rec.modelId,
      createdAt: this.createdAt,
      lastActivityAt: rec.lastActivityAt,

      // Run
      isRunning: this.isRunning(),

      // Activity — fresh projections so callers can't mutate internal maps
      activeTools: Object.fromEntries(this._activeTools.entries()),
      toolInputBuffers: Object.fromEntries(this._toolInputBuffers.entries()),
      activeSubagents: Object.fromEntries(this._activeSubagents.entries()),
      assistantDrafts: this._assistantDraftSnapshot(),

      // Tokens — copy so the caller can't mutate the running aggregate
      tokenUsage: { ...this._tokenUsage },

      // Pending interrupt — UX payload only; recovery metadata stays internal.
      pending: pendingResumeForDisplay(rec.pendingResume),

      // Queue
      queueDepth: rec.pendingQueue.length,
    };
    if (this.parentSessionId !== undefined) snapshot.parentSessionId = this.parentSessionId;
    if (this._currentRunId !== undefined) snapshot.currentRunId = this._currentRunId;
    if (this._currentMessageId !== undefined) snapshot.currentMessageId = this._currentMessageId;
    if (this._currentTraceId !== undefined) snapshot.currentTraceId = this._currentTraceId;
    if (this._currentQueuedItemId !== undefined) snapshot.currentQueuedItemId = this._currentQueuedItemId;
    if (rec.goal !== undefined) snapshot.goal = rec.goal;
    const currentRun = this._buildCurrentRunProjection();
    if (currentRun !== undefined) snapshot.currentRun = currentRun;
    // §5.1k / TM-5 bounded plan-task summary. Kick a one-time lazy seed (cheap,
    // bounded) for a hydrated session, then surface the cached summary if present.
    this._maybeSeedPlanTaskSummary();
    if (this._planTaskSummary !== undefined) snapshot.planTasks = this._planTaskSummary;
    return snapshot;
  }

  /**
   * §5.1b SessionRunProjection — a bounded, LIVE read-model view of the in-flight
   * (or suspended) run for the session list/detail UI. Returns `undefined` when no
   * run is active and nothing is pending. F11b fidelity:
   *   - `modeId`/`modelId`/`agentId` reflect the run's EFFECTIVE identity (a
   *     per-turn `opts.mode`/`opts.model` override is captured by `message()`;
   *     a suspended run takes the captured `pendingResume.modeId`).
   *   - `status` is `running` for a live turn, and `waiting`/`resuming` for a
   *     suspended turn (sourced from `pendingResume`; `resumedAt` ⇒ `resuming`).
   *   - `operation.kind` is `queue` for a queued item, else `signal` (carrying
   *     the owned-signal `signalId` when known); the finer kinds
   *     (`sync-generate`/`use-skill`/`inbox-response`) still fold into `signal`.
   *   - `startedAt` is the run-start (`agent_start`) for a live turn, or the
   *     pending interaction's `requestedAt` for a suspended turn.
   * Remaining minor nuance: a live turn reports `running` even at the very
   * `starting` instant (no separate starting phase is tracked).
   */
  private _buildCurrentRunProjection(): SessionRunProjection | undefined {
    const rec = this._record;
    // A pending interaction owns the projection ONLY when no UNRELATED live run is
    // executing: either there is no live run, or the live run IS the resume of
    // this pending (the resume continues the pending's own runId). A genuinely new
    // turn started while suspended (default `message()`/`signal()` are not
    // busy-blocked by a pending) has a different `_currentRunId` and must show as
    // `running`, not be masked by the stale pending.
    const pending = rec.pendingResume;
    if (pending !== undefined && (this._currentRunId === undefined || this._currentRunId === pending.runId)) {
      const modeId = pending.modeId ?? pending.runtimeDependencies?.modeId ?? rec.modeId;
      const operation: SessionRunProjection['operation'] =
        pending.queuedItemId !== undefined
          ? { kind: 'queue', queuedItemId: pending.queuedItemId }
          : pending.originSignalId !== undefined
            ? { kind: 'signal', signalId: pending.originSignalId }
            : { kind: 'signal' };
      return {
        runId: pending.runId,
        status: pending.resumedAt !== undefined ? 'resuming' : 'waiting',
        operation,
        modeId,
        modelId: pending.runtimeDependencies?.modelId ?? rec.modelId,
        agentId: this._modeAgentId(modeId),
        startedAt: pending.requestedAt,
        updatedAt: pending.resumedAt ?? pending.requestedAt,
      };
    }
    // Live in-flight turn (no pending): report the run's EFFECTIVE identity (a
    // per-turn `mode`/`model` override, not just the session default — §5.1b
    // effective identity), captured by `_beginTurn`.
    if (this._currentRunId !== undefined) {
      const modeId = this._currentRunModeId ?? rec.modeId;
      const queuedItemId = this._currentQueuedItemId;
      const projection: SessionRunProjection = {
        runId: this._currentRunId,
        status: 'running',
        operation:
          queuedItemId !== undefined
            ? { kind: 'queue', queuedItemId }
            : {
                kind: 'signal',
                ...(this._currentRunSignalId !== undefined ? { signalId: this._currentRunSignalId } : {}),
              },
        modeId,
        modelId: this._currentRunModelId ?? rec.modelId,
        agentId: this._modeAgentId(modeId),
        startedAt: this._currentRunStartedAt ?? rec.lastActivityAt,
        updatedAt: rec.lastActivityAt,
      };
      if (this._currentTraceId !== undefined) projection.traceId = this._currentTraceId;
      return projection;
    }
    return undefined;
  }

  /** Resolve a mode's backing agentId for the run projection, tolerating a mode
   * that has since been removed from config (fall back to the session default). */
  private _modeAgentId(modeId: string): string {
    try {
      return this._harness._getMode(modeId).agentId;
    } catch {
      return this._harness._getMode(this._record.modeId).agentId;
    }
  }

  // -------------------------------------------------------------------------
  // listMessages — §4.2, §4.4.
  //
  // Read-only history readback for this session's thread, returned
  // oldest-first. Delegates to the memory storage domain on the bound Mastra
  // instance and maps each row into the public `HarnessMessage` partition
  // (spec §11.1) via the shared converter.
  //
  // Returns `[]` when memory storage is not configured (e.g. ad-hoc threads,
  // tests with no storage wired). Throws if the session is no longer live.
  // -------------------------------------------------------------------------

  async listMessages(opts?: ListMessagesOptions): Promise<HarnessMessage[]> {
    this._assertLive('listMessages()');
    const memory = await this._harness._internalTryGetMemoryStorage();
    if (!memory) return [];

    const limit = opts?.limit;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(limit))) {
      throw new HarnessValidationError('limit', `\`limit\` must be a non-negative integer; received ${String(limit)}`);
    }
    if (limit === 0) return [];

    // When `limit` is set, fetch the most recent N (DESC) and reverse to
    // restore chronological order. Otherwise fetch the full thread history
    // in natural order — mirrors the legacy harness's two-path behaviour.
    if (limit !== undefined) {
      const result = await memory.listMessages({
        threadId: this.threadId,
        resourceId: this.resourceId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages
        .slice()
        .reverse()
        .map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
    }

    const result = await memory.listMessages({ threadId: this.threadId, resourceId: this.resourceId, perPage: false });
    return result.messages.map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
  }

  /**
   * §5.1b.4 / §5.6 / §10.6 — bounded, redacted activity timeline. A READ-TIME
   * projection assembled from this session's durable thread/message log + goal +
   * pending inbox, and (under `includeDescendants`) descendant subagent entries.
   * It never settles promises, proves delivery, claims rows, or mutates state.
   * The lower-durability source kinds (operation-result / durable-work / channel /
   * file-reference) are not emitted yet — see {@link buildActivityTimeline}.
   */
  async getActivityTimeline(opts: ActivityTimelineOptions = {}): Promise<SessionActivityTimeline> {
    this._assertLive('getActivityTimeline()');
    const includeDescendants = opts.includeDescendants === true;
    const generatedAt = Date.now();
    // P6.3 — derive the bounded per-thread read window up front (also validates
    // limit + decodes/validates the cursor BEFORE any message scan), so each thread
    // reads at most `limit + 1` messages instead of its whole log.
    const readBound = activityTimelineMessageReadBound(opts, this.id, includeDescendants);

    const sessions: ActivityTimelineSessionInput[] = [
      {
        sessionId: this.id,
        threadId: this.threadId,
        depth: 0,
        messages: await this._activityMessagesForThread(this.threadId, this.resourceId, readBound),
        ...(this._record.goal
          ? {
              goal: {
                id: this._record.goal.id,
                objective: this._record.goal.objective,
                status: this._record.goal.status,
                createdAt: this._record.goal.createdAt,
                ...(this._record.goal.lastDecision ? { lastDecision: this._record.goal.lastDecision } : {}),
              },
            }
          : {}),
        ...(this._record.pendingResume
          ? {
              pendingInbox: [
                {
                  itemId: this._record.pendingResume.itemId ?? this._record.pendingResume.toolCallId,
                  kind: this._record.pendingResume.kind,
                  requestedAt: this._record.pendingResume.requestedAt,
                  ...(this._record.pendingResume.toolName ? { toolName: this._record.pendingResume.toolName } : {}),
                  ...(this._record.pendingResume.runId ? { runId: this._record.pendingResume.runId } : {}),
                },
              ],
            }
          : {}),
      },
    ];

    if (includeDescendants) {
      // Bounded BFS over non-deleted descendant subagent sessions sharing this
      // (harnessName, resourceId). Each contributes a `subagent` entry plus its
      // own message log; descendant goal/pending are deferred with the heavier
      // source kinds. Caps keep the read-time projection server-bounded (§9).
      const MAX_DESCENDANTS = 50;
      const MAX_DEPTH = 4;
      const collected: {
        id: string;
        threadId: string;
        parentSessionId: string;
        depth: number;
        lastActivityAt: number;
      }[] = [];
      let frontier = [{ id: this.id, depth: 0 }];
      const visited = new Set<string>([this.id]);
      while (frontier.length > 0 && collected.length < MAX_DESCENDANTS) {
        const nextFrontier: { id: string; depth: number }[] = [];
        for (const node of frontier) {
          if (node.depth >= MAX_DEPTH) continue;
          let children: SessionSummary[];
          try {
            children = await this._storage.listSessions({
              harnessName: this._record.harnessName,
              resourceId: this.resourceId,
              parentSessionId: node.id,
            });
          } catch {
            continue; // best-effort: a flaky list does not fail the whole timeline
          }
          for (const child of children) {
            if (visited.has(child.id) || collected.length >= MAX_DESCENDANTS) continue;
            visited.add(child.id);
            collected.push({
              id: child.id,
              threadId: child.threadId,
              parentSessionId: node.id,
              depth: node.depth + 1,
              lastActivityAt: child.lastActivityAt,
            });
            nextFrontier.push({ id: child.id, depth: node.depth + 1 });
          }
        }
        frontier = nextFrontier;
      }
      for (const child of collected) {
        sessions.push({
          sessionId: child.id,
          threadId: child.threadId,
          parentSessionId: child.parentSessionId,
          depth: child.depth,
          messages: await this._activityMessagesForThread(child.threadId, this.resourceId, readBound),
          subagent: {
            parentSessionId: child.parentSessionId,
            childSessionId: child.id,
            // DURABLE anchor (PR #200 review): `generatedAt` regenerated per request,
            // so a cursor page could re-return / reorder the subagent entry forever.
            // SessionSummary has no createdAt, but lastActivityAt is stored and only
            // moves on real child activity — stable across paginated reads.
            createdAt: child.lastActivityAt,
          },
        });
      }
    }

    return buildActivityTimeline(
      { addressedSessionId: this.id, addressedThreadId: this.threadId, generatedAt, sessions },
      opts,
    );
  }

  /**
   * Read a thread's persisted message log for the activity timeline, BOUNDED to the
   * oldest `limit + 1` messages at/after the optional cursor (P6.3). Previously this
   * read `perPage: false` (the whole thread log) for every session in the timeline —
   * up to 1 + MAX_DESCENDANTS threads — then discarded all but `limit` entries. The
   * inclusive `dateRange.start` + ascending order + `perPage = limit + 1` are a correct
   * superset of what `buildActivityTimeline` can place on the page; it still applies the
   * precise `> cursor` filter and the final `limit` slice, so output is unchanged.
   */
  private async _activityMessagesForThread(
    threadId: string,
    resourceId: string,
    bound: { limit: number; sinceOccurredAt?: number },
  ): Promise<HarnessMessage[]> {
    const memory = await this._harness._internalTryGetMemoryStorage();
    if (!memory) return [];
    const pageSize = bound.limit + 1;
    const fetchPage = (page: number, startMs: number | undefined, startExclusive: boolean) =>
      memory.listMessages({
        threadId,
        resourceId,
        perPage: pageSize,
        page,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        ...(startMs !== undefined ? { filter: { dateRange: { start: new Date(startMs), startExclusive } } } : {}),
      });
    const msgTs = (msg: { createdAt: unknown }) => new Date(msg.createdAt as Date).getTime();

    // PR #200 review (P2): storage orders only by createdAt while the timeline
    // tiebreaks by (occurredAt, sessionId, entryId), so a fetch boundary that
    // splits a SAME-TIMESTAMP run lets storage return an arbitrary subset of that
    // run — entries can be skipped across cursor pages or `truncated`
    // under-reported. Two invariants restore correctness while staying bounded:
    //   1. COHORT COMPLETENESS — every timestamp present in the returned rows is
    //      returned COMPLETELY (keep paging while the trailing timestamp repeats),
    //      so buildActivityTimeline's precise tiebreak always sees full cohorts.
    //   2. CURSOR PROGRESS — accumulate at least `limit + 1` rows STRICTLY AFTER
    //      the cursor timestamp (a cursor parked at the end of a large cohort
    //      otherwise refetches only already-consumed rows and the walk stalls).
    // Each fetch stays bounded; the pre-P6.3 code read the entire log, so this
    // remains a strict win even on pathological same-timestamp data.
    const rows: Awaited<ReturnType<typeof fetchPage>>['messages'] = [];
    let windowStartMs = bound.sinceOccurredAt;
    let windowExclusive = false;
    let beyondCursorCount = 0;
    for (;;) {
      const first = await fetchPage(0, windowStartMs, windowExclusive);
      let fetched = first.messages;
      rows.push(...fetched);
      let exhausted = fetched.length < pageSize;
      if (!exhausted) {
        // Invariant 1: complete the trailing timestamp's cohort.
        const boundaryMs = msgTs(fetched[fetched.length - 1]!);
        for (let page = 1; ; page++) {
          const next = await fetchPage(page, windowStartMs, windowExclusive);
          let advanced = next.messages.length === 0;
          for (const msg of next.messages) {
            if (msgTs(msg) === boundaryMs) {
              rows.push(msg);
            } else {
              advanced = true;
              break;
            }
          }
          if (next.messages.length < pageSize) exhausted = !advanced && true;
          if (advanced || next.messages.length < pageSize) break;
        }
        // Invariant 2: continue strictly past the completed cohort if needed.
        windowStartMs = boundaryMs;
        windowExclusive = true;
      }
      beyondCursorCount =
        bound.sinceOccurredAt === undefined
          ? rows.length
          : rows.reduce((n, msg) => (msgTs(msg) > bound.sinceOccurredAt! ? n + 1 : n), 0);
      if (exhausted || beyondCursorCount >= pageSize) break;
    }
    return rows.map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
  }

  // -------------------------------------------------------------------------
  // Goals — §4.7.
  //
  // A goal is a standing objective attached to the session that survives
  // across turns. While the goal is `active`, the harness invokes a separate
  // judge model after every assistant turn (`_recordTurnCompletion` hook)
  // and dispatches its verdict (`done` / `continue` / `waiting`). On
  // `continue`, the harness self-enqueues a continuation turn via the
  // session's own `pendingQueue` so user follow-ups preempt it cleanly.
  //
  // Goals are session-scoped (not thread-scoped) and are forbidden on
  // subagent sessions — subagents are bounded units of work that already
  // terminate at task completion.
  // -------------------------------------------------------------------------

  /**
   * Attach a goal to this session. Replaces any existing goal (emits
   * `goal_cleared` for the prior goal first, then `goal_set`). Resets the
   * turn counter and persists to `SessionRecord.goal`.
   *
   * When `kickoff` is `true` (default), an initial continuation turn is
   * enqueued so the agent starts working without an explicit `message()`.
   */
  async setGoal(opts: GoalOptions): Promise<GoalState> {
    this._assertLive('setGoal()');
    if (this.parentSessionId !== undefined || this._record.origin === 'subagent-tool') {
      throw new HarnessValidationError('setGoal', 'goals cannot be set on subagent sessions (parent owns the loop)');
    }
    if (typeof opts.objective !== 'string' || opts.objective.length === 0) {
      throw new HarnessValidationError('setGoal.objective', 'must be a non-empty string');
    }
    if (opts.maxTurns !== undefined && (!Number.isInteger(opts.maxTurns) || opts.maxTurns < 1)) {
      throw new HarnessValidationError('setGoal.maxTurns', 'must be a positive integer');
    }

    const defaults = this._harness._internalGoalDefaults;
    const judgeModelId = opts.judgeModel ?? defaults.defaultJudgeModel;
    if (typeof judgeModelId !== 'string' || judgeModelId.length === 0) {
      throw new HarnessValidationError(
        'setGoal.judgeModel',
        'no judge model provided and `goals.defaultJudgeModel` is not configured',
      );
    }

    const priorId = this._record.goal?.id;
    const goal: GoalState = {
      id: `goal-${randomUUID()}`,
      objective: opts.objective,
      status: 'active',
      turnsUsed: 0,
      maxTurns: opts.maxTurns ?? defaults.defaultMaxTurns,
      judgeModelId,
      createdAt: Date.now(),
    };

    await this._flushUpdate(prev => ({ ...prev, goal }));
    if (priorId !== undefined) {
      this._emit({ type: 'goal_cleared', goalId: priorId });
    }
    this._emit({ type: 'goal_set', goal });

    if (opts.kickoff !== false) {
      await this._enqueueGoalContinuation(goal, buildKickoffContinuation(opts.objective));
    }

    return goal;
  }

  /** Return the active goal, if any. */
  getGoal(): GoalState | undefined {
    this._assertLive('getGoal()');
    return this._record.goal;
  }

  /** Pause auto-continuations without losing the goal. Emits `goal_paused`. */
  async pauseGoal(): Promise<GoalState | undefined> {
    this._assertLive('pauseGoal()');
    const goal = this._record.goal;
    if (!goal || goal.status === 'paused') return goal;
    const updated: GoalState = { ...goal, status: 'paused' };
    await this._flushUpdate(prev => ({ ...prev, goal: updated }));
    this._emit({ type: 'goal_paused', goalId: goal.id, reason: 'requested' });
    return updated;
  }

  /**
   * Resume an inactive goal. Re-emits `goal_resumed` and enqueues a fresh
   * continuation turn so the agent picks up where it left off.
   */
  async resumeGoal(): Promise<GoalState | undefined> {
    this._assertLive('resumeGoal()');
    const goal = this._record.goal;
    if (!goal) return undefined;
    if (goal.status === 'active') return goal;
    const updated: GoalState = { ...goal, status: 'active' };
    await this._flushUpdate(prev => ({ ...prev, goal: updated }));
    this._emit({ type: 'goal_resumed', goalId: goal.id });
    await this._enqueueGoalContinuation(updated, buildResumeContinuation(updated.objective));
    return updated;
  }

  /** Drop the goal entirely. Emits `goal_cleared`. */
  async clearGoal(): Promise<void> {
    this._assertLive('clearGoal()');
    const goal = this._record.goal;
    if (!goal) return;
    await this._flushUpdate(prev => {
      const next = { ...prev };
      delete next.goal;
      return next;
    });
    this._emit({ type: 'goal_cleared', goalId: goal.id });
  }

  /**
   * Re-point judge model and/or budget on the in-flight goal. Parity with
   * TUI's `GoalManager.updateJudgeDefaults`. Both fields are optional; pass
   * only what you want to change. Does not reset `turnsUsed`, does not emit
   * `goal_paused`/`goal_resumed`. No-op when no goal is set.
   *
   * Returns the updated goal, or `undefined` if there's nothing to update.
   */
  async updateJudgeDefaults(opts: { judgeModelId?: string; maxTurns?: number }): Promise<GoalState | undefined> {
    this._assertLive('updateJudgeDefaults()');
    const goal = this._record.goal;
    if (!goal) return undefined;
    if (opts.judgeModelId === undefined && opts.maxTurns === undefined) return goal;
    if (opts.maxTurns !== undefined && (!Number.isFinite(opts.maxTurns) || opts.maxTurns <= 0)) {
      throw new HarnessValidationError('maxTurns', 'maxTurns must be a positive number');
    }
    const updated: GoalState = {
      ...goal,
      ...(opts.judgeModelId !== undefined ? { judgeModelId: opts.judgeModelId } : {}),
      ...(opts.maxTurns !== undefined ? { maxTurns: opts.maxTurns } : {}),
    };
    await this._flushUpdate(prev => ({ ...prev, goal: updated }));
    return updated;
  }

  /**
   * @internal — enqueue a goal-driven continuation turn. Caller is responsible
   * for building the final prompt content (kickoff / resume / judge-continue
   * each use a distinct template — see `buildKickoffContinuation` /
   * `buildResumeContinuation` / `buildJudgeContinuation`). Marked with
   * `source: 'goal'` so the judge loop knows to skip re-judging on the
   * resulting turn (otherwise the loop would never terminate).
   */
  private async _enqueueGoalContinuation(goal: GoalState, content: string): Promise<void> {
    if (this._currentCancelRequest() !== undefined) return;
    const cap = this._harness._internalMaxQueueDepth;
    const item: QueuedItem = {
      id: `q-${randomUUID()}`,
      enqueuedAt: Date.now(),
      content,
      attachments: [],
      mode: this._record.modeId,
      source: 'goal',
      goalId: goal.id,
    };
    const droppedItems: QueueBackpressureDrop[] = [];
    let admitted = false;
    await this._flushUpdate(prev => {
      if (prev.cancelRequest !== undefined) return prev;
      return this._applyQueueBackpressureForAppend(prev, {
        item,
        receipt: undefined,
        maxQueueDepth: cap,
        source: 'goal',
        goalId: goal.id,
        droppedItems,
        onRejected: () => {
          admitted = false;
        },
        onAdmitted: () => {
          admitted = true;
        },
      });
    });
    this._failBackpressureDroppedItems(droppedItems);
    if (!admitted) {
      // §10.2: queue-full/backpressure is not a public event — the goal item is
      // simply not admitted (rejected at the caller for direct queue()).
      return;
    }
    void this._maybeDrainQueue();
  }

  /**
   * @internal — invoked from `_recordTurnCompletion` after every assistant
   * turn settles. Implements the judge loop (§4.7).
   *
   * Triple stale-goal gate: we capture the goal id before fetching context,
   * before calling the judge, and before enqueueing the continuation. If
   * any check fails the verdict is discarded silently (no event, no state
   * change) — the user has already moved on.
   */
  private async _runGoalJudge(turn: FullOutput<unknown>, wasGoalDriven: boolean): Promise<void> {
    // Skip re-judging on goal-driven continuation turns to avoid a tight
    // loop where every continuation triggers another judge call. The
    // judge only runs after user-driven turns; continuations are auto-
    // generated from the prior judge call.
    if (wasGoalDriven) return;

    const goal = this._record.goal;
    if (!goal || goal.status !== 'active') return;

    const evaluatedGoalId = goal.id;

    // Suspended turns don't count toward the judge loop — wait for resume.
    if (turn.finishReason === 'suspended') return;

    // Gate 1 — re-read goal after the async context fetch. If it's been
    // cleared / paused / replaced, drop this judge cycle silently.
    const context = await this._getJudgeContext(turn);
    if (this._record.goal?.id !== evaluatedGoalId || this._record.goal.status !== 'active') return;

    // No-assistant-message fallback: parity with TUI's evaluateAfterTurn.
    // The judge has nothing to score, but the agent still made some attempt
    // (typically a tool call without a closing assistant message). Push a
    // gentle nudge unless we've hit the budget.
    if (!context.lastAssistantContent) {
      if (goal.turnsUsed >= goal.maxTurns) {
        await this._flushUpdate(prev =>
          prev.goal && prev.goal.id === evaluatedGoalId
            ? { ...prev, goal: { ...prev.goal, status: 'paused' as const } }
            : prev,
        );
        this._emit({ type: 'goal_paused', goalId: evaluatedGoalId, reason: 'budget_exhausted' });
        return;
      }
      await this._enqueueGoalContinuation(
        goal,
        buildJudgeContinuation({
          turn: goal.turnsUsed,
          max: goal.maxTurns,
          objective: goal.objective,
          judgeReason: 'No response yet, keep working.',
        }),
      );
      return;
    }

    let decision: GoalJudgeDecision;
    try {
      decision = await this._callJudge(goal, turn);
    } catch {
      // Gate 2a — goal might have changed during the judge call.
      if (this._record.goal?.id !== evaluatedGoalId) return;
      await this._flushUpdate(prev =>
        prev.goal && prev.goal.id === evaluatedGoalId
          ? { ...prev, goal: { ...prev.goal, status: 'paused' as const } }
          : prev,
      );
      this._emit({ type: 'goal_paused', goalId: evaluatedGoalId, reason: 'judge_failed' });
      return;
    }

    // Gate 2b — goal might have changed during the judge call.
    if (this._record.goal?.id !== evaluatedGoalId) return;

    const turnsUsed = decision.decision === 'waiting' ? goal.turnsUsed : goal.turnsUsed + 1;
    const updated: GoalState = { ...goal, turnsUsed, lastDecision: decision };

    await this._flushUpdate(prev =>
      prev.goal && prev.goal.id === evaluatedGoalId ? { ...prev, goal: updated } : prev,
    );

    this._emit({
      type: 'goal_judged',
      goalId: evaluatedGoalId,
      decision,
      turnsUsed,
      maxTurns: updated.maxTurns,
    });

    if (decision.decision === 'done') {
      await this._flushUpdate(prev =>
        prev.goal && prev.goal.id === evaluatedGoalId
          ? { ...prev, goal: { ...prev.goal, status: 'done' as const } }
          : prev,
      );
      this._emit({ type: 'goal_done', goalId: evaluatedGoalId, reason: decision.reason, turnsUsed });
      return;
    }

    if (decision.decision === 'waiting') {
      // §10.2: the judge parked the goal at an external checkpoint. Surface it
      // as `goal_waiting` (turnsUsed is unchanged — see the computation above)
      // so subscribers can distinguish a checkpoint pause from a budget/judge
      // failure (`goal_paused`) or completion (`goal_done`).
      this._emit({ type: 'goal_waiting', goalId: evaluatedGoalId, reason: decision.reason, turnsUsed });
      return;
    }

    // decision.decision === 'continue'
    if (turnsUsed >= updated.maxTurns) {
      await this._flushUpdate(prev =>
        prev.goal && prev.goal.id === evaluatedGoalId
          ? { ...prev, goal: { ...prev.goal, status: 'paused' as const } }
          : prev,
      );
      this._emit({ type: 'goal_paused', goalId: evaluatedGoalId, reason: 'budget_exhausted' });
      return;
    }

    // Gate 3 — final stale check before enqueueing.
    if (this._record.goal?.id !== evaluatedGoalId || this._record.goal.status !== 'active') return;
    await this._enqueueGoalContinuation(
      updated,
      buildJudgeContinuation({
        turn: turnsUsed,
        max: updated.maxTurns,
        objective: updated.objective,
        judgeReason: decision.reason,
      }),
    );
  }

  /**
   * @internal — execute the judge model. Returns a `GoalJudgeDecision`.
   *
   * Test-injection hook: when `__testJudge` is set on this session, it
   * runs in place of the real judge call so unit tests can drive verdicts
   * deterministically without standing up a live model.
   */
  private async _callJudge(goal: GoalState, turn: FullOutput<unknown>): Promise<GoalJudgeDecision> {
    const hook = this.__testJudge;
    if (hook) {
      const verdict = await hook(goal);
      return { ...verdict, judgedAt: Date.now() };
    }
    // Real judge path. Mirrors the TUI's GoalManager.callJudge:
    //   - dedicated `goal-judge` Agent with JUDGE_SYSTEM_PROMPT baked in
    //   - input processor: ProviderHistoryCompat (history-shape parity
    //     across providers, esp. Anthropic)
    //   - error processors: StreamErrorRetryProcessor, PrefillErrorHandler,
    //     ProviderHistoryCompat (retry flaky judge streams cleanly)
    //   - dedicated memory thread `${sessionId}-${goalId}` so the judge
    //     sees continuity across iterations (its own prior verdicts)
    //   - structured output via the judge schema
    //   - context: goal + last user content + assistantStepsSinceLastUser
    //     + truncated last assistant content (4000-char cap)
    const context = await this._getJudgeContext(turn);
    const judgeAgent = this._createJudgeAgent(goal);
    const memory = await judgeAgent.getMemory({ requestContext: new RequestContext() });
    const judgeThreadId = `${this._record.id}-${goal.id}`;

    if (memory) {
      const existing = await memory.getThreadById({ threadId: judgeThreadId });
      if (!existing) {
        await memory.createThread({
          threadId: judgeThreadId,
          resourceId: this._record.resourceId,
          title: `Goal judge: ${goal.objective.slice(0, 80)}`,
          metadata: {
            goalJudge: true,
            parentSessionId: this._record.id,
            goalId: goal.id,
          },
        });
      }
    }

    const truncatedAssistant = truncateForJudge(context.lastAssistantContent ?? 'No response yet, keep working.');
    const recentUser = context.lastUserContent
      ? `\n\nLatest user message:\n${truncateForJudge(context.lastUserContent)}\n\nAssistant steps since that user message: ${context.assistantStepsSinceLastUser}`
      : '';
    const prompt = `Goal: ${goal.objective}${recentUser}\n\nLatest assistant message:\n${truncatedAssistant}`;

    const stream = await judgeAgent.stream(prompt, {
      ...(memory ? { memory: { thread: judgeThreadId, resource: this._record.resourceId } } : {}),
      structuredOutput: { schema: GoalJudgeSchema },
    } as never);

    await (stream as { consumeStream: () => Promise<void> }).consumeStream();
    const full = (await (stream as { getFullOutput: () => Promise<unknown> }).getFullOutput()) as {
      object?: unknown;
    };
    const obj = full.object as { decision: 'done' | 'continue' | 'waiting'; reason: string } | undefined;
    if (!obj || typeof obj !== 'object') {
      throw new Error('judge returned no structured output');
    }
    return { decision: obj.decision, reason: obj.reason, judgedAt: Date.now() };
  }

  /** @internal — test-only hook used by `session.goal.test.ts`. */
  __testJudge?: (goal: GoalState) => Promise<Omit<GoalJudgeDecision, 'judgedAt'>>;

  /**
   * Build the conversation context the judge sees: the latest user content,
   * how many assistant steps have happened since that user message, and the
   * latest assistant content. Mirrors `GoalManager.getRecentConversationContext`.
   */
  private async _getJudgeContext(turn?: FullOutput<unknown>): Promise<{
    lastUserContent: string | null;
    assistantStepsSinceLastUser: number;
    lastAssistantContent: string | null;
  }> {
    let messages: HarnessMessage[] = [];
    try {
      messages = await this.listMessages();
    } catch {
      // listMessages can fail in ad-hoc-thread setups; we'll fall back to
      // the in-memory turn text below.
    }

    let lastUserIndex = -1;
    let lastAssistantContent: string | null = null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as { role?: string; content?: unknown } | undefined;
      if (!msg) continue;
      if (!lastAssistantContent && msg.role === 'assistant') {
        lastAssistantContent = this._extractTextContent(msg.content);
      }
      if (msg.role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    // Storage may not have the assistant turn yet (depends on the agent
    // wiring). Fall back to the in-memory `turn.text` we just produced.
    if (!lastAssistantContent && turn) {
      const text = (turn as { text?: string }).text;
      if (typeof text === 'string' && text.length > 0) {
        lastAssistantContent = text;
      }
    }

    const lastUserContent =
      lastUserIndex >= 0 ? this._extractTextContent((messages[lastUserIndex] as { content?: unknown }).content) : null;
    const assistantStepsSinceLastUser =
      lastUserIndex >= 0
        ? messages.slice(lastUserIndex + 1).filter(m => (m as { role?: string }).role === 'assistant').length
        : 0;

    return {
      lastUserContent,
      assistantStepsSinceLastUser,
      lastAssistantContent,
    };
  }

  private _extractTextContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(part => (part as { type?: string })?.type === 'text')
        .map(part => (part as { text?: string }).text ?? '')
        .join('\n');
    }
    return String(content ?? '');
  }

  /**
   * Construct the dedicated judge Agent. The processor chain matches the
   * TUI's GoalManager so the harness-native judge has the same robustness
   * against provider history quirks and transient stream errors.
   *
   * The judge agent is bound to the same Mastra instance as the parent
   * session so it inherits memory/storage wiring.
   */
  private _createJudgeAgent(goal: GoalState): Agent {
    const model = new ModelRouterLanguageModel(goal.judgeModelId as never);
    return new Agent({
      id: 'goal-judge',
      name: 'Goal Judge',
      instructions: JUDGE_SYSTEM_PROMPT,
      model,
      mastra: this._harness.mastra,
      inputProcessors: [new ProviderHistoryCompat()],
      errorProcessors: [new StreamErrorRetryProcessor(), new PrefillErrorHandler(), new ProviderHistoryCompat()],
    });
  }

  // -------------------------------------------------------------------------
  // Suspend / resume — §4.2.
  //
  // When `message()` (or a queued turn) finishes with `finishReason
  // === 'suspended'`, the harness persists a `PendingResume` record holding
  // the agent's `runId` + `toolCallId` + UX-facing payload. Callers respond
  // through one of four typed entry points; all funnel into `_resume(...)`,
  // which is the single place that calls `agent.resumeStream(...)`.
  //
  // `pendingResume.resumedAt` is set under the lease before the agent call so
  // a crash between "marked resumed" and "cleared pending" replays as a no-op
  // on rehydration (idempotent at-least-once).
  // -------------------------------------------------------------------------

  /** Resume a pending tool-approval. `approved: false` rejects the call. */
  async respondToToolApproval(opts: ToolApprovalDecision & InboxReceiptResponseOptions): Promise<InboxResponseResult>;
  async respondToToolApproval(opts: ToolApprovalDecision & LegacyInboxResponseOptions): Promise<AgentResult>;
  async respondToToolApproval(
    opts: ToolApprovalDecision & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult>;
  async respondToToolApproval(
    opts: ToolApprovalDecision & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    const approvalDecision =
      opts.editedArgs !== undefined
        ? parseToolApprovalDecision({ approved: opts.approved, editedArgs: opts.editedArgs })
        : undefined;
    if (opts.editedArgs !== undefined && !approvalDecision) {
      throw new HarnessValidationError(
        'respond[tool-approval].editedArgs',
        'editedArgs requires an approved decision and a JSON object',
      );
    }
    return this._resume(
      'tool-approval',
      compactJsonObject({
        approved: opts.approved,
        reason: opts.reason,
        editedArgs: approvalDecision?.editedArgs,
      }),
      opts,
    );
  }

  /** Resume a pending tool-suspension. `resumeData` is forwarded to the tool. */
  async respondToToolSuspension(
    opts: { resumeData: unknown } & InboxReceiptResponseOptions,
  ): Promise<InboxResponseResult>;
  async respondToToolSuspension(opts: { resumeData: unknown } & LegacyInboxResponseOptions): Promise<AgentResult>;
  async respondToToolSuspension(
    opts: { resumeData: unknown } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult>;
  async respondToToolSuspension(
    opts: { resumeData: unknown } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    return this._resume('tool-suspension', opts.resumeData, opts);
  }

  /** Resume a pending `ask_user` question. */
  async respondToQuestion(opts: { answer: unknown } & InboxReceiptResponseOptions): Promise<InboxResponseResult>;
  async respondToQuestion(opts: { answer: unknown } & LegacyInboxResponseOptions): Promise<AgentResult>;
  async respondToQuestion(opts: { answer: unknown } & InboxResponseOptions): Promise<AgentResult | InboxResponseResult>;
  async respondToQuestion(
    opts: { answer: unknown } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    return this._resume('question', { answer: opts.answer }, opts);
  }

  async respondToSandboxAccess(
    opts: { approved: boolean; reason?: string } & InboxReceiptResponseOptions,
  ): Promise<InboxResponseResult>;
  async respondToSandboxAccess(
    opts: { approved: boolean; reason?: string } & LegacyInboxResponseOptions,
  ): Promise<AgentResult>;
  async respondToSandboxAccess(
    opts: { approved: boolean; reason?: string } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult>;
  async respondToSandboxAccess(
    opts: { approved: boolean; reason?: string } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    return this._resume(
      'sandbox-access',
      compactJsonObject({
        approved: opts.approved,
        reason: opts.reason,
      }),
      opts,
    );
  }

  /**
   * Resume a pending `submit_plan` approval.
   *
   * On `approved: true` the harness flips the active mode to:
   *   - `opts.transitionToMode` when supplied (overrides mode-declared default), OR
   *   - the submitting mode's declared `transitionsTo` when set, OR
   *   - no-op (stays in the submitting mode).
   *
   * `revision` is free-form reviewer feedback forwarded to the tool as
   * `resumeData.revision` (see `submitPlan` resume schema). It is independent
   * of approval — the reviewer can approve with a revision note or reject
   * with revision guidance.
   */
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & InboxReceiptResponseOptions,
  ): Promise<InboxResponseResult>;
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & LegacyInboxResponseOptions,
  ): Promise<AgentResult>;
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult>;
  async respondToPlanApproval(
    opts: {
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    } & InboxResponseOptions,
  ): Promise<AgentResult | InboxResponseResult> {
    if (opts.transitionToMode !== undefined) {
      // Validate eagerly so callers see a clean error rather than a CAS-time
      // throw from inside the resume flow.
      this._harness._getMode(opts.transitionToMode);
    }
    return this._resume(
      'plan-approval',
      compactJsonObject({
        approved: opts.approved,
        revision: opts.revision,
        transitionToMode: opts.transitionToMode,
      }),
      opts,
    );
  }

  // -------------------------------------------------------------------------
  // Permissions (§4.2e).
  //
  // Session-scoped grants (`SessionRecord.sessionGrants`) and policy rules
  // (`SessionRecord.permissionRules`) compose with the tool's static
  // approval flag, the harness `defaultPermissionPolicy`, and any
  // resolver-supplied category to decide allow/ask/deny on each tool call.
  //
  // Both surfaces are persisted under the session's write lease so a crash
  // mid-grant either lands entirely or not at all.
  // -------------------------------------------------------------------------

  /**
   * Session permissions namespace (§4.2e). All mutators write
   * `SessionRecord.permissionRules` / `SessionRecord.sessionGrants` under
   * the session lease and resolve only after the durable transition
   * commits. Validation, closed-session, ownership, or storage failures
   * reject before any event or display projection is emitted.
   */
  readonly permissions = Object.freeze({
    grantCategory: (opts: { category: ToolCategory }): Promise<void> => this._permGrantCategory(opts),
    grantTool: (opts: { toolName: string }): Promise<void> => this._permGrantTool(opts),
    revokeCategory: (opts: { category: ToolCategory }): Promise<void> => this._permRevokeCategory(opts),
    revokeTool: (opts: { toolName: string }): Promise<void> => this._permRevokeTool(opts),
    getGrants: (): Readonly<SessionGrants> => this._permGetGrants(),
    getRules: (): Readonly<PermissionRules> => this._permGetRules(),
    setPolicy: (
      opts:
        | { category: ToolCategory; toolName?: never; policy: PermissionPolicy }
        | { toolName: string; category?: never; policy: PermissionPolicy },
    ): Promise<void> => this._permSetPolicy(opts),
  });

  /**
   * Grant every tool in a category for the lifetime of this session
   * ("don't ask again for `read` tools"). No-op if already granted.
   * Emits `permission_granted` on a transition.
   */
  private async _permGrantCategory(opts: { category: ToolCategory }): Promise<void> {
    this._assertLive('permissions.grantCategory()');
    assertToolCategory('permissions.grantCategory', opts.category);
    let changed = false;
    await this._flushUpdate(prev => {
      changed = false;
      if (prev.sessionGrants.categories.includes(opts.category)) return prev;
      changed = true;
      return {
        ...prev,
        sessionGrants: {
          ...prev.sessionGrants,
          categories: [...prev.sessionGrants.categories, opts.category],
        },
      };
    });
    if (changed) this._emitter.emit({ type: 'permission_granted', category: opts.category });
  }

  /**
   * Grant a specific tool for the lifetime of this session. No-op if
   * already granted. Emits `permission_granted` on a transition.
   */
  private async _permGrantTool(opts: { toolName: string }): Promise<void> {
    this._assertLive('permissions.grantTool()');
    assertToolName('permissions.grantTool', opts.toolName);
    let changed = false;
    await this._flushUpdate(prev => {
      changed = false;
      if (prev.sessionGrants.tools.includes(opts.toolName)) return prev;
      changed = true;
      return {
        ...prev,
        sessionGrants: {
          ...prev.sessionGrants,
          tools: [...prev.sessionGrants.tools, opts.toolName],
        },
      };
    });
    if (changed) this._emitter.emit({ type: 'permission_granted', toolName: opts.toolName });
  }

  /**
   * Revoke a previously granted category. No-op if not granted. Emits
   * `permission_revoked` on a transition.
   */
  private async _permRevokeCategory(opts: { category: ToolCategory }): Promise<void> {
    this._assertLive('permissions.revokeCategory()');
    assertToolCategory('permissions.revokeCategory', opts.category);
    let changed = false;
    await this._flushUpdate(prev => {
      changed = false;
      if (!prev.sessionGrants.categories.includes(opts.category)) return prev;
      changed = true;
      return {
        ...prev,
        sessionGrants: {
          ...prev.sessionGrants,
          categories: prev.sessionGrants.categories.filter(c => c !== opts.category),
        },
      };
    });
    if (changed) this._emitter.emit({ type: 'permission_revoked', category: opts.category });
  }

  /**
   * Revoke a previously granted tool. No-op if not granted. Emits
   * `permission_revoked` on a transition.
   */
  private async _permRevokeTool(opts: { toolName: string }): Promise<void> {
    this._assertLive('permissions.revokeTool()');
    assertToolName('permissions.revokeTool', opts.toolName);
    let changed = false;
    await this._flushUpdate(prev => {
      changed = false;
      if (!prev.sessionGrants.tools.includes(opts.toolName)) return prev;
      changed = true;
      return {
        ...prev,
        sessionGrants: {
          ...prev.sessionGrants,
          tools: prev.sessionGrants.tools.filter(t => t !== opts.toolName),
        },
      };
    });
    if (changed) this._emitter.emit({ type: 'permission_revoked', toolName: opts.toolName });
  }

  /** Read-only snapshot of the session's current grants. */
  private _permGetGrants(): Readonly<SessionGrants> {
    this._assertLive('permissions.getGrants()');
    const { categories, tools } = this._record.sessionGrants;
    return Object.freeze({ categories: [...categories], tools: [...tools] });
  }

  /** Read-only snapshot of the session's current per-category / per-tool rules. */
  private _permGetRules(): Readonly<PermissionRules> {
    this._assertLive('permissions.getRules()');
    const { categories, tools } = this._record.permissionRules;
    return Object.freeze({ categories: { ...categories }, tools: { ...tools } });
  }

  /**
   * Set a permission rule. Exactly one of `category` / `toolName` must be
   * set — the wire shape and the storage shape both keep these
   * dimensions separate so subscribers can route without inspecting the
   * payload. Emits `permission_policy_changed` on a transition.
   */
  private async _permSetPolicy(
    opts:
      | { category: ToolCategory; toolName?: never; policy: PermissionPolicy }
      | { toolName: string; category?: never; policy: PermissionPolicy },
  ): Promise<void> {
    this._assertLive('permissions.setPolicy()');
    if ((opts.category === undefined) === (opts.toolName === undefined)) {
      throw new HarnessValidationError('permissions.setPolicy', 'must set exactly one of "category" or "toolName"');
    }
    assertPolicy('permissions.setPolicy', opts.policy);
    if (opts.category !== undefined) {
      assertToolCategory('permissions.setPolicy', opts.category);
      let oldPolicy: PermissionPolicy | undefined;
      let changed = false;
      await this._flushUpdate(prev => {
        changed = false;
        oldPolicy = prev.permissionRules.categories[opts.category!];
        if (oldPolicy === opts.policy) return prev;
        changed = true;
        return {
          ...prev,
          permissionRules: {
            ...prev.permissionRules,
            categories: { ...prev.permissionRules.categories, [opts.category!]: opts.policy },
          },
        };
      });
      if (changed) {
        this._emitter.emit({
          type: 'permission_policy_changed',
          category: opts.category,
          oldPolicy,
          newPolicy: opts.policy,
        });
      }
      return;
    }
    assertToolName('permissions.setPolicy', opts.toolName!);
    let oldPolicy: PermissionPolicy | undefined;
    let changed = false;
    await this._flushUpdate(prev => {
      changed = false;
      oldPolicy = prev.permissionRules.tools[opts.toolName!];
      if (oldPolicy === opts.policy) return prev;
      changed = true;
      return {
        ...prev,
        permissionRules: {
          ...prev.permissionRules,
          tools: { ...prev.permissionRules.tools, [opts.toolName!]: opts.policy },
        },
      };
    });
    if (changed) {
      this._emitter.emit({
        type: 'permission_policy_changed',
        toolName: opts.toolName,
        oldPolicy,
        newPolicy: opts.policy,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Observational Memory — §4.2e / §9.2.
  //
  // OM is advisory memory context, not a recovery proof boundary. Native
  // per-turn engine selection is not available yet, so enabled Harness OM
  // configuration is rejected at Harness construction and model switches reject
  // before persisting anything. `clearOverride()` remains as a recovery surface
  // for sessions written by an older build that recorded now-unsupported intent.
  // Configure OM directly on the Agent Memory instance in the meantime.
  // -------------------------------------------------------------------------

  readonly om = Object.freeze({
    getObserverModelId: (): string | null => this._omObserverModelId(),
    getReflectorModelId: (): string | null => this._omReflectorModelId(),
    getObservationThreshold: (): number => this._omObservationThreshold(),
    getReflectionThreshold: (): number => this._omReflectionThreshold(),
    switchObserverModel: (opts: { model: string }): Promise<void> => this._omSwitchObserverModel(opts),
    switchReflectorModel: (opts: { model: string }): Promise<void> => this._omSwitchReflectorModel(opts),
    clearOverride: (): Promise<void> => this._omClearOverride(),
  });

  private _omDefaults() {
    return this._harness._getObservationalMemoryDefaults();
  }

  private _omObserverModelId(): string | null {
    this._assertLive('om.getObserverModelId()');
    return this._record.observationalMemory?.observerModelId ?? this._omDefaults().observerModelId ?? null;
  }

  private _omReflectorModelId(): string | null {
    this._assertLive('om.getReflectorModelId()');
    return this._record.observationalMemory?.reflectorModelId ?? this._omDefaults().reflectorModelId ?? null;
  }

  /** Effective observation trigger threshold. `0` means "use the memory adapter default". */
  private _omObservationThreshold(): number {
    this._assertLive('om.getObservationThreshold()');
    return this._record.observationalMemory?.observationThreshold ?? this._omDefaults().observationThreshold ?? 0;
  }

  /** Effective reflection trigger threshold. `0` means "use the memory adapter default". */
  private _omReflectionThreshold(): number {
    this._assertLive('om.getReflectionThreshold()');
    return this._record.observationalMemory?.reflectionThreshold ?? this._omDefaults().reflectionThreshold ?? 0;
  }

  private async _omSwitchObserverModel(opts: { model: string }): Promise<void> {
    this._assertLive('om.switchObserverModel()');
    if (typeof opts?.model !== 'string' || opts.model.length === 0) {
      throw new HarnessValidationError('om.switchObserverModel.model', 'must be a non-empty string');
    }
    throw new HarnessConfigError(
      'observationalMemory',
      'per-session model switches are not supported until @mastra/memory can select an OM engine from the effective per-turn config',
    );
  }

  private async _omSwitchReflectorModel(opts: { model: string }): Promise<void> {
    this._assertLive('om.switchReflectorModel()');
    if (typeof opts?.model !== 'string' || opts.model.length === 0) {
      throw new HarnessValidationError('om.switchReflectorModel.model', 'must be a non-empty string');
    }
    throw new HarnessConfigError(
      'observationalMemory',
      'per-session model switches are not supported until @mastra/memory can select an OM engine from the effective per-turn config',
    );
  }

  /** Remove unsupported intent persisted by an older Harness build. */
  private async _omClearOverride(): Promise<void> {
    this._assertLive('om.clearOverride()');
    await this._flushUpdate(prev => {
      if (prev.observationalMemory === undefined) return prev;
      const next = { ...prev };
      delete next.observationalMemory;
      return next;
    });
    // Recovered queue work parks while a legacy override is present. Wake it
    // only after the clearing CAS commits; a failed write leaves the durable
    // poison authoritative. This mirrors the other fire-and-forget queue kicks
    // and is idempotent when another drain already owns the session.
    void this._maybeDrainQueue();
  }

  private _hasUnsupportedObservationalMemoryIntent(): boolean {
    return this._harness._getObservationalMemoryDefaults().enabled || this._record.observationalMemory !== undefined;
  }

  // §9.2 PER-TURN OM ENABLEMENT — DEFERRED (BLOCKED ON @mastra/memory).
  //
  // Threading `memory.options.observationalMemory` into a turn does NOT enable or
  // configure OM at runtime: `@mastra/memory` builds its OM engine ONLY from the
  // Memory instance's CONSTRUCTOR `threadConfig.observationalMemory` (index.ts
  // `_initOMEngine` returns null otherwise), and the per-turn path forwards only
  // `temporalMarkers` to the processor — models/scope/thresholds are fixed at
  // construction. Worse, core memory SKIPS the MessageHistory input processor
  // whenever it sees OM "enabled" in the effective config (memory.ts), so passing
  // a runtime OM option for an Agent whose Memory was NOT constructed with OM would
  // SUPPRESS normal history WITHOUT attaching OM. So the harness does NOT thread a
  // per-turn OM option today. Harness construction rejects enabled configuration;
  // `_buildRequestContext` additionally rejects records carrying unsupported intent
  // persisted by older builds until `session.om.clearOverride()` removes it. Users
  // can configure OM directly on the Agent Memory and omit this option while native
  // per-turn engine selection is implemented in @mastra/memory.

  private async _resume(
    expectedKind: PendingResume['kind'],
    resumeData: unknown,
    responseOptions: InboxResponseOptions = {},
  ): Promise<AgentResult | InboxResponseResult> {
    this._assertLive(`respond[${expectedKind}]`);
    const activeWorkAdmissionEpoch = this._captureActiveWorkAdmission(`respond[${expectedKind}]`);
    const responseId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'responseId');
    if (responseId !== undefined && typeof responseId !== 'string') {
      throw new HarnessValidationError(`respond[${expectedKind}].responseId`, 'responseId must be a string');
    }
    const responseMode: ResumeResponseMode = responseId !== undefined ? 'inbox-receipt' : 'agent-result';
    if (responseId !== undefined && responseId.length === 0) {
      throw new HarnessValidationError(`respond[${expectedKind}].responseId`, 'responseId must be a non-empty string');
    }
    const requestedItemId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'itemId');
    if (requestedItemId !== undefined && typeof requestedItemId !== 'string') {
      throw new HarnessValidationError(`respond[${expectedKind}].itemId`, 'itemId must be a string');
    }
    const requestedRunId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'runId');
    const requestedToolCallId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'toolCallId');
    const requestedPendingRequestedAt = getOwnRecordValue(
      responseOptions as Record<string, unknown>,
      'pendingRequestedAt',
    );
    if (responseId !== undefined) {
      if (typeof requestedItemId !== 'string' || requestedItemId.length === 0) {
        throw new HarnessValidationError(`respond[${expectedKind}].itemId`, 'receipt responses require itemId');
      }
      if (typeof requestedRunId !== 'string' || requestedRunId.length === 0) {
        throw new HarnessValidationError(`respond[${expectedKind}].runId`, 'receipt responses require runId');
      }
      if (typeof requestedToolCallId !== 'string' || requestedToolCallId.length === 0) {
        throw new HarnessValidationError(`respond[${expectedKind}].toolCallId`, 'receipt responses require toolCallId');
      }
      if (
        typeof requestedPendingRequestedAt !== 'number' ||
        !Number.isSafeInteger(requestedPendingRequestedAt) ||
        requestedPendingRequestedAt < 0
      ) {
        throw new HarnessValidationError(
          `respond[${expectedKind}].pendingRequestedAt`,
          'receipt responses require a non-negative integer pendingRequestedAt',
        );
      }
    }
    const requestedApprovalScope = getOwnRecordValue(responseOptions as Record<string, unknown>, 'approvalScope');
    if (
      requestedApprovalScope !== undefined &&
      requestedApprovalScope !== 'once' &&
      requestedApprovalScope !== 'always'
    ) {
      throw new HarnessValidationError(
        `respond[${expectedKind}].approvalScope`,
        'approvalScope must be "once" or "always"',
      );
    }
    if (expectedKind !== 'tool-approval' && requestedApprovalScope !== undefined) {
      throw new HarnessValidationError(
        `respond[${expectedKind}].approvalScope`,
        'approvalScope is only valid for tool approvals',
      );
    }
    const approvalScope =
      expectedKind === 'tool-approval' ? ((requestedApprovalScope ?? 'once') as 'once' | 'always') : undefined;
    if (approvalScope === 'always' && (resumeData as { approved?: unknown })?.approved !== true) {
      throw new HarnessValidationError('respond[tool-approval].approvalScope', '"always" requires approved: true');
    }

    const storedReceipt =
      responseId !== undefined ? getOwnRecordValue(this._record.inboxResponseReceipts, responseId) : undefined;
    if (storedReceipt !== undefined) {
      const duplicate = this._resolveStoredInboxResponse(expectedKind, resumeData, responseOptions);
      const retryClaim = storedReceipt.status === 'failed' && storedReceipt.retryable === true;
      if (!retryClaim && storedReceipt.status === 'applied') {
        return duplicate!;
      }
      if (!retryClaim && this._record.pendingResume === undefined) {
        const recoveredReceipt = await this._applyInboxReceiptFromCompletedQueue(storedReceipt);
        if (recoveredReceipt) return this._inboxReceiptResult(recoveredReceipt, true);
        return duplicate!;
      }
      // The original caller owns the in-flight resume. A later delivery of the
      // same accepted inbox response observes that durable admission and must
      // not enter the busy resume path or dispatch the agent a second time.
      if (
        !retryClaim &&
        this._record.pendingResume?.resumedAt !== undefined &&
        this._currentTurnAbortController !== undefined
      ) {
        return duplicate!;
      }
    }

    const cancelRequest = this._currentCancelRequest();
    if (cancelRequest !== undefined) {
      throw new HarnessSessionCancelledError(this.id, cancelRequest.reason);
    }

    const pending = this._record.pendingResume;
    if (!pending) {
      if (
        typeof requestedItemId === 'string' &&
        typeof requestedRunId === 'string' &&
        typeof requestedToolCallId === 'string' &&
        typeof requestedPendingRequestedAt === 'number'
      ) {
        const generationKey = pendingInteractionGenerationKey({
          kind: expectedKind,
          itemId: requestedItemId,
          runId: requestedRunId,
          toolCallId: requestedToolCallId,
          requestedAt: requestedPendingRequestedAt,
        });
        const expired = getOwnRecordValue(this._record.expiredPendingInteractions, generationKey);
        if (expired?.kind === expectedKind) {
          throw new HarnessPendingInteractionExpiredError(this.id, expired.itemId, expired.expiresAt);
        }
      }
      throw new HarnessValidationError(`respond[${expectedKind}]`, 'no pending resume on this session');
    }
    if (pending.kind !== expectedKind) {
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        `pending resume is "${pending.kind}", not "${expectedKind}"`,
      );
    }
    if (
      responseId !== undefined &&
      (requestedRunId !== pending.runId ||
        requestedToolCallId !== pending.toolCallId ||
        requestedPendingRequestedAt !== pending.requestedAt)
    ) {
      throw new HarnessInboxItemNotFoundError(
        this.id,
        requestedItemId as string,
        expectedKind === 'sandbox-access' ? undefined : expectedKind,
      );
    }
    // ask_user / submit_plan / sandbox access persist and emit their pending
    // record from inside the still-running tool. Do not let an event subscriber
    // start the resume until the original run has crossed its terminal-delivery
    // barrier. Otherwise the resume can stamp `resumedAt` while the original
    // terminal is failing, leaving neither path with exclusive cleanup
    // ownership. No receipt/admission state has been written at this point, so
    // the caller can safely retry once the active turn settles.
    if (
      this._currentTurnAbortController !== undefined &&
      (pending.kind === 'question' || pending.kind === 'plan-approval' || pending.kind === 'sandbox-access')
    ) {
      throw new HarnessBusyError(this.id, 'in_flight');
    }

    const itemId = pending.itemId ?? pending.toolCallId;
    if (requestedItemId !== undefined && requestedItemId !== itemId) {
      throw new HarnessInboxItemNotFoundError(
        this.id,
        requestedItemId,
        expectedKind === 'sandbox-access' ? undefined : expectedKind,
      );
    }
    if (approvalScope === 'always' && (!pending.toolName || pending.toolName.length === 0)) {
      throw new HarnessValidationError(
        'respond[tool-approval].approvalScope',
        'the pending tool approval has no grantable tool name',
      );
    }
    const pendingExpiresAt = this._pendingInteractionExpiresAt(pending);
    if (pending.expiryStartedAt !== undefined || (pending.resumedAt === undefined && Date.now() >= pendingExpiresAt)) {
      const didExpire = await this._expirePendingInteraction({
        kind: pending.kind,
        itemId,
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        requestedAt: pending.requestedAt,
        expiresAt: pendingExpiresAt,
      });
      const generationKey = pendingInteractionGenerationKey({
        kind: pending.kind,
        itemId,
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        requestedAt: pending.requestedAt,
      });
      if (
        didExpire ||
        getOwnRecordValue(this._record.expiredPendingInteractions, generationKey)?.kind === expectedKind
      ) {
        throw new HarnessPendingInteractionExpiredError(this.id, itemId, pendingExpiresAt);
      }
    }
    const responseHash =
      responseId !== undefined
        ? this._computeInboxResponseHash({
            kind: expectedKind,
            itemId,
            runId: pending.runId,
            pendingRequestedAt: pending.requestedAt,
            response: resumeData,
            ...(approvalScope !== undefined ? { approvalScope } : {}),
          })
        : undefined;
    const persistedResponse =
      responseId !== undefined ? assertJsonValue(resumeData, `respond[${expectedKind}].response`) : undefined;
    const existingReceipt =
      responseId !== undefined ? getOwnRecordValue(this._record.inboxResponseReceipts, responseId) : undefined;
    if (existingReceipt !== undefined) {
      this._assertMatchingInboxReceipt(existingReceipt, {
        kind: expectedKind,
        itemId,
        responseId: responseId!,
        responseHash: responseHash!,
      });
      const retryClaim = existingReceipt.status === 'failed' && existingReceipt.retryable === true;
      if (!retryClaim) {
        this._throwStoredInboxResponseFailure(existingReceipt);
        if (
          responseMode === 'inbox-receipt' &&
          (pending.resumedAt === undefined || existingReceipt.status === 'applied')
        ) {
          return this._inboxReceiptResult(existingReceipt, true);
        }
        if (existingReceipt.status === 'applied' && existingReceipt.result !== undefined) {
          return existingReceipt.result as AgentResult;
        }
      }
    }

    // Idempotency: a crash between "marked resumed" and "cleared pending"
    // surfaces here on the next call. We do not replay the agent — the prior
    // resumeStream() either landed (and cleared pending in a later flush we
    // lost) or is being completed by a sibling caller. Either way, the safe
    // move is to surface the suspended state to the caller and let them
    // re-fetch via getDisplayState / listMessages.
    if (pending.resumedAt !== undefined) {
      if (existingReceipt !== undefined && responseMode === 'inbox-receipt') {
        const recovery = await this._maybeRecoverStaleQueuedResume();
        if (recovery.status === 'completed') {
          await this._markInboxResponseApplied(existingReceipt.responseId, recovery.result);
          const receipt =
            getOwnRecordValue(this._record.inboxResponseReceipts, existingReceipt.responseId) ?? existingReceipt;
          return this._inboxReceiptResult(receipt, true);
        }
        if (recovery.status === 'stale') {
          throw new ResumeRecoveryStaleError();
        }
        if (
          this._currentTurnAbortController === undefined &&
          this._queuedItemIdForPendingResume(pending) === undefined &&
          Date.now() >= this._pendingInteractionDueAt(pending)
        ) {
          const stale = new ResumeRecoveryStaleError();
          if (await this._recoverStaleResumeAdmission(this._pendingInteractionGeneration(pending))) throw stale;
        }
        return this._inboxReceiptResult(existingReceipt, true);
      }
      const recovery = await this._maybeRecoverStaleQueuedResume();
      if (recovery.status === 'completed') {
        if (responseMode === 'inbox-receipt') {
          throw new HarnessValidationError(
            `respond[${expectedKind}]`,
            'pending resume already responded; no matching inbox response receipt exists',
          );
        }
        return recovery.result;
      }
      if (recovery.status === 'stale') {
        throw new ResumeRecoveryStaleError();
      }
      if (
        this._currentTurnAbortController === undefined &&
        this._queuedItemIdForPendingResume(pending) === undefined &&
        Date.now() >= this._pendingInteractionDueAt(pending)
      ) {
        const stale = new ResumeRecoveryStaleError();
        if (await this._recoverStaleResumeAdmission(this._pendingInteractionGeneration(pending))) throw stale;
      }
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        'pending resume already responded; awaiting agent confirmation',
      );
    }

    const pendingQueuedItemId = this._queuedItemIdForPendingResume(pending);
    if (pendingQueuedItemId !== undefined) {
      this._ensureQueuedItemContext(pendingQueuedItemId);
    }

    // For plan-approval, resolve the active-mode flip before finalizing the
    // resumed turn. Queued terminal resumes persist this flip with the
    // completed receipt so crash recovery cannot observe "completed plan
    // approval, old mode".
    //
    // Resolution order on approval:
    //   1. Caller-supplied `transitionToMode` overrides everything.
    //   2. Falls back to the submitting mode's declared `transitionsTo`
    //      (captured into `pending.transitionModeId` at suspend time).
    //   3. Otherwise no flip.
    let modeFlipTarget: string | undefined;
    if (expectedKind === 'plan-approval') {
      const data = resumeData as { approved: boolean; transitionToMode?: string };
      if (data.approved) {
        const candidate = data.transitionToMode ?? pending.transitionModeId;
        if (candidate && candidate !== this._record.modeId) {
          // Validate the target mode exists before we hand off to the agent.
          // (Caller-supplied `transitionToMode` is also validated up-front in
          // `respondToPlanApproval`; this catches the pending-record path.)
          this._harness._getMode(candidate);
          modeFlipTarget = candidate;
        }
      }
    }

    const previousModeId = this._record.modeId;
    const resumeModeId = this._modeIdForPendingResume(pending);
    const resumeRuntimeDependencies = this._runtimeDependenciesForPendingResume(pending);
    const resumeMode = this._harness._getMode(resumeModeId);
    let resumeToolSurface = this._buildToolSurface(resumeMode);
    if (pending.toolSurfaceFence !== undefined) {
      const retainedFence = this._pendingReplacementToolSurfaces.get(pending.runId);
      if (retainedFence === undefined) {
        throw new HarnessValidationError(
          `respond[${expectedKind}]`,
          'cannot resume the replacement tool surface because its original tool implementations are no longer available in this process',
        );
      }
      resumeToolSurface = {
        toolsets: {
          'harness:retained-replacement': materializeToolSurfaceFence(retainedFence) as ToolsInput,
        },
        toolsetsMode: 'replace',
      };
    }
    let agent: Agent;
    try {
      agent = this._harness._resolveAgentForRuntimeDependencies(
        resumeRuntimeDependencies,
        `pending ${expectedKind} resume`,
      ).agent;
    } catch (err) {
      let thrown = err;
      if (responseId !== undefined) {
        try {
          await this._recordInboxResponsePreDispatchFailure(
            {
              responseId,
              responseHash: responseHash!,
              itemId,
              queuedItemId: pendingQueuedItemId,
              kind: expectedKind,
              pending,
              response: persistedResponse,
              ...(approvalScope !== undefined ? { approvalScope } : {}),
            },
            err,
          );
        } catch (responseErr) {
          thrown = responseErr;
        }
      }
      // §13.3f.1 — respondTo* is a public §4.2b boundary; the runtime-drift
      // resolution throws a construction-safe HarnessRuntimeDriftError
      // (pass-through), but the pre-dispatch-failure write can surface a raw
      // storage error. Redact before rejecting the caller.
      throw redactPublicBoundaryRejection(thrown);
    }

    // Mark resumed under the lease BEFORE calling the agent (idempotency
    // marker per §5.4 / §5.7). On crash here, the next caller observes
    // resumedAt set and rejects rather than double-resuming.
    let resumedAt: number | undefined;
    let duplicateReceiptAfterAdmission: InboxResponseReceipt | undefined;
    let pendingAlreadyResumedAfterAdmission = false;
    let cancelledBeforeResume: { reason?: string } | undefined;
    let invalidatedBeforeResume = false;
    let expiredBeforeAdmission: PendingResume | undefined;
    let grantedToolAfterAdmission: string | undefined;
    await this._flushUpdate(prev => {
      expiredBeforeAdmission = undefined;
      grantedToolAfterAdmission = undefined;
      resumedAt = undefined;
      if (!this._activeWorkAdmissionIsCurrent(activeWorkAdmissionEpoch)) {
        invalidatedBeforeResume = true;
        return prev;
      }
      if (prev.cancelRequest !== undefined && prev.pendingResume?.resumedAt === undefined) {
        cancelledBeforeResume = prev.cancelRequest.reason !== undefined ? { reason: prev.cancelRequest.reason } : {};
        return prev;
      }

      const currentReceipt =
        responseId !== undefined ? getOwnRecordValue(prev.inboxResponseReceipts, responseId) : undefined;
      const retryableReceipt =
        currentReceipt?.status === 'failed' && currentReceipt.retryable === true ? currentReceipt : undefined;
      if (currentReceipt !== undefined && retryableReceipt === undefined) {
        this._assertMatchingInboxReceipt(currentReceipt, {
          kind: expectedKind,
          itemId,
          responseId: currentReceipt.responseId,
          responseHash: responseHash!,
        });
        duplicateReceiptAfterAdmission = currentReceipt;
        return prev;
      }

      const currentPending = prev.pendingResume;
      if (
        currentPending === undefined ||
        currentPending.resumedAt !== undefined ||
        currentPending.kind !== expectedKind ||
        currentPending.runId !== pending.runId ||
        currentPending.toolCallId !== pending.toolCallId ||
        (currentPending.itemId ?? currentPending.toolCallId) !== itemId ||
        currentPending.requestedAt !== pending.requestedAt ||
        currentPending.expiresAt !== pending.expiresAt ||
        currentPending.expiryStartedAt !== undefined
      ) {
        pendingAlreadyResumedAfterAdmission = true;
        return prev;
      }

      const admissionAt = Date.now();
      if (admissionAt >= this._pendingInteractionExpiresAt(currentPending)) {
        expiredBeforeAdmission = currentPending;
        return prev;
      }
      resumedAt = admissionAt;

      const shouldGrantTool =
        approvalScope === 'always' &&
        currentPending.toolName !== undefined &&
        !prev.sessionGrants.tools.includes(currentPending.toolName);
      const next: SessionRecord = {
        ...prev,
        pendingResume: {
          ...currentPending,
          resumedAt: admissionAt,
          resumeRecoveryAt: admissionAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS,
        },
        ...(shouldGrantTool
          ? {
              sessionGrants: {
                ...prev.sessionGrants,
                tools: [...prev.sessionGrants.tools, currentPending.toolName!],
              },
            }
          : {}),
      };
      if (shouldGrantTool) {
        grantedToolAfterAdmission = currentPending.toolName;
      }
      if (responseId === undefined) return next;

      let retriedReceipt: InboxResponseReceipt | undefined;
      if (retryableReceipt !== undefined) {
        const { error: _error, failedAt: _failedAt, retryable: _retryable, ...receiptBase } = retryableReceipt;
        retriedReceipt = {
          ...receiptBase,
          resumeAttemptId: `${responseId}:${retryableReceipt.failedAt ?? retryableReceipt.updatedAt}`,
          status: 'accepted',
          acceptedAt: admissionAt,
          updatedAt: admissionAt,
        };
      }
      next.inboxResponseReceipts = pruneInboxResponseReceipts({
        ...(prev.inboxResponseReceipts ?? {}),
        [responseId]:
          retriedReceipt ??
          ({
            responseId,
            responseHash: responseHash!,
            resumeAttemptId: responseId,
            itemId,
            ...(pendingQueuedItemId !== undefined ? { queuedItemId: pendingQueuedItemId } : {}),
            kind: expectedKind,
            runId: pending.runId,
            toolCallId: pending.toolCallId,
            pendingRequestedAt: pending.requestedAt,
            response: persistedResponse,
            ...(approvalScope !== undefined ? { approvalScope } : {}),
            status: 'accepted',
            acceptedAt: admissionAt,
            updatedAt: admissionAt,
          } satisfies InboxResponseReceipt),
      });
      return next;
    });
    // This event describes the durable policy transition committed by the CAS,
    // not whether the provider resume subsequently starts. Emit before the
    // branch-epoch checks so a Stop that wins immediately after admission does
    // not hide a grant that remains authoritative in storage.
    if (grantedToolAfterAdmission !== undefined) {
      this._emitter.emit({ type: 'permission_granted', toolName: grantedToolAfterAdmission });
    }
    if (cancelledBeforeResume !== undefined) {
      throw new HarnessSessionCancelledError(this.id, cancelledBeforeResume.reason);
    }
    if (invalidatedBeforeResume || !this._activeWorkAdmissionIsCurrent(activeWorkAdmissionEpoch)) {
      throw new HarnessBusyError(this.id, 'in_flight');
    }
    if (expiredBeforeAdmission !== undefined) {
      const expired = expiredBeforeAdmission;
      await this._expirePendingInteraction({
        kind: expired.kind,
        itemId: expired.itemId ?? expired.toolCallId,
        runId: expired.runId,
        toolCallId: expired.toolCallId,
        requestedAt: expired.requestedAt,
        expiresAt: this._pendingInteractionExpiresAt(expired),
      });
      throw new HarnessPendingInteractionExpiredError(
        this.id,
        expired.itemId ?? expired.toolCallId,
        this._pendingInteractionExpiresAt(expired),
      );
    }
    if (duplicateReceiptAfterAdmission !== undefined) {
      this._throwStoredInboxResponseFailure(duplicateReceiptAfterAdmission);
      return this._inboxReceiptResult(duplicateReceiptAfterAdmission, true);
    }
    if (pendingAlreadyResumedAfterAdmission) {
      const recovery = await this._maybeRecoverStaleQueuedResume();
      if (recovery.status === 'completed') {
        if (responseMode === 'inbox-receipt') {
          throw new HarnessValidationError(
            `respond[${expectedKind}]`,
            'pending resume already responded; no matching inbox response receipt exists',
          );
        }
        return recovery.result;
      }
      if (recovery.status === 'stale') {
        const stale = new ResumeRecoveryStaleError();
        if (responseId !== undefined) {
          await this._markInboxResponseFailed(responseId, stale);
        }
        throw stale;
      }
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        'pending resume already responded; awaiting agent confirmation',
      );
    }
    if (resumedAt === undefined) {
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        'pending resume admission did not commit an authoritative response attempt',
      );
    }

    // The storage CAS may have completed just before a Stop bumped the local
    // branch epoch. Never create a new provider controller for a stale
    // admission; Stop's
    // durable discard owns execution terminalization from here. It does not
    // roll back the independently committed policy grant.
    this._assertActiveWorkAdmission(activeWorkAdmissionEpoch, `respond[${expectedKind}]`);

    // §10.2 defines no sandbox_access_resolved event — sandbox/path-access
    // prompts surface as question_pending and resolve via the inbox response
    // transition + display snapshot (no dedicated resolved event).

    // Resumed runs run under a session-owned AbortController too, so
    // `session.abort()` can cancel an in-flight resume (e.g. ESC after the
    // user approved a tool that's now grinding through a long workflow).
    const turnAbortController = this._beginTurn(undefined);
    this._setCurrentTurnReplacementToolSurface(resumeToolSurface);
    // §4.2e — carry the original turn's yolo forward (captured on pendingResume).
    // Re-arm the transient so a re-suspend on this resumed run persists it again.
    this._currentTurnYolo = pending.yolo === true;
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    const finishResumedTurn = () => {
      activeTurnWaiter.cleanup();
      this._endTurn(turnAbortController);
    };
    const assertResumedTurnNotDeleted = () => {
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
      }
    };
    try {
      this._assertOpenForTurn(`respond[${expectedKind}]`);
    } catch (err) {
      let thrown = err;
      if (responseId !== undefined) {
        try {
          await this._markInboxResponseFailed(responseId, err);
        } catch (responseErr) {
          thrown = responseErr;
        }
      }
      finishResumedTurn();
      // §13.3f.1 — respondTo* is a public §4.2b boundary; the open-for-turn assert
      // throws construction-safe Harness errors (pass-through), but the
      // response-failed write can surface a raw storage error. Redact before
      // rejecting the caller.
      throw redactPublicBoundaryRejection(thrown);
    }
    let full: FullOutput<unknown>;
    let outputDrainError: AgentThreadOutputDrainError | undefined;
    try {
      assertResumedTurnNotDeleted();
      const threadSubscription = await Promise.race([this._ensureThreadSubscription(agent), activeTurnWaiter.promise]);
      // §4.2e / §6.1 — rebuild + pass the harness RequestContext on RESUME too, so
      // the resumed turn carries the 'harness' slot AND the per-tool permission gate
      // resolver. The resolver is a live closure (not serializable into the suspend
      // snapshot via toJSON), so without this a resumed turn would run UNGATED — the
      // §4.2e pre-action gate must re-evaluate before resume/execute, not just on the
      // initial turn.
      const [resumeRequestContext, turnInstructions] = await Promise.race([
        Promise.all([
          this._buildRequestContext({
            modeId: resumeModeId,
            modelId: resumeRuntimeDependencies.modelId ?? this._record.modelId,
            abortSignal: turnAbortController.signal,
            // §5.1 — rebuild the SAME caller app bag the suspended turn carried (the
            // queued-drain path already threads `item.requestContext`; resume used to
            // drop it). `_buildRequestContext` re-stashes it so a re-suspend on this
            // resumed turn re-persists it. Absent on legacy pendings ⇒ no app bag.
            ...(pending.requestContext ? { persistedRequestContext: pending.requestContext } : {}),
            yolo: pending.yolo === true,
          }),
          this._turnInstructions(resumeMode.instructions),
        ]),
        activeTurnWaiter.promise,
      ]);
      if (pending.toolSurfaceFence) {
        stageToolSurfaceFenceRestore(resumeRequestContext, pending.runId, pending.toolSurfaceFence);
      }
      this._restorePendingRunToolReceipts(pending);
      const resumeStream = agent.resumeStream(resumeData, {
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        memory: { thread: this.threadId, resource: this.resourceId },
        abortSignal: turnAbortController.signal,
        requestContext: resumeRequestContext,
        // Resume must re-carry the ceiling: a missing `maxSteps` here caps the
        // RESUMED segment at the agent's 5-step default and ends it mid-task
        // (the agent-controller documents the identical trap for its lane).
        maxSteps: HARNESS_SESSION_MAX_STEPS,
        ...this._createEmptySynthesisOptions(),
        ...resumeToolSurface,
        ...(turnInstructions ? { instructions: turnInstructions } : {}),
      });
      void resumeStream.catch(() => {});
      const out = await Promise.race([resumeStream, activeTurnWaiter.promise]);
      // §10.4 — the thread runtime removes a suspended run from its subscriber's
      // `seenRunIds`, so re-registering the same run id on resume queues the new
      // segment on the existing long-lived subscription. That subscription stays
      // the sole event consumer. Reading `out.fullStream` here as well would emit
      // every resumed tool/text chunk twice.
      const outputDrain = threadSubscription._waitForOutputDrain?.(out);
      // Registration can fail before the provider finishes producing FullOutput.
      // Observe the barrier immediately, then await it after FullOutput so the
      // durable completion-vs-retry decision still has the concrete model result.
      void outputDrain?.catch(() => {});
      const fullOutput = out.getFullOutput() as Promise<FullOutput<unknown>>;
      void fullOutput.catch(() => {});
      full = await Promise.race([fullOutput, activeTurnWaiter.promise]);
      if (outputDrain) {
        try {
          await Promise.race([outputDrain, activeTurnWaiter.promise]);
        } catch (error) {
          // The provider/tool work has already reached a concrete FullOutput at
          // this point. A thread-terminal publication or delivery failure must
          // still reject the public resume call, but it must not run the
          // pre-completion catch below: reverting `resumedAt` there would make an
          // already-executed approval/suspension retryable. Finish the durable
          // pending/receipt/queue transition first, then surface the drain error.
          if (error instanceof AgentThreadOutputDrainError) {
            outputDrainError = error;
          } else {
            throw error;
          }
        }
      }
      // Mirror ordinary-run finalization: a resumed segment can start a new
      // tool before it is aborted or otherwise terminates without a result.
      // Close that tool while the run's receipt state can still be projected.
      if (full.finishReason !== 'suspended' && this._currentRunId === pending.runId) {
        // The consumed pending record remains installed until the resume's
        // durable settlement below, so explicitly close only this terminal
        // resumed segment rather than treating it as still parked.
        this._emitAbortedToolEnds({ force: true });
      }
      full = this._materializeHarnessRunOutput(pending.runId, full);
      const resumedQueuedItemId = this._queuedItemIdForPendingResume(pending);
      if (full.finishReason !== 'suspended' && resumedQueuedItemId !== undefined) {
        await Promise.race([
          this._markQueuedTurnCompleted(resumedQueuedItemId, full, { modeId: modeFlipTarget }),
          activeTurnWaiter.promise,
        ]);
      }
    } catch (err) {
      let thrown = err;
      let retryableAdmissionRestored = false;
      try {
        retryableAdmissionRestored = await Promise.race([
          this._revertFailedResumeAdmission(pending, resumedAt, responseId, err),
          activeTurnWaiter.promise,
        ]);
      } catch (responseErr) {
        thrown = responseErr;
        this._emitter.emit({
          type: 'storage_error',
          operation: 'session_save',
          retryable: true,
          error: { code: 'harness.storage', message: 'failed to restore retryable inbox response admission' },
          resourceId: this.resourceId,
          threadId: this.threadId,
          harnessName: this._record.harnessName,
        } as EmitInput);
      }
      finishResumedTurn();
      // §5.4 / §5.7 — `pendingResume.resumedAt` is the at-least-once
      // idempotency marker, set under the lease BEFORE the agent call so a
      // CRASH between "marked resumed" and "cleared pending" replays as a
      // no-op on rehydration (the next caller observes the durable marker and
      // rejects rather than double-resuming). That crash-recovery contract is
      // preserved untouched: it only governs markers that SURVIVE a process
      // death. Here, by contrast, the resume threw IN-PROCESS — no completion,
      // re-suspension, or settlement occurred (those land in the later try
      // block, never this catch; the only writes reaching this catch are the
      // resumeStream/getFullOutput rejection and the queue-completion mark,
      // and `_markQueuedTurnCompleted` never throws QueuePostRunFinalizationPendingError,
      // so the deferred-finalization defer is not in play here). We KNOW the
      // attempt failed, so it is both safe and strictly better than waiting for
      // QUEUE_ACCEPTED_RECOVERY_STALE_MS to revert the marker back to undefined,
      // restoring the suspension to its retryable `waiting` state. Without this,
      // an immediate `respondTo*` retry hits the `resumedAt`-set branch and is
      // told "awaiting agent confirmation", and `_maybeDrainQueue` parks until
      // the staleness window elapses — a real liveness gap (F2).
      //
      // The revert is CAS-guarded (only clears the marker WE stamped on the
      // SAME pending identity) and best-effort: if a concurrent caller already
      // cleared/advanced pending it leaves it alone, and if the session is
      // CLOSING/CLOSED/DELETED/EVICTED the revert flush rejects — we swallow
      // that, because (a) `_isShutdownDrainBusy()` already treats a parked
      // pendingResume as non-busy (a suspension awaiting a user response must
      // not block shutdown), and (b) a closed/deleted record is being torn down,
      // so a residual `resumedAt` on it is never observed again. The original
      // resume error must surface regardless, so the revert never masks it (F4).
      // §S3.1 — surface the failed resume as a NON-terminal `resume_failed` event so
      // an event-only consumer learns the attempt failed instead of seeing the run
      // stuck "running". It is deliberately NOT a terminal `agent_end`: the marker
      // revert above restored the suspension to `waiting`, so a subsequent
      // `respondTo*` can retry (finalizing here would wrongly mark the run failed and
      // poison a later retry's run_completed/run-summary for the same runId).
      this._emitTurnEvent({
        type: 'resume_failed',
        runId: pending.runId,
        retryable: retryableAdmissionRestored,
        error: projectHarnessPublicError(thrown),
      });
      // §13.3f.1 — respondTo* (this resume) is a public §4.2b boundary; the
      // resumed agent run (resumeStream / getFullOutput) can reject with a raw
      // provider/runtime error. Redact before rejecting the caller's promise.
      // An origin signal remains pending because the marker revert makes this
      // resume retryable. Truly terminal resume failures settle it in the
      // terminalization paths below. A HarnessSessionDeletedError from the
      // response-failed write passes through unchanged.
      throw redactPublicBoundaryRejection(thrown);
    }

    if (outputDrainError) {
      this._emitUndeliveredResumedToolEnd(pending, full, outputDrainError);
    }

    if (outputDrainError && full.finishReason === 'suspended') {
      let thrown: unknown = outputDrainError;
      let terminalized = false;
      try {
        terminalized = await this._terminalizeUndeliverableResuspension({
          pending,
          resumedAt,
          responseId,
          queuedItemId: pendingQueuedItemId,
          modeFlipTarget,
          previousModeId,
          full,
          error: outputDrainError,
        });
      } catch (error) {
        thrown = error;
      } finally {
        if (!terminalized) {
          // The resumed stream may already have published a new tool_start. If
          // terminalization fails before removing the old durable pending, the
          // ordinary turn teardown deliberately preserves parked tools and
          // would skip this one too. This branch is terminal from the caller's
          // perspective, so force-close every newly active tool while queued
          // correlation is still attached to its terminal event.
          this._emitAbortedToolEnds({ force: true });
        }
        finishResumedTurn();
        // Keep queued correlation live through tool_end, resume_failed,
        // agent_end, run_completed, and generic turn teardown, then always
        // release the in-process owner. If terminalization failed before its
        // CAS, the durable pending still carries `resumedAt`; re-kicking the
        // drain arms the existing stale-recovery timer instead of leaving the
        // queue parked until an unrelated external call arrives.
        if (pendingQueuedItemId !== undefined) {
          this._currentQueuedItemId = undefined;
          this._currentQueuedItemSource = undefined;
          this._notifyMaybeIdle();
        }
      }
      if (pendingQueuedItemId !== undefined) {
        void this._maybeDrainQueue();
      }
      throw redactPublicBoundaryRejection(thrown);
    }

    // Clear pending + apply any remaining mode flip in a single CAS write. A
    // queued terminal resume has already persisted its completed receipt before
    // this point, so crash recovery never sees "pending cleared, queue still
    // accepted".
    const completingQueuedItemId = full.finishReason !== 'suspended' ? pendingQueuedItemId : undefined;
    try {
      const suspendedPayload =
        full.finishReason === 'suspended'
          ? (full.suspendPayload as
              | {
                  toolCallId: string;
                  toolName: string;
                  args?: unknown;
                  suspendPayload?: unknown;
                  approvalReasons?: string[];
                }
              | undefined)
          : undefined;
      const suspendedPending =
        suspendedPayload !== undefined
          ? this._pendingResumeFromSuspendedOutput(
              full,
              suspendedPayload,
              pendingQueuedItemId,
              resumeModeId,
              resumeRuntimeDependencies.modelId,
              pending.originSignalId,
            )
          : undefined;
      const suspendedTokenUsageDelta =
        full.finishReason === 'suspended'
          ? this._tokenUsageDeltaFromFullOutput(full, pending.accountedTokenUsage)
          : undefined;
      if (full.finishReason === 'suspended') this._captureTurnRunId(full);
      let alreadyAccounted = false;
      if (completingQueuedItemId !== undefined) {
        if (modeFlipTarget && modeFlipTarget !== previousModeId) {
          // §4.2e — a plan-approval mode transition re-establishes the target
          // mode's base permission policy (when it declares one), exactly like
          // create + switchMode. Keeps permissionRules consistent with modeId.
          const seededRules = this._harness._modePermissionRules(modeFlipTarget);
          await Promise.race([
            this._flushUpdate(prev => ({
              ...prev,
              modeId: modeFlipTarget,
              ...(seededRules !== undefined
                ? { permissionRules: seededRules, permissionRulesSeedHash: sha256CanonicalJson(seededRules) }
                : {}),
            })),
            activeTurnWaiter.promise,
          ]);
        }
        const queuedItem = this._record.pendingQueue.find(item => item.id === completingQueuedItemId);
        if (queuedItem) {
          let tokenUsageDelta: TokenUsage | undefined;
          try {
            this._captureTurnRunId(full);
            tokenUsageDelta = this._tokenUsageDeltaFromFullOutput(full, pending.accountedTokenUsage);
            alreadyAccounted = true;
            await Promise.race([
              this._markQueuedPostRunFinalized(completingQueuedItemId, { tokenUsageDelta }),
              activeTurnWaiter.promise,
            ]);
          } catch (err) {
            if (err instanceof HarnessSessionDeletedError) throw err;
            throw new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, err);
          }
        }
        if (!alreadyAccounted) {
          this._recordTurnCompletion(full, {
            persist: false,
            accountedCumulative: pending.accountedTokenUsage,
          });
        }
      } else if (full.finishReason !== 'suspended') {
        this._recordTurnCompletion(full, {
          persist: false,
          accountedCumulative: pending.accountedTokenUsage,
        });
      }
      const queueCompletedAt = Date.now();
      const responseAppliedAt = queueCompletedAt;
      await Promise.race([
        this._flushUpdate(
          prev => {
            const next: SessionRecord = { ...prev };
            if (full.finishReason === 'suspended' && suspendedPending !== undefined) {
              next.pendingResume = suspendedPending;
            } else {
              delete next.pendingResume;
            }
            const receipt =
              responseId !== undefined ? getOwnRecordValue(prev.inboxResponseReceipts, responseId) : undefined;
            if (receipt) {
              next.inboxResponseReceipts = pruneInboxResponseReceipts({
                ...(prev.inboxResponseReceipts ?? {}),
                [receipt.responseId]: {
                  ...receipt,
                  status: 'applied',
                  result: boundInboxReceiptResult(full) as typeof full,
                  appliedAt: receipt.appliedAt ?? responseAppliedAt,
                  updatedAt: responseAppliedAt,
                },
              });
            }
            if (modeFlipTarget) {
              next.modeId = modeFlipTarget;
              // §4.2e — re-seed the base permission policy for the transitioned mode.
              const seededRules = this._harness._modePermissionRules(modeFlipTarget);
              if (seededRules !== undefined) {
                next.permissionRules = seededRules;
                next.permissionRulesSeedHash = sha256CanonicalJson(seededRules);
              }
            }
            if (completingQueuedItemId !== undefined) {
              next.pendingQueue = (prev.pendingQueue ?? []).filter(x => x.id !== completingQueuedItemId);
              const receipt = prev.queueAdmissionReceipts?.[completingQueuedItemId];
              if (receipt) {
                next.queueAdmissionReceipts = {
                  ...(prev.queueAdmissionReceipts ?? {}),
                  [completingQueuedItemId]: {
                    ...receipt,
                    status: 'completed',
                    result: boundInboxReceiptResult(full),
                    completedAt: receipt.completedAt ?? queueCompletedAt,
                    updatedAt: queueCompletedAt,
                  },
                };
              }
            }
            return next;
          },
          {
            tokenUsageDelta:
              full.finishReason === 'suspended' && suspendedTokenUsageDelta !== undefined
                ? suspendedTokenUsageDelta
                : undefined,
          },
        ),
        activeTurnWaiter.promise,
      ]);
      if (full.finishReason !== 'suspended') {
        this._pendingReplacementToolSurfaces.delete(pending.runId);
      }

      // §10.2 defines no suspension_resolved event — resolution is observed via
      // the inbox response transition + display snapshot. A mode flip on a plan
      // approval still emits mode_changed; a re-suspension emits the matching
      // §10.2 pending event.
      if (modeFlipTarget && modeFlipTarget !== previousModeId) {
        this._emitter.emit({
          type: 'mode_changed',
          modeId: modeFlipTarget,
          previousModeId,
        });
      }

      if (suspendedPending !== undefined) {
        this._emitPendingEvent(suspendedPending);
      }

      // If the resumed run did NOT suspend again, the turn is complete from
      // the harness's perspective. Surface that to subscribers via agent_end.
      if (full.finishReason !== 'suspended') {
        this._emitAgentEnd({ runId: full.runId, finishReason: this._agentEndReasonForFullOutput(full), full });

        // §4.2f — an owned `signal()` turn that suspended left its durable
        // per-`signalId` evidence `pending`. The terminal (non-suspended)
        // resume IS that signal's answer (1:1), so settle the evidence and
        // project `signal_completed`/`signal_failed` now; otherwise a suspended
        // owned signal would stay pending forever. Queued turns are settled via
        // their queue receipt above and never carry `originSignalId`.
        if (pending.originSignalId !== undefined) {
          await this._settleSignalResult(pending.originSignalId, {
            status: 'completed',
            runId: pending.runId,
            result: full as AgentResult,
          });
        }

        // If this was the terminal completion of a queued turn, settle the
        // resolver, remove the head item, clear current, then kick the drain
        // for the next item.
        const wasGoalDriven = (this._currentQueuedItemSource ?? 'user') === 'goal';
        await Promise.race([this._runGoalJudge(full, wasGoalDriven), activeTurnWaiter.promise]);
        if (completingQueuedItemId !== undefined) {
          this._currentQueuedItemId = undefined;
          this._currentQueuedItemSource = undefined;
          const resolver = this._queueResolvers.get(completingQueuedItemId);
          if (resolver) {
            this._queueResolvers.delete(completingQueuedItemId);
            resolver.resolve(full as AgentResult);
          }
          this._notifyMaybeIdle();
        }
      }
    } catch (err) {
      if (err instanceof QueuePostRunFinalizationPendingError && completingQueuedItemId !== undefined) {
        this._deferQueuedTurnRetry(err);
      }
      // §13.3f.1 — respondTo* is a public §4.2b boundary; the post-completion
      // bookkeeping (_flushUpdate / settle / finalize) can reject with a raw
      // storage error. Redact before rejecting the caller (the deferred
      // QueuePostRunFinalizationPendingError and other Harness errors pass through).
      throw redactPublicBoundaryRejection(err);
    } finally {
      finishResumedTurn();
    }
    // A terminal queued resume clears the active-turn marker in the `finally`
    // above. Kick the next item only after that teardown; doing this inside the
    // completion block races `_maybeDrainQueue()` against the still-active
    // resume, so the busy guard returns and the remaining queue stays parked.
    if (completingQueuedItemId !== undefined && full.finishReason !== 'suspended') {
      void this._maybeDrainQueue();
    }
    if (outputDrainError) {
      throw redactPublicBoundaryRejection(outputDrainError);
    }
    if (responseMode === 'inbox-receipt') {
      const receipt =
        responseId !== undefined ? getOwnRecordValue(this._record.inboxResponseReceipts, responseId) : undefined;
      if (receipt) return this._inboxReceiptResult(receipt, false);
    }
    return full as AgentResult;
  }

  /**
   * A resumed segment can execute real side effects and then suspend again. If
   * its terminal publication/delivery fails, the thread runtime discards that
   * segment, so persisting the new suspension would create an interaction that
   * can never be resumed. Atomically consume the exact admitted pending marker,
   * fail its inbox/queue evidence, and preserve any already-earned token usage
   * before the public response rejects.
   */
  private async _terminalizeUndeliverableResuspension(input: {
    pending: PendingResume;
    resumedAt: number;
    responseId?: string;
    queuedItemId?: string;
    modeFlipTarget?: string;
    previousModeId: string;
    full: FullOutput<unknown>;
    error: AgentThreadOutputDrainError;
  }): Promise<boolean> {
    const { pending, resumedAt, responseId, queuedItemId, modeFlipTarget, previousModeId, full, error } = input;
    const failedAt = Date.now();
    const projectedError = projectHarnessPublicError(error);
    const usageDelta = this._tokenUsageDeltaFromFullOutput(full, pending.accountedTokenUsage);
    let terminalized = false;
    let usageDeltaToPersist: TokenUsage | undefined;
    let failedQueueReceipt: QueueAdmissionReceipt | undefined;

    this._captureTurnRunId(full);
    await this._flushUpdate(
      prev => {
        // `_flushUpdate` can replay this pure updater once after a CAS reload;
        // reset attempt-local observations before matching the current image.
        terminalized = false;
        usageDeltaToPersist = undefined;
        failedQueueReceipt = undefined;
        const current = prev.pendingResume;
        if (
          current === undefined ||
          current.kind !== pending.kind ||
          current.runId !== pending.runId ||
          current.toolCallId !== pending.toolCallId ||
          (current.itemId ?? current.toolCallId) !== (pending.itemId ?? pending.toolCallId) ||
          current.requestedAt !== pending.requestedAt ||
          current.resumedAt !== resumedAt
        ) {
          return prev;
        }

        terminalized = true;
        usageDeltaToPersist = usageDelta;
        const next: SessionRecord = { ...prev };
        delete next.pendingResume;

        if (responseId !== undefined) {
          const receipt = getOwnRecordValue(prev.inboxResponseReceipts, responseId);
          if (receipt && receipt.status !== 'applied' && receipt.status !== 'failed' && receipt.status !== 'dead') {
            next.inboxResponseReceipts = {
              ...(prev.inboxResponseReceipts ?? {}),
              [responseId]: {
                ...receipt,
                status: 'failed',
                error: projectedError,
                retryable: false,
                failedAt: receipt.failedAt ?? failedAt,
                updatedAt: failedAt,
              },
            };
          }
        }

        if (queuedItemId !== undefined) {
          next.pendingQueue = (prev.pendingQueue ?? []).filter(item => item.id !== queuedItemId);
          const receipt = prev.queueAdmissionReceipts?.[queuedItemId];
          if (receipt && receipt.status !== 'completed' && receipt.status !== 'failed' && receipt.status !== 'dead') {
            failedQueueReceipt = {
              ...receipt,
              status: 'failed',
              error: projectedError,
              failedAt: receipt.failedAt ?? failedAt,
              updatedAt: failedAt,
            };
            next.queueAdmissionReceipts = {
              ...(prev.queueAdmissionReceipts ?? {}),
              [queuedItemId]: failedQueueReceipt,
            };
          }
        }

        if (modeFlipTarget !== undefined) {
          next.modeId = modeFlipTarget;
          const seededRules = this._harness._modePermissionRules(modeFlipTarget);
          if (seededRules !== undefined) {
            next.permissionRules = seededRules;
            next.permissionRulesSeedHash = sha256CanonicalJson(seededRules);
          }
        }
        return next;
      },
      { tokenUsageDelta: () => usageDeltaToPersist },
    );

    if (!terminalized) return false;
    this._pendingReplacementToolSurfaces.delete(pending.runId);

    if (queuedItemId !== undefined) {
      const settledReceipt = this._record.queueAdmissionReceipts?.[queuedItemId] ?? failedQueueReceipt;
      if (settledReceipt?.signalId !== undefined) {
        await this._writeQueueSignalResultEvidence({
          status: 'failed',
          signalId: settledReceipt.signalId,
          runId: settledReceipt.runId,
          error: projectedError,
        }).catch(() => {});
      }
      this._emit({
        type: 'queue_failed',
        queuedItemId,
        ...(settledReceipt?.runId ? { runId: settledReceipt.runId } : {}),
        ...(settledReceipt?.signalId ? { signalId: settledReceipt.signalId } : {}),
        ...(settledReceipt?.admissionId ? { admissionId: settledReceipt.admissionId } : {}),
        error: projectedError,
      });
      const resolver = this._queueResolvers.get(queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(queuedItemId);
        resolver.reject(publicErrorProjectionToError(projectedError));
      }
    }

    if (pending.originSignalId !== undefined) {
      await this._settleSignalResult(pending.originSignalId, {
        status: 'failed',
        runId: pending.runId,
        error: projectedError,
      });
    }
    if (modeFlipTarget !== undefined && modeFlipTarget !== previousModeId) {
      this._emitter.emit({ type: 'mode_changed', modeId: modeFlipTarget, previousModeId });
    }
    // The resumed segment may have emitted a new tool_start before its
    // re-suspension became undeliverable. Close every such tool before the
    // failed agent terminal so event order and the finalized tool rollup remain
    // truthful. `_emitAbortedToolEnds` removes emitted entries, making the later
    // generic turn teardown a no-op for them.
    this._emitAbortedToolEnds();
    this._emitTurnEvent({
      type: 'resume_failed',
      runId: pending.runId,
      retryable: false,
      error: projectedError,
    });
    this._emitAgentEnd({ runId: full.runId, finishReason: 'error', full });
    return true;
  }

  private _resolveStoredInboxResponse(
    expectedKind: PendingResume['kind'],
    resumeData: unknown,
    responseOptions: InboxResponseOptions,
  ): InboxResponseResult | undefined {
    const responseId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'responseId');
    if (typeof responseId !== 'string') return undefined;
    const receipt = getOwnRecordValue(this._record.inboxResponseReceipts, responseId);
    if (receipt === undefined) return undefined;
    if (receipt.kind !== expectedKind) {
      throw new HarnessInboxResponseConflictError(this.id, receipt.itemId, responseId);
    }
    const requestedItemId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'itemId');
    if (requestedItemId !== undefined && typeof requestedItemId !== 'string') {
      throw new HarnessValidationError(`respond[${expectedKind}].itemId`, 'itemId must be a string');
    }
    if (requestedItemId !== undefined && receipt.itemId !== requestedItemId) {
      throw new HarnessInboxItemNotFoundError(
        this.id,
        requestedItemId,
        expectedKind === 'sandbox-access' ? undefined : expectedKind,
      );
    }
    const requestedRunId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'runId');
    const requestedToolCallId = getOwnRecordValue(responseOptions as Record<string, unknown>, 'toolCallId');
    const requestedPendingRequestedAt = getOwnRecordValue(
      responseOptions as Record<string, unknown>,
      'pendingRequestedAt',
    );
    if (
      receipt.runId !== requestedRunId ||
      receipt.toolCallId !== requestedToolCallId ||
      receipt.pendingRequestedAt !== requestedPendingRequestedAt
    ) {
      throw new HarnessInboxResponseConflictError(this.id, receipt.itemId, responseId);
    }
    const attemptedHash = this._computeInboxResponseHash({
      kind: expectedKind,
      itemId: receipt.itemId,
      runId: receipt.runId,
      pendingRequestedAt: receipt.pendingRequestedAt,
      response: resumeData,
      ...(expectedKind === 'tool-approval' ? { approvalScope: responseOptions.approvalScope ?? 'once' } : {}),
    });
    if (attemptedHash !== receipt.responseHash) {
      throw new HarnessInboxResponseConflictError(this.id, receipt.itemId, responseId);
    }
    this._throwStoredInboxResponseFailure(receipt);
    return this._inboxReceiptResult(receipt, true);
  }

  private _assertMatchingInboxReceipt(
    receipt: InboxResponseReceipt,
    input: { kind: PendingResume['kind']; itemId: string; responseId: string; responseHash: string },
  ): void {
    if (receipt.kind !== input.kind || receipt.itemId !== input.itemId || receipt.responseHash !== input.responseHash) {
      throw new HarnessInboxResponseConflictError(this.id, input.itemId, input.responseId);
    }
  }

  private _inboxReceiptResult(receipt: InboxResponseReceipt, duplicate: boolean): InboxResponseResult {
    return {
      itemId: receipt.itemId,
      kind: receipt.kind,
      status: receipt.status === 'applied' ? 'applied' : 'accepted',
      responseId: receipt.responseId,
      duplicate,
    };
  }

  private _throwStoredInboxResponseFailure(receipt: InboxResponseReceipt): void {
    if (receipt.status !== 'failed' && receipt.status !== 'dead') return;
    if (receipt.status === 'failed' && receipt.retryable === true) return;
    throw publicErrorProjectionToError(
      receipt.error ?? { code: 'harness.inbox_response_failed', message: 'inbox response failed' },
    );
  }

  private async _applyInboxReceiptFromCompletedQueue(
    receipt: InboxResponseReceipt,
  ): Promise<InboxResponseReceipt | undefined> {
    if (receipt.queuedItemId === undefined) return undefined;
    const completed = this._record.queueAdmissionReceipts?.[receipt.queuedItemId];
    if (completed?.status !== 'completed' || completed.runId !== receipt.runId || completed.result === undefined) {
      return undefined;
    }
    await this._markInboxResponseApplied(receipt.responseId, completed.result as AgentResult);
    return getOwnRecordValue(this._record.inboxResponseReceipts, receipt.responseId) ?? receipt;
  }

  private async _markInboxResponseApplied(responseId: string, result: AgentResult): Promise<void> {
    const appliedAt = Date.now();
    await this._flushUpdate(prev => {
      const receipt = getOwnRecordValue(prev.inboxResponseReceipts, responseId);
      if (!receipt || receipt.status === 'applied') return prev;
      return {
        ...prev,
        inboxResponseReceipts: {
          ...(prev.inboxResponseReceipts ?? {}),
          [responseId]: {
            ...receipt,
            status: 'applied',
            result,
            appliedAt: receipt.appliedAt ?? appliedAt,
            updatedAt: appliedAt,
          },
        },
      };
    });
  }

  private async _recordInboxResponsePreDispatchFailure(
    input: {
      responseId: string;
      responseHash: string;
      itemId: string;
      queuedItemId?: string;
      kind: PendingResume['kind'];
      pending: PendingResume;
      response: unknown;
      approvalScope?: 'once' | 'always';
    },
    err: unknown,
  ): Promise<void> {
    const failedAt = Date.now();
    await this._flushUpdate(prev => {
      const currentReceipt = getOwnRecordValue(prev.inboxResponseReceipts, input.responseId);
      if (currentReceipt !== undefined) {
        this._assertMatchingInboxReceipt(currentReceipt, {
          kind: input.kind,
          itemId: input.itemId,
          responseId: input.responseId,
          responseHash: input.responseHash,
        });
        return prev;
      }
      return {
        ...prev,
        inboxResponseReceipts: {
          ...(prev.inboxResponseReceipts ?? {}),
          [input.responseId]: {
            responseId: input.responseId,
            responseHash: input.responseHash,
            resumeAttemptId: input.responseId,
            itemId: input.itemId,
            ...(input.queuedItemId !== undefined ? { queuedItemId: input.queuedItemId } : {}),
            kind: input.kind,
            runId: input.pending.runId,
            toolCallId: input.pending.toolCallId,
            pendingRequestedAt: input.pending.requestedAt,
            response: input.response,
            ...(input.approvalScope !== undefined ? { approvalScope: input.approvalScope } : {}),
            status: 'failed',
            error: projectHarnessPublicError(err),
            retryable: false,
            acceptedAt: failedAt,
            failedAt,
            updatedAt: failedAt,
          } satisfies InboxResponseReceipt,
        },
      };
    });
  }

  private async _markInboxResponseFailed(responseId: string, err: unknown): Promise<void> {
    const failedAt = Date.now();
    await this._flushUpdate(prev => {
      const receipt = getOwnRecordValue(prev.inboxResponseReceipts, responseId);
      if (!receipt || receipt.status === 'applied' || receipt.status === 'failed' || receipt.status === 'dead') {
        return prev;
      }
      return {
        ...prev,
        inboxResponseReceipts: {
          ...(prev.inboxResponseReceipts ?? {}),
          [responseId]: {
            ...receipt,
            status: 'failed',
            error: projectHarnessPublicError(err),
            retryable: false,
            failedAt: receipt.failedAt ?? failedAt,
            updatedAt: failedAt,
          },
        },
      };
    });
  }

  private _computeInboxResponseHash(input: {
    kind: PendingResume['kind'];
    itemId: string;
    runId: string;
    pendingRequestedAt: number;
    response: unknown;
    approvalScope?: 'once' | 'always';
  }): string {
    return sha256CanonicalJson(input);
  }

  private _queuedItemIdForPendingResume(pending: PendingResume): string | undefined {
    if (pending.queuedItemId !== undefined) return pending.queuedItemId;
    if (this._currentQueuedItemId !== undefined) return this._currentQueuedItemId;
    return (this._record.pendingQueue ?? []).find(item => {
      const receipt = this._record.queueAdmissionReceipts?.[item.id];
      return (receipt?.status === 'accepted' || receipt?.status === 'completed') && receipt.runId === pending.runId;
    })?.id;
  }

  private _modeIdForPendingResume(pending: PendingResume): string {
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    const queuedItem = queuedItemId ? this._record.pendingQueue.find(item => item.id === queuedItemId) : undefined;
    const receipt = queuedItemId ? this._record.queueAdmissionReceipts?.[queuedItemId] : undefined;
    return pending.modeId ?? receipt?.modeId ?? queuedItem?.mode ?? this._record.modeId;
  }

  private _modelIdForQueuedItem(queuedItemId: string | undefined): string {
    const queuedItem = queuedItemId ? this._record.pendingQueue.find(item => item.id === queuedItemId) : undefined;
    const receipt = queuedItemId ? this._record.queueAdmissionReceipts?.[queuedItemId] : undefined;
    return queuedItem?.model ?? receipt?.runtimeDependencies?.modelId ?? this._record.modelId;
  }

  private _runtimeDependenciesForPendingResume(pending: PendingResume): HarnessRuntimeDependencyRefs {
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    const queuedItem = queuedItemId ? this._record.pendingQueue.find(item => item.id === queuedItemId) : undefined;
    const receipt = queuedItemId ? this._record.queueAdmissionReceipts?.[queuedItemId] : undefined;
    const modeId = this._modeIdForPendingResume(pending);
    const modelId = queuedItem?.model ?? this._record.modelId;
    return pending.runtimeDependencies ?? receipt?.runtimeDependencies ?? { modeId, ...(modelId ? { modelId } : {}) };
  }

  /**
   * §5.4 / §5.7 — revert the at-least-once resume marker after an IN-PROCESS
   * resume failure so the suspension returns to a retryable `waiting` state
   * instead of looking "resuming" until the staleness window elapses.
   *
   * Only the in-process resume catch calls this, where we KNOW the agent call
   * threw before any settlement/re-suspension (those land in the later try
   * block, not the resume catch). The crash-recovery contract — a marker that
   * SURVIVES process death rejects on rehydration — is unaffected, since this
   * never runs on a rehydrated marker.
   *
   * CAS-guarded: clears `resumedAt` only when `pendingResume` is still the same
   * suspension (same runId/toolCallId/itemId) and still carries exactly the
   * marker WE stamped (`=== resumedAt`). A concurrent caller that already
   * cleared or advanced pending is left untouched. After a successful revert we
   * void-kick `_maybeDrainQueue()` (only while live) so a parked queue self-heals
   * in-process rather than waiting for an external trigger.
   *
   * The flush is allowed to reject on a closing/closed/deleted/evicted session;
   * the caller swallows that (the record is being torn down and a parked
   * pendingResume is already non-busy for shutdown — see `_isShutdownDrainBusy`).
   */
  private async _revertFailedResumeAdmission(
    pending: PendingResume,
    resumedAt: number,
    responseId: string | undefined,
    error: unknown,
  ): Promise<boolean> {
    let reverted = false;
    const failedAt = Date.now();
    await this._flushUpdate(prev => {
      const current = prev.pendingResume;
      if (
        current === undefined ||
        current.resumedAt !== resumedAt ||
        current.runId !== pending.runId ||
        current.toolCallId !== pending.toolCallId ||
        (current.itemId ?? current.toolCallId) !== (pending.itemId ?? pending.toolCallId)
      ) {
        return prev;
      }
      const receipt = responseId ? getOwnRecordValue(prev.inboxResponseReceipts, responseId) : undefined;
      if (
        responseId !== undefined &&
        (receipt === undefined ||
          receipt.status !== 'accepted' ||
          receipt.runId !== pending.runId ||
          receipt.toolCallId !== pending.toolCallId ||
          receipt.pendingRequestedAt !== pending.requestedAt)
      ) {
        return prev;
      }
      reverted = true;
      const restored: PendingResume = { ...current };
      delete restored.resumedAt;
      delete restored.resumeRecoveryAt;
      delete restored.resumeRecoveryStartedAt;
      const next: SessionRecord = { ...prev, pendingResume: restored };
      if (receipt !== undefined) {
        next.inboxResponseReceipts = {
          ...(prev.inboxResponseReceipts ?? {}),
          [receipt.responseId]: {
            ...receipt,
            status: 'failed',
            error: projectHarnessPublicError(error),
            retryable: true,
            failedAt,
            updatedAt: failedAt,
          },
        };
      }
      return next;
    });
    if (reverted && this._state === 'live') {
      void this._maybeDrainQueue();
    }
    return reverted;
  }

  private async _maybeRecoverStaleQueuedResume({
    kickDrainOnStale = true,
  }: { kickDrainOnStale?: boolean } = {}): Promise<QueueResumeRecoveryResult> {
    if (this._currentTurnAbortController !== undefined) return { status: 'none' };
    const pending = this._record.pendingResume;
    if (pending?.resumedAt === undefined) return { status: 'none' };
    const queuedItemId = this._queuedItemIdForPendingResume(pending);
    if (queuedItemId === undefined) return { status: 'none' };
    // §10.2: no queue_item_replayed event on crash-recovery — the recovered
    // turn flows through normal drain/agent_start; settlement evidence stays durable.
    this._ensureQueuedItemContext(queuedItemId);

    const currentReceipt = this._record.queueAdmissionReceipts?.[queuedItemId];
    if (currentReceipt?.status === 'completed') {
      const queuedItem = this._record.pendingQueue.find(item => item.id === queuedItemId);
      const shouldRunPostRunSideEffects = queuedItem !== undefined && currentReceipt.postRunFinalizedAt === undefined;
      let alreadyAccounted = false;
      if (shouldRunPostRunSideEffects) {
        let tokenUsageDelta: TokenUsage | undefined;
        try {
          const full = currentReceipt.result as FullOutput<unknown>;
          this._captureTurnRunId(full);
          tokenUsageDelta = this._tokenUsageDeltaFromFullOutput(full, pending.accountedTokenUsage);
          alreadyAccounted = true;
          await this._markQueuedPostRunFinalized(queuedItemId, { tokenUsageDelta });
        } catch (err) {
          this._deferQueuedTurnRetry(
            new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, err),
          );
          return { status: 'none' };
        }
      }
      await this._flushUpdate(prev => {
        const current = prev.pendingResume;
        if (
          !current ||
          current.runId !== pending.runId ||
          current.toolCallId !== pending.toolCallId ||
          current.resumedAt !== pending.resumedAt
        ) {
          return prev;
        }
        const next: SessionRecord = {
          ...prev,
          pendingQueue: (prev.pendingQueue ?? []).filter(item => item.id !== queuedItemId),
        };
        delete next.pendingResume;
        return next;
      });
      if (shouldRunPostRunSideEffects && queuedItem) {
        await this._finalizeQueuedRunCompletion(
          queuedItem,
          currentReceipt.result as FullOutput<unknown>,
          pending.modeId ?? currentReceipt.modeId ?? queuedItem.mode ?? this._record.modeId,
          undefined,
          { skipTokenAccounting: alreadyAccounted },
        );
      }
      this._currentQueuedItemId = undefined;
      this._currentQueuedItemSource = undefined;
      const resolver = this._queueResolvers.get(queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(queuedItemId);
        resolver.resolve(currentReceipt.result as AgentResult);
      }
      this._notifyMaybeIdle();
      void this._maybeDrainQueue();
      return { status: 'completed', result: currentReceipt.result as AgentResult };
    }

    const retryAt = pending.resumedAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS;
    if (Date.now() < retryAt) {
      if (this._queuedResumeRecoveryTimer === undefined) {
        const delayMs = Math.max(0, retryAt - Date.now());
        this._queuedResumeRecoveryTimer = setTimeout(() => {
          this._queuedResumeRecoveryTimer = undefined;
          void this._maybeDrainQueue();
        }, delayMs);
        this._queuedResumeRecoveryTimer.unref?.();
      }
      return { status: 'none' };
    }

    if (this._queuedResumeRecoveryTimer !== undefined) {
      clearTimeout(this._queuedResumeRecoveryTimer);
      this._queuedResumeRecoveryTimer = undefined;
    }

    const recovered = await this._recoverStaleResumeAdmission(this._pendingInteractionGeneration(pending), {
      drainQueue: kickDrainOnStale,
    });
    return recovered ? { status: 'stale' } : { status: 'none' };
  }

  // -------------------------------------------------------------------------
  // queue() — wait-for-idle FIFO turn queue (§4.2 / §6).
  //
  // Append-then-drain. The capacity check + durable append are atomic per
  // session: two concurrent `queue()` calls on the same Session instance
  // race on the in-process `_flushUpdate` lock, so neither can both observe
  // available space and commit past the cap. Cross-instance contention is
  // covered by the lease + version CAS on the underlying record.
  //
  // Drain semantics:
  //   1. `queue()` admits → flush record → register resolver → kick drain.
  //   2. Drain pulls head item, emits `queue_item_started`, runs the turn
  //      by dispatching a deterministic `agent.sendSignal()` turn (so
  //      `agent_start`, `message_*`, `tool_*`, `suspension_*`, `agent_end`
  //      all flow with `queuedItemId` stamped automatically by
  //      `_emitTurnEvent`).
  //   3. If the turn suspends, the head item stays in `pendingQueue` and
  //      `_currentQueuedItemId` stays set. The next `respondTo*` call calls
  //      into `_resume`; on terminal completion the resume path settles the
  //      resolver + removes the head + kicks drain again.
  //   4. If the turn completes without suspending, the queue receipt,
  //      signal-result evidence, resolver, and head item settle together.
  //
  // Promise resolution: the eventual `AgentResult` once the turn fully ends
  // (including any suspend → resume cycles). Rejection surfaces admission
  // conflicts, queued-run failures, stale accepted recovery, or expired
  // duplicate-result evidence.
  // -------------------------------------------------------------------------

  /**
   * Append a turn to the durable queue. Resolves with the eventual
   * `AgentResult` once the turn fully completes — including any
   * suspend → resume cycles.
   *
   * Rejects synchronously with:
   *   - `HarnessConfigError` if the session is not live, or `mode` is unknown.
   *   - `HarnessValidationError` if `content` is empty.
   *   - `HarnessQueueFullError` if `pendingQueue.length` is already at
   *     `sessions.maxQueueDepth`.
   *   - `HarnessSessionCancelledError` if the session has been cancelled.
   */
  async queue(opts: QueueOptions): Promise<AgentResult> {
    const admission = await this._admitQueue(opts, 'queue()');
    if (admission.duplicate) {
      return this._withActiveDeletedWaiter(activeDeleted =>
        this._raceActiveTurnWaiter(this._returnDuplicateQueueResult(admission.evidence, activeDeleted), activeDeleted),
      );
    }

    const queued = createDeferred<AgentResult>();
    const promise = queued.promise;
    const latestReceipt = this._record.queueAdmissionReceipts?.[admission.queuedItemId];
    const terminalAdmissionError = this._queueReceiptTerminalFailureErrorFromReceipt(latestReceipt);
    if (terminalAdmissionError) {
      queued.reject(
        latestReceipt?.status === 'failed' && latestReceipt.error?.code === 'harness.queue_full_dropped'
          ? new HarnessQueueFullDroppedError(admission.queuedItemId)
          : terminalAdmissionError,
      );
      void promise.catch(() => {});
      return promise;
    }
    if (latestReceipt?.status === 'completed') {
      queued.resolve(latestReceipt.result as AgentResult);
      return promise;
    }

    this._queueResolvers.set(admission.queuedItemId, { promise, resolve: queued.resolve, reject: queued.reject });
    // Kick the drain — fire-and-forget. Drain handles its own errors and
    // settles the resolver via `_completeQueuedTurn` / `_failQueuedTurn`.
    void this._maybeDrainQueue();
    void promise.catch(() => {});
    return promise;
  }

  /**
   * Admit a queued turn without awaiting its eventual AgentResult. This is the
   * remote-route counterpart to `queue(...)`; SDK promises settle from
   * session events or result lookup routes.
   */
  async admitQueue(opts: QueueOptions): Promise<QueueAdmissionResult> {
    if (opts.admissionId === undefined || opts.admissionId.length === 0) {
      throw new HarnessValidationError('admitQueue().admissionId', 'admissionId must be a non-empty string');
    }
    const admission = await this._admitQueue(opts, 'admitQueue()');
    if (!admission.duplicate) {
      this._liveAdmittedQueuedItemIds.add(admission.queuedItemId);
    }
    void this._maybeDrainQueue();
    return { accepted: true, queuedItemId: admission.queuedItemId, duplicate: admission.duplicate };
  }

  /**
   * @internal §14.2 channel ingress admission via the queue path. Like
   * `admitQueue` but threads a persisted `requestContext` (the trusted
   * `requestContext.channel` projection built by the bridge) into the queued item
   * so the admitted turn — and its crash recovery — carry channel provenance.
   * `admissionId` (the inbox item id) makes a provider/worker retry idempotent.
   */
  async _admitChannelQueueTurn(opts: {
    content: string;
    admissionId: string;
    requestContext: PersistedRequestContextInput;
    mode?: string;
    model?: string;
    // Already-normalized persisted attachments from the durable inbox row. The
    // channel bridge resolves provider files to Harness-owned refs before the row
    // exists (§14.2 step 3); a queued/retried turn never depends on live bytes.
    attachments?: PersistedAttachment[];
    // §14.2 step 7/8: when the bridge has already computed and persisted the
    // admissionHash, it is replayed here so the queue boundary rejects a payload
    // that does not match the persisted admission (recovery integrity).
    expectedAdmissionHash?: string;
  }): Promise<QueueAdmissionResult> {
    if (opts.admissionId.length === 0) {
      throw new HarnessValidationError('admitChannelQueueTurn().admissionId', 'admissionId must be a non-empty string');
    }
    const queueOpts: QueueOptions = {
      content: opts.content,
      admissionId: opts.admissionId,
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.model !== undefined ? { model: opts.model } : {}),
    };
    const admission = await this._admitQueue(queueOpts, 'admitQueue()', {
      persistedRequestContext: opts.requestContext,
      ...(opts.attachments !== undefined ? { persistedAttachments: opts.attachments } : {}),
      ...(opts.expectedAdmissionHash !== undefined ? { expectedAdmissionHash: opts.expectedAdmissionHash } : {}),
    });
    if (!admission.duplicate) {
      this._liveAdmittedQueuedItemIds.add(admission.queuedItemId);
    }
    void this._maybeDrainQueue();
    return { accepted: true, queuedItemId: admission.queuedItemId, duplicate: admission.duplicate };
  }

  /**
   * @internal §14.2 step 7: the queue admissionHash for a channel turn, computed
   * over the exact persisted admission payload (content + persisted attachments +
   * policy-selected mode/model + trusted requestContext). The bridge records this
   * on the inbox row BEFORE runtime admission so recovery replays the SAME payload
   * and validates it via {@link _admitChannelQueueTurn}'s `expectedAdmissionHash`
   * — never re-running channel policy once the hash exists.
   */
  _channelQueueAdmissionHash(
    opts: { content: string; mode?: string; model?: string },
    attachments: PersistedAttachment[],
    requestContext: PersistedRequestContextInput,
  ): string {
    const queueOpts: QueueOptions = {
      content: opts.content,
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.model !== undefined ? { model: opts.model } : {}),
    };
    return this._computeQueueAdmissionHash(queueOpts, attachments, requestContext);
  }

  /**
   * @internal §14.2 channel ingress admission via the SIGNAL path. The
   * interactive counterpart to {@link _admitChannelQueueTurn}: an inbound that
   * the channel policy selected `delivery: 'signal'` for interleaves into an
   * active run (§21 shared terminal) or wakes a fresh idle run, rather than
   * appending a sequential queue boundary. The trusted `requestContext.channel`
   * projection and the already-persisted inbox attachments are threaded via the
   * internal signal hook. `signal()` has no per-turn `model` override, so a
   * policy `model` is rejected by {@link admitChannelInbound} before reaching
   * here. Returns the run/signal ids the bridge persists on the inbox row.
   */
  async _admitChannelSignalTurn(opts: {
    content: string;
    admissionId: string;
    requestContext: PersistedRequestContextInput;
    expectedAdmissionHash: string;
    mode?: string;
    attachments?: PersistedAttachment[];
  }): Promise<{ runId: string; signalId: string; willInterleave: boolean }> {
    if (opts.admissionId.length === 0) {
      throw new HarnessValidationError(
        'admitChannelSignalTurn().admissionId',
        'admissionId must be a non-empty string',
      );
    }
    if (opts.expectedAdmissionHash.length === 0) {
      throw new HarnessValidationError(
        'admitChannelSignalTurn().expectedAdmissionHash',
        'expectedAdmissionHash must be a non-empty string',
      );
    }
    // Public and channel callers share one admission path. The only channel-only
    // inputs are the already-persisted attachments/request context and the hash
    // the inbox row committed before runtime dispatch.
    const handle = await this.signal(
      {
        content: opts.content,
        admissionId: opts.admissionId,
        ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      },
      {
        persistedRequestContext: opts.requestContext,
        expectedAdmissionHash: opts.expectedAdmissionHash,
        ...(opts.attachments !== undefined ? { attachments: opts.attachments } : {}),
      },
    );
    // The shared run terminal settles `handle.result` in the background (§4.2f /
    // §21); the bridge persists `runId`/`signalId` synchronously and does not
    // await the answer here. Swallow so an unawaited rejection is not unhandled.
    void handle.result.catch(() => {});
    return { runId: handle.runId, signalId: handle.id, willInterleave: handle.willInterleave };
  }

  /**
   * @internal §13.7/§14.2 step 3: resolve inbound channel provider files
   * (AttachmentRefs the bridge has already uploaded) into Harness-owned persisted
   * attachment refs scoped to this resolved session. Thin wrapper over the same
   * `_resolveAttachmentRefs` the queue/message admission paths use — validates
   * ownership + loads metadata, so the durable inbox row, admissionHash, and the
   * admitted turn all carry the SAME normalized attachments.
   */
  async _resolveChannelInboundAttachments(refs: AttachmentRef[]): Promise<PersistedAttachment[]> {
    if (refs.length === 0) return [];
    return this._resolveAttachmentRefs('channel ingress attachments', refs);
  }

  /**
   * @internal §14.2 step 7: the SIGNAL admissionHash for a channel turn, computed
   * over the exact persisted admission payload (content + persisted attachments +
   * policy-selected mode + trusted requestContext). Discriminated `kind: 'signal'`
   * (distinct from the queue path's `kind: 'queue'`) so a queue-vs-signal payload
   * never collides. Persisted on the inbox row BEFORE runtime admission so
   * recovery replays the SAME payload and never re-runs policy. Hashes the same
   * `PersistedAttachment` projection as {@link _computeQueueAdmissionHash}. Note:
   * signal delivery has no `model` field, so model is intentionally absent.
   */
  _channelSignalAdmissionHash(
    opts: { content: string; mode?: string },
    attachments: PersistedAttachment[],
    requestContext: PersistedRequestContextInput,
  ): string {
    return this._computeSignalAdmissionHash(opts, attachments, requestContext);
  }

  private async _admitQueue(
    opts: QueueOptions,
    methodName: 'queue()' | 'admitQueue()',
    internal?: {
      persistedAttachments?: PersistedAttachment[];
      persistedRequestContext?: PersistedRequestContextInput;
      expectedAdmissionHash?: string;
    },
  ): Promise<{
    queuedItemId: string;
    evidence: QueueAdmissionReceipt | OperationAdmissionTombstone;
    duplicate: boolean;
  }> {
    this._assertLive(methodName);
    this._assertOpenForTurn(methodName);
    const logicalMessageIdentity = normalizeSessionLogicalMessageIdentity(opts.logicalMessageIdentity, methodName);
    const admittedOpts = {
      ...opts,
      ...(logicalMessageIdentity === undefined ? {} : { logicalMessageIdentity }),
    };
    if (typeof opts.content !== 'string' || opts.content.length === 0) {
      throw new HarnessValidationError(`${methodName}.content`, 'must be a non-empty string');
    }
    if (opts.mode !== undefined) {
      // Validates and throws on unknown id.
      this._harness._getMode(opts.mode);
    }
    if (opts.admissionId !== undefined && opts.admissionId.length === 0) {
      throw new HarnessValidationError(`${methodName}.admissionId`, 'admissionId must be a non-empty string');
    }
    this._validateQueueSchedulingOptions(opts, methodName);

    // §4.4c: validate caller request context before attachment resolution,
    // hashing, and persistence. A direct queue()/admitQueue() caller supplies
    // `app`; the channel-bridge path supplies a trusted `channel` via `internal`.
    // They are top-level siblings — combine into one persisted DTO, never deep
    // merge. (No path supplies both today; channel ingress has no SDK caller.)
    const callerRequestContext = validateCallerRequestContext(opts.requestContext, methodName);
    const callerPersistedRequestContext = callerRequestContextToPersisted(callerRequestContext);
    const effectivePersistedRequestContext: PersistedRequestContextInput | undefined =
      internal?.persistedRequestContext !== undefined || callerPersistedRequestContext !== undefined
        ? { ...(internal?.persistedRequestContext ?? {}), ...(callerPersistedRequestContext ?? {}) }
        : undefined;

    const attachments =
      internal?.persistedAttachments ??
      (await this._resolveAttachmentRefs(`${methodName}.attachments`, opts.attachments ?? []));
    if (internal?.persistedAttachments) {
      this._validatePersistedAttachments(`${methodName}.attachments`, attachments);
    }
    const effectiveModeId = opts.mode ?? this._record.modeId;
    const admissionId = opts.admissionId ?? `queue-${randomUUID()}`;
    const admissionHash = this._computeQueueAdmissionHash(admittedOpts, attachments, effectivePersistedRequestContext);
    if (internal?.expectedAdmissionHash !== undefined && internal.expectedAdmissionHash !== admissionHash) {
      throw new HarnessAdmissionConflictError(this.id, admissionId, internal.expectedAdmissionHash, admissionHash);
    }
    const duplicate = opts.admissionId
      ? await this._resolveQueueAdmissionDuplicate({ admissionId, admissionHash })
      : undefined;
    if (duplicate) {
      this._assertOpenForTurn(methodName);
      const queuedItemId = duplicate.queuedItemId;
      if (queuedItemId === undefined) {
        throw new HarnessValidationError(`${methodName}.admissionId`, 'duplicate queue result evidence has expired');
      }
      return { queuedItemId, evidence: duplicate, duplicate: true };
    }

    const cap = this._harness._internalMaxQueueDepth;
    const queueBackpressure = this._harness._internalQueueBackpressure;
    if (queueBackpressure === 'reject' && (this._record.pendingQueue?.length ?? 0) >= cap) {
      throw new HarnessQueueFullError(this.id, cap, this._record.pendingQueue?.length ?? 0);
    }
    const queuedItemId = this._queueAdmissionQueuedItemId(admissionId);
    const item: QueuedItem = {
      id: queuedItemId,
      admissionId,
      admissionHash,
      enqueuedAt: Date.now(),
      content: opts.content,
      attachments,
      ...(effectivePersistedRequestContext
        ? { requestContext: clonePersistedRequestContext(effectivePersistedRequestContext) }
        : {}),
      ...(logicalMessageIdentity ? { logicalMessageIdentity } : {}),
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      mode: effectiveModeId,
      ...(opts.yolo !== undefined ? { yolo: opts.yolo } : {}),
      ...(opts.priority !== undefined ? { priority: opts.priority } : {}),
      ...(opts.deadline !== undefined ? { deadline: opts.deadline } : {}),
      ...(opts.notBefore !== undefined ? { notBefore: opts.notBefore } : {}),
    };
    const attachmentReferences = attachments
      .filter((attachment): attachment is Extract<PersistedAttachment, { kind: 'ref' }> => attachment.kind === 'ref')
      .map(attachment => ({
        harnessName: this._record.harnessName,
        sessionId: attachment.ownerSessionId,
        attachmentId: attachment.attachmentId,
        source: 'queued_item' as const,
        sourceId: item.id,
      }));
    let admittedReceipt: QueueAdmissionReceipt | undefined;
    const droppedItems: QueueBackpressureDrop[] = [];
    const receipt: QueueAdmissionReceipt = {
      admissionId,
      admissionHash,
      queuedItemId: item.id,
      modeId: effectiveModeId,
      runtimeDependencies: this._harness._runtimeDependenciesForMode(
        effectiveModeId,
        item.model ?? this._record.modelId,
      ),
      status: 'queued',
      attempts: 0,
      enqueuedAt: item.enqueuedAt,
      updatedAt: item.enqueuedAt,
    };

    try {
      // Atomic check + append: re-check capacity inside the updater so a
      // concurrent in-process `queue()` cannot push us past the cap. Exact
      // admission retries are resolved here too so they do not append or
      // consume queue capacity even when racing the original admission.
      await this._flushUpdate(
        prev => {
          for (const existing of Object.values(prev.queueAdmissionReceipts ?? {})) {
            if (existing.admissionId !== admissionId) continue;
            if (existing.admissionHash !== admissionHash) {
              throw new HarnessAdmissionConflictError(this.id, admissionId, existing.admissionHash, admissionHash);
            }
            admittedReceipt = existing;
            return prev;
          }
          if (prev.closingAt !== undefined || this.isClosing) {
            throw harnessSessionClosingError(this);
          }
          if (prev.cancelRequest !== undefined) {
            throw new HarnessSessionCancelledError(this.id, prev.cancelRequest.reason);
          }
          if (queueBackpressure === 'reject' && (prev.pendingQueue?.length ?? 0) >= cap) {
            throw new HarnessQueueFullError(this.id, cap, prev.pendingQueue?.length ?? 0);
          }
          return this._applyQueueBackpressureForAppend(prev, {
            item,
            receipt,
            maxQueueDepth: cap,
            source: 'queue',
            droppedItems,
          });
        },
        { attachmentReferences },
      );
    } catch (err) {
      if (isStorageAttachmentUnavailableError(err)) {
        throw new HarnessAttachmentUnavailableError(err.sessionId, 'not_found', err.attachmentId);
      }
      throw err;
    }

    if (admittedReceipt) {
      this._assertOpenForTurn(methodName);
      return { queuedItemId: admittedReceipt.queuedItemId, evidence: admittedReceipt, duplicate: true };
    }

    this._failBackpressureDroppedItems(droppedItems);
    return { queuedItemId: item.id, evidence: receipt, duplicate: false };
  }

  /**
   * @internal
   * Worker-only admission for durable wakeups. Wakeup rows already carry
   * persisted attachment/request-context records, so this path must not
   * reinterpret them as caller-provided attachment refs or route request
   * context through public queue options.
   */
  async _admitWakeupQueue(item: {
    content: string;
    admissionId: string;
    admissionHash?: string;
    mode?: string;
    model?: string;
    yolo?: boolean;
    logicalMessageIdentity?: LogicalMessageIdentity;
    attachments: PersistedAttachment[];
    requestContext?: PersistedRequestContextInput;
  }): Promise<QueueAdmissionResult> {
    const admission = await this._admitQueue(
      {
        content: item.content,
        admissionId: item.admissionId,
        ...(item.mode !== undefined ? { mode: item.mode } : {}),
        ...(item.model !== undefined ? { model: item.model } : {}),
        ...(item.yolo === true ? { yolo: true } : {}),
        ...(item.logicalMessageIdentity !== undefined ? { logicalMessageIdentity: item.logicalMessageIdentity } : {}),
      },
      'admitQueue()',
      {
        persistedAttachments: item.attachments.map(clonePersistedAttachment),
        ...(item.requestContext ? { persistedRequestContext: clonePersistedRequestContext(item.requestContext) } : {}),
        ...(item.admissionHash ? { expectedAdmissionHash: item.admissionHash } : {}),
      },
    );
    if (!admission.duplicate) {
      this._liveAdmittedQueuedItemIds.add(admission.queuedItemId);
    }
    void this._maybeDrainQueue();
    return { accepted: true, queuedItemId: admission.queuedItemId, duplicate: admission.duplicate };
  }

  private async _resolveQueueAdmissionDuplicate({
    admissionId,
    admissionHash,
  }: {
    admissionId: string;
    admissionHash: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | undefined> {
    const resolved = await this._storage.resolveOperationAdmissionEvidence({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      kind: 'queue',
      admissionId,
      attemptedAdmissionHash: admissionHash,
    });
    if (resolved.status === 'none') return undefined;
    if (resolved.status === 'conflict') {
      throw new HarnessAdmissionConflictError(this.id, admissionId, resolved.storedAdmissionHash ?? '', admissionHash);
    }
    return resolved.evidence as QueueAdmissionReceipt | OperationAdmissionTombstone | undefined;
  }

  private async _returnDuplicateQueueResult(
    evidence: QueueAdmissionReceipt | OperationAdmissionTombstone,
    activeDeleted?: Promise<never>,
  ): Promise<AgentResult> {
    if ('kind' in evidence) {
      throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
    }
    if (evidence.status === 'completed' && evidence.postRunFinalizedAt !== undefined) {
      return evidence.result as AgentResult;
    }
    if (evidence.status === 'failed' || evidence.status === 'admission_failed') {
      throw publicErrorProjectionToError(
        evidence.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
      );
    }
    if (evidence.status === 'dead') {
      throw publicErrorProjectionToError(
        evidence.error ?? { code: 'harness.queue_exhausted', message: 'queued turn exhausted retry attempts' },
      );
    }
    const resolver = this._queueResolvers.get(evidence.queuedItemId);
    if (resolver) return this._raceActiveTurnWaiter(resolver.promise, activeDeleted);
    void this._maybeDrainQueue();
    return this._awaitDurableQueueResult(evidence, activeDeleted);
  }

  private async _awaitDurableQueueResult(
    receipt: QueueAdmissionReceipt,
    activeDeleted?: Promise<never>,
  ): Promise<AgentResult> {
    const deadline = Date.now() + MESSAGE_ADMISSION_DURABLE_WAIT_TIMEOUT_MS;
    while (true) {
      this._assertNotDeleted();
      const latest = await this._raceActiveTurnWaiter(
        this._storage.loadQueueResultEvidence({
          harnessName: this._record.harnessName,
          sessionId: this.id,
          resourceId: this.resourceId,
          queuedItemId: receipt.queuedItemId,
        }),
        activeDeleted,
      );
      this._assertNotDeleted();
      if (!latest) {
        throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
      }
      if ('kind' in latest) {
        throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
      }
      if (latest.status === 'completed' && latest.postRunFinalizedAt !== undefined) return latest.result as AgentResult;
      if (latest.status === 'failed' || latest.status === 'admission_failed') {
        throw publicErrorProjectionToError(
          latest.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
        );
      }
      if (latest.status === 'dead') {
        throw publicErrorProjectionToError(
          latest.error ?? { code: 'harness.queue_exhausted', message: 'queued turn exhausted retry attempts' },
        );
      }
      const waitMs = Math.min(MESSAGE_ADMISSION_DURABLE_WAIT_INTERVAL_MS, Math.max(0, deadline - Date.now()));
      if (waitMs === 0) {
        throw new HarnessValidationError('queue().admissionId', 'duplicate queue result evidence has expired');
      }
      await this._raceActiveTurnWaiter(delay(waitMs), activeDeleted);
    }
  }

  private _queueAdmissionQueuedItemId(admissionId: string): string {
    const digest = sha256CanonicalJson({
      kind: 'queue-admission',
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      admissionId,
    });
    return `q-${digest.slice(0, 32)}`;
  }

  private _queueSignalIdentity(item: QueuedItem): MessageAdmissionIdentity {
    const digest = sha256CanonicalJson({
      kind: 'queue-signal',
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      queuedItemId: item.id,
      admissionId: item.admissionId,
    });
    return {
      signalId: `harness-queue-${digest.slice(0, 32)}`,
      runId: `harness-queue-${digest.slice(32, 64)}`,
    };
  }

  private _computeQueueAdmissionHash(
    opts: QueueOptions,
    attachments: PersistedAttachment[],
    requestContext?: PersistedRequestContextInput,
  ): string {
    return sha256CanonicalJson({
      kind: 'queue',
      content: opts.content,
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      ...(opts.yolo === true ? { yolo: true } : {}),
      ...(opts.logicalMessageIdentity !== undefined
        ? { logicalMessageIdentity: { ...opts.logicalMessageIdentity } }
        : {}),
      ...(opts.priority !== undefined && opts.priority !== 0 ? { priority: opts.priority } : {}),
      ...(opts.deadline !== undefined ? { deadline: opts.deadline } : {}),
      ...(opts.notBefore !== undefined ? { notBefore: opts.notBefore } : {}),
      attachments: attachments.map(attachment => ({
        kind: attachment.kind,
        name: attachment.name,
        mimeType: attachment.mimeType,
        ...(attachment.kind === 'ref'
          ? {
              attachmentId: attachment.attachmentId,
              resourceId: this.resourceId,
              ownerSessionId: attachment.ownerSessionId,
              bytes: attachment.bytes,
              sha256: attachment.sha256,
              source: attachment.source,
              attachmentKind: attachment.attachmentKind ?? 'file',
              ...(attachment.primitiveType ? { primitiveType: attachment.primitiveType } : {}),
              ...(attachment.elementType ? { elementType: attachment.elementType } : {}),
              ...(attachment.renderer ? { renderer: attachment.renderer } : {}),
              ...(attachment.schemaId ? { schemaId: attachment.schemaId } : {}),
              ...(attachment.metadata ? { metadata: cloneAttachmentMetadata(attachment.metadata) } : {}),
              ...(attachment.object ? { object: attachment.object } : {}),
            }
          : { url: attachment.url }),
      })),
      ...(requestContext ? { requestContext: clonePersistedRequestContext(requestContext) } : {}),
    });
  }

  private _validateQueueSchedulingOptions(opts: QueueOptions, methodName: 'queue()' | 'admitQueue()'): void {
    for (const field of ['priority', 'deadline', 'notBefore'] as const) {
      const value = opts[field];
      if (value !== undefined && (!Number.isFinite(value) || Object.is(value, -0))) {
        throw new HarnessValidationError(`${methodName}.${field}`, 'must be a finite JSON number other than -0');
      }
    }
    if (opts.notBefore !== undefined && opts.deadline !== undefined && opts.notBefore > opts.deadline) {
      throw new HarnessValidationError(
        `${methodName}.notBefore`,
        '`notBefore` must be less than or equal to `deadline`',
      );
    }
  }

  private _applyQueueBackpressureForAppend(
    prev: SessionRecord,
    opts: {
      item: QueuedItem;
      receipt?: QueueAdmissionReceipt;
      maxQueueDepth: number;
      source: 'queue' | 'goal';
      goalId?: string;
      droppedItems: QueueBackpressureDrop[];
      onRejected?: () => void;
      onAdmitted?: () => void;
    },
  ): SessionRecord {
    const policy = this._harness._internalQueueBackpressure;
    const activeId = this._currentQueuedItemId ?? prev.pendingResume?.queuedItemId;
    const queue = [...(prev.pendingQueue ?? [])];
    const existingReceipts = prev.queueAdmissionReceipts ?? {};
    let nextReceipts: Record<string, QueueAdmissionReceipt> | undefined;
    const now = opts.item.enqueuedAt;

    while (queue.length >= opts.maxQueueDepth) {
      if (policy === 'reject') {
        opts.onRejected?.();
        return prev;
      }

      let dropIdx = -1;
      let dropEnqueuedAt = Number.POSITIVE_INFINITY;
      for (let i = 0; i < queue.length; i += 1) {
        const candidate = queue[i]!;
        if (activeId !== undefined && candidate.id === activeId) continue;
        const receipt = existingReceipts[candidate.id];
        if (receipt !== undefined && receipt.status !== 'queued') continue;
        if (candidate.enqueuedAt < dropEnqueuedAt) {
          dropIdx = i;
          dropEnqueuedAt = candidate.enqueuedAt;
        }
      }
      if (dropIdx < 0) {
        if (opts.source === 'goal') {
          opts.onRejected?.();
          return prev;
        }
        throw new HarnessQueueFullError(this.id, opts.maxQueueDepth, queue.length);
      }

      const [dropped] = queue.splice(dropIdx, 1);
      if (!dropped) continue;
      opts.droppedItems.push({
        queuedItemId: dropped.id,
        ...(dropped.admissionId !== undefined ? { admissionId: dropped.admissionId } : {}),
        replacementQueuedItemId: opts.item.id,
        ...(opts.item.admissionId !== undefined ? { replacementAdmissionId: opts.item.admissionId } : {}),
        maxQueueDepth: opts.maxQueueDepth,
        source: opts.source,
        ...(opts.goalId !== undefined ? { goalId: opts.goalId } : {}),
      });

      const receipt = existingReceipts[dropped.id];
      if (receipt && !this._isTerminalQueueReceipt(receipt)) {
        nextReceipts ??= { ...existingReceipts };
        const dropError = new HarnessQueueFullDroppedError(dropped.id);
        nextReceipts[dropped.id] = {
          ...receipt,
          status: 'failed',
          error: projectHarnessPublicError(dropError),
          failedAt: receipt.failedAt ?? now,
          updatedAt: now,
        };
      }
    }

    opts.onAdmitted?.();
    const next: SessionRecord = {
      ...prev,
      pendingQueue: [...queue, opts.item],
    };
    if (opts.receipt !== undefined) {
      next.queueAdmissionReceipts = {
        ...(nextReceipts ?? existingReceipts),
        [opts.item.id]: opts.receipt,
      };
    } else if (nextReceipts !== undefined) {
      next.queueAdmissionReceipts = nextReceipts;
    }
    return next;
  }

  // §10.2: backpressure drops emit no public event — the observable effect is
  // the rejected drop-oldest operation promises below. (The reject-policy path
  // throws HarnessQueueFullError at the caller and admits nothing.)
  private _failBackpressureDroppedItems(droppedItems: QueueBackpressureDrop[]): void {
    for (const dropped of droppedItems) {
      const resolver = this._queueResolvers.get(dropped.queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(dropped.queuedItemId);
        resolver.reject(new HarnessQueueFullDroppedError(dropped.queuedItemId));
      }
    }
  }

  private _isTerminalQueueReceipt(receipt: QueueAdmissionReceipt): boolean {
    return receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'dead';
  }

  private async _updateQueueAdmissionReceipt(
    queuedItemId: string,
    update: (receipt: QueueAdmissionReceipt, now: number) => QueueAdmissionReceipt,
  ): Promise<void> {
    await this._flushUpdate(prev => {
      const current = prev.queueAdmissionReceipts?.[queuedItemId];
      if (!current) return prev;
      const now = Date.now();
      return {
        ...prev,
        queueAdmissionReceipts: {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]: update(current, now),
        },
      };
    });
  }

  private async _resolveAttachmentRefs(field: string, refs: AttachmentRef[]): Promise<PersistedAttachment[]> {
    const attachments: PersistedAttachment[] = [];
    for (let i = 0; i < refs.length; i += 1) {
      const ref = refs[i]!;
      const ownerSessionId = ref.ownerSessionId ?? this.id;
      if (ownerSessionId !== this.id) {
        throw new HarnessValidationError(`${field}[${i}].ownerSessionId`, 'attachment must belong to this session');
      }
      const record = await this._storage.getAttachmentRecord({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        attachmentId: ref.attachmentId,
      });
      if (!record) {
        throw new HarnessAttachmentUnavailableError(this.id, 'not_found', ref.attachmentId);
      }
      if (ref.bytes !== undefined && ref.bytes !== record.bytes) {
        throw new HarnessValidationError(`${field}[${i}].bytes`, 'attachment byte count does not match storage');
      }
      if (ref.sha256 !== undefined && ref.sha256 !== record.sha256) {
        throw new HarnessValidationError(`${field}[${i}].sha256`, 'attachment digest does not match storage');
      }
      attachments.push({
        kind: 'ref',
        name: record.name,
        mimeType: record.mimeType,
        ownerSessionId: record.ownerSessionId,
        attachmentId: record.attachmentId,
        bytes: record.bytes,
        sha256: record.sha256,
        source: record.source,
        attachmentKind: record.kind ?? 'file',
        ...(record.primitiveType ? { primitiveType: record.primitiveType } : {}),
        ...(record.elementType ? { elementType: record.elementType } : {}),
        ...(record.renderer ? { renderer: { ...record.renderer } } : {}),
        ...(record.schemaId ? { schemaId: record.schemaId } : {}),
        ...(record.metadata ? { metadata: cloneAttachmentMetadata(record.metadata) } : {}),
        ...(record.object ? { object: { ...record.object } } : {}),
      });
    }
    return attachments;
  }

  private _validatePersistedAttachments(field: string, attachments: PersistedAttachment[]): void {
    for (let i = 0; i < attachments.length; i += 1) {
      const attachment = attachments[i]!;
      if (attachment.kind !== 'ref') continue;
      if (attachment.ownerSessionId !== this.id) {
        throw new HarnessValidationError(`${field}[${i}].ownerSessionId`, 'attachment must belong to this session');
      }
    }
  }

  /**
   * Scheduler step. Inside a single `_flushUpdate` CAS:
   *   - drop any items whose `deadline` has passed; emit
   *     `queue_item_expired` per drop, mark each item's receipt
   *     `failed`, and reject the resolver after the commit;
   *   - select the next item to run by `(priority desc, enqueuedAt
   *     asc)` from those that have no `notBefore` block; rotate it
   *     to position 0 so the existing drain + recovery logic can keep
   *     its `pendingQueue[0]` invariant.
   *
   * No-op when the queue is empty or no item is currently eligible.
   */
  private async _scheduleNextQueueHead(): Promise<boolean> {
    const now = Date.now();
    const expired: { queuedItemId: string; admissionId?: string; deadline: number }[] = [];
    let didCommit = false;
    let hasRunnableHead = false;

    await this._flushUpdate(prev => {
      const queue = prev.pendingQueue ?? [];
      if (queue.length === 0) return prev;

      const survivors: QueuedItem[] = [];
      const existingReceipts = prev.queueAdmissionReceipts ?? {};
      const nextReceipts: Record<string, QueueAdmissionReceipt> = { ...existingReceipts };
      let receiptsChanged = false;

      for (const item of queue) {
        const receipt = existingReceipts[item.id];
        if (receipt?.status === 'completed') {
          survivors.push(item);
          continue;
        }
        if (item.deadline !== undefined && item.deadline <= now) {
          expired.push({ queuedItemId: item.id, admissionId: item.admissionId, deadline: item.deadline });
          if (receipt && receipt.status !== 'failed' && receipt.status !== 'dead') {
            const expiryError = new HarnessQueueItemExpiredError(this.id, item.id, item.deadline);
            nextReceipts[item.id] = {
              ...receipt,
              status: 'failed',
              error: projectHarnessPublicError(expiryError),
              failedAt: receipt.failedAt ?? now,
              updatedAt: now,
            };
            receiptsChanged = true;
          }
          continue;
        }
        survivors.push(item);
      }

      // Pick the next runnable item: highest priority, FIFO tie-break.
      // The currently-running item (if any) stays first — it's already
      // executing and the drain only consults position 0 mid-loop when
      // no turn is in flight.
      let head: QueuedItem | undefined;
      let headIdx = -1;
      for (let i = 0; i < survivors.length; i++) {
        const candidate = survivors[i]!;
        if (candidate.notBefore !== undefined && candidate.notBefore > now) continue;
        const cp = candidate.priority ?? 0;
        const hp = head?.priority ?? 0;
        if (head === undefined || cp > hp || (cp === hp && candidate.enqueuedAt < head.enqueuedAt)) {
          head = candidate;
          headIdx = i;
        }
      }
      hasRunnableHead = head !== undefined;

      const rotated = head !== undefined && headIdx > 0;
      const didExpire = expired.length > 0;
      // No-op short-circuit: nothing expired, no rotation needed, no
      // receipts to update. `survivors` is always a fresh array, so an
      // identity check vs `queue` would never short-circuit — we have
      // to derive "nothing changed" from the flags instead.
      if (!didExpire && !rotated && !receiptsChanged) return prev;

      const nextQueue = rotated
        ? // Rotate selected item to position 0 so the existing
          // recovery + drain code can keep its `pendingQueue[0]`
          // assumption while still running the highest-priority
          // work first.
          [head!, ...survivors.slice(0, headIdx), ...survivors.slice(headIdx + 1)]
        : survivors;

      didCommit = true;
      const next: SessionRecord = { ...prev, pendingQueue: nextQueue };
      if (receiptsChanged) {
        next.queueAdmissionReceipts = nextReceipts;
      }
      return next;
    });

    if (!didCommit) return hasRunnableHead;

    for (const dropped of expired) {
      // §10.2: no queue_item_expired event — the observable effect is the
      // rejected operation promise (HarnessQueueItemExpiredError) below.
      const resolver = this._queueResolvers.get(dropped.queuedItemId);
      if (resolver) {
        this._queueResolvers.delete(dropped.queuedItemId);
        resolver.reject(new HarnessQueueItemExpiredError(this.id, dropped.queuedItemId, dropped.deadline));
      }
    }
    return hasRunnableHead;
  }

  /**
   * Drain pending queue items head-of-line. No-op while another drain is
   * running, the session is suspended (`pendingResume` set), or the queue
   * is empty. Each item runs as a fresh turn; if the turn suspends, drain
   * exits early and resumes from `_resume()` once the user responds.
   */
  private async _maybeDrainQueue(): Promise<void> {
    if (this._draining) return;
    if (!this._canDrainQueue()) return;
    // A live suspension means a previous queued turn is awaiting a
    // `respondTo*` call — drain stays parked until that resolves.
    if (this._record.pendingResume !== undefined) {
      const recovery = await this._maybeRecoverStaleQueuedResume({ kickDrainOnStale: false });
      if (recovery.status === 'none') return;
    }
    if (this._currentQueuedItemId !== undefined) return;
    // A manual `message()` turn is in flight — wait for it to settle.
    // `_recordTurnCompletion` will re-kick the drain on its way out.
    if (this._currentTurnAbortController !== undefined) return;

    this._draining = true;
    try {
      while (this._canDrainQueue() && (this._record.pendingQueue?.length ?? 0) > 0) {
        // Bail if a previous iteration left the session suspended.
        if (this._record.pendingResume !== undefined) return;

        // Scheduler step: expire any items past their deadline, then
        // rotate the highest-priority item to the head. Done in a
        // single CAS so the rest of the drain logic (recovery,
        // post-run finalize) can keep its `pendingQueue[0]` assumption.
        const hasRunnableHead = await this._scheduleNextQueueHead();
        if (!hasRunnableHead) {
          this._scheduleQueueWakeupForPendingQueue();
          return;
        }
        this._clearQueueWakeTimer();
        const head = this._record.pendingQueue?.[0];
        if (!head) return;
        this._currentQueuedItemId = head.id;
        this._currentQueuedItemSource = head.source ?? 'user';
        // §10.2: no queue_item_started / queue_item_replayed events — the closed
        // union has no queue-lifecycle family; the drained turn's `agent_start`
        // marks the boundary. We still clear the live-admission marker (only
        // when no live resolver is tracking the item, mirroring the prior
        // short-circuit) so `_liveAdmittedQueuedItemIds` does not leak.
        if (!this._queueResolvers.has(head.id)) {
          this._liveAdmittedQueuedItemIds.delete(head.id);
        }

        let suspended = false;
        try {
          const full = await this._runQueuedTurn(head);
          suspended = full.finishReason === 'suspended';
          if (!suspended) {
            await this._completeQueuedTurn(head.id, full as AgentResult);
          }
        } catch (err) {
          if (err instanceof QueueRecoveryPendingError) {
            this._parkQueuedTurn(head.id, err);
            return;
          }
          if (err instanceof QueuePostRunFinalizationPendingError) {
            this._deferQueuedTurnRetry(err);
            return;
          }
          // Permanent failure during the turn — reject the resolver and
          // remove the item so we don't replay it forever.
          await this._failQueuedTurn(head.id, err);
        }

        if (suspended) {
          // Stop draining; `_resume()` will re-kick when the user responds.
          return;
        }
      }
    } finally {
      this._draining = false;
      this._notifyMaybeIdle();
    }
  }

  /**
   * Run a single queued item as a turn. Mirrors `message()`'s default path
   * but pulls overrides off the queued item rather than per-call options.
   * Returns the `FullOutput` so the drain loop can decide whether the head
   * stays in place (suspended) or is removed (complete / error).
   */
  private async _runQueuedTurn(item: QueuedItem): Promise<FullOutput<unknown>> {
    const currentReceipt = this._record.queueAdmissionReceipts?.[item.id];
    const effectiveModeId = currentReceipt?.modeId ?? item.mode ?? this._record.modeId;
    if (currentReceipt?.status === 'completed') {
      const full = currentReceipt.result as FullOutput<unknown>;
      if (currentReceipt.postRunFinalizedAt === undefined) {
        await this._finalizeCompletedQueuedTurn(item, full, effectiveModeId);
      }
      return full;
    }

    this._assertOpenForTurn('queue drain');
    await this._validateQueuedAttachmentRefs(item);
    const identity = this._queueSignalIdentity(item);
    let shouldMarkAdmitting = true;
    if (currentReceipt) {
      if (currentReceipt.status === 'failed' || currentReceipt.status === 'admission_failed') {
        throw publicErrorProjectionToError(
          currentReceipt.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
        );
      }
      if (currentReceipt.status === 'dead') {
        throw publicErrorProjectionToError(
          currentReceipt.error ?? {
            code: 'harness.queue_exhausted',
            message: 'queued turn exhausted retry attempts',
          },
        );
      }
    }
    if (
      currentReceipt &&
      (currentReceipt.status === 'admitting' || currentReceipt.status === 'accepted') &&
      currentReceipt.runId &&
      currentReceipt.signalId
    ) {
      const recoveredTerminal = await this._withActiveDeletedWaiter(activeDeleted =>
        this._recoverQueuedTerminalEvidence(item, currentReceipt, effectiveModeId, activeDeleted),
      );
      if (recoveredTerminal) return recoveredTerminal;
    }
    const runtimeDependencies = this._runtimeDependenciesForQueuedTurn(item, currentReceipt, effectiveModeId);
    const { mode, agent } = this._harness._resolveAgentForRuntimeDependencies(
      runtimeDependencies,
      `queued item "${item.id}" recovery`,
    );
    if (
      currentReceipt &&
      (currentReceipt.status === 'admitting' || currentReceipt.status === 'accepted') &&
      currentReceipt.runId &&
      currentReceipt.signalId
    ) {
      const recovered = await this._recoverQueuedDispatch(item, currentReceipt, agent, effectiveModeId);
      if (recovered) return recovered;
    }
    if (shouldMarkAdmitting) {
      await this._updateQueueAdmissionReceipt(item.id, (receipt, now) => ({
        ...receipt,
        status: 'admitting',
        runId: identity.runId,
        signalId: identity.signalId,
        modeId: receipt.modeId ?? effectiveModeId,
        attempts: receipt.attempts + 1,
        admittingAt: receipt.admittingAt ?? now,
        updatedAt: now,
      }));
    }

    const toolSurface = this._buildToolSurface(mode);
    // Queued turns run under a session-owned AbortController so
    // `session.abort()` can cancel an in-flight queued run too.
    this._assertOpenForTurn('queue drain');
    const turnAbortController = this._beginTurn(undefined, {
      modeId: effectiveModeId,
      modelId: item.model ?? this._record.modelId,
    });
    this._setCurrentTurnReplacementToolSurface(toolSurface);
    // §4.2e — arm per-turn yolo for the drain so suspend-capture persists it onto
    // pendingResume (so a later resume keeps auto-granting). `_beginTurn` reset it.
    this._currentTurnYolo = item.yolo === true;
    const activeTurnWaiter = this._createActiveTurnWaiter();
    void activeTurnWaiter.promise.catch(() => {});
    const finishQueuedTurn = () => {
      activeTurnWaiter.cleanup();
      this._endTurn(turnAbortController);
    };
    const assertQueuedTurnNotDeleted = () => {
      if (this._state === 'deleted') {
        throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
      }
    };
    let agentStarted = false;
    let agentEndEmitted = false;
    let fallbackRunId = identity.runId;

    try {
      const [requestContext, turnInstructions] = await Promise.race([
        Promise.all([
          this._buildRequestContext({
            modeId: effectiveModeId,
            modelId: this._modelIdForQueuedItem(item.id),
            abortSignal: turnAbortController.signal,
            persistedRequestContext: item.requestContext,
            yolo: item.yolo === true,
          }),
          this._turnInstructions(mode.instructions),
        ]),
        activeTurnWaiter.promise,
      ]);
      assertQueuedTurnNotDeleted();
      const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
        memory: { thread: this.threadId, resource: this.resourceId },
        abortSignal: turnAbortController.signal,
        requestContext,
        // Queued turns that wake an idle session run a REAL streamed turn and
        // must carry the same step ceiling as direct turns — omitting it here
        // capped channel/queued deliveries at the provider's 5-step default.
        maxSteps: HARNESS_SESSION_MAX_STEPS,
        ...toolSurface,
        ...(turnInstructions ? { instructions: turnInstructions } : {}),
        ...(item.logicalMessageIdentity ? { logicalMessageIdentity: item.logicalMessageIdentity } : {}),
      };

      await Promise.race([this._ensureThreadSubscription(agent), activeTurnWaiter.promise]);
      assertQueuedTurnNotDeleted();
      await Promise.race([
        this._writeQueueSignalResultEvidence({
          status: 'pending',
          signalId: identity.signalId,
          runId: identity.runId,
        }),
        activeTurnWaiter.promise,
      ]);
      assertQueuedTurnNotDeleted();
      // §13.7/§14.2: forward persisted attachment bytes as model file-parts so a
      // queued (channel or direct) turn's attachments actually reach the agent,
      // not just the dedup identity. No attachments → bare `item.content`.
      const queuedContents = await Promise.race([
        this._buildSignalContentsWithAttachments(item.content, item.attachments),
        activeTurnWaiter.promise,
      ]);
      assertQueuedTurnNotDeleted();
      const signal = agent.sendSignal(
        {
          id: identity.signalId,
          type: 'user-message',
          contents: queuedContents as never,
          ...(item.logicalMessageIdentity ? { metadata: { logicalMessageId: item.logicalMessageIdentity.input } } : {}),
        },
        {
          runId: identity.runId,
          resourceId: this.resourceId,
          threadId: this.threadId,
          ...(item.logicalMessageIdentity ? { ifActive: { behavior: 'discard' } } : {}),
          ifIdle: {
            behavior: 'wake',
            // The wake branch starts a REAL streamed turn; carry the silent-turn nudge.
            streamOptions: {
              ...baseExecOptions,
              ...this._createEmptySynthesisOptions(),
            } as never,
          },
        },
      );
      if (item.logicalMessageIdentity !== undefined) {
        const accepted = await this._awaitSignalNativeAcceptance(
          signal.accepted,
          turnAbortController.signal,
          activeTurnWaiter.promise,
        );
        if (accepted.action === 'discard') {
          const err = new HarnessConfigError(
            'queue().logicalMessageIdentity',
            'a full logical message identity cannot be delivered into an active run',
          );
          await this._writeQueueSignalResultEvidence({
            status: 'failed',
            signalId: identity.signalId,
            runId: identity.runId,
            error: projectHarnessPublicError(err),
          });
          throw err;
        }
      }
      const signalIdentity =
        signal.runId === identity.runId && signal.signal.id === identity.signalId
          ? identity
          : { runId: signal.runId, signalId: signal.signal.id };
      fallbackRunId = signalIdentity.runId;
      // §10.2 agent_start carries the runId — emit it only AFTER sendSignal so
      // the run is registered and the runId matches the one chunks/completion
      // use (signalIdentity.runId may differ from the pre-dispatch identity).
      this._emitAgentStart(signalIdentity.runId);
      agentStarted = true;
      const completion = this._awaitQueuedRunCompletion(
        item,
        signalIdentity.runId,
        signalIdentity.signalId,
        effectiveModeId,
        activeTurnWaiter.promise,
        { onAgentEnd: () => (agentEndEmitted = true) },
      );
      void completion.catch(() => {});
      if (signalIdentity !== identity) {
        await Promise.race([
          this._writeQueueSignalResultEvidence({
            status: 'pending',
            signalId: signalIdentity.signalId,
            runId: signalIdentity.runId,
          }),
          activeTurnWaiter.promise,
        ]);
      }
      await Promise.race([
        this._updateQueueAdmissionReceipt(item.id, (receipt, now) => ({
          ...receipt,
          status: 'accepted',
          runId: signalIdentity.runId,
          signalId: signalIdentity.signalId,
          modeId: receipt.modeId ?? effectiveModeId,
          acceptedAt: receipt.acceptedAt ?? now,
          updatedAt: now,
        })).catch(() => {}),
        activeTurnWaiter.promise,
      ]);
      const full = await Promise.race([completion, activeTurnWaiter.promise]);
      agentEndEmitted = true;
      return full;
    } catch (err) {
      if (agentStarted && !agentEndEmitted && !(err instanceof QueuePostRunFinalizationPendingError)) {
        this._emitTurnEvent({
          type: 'agent_end',
          finishReason: turnAbortController.signal.aborted ? 'aborted' : 'error',
          runId: fallbackRunId,
          usage: this._runUsage(),
          queuedItemId: item.id,
        });
      }
      throw err;
    } finally {
      finishQueuedTurn();
    }
  }

  private _runtimeDependenciesForQueuedTurn(
    item: QueuedItem,
    receipt: QueueAdmissionReceipt | undefined,
    modeId: string,
  ): HarnessRuntimeDependencyRefs {
    const modelId = item.model ?? this._record.modelId;
    return receipt?.runtimeDependencies ?? { modeId, ...(modelId ? { modelId } : {}) };
  }

  private async _recoverQueuedDispatch(
    item: QueuedItem,
    receipt: QueueAdmissionReceipt,
    agent: Agent,
    modeId: string,
  ): Promise<FullOutput<unknown> | undefined> {
    if (!receipt.runId || !receipt.signalId) return undefined;

    return this._withActiveDeletedWaiter(async activeDeleted => {
      await this._raceActiveTurnWaiter(this._ensureThreadSubscription(agent), activeDeleted);
      if (this._hasLiveMessageRun(agent, receipt.runId!)) {
        return this._awaitQueuedRunCompletion(item, receipt.runId!, receipt.signalId!, modeId, activeDeleted);
      }

      const terminalEvidence = await this._recoverQueuedTerminalEvidence(item, receipt, modeId, activeDeleted);
      if (terminalEvidence) return terminalEvidence;

      const recovery = await this._raceActiveTurnWaiter(this._inspectQueueReceiptMemory(receipt), activeDeleted);
      if (recovery.status === 'pending') {
        const dispatchAt = receipt.acceptedAt ?? receipt.admittingAt ?? receipt.updatedAt;
        const retryAt = dispatchAt + QUEUE_ACCEPTED_RECOVERY_STALE_MS;
        if (Date.now() >= retryAt) throw new QueueRecoveryStaleError();
        throw new QueueRecoveryPendingError(retryAt);
      }

      return undefined;
    });
  }

  private async _recoverQueuedTerminalEvidence(
    item: QueuedItem,
    receipt: QueueAdmissionReceipt,
    modeId: string,
    activeTurnWaiter?: Promise<never>,
  ): Promise<FullOutput<unknown> | undefined> {
    if (!receipt.runId || !receipt.signalId) return undefined;

    const evidence = await this._raceActiveTurnWaiter(this._loadQueueSignalResultEvidence(receipt), activeTurnWaiter);
    if (evidence.status === 'completed') {
      const full = evidence.result as FullOutput<unknown>;
      await this._raceActiveTurnWaiter(this._markQueuedTurnCompleted(item.id, full), activeTurnWaiter);
      if (receipt.postRunFinalizedAt === undefined) {
        await this._finalizeCompletedQueuedTurn(item, full, modeId, activeTurnWaiter);
      }
      return full;
    }
    if (evidence.status === 'failed') {
      throw publicErrorProjectionToError(
        evidence.error ?? { code: 'harness.queue_failed', message: 'queued turn failed' },
      );
    }

    return undefined;
  }

  private _queueReceiptTerminalFailureError(queuedItemId: string): Error | undefined {
    return this._queueReceiptTerminalFailureErrorFromReceipt(this._record.queueAdmissionReceipts?.[queuedItemId]);
  }

  private _queueReceiptTerminalFailureErrorFromReceipt(receipt: QueueAdmissionReceipt | undefined): Error | undefined {
    if (
      !receipt ||
      (receipt.status !== 'failed' && receipt.status !== 'dead' && receipt.status !== 'admission_failed')
    ) {
      return undefined;
    }
    return publicErrorProjectionToError(
      receipt.error ?? {
        code: receipt.status === 'dead' ? 'harness.queue_exhausted' : 'harness.queue_failed',
        message: receipt.status === 'dead' ? 'queued turn exhausted retry attempts' : 'queued turn failed',
      },
    );
  }

  private async _awaitQueuedRunCompletion(
    item: QueuedItem,
    runId: string,
    signalId: string,
    modeId: string,
    activeTurnWaiter?: Promise<never>,
    opts: { onAgentEnd?: () => void } = {},
  ): Promise<FullOutput<unknown>> {
    let full: FullOutput<unknown>;
    try {
      full = await this._raceActiveTurnWaiter(this._awaitRunCompletion(runId), activeTurnWaiter);
    } catch (err) {
      if (this._shouldWriteTurnFailureEvidence(err)) {
        await this._raceActiveTurnWaiter(
          this._writeQueueSignalResultEvidence({
            status: 'failed',
            signalId,
            runId,
            error: projectHarnessPublicError(err),
          }).catch(() => {}),
          activeTurnWaiter,
        );
      }
      throw err;
    }

    const terminalFailure = this._queueReceiptTerminalFailureError(item.id);
    if (terminalFailure) throw terminalFailure;

    if (full.finishReason !== 'suspended') {
      await this._raceActiveTurnWaiter(this._markQueuedTurnCompleted(item.id, full), activeTurnWaiter);
      await this._finalizeCompletedQueuedTurn(item, full, modeId, activeTurnWaiter, opts);
      await this._raceActiveTurnWaiter(
        this._writeQueueSignalResultEvidence({
          status: 'completed',
          signalId,
          runId,
          result: full,
        }).catch(() => {}),
        activeTurnWaiter,
      );
    } else {
      await this._finalizeQueuedRunCompletion(item, full, modeId, activeTurnWaiter, opts);
    }
    return full;
  }

  private async _finalizeCompletedQueuedTurn(
    item: QueuedItem,
    full: FullOutput<unknown>,
    modeId: string,
    activeTurnWaiter?: Promise<never>,
    opts: { onAgentEnd?: () => void } = {},
  ): Promise<void> {
    let alreadyAccounted = false;
    if (this._record.queueAdmissionReceipts?.[item.id]?.postRunFinalizedAt === undefined) {
      // Account for the turn's tokens BEFORE writing the no-replay marker so
      // the marker's CAS save piggybacks the live `_tokenUsage` via the
      // `_flushUpdate` overlay. Without this ordering, a
      // crash between the marker save and a later scheduled token persist
      // would resume with `postRunFinalizedAt` set and never re-account.
      let tokenUsageDelta: TokenUsage | undefined;
      try {
        this._captureTurnRunId(full);
        tokenUsageDelta = this._tokenUsageDeltaFromFullOutput(full);
        alreadyAccounted = true;
        await this._raceActiveTurnWaiter(
          this._markQueuedPostRunFinalized(item.id, { tokenUsageDelta }),
          activeTurnWaiter,
        );
      } catch (err) {
        if (err instanceof HarnessSessionDeletedError) throw err;
        throw new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, err);
      }
    }
    await this._finalizeQueuedRunCompletion(item, full, modeId, activeTurnWaiter, {
      skipTokenAccounting: alreadyAccounted,
      onAgentEnd: opts.onAgentEnd,
    });
  }

  private async _settleCompletedQueuedItemAfterCancellation(
    item: QueuedItem,
    full: FullOutput<unknown>,
    modeId: string,
  ): Promise<void> {
    try {
      await this._finalizeCompletedQueuedTurn(item, full, modeId);
      await this._completeQueuedTurn(item.id, full as AgentResult);
    } catch (err) {
      if (err instanceof HarnessSessionDeletedError) throw err;
      const receipt = this._record.queueAdmissionReceipts?.[item.id];
      if (receipt?.postRunFinalizedAt !== undefined) {
        try {
          await this._completeQueuedTurn(item.id, full as AgentResult);
          return;
        } catch (completionErr) {
          if (completionErr instanceof HarnessSessionDeletedError) throw completionErr;
          this._deferCompletedQueuedItemFinalizationAfterCancellation(
            item,
            full,
            modeId,
            new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, completionErr),
          );
          return;
        }
      }
      this._deferCompletedQueuedItemFinalizationAfterCancellation(
        item,
        full,
        modeId,
        err instanceof QueuePostRunFinalizationPendingError
          ? err
          : new QueuePostRunFinalizationPendingError(Date.now() + QUEUE_POST_RUN_FINALIZATION_RETRY_MS, err),
      );
    }
  }

  private _deferCompletedQueuedItemFinalizationAfterCancellation(
    item: QueuedItem,
    full: FullOutput<unknown>,
    modeId: string,
    err: QueuePostRunFinalizationPendingError,
  ): void {
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    this._notifyMaybeIdle();
    const delayMs = Math.max(0, err.retryAt - Date.now());
    const timer = setTimeout(() => {
      // Teardown guard: if the session was closed/evicted/deleted while this
      // retry was parked, `_settleCompletedQueuedItemAfterCancellation` would
      // hit `_flushUpdate`'s terminal reject and reschedule itself forever — a
      // perpetual no-op finalization loop on a dead session. Bail instead.
      if (!this._canDrainQueue()) return;
      void this._settleCompletedQueuedItemAfterCancellation(item, full, modeId).catch(() => {
        this._notifyMaybeIdle();
      });
    }, delayMs);
    timer.unref?.();
  }

  private async _markQueuedTurnCompleted(
    queuedItemId: string,
    full: FullOutput<unknown>,
    opts?: { modeId?: string },
  ): Promise<void> {
    let terminalFailure: Error | undefined;
    await this._flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[queuedItemId];
      if (!receipt && opts?.modeId === undefined) return prev;
      const receiptTerminalFailure = this._queueReceiptTerminalFailureErrorFromReceipt(receipt);
      if (receiptTerminalFailure) {
        terminalFailure = receiptTerminalFailure;
        return prev;
      }
      const now = Date.now();
      const next: SessionRecord = { ...prev };
      if (opts?.modeId !== undefined) {
        next.modeId = opts.modeId;
        // §4.2e — re-seed the base permission policy WITH the modeId flip so a crash
        // between this queued-completion write and the later settlement flush can
        // never persist the target mode alongside the previous mode's rules.
        const seededRules = this._harness._modePermissionRules(opts.modeId);
        if (seededRules !== undefined) {
          next.permissionRules = seededRules;
          next.permissionRulesSeedHash = sha256CanonicalJson(seededRules);
        }
      }
      if (receipt) {
        next.queueAdmissionReceipts = {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]:
            receipt.status === 'completed'
              ? receipt
              : {
                  ...receipt,
                  status: 'completed',
                  result: full,
                  completedAt: receipt.completedAt ?? now,
                  updatedAt: now,
                },
        };
      }
      return next;
    });
    if (terminalFailure) throw terminalFailure;
  }

  private async _finalizeQueuedRunCompletion(
    item: QueuedItem,
    full: FullOutput<unknown>,
    modeId?: string,
    activeTurnWaiter?: Promise<never>,
    opts: { skipTokenAccounting?: boolean; onAgentEnd?: () => void } = {},
  ): Promise<FullOutput<unknown>> {
    const tokenUsageDelta = opts.skipTokenAccounting
      ? undefined
      : full.finishReason === 'suspended'
        ? this._tokenUsageDeltaFromFullOutput(full)
        : this._recordTurnCompletion(full, { persist: false });
    await this._raceActiveTurnWaiter(
      this._maybeCaptureSuspend(full, item.id, modeId ?? item.mode ?? this._record.modeId, undefined, {
        tokenUsageDelta: full.finishReason === 'suspended' ? tokenUsageDelta : undefined,
      }),
      activeTurnWaiter,
    );
    if (tokenUsageDelta !== undefined && full.finishReason !== 'suspended') {
      await this._raceActiveTurnWaiter(this._persistTokenUsageOrLatch(), activeTurnWaiter);
    }
    this._emitAgentEnd({ runId: full.runId, finishReason: this._agentEndReasonForFullOutput(full), full });
    opts.onAgentEnd?.();
    await this._raceActiveTurnWaiter(this._runGoalJudge(full, (item.source ?? 'user') === 'goal'), activeTurnWaiter);
    return full;
  }

  private async _markQueuedPostRunFinalized(
    queuedItemId: string,
    opts: { tokenUsageDelta?: TokenUsage } = {},
  ): Promise<void> {
    let tokenUsageDeltaToPersist: TokenUsage | undefined;
    await this._flushUpdate(
      prev => {
        const current = prev.queueAdmissionReceipts?.[queuedItemId];
        if (!current) return prev;
        const now = Date.now();
        const nextReceipt =
          current.postRunFinalizedAt !== undefined
            ? current
            : {
                ...current,
                postRunFinalizedAt: now,
                updatedAt: now,
              };
        if (current.postRunFinalizedAt === undefined) tokenUsageDeltaToPersist = opts.tokenUsageDelta;
        return {
          ...prev,
          queueAdmissionReceipts: {
            ...(prev.queueAdmissionReceipts ?? {}),
            [queuedItemId]: nextReceipt,
          },
        };
      },
      { tokenUsageDelta: () => tokenUsageDeltaToPersist },
    );
  }

  private async _loadQueueSignalResultEvidence(
    receipt: QueueAdmissionReceipt,
  ): Promise<AgentSignalResultStatus | { status: 'not_found' }> {
    if (!receipt.signalId) return { status: 'not_found' };
    const evidence = await this._storage.loadMessageResultEvidence({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      signalId: receipt.signalId,
    });
    if (!evidence || 'kind' in evidence) return { status: 'not_found' };
    return evidence;
  }

  private async _writeQueueSignalResultEvidence(status: AgentSignalResultStatus): Promise<void> {
    const now = Date.now();
    this._operationEvidenceSignalIds.add(status.signalId);
    await this._storage.writeMessageResultEvidence({
      ...status,
      harnessName: this._record.harnessName,
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      createdAt: now,
      updatedAt: now,
    });
    await this._cleanupOperationEvidenceIfDeleted(status);
  }

  private async _inspectQueueReceiptMemory(
    receipt: QueueAdmissionReceipt,
  ): Promise<{ status: 'not_found' } | { status: 'pending' }> {
    if (!receipt.signalId) return { status: 'not_found' };

    const memory = await this._harness._internalTryGetMemoryStorage();
    if (!memory) return { status: 'not_found' };

    const result = await memory.listMessages({ threadId: this.threadId, resourceId: this.resourceId, perPage: false });
    const messages = result.messages as StoredMessageRow[];
    return messages.some(message => message.id === receipt.signalId) ? { status: 'pending' } : { status: 'not_found' };
  }

  private async _validateQueuedAttachmentRefs(item: QueuedItem): Promise<void> {
    for (const attachment of item.attachments) {
      if (attachment.kind !== 'ref') continue;
      const loaded = await this._storage.loadAttachment({
        harnessName: this._record.harnessName,
        sessionId: attachment.ownerSessionId,
        attachmentId: attachment.attachmentId,
      });
      if (!loaded) {
        throw new HarnessAttachmentUnavailableError(attachment.ownerSessionId, 'not_found', attachment.attachmentId);
      }
      if (loaded.sha256 !== attachment.sha256) {
        throw new HarnessAttachmentUnavailableError(
          attachment.ownerSessionId,
          'digest_mismatch',
          attachment.attachmentId,
        );
      }
      if (loaded.bytes !== attachment.bytes) {
        // §4.5a has no separate `bytes_mismatch`; a recorded-size mismatch is a
        // digest/bytes mismatch (the persisted ref no longer resolves to the
        // recorded bytes).
        throw new HarnessAttachmentUnavailableError(
          attachment.ownerSessionId,
          'digest_mismatch',
          attachment.attachmentId,
        );
      }
    }
  }

  /**
   * §14.2 / §13.7: build the agent signal contents for a turn, attaching any
   * persisted attachment bytes as model file/image parts. With no attachments
   * the contents stay the bare `content` string (byte-identical to the prior
   * text-only dispatch — no behavior change for the common case). When
   * attachments are present we load each ref's bytes (already validated by
   * {@link _validateQueuedAttachmentRefs}) and build a structured user message
   * mirroring the non-v1 harness file-part pattern, so the agent turn actually
   * receives the attachment, not just the dedup identity.
   */
  private async _buildSignalContentsWithAttachments(
    content: string,
    attachments: PersistedAttachment[] | undefined,
  ): Promise<AgentSignalContents> {
    if (attachments === undefined || attachments.length === 0) {
      return content;
    }
    const parts: Array<
      { type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string; filename?: string }
    > = [{ type: 'text', text: content }];
    for (const attachment of attachments) {
      if (attachment.kind === 'url') {
        // A URL-only attachment carries no bytes to inline; surface it as a file
        // reference so the model still sees the link + filename.
        parts.push({ type: 'file', data: attachment.url, mediaType: attachment.mimeType, filename: attachment.name });
        continue;
      }
      const loaded = await this._storage.loadAttachment({
        harnessName: this._record.harnessName,
        sessionId: attachment.ownerSessionId,
        attachmentId: attachment.attachmentId,
      });
      if (!loaded) {
        throw new HarnessAttachmentUnavailableError(attachment.ownerSessionId, 'not_found', attachment.attachmentId);
      }
      const base64 = Buffer.from(loaded.data).toString('base64');
      // Inline both image and non-image attachment bytes through the AI SDK v5
      // file-part shape (a `data:<mime>;base64,<bytes>` URL). The v5 image-part
      // shape keys on `image`/`mediaType`, not `data`/`mimeType`, so a hand-built
      // `{ type: 'image', data, mimeType }` part silently drops its bytes when
      // MessageList runs `convertImageFilePart` (it reads `part.image`, which is
      // undefined). The file shape preserves bytes for image/* mime types too —
      // `convertToDataContent` decodes the data URL regardless of media type — so
      // one code path covers every inline attachment.
      parts.push({
        type: 'file',
        data: `data:${attachment.mimeType};base64,${base64}`,
        mediaType: attachment.mimeType,
        filename: attachment.name,
      });
    }
    // Upstream signals API (#merge): AgentSignalContents is a bare parts array.
    return parts as AgentSignalContents;
  }

  private async _registerQuestion(
    params: RegisterQuestionParams & { runId?: string; toolCallId?: string; modeId?: string; modelId?: string },
  ): Promise<void> {
    this._assertOpenForTurn('ctx.registerQuestion');
    if (typeof params.questionId !== 'string' || params.questionId.length === 0) {
      throw new HarnessValidationError('ctx.registerQuestion.questionId', 'must be a non-empty string');
    }
    if (typeof params.question !== 'string' || params.question.length === 0) {
      throw new HarnessValidationError('ctx.registerQuestion.question', 'must be a non-empty string');
    }
    if (
      params.selectionMode !== undefined &&
      params.selectionMode !== 'single_select' &&
      params.selectionMode !== 'multi_select'
    ) {
      throw new HarnessValidationError('ctx.registerQuestion.selectionMode', 'must be single_select or multi_select');
    }
    const runId = params.runId ?? this._currentRunId;
    const toolCallId = params.toolCallId ?? params.questionId;
    if (!runId) {
      throw new HarnessValidationError('ctx.registerQuestion.runId', 'active run id is required');
    }
    const pending: PendingResume = {
      kind: 'question',
      itemId: params.questionId,
      runId,
      toolCallId,
      toolName: ASK_USER_TOOL_NAME,
      ...this._pendingResumeSourceFields(),
      ...this._newPendingInteractionTiming('question'),
      modeId: params.modeId ?? this._record.modeId,
      // §4.2e — carry the active turn's yolo so a later tool approval on the
      // resumed run is still auto-granted (pre-registered pendings win over the
      // suspend-capture merge, so yolo must be stamped here too).
      ...(this._currentTurnYolo ? { yolo: true } : {}),
      runtimeDependencies: this._harness._runtimeDependenciesForMode(
        params.modeId ?? this._record.modeId,
        params.modelId ?? this._modelIdForQueuedItem(this._currentQueuedItemId),
      ),
      // §5.1 — carry the active turn's caller app bag onto the pending resume.
      ...(this._currentTurnRequestContext
        ? { requestContext: clonePersistedRequestContext(this._currentTurnRequestContext) }
        : {}),
      ...(this._currentToolSurfaceFenceSnapshot(runId)
        ? { toolSurfaceFence: this._currentToolSurfaceFenceSnapshot(runId) }
        : {}),
      payload: {
        question: params.question,
        ...(params.options ? { options: params.options } : {}),
        ...(params.selectionMode ? { selectionMode: params.selectionMode } : {}),
      },
    };
    let registered = false;
    await this._flushUpdate(prev => {
      const current = prev.pendingResume;
      if (current) {
        if (current.kind === 'question' && current.runId === runId && current.toolCallId === toolCallId) {
          return prev;
        }
        throw new HarnessValidationError('ctx.registerQuestion', `pending resume is already "${current.kind}"`);
      }
      registered = true;
      return { ...prev, pendingResume: pending };
    });
    if (pending.toolSurfaceFence !== undefined) this._retainCurrentReplacementToolSurface(runId);
    if (!registered) return;
    if (this._record.pendingResume) this._emitPendingEvent(this._record.pendingResume);
  }

  private async _registerSandboxAccess(
    params: RegisterSandboxAccessParams & { runId?: string; toolCallId?: string; modeId?: string; modelId?: string },
  ): Promise<void> {
    this._assertOpenForTurn('ctx.registerSandboxAccess');
    if (typeof params.requestId !== 'string' || params.requestId.length === 0) {
      throw new HarnessValidationError('ctx.registerSandboxAccess.requestId', 'must be a non-empty string');
    }
    const validSemanticTypes = new Set(['file', 'command', 'network', 'mcp', 'custom']);
    if (!validSemanticTypes.has(params.semanticType)) {
      throw new HarnessValidationError(
        'ctx.registerSandboxAccess.semanticType',
        "must be one of 'file' | 'command' | 'network' | 'mcp' | 'custom'",
      );
    }
    if (params.reason !== undefined && typeof params.reason !== 'string') {
      throw new HarnessValidationError('ctx.registerSandboxAccess.reason', 'must be a string when provided');
    }
    const sanitizedPayload =
      params.payload !== undefined ? assertJsonValue(params.payload, 'ctx.registerSandboxAccess.payload') : undefined;
    const runId = params.runId ?? this._currentRunId;
    const toolCallId = params.toolCallId ?? params.requestId;
    if (!runId) {
      throw new HarnessValidationError('ctx.registerSandboxAccess.runId', 'active run id is required');
    }
    const modeId = params.modeId ?? this._record.modeId;
    const pending: PendingResume = {
      kind: 'sandbox-access',
      itemId: params.requestId,
      runId,
      toolCallId,
      ...this._pendingResumeSourceFields(),
      ...this._newPendingInteractionTiming('sandbox-access'),
      modeId,
      // §4.2e — see _registerQuestion: carry yolo through pre-registered pendings.
      ...(this._currentTurnYolo ? { yolo: true } : {}),
      runtimeDependencies: this._harness._runtimeDependenciesForMode(
        modeId,
        params.modelId ?? this._modelIdForQueuedItem(this._currentQueuedItemId),
      ),
      // §5.1 — carry the active turn's caller app bag onto the pending resume.
      ...(this._currentTurnRequestContext
        ? { requestContext: clonePersistedRequestContext(this._currentTurnRequestContext) }
        : {}),
      ...(this._currentToolSurfaceFenceSnapshot(runId)
        ? { toolSurfaceFence: this._currentToolSurfaceFenceSnapshot(runId) }
        : {}),
      payload: {
        sandboxAccess: {
          semanticType: params.semanticType,
          ...(params.reason !== undefined ? { reason: params.reason } : {}),
          ...(sanitizedPayload !== undefined ? { payload: sanitizedPayload } : {}),
        },
      },
    };
    let registered = false;
    await this._flushUpdate(prev => {
      const current = prev.pendingResume;
      if (current) {
        const currentSandboxAccess = current.payload?.sandboxAccess;
        if (
          current.kind === 'sandbox-access' &&
          current.runId === runId &&
          current.toolCallId === toolCallId &&
          current.itemId === params.requestId &&
          currentSandboxAccess?.semanticType === params.semanticType &&
          currentSandboxAccess?.reason === params.reason &&
          jsonValuesEqual(currentSandboxAccess?.payload, sanitizedPayload)
        ) {
          return prev;
        }
        throw new HarnessValidationError('ctx.registerSandboxAccess', `pending resume is already "${current.kind}"`);
      }
      registered = true;
      return { ...prev, pendingResume: pending };
    });
    if (pending.toolSurfaceFence !== undefined) this._retainCurrentReplacementToolSurface(runId);
    if (!registered) return;
    // §10.2: sandbox/path-access has no dedicated event — it projects to
    // question_pending via the captured pending resume.
    if (this._record.pendingResume) this._emitPendingEvent(this._record.pendingResume);
  }

  private async _registerPlanApproval(
    params: RegisterPlanApprovalParams & { runId?: string; toolCallId?: string; modeId?: string; modelId?: string },
  ): Promise<void> {
    this._assertOpenForTurn('ctx.registerPlanApproval');
    if (typeof params.planId !== 'string' || params.planId.length === 0) {
      throw new HarnessValidationError('ctx.registerPlanApproval.planId', 'must be a non-empty string');
    }
    if (params.title !== undefined && typeof params.title !== 'string') {
      throw new HarnessValidationError('ctx.registerPlanApproval.title', 'must be a string when provided');
    }
    if (typeof params.plan !== 'string' || params.plan.length === 0) {
      throw new HarnessValidationError('ctx.registerPlanApproval.plan', 'must be a non-empty string');
    }
    const runId = params.runId ?? this._currentRunId;
    const toolCallId = params.toolCallId ?? params.planId;
    if (!runId) {
      throw new HarnessValidationError('ctx.registerPlanApproval.runId', 'active run id is required');
    }
    const submittingModeId = params.modeId ?? this._record.modeId;
    const submittingMode = this._harness._getMode(submittingModeId);
    const pending: PendingResume = {
      kind: 'plan-approval',
      itemId: params.planId,
      runId,
      toolCallId,
      toolName: SUBMIT_PLAN_TOOL_NAME,
      ...this._pendingResumeSourceFields(),
      ...this._newPendingInteractionTiming('plan-approval'),
      modeId: submittingModeId,
      // §4.2e — see _registerQuestion: carry yolo through pre-registered pendings.
      ...(this._currentTurnYolo ? { yolo: true } : {}),
      runtimeDependencies: this._harness._runtimeDependenciesForMode(
        submittingModeId,
        params.modelId ?? this._modelIdForQueuedItem(this._currentQueuedItemId),
      ),
      // §5.1 — carry the active turn's caller app bag onto the pending resume.
      ...(this._currentTurnRequestContext
        ? { requestContext: clonePersistedRequestContext(this._currentTurnRequestContext) }
        : {}),
      ...(this._currentToolSurfaceFenceSnapshot(runId)
        ? { toolSurfaceFence: this._currentToolSurfaceFenceSnapshot(runId) }
        : {}),
      payload: {
        ...(params.title !== undefined ? { title: params.title } : {}),
        plan: params.plan,
      },
      ...(submittingMode.transitionsTo ? { transitionModeId: submittingMode.transitionsTo } : {}),
    };
    let registered = false;
    await this._flushUpdate(prev => {
      const current = prev.pendingResume;
      if (current) {
        if (current.kind === 'plan-approval' && current.runId === runId && current.toolCallId === toolCallId) {
          return prev;
        }
        throw new HarnessValidationError('ctx.registerPlanApproval', `pending resume is already "${current.kind}"`);
      }
      registered = true;
      return { ...prev, pendingResume: pending };
    });
    if (pending.toolSurfaceFence !== undefined) this._retainCurrentReplacementToolSurface(runId);
    if (!registered) return;
    if (this._record.pendingResume) this._emitPendingEvent(this._record.pendingResume);
  }

  /**
   * Settle a queued item's resolver with success and remove it from the
   * head of `pendingQueue`. The CAS write here is the durable record that
   * the item ran exactly once. Crash recovery uses `pendingQueue[0]`,
   * `pendingResume`, queue receipts, and signal-result evidence to decide
   * whether to replay, await, or fail a previously admitted item.
   */
  private async _completeQueuedTurn(itemId: string, result: AgentResult): Promise<void> {
    if (this.isClosed) {
      const resolver = this._queueResolvers.get(itemId);
      if (resolver) {
        this._queueResolvers.delete(itemId);
        resolver.resolve(result);
      }
      return;
    }
    const now = Date.now();
    let terminalFailure: Error | undefined;
    await this._flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[itemId];
      const receiptTerminalFailure = this._queueReceiptTerminalFailureErrorFromReceipt(receipt);
      if (receiptTerminalFailure) {
        terminalFailure = receiptTerminalFailure;
        return prev;
      }
      return {
        ...prev,
        pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
        ...(receipt
          ? {
              queueAdmissionReceipts: {
                ...(prev.queueAdmissionReceipts ?? {}),
                [itemId]: {
                  ...receipt,
                  status: 'completed',
                  result,
                  completedAt: receipt.completedAt ?? now,
                  updatedAt: now,
                },
              },
            }
          : {}),
      };
    });
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    // §10.2 OperationEvent — `queue_completed` is the queue settlement boundary,
    // not `agent_end`. Requires the accepted-signal identities (`runId`,
    // `signalId`); skip if the receipt never crossed the agent boundary.
    if (!terminalFailure) {
      const settledReceipt = this._record.queueAdmissionReceipts?.[itemId];
      if (settledReceipt?.runId && settledReceipt.signalId) {
        this._emit({
          type: 'queue_completed',
          runId: settledReceipt.runId,
          queuedItemId: itemId,
          signalId: settledReceipt.signalId,
          ...(settledReceipt.admissionId ? { admissionId: settledReceipt.admissionId } : {}),
          result,
        });
      }
    }
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      if (terminalFailure) {
        resolver.reject(terminalFailure);
      } else {
        resolver.resolve(result);
      }
    }
    this._notifyMaybeIdle();
    if (terminalFailure) return;
    // Kick the drain again — there may be more items waiting.
    void this._maybeDrainQueue();
  }

  /** Same as `_completeQueuedTurn` but rejects the resolver with `err`. */
  private async _failQueuedTurn(itemId: string, err: unknown): Promise<void> {
    // Eviction rejects local waiters and leaves durable queued work for its next
    // owner. Failure cleanup must not write through the lost lease.
    if (this.isClosed || this._state === 'evicted') {
      const resolver = this._queueResolvers.get(itemId);
      if (resolver) {
        this._queueResolvers.delete(itemId);
        resolver.reject(err);
      }
      return;
    }
    const now = Date.now();
    let completedResult: AgentResult | undefined;
    try {
      await this._flushUpdate(prev => {
        const receipt = prev.queueAdmissionReceipts?.[itemId];
        if (receipt?.status === 'completed') {
          completedResult = receipt.result as AgentResult | undefined;
          return {
            ...prev,
            pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
          };
        }
        return {
          ...prev,
          pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
          ...(receipt
            ? {
                queueAdmissionReceipts: {
                  ...(prev.queueAdmissionReceipts ?? {}),
                  [itemId]: {
                    ...receipt,
                    status: 'failed',
                    error: projectHarnessPublicError(err),
                    failedAt: receipt.failedAt ?? now,
                    updatedAt: now,
                  },
                },
              }
            : {}),
        };
      });
    } catch (flushError) {
      // The cleanup write may itself discover lease loss and evict this handle.
      if (
        this.lifecycleState === 'evicted' &&
        (flushError instanceof HarnessSessionLockedError || flushError instanceof HarnessSessionClosedError)
      ) {
        return;
      }
      throw flushError;
    }
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    // §10.2 OperationEvent — a late failure may race a completion that already
    // won (`completedResult`): emit `queue_completed` for that, else
    // `queue_failed`. `signalId`/`runId` are optional on the failed event.
    {
      const settledReceipt = this._record.queueAdmissionReceipts?.[itemId];
      if (completedResult !== undefined) {
        if (settledReceipt?.runId && settledReceipt.signalId) {
          this._emit({
            type: 'queue_completed',
            runId: settledReceipt.runId,
            queuedItemId: itemId,
            signalId: settledReceipt.signalId,
            ...(settledReceipt.admissionId ? { admissionId: settledReceipt.admissionId } : {}),
            result: completedResult,
          });
        }
      } else {
        this._emit({
          type: 'queue_failed',
          queuedItemId: itemId,
          ...(settledReceipt?.runId ? { runId: settledReceipt.runId } : {}),
          ...(settledReceipt?.signalId ? { signalId: settledReceipt.signalId } : {}),
          ...(settledReceipt?.admissionId ? { admissionId: settledReceipt.admissionId } : {}),
          error: projectHarnessPublicError(err),
        });
      }
    }
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      if (completedResult !== undefined) {
        resolver.resolve(completedResult);
      } else {
        resolver.reject(err);
      }
    }
    this._notifyMaybeIdle();
    void this._maybeDrainQueue();
  }

  private async _failPendingQueueForClose(err: unknown): Promise<void> {
    const queuedIds = (this._record.pendingQueue ?? []).map(item => item.id);
    if (queuedIds.length === 0) return;

    const completedResults = new Map<string, AgentResult>();
    const failedIds = new Set<string>();
    const now = Date.now();
    await this._flushUpdate(prev => {
      const next: SessionRecord = {
        ...prev,
        pendingQueue: [],
      };
      const receipts = prev.queueAdmissionReceipts ?? {};
      const nextReceipts: Record<string, QueueAdmissionReceipt> = { ...receipts };
      for (const item of prev.pendingQueue ?? []) {
        const receipt = receipts[item.id];
        if (!receipt) {
          failedIds.add(item.id);
          continue;
        }
        if (receipt.status === 'completed') {
          completedResults.set(item.id, receipt.result as AgentResult);
          continue;
        }
        failedIds.add(item.id);
        nextReceipts[item.id] = {
          ...receipt,
          status: 'failed',
          error: projectHarnessPublicError(err),
          failedAt: receipt.failedAt ?? now,
          updatedAt: now,
        };
      }
      next.queueAdmissionReceipts = nextReceipts;
      return next;
    });

    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    for (const itemId of queuedIds) {
      const resolver = this._queueResolvers.get(itemId);
      if (!resolver) continue;
      this._queueResolvers.delete(itemId);
      const completed = completedResults.get(itemId);
      if (completed !== undefined) {
        resolver.resolve(completed);
      } else if (failedIds.has(itemId)) {
        resolver.reject(err);
      }
    }
    this._notifyMaybeIdle();
  }

  private _parkQueuedTurn(itemId: string, err: unknown): void {
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    this._notifyMaybeIdle();
    if (err instanceof QueueRecoveryPendingError) {
      const delayMs = Math.max(0, err.retryAt - Date.now());
      const timer = setTimeout(() => void this._maybeDrainQueue(), delayMs);
      this._unrefQueueTimerIfBackgroundOnly(timer);
      return;
    }
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      resolver.reject(err);
    }
  }

  private _ensureQueuedItemContext(queuedItemId: string): void {
    if (this._currentQueuedItemId !== undefined) return;
    const queuedItem = this._record.pendingQueue.find(item => item.id === queuedItemId);
    this._currentQueuedItemId = queuedItemId;
    this._currentQueuedItemSource = queuedItem?.source ?? 'user';
  }

  private _deferQueuedTurnRetry(err: QueuePostRunFinalizationPendingError): void {
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    this._notifyMaybeIdle();
    const delayMs = Math.max(0, err.retryAt - Date.now());
    const timer = setTimeout(() => void this._maybeDrainQueue(), delayMs);
    this._unrefQueueTimerIfBackgroundOnly(timer);
  }

  private _scheduleQueueWakeupForPendingQueue(): void {
    const now = Date.now();
    let wakeAt: number | undefined;
    for (const item of this._record.pendingQueue ?? []) {
      const candidates = [item.notBefore, item.deadline].filter(
        (value): value is number => value !== undefined && value > now,
      );
      for (const candidate of candidates) {
        if (wakeAt === undefined || candidate < wakeAt) wakeAt = candidate;
      }
    }
    if (wakeAt === undefined) {
      this._clearQueueWakeTimer();
      if ((this._record.pendingQueue?.length ?? 0) > 0) {
        const timer = setTimeout(() => void this._maybeDrainQueue(), 0);
        this._unrefQueueTimerIfBackgroundOnly(timer);
      }
      return;
    }
    if (this._queueWakeAt !== undefined && this._queueWakeAt <= wakeAt) return;
    this._clearQueueWakeTimer();
    this._queueWakeAt = wakeAt;
    const delayMs = Math.min(Math.max(0, wakeAt - now), 2_147_483_647);
    this._queueWakeTimer = setTimeout(() => {
      this._queueWakeTimer = undefined;
      this._queueWakeAt = undefined;
      void this._maybeDrainQueue();
    }, delayMs);
    this._unrefQueueTimerIfBackgroundOnly(this._queueWakeTimer);
  }

  private _clearQueueWakeTimer(): void {
    if (this._queueWakeTimer !== undefined) {
      clearTimeout(this._queueWakeTimer);
      this._queueWakeTimer = undefined;
    }
    this._queueWakeAt = undefined;
  }

  /** TM-6 — cancel any pending reconcile-on-rehydrate retry timers on teardown. */
  private _clearDelegationReconcileTimers(): void {
    for (const timer of this._delegationReconcileRetryTimers) clearTimeout(timer);
    this._delegationReconcileRetryTimers.clear();
    this._delegationReconcileRerunRequested = false;
  }

  private _unrefQueueTimerIfBackgroundOnly(timer: ReturnType<typeof setTimeout>): void {
    if (this._queueResolvers.size === 0) {
      timer.unref?.();
    }
  }

  /** @internal — used by the Harness on hydration to start replay drain. */
  async _kickQueueDrain(): Promise<void> {
    return this._maybeDrainQueue();
  }

  // -------------------------------------------------------------------------
  // Internal helpers.
  // -------------------------------------------------------------------------

  private _assertLive(_method: string): void {
    if (this._state === 'deleted') {
      throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
    }
    if (this.isClosing) {
      throw harnessSessionClosingError(this);
    }
    if (this._state !== 'live') {
      throw new HarnessSessionClosedError(this.id);
    }
  }

  private _assertNotDeleted(): void {
    if (this._state === 'deleted') {
      throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
    }
  }

  private _assertOpenForTurn(_method: string): void {
    if (this._state === 'deleted') {
      throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
    }
    if (this._state === 'closed') {
      throw new HarnessSessionClosedError(this.id);
    }
    const cancelRequest = this._currentCancelRequest();
    if (cancelRequest !== undefined) {
      throw new HarnessSessionCancelledError(this.id, cancelRequest.reason);
    }
  }

  private _canDrainQueue(): boolean {
    // Legacy builds could persist per-session OM intent that the native Memory
    // engine never honored. Recovered work must park before scheduling, expiry,
    // receipt admission, or failure settlement mutates durable queue state.
    // `session.om.clearOverride()` commits recovery and then re-kicks the drain.
    if (this._hasUnsupportedObservationalMemoryIntent()) return false;
    if (this._record.cancelRequest !== undefined) return this._hasCompletedQueuedItemsAfterCancellation();
    if (this._state === 'live') return true;
    if (!this.isClosing) return false;
    return this._record.closeDeadlineAt === undefined || Date.now() < this._record.closeDeadlineAt;
  }

  private _hasCompletedQueuedItemsAfterCancellation(): boolean {
    return (this._record.pendingQueue ?? []).some(item => {
      const receipt = this._record.queueAdmissionReceipts?.[item.id];
      return receipt?.status === 'completed';
    });
  }

  /**
   * Apply an update to the in-memory record, CAS-write to storage, and
   * adopt the returned version. Single point of truth so every setter
   * stays consistent with the lease + version contract (§5.8).
   */
  private _flushUpdate(
    update: (prev: SessionRecord) => SessionRecord,
    opts?: {
      attachmentReferences?: SaveAttachmentReferenceInput[];
      ifVersion?: number;
      tokenUsageDelta?: TokenUsage | (() => TokenUsage | undefined);
    },
  ): Promise<void> {
    if (this._state === 'closed') {
      return Promise.reject(new HarnessSessionClosedError(this.id));
    }
    if (this._state === 'deleted') {
      return Promise.reject(new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId));
    }
    if (this._state === 'evicted') {
      return Promise.reject(new HarnessSessionClosedError(this.id));
    }
    const run = async (): Promise<void> => {
      // §5.8 write-concurrency: a caller-supplied `ifVersion` (remote state
      // PATCH OCC) must fail closed on conflict — never retry. Internal flushes
      // may recover from a cross-owner CAS conflict once (same-process writes
      // serialize on the flush chain, so a conflict here means another owner).
      const maxRetries = opts?.ifVersion !== undefined ? 0 : 1;
      for (let attempt = 0; ; attempt++) {
        const leaseExpiresAt = this._record.leaseExpiresAt;
        if (
          (this._state === 'live' || this._state === 'closing') &&
          leaseExpiresAt !== undefined &&
          leaseExpiresAt <= Date.now()
        ) {
          await this._harness._internalEvictLiveSessionLeaseLost(this);
          throw new HarnessSessionLockedError(this.id, 'unknown', leaseExpiresAt);
        }
        if (opts?.ifVersion !== undefined && this._record.version !== opts.ifVersion) {
          throw new HarnessStateConflictError(this.id, opts.ifVersion, this._record.version);
        }
        // §10.2 state_changed: capture the pre-update durable state so we can
        // diff it after the write commits. Internal flushes that don't touch
        // `state` (mode/model/token/goal/pendingResume) keep the same reference
        // and produce no changed keys, so they never emit.
        const prevState = this._record.state;
        const updated = update(this._record);
        const tokenUsageDelta =
          typeof opts?.tokenUsageDelta === 'function' ? opts.tokenUsageDelta() : opts?.tokenUsageDelta;
        const tokenUsageForSave =
          tokenUsageDelta !== undefined
            ? {
                promptTokens: this._tokenUsage.promptTokens + tokenUsageDelta.promptTokens,
                completionTokens: this._tokenUsage.completionTokens + tokenUsageDelta.completionTokens,
                totalTokens: this._tokenUsage.totalTokens + tokenUsageDelta.totalTokens,
              }
            : this._tokenUsage;
        const next: SessionRecord = {
          ...updated,
          // Overlay the live token-usage counter so every CAS write persists the
          // latest aggregate. Updaters never need to thread `tokenUsage` through
          // their closures, and `_recordTurnCompletion` mutations between save
          // construction and post-save assignment are not lost — we re-overlay
          // from the live counter below.
          tokenUsage: { ...tokenUsageForSave },
          lastActivityAt: Date.now(),
        };
        // PF-2251 D2/D4 — receipts stay bounded on EVERY persisted record, at
        // the single flush chokepoint, so no write path can regrow them past
        // the storage document limit.
        if (next.inboxResponseReceipts !== undefined) {
          next.inboxResponseReceipts = pruneInboxResponseReceipts(next.inboxResponseReceipts);
        }
        if (next.queueAdmissionReceipts !== undefined) {
          next.queueAdmissionReceipts = pruneQueueAdmissionReceipts(next.queueAdmissionReceipts);
        }
        // PF-2251 step 3 — session-survival guard. A record past the storage
        // document budget bricks the session forever (every later save fails),
        // so an oversized record is diagnosed loudly and, when a pending
        // interaction's payload dominates (suspend snapshots can embed huge
        // provider reasoning blobs), the pending is converted into an expired
        // interaction: the user re-issues one confirmation instead of losing
        // the whole session. Never silent — the log names the top fields.
        {
          const serializedSize = safeSerializedSize(next);
          if (serializedSize > SESSION_RECORD_SIZE_BUDGET_BYTES) {
            const fieldSizes = topRecordFieldSizes(next);
            console.error(
              '[harness/v1] session record exceeded the size budget; top fields:',
              JSON.stringify({ sessionId: this.id, serializedSize, fieldSizes }),
            );
            const pending = next.pendingResume;
            if (
              pending !== undefined &&
              pending.itemId !== undefined &&
              pending.runId !== undefined &&
              pending.toolCallId !== undefined &&
              pending.requestedAt !== undefined &&
              safeSerializedSize(pending) > serializedSize / 4
            ) {
              next.expiredPendingInteractions = appendExpiredPendingInteraction(next.expiredPendingInteractions, {
                generationKey: pendingInteractionGenerationKey({
                  kind: pending.kind,
                  itemId: pending.itemId,
                  runId: pending.runId,
                  toolCallId: pending.toolCallId,
                  requestedAt: pending.requestedAt,
                }),
                itemId: pending.itemId,
                kind: pending.kind,
                runId: pending.runId,
                toolCallId: pending.toolCallId,
                requestedAt: pending.requestedAt,
                expiresAt: pending.expiresAt ?? pending.requestedAt,
                expiredAt: Date.now(),
                error: {
                  code: 'harness.pending.record_size_budget',
                  message:
                    'Pending interaction was expired because its durable payload exceeded the session record size budget.',
                },
              });
              delete next.pendingResume;
            }
          }
        }
        const saveOpts = {
          harnessName: this._record.harnessName,
          ownerId: this._ownerId,
          ifVersion: this._record.version,
        };
        try {
          const saved =
            opts?.attachmentReferences && opts.attachmentReferences.length > 0
              ? await this._storage.saveSessionWithAttachmentReferences(next, saveOpts, opts.attachmentReferences)
              : await this._storage.saveSession(next, saveOpts);
          // `tokenUsageDelta` is applied only after a successful save, so a
          // failed attempt never double-counts on retry.
          this._applyTokenUsageDelta(tokenUsageDelta);
          this._clearPendingTokenUsageFlushErrorIfSaved(next.tokenUsage);
          // §5.8 advance-only lease expiry: `next` was built from an older
          // `_record`, so a subtree renewal that marked a later expiry on this
          // session while the save was in flight must not be regressed by this
          // reassignment. Carry the max so the local lease guard never fences a
          // still-valid session early. saveSession does not persist lease
          // metadata, so this is an in-memory reconciliation only.
          const committedLeaseExpiresAt =
            Math.max(next.leaseExpiresAt ?? 0, this._record.leaseExpiresAt ?? 0) || undefined;
          this._record = {
            ...next,
            tokenUsage: { ...this._tokenUsage },
            version: saved.version,
            leaseExpiresAt: committedLeaseExpiresAt,
          };
          this._syncPendingInteractionExpiryTimer();
          // §10.2 state_changed — emit only when durable `session.state` actually
          // changed, after the record is committed so subscribers reading state
          // see the post-write value.
          const stateChangedKeys = diffStateKeys(prevState, this._record.state);
          if (stateChangedKeys.length > 0) {
            this._emit({
              type: 'state_changed',
              // §10.2: full post-commit root. `session.state` is `unknown` and may
              // be a scalar/array/object root; carry it as-is so a `'$'`-keyed root
              // change is readable from this field. `undefined` (no state yet) is
              // reported as `{}` to keep the prior empty-object default.
              state: (this._record.state ?? {}) as JsonValue,
              changedKeys: stateChangedKeys,
            });
          }
          return;
        } catch (err) {
          // §5.8: the save's lease-holder check fired — another owner holds the
          // lease, so subtree ownership was lost (root conflict) or split (child
          // conflict). Fence the WHOLE live subtree rather than only this session
          // or retrying into a contested record.
          if (err instanceof HarnessStorageLeaseConflictError) {
            await this._harness._internalEvictSubtreeLeaseLost(this);
            throw new HarnessSessionLockedError(this.id, err.heldBy, err.expiresAt);
          }
          if (!(err instanceof HarnessStorageVersionConflictError) || attempt >= maxRetries) {
            throw err;
          }
          // §5.8: before re-applying, prove this owner still holds the SUBTREE
          // lease. For a child this proves through the root, not the child's own
          // row — renewing the child alone would not detect a parent/root
          // ownership loss or subtree split. The helper renews root + active
          // descendants and fences the whole subtree (throwing locked/not-found)
          // if ownership can't be proven.
          await this._harness._internalRenewProveSubtree(
            this,
            this._getEffectiveLeaseTtlMs(this._harness._internalLeaseTtlMs),
          );
          const reloaded = await this._storage.loadSession({
            harnessName: this._record.harnessName,
            sessionId: this.id,
          });
          if (!reloaded) {
            await this._harness._internalEvictLiveSessionLeaseLost(this);
            throw new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
          }
          // Adopt the concurrent durable state under our proven lease, then loop
          // to re-apply the (pure) updater against the reloaded record.
          this._record = { ...reloaded, ownerId: this._ownerId, leaseExpiresAt: this._record.leaseExpiresAt };
        }
      }
    };
    // Chain so concurrent callers serialize against the latest in-memory
    // version. Swallow chain-link errors so one caller's failure doesn't
    // poison subsequent flushes.
    const next = this._flushChain.then(run, run);
    this._flushChain = next.catch(() => {});
    return next;
  }

  /**
   * Serialize a plan-task read-modify-write op onto the same per-session
   * `_flushChain` that serializes `_flushUpdate`.
   *
   * §5.8 / TM-5 concurrency: a single model turn can emit parallel tool calls
   * (the agent loop executes tool calls in a step concurrently), so two
   * `task_*` tools can run at once for one live session. Each plan-task op does
   * a read (`listPlanTasks`) → compute (rollup / single-`in_progress` / cycle
   * checks) → write (`mutatePlanTasksForSession`). The storage fence keys on the
   * SESSION version, which plan-task writes do NOT bump, and per-row OCC only
   * guards same-row writes — so two ops touching DIFFERENT rows (e.g. each
   * driving a different sibling `in_progress`) both read the same pre-image,
   * both pass their invariant checks, and both commit, violating the per-root
   * single-`in_progress` / rollup invariants. Running the whole op body inside
   * this chain makes them one-at-a-time per session, so the second op's read
   * sees the first op's committed result and its invariant check is honored.
   *
   * Unlike `_flushUpdate`, errors propagate to the caller (a `task_*` tool must
   * surface a conflict) but are swallowed from the stored chain link so one
   * op's failure never poisons a later op.
   */
  private _serializePlanTaskWrite<T>(run: () => Promise<T>): Promise<T> {
    const next = this._flushChain.then(run, run);
    this._flushChain = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  /**
   * Admit a model-authored plan mutation against the current conversation-work
   * epoch, then recheck that epoch when its serialized RMW body reaches the head
   * of the write chain. A reset/stop that starts in between therefore rejects
   * stale work instead of letting it recreate a discarded branch.
   */
  private _admitPlanTaskMutation<T>(
    operation: string,
    callerSignal: AbortSignal | undefined,
    run: () => Promise<T>,
  ): Promise<T> {
    const admissionEpoch = this._captureActiveWorkAdmission(operation);
    this._assertActiveWorkAdmission(admissionEpoch, operation, callerSignal);
    return this._serializePlanTaskWrite(() => {
      this._assertActiveWorkAdmission(admissionEpoch, operation, callerSignal);
      return run();
    });
  }

  /**
   * Build the toolset surface for a single turn:
   *   - mode.tools (replace) wins over agent's own tools
   *   - mode.additionalTools merges with agent's tools
   *   - per-call additionalTools layer on top of whatever the mode produced
   *
   * Returns the per-turn toolsets and replacement policy. With no mode or
   * Harness overrides, both fields are omitted and the agent keeps its tools.
   */
  private _buildToolSurface(
    mode: HarnessMode,
    callAdditional?: ToolsInput,
  ): Pick<AgentExecutionOptionsBase<unknown>, 'toolsets' | 'toolsetsMode'> {
    // §4.2e workspace tool profile: when the mode declares `workspaceTools.expose`,
    // withhold workspace-category tools (read/edit/execute) NOT in the list from
    // the harness-controlled toolsets (mode + per-call). mcp/other/uncategorized
    // tools and the harness built-ins are never filtered. Needs a configured
    // `toolCategoryResolver`; with none, categories are null and nothing is hidden.
    const expose = mode.workspaceTools?.expose;
    const profile = (tools: ToolsInput): ToolsInput =>
      expose ? this._applyWorkspaceToolProfile(tools, expose) : { ...tools };
    const toolsets: Record<string, ToolsInput> = {};
    if (mode.tools && Object.keys(mode.tools).length > 0) toolsets[`mode:${mode.id}`] = profile(mode.tools);
    if (mode.additionalTools && Object.keys(mode.additionalTools).length > 0) {
      toolsets[`mode:${mode.id}:add`] = profile(mode.additionalTools);
    }
    if (callAdditional && Object.keys(callAdditional).length > 0) toolsets[`call:additional`] = profile(callAdditional);
    // §9 — a SubagentDefinition.tools override (set on the child session at spawn)
    // is layered onto the subagent's surface, subject to the same workspace-tool
    // profile + permission gate as any other tool.
    if (this._subagentToolsOverride) toolsets[`subagent:tools`] = profile(this._subagentToolsOverride);

    // Built-in tools registered on the `harness:builtin` toolset (§6.4 / §9).
    // `spawn_subagent` is conditional on subagent types being configured; the
    // plan-task tools are always available. Both close over this session so they
    // act on the calling session only (§6.4 ownership rule).
    const builtins: ToolsInput = {};
    if (mode.harnessBuiltins !== 'exclude') {
      const spawn = createSpawnSubagentTool(this);
      if (spawn) builtins[SPAWN_SUBAGENT_TOOL_ID] = spawn;
      // Plan-task tools (§5.1k / §6.4 — TM-3). The only model-facing mutation path
      // for the durable HarnessPlanTask tree; each write routes through this
      // session under its lease.
      Object.assign(builtins, createPlanTaskTools(this));
    }
    // Child completion requires this terminal envelope even when the mode
    // excludes optional mutation and delegation builtins.
    if (this._record.origin === 'subagent-tool') {
      builtins[HARNESS_SUBAGENT_OUTCOME_REPORT_TOOL_ID] = createSubagentOutcomeReportTool();
    }
    if (Object.keys(builtins).length > 0) {
      toolsets['harness:builtin'] = builtins;
    }

    return {
      ...(Object.keys(toolsets).length > 0 || mode.tools !== undefined ? { toolsets } : {}),
      ...(mode.tools !== undefined ? { toolsetsMode: 'replace' as const } : {}),
    };
  }

  /** Capture the canonical per-turn replacement surface after `_beginTurn` resets transient state. */
  private _setCurrentTurnReplacementToolSurface(
    toolSurface: Pick<AgentExecutionOptionsBase<unknown>, 'toolsets' | 'toolsetsMode'>,
  ): void {
    if (toolSurface.toolsetsMode !== 'replace') {
      this._currentTurnReplacementToolSurface = undefined;
      return;
    }
    const sourceTools = Object.assign({}, ...Object.values(toolSurface.toolsets ?? {})) as Record<string, unknown>;
    this._currentTurnReplacementToolSurface = {
      toolSurface,
      // Snapshot source descriptors at turn admission. The toolset maps are
      // already shallow copies, so later mode-map edits cannot swap values;
      // this fence also restores in-place edits to a retained tool object.
      fence: createToolSurfaceFence(sourceTools),
    };
  }

  /** Retain the admission-time definition snapshot for a later same-process resume. */
  private _retainCurrentReplacementToolSurface(runId: string): void {
    const current = this._currentTurnReplacementToolSurface;
    if (!current) return;
    this._pendingReplacementToolSurfaces.clear();
    this._pendingReplacementToolSurfaces.set(runId, current.fence);
  }

  /**
   * Withhold workspace-category tools (`read`/`edit`/`execute`) whose category is
   * NOT in `expose` (§4.2e workspace tool profile). `mcp`/`other`/uncategorized
   * tools pass through unchanged — the profile governs the workspace tool surface
   * only, never the workspace itself. Returns a fresh map; the input is untouched.
   */
  private _applyWorkspaceToolProfile(tools: ToolsInput, expose: readonly ToolCategory[]): ToolsInput {
    if (typeof tools !== 'object' || tools === null || Array.isArray(tools)) return tools;
    const allowed = new Set<ToolCategory>(expose);
    const out: Record<string, unknown> = {};
    for (const [name, tool] of Object.entries(tools as Record<string, unknown>)) {
      const category = this._harness.getToolCategory({ toolName: name });
      const isWorkspaceCategory = category === 'read' || category === 'edit' || category === 'execute';
      if (isWorkspaceCategory && !allowed.has(category)) continue; // withheld for this mode
      out[name] = tool;
    }
    return out as ToolsInput;
  }

  /**
   * Build the per-turn `RequestContext` that the agent passes to tools. The
   * `'harness'` slot exposes `HarnessRequestContext` (§6.1). Tools read it
   * with `context.requestContext.get('harness')`.
   *
   * The slot is constructed fresh per turn so identity reads, the state
   * snapshot, abort plumbing, and event emission all see the current state
   * of the session. Functional `setState` updates serialize through the
   * same `_flushUpdate` chain that backs `Session.setState`.
   */
  private async _buildRequestContext(turn: {
    modeId: string;
    modelId: string;
    abortSignal: AbortSignal;
    persistedRequestContext?: PersistedRequestContextInput;
    resolveWorkspace?: boolean;
    /**
     * Per-turn `yolo` (§4.2e / `QueueOverrides.yolo`). When `true`, clear the
     * POLICY-level approval reason this turn would raise (an effective `ask` from
     * the permission gate). Per spec it suppresses ONLY the `policy` reason — it
     * never suppresses a tool-owned `requireApproval`/`needsApprovalFn`, and never
     * bypasses a `deny`. Only the queued-turn drain sets it today (a queued item
     * persists `yolo` so it survives crash replay).
     */
    yolo?: boolean;
  }): Promise<RequestContext> {
    if (this._hasUnsupportedObservationalMemoryIntent()) {
      throw new HarnessConfigError(
        'observationalMemory',
        'Harness per-session Observational Memory is not supported until @mastra/memory can select an OM engine from the per-turn memory config. Configure OM on the Agent Memory instance and omit HarnessConfig.observationalMemory.',
      );
    }
    const session = this;
    const stateSnapshot = (this._record.state ?? {}) as unknown;
    const persistedRequestContext = turn.persistedRequestContext
      ? clonePersistedRequestContext(turn.persistedRequestContext)
      : undefined;
    // §5.1 — stash the turn's caller context so a suspension can persist it on
    // `PendingResume` and a resume rebuild the SAME app bag. GUARDED on
    // `turn.persistedRequestContext` so non-turn callers (e.g. `mcp.listTools`,
    // which pass no caller context) never clobber an active turn's stash; the
    // per-turn reset in `_resetTurnTracking` keeps turn N's bag out of turn N+1.
    if (persistedRequestContext !== undefined) {
      this._currentTurnRequestContext = persistedRequestContext;
    }
    // §6.2 strict-lazy materialization: context construction MUST NOT cold-start a
    // (cloud) workspace solely to fill the `ctx.workspace` field. Default to the
    // cached handle (non-materializing); a tool that needs the filesystem calls
    // `ctx.resolveWorkspace()`, and the workspace's own built-in tools resolve
    // through the agent's workspace independently of this slot. This is UNIFORM
    // across top-level and subagent sessions: a `fresh`/per-session subagent owns
    // a DISTINCT workspace identity, but the backing sandbox is provisioned only
    // when that session first resolves it — `fresh` guarantees independence on
    // resolution, not allocation at spawn (task #36). A caller may force eager
    // materialization with `resolveWorkspace: true`.
    let workspace: Workspace | undefined;
    if (turn.resolveWorkspace === true) {
      try {
        workspace = await this._getWorkspaceUnchecked();
      } catch {
        // Leave undefined — tools that need a workspace will get a null slot.
        // The registry has already emitted workspace_error so subscribers know.
        workspace = undefined;
      }
    } else {
      workspace = this.peekWorkspace();
    }
    const harnessSlot: HarnessRequestContext<unknown> = {
      // §6.1: harnessName is the stable namespace; harnessInstanceId is per-process.
      harnessName: this._record.harnessName,
      harnessInstanceId: this._harness.ownerId,
      sessionId: this.id,
      threadId: this.threadId,
      resourceId: this.resourceId,
      modeId: turn.modeId,
      modelId: turn.modelId,
      ...(persistedRequestContext?.metadata ? { app: persistedRequestContext.metadata } : {}),
      ...(persistedRequestContext?.channel ? { channel: persistedRequestContext.channel } : {}),
      state: stateSnapshot,
      getState: () => (session._record.state ?? {}) as unknown,
      setState: ((updatesOrUpdater: unknown) =>
        session._setTurnState(
          updatesOrUpdater as Partial<unknown> | ((prev: unknown) => unknown),
        )) as HarnessRequestContext<unknown>['setState'],
      abortSignal: turn.abortSignal,
      registerQuestion: params => session._registerQuestion({ ...params, modeId: turn.modeId, modelId: turn.modelId }),
      registerPlanApproval: params =>
        session._registerPlanApproval({ ...params, modeId: turn.modeId, modelId: turn.modelId }),
      registerSandboxAccess: params =>
        session._registerSandboxAccess({ ...params, modeId: turn.modeId, modelId: turn.modelId }),
      emitCustomEvent: event => session._emitCustomEvent(event),
      extendLease: opts => session.extendLease(opts),
      // Subagent linkage — set from the record so spawned sessions report
      // their depth + parent linkage on the harness slot.
      subagentDepth: this._record.subagentDepth ?? 0,
      source: (this._record.subagentDepth ?? 0) > 0 ? 'subagent' : 'parent',
      parentSessionId: this._record.parentSessionId,
      ...(this._subagentParentToolCallId !== undefined ? { subagentToolCallId: this._subagentParentToolCallId } : {}),
      getSubagentModel: params => {
        const agentType = params?.agentType;
        if (!agentType) return null;
        return this._record.subagentModelOverrides?.[agentType] ?? null;
      },
      // §6.1 workspace access — delegate to the owning session so the
      // materialization/lease logic stays in one place. `getWorkspace()` is the
      // sync cached read (non-materializing); `resolveWorkspace()` cold-starts.
      hasWorkspace: () => session.hasWorkspace(),
      isWorkspaceReady: () => session.isWorkspaceReady(),
      getWorkspace: () => session.peekWorkspace(),
      resolveWorkspace: () => session.resolveWorkspace(),
      // §5.1b.4/§5.6/§10.6 activity timeline — delegate to the owning session so the
      // read-time projection logic lives in one place.
      getActivityTimeline: (opts?: ActivityTimelineOptions) => session.getActivityTimeline(opts),
      // Tool-facing skill execution. Delegates back to the owning session
      // so resolution, args validation, prompt construction, and dispatch
      // stay in one place (§4.6).
      useSkill: (ref, opts) => session._skillsUse(ref, opts),
      ...(workspace ? { workspace } : {}),
    };
    const entries: [string, unknown][] = [['harness', harnessSlot]];
    if (persistedRequestContext?.metadata) {
      entries.push(['app', persistedRequestContext.metadata]);
    }
    if (persistedRequestContext?.channel) {
      entries.push(['channel', persistedRequestContext.channel]);
    }
    const inheritedRequestContext = projectInheritedRequestContextAppBag(
      persistedRequestContext?.metadata,
      this._harness._getSubagentInheritedRequestContextAppKeys(),
    );
    if (inheritedRequestContext !== undefined) {
      for (const [key, value] of Object.entries(inheritedRequestContext.app)) {
        entries.push([key, value]);
      }
    }
    // §4.2e permission GATE — thread a per-tool policy resolver the loop's
    // tool-call step consults (deny → block, ask → require approval, allow →
    // proceed). OPT-IN: only engaged when the operator configured a policy
    // (mode.permissions/runtime rules, or an explicit defaultPermissionPolicy),
    // so an unconfigured harness keeps today's no-gate behavior.
    if (this._toolPermissionGateEngaged()) {
      // Snapshot rules/grants/default at turn-build time so a concurrent
      // switchMode (or runtime setPolicy) mid-turn cannot retroactively re-gate an
      // in-flight turn. Resume rebuilds the context (re-snapshots the CURRENT
      // policy), so parked approvals still re-evaluate per §4.2e.
      const ruleSnapshot: PermissionRules = {
        categories: { ...this._record.permissionRules.categories },
        tools: { ...this._record.permissionRules.tools },
      };
      const grantSnapshot: SessionGrants = {
        categories: [...this._record.sessionGrants.categories],
        tools: [...this._record.sessionGrants.tools],
      };
      const defaultPolicy = this._harness._getDefaultPermissionPolicy();
      // M4: snapshot the subagent allowlist alongside the policy so a non-listed
      // tool resolves to a hard `deny` (the §14.7 channel fence already ran upstream
      // at the pre-exposure gate; this composes after it and ahead of the policy).
      const allowlistSnapshot = this._subagentToolAllowlist ? new Set(this._subagentToolAllowlist) : undefined;
      entries.push([
        TOOL_PERMISSION_POLICY_KEY,
        (toolName: string) =>
          session._resolveToolPolicy(toolName, ruleSnapshot, grantSnapshot, defaultPolicy, allowlistSnapshot),
      ]);
      // The resolver above closes over immutable per-turn copies. Durable
      // foreach dispatch may therefore classify the emitted batch before
      // choosing concurrency without a mid-turn rule/grant change turning an
      // `allow` preflight into an `ask` at the side-effect boundary.
      entries.push([TOOL_PERMISSION_POLICY_STABLE_KEY, true]);
      // §O4 — deny observability: the loop calls this when the policy above blocks
      // a tool (pre-exposure removal or action-time refusal), so a `tool_denied`
      // event surfaces WHY instead of the denial being silent. Sync + best-effort.
      entries.push([
        '__mastra_onToolDenied',
        (info: {
          toolName: string;
          stage: 'pre-exposure' | 'action';
          toolCallId?: string;
          forcedToolChoice?: boolean;
          deniedToolCount?: number;
          deniedToolNames?: string[];
        }) => {
          session._emitTurnEvent({
            type: 'tool_denied',
            toolName: info.toolName,
            stage: info.stage,
            ...(info.toolCallId !== undefined ? { toolCallId: info.toolCallId } : {}),
            ...(info.forcedToolChoice ? { forcedToolChoice: true } : {}),
            ...(info.deniedToolCount !== undefined ? { deniedToolCount: info.deniedToolCount } : {}),
            ...(info.deniedToolNames !== undefined ? { deniedToolNames: info.deniedToolNames } : {}),
            ...(session._currentRunId !== undefined ? { runId: session._currentRunId } : {}),
          });
        },
      ]);
    }
    // §4.2e `yolo` — a per-turn suppressor for the POLICY-level approval reason
    // (an effective `ask` from the permission gate). Per spec it clears ONLY the
    // `policy` reason; it never suppresses a tool-owned `requireApproval`/
    // `needsApprovalFn`, and never bypasses a `deny`. The loop's tool-call step
    // honors it AFTER the `deny` short-circuit.
    if (turn.yolo === true) {
      entries.push(['__mastra_yoloAutoApprove', true]);
    }
    const requestContext = new RequestContext<unknown>(entries);
    // Only the currently admitted turn owns the suspend snapshot. Auxiliary
    // callers such as MCP listTools may also build a context; they must not
    // overwrite the active turn's fence source.
    if (this._currentTurnAbortController?.signal === turn.abortSignal) {
      this._currentAgentRequestContext = requestContext;
    }
    return requestContext;
  }

  private _currentToolSurfaceFenceSnapshot(runId: string): string[] | undefined {
    const fence = readToolSurfaceFence(this._currentAgentRequestContext, runId);
    return fence ? [...fence.allowedNames] : undefined;
  }

  /**
   * Whether the §4.2e permission gate is engaged for this session. True when the
   * session has ANY per-tool/category rule, OR the harness `defaultPermissionPolicy`
   * was explicitly configured. When neither holds, the gate is OFF (no resolver is
   * threaded) and tools run ungated, preserving pre-§4.2e behavior.
   */
  private _toolPermissionGateEngaged(): boolean {
    if (this._harness._isDefaultPermissionPolicyConfigured()) return true;
    // M4: a subagent capability allowlist must engage the gate too — the resolver
    // is what hard-denies (and pre-exposure removes) tools outside the scope.
    if (this._subagentToolAllowlist !== undefined) return true;
    const rules = this._record.permissionRules;
    return Object.keys(rules.categories).length > 0 || Object.keys(rules.tools).length > 0;
  }

  /**
   * Resolve the effective permission policy for a tool (§4.2e order) against a
   * per-turn POLICY SNAPSHOT: a per-tool rule wins, else the tool's category rule,
   * else the harness default. A matching tool/category GRANT turns an `ask` into
   * `allow` (a grant suppresses only the policy-level ask; it never overrides a
   * `deny`). Only protocol-critical HITL/terminal built-ins resolve to `allow`.
   * Plan mutation/check/delegation and child-spawn built-ins fall through to the
   * normal policy after the subagent allowlist cap.
   */
  private _resolveToolPolicy(
    toolName: string,
    rules: PermissionRules,
    grants: SessionGrants,
    defaultPolicy: PermissionPolicy,
    allowlist?: ReadonlySet<string>,
  ): PermissionPolicy {
    // These three tools are protocol boundaries rather than user capabilities.
    if (UNGATED_HARNESS_BUILTIN_TOOL_IDS.has(toolName)) return 'allow';
    // M4 — subagent capability scope: a tool outside the allowlist is a hard deny
    // (removed pre-exposure; refused at action time), regardless of permission rules.
    if (allowlist !== undefined && !allowlist.has(toolName)) return 'deny';
    const category = this._harness.getToolCategory({ toolName }) ?? undefined;
    let policy: PermissionPolicy =
      (rules.tools[toolName] as PermissionPolicy | undefined) ??
      (category !== undefined ? (rules.categories[category] as PermissionPolicy | undefined) : undefined) ??
      defaultPolicy;
    if (policy === 'ask') {
      const granted =
        grants.tools.includes(toolName) || (category !== undefined && grants.categories.includes(category));
      if (granted) policy = 'allow';
    }
    return policy;
  }

  private async _setTurnState<TState = unknown>(
    updatesOrUpdater: Partial<TState> | ((prev: TState) => TState),
  ): Promise<void> {
    // Tool-facing state writes belong to an already-admitted turn, so they
    // remain valid while close drains. `_flushUpdate` still rejects after the
    // terminal closed marker lands.
    await this._flushUpdate(prev => {
      const current = (prev.state ?? {}) as TState;
      const next =
        typeof updatesOrUpdater === 'function'
          ? (updatesOrUpdater as (prev: TState) => TState)(current)
          : ({ ...(current as object), ...(updatesOrUpdater as object) } as TState);
      // §5.1: same pre-commit JSON-serializability guard as `setState()` — a tool
      // that writes a non-serializable value fails closed, not silently.
      const badPath = firstNonJsonStatePath(next, '$', new Set());
      if (badPath !== undefined) throw new HarnessStateSerializationError(this.id, badPath);
      return { ...prev, state: next };
    });
  }

  /** @internal — used by the Harness as soon as close starts. */
  _beginClosing(): void {
    if (this.isClosed) {
      return;
    }
    this._state = 'closing';
    this._rejectIdleWaiters(harnessSessionClosingError(this));
  }

  /** @internal — restore admission if close failed before the durable marker committed. */
  _restoreLiveAfterFailedClose(): void {
    if (this._state === 'closing' && this._record.closingAt === undefined && this._record.closedAt === undefined) {
      this._state = 'live';
    }
  }

  /**
   * @internal — used by the Harness after close starts. New work is rejected
   * immediately while previously admitted flushes serialize before the marker.
   */
  _flushClosingMarker(params: { closeTimeoutMs: number; closeDeadlineAt?: number }): Promise<SessionRecord> {
    if (this.isClosed) {
      return Promise.resolve(this._record);
    }
    this._beginClosing();

    const run = async (): Promise<SessionRecord> => {
      const closingAt = this._record.closingAt ?? Date.now();
      // §5.5: ONE fixed deadline for the whole subtree. The close owner stamps a
      // single `closeDeadlineAt` at the root and propagates it here, so a
      // descendant marked mid-walk never resets the clock to its own wall-clock
      // `now + closeTimeoutMs`. The per-node `closingAt + closeTimeoutMs` is only
      // a fallback for the root (or a standalone flush where no subtree deadline
      // is supplied) and is overridden by any deadline already persisted on the
      // record (resumed close).
      const closeDeadlineAt =
        this._record.closeDeadlineAt ?? params.closeDeadlineAt ?? closingAt + params.closeTimeoutMs;
      const next: SessionRecord = {
        ...this._record,
        closingAt,
        closeDeadlineAt,
        tokenUsage: { ...this._tokenUsage },
        lastActivityAt: Date.now(),
      };
      const saved = await this._storage.saveSession(next, {
        harnessName: this._record.harnessName,
        ownerId: this._ownerId,
        ifVersion: this._record.version,
      });
      this._record = { ...next, version: saved.version };
      return this._record;
    };
    const next = this._flushChain.then(run, run);
    this._flushChain = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  /** @internal — used by the Harness after descendants are terminalized. */
  async _flushClosedMarker(closedAt: number): Promise<SessionRecord> {
    // Close can begin before the debounced assistant-draft write fires. Drain
    // that write while the session is still in the writable `closing` state;
    // `_markClosed()` intentionally rejects every later `_flushUpdate`.
    // There can be no new draft deltas after the close drain reaches idle, so
    // this also cancels the timer and makes the post-close event flush a no-op
    // for assistant drafts.
    await this._flushAssistantDraftsNow();

    const run = async (): Promise<SessionRecord> => {
      if (this._record.closedAt !== undefined) {
        return this._record;
      }
      const next: SessionRecord = {
        ...this._record,
        tokenUsage: { ...this._tokenUsage },
        lastActivityAt: closedAt,
        closedAt,
      };
      const saved = await this._storage.saveSession(next, {
        harnessName: this._record.harnessName,
        ownerId: this._ownerId,
        ifVersion: this._record.version,
      });
      this._record = { ...next, version: saved.version };
      return this._record;
    };
    const next = this._flushChain.then(run, run);
    this._flushChain = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  /**
   * @internal — used by the Harness during `close()` to mark this instance
   * terminal. Does not touch storage or release the lease — those are the
   * harness's job. Idempotent.
   */
  _markClosed(updatedRecord: SessionRecord): void {
    this._clearQueueWakeTimer();
    this._clearPendingInteractionExpiryTimer();
    this._clearDelegationReconcileTimers();
    this._leaseExtensionDeadline = undefined;
    this._record = updatedRecord;
    this._state = 'closed';
    // Span-summary: drop any in-flight run spans (e.g. an abandoned suspended run
    // that will never reach a terminal here) so they cannot accumulate.
    this._openRuns.clear();
    this._runToolReceipts.clear();
    this._finalizedRunIds.clear();
    this._pendingReplacementToolSurfaces.clear();
    this._tearDownThreadSubscription(new HarnessValidationError('session.close()', 'Session closed'));
    this._rejectIdleWaiters(new HarnessSessionClosedError(this.id));
  }

  /** @internal — used by Harness hard-delete after storage has removed the row. */
  _markDeleted(): void {
    const err = new HarnessSessionDeletedError(this.id, this._record.resourceId, this._record.threadId);
    this._leaseExtensionDeadline = undefined;
    this._clearPendingInteractionExpiryTimer();
    this._state = 'deleted';
    this._openRuns.clear();
    this._runToolReceipts.clear();
    this._finalizedRunIds.clear();
    this._pendingReplacementToolSurfaces.clear();
    this._rejectIdleWaiters(err);
    this._rejectActiveTurnWaiters(err);
    const activeTurn = this._currentTurnAbortController;
    if (activeTurn) {
      // §6.2: hard-delete is a terminal teardown — the record is gone, so tools
      // should run rollback/cleanup (`session_closed`), not the record-survives
      // `process_restart` semantics. The operation rejection above already carries
      // the precise HarnessSessionDeletedError.
      activeTurn.abort(new HarnessAbortedError(this.id, 'session_closed'));
      this._endTurn(activeTurn);
    }
    if (this._queuedResumeRecoveryTimer !== undefined) {
      clearTimeout(this._queuedResumeRecoveryTimer);
      this._queuedResumeRecoveryTimer = undefined;
    }
    this._clearQueueWakeTimer();
    this._clearDelegationReconcileTimers();
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    for (const [queuedItemId, resolver] of this._queueResolvers) {
      this._queueResolvers.delete(queuedItemId);
      resolver.reject(err);
    }
    this._tearDownThreadSubscription(err);
  }

  /** @internal — signal identities that may have written operation evidence for this live session. */
  _deletedOperationEvidenceSignalIds(): string[] {
    return Array.from(this._operationEvidenceSignalIds);
  }

  /** @internal — harness bridge subscription that remains valid while closing. */
  _subscribeInternal(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this._emitter.subscribe(listener);
  }

  /**
   * @internal — used by the Harness when an idle/pressure eviction drops the
   * instance from the live map (§5.4). The record stays active in storage;
   * the session can be re-hydrated. Currently unused; lands with eviction.
   */
  _markEvicted(updatedRecord: SessionRecord): void {
    const err = new HarnessValidationError('session.evict()', 'Session evicted');
    this._leaseExtensionDeadline = undefined;
    this._clearPendingInteractionExpiryTimer();
    this._record = updatedRecord;
    this._state = 'evicted';
    this._openRuns.clear();
    this._runToolReceipts.clear();
    this._finalizedRunIds.clear();
    this._pendingReplacementToolSurfaces.clear();
    this._tearDownThreadSubscription(err);
    this._rejectIdleWaiters(new HarnessSessionClosedError(this.id));
    this._rejectActiveTurnWaiters(err);
    const activeTurn = this._currentTurnAbortController;
    if (activeTurn) {
      // §6.2: eviction releases live process ownership without a durable close —
      // tools see `process_restart` so they do best-effort cleanup, not rollback.
      activeTurn.abort(new HarnessAbortedError(this.id, 'process_restart'));
      this._endTurn(activeTurn);
    }
    if (this._queuedResumeRecoveryTimer !== undefined) {
      clearTimeout(this._queuedResumeRecoveryTimer);
      this._queuedResumeRecoveryTimer = undefined;
    }
    this._clearQueueWakeTimer();
    this._clearDelegationReconcileTimers();
    this._currentQueuedItemId = undefined;
    this._currentQueuedItemSource = undefined;
    for (const [queuedItemId, resolver] of this._queueResolvers) {
      this._queueResolvers.delete(queuedItemId);
      resolver.reject(err);
    }
  }

  /** @internal — update local lease metadata after the owning Harness renews storage. */
  _markLeaseRenewed(expiresAt: number): void {
    if (this._state !== 'live' && this._state !== 'closing') return;
    // Advance-only (§5.8): a subtree renewal marks the root AND every live
    // descendant from the root's renewal chain, which can interleave with a
    // descendant's own `_flushUpdate`. Never regress the in-memory expiry below
    // a value already observed, so a racing flush carrying an older snapshot
    // can't shorten a freshly renewed lease. Storage remains authoritative via
    // `renewSessionLeaseSubtree`.
    const current = this._record.leaseExpiresAt;
    if (current !== undefined && current >= expiresAt) return;
    this._record = { ...this._record, leaseExpiresAt: expiresAt };
  }

  /**
   * Reject every outstanding `waitForIdle()` waiter with `reason`. Drains
   * `_idleWaiters` via each waiter's own `cleanup` so subscribers and
   * timers are properly disposed. Idempotent.
   */
  private _rejectIdleWaiters(reason: unknown): void {
    if (this._idleWaiters.size === 0) return;
    const waiters = Array.from(this._idleWaiters);
    this._idleWaiters.clear();
    for (const w of waiters) {
      w.cleanup();
      w.reject(reason);
    }
  }

  /**
   * Synchronous teardown for the thread subscription on close/evict/delete.
   * Unsubscribes, marks the subscription closed, and rejects every outstanding entry in
   * `_runCompletionPromises` so awaiters don't hang on a dead subscription.
   * The drain loop's `for-await` exits naturally once `unsubscribe()` wakes it.
   */
  private _tearDownThreadSubscription(reason: unknown): void {
    if (this._threadSubscriptionClosed) return;
    this._threadSubscriptionClosed = true;
    try {
      this._threadSubscription?.unsubscribe();
    } catch {
      // Best-effort — subscription may already be done.
    }
    this._rejectNonTerminalRunCompletions(reason);
  }

  // -------------------------------------------------------------------------
  // Plan tasks (HARNESS_V1_SPEC.md §5.1k / §6.4 — TM-3/TM-4).
  //
  // The model mutates its plan tree exclusively through the built-in plan-task
  // tools (`task_add` / `task_decompose` / `task_reparent` / `task_update` /
  // `task_complete` / `plan_task_check`), which call these
  // methods. The session is the single serialized writer: every mutator fences
  // on this owner + the current SessionRecord.version (§5.8), runs the TM-4
  // hierarchy semantics, commits transaction-shaped via
  // `mutatePlanTasksForSession`, and emits `papersflow.plan_task.updated`.
  // -------------------------------------------------------------------------

  /** Build the small port the plan-task operations need. */
  private _planTaskPort(): PlanTaskSessionPort {
    const session = this;
    return {
      id: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      harnessName: this._record.harnessName,
      storage: this._storage,
      ownerId: this._ownerId,
      get sessionVersion() {
        return session._record.version;
      },
      emitPlanTaskEvent: payload => session._emitPlanTaskEvent(payload),
      setPlanTaskSummary: summary => {
        session._planTaskSummary = summary;
        session._planTaskSummarySeeded = true;
      },
    };
  }

  /**
   * §5.1k / TM-5 — lazily seed the bounded plan-task summary ONCE for a hydrated
   * session that may carry pre-existing plan tasks but hasn't mutated yet, so the
   * first `getDisplayState()` after hydration eventually reflects the tree.
   *
   * The counts (`total`/`byStatus`/`rootCount`) come from a cheap EXACT aggregate
   * (`countPlanTasksByStatus` — a `COUNT(*) GROUP BY status`, never a row load) so
   * they are correct no matter how large the tree is; a bounded single-page read
   * would silently undercount a tree larger than the page. `inProgressTaskIds`
   * is naturally bounded (one explicit per root by §5.1k) and read via a small
   * status-filtered subtree slice, capped defensively.
   *
   * Idempotent and fire-and-forget — any mutation recomputes the authoritative
   * summary from the post-image for free. Best-effort: a failed read leaves the
   * summary unseeded for a later retry. When the seed completes and nothing else
   * populated the summary first, it nudges any display subscriber so the absent
   * `planTasks` field becomes observable without waiting for an unrelated event.
   */
  private _maybeSeedPlanTaskSummary(): void {
    void this._ensurePlanTaskSummary().catch(() => {});
  }

  /**
   * Load the bounded authoritative summary once per in-memory Session. Plan
   * mutations replace `_planTaskSummary` from their committed post-image, so
   * subsequent turns add no storage round-trip. A concurrent mutation wins over
   * a stale seed response; concurrent display/turn callers share this promise.
   */
  private _ensurePlanTaskSummary(): Promise<PlanTaskSummary | undefined> {
    if (this._planTaskSummary !== undefined) return Promise.resolve(this._planTaskSummary);
    if (this._planTaskSummarySeedPromise !== undefined) return this._planTaskSummarySeedPromise;

    this._planTaskSummarySeeded = true;
    const seed = Promise.all([
      this._storage.countPlanTasksByStatus({ harnessName: this._record.harnessName, sessionId: this.id }),
      // Bounded: in_progress is at most the plan-node cap; never load task bodies.
      this._storage.loadPlanTaskSubtree({
        harnessName: this._record.harnessName,
        sessionId: this.id,
        status: 'in_progress',
        limit: PLAN_TASK_SUMMARY_IN_PROGRESS_CAP,
      }),
    ])
      .then(([counts, inProgress]) => {
        // A concurrent mutation may have populated the authoritative post-image
        // first. Never overwrite it with an older aggregate/read pair.
        if (this._planTaskSummary !== undefined) return this._planTaskSummary;
        this._planTaskSummary = {
          total: counts.total,
          byStatus: counts.byStatus,
          rootCount: counts.rootCount,
          inProgressTaskIds: inProgress.tasks.map(t => t.taskId),
        };
        // Make the freshly-seeded summary observable without a persisted event.
        this._notifyDisplayRefresh();
        return this._planTaskSummary;
      })
      .catch(error => {
        // Display seeding remains best-effort because its caller observes this
        // promise with a catch. Turn instruction assembly, however, awaits the
        // same promise and fails closed: running without authoritative durable
        // plan state can make the model repeat or skip work after a restart.
        this._planTaskSummarySeeded = false;
        throw error;
      })
      .finally(() => {
        if (this._planTaskSummarySeedPromise === seed) this._planTaskSummarySeedPromise = undefined;
      });
    this._planTaskSummarySeedPromise = seed;
    return seed;
  }

  /**
   * Framework-owned, content-free plan orientation appended to every owned turn.
   * The summary contains only fixed status labels, counts, and generated task ids;
   * user task bodies/results remain behind the bounded `plan_task_check` tool.
   * This keeps the durable tracker authoritative even after memory compression or
   * a process restart, while adding storage I/O only for the first turn on a
   * freshly hydrated Session.
   */
  private async _turnInstructions(modeInstructions?: string): Promise<string | undefined> {
    const summary = await this._ensurePlanTaskSummary();
    const parts: string[] = [];
    if (modeInstructions) parts.push(modeInstructions);
    if (summary !== undefined && summary.total > 0) {
      const statuses = Object.entries(summary.byStatus)
        .filter((entry): entry is [HarnessPlanTaskStatus, number] => typeof entry[1] === 'number' && entry[1] > 0)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([status, count]) => `${status}=${count}`)
        .join(', ');
      const activeIds = summary.inProgressTaskIds.length > 0 ? summary.inProgressTaskIds.join(',') : 'none';
      parts.push(
        [
          '<harness_durable_plan_state>',
          `total=${summary.total}; roots=${summary.rootCount}; statuses=${statuses || 'none'}; in_progress_ids=${activeIds}`,
          'The durable plan tracker is authoritative across turns and restarts. Before planning, declaring completion, or answering from delegated work, call plan_task_check to inspect the relevant bounded slice. Completed delegated tasks can contain delegation.result; synthesize that result instead of assuming completion from status alone.',
          '</harness_durable_plan_state>',
        ].join('\n'),
      );
    }
    if (this._record.origin === 'subagent-tool') {
      parts.push(
        [
          '<harness_subagent_outcome_contract>',
          `Before ending this assignment, call ${HARNESS_SUBAGENT_OUTCOME_REPORT_TOOL_ID} exactly once and by itself as the final action.`,
          'A normal text response or provider stop does not prove that the assigned task completed.',
          'Use completed only when the work is actually complete with concrete evidence; use blocked for unavailable external services, missing required input, or unmet dependencies; use failed for an unrecoverable work failure.',
          'Never claim a source repair when only a compiler/service failure was observed.',
          '</harness_subagent_outcome_contract>',
        ].join('\n'),
      );
    }
    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }

  /**
   * Emit the framework-owned `papersflow.plan_task.updated` custom event
   * (§10.3). Unlike tool-authored `ctx.emitCustomEvent`, delegation settlement
   * legitimately occurs between parent turns or during restart reconciliation;
   * it must still be persisted so reconnecting projections cannot remain stuck
   * on an in-progress task forever.
   */
  private _emitPlanTaskEvent(payload: JsonValue): void {
    assertCustomEventType(PLAN_TASK_UPDATED_EVENT);
    assertJsonSerializable(PLAN_TASK_UPDATED_EVENT, this.id, payload);
    this._emit({
      type: PLAN_TASK_UPDATED_EVENT,
      resourceId: this.resourceId,
      threadId: this.threadId,
      payload,
      ...(this._currentRunId !== undefined ? { runId: this._currentRunId } : {}),
    });
  }

  /**
   * Clear the complete durable plan for a discarded conversation branch and
   * cancel every child session that was executing work from that plan. The
   * parent session remains live/reusable so the replacement edit/regeneration
   * can start from the retained MessageHistory prefix.
   */
  async resetPlanTasks(opts?: {
    reason?: string;
  }): Promise<ResetPlanTasksResult & { cancelledSubagentSessionIds: string[] }> {
    this._assertLive('resetPlanTasks()');
    const releaseInvalidation = this._beginActiveWorkInvalidation();
    try {
      return await this._serializePlanTaskWrite(async () => {
        const activeIds = Array.from(this._activeSubagents.values(), state => state.subagentSessionId);
        const delegatedIds = await this._listDelegatedSubagentSessionIds();
        const cancellation = await this._cancelOwnedSubagentSessions(
          [...activeIds, ...delegatedIds],
          opts?.reason ?? 'conversation_revision',
        );
        if (cancellation.unavailable.length > 0) {
          // Keep the durable links intact so the operation remains retryable. If
          // we deleted first, a child locked by another instance could continue
          // working while the only durable ownership edge had already vanished.
          throw new HarnessValidationError(
            'resetPlanTasks()',
            `could not cancel owned subagent sessions; plan was preserved for retry: ${cancellation.unavailable.join(', ')}`,
          );
        }
        const result = await planTaskReset(this._planTaskPort());
        // The reset helper updates the cached summary without a persisted event
        // when called between turns; wake display subscribers explicitly.
        this._notifyDisplayRefresh();
        return { ...result, cancelledSubagentSessionIds: cancellation.cancelled };
      });
    } finally {
      releaseInvalidation();
    }
  }

  /** @internal — `task_add`. Add one plan task. Serialized per session. */
  _planTaskAdd(input: AddTaskInput, callerSignal?: AbortSignal): Promise<PlanTaskView> {
    return this._admitPlanTaskMutation('task_add', callerSignal, () => planTaskAdd(this._planTaskPort(), input));
  }

  /** @internal — `task_decompose`. Add N children under a parent atomically. */
  _planTaskDecompose(
    parentTaskId: string,
    children: DecomposeChildInput[],
    callerSignal?: AbortSignal,
  ): Promise<PlanTaskView[]> {
    return this._admitPlanTaskMutation('task_decompose', callerSignal, () =>
      planTaskDecompose(this._planTaskPort(), parentTaskId, children),
    );
  }

  /** @internal — `task_reparent`. Move a subtree (cycle-checked). */
  _planTaskReparent(
    taskId: string,
    newParentTaskId: string | null,
    order?: number,
    callerSignal?: AbortSignal,
  ): Promise<void> {
    return this._admitPlanTaskMutation('task_reparent', callerSignal, () =>
      planTaskReparent(this._planTaskPort(), taskId, newParentTaskId, order),
    );
  }

  /** @internal — `task_update`. Patch status/content/priority/blockedBy. */
  _planTaskUpdate(taskId: string, patch: UpdateTaskInput, callerSignal?: AbortSignal): Promise<PlanTaskView> {
    return this._admitPlanTaskMutation('task_update', callerSignal, () =>
      planTaskUpdate(this._planTaskPort(), taskId, patch),
    );
  }

  /** @internal — `task_complete`. Mark completed; triggers rollup. */
  _planTaskComplete(taskId: string, callerSignal?: AbortSignal): Promise<PlanTaskView> {
    return this._admitPlanTaskMutation('task_complete', callerSignal, () =>
      planTaskComplete(this._planTaskPort(), taskId),
    );
  }

  /** @internal — `plan_task_check`. The bounded anti-forgetting read. */
  _planTaskCheck(input: CheckInput): Promise<{ tasks: PlanTaskView[]; truncated: boolean; nextCursor?: string }> {
    return planTaskCheck(this._planTaskPort(), input);
  }

  // -------------------------------------------------------------------------
  // TM-6 — durable subtask → subagent DELEGATION (§5.1k / §5.6 / §8).
  //
  // `task_delegate` hands a plan task (and, optionally, its subtree subset) to a
  // subagent SESSION whose completion the plan task tracks across turns and
  // restarts. Unlike `spawn_subagent` (a synchronous in-turn child the parent
  // awaits inline), delegation is DURABLE: the link is the persisted
  // `delegatedSubagentSessionId` on the plan task, the parent turn does NOT
  // block, and the rollup fires from a completion HOOK on the child's terminal
  // outcome — re-established by reconcile-on-rehydrate after a restart.
  // -------------------------------------------------------------------------

  /**
   * @internal — `task_delegate`. Spawn/create a subagent SESSION for `taskId`,
   * durably link it (`delegatedSubagentSessionId`), drive the task `in_progress`,
   * and arm the live completion hook. Returns the view + the created subagent
   * session id. Throws `HarnessValidationError`,
   * `HarnessSubagentDepthExceededError`, or
   * `HarnessSubagentConcurrencyLimitError` BEFORE any plan-task or session
   * mutation so a rejected delegation is a no-op.
   */
  async _planTaskDelegate(
    input: {
      taskId: string;
      agentType: string;
      task?: string;
      includeSubtree?: boolean;
      modelOverride?: string;
    },
    callerSignal?: AbortSignal,
    parentToolCallId?: string,
    parentRunId?: string,
    callerRequestContext?: RequestContext,
  ): Promise<PlanTaskView & { subagentSessionId: string }> {
    this._assertLive('task_delegate');
    const admissionEpoch = this._captureActiveWorkAdmission('task_delegate');
    this._assertActiveWorkAdmission(admissionEpoch, 'task_delegate', callerSignal);
    const def = this._harness._getSubagentType(input.agentType);
    if (!def) {
      throw new HarnessValidationError('agentType', `unknown subagent type "${input.agentType}"`);
    }
    if (input.modelOverride !== undefined && typeof input.modelOverride !== 'string') {
      throw new HarnessValidationError('modelOverride', 'must be a string when provided');
    }
    const delegatedRequestContext = projectInheritedRequestContextApp(
      callerRequestContext,
      this._harness._getSubagentInheritedRequestContextAppKeys(),
    );

    // §8 depth cap — fail closed BEFORE creating any child record (mirrors the
    // spawn tool's pre-creation gate).
    const childDepth = this.subagentDepth + 1;
    const maxDepth = this._harness._getSubagentMaxDepth();
    if (childDepth > maxDepth) {
      throw new HarnessSubagentDepthExceededError(maxDepth, childDepth);
    }

    // Reject unknown, already-running, or dependency-blocked tasks before
    // reserving capacity or creating a durable child. The fenced link commit
    // repeats the same eligibility checks after child creation.
    const scopeSnapshot = await this._serializePlanTaskWrite(() =>
      capturePlanTaskDelegationScope(this._planTaskPort(), input.taskId, input.includeSubtree === true),
    );
    this._assertActiveWorkAdmission(admissionEpoch, 'task_delegate', callerSignal);
    let taskBody = input.task ?? scopeSnapshot.view.content;
    if (input.includeSubtree) {
      // Surface the delegated subtree SUBSET so the subagent sees the unit it
      // owns. This is a LOSSLESS transfer: every node keeps its stable taskId,
      // parent edge, status, sibling order, and blockedBy ids, rendered by true
      // depth (computed from the parent chain, not a flat one-level indent). A
      // clipped subtree appends an explicit truncation marker so the subagent
      // knows the unit it received is incomplete.
      taskBody = `${taskBody}\n\n${this._renderDelegatedSubtree(input.taskId, scopeSnapshot.tasks, false)}`;
    }
    this._assertActiveWorkAdmission(admissionEpoch, 'task_delegate', callerSignal);

    // Durable delegation and inline spawn share the same parent-local
    // backpressure reservation. Claim it before child creation/linking so the
    // detached API cannot bypass `subagents.maxConcurrent`.
    const reservation = this._internalTryReserveSubagentExecution();
    if (!reservation.reserved) {
      throw new HarnessSubagentConcurrencyLimitError(reservation.maxConcurrent, reservation.inFlight);
    }

    // Allocate the child identity and commit the durable plan ownership edge
    // BEFORE creating the child row. A crash in this order leaves a link to a
    // missing child, which recovery deterministically fails closed. The former
    // create-then-link order could leave an unreferenced active descendant whose
    // old-owner lease later poisoned root subtree renewal.
    const childSessionId = `sess-${randomUUID()}`;
    // Claim before the link write awaits storage. A reconciliation wakeup that
    // observes the committed link before child allocation must not classify the
    // intentionally-not-yet-created child as missing.
    this._delegationDriverClaims.add(childSessionId);
    const delegationStartedAt = Date.now();
    const delegationDeadlineAt = delegationStartedAt + this._harness._getSubagentDelegationTimeoutMs();
    let view: PlanTaskView;
    try {
      view = await this._serializePlanTaskWrite(() =>
        planTaskDelegate(this._planTaskPort(), {
          taskId: input.taskId,
          subagentSessionId: childSessionId,
          subagentTypeId: input.agentType,
          includeSubtree: input.includeSubtree === true,
          taskBody,
          startedAt: delegationStartedAt,
          deadlineAt: delegationDeadlineAt,
          expectedScopeFingerprint: scopeSnapshot.fingerprint,
          ...(parentToolCallId !== undefined ? { parentToolCallId } : {}),
          ...(parentRunId !== undefined ? { parentRunId } : {}),
          ...(delegatedRequestContext !== undefined ? { requestContextApp: delegatedRequestContext.app } : {}),
        }),
      );
      this._assertActiveWorkAdmission(admissionEpoch, 'task_delegate', callerSignal);
    } catch (error) {
      // No child exists yet. If the link committed before active-work
      // invalidation won, clear it to a durable failed terminal state.
      await this._reconcileDelegatedTask(input.taskId, childSessionId, 'failed');
      this._delegationDriverClaims.delete(childSessionId);
      this._internalReleaseSubagentExecution();
      throw error;
    }

    // Create the durable subagent SESSION (reuse the subagent-tool creation path:
    // origin 'subagent-tool' + parentSessionId so cascade/depth/lease-sharing all
    // apply per §5.6). It is NOT auto-closed at delegate time — its lifecycle is
    // tracked by the plan task across turns.
    let child: Session;
    try {
      child = await this._harness.session({
        sessionId: childSessionId,
        resourceId: this.resourceId,
        threadId: { fresh: true },
        parentSessionId: this.id,
        origin: 'subagent-tool',
        // §9 — an unset `def.modeId` inherits the PARENT's current mode (as
        // documented), not the harness default mode.
        modeId: def.modeId ?? this._record.modeId,
        modelId: input.modelOverride ?? def.defaultModelId,
        subagentDepth: childDepth,
        // M4 — persist the type so the durable delegated child's per-subagent
        // overrides (tools / workspace / toolAllowlist) survive a direct-by-id
        // hydrate, not only this parent's delegation-reattach.
        subagentTypeId: input.agentType,
      });
    } catch (error) {
      await this._reconcileDelegatedTask(input.taskId, childSessionId, 'failed');
      this._delegationDriverClaims.delete(childSessionId);
      this._internalReleaseSubagentExecution();
      throw error;
    }
    const subagentWorkspaceMode = def.workspace ?? 'inherit';
    child._subagentInheritWorkspace = subagentWorkspaceMode === 'inherit';
    if (def.tools) child._subagentToolsOverride = def.tools;
    if (def.toolAllowlist) child._subagentToolAllowlist = def.toolAllowlist;
    const delegationParentToolCallId = view.delegation?.parentToolCallId ?? `delegate:${input.taskId}`;
    child._subagentParentToolCallId = delegationParentToolCallId;

    // Stop/revision may have won while child creation was awaiting storage.
    // The unlinked child has done no provider work, so close it and fail the
    // stale tool call before it can create an ownership edge.
    try {
      this._assertActiveWorkAdmission(admissionEpoch, 'task_delegate', callerSignal);
    } catch (error) {
      // The plan ownership edge was committed before child allocation. Close
      // the child before clearing that edge: if close fails, retaining the link
      // keeps the active descendant discoverable and retryable by recovery.
      let childClosed = false;
      try {
        await child.close();
        childClosed = true;
      } catch {
        this._scheduleDelegationReconcileRetry(0);
      }
      if (childClosed) await this._reconcileDelegatedTask(input.taskId, child.id, 'failed');
      this._delegationDriverClaims.delete(childSessionId);
      this._internalReleaseSubagentExecution();
      throw error;
    }

    // A Stop can begin while the fenced link transaction is in flight. It may
    // have completed discovery before this new link became visible, so the
    // delegate itself must settle the now-stale attempt and never start it.
    try {
      this._assertActiveWorkAdmission(admissionEpoch, 'task_delegate', callerSignal);
      const linkStillCurrent = await this._delegationLinkIsCurrent(input.taskId, child.id);
      this._assertActiveWorkAdmission(admissionEpoch, 'task_delegate', callerSignal);
      if (!linkStillCurrent) {
        throw new HarnessValidationError(
          'taskId',
          `delegation ownership for task "${input.taskId}" changed during child allocation`,
        );
      }
    } catch (error) {
      try {
        await child._cancelInternal({ reason: 'parent_work_aborted', requestedBy: this.id }, this.id);
      } catch {
        // The exact task link below still fails closed even if child cleanup
        // races another owner; reconciliation remains retryable from storage.
      }
      let childClosed = false;
      try {
        await child.close();
        childClosed = true;
      } catch {
        this._scheduleDelegationReconcileRetry(0);
      }
      if (childClosed) await this._reconcileDelegatedTask(input.taskId, child.id, 'failed');
      this._delegationDriverClaims.delete(childSessionId);
      this._internalReleaseSubagentExecution();
      throw error;
    }

    // Track for display (mirrors the spawn tool) keyed by the subagent id so a
    // delegated subagent renders while it runs.
    this._activeSubagents.set(`delegate:${child.id}`, {
      subagentSessionId: child.id,
      agentType: input.agentType,
      task: taskBody,
      parentToolCallId: delegationParentToolCallId,
      startedAt: delegationStartedAt,
      status: 'running',
    });

    // Arm the live completion hook. Delegation uses an admitted SIGNAL instead
    // of `message()`: signal evidence remains `pending` while the child is
    // suspended, carries the pending interaction's `originSignalId`, and settles
    // only after a later resume terminalizes. That gives detached HITL a durable
    // join handle across reconnects/restarts rather than falsely completing and
    // closing the child at the first `finishReason: suspended` segment.
    void this._driveDelegatedSubagent(
      input.taskId,
      child,
      taskBody,
      input.agentType,
      child._record.modelId,
      delegationStartedAt,
      delegationDeadlineAt,
      delegationParentToolCallId,
      delegatedRequestContext?.app,
    );

    return { ...view, subagentSessionId: child.id };
  }

  /**
   * @internal — render a delegated subtree subset as a LOSSLESS structured block
   * for the subagent. Each node keeps its stable `taskId`, parent edge, status,
   * sibling order, and `blockedBy` ids, indented by its TRUE depth (computed from
   * the in-subset parent chain). Nodes are ordered as a stable pre-order
   * traversal (siblings by `order`, then `taskId`) so the same subtree always
   * renders identically. A clipped subtree (the storage `truncated` flag, or a
   * node whose parent fell outside the returned page) appends an explicit
   * truncation marker so the subagent knows its unit is incomplete.
   */
  private _renderDelegatedSubtree(rootTaskId: string, tasks: HarnessPlanTask[], storageTruncated: boolean): string {
    const byId = new Map(tasks.map(t => [t.taskId, t]));
    const childrenOf = new Map<string | undefined, HarnessPlanTask[]>();
    let parentDropped = false;
    for (const t of tasks) {
      // A node whose parent is not in the returned page (other than the root,
      // whose parent is intentionally outside the subset) means the subtree was
      // clipped above this node — flag it as truncated.
      const parentKey =
        t.taskId === rootTaskId
          ? undefined
          : t.parentTaskId !== undefined && byId.has(t.parentTaskId)
            ? t.parentTaskId
            : undefined;
      if (t.taskId !== rootTaskId && (t.parentTaskId === undefined || !byId.has(t.parentTaskId))) {
        parentDropped = true;
      }
      const bucket = childrenOf.get(parentKey);
      if (bucket) bucket.push(t);
      else childrenOf.set(parentKey, [t]);
    }
    for (const bucket of childrenOf.values()) {
      bucket.sort((a, b) =>
        a.order !== b.order ? a.order - b.order : a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0,
      );
    }
    const lines: string[] = [];
    const walk = (node: HarnessPlanTask, depth: number): void => {
      const indent = '  '.repeat(depth);
      const fields = [`id=${node.taskId}`, `status=${node.status}`, `order=${node.order}`];
      if (node.blockedBy !== undefined && node.blockedBy.length > 0) {
        fields.push(`blockedBy=${node.blockedBy.join(',')}`);
      }
      lines.push(`${indent}- [${fields.join(' ')}] ${node.content}`);
      for (const child of childrenOf.get(node.taskId) ?? []) walk(child, depth + 1);
    };
    const root = byId.get(rootTaskId);
    if (root) walk(root, 0);
    let block = `Delegated subtree (lossless — taskId/status/order/blockedBy preserved):\n${lines.join('\n')}`;
    if (storageTruncated || parentDropped) {
      block += `\n(TRUNCATED: the subtree was clipped at ${DELEGATED_SUBTREE_MAX_NODES} nodes; some descendants are not shown.)`;
    }
    return block;
  }

  /**
   * @internal — deterministic `admissionId` for a delegated subagent signal.
   * Stable across restarts so re-issuing it re-attaches to the original durable
   * signal result (including a suspended run) instead of dispatching duplicate
   * specialist work.
   */
  private _delegationAdmissionId(taskId: string): string {
    return `harness-delegate:${this.id}:${taskId}`;
  }

  /**
   * @internal — detached driver for a delegated subagent signal. The admitted
   * signal's result promise remains pending across HITL suspension and resolves
   * only after a terminal resume. On terminal settlement this reconciles the
   * plan task, closes the child, and releases the shared parent reservation.
   */
  private async _driveDelegatedSubagent(
    taskId: string,
    child: Session,
    taskBody: string,
    agentType: string,
    modelId: string,
    startedAt: number,
    deadlineAt: number,
    parentToolCallId: string,
    requestContextApp?: Record<string, JsonValue>,
  ): Promise<void> {
    let outcome: DelegatedSubagentOutcome = 'failed';
    let rawResult: unknown;
    let publicError: { code: string; message: string } | undefined;
    // §SA2 — fold the detached child's live progress into the parent's display
    // projection (the delegate path has no event bridge of its own, unlike the
    // spawn tool). Unsubscribed in the finally below.
    const progressKey = `delegate:${child.id}`;
    const childDepth = child.subagentDepth;
    const innerToolNames = new Map<string, string>();
    child._subagentParentToolCallId = parentToolCallId;
    const unsubProgress = child.subscribe(event => {
      this._internalUpdateSubagentProgress(progressKey, event);
      switch (event.type) {
        case 'text_delta':
          if (event.delta.length > 0) {
            this._emitSubagentEvent({
              type: 'subagent_text_delta',
              toolCallId: parentToolCallId,
              subagentSessionId: child.id,
              agentType,
              delta: event.delta,
              depth: childDepth,
            });
          }
          break;
        case 'reasoning_delta':
          if (event.delta.length > 0) {
            this._emitSubagentEvent({
              type: 'subagent_reasoning_delta',
              toolCallId: parentToolCallId,
              subagentSessionId: child.id,
              agentType,
              delta: event.delta,
              depth: childDepth,
            });
          }
          break;
        case 'tool_start':
          innerToolNames.set(event.toolCallId, event.toolName);
          this._emitSubagentEvent({
            type: 'subagent_tool_start',
            toolCallId: parentToolCallId,
            subagentSessionId: child.id,
            agentType,
            innerToolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.input,
            depth: childDepth,
          });
          break;
        case 'tool_end': {
          const toolName = innerToolNames.get(event.toolCallId) ?? event.toolName;
          innerToolNames.delete(event.toolCallId);
          this._emitSubagentEvent({
            type: 'subagent_tool_end',
            toolCallId: parentToolCallId,
            subagentSessionId: child.id,
            agentType,
            innerToolCallId: event.toolCallId,
            toolName,
            output: event.output,
            isError: event.isError ?? false,
            ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
            depth: childDepth,
          });
          break;
        }
        case 'tool_approval_required':
        case 'tool_suspension_required':
        case 'question_pending':
        case 'plan_approval_required':
          this._emitDelegatedSubagentPendingEvent(event, {
            parentToolCallId,
            subagentSessionId: child.id,
          });
          break;
      }
    });
    this._emitSubagentEvent({
      type: 'subagent_start',
      toolCallId: parentToolCallId,
      subagentSessionId: child.id,
      agentType,
      task: taskBody,
      modelId,
      depth: childDepth,
    });
    try {
      // The deadline covers admission/dispatch as well as the eventual result.
      // Racing only the returned result leaves a storage/provider stall inside
      // signal() itself able to retain the parent reservation forever.
      const terminal = await waitForDelegationResult(
        child
          .signal({
            content: taskBody,
            admissionId: this._delegationAdmissionId(taskId),
            ...(requestContextApp !== undefined ? { requestContext: { app: requestContextApp } } : {}),
          })
          .then(dispatched => dispatched.result),
        deadlineAt,
      );
      if (terminal === DELEGATION_DEADLINE_REACHED) {
        // Commit cancellation before settlement so the child cannot continue
        // mutating tools after its parent task has released ownership.
        try {
          await child._cancelInternal({ reason: 'delegation_timeout', requestedBy: this.id }, this.id);
        } catch {
          // Child closure below remains the ownership prerequisite. A failed
          // cancel/close retains the durable link for restart reconciliation.
        }
        outcome = 'failed';
        publicError = {
          code: 'harness.delegation_timeout',
          message: `The delegated subagent did not complete before its durable deadline (${deadlineAt})`,
        };
      } else {
        rawResult = terminal;
        const finishReason = (rawResult as { finishReason?: string } | undefined)?.finishReason;
        const declaredReport = parseHarnessSubagentOutcomeReport(rawResult);
        const declaredTerminalText = parseHarnessTerminalToolResultText(
          (rawResult as { terminalToolResult?: unknown } | undefined)?.terminalToolResult,
        );
        const report = verifyHarnessSubagentTerminalCompletion(rawResult);
        // Provider finishReason is transport termination, not semantic task success.
        // A delegated task settles only from the exact framework-owned report
        // terminal envelope. Cancellation still overrides any concurrently
        // produced report; a terminal tool normally ends the provider step as
        // `tool-calls`, so requiring `stop` would reject every real first-call
        // terminal delivery.
        outcome = child._record.cancelRequest === undefined && report !== undefined ? report.outcome : 'failed';
        if (outcome !== 'completed') {
          publicError = {
            code:
              child._record.cancelRequest !== undefined
                ? 'harness.subagent_cancelled'
                : (report?.issue?.code ??
                  ((declaredReport !== undefined || declaredTerminalText !== undefined) && report === undefined
                    ? 'harness.subagent_evidence_unverified'
                    : report === undefined
                      ? 'harness.subagent_outcome_missing'
                      : 'harness.subagent_incomplete')),
            message:
              child._record.cancelRequest !== undefined
                ? 'The delegated subagent was cancelled before it completed'
                : (report?.issue?.message ??
                  (report === undefined
                    ? declaredReport !== undefined || declaredTerminalText !== undefined
                      ? 'The delegated subagent terminal completion did not match framework execution receipts'
                      : `The delegated subagent ended without ${HARNESS_SUBAGENT_OUTCOME_REPORT_TOOL_ID}`
                    : `The delegated subagent reported ${report.outcome} after provider finish reason "${finishReason ?? 'missing'}"`)),
          };
        }
      }
    } catch (error) {
      // Rejected signal/result, cancellation, expiry, or crash-orphan recovery.
      outcome = 'failed';
      publicError = projectHarnessPublicError(error);
    } finally {
      unsubProgress();
      this._activeSubagents.delete(`delegate:${child.id}`);
    }
    const summary = summarizeHarnessSubagentResult(rawResult, {
      isError: outcome !== 'completed',
      ...(publicError !== undefined ? { error: publicError } : {}),
    });
    try {
      // Close the terminal child BEFORE clearing its durable plan link. If the
      // process dies after close, recovery can still settle from signal evidence;
      // if close fails, retaining the link keeps ownership discoverable and
      // retryable instead of creating an unlinked active descendant.
      try {
        await child.close();
      } catch {
        this._scheduleDelegationReconcileRetry(0);
        return;
      }
      const reconciled = await this._reconcileDelegatedTask(taskId, child.id, outcome, summary);
      if (!reconciled) return;
      // A successful subagent_end is a durable settlement notification, not a
      // provider-stop notification. Emit only after child closure and the
      // fenced plan write both committed so reconnecting UI cannot show a
      // completed child while the authoritative task remains in_progress.
      this._emitSubagentEvent({
        type: 'subagent_end',
        toolCallId: parentToolCallId,
        subagentSessionId: child.id,
        agentType,
        output: summarizeHarnessSubagentEventResult(summary),
        isError: outcome !== 'completed',
        durationMs: Math.max(0, Date.now() - startedAt),
        depth: childDepth,
      });
    } finally {
      this._delegationDriverClaims.delete(child.id);
      this._internalReleaseSubagentExecution();
    }
  }

  /**
   * @internal — roll a delegated plan task up from its subagent session's
   * terminal `outcome`. Idempotent + fence-guarded; emits best-effort because the
   * subagent can terminalize outside any parent turn. Called by the live hook AND
   * reconcile-on-rehydrate.
   */
  async _reconcileDelegatedTask(
    taskId: string,
    subagentSessionId: string,
    outcome: DelegatedSubagentOutcome,
    result?: HarnessSubagentResultSummary,
  ): Promise<boolean> {
    if (this._state === 'closed') return false;
    try {
      const durableResult =
        result ??
        (outcome !== 'completed'
          ? {
              ...summarizeHarnessSubagentEventResult(
                summarizeHarnessSubagentResult(undefined, {
                  isError: true,
                  error: {
                    code: outcome === 'blocked' ? 'harness.delegation_blocked' : 'harness.delegation_failed',
                    message: `The delegated task ${outcome} without usable terminal result evidence`,
                  },
                }),
              ),
              outcome,
            }
          : undefined);
      const reconcileResult = await this._serializePlanTaskWrite(() =>
        planTaskReconcileDelegation(this._planTaskPort(), {
          taskId,
          subagentSessionId,
          outcome,
          ...(durableResult !== undefined ? { result: durableResult } : {}),
        }),
      );
      if (reconcileResult.reconciled) this._notifyDisplayRefresh();
      return reconcileResult.reconciled;
    } catch {
      // Keep a live recovery path even when no future parent message or hydrate
      // occurs. The durable child signal evidence is the authority; a bounded
      // scan retry re-reads the exact link and settles it idempotently.
      this._scheduleDelegationReconcileRetry(0);
      return false;
    }
  }

  /**
   * Make child closure the prerequisite for clearing its plan ownership edge.
   * Returns false on a transient/foreign-lease failure so the caller can retain
   * the link and retry; a closed child is already safe.
   */
  private async _closeDelegatedChildForSettlement(childRecord: SessionRecord): Promise<boolean> {
    if (childRecord.closedAt !== undefined) return true;
    try {
      const child = await this._harness.session({ sessionId: childRecord.id, resourceId: this.resourceId });
      await child.close();
      return true;
    } catch {
      return false;
    }
  }

  /** Cancel timed-out work before closing it and releasing its plan ownership edge. */
  private async _cancelAndCloseDelegatedChildForDeadline(childRecord: SessionRecord): Promise<boolean> {
    if (childRecord.closedAt !== undefined) return true;
    try {
      const child = await this._harness.session({ sessionId: childRecord.id, resourceId: this.resourceId });
      await child._cancelInternal({ reason: 'delegation_timeout', requestedBy: this.id }, this.id);
      await child.close();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @internal — read the durable terminal outcome of the delegated admitted
   * signal. Signal evidence deliberately remains `pending` across a suspension
   * and settles only after resume/expiry, so `undefined` means "still owned or
   * waiting for HITL", never a successful delegation. Evidence outlives a closed
   * child and therefore remains the recovery authority after a crash.
   */
  private async _loadDelegationOutcomeFromEvidence(
    childRecord: SessionRecord,
    taskId: string,
    deadlineAt: number,
  ): Promise<{ outcome: DelegatedSubagentOutcome; result: HarnessSubagentResultSummary } | undefined> {
    const admissionId = this._delegationAdmissionId(taskId);
    const digest = sha256CanonicalJson({
      kind: 'channel-signal-admission',
      harnessName: childRecord.harnessName,
      sessionId: childRecord.id,
      resourceId: childRecord.resourceId,
      threadId: childRecord.threadId,
      admissionId,
    });
    const signalId = `harness-channel-signal-${digest.slice(0, 32)}`;
    let evidence: AgentSignalResultEvidence | OperationAdmissionTombstone | null;
    try {
      evidence = await this._storage.loadMessageResultEvidence({
        harnessName: childRecord.harnessName,
        sessionId: childRecord.id,
        resourceId: childRecord.resourceId,
        threadId: childRecord.threadId,
        signalId,
      });
    } catch {
      return undefined;
    }
    if (!evidence || !('status' in evidence)) return undefined;
    if (evidence.status === 'completed' || evidence.status === 'failed') {
      const settledAt = evidence.updatedAt;
      if (!Number.isSafeInteger(settledAt) || settledAt > deadlineAt) {
        return { outcome: 'failed', result: summarizeDelegationDeadline(deadlineAt) };
      }
    }
    if (evidence.status === 'completed') {
      const rawResult = (evidence as { result?: unknown }).result;
      const finishReason = (rawResult as { finishReason?: unknown } | undefined)?.finishReason;
      const declaredReport = parseHarnessSubagentOutcomeReport(rawResult);
      const declaredTerminalText = parseHarnessTerminalToolResultText(
        (rawResult as { terminalToolResult?: unknown } | undefined)?.terminalToolResult,
      );
      const report = verifyHarnessSubagentTerminalCompletion(rawResult);
      const outcome: DelegatedSubagentOutcome = report !== undefined ? report.outcome : 'failed';
      const result = summarizeHarnessSubagentResult(rawResult, {
        isError: outcome !== 'completed',
        ...(outcome !== 'completed'
          ? {
              error: {
                code:
                  report?.issue?.code ??
                  ((declaredReport !== undefined || declaredTerminalText !== undefined) && report === undefined
                    ? 'harness.subagent_evidence_unverified'
                    : report === undefined
                      ? 'harness.subagent_outcome_missing'
                      : 'harness.subagent_incomplete'),
                message:
                  report?.issue?.message ??
                  (report === undefined
                    ? declaredReport !== undefined || declaredTerminalText !== undefined
                      ? 'The delegated subagent terminal completion did not match framework execution receipts'
                      : `The delegated subagent ended without ${HARNESS_SUBAGENT_OUTCOME_REPORT_TOOL_ID}`
                    : `The delegated subagent reported ${report.outcome} after provider finish reason "${String(finishReason ?? 'missing')}"`),
              },
            }
          : {}),
      });
      return { outcome, result };
    }
    if (evidence.status === 'failed') {
      return {
        outcome: 'failed',
        result: summarizeHarnessSubagentEventResult(
          summarizeHarnessSubagentResult(undefined, { isError: true, error: evidence.error }),
        ),
      };
    }
    return undefined; // 'pending' — no terminal outcome yet.
  }

  /**
   * @internal — recovery / reconcile-on-rehydrate (§5.6 TM-6). Scan this
   * session's plan tasks for a `delegatedSubagentSessionId` whose task is still
   * non-terminal and reconcile each against the delegated subagent session's
   * DURABLE state. The authority is the child's durable signal-result evidence
   * (persisted by the deterministic delegation `admissionId`), not a guess from
   * the session close marker:
   *   - durable terminal evidence (completed/failed) → roll the plan task up from
   *     it (a FAILED delegated run recovers as `failed`, not `completed`);
   *   - subagent session GONE/deleted → fail closed (`failed`);
   *   - subagent CLOSED with no terminal evidence → fail closed;
   *   - subagent still LIVE with pending evidence → re-attach by re-issuing the
   *     admitted signal. Dedup observes the original run or waits for its
   *     suspended resume; it never dispatches a second specialist turn.
   *
   * Resilient: a transient/CAS failure on a single task does not strand it — the
   * scan re-arms a capped-backoff retry so a stuck `in_progress` delegation is not left
   * with no path forward while the parent stays live.
   */
  async _reconcileDelegationsOnHydrate(attempt = 0): Promise<void> {
    const current = this._delegationReconcileInFlight;
    if (current !== undefined) {
      // Do not lose a timer/capacity-release wakeup merely because a slower scan
      // is still reading another delegated task. The owner of `current` loops
      // once more before releasing the singleflight.
      this._delegationReconcileRerunRequested = true;
      return current;
    }
    const run = (async () => {
      do {
        this._delegationReconcileRerunRequested = false;
        await this._reconcileDelegationsOnHydratePass(attempt);
      } while (this._state === 'live' && this._delegationReconcileRerunRequested);
    })();
    this._delegationReconcileInFlight = run;
    try {
      await run;
    } finally {
      if (this._delegationReconcileInFlight === run) this._delegationReconcileInFlight = undefined;
      // A request can land after the loop's final condition but before this
      // singleflight is cleared. Preserve that narrow wakeup with a fresh timer.
      if (this._state === 'live' && this._delegationReconcileRerunRequested) {
        this._delegationReconcileRerunRequested = false;
        this._scheduleDelegationReconcileRetry(0);
      }
    }
  }

  private async _reconcileDelegationsOnHydratePass(attempt: number): Promise<void> {
    if (this._state !== 'live') return;
    let admissionEpoch: number;
    try {
      admissionEpoch = this._captureActiveWorkAdmission('delegation reconciliation');
    } catch {
      // Stop/reset owns the branch. Its cancellation/reset pass will settle or
      // preserve every durable edge; recovery must not attach new work behind it.
      return;
    }
    let cursor: string | undefined;
    const delegated: HarnessPlanTask[] = [];
    try {
      for (;;) {
        const page = await this._storage.listPlanTasks({
          harnessName: this._record.harnessName,
          sessionId: this.id,
          limit: 500,
          cursor,
        });
        for (const t of page.tasks) {
          if (t.delegatedSubagentSessionId !== undefined && !TERMINAL_PLAN_TASK_STATUSES.has(t.status)) {
            delegated.push(t);
          }
        }
        if (!page.cursor || page.tasks.length === 0) break;
        cursor = page.cursor;
      }
    } catch {
      // Best-effort: the listing itself failed transiently — re-arm a
      // retry so a delegated task is not stranded by a flaky read.
      this._scheduleDelegationReconcileRetry(attempt);
      return;
    }

    let needsRetry = false;
    for (const task of delegated) {
      const childId = task.delegatedSubagentSessionId!;
      if (!this._activeWorkAdmissionIsCurrent(admissionEpoch)) return;
      // A live driver in this process already owns the exact delegation. This
      // also keeps an explicit/manual recovery kick from double-reserving it.
      if (this._delegationDriverClaims.has(childId) || this._activeSubagents.has(`delegate:${childId}`)) continue;
      let childRecord: SessionRecord | null;
      try {
        childRecord = await this._storage.loadSession({ harnessName: this._record.harnessName, sessionId: childId });
      } catch {
        // Transient storage error reading the child — retry the whole scan later
        // rather than silently leaving this task stuck `in_progress`.
        needsRetry = true;
        continue;
      }
      // Subagent session GONE/deleted → fail closed.
      if (!childRecord) {
        await this._reconcileDelegatedTask(task.taskId, childId, 'failed');
        continue;
      }
      const delegationAttempt = readDelegationAttemptMetadata(task, childId);
      // A CANCELLED subagent is a FAILED delegation regardless of how the run
      // finishReason landed — mirrors the live driver's `cancelRequest` override
      // (a run can race to `complete` after a cancel, but the delegation was
      // cancelled, so the plan task fails). Checked before the evidence so a
      // `completed` evidence row from that race cannot mask the cancel. Preserve
      // the framework-owned timeout reason across the crash window between the
      // durable cancellation CAS and task reconciliation; otherwise recovery
      // degrades a precise timeout into the generic delegation-failed result.
      if (childRecord.cancelRequest !== undefined) {
        if (!(await this._closeDelegatedChildForSettlement(childRecord))) {
          needsRetry = true;
          continue;
        }
        await this._reconcileDelegatedTask(
          task.taskId,
          childId,
          'failed',
          childRecord.cancelRequest.reason === 'delegation_timeout' && delegationAttempt !== undefined
            ? summarizeDelegationDeadline(delegationAttempt.deadlineAt)
            : undefined,
        );
        continue;
      }
      if (delegationAttempt === undefined) {
        if (!(await this._closeDelegatedChildForSettlement(childRecord))) {
          needsRetry = true;
          continue;
        }
        await this._reconcileDelegatedTask(task.taskId, childId, 'failed');
        continue;
      }
      // DURABLE terminal evidence is the authority — a delegated run that ERRORED
      // before closing recovers as `failed`, not `completed`. Its durable
      // settlement timestamp must also fall within the immutable attempt
      // deadline; a late provider result cannot retroactively win recovery.
      const durable = await this._loadDelegationOutcomeFromEvidence(
        childRecord,
        task.taskId,
        delegationAttempt.deadlineAt,
      );
      if (durable !== undefined) {
        if (!(await this._closeDelegatedChildForSettlement(childRecord))) {
          needsRetry = true;
          continue;
        }
        await this._reconcileDelegatedTask(task.taskId, childId, durable.outcome, durable.result);
        continue;
      }
      // A close marker cannot prove useful work completed. Without terminal
      // signal evidence, fail closed rather than fabricating success.
      if (childRecord.closedAt !== undefined) {
        await this._reconcileDelegatedTask(task.taskId, childId, 'failed');
        continue;
      }
      // The absolute timestamp was committed with the ownership edge. Recovery
      // must never grant a fresh duration after restart. Terminal evidence above
      // still wins when it already proves the child settled.
      if (Date.now() >= delegationAttempt.deadlineAt) {
        if (!(await this._cancelAndCloseDelegatedChildForDeadline(childRecord))) {
          needsRetry = true;
          continue;
        }
        await this._reconcileDelegatedTask(
          task.taskId,
          childId,
          'failed',
          summarizeDelegationDeadline(delegationAttempt.deadlineAt),
        );
        continue;
      }
      if (!this._activeWorkAdmissionIsCurrent(admissionEpoch)) return;
      // Reserve from the same pool as a newly delegated/inline child before
      // hydrating and attaching. A capacity miss is retried and is also kicked
      // immediately when any current child releases a slot.
      const reservation = this._internalTryReserveSubagentExecution();
      if (!reservation.reserved) {
        this._delegationReconcileCapacityBlocked = true;
        needsRetry = true;
        continue;
      }
      this._delegationDriverClaims.add(childId);

      // Subagent still active → re-attach by re-issuing the admitted signal with
      // the deterministic admission id. The durable dispatch fence observes the
      // original execution or waits through HITL; it does not enqueue a second.
      let child: Session | undefined;
      try {
        child = await this._harness.session({ sessionId: childId, resourceId: this.resourceId });
      } catch {
        this._delegationDriverClaims.delete(childId);
        this._internalReleaseSubagentExecution();
        // Could not re-acquire the child (locked elsewhere / transient) — retry
        // the scan later so the task is not stranded.
        needsRetry = true;
        continue;
      }
      // Hydrating the child crossed an async ownership boundary. Stop/reset may
      // have invalidated this recovery pass or removed/replaced the exact link;
      // re-read both authorities before starting the admitted signal driver.
      let linkStillCurrent = false;
      try {
        linkStillCurrent = await this._delegationLinkIsCurrent(task.taskId, childId);
      } catch {
        this._delegationDriverClaims.delete(childId);
        this._internalReleaseSubagentExecution();
        needsRetry = true;
        continue;
      }
      if (!this._activeWorkAdmissionIsCurrent(admissionEpoch) || !linkStillCurrent) {
        this._delegationDriverClaims.delete(childId);
        this._internalReleaseSubagentExecution();
        if (!this._activeWorkAdmissionIsCurrent(admissionEpoch)) return;
        continue;
      }
      // §9 — restore the SubagentDefinition overrides on the reattached child. The
      // `tools` / `workspace` overrides are applied in-memory at delegate time and
      // are not persisted on the child, so re-resolve them from the durable
      // subagent type id before re-driving (unknown/unset type ⇒ mode-derived
      // surface, the documented fallback).
      if (task.delegatedSubagentTypeId !== undefined) {
        const def = this._harness._getSubagentType(task.delegatedSubagentTypeId);
        if (def) {
          child._subagentInheritWorkspace = (def.workspace ?? 'inherit') === 'inherit';
          if (def.tools) child._subagentToolsOverride = def.tools;
          if (def.toolAllowlist) child._subagentToolAllowlist = def.toolAllowlist;
        }
      }
      const agentType = task.delegatedSubagentTypeId ?? childRecord.subagentTypeId ?? 'delegated';
      child._subagentParentToolCallId = delegationAttempt.parentToolCallId;
      this._activeSubagents.set(`delegate:${child.id}`, {
        subagentSessionId: child.id,
        agentType,
        task: delegationAttempt.taskBody,
        parentToolCallId: delegationAttempt.parentToolCallId,
        startedAt: delegationAttempt.startedAt,
        status: childRecord.pendingResume !== undefined ? 'awaiting_input' : 'running',
      });
      void this._driveDelegatedSubagent(
        task.taskId,
        child,
        delegationAttempt.taskBody,
        agentType,
        childRecord.modelId,
        delegationAttempt.startedAt,
        delegationAttempt.deadlineAt,
        delegationAttempt.parentToolCallId,
        delegationAttempt.requestContextApp,
      );
    }
    if (needsRetry) this._scheduleDelegationReconcileRetry(attempt);
  }

  /** Exact revision-fenced ownership check immediately before reattachment. */
  private async _delegationLinkIsCurrent(taskId: string, childId: string): Promise<boolean> {
    const snapshot = await this._storage.loadPlanTaskSubtree({
      harnessName: this._record.harnessName,
      sessionId: this.id,
      rootTaskId: taskId,
      limit: 1,
    });
    const current = snapshot.tasks.find(task => task.taskId === taskId);
    return current?.delegatedSubagentSessionId === childId && !TERMINAL_PLAN_TASK_STATUSES.has(current.status);
  }

  /**
   * @internal — persistent retry for reconcile-on-rehydrate. A transient/CAS/
   * locked failure re-arms the scan with capped exponential backoff for as long
   * as the parent remains live. This intentionally has no small attempt ceiling:
   * another process may legitimately hold a child lease longer than one retry
   * window. At most one timer is armed, preventing retry fan-out. A fresh
   * capacity release (`attempt === 0`) replaces a slower pending timer.
   */
  private _scheduleDelegationReconcileRetry(attempt: number): void {
    if (this._state !== 'live') return;
    if (this._delegationReconcileRetryTimers.size > 0) {
      if (attempt !== 0) return;
      for (const existing of this._delegationReconcileRetryTimers) clearTimeout(existing);
      this._delegationReconcileRetryTimers.clear();
    }
    const next = attempt + 1;
    const exponent = Math.min(Math.max(0, attempt), 16);
    const backoffMs = Math.min(DELEGATION_RECONCILE_RETRY_BASE_MS * 2 ** exponent, DELEGATION_RECONCILE_RETRY_MAX_MS);
    const timer = setTimeout(() => {
      this._delegationReconcileRetryTimers.delete(timer);
      if (this._state !== 'live') return;
      void this._reconcileDelegationsOnHydrate(next);
    }, backoffMs);
    if (typeof timer.unref === 'function') timer.unref();
    this._delegationReconcileRetryTimers.add(timer);
  }

  /** @internal — accessor for the Harness when it needs the owner id back. */
  get _internalOwnerId(): string {
    return this._ownerId;
  }

  /** @internal — accessor for the Harness when it needs the record version. */
  get _internalRecordVersion(): number {
    return this._record.version;
  }

  /** @internal — accessor for the Harness when it needs the storage handle. */
  get _internalStorage(): HarnessStorage {
    return this._storage;
  }
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function compactJsonObject<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function getOwnRecordValue<T>(record: Record<string, T> | undefined, key: string): T | undefined {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  return record[key];
}

function appendExpiredPendingInteraction(
  current: SessionRecord['expiredPendingInteractions'],
  receipt: NonNullable<SessionRecord['expiredPendingInteractions']>[string],
): NonNullable<SessionRecord['expiredPendingInteractions']> {
  const next = { ...(current ?? {}), [receipt.generationKey]: receipt };
  const retained = Object.values(next)
    .sort((a, b) => b.expiredAt - a.expiredAt || b.generationKey.localeCompare(a.generationKey))
    .slice(0, MAX_EXPIRED_PENDING_INTERACTIONS);
  return Object.fromEntries(retained.map(entry => [entry.generationKey, entry]));
}

function pendingInteractionGenerationKey(input: {
  kind: PendingResume['kind'];
  itemId: string;
  runId: string;
  toolCallId: string;
  requestedAt: number;
}): string {
  return sha256CanonicalJson([input.kind, input.itemId, input.runId, input.toolCallId, input.requestedAt]);
}

function publicErrorProjectionToError(error: { code: string; message: string }): Error {
  const projected = new Error(error.message);
  projected.name = error.code;
  (projected as Error & { code: string }).code = error.code;
  return projected;
}

function cloneAttachmentMetadata(metadata: Record<string, JsonValue>): Record<string, JsonValue> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, JsonValue>;
}

function clonePersistedAttachment(attachment: PersistedAttachment): PersistedAttachment {
  return JSON.parse(JSON.stringify(attachment)) as PersistedAttachment;
}

function clonePersistedRequestContext(input: PersistedRequestContextInput): PersistedRequestContextInput {
  return JSON.parse(JSON.stringify(input)) as PersistedRequestContextInput;
}

class QueueRecoveryPendingError extends HarnessError {
  readonly code = 'harness.queue_recovery_pending';
  readonly retryAt: number;

  constructor(retryAt: number) {
    super('queued turn was accepted by the signal runtime and is awaiting durable terminal result evidence');
    this.name = 'harness.queue_recovery_pending';
    this.retryAt = retryAt;
  }
}

class QueueRecoveryStaleError extends HarnessError {
  readonly code = 'harness.queue_recovery_stale';

  constructor() {
    super('queued turn was accepted by the signal runtime but no live run or durable terminal result is available');
    this.name = 'harness.queue_recovery_stale';
  }
}

class ResumeRecoveryStaleError extends HarnessError {
  readonly code = 'harness.resume_recovery_stale';

  constructor() {
    super('resume was admitted but no live owner or durable terminal result is available');
    this.name = 'harness.resume_recovery_stale';
  }
}

class QueuePostRunFinalizationPendingError extends HarnessError {
  readonly code = 'harness.queue_post_run_finalization_pending';
  readonly retryAt: number;
  readonly cause: unknown;

  constructor(retryAt: number, cause: unknown) {
    super('queued turn completed and is waiting for post-run finalization to persist');
    this.name = 'harness.queue_post_run_finalization_pending';
    this.retryAt = retryAt;
    this.cause = cause;
  }
}

function throwIfAborted(signal: AbortSignal | undefined, path: string): void {
  if (!signal?.aborted) return;
  throw signal.reason ?? new HarnessValidationError(path, 'operation aborted');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal, 'delay()');
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new HarnessValidationError('delay()', 'operation aborted'));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
