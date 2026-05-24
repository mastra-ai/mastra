/**
 * Harness v1 — canonical work-unit contracts.
 *
 * Defines the durable runtime semantics shared by every entrypoint
 * (user `session.message`, A2A `message/send`, channel ingress, CLI /
 * headless, server routes, subagents, system goal continuations). The
 * goal is one model — not five parallel ones — for what's being
 * attempted, how, and what proof we accumulate.
 *
 * Slice scope: type-only. The durable storage row (`TaskIndexEntry`
 * persistence) is materialized by the cancellation umbrella when it
 * lands; until then this file exists to stabilize the names and the
 * field-mapping table, so downstream consumers stop inventing
 * per-surface vocabulary.
 *
 * Companion primitives that already exist on this branch and are
 * referenced by the contracts below:
 *   - {@link HarnessArtifactRecord} (durable proof + lineage)
 *   - {@link PendingResume} (durable wait point — also re-exported
 *     here as `PendingInteraction` in a later slice)
 *   - {@link WorkspaceActionJournalEntry} (workspace evidence)
 *   - {@link InboxResponseReceipt} (approval evidence)
 *   - {@link OperationAdmissionEvidence} (admission evidence)
 */

import type {
  HarnessOperationAdmissionEvidence,
  InboxResponseReceipt,
  JsonValue,
  PendingResume,
  TokenUsage,
  WorkspaceActionJournalEntry,
} from '../../storage/domains/harness';

// ---------------------------------------------------------------------------
// Task — what is being attempted.
// ---------------------------------------------------------------------------

/**
 * Where a Task was admitted from. One Task has exactly one origin, set
 * at admission time and immutable afterwards.
 *
 *   - `'user'`    — local caller via `session.message` / `session.queue`
 *   - `'a2a'`     — remote agent over A2A `message/send`
 *   - `'channel'` — channel ingress (Slack DM, Discord thread, …)
 *   - `'cli'`     — Mastra CLI / headless invocation
 *   - `'server'`  — HTTP / server route
 *   - `'system'`  — harness-internal (goal continuation, retry)
 */
export type HarnessTaskOrigin = 'user' | 'a2a' | 'channel' | 'cli' | 'server' | 'system';

/**
 * Terminal status set for a Task. Tasks transition forward only —
 * `pending → running → (paused → running)* → {succeeded | failed |
 * cancelled}`. Once terminal, the row is immutable.
 */
export type HarnessTaskStatus = 'pending' | 'running' | 'paused' | 'cancelled' | 'succeeded' | 'failed';

/**
 * The canonical work-unit primitive. One Task may produce many
 * {@link HarnessRun}s (retries, resumes, continuations). The Task is
 * the cancellation, accounting, and identity unit; the Run is the
 * execution unit.
 *
 * `taskId` is opaque to consumers; harness internals compose it from
 * the field-mapping table in {@link TaskIdFieldMapping}. Until
 * persistence ships, callers reference Tasks by {@link TaskIndexEntry}.
 */
export interface HarnessTask {
  taskId: string;
  origin: HarnessTaskOrigin;
  sessionId: string;
  resourceId: string;
  threadId: string;
  /** Set when this task was admitted via the durable queue / signal path. */
  admissionId?: string;
  /** Opaque caller-supplied metadata. */
  metadata?: Record<string, JsonValue>;
  createdAt: number;
  status: HarnessTaskStatus;
}

// ---------------------------------------------------------------------------
// Run — one execution attempt for a Task.
// ---------------------------------------------------------------------------

/**
 * Why a Run stopped. Maps onto the existing
 * `agent_end.reason` discriminator on the event ledger so replay can
 * reconstruct a Run's terminal state without re-executing.
 *
 *   - `'complete'`        — finished without suspension
 *   - `'suspended'`       — paused on a {@link PendingResume}
 *   - `'error'`           — threw / rejected
 *   - `'aborted'`         — cancelled mid-flight (see cancellation tree)
 *   - `'budget_exhausted'`— token / cost / tool budget triggered
 */
export type HarnessRunFinishReason = 'complete' | 'suspended' | 'error' | 'aborted' | 'budget_exhausted';

/**
 * One execution attempt for a Task. Retries spawn a new Run with the
 * same `taskId`; resumes reattach to the existing Run. `runId`
 * matches the value carried on `SessionDisplayState.currentRunId` and
 * the `runId` field on every harness event emitted during the
 * attempt.
 */
export interface HarnessRun {
  runId: string;
  taskId: string;
  agentId: string;
  modeId: string;
  modelId?: string;
  startedAt: number;
  completedAt?: number;
  finishReason?: HarnessRunFinishReason;
  /** Cumulative token usage observed during this Run. */
  tokenUsage?: TokenUsage;
}

// ---------------------------------------------------------------------------
// TaskIndexEntry — durable mapping rows.
// ---------------------------------------------------------------------------

/**
 * The minimum information needed to locate a Task across surfaces:
 * given any of `(sessionId, runId, queuedItemId, a2aTaskId)`, recover
 * the canonical `taskId`. Persistence + lookup APIs are wired by the
 * cancellation umbrella; this slice ships the row shape only.
 */
export interface TaskIndexEntry {
  taskId: string;
  sessionId: string;
  runId?: string;
  queuedItemId?: string;
  a2aTaskId?: string;
}

// ---------------------------------------------------------------------------
// Field-mapping table — PF-631 deliverable §2.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Evidence — durable proof of admission, action, approval, completion.
// ---------------------------------------------------------------------------

/** Discriminator on {@link HarnessEvidence}. */
export type HarnessEvidenceKind = 'admission' | 'workspace-action' | 'inbox-receipt';

/**
 * Canonical public union over durable proof rows accumulated during
 * a Harness v1 session. Wraps the three existing source shapes —
 * {@link HarnessOperationAdmissionEvidence} (admission / result /
 * tombstone), {@link WorkspaceActionJournalEntry} (workspace audit),
 * and {@link InboxResponseReceipt} (approval / question /
 * sandbox-access decisions) — under a single tagged discriminator
 * so consumers narrow on `evidenceKind` instead of property
 * presence-checks.
 *
 * The wrapper is read-side only — existing storage rows are
 * unchanged. Adapters wrap when surfacing evidence to public
 * consumers; the underlying persisted shape stays as-is.
 */
export type HarnessEvidence =
  | { evidenceKind: 'admission'; admission: HarnessOperationAdmissionEvidence }
  | { evidenceKind: 'workspace-action'; entry: WorkspaceActionJournalEntry }
  | { evidenceKind: 'inbox-receipt'; receipt: InboxResponseReceipt };

// ---------------------------------------------------------------------------
// PendingInteraction — durable wait point (public alias).
// ---------------------------------------------------------------------------

/**
 * Canonical public alias for {@link PendingResume} — the durable
 * wait point a Harness v1 session pauses on. `PendingResume.kind`
 * carries the discriminator: `'tool-approval' | 'tool-suspension' |
 * 'question' | 'plan-approval' | 'sandbox-access'`. No fields rename
 * and no runtime change; this alias only surfaces the canonical name
 * to public consumers.
 *
 * Internal/storage callsites continue to use `PendingResume`. The
 * two names are structurally identical and freely interchangeable.
 */
export type PendingInteraction = PendingResume;

/**
 * Documentation-only type. Maps every pre-existing identifier in the
 * harness to the canonical primitive it belongs to.
 *
 * | Existing identifier             | Canonical primitive                                              |
 * | ------------------------------- | ---------------------------------------------------------------- |
 * | `sessionId`                     | {@link HarnessTask}.sessionId                                    |
 * | `threadId`                      | {@link HarnessTask}.threadId                                     |
 * | `resourceId`                    | {@link HarnessTask}.resourceId                                   |
 * | `runId`                         | {@link HarnessRun}.runId                                         |
 * | `admissionId` (queue / message) | {@link HarnessTask}.admissionId                                  |
 * | `signalId` (`session.signal`)   | Auxiliary id on signal admissions; carried alongside `admissionId` on `AgentSignalAccepted` — NOT folded into `HarnessTask.admissionId` |
 * | `queuedItemId`                  | {@link TaskIndexEntry}.queuedItemId                              |
 * | `WorkspaceActionJournalEntry.id`| Identifies one row in the workspace journal — surfaced via {@link HarnessEvidence} (`evidenceKind: 'workspace-action'`) |
 * | `subagentSessionId`             | {@link HarnessTask}.sessionId on the child Task                  |
 * | `goalId`                        | `metadata.goalId` on {@link HarnessTask}                         |
 * | `PendingResume.itemId`          | Surfaced publicly as {@link PendingInteraction}.itemId — the field name does not change between the internal and public names |
 * | A2A `task.id`                   | {@link TaskIndexEntry}.a2aTaskId → resolves to {@link HarnessTask}.taskId |
 * | A2A `task.contextId`            | {@link HarnessTask}.threadId                                     |
 */
export type TaskIdFieldMapping = never;
