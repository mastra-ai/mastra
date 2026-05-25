/**
 * Harness v1 — canonical work-unit contracts.
 *
 * Type-only public contracts shared by every Harness v1 entrypoint:
 * user calls, A2A, channel ingress, CLI/headless, server routes,
 * subagent tools, and system continuations. This file intentionally
 * does not add storage, routing, or runtime behavior; later Harness
 * slices can produce these shapes without inventing per-surface
 * vocabulary.
 */

import type {
  HarnessOperationAdmissionEvidence,
  InboxResponseReceipt,
  JsonValue,
  PendingResume,
  QueueAdmissionReceipt,
  TokenUsage,
  WorkspaceActionJournalEntry,
} from '../../storage/domains/harness/types';

// ---------------------------------------------------------------------------
// Task — what is being attempted.
// ---------------------------------------------------------------------------

/**
 * Where a task was admitted from. One task has exactly one origin,
 * set at admission time and immutable afterwards.
 */
export type HarnessTaskOrigin = 'user' | 'a2a' | 'channel' | 'cli' | 'server' | 'subagent-tool' | 'system';

/**
 * Lifecycle status set for a task. Tasks transition forward only:
 * `pending -> running -> (paused -> running)* -> terminal`.
 */
export type HarnessTaskStatus = 'pending' | 'running' | 'paused' | 'cancelled' | 'succeeded' | 'failed';

/**
 * The canonical work-unit primitive. One task may produce many runs
 * through retries, resumes, or continuations. The task is the future
 * cancellation, accounting, and identity unit; the run is one
 * execution attempt.
 */
export interface HarnessTask {
  taskId: string;
  origin: HarnessTaskOrigin;
  sessionId: string;
  resourceId: string;
  threadId: string;
  /** Set when this task was admitted through the durable queue or signal path. */
  admissionId?: string;
  /** Opaque caller-supplied metadata. */
  metadata?: Record<string, JsonValue>;
  createdAt: number;
  status: HarnessTaskStatus;
}

// ---------------------------------------------------------------------------
// Run — one execution attempt for a task.
// ---------------------------------------------------------------------------

/**
 * Why a run stopped. This is the public contract vocabulary for
 * terminal run state; runtime persistence is added by later slices.
 */
export type HarnessRunFinishReason = 'complete' | 'suspended' | 'error' | 'aborted' | 'budget_exhausted';

/**
 * One execution attempt for a task. Retries spawn a new run with the
 * same task id; resumes reattach to the run identified by `runId`.
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
  /** Cumulative token usage observed during this run. */
  tokenUsage?: TokenUsage;
}

// ---------------------------------------------------------------------------
// HarnessTaskIndexEntry — durable mapping rows.
// ---------------------------------------------------------------------------

/**
 * The minimum information needed to locate a task across surfaces.
 * Persistence and lookup APIs are wired by later runtime slices; this
 * slice only stabilizes the row shape.
 */
export interface HarnessTaskIndexEntry {
  taskId: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  runId?: string;
  queuedItemId?: string;
  a2aTaskId?: string;
}

// ---------------------------------------------------------------------------
// Evidence — durable proof of admission, action, approval, completion.
// ---------------------------------------------------------------------------

/** Discriminator on `HarnessEvidence`. */
export type HarnessEvidenceKind = 'admission' | 'workspace-action' | 'inbox-receipt';

/**
 * Public projection of operation admission evidence. Queue receipt recovery
 * fields stay storage-internal for the same reason `PendingInteraction`
 * projects out runtime recovery markers.
 */
export type HarnessAdmissionEvidence =
  | Exclude<HarnessOperationAdmissionEvidence, QueueAdmissionReceipt>
  | Omit<QueueAdmissionReceipt, 'runtimeDependencies'>;

/**
 * Canonical public union over durable proof rows accumulated during a
 * Harness v1 session. The wrapper is read-side only; existing storage
 * rows remain unchanged.
 */
export type HarnessEvidence =
  | { evidenceKind: 'admission'; admission: HarnessAdmissionEvidence }
  | { evidenceKind: 'workspace-action'; entry: WorkspaceActionJournalEntry }
  | { evidenceKind: 'inbox-receipt'; receipt: InboxResponseReceipt };

// ---------------------------------------------------------------------------
// PendingInteraction — durable wait point (public alias).
// ---------------------------------------------------------------------------

/**
 * Canonical public projection of `PendingResume`, the durable wait point a
 * Harness v1 session pauses on. In the current fork this covers tool
 * approval, tool suspension, question, plan approval, and sandbox-access
 * pending kinds.
 *
 * Runtime recovery fields stay storage-internal; public routes already
 * strip `runtimeDependencies`, and the canonical type keeps that boundary
 * explicit for future producers.
 */
export type PendingInteraction = Omit<
  PendingResume,
  'runtimeDependencies' | 'resumedAt' | 'approvedTransitionModeId' | 'modeTransitionAppliedAt'
>;

/**
 * Documentation-only recovery policy for interrupted live sessions.
 *
 * Harness owners renew live session leases periodically before the storage
 * TTL expires. Tools that know they may outlive the default TTL should call
 * `ctx.extendLease({ ttlMs })` before the long operation starts. If the
 * process crashes or the event loop is starved long enough for the lease to
 * expire, a new process may re-open the session after TTL expiry. If another
 * process already owns the lease, callers receive `HarnessSessionLockedError`
 * with the current owner id and expiry timestamp instead of silently writing
 * into a contested session. If a live process loses its lease during renewal,
 * that local session is evicted with `session_evicted` reason `lease_lost`;
 * clients should re-resolve the session and replay from durable events.
 */
export type HarnessLeaseRecoveryPolicy = never;

/**
 * Documentation-only type. Maps pre-existing identifiers in the
 * harness to the canonical primitive they belong to.
 *
 * | Existing identifier              | Canonical primitive                         |
 * | -------------------------------- | ------------------------------------------- |
 * | `sessionId`                      | `HarnessTask.sessionId`                     |
 * | `threadId`                       | `HarnessTask.threadId`                      |
 * | `resourceId`                     | `HarnessTask.resourceId`                    |
 * | `runId`                          | `HarnessRun.runId`                          |
 * | `admissionId`                    | `HarnessTask.admissionId`                   |
 * | `queuedItemId`                   | `HarnessTaskIndexEntry.queuedItemId`        |
 * | `WorkspaceActionJournalEntry.id` | `HarnessEvidence` workspace-action evidence |
 * | `PendingResume.itemId`           | `PendingInteraction.itemId`                 |
 * | A2A `task.id`                    | `HarnessTaskIndexEntry.a2aTaskId`           |
 */
export type TaskIdFieldMapping = never;
