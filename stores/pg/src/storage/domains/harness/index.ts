import { createHash, randomUUID } from 'node:crypto';

import {
  HarnessStorage,
  HarnessStorageAdmissionConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageAttachmentByteOwnerError,
  HarnessStorageAttachmentConflictError,
  HarnessStorageAttachmentPendingError,
  HarnessStorageChannelActionClaimConflictError,
  HarnessStorageChannelActionReceiptTransitionError,
  HarnessStorageChannelActionTokenConflictError,
  HarnessStorageChannelBindingConflictError,
  HarnessStorageChannelInboxClaimConflictError,
  HarnessStorageChannelInboxTransitionError,
  HarnessStorageChannelOutboxClaimConflictError,
  HarnessStorageChannelOutboxTransitionError,
  HarnessStorageDeleteGuardConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStoragePlanTaskNotFoundError,
  HarnessStoragePlanTaskVersionConflictError,
  HarnessStorageProviderCallbackBindingTransitionError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageSessionRecordProjectionUnsupportedError,
  HarnessStorageSessionProjectionBackpressureError,
  HarnessStorageSessionProjectionClaimConflictError,
  HarnessStorageSessionProjectionIncarnationError,
  HarnessStorageSessionProjectionIdentityError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
  HarnessStorageWakeupClaimConflictError,
  HarnessStorageWakeupTransitionError,
  DEFAULT_HARNESS_ATTACHMENT_MAX_BYTES,
  TABLE_CONFIGS,
  TABLE_HARNESS_ATTACHMENT_REFERENCES,
  TABLE_HARNESS_ATTACHMENT_OPERATIONS,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
  TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
  TABLE_HARNESS_CHANNEL_BINDINGS,
  TABLE_HARNESS_CHANNEL_INBOX,
  TABLE_HARNESS_CHANNEL_OUTBOX,
  TABLE_HARNESS_MESSAGE_RESULTS,
  TABLE_HARNESS_OPERATION_TOMBSTONES,
  TABLE_HARNESS_PLAN_TASKS,
  TABLE_HARNESS_RUN_SUMMARIES,
  TABLE_HARNESS_SESSION_PROJECTION_FENCES,
  TABLE_HARNESS_SESSION_PROJECTION_INTENTS,
  TABLE_HARNESS_SESSION_PROJECTION_PRESSURE,
  TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
  TABLE_HARNESS_SESSION_EVENTS,
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
  TABLE_HARNESS_WAKEUPS,
  TABLE_HARNESS_WORKSPACE_ACTIONS,
  TABLE_SCHEMAS,
  applyPlanTaskPatch,
  assertPlanTaskCreateIdempotencyInput,
  decodePlanTaskCursor,
  encodePlanTaskCursor,
  normalizePendingInteractionDueScanInput,
  buildHarnessSessionRecordProjectionIntent,
  projectHarnessSessionRecordProjectionFence,
  walkPlanTaskSubtree,
  HarnessAttachmentByteOwnerIntegrityError,
  assertHarnessAttachmentOwnerScope,
} from '@mastra/core/storage';
import type {
  AcquireSessionLeaseInput,
  AgentSignalDispatchState,
  AgentSignalResultEvidence,
  AppendWorkspaceActionJournalEntryResult,
  AttachmentReference,
  AttachmentRecord,
  AttachmentSemanticMetadata,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelBinding,
  ChannelDiagnosticsRows,
  ChannelInboxItem,
  ChannelOutboxItem,
  ChannelProviderDeliveryReceipt,
  CreateIndexOptions,
  CreateOrLoadActiveSessionOptions,
  CreateOrLoadActiveSessionResult,
  CreateOrLoadChannelActionReceiptResult,
  CreateOrLoadChannelActionTokenResult,
  CreateOrLoadChannelInboxItemResult,
  CreateOrLoadHarnessWakeupItemResult,
  CountPlanTasksByStatusInput,
  CreatePlanTaskInput,
  DeletePlanTaskSubtreeInput,
  DeletePlanTaskSubtreeResult,
  HarnessPlanTask,
  HarnessPlanTaskStatus,
  HarnessRunSummary,
  SaveRunSummaryInput,
  LoadRunSummaryInput,
  ListRunSummariesInput,
  ListRunSummariesResult,
  ListPlanTasksInput,
  ListPlanTasksResult,
  LoadPlanTaskSubtreeInput,
  LoadPlanTaskSubtreeResult,
  PlanTaskCountSummary,
  MutatePlanTasksForSessionInput,
  PlanTaskMutationOp,
  PlanTaskSessionFence,
  UpdatePlanTaskInput,
  UpdatePlanTaskResult,
  DeleteSessionOptions,
  HarnessWakeupItem,
  HarnessProviderCallbackBinding,
  HarnessSessionEventRecord,
  HarnessSessionEventReplayState,
  ListActiveChannelBindingsResult,
  ListActiveSessionsByThreadInput,
  ListChannelDiagnosticsInput,
  ListDuePendingInteractionsInput,
  ListDuePendingInteractionsResult,
  ListSessionsByThreadInput,
  ListSessionsInput,
  ListWorkspaceActionJournalInput,
  LoadedAttachment,
  JsonValue,
  OperationAdmissionEvidence,
  OperationAdmissionTombstone,
  PendingInteractionExpiryGeneration,
  PendingResume,
  ProviderCallbackSelectorKind,
  QueueAdmissionReceipt,
  ReleaseSessionLeaseInput,
  RenewSessionLeaseInput,
  RenewSessionLeaseSubtreeInput,
  ResolveChannelBindingResult,
  ResolveProviderCallbackBindingResult,
  SaveAttachmentReferenceInput,
  SaveAttachmentInput,
  SaveAttachmentResult,
  SaveSessionOptions,
  SaveSessionResult,
  SessionLeaseResult,
  SessionRecord,
  SessionSummary,
  SubtreeSessionLeaseResult,
  ThreadDeleteFenceLease,
  WithThreadDeleteFenceInput,
  WorkspaceActionJournalEntry,
  CompareAndSwapSignalDispatchInput,
  CompareAndSwapSignalDispatchResult,
  CompareAndSwapSignalTerminalInput,
  CompareAndSwapSignalTerminalResult,
  WriteMessageResultEvidenceResult,
  AckSessionRecordProjectionInput,
  AckSessionRecordProjectionResult,
  ClaimSessionRecordProjectionIntentsInput,
  FailSessionRecordProjectionInput,
  HarnessSessionRecordProjectionFence,
  HarnessSessionRecordProjectionIntent,
  RenewSessionRecordProjectionClaimInput,
  SessionRecordProjectionQueuePressure,
  SessionRecordProjectionQueuePressureInput,
  HarnessAttachmentByteOwner,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import type { DbClient, QueryValues, TxClient } from '../../client';
import { PgDB, generateIndexSQL, generateTableSQL, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { POSTGRES_IDENTIFIER_MAX_LENGTH, truncateIdentifier } from '../../db/constraint-utils';

type HarnessWakeupClaimStatus = Extract<HarnessWakeupItem['status'], 'due' | 'claimed' | 'failed'>;
type PgHarnessExecuteArgs = string | { sql: string; args?: QueryValues };
type PgHarnessExecuteResult = { rows: Record<string, unknown>[]; rowsAffected: number };
type PgHarnessTx = PgHarnessClient & { closed: boolean; commit(): Promise<void>; rollback(): Promise<void> };
type HarnessAttachmentOperationKind = 'put' | 'delete';
const HARNESS_ATTACHMENT_PUT_ABANDONMENT_DELAY_MS = 60_000;
type HarnessAttachmentOperationStatus =
  | 'pending'
  | 'uploaded'
  | 'unknown'
  | 'cleanup_pending'
  | 'claimed'
  | 'completed'
  | 'cleaned';
type PgAttachmentOperation = {
  id: string;
  harnessName: string;
  sessionId: string;
  attachmentId: string;
  sessionIncarnation: string;
  kind: HarnessAttachmentOperationKind;
  status: HarnessAttachmentOperationStatus;
  name?: string;
  mimeType?: string;
  source?: AttachmentRecord['source'];
  sizeBytes: number;
  sha256: string;
  semantic?: AttachmentSemanticMetadata;
  blobRef?: string;
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};
type AttachmentOperationClaim =
  | { state: 'done'; operation?: PgAttachmentOperation }
  | { state: 'busy'; operation: PgAttachmentOperation }
  | { state: 'claimed'; operation: PgAttachmentOperation; claimId: string };
const HARNESS_TABLE_NAMES = [
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_ATTACHMENTS,
  TABLE_HARNESS_ATTACHMENT_REFERENCES,
  TABLE_HARNESS_ATTACHMENT_OPERATIONS,
  TABLE_HARNESS_MESSAGE_RESULTS,
  TABLE_HARNESS_OPERATION_TOMBSTONES,
  TABLE_HARNESS_SESSION_EVENTS,
  TABLE_HARNESS_THREAD_DELETE_FENCES,
  TABLE_HARNESS_CHANNEL_BINDINGS,
  TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
  TABLE_HARNESS_CHANNEL_INBOX,
  TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
  TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
  TABLE_HARNESS_CHANNEL_OUTBOX,
  TABLE_HARNESS_WAKEUPS,
  TABLE_HARNESS_WORKSPACE_ACTIONS,
  TABLE_HARNESS_PLAN_TASKS,
  TABLE_HARNESS_RUN_SUMMARIES,
  TABLE_HARNESS_SESSION_PROJECTION_INTENTS,
  TABLE_HARNESS_SESSION_PROJECTION_FENCES,
  TABLE_HARNESS_SESSION_PROJECTION_PRESSURE,
] as const;

class PgHarnessClient {
  readonly #client: DbClient;
  readonly #schemaName?: string;

  constructor(client: DbClient, schemaName?: string) {
    this.#client = client;
    this.#schemaName = schemaName;
  }

  async execute(input: PgHarnessExecuteArgs): Promise<PgHarnessExecuteResult> {
    const { sql, args } = typeof input === 'string' ? { sql: input, args: [] } : input;
    const prepared = preparePgHarnessSql(sql, this.#schemaName);
    const result = await this.#client.query(prepared, args);
    return { rows: result.rows as Record<string, unknown>[], rowsAffected: result.rowCount ?? 0 };
  }

  async transaction(_mode?: 'write'): Promise<PgHarnessTx> {
    const client = await this.#client.connect();
    let closed = false;
    try {
      await client.query('BEGIN');
      const tx = new PgHarnessClient(
        {
          $pool: this.#client.$pool,
          connect: this.#client.connect.bind(this.#client),
          async none(query, values) {
            await client.query(query, values);
            return null;
          },
          async one<T>(query: string, values?: QueryValues): Promise<T> {
            const result = await client.query(query, values);
            if (result.rows.length !== 1) {
              throw new Error(`Expected one row from Harness PG transaction query, got ${result.rows.length}`);
            }
            return result.rows[0] as T;
          },
          async oneOrNone<T>(query: string, values?: QueryValues): Promise<T | null> {
            const result = await client.query(query, values);
            if (result.rows.length > 1) {
              throw new Error(`Expected zero or one row from Harness PG transaction query, got ${result.rows.length}`);
            }
            return (result.rows[0] as T | undefined) ?? null;
          },
          async any<T>(query: string, values?: QueryValues): Promise<T[]> {
            const result = await client.query(query, values);
            return result.rows as T[];
          },
          async manyOrNone<T>(query: string, values?: QueryValues): Promise<T[]> {
            const result = await client.query(query, values);
            return result.rows as T[];
          },
          async many<T>(query: string, values?: QueryValues): Promise<T[]> {
            const result = await client.query(query, values);
            if (result.rows.length === 0) {
              throw new Error('Expected at least one row from Harness PG transaction query');
            }
            return result.rows as T[];
          },
          async query(query: string, values?: QueryValues) {
            return client.query(query, values);
          },
          async batch<T>(promises: Promise<T>[]): Promise<T[]> {
            return Promise.all(promises);
          },
          async tx<T>(callback: (t: TxClient) => Promise<T>) {
            return callback(this as unknown as TxClient);
          },
        } as DbClient,
        this.#schemaName,
      ) as PgHarnessTx;
      Object.defineProperty(tx, 'closed', { get: () => closed });
      tx.commit = async () => {
        if (closed) return;
        await client.query('COMMIT');
        closed = true;
        client.release();
      };
      tx.rollback = async () => {
        if (closed) return;
        await client.query('ROLLBACK');
        closed = true;
        client.release();
      };
      return tx;
    } catch (err) {
      if (!closed) client.release();
      throw err;
    }
  }
}

function preparePgHarnessSql(sql: string, schemaName?: string): string {
  let param = 0;
  const schemaQualified = qualifyHarnessTableNames(sql, schemaName);
  return schemaQualified.replace(/\bIS\s+\?/g, 'IS NOT DISTINCT FROM ?').replace(/\?/g, () => `$${++param}`);
}

function qualifyHarnessTableNames(sql: string, schemaName?: string): string {
  if (!schemaName || schemaName === 'public') return sql;
  const schema = `"${parseSqlIdentifier(schemaName, 'schema name')}"`;
  let next = sql;
  for (const table of HARNESS_TABLE_NAMES) {
    const bare = parseSqlIdentifier(table, 'table name');
    const qualified = `${schema}."${bare}"`;
    next = next.replace(new RegExp(`"${bare}"`, 'g'), qualified);
    next = next.replace(new RegExp(`(?<!")\\b${bare}\\b(?!")`, 'g'), qualified);
  }
  return next;
}

function harnessIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
  return [
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_sessions_active_key'),
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'resource_id', 'thread_id'],
      unique: true,
      where: '"closed_at" IS NULL',
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_sessions_thread_scope'),
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'resource_id', 'thread_id', 'last_activity_at'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_sessions_thread_global'),
      table: TABLE_HARNESS_SESSIONS,
      columns: ['thread_id', 'last_activity_at'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_sessions_active_thread'),
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'thread_id', 'last_activity_at'],
      where: '"closed_at" IS NULL',
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_sessions_active_thread_global'),
      table: TABLE_HARNESS_SESSIONS,
      columns: ['thread_id', 'last_activity_at'],
      where: '"closed_at" IS NULL',
    },
    {
      // §5.8 subtree-lease renewal (renewSessionLeaseSubtree recursive CTE) and
      // listSessions({ parentSessionId }) filter `harness_name + parent_session_id`;
      // without this index each recursion level / listing seq-scans the sessions table.
      name: harnessIndexName(schemaPrefix, 'idx_harness_sessions_parent'),
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'parent_session_id'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_sessions_pending_resume_expiry'),
      table: TABLE_HARNESS_SESSIONS,
      columns: ['harness_name', 'pending_resume_expires_at', 'id'],
      where: '"pending_resume_expires_at" IS NOT NULL',
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_session_events_replay'),
      table: TABLE_HARNESS_SESSION_EVENTS,
      columns: ['harness_name', 'session_id', 'resource_id', 'thread_id', 'epoch', 'sequence'],
    },
    {
      // One immutable put/delete lifecycle is retained per attachment
      // incarnation. A new session incarnation can reuse the logical id
      // without colliding with the old cleanup operation.
      name: harnessIndexName(schemaPrefix, 'idx_harness_attachment_operations_scope'),
      table: TABLE_HARNESS_ATTACHMENT_OPERATIONS,
      columns: ['harness_name', 'session_id', 'attachment_id', 'session_incarnation', 'kind'],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_attachment_operations_claim'),
      table: TABLE_HARNESS_ATTACHMENT_OPERATIONS,
      columns: ['harness_name', 'kind', 'status', 'next_attempt_at', 'claim_expires_at', 'created_at'],
    },
    {
      // blob_ref can run to the 4,096-character reference bound, which exceeds
      // the B-tree entry limit for incompressible values. A single-column hash
      // index stores a fixed-size digest per entry (hash indexes do not
      // support multiple columns) and serves the equality lookups this index
      // exists for.
      name: harnessIndexName(schemaPrefix, 'idx_harness_attachments_blob_ref'),
      table: TABLE_HARNESS_ATTACHMENTS,
      columns: ['blob_ref'],
      where: '"blob_ref" IS NOT NULL',
      method: 'hash',
    },
    {
      // §4.2f idempotency: loadMessageResultEvidence + compactOperationResultEvidence
      // look up retained signal-result evidence by (session tuple + signal_id) on the
      // message-admission path; without this index each admission seq-scans the table.
      name: harnessIndexName(schemaPrefix, 'idx_harness_message_results_lookup'),
      table: TABLE_HARNESS_MESSAGE_RESULTS,
      columns: ['harness_name', 'session_id', 'resource_id', 'thread_id', 'signal_id'],
    },
    {
      // resolveOperationAdmissionEvidence (signal branch) probes message_results by
      // (session scope + admission_id) on every signal admission — a distinct hot path
      // from the signal_id lookup; thread_id is optional so it stays residual.
      name: harnessIndexName(schemaPrefix, 'idx_harness_message_results_admission'),
      table: TABLE_HARNESS_MESSAGE_RESULTS,
      columns: ['harness_name', 'session_id', 'resource_id', 'admission_id'],
    },
    {
      // §5.1d idempotency: resolveOperationAdmissionEvidence checks the tombstone by
      // (session scope + kind + admission_id) on EVERY message/queue admission; the
      // (harness_name, session_id, resource_id, kind) prefix also serves the
      // signal_id / queued_item_id tombstone lookups and the per-session delete.
      name: harnessIndexName(schemaPrefix, 'idx_harness_tombstones_lookup'),
      table: TABLE_HARNESS_OPERATION_TOMBSTONES,
      columns: ['harness_name', 'session_id', 'resource_id', 'kind', 'admission_id'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_workspace_actions_session'),
      table: TABLE_HARNESS_WORKSPACE_ACTIONS,
      columns: ['harness_name', 'session_id', 'resource_id', 'thread_id', 'created_at', 'id'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_workspace_actions_page'),
      table: TABLE_HARNESS_WORKSPACE_ACTIONS,
      columns: ['harness_name', 'session_id', 'resource_id', 'created_at', 'id'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_inbox_idempotency'),
      table: TABLE_HARNESS_CHANNEL_INBOX,
      columns: ['harness_name', 'channel_id', 'idempotency_key'],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_inbox_claim'),
      table: TABLE_HARNESS_CHANNEL_INBOX,
      columns: ['harness_name', 'channel_id', 'status', 'next_attempt_at', 'claim_expires_at', 'received_at'],
    },
    {
      // §5.2h / §14.1: at most one ACTIVE binding per platform-conversation tuple. A
      // missing optional external id is stored as a non-null out-of-band sentinel
      // (CHANNEL_BINDING_EXTERNAL_ID_SENTINEL), so this partial-unique index enforces
      // the invariant without depending on SQL NULL uniqueness semantics. Mirrors the
      // LibSQL sibling's active-tuple index.
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_bindings_active_tuple'),
      table: TABLE_HARNESS_CHANNEL_BINDINGS,
      columns: [
        'harness_name',
        'channel_id',
        'platform',
        'external_tenant_id',
        'external_channel_id',
        'external_thread_id',
      ],
      unique: true,
      where: `"status" = 'active'`,
    },
    {
      // loadChannelBindingByExternal / resolveChannelBinding probe the active row for a
      // tuple; resolveChannelBinding also scans every binding (active or fenced) for the
      // tuple to compute the monotonic max generation.
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_bindings_tuple'),
      table: TABLE_HARNESS_CHANNEL_BINDINGS,
      columns: [
        'harness_name',
        'channel_id',
        'platform',
        'external_tenant_id',
        'external_channel_id',
        'external_thread_id',
      ],
    },
    {
      // listChannelBindingsForSession + the deleteSessions cleanup filter by session.
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_bindings_session'),
      table: TABLE_HARNESS_CHANNEL_BINDINGS,
      columns: ['harness_name', 'session_id'],
    },
    {
      // §14.8 listActiveChannelBindingsForScope ordering: active rows for a harness
      // (optionally a channel) ranked by activity then binding id. Mirrors the LibSQL
      // sibling's idx_harness_channel_bindings_scope (status in the key, not partial).
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_bindings_scope'),
      table: TABLE_HARNESS_CHANNEL_BINDINGS,
      columns: ['harness_name', 'channel_id', 'status', 'last_outbound_at', 'last_inbound_at', 'id'],
    },
    {
      // §5.1i: at most one ACTIVE provider-callback binding per
      // (provider_id, selector_kind, selector_value). The partial-unique index
      // enforces the invariant; replacements mark the prior row `replaced` rather
      // than leaving two active owners. Mirrors the LibSQL sibling's
      // idx_harness_provider_callback_active_selector.
      name: harnessIndexName(schemaPrefix, 'idx_harness_provider_callback_active_selector'),
      table: TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
      columns: ['provider_id', 'selector_kind', 'selector_value'],
      unique: true,
      where: `"status" = 'active'`,
    },
    {
      // resolveProviderCallbackBinding / markProviderCallbackBindingStatus probe the
      // active row for a selector, and the status filter also serves history lookups
      // for a selector. Mirrors idx_harness_provider_callback_selector_status.
      name: harnessIndexName(schemaPrefix, 'idx_harness_provider_callback_selector_status'),
      table: TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
      columns: ['provider_id', 'selector_kind', 'selector_value', 'status'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_action_tokens_transport'),
      table: TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
      columns: ['harness_name', 'channel_id', 'transport_hash'],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_action_tokens_pending'),
      table: TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
      columns: [
        'harness_name',
        'channel_id',
        'binding_id',
        'binding_generation',
        'owning_session_id',
        'item_id',
        'kind',
        'run_id',
        'pending_requested_at',
        'metadata_hash',
      ],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_action_receipts_token'),
      table: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      columns: ['harness_name', 'channel_id', 'action_token_id'],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_action_receipts_action'),
      table: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      columns: ['harness_name', 'channel_id', 'action_id', 'created_at'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_action_receipts_claim'),
      table: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      columns: ['harness_name', 'channel_id', 'status', 'next_attempt_at', 'claim_expires_at', 'created_at'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_outbox_idempotency'),
      table: TABLE_HARNESS_CHANNEL_OUTBOX,
      columns: ['harness_name', 'binding_id', 'idempotency_key'],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_outbox_claim'),
      table: TABLE_HARNESS_CHANNEL_OUTBOX,
      columns: ['harness_name', 'channel_id', 'status', 'next_attempt_at', 'claim_expires_at', 'created_at', 'id'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_channel_outbox_binding_order'),
      table: TABLE_HARNESS_CHANNEL_OUTBOX,
      columns: ['harness_name', 'binding_id', 'status', 'created_at', 'id'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_wakeups_idempotency'),
      table: TABLE_HARNESS_WAKEUPS,
      columns: ['harness_name', 'idempotency_key'],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_wakeups_source_fire'),
      table: TABLE_HARNESS_WAKEUPS,
      columns: ['harness_name', 'source', 'source_id', 'fire_id'],
      unique: true,
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_wakeups_claim'),
      table: TABLE_HARNESS_WAKEUPS,
      columns: ['harness_name', 'source', 'status', 'due_at', 'next_attempt_at', 'claim_expires_at'],
    },
    {
      // §5.1k: listPlanTasks orders by (parentTaskId, order) within a session;
      // loadPlanTaskSubtree + deletePlanTaskSubtree walk parent_task_id. This
      // index serves the ordered listing and the recursive subtree walk.
      name: harnessIndexName(schemaPrefix, 'idx_harness_plan_tasks_order'),
      table: TABLE_HARNESS_PLAN_TASKS,
      columns: ['harness_name', 'session_id', 'parent_task_id', 'order'],
    },
    {
      // createPlanTask idempotency lookup by (session, idempotency_key).
      name: harnessIndexName(schemaPrefix, 'idx_harness_plan_tasks_idempotency'),
      table: TABLE_HARNESS_PLAN_TASKS,
      columns: ['harness_name', 'session_id', 'idempotency_key'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_session_projection_claim'),
      table: TABLE_HARNESS_SESSION_PROJECTION_INTENTS,
      columns: ['harness_name', 'status', 'next_attempt_at', 'created_at'],
    },
    {
      name: harnessIndexName(schemaPrefix, 'idx_harness_session_projection_order'),
      table: TABLE_HARNESS_SESSION_PROJECTION_INTENTS,
      columns: ['harness_name', 'session_id', 'session_incarnation', 'revision'],
      unique: true,
    },
  ];
}

function harnessIndexName(schemaPrefix: string, baseName: string): string {
  const name = `${schemaPrefix}${baseName}`;
  if (Buffer.byteLength(name, 'utf-8') <= POSTGRES_IDENTIFIER_MAX_LENGTH) return name;

  const suffix = `_${createHash('sha256').update(name).digest('hex').slice(0, 8)}`;
  return `${truncateIdentifier(name, POSTGRES_IDENTIFIER_MAX_LENGTH - Buffer.byteLength(suffix, 'utf-8'))}${suffix}`;
}

/**
 * PostgreSQL `HarnessStorage` adapter.
 *
 * Sessions are persisted to a single row in `mastra_harness_sessions`. The
 * `version` column drives the optimistic-CAS contract — every successful
 * `saveSession` increments it inside the same `UPDATE`'s `WHERE` clause so
 * two writers cannot both observe the same predecessor.
 *
 * Attachments live in `mastra_harness_attachments` with a composite primary
 * key on `(harness_name, session_id, attachment_id)`. New rows retain an
 * immutable external byte reference; the native operation table records
 * upload and cleanup outcomes.
 */
export class HarnessPG extends HarnessStorage {
  #db: PgDB;
  #client: PgHarnessClient;
  #harnessName: string;
  #attachmentByteOwner?: HarnessAttachmentByteOwner;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];
  #sessionEventsReady: Promise<void> | undefined;
  #workspaceActionsReady: Promise<void> | undefined;
  #planTasksReady: Promise<void> | undefined;
  #runSummariesReady: Promise<void> | undefined;
  #compactionLocks = new Map<string, Promise<void>>();
  #channelBindingIndexesReady: Promise<void> | undefined;
  #providerCallbackBindingIndexesReady: Promise<void> | undefined;
  #channelInboxIndexesReady: Promise<void> | undefined;
  #channelActionIndexesReady: Promise<void> | undefined;
  #channelOutboxIndexesReady: Promise<void> | undefined;
  #wakeupIndexesReady: Promise<void> | undefined;
  #localThreadDeleteFences = new Map<string, { ownerId: string; leaseId: string; ttlMs: number }>();

  static readonly MANAGED_TABLES = [
    TABLE_HARNESS_SESSIONS,
    TABLE_HARNESS_ATTACHMENTS,
    TABLE_HARNESS_ATTACHMENT_REFERENCES,
    TABLE_HARNESS_ATTACHMENT_OPERATIONS,
    TABLE_HARNESS_MESSAGE_RESULTS,
    TABLE_HARNESS_OPERATION_TOMBSTONES,
    TABLE_HARNESS_SESSION_EVENTS,
    TABLE_HARNESS_THREAD_DELETE_FENCES,
    TABLE_HARNESS_CHANNEL_BINDINGS,
    TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
    TABLE_HARNESS_CHANNEL_INBOX,
    TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
    TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
    TABLE_HARNESS_CHANNEL_OUTBOX,
    TABLE_HARNESS_WAKEUPS,
    TABLE_HARNESS_WORKSPACE_ACTIONS,
    TABLE_HARNESS_PLAN_TASKS,
    TABLE_HARNESS_RUN_SUMMARIES,
    TABLE_HARNESS_SESSION_PROJECTION_INTENTS,
    TABLE_HARNESS_SESSION_PROJECTION_FENCES,
    TABLE_HARNESS_SESSION_PROJECTION_PRESSURE,
  ] as const;

  constructor(config: PgDomainConfig & { harnessName?: string }) {
    const resolved = resolvePgConfig(config);
    super({ sessionRecordProjection: resolved.sessionRecordProjection });
    const { client, schemaName, disableInit, skipDefaultIndexes, indexes, attachmentByteOwner } = resolved;
    this.#client = new PgHarnessClient(client, schemaName);
    this.#harnessName = config.harnessName ?? 'default';
    this.#attachmentByteOwner = attachmentByteOwner;
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (HarnessPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
    this.#db = new PgDB({ client, schemaName, disableInit, skipDefaultIndexes });
  }

  override get supportsSessionRecordProjection(): boolean {
    return this.sessionRecordProjection.enabled;
  }

  static getDefaultIndexDefs(schemaPrefix: string) {
    return harnessIndexDefs(schemaPrefix);
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    for (const tableName of HarnessPG.MANAGED_TABLES) {
      const config = TABLE_CONFIGS[tableName];
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          compositePrimaryKey: config?.compositePrimaryKey,
          includeAllConstraints: true,
        }),
      );
    }
    for (const indexDef of HarnessPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(indexDef, schemaName));
    }
    return statements;
  }

  async init(): Promise<void> {
    const sessionsConfig = TABLE_CONFIGS[TABLE_HARNESS_SESSIONS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
      compositePrimaryKey: sessionsConfig?.compositePrimaryKey,
    });
    const projectionIntentsConfig = TABLE_CONFIGS[TABLE_HARNESS_SESSION_PROJECTION_INTENTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSION_PROJECTION_INTENTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSION_PROJECTION_INTENTS],
      compositePrimaryKey: projectionIntentsConfig?.compositePrimaryKey,
    });
    const projectionFencesConfig = TABLE_CONFIGS[TABLE_HARNESS_SESSION_PROJECTION_FENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSION_PROJECTION_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSION_PROJECTION_FENCES],
      compositePrimaryKey: projectionFencesConfig?.compositePrimaryKey,
    });
    const projectionPressureConfig = TABLE_CONFIGS[TABLE_HARNESS_SESSION_PROJECTION_PRESSURE];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_SESSION_PROJECTION_PRESSURE,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSION_PROJECTION_PRESSURE],
      compositePrimaryKey: projectionPressureConfig?.compositePrimaryKey,
    });
    const attachmentsConfig = TABLE_CONFIGS[TABLE_HARNESS_ATTACHMENTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_ATTACHMENTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENTS],
      compositePrimaryKey: attachmentsConfig?.compositePrimaryKey,
    });
    const attachmentRefsConfig = TABLE_CONFIGS[TABLE_HARNESS_ATTACHMENT_REFERENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_ATTACHMENT_REFERENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENT_REFERENCES],
      compositePrimaryKey: attachmentRefsConfig?.compositePrimaryKey,
    });
    const attachmentOperationsConfig = TABLE_CONFIGS[TABLE_HARNESS_ATTACHMENT_OPERATIONS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_ATTACHMENT_OPERATIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENT_OPERATIONS],
      compositePrimaryKey: attachmentOperationsConfig?.compositePrimaryKey,
    });
    // PUT/DELETE inserts rely on ON CONFLICT over this exact scope tuple, so
    // the unique index is correctness-critical rather than an optional
    // performance index: create it even when skipDefaultIndexes is set. It
    // stays in getDefaultIndexDefs so exported DDL still carries it.
    const operationsScopeIndex = HarnessPG.getDefaultIndexDefs(this.#schemaPrefix()).find(
      def => def.table === TABLE_HARNESS_ATTACHMENT_OPERATIONS && def.unique === true,
    );
    if (operationsScopeIndex) await this.#db.createIndex(operationsScopeIndex);
    await this.#ensureMessageResultsTable();
    await this.#ensureSessionEventsTable();
    await this.#ensureWorkspaceActionsTable();
    const tombstonesConfig = TABLE_CONFIGS[TABLE_HARNESS_OPERATION_TOMBSTONES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_OPERATION_TOMBSTONES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_OPERATION_TOMBSTONES],
      compositePrimaryKey: tombstonesConfig?.compositePrimaryKey,
    });
    const threadDeleteFencesConfig = TABLE_CONFIGS[TABLE_HARNESS_THREAD_DELETE_FENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_THREAD_DELETE_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_THREAD_DELETE_FENCES],
      compositePrimaryKey: threadDeleteFencesConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelBindingsTable();
    await this.#ensureProviderCallbackBindingsTable();
    await this.#ensureChannelInboxTable();
    await this.#ensureChannelActionTables();
    await this.#ensureChannelOutboxTable();
    await this.#ensureWakeupTable();
    await this.#ensurePlanTasksTable();
    await this.#ensureRunSummariesTable();
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_SESSIONS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSIONS],
      ifNotExists: [
        'harness_name',
        'session_incarnation',
        'subagent_depth',
        'subagent_type_id',
        'subagent_tool_allowlist_scoped',
        'permission_rules_seed_hash',
        'current_run',
        'assistant_drafts',
        'cancel_request',
        'pending_resume_expires_at',
        'queue_admission_receipts',
        'inbox_response_receipts',
        'expired_pending_interactions',
        'closing_at',
        'close_deadline_at',
      ],
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_ATTACHMENTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENTS],
      ifNotExists: [
        'harness_name',
        'sha256',
        'source',
        'kind',
        'primitive_type',
        'element_type',
        'renderer_json',
        'schema_id',
        'metadata_json',
        'object_json',
        'session_incarnation',
        'blob_ref',
        'put_operation_id',
      ],
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_ATTACHMENT_REFERENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_ATTACHMENT_REFERENCES],
      ifNotExists: ['harness_name', 'session_incarnation'],
    });
    // Existing native schemas used a required inline payload. New attachment
    // rows keep bytes external, so the old column must be nullable before the
    // first external metadata commit can succeed. Legacy rows remain untouched
    // and require an explicit import/fence before they can be loaded.
    if (!this.#db.isExternalSchemaMode()) {
      // DROP NOT NULL still takes AccessExclusiveLock on an already-nullable
      // column, so only alter when the catalog says the column is required.
      const nullable = await this.#client.execute({
        sql: `SELECT is_nullable FROM information_schema.columns
              WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
        args: [this.#schema, TABLE_HARNESS_ATTACHMENTS, 'data_b64'],
      });
      if (nullable.rows[0]?.is_nullable === 'NO') {
        await this.#client.execute(`ALTER TABLE ${TABLE_HARNESS_ATTACHMENTS} ALTER COLUMN data_b64 DROP NOT NULL`);
      }
    }
    await this.#backfillHarnessNamespace();
    await this.#backfillPendingResumeExpiry();
    if (!this.#skipDefaultIndexes) {
      await this.#assertNoDuplicateActiveSessions();
    }
    await this.#backfillAttachmentMetadata();
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return HarnessPG.getDefaultIndexDefs(this.#schemaPrefix());
  }

  async createDefaultIndexes(): Promise<void> {
    await this.#createDefaultIndexes();
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        if (this.#db.isExternalSchemaMode()) throw error;
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async #lockThreadDeleteFence(tx: PgHarnessClient, threadId: string): Promise<void> {
    await tx.execute({
      sql: `SELECT pg_advisory_xact_lock(hashtextextended(?, 0::bigint))`,
      args: [`mastra:harness:thread-delete:${threadId}`],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#ensureMessageResultsTable();
    await this.#ensureOperationTombstonesTable();
    await this.#ensureSessionEventsTable();
    await this.#ensureWorkspaceActionsTable();
    await this.#ensureThreadDeleteFencesTable();
    await this.#ensureChannelBindingsTable();
    await this.#ensureProviderCallbackBindingsTable();
    await this.#ensureChannelInboxTable();
    await this.#ensureChannelActionTables();
    await this.#ensureChannelOutboxTable();
    await this.#ensureWakeupTable();
    await this.#ensurePlanTasksTable();
    await this.#ensureRunSummariesTable();
    this.#localThreadDeleteFences.clear();
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_RUN_SUMMARIES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_PLAN_TASKS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSION_EVENTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_WORKSPACE_ACTIONS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_BINDINGS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_INBOX}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_WAKEUPS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSION_PROJECTION_FENCES}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}`);
    await this.#client.execute(`DELETE FROM ${TABLE_HARNESS_SESSIONS}`);
  }

  // -------------------------------------------------------------------------
  // Session records
  // -------------------------------------------------------------------------

  async loadSession({
    sessionId,
    harnessName,
  }: {
    sessionId: string;
    harnessName?: string;
  }): Promise<SessionRecord | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ?`,
      args: [namespace, sessionId],
    });
    const row = result.rows[0];
    return row ? rowToSession(row as Record<string, unknown>) : null;
  }

  async loadSessionByThread({
    threadId,
    resourceId,
    harnessName,
  }: {
    threadId: string;
    resourceId: string;
    harnessName?: string;
  }): Promise<SessionRecord | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    // §5.2a/§5.3/§5.5: return the current owner INCLUDING Closed (reopen
    // candidate) and Closing records. A `closed_at IS NULL` filter here would
    // hide a closed owner so `harness.session({ threadId, resourceId })` would
    // mint a second active record on the same thread instead of reopening the
    // closed one — diverging from InMemory and violating the storage contract.
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND thread_id = ? AND resource_id = ?
            ORDER BY last_activity_at DESC
            LIMIT 1`,
      args: [namespace, threadId, resourceId],
    });
    const row = result.rows[0];
    return row ? rowToSession(row as Record<string, unknown>) : null;
  }

  async listSessions({
    resourceId,
    includeClosed = false,
    parentSessionId,
    harnessName,
  }: ListSessionsInput): Promise<SessionSummary[]> {
    const conditions: string[] = ['harness_name = ?', 'resource_id = ?'];
    const args: (string | number)[] = [this.#resolveHarnessName(harnessName), resourceId];

    if (!includeClosed) conditions.push('closed_at IS NULL');
    if (parentSessionId !== undefined) {
      conditions.push('parent_session_id = ?');
      args.push(parentSessionId);
    }

    const result = await this.#client.execute({
      sql: `SELECT harness_name, id, resource_id, thread_id, parent_session_id, origin, mode_id, model_id,
                   last_activity_at, closing_at, close_deadline_at, closed_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY last_activity_at DESC`,
      args,
    });

    return result.rows.map(row => rowToSummary(row as Record<string, unknown>));
  }

  async listSessionsByThread({
    resourceId,
    threadId,
    includeClosed = false,
    harnessName,
  }: ListSessionsByThreadInput): Promise<SessionSummary[]> {
    await this.#renewLocalThreadDeleteFence(threadId);
    const conditions: string[] = ['thread_id = ?'];
    const args: (string | number)[] = [threadId];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    if (resourceId !== undefined) {
      conditions.push('resource_id = ?');
      args.push(resourceId);
    }

    if (!includeClosed) conditions.push('closed_at IS NULL');

    const result = await this.#client.execute({
      sql: `SELECT harness_name, id, resource_id, thread_id, parent_session_id, origin, mode_id, model_id,
                   last_activity_at, closing_at, close_deadline_at, closed_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY last_activity_at DESC`,
      args,
    });

    return result.rows.map(row => rowToSummary(row as Record<string, unknown>));
  }

  async listActiveSessionsByThread({
    threadId,
    harnessName,
  }: ListActiveSessionsByThreadInput): Promise<SessionSummary[]> {
    await this.#renewLocalThreadDeleteFence(threadId);
    const conditions = ['thread_id = ?', 'closed_at IS NULL'];
    const args: (string | number)[] = [threadId];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }

    const result = await this.#client.execute({
      sql: `SELECT harness_name, id, resource_id, thread_id, parent_session_id, origin, mode_id, model_id,
                   last_activity_at, closing_at, close_deadline_at, closed_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY last_activity_at DESC`,
      args,
    });

    return result.rows.map(row => rowToSummary(row as Record<string, unknown>));
  }

  async listDuePendingInteractions(input: ListDuePendingInteractionsInput): Promise<ListDuePendingInteractionsResult> {
    const { now, limit, cursor } = normalizePendingInteractionDueScanInput(input);
    const conditions = [
      'harness_name = ?',
      'closed_at IS NULL',
      'pending_resume_expires_at IS NOT NULL',
      'pending_resume_expires_at <= ?',
    ];
    const args: (string | number)[] = [this.#resolveHarnessName(input.harnessName), now];
    if (cursor !== undefined) {
      conditions.push('(pending_resume_expires_at > ? OR (pending_resume_expires_at = ? AND id > ?))');
      args.push(cursor.dueAt, cursor.dueAt, cursor.sessionId);
    }
    args.push(limit + 1);

    const result = await this.#client.execute({
      sql: `SELECT harness_name, id, resource_id, pending_resume, pending_resume_expires_at
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY pending_resume_expires_at ASC, id ASC
            LIMIT ?`,
      args,
    });
    const generations = result.rows.map(row => rowToPendingInteractionExpiryGeneration(row as Record<string, unknown>));
    const items = generations.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      ...(generations.length > limit && last ? { nextCursor: { dueAt: last.dueAt, sessionId: last.sessionId } } : {}),
    };
  }

  async withThreadDeleteFence<T>(
    { threadId, ownerId, ttlMs }: WithThreadDeleteFenceInput,
    fn: (fence: ThreadDeleteFenceLease) => Promise<T>,
  ): Promise<T> {
    await this.#ensureThreadDeleteFencesTable();
    const leaseId = randomUUID();
    for (;;) {
      const tx = await this.#client.transaction('write');
      try {
        await this.#lockThreadDeleteFence(tx, threadId);
        const now = Date.now();
        const expiresAt = now + ttlMs;
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                WHERE expires_at <= ?`,
          args: [now],
        });
        const result = await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                  (thread_id, owner_id, lease_id, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(thread_id) DO UPDATE SET
                  owner_id = excluded.owner_id,
                  lease_id = excluded.lease_id,
                  created_at = excluded.created_at,
                  expires_at = excluded.expires_at
                WHERE ${TABLE_HARNESS_THREAD_DELETE_FENCES}.expires_at <= ?`,
          args: [threadId, ownerId, leaseId, now, expiresAt, now],
        });
        if (result.rowsAffected !== 0) {
          await tx.commit();
          break;
        }
        const existing = await tx.execute({
          sql: `SELECT owner_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                WHERE thread_id = ? AND expires_at > ?
                LIMIT 1`,
          args: [threadId, now],
        });
        const existingOwnerId = (existing.rows[0] as any)?.owner_id as string | undefined;
        await tx.rollback();
        if (existingOwnerId === undefined) continue;
        throw new HarnessStorageThreadDeleteFenceConflictError(threadId, existingOwnerId);
      } catch (err) {
        if (!tx.closed) await tx.rollback();
        throw err;
      }
    }
    this.#localThreadDeleteFences.set(threadId, { ownerId, leaseId, ttlMs });
    const renewalIntervalMs = Math.max(1, Math.floor(ttlMs / 3));
    let renewals = Promise.resolve();
    let renewalFailure: unknown;
    const renewal = setInterval(() => {
      renewals = renewals
        .catch(err => {
          renewalFailure ??= err;
        })
        .then(async () => {
          await this.#renewLocalThreadDeleteFence(threadId, leaseId);
        })
        .then(
          () => undefined,
          err => {
            renewalFailure ??= err;
          },
        );
    }, renewalIntervalMs);
    (renewal as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();
    const assertActive = async () => {
      try {
        await renewals;
      } catch (err) {
        renewalFailure ??= err;
      }
      if (renewalFailure) throw renewalFailure;
      await this.#renewLocalThreadDeleteFence(threadId, leaseId);
      if (renewalFailure) throw renewalFailure;
    };
    const fence: ThreadDeleteFenceLease = {
      threadId,
      ownerId,
      assertActive,
    };
    try {
      const result = await fn(fence);
      if (renewalFailure) throw renewalFailure;
      return result;
    } finally {
      clearInterval(renewal);
      try {
        await renewals;
      } catch (err) {
        renewalFailure ??= err;
      }
      const localFence = this.#localThreadDeleteFences.get(threadId);
      if (localFence && localFence.ownerId === ownerId && localFence.leaseId === leaseId) {
        this.#localThreadDeleteFences.delete(threadId);
      }
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND owner_id = ? AND lease_id = ?`,
        args: [threadId, ownerId, leaseId],
      });
    }
  }

  async #renewLocalThreadDeleteFence(threadId: string, expectedLeaseId?: string): Promise<void> {
    const fence = this.#localThreadDeleteFences.get(threadId);
    if (!fence) {
      if (expectedLeaseId === undefined) return;
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId);
    }
    if (expectedLeaseId !== undefined && fence.leaseId !== expectedLeaseId) {
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId, fence.ownerId);
    }
    const now = Date.now();
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_THREAD_DELETE_FENCES}
            SET expires_at = ?
            WHERE thread_id = ? AND owner_id = ? AND lease_id = ? AND expires_at > ?`,
      args: [now + fence.ttlMs, threadId, fence.ownerId, fence.leaseId, now],
    });
    if (result.rowsAffected === 0) {
      const existing = await this.#client.execute({
        sql: `SELECT owner_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND expires_at > ?
              LIMIT 1`,
        args: [threadId, Date.now()],
      });
      throw new HarnessStorageThreadDeleteFenceConflictError(threadId, (existing.rows[0] as any)?.owner_id as string);
    }
  }

  async saveSession(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult> {
    if (this.sessionRecordProjection.enabled) {
      return this.#saveSessionWithProjection(record, opts);
    }
    const harnessName = this.#resolveHarnessName(opts.harnessName ?? record.harnessName);
    const sessionIncarnation = opts.ifVersion === 0 && this.#attachmentByteOwner ? randomUUID() : undefined;
    const namespacedRecord: SessionRecord = {
      ...record,
      harnessName,
      ...(sessionIncarnation !== undefined ? { sessionIncarnation } : {}),
    };
    const nextVersion = opts.ifVersion + 1;
    const cols = sessionColumnValues(namespacedRecord, nextVersion);

    if (opts.ifVersion === 0) {
      await this.#renewLocalThreadDeleteFence(record.threadId);
      if (this.#localThreadDeleteFences.has(record.threadId)) {
        throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
      }
      // First insert. Race with another writer is caught by the PRIMARY KEY
      // constraint — translate that into the same conflict error.
      const tx = await this.#client.transaction('write');
      try {
        const fence = await tx.execute({
          sql: `SELECT thread_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                WHERE thread_id = ? AND expires_at > ?
                LIMIT 1`,
          args: [record.threadId, Date.now()],
        });
        if (fence.rows[0]) {
          throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
        }
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_SESSIONS}
                (${cols.names.join(', ')})
                VALUES (${cols.names.map(() => '?').join(', ')})`,
          args: cols.values,
        });
        await tx.commit();
      } catch (err) {
        if (!tx.closed) await tx.rollback();
        if (isUniqueConstraintError(err)) {
          const existing = await this.loadSession({ harnessName, sessionId: record.id });
          const active = await this.loadSessionByThread({
            harnessName,
            resourceId: record.resourceId,
            threadId: record.threadId,
          });
          throw new HarnessStorageVersionConflictError(
            record.id,
            opts.ifVersion,
            existing?.version ?? active?.version ?? 0,
          );
        }
        throw err;
      }
      return { version: nextVersion };
    }

    // Update path. Single statement does both the lease check and the CAS so
    // two concurrent writers cannot both succeed on the same predecessor.
    // We exclude owner_id and lease_expires_at from the update set — those
    // belong to the lease lifecycle methods.
    const updateNames = cols.names.filter(
      n =>
        n !== 'owner_id' &&
        n !== 'lease_expires_at' &&
        n !== 'id' &&
        n !== 'harness_name' &&
        !(this.#attachmentByteOwner && n === 'session_incarnation'),
    );
    const updateValues = updateNames.map(n => cols.values[cols.names.indexOf(n)]);

    const setClause = updateNames.map(n => `${n} = ?`).join(', ');
    const updateResult = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET ${setClause}
            WHERE harness_name = ?
              AND id = ?
              AND version = ?
              AND (
                owner_id IS NULL
                OR lease_expires_at IS NULL
                OR lease_expires_at <= ?
                OR owner_id = ?
              )`,
      args: [...updateValues, harnessName, record.id, opts.ifVersion, Date.now(), opts.ownerId],
    });

    if (updateResult.rowsAffected === 0) {
      // Distinguish lease conflict from version conflict by re-reading the row.
      const existing = await this.loadSession({ harnessName, sessionId: record.id });
      if (!existing) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
      }
      const now = Date.now();
      const leaseHeld =
        existing.ownerId !== undefined &&
        existing.leaseExpiresAt !== undefined &&
        existing.leaseExpiresAt > now &&
        existing.ownerId !== opts.ownerId;
      if (leaseHeld) {
        throw new HarnessStorageLeaseConflictError(record.id, existing.ownerId!, existing.leaseExpiresAt!);
      }
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
    }

    return { version: nextVersion };
  }

  async saveSessionWithAttachmentReferences(
    record: SessionRecord,
    opts: SaveSessionOptions,
    references: SaveAttachmentReferenceInput[],
  ): Promise<SaveSessionResult> {
    if (this.sessionRecordProjection.enabled) {
      return this.#saveSessionWithProjectionAndAttachmentReferences(record, opts, references);
    }
    if (opts.ifVersion === 0) {
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    }

    const harnessName = this.#resolveHarnessName(opts.harnessName ?? record.harnessName);
    const namespacedRecord: SessionRecord = { ...record, harnessName };
    const nextVersion = opts.ifVersion + 1;
    const cols = sessionColumnValues(namespacedRecord, nextVersion);
    const updateNames = cols.names.filter(
      n =>
        n !== 'owner_id' &&
        n !== 'lease_expires_at' &&
        n !== 'id' &&
        n !== 'harness_name' &&
        !(this.#attachmentByteOwner && n === 'session_incarnation'),
    );
    const updateValues = updateNames.map(n => cols.values[cols.names.indexOf(n)]);
    const setClause = updateNames.map(n => `${n} = ?`).join(', ');

    const tx = await this.#client.transaction('write');
    try {
      const updateResult = await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
              SET ${setClause}
              WHERE harness_name = ?
                AND id = ?
                AND version = ?
                AND (
                  owner_id IS NULL
                  OR lease_expires_at IS NULL
                  OR lease_expires_at <= ?
                  OR owner_id = ?
                )`,
        args: [...updateValues, harnessName, record.id, opts.ifVersion, Date.now(), opts.ownerId],
      });

      if (updateResult.rowsAffected === 0) {
        await tx.rollback();
        await this.#throwSaveSessionConflict(namespacedRecord, opts);
      }

      const createdAt = Date.now();
      for (const ref of references) {
        if (ref.harnessName !== undefined && this.#resolveHarnessName(ref.harnessName) !== harnessName) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        const attachment = await tx.execute({
          sql: `SELECT attachment_id, session_incarnation, blob_ref
	                FROM ${TABLE_HARNESS_ATTACHMENTS}
	                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
	                LIMIT 1
	                FOR KEY SHARE`,
          args: [harnessName, ref.sessionId, ref.attachmentId],
        });
        if (attachment.rows.length === 0) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        if (attachment.rows[0]!.session_incarnation == null || attachment.rows[0]!.blob_ref == null) {
          throw new HarnessStorageAttachmentByteOwnerError(ref.sessionId, ref.attachmentId);
        }
        await this.#assertAttachmentReferenceFenceTx(
          tx,
          harnessName,
          ref.sessionId,
          ref.attachmentId,
          ref.source,
          ref.sourceId,
          String(attachment.rows[0]!.session_incarnation),
        );
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                (harness_name, session_id, attachment_id, session_incarnation, source, source_id, retained_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (harness_name, session_id, attachment_id, source, source_id) DO UPDATE SET
                  session_incarnation = excluded.session_incarnation,
                  retained_until = excluded.retained_until`,
          args: [
            harnessName,
            ref.sessionId,
            ref.attachmentId,
            attachment.rows[0]!.session_incarnation ?? null,
            ref.source,
            ref.sourceId,
            ref.retainedUntil ?? null,
            createdAt,
          ],
        });
      }

      await tx.commit();
      return { version: nextVersion };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async #saveSessionWithProjection(record: SessionRecord, opts: SaveSessionOptions): Promise<SaveSessionResult> {
    const harnessName = this.#resolveHarnessName(opts.harnessName ?? record.harnessName);
    if (opts.ifVersion === 0) {
      await this.#renewLocalThreadDeleteFence(record.threadId);
      if (this.#localThreadDeleteFences.has(record.threadId)) {
        throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
      }
    }
    const tx = await this.#client.transaction('write');
    try {
      const now = Date.now();
      if (opts.ifVersion === 0) {
        const fence = await tx.execute({
          sql: `SELECT thread_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
                WHERE thread_id = ? AND expires_at > ? LIMIT 1`,
          args: [record.threadId, now],
        });
        if (fence.rows[0]) throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
        const sessionIncarnation = randomUUID();
        const namespacedRecord: SessionRecord = { ...record, harnessName, sessionIncarnation };
        const cols = sessionColumnValues(namespacedRecord, 1);
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_SESSIONS} (${cols.names.join(', ')}) VALUES (${cols.names.map(() => '?').join(', ')})`,
          args: cols.values,
        });
        const intent = this.#buildProjectionIntent(namespacedRecord, sessionIncarnation, 1, now);
        await this.#upsertProjectionFenceTx(
          tx,
          projectHarnessSessionRecordProjectionFence(namespacedRecord, {
            sessionIncarnation,
            state: 'active',
            revision: 1,
            updatedAt: now,
          }),
        );
        await this.#insertProjectionIntentTx(tx, intent);
        await this.#reserveProjectionCapacityTx(tx, intent);
        await tx.commit();
        return { version: 1 };
      }

      const existingResult = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ? FOR UPDATE`,
        args: [harnessName, record.id],
      });
      const existingRow = existingResult.rows[0] as Record<string, unknown> | undefined;
      if (!existingRow) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
      }
      const existing = rowToSession(existingRow);
      assertPgSessionLease(existing, opts.ownerId);
      if (existing.version !== opts.ifVersion) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
      }
      const sessionIncarnation = requirePgProjectionIncarnation(existing);
      if (record.sessionIncarnation !== undefined && record.sessionIncarnation !== sessionIncarnation) {
        throw new HarnessStorageSessionProjectionIncarnationError(record.id);
      }
      if (record.resourceId !== existing.resourceId) {
        throw new HarnessStorageSessionProjectionIdentityError(record.id, 'resourceId');
      }
      if (record.threadId !== existing.threadId) {
        throw new HarnessStorageSessionProjectionIdentityError(record.id, 'threadId');
      }
      const nextVersion = opts.ifVersion + 1;
      const namespacedRecord: SessionRecord = { ...record, harnessName, sessionIncarnation };
      const cols = sessionColumnValues(namespacedRecord, nextVersion);
      const updateNames = cols.names.filter(
        n => n !== 'owner_id' && n !== 'lease_expires_at' && n !== 'id' && n !== 'harness_name',
      );
      const updateValues = updateNames.map(n => cols.values[cols.names.indexOf(n)]);
      const updateResult = await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
              SET ${updateNames.map(n => `${n} = ?`).join(', ')}
              WHERE harness_name = ? AND id = ? AND version = ?
                AND (owner_id IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ? OR owner_id = ?)`,
        args: [...updateValues, harnessName, record.id, opts.ifVersion, now, opts.ownerId],
      });
      if (updateResult.rowsAffected === 0) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
      }
      const intent = this.#buildProjectionIntent(namespacedRecord, sessionIncarnation, nextVersion, now);
      await this.#upsertProjectionFenceTx(
        tx,
        projectHarnessSessionRecordProjectionFence(namespacedRecord, {
          sessionIncarnation,
          state: 'active',
          revision: nextVersion,
          updatedAt: now,
        }),
      );
      await this.#insertProjectionIntentTx(tx, intent);
      await this.#reserveProjectionCapacityTx(tx, intent);
      await tx.commit();
      return { version: nextVersion };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      if (opts.ifVersion === 0 && isUniqueConstraintError(err)) {
        const existing = await this.loadSession({ harnessName, sessionId: record.id });
        const active = await this.loadSessionByThread({
          harnessName,
          resourceId: record.resourceId,
          threadId: record.threadId,
        });
        throw new HarnessStorageVersionConflictError(
          record.id,
          opts.ifVersion,
          existing?.version ?? active?.version ?? 0,
        );
      }
      throw err;
    }
  }

  async #saveSessionWithProjectionAndAttachmentReferences(
    record: SessionRecord,
    opts: SaveSessionOptions,
    references: SaveAttachmentReferenceInput[],
  ): Promise<SaveSessionResult> {
    if (opts.ifVersion === 0) throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    const harnessName = this.#resolveHarnessName(opts.harnessName ?? record.harnessName);
    const tx = await this.#client.transaction('write');
    try {
      const now = Date.now();
      const existingResult = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ? FOR UPDATE`,
        args: [harnessName, record.id],
      });
      const existingRow = existingResult.rows[0] as Record<string, unknown> | undefined;
      if (!existingRow) throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
      const existing = rowToSession(existingRow);
      assertPgSessionLease(existing, opts.ownerId);
      if (existing.version !== opts.ifVersion) {
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
      }
      const sessionIncarnation = requirePgProjectionIncarnation(existing);
      if (record.sessionIncarnation !== undefined && record.sessionIncarnation !== sessionIncarnation) {
        throw new HarnessStorageSessionProjectionIncarnationError(record.id);
      }
      if (record.resourceId !== existing.resourceId) {
        throw new HarnessStorageSessionProjectionIdentityError(record.id, 'resourceId');
      }
      if (record.threadId !== existing.threadId) {
        throw new HarnessStorageSessionProjectionIdentityError(record.id, 'threadId');
      }
      const nextVersion = opts.ifVersion + 1;
      const namespacedRecord: SessionRecord = { ...record, harnessName, sessionIncarnation };
      const cols = sessionColumnValues(namespacedRecord, nextVersion);
      const updateNames = cols.names.filter(
        n => n !== 'owner_id' && n !== 'lease_expires_at' && n !== 'id' && n !== 'harness_name',
      );
      const updateValues = updateNames.map(n => cols.values[cols.names.indexOf(n)]);
      const updateResult = await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
              SET ${updateNames.map(n => `${n} = ?`).join(', ')}
              WHERE harness_name = ? AND id = ? AND version = ?
                AND (owner_id IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ? OR owner_id = ?)`,
        args: [...updateValues, harnessName, record.id, opts.ifVersion, now, opts.ownerId],
      });
      if (updateResult.rowsAffected === 0)
        throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);

      for (const ref of references) {
        if (ref.harnessName !== undefined && this.#resolveHarnessName(ref.harnessName) !== harnessName) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        const attachment = await tx.execute({
          sql: `SELECT attachment_id, session_incarnation, blob_ref FROM ${TABLE_HARNESS_ATTACHMENTS}
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
                LIMIT 1 FOR KEY SHARE`,
          args: [harnessName, ref.sessionId, ref.attachmentId],
        });
        if (attachment.rows.length === 0)
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        if (attachment.rows[0]!.session_incarnation == null || attachment.rows[0]!.blob_ref == null)
          throw new HarnessStorageAttachmentByteOwnerError(ref.sessionId, ref.attachmentId);
        await this.#assertAttachmentReferenceFenceTx(
          tx,
          harnessName,
          ref.sessionId,
          ref.attachmentId,
          ref.source,
          ref.sourceId,
          String(attachment.rows[0]!.session_incarnation),
        );
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                (harness_name, session_id, attachment_id, session_incarnation, source, source_id, retained_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (harness_name, session_id, attachment_id, source, source_id) DO UPDATE SET
                  session_incarnation = excluded.session_incarnation,
                  retained_until = excluded.retained_until`,
          args: [
            harnessName,
            ref.sessionId,
            ref.attachmentId,
            attachment.rows[0]!.session_incarnation ?? null,
            ref.source,
            ref.sourceId,
            ref.retainedUntil ?? null,
            now,
          ],
        });
      }

      const intent = this.#buildProjectionIntent(namespacedRecord, sessionIncarnation, nextVersion, now);
      await this.#upsertProjectionFenceTx(
        tx,
        projectHarnessSessionRecordProjectionFence(namespacedRecord, {
          sessionIncarnation,
          state: 'active',
          revision: nextVersion,
          updatedAt: now,
        }),
      );
      await this.#insertProjectionIntentTx(tx, intent);
      await this.#reserveProjectionCapacityTx(tx, intent);
      await tx.commit();
      return { version: nextVersion };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  #buildProjectionIntent(record: SessionRecord, sessionIncarnation: string, revision: number, createdAt: number) {
    return buildHarnessSessionRecordProjectionIntent(record, {
      sessionIncarnation,
      revision,
      createdAt,
      maxPayloadBytes: this.sessionRecordProjection.maxPayloadBytes,
    });
  }

  /**
   * Reserve the namespace quota as the final mutation before commit. Producers
   * already hold the session/fence/intent locks, matching ack/fail/delete's
   * fence -> intent -> pressure order while keeping the namespace lock short.
   */
  async #reserveProjectionCapacityTx(tx: PgHarnessClient, intent: HarnessSessionRecordProjectionIntent): Promise<void> {
    if (
      intent.payloadBytes > this.sessionRecordProjection.maxPendingBytes ||
      this.sessionRecordProjection.maxPendingIntents < 1
    ) {
      throw new HarnessStorageSessionProjectionBackpressureError(0, 0);
    }
    const result = await tx.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}
              (harness_name, pending_intents, pending_bytes, updated_at)
            VALUES (?, 1, ?, ?)
            ON CONFLICT (harness_name) DO UPDATE SET
              pending_intents = ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}.pending_intents + 1,
              pending_bytes = ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}.pending_bytes + excluded.pending_bytes,
              updated_at = excluded.updated_at
            WHERE ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}.pending_intents + 1 <= ?
              AND ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}.pending_bytes + excluded.pending_bytes <= ?
            RETURNING pending_intents, pending_bytes`,
      args: [
        intent.harnessName,
        intent.payloadBytes,
        intent.createdAt,
        this.sessionRecordProjection.maxPendingIntents,
        this.sessionRecordProjection.maxPendingBytes,
      ],
    });
    if (result.rows.length === 0) {
      const pressure = await this.#loadProjectionPressureTx(tx, intent.harnessName);
      throw new HarnessStorageSessionProjectionBackpressureError(
        pressure?.pendingIntents ?? 0,
        pressure?.pendingBytes ?? 0,
      );
    }
  }

  async #releaseProjectionCapacityTx(
    tx: PgHarnessClient,
    intent: HarnessSessionRecordProjectionIntent,
    updatedAt: number,
  ): Promise<void> {
    await tx.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}
            SET pending_intents = GREATEST(pending_intents - 1, 0),
                pending_bytes = GREATEST(pending_bytes - ?, 0),
                updated_at = ?
            WHERE harness_name = ?`,
      args: [intent.payloadBytes, updatedAt, intent.harnessName],
    });
  }

  async #releaseProjectionCapacityValuesTx(
    tx: PgHarnessClient,
    harnessName: string,
    pendingIntents: number,
    pendingBytes: number,
    updatedAt: number,
  ): Promise<void> {
    if (pendingIntents === 0 && pendingBytes === 0) return;
    await tx.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}
            SET pending_intents = GREATEST(pending_intents - ?, 0),
                pending_bytes = GREATEST(pending_bytes - ?, 0),
                updated_at = ?
            WHERE harness_name = ?`,
      args: [pendingIntents, pendingBytes, updatedAt, harnessName],
    });
  }

  async #loadProjectionPressureTx(
    tx: PgHarnessClient,
    harnessName: string,
  ): Promise<{ pendingIntents: number; pendingBytes: number } | undefined> {
    const result = await tx.execute({
      sql: `SELECT pending_intents, pending_bytes
            FROM ${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}
            WHERE harness_name = ?`,
      args: [harnessName],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { pendingIntents: Number(row.pending_intents), pendingBytes: Number(row.pending_bytes) };
  }

  async #retireProjectionIntentsTx(
    tx: PgHarnessClient,
    harnessName: string,
    sessionId: string,
    sessionIncarnation: string,
    updatedAt: number,
  ): Promise<{ pendingIntents: number; pendingBytes: number }> {
    const result = await tx.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}
            SET status = ?, dead_at = ?, failed_at = ?, claim_id = NULL, claim_expires_at = NULL,
                next_attempt_at = NULL, last_error = ?, updated_at = ?
            WHERE harness_name = ? AND session_id = ? AND session_incarnation = ?
              AND status IN (?, ?, ?)
            RETURNING payload_bytes`,
      args: [
        'dead',
        updatedAt,
        updatedAt,
        JSON.stringify({ code: 'session_projection.deleted', message: 'Session lifetime was deleted' }),
        updatedAt,
        harnessName,
        sessionId,
        sessionIncarnation,
        'pending',
        'claimed',
        'failed',
      ],
    });
    const pendingBytes = result.rows.reduce(
      (total, row) => total + Number((row as Record<string, unknown>).payload_bytes ?? 0),
      0,
    );
    return { pendingIntents: result.rows.length, pendingBytes };
  }

  async #upsertProjectionFenceTx(tx: PgHarnessClient, fence: HarnessSessionRecordProjectionFence): Promise<void> {
    await tx.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_SESSION_PROJECTION_FENCES}
              (harness_name, session_id, session_incarnation, resource_id, thread_id, revision, state, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (harness_name, session_id) DO UPDATE SET
              session_incarnation = excluded.session_incarnation,
              resource_id = excluded.resource_id,
              thread_id = excluded.thread_id,
              revision = excluded.revision,
              state = excluded.state,
              updated_at = excluded.updated_at`,
      args: [
        fence.harnessName,
        fence.sessionId,
        fence.sessionIncarnation,
        fence.resourceId,
        fence.threadId,
        fence.revision,
        fence.state,
        fence.updatedAt,
      ],
    });
  }

  async #insertProjectionIntentTx(tx: PgHarnessClient, intent: HarnessSessionRecordProjectionIntent): Promise<void> {
    await tx.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}
              (id, operation_id, harness_name, session_id, session_incarnation, resource_id, thread_id, revision,
               payload_digest, payload_bytes, payload, status, attempts, claim_id, claim_expires_at, next_attempt_at,
               applied_at, failed_at, dead_at, last_error, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        intent.id,
        intent.operationId,
        intent.harnessName,
        intent.sessionId,
        intent.sessionIncarnation,
        intent.resourceId,
        intent.threadId,
        intent.revision,
        intent.payloadDigest,
        intent.payloadBytes,
        JSON.stringify(intent.payload),
        intent.status,
        intent.attempts,
        intent.claimId ?? null,
        intent.claimExpiresAt ?? null,
        intent.nextAttemptAt ?? null,
        intent.appliedAt ?? null,
        intent.failedAt ?? null,
        intent.deadAt ?? null,
        intent.lastError ? JSON.stringify(intent.lastError) : null,
        intent.createdAt,
        intent.updatedAt,
      ],
    });
  }

  async #throwSaveSessionConflict(record: SessionRecord, opts: SaveSessionOptions): Promise<never> {
    const existing = await this.loadSession({ harnessName: record.harnessName, sessionId: record.id });
    if (!existing) {
      throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, 0);
    }
    const now = Date.now();
    const leaseHeld =
      existing.ownerId !== undefined &&
      existing.leaseExpiresAt !== undefined &&
      existing.leaseExpiresAt > now &&
      existing.ownerId !== opts.ownerId;
    if (leaseHeld) {
      throw new HarnessStorageLeaseConflictError(record.id, existing.ownerId!, existing.leaseExpiresAt!);
    }
    throw new HarnessStorageVersionConflictError(record.id, opts.ifVersion, existing.version);
  }

  async createOrLoadActiveSession(
    record: SessionRecord,
    opts: CreateOrLoadActiveSessionOptions,
  ): Promise<CreateOrLoadActiveSessionResult> {
    const harnessName = this.#resolveHarnessName(record.harnessName);
    await this.#renewLocalThreadDeleteFence(record.threadId);
    if (this.#localThreadDeleteFences.has(record.threadId)) {
      throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
    }
    let storageNow = Date.now();
    const tx = await this.#client.transaction('write');
    try {
      await this.#lockThreadDeleteFence(tx, record.threadId);
      storageNow = Date.now();
      const fence = await tx.execute({
        sql: `SELECT thread_id FROM ${TABLE_HARNESS_THREAD_DELETE_FENCES}
              WHERE thread_id = ? AND expires_at > ?
              LIMIT 1`,
        args: [record.threadId, storageNow],
      });
      if (fence.rows[0]) {
        throw new HarnessStorageThreadDeleteFenceConflictError(record.threadId);
      }

      // §5.3/§5.5: the current owner for this (harness, resource, thread)
      // INCLUDES Closed (reopenable) and Closing records — the caller reopens a
      // closed owner or fails new work on a closing one rather than minting a
      // second active record behind it. Filtering `closed_at IS NULL` here would
      // skip a closed owner and INSERT a fresh active row, diverging from
      // InMemory and orphaning the closed owner.
      const active = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS}
              WHERE harness_name = ? AND resource_id = ? AND thread_id = ?
              ORDER BY last_activity_at DESC
              LIMIT 1
              FOR UPDATE`,
        args: [harnessName, record.resourceId, record.threadId],
      });
      const activeRow = active.rows[0];
      if (activeRow) {
        if (this.sessionRecordProjection.enabled) {
          const existing = rowToSession(activeRow as Record<string, unknown>);
          const incarnation = requirePgProjectionIncarnation(existing);
          const fenceResult = await tx.execute({
            sql: `SELECT harness_name, session_id, session_incarnation, resource_id, thread_id, revision, state
                  FROM ${TABLE_HARNESS_SESSION_PROJECTION_FENCES}
                  WHERE harness_name = ? AND session_id = ? FOR UPDATE`,
            args: [harnessName, existing.id],
          });
          const projectionFence = rowToProjectionFence(fenceResult.rows[0] as Record<string, unknown> | undefined);
          assertPgProjectionFence(projectionFence, existing, incarnation, 'active');
        }
        await tx.commit();
        const existing = rowToSession(activeRow as Record<string, unknown>);
        return {
          record: existing,
          created: false,
          leaseAcquired: false,
          version: existing.version,
          expiresAt: existing.leaseExpiresAt,
          storageNow,
        };
      }

      if (record.parentSessionId !== undefined) {
        const parent = await tx.execute({
          sql: `SELECT resource_id, closed_at, closing_at, close_deadline_at FROM ${TABLE_HARNESS_SESSIONS}
                WHERE harness_name = ? AND id = ?
                LIMIT 1`,
          args: [harnessName, record.parentSessionId],
        });
        const parentRow = parent.rows[0] as Record<string, unknown> | undefined;
        if (!parentRow || String(parentRow.resource_id) !== record.resourceId) {
          throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'not_found');
        }
        if (parentRow.closed_at != null) {
          throw new HarnessStorageParentSessionUnavailableError(record.parentSessionId, 'closed');
        }
        if (parentRow.closing_at != null) {
          // §4.5b: carry the parent's closing window so the caller can build a
          // spec-accurate HarnessSessionClosingError instead of fabricating a
          // `Date.now()` window (InMemory passes these timestamps too).
          throw new HarnessStorageParentSessionUnavailableError(
            record.parentSessionId,
            'closing',
            parentRow.closing_at != null ? Number(parentRow.closing_at) : undefined,
            parentRow.close_deadline_at != null ? Number(parentRow.close_deadline_at) : undefined,
          );
        }
      }

      const existingById = await tx.execute({
        sql: `SELECT version FROM ${TABLE_HARNESS_SESSIONS}
              WHERE harness_name = ? AND id = ?
              LIMIT 1`,
        args: [harnessName, record.id],
      });
      if (existingById.rows[0]) {
        await tx.rollback();
        throw new HarnessStorageVersionConflictError(record.id, 0, Number(existingById.rows[0]!.version));
      }

      const expiresAt = storageNow + opts.initialLease.ttlMs;
      const sessionIncarnation =
        this.sessionRecordProjection.enabled || this.#attachmentByteOwner ? randomUUID() : undefined;
      const namespacedRecord: SessionRecord = {
        ...record,
        harnessName,
        ...(sessionIncarnation !== undefined ? { sessionIncarnation } : {}),
        ownerId: opts.initialLease.ownerId,
        leaseExpiresAt: expiresAt,
      };
      const cols = sessionColumnValues(namespacedRecord, 1);
      await tx.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_SESSIONS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      if (sessionIncarnation !== undefined) {
        const intent = this.#buildProjectionIntent(namespacedRecord, sessionIncarnation, 1, storageNow);
        await this.#upsertProjectionFenceTx(
          tx,
          projectHarnessSessionRecordProjectionFence(namespacedRecord, {
            sessionIncarnation,
            state: 'active',
            revision: 1,
            updatedAt: storageNow,
          }),
        );
        await this.#insertProjectionIntentTx(tx, intent);
        await this.#reserveProjectionCapacityTx(tx, intent);
      }
      await tx.commit();
      const created = rowToSession(Object.fromEntries(cols.names.map((name, index) => [name, cols.values[index]])));
      return {
        record: created,
        created: true,
        leaseAcquired: true,
        version: 1,
        expiresAt,
        storageNow,
      };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      if (isUniqueConstraintError(err)) {
        const active = await this.loadSessionByThread({
          harnessName,
          resourceId: record.resourceId,
          threadId: record.threadId,
        });
        if (active) {
          if (this.sessionRecordProjection.enabled) {
            const incarnation = requirePgProjectionIncarnation(active);
            const fenceResult = await this.#client.execute({
              sql: `SELECT * FROM ${TABLE_HARNESS_SESSION_PROJECTION_FENCES}
                    WHERE harness_name = ? AND session_id = ?`,
              args: [harnessName, active.id],
            });
            assertPgProjectionFence(
              rowToProjectionFence(fenceResult.rows[0] as Record<string, unknown> | undefined),
              active,
              incarnation,
              'active',
            );
          }
          return {
            record: active,
            created: false,
            leaseAcquired: false,
            version: active.version,
            expiresAt: active.leaseExpiresAt,
            storageNow,
          };
        }
        const existingById = await this.loadSession({ harnessName, sessionId: record.id });
        if (existingById) throw new HarnessStorageVersionConflictError(record.id, 0, existingById.version);
      }
      throw err;
    }
  }

  async deleteSession(opts: DeleteSessionOptions): Promise<void> {
    await this.deleteSessions({ sessions: [opts] });
  }

  async deleteSessions({ sessions }: { sessions: DeleteSessionOptions[] }): Promise<void> {
    await this.#ensureMessageResultsTable();
    await this.#ensureOperationTombstonesTable();
    await this.#ensureSessionEventsTable();
    await this.#ensureWorkspaceActionsTable();
    await this.#ensureChannelBindingsTable();
    await this.#ensurePlanTasksTable();
    const tx = await this.#client.transaction('write');
    const attachmentCleanupOperationIds: string[] = [];
    const deleteCandidates = new Map<
      string,
      {
        namespace: string;
        sessionId: string;
        resourceId: string;
        threadId: string;
        version: number;
        sessionIncarnation?: string;
      }
    >();
    try {
      for (const opts of sessions) {
        const { sessionId } = opts;
        const namespace = this.#resolveHarnessName(opts.harnessName);
        const existing = await tx.execute({
          sql: `SELECT version, session_incarnation, resource_id, thread_id, parent_session_id, created_at, closed_at
	                FROM ${TABLE_HARNESS_SESSIONS}
	                WHERE harness_name = ? AND id = ?
	                LIMIT 1
	                FOR UPDATE`,
          args: [namespace, sessionId],
        });
        const existingRow = existing.rows[0] as Record<string, unknown> | undefined;
        if (!existingRow) {
          // A previous delete may already have removed native metadata while
          // its external cleanup was ambiguous. A retry must resume those
          // durable intents even though the session row is gone.
          const outstanding = await tx.execute({
            sql: `SELECT id
                  FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
                  WHERE harness_name = ? AND session_id = ? AND kind = ?
                    AND status NOT IN (?, ?)
                  ORDER BY created_at ASC, id ASC`,
            args: [namespace, sessionId, 'delete', 'completed', 'cleaned'],
          });
          for (const row of outstanding.rows) attachmentCleanupOperationIds.push(String(row.id));
          continue;
        }

        const record = rowToDeleteGuardRecord(existingRow);
        const mismatch = getDeleteGuardMismatch(record, opts);
        if (mismatch) {
          throw new HarnessStorageDeleteGuardConflictError(
            sessionId,
            mismatch,
            opts.ifVersion ?? record.version,
            record.version,
          );
        }
        const sessionIncarnation =
          existingRow.session_incarnation == null ? undefined : String(existingRow.session_incarnation);
        if (this.sessionRecordProjection.enabled) {
          if (sessionIncarnation === undefined || sessionIncarnation.length === 0) {
            throw new HarnessStorageSessionProjectionIncarnationError(sessionId);
          }
          const fenceResult = await tx.execute({
            sql: `SELECT harness_name, session_id, session_incarnation, resource_id, thread_id, revision, state
                  FROM ${TABLE_HARNESS_SESSION_PROJECTION_FENCES}
                  WHERE harness_name = ? AND session_id = ? FOR UPDATE`,
            args: [namespace, sessionId],
          });
          const projectionFence = rowToProjectionFence(fenceResult.rows[0] as Record<string, unknown> | undefined);
          assertPgProjectionFenceValues(
            projectionFence,
            namespace,
            sessionId,
            sessionIncarnation,
            record.resourceId,
            record.threadId,
            record.version,
            'active',
          );
        }
        // A first upload reserves its PUT intent before the external byte
        // owner is called, so the attachment row may not exist yet. Fence the
        // whole session scope before deleting the session; otherwise a late
        // owner response could leave an orphaned object behind the deleted
        // incarnation.
        await this.#assertNoPendingAttachmentPutsTx(tx, namespace, sessionId);
        deleteCandidates.set(`${namespace}\u0000${sessionId}`, {
          namespace,
          sessionId,
          resourceId: record.resourceId,
          threadId: record.threadId,
          version: record.version,
          ...(sessionIncarnation !== undefined ? { sessionIncarnation } : {}),
        });
      }

      const retiredProjectionCapacity = new Map<string, { pendingIntents: number; pendingBytes: number }>();
      for (const {
        namespace,
        sessionId,
        resourceId,
        threadId,
        version,
        sessionIncarnation,
      } of deleteCandidates.values()) {
        let retired: { pendingIntents: number; pendingBytes: number } | undefined;
        if (this.sessionRecordProjection.enabled && sessionIncarnation !== undefined) {
          retired = await this.#retireProjectionIntentsTx(tx, namespace, sessionId, sessionIncarnation, Date.now());
        }
        const result = await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_SESSIONS}
                WHERE harness_name = ? AND id = ?`,
          args: [namespace, sessionId],
        });
        if (result.rowsAffected === 0) {
          throw new HarnessStorageVersionConflictError(sessionId, 0, 0);
        }
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
                WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?`,
          args: [namespace, sessionId, resourceId, threadId],
        });
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
                WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?`,
          args: [namespace, sessionId, resourceId, threadId],
        });
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_SESSION_EVENTS}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        if (this.sessionRecordProjection.enabled && sessionIncarnation !== undefined) {
          await tx.execute({
            sql: `UPDATE ${TABLE_HARNESS_SESSION_PROJECTION_FENCES}
                  SET state = ?, revision = ?, updated_at = ?
                  WHERE harness_name = ? AND session_id = ? AND session_incarnation = ?`,
            args: ['deleted', version, Date.now(), namespace, sessionId, sessionIncarnation],
          });
        }
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_WORKSPACE_ACTIONS}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        // §14.1: channel bindings are session-scoped. A deleted session must not
        // leave a binding behind, or it would still win loadChannelBindingByExternal
        // / resolveChannelBinding and block rebinding that conversation to a
        // replacement session (mirrors the in-memory cleanupDeletedSession sweep).
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_CHANNEL_BINDINGS}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        // §5.2g: cascade the whole plan-task tree owned by this session (every
        // node — all rows share session_id, so descendants are covered).
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_PLAN_TASKS}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        // A deleteAttachment call may already have removed a metadata row
        // while its external cleanup stayed unresolved. Collect those durable
        // intents before staging new ones — a successful session delete must
        // not abandon outstanding deletes just because the row is gone. This
        // runs before the staging loop so freshly staged ops are not
        // collected twice.
        const outstandingDeletes = await tx.execute({
          sql: `SELECT id
                FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
                WHERE harness_name = ? AND session_id = ? AND kind = ?
                  AND status NOT IN (?, ?)
                ORDER BY created_at ASC, id ASC`,
          args: [namespace, sessionId, 'delete', 'completed', 'cleaned'],
        });
        for (const row of outstandingDeletes.rows) attachmentCleanupOperationIds.push(String(row.id));
        const attachments = await tx.execute({
          sql: `SELECT * FROM ${TABLE_HARNESS_ATTACHMENTS}
                WHERE harness_name = ? AND session_id = ? FOR UPDATE`,
          args: [namespace, sessionId],
        });
        for (const attachment of attachments.rows) {
          this.#requireAttachmentByteOwner(sessionId, String(attachment.attachment_id));
          const attachmentId = String(attachment.attachment_id);
          const attachmentIncarnation = requireAttachmentIncarnation(attachment, sessionId, attachmentId);
          const putOperation = await this.#loadAttachmentOperationTx(
            tx,
            namespace,
            sessionId,
            attachmentId,
            attachmentIncarnation,
            'put',
          );
          if (putOperation && putOperation.status !== 'completed' && putOperation.status !== 'cleaned') {
            throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
          }
          const operation = await this.#stageAttachmentDeleteTx(tx, {
            namespace,
            sessionId,
            attachmentId,
            incarnation: attachmentIncarnation,
            name: String(attachment.name),
            mimeType: String(attachment.mime_type),
            source: toAttachmentSource(attachment.source),
            bytes: Number(attachment.size_bytes),
            sha256: String(attachment.sha256),
            semantic: rowToAttachmentSemantic(attachment),
            blobRef: requireAttachmentBlobRef(attachment, sessionId, attachmentId),
          });
          attachmentCleanupOperationIds.push(operation.id);
        }
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}
                WHERE harness_name = ? AND session_id = ?`,
          args: [namespace, sessionId],
        });
        if (retired !== undefined) {
          const previous = retiredProjectionCapacity.get(namespace) ?? { pendingIntents: 0, pendingBytes: 0 };
          previous.pendingIntents += retired.pendingIntents;
          previous.pendingBytes += retired.pendingBytes;
          retiredProjectionCapacity.set(namespace, previous);
        }
      }

      // Keep the pressure row lock after attachment cleanup. A concurrent
      // save that references one of these attachments may hold a key-share
      // lock while reserving its own projection capacity; releasing here
      // avoids a pressure-before-attachment cycle.
      for (const [namespace, capacity] of [...retiredProjectionCapacity.entries()].sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      )) {
        await this.#releaseProjectionCapacityValuesTx(
          tx,
          namespace,
          capacity.pendingIntents,
          capacity.pendingBytes,
          Date.now(),
        );
      }

      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
    let pendingError: unknown;
    for (const operationId of attachmentCleanupOperationIds) {
      try {
        await this.#reconcileAttachmentDeleteOperation(operationId, true);
      } catch (err) {
        pendingError ??= err;
      }
    }
    if (pendingError !== undefined) throw pendingError;
  }

  // -------------------------------------------------------------------------
  // Native session record projection
  // -------------------------------------------------------------------------

  async claimSessionRecordProjectionIntents(
    input: ClaimSessionRecordProjectionIntentsInput,
  ): Promise<HarnessSessionRecordProjectionIntent[]> {
    this.assertProjectionEnabled();
    assertPgProjectionClaimInput(input);
    const namespace = this.#resolveHarnessName(input.harnessName);
    const tx = await this.#client.transaction('write');
    try {
      const maxAttempts = this.sessionRecordProjection.maxAttempts;
      const commonClaimConditions = [
        'i.harness_name = ?',
        'f.harness_name = i.harness_name',
        'f.session_id = i.session_id',
        "f.state = 'active'",
        'f.session_incarnation = i.session_incarnation',
        'f.resource_id = i.resource_id',
        'f.thread_id = i.thread_id',
      ];
      const normalClaimConditions = [
        `i.attempts < ${maxAttempts}`,
        'i.status IN (?, ?, ?)',
        '(i.status <> ? OR i.claim_expires_at <= ?)',
        '(i.status NOT IN (?, ?) OR i.next_attempt_at IS NULL OR i.next_attempt_at <= ?)',
        `NOT EXISTS (
           SELECT 1 FROM ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS} predecessor
           WHERE predecessor.harness_name = i.harness_name
             AND predecessor.session_id = i.session_id
             AND predecessor.session_incarnation = i.session_incarnation
             AND predecessor.revision < i.revision
             AND predecessor.status IN (?, ?, ?)
         )`,
      ];
      const exhaustedClaimConditions = [
        `i.attempts >= ${maxAttempts}`,
        'i.status IN (?, ?, ?)',
        '(i.status <> ? OR i.claim_expires_at <= ?)',
      ];
      const claimConditions = [
        ...commonClaimConditions,
        `((${normalClaimConditions.join(' AND ')}) OR (${exhaustedClaimConditions.join(' AND ')}))`,
      ];
      const claimArgs: (string | number)[] = [
        namespace,
        'pending',
        'claimed',
        'failed',
        'claimed',
        input.now,
        'pending',
        'failed',
        input.now,
        'pending',
        'claimed',
        'failed',
        'pending',
        'claimed',
        'failed',
        'claimed',
        input.now,
      ];
      if (input.resourceId !== undefined) {
        claimConditions.push('i.resource_id = ?');
        claimArgs.push(input.resourceId);
      }
      if (input.sessionId !== undefined) {
        claimConditions.push('i.session_id = ?');
        claimArgs.push(input.sessionId);
      }
      // Lock only the bounded set of eligible fences first. All other
      // projection mutators use fence -> intent ordering, so a claim cannot
      // participate in an intent -> fence cycle. The second statement
      // rechecks every predicate while taking the intent locks and therefore
      // remains correct if a row changed before this transaction acquired its
      // fence lock.
      const candidates = await tx.execute({
        sql: `SELECT i.id
              FROM ${TABLE_HARNESS_SESSION_PROJECTION_FENCES} f
              JOIN ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS} i
                ON i.harness_name = f.harness_name AND i.session_id = f.session_id
              WHERE ${claimConditions.join(' AND ')}
              ORDER BY i.created_at ASC, i.revision ASC, i.operation_id ASC
              LIMIT ?
              FOR UPDATE OF f SKIP LOCKED`,
        args: [...claimArgs, input.limit],
      });
      const candidateIds = (candidates.rows as Record<string, unknown>[]).map(row => String(row.id));
      if (candidateIds.length === 0) {
        await tx.commit();
        return [];
      }

      const updateConditions = [
        ...commonClaimConditions,
        `i.id IN (${candidateIds.map(() => '?').join(', ')})`,
        `((${normalClaimConditions.join(' AND ')}) OR (${exhaustedClaimConditions.join(' AND ')}))`,
      ];
      const updateArgs: (string | number)[] = [
        namespace,
        ...candidateIds,
        'pending',
        'claimed',
        'failed',
        'claimed',
        input.now,
        'pending',
        'failed',
        input.now,
        'pending',
        'claimed',
        'failed',
        'pending',
        'claimed',
        'failed',
        'claimed',
        input.now,
      ];
      if (input.resourceId !== undefined) {
        updateConditions.push('i.resource_id = ?');
        updateArgs.push(input.resourceId);
      }
      if (input.sessionId !== undefined) {
        updateConditions.push('i.session_id = ?');
        updateArgs.push(input.sessionId);
      }
      const claimedRows = await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS} i
              SET status = CASE WHEN i.attempts >= ${maxAttempts} THEN ? ELSE ? END,
                  attempts = CASE WHEN i.attempts >= ${maxAttempts} THEN i.attempts ELSE i.attempts + 1 END,
                  claim_id = CASE WHEN i.attempts >= ${maxAttempts} THEN NULL ELSE ? END,
                  claim_expires_at = CASE WHEN i.attempts >= ${maxAttempts} THEN NULL ELSE CAST(? AS bigint) END,
                  dead_at = CASE WHEN i.attempts >= ${maxAttempts} THEN CAST(? AS bigint) ELSE i.dead_at END,
                  failed_at = CASE WHEN i.attempts >= ${maxAttempts} THEN CAST(? AS bigint) ELSE i.failed_at END,
                  next_attempt_at = CASE WHEN i.attempts >= ${maxAttempts} THEN NULL ELSE i.next_attempt_at END,
                  last_error = CASE WHEN i.attempts >= ${maxAttempts} THEN CAST(? AS jsonb) ELSE i.last_error END,
                  updated_at = ?
              FROM ${TABLE_HARNESS_SESSION_PROJECTION_FENCES} f
              WHERE ${updateConditions.join(' AND ')}
              RETURNING i.*`,
        args: [
          'dead',
          'claimed',
          input.claimId,
          input.now + input.claimTtlMs,
          input.now,
          input.now,
          JSON.stringify({ code: 'session_projection.max_attempts', message: 'Maximum projection attempts reached' }),
          input.now,
          ...updateArgs,
        ],
      });
      const updatedIntents = (claimedRows.rows as Record<string, unknown>[]).map(row => rowToProjectionIntent(row));
      const deadIntents = updatedIntents.filter(intent => intent.status === 'dead');
      if (deadIntents.length > 0) {
        await this.#releaseProjectionCapacityValuesTx(
          tx,
          namespace,
          deadIntents.length,
          deadIntents.reduce((total, intent) => total + intent.payloadBytes, 0),
          input.now,
        );
      }
      const claimedById = new Map(
        updatedIntents
          .filter(
            (intent): intent is HarnessSessionRecordProjectionIntent & { status: 'claimed' } =>
              intent.status === 'claimed',
          )
          .map(intent => [intent.id, intent] as const),
      );
      const claimed = candidateIds.flatMap(id => {
        const intent = claimedById.get(id);
        return intent === undefined ? [] : [intent];
      });
      await tx.commit();
      return claimed;
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async renewSessionRecordProjectionClaim(
    input: RenewSessionRecordProjectionClaimInput,
  ): Promise<{ claimExpiresAt: number; storageNow: number }> {
    this.assertProjectionEnabled();
    assertPgProjectionRenewInput(input);
    const tx = await this.#client.transaction('write');
    try {
      const namespace = this.#resolveHarnessName(input.harnessName);
      const fence = await this.#loadProjectionFenceTx(tx, namespace, input.sessionId);
      const intent = await this.#loadProjectionIntentTx(tx, namespace, input.operationId);
      assertPgProjectionIntentIdentity(
        intent,
        input.sessionId,
        input.sessionIncarnation,
        input.revision,
        input.payloadDigest,
      );
      if (!pgProjectionFenceMatches(fence, intent, 'active')) {
        throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId);
      }
      if (
        intent.status !== 'claimed' ||
        intent.claimId !== input.claimId ||
        (intent.claimExpiresAt ?? 0) <= input.now
      ) {
        throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId, input.claimId);
      }
      const expiresAt = input.now + input.claimTtlMs;
      await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}
              SET claim_expires_at = ?, updated_at = ? WHERE id = ? AND claim_id = ?`,
        args: [expiresAt, input.now, intent.id, input.claimId],
      });
      await tx.commit();
      return { claimExpiresAt: expiresAt, storageNow: input.now };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async ackSessionRecordProjection(input: AckSessionRecordProjectionInput): Promise<AckSessionRecordProjectionResult> {
    this.assertProjectionEnabled();
    assertPgProjectionAckInput(input);
    const acknowledgedAt = input.acknowledgedAt ?? Date.now();
    const tx = await this.#client.transaction('write');
    try {
      const namespace = this.#resolveHarnessName(input.harnessName);
      const fence = await this.#loadProjectionFenceTx(tx, namespace, input.sessionId);
      const intent = await this.#loadProjectionIntentTx(tx, namespace, input.operationId);
      assertPgProjectionIntentIdentity(
        intent,
        input.sessionId,
        input.sessionIncarnation,
        input.revision,
        input.payloadDigest,
      );
      if (!pgProjectionFenceMatches(fence, intent, 'active')) {
        await this.#markProjectionDeadTx(
          tx,
          intent,
          acknowledgedAt,
          'session_projection.fenced',
          'Session projection lifetime is fenced',
        );
        await tx.commit();
        return projectionAckResult(intent, 'fenced');
      }
      if (intent.status === 'applied') {
        await tx.commit();
        return projectionAckResult(intent, 'duplicate');
      }
      if (
        intent.status !== 'claimed' ||
        intent.claimId !== input.claimId ||
        (intent.claimExpiresAt ?? 0) <= acknowledgedAt
      ) {
        throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId, input.claimId);
      }
      await tx.execute({
        sql: `UPDATE ${
          TABLE_HARNESS_SESSION_PROJECTION_INTENTS
        } SET status = ?, applied_at = ?, claim_id = NULL, claim_expires_at = NULL, next_attempt_at = NULL, updated_at = ?
          WHERE id = ? AND status = ? AND claim_id = ?`,
        args: ['applied', acknowledgedAt, acknowledgedAt, intent.id, 'claimed', input.claimId],
      });
      await this.#releaseProjectionCapacityTx(tx, intent, acknowledgedAt);
      await tx.commit();
      return projectionAckResult({ ...intent, status: 'applied', appliedAt: acknowledgedAt }, 'applied');
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async failSessionRecordProjection(
    input: FailSessionRecordProjectionInput,
  ): Promise<HarnessSessionRecordProjectionIntent> {
    this.assertProjectionEnabled();
    assertPgProjectionFailInput(input);
    const failedAt = input.failedAt ?? Date.now();
    const tx = await this.#client.transaction('write');
    try {
      const namespace = this.#resolveHarnessName(input.harnessName);
      const fence = await this.#loadProjectionFenceTx(tx, namespace, input.sessionId);
      const intent = await this.#loadProjectionIntentTx(tx, namespace, input.operationId);
      assertPgProjectionIntentIdentity(
        intent,
        input.sessionId,
        input.sessionIncarnation,
        input.revision,
        input.payloadDigest,
      );
      if (!pgProjectionFenceMatches(fence, intent, 'active')) {
        throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId);
      }
      if (intent.status !== 'claimed' || intent.claimId !== input.claimId || (intent.claimExpiresAt ?? 0) <= failedAt) {
        throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId, input.claimId);
      }
      const terminal =
        input.dead === true ||
        input.error.retryable === false ||
        intent.attempts >= this.sessionRecordProjection.maxAttempts;
      const status = terminal ? 'dead' : 'failed';
      const nextAttemptAt = terminal ? null : (input.retryAt ?? failedAt);
      await tx.execute({
        sql: `UPDATE ${
          TABLE_HARNESS_SESSION_PROJECTION_INTENTS
        } SET status = ?, failed_at = ?, dead_at = ?, next_attempt_at = ?, claim_id = NULL, claim_expires_at = NULL,
              last_error = ?, updated_at = ? WHERE id = ? AND status = ? AND claim_id = ?`,
        args: [
          status,
          failedAt,
          terminal ? failedAt : null,
          nextAttemptAt,
          JSON.stringify(input.error),
          failedAt,
          intent.id,
          'claimed',
          input.claimId,
        ],
      });
      if (terminal) await this.#releaseProjectionCapacityTx(tx, intent, failedAt);
      await tx.commit();
      return {
        ...intent,
        status,
        failedAt,
        deadAt: terminal ? failedAt : undefined,
        nextAttemptAt: terminal ? undefined : (input.retryAt ?? failedAt),
        claimId: undefined,
        claimExpiresAt: undefined,
        lastError: { ...input.error },
        updatedAt: failedAt,
      };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async getSessionRecordProjectionQueuePressure(
    input: SessionRecordProjectionQueuePressureInput,
  ): Promise<SessionRecordProjectionQueuePressure> {
    this.assertProjectionEnabled();
    const namespace = this.#resolveHarnessName(input.harnessName);
    const namespacePressure =
      input.resourceId === undefined && input.sessionId === undefined
        ? await this.#loadProjectionPressureTx(this.#client, namespace)
        : undefined;
    const conditions = ['harness_name = ?'];
    const args: (string | number)[] = [namespace];
    if (input.resourceId !== undefined) {
      conditions.push('resource_id = ?');
      args.push(input.resourceId);
    }
    if (input.sessionId !== undefined) {
      conditions.push('session_id = ?');
      args.push(input.sessionId);
    }
    const result = await this.#client.execute({
      sql: `SELECT status, COUNT(*) AS count, COALESCE(SUM(payload_bytes), 0) AS payload_bytes,
                   MIN(created_at) FILTER (WHERE status IN ('pending', 'claimed', 'failed')) AS oldest_pending_at
            FROM ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}
            WHERE ${conditions.join(' AND ')} GROUP BY status`,
      args,
    });
    let pendingIntents = namespacePressure?.pendingIntents ?? 0;
    let pendingBytes = namespacePressure?.pendingBytes ?? 0;
    let claimedIntents = 0;
    let failedIntents = 0;
    let deadIntents = 0;
    let appliedIntents = 0;
    let oldestPendingAt: number | undefined;
    for (const row of result.rows as Record<string, unknown>[]) {
      const status = String(row.status);
      const count = Number(row.count);
      const bytes = Number(row.payload_bytes ?? 0);
      if (status === 'pending' || status === 'claimed' || status === 'failed') {
        if (namespacePressure === undefined) {
          pendingIntents += count;
          pendingBytes += bytes;
        }
        if (status === 'claimed') claimedIntents = count;
        if (status === 'failed') failedIntents = count;
        const oldest = row.oldest_pending_at == null ? undefined : Number(row.oldest_pending_at);
        if (oldest !== undefined)
          oldestPendingAt = oldestPendingAt === undefined ? oldest : Math.min(oldestPendingAt, oldest);
      } else if (status === 'dead') {
        deadIntents = count;
      } else if (status === 'applied') {
        appliedIntents = count;
      }
    }
    return {
      pendingIntents,
      pendingBytes,
      claimedIntents,
      failedIntents,
      deadIntents,
      appliedIntents,
      ...(oldestPendingAt !== undefined ? { oldestPendingAt } : {}),
      maxPendingIntents: this.sessionRecordProjection.maxPendingIntents,
      maxPendingBytes: this.sessionRecordProjection.maxPendingBytes,
      overLimit:
        pendingIntents >= this.sessionRecordProjection.maxPendingIntents ||
        pendingBytes >= this.sessionRecordProjection.maxPendingBytes,
    };
  }

  private assertProjectionEnabled(): void {
    if (!this.sessionRecordProjection.enabled) {
      throw new HarnessStorageSessionRecordProjectionUnsupportedError();
    }
  }

  async #loadProjectionIntentTx(
    tx: PgHarnessClient,
    harnessName: string,
    operationId: string,
  ): Promise<HarnessSessionRecordProjectionIntent> {
    const result = await tx.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}
            WHERE id = ? AND harness_name = ? FOR UPDATE`,
      args: [operationId, harnessName],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new HarnessStorageSessionProjectionClaimConflictError(operationId);
    return rowToProjectionIntent(row);
  }

  async #loadProjectionFenceTx(
    tx: PgHarnessClient,
    harnessName: string,
    sessionId: string,
  ): Promise<HarnessSessionRecordProjectionFence | undefined> {
    const result = await tx.execute({
      sql: `SELECT * FROM ${
        TABLE_HARNESS_SESSION_PROJECTION_FENCES
      } WHERE harness_name = ? AND session_id = ? FOR UPDATE`,
      args: [harnessName, sessionId],
    });
    return rowToProjectionFence(result.rows[0] as Record<string, unknown> | undefined);
  }

  async #markProjectionDeadTx(
    tx: PgHarnessClient,
    intent: HarnessSessionRecordProjectionIntent,
    now: number,
    code: string,
    message: string,
  ): Promise<void> {
    if (intent.status === 'applied' || intent.status === 'dead') return;
    await tx.execute({
      sql: `UPDATE ${
        TABLE_HARNESS_SESSION_PROJECTION_INTENTS
      } SET status = ?, dead_at = ?, failed_at = ?, claim_id = NULL, claim_expires_at = NULL,
            next_attempt_at = NULL, last_error = ?, updated_at = ? WHERE id = ?`,
      args: ['dead', now, now, JSON.stringify({ code, message }), now, intent.id],
    });
    await this.#releaseProjectionCapacityTx(tx, intent, now);
  }

  // -------------------------------------------------------------------------
  // Session leases
  // -------------------------------------------------------------------------

  async acquireSessionLease({
    sessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: AcquireSessionLeaseInput): Promise<SessionLeaseResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET owner_id = ?, lease_expires_at = ?
            WHERE harness_name = ?
              AND id = ?
              AND (
                owner_id IS NULL
                OR lease_expires_at IS NULL
                OR lease_expires_at <= ?
                OR owner_id = ?
              )
            RETURNING version`,
      args: [ownerId, expiresAt, namespace, sessionId, now, ownerId],
    });

    if (result.rows.length === 0) {
      const existing = await this.loadSession({ harnessName: namespace, sessionId });
      if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);
      throw new HarnessStorageLeaseConflictError(
        sessionId,
        existing.ownerId ?? '<unowned>',
        existing.leaseExpiresAt ?? 0,
      );
    }

    return { version: Number(result.rows[0]!.version), expiresAt };
  }

  async renewSessionLease({
    sessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: RenewSessionLeaseInput): Promise<SessionLeaseResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET lease_expires_at = ?
            WHERE harness_name = ?
              AND id = ?
              AND owner_id = ?
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at > ?
            RETURNING version`,
      args: [expiresAt, namespace, sessionId, ownerId, now],
    });

    if (result.rows.length === 0) {
      const existing = await this.loadSession({ harnessName: namespace, sessionId });
      if (!existing) throw new HarnessStorageSessionNotFoundError(sessionId);
      throw new HarnessStorageLeaseConflictError(
        sessionId,
        existing.ownerId ?? '<unowned>',
        existing.leaseExpiresAt ?? 0,
      );
    }

    return { version: Number(result.rows[0]!.version), expiresAt };
  }

  async renewSessionLeaseSubtree({
    rootSessionId,
    ownerId,
    ttlMs,
    harnessName,
  }: RenewSessionLeaseSubtreeInput): Promise<SubtreeSessionLeaseResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const now = Date.now();
    const expiresAt = now + ttlMs;

    // §5.8 atomic subtree renewal: one transaction locks the root, gathers every
    // ACTIVE (non-closed) descendant under one owner, then renews root + descendants
    // to one capped expiry — all-or-nothing, so a foreign-owned descendant fences
    // the whole pass (no parent-only partial commit). The final UPDATE is guarded by
    // `owner_id = ?` and an affected-count check, so a concurrent ownership change
    // slipping in under READ COMMITTED fails the renewal closed rather than committing
    // a partial subtree.
    const tx = await this.#client.transaction('write');
    try {
      const rootResult = await tx.execute({
        sql: `SELECT version, owner_id, lease_expires_at FROM ${TABLE_HARNESS_SESSIONS}
              WHERE harness_name = ? AND id = ?
              FOR UPDATE`,
        args: [namespace, rootSessionId],
      });
      const rootRow = rootResult.rows[0] as Record<string, unknown> | undefined;
      if (!rootRow) throw new HarnessStorageSessionNotFoundError(rootSessionId);
      const rootOwner = (rootRow.owner_id ?? null) as string | null;
      const rootExpires = rootRow.lease_expires_at == null ? undefined : Number(rootRow.lease_expires_at);
      if (rootOwner !== ownerId || rootExpires === undefined || rootExpires <= now) {
        throw new HarnessStorageLeaseConflictError(rootSessionId, rootOwner ?? '<unowned>', rootExpires ?? 0);
      }

      // Walk parentSessionId via a recursive CTE.
      const descendantsResult = await tx.execute({
        // UNION (not UNION ALL) row-dedupes the frontier so a parent_session_id
        // cycle (the storage boundary does not hard-enforce parentage immutability)
        // terminates instead of recursing until the engine's depth cap. Mirrors the
        // visited-set guard the in-memory adapter uses.
        sql: `WITH RECURSIVE subtree(id, owner_id, closed_at, closing_at) AS (
                SELECT id, owner_id, closed_at, closing_at FROM ${TABLE_HARNESS_SESSIONS}
                WHERE harness_name = ? AND parent_session_id = ?
                UNION
                SELECT s.id, s.owner_id, s.closed_at, s.closing_at FROM ${TABLE_HARNESS_SESSIONS} s
                JOIN subtree ON s.parent_session_id = subtree.id
                WHERE s.harness_name = ?
              )
              SELECT id, owner_id FROM subtree WHERE closed_at IS NULL AND closing_at IS NULL`,
        args: [namespace, rootSessionId, namespace],
      });

      const descendantIds: string[] = [];
      for (const row of descendantsResult.rows as Record<string, unknown>[]) {
        const childId = row.id as string;
        const childOwner = (row.owner_id ?? null) as string | null;
        if (childOwner !== ownerId) {
          throw new HarnessStorageLeaseConflictError(childId, childOwner ?? '<unowned>', 0);
        }
        descendantIds.push(childId);
      }

      const allIds = [rootSessionId, ...descendantIds];
      const updateResult = await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
              SET lease_expires_at = ?
              WHERE harness_name = ? AND owner_id = ?
                AND closed_at IS NULL
                AND id IN (${allIds.map(() => '?').join(', ')})`,
        args: [expiresAt, namespace, ownerId, ...allIds],
      });
      if (updateResult.rowsAffected !== allIds.length) {
        // A concurrent ownership change OR a hard CLOSE (closed_at written) slipped
        // in between the read and the write — fail closed, renewing NOTHING (the
        // rollback discards any partial update). A CLOSED row holds no live lease
        // (§5.8) so it is excluded here and trips this guard. The guard does NOT
        // exclude `closing` rows: the close-drain path keeps renewing a CLOSING
        // ROOT's lease while it waits (harness `_renewLiveSessionLeaseSubtree`
        // renews `live` OR `closing` roots), and closing DESCENDANTS are already
        // dropped from `allIds` by the recursive-CTE selector above.
        throw new HarnessStorageLeaseConflictError(rootSessionId, ownerId, expiresAt);
      }

      await tx.commit();
      return { version: Number(rootRow.version), expiresAt, renewedDescendantCount: descendantIds.length };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async releaseSessionLease({ sessionId, ownerId, harnessName }: ReleaseSessionLeaseInput): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const exists = await this.#client.execute({
      sql: `SELECT 1 FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ? LIMIT 1`,
      args: [namespace, sessionId],
    });
    if (exists.rows.length === 0) {
      throw new HarnessStorageSessionNotFoundError(sessionId);
    }

    // No-op if we're not the current owner.
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET owner_id = NULL, lease_expires_at = NULL
            WHERE harness_name = ? AND id = ? AND owner_id = ?`,
      args: [namespace, sessionId, ownerId],
    });
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  async saveAttachment({
    sessionId,
    attachmentId,
    harnessName,
    name,
    mimeType,
    source,
    data,
    semantic,
  }: SaveAttachmentInput): Promise<SaveAttachmentResult> {
    const namespace = this.#resolveHarnessName(harnessName);
    const sha256 = sha256Hex(data);
    const bytes = data.byteLength;
    if (bytes > DEFAULT_HARNESS_ATTACHMENT_MAX_BYTES) {
      throw new HarnessStorageAttachmentByteOwnerError(sessionId, attachmentId);
    }
    const owner = this.#requireAttachmentByteOwner(sessionId, attachmentId);
    const semanticJson = JSON.stringify(semantic ?? { kind: 'file' });
    let operation: PgAttachmentOperation;
    let incarnation: string;

    const reservation = await this.#client.transaction('write');
    try {
      incarnation = await this.#attachmentSessionIncarnationTx(reservation, namespace, sessionId);
      // Reject identities the byte-owner contract can never address before a
      // durable PUT exists; otherwise the operation could never reconcile and
      // would fence session deletion forever.
      assertHarnessAttachmentOwnerScope({ harnessName: namespace, sessionId, attachmentId, incarnation });
      const existingResult = await reservation.execute({
        sql: `SELECT *
              FROM ${TABLE_HARNESS_ATTACHMENTS}
              WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
              FOR UPDATE`,
        args: [namespace, sessionId, attachmentId],
      });
      const existing = existingResult.rows[0];
      if (
        existing &&
        !attachmentRowMatchesInput(existing, {
          name,
          mimeType,
          source,
          bytes,
          sha256,
          incarnation,
          semantic,
        })
      ) {
        throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
      }
      operation = await this.#reserveAttachmentPutTx(reservation, {
        namespace,
        sessionId,
        attachmentId,
        incarnation,
        name,
        mimeType,
        source,
        bytes,
        sha256,
        semanticJson,
      });
      await reservation.commit();
    } catch (err) {
      if (!reservation.closed) await reservation.rollback();
      throw err;
    }

    let saved: Awaited<ReturnType<HarnessAttachmentByteOwner['save']>>;
    try {
      saved = await owner.save({
        owner: { harnessName: namespace, sessionId, attachmentId, incarnation },
        operationId: operation.id,
        data,
        expectedBytes: bytes,
        expectedSha256: sha256,
        mimeType,
      });
    } catch {
      await this.#markAttachmentOperationUnknown(operation.id, {
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
    }
    if (saved.outcome === 'unknown') {
      let blobRef: string | undefined;
      try {
        blobRef =
          saved.blobRef === undefined ? undefined : validateAttachmentBlobRef(saved.blobRef, sessionId, attachmentId);
      } catch {
        await this.#markAttachmentOperationUnknown(operation.id, {
          observedNextAttemptAt: operation.nextAttemptAt,
        });
        throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
      }
      await this.#markAttachmentOperationUnknown(operation.id, {
        blobRef,
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
    }
    let savedBlobRef: string;
    try {
      savedBlobRef = validateAttachmentBlobRef(saved.blobRef, sessionId, attachmentId);
    } catch {
      await this.#markAttachmentOperationUnknown(operation.id, {
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
    }
    if (operation.blobRef !== undefined && operation.blobRef !== savedBlobRef) {
      await this.#markAttachmentOperationUnknown(operation.id, {
        blobRef: operation.blobRef,
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
    }

    const commitTx = await this.#client.transaction('write');
    try {
      const sessionResult = await commitTx.execute({
        sql: `SELECT session_incarnation
              FROM ${TABLE_HARNESS_SESSIONS}
              WHERE harness_name = ? AND id = ?
              LIMIT 1
              FOR KEY SHARE`,
        args: [namespace, sessionId],
      });
      if (sessionResult.rows.length === 0 || String(sessionResult.rows[0]!.session_incarnation ?? '') !== incarnation) {
        throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
      }
      const currentAttachmentResult = await commitTx.execute({
        sql: `SELECT * FROM ${
          TABLE_HARNESS_ATTACHMENTS
        } WHERE harness_name = ? AND session_id = ? AND attachment_id = ? FOR UPDATE`,
        args: [namespace, sessionId, attachmentId],
      });
      const currentAttachment = currentAttachmentResult.rows[0];
      const opResult = await commitTx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS} WHERE id = ? FOR UPDATE`,
        args: [operation.id],
      });
      if (!opResult.rows[0]) throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
      const currentOperation = rowToAttachmentOperation(opResult.rows[0]);
      if (currentOperation.status === 'cleaned') {
        throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
      }
      if (currentOperation.status === 'claimed') {
        throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
      }
      const deleteOperation = await this.#loadAttachmentOperationTx(
        commitTx,
        namespace,
        sessionId,
        attachmentId,
        incarnation,
        'delete',
      );
      if (deleteOperation) {
        if (deleteOperation.status === 'completed') {
          throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
        }
        throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
      }
      if (
        currentAttachment &&
        !attachmentRowMatchesInput(currentAttachment, {
          name,
          mimeType,
          source,
          bytes,
          sha256,
          incarnation,
          semantic,
        })
      ) {
        throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
      }
      if (currentAttachment && String(currentAttachment.blob_ref ?? '') !== savedBlobRef) {
        throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
      }
      if (!currentAttachment) {
        const insertResult = await commitTx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENTS}
                (harness_name, session_id, attachment_id, name, mime_type, size_bytes, sha256, source,
                 kind, primitive_type, element_type, renderer_json, schema_id, metadata_json, object_json,
                 created_at, data_b64, session_incarnation, blob_ref, put_operation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
                ON CONFLICT (harness_name, session_id, attachment_id) DO NOTHING`,
          args: [
            namespace,
            sessionId,
            attachmentId,
            name,
            mimeType,
            bytes,
            sha256,
            source,
            semantic?.kind ?? 'file',
            semantic?.primitiveType ?? null,
            semantic?.elementType ?? null,
            semantic?.renderer ? JSON.stringify(semantic.renderer) : null,
            semantic?.schemaId ?? null,
            semantic?.metadata ? JSON.stringify(semantic.metadata) : null,
            semantic?.object ? JSON.stringify(semantic.object) : null,
            Date.now(),
            incarnation,
            savedBlobRef,
            operation.id,
          ],
        });
        if (insertResult.rowsAffected === 0) {
          // A concurrent identical save committed between the earlier FOR
          // UPDATE read and this insert. Reload the committed row and verify
          // it carries this operation's identity rather than failing on the
          // lost insert race. Plain read: this transaction already holds the
          // operation lock, and taking the attachment row lock here would
          // invert the attachment→operation order every other path uses —
          // a third save mid-reservation deadlocks against it. A concurrent
          // delete committing in between linearizes as delete-after-save;
          // its staged operation still reconciles the stored bytes.
          const reloaded = await commitTx.execute({
            sql: `SELECT * FROM ${TABLE_HARNESS_ATTACHMENTS}
                  WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
            args: [namespace, sessionId, attachmentId],
          });
          const committed = reloaded.rows[0];
          if (
            !committed ||
            !attachmentRowMatchesInput(committed, {
              name,
              mimeType,
              source,
              bytes,
              sha256,
              incarnation,
              semantic,
            }) ||
            String(committed.blob_ref ?? '') !== savedBlobRef ||
            String(committed.put_operation_id ?? '') !== operation.id
          ) {
            throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
          }
        }
      }
      await commitTx.execute({
        sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
              SET status = ?, blob_ref = ?, updated_at = ?, completed_at = ?
              WHERE id = ?`,
        args: ['completed', savedBlobRef, Date.now(), Date.now(), operation.id],
      });
      await commitTx.commit();
      return { attachmentId, bytes, sha256 };
    } catch (err) {
      if (!commitTx.closed) await commitTx.rollback();
      if (err instanceof HarnessStorageAttachmentConflictError) {
        // The byte owner has already accepted this PUT. Preserve its exact
        // identity in the durable ledger even when metadata lost a same-ID
        // race, so a later reconciler can still make a cleanup decision.
        await this.#markAttachmentOperationUnknown(operation.id, {
          blobRef: savedBlobRef,
          observedNextAttemptAt: operation.nextAttemptAt,
        });
        throw err;
      }
      // A commit response/error is ambiguous: the durable operation remains
      // available for an exact retry and is never converted into success.
      await this.#markAttachmentOperationUnknown(operation.id, {
        blobRef: savedBlobRef,
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
    }
  }

  async loadAttachment({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<LoadedAttachment | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT name, mime_type, size_bytes, sha256, blob_ref, session_incarnation,
                   kind, primitive_type, element_type, renderer_json, schema_id, metadata_json, object_json
            FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
      args: [namespace, sessionId, attachmentId],
    });
    const row = result.rows[0];
    if (!row) return null;
    const owner = this.#requireAttachmentByteOwner(sessionId, attachmentId);
    const blobRef = row.blob_ref == null ? undefined : String(row.blob_ref);
    const incarnation = row.session_incarnation == null ? undefined : String(row.session_incarnation);
    if (!blobRef || !incarnation) throw new HarnessStorageAttachmentByteOwnerError(sessionId, attachmentId);
    let data: Uint8Array | null;
    try {
      data = await owner.load({
        blobRef,
        owner: { harnessName: namespace, sessionId, attachmentId, incarnation },
        expectedBytes: Number(row.size_bytes),
        expectedSha256: String(row.sha256),
        maxBytes: DEFAULT_HARNESS_ATTACHMENT_MAX_BYTES,
      });
    } catch {
      throw new HarnessStorageAttachmentByteOwnerError(sessionId, attachmentId);
    }
    if (data === null) throw new HarnessStorageAttachmentUnavailableError(sessionId, attachmentId);
    if (data.byteLength !== Number(row.size_bytes) || sha256Hex(data) !== String(row.sha256)) {
      throw new HarnessAttachmentByteOwnerIntegrityError('stored_bytes');
    }
    return {
      name: String(row.name),
      mimeType: String(row.mime_type),
      bytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      data,
      semantic: rowToAttachmentSemantic(row),
    };
  }

  async deleteAttachment({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const tx = await this.#client.transaction('write');
    let operationId: string | undefined;
    try {
      const attachmentResult = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_ATTACHMENTS}
              WHERE harness_name = ? AND session_id = ? AND attachment_id = ? FOR UPDATE`,
        args: [namespace, sessionId, attachmentId],
      });
      const attachment = attachmentResult.rows[0];
      if (!attachment) {
        const sessionResult = await tx.execute({
          sql: `SELECT session_incarnation
                FROM ${TABLE_HARNESS_SESSIONS}
                WHERE harness_name = ? AND id = ?
                LIMIT 1
                FOR KEY SHARE`,
          args: [namespace, sessionId],
        });
        const sessionIncarnation = sessionResult.rows[0]?.session_incarnation;
        if (sessionIncarnation != null && String(sessionIncarnation).length > 0) {
          const putOperation = await this.#loadAttachmentOperationTx(
            tx,
            namespace,
            sessionId,
            attachmentId,
            String(sessionIncarnation),
            'put',
          );
          if (putOperation && putOperation.status !== 'completed' && putOperation.status !== 'cleaned') {
            throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
          }
        }
        const existingOperation = await this.#loadAttachmentOperationTx(
          tx,
          namespace,
          sessionId,
          attachmentId,
          undefined,
          'delete',
        );
        operationId = existingOperation?.id;
        await tx.commit();
      } else {
        const references = await tx.execute({
          sql: `SELECT source, source_id, retained_until
                FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
                ORDER BY source ASC, source_id ASC`,
          args: [namespace, sessionId, attachmentId],
        });
        if (references.rows.length > 0) {
          throw new HarnessStorageAttachmentInUseError(
            sessionId,
            attachmentId,
            references.rows.map(rowToAttachmentReference),
          );
        }
        this.#requireAttachmentByteOwner(sessionId, attachmentId);
        const incarnation = requireAttachmentIncarnation(attachment, sessionId, attachmentId);
        const putOperation = await this.#loadAttachmentOperationTx(
          tx,
          namespace,
          sessionId,
          attachmentId,
          incarnation,
          'put',
        );
        if (putOperation && putOperation.status !== 'completed') {
          throw new HarnessStorageAttachmentPendingError(sessionId, attachmentId);
        }
        const blobRef = requireAttachmentBlobRef(attachment, sessionId, attachmentId);
        const operation = await this.#stageAttachmentDeleteTx(tx, {
          namespace,
          sessionId,
          attachmentId,
          incarnation,
          name: String(attachment.name),
          mimeType: String(attachment.mime_type),
          source: toAttachmentSource(attachment.source),
          bytes: Number(attachment.size_bytes),
          sha256: String(attachment.sha256),
          semantic: rowToAttachmentSemantic(attachment),
          blobRef,
        });
        operationId = operation.id;
        await tx.execute({
          sql: `DELETE FROM ${
            TABLE_HARNESS_ATTACHMENTS
          } WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
          args: [namespace, sessionId, attachmentId],
        });
        await tx.commit();
      }
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
    if (operationId !== undefined) await this.#reconcileAttachmentDeleteOperation(operationId, true);
  }

  async deleteAttachmentsForSession({
    sessionId,
    harnessName,
  }: {
    sessionId: string;
    harnessName?: string;
  }): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const tx = await this.#client.transaction('write');
    const operationIds: string[] = [];
    try {
      // Attachment rows lock before operation rows, matching the save paths. A
      // pending-PUT check that waits on a saver's operation lock keeps that
      // lock after the rechecked row turns terminal, so taking it first
      // inverts the order and deadlocks a saver waiting on this row set.
      const attachments = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_ATTACHMENTS}
              WHERE harness_name = ? AND session_id = ? FOR UPDATE`,
        args: [namespace, sessionId],
      });
      await this.#assertNoPendingAttachmentPutsTx(tx, namespace, sessionId);
      if (attachments.rows.length > 0)
        this.#requireAttachmentByteOwner(sessionId, String(attachments.rows[0]!.attachment_id));
      for (const attachment of attachments.rows) {
        const references = await tx.execute({
          sql: `SELECT 1 FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ? LIMIT 1`,
          args: [namespace, sessionId, String(attachment.attachment_id)],
        });
        if (references.rows.length > 0) continue;
        const incarnation = requireAttachmentIncarnation(attachment, sessionId, String(attachment.attachment_id));
        const putOperation = await this.#loadAttachmentOperationTx(
          tx,
          namespace,
          sessionId,
          String(attachment.attachment_id),
          incarnation,
          'put',
        );
        if (putOperation && putOperation.status !== 'completed') {
          throw new HarnessStorageAttachmentPendingError(sessionId, String(attachment.attachment_id));
        }
        const operation = await this.#stageAttachmentDeleteTx(tx, {
          namespace,
          sessionId,
          attachmentId: String(attachment.attachment_id),
          incarnation,
          name: String(attachment.name),
          mimeType: String(attachment.mime_type),
          source: toAttachmentSource(attachment.source),
          bytes: Number(attachment.size_bytes),
          sha256: String(attachment.sha256),
          semantic: rowToAttachmentSemantic(attachment),
          blobRef: requireAttachmentBlobRef(attachment, sessionId, String(attachment.attachment_id)),
        });
        operationIds.push(operation.id);
        await tx.execute({
          sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENTS}
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
          args: [namespace, sessionId, String(attachment.attachment_id)],
        });
      }
      const outstanding = await tx.execute({
        sql: `SELECT id
              FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
              WHERE harness_name = ? AND session_id = ? AND kind = ?
                AND status NOT IN (?, ?)
              ORDER BY created_at ASC, id ASC`,
        args: [namespace, sessionId, 'delete', 'completed', 'cleaned'],
      });
      for (const row of outstanding.rows) {
        const operationId = String(row.id);
        if (!operationIds.includes(operationId)) operationIds.push(operationId);
      }
      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
    for (const operationId of operationIds) await this.#reconcileAttachmentDeleteOperation(operationId, true);
  }

  async getAttachmentRecord({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<AttachmentRecord | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT session_id, attachment_id, name, mime_type, size_bytes, sha256, source,
                   kind, primitive_type, element_type, renderer_json, schema_id, metadata_json, object_json,
                   created_at
            FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
      args: [namespace, sessionId, attachmentId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
      ownerSessionId: String(row.session_id),
      attachmentId: String(row.attachment_id),
      name: String(row.name),
      mimeType: String(row.mime_type),
      bytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      source: toAttachmentSource(row.source),
      ...rowToAttachmentSemantic(row),
      createdAt: Number(row.created_at),
    };
  }

  async recordAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    const createdAt = Date.now();
    const tx = await this.#client.transaction('write');
    try {
      for (const ref of references) {
        const namespace = this.#resolveHarnessName(ref.harnessName);
        const attachment = await tx.execute({
          sql: `SELECT attachment_id, session_incarnation, blob_ref
                FROM ${TABLE_HARNESS_ATTACHMENTS}
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
                LIMIT 1
                FOR KEY SHARE`,
          args: [namespace, ref.sessionId, ref.attachmentId],
        });
        if (attachment.rows.length === 0) {
          throw new HarnessStorageAttachmentUnavailableError(ref.sessionId, ref.attachmentId);
        }
        if (attachment.rows[0]!.session_incarnation == null || attachment.rows[0]!.blob_ref == null) {
          throw new HarnessStorageAttachmentByteOwnerError(ref.sessionId, ref.attachmentId);
        }
        await this.#assertAttachmentReferenceFenceTx(
          tx,
          namespace,
          ref.sessionId,
          ref.attachmentId,
          ref.source,
          ref.sourceId,
          String(attachment.rows[0]!.session_incarnation),
        );
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
                (harness_name, session_id, attachment_id, session_incarnation, source, source_id, retained_until, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (harness_name, session_id, attachment_id, source, source_id) DO UPDATE SET
                  session_incarnation = excluded.session_incarnation,
                  retained_until = excluded.retained_until`,
          args: [
            namespace,
            ref.sessionId,
            ref.attachmentId,
            attachment.rows[0]!.session_incarnation ?? null,
            ref.source,
            ref.sourceId,
            ref.retainedUntil ?? null,
            createdAt,
          ],
        });
      }
      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async deleteAttachmentReferences(references: SaveAttachmentReferenceInput[]): Promise<void> {
    for (const ref of references) {
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
              WHERE harness_name = ? AND session_id = ? AND attachment_id = ? AND source = ? AND source_id = ?`,
        args: [this.#resolveHarnessName(ref.harnessName), ref.sessionId, ref.attachmentId, ref.source, ref.sourceId],
      });
    }
  }

  async listAttachmentReferences({
    sessionId,
    attachmentId,
    harnessName,
  }: {
    sessionId: string;
    attachmentId: string;
    harnessName?: string;
  }): Promise<AttachmentReference[]> {
    const namespace = this.#resolveHarnessName(harnessName);
    const result = await this.#client.execute({
      sql: `SELECT source, source_id, retained_until
            FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
            ORDER BY source ASC, source_id ASC`,
      args: [namespace, sessionId, attachmentId],
    });
    return result.rows.map(rowToAttachmentReference);
  }

  /**
   * Claims and advances durable external-byte operations. This is deliberately
   * an explicit native adapter surface: an app may schedule it from its normal
   * maintenance loop without giving the byte owner access to PG metadata.
   */
  async reconcileAttachmentOperations(options: { harnessName?: string; limit?: number; now?: number } = {}): Promise<{
    processed: number;
    pending: number;
  }> {
    const requestedLimit = options.limit ?? 25;
    const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 25;
    const namespace = this.#resolveHarnessName(options.harnessName);
    const now = options.now ?? Date.now();
    let processed = 0;
    for (;;) {
      if (processed >= limit) break;
      const candidate = await this.#client.execute({
        sql: `SELECT id, kind
              FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
              WHERE harness_name = ?
                AND (
                  (kind = ? AND status IN (?, ?, ?))
                  OR (kind = ? AND status IN (?, ?, ?))
                  OR (status = ? AND claim_expires_at <= ?)
                )
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
              ORDER BY created_at ASC, id ASC
              LIMIT 1`,
        args: [
          namespace,
          'delete',
          'pending',
          'unknown',
          'cleanup_pending',
          'put',
          'pending',
          'unknown',
          'cleanup_pending',
          'claimed',
          now,
          now,
        ],
      });
      const operationId = candidate.rows[0]?.id;
      if (operationId === undefined) break;
      if (String(candidate.rows[0]?.kind) === 'put') {
        await this.#reconcileAttachmentPutOperation(String(operationId), now);
      } else {
        await this.#reconcileAttachmentDeleteOperation(String(operationId), false, now);
      }
      processed += 1;
    }
    const pending = await this.#client.execute({
      sql: `SELECT COUNT(*)::text AS count
            FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            WHERE harness_name = ? AND kind IN (?, ?) AND status NOT IN (?, ?)`,
      args: [namespace, 'delete', 'put', 'completed', 'cleaned'],
    });
    return { processed, pending: Number(pending.rows[0]?.count ?? 0) };
  }

  #requireAttachmentByteOwner(sessionId: string, attachmentId: string): HarnessAttachmentByteOwner {
    if (!this.#attachmentByteOwner) throw new HarnessStorageAttachmentByteOwnerError(sessionId, attachmentId);
    return this.#attachmentByteOwner;
  }

  async #attachmentSessionIncarnationTx(tx: PgHarnessClient, namespace: string, sessionId: string): Promise<string> {
    const result = await tx.execute({
      sql: `SELECT session_incarnation
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND id = ?
            LIMIT 1
            FOR KEY SHARE`,
      args: [namespace, sessionId],
    });
    const row = result.rows[0];
    if (!row || row.session_incarnation == null || String(row.session_incarnation).length === 0) {
      throw new HarnessStorageAttachmentByteOwnerError(sessionId, 'session');
    }
    return String(row.session_incarnation);
  }

  async #loadAttachmentOperationTx(
    tx: PgHarnessClient,
    namespace: string,
    sessionId: string,
    attachmentId: string,
    incarnation: string | undefined,
    kind: HarnessAttachmentOperationKind,
  ): Promise<PgAttachmentOperation | undefined> {
    const whereIncarnation = incarnation === undefined ? '' : ' AND session_incarnation = ?';
    const pendingOnly = incarnation === undefined ? ' AND status <> ?' : '';
    const args = [
      namespace,
      sessionId,
      attachmentId,
      ...(incarnation === undefined ? [] : [incarnation]),
      kind,
      ...(incarnation === undefined ? ['completed'] : []),
    ];
    const result = await tx.execute({
      sql: `SELECT *
            FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?${whereIncarnation}
              AND kind = ?${pendingOnly}
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            FOR UPDATE`,
      args,
    });
    return result.rows[0] ? rowToAttachmentOperation(result.rows[0]) : undefined;
  }

  async #assertNoPendingAttachmentPutsTx(tx: PgHarnessClient, namespace: string, sessionId: string): Promise<void> {
    const result = await tx.execute({
      sql: `SELECT attachment_id
            FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            WHERE harness_name = ? AND session_id = ? AND kind = ?
              AND status NOT IN (?, ?)
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            FOR UPDATE`,
      args: [namespace, sessionId, 'put', 'completed', 'cleaned'],
    });
    const row = result.rows[0];
    if (row) throw new HarnessStorageAttachmentPendingError(sessionId, String(row.attachment_id));
  }

  async #assertAttachmentReferenceFenceTx(
    tx: PgHarnessClient,
    namespace: string,
    sessionId: string,
    attachmentId: string,
    source: AttachmentReference['source'],
    sourceId: string,
    sessionIncarnation: string,
  ): Promise<void> {
    const result = await tx.execute({
      sql: `SELECT session_incarnation
            FROM ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ? AND source = ? AND source_id = ?
            LIMIT 1
            FOR UPDATE`,
      args: [namespace, sessionId, attachmentId, source, sourceId],
    });
    const existing = result.rows[0]?.session_incarnation;
    if (result.rows[0] && String(existing ?? '') !== sessionIncarnation) {
      throw new HarnessStorageAttachmentConflictError(sessionId, attachmentId);
    }
  }

  async #reserveAttachmentPutTx(
    tx: PgHarnessClient,
    input: {
      namespace: string;
      sessionId: string;
      attachmentId: string;
      incarnation: string;
      name: string;
      mimeType: string;
      source: AttachmentRecord['source'];
      bytes: number;
      sha256: string;
      semanticJson: string;
    },
  ): Promise<PgAttachmentOperation> {
    const now = Date.now();
    await tx.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            (id, harness_name, session_id, attachment_id, session_incarnation, kind, status,
             name, mime_type, source, size_bytes, sha256, semantic_json, attempts, created_at, updated_at, next_attempt_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (harness_name, session_id, attachment_id, session_incarnation, kind) DO NOTHING`,
      args: [
        randomUUID(),
        input.namespace,
        input.sessionId,
        input.attachmentId,
        input.incarnation,
        'put',
        'pending',
        input.name,
        input.mimeType,
        input.source,
        input.bytes,
        input.sha256,
        input.semanticJson,
        0,
        now,
        now,
        now + HARNESS_ATTACHMENT_PUT_ABANDONMENT_DELAY_MS,
      ],
    });
    const operation = await this.#loadAttachmentOperationTx(
      tx,
      input.namespace,
      input.sessionId,
      input.attachmentId,
      input.incarnation,
      'put',
    );
    if (!operation || !attachmentOperationMatchesInput(operation, input)) {
      throw new HarnessStorageAttachmentConflictError(input.sessionId, input.attachmentId);
    }
    if (operation.status === 'cleaned') {
      throw new HarnessStorageAttachmentConflictError(input.sessionId, input.attachmentId);
    }
    if (operation.status === 'claimed') {
      throw new HarnessStorageAttachmentPendingError(input.sessionId, input.attachmentId);
    }
    if (operation.status !== 'completed') {
      const nextAttemptAt = Date.now() + HARNESS_ATTACHMENT_PUT_ABANDONMENT_DELAY_MS;
      await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
              SET next_attempt_at = ?, updated_at = ?
              WHERE id = ? AND status NOT IN (?, ?)`,
        args: [nextAttemptAt, Date.now(), operation.id, 'completed', 'cleaned'],
      });
      operation.nextAttemptAt = nextAttemptAt;
    }
    const deleteOperation = await this.#loadAttachmentOperationTx(
      tx,
      input.namespace,
      input.sessionId,
      input.attachmentId,
      input.incarnation,
      'delete',
    );
    if (deleteOperation) {
      if (deleteOperation.status === 'completed') {
        throw new HarnessStorageAttachmentConflictError(input.sessionId, input.attachmentId);
      }
      throw new HarnessStorageAttachmentPendingError(input.sessionId, input.attachmentId);
    }
    return operation;
  }

  async #stageAttachmentDeleteTx(
    tx: PgHarnessClient,
    input: {
      namespace: string;
      sessionId: string;
      attachmentId: string;
      incarnation: string;
      name: string;
      mimeType: string;
      source: AttachmentRecord['source'];
      bytes: number;
      sha256: string;
      semantic?: AttachmentSemanticMetadata;
      blobRef: string;
    },
  ): Promise<PgAttachmentOperation> {
    // Same pre-flight as the PUT path: a stored identity the byte-owner
    // contract cannot address must fail here rather than persist a cleanup
    // operation that can never reconcile.
    assertHarnessAttachmentOwnerScope({
      harnessName: input.namespace,
      sessionId: input.sessionId,
      attachmentId: input.attachmentId,
      incarnation: input.incarnation,
    });
    const existing = await this.#loadAttachmentOperationTx(
      tx,
      input.namespace,
      input.sessionId,
      input.attachmentId,
      input.incarnation,
      'delete',
    );
    if (existing) {
      if (
        existing.blobRef !== input.blobRef ||
        existing.sizeBytes !== input.bytes ||
        existing.sha256 !== input.sha256
      ) {
        throw new HarnessStorageAttachmentConflictError(input.sessionId, input.attachmentId);
      }
      return existing;
    }
    const now = Date.now();
    await tx.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            (id, harness_name, session_id, attachment_id, session_incarnation, kind, status,
             name, mime_type, source, size_bytes, sha256, semantic_json, blob_ref, attempts, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (harness_name, session_id, attachment_id, session_incarnation, kind) DO NOTHING`,
      args: [
        randomUUID(),
        input.namespace,
        input.sessionId,
        input.attachmentId,
        input.incarnation,
        'delete',
        'pending',
        input.name,
        input.mimeType,
        input.source,
        input.bytes,
        input.sha256,
        input.semantic ? JSON.stringify(input.semantic) : null,
        input.blobRef,
        0,
        now,
        now,
      ],
    });
    const operation = await this.#loadAttachmentOperationTx(
      tx,
      input.namespace,
      input.sessionId,
      input.attachmentId,
      input.incarnation,
      'delete',
    );
    if (!operation) throw new HarnessStorageAttachmentPendingError(input.sessionId, input.attachmentId);
    return operation;
  }

  async #claimAttachmentOperation(operationId: string, eligibleAsOf?: number): Promise<AttachmentOperationClaim> {
    const claimId = randomUUID();
    const now = Date.now();
    const tx = await this.#client.transaction('write');
    try {
      const result = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_ATTACHMENT_OPERATIONS} WHERE id = ? FOR UPDATE`,
        args: [operationId],
      });
      const operation = result.rows[0] ? rowToAttachmentOperation(result.rows[0]) : undefined;
      if (!operation || operation.status === 'completed' || operation.status === 'cleaned') {
        await tx.commit();
        return { state: 'done', operation };
      }
      if (operation.status === 'claimed' && (operation.claimExpiresAt ?? 0) > now) {
        await tx.commit();
        return { state: 'busy', operation };
      }
      // A retry may have renewed the operation's deferral between the
      // caller's eligibility select and this row lock. Honor the refreshed
      // next_attempt_at rather than claiming — and potentially cancelling —
      // an upload that is actively in flight. Direct callers resuming a
      // known operation omit the clock: the caller is itself the retry.
      if (eligibleAsOf !== undefined && (operation.nextAttemptAt ?? 0) > eligibleAsOf) {
        await tx.commit();
        return { state: 'busy', operation };
      }
      await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
              SET status = ?, claim_id = ?, claim_expires_at = ?, attempts = attempts + 1,
                  updated_at = ?
              WHERE id = ?`,
        args: ['claimed', claimId, now + 60_000, now, operationId],
      });
      await tx.commit();
      return { state: 'claimed', operation, claimId };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async #markAttachmentOperationUnknown(
    operationId: string,
    options: { blobRef?: string; claimId?: string; observedNextAttemptAt?: number } = {},
  ): Promise<void> {
    const { blobRef, claimId, observedNextAttemptAt } = options;
    // A caller holding an expired claim must not clear a fresher claim: the
    // first disjunct excludes every claimed row, the second admits only this
    // exact claim. Terminal transitions stay claim-gated either way, but
    // without the exclusion a stale holder would silently discard live work.
    const claimCondition =
      claimId === undefined ? 'status NOT IN (?, ?, ?)' : '(status NOT IN (?, ?, ?) OR (status = ? AND claim_id = ?))';
    const claimArgs =
      claimId === undefined
        ? ['completed', 'cleaned', 'claimed']
        : ['completed', 'cleaned', 'claimed', 'claimed', claimId];
    // Only pull the deferral back to the short retry delay when nothing moved
    // it past the deadline this attempt observed at reserve/claim time. A
    // concurrent retry renewing the reservation mid-upload pushes
    // next_attempt_at forward; a stale failure must not erase that window or
    // a sweep could cancel the newer upload while it is still running.
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            SET status = ?, blob_ref = COALESCE(?, blob_ref), claim_id = NULL,
                claim_expires_at = NULL,
                next_attempt_at = CASE WHEN COALESCE(next_attempt_at, 0) <= ? THEN ? ELSE next_attempt_at END,
                updated_at = ?, last_error = ?
            WHERE id = ? AND ${claimCondition}`,
      args: [
        'unknown',
        blobRef ?? null,
        observedNextAttemptAt ?? 0,
        Date.now() + 1_000,
        Date.now(),
        JSON.stringify({ code: 'external_unknown' }),
        operationId,
        ...claimArgs,
      ],
    });
  }

  async #markAttachmentOperationCleaned(operationId: string, claimId: string): Promise<void> {
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            SET status = ?, claim_id = NULL, claim_expires_at = NULL, next_attempt_at = NULL,
                updated_at = ?, completed_at = ?, last_error = ?
            WHERE id = ? AND claim_id = ?`,
      args: ['cleaned', Date.now(), Date.now(), JSON.stringify({ code: 'orphan_cleaned' }), operationId, claimId],
    });
  }

  async #markAttachmentOperationCompleted(operationId: string, claimId: string): Promise<void> {
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_OPERATIONS}
            SET status = ?, claim_id = NULL, claim_expires_at = NULL, next_attempt_at = NULL,
                updated_at = ?, completed_at = ?, last_error = NULL
            WHERE id = ? AND claim_id = ?`,
      args: ['completed', Date.now(), Date.now(), operationId, claimId],
    });
  }

  async #cancelAttachmentPutOperation(operation: PgAttachmentOperation, claimId: string): Promise<boolean> {
    const owner = this.#requireAttachmentByteOwner(operation.sessionId, operation.attachmentId);
    let outcome: Awaited<ReturnType<HarnessAttachmentByteOwner['cancel']>>;
    try {
      outcome = await owner.cancel({
        owner: {
          harnessName: operation.harnessName,
          sessionId: operation.sessionId,
          attachmentId: operation.attachmentId,
          incarnation: operation.sessionIncarnation,
        },
        operationId: operation.id,
        expectedBytes: operation.sizeBytes,
        expectedSha256: operation.sha256,
      });
    } catch {
      await this.#markAttachmentOperationUnknown(operation.id, {
        blobRef: operation.blobRef,
        claimId,
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      return false;
    }
    if (outcome.outcome === 'unknown') {
      await this.#markAttachmentOperationUnknown(operation.id, {
        blobRef: operation.blobRef,
        claimId,
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      return false;
    }
    await this.#markAttachmentOperationCleaned(operation.id, claimId);
    return true;
  }

  async #reconcileAttachmentPutOperation(operationId: string, eligibleAsOf: number): Promise<boolean> {
    const claim = await this.#claimAttachmentOperation(operationId, eligibleAsOf);
    if (claim.state === 'done') return true;
    if (claim.state === 'busy') return false;
    const { operation, claimId } = claim;
    if (operation.blobRef === undefined) {
      return this.#cancelAttachmentPutOperation(operation, claimId);
    }

    const session = await this.#client.execute({
      sql: `SELECT session_incarnation
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND id = ?
            LIMIT 1`,
      args: [operation.harnessName, operation.sessionId],
    });
    const attachment = await this.#client.execute({
      sql: `SELECT size_bytes, sha256, session_incarnation, blob_ref
            FROM ${TABLE_HARNESS_ATTACHMENTS}
            WHERE harness_name = ? AND session_id = ? AND attachment_id = ?
            LIMIT 1`,
      args: [operation.harnessName, operation.sessionId, operation.attachmentId],
    });

    const sessionIncarnation = session.rows[0]?.session_incarnation;
    const sameSessionIncarnation =
      sessionIncarnation != null && String(sessionIncarnation) === operation.sessionIncarnation;
    if (sameSessionIncarnation && attachment.rows.length === 0) {
      return this.#cancelAttachmentPutOperation(operation, claimId);
    }

    const owner = this.#requireAttachmentByteOwner(operation.sessionId, operation.attachmentId);
    if (sameSessionIncarnation && attachment.rows.length > 0) {
      const row = attachment.rows[0]!;
      if (
        Number(row.size_bytes) !== operation.sizeBytes ||
        String(row.sha256) !== operation.sha256 ||
        String(row.session_incarnation ?? '') !== operation.sessionIncarnation ||
        String(row.blob_ref ?? '') !== operation.blobRef
      ) {
        return this.#cancelAttachmentPutOperation(operation, claimId);
      }
      let data: Uint8Array | null;
      try {
        data = await owner.load({
          blobRef: operation.blobRef,
          owner: {
            harnessName: operation.harnessName,
            sessionId: operation.sessionId,
            attachmentId: operation.attachmentId,
            incarnation: operation.sessionIncarnation,
          },
          expectedBytes: operation.sizeBytes,
          expectedSha256: operation.sha256,
          maxBytes: DEFAULT_HARNESS_ATTACHMENT_MAX_BYTES,
        });
      } catch {
        await this.#markAttachmentOperationUnknown(operationId, {
          blobRef: operation.blobRef,
          claimId,
          observedNextAttemptAt: operation.nextAttemptAt,
        });
        return false;
      }
      if (data === null || data.byteLength !== operation.sizeBytes || sha256Hex(data) !== operation.sha256) {
        await this.#markAttachmentOperationUnknown(operationId, {
          blobRef: operation.blobRef,
          claimId,
          observedNextAttemptAt: operation.nextAttemptAt,
        });
        return false;
      }
      await this.#markAttachmentOperationCompleted(operationId, claimId);
      return true;
    }

    return this.#cancelAttachmentPutOperation(operation, claimId);
  }

  async #reconcileAttachmentDeleteOperation(
    operationId: string,
    throwOnUnknown: boolean,
    eligibleAsOf?: number,
  ): Promise<boolean> {
    const claim = await this.#claimAttachmentOperation(operationId, eligibleAsOf);
    if (claim.state === 'done') return true;
    if (claim.state === 'busy') {
      if (throwOnUnknown) {
        throw new HarnessStorageAttachmentPendingError(claim.operation.sessionId, claim.operation.attachmentId);
      }
      return false;
    }
    const { operation, claimId } = claim;
    if (!operation || operation.blobRef === undefined) {
      // The claim just taken makes the row 'claimed', so the transition must
      // carry claimId — without it the update cannot match and the operation
      // would spin claim/abandon instead of becoming unknown.
      await this.#markAttachmentOperationUnknown(operationId, {
        blobRef: operation?.blobRef,
        claimId,
        observedNextAttemptAt: operation?.nextAttemptAt,
      });
      if (throwOnUnknown)
        throw new HarnessStorageAttachmentPendingError(operation?.sessionId ?? '', operation?.attachmentId ?? '');
      return false;
    }
    const owner = this.#requireAttachmentByteOwner(operation.sessionId, operation.attachmentId);
    let outcome: Awaited<ReturnType<HarnessAttachmentByteOwner['delete']>>;
    try {
      outcome = await owner.delete({
        blobRef: operation.blobRef,
        owner: {
          harnessName: operation.harnessName,
          sessionId: operation.sessionId,
          attachmentId: operation.attachmentId,
          incarnation: operation.sessionIncarnation,
        },
        expectedBytes: operation.sizeBytes,
        expectedSha256: operation.sha256,
      });
    } catch {
      await this.#markAttachmentOperationUnknown(operationId, {
        blobRef: operation.blobRef,
        claimId,
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      if (throwOnUnknown) throw new HarnessStorageAttachmentPendingError(operation.sessionId, operation.attachmentId);
      return false;
    }
    if (outcome.outcome === 'unknown') {
      await this.#markAttachmentOperationUnknown(operationId, {
        blobRef: operation.blobRef,
        claimId,
        observedNextAttemptAt: operation.nextAttemptAt,
      });
      if (throwOnUnknown) throw new HarnessStorageAttachmentPendingError(operation.sessionId, operation.attachmentId);
      return false;
    }
    await this.#markAttachmentOperationCompleted(operationId, claimId);
    return true;
  }

  // -------------------------------------------------------------------------
  // Admission/result evidence
  // -------------------------------------------------------------------------

  async loadMessageResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    signalId: string;
  }): Promise<AgentSignalResultEvidence | OperationAdmissionTombstone | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#ensureMessageResultsTable();
    const retainedResult = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?
              AND signal_id = ?
            LIMIT 1`,
      args: [namespace, sessionId, resourceId, threadId, signalId],
    });
    const retained = retainedResult.rows[0];
    if (retained) return rowToMessageResultEvidence(retained as Record<string, unknown>);
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?
              AND kind IN ('signal', 'message') AND signal_id = ?
            LIMIT 1`,
      args: [namespace, sessionId, resourceId, threadId, signalId],
    });
    const row = result.rows[0];
    return row ? rowToTombstone(row as Record<string, unknown>) : null;
  }

  async writeMessageResultEvidence(record: AgentSignalResultEvidence): Promise<WriteMessageResultEvidenceResult> {
    await this.#ensureMessageResultsTable();
    const namespacedRecord = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    if (namespacedRecord.status === 'completed') completedMessageEvidenceRunId(namespacedRecord);
    const id = messageEvidenceId(namespacedRecord);
    const loadCurrent = async () => {
      const current = await this.loadMessageResultEvidence({
        harnessName: namespacedRecord.harnessName,
        sessionId: namespacedRecord.sessionId,
        resourceId: namespacedRecord.resourceId,
        threadId: namespacedRecord.threadId,
        signalId: namespacedRecord.signalId,
      });
      return current && 'status' in current ? (current as AgentSignalResultEvidence) : null;
    };
    const tx = await this.#client.transaction('write');
    let created = false;
    try {
      const existing = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS} WHERE id = ? LIMIT 1 FOR UPDATE`,
        args: [id],
      });
      if (existing.rows[0]) {
        const current = rowToMessageResultEvidence(existing.rows[0] as Record<string, unknown>);
        if (!sameMessageEvidenceIdentity(current, namespacedRecord)) {
          throw new HarnessStorageAdmissionConflictError(
            namespacedRecord.sessionId,
            'signal',
            namespacedRecord.admissionId ?? namespacedRecord.signalId,
          );
        }
        if (
          current.operationKind !== undefined &&
          namespacedRecord.operationKind !== undefined &&
          current.operationKind !== namespacedRecord.operationKind
        ) {
          throw new HarnessStorageAdmissionConflictError(
            namespacedRecord.sessionId,
            'signal',
            namespacedRecord.admissionId ?? namespacedRecord.signalId,
          );
        }
        if (isTerminalMessageEvidence(current)) {
          await tx.commit();
          return { created: false, applied: false, evidence: current };
        }
        if (isDispatchFencedAdmission(current)) {
          await tx.commit();
          return { created: false, applied: false, evidence: current };
        }
        const updated = {
          ...namespacedRecord,
          modeId: namespacedRecord.modeId ?? current.modeId,
          modelId: namespacedRecord.modelId ?? current.modelId,
          operationKind: namespacedRecord.operationKind ?? current.operationKind,
          dispatch: namespacedRecord.dispatch ?? current.dispatch,
          createdAt: current.createdAt,
        };
        const update = await tx.execute({
          sql: `UPDATE ${TABLE_HARNESS_MESSAGE_RESULTS}
                SET run_id = ?, mode_id = ?, model_id = ?, operation_kind = ?, status = ?, dispatch = ?, result = ?, error = ?, updated_at = ?
                WHERE id = ? AND status = 'pending'
                  AND operation_kind IS NOT DISTINCT FROM ?
                  AND dispatch IS NOT DISTINCT FROM CAST(? AS jsonb)
                  AND run_id IS NOT DISTINCT FROM ?`,
          args: [
            namespacedRecord.runId ?? null,
            updated.modeId ?? null,
            updated.modelId ?? null,
            updated.operationKind ?? null,
            namespacedRecord.status,
            updated.dispatch === undefined ? null : JSON.stringify(updated.dispatch),
            'result' in namespacedRecord ? JSON.stringify(namespacedRecord.result) : null,
            'error' in namespacedRecord ? JSON.stringify(namespacedRecord.error) : null,
            namespacedRecord.updatedAt,
            id,
            current.operationKind ?? null,
            current.dispatch === undefined ? null : JSON.stringify(current.dispatch),
            current.runId ?? null,
          ],
        });
        if (update.rowsAffected === 0) {
          await tx.commit();
          return { created: false, applied: false, evidence: current };
        }
        await tx.commit();
        return { created: false, applied: true, evidence: updated };
      } else {
        created = true;
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_MESSAGE_RESULTS}
                (id, harness_name, session_id, resource_id, thread_id, signal_id, run_id, mode_id, model_id,
                 admission_id, admission_hash, operation_kind, status, dispatch, result, error, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            namespacedRecord.harnessName,
            namespacedRecord.sessionId,
            namespacedRecord.resourceId,
            namespacedRecord.threadId,
            namespacedRecord.signalId,
            namespacedRecord.runId ?? null,
            namespacedRecord.modeId ?? null,
            namespacedRecord.modelId ?? null,
            namespacedRecord.admissionId ?? null,
            namespacedRecord.admissionHash ?? null,
            namespacedRecord.operationKind ?? null,
            namespacedRecord.status,
            namespacedRecord.dispatch === undefined ? null : JSON.stringify(namespacedRecord.dispatch),
            'result' in namespacedRecord ? JSON.stringify(namespacedRecord.result) : null,
            'error' in namespacedRecord ? JSON.stringify(namespacedRecord.error) : null,
            namespacedRecord.createdAt,
            namespacedRecord.updatedAt,
          ],
        });
      }
      await tx.commit();
      return { created, applied: true };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      if (isUniqueConstraintError(err)) {
        const current = await loadCurrent();
        if (current && sameMessageEvidenceIdentity(current as AgentSignalResultEvidence, namespacedRecord)) {
          return { created: false, applied: false, evidence: current };
        }
        throw new HarnessStorageAdmissionConflictError(
          namespacedRecord.sessionId,
          'signal',
          namespacedRecord.admissionId ?? namespacedRecord.signalId,
        );
      }
      throw err;
    }
  }

  async compareAndSwapSignalDispatch(
    input: CompareAndSwapSignalDispatchInput,
  ): Promise<CompareAndSwapSignalDispatchResult> {
    await this.#ensureMessageResultsTable();
    const harnessName = this.#resolveHarnessName(input.harnessName);
    const id = messageEvidenceId({ harnessName, sessionId: input.sessionId, signalId: input.signalId });
    const tx = await this.#client.transaction('write');
    try {
      const selected = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS} WHERE id = ? LIMIT 1 FOR UPDATE`,
        args: [id],
      });
      const row = selected.rows[0];
      if (!row) {
        throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
      }
      const current = rowToMessageResultEvidence(row as Record<string, unknown>);
      if (
        current.resourceId !== input.resourceId ||
        current.threadId !== input.threadId ||
        current.admissionId !== input.admissionId ||
        current.admissionHash !== input.admissionHash
      ) {
        throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
      }
      if (!isSignalAdmissionEvidence(current)) {
        throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
      }
      if (isTerminalMessageEvidence(current) || !signalDispatchMatches(current, input.expected)) {
        await tx.commit();
        return { applied: false, evidence: current };
      }
      const evidence: AgentSignalResultEvidence = {
        ...(current as Extract<AgentSignalResultEvidence, { status: 'pending' }>),
        operationKind: 'signal',
        dispatch: input.next,
        ...(input.next.state === 'reserved' ? { runId: undefined } : { runId: input.next.runId }),
        updatedAt: input.updatedAt,
      };
      await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_MESSAGE_RESULTS}
              SET run_id = ?, operation_kind = 'signal', dispatch = ?, updated_at = ?
              WHERE id = ? AND operation_kind IS NOT DISTINCT FROM ?`,
        args: [
          input.next.state === 'reserved' ? null : input.next.runId,
          JSON.stringify(input.next),
          input.updatedAt,
          id,
          current.operationKind ?? null,
        ],
      });
      await tx.commit();
      return { applied: true, evidence };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  }

  async compareAndSwapSignalTerminal(
    input: CompareAndSwapSignalTerminalInput,
  ): Promise<CompareAndSwapSignalTerminalResult> {
    await this.#ensureMessageResultsTable();
    const harnessName = this.#resolveHarnessName(input.harnessName);
    const id = messageEvidenceId({ harnessName, sessionId: input.sessionId, signalId: input.signalId });
    const tx = await this.#client.transaction('write');
    try {
      const selected = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS} WHERE id = ? LIMIT 1 FOR UPDATE`,
        args: [id],
      });
      const row = selected.rows[0];
      if (!row) {
        throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
      }
      const current = rowToMessageResultEvidence(row as Record<string, unknown>);
      if (
        current.resourceId !== input.resourceId ||
        current.threadId !== input.threadId ||
        current.admissionId !== input.admissionId ||
        current.admissionHash !== input.admissionHash
      ) {
        throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
      }
      if (!isSignalAdmissionEvidence(current)) {
        throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
      }
      if (isTerminalMessageEvidence(current) || !signalDispatchMatches(current, input.expected)) {
        await tx.commit();
        return { applied: false, evidence: current };
      }
      if (
        input.expected.state === 'reserved' ||
        (input.terminal.runId !== undefined && input.terminal.runId !== input.expected.runId)
      ) {
        throw new HarnessStorageAdmissionConflictError(input.sessionId, 'signal', input.admissionId);
      }
      const terminal = input.terminal;
      await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_MESSAGE_RESULTS}
              SET run_id = ?, mode_id = ?, model_id = ?, operation_kind = 'signal', status = ?, result = ?, error = ?, updated_at = ?
              WHERE id = ? AND operation_kind IS NOT DISTINCT FROM ?`,
        args: [
          input.expected.runId,
          terminal.modeId ?? current.modeId ?? null,
          terminal.modelId ?? current.modelId ?? null,
          terminal.status,
          terminal.status === 'completed' ? JSON.stringify(terminal.result) : null,
          terminal.status === 'failed' ? JSON.stringify(terminal.error) : null,
          input.updatedAt,
          id,
          current.operationKind ?? null,
        ],
      });
      const evidence: AgentSignalResultEvidence = {
        ...current,
        ...terminal,
        operationKind: 'signal',
        runId: input.expected.runId,
        modeId: terminal.modeId ?? current.modeId,
        modelId: terminal.modelId ?? current.modelId,
        dispatch: input.expected,
        createdAt: current.createdAt,
        updatedAt: input.updatedAt,
      };
      await tx.commit();
      return { applied: true, evidence };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  }

  async loadQueueResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    queuedItemId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    const session = await this.loadSession({ harnessName: namespace, sessionId });
    if (session && session.resourceId !== resourceId) return null;
    const receipt = session?.queueAdmissionReceipts?.[queuedItemId];
    if (receipt) return receipt;
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ?
              AND kind = 'queue' AND queued_item_id = ?
            LIMIT 1`,
      args: [namespace, sessionId, resourceId, queuedItemId],
    });
    const row = result.rows[0];
    return row ? rowToTombstone(row as Record<string, unknown>) : null;
  }

  async appendSessionEvent(record: HarnessSessionEventRecord): Promise<void> {
    const namespace = this.#resolveHarnessName(record.harnessName);
    await this.#ensureSessionEventsTable();
    await this.#client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_SESSION_EVENTS}
            (harness_name, session_id, resource_id, thread_id, event_id, epoch, sequence, event, emitted_at, stored_at)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND id = ? AND resource_id = ? AND thread_id = ?
            FOR KEY SHARE
            ON CONFLICT (harness_name, session_id, epoch, sequence) DO NOTHING`,
      args: [
        namespace,
        record.sessionId,
        record.resourceId,
        record.threadId,
        record.eventId,
        record.epoch,
        record.sequence,
        JSON.stringify(record.event),
        record.emittedAt,
        record.storedAt,
        namespace,
        record.sessionId,
        record.resourceId,
        record.threadId,
      ],
    });
  }

  async getSessionEventReplayState({
    harnessName,
    sessionId,
    resourceId,
    threadId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
  }): Promise<HarnessSessionEventReplayState | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#ensureSessionEventsTable();
    // §10.5 live-replay: the SSE cursor contract is anchored to the CURRENT
    // in-memory Session instance's epoch, which storage cannot observe. When the
    // ledger holds more than one epoch (every rehydrate after eviction mints a
    // fresh epoch and still appends lifecycle events), the replay state is
    // ambiguous, so we collapse to `null`. The server then returns 412 for the
    // stale cursor and the client recovers via the §10.5 snapshot path. Durable
    // SSE replay across restarts/evictions is explicitly NOT a v1 goal, and a
    // newest-by-`stored_at` projection would (a) diverge from the authoritative
    // in-memory adapter, which returns `null` for any multi-epoch ledger, and
    // (b) misidentify the current epoch whenever the prior epoch's last event
    // and the fresh epoch's seq-0 event share a `stored_at` millisecond.
    const bounds = await this.#client.execute({
      sql: `SELECT
              COUNT(DISTINCT epoch) AS epoch_count,
              MIN(epoch) AS epoch,
              MIN(sequence) AS oldest_sequence,
              MAX(sequence) AS newest_sequence
            FROM ${TABLE_HARNESS_SESSION_EVENTS}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ?`,
      args: [namespace, sessionId, resourceId, threadId],
    });
    const row = bounds.rows[0];
    if (!row || row.epoch_count == null || Number(row.epoch_count) !== 1) return null;
    if (row.oldest_sequence == null || row.newest_sequence == null) return null;

    return {
      epoch: String(row.epoch),
      oldestSequence: Number(row.oldest_sequence),
      newestSequence: Number(row.newest_sequence),
    };
  }

  async listSessionEvents({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    epoch,
    afterSequence,
    limit,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId: string;
    epoch: string;
    afterSequence: number;
    limit: number;
  }): Promise<HarnessSessionEventRecord[]> {
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#ensureSessionEventsTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_SESSION_EVENTS}
            WHERE harness_name = ? AND session_id = ? AND resource_id = ? AND thread_id = ? AND epoch = ? AND sequence > ?
            ORDER BY sequence ASC
            LIMIT ?`,
      args: [namespace, sessionId, resourceId, threadId, epoch, afterSequence, limit],
    });
    return result.rows.map(row => rowToSessionEvent(row as Record<string, unknown>));
  }

  async appendWorkspaceActionJournalEntry(
    record: WorkspaceActionJournalEntry,
  ): Promise<AppendWorkspaceActionJournalEntryResult> {
    assertWorkspaceActionTraceScope(record);
    assertWorkspaceActionKindMatches(record);
    const namespace = this.#resolveHarnessName(record.harnessName);
    await this.#ensureWorkspaceActionsTable();
    const result = await this.#client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_WORKSPACE_ACTIONS}
            (id, harness_name, session_id, resource_id, thread_id, action_kind, operation, action,
             policy_decision, policy_reasons, matched_rules, path, to_path, cwd, actor, request_id,
             trace_id, span_id, result, created_at)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND id = ? AND resource_id = ? AND thread_id = ?
            FOR KEY SHARE
            ON CONFLICT (harness_name, session_id, id) DO NOTHING`,
      args: [
        record.id,
        namespace,
        record.sessionId,
        record.resourceId,
        record.threadId,
        record.actionKind,
        record.operation ?? null,
        JSON.stringify(record.action),
        record.policyDecision,
        JSON.stringify(record.policyReasons),
        JSON.stringify(record.matchedRules),
        record.path === undefined ? null : JSON.stringify(record.path),
        record.toPath === undefined ? null : JSON.stringify(record.toPath),
        record.cwd === undefined ? null : JSON.stringify(record.cwd),
        record.actor === undefined ? null : JSON.stringify(record.actor),
        record.requestId ?? null,
        record.traceId ?? null,
        record.spanId ?? null,
        record.result === undefined ? null : JSON.stringify(record.result),
        record.createdAt,
        namespace,
        record.sessionId,
        record.resourceId,
        record.threadId,
      ],
    });
    return { created: result.rowsAffected > 0 };
  }

  async listWorkspaceActionJournalEntries({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    actionKind,
    operation,
    policyDecision,
    requestId,
    traceId,
    spanId,
    affectedPath,
    after,
    limit,
  }: ListWorkspaceActionJournalInput): Promise<WorkspaceActionJournalEntry[]> {
    if (spanId !== undefined && traceId === undefined) {
      throw new Error('Workspace action journal spanId filter requires traceId');
    }
    if (limit <= 0) return [];
    const namespace = this.#resolveHarnessName(harnessName);
    await this.#ensureWorkspaceActionsTable();
    const conditions = ['harness_name = ?', 'session_id = ?', 'resource_id = ?'];
    const args: QueryValues = [namespace, sessionId, resourceId];
    if (threadId !== undefined) {
      conditions.push('thread_id = ?');
      args.push(threadId);
    }
    if (actionKind !== undefined) {
      conditions.push('action_kind = ?');
      args.push(actionKind);
    }
    if (operation !== undefined) {
      conditions.push('operation = ?');
      args.push(operation);
    }
    if (policyDecision !== undefined) {
      conditions.push('policy_decision = ?');
      args.push(policyDecision);
    }
    if (requestId !== undefined) {
      conditions.push('request_id = ?');
      args.push(requestId);
    }
    if (traceId !== undefined) {
      conditions.push('trace_id = ?');
      args.push(traceId);
    }
    if (spanId !== undefined) {
      conditions.push('span_id = ?');
      args.push(spanId);
    }
    addWorkspaceActionPathFilter(conditions, args, affectedPath);
    if (after !== undefined) {
      conditions.push('(created_at > ? OR (created_at = ? AND id > ?))');
      args.push(after.createdAt, after.createdAt, after.id);
    }
    args.push(limit);
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_WORKSPACE_ACTIONS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at ASC, id ASC
            LIMIT ?`,
      args,
    });
    return result.rows.map(row => rowToWorkspaceActionJournalEntry(row as Record<string, unknown>));
  }

  // -------------------------------------------------------------------------
  // Plan tasks (§5.1k) — session-owner-fenced model-authored task tree.
  // -------------------------------------------------------------------------

  /**
   * Assert the session-owner fence inside `tx`: the owning session row is locked
   * FOR UPDATE, must be held by `ownerId` under an unexpired lease, and must have
   * `version` matching `ifSessionVersion`. Returns the resolved namespace.
   */
  async #assertPlanTaskFence(tx: PgHarnessClient, fence: PlanTaskSessionFence): Promise<string> {
    const namespace = this.#resolveHarnessName(fence.harnessName);
    const res = await tx.execute({
      sql: `SELECT version, owner_id, lease_expires_at FROM ${TABLE_HARNESS_SESSIONS}
            WHERE harness_name = ? AND id = ?
            FOR UPDATE`,
      args: [namespace, fence.sessionId],
    });
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new HarnessStorageSessionNotFoundError(fence.sessionId);
    const ownerId = (row.owner_id ?? undefined) as string | undefined;
    const leaseExpiresAt = row.lease_expires_at == null ? undefined : Number(row.lease_expires_at);
    const now = Date.now();
    // Plan-task writes require this exact owner to hold a live lease. An
    // expired/released lease is no authority for a stale session object.
    const leaseHeld = ownerId !== undefined && leaseExpiresAt !== undefined && leaseExpiresAt > now;
    if (!leaseHeld || ownerId !== fence.ownerId) {
      throw new HarnessStorageLeaseConflictError(fence.sessionId, ownerId ?? '<unowned>', leaseExpiresAt ?? 0);
    }
    const version = Number(row.version);
    if (version !== fence.ifSessionVersion) {
      throw new HarnessStorageVersionConflictError(fence.sessionId, fence.ifSessionVersion, version);
    }
    return namespace;
  }

  async createPlanTask({ fence, task }: CreatePlanTaskInput): Promise<HarnessPlanTask> {
    await this.#ensurePlanTasksTable();
    const tx = await this.#client.transaction('write');
    try {
      const namespace = await this.#assertPlanTaskFence(tx, fence);
      const stored = await this.#insertPlanTask(tx, namespace, fence.sessionId, task);
      await tx.commit();
      return stored;
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async #insertPlanTask(
    tx: PgHarnessClient,
    namespace: string,
    sessionId: string,
    task: HarnessPlanTask,
  ): Promise<HarnessPlanTask> {
    assertPlanTaskCreateIdempotencyInput(task);
    if (task.idempotencyKey !== undefined) {
      const existing = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_PLAN_TASKS}
              WHERE harness_name = ? AND session_id = ? AND idempotency_key = ?
              LIMIT 1`,
        args: [namespace, sessionId, task.idempotencyKey],
      });
      if (existing.rows[0]) return rowToPlanTask(existing.rows[0] as Record<string, unknown>);
    }
    const now = Date.now();
    const stored: HarnessPlanTask = {
      ...task,
      harnessName: namespace,
      sessionId,
      createdAt: task.createdAt ?? now,
      updatedAt: now,
      version: 1,
    };
    const cols = planTaskColumnValues(stored);
    await tx.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_PLAN_TASKS} (${cols.names.join(', ')})
            VALUES (${cols.names.map(() => '?').join(', ')})`,
      args: cols.values,
    });
    return stored;
  }

  async updatePlanTask({ fence, taskId, ifVersion, patch }: UpdatePlanTaskInput): Promise<UpdatePlanTaskResult> {
    await this.#ensurePlanTasksTable();
    const tx = await this.#client.transaction('write');
    try {
      const namespace = await this.#assertPlanTaskFence(tx, fence);
      const version = await this.#updatePlanTaskRow(tx, namespace, fence.sessionId, taskId, ifVersion, patch);
      await tx.commit();
      return { version };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async #updatePlanTaskRow(
    tx: PgHarnessClient,
    namespace: string,
    sessionId: string,
    taskId: string,
    ifVersion: number,
    patch: UpdatePlanTaskInput['patch'],
  ): Promise<number> {
    const res = await tx.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_PLAN_TASKS}
            WHERE harness_name = ? AND session_id = ? AND task_id = ?
            FOR UPDATE`,
      args: [namespace, sessionId, taskId],
    });
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new HarnessStoragePlanTaskNotFoundError(sessionId, taskId);
    const existing = rowToPlanTask(row);
    if (existing.version !== ifVersion) {
      throw new HarnessStoragePlanTaskVersionConflictError(taskId, ifVersion, existing.version);
    }
    const next = applyPlanTaskPatch(existing, patch, ifVersion + 1);
    const cols = planTaskColumnValues(next);
    const updatable = cols.names.filter(n => n !== 'harness_name' && n !== 'session_id' && n !== 'task_id');
    const setClause = updatable.map(n => `${n} = ?`).join(', ');
    const setValues = updatable.map(n => cols.values[cols.names.indexOf(n)]);
    await tx.execute({
      sql: `UPDATE ${TABLE_HARNESS_PLAN_TASKS}
            SET ${setClause}
            WHERE harness_name = ? AND session_id = ? AND task_id = ?`,
      args: [...setValues, namespace, sessionId, taskId],
    });
    return next.version;
  }

  async deletePlanTaskSubtree({ fence, rootTaskId }: DeletePlanTaskSubtreeInput): Promise<DeletePlanTaskSubtreeResult> {
    await this.#ensurePlanTasksTable();
    const tx = await this.#client.transaction('write');
    try {
      const namespace = await this.#assertPlanTaskFence(tx, fence);
      const deletedCount = await this.#deletePlanTaskSubtreeRows(tx, namespace, fence.sessionId, rootTaskId);
      await tx.commit();
      return { deletedCount };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async #deletePlanTaskSubtreeRows(
    tx: PgHarnessClient,
    namespace: string,
    sessionId: string,
    rootTaskId: string,
  ): Promise<number> {
    // §5.1k: walk parent_task_id with a recursive CTE; UNION (not UNION ALL)
    // row-dedupes so a parent_task_id cycle terminates (cycle PREVENTION is TM-4,
    // this is the defensive runtime guard). Delete the root + every descendant.
    const result = await tx.execute({
      sql: `WITH RECURSIVE subtree(task_id) AS (
              SELECT task_id FROM ${TABLE_HARNESS_PLAN_TASKS}
              WHERE harness_name = ? AND session_id = ? AND task_id = ?
              UNION
              SELECT t.task_id FROM ${TABLE_HARNESS_PLAN_TASKS} t
              JOIN subtree ON t.parent_task_id = subtree.task_id
              WHERE t.harness_name = ? AND t.session_id = ?
            )
            DELETE FROM ${TABLE_HARNESS_PLAN_TASKS}
            WHERE harness_name = ? AND session_id = ?
              AND task_id IN (SELECT task_id FROM subtree)`,
      args: [namespace, sessionId, rootTaskId, namespace, sessionId, namespace, sessionId],
    });
    return result.rowsAffected;
  }

  async mutatePlanTasksForSession({ fence, ops }: MutatePlanTasksForSessionInput): Promise<void> {
    await this.#ensurePlanTasksTable();
    const tx = await this.#client.transaction('write');
    try {
      const namespace = await this.#assertPlanTaskFence(tx, fence);
      for (const op of ops) {
        await this.#applyPlanTaskOp(tx, namespace, fence.sessionId, op);
      }
      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async #applyPlanTaskOp(
    tx: PgHarnessClient,
    namespace: string,
    sessionId: string,
    op: PlanTaskMutationOp,
  ): Promise<void> {
    if (op.kind === 'create') {
      await this.#insertPlanTask(tx, namespace, sessionId, op.task);
      return;
    }
    if (op.kind === 'update') {
      await this.#updatePlanTaskRow(tx, namespace, sessionId, op.taskId, op.ifVersion, op.patch);
      return;
    }
    await this.#deletePlanTaskSubtreeRows(tx, namespace, sessionId, op.rootTaskId);
  }

  async listPlanTasks({ harnessName, sessionId, limit, cursor }: ListPlanTasksInput): Promise<ListPlanTasksResult> {
    if (limit <= 0) return { tasks: [] };
    await this.#ensurePlanTasksTable();
    const namespace = this.#resolveHarnessName(harnessName);
    // Keyset cursor on the (parent_task_id, "order", task_id) sort key.
    const conditions = ['harness_name = ?', 'session_id = ?'];
    const args: QueryValues = [namespace, sessionId];
    if (cursor !== undefined) {
      const c = decodePlanTaskCursor(cursor);
      conditions.push(
        `(COALESCE(parent_task_id, '') > ? OR (COALESCE(parent_task_id, '') = ? AND ("order" > ? OR ("order" = ? AND task_id > ?))))`,
      );
      args.push(c.parent, c.parent, c.order, c.order, c.taskId);
    }
    // Fetch limit+1 so a cursor is emitted only when a further row actually
    // exists (matching the in-memory adapter's `nextIndex < total` semantics).
    args.push(limit + 1);
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_PLAN_TASKS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY COALESCE(parent_task_id, '') ASC, "order" ASC, task_id ASC
            LIMIT ?`,
      args,
    });
    const fetched = result.rows.map(row => rowToPlanTask(row as Record<string, unknown>));
    const hasMore = fetched.length > limit;
    const tasks = hasMore ? fetched.slice(0, limit) : fetched;
    const out: ListPlanTasksResult = { tasks };
    if (hasMore && tasks.length > 0) {
      out.cursor = encodePlanTaskCursor(tasks[tasks.length - 1]!);
    }
    return out;
  }

  async loadPlanTaskSubtree({
    harnessName,
    sessionId,
    rootTaskId,
    depth,
    status,
    limit,
  }: LoadPlanTaskSubtreeInput): Promise<LoadPlanTaskSubtreeResult> {
    await this.#ensurePlanTasksTable();
    const namespace = this.#resolveHarnessName(harnessName);
    // Materialize the whole session tree (bounded by session ownership), then do
    // the depth-first preorder walk in-process — the same shape as the in-memory
    // adapter, so depth/status/limit semantics match exactly across adapters.
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_PLAN_TASKS}
            WHERE harness_name = ? AND session_id = ?
            ORDER BY COALESCE(parent_task_id, '') ASC, "order" ASC, task_id ASC`,
      args: [namespace, sessionId],
    });
    const tasks = result.rows.map(row => rowToPlanTask(row as Record<string, unknown>));
    return walkPlanTaskSubtree(tasks, { rootTaskId, depth, status, limit });
  }

  async countPlanTasksByStatus({ harnessName, sessionId }: CountPlanTasksByStatusInput): Promise<PlanTaskCountSummary> {
    await this.#ensurePlanTasksTable();
    const namespace = this.#resolveHarnessName(harnessName);
    // Exact aggregate, NOT a row load: one COUNT(*) GROUP BY status pass over the
    // session's tasks. The roots count (parent NULL or unresolvable) comes from a
    // single anti-join, matching `computePlanTaskSummary`'s root rule.
    const grouped = await this.#client.execute({
      sql: `SELECT status, COUNT(*)::bigint AS n
            FROM ${TABLE_HARNESS_PLAN_TASKS}
            WHERE harness_name = ? AND session_id = ?
            GROUP BY status`,
      args: [namespace, sessionId],
    });
    const rootsResult = await this.#client.execute({
      sql: `SELECT COUNT(*)::bigint AS n
            FROM ${TABLE_HARNESS_PLAN_TASKS} t
            WHERE t.harness_name = ? AND t.session_id = ?
              AND (t.parent_task_id IS NULL
                   OR NOT EXISTS (
                     SELECT 1 FROM ${TABLE_HARNESS_PLAN_TASKS} p
                     WHERE p.harness_name = t.harness_name
                       AND p.session_id = t.session_id
                       AND p.task_id = t.parent_task_id))`,
      args: [namespace, sessionId],
    });
    const byStatus: Partial<Record<HarnessPlanTaskStatus, number>> = {};
    let total = 0;
    for (const row of grouped.rows as Array<{ status: string; n: unknown }>) {
      const n = Number(row.n);
      byStatus[row.status as HarnessPlanTaskStatus] = n;
      total += n;
    }
    const rootCount = Number((rootsResult.rows[0] as { n: unknown } | undefined)?.n ?? 0);
    return { total, byStatus, rootCount };
  }

  // -------------------------------------------------------------------------
  // Run summaries (span-summary O1/O2)
  // -------------------------------------------------------------------------

  async saveRunSummary({ summary }: SaveRunSummaryInput): Promise<HarnessRunSummary> {
    await this.#ensureRunSummariesTable();
    const namespace = this.#resolveHarnessName(summary.harnessName);
    const stored: HarnessRunSummary = { ...summary, harnessName: namespace };
    const cols = runSummaryColumnValues(stored);
    // First-terminal-wins idempotency: a later write for the same (harness, run)
    // is a no-op.
    await this.#client.execute({
      sql: `INSERT INTO ${TABLE_HARNESS_RUN_SUMMARIES} (${cols.names.join(', ')})
            VALUES (${cols.names.map(() => '?').join(', ')})
            ON CONFLICT (harness_name, run_id) DO NOTHING`,
      args: cols.values,
    });
    // Return the authoritative stored row (the existing one on a no-op).
    const existing = await this.loadRunSummary({ harnessName: namespace, runId: summary.runId });
    return existing ?? stored;
  }

  async loadRunSummary({ harnessName, runId }: LoadRunSummaryInput): Promise<HarnessRunSummary | null> {
    await this.#ensureRunSummariesTable();
    const namespace = this.#resolveHarnessName(harnessName);
    const res = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_RUN_SUMMARIES} WHERE harness_name = ? AND run_id = ? LIMIT 1`,
      args: [namespace, runId],
    });
    return res.rows[0] ? rowToRunSummary(res.rows[0] as Record<string, unknown>) : null;
  }

  async listRunSummaries({
    harnessName,
    sessionId,
    resourceId,
    limit,
    beforeCompletedAt,
    beforeRunId,
  }: ListRunSummariesInput): Promise<ListRunSummariesResult> {
    await this.#ensureRunSummariesTable();
    const namespace = this.#resolveHarnessName(harnessName);
    const cap = limit ?? 50;
    const where: string[] = ['harness_name = ?', 'session_id = ?'];
    const args: QueryValues = [namespace, sessionId];
    if (resourceId !== undefined) {
      where.push('resource_id = ?');
      args.push(resourceId);
    }
    if (beforeCompletedAt !== undefined) {
      // Composite keyset for the (completed_at DESC, run_id DESC) order so
      // same-timestamp rows at a page boundary are not skipped.
      if (beforeRunId !== undefined) {
        where.push('(completed_at < ? OR (completed_at = ? AND run_id < ?))');
        args.push(beforeCompletedAt, beforeCompletedAt, beforeRunId);
      } else {
        where.push('completed_at < ?');
        args.push(beforeCompletedAt);
      }
    }
    // Fetch one extra row to detect whether more pages remain.
    args.push(cap + 1);
    const res = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_RUN_SUMMARIES}
            WHERE ${where.join(' AND ')}
            ORDER BY completed_at DESC, run_id DESC
            LIMIT ?`,
      args,
    });
    const all = (res.rows as Record<string, unknown>[]).map(rowToRunSummary);
    const page = all.slice(0, cap);
    const result: ListRunSummariesResult = { summaries: page };
    if (all.length > cap) {
      const last = page[page.length - 1]!;
      result.nextBeforeCompletedAt = last.completedAt;
      result.nextBeforeRunId = last.runId;
    }
    return result;
  }

  async resolveOperationAdmissionEvidence({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    kind,
    admissionId,
    attemptedAdmissionHash,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    kind: 'signal' | 'queue';
    admissionId: string;
    attemptedAdmissionHash: string;
  }): Promise<{
    status: 'none' | 'duplicate' | 'conflict';
    evidence?: OperationAdmissionEvidence;
    storedAdmissionHash?: string;
  }> {
    const namespace = this.#resolveHarnessName(harnessName);
    if (kind === 'signal') await this.#ensureMessageResultsTable();
    if (kind === 'signal') {
      const filters = ['harness_name = ?', 'session_id = ?', 'resource_id = ?', 'admission_id = ?'];
      const args = [namespace, sessionId, resourceId, admissionId];
      if (threadId !== undefined) {
        filters.splice(3, 0, 'thread_id = ?');
        args.splice(3, 0, threadId);
      }
      const retained = await this.#client.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
              WHERE ${filters.join(' AND ')}
              LIMIT 1`,
        args,
      });
      const row = retained.rows[0];
      if (row) {
        const evidence = rowToMessageResultEvidence(row as Record<string, unknown>);
        return {
          status: evidence.admissionHash === attemptedAdmissionHash ? 'duplicate' : 'conflict',
          evidence,
          storedAdmissionHash: evidence.admissionHash,
        };
      }
    }
    if (kind === 'queue') {
      const session = await this.loadSession({ harnessName: namespace, sessionId });
      if (session && (session.resourceId !== resourceId || (threadId !== undefined && session.threadId !== threadId))) {
        return { status: 'none' };
      }
      const receipts = Object.values(session?.queueAdmissionReceipts ?? {}) as QueueAdmissionReceipt[];
      for (const receipt of receipts) {
        if (receipt.admissionId !== admissionId) continue;
        return {
          status: receipt.admissionHash === attemptedAdmissionHash ? 'duplicate' : 'conflict',
          evidence: receipt,
          storedAdmissionHash: receipt.admissionHash,
        };
      }
    }

    // §5.1d: legacy tombstones persisted under kind 'message' must still be
    // discoverable for signal idempotency (rowToTombstone normalizes them on read).
    const kindFilter = kind === 'signal' ? "kind IN ('signal', 'message')" : 'kind = ?';
    const tombstoneFilters = ['harness_name = ?', 'session_id = ?', 'resource_id = ?', kindFilter, 'admission_id = ?'];
    const tombstoneArgs =
      kind === 'signal'
        ? [namespace, sessionId, resourceId, admissionId]
        : [namespace, sessionId, resourceId, kind, admissionId];
    if (threadId !== undefined) {
      tombstoneFilters.splice(3, 0, 'thread_id = ?');
      tombstoneArgs.splice(3, 0, threadId);
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE ${tombstoneFilters.join(' AND ')}
            LIMIT 1`,
      args: tombstoneArgs,
    });
    const row = result.rows[0];
    if (!row) return { status: 'none' };
    const tombstone = rowToTombstone(row as Record<string, unknown>);
    return {
      status: tombstone.admissionHash === attemptedAdmissionHash ? 'duplicate' : 'conflict',
      evidence: tombstone,
      storedAdmissionHash: tombstone.admissionHash,
    };
  }

  async writeOperationAdmissionTombstone(record: OperationAdmissionTombstone): Promise<void> {
    const namespacedRecord = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    const id = tombstoneId(namespacedRecord);
    const tx = await this.#client.transaction('write');
    try {
      const existing = await tx.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES} WHERE id = ? LIMIT 1`,
        args: [id],
      });
      if (existing.rows[0]) {
        const current = rowToTombstone(existing.rows[0] as Record<string, unknown>);
        if (!sameTombstoneIdentity(current, namespacedRecord)) {
          throw new HarnessStorageAdmissionConflictError(
            namespacedRecord.sessionId,
            namespacedRecord.kind,
            namespacedRecord.admissionId ?? id,
          );
        }
        await tx.execute({
          sql: `UPDATE ${TABLE_HARNESS_OPERATION_TOMBSTONES}
                SET expires_at = ?
                WHERE id = ?`,
          args: [namespacedRecord.expiresAt, id],
        });
      } else {
        await tx.execute({
          sql: `INSERT INTO ${TABLE_HARNESS_OPERATION_TOMBSTONES}
                (id, harness_name, session_id, kind, resource_id, thread_id, admission_id, admission_hash,
                 queued_item_id, signal_id, run_id, terminal_at, compacted_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            namespacedRecord.harnessName,
            namespacedRecord.sessionId,
            namespacedRecord.kind,
            namespacedRecord.resourceId,
            namespacedRecord.threadId,
            namespacedRecord.admissionId ?? null,
            namespacedRecord.admissionHash ?? null,
            namespacedRecord.queuedItemId ?? null,
            namespacedRecord.signalId ?? null,
            namespacedRecord.runId ?? null,
            namespacedRecord.terminalAt,
            namespacedRecord.compactedAt,
            namespacedRecord.expiresAt,
          ],
        });
      }
      await tx.commit();
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async compactOperationResultEvidence({
    harnessName,
    sessionId,
    resourceId,
    kind,
    signalId,
    queuedItemId,
    now,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    kind: 'signal' | 'queue';
    signalId?: string;
    queuedItemId?: string;
    now: number;
  }): Promise<OperationAdmissionTombstone | null> {
    const namespace = this.#resolveHarnessName(harnessName);
    if (kind === 'signal') {
      await this.#ensureMessageResultsTable();
      const result = await this.#client.execute({
        sql: `SELECT * FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
              WHERE harness_name = ? AND session_id = ? AND resource_id = ?
                AND signal_id = ?
              LIMIT 1`,
        args: [namespace, sessionId, resourceId, signalId ?? ''],
      });
      const row = result.rows[0];
      if (!row) return null;
      const retained = rowToMessageResultEvidence(row as Record<string, unknown>);
      if (retained.status === 'pending') return null;
      const tombstone: OperationAdmissionTombstone = {
        kind: 'signal',
        harnessName: namespace,
        sessionId,
        resourceId,
        threadId: retained.threadId,
        ...(retained.admissionId !== undefined ? { admissionId: retained.admissionId } : {}),
        ...(retained.admissionHash !== undefined ? { admissionHash: retained.admissionHash } : {}),
        signalId: retained.signalId,
        ...(retained.runId !== undefined ? { runId: retained.runId } : {}),
        terminalAt: retained.updatedAt,
        compactedAt: now,
        expiresAt: now,
      };
      await this.writeOperationAdmissionTombstone(tombstone);
      await this.#client.execute({
        sql: `DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS} WHERE id = ?`,
        args: [messageEvidenceId(retained)],
      });
      return tombstone;
    }
    return this.#withCompactionLock(`${namespace}\0${sessionId}`, async () => {
      let lastReceipt: QueueAdmissionReceipt | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await this.#client.execute({
          sql: `SELECT * FROM ${TABLE_HARNESS_SESSIONS} WHERE harness_name = ? AND id = ?`,
          args: [namespace, sessionId],
        });
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        const session = rowToSession(row);
        if (session.resourceId !== resourceId) return null;
        const receipt = queuedItemId ? session.queueAdmissionReceipts?.[queuedItemId] : undefined;
        if (!receipt || !isTerminalQueueReceipt(receipt)) return null;
        lastReceipt = receipt;
        const tombstone: OperationAdmissionTombstone = {
          kind: 'queue',
          harnessName: namespace,
          sessionId,
          resourceId,
          threadId: session.threadId,
          admissionId: receipt.admissionId,
          admissionHash: receipt.admissionHash,
          queuedItemId: receipt.queuedItemId,
          ...(receipt.signalId !== undefined ? { signalId: receipt.signalId } : {}),
          ...(receipt.runId !== undefined ? { runId: receipt.runId } : {}),
          terminalAt: receipt.completedAt ?? receipt.failedAt ?? receipt.deadAt ?? now,
          compactedAt: now,
          expiresAt: now,
        };
        await this.writeOperationAdmissionTombstone(tombstone);
        const nextReceipts = { ...(session.queueAdmissionReceipts ?? {}) };
        delete nextReceipts[queuedItemId!];
        const nextReceiptJson = Object.keys(nextReceipts).length > 0 ? JSON.stringify(nextReceipts) : null;
        const originalReceiptJson =
          row.queue_admission_receipts == null ? null : JSON.stringify(row.queue_admission_receipts);
        const updateResult = await this.#client.execute({
          sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
                SET queue_admission_receipts = ?
                WHERE harness_name = ? AND id = ?
                  AND ${originalReceiptJson === null ? 'queue_admission_receipts IS NULL' : 'queue_admission_receipts = ?'}`,
          args:
            originalReceiptJson === null
              ? [nextReceiptJson, namespace, sessionId]
              : [nextReceiptJson, namespace, sessionId, originalReceiptJson],
        });
        if (updateResult.rowsAffected > 0) return tombstone;
      }
      const receiptDetails = lastReceipt
        ? `queued item "${lastReceipt.queuedItemId}" admission "${lastReceipt.admissionId}"`
        : `queued item "${queuedItemId ?? '<unknown>'}"`;
      throw new Error(
        `Harness PG queue compaction for harness "${namespace}" session "${sessionId}" resource "${resourceId}" ${receiptDetails} conflicted after retries`,
      );
    });
  }

  async deleteOperationAdmissionTombstonesForSession({
    harnessName,
    sessionId,
    resourceId,
    threadId,
    signalId,
  }: {
    harnessName?: string;
    sessionId: string;
    resourceId: string;
    threadId?: string;
    signalId?: string;
  }): Promise<void> {
    const namespace = this.#resolveHarnessName(harnessName);
    const filters = ['harness_name = ?', 'session_id = ?', 'resource_id = ?'];
    const args: string[] = [namespace, sessionId, resourceId];
    if (threadId !== undefined) {
      filters.push('thread_id = ?');
      args.push(threadId);
    }
    if (signalId !== undefined) {
      filters.push('signal_id = ?');
      args.push(signalId);
    }
    const where = filters.join(' AND ');
    await this.#ensureMessageResultsTable();
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_MESSAGE_RESULTS}
            WHERE ${where}`,
      args,
    });
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_OPERATION_TOMBSTONES}
            WHERE ${where}`,
      args,
    });
  }

  // -------------------------------------------------------------------------
  // Provider-callback bindings (§5.1i)
  // -------------------------------------------------------------------------

  async resolveProviderCallbackBinding(
    record: HarnessProviderCallbackBinding,
    opts?: { replaceBindingId?: string },
  ): Promise<ResolveProviderCallbackBindingResult> {
    await this.#ensureProviderCallbackBindingsTable();
    const incoming: HarnessProviderCallbackBinding = {
      ...record,
      harnessName: this.#resolveHarnessName(record.harnessName),
    };
    assertValidProviderCallbackBindingState(incoming);
    const tx = await this.#client.transaction('write');
    try {
      const active = await this.#loadActiveProviderCallbackBindingBySelectorWithClient(tx, {
        providerId: incoming.providerId,
        selectorKind: incoming.selectorKind,
        selectorValue: incoming.selectorValue,
      });

      if (opts?.replaceBindingId !== undefined) {
        if (opts.replaceBindingId === incoming.id) {
          throw new HarnessStorageProviderCallbackBindingTransitionError(
            incoming.id,
            incoming.status,
            'replaced',
            'replacement target must be different from the incoming binding',
          );
        }
        if (incoming.status !== 'active') {
          throw new HarnessStorageProviderCallbackBindingTransitionError(
            incoming.id,
            incoming.status,
            'active',
            'replacement binding must be active',
          );
        }
        const existingById = await this.#loadProviderCallbackBindingByIdWithClient(tx, incoming.id);
        if (existingById && !providerCallbackBindingsEqual(existingById, incoming)) {
          throw new HarnessStorageProviderCallbackBindingTransitionError(
            incoming.id,
            existingById.status,
            incoming.status,
            'id is already owned by another provider callback binding',
          );
        }
        const previous = await this.#loadProviderCallbackBindingByIdWithClient(tx, opts.replaceBindingId);
        if (
          previous?.status === 'replaced' &&
          previous.replacedByBindingId === incoming.id &&
          existingById &&
          providerCallbackBindingsEqual(existingById, incoming)
        ) {
          await tx.commit();
          return {
            binding: existingById,
            duplicate: true,
            conflict: false,
            replacedBindingId: previous.id,
          };
        }
        if (existingById && providerCallbackBindingsEqual(existingById, incoming)) {
          throw new HarnessStorageProviderCallbackBindingTransitionError(
            incoming.id,
            existingById.status,
            incoming.status,
            'id is already owned and replacement target has not transitioned',
          );
        }
        if (
          !previous ||
          previous.status !== 'active' ||
          previous.providerId !== incoming.providerId ||
          previous.selectorKind !== incoming.selectorKind ||
          previous.selectorValue !== incoming.selectorValue
        ) {
          throw new HarnessStorageProviderCallbackBindingTransitionError(
            opts.replaceBindingId,
            previous?.status,
            'replaced',
            'replacement target is missing, inactive, or owns a different selector',
          );
        }
        if (active && active.id !== previous.id) {
          if (existingById && providerCallbackBindingsEqual(existingById, incoming)) {
            await tx.commit();
            return { binding: existingById, duplicate: true, conflict: false, replacedBindingId: previous.id };
          }
          await tx.commit();
          return { binding: active, duplicate: true, conflict: true };
        }
        const replacedAt = incoming.createdAt;
        const replaceResult = await tx.execute({
          sql: `UPDATE ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}
                SET status = 'replaced', replaced_at = ?, replaced_by_binding_id = ?, updated_at = ?
                WHERE id = ? AND status = 'active'`,
          args: [replacedAt, incoming.id, replacedAt, previous.id],
        });
        if (replaceResult.rowsAffected === 0) {
          throw new HarnessStorageProviderCallbackBindingTransitionError(
            previous.id,
            previous.status,
            'replaced',
            'replacement target changed before it could be replaced',
          );
        }
        await tx.execute(providerCallbackBindingInsertStatement(incoming));
        await tx.commit();
        return { binding: incoming, duplicate: false, conflict: false, replacedBindingId: previous.id };
      }

      if (active) {
        await tx.commit();
        return {
          binding: active,
          duplicate: true,
          conflict: !sameProviderCallbackBindingTarget(active, incoming),
        };
      }
      const existingById = await this.#loadProviderCallbackBindingByIdWithClient(tx, incoming.id);
      if (existingById) {
        if (providerCallbackBindingsEqual(existingById, incoming)) {
          await tx.commit();
          return { binding: existingById, duplicate: true, conflict: false };
        }
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          incoming.id,
          existingById.status,
          incoming.status,
          'id is already owned by another provider callback binding',
        );
      }
      await tx.execute(providerCallbackBindingInsertStatement(incoming));
      await tx.commit();
      return { binding: incoming, duplicate: false, conflict: false };
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      if (isUniqueConstraintError(error)) {
        return this.#resolveProviderCallbackBindingUniqueConflict(incoming, opts);
      }
      throw error;
    }
  }

  async loadProviderCallbackBindingBySelector(opts: {
    providerId: string;
    selectorKind: ProviderCallbackSelectorKind;
    selectorValue: string;
  }): Promise<HarnessProviderCallbackBinding | null> {
    await this.#ensureProviderCallbackBindingsTable();
    return this.#loadActiveProviderCallbackBindingBySelectorWithClient(this.#client, opts);
  }

  async markProviderCallbackBindingStatus(opts: {
    bindingId: string;
    status: Extract<HarnessProviderCallbackBinding['status'], 'active' | 'disabled' | 'undeliverable'>;
    updatedAt?: number;
    lastError?: HarnessProviderCallbackBinding['lastError'];
  }): Promise<HarnessProviderCallbackBinding> {
    await this.#ensureProviderCallbackBindingsTable();
    const tx = await this.#client.transaction('write');
    try {
      const current = await this.#loadProviderCallbackBindingByIdWithClient(tx, opts.bindingId);
      if (!current) {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          opts.bindingId,
          undefined,
          opts.status,
          'binding was not found',
        );
      }
      if (current.status === 'replaced') {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          current.id,
          current.status,
          opts.status,
          'replaced bindings are terminal',
        );
      }
      const active = await this.#loadActiveProviderCallbackBindingBySelectorWithClient(tx, {
        providerId: current.providerId,
        selectorKind: current.selectorKind,
        selectorValue: current.selectorValue,
      });
      if (opts.status === 'active' && active && active.id !== current.id) {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          current.id,
          current.status,
          opts.status,
          'another active binding owns this selector',
        );
      }
      const updatedAt = opts.updatedAt ?? Date.now();
      const next: HarnessProviderCallbackBinding = {
        ...current,
        status: opts.status,
        updatedAt,
        lastError: opts.lastError,
      };
      assertValidProviderCallbackBindingState(next);
      const values = providerCallbackBindingColumnValues(next);
      const currentValues = providerCallbackBindingColumnValues(current);
      const expectedNames = currentValues.names.filter(name => name !== 'id');
      // `IS ?` is rewritten to `IS NOT DISTINCT FROM ?` by preparePgHarnessSql so the
      // optimistic-CAS predicate treats SQL NULLs as comparable, matching the LibSQL
      // sibling's `IS ?` semantics.
      const updateResult = await tx.execute({
        sql: `UPDATE ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}
              SET ${values.names
                .filter(name => name !== 'id')
                .map(name => `${name} = ?`)
                .join(', ')}
              WHERE id = ? AND ${expectedNames.map(name => `${name} IS ?`).join(' AND ')}`,
        args: [...values.values.slice(1), next.id, ...currentValues.values.slice(1)],
      });
      if (updateResult.rowsAffected === 0) {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          current.id,
          current.status,
          opts.status,
          'binding changed before status update could be applied',
        );
      }
      await tx.commit();
      return next;
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      if (isUniqueConstraintError(error)) {
        return this.#resolveProviderCallbackBindingStatusUniqueConflict(opts);
      }
      throw error;
    }
  }

  async #loadProviderCallbackBindingByIdWithClient(
    client: PgHarnessClient,
    id: string,
  ): Promise<HarnessProviderCallbackBinding | null> {
    const result = await client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}
            WHERE id = ?
            LIMIT 1`,
      args: [id],
    });
    const row = result.rows[0];
    return row ? rowToProviderCallbackBinding(row as Record<string, unknown>) : null;
  }

  async #loadActiveProviderCallbackBindingBySelectorWithClient(
    client: PgHarnessClient,
    opts: {
      providerId: string;
      selectorKind: ProviderCallbackSelectorKind;
      selectorValue: string;
    },
  ): Promise<HarnessProviderCallbackBinding | null> {
    const result = await client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}
            WHERE provider_id = ? AND selector_kind = ? AND selector_value = ? AND status = 'active'
            LIMIT 1`,
      args: [opts.providerId, opts.selectorKind, opts.selectorValue],
    });
    const row = result.rows[0];
    return row ? rowToProviderCallbackBinding(row as Record<string, unknown>) : null;
  }

  async #resolveProviderCallbackBindingUniqueConflict(
    incoming: HarnessProviderCallbackBinding,
    opts?: { replaceBindingId?: string },
  ): Promise<ResolveProviderCallbackBindingResult> {
    const [active, existingById] = await Promise.all([
      this.#loadActiveProviderCallbackBindingBySelectorWithClient(this.#client, {
        providerId: incoming.providerId,
        selectorKind: incoming.selectorKind,
        selectorValue: incoming.selectorValue,
      }),
      this.#loadProviderCallbackBindingByIdWithClient(this.#client, incoming.id),
    ]);

    if (existingById) {
      if (!providerCallbackBindingsEqual(existingById, incoming)) {
        throw new HarnessStorageProviderCallbackBindingTransitionError(
          incoming.id,
          existingById.status,
          incoming.status,
          'id is already owned by another provider callback binding',
        );
      }
      if (opts?.replaceBindingId !== undefined) {
        const previous = await this.#loadProviderCallbackBindingByIdWithClient(this.#client, opts.replaceBindingId);
        if (previous?.status !== 'replaced' || previous.replacedByBindingId !== existingById.id) {
          throw new HarnessStorageProviderCallbackBindingTransitionError(
            incoming.id,
            existingById.status,
            incoming.status,
            'id is already owned and replacement target has not transitioned',
          );
        }
        return {
          binding: existingById,
          duplicate: true,
          conflict: false,
          replacedBindingId: previous.id,
        };
      }
      return { binding: existingById, duplicate: true, conflict: false };
    }

    if (active) {
      return {
        binding: active,
        duplicate: true,
        conflict: !sameProviderCallbackBindingTarget(active, incoming),
      };
    }

    throw new HarnessStorageProviderCallbackBindingTransitionError(
      incoming.id,
      undefined,
      incoming.status,
      'unique constraint conflict could not be resolved after provider callback binding insert',
    );
  }

  async #resolveProviderCallbackBindingStatusUniqueConflict(opts: {
    bindingId: string;
    status: Extract<HarnessProviderCallbackBinding['status'], 'active' | 'disabled' | 'undeliverable'>;
    updatedAt?: number;
    lastError?: HarnessProviderCallbackBinding['lastError'];
  }): Promise<HarnessProviderCallbackBinding> {
    const current = await this.#loadProviderCallbackBindingByIdWithClient(this.#client, opts.bindingId);
    if (!current) {
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        opts.bindingId,
        undefined,
        opts.status,
        'binding was not found',
      );
    }
    const active = await this.#loadActiveProviderCallbackBindingBySelectorWithClient(this.#client, {
      providerId: current.providerId,
      selectorKind: current.selectorKind,
      selectorValue: current.selectorValue,
    });
    if (opts.status === 'active' && active && active.id !== current.id) {
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        current.id,
        current.status,
        opts.status,
        'another active binding owns this selector',
      );
    }
    if (
      current.status === opts.status &&
      (opts.lastError === undefined || stableJsonString(current.lastError) === stableJsonString(opts.lastError))
    ) {
      return current;
    }
    throw new HarnessStorageProviderCallbackBindingTransitionError(
      current.id,
      current.status,
      opts.status,
      'unique constraint conflict could not be resolved after provider callback binding status update',
    );
  }

  // -------------------------------------------------------------------------
  // Channel bindings (§5.1h / §14.1)
  // -------------------------------------------------------------------------

  async saveChannelBinding(record: ChannelBinding): Promise<void> {
    await this.#ensureChannelBindingsTable();
    const namespaced: ChannelBinding = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    // §5.2h: active rows are unique per conversation tuple. Updating the same
    // binding id, or writing a non-active row, is always allowed; only a write
    // that would create a SECOND active binding for the tuple is rejected. The
    // partial-unique index enforces this — but it would also fire for the no-op
    // self-update of an already-active row, so the upsert keys on id (primary key)
    // and the unique-conflict path below distinguishes "another id holds it".
    try {
      await this.#client.execute(channelBindingUpsertStatement(namespaced));
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const heldBy = await this.#loadActiveChannelBindingIdByTuple(namespaced);
      // The conflict can only come from the active-tuple index; if the holder is
      // (improbably) this same id, the row was concurrently rewritten — surface
      // the holder we observed (falling back to this id) rather than masking it.
      throw new HarnessStorageChannelBindingConflictError(
        namespaced.channelId,
        namespaced.externalThreadId,
        heldBy ?? namespaced.id,
      );
    }
  }

  async touchChannelBindingInbound(opts: {
    harnessName?: string;
    bindingId: string;
    at: number;
  }): Promise<ChannelBinding | null> {
    await this.#ensureChannelBindingsTable();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    // §14.1 forward-only: advance the activity markers monotonically with GREATEST so
    // a delayed or concurrent older same-binding ingress can never regress a newer
    // marker. Returns the merged row, or null when the binding no longer exists.
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_BINDINGS}
            SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, 0), ?),
                updated_at = GREATEST(updated_at, ?)
            WHERE harness_name = ? AND id = ?`,
      args: [opts.at, opts.at, namespace, opts.bindingId],
    });
    if (result.rowsAffected === 0) return null;
    return this.#loadChannelBindingByIdInNamespace(opts.bindingId, namespace);
  }

  async loadChannelBinding(opts: { bindingId: string }): Promise<ChannelBinding | null> {
    await this.#ensureChannelBindingsTable();
    return this.#loadChannelBindingByIdInNamespace(opts.bindingId, this.#resolveHarnessName());
  }

  async loadChannelBindingByExternal(opts: {
    harnessName: string;
    channelId: string;
    platform: string;
    externalTenantId?: string;
    externalChannelId?: string;
    externalThreadId: string;
  }): Promise<ChannelBinding | null> {
    await this.#ensureChannelBindingsTable();
    return this.#loadActiveChannelBindingByTuple(this.#client, {
      harnessName: this.#resolveHarnessName(opts.harnessName),
      channelId: opts.channelId,
      platform: opts.platform,
      externalTenantId: opts.externalTenantId,
      externalChannelId: opts.externalChannelId,
      externalThreadId: opts.externalThreadId,
    });
  }

  async resolveChannelBinding(opts: {
    candidate: ChannelBinding;
    replaceBindingId?: string;
  }): Promise<ResolveChannelBindingResult> {
    await this.#ensureChannelBindingsTable();
    const ns = this.#resolveHarnessName(opts.candidate.harnessName);
    const candidate: ChannelBinding = { ...opts.candidate, harnessName: ns };
    const tuple = {
      harnessName: ns,
      channelId: candidate.channelId,
      platform: candidate.platform,
      externalTenantId: candidate.externalTenantId,
      externalChannelId: candidate.externalChannelId,
      externalThreadId: candidate.externalThreadId,
    };
    const tx = await this.#client.transaction('write');
    try {
      // The tuple's current active binding is authoritative for the §14.1
      // one-active-per-tuple invariant (regardless of the caller-supplied
      // replaceBindingId, which is only a hint about the prior generation).
      const existingActive = await this.#loadActiveChannelBindingByTuple(tx, tuple);
      // Generation is storage-managed and monotonic per tuple: a new binding never
      // regresses below the max generation any binding for this tuple has ever held.
      const maxTupleGeneration = await this.#maxChannelBindingGenerationForTuple(tx, tuple);

      if (opts.replaceBindingId !== undefined) {
        // §14.1 replacement: fence the tuple's existing active binding(s) to
        // `replaced` (never an unrelated conversation named by a stale id) and
        // commit the candidate with an incremented generation. Exactly one active
        // binding remains for the tuple.
        const fenceIds = new Set<string>([opts.replaceBindingId, ...(existingActive ? [existingActive.id] : [])]);
        for (const id of fenceIds) {
          const prior = await this.#loadChannelBindingByIdWithClient(tx, id, ns);
          if (prior !== null && prior.status === 'active' && channelBindingTupleMatches(prior, tuple)) {
            await tx.execute({
              sql: `UPDATE ${TABLE_HARNESS_CHANNEL_BINDINGS}
                    SET status = 'replaced', replaced_by_binding_id = ?, updated_at = ?
                    WHERE harness_name = ? AND id = ? AND status = 'active'`,
              args: [candidate.id, candidate.updatedAt, ns, prior.id],
            });
          }
        }
        const committed: ChannelBinding = {
          ...candidate,
          harnessName: ns,
          status: 'active',
          generation: maxTupleGeneration + 1,
        };
        await tx.execute(channelBindingUpsertStatement(committed));
        await tx.commit();
        return {
          binding: committed,
          created: true,
          ...(existingActive !== null ? { replacedBindingId: existingActive.id } : {}),
        };
      }

      // No replacement: an existing active binding for the tuple wins (idempotent
      // resolution); otherwise commit the candidate as the new active binding.
      if (existingActive !== null) {
        await tx.commit();
        return { binding: existingActive, created: false };
      }
      const committed: ChannelBinding = {
        ...candidate,
        harnessName: ns,
        status: 'active',
        generation: maxTupleGeneration + 1,
      };
      await tx.execute(channelBindingUpsertStatement(committed));
      await tx.commit();
      return { binding: committed, created: true };
    } catch (err) {
      if (!tx.closed) await tx.rollback();
      throw err;
    }
  }

  async listChannelBindingsForSession(opts: { sessionId: string }): Promise<ChannelBinding[]> {
    await this.#ensureChannelBindingsTable();
    const ns = this.#resolveHarnessName();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_BINDINGS}
            WHERE harness_name = ? AND session_id = ?
            ORDER BY id ASC`,
      args: [ns, opts.sessionId],
    });
    return result.rows.map(row => rowToChannelBinding(row as Record<string, unknown>));
  }

  async listActiveChannelBindingsForScope(opts: {
    harnessName: string;
    channelId?: string;
    limit: number;
    cursor?: string;
  }): Promise<ListActiveChannelBindingsResult> {
    await this.#ensureChannelBindingsTable();
    const ns = this.#resolveHarnessName(opts.harnessName);
    const filters = ['harness_name = ?', `status = 'active'`];
    const args: (string | number)[] = [ns];
    if (opts.channelId !== undefined) {
      filters.push('channel_id = ?');
      args.push(opts.channelId);
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_BINDINGS}
            WHERE ${filters.join(' AND ')}`,
      args,
    });
    const all = result.rows.map(row => rowToChannelBinding(row as Record<string, unknown>));
    // §14.8 binding ordering: (lastOutboundAt DESC, bindingId DESC), using
    // lastInboundAt when no outbound time exists. Sorted in memory so the cursor
    // semantics match the in-memory adapter exactly (stable end-of-set on a stale
    // cursor rather than restarting page 1).
    const activityAt = (b: ChannelBinding): number => b.lastOutboundAt ?? b.lastInboundAt ?? 0;
    all.sort((a, b) => activityAt(b) - activityAt(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    let start = 0;
    if (opts.cursor !== undefined) {
      const idx = all.findIndex(b => b.id === opts.cursor);
      start = idx === -1 ? all.length : idx + 1;
    }
    const page = all.slice(start, start + opts.limit);
    const hasMore = start + opts.limit < all.length;
    const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;
    return { bindings: page, ...(nextCursor !== undefined ? { nextCursor } : {}) };
  }

  async deleteChannelBinding(opts: { bindingId: string }): Promise<void> {
    await this.#ensureChannelBindingsTable();
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_HARNESS_CHANNEL_BINDINGS} WHERE harness_name = ? AND id = ?`,
      args: [this.#resolveHarnessName(), opts.bindingId],
    });
  }

  async #loadChannelBindingByIdInNamespace(bindingId: string, namespace: string): Promise<ChannelBinding | null> {
    return this.#loadChannelBindingByIdWithClient(this.#client, bindingId, namespace);
  }

  async #loadChannelBindingByIdWithClient(
    client: PgHarnessClient,
    bindingId: string,
    namespace: string,
  ): Promise<ChannelBinding | null> {
    const result = await client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_BINDINGS} WHERE harness_name = ? AND id = ? LIMIT 1`,
      args: [namespace, bindingId],
    });
    const row = result.rows[0];
    return row ? rowToChannelBinding(row as Record<string, unknown>) : null;
  }

  async #loadActiveChannelBindingByTuple(
    client: PgHarnessClient,
    tuple: {
      harnessName: string;
      channelId: string;
      platform: string;
      externalTenantId?: string;
      externalChannelId?: string;
      externalThreadId: string;
    },
  ): Promise<ChannelBinding | null> {
    const result = await client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_BINDINGS}
            WHERE harness_name = ? AND status = 'active'
              AND channel_id = ? AND platform = ?
              AND external_tenant_id = ? AND external_channel_id = ? AND external_thread_id = ?
            LIMIT 1`,
      args: [
        tuple.harnessName,
        tuple.channelId,
        tuple.platform,
        normalizeChannelBindingExternalId(tuple.externalTenantId),
        normalizeChannelBindingExternalId(tuple.externalChannelId),
        tuple.externalThreadId,
      ],
    });
    const row = result.rows[0];
    return row ? rowToChannelBinding(row as Record<string, unknown>) : null;
  }

  async #loadActiveChannelBindingIdByTuple(binding: ChannelBinding): Promise<string | undefined> {
    const active = await this.#loadActiveChannelBindingByTuple(this.#client, binding);
    return active?.id;
  }

  async #maxChannelBindingGenerationForTuple(
    client: PgHarnessClient,
    tuple: {
      harnessName: string;
      channelId: string;
      platform: string;
      externalTenantId?: string;
      externalChannelId?: string;
      externalThreadId: string;
    },
  ): Promise<number> {
    const result = await client.execute({
      sql: `SELECT MAX(generation) AS max_generation FROM ${TABLE_HARNESS_CHANNEL_BINDINGS}
            WHERE harness_name = ? AND channel_id = ? AND platform = ?
              AND external_tenant_id = ? AND external_channel_id = ? AND external_thread_id = ?`,
      args: [
        tuple.harnessName,
        tuple.channelId,
        tuple.platform,
        normalizeChannelBindingExternalId(tuple.externalTenantId),
        normalizeChannelBindingExternalId(tuple.externalChannelId),
        tuple.externalThreadId,
      ],
    });
    const value = result.rows[0]?.max_generation;
    return value == null ? 0 : Number(value);
  }

  // -------------------------------------------------------------------------
  // Channel inbox ledger
  // -------------------------------------------------------------------------

  async saveChannelInboxItem(record: ChannelInboxItem): Promise<void> {
    await this.#ensureChannelInboxTable();
    const namespaced = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    assertValidChannelInboxState(namespaced);
    const existingByKey = await this.loadChannelInboxItemByIdempotencyKey({
      harnessName: namespaced.harnessName,
      channelId: namespaced.channelId,
      idempotencyKey: namespaced.idempotencyKey,
    });
    if (existingByKey && existingByKey.id !== namespaced.id) {
      throw new HarnessStorageChannelInboxTransitionError(
        namespaced.id,
        undefined,
        namespaced.status,
        'idempotency key is already owned by another inbox item',
      );
    }
    const existing = await this.#loadChannelInboxItemById(namespaced.id);
    if (existing) {
      if (channelInboxItemsEqual(existing, namespaced)) return;
      assertLegalChannelInboxUpdate(existing, namespaced);
    }
    const cols = channelInboxColumnValues(namespaced);
    try {
      const result = await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_INBOX}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})
              ON CONFLICT(id) DO UPDATE SET
                ${cols.names
                  .filter(name => name !== 'id')
                  .map(name => `${name} = excluded.${name}`)
                  .join(', ')}
              WHERE ${TABLE_HARNESS_CHANNEL_INBOX}.harness_name = excluded.harness_name
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.channel_id = excluded.channel_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.provider_id = excluded.provider_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.idempotency_key = excluded.idempotency_key
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.payload_hash = excluded.payload_hash
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.admission_id = excluded.admission_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.external_message_id = excluded.external_message_id
                AND ${TABLE_HARNESS_CHANNEL_INBOX}.received_at = excluded.received_at
                AND (
                  (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = excluded.status
                    AND ${TABLE_HARNESS_CHANNEL_INBOX}.status NOT IN ('accepted', 'queued', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = 'received'
                    AND excluded.status IN ('admitted', 'failed', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = 'admitted'
                    AND excluded.status IN ('accepted', 'queued', 'failed', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_INBOX}.status = 'failed'
                    AND excluded.status IN ('received', 'admitted', 'failed', 'dead')
                  )
                )`,
        args: cols.values,
      });
      if (result.rowsAffected === 0) {
        const conflict = await this.#loadChannelInboxItemById(namespaced.id);
        if (conflict && channelInboxItemsEqual(conflict, namespaced)) return;
        if (conflict) assertLegalChannelInboxUpdate(conflict, namespaced);
        throw new HarnessStorageChannelInboxTransitionError(
          namespaced.id,
          conflict?.status,
          namespaced.status,
          'id is already owned by another inbox item',
        );
      }
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const conflictingByKey = await this.loadChannelInboxItemByIdempotencyKey({
        harnessName: namespaced.harnessName,
        channelId: namespaced.channelId,
        idempotencyKey: namespaced.idempotencyKey,
      });
      if (conflictingByKey && conflictingByKey.id !== namespaced.id) {
        throw new HarnessStorageChannelInboxTransitionError(
          namespaced.id,
          undefined,
          namespaced.status,
          'idempotency key is already owned by another inbox item',
        );
      }
      throw err;
    }
  }

  async createOrLoadChannelInboxItem(
    record: ChannelInboxItem,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelInboxItemResult> {
    await this.#ensureChannelInboxTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const incoming: ChannelInboxItem = { ...record, harnessName: namespace };
    assertValidChannelInboxState(incoming);
    const initialClaim = opts?.initialClaim;
    const insertItem =
      initialClaim === undefined
        ? incoming
        : {
            ...incoming,
            claimId: initialClaim.claimId,
            claimExpiresAt: initialClaim.now + initialClaim.claimTtlMs,
            updatedAt: initialClaim.now,
          };
    const cols = channelInboxColumnValues(insertItem);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_INBOX}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return {
        item: insertItem,
        duplicate: false,
        conflict: false,
        claimed: initialClaim !== undefined,
      };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }

    let existing = await this.loadChannelInboxItemByIdempotencyKey({
      harnessName: namespace,
      channelId: incoming.channelId,
      idempotencyKey: incoming.idempotencyKey,
    });
    if (!existing) {
      const existingById = await this.#loadChannelInboxItemById(incoming.id);
      if (existingById) {
        throw new HarnessStorageChannelInboxTransitionError(
          incoming.id,
          existingById.status,
          incoming.status,
          'id is already owned by another inbox item',
        );
      }
    }
    if (!existing) throw new HarnessStorageChannelInboxClaimConflictError(incoming.id);
    const conflict = existing.payloadHash !== incoming.payloadHash;
    let claimed = false;
    if (!conflict && initialClaim && isChannelInboxClaimable(existing, initialClaim.now)) {
      const update = await this.#client.execute({
        sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
              SET claim_id = ?, claim_expires_at = ?, updated_at = ?
              WHERE harness_name = ? AND id = ?
                AND (claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                AND status NOT IN ('accepted', 'queued', 'dead')`,
        args: [
          initialClaim.claimId,
          initialClaim.now + initialClaim.claimTtlMs,
          initialClaim.now,
          namespace,
          existing.id,
          initialClaim.now,
          initialClaim.now,
        ],
      });
      if (update.rowsAffected > 0) {
        claimed = true;
        existing = (await this.#loadChannelInboxItemById(existing.id, namespace)) ?? existing;
      }
    }
    return { item: existing, duplicate: true, conflict, claimed };
  }

  async loadChannelInboxItemByIdempotencyKey({
    harnessName,
    channelId,
    idempotencyKey,
  }: {
    harnessName: string;
    channelId: string;
    idempotencyKey: string;
  }): Promise<ChannelInboxItem | null> {
    await this.#ensureChannelInboxTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}
            WHERE harness_name = ? AND channel_id = ? AND idempotency_key = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(harnessName), channelId, idempotencyKey],
    });
    const row = result.rows[0];
    return row ? rowToChannelInboxItem(row as Record<string, unknown>) : null;
  }

  async claimChannelInboxItems({
    harnessName,
    channelId,
    statuses,
    claimId,
    limit,
    now,
    claimTtlMs,
  }: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'admitted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelInboxItem[]> {
    await this.#ensureChannelInboxTable();
    if (limit <= 0 || statuses.length === 0) return [];
    const namespace = this.#resolveHarnessName(harnessName);
    const filters = [
      'harness_name = ?',
      `status IN (${statuses.map(() => '?').join(', ')})`,
      '(claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)',
      '(next_attempt_at IS NULL OR next_attempt_at <= ?)',
    ];
    const args: (string | number)[] = [namespace, ...statuses, now, now];
    if (channelId !== undefined) {
      filters.splice(1, 0, 'channel_id = ?');
      args.splice(1, 0, channelId);
    }
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT id FROM ${TABLE_HARNESS_CHANNEL_INBOX}
              WHERE ${filters.join(' AND ')}
              ORDER BY received_at ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_CHANNEL_INBOX} AS item
            SET claim_id = ?, claim_expires_at = ?, updated_at = ?
            FROM candidates
            WHERE item.id = candidates.id
            RETURNING item.*`,
      args: [...args, limit, claimId, now + claimTtlMs, now],
    });
    return claimed.rows.map(row => rowToChannelInboxItem(row as Record<string, unknown>));
  }

  async renewChannelInboxClaim({
    inboxItemId,
    claimId,
    now,
    claimTtlMs,
  }: {
    inboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureChannelInboxTable();
    const claimExpiresAt = now + claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL
              AND claim_expires_at > ?
              AND status NOT IN ('accepted', 'queued', 'dead')`,
      args: [claimExpiresAt, now, inboxItemId, claimId, now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelInboxClaimConflictError(inboxItemId, claimId);
    }
    return { claimExpiresAt, storageNow: now };
  }

  async updateChannelInboxItem(record: ChannelInboxItem, opts: { claimId: string }): Promise<void> {
    await this.#ensureChannelInboxTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const current = await this.#loadChannelInboxItemById(record.id, namespace);
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      isTerminalChannelInboxStatus(current.status)
    ) {
      throw new HarnessStorageChannelInboxClaimConflictError(record.id, opts.claimId);
    }
    const next = { ...record, harnessName: namespace };
    assertLegalChannelInboxUpdate(current, next);
    const cols = channelInboxColumnValues(next);
    const currentCols = channelInboxColumnValues(current);
    const preservesCurrentClaim = next.claimId === opts.claimId && next.claimExpiresAt !== undefined;
    const updateNames = cols.names.filter(
      name => name !== 'id' && (!preservesCurrentClaim || (name !== 'claim_id' && name !== 'claim_expires_at')),
    );
    const stateCompareNames = cols.names.filter(
      name => name !== 'id' && name !== 'claim_id' && name !== 'claim_expires_at' && name !== 'updated_at',
    );
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_INBOX}
            SET ${updateNames.map(name => `${name} = ?`).join(', ')}
            WHERE harness_name = ? AND id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL
              AND claim_expires_at > ?
              AND status NOT IN ('accepted', 'queued', 'dead')
              AND ${stateCompareNames.map(name => `${name} IS ?`).join(' AND ')}`,
      args: [
        ...updateNames.map(name => cols.values[cols.names.indexOf(name)]),
        namespace,
        next.id,
        opts.claimId,
        storageNow,
        ...stateCompareNames.map(name => currentCols.values[currentCols.names.indexOf(name)]),
      ],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelInboxClaimConflictError(record.id, opts.claimId);
    }
  }

  // -------------------------------------------------------------------------
  // Channel action token and receipt ledger
  // -------------------------------------------------------------------------

  async createOrLoadChannelActionToken(record: ChannelActionToken): Promise<CreateOrLoadChannelActionTokenResult> {
    await this.#ensureChannelActionTables();
    const token = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    const existing = await this.loadChannelActionTokenById({
      harnessName: token.harnessName,
      channelId: token.channelId,
      actionTokenId: token.actionTokenId,
    });
    if (existing) {
      return { token: existing, duplicate: true, conflict: !channelActionTokensEquivalent(existing, token) };
    }
    const existingByTransport = await this.loadChannelActionTokenByTransportHash({
      harnessName: token.harnessName,
      channelId: token.channelId,
      transportHash: token.transportHash,
    });
    if (existingByTransport) return { token: existingByTransport, duplicate: true, conflict: true };
    const existingByPending = await this.loadChannelActionTokenForPendingItem({
      harnessName: token.harnessName,
      channelId: token.channelId,
      bindingId: token.bindingId,
      bindingGeneration: token.bindingGeneration,
      owningSessionId: token.owningSessionId,
      itemId: token.itemId,
      kind: token.kind,
      runId: token.runId,
      pendingRequestedAt: token.pendingRequestedAt,
      metadataHash: token.metadataHash,
    });
    if (existingByPending) return { token: existingByPending, duplicate: true, conflict: true };
    const cols = channelActionTokenColumnValues(token);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const raced =
        (await this.loadChannelActionTokenById({
          harnessName: token.harnessName,
          channelId: token.channelId,
          actionTokenId: token.actionTokenId,
        })) ??
        (await this.loadChannelActionTokenByTransportHash({
          harnessName: token.harnessName,
          channelId: token.channelId,
          transportHash: token.transportHash,
        })) ??
        (await this.loadChannelActionTokenForPendingItem({
          harnessName: token.harnessName,
          channelId: token.channelId,
          bindingId: token.bindingId,
          bindingGeneration: token.bindingGeneration,
          owningSessionId: token.owningSessionId,
          itemId: token.itemId,
          kind: token.kind,
          runId: token.runId,
          pendingRequestedAt: token.pendingRequestedAt,
          metadataHash: token.metadataHash,
        }));
      if (raced) return { token: raced, duplicate: true, conflict: !channelActionTokensEquivalent(raced, token) };
      throw err;
    }
    return { token, duplicate: false, conflict: false };
  }

  async loadChannelActionTokenById({
    harnessName,
    channelId,
    actionTokenId,
  }: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionToken | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND channel_id = ? AND action_token_id = ?
            LIMIT 1`,
      args: [namespace, channelId, actionTokenId],
    });
    return row.rows[0] ? rowToChannelActionToken(row.rows[0] as Record<string, unknown>) : null;
  }

  async loadChannelActionTokenByTransportHash({
    harnessName,
    channelId,
    transportHash,
  }: {
    harnessName: string;
    channelId: string;
    transportHash: string;
  }): Promise<ChannelActionToken | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND channel_id = ? AND transport_hash = ?
            LIMIT 1`,
      args: [namespace, channelId, transportHash],
    });
    return row.rows[0] ? rowToChannelActionToken(row.rows[0] as Record<string, unknown>) : null;
  }

  async loadChannelActionTokenForPendingItem(opts: {
    harnessName: string;
    channelId: string;
    bindingId: string;
    bindingGeneration: number;
    owningSessionId: string;
    itemId: string;
    kind: ChannelActionToken['kind'];
    runId: string;
    pendingRequestedAt: number;
    metadataHash: string;
  }): Promise<ChannelActionToken | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND channel_id = ? AND binding_id = ? AND binding_generation = ?
              AND owning_session_id = ? AND item_id = ? AND kind = ? AND run_id = ?
              AND pending_requested_at = ? AND metadata_hash = ?
            LIMIT 1`,
      args: [
        namespace,
        opts.channelId,
        opts.bindingId,
        opts.bindingGeneration,
        opts.owningSessionId,
        opts.itemId,
        opts.kind,
        opts.runId,
        opts.pendingRequestedAt,
        opts.metadataHash,
      ],
    });
    return row.rows[0] ? rowToChannelActionToken(row.rows[0] as Record<string, unknown>) : null;
  }

  async revokeChannelActionToken(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
    revokedAt?: number;
    revokedReason?: ChannelActionToken['revokedReason'];
  }): Promise<ChannelActionToken> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const revokedAt = opts.revokedAt ?? Date.now();
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            SET revoked_at = ?, revoked_reason = ?, updated_at = ?
            WHERE harness_name = ? AND channel_id = ? AND action_token_id = ?`,
      args: [revokedAt, opts.revokedReason ?? null, revokedAt, namespace, opts.channelId, opts.actionTokenId],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelActionTokenConflictError(opts.actionTokenId, 'token was not found');
    }
    return (await this.loadChannelActionTokenById({
      harnessName: namespace,
      channelId: opts.channelId,
      actionTokenId: opts.actionTokenId,
    }))!;
  }

  async saveChannelActionReceipt(record: ChannelActionReceipt): Promise<void> {
    await this.#ensureChannelActionTables();
    const receipt = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    assertValidChannelActionReceiptState(receipt);
    const existing = await this.#loadChannelActionReceiptById(receipt.id);
    if (existing) {
      if (channelActionReceiptsEqual(existing, receipt)) return;
      assertLegalChannelActionReceiptUpdate(existing, receipt);
    }
    const existingByToken = await this.loadChannelActionReceiptByTokenId({
      harnessName: receipt.harnessName,
      channelId: receipt.channelId,
      actionTokenId: receipt.actionTokenId,
    });
    if (existingByToken && existingByToken.id !== receipt.id) {
      throw new HarnessStorageChannelActionReceiptTransitionError(
        receipt.id,
        existingByToken.status,
        receipt.status,
        'action token is already owned by another receipt',
      );
    }
    const cols = channelActionReceiptColumnValues(receipt);
    try {
      const result = await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})
              ON CONFLICT(id) DO UPDATE SET
                ${cols.names
                  .filter(name => name !== 'id')
                  .map(name => `${name} = excluded.${name}`)
                  .join(', ')}
              WHERE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.harness_name = excluded.harness_name
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.channel_id = excluded.channel_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.provider_id = excluded.provider_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.action_token_id = excluded.action_token_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.action_id = excluded.action_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.binding_id = excluded.binding_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.binding_generation = excluded.binding_generation
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.resource_id = excluded.resource_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.owning_session_id = excluded.owning_session_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.item_id = excluded.item_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.kind = excluded.kind
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.run_id = excluded.run_id
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.pending_requested_at = excluded.pending_requested_at
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.audience = excluded.audience
                AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.response_hash = excluded.response_hash
                AND (
                  (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = excluded.status
                    AND ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status NOT IN ('applied', 'conflict', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = 'received'
                    AND excluded.status IN ('accepted', 'failed', 'conflict', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = 'accepted'
                    AND excluded.status IN ('applied', 'failed', 'dead')
                  )
                  OR (
                    ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}.status = 'failed'
                    AND excluded.status IN ('received', 'accepted', 'failed', 'dead')
                  )
                )`,
        args: cols.values,
      });
      if (result.rowsAffected === 0) {
        const conflict = await this.#loadChannelActionReceiptById(receipt.id);
        if (conflict && channelActionReceiptsEqual(conflict, receipt)) return;
        if (conflict) assertLegalChannelActionReceiptUpdate(conflict, receipt);
        throw new HarnessStorageChannelActionReceiptTransitionError(
          receipt.id,
          conflict?.status,
          receipt.status,
          'receipt upsert did not affect a row',
        );
      }
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      const conflictingByToken = await this.loadChannelActionReceiptByTokenId({
        harnessName: receipt.harnessName,
        channelId: receipt.channelId,
        actionTokenId: receipt.actionTokenId,
      });
      if (conflictingByToken && conflictingByToken.id !== receipt.id) {
        throw new HarnessStorageChannelActionReceiptTransitionError(
          receipt.id,
          conflictingByToken.status,
          receipt.status,
          'action token is already owned by another receipt',
        );
      }
      throw err;
    }
  }

  async createOrLoadChannelActionReceipt(
    record: ChannelActionReceipt,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelActionReceiptResult> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const incoming: ChannelActionReceipt = { ...record, harnessName: namespace };
    assertValidChannelActionReceiptState(incoming);
    let existing = await this.loadChannelActionReceiptByTokenId({
      harnessName: namespace,
      channelId: incoming.channelId,
      actionTokenId: incoming.actionTokenId,
    });
    if (existing) return this.#channelActionReceiptDuplicate(existing, incoming, opts);
    const insertReceipt =
      opts?.initialClaim === undefined
        ? incoming
        : {
            ...incoming,
            claimId: opts.initialClaim.claimId,
            claimExpiresAt: opts.initialClaim.now + opts.initialClaim.claimTtlMs,
            updatedAt: opts.initialClaim.now,
          };
    const cols = channelActionReceiptColumnValues(insertReceipt);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return {
        receipt: insertReceipt,
        duplicate: false,
        conflict: false,
        claimed: opts?.initialClaim !== undefined,
      };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
    existing = await this.loadChannelActionReceiptByTokenId({
      harnessName: namespace,
      channelId: incoming.channelId,
      actionTokenId: incoming.actionTokenId,
    });
    if (existing) return this.#channelActionReceiptDuplicate(existing, incoming, opts);
    const existingById = await this.#loadChannelActionReceiptById(incoming.id);
    if (existingById) {
      throw new HarnessStorageChannelActionReceiptTransitionError(
        incoming.id,
        existingById.status,
        incoming.status,
        'id is already owned by another action receipt',
      );
    }
    throw new HarnessStorageChannelActionClaimConflictError(incoming.id);
  }

  async #channelActionReceiptDuplicate(
    existing: ChannelActionReceipt,
    incoming: ChannelActionReceipt,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadChannelActionReceiptResult> {
    const conflict = !channelActionReceiptsEquivalentForCreate(existing, incoming);
    let receipt = existing;
    let claimed = false;
    if (!conflict && opts?.initialClaim && isChannelActionReceiptClaimable(existing, opts.initialClaim.now)) {
      const update = await this.#client.execute({
        sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              SET claim_id = ?, claim_expires_at = ?, updated_at = ?
              WHERE id = ?
                AND (claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                AND status NOT IN ('applied', 'conflict', 'dead')`,
        args: [
          opts.initialClaim.claimId,
          opts.initialClaim.now + opts.initialClaim.claimTtlMs,
          opts.initialClaim.now,
          existing.id,
          opts.initialClaim.now,
          opts.initialClaim.now,
        ],
      });
      if (update.rowsAffected > 0) {
        claimed = true;
        receipt = (await this.#loadChannelActionReceiptById(existing.id)) ?? existing;
      }
    }
    return { receipt, duplicate: true, conflict, claimed };
  }

  async loadChannelActionReceiptByActionId(opts: {
    harnessName: string;
    channelId: string;
    actionId: string;
  }): Promise<ChannelActionReceipt | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE harness_name = ? AND channel_id = ? AND action_id = ?
            ORDER BY created_at ASC, id ASC
            LIMIT 1`,
      args: [namespace, opts.channelId, opts.actionId],
    });
    return row.rows[0] ? rowToChannelActionReceipt(row.rows[0] as Record<string, unknown>) : null;
  }

  async loadChannelActionReceiptByTokenId(opts: {
    harnessName: string;
    channelId: string;
    actionTokenId: string;
  }): Promise<ChannelActionReceipt | null> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE harness_name = ? AND channel_id = ? AND action_token_id = ?
            LIMIT 1`,
      args: [namespace, opts.channelId, opts.actionTokenId],
    });
    return row.rows[0] ? rowToChannelActionReceipt(row.rows[0] as Record<string, unknown>) : null;
  }

  async #loadChannelActionReceiptById(id: string, harnessName?: string): Promise<ChannelActionReceipt | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const row = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    return row.rows[0] ? rowToChannelActionReceipt(row.rows[0] as Record<string, unknown>) : null;
  }

  async claimChannelActionReceipts(opts: {
    harnessName: string;
    channelId?: string;
    statuses: Array<'received' | 'accepted' | 'failed'>;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelActionReceipt[]> {
    await this.#ensureChannelActionTables();
    if (opts.limit <= 0 || opts.statuses.length === 0) return [];
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const filters = ['harness_name = ?', `status IN (${opts.statuses.map(() => '?').join(', ')})`];
    const args: any[] = [namespace, ...opts.statuses];
    if (opts.channelId !== undefined) {
      filters.push('channel_id = ?');
      args.push(opts.channelId);
    }
    filters.push('(next_attempt_at IS NULL OR next_attempt_at <= ?)');
    filters.push('(claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)');
    args.push(opts.now, opts.now, opts.limit);
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT id FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
              WHERE ${filters.join(' AND ')}
              ORDER BY created_at ASC, id ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS} AS receipt
            SET claim_id = ?, claim_expires_at = ?, updated_at = ?
            FROM candidates
            WHERE receipt.id = candidates.id
            RETURNING receipt.*`,
      args: [...args, opts.claimId, opts.now + opts.claimTtlMs, opts.now],
    });
    return claimed.rows.map(row => rowToChannelActionReceipt(row as Record<string, unknown>));
  }

  async renewChannelActionReceiptClaim(opts: {
    receiptId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureChannelActionTables();
    const claimExpiresAt = opts.now + opts.claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
              AND status NOT IN ('applied', 'conflict', 'dead')`,
      args: [claimExpiresAt, opts.now, opts.receiptId, opts.claimId, opts.now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelActionClaimConflictError(opts.receiptId, opts.claimId);
    }
    return { claimExpiresAt, storageNow: opts.now };
  }

  async updateChannelActionReceipt(record: ChannelActionReceipt, opts: { claimId: string }): Promise<void> {
    await this.#ensureChannelActionTables();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const current = await this.#loadChannelActionReceiptById(record.id, namespace);
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      isTerminalChannelActionReceiptStatus(current.status)
    ) {
      throw new HarnessStorageChannelActionClaimConflictError(record.id, opts.claimId);
    }
    const next = { ...record, harnessName: namespace };
    assertLegalChannelActionReceiptUpdate(current, next);
    const cols = channelActionReceiptColumnValues(next);
    const currentCols = channelActionReceiptColumnValues(current);
    const preservesCurrentClaim = next.claimId === opts.claimId && next.claimExpiresAt !== undefined;
    const updateNames = cols.names.filter(
      name => name !== 'id' && (!preservesCurrentClaim || (name !== 'claim_id' && name !== 'claim_expires_at')),
    );
    const stateCompareNames = cols.names.filter(
      name => name !== 'id' && name !== 'claim_id' && name !== 'claim_expires_at' && name !== 'updated_at',
    );
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            SET ${updateNames.map(name => `${name} = ?`).join(', ')}
            WHERE harness_name = ? AND id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
              AND status NOT IN ('applied', 'conflict', 'dead')
              AND ${stateCompareNames.map(name => `${name} IS ?`).join(' AND ')}`,
      args: [
        ...updateNames.map(name => cols.values[cols.names.indexOf(name)]),
        namespace,
        next.id,
        opts.claimId,
        storageNow,
        ...stateCompareNames.map(name => currentCols.values[currentCols.names.indexOf(name)]),
      ],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelActionClaimConflictError(record.id, opts.claimId);
    }
  }

  async enqueueChannelOutbox(record: ChannelOutboxItem): Promise<{
    outboxItemId: string;
    duplicate: boolean;
    conflict: boolean;
  }> {
    await this.#ensureChannelOutboxTable();
    const item: ChannelOutboxItem = { ...record, harnessName: this.#resolveHarnessName(record.harnessName) };
    assertValidChannelOutboxState(item);
    const cols = channelOutboxColumnValues(item);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_OUTBOX}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return { outboxItemId: item.id, duplicate: false, conflict: false };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }

    const existing = await this.#loadChannelOutboxByIdempotencyKey({
      harnessName: item.harnessName,
      bindingId: item.bindingId,
      idempotencyKey: item.idempotencyKey,
    });
    if (existing) {
      return {
        outboxItemId: existing.id,
        duplicate: true,
        conflict: !channelOutboxItemsEquivalentForEnqueue(existing, item),
      };
    }
    const existingById = await this.#loadChannelOutboxItemById(item.id);
    if (existingById) {
      throw new HarnessStorageChannelOutboxTransitionError(
        item.id,
        existingById.status,
        item.status,
        'id is already owned by another outbox item',
      );
    }
    throw new HarnessStorageChannelOutboxTransitionError(
      item.id,
      undefined,
      item.status,
      'unique constraint conflict could not be resolved after enqueue',
    );
  }

  async claimChannelOutbox(opts: {
    harnessName: string;
    channelId?: string;
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<ChannelOutboxItem[]> {
    await this.#ensureChannelOutboxTable();
    if (opts.limit <= 0) return [];
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const filters = [
      'candidate.harness_name = ?',
      "candidate.status IN ('pending', 'failed', 'claimed')",
      '(candidate.claim_id IS NULL OR candidate.claim_expires_at IS NULL OR candidate.claim_expires_at <= ?)',
      '(candidate.next_attempt_at IS NULL OR candidate.next_attempt_at <= ?)',
      `NOT EXISTS (
        SELECT 1 FROM ${TABLE_HARNESS_CHANNEL_OUTBOX} AS earlier
        WHERE earlier.harness_name = candidate.harness_name
          AND earlier.binding_id = candidate.binding_id
          AND earlier.id != candidate.id
          AND earlier.status NOT IN ('sent', 'dead')
          AND (earlier.created_at < candidate.created_at
            OR (earlier.created_at = candidate.created_at AND earlier.id < candidate.id))
      )`,
    ];
    const args: (string | number)[] = [namespace, opts.now, opts.now];
    if (opts.channelId !== undefined) {
      filters.splice(1, 0, 'candidate.channel_id = ?');
      args.splice(1, 0, opts.channelId);
    }
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT candidate.id FROM ${TABLE_HARNESS_CHANNEL_OUTBOX} AS candidate
              WHERE ${filters.join(' AND ')}
              ORDER BY candidate.created_at ASC, candidate.id ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX} AS item
            SET status = 'claimed',
                attempts = item.attempts + 1,
                claim_id = ?,
                claim_expires_at = ?,
                next_attempt_at = NULL,
                failed_at = NULL,
                last_error = NULL,
                updated_at = ?
            FROM candidates
            WHERE item.id = candidates.id
            RETURNING item.*`,
      args: [...args, opts.limit, opts.claimId, opts.now + opts.claimTtlMs, opts.now],
    });
    return claimed.rows.map(row => rowToChannelOutboxItem(row as Record<string, unknown>));
  }

  async renewChannelOutboxClaim(opts: {
    outboxItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureChannelOutboxTable();
    const claimExpiresAt = opts.now + opts.claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND status = 'claimed' AND claim_id = ? AND claim_expires_at IS NOT NULL AND claim_expires_at > ?`,
      args: [claimExpiresAt, opts.now, opts.outboxItemId, opts.claimId, opts.now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageChannelOutboxClaimConflictError(opts.outboxItemId, opts.claimId);
    }
    return { claimExpiresAt, storageNow: opts.now };
  }

  async markChannelOutboxSent(opts: {
    outboxItemId: string;
    claimId: string;
    sentAt?: number;
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }): Promise<void> {
    await this.#ensureChannelOutboxTable();
    const current = await this.#claimedChannelOutboxItem(opts.outboxItemId, opts.claimId);
    const storageNow = Date.now();
    const next: ChannelOutboxItem = {
      ...current,
      status: 'sent',
      claimId: undefined,
      claimExpiresAt: undefined,
      nextAttemptAt: undefined,
      failedAt: undefined,
      deadAt: undefined,
      lastError: undefined,
      sentAt: opts.sentAt ?? storageNow,
      providerMessageId: opts.providerMessageId,
      providerReceipt: opts.providerReceipt,
      updatedAt: storageNow,
    };
    assertLegalChannelOutboxUpdate(current, next);
    const cols = channelOutboxColumnValues(next);
    const update = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}
            SET ${cols.names.map(name => `${name} = ?`).join(', ')}
            WHERE id = ? AND status = 'claimed' AND claim_id = ? AND claim_expires_at IS NOT NULL AND claim_expires_at > ?`,
      args: [...cols.values, opts.outboxItemId, opts.claimId, storageNow],
    });
    if (update.rowsAffected === 0) {
      throw new HarnessStorageChannelOutboxClaimConflictError(opts.outboxItemId, opts.claimId);
    }
  }

  async markChannelOutboxFailed(opts: {
    outboxItemId: string;
    claimId: string;
    retryAt?: number;
    dead?: boolean;
    error: NonNullable<ChannelOutboxItem['lastError']>;
  }): Promise<void> {
    await this.#ensureChannelOutboxTable();
    const current = await this.#claimedChannelOutboxItem(opts.outboxItemId, opts.claimId);
    const storageNow = Date.now();
    const terminal = opts.dead === true || opts.error.retryable === false;
    const next: ChannelOutboxItem = {
      ...current,
      status: terminal ? 'dead' : 'failed',
      claimId: undefined,
      claimExpiresAt: undefined,
      nextAttemptAt: terminal ? undefined : opts.retryAt,
      failedAt: terminal ? current.failedAt : storageNow,
      deadAt: terminal ? storageNow : undefined,
      lastError: { ...opts.error, retryable: terminal ? false : (opts.error.retryable ?? true) },
      updatedAt: storageNow,
    };
    assertLegalChannelOutboxUpdate(current, next);
    const cols = channelOutboxColumnValues(next);
    const update = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_CHANNEL_OUTBOX}
            SET ${cols.names.map(name => `${name} = ?`).join(', ')}
            WHERE id = ? AND status = 'claimed' AND claim_id = ? AND claim_expires_at IS NOT NULL AND claim_expires_at > ?`,
      args: [...cols.values, opts.outboxItemId, opts.claimId, storageNow],
    });
    if (update.rowsAffected === 0) {
      throw new HarnessStorageChannelOutboxClaimConflictError(opts.outboxItemId, opts.claimId);
    }
  }

  async listChannelDiagnosticsRows(opts: ListChannelDiagnosticsInput): Promise<ChannelDiagnosticsRows> {
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const limit = opts.limit ?? 50;
    const sessionIds = Array.from(new Set(opts.sessionIds));
    if (limit <= 0 || sessionIds.length === 0) {
      return { inbox: [], actionTokens: [], actionReceipts: [], outbox: [] };
    }
    await this.#ensureChannelInboxTable();
    await this.#ensureChannelActionTables();
    await this.#ensureChannelOutboxTable();

    const sessionPlaceholders = sessionIds.map(() => '?').join(', ');
    const inbox = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}
            WHERE harness_name = ? AND resource_id = ? AND session_id IN (${sessionPlaceholders})
            ORDER BY updated_at DESC, id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, limit],
    });
    const actionTokens = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_TOKENS}
            WHERE harness_name = ? AND resource_id = ? AND owning_session_id IN (${sessionPlaceholders})
            ORDER BY updated_at DESC, action_token_id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, limit],
    });
    const actionReceipts = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS}
            WHERE harness_name = ? AND resource_id = ? AND owning_session_id IN (${sessionPlaceholders})
            ORDER BY updated_at DESC, id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, limit],
    });
    const outbox = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
            WHERE harness_name = ? AND resource_id = ?
              AND (session_id IN (${sessionPlaceholders}) OR owning_session_id IN (${sessionPlaceholders}))
            ORDER BY updated_at DESC, id DESC
            LIMIT ?`,
      args: [namespace, opts.resourceId, ...sessionIds, ...sessionIds, limit],
    });

    return {
      inbox: inbox.rows.map(row => rowToChannelInboxItem(row)),
      actionTokens: actionTokens.rows.map(row => rowToChannelActionToken(row)),
      actionReceipts: actionReceipts.rows.map(row => rowToChannelActionReceipt(row)),
      outbox: outbox.rows.map(row => rowToChannelOutboxItem(row)),
    };
  }

  async createOrLoadHarnessWakeupItem(
    record: HarnessWakeupItem,
    opts?: { initialClaim?: { claimId: string; now: number; claimTtlMs: number } },
  ): Promise<CreateOrLoadHarnessWakeupItemResult> {
    await this.#ensureWakeupTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const incoming: HarnessWakeupItem = { ...record, harnessName: namespace };
    if (incoming.status !== 'due') {
      throw new HarnessStorageWakeupTransitionError(
        incoming.id,
        undefined,
        incoming.status,
        'new wakeups must start as due',
      );
    }
    assertValidHarnessWakeupState(incoming);
    const canInitialClaim =
      opts?.initialClaim !== undefined && isHarnessWakeupClaimable(incoming, opts.initialClaim.now);
    const insertItem = canInitialClaim
      ? claimHarnessWakeupItem(
          incoming,
          opts.initialClaim!.claimId,
          opts.initialClaim!.now,
          opts.initialClaim!.claimTtlMs,
        )
      : incoming;
    assertValidHarnessWakeupState(insertItem);
    const cols = harnessWakeupColumnValues(insertItem);
    try {
      await this.#client.execute({
        sql: `INSERT INTO ${TABLE_HARNESS_WAKEUPS}
              (${cols.names.join(', ')})
              VALUES (${cols.names.map(() => '?').join(', ')})`,
        args: cols.values,
      });
      return { item: insertItem, duplicate: false, conflict: false, claimed: canInitialClaim };
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
    let existing = await this.loadHarnessWakeupItemByIdempotencyKey({
      harnessName: namespace,
      idempotencyKey: incoming.idempotencyKey,
    });
    if (!existing) {
      existing = await this.loadHarnessWakeupItemBySourceFire({
        harnessName: namespace,
        source: incoming.source,
        sourceId: incoming.sourceId,
        fireId: incoming.fireId,
      });
    }
    if (!existing) {
      const existingById = await this.#loadHarnessWakeupItemById(incoming.id);
      if (existingById) {
        throw new HarnessStorageWakeupTransitionError(
          incoming.id,
          existingById.status,
          incoming.status,
          'id is already owned by another wakeup item',
        );
      }
      throw new HarnessStorageWakeupClaimConflictError(incoming.id);
    }
    const conflict = !harnessWakeupItemsEquivalentForCreate(existing, incoming);
    let item = existing;
    let claimed = false;
    if (!conflict && opts?.initialClaim && isHarnessWakeupClaimable(existing, opts.initialClaim.now)) {
      const update = await this.#client.execute({
        sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
              SET status = 'claimed',
                  attempts = attempts + 1,
                  claim_id = ?,
                  claim_expires_at = ?,
                  claimed_at = ?,
                  queued_item_id = NULL,
                  queued_at = NULL,
                  completed_at = NULL,
                  dead_at = NULL,
                  run_id = NULL,
                  signal_id = NULL,
                  result = NULL,
                  next_attempt_at = NULL,
                  failed_at = NULL,
                  last_error = NULL,
                  updated_at = ?
              WHERE harness_name = ? AND id = ?
                AND status IN ('due', 'failed', 'claimed')
                AND due_at <= ?
                AND (claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)
                AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
        args: [
          opts.initialClaim.claimId,
          opts.initialClaim.now + opts.initialClaim.claimTtlMs,
          opts.initialClaim.now,
          opts.initialClaim.now,
          namespace,
          existing.id,
          opts.initialClaim.now,
          opts.initialClaim.now,
          opts.initialClaim.now,
        ],
      });
      if (update.rowsAffected > 0) {
        claimed = true;
        item = (await this.#loadHarnessWakeupItemById(existing.id, namespace)) ?? existing;
      }
    }
    return { item, duplicate: true, conflict, claimed };
  }

  async loadHarnessWakeupItemByIdempotencyKey(opts: {
    harnessName: string;
    idempotencyKey: string;
  }): Promise<HarnessWakeupItem | null> {
    await this.#ensureWakeupTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE harness_name = ? AND idempotency_key = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(opts.harnessName), opts.idempotencyKey],
    });
    return result.rows[0] ? rowToHarnessWakeupItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async loadHarnessWakeupItemBySourceFire(opts: {
    harnessName: string;
    source: HarnessWakeupItem['source'];
    sourceId: string;
    fireId: string;
  }): Promise<HarnessWakeupItem | null> {
    await this.#ensureWakeupTable();
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE harness_name = ? AND source = ? AND source_id = ? AND fire_id = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(opts.harnessName), opts.source, opts.sourceId, opts.fireId],
    });
    return result.rows[0] ? rowToHarnessWakeupItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async claimHarnessWakeupItems(opts: {
    harnessName: string;
    source?: HarnessWakeupItem['source'];
    statuses: HarnessWakeupClaimStatus[];
    claimId: string;
    limit: number;
    now: number;
    claimTtlMs: number;
  }): Promise<HarnessWakeupItem[]> {
    await this.#ensureWakeupTable();
    if (opts.limit <= 0 || opts.statuses.length === 0) return [];
    const namespace = this.#resolveHarnessName(opts.harnessName);
    const filters = [
      'harness_name = ?',
      `status IN (${opts.statuses.map(() => '?').join(', ')})`,
      'due_at <= ?',
      '(claim_id IS NULL OR claim_expires_at IS NULL OR claim_expires_at <= ?)',
      '(next_attempt_at IS NULL OR next_attempt_at <= ?)',
    ];
    const args: any[] = [namespace, ...opts.statuses, opts.now, opts.now, opts.now];
    if (opts.source !== undefined) {
      filters.splice(1, 0, 'source = ?');
      args.splice(1, 0, opts.source);
    }
    const claimed = await this.#client.execute({
      sql: `WITH candidates AS (
              SELECT id FROM ${TABLE_HARNESS_WAKEUPS}
              WHERE ${filters.join(' AND ')}
              ORDER BY due_at ASC, created_at ASC, id ASC
              LIMIT ?
              FOR UPDATE SKIP LOCKED
            )
            UPDATE ${TABLE_HARNESS_WAKEUPS} AS wakeup
            SET status = 'claimed',
                attempts = wakeup.attempts + 1,
                claim_id = ?,
                claim_expires_at = ?,
                claimed_at = ?,
                queued_item_id = NULL,
                queued_at = NULL,
                completed_at = NULL,
                dead_at = NULL,
                run_id = NULL,
                signal_id = NULL,
                result = NULL,
                next_attempt_at = NULL,
                failed_at = NULL,
                last_error = NULL,
                updated_at = ?
            FROM candidates
            WHERE wakeup.id = candidates.id
            RETURNING wakeup.*`,
      args: [...args, opts.limit, opts.claimId, opts.now + opts.claimTtlMs, opts.now, opts.now],
    });
    return claimed.rows.map(row => rowToHarnessWakeupItem(row as Record<string, unknown>));
  }

  async renewHarnessWakeupClaim(opts: {
    wakeupItemId: string;
    claimId: string;
    now: number;
    claimTtlMs: number;
  }): Promise<{ claimExpiresAt: number; storageNow: number }> {
    await this.#ensureWakeupTable();
    const claimExpiresAt = opts.now + opts.claimTtlMs;
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
            SET claim_expires_at = ?, updated_at = ?
            WHERE id = ? AND claim_id = ?
              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
              AND status = 'claimed'`,
      args: [claimExpiresAt, opts.now, opts.wakeupItemId, opts.claimId, opts.now],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageWakeupClaimConflictError(opts.wakeupItemId, opts.claimId);
    }
    return { claimExpiresAt, storageNow: opts.now };
  }

  async updateHarnessWakeupItem(record: HarnessWakeupItem, opts: { claimId: string }): Promise<void> {
    await this.#ensureWakeupTable();
    const namespace = this.#resolveHarnessName(record.harnessName);
    const current = await this.#loadHarnessWakeupItemById(record.id, namespace);
    const storageNow = Date.now();
    if (
      !current ||
      current.claimId !== opts.claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow ||
      current.status !== 'claimed'
    ) {
      throw new HarnessStorageWakeupClaimConflictError(record.id, opts.claimId);
    }
    const next = { ...record, harnessName: namespace };
    assertLegalHarnessWakeupUpdate(current, next);
    const cols = harnessWakeupColumnValues(next);
    const currentCols = harnessWakeupColumnValues(current);
    const preservesCurrentClaim = next.claimId === opts.claimId && next.claimExpiresAt !== undefined;
    const updateNames = cols.names.filter(
      name => name !== 'id' && (!preservesCurrentClaim || (name !== 'claim_id' && name !== 'claim_expires_at')),
    );
    const stateCompareNames = cols.names.filter(
      name => name !== 'id' && name !== 'claim_id' && name !== 'claim_expires_at' && name !== 'updated_at',
    );
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_WAKEUPS}
	            SET ${updateNames.map(name => `${name} = ?`).join(', ')}
	            WHERE harness_name = ? AND id = ? AND claim_id = ?
	              AND claim_expires_at IS NOT NULL AND claim_expires_at > ?
	              AND status = 'claimed'
	              AND ${stateCompareNames.map(name => `${name} IS ?`).join(' AND ')}`,
      args: [
        ...updateNames.map(name => cols.values[cols.names.indexOf(name)]),
        namespace,
        next.id,
        opts.claimId,
        storageNow,
        ...stateCompareNames.map(name => currentCols.values[currentCols.names.indexOf(name)]),
      ],
    });
    if (result.rowsAffected === 0) {
      throw new HarnessStorageWakeupClaimConflictError(record.id, opts.claimId);
    }
  }

  async #loadHarnessWakeupItemById(id: string, harnessName?: string): Promise<HarnessWakeupItem | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_WAKEUPS}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    return result.rows[0] ? rowToHarnessWakeupItem(result.rows[0] as Record<string, unknown>) : null;
  }

  async #loadChannelInboxItemById(id: string, harnessName?: string): Promise<ChannelInboxItem | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_INBOX}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    const row = result.rows[0];
    return row ? rowToChannelInboxItem(row as Record<string, unknown>) : null;
  }

  async #loadChannelOutboxItemById(id: string, harnessName?: string): Promise<ChannelOutboxItem | null> {
    const conditions = ['id = ?'];
    const args: string[] = [id];
    if (harnessName !== undefined) {
      conditions.unshift('harness_name = ?');
      args.unshift(this.#resolveHarnessName(harnessName));
    }
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1`,
      args,
    });
    const row = result.rows[0];
    return row ? rowToChannelOutboxItem(row as Record<string, unknown>) : null;
  }

  async #loadChannelOutboxByIdempotencyKey(opts: {
    harnessName: string;
    bindingId: string;
    idempotencyKey: string;
  }): Promise<ChannelOutboxItem | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_HARNESS_CHANNEL_OUTBOX}
            WHERE harness_name = ? AND binding_id = ? AND idempotency_key = ?
            LIMIT 1`,
      args: [this.#resolveHarnessName(opts.harnessName), opts.bindingId, opts.idempotencyKey],
    });
    const row = result.rows[0];
    return row ? rowToChannelOutboxItem(row as Record<string, unknown>) : null;
  }

  async #claimedChannelOutboxItem(outboxItemId: string, claimId: string): Promise<ChannelOutboxItem> {
    const current = await this.#loadChannelOutboxItemById(outboxItemId);
    const storageNow = Date.now();
    if (
      !current ||
      current.status !== 'claimed' ||
      current.claimId !== claimId ||
      current.claimExpiresAt === undefined ||
      current.claimExpiresAt <= storageNow
    ) {
      throw new HarnessStorageChannelOutboxClaimConflictError(outboxItemId, claimId);
    }
    return current;
  }

  async #backfillHarnessNamespace(): Promise<void> {
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET harness_name = ?
            WHERE harness_name IS NULL OR harness_name = ''`,
      args: [this.#harnessName],
    });
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_ATTACHMENTS}
            SET harness_name = ?
            WHERE harness_name IS NULL OR harness_name = ''`,
      args: [this.#harnessName],
    });
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_ATTACHMENT_REFERENCES}
            SET harness_name = ?
            WHERE harness_name IS NULL OR harness_name = ''`,
      args: [this.#harnessName],
    });
  }

  #resolveHarnessName(input?: string): string {
    return input ?? this.#harnessName;
  }

  #schemaPrefix(): string {
    return this.#schema !== 'public' ? `${this.#schema}_` : '';
  }

  async #createDefaultIndexes(indexNames?: readonly string[]): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    const prefix = this.#schemaPrefix();
    const allowedNames =
      indexNames === undefined ? undefined : new Set(indexNames.map(name => harnessIndexName(prefix, name)));
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      if (allowedNames !== undefined && !allowedNames.has(indexDef.name)) continue;
      await this.#db.createIndex(indexDef);
    }
  }

  async #ensureMessageResultsTable(): Promise<void> {
    const messageResultsConfig = TABLE_CONFIGS[TABLE_HARNESS_MESSAGE_RESULTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_MESSAGE_RESULTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_MESSAGE_RESULTS],
      compositePrimaryKey: messageResultsConfig?.compositePrimaryKey,
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_MESSAGE_RESULTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_MESSAGE_RESULTS],
      ifNotExists: ['mode_id', 'model_id', 'operation_kind', 'dispatch'],
    });
  }

  async #ensureOperationTombstonesTable(): Promise<void> {
    const tombstonesConfig = TABLE_CONFIGS[TABLE_HARNESS_OPERATION_TOMBSTONES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_OPERATION_TOMBSTONES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_OPERATION_TOMBSTONES],
      compositePrimaryKey: tombstonesConfig?.compositePrimaryKey,
    });
  }

  async #ensureSessionEventsTable(): Promise<void> {
    if (this.#sessionEventsReady !== undefined) {
      return this.#sessionEventsReady;
    }
    this.#sessionEventsReady = (async () => {
      const eventConfig = TABLE_CONFIGS[TABLE_HARNESS_SESSION_EVENTS];
      await this.#db.createTable({
        tableName: TABLE_HARNESS_SESSION_EVENTS,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_SESSION_EVENTS],
        compositePrimaryKey: eventConfig?.compositePrimaryKey,
      });
      await this.#createDefaultIndexes(['idx_harness_session_events_replay']);
    })().catch(error => {
      this.#sessionEventsReady = undefined;
      throw error;
    });
    return this.#sessionEventsReady;
  }

  async #ensureWorkspaceActionsTable(): Promise<void> {
    if (this.#workspaceActionsReady !== undefined) {
      return this.#workspaceActionsReady;
    }
    this.#workspaceActionsReady = (async () => {
      const workspaceActionsConfig = TABLE_CONFIGS[TABLE_HARNESS_WORKSPACE_ACTIONS];
      await this.#db.createTable({
        tableName: TABLE_HARNESS_WORKSPACE_ACTIONS,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_WORKSPACE_ACTIONS],
        compositePrimaryKey: workspaceActionsConfig?.compositePrimaryKey,
      });
      await this.#db.alterTable({
        tableName: TABLE_HARNESS_WORKSPACE_ACTIONS,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_WORKSPACE_ACTIONS],
        ifNotExists: ['trace_id', 'span_id'],
      });
      await this.#createDefaultIndexes(['idx_harness_workspace_actions_session']);
      await this.#createDefaultIndexes(['idx_harness_workspace_actions_page']);
    })().catch(error => {
      this.#workspaceActionsReady = undefined;
      throw error;
    });
    return this.#workspaceActionsReady;
  }

  async #ensurePlanTasksTable(): Promise<void> {
    if (this.#planTasksReady !== undefined) {
      return this.#planTasksReady;
    }
    this.#planTasksReady = (async () => {
      const planTasksConfig = TABLE_CONFIGS[TABLE_HARNESS_PLAN_TASKS];
      await this.#db.createTable({
        tableName: TABLE_HARNESS_PLAN_TASKS,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_PLAN_TASKS],
        compositePrimaryKey: planTasksConfig?.compositePrimaryKey,
      });
      // Migrate columns added after the table's first creation onto existing
      // deployments (createTable is CREATE TABLE IF NOT EXISTS and never alters).
      await this.#db.alterTable({
        tableName: TABLE_HARNESS_PLAN_TASKS,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_PLAN_TASKS],
        ifNotExists: ['delegated_subagent_type_id', 'started_at', 'idempotency_input_hash'],
      });
      await this.#createDefaultIndexes(['idx_harness_plan_tasks_order']);
      await this.#createDefaultIndexes(['idx_harness_plan_tasks_idempotency']);
    })().catch(error => {
      this.#planTasksReady = undefined;
      throw error;
    });
    return this.#planTasksReady;
  }

  async #ensureRunSummariesTable(): Promise<void> {
    if (this.#runSummariesReady !== undefined) {
      return this.#runSummariesReady;
    }
    this.#runSummariesReady = (async () => {
      const config = TABLE_CONFIGS[TABLE_HARNESS_RUN_SUMMARIES];
      await this.#db.createTable({
        tableName: TABLE_HARNESS_RUN_SUMMARIES,
        schema: TABLE_SCHEMAS[TABLE_HARNESS_RUN_SUMMARIES],
        compositePrimaryKey: config?.compositePrimaryKey,
      });
    })().catch(error => {
      this.#runSummariesReady = undefined;
      throw error;
    });
    return this.#runSummariesReady;
  }

  async #ensureThreadDeleteFencesTable(): Promise<void> {
    const threadDeleteFencesConfig = TABLE_CONFIGS[TABLE_HARNESS_THREAD_DELETE_FENCES];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_THREAD_DELETE_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_THREAD_DELETE_FENCES],
      compositePrimaryKey: threadDeleteFencesConfig?.compositePrimaryKey,
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_THREAD_DELETE_FENCES,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_THREAD_DELETE_FENCES],
      ifNotExists: ['lease_id'],
    });
  }

  async #ensureChannelBindingsTable(): Promise<void> {
    const bindingsConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_BINDINGS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_BINDINGS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_BINDINGS],
      compositePrimaryKey: bindingsConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelBindingIndexes();
  }

  async #ensureChannelBindingIndexes(): Promise<void> {
    if (this.#channelBindingIndexesReady !== undefined) {
      return this.#channelBindingIndexesReady;
    }
    this.#channelBindingIndexesReady = this.#createChannelBindingIndexes().catch(error => {
      this.#channelBindingIndexesReady = undefined;
      throw error;
    });
    return this.#channelBindingIndexesReady;
  }

  async #createChannelBindingIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_channel_bindings_active_tuple',
      'idx_harness_channel_bindings_tuple',
      'idx_harness_channel_bindings_session',
      'idx_harness_channel_bindings_scope',
    ]);
  }

  async #ensureProviderCallbackBindingsTable(): Promise<void> {
    const config = TABLE_CONFIGS[TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS],
      compositePrimaryKey: config?.compositePrimaryKey,
    });
    await this.#ensureProviderCallbackBindingIndexes();
  }

  async #ensureProviderCallbackBindingIndexes(): Promise<void> {
    if (this.#providerCallbackBindingIndexesReady !== undefined) {
      return this.#providerCallbackBindingIndexesReady;
    }
    this.#providerCallbackBindingIndexesReady = this.#createProviderCallbackBindingIndexes().catch(error => {
      this.#providerCallbackBindingIndexesReady = undefined;
      throw error;
    });
    return this.#providerCallbackBindingIndexesReady;
  }

  async #createProviderCallbackBindingIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_provider_callback_active_selector',
      'idx_harness_provider_callback_selector_status',
    ]);
  }

  async #ensureChannelInboxTable(): Promise<void> {
    const inboxConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_INBOX];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_INBOX,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_INBOX],
      compositePrimaryKey: inboxConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelInboxIndexes();
  }

  async #ensureChannelInboxIndexes(): Promise<void> {
    if (this.#channelInboxIndexesReady !== undefined) {
      return this.#channelInboxIndexesReady;
    }
    this.#channelInboxIndexesReady = this.#createChannelInboxIndexes().catch(error => {
      this.#channelInboxIndexesReady = undefined;
      throw error;
    });
    return this.#channelInboxIndexesReady;
  }

  async #createChannelInboxIndexes(): Promise<void> {
    await this.#createDefaultIndexes(['idx_harness_channel_inbox_idempotency', 'idx_harness_channel_inbox_claim']);
  }

  async #ensureChannelActionTables(): Promise<void> {
    const tokenConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_ACTION_TOKENS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_ACTION_TOKENS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_ACTION_TOKENS],
      compositePrimaryKey: tokenConfig?.compositePrimaryKey,
    });
    const receiptConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_ACTION_RECEIPTS],
      compositePrimaryKey: receiptConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelActionIndexes();
  }

  async #ensureChannelActionIndexes(): Promise<void> {
    if (this.#channelActionIndexesReady !== undefined) {
      return this.#channelActionIndexesReady;
    }
    this.#channelActionIndexesReady = this.#createChannelActionIndexes().catch(error => {
      this.#channelActionIndexesReady = undefined;
      throw error;
    });
    return this.#channelActionIndexesReady;
  }

  async #createChannelActionIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_channel_action_tokens_transport',
      'idx_harness_channel_action_tokens_pending',
      'idx_harness_channel_action_receipts_token',
      'idx_harness_channel_action_receipts_action',
      'idx_harness_channel_action_receipts_claim',
    ]);
  }

  async #ensureChannelOutboxTable(): Promise<void> {
    const outboxConfig = TABLE_CONFIGS[TABLE_HARNESS_CHANNEL_OUTBOX];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_CHANNEL_OUTBOX,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_CHANNEL_OUTBOX],
      compositePrimaryKey: outboxConfig?.compositePrimaryKey,
    });
    await this.#ensureChannelOutboxIndexes();
  }

  async #ensureChannelOutboxIndexes(): Promise<void> {
    if (this.#channelOutboxIndexesReady !== undefined) {
      return this.#channelOutboxIndexesReady;
    }
    this.#channelOutboxIndexesReady = this.#createChannelOutboxIndexes().catch(error => {
      this.#channelOutboxIndexesReady = undefined;
      throw error;
    });
    return this.#channelOutboxIndexesReady;
  }

  async #createChannelOutboxIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_channel_outbox_idempotency',
      'idx_harness_channel_outbox_claim',
      'idx_harness_channel_outbox_binding_order',
    ]);
  }

  async #ensureWakeupTable(): Promise<void> {
    const wakeupConfig = TABLE_CONFIGS[TABLE_HARNESS_WAKEUPS];
    await this.#db.createTable({
      tableName: TABLE_HARNESS_WAKEUPS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_WAKEUPS],
      compositePrimaryKey: wakeupConfig?.compositePrimaryKey,
    });
    await this.#db.alterTable({
      tableName: TABLE_HARNESS_WAKEUPS,
      schema: TABLE_SCHEMAS[TABLE_HARNESS_WAKEUPS],
      ifNotExists: ['yolo'],
    });
    await this.#ensureWakeupIndexes();
  }

  async #ensureWakeupIndexes(): Promise<void> {
    if (this.#wakeupIndexesReady !== undefined) {
      return this.#wakeupIndexesReady;
    }
    this.#wakeupIndexesReady = this.#createWakeupIndexes().catch(error => {
      this.#wakeupIndexesReady = undefined;
      throw error;
    });
    return this.#wakeupIndexesReady;
  }

  async #createWakeupIndexes(): Promise<void> {
    await this.#createDefaultIndexes([
      'idx_harness_wakeups_idempotency',
      'idx_harness_wakeups_source_fire',
      'idx_harness_wakeups_claim',
    ]);
  }

  async #backfillAttachmentMetadata(): Promise<void> {
    for (;;) {
      const result = await this.#client.execute({
        sql: `SELECT harness_name, session_id, attachment_id, data_b64, sha256, source
              FROM ${TABLE_HARNESS_ATTACHMENTS}
              WHERE data_b64 IS NOT NULL
                AND (sha256 IS NULL OR sha256 = '' OR source IS NULL OR source = '')
              LIMIT 100`,
      });
      if (result.rows.length === 0) return;

      for (const row of result.rows) {
        const sha256 =
          row.sha256 != null && String(row.sha256).length > 0
            ? String(row.sha256)
            : sha256Hex(base64ToBytes(String(row.data_b64)));
        // Legacy rows predate source tracking; they were written through the
        // staged local upload path, so `preupload` is the least lossy default.
        const source =
          row.source != null && String(row.source).length > 0 ? toAttachmentSource(row.source) : 'preupload';
        await this.#client.execute({
          sql: `UPDATE ${TABLE_HARNESS_ATTACHMENTS}
                SET sha256 = ?, source = ?
                WHERE harness_name = ? AND session_id = ? AND attachment_id = ?`,
          args: [
            sha256,
            source,
            String(row.harness_name ?? this.#harnessName),
            String(row.session_id),
            String(row.attachment_id),
          ],
        });
      }
    }
  }

  async #backfillPendingResumeExpiry(): Promise<void> {
    // The scalar is discovery-only and stores the row's next durable action:
    // unanswered interaction expiry or admitted-resume stale recovery.
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET pending_resume_expires_at = NULL
            WHERE pending_resume_expires_at IS NOT NULL
              AND (
                closed_at IS NOT NULL
                OR pending_resume IS NULL
                OR COALESCE(jsonb_typeof(pending_resume->'itemId'), '') <> 'string'
                OR COALESCE(pending_resume->>'itemId', '') = ''
                OR (
                  pending_resume->>'resumedAt' IS NULL
                  AND (
                    COALESCE(jsonb_typeof(pending_resume->'expiresAt'), '') <> 'number'
                    OR COALESCE(pending_resume->>'expiresAt', '') !~ '^[0-9]+$'
                    OR CAST(pending_resume->>'expiresAt' AS NUMERIC) > 9007199254740991
                  )
                )
                OR (
                  pending_resume->>'resumedAt' IS NOT NULL
                  AND (
                    COALESCE(jsonb_typeof(pending_resume->'resumedAt'), '') <> 'number'
                    OR COALESCE(pending_resume->>'resumedAt', '') !~ '^[0-9]+$'
                    OR CAST(pending_resume->>'resumedAt' AS NUMERIC) > 9007199254740991
                    OR COALESCE(jsonb_typeof(pending_resume->'resumeRecoveryAt'), '') <> 'number'
                    OR COALESCE(pending_resume->>'resumeRecoveryAt', '') !~ '^[0-9]+$'
                    OR CAST(pending_resume->>'resumeRecoveryAt' AS NUMERIC)
                      NOT BETWEEN CAST(pending_resume->>'resumedAt' AS NUMERIC) AND 9007199254740991
                  )
                )
              )`,
      args: [],
    });
    await this.#client.execute({
      sql: `UPDATE ${TABLE_HARNESS_SESSIONS}
            SET pending_resume_expires_at = CASE
              WHEN pending_resume->>'resumedAt' IS NULL
                THEN CAST(pending_resume->>'expiresAt' AS BIGINT)
              ELSE CAST(pending_resume->>'resumeRecoveryAt' AS BIGINT)
            END
            WHERE pending_resume_expires_at IS NULL
              AND closed_at IS NULL
              AND pending_resume IS NOT NULL
              AND jsonb_typeof(pending_resume->'itemId') = 'string'
              AND pending_resume->>'itemId' <> ''
              AND (
                (
                  pending_resume->>'resumedAt' IS NULL
                  AND jsonb_typeof(pending_resume->'expiresAt') = 'number'
                  AND pending_resume->>'expiresAt' ~ '^[0-9]+$'
                  AND CAST(pending_resume->>'expiresAt' AS NUMERIC) <= 9007199254740991
                )
                OR (
                  jsonb_typeof(pending_resume->'resumedAt') = 'number'
                  AND pending_resume->>'resumedAt' ~ '^[0-9]+$'
                  AND CAST(pending_resume->>'resumedAt' AS NUMERIC) <= 9007199254740991
                  AND jsonb_typeof(pending_resume->'resumeRecoveryAt') = 'number'
                  AND pending_resume->>'resumeRecoveryAt' ~ '^[0-9]+$'
                  AND CAST(pending_resume->>'resumeRecoveryAt' AS NUMERIC)
                    BETWEEN CAST(pending_resume->>'resumedAt' AS NUMERIC) AND 9007199254740991
                )
              )`,
      args: [],
    });
  }

  async #assertNoDuplicateActiveSessions(): Promise<void> {
    const result = await this.#client.execute({
      sql: `SELECT harness_name, resource_id, thread_id, COUNT(*) AS duplicate_count
            FROM ${TABLE_HARNESS_SESSIONS}
            WHERE closed_at IS NULL
            GROUP BY harness_name, resource_id, thread_id
            HAVING COUNT(*) > 1
            LIMIT 5`,
      args: [],
    });
    if (result.rows.length === 0) return;

    const examples = result.rows
      .map(row => {
        const record = row as Record<string, unknown>;
        return `${String(record.harness_name)}:${String(record.resource_id)}:${String(record.thread_id)} (${String(
          record.duplicate_count,
        )})`;
      })
      .join(', ');
    throw new Error(
      `Cannot create Harness active-session uniqueness index while duplicate active rows exist. Close or migrate duplicate active rows for: ${examples}`,
    );
  }

  async #withCompactionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.#compactionLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);
    this.#compactionLocks.set(key, queued);
    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.#compactionLocks.get(key) === queued) {
        this.#compactionLocks.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const SESSION_COLUMN_NAMES = [
  'harness_name',
  'id',
  'session_incarnation',
  'resource_id',
  'thread_id',
  'parent_session_id',
  'origin',
  'subagent_depth',
  'subagent_type_id',
  'subagent_tool_allowlist_scoped',
  'owns_thread',
  'mode_id',
  'model_id',
  'subagent_model_overrides',
  'permission_rules',
  'permission_rules_seed_hash',
  'session_grants',
  'token_usage',
  'pending_queue',
  'pending_resume',
  'current_run',
  'assistant_drafts',
  'pending_resume_expires_at',
  'queue_admission_receipts',
  'inbox_response_receipts',
  'expired_pending_interactions',
  'observational_memory',
  'goal',
  'workspace',
  'state',
  'created_at',
  'last_activity_at',
  'closing_at',
  'close_deadline_at',
  'closed_at',
  'version',
  'owner_id',
  'lease_expires_at',
  'cancel_request',
] as const;

function pendingResumeExpiryIndexValue(record: SessionRecord): number | null {
  const pending = record.pendingResume;
  if (record.closedAt !== undefined || !isDueScannablePendingResume(pending)) {
    return null;
  }
  return pendingResumeDueAt(pending);
}

function rowToPendingInteractionExpiryGeneration(row: Record<string, unknown>): PendingInteractionExpiryGeneration {
  const pending = parseJson(row.pending_resume) as PendingResume | undefined;
  const indexedExpiresAt = Number(row.pending_resume_expires_at);
  if (!isDueScannablePendingResume(pending) || pendingResumeDueAt(pending) !== indexedExpiresAt) {
    throw new Error(
      `Corrupt pending-interaction expiry index for harness "${String(row.harness_name)}" session "${String(row.id)}"`,
    );
  }
  return {
    harnessName: String(row.harness_name),
    sessionId: String(row.id),
    resourceId: String(row.resource_id),
    kind: pending.kind,
    itemId: pending.itemId,
    runId: pending.runId,
    toolCallId: pending.toolCallId,
    requestedAt: pending.requestedAt,
    dueAt: indexedExpiresAt,
    expiresAt: pending.expiresAt,
    ...(pending.expiryStartedAt !== undefined ? { expiryStartedAt: pending.expiryStartedAt } : {}),
    ...(pending.resumedAt !== undefined ? { resumedAt: pending.resumedAt } : {}),
    ...(pending.resumeRecoveryAt !== undefined ? { resumeRecoveryAt: pending.resumeRecoveryAt } : {}),
    ...(pending.resumeRecoveryStartedAt !== undefined
      ? { resumeRecoveryStartedAt: pending.resumeRecoveryStartedAt }
      : {}),
  };
}

function isDueScannablePendingResume(
  pending: PendingResume | undefined,
): pending is PendingResume & { itemId: string } {
  return (
    pending !== undefined &&
    isPendingResumeKind(pending.kind) &&
    typeof pending.itemId === 'string' &&
    pending.itemId.length > 0 &&
    typeof pending.runId === 'string' &&
    pending.runId.length > 0 &&
    typeof pending.toolCallId === 'string' &&
    pending.toolCallId.length > 0 &&
    Number.isSafeInteger(pending.requestedAt) &&
    pending.requestedAt >= 0 &&
    Number.isSafeInteger(pending.expiresAt) &&
    pending.expiresAt >= 0 &&
    (pending.expiryStartedAt === undefined ||
      (Number.isSafeInteger(pending.expiryStartedAt) && pending.expiryStartedAt >= 0)) &&
    (pending.resumedAt === undefined
      ? pending.resumeRecoveryAt === undefined && pending.resumeRecoveryStartedAt === undefined
      : Number.isSafeInteger(pending.resumedAt) &&
        pending.resumedAt >= 0 &&
        Number.isSafeInteger(pending.resumeRecoveryAt) &&
        pending.resumeRecoveryAt! >= pending.resumedAt &&
        (pending.resumeRecoveryStartedAt === undefined ||
          (Number.isSafeInteger(pending.resumeRecoveryStartedAt) && pending.resumeRecoveryStartedAt >= 0)))
  );
}

function pendingResumeDueAt(pending: PendingResume & { itemId: string }): number {
  return pending.resumedAt === undefined ? pending.expiresAt : pending.resumeRecoveryAt!;
}

function isPendingResumeKind(value: unknown): value is PendingResume['kind'] {
  return (
    value === 'tool-approval' ||
    value === 'tool-suspension' ||
    value === 'question' ||
    value === 'plan-approval' ||
    value === 'sandbox-access'
  );
}

function sessionColumnValues(record: SessionRecord, version: number): { names: string[]; values: any[] } {
  const values = [
    record.harnessName,
    record.id,
    record.sessionIncarnation ?? null,
    record.resourceId,
    record.threadId,
    record.parentSessionId ?? null,
    record.origin,
    record.subagentDepth ?? null,
    record.subagentTypeId ?? null,
    record.subagentToolAllowlistScoped ?? null,
    record.ownsThread,
    record.modeId,
    record.modelId,
    JSON.stringify(record.subagentModelOverrides ?? {}),
    JSON.stringify(record.permissionRules),
    record.permissionRulesSeedHash ?? null,
    JSON.stringify(record.sessionGrants),
    JSON.stringify(record.tokenUsage),
    JSON.stringify(record.pendingQueue),
    record.pendingResume ? JSON.stringify(record.pendingResume) : null,
    record.currentRun ? JSON.stringify(record.currentRun) : null,
    record.assistantDrafts ? JSON.stringify(record.assistantDrafts) : null,
    pendingResumeExpiryIndexValue(record),
    record.queueAdmissionReceipts ? JSON.stringify(record.queueAdmissionReceipts) : null,
    record.inboxResponseReceipts ? JSON.stringify(record.inboxResponseReceipts) : null,
    record.expiredPendingInteractions ? JSON.stringify(record.expiredPendingInteractions) : null,
    record.observationalMemory ? JSON.stringify(record.observationalMemory) : null,
    record.goal ? JSON.stringify(record.goal) : null,
    record.workspace ? JSON.stringify(record.workspace) : null,
    JSON.stringify(record.state ?? {}),
    record.createdAt,
    record.lastActivityAt,
    record.closingAt ?? null,
    record.closeDeadlineAt ?? null,
    record.closedAt ?? null,
    version,
    record.ownerId ?? null,
    record.leaseExpiresAt ?? null,
    record.cancelRequest ? JSON.stringify(record.cancelRequest) : null,
  ];
  return { names: [...SESSION_COLUMN_NAMES], values };
}

const CHANNEL_BINDING_COLUMN_NAMES = [
  'id',
  'harness_name',
  'channel_id',
  'provider_id',
  'status',
  'platform',
  'external_tenant_id',
  'external_channel_id',
  'external_thread_id',
  'resource_id',
  'thread_id',
  'session_id',
  'mode',
  'generation',
  'created_at',
  'updated_at',
  'last_inbound_at',
  'last_outbound_at',
  'closed_at',
  'closed_reason',
  'replaced_by_binding_id',
  'undeliverable_reason',
] as const;

// §14.1: a missing optional external ID is persisted as this non-null sentinel so
// the partial-unique ACTIVE-tuple index never depends on SQL NULL uniqueness
// semantics. The U+001F (Unit Separator) prefix is a C0 control character no
// provider emits in a real external id (including a literal single space), so the
// by-external lookup and active-tuple uniqueness stay correct. NUL (U+0000) is
// deliberately avoided so the value round-trips through both PG and the LibSQL
// driver (which rejects NUL bytes in string args). Mirrors the in-memory adapters
// shared CHANNEL_BINDING_EXTERNAL_ID_SENTINEL (the single source of truth in
// @mastra/core) and the LibSQL sibling — keep the value in exact sync so the
// persisted encoding matches the harness channel id-derivation.
const CHANNEL_BINDING_EXTERNAL_ID_SENTINEL = '__mastra_missing_external_id__';

function normalizeChannelBindingExternalId(value: string | undefined): string {
  return value ?? CHANNEL_BINDING_EXTERNAL_ID_SENTINEL;
}

function denormalizeChannelBindingExternalId(value: string): string | undefined {
  return value === CHANNEL_BINDING_EXTERNAL_ID_SENTINEL ? undefined : value;
}

/** True when a binding addresses the same platform-conversation tuple (§14.1). */
function channelBindingTupleMatches(
  a: ChannelBinding,
  b: {
    channelId: string;
    platform: string;
    externalTenantId?: string;
    externalChannelId?: string;
    externalThreadId: string;
  },
): boolean {
  return (
    a.channelId === b.channelId &&
    a.platform === b.platform &&
    normalizeChannelBindingExternalId(a.externalTenantId) === normalizeChannelBindingExternalId(b.externalTenantId) &&
    normalizeChannelBindingExternalId(a.externalChannelId) === normalizeChannelBindingExternalId(b.externalChannelId) &&
    a.externalThreadId === b.externalThreadId
  );
}

function channelBindingColumnValues(record: ChannelBinding): { names: string[]; values: any[] } {
  return {
    names: [...CHANNEL_BINDING_COLUMN_NAMES],
    values: [
      record.id,
      record.harnessName,
      record.channelId,
      record.providerId,
      record.status,
      record.platform,
      normalizeChannelBindingExternalId(record.externalTenantId),
      normalizeChannelBindingExternalId(record.externalChannelId),
      record.externalThreadId,
      record.resourceId,
      record.threadId,
      record.sessionId,
      record.mode,
      record.generation,
      record.createdAt,
      record.updatedAt,
      record.lastInboundAt ?? null,
      record.lastOutboundAt ?? null,
      record.closedAt ?? null,
      record.closedReason ?? null,
      record.replacedByBindingId ?? null,
      record.undeliverableReason ?? null,
    ],
  };
}

function channelBindingUpsertStatement(record: ChannelBinding): { sql: string; args: any[] } {
  const cols = channelBindingColumnValues(record);
  // Keyed on the `id` primary key: re-saving the same binding id is an in-place
  // update (the active-tuple uniqueness invariant is enforced by the partial-unique
  // index, which fires only when a DIFFERENT id would hold a second active row).
  const assignments = cols.names.filter(name => name !== 'id').map(name => `${name} = excluded.${name}`);
  return {
    sql: `INSERT INTO ${TABLE_HARNESS_CHANNEL_BINDINGS}
          (${cols.names.join(', ')})
          VALUES (${cols.names.map(() => '?').join(', ')})
          ON CONFLICT (id) DO UPDATE SET ${assignments.join(', ')}`,
    args: cols.values,
  };
}

function rowToChannelBinding(row: Record<string, unknown>): ChannelBinding {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    status: String(row.status) as ChannelBinding['status'],
    platform: String(row.platform),
    externalTenantId: denormalizeChannelBindingExternalId(String(row.external_tenant_id)),
    externalChannelId: denormalizeChannelBindingExternalId(String(row.external_channel_id)),
    externalThreadId: String(row.external_thread_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    sessionId: String(row.session_id),
    mode: String(row.mode) as ChannelBinding['mode'],
    generation: Number(row.generation),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastInboundAt: row.last_inbound_at == null ? undefined : Number(row.last_inbound_at),
    lastOutboundAt: row.last_outbound_at == null ? undefined : Number(row.last_outbound_at),
    closedAt: row.closed_at == null ? undefined : Number(row.closed_at),
    closedReason: row.closed_reason == null ? undefined : (String(row.closed_reason) as ChannelBinding['closedReason']),
    replacedByBindingId: row.replaced_by_binding_id == null ? undefined : String(row.replaced_by_binding_id),
    undeliverableReason: row.undeliverable_reason == null ? undefined : String(row.undeliverable_reason),
  };
}

const PROVIDER_CALLBACK_BINDING_COLUMN_NAMES = [
  'id',
  'provider_id',
  'selector_kind',
  'selector_value',
  'harness_name',
  'channel_id',
  'origin',
  'status',
  'created_at',
  'updated_at',
  'replaced_at',
  'replaced_by_binding_id',
  'last_error',
] as const;

function providerCallbackBindingColumnValues(record: HarnessProviderCallbackBinding): {
  names: string[];
  values: any[];
} {
  return {
    names: [...PROVIDER_CALLBACK_BINDING_COLUMN_NAMES],
    values: [
      record.id,
      record.providerId,
      record.selectorKind,
      record.selectorValue,
      record.harnessName,
      record.channelId,
      JSON.stringify(record.origin),
      record.status,
      record.createdAt,
      record.updatedAt,
      record.replacedAt ?? null,
      record.replacedByBindingId ?? null,
      record.lastError ? JSON.stringify(record.lastError) : null,
    ],
  };
}

function providerCallbackBindingInsertStatement(record: HarnessProviderCallbackBinding): { sql: string; args: any[] } {
  const cols = providerCallbackBindingColumnValues(record);
  return {
    sql: `INSERT INTO ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}
          (${cols.names.join(', ')})
          VALUES (${cols.names.map(() => '?').join(', ')})`,
    args: cols.values,
  };
}

function rowToProviderCallbackBinding(row: Record<string, unknown>): HarnessProviderCallbackBinding {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    selectorKind: String(row.selector_kind) as ProviderCallbackSelectorKind,
    selectorValue: String(row.selector_value),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    origin: parseJson(row.origin) as JsonValue,
    status: String(row.status) as HarnessProviderCallbackBinding['status'],
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    replacedAt: row.replaced_at == null ? undefined : Number(row.replaced_at),
    replacedByBindingId: row.replaced_by_binding_id == null ? undefined : String(row.replaced_by_binding_id),
    lastError:
      row.last_error == null ? undefined : (parseJson(row.last_error) as HarnessProviderCallbackBinding['lastError']),
  };
}

function providerCallbackBindingsEqual(a: HarnessProviderCallbackBinding, b: HarnessProviderCallbackBinding): boolean {
  return (
    stableJsonString(providerCallbackBindingComparableValues(a)) ===
    stableJsonString(providerCallbackBindingComparableValues(b))
  );
}

function sameProviderCallbackBindingTarget(
  a: HarnessProviderCallbackBinding,
  b: HarnessProviderCallbackBinding,
): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    stableJsonString(a.origin) === stableJsonString(b.origin)
  );
}

function providerCallbackBindingComparableValues(record: HarnessProviderCallbackBinding): unknown[] {
  return [
    record.id,
    record.providerId,
    record.selectorKind,
    record.selectorValue,
    record.harnessName,
    record.channelId,
    stableJsonString(record.origin),
    record.status,
    record.createdAt,
    record.updatedAt,
    record.replacedAt,
    record.replacedByBindingId,
    record.lastError ? stableJsonString(record.lastError) : undefined,
  ];
}

function assertValidProviderCallbackBindingState(record: HarnessProviderCallbackBinding): void {
  if (!['installation', 'route-key', 'external-tenant'].includes(record.selectorKind)) {
    throw new HarnessStorageProviderCallbackBindingTransitionError(
      record.id,
      undefined,
      record.status,
      `invalid selector kind "${record.selectorKind}"`,
    );
  }
  if (!['active', 'disabled', 'undeliverable', 'replaced'].includes(record.status)) {
    throw new HarnessStorageProviderCallbackBindingTransitionError(
      record.id,
      undefined,
      record.status,
      `invalid status "${record.status}"`,
    );
  }
  if (record.status === 'replaced') {
    if (record.replacedAt === undefined || record.replacedByBindingId === undefined) {
      throw new HarnessStorageProviderCallbackBindingTransitionError(
        record.id,
        undefined,
        record.status,
        'replaced bindings require replacedAt and replacedByBindingId',
      );
    }
    return;
  }
  if (record.replacedAt !== undefined || record.replacedByBindingId !== undefined) {
    throw new HarnessStorageProviderCallbackBindingTransitionError(
      record.id,
      undefined,
      record.status,
      'non-replaced bindings cannot carry replacement metadata',
    );
  }
}

const CHANNEL_INBOX_COLUMN_NAMES = [
  'id',
  'harness_name',
  'channel_id',
  'provider_id',
  'idempotency_key',
  'payload_hash',
  'admission_hash',
  'admission_id',
  'binding_id',
  'resource_id',
  'thread_id',
  'session_id',
  'run_id',
  'signal_id',
  'queued_item_id',
  'external_message_id',
  'received_at',
  'admitted_at',
  'accepted_at',
  'queued_at',
  'failed_at',
  'dead_at',
  'updated_at',
  'status',
  'delivery',
  'mode',
  'model',
  'attempts',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'request_context',
  'content',
  'attachments',
  'raw_files',
  'last_error',
] as const;

function channelInboxColumnValues(record: ChannelInboxItem): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.idempotencyKey,
    record.payloadHash,
    record.admissionHash ?? null,
    record.admissionId,
    record.bindingId ?? null,
    record.resourceId ?? null,
    record.threadId ?? null,
    record.sessionId ?? null,
    record.runId ?? null,
    record.signalId ?? null,
    record.queuedItemId ?? null,
    record.externalMessageId,
    record.receivedAt,
    record.admittedAt ?? null,
    record.acceptedAt ?? null,
    record.queuedAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.updatedAt,
    record.status,
    record.delivery ?? null,
    record.mode ?? null,
    record.model ?? null,
    record.attempts,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    JSON.stringify(record.requestContext),
    record.content,
    JSON.stringify(record.attachments),
    record.rawFiles ? JSON.stringify(record.rawFiles) : null,
    record.lastError ? JSON.stringify(record.lastError) : null,
  ];
  return { names: [...CHANNEL_INBOX_COLUMN_NAMES], values };
}

function rowToChannelInboxItem(row: Record<string, unknown>): ChannelInboxItem {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    idempotencyKey: String(row.idempotency_key),
    payloadHash: String(row.payload_hash),
    admissionHash: row.admission_hash == null ? undefined : String(row.admission_hash),
    admissionId: String(row.admission_id),
    bindingId: row.binding_id == null ? undefined : String(row.binding_id),
    resourceId: row.resource_id == null ? undefined : String(row.resource_id),
    threadId: row.thread_id == null ? undefined : String(row.thread_id),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    runId: row.run_id == null ? undefined : String(row.run_id),
    signalId: row.signal_id == null ? undefined : String(row.signal_id),
    queuedItemId: row.queued_item_id == null ? undefined : String(row.queued_item_id),
    externalMessageId: String(row.external_message_id),
    receivedAt: Number(row.received_at),
    admittedAt: row.admitted_at == null ? undefined : Number(row.admitted_at),
    acceptedAt: row.accepted_at == null ? undefined : Number(row.accepted_at),
    queuedAt: row.queued_at == null ? undefined : Number(row.queued_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    updatedAt: Number(row.updated_at),
    status: String(row.status) as ChannelInboxItem['status'],
    delivery: row.delivery == null ? undefined : (String(row.delivery) as ChannelInboxItem['delivery']),
    mode: row.mode == null ? undefined : String(row.mode),
    model: row.model == null ? undefined : String(row.model),
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    requestContext: parseJson(row.request_context) ?? {},
    content: String(row.content),
    attachments: parseJson(row.attachments) ?? [],
    rawFiles: parseJson(row.raw_files) ?? undefined,
    lastError: parseJson(row.last_error) ?? undefined,
  };
}

const HARNESS_WAKEUP_COLUMN_NAMES = [
  'id',
  'harness_name',
  'source',
  'source_id',
  'fire_id',
  'idempotency_key',
  'payload_hash',
  'admission_id',
  'admission_hash',
  'resource_id',
  'thread_id',
  'session_id',
  'queued_item_id',
  'run_id',
  'signal_id',
  'due_at',
  'created_at',
  'updated_at',
  'claimed_at',
  'queued_at',
  'completed_at',
  'failed_at',
  'dead_at',
  'status',
  'mode',
  'model',
  'yolo',
  'attempts',
  'missed_count',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'request_context',
  'content',
  'attachments',
  'result',
  'last_error',
] as const;

function harnessWakeupColumnValues(record: HarnessWakeupItem): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.source,
    record.sourceId,
    record.fireId,
    record.idempotencyKey,
    record.payloadHash,
    record.admissionId,
    record.admissionHash ?? null,
    record.resourceId ?? null,
    record.threadId ?? null,
    record.sessionId ?? null,
    record.queuedItemId ?? null,
    record.runId ?? null,
    record.signalId ?? null,
    record.dueAt,
    record.createdAt,
    record.updatedAt,
    record.claimedAt ?? null,
    record.queuedAt ?? null,
    record.completedAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.status,
    record.mode ?? null,
    record.model ?? null,
    record.yolo === true ? true : null,
    record.attempts,
    record.missedCount ?? null,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    record.requestContext === undefined ? null : JSON.stringify(record.requestContext),
    record.content,
    JSON.stringify(record.attachments),
    record.result === undefined ? null : JSON.stringify(record.result),
    record.lastError === undefined ? null : JSON.stringify(record.lastError),
  ];
  return { names: [...HARNESS_WAKEUP_COLUMN_NAMES], values };
}

function rowToHarnessWakeupItem(row: Record<string, unknown>): HarnessWakeupItem {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    source: String(row.source) as HarnessWakeupItem['source'],
    sourceId: String(row.source_id),
    fireId: String(row.fire_id),
    idempotencyKey: String(row.idempotency_key),
    payloadHash: String(row.payload_hash),
    admissionId: String(row.admission_id),
    admissionHash: row.admission_hash == null ? undefined : String(row.admission_hash),
    resourceId: row.resource_id == null ? undefined : String(row.resource_id),
    threadId: row.thread_id == null ? undefined : String(row.thread_id),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    queuedItemId: row.queued_item_id == null ? undefined : String(row.queued_item_id),
    runId: row.run_id == null ? undefined : String(row.run_id),
    signalId: row.signal_id == null ? undefined : String(row.signal_id),
    dueAt: Number(row.due_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    claimedAt: row.claimed_at == null ? undefined : Number(row.claimed_at),
    queuedAt: row.queued_at == null ? undefined : Number(row.queued_at),
    completedAt: row.completed_at == null ? undefined : Number(row.completed_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    status: String(row.status) as HarnessWakeupItem['status'],
    mode: row.mode == null ? undefined : String(row.mode),
    model: row.model == null ? undefined : String(row.model),
    yolo: row.yolo === true || row.yolo === 1 || row.yolo === '1' ? true : undefined,
    attempts: Number(row.attempts),
    missedCount: row.missed_count == null ? undefined : Number(row.missed_count),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    requestContext: parseJson(row.request_context) ?? undefined,
    content: String(row.content),
    attachments: parseJson(row.attachments) ?? [],
    result: row.result == null ? undefined : parseJson(row.result),
    lastError: parseJson(row.last_error) ?? undefined,
  };
}

const CHANNEL_ACTION_TOKEN_COLUMN_NAMES = [
  'action_token_id',
  'harness_name',
  'channel_id',
  'provider_id',
  'resource_id',
  'owning_session_id',
  'item_id',
  'kind',
  'binding_id',
  'binding_generation',
  'run_id',
  'pending_requested_at',
  'audience',
  'metadata_hash',
  'transport_hash',
  'key_id',
  'expires_at',
  'revoked_at',
  'revoked_reason',
  'created_at',
  'updated_at',
] as const;

function channelActionTokenColumnValues(record: ChannelActionToken): { names: string[]; values: any[] } {
  const values = [
    record.actionTokenId,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.resourceId,
    record.owningSessionId,
    record.itemId,
    record.kind,
    record.bindingId,
    record.bindingGeneration,
    record.runId,
    record.pendingRequestedAt,
    JSON.stringify(record.audience),
    record.metadataHash,
    record.transportHash,
    record.keyId ?? null,
    record.expiresAt ?? null,
    record.revokedAt ?? null,
    record.revokedReason ?? null,
    record.createdAt,
    record.updatedAt,
  ];
  return { names: [...CHANNEL_ACTION_TOKEN_COLUMN_NAMES], values };
}

function rowToChannelActionToken(row: Record<string, unknown>): ChannelActionToken {
  return {
    actionTokenId: String(row.action_token_id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    resourceId: String(row.resource_id),
    owningSessionId: String(row.owning_session_id),
    itemId: String(row.item_id),
    kind: String(row.kind) as ChannelActionToken['kind'],
    bindingId: String(row.binding_id),
    bindingGeneration: Number(row.binding_generation),
    runId: String(row.run_id),
    pendingRequestedAt: Number(row.pending_requested_at),
    audience: parseJson(row.audience),
    metadataHash: String(row.metadata_hash),
    transportHash: String(row.transport_hash),
    keyId: row.key_id == null ? undefined : String(row.key_id),
    expiresAt: row.expires_at == null ? undefined : Number(row.expires_at),
    revokedAt: row.revoked_at == null ? undefined : Number(row.revoked_at),
    revokedReason:
      row.revoked_reason == null ? undefined : (String(row.revoked_reason) as ChannelActionToken['revokedReason']),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const CHANNEL_ACTION_RECEIPT_COLUMN_NAMES = [
  'id',
  'harness_name',
  'channel_id',
  'provider_id',
  'action_token_id',
  'action_id',
  'binding_id',
  'binding_generation',
  'resource_id',
  'owning_session_id',
  'item_id',
  'kind',
  'run_id',
  'pending_requested_at',
  'audience',
  'verified_actor',
  'response_hash',
  'response',
  'status',
  'conflict_reason',
  'attempts',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'accepted_at',
  'applied_at',
  'failed_at',
  'dead_at',
  'result',
  'last_error',
  'created_at',
  'updated_at',
] as const;

function channelActionReceiptColumnValues(record: ChannelActionReceipt): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.actionTokenId,
    record.actionId,
    record.bindingId,
    record.bindingGeneration,
    record.resourceId,
    record.owningSessionId,
    record.itemId,
    record.kind,
    record.runId,
    record.pendingRequestedAt,
    JSON.stringify(record.audience),
    record.verifiedActor ? JSON.stringify(record.verifiedActor) : null,
    record.responseHash,
    JSON.stringify(record.response),
    record.status,
    record.conflictReason ?? null,
    record.attempts,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    record.acceptedAt ?? null,
    record.appliedAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.result === undefined ? null : JSON.stringify(record.result),
    record.lastError ? JSON.stringify(record.lastError) : null,
    record.createdAt,
    record.updatedAt,
  ];
  return { names: [...CHANNEL_ACTION_RECEIPT_COLUMN_NAMES], values };
}

function rowToChannelActionReceipt(row: Record<string, unknown>): ChannelActionReceipt {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    actionTokenId: String(row.action_token_id),
    actionId: String(row.action_id),
    bindingId: String(row.binding_id),
    bindingGeneration: Number(row.binding_generation),
    resourceId: String(row.resource_id),
    owningSessionId: String(row.owning_session_id),
    itemId: String(row.item_id),
    kind: String(row.kind) as ChannelActionReceipt['kind'],
    runId: String(row.run_id),
    pendingRequestedAt: Number(row.pending_requested_at),
    audience: parseJson(row.audience),
    verifiedActor: parseJson(row.verified_actor) ?? undefined,
    responseHash: String(row.response_hash),
    response: parseJson(row.response),
    status: String(row.status) as ChannelActionReceipt['status'],
    conflictReason:
      row.conflict_reason == null ? undefined : (String(row.conflict_reason) as ChannelActionReceipt['conflictReason']),
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    acceptedAt: row.accepted_at == null ? undefined : Number(row.accepted_at),
    appliedAt: row.applied_at == null ? undefined : Number(row.applied_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    result: row.result == null ? undefined : parseJson(row.result),
    lastError: parseJson(row.last_error) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const CHANNEL_OUTBOX_COLUMN_NAMES = [
  'id',
  'harness_name',
  'channel_id',
  'provider_id',
  'binding_id',
  'binding_generation',
  'idempotency_key',
  'payload_hash',
  'resource_id',
  'thread_id',
  'session_id',
  'owning_session_id',
  'source',
  'target',
  'kind',
  'operation_kind',
  'operation_name',
  'payload',
  'delivery_semantics',
  'status',
  'attempts',
  'claim_id',
  'claim_expires_at',
  'next_attempt_at',
  'sent_at',
  'failed_at',
  'dead_at',
  'provider_message_id',
  'provider_receipt',
  'last_error',
  'created_at',
  'updated_at',
] as const;

function channelOutboxColumnValues(record: ChannelOutboxItem): { names: string[]; values: any[] } {
  const values = [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.bindingId,
    record.bindingGeneration,
    record.idempotencyKey,
    record.payloadHash,
    record.resourceId,
    record.threadId,
    record.sessionId ?? null,
    record.owningSessionId ?? null,
    record.source ? JSON.stringify(record.source) : null,
    JSON.stringify(record.target),
    record.kind,
    record.operationKind,
    record.operationName ?? null,
    JSON.stringify(record.payload),
    record.deliverySemantics,
    record.status,
    record.attempts,
    record.claimId ?? null,
    record.claimExpiresAt ?? null,
    record.nextAttemptAt ?? null,
    record.sentAt ?? null,
    record.failedAt ?? null,
    record.deadAt ?? null,
    record.providerMessageId ?? null,
    record.providerReceipt ? JSON.stringify(record.providerReceipt) : null,
    record.lastError ? JSON.stringify(record.lastError) : null,
    record.createdAt,
    record.updatedAt,
  ];
  return { names: [...CHANNEL_OUTBOX_COLUMN_NAMES], values };
}

function rowToChannelOutboxItem(row: Record<string, unknown>): ChannelOutboxItem {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    channelId: String(row.channel_id),
    providerId: String(row.provider_id),
    bindingId: String(row.binding_id),
    bindingGeneration: Number(row.binding_generation),
    idempotencyKey: String(row.idempotency_key),
    payloadHash: String(row.payload_hash),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    owningSessionId: row.owning_session_id == null ? undefined : String(row.owning_session_id),
    source: parseJson(row.source) ?? undefined,
    target: parseJson(row.target),
    kind: String(row.kind) as ChannelOutboxItem['kind'],
    operationKind: String(row.operation_kind) as ChannelOutboxItem['operationKind'],
    operationName: row.operation_name == null ? undefined : String(row.operation_name),
    payload: parseJson(row.payload),
    deliverySemantics: String(row.delivery_semantics) as ChannelOutboxItem['deliverySemantics'],
    status: String(row.status) as ChannelOutboxItem['status'],
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    sentAt: row.sent_at == null ? undefined : Number(row.sent_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    providerMessageId: row.provider_message_id == null ? undefined : String(row.provider_message_id),
    providerReceipt: parseJson(row.provider_receipt) ?? undefined,
    lastError: parseJson(row.last_error) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    harnessName: String(row.harness_name ?? 'default'),
    id: String(row.id),
    sessionIncarnation: row.session_incarnation != null ? String(row.session_incarnation) : undefined,
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id != null ? String(row.parent_session_id) : undefined,
    origin: String(row.origin) as SessionRecord['origin'],
    subagentDepth: row.subagent_depth != null ? Number(row.subagent_depth) : undefined,
    subagentTypeId: row.subagent_type_id != null ? String(row.subagent_type_id) : undefined,
    subagentToolAllowlistScoped:
      row.subagent_tool_allowlist_scoped == null ? undefined : Boolean(row.subagent_tool_allowlist_scoped),
    ownsThread: Number(row.owns_thread) === 1,
    modeId: String(row.mode_id),
    modelId: String(row.model_id),
    subagentModelOverrides: parseJson(row.subagent_model_overrides) ?? {},
    permissionRules: parseJson(row.permission_rules) ?? { categories: {}, tools: {} },
    permissionRulesSeedHash:
      row.permission_rules_seed_hash != null ? String(row.permission_rules_seed_hash) : undefined,
    sessionGrants: parseJson(row.session_grants) ?? { categories: [], tools: [] },
    tokenUsage: parseJson(row.token_usage) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: parseJson(row.pending_queue) ?? [],
    pendingResume: parseJson(row.pending_resume) ?? undefined,
    currentRun: parseJson(row.current_run) ?? undefined,
    assistantDrafts: parseJson(row.assistant_drafts) ?? undefined,
    queueAdmissionReceipts: parseJson(row.queue_admission_receipts) ?? undefined,
    inboxResponseReceipts: parseJson(row.inbox_response_receipts) ?? undefined,
    expiredPendingInteractions: parseJson(row.expired_pending_interactions) ?? undefined,
    observationalMemory: parseJson(row.observational_memory) ?? undefined,
    goal: parseJson(row.goal) ?? undefined,
    workspace: parseJson(row.workspace) ?? undefined,
    state: parseJson(row.state) ?? {},
    createdAt: Number(row.created_at),
    lastActivityAt: Number(row.last_activity_at),
    closingAt: row.closing_at != null ? Number(row.closing_at) : undefined,
    closeDeadlineAt: row.close_deadline_at != null ? Number(row.close_deadline_at) : undefined,
    closedAt: row.closed_at != null ? Number(row.closed_at) : undefined,
    version: Number(row.version),
    ownerId: row.owner_id != null ? String(row.owner_id) : undefined,
    leaseExpiresAt: row.lease_expires_at != null ? Number(row.lease_expires_at) : undefined,
    cancelRequest: parseJson(row.cancel_request) ?? undefined,
  };
}

function rowToProjectionIntent(row: Record<string, unknown>): HarnessSessionRecordProjectionIntent {
  return {
    id: String(row.id),
    operationId: String(row.operation_id),
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    sessionIncarnation: String(row.session_incarnation),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    revision: Number(row.revision),
    payloadDigest: String(row.payload_digest),
    payloadBytes: Number(row.payload_bytes),
    payload: parseJson(row.payload),
    status: String(row.status) as HarnessSessionRecordProjectionIntent['status'],
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    appliedAt: row.applied_at == null ? undefined : Number(row.applied_at),
    failedAt: row.failed_at == null ? undefined : Number(row.failed_at),
    deadAt: row.dead_at == null ? undefined : Number(row.dead_at),
    lastError: parseJson(row.last_error) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToProjectionFence(
  row: Record<string, unknown> | undefined,
): HarnessSessionRecordProjectionFence | undefined {
  if (!row) return undefined;
  return {
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    sessionIncarnation: String(row.session_incarnation),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    revision: Number(row.revision),
    state: String(row.state) as HarnessSessionRecordProjectionFence['state'],
    updatedAt: Number(row.updated_at),
  };
}

function requirePgProjectionIncarnation(record: SessionRecord): string {
  if (record.sessionIncarnation === undefined || record.sessionIncarnation.length === 0) {
    throw new HarnessStorageSessionProjectionIncarnationError(record.id);
  }
  return record.sessionIncarnation;
}

function assertPgSessionLease(record: SessionRecord, ownerId: string): void {
  const now = Date.now();
  const leaseHeld =
    record.ownerId !== undefined &&
    record.leaseExpiresAt !== undefined &&
    record.leaseExpiresAt > now &&
    record.ownerId !== ownerId;
  if (leaseHeld) {
    throw new HarnessStorageLeaseConflictError(record.id, record.ownerId!, record.leaseExpiresAt!);
  }
}

function assertPgProjectionFence(
  fence: HarnessSessionRecordProjectionFence | undefined,
  record: SessionRecord,
  incarnation: string,
  state: 'active' | 'deleted',
): void {
  assertPgProjectionFenceValues(
    fence,
    record.harnessName,
    record.id,
    incarnation,
    record.resourceId,
    record.threadId,
    record.version,
    state,
  );
}

function assertPgProjectionFenceValues(
  fence: HarnessSessionRecordProjectionFence | undefined,
  harnessName: string,
  sessionId: string,
  sessionIncarnation: string,
  resourceId: string,
  threadId: string,
  revision: number,
  state: 'active' | 'deleted',
): void {
  if (
    fence === undefined ||
    fence.harnessName !== harnessName ||
    fence.sessionId !== sessionId ||
    fence.sessionIncarnation !== sessionIncarnation ||
    fence.resourceId !== resourceId ||
    fence.threadId !== threadId ||
    fence.revision !== revision ||
    fence.state !== state
  ) {
    throw new HarnessStorageSessionProjectionIncarnationError(sessionId);
  }
}

function pgProjectionFenceMatches(
  fence: HarnessSessionRecordProjectionFence | undefined,
  intent: HarnessSessionRecordProjectionIntent,
  state: 'active' | 'deleted',
): boolean {
  return (
    fence !== undefined &&
    fence.state === state &&
    fence.sessionIncarnation === intent.sessionIncarnation &&
    fence.resourceId === intent.resourceId &&
    fence.threadId === intent.threadId &&
    fence.revision >= intent.revision
  );
}

function assertPgProjectionIntentIdentity(
  intent: HarnessSessionRecordProjectionIntent,
  sessionId: string,
  sessionIncarnation: string,
  revision: number,
  payloadDigest: string,
): void {
  if (
    intent.sessionId !== sessionId ||
    intent.sessionIncarnation !== sessionIncarnation ||
    intent.revision !== revision ||
    intent.payloadDigest !== payloadDigest
  ) {
    throw new HarnessStorageSessionProjectionClaimConflictError(intent.operationId);
  }
}

function projectionAckResult(
  intent: HarnessSessionRecordProjectionIntent,
  status: AckSessionRecordProjectionResult['status'],
): AckSessionRecordProjectionResult {
  return {
    status,
    operationId: intent.operationId,
    sessionId: intent.sessionId,
    sessionIncarnation: intent.sessionIncarnation,
    revision: intent.revision,
    payloadDigest: intent.payloadDigest,
  };
}

function assertPgProjectionClaimInput(input: ClaimSessionRecordProjectionIntentsInput): void {
  if (input.claimId.length === 0 || !Number.isSafeInteger(input.limit) || input.limit <= 0) {
    throw new RangeError('Session projection claim requires a non-empty claim id and positive limit');
  }
  if (
    !Number.isSafeInteger(input.now) ||
    input.now < 0 ||
    !Number.isSafeInteger(input.claimTtlMs) ||
    input.claimTtlMs <= 0
  ) {
    throw new RangeError('Session projection claim timestamps must be positive safe integers');
  }
}

function assertPgProjectionRenewInput(input: RenewSessionRecordProjectionClaimInput): void {
  if (
    input.operationId.length === 0 ||
    input.claimId.length === 0 ||
    input.sessionIncarnation.length === 0 ||
    input.payloadDigest.length === 0 ||
    !Number.isSafeInteger(input.revision) ||
    input.revision <= 0 ||
    !Number.isSafeInteger(input.now) ||
    input.now < 0 ||
    !Number.isSafeInteger(input.claimTtlMs) ||
    input.claimTtlMs <= 0
  ) {
    throw new RangeError('Session projection claim renewal input is invalid');
  }
}

function assertPgProjectionAckInput(input: AckSessionRecordProjectionInput): void {
  if (
    input.operationId.length === 0 ||
    input.claimId.length === 0 ||
    input.sessionIncarnation.length === 0 ||
    input.payloadDigest.length === 0 ||
    !Number.isSafeInteger(input.revision) ||
    input.revision <= 0 ||
    (input.acknowledgedAt !== undefined && (!Number.isSafeInteger(input.acknowledgedAt) || input.acknowledgedAt < 0))
  ) {
    throw new RangeError('Session projection acknowledgement input is invalid');
  }
}

function assertPgProjectionFailInput(input: FailSessionRecordProjectionInput): void {
  if (
    input.operationId.length === 0 ||
    input.claimId.length === 0 ||
    input.sessionIncarnation.length === 0 ||
    input.payloadDigest.length === 0 ||
    !Number.isSafeInteger(input.revision) ||
    input.revision <= 0 ||
    (input.failedAt !== undefined && (!Number.isSafeInteger(input.failedAt) || input.failedAt < 0)) ||
    (input.retryAt !== undefined && (!Number.isSafeInteger(input.retryAt) || input.retryAt < 0)) ||
    input.error.code.length === 0 ||
    input.error.message.length === 0
  ) {
    throw new RangeError('Session projection failure input is invalid');
  }
}

function rowToSummary(row: Record<string, unknown>): SessionSummary {
  return {
    harnessName: String(row.harness_name ?? 'default'),
    id: String(row.id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id != null ? String(row.parent_session_id) : undefined,
    origin: String(row.origin) as SessionRecord['origin'],
    modeId: String(row.mode_id),
    modelId: String(row.model_id),
    lastActivityAt: Number(row.last_activity_at),
    closingAt: row.closing_at != null ? Number(row.closing_at) : undefined,
    closeDeadlineAt: row.close_deadline_at != null ? Number(row.close_deadline_at) : undefined,
    closedAt: row.closed_at != null ? Number(row.closed_at) : undefined,
  };
}

type DeleteGuardRecord = {
  version: number;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  createdAt: number;
  closedAt?: number;
};

function rowToDeleteGuardRecord(row: Record<string, unknown>): DeleteGuardRecord {
  return {
    version: Number(row.version),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    parentSessionId: row.parent_session_id == null ? undefined : String(row.parent_session_id),
    createdAt: Number(row.created_at),
    closedAt: row.closed_at == null ? undefined : Number(row.closed_at),
  };
}

function getDeleteGuardMismatch(
  record: DeleteGuardRecord,
  opts: DeleteSessionOptions,
): ConstructorParameters<typeof HarnessStorageDeleteGuardConflictError>[1] | undefined {
  if (opts.ifVersion !== undefined && record.version !== opts.ifVersion) return 'ifVersion';
  if (opts.expectedResourceId !== undefined && record.resourceId !== opts.expectedResourceId)
    return 'expectedResourceId';
  if (opts.expectedThreadId !== undefined && record.threadId !== opts.expectedThreadId) return 'expectedThreadId';
  if (opts.expectedParentSessionId !== undefined && (record.parentSessionId ?? null) !== opts.expectedParentSessionId) {
    return 'expectedParentSessionId';
  }
  if (opts.expectedCreatedAt !== undefined && record.createdAt !== opts.expectedCreatedAt) return 'expectedCreatedAt';
  if (opts.requireClosed === true && record.closedAt === undefined) return 'requireClosed';
  return undefined;
}

function parseJson(value: unknown): any {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      // node-postgres already decodes JSONB scalar strings, so a value such
      // as `"winner"` reaches us as the bare string `winner`. Preserve that
      // decoded value instead of treating it as malformed JSON text.
      return value;
    }
  }
  return value;
}

function rowToAttachmentSemantic(row: Record<string, unknown>): AttachmentSemanticMetadata {
  const semantic: AttachmentSemanticMetadata = { kind: toAttachmentKind(row.kind) };
  if (row.primitive_type != null) {
    semantic.primitiveType = String(row.primitive_type) as AttachmentSemanticMetadata['primitiveType'];
  }
  if (row.element_type != null) semantic.elementType = String(row.element_type);
  if (row.renderer_json != null) semantic.renderer = parseJson(row.renderer_json);
  if (row.schema_id != null) semantic.schemaId = String(row.schema_id);
  if (row.metadata_json != null) semantic.metadata = parseJson(row.metadata_json) as Record<string, JsonValue>;
  if (row.object_json != null) semantic.object = parseJson(row.object_json);
  return semantic;
}

// Attachment rows persist semantic exploded into typed columns with 'file'
// as the kind default, so a retry must be compared against the same
// normalized shape — otherwise omitting kind on an identical request reads
// back as a conflict.
function normalizeAttachmentSemantic(semantic: AttachmentSemanticMetadata | undefined): AttachmentSemanticMetadata {
  const normalized: AttachmentSemanticMetadata = { kind: toAttachmentKind(semantic?.kind) };
  if (semantic?.primitiveType != null) normalized.primitiveType = semantic.primitiveType;
  if (semantic?.elementType != null) normalized.elementType = semantic.elementType;
  if (semantic?.renderer != null) normalized.renderer = semantic.renderer;
  if (semantic?.schemaId != null) normalized.schemaId = semantic.schemaId;
  if (semantic?.metadata != null) normalized.metadata = semantic.metadata;
  if (semantic?.object != null) normalized.object = semantic.object;
  return normalized;
}

function rowToAttachmentOperation(row: Record<string, unknown>): PgAttachmentOperation {
  return {
    id: String(row.id),
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    attachmentId: String(row.attachment_id),
    sessionIncarnation: String(row.session_incarnation),
    kind: String(row.kind) as HarnessAttachmentOperationKind,
    status: String(row.status) as HarnessAttachmentOperationStatus,
    name: row.name == null ? undefined : String(row.name),
    mimeType: row.mime_type == null ? undefined : String(row.mime_type),
    source: row.source == null ? undefined : toAttachmentSource(row.source),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    semantic: parseJson(row.semantic_json) as AttachmentSemanticMetadata | undefined,
    blobRef: row.blob_ref == null ? undefined : String(row.blob_ref),
    attempts: Number(row.attempts),
    claimId: row.claim_id == null ? undefined : String(row.claim_id),
    claimExpiresAt: row.claim_expires_at == null ? undefined : Number(row.claim_expires_at),
    nextAttemptAt: row.next_attempt_at == null ? undefined : Number(row.next_attempt_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    completedAt: row.completed_at == null ? undefined : Number(row.completed_at),
  };
}

function attachmentRowMatchesInput(
  row: Record<string, unknown>,
  input: {
    name: string;
    mimeType: string;
    source: AttachmentRecord['source'];
    bytes: number;
    sha256: string;
    incarnation: string;
    semantic?: AttachmentSemanticMetadata;
  },
): boolean {
  return (
    String(row.name) === input.name &&
    String(row.mime_type) === input.mimeType &&
    toAttachmentSource(row.source) === input.source &&
    Number(row.size_bytes) === input.bytes &&
    String(row.sha256) === input.sha256 &&
    String(row.session_incarnation ?? '') === input.incarnation &&
    stableJson(rowToAttachmentSemantic(row)) === stableJson(normalizeAttachmentSemantic(input.semantic))
  );
}

function attachmentOperationMatchesInput(
  operation: PgAttachmentOperation,
  input: {
    name: string;
    mimeType: string;
    source: AttachmentRecord['source'];
    bytes: number;
    sha256: string;
    semanticJson: string;
  },
): boolean {
  return (
    operation.kind === 'put' &&
    operation.name === input.name &&
    operation.mimeType === input.mimeType &&
    operation.source === input.source &&
    operation.sizeBytes === input.bytes &&
    operation.sha256 === input.sha256 &&
    stableJson(normalizeAttachmentSemantic(operation.semantic)) ===
      stableJson(normalizeAttachmentSemantic(parseJson(input.semanticJson) as AttachmentSemanticMetadata | undefined))
  );
}

function requireAttachmentIncarnation(row: Record<string, unknown>, sessionId: string, attachmentId: string): string {
  const incarnation = row.session_incarnation == null ? '' : String(row.session_incarnation);
  if (incarnation.length === 0) throw new HarnessStorageAttachmentByteOwnerError(sessionId, attachmentId);
  return incarnation;
}

function requireAttachmentBlobRef(row: Record<string, unknown>, sessionId: string, attachmentId: string): string {
  const blobRef = row.blob_ref == null ? '' : String(row.blob_ref);
  if (blobRef.length === 0) throw new HarnessStorageAttachmentByteOwnerError(sessionId, attachmentId);
  return blobRef;
}

function validateAttachmentBlobRef(value: unknown, sessionId: string, attachmentId: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new HarnessStorageAttachmentByteOwnerError(sessionId, attachmentId);
  }
  return value;
}

function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    // Match JSON.stringify: undefined array elements serialize as null.
    return `[${value.map(entry => (entry === undefined ? 'null' : stableJson(entry))).join(',')}]`;
  }
  // Match JSON.stringify: undefined object properties are omitted, so a
  // caller-supplied optional key never differs from its persisted form.
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
  return `{${entries.join(',')}}`;
}

function toAttachmentKind(value: unknown): AttachmentSemanticMetadata['kind'] {
  if (value === 'primitive' || value === 'element' || value === 'file') return value;
  return 'file';
}

function isUniqueConstraintError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === '23505') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /duplicate key value violates unique constraint/i.test(msg);
}

function bytesToBase64(bytes: Uint8Array): string {
  // Buffer is available in Node and bun; fall back to a manual encoder elsewhere.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return globalThis.btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function toAttachmentSource(value: unknown): AttachmentRecord['source'] {
  if (value === 'inline' || value === 'preupload' || value === 'url' || value === 'provider') {
    return value;
  }
  return 'preupload';
}

function rowToAttachmentReference(row: Record<string, unknown>): AttachmentReference {
  return {
    source: toAttachmentReferenceSource(row.source),
    sourceId: String(row.source_id),
    ...(row.retained_until == null ? {} : { retainedUntil: Number(row.retained_until) }),
  };
}

function rowToTombstone(row: Record<string, unknown>): OperationAdmissionTombstone {
  return {
    // §5.1d: normalize the legacy pre-spec `'message'` operation-kind token to
    // `'signal'` on read, per the HarnessOperationKind contract for durable backends.
    kind: (String(row.kind) === 'message' ? 'signal' : String(row.kind)) as OperationAdmissionTombstone['kind'],
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    admissionId: row.admission_id == null ? undefined : String(row.admission_id),
    admissionHash: row.admission_hash == null ? undefined : String(row.admission_hash),
    queuedItemId: row.queued_item_id == null ? undefined : String(row.queued_item_id),
    signalId: row.signal_id == null ? undefined : String(row.signal_id),
    runId: row.run_id == null ? undefined : String(row.run_id),
    terminalAt: Number(row.terminal_at),
    compactedAt: Number(row.compacted_at),
    expiresAt: Number(row.expires_at),
  };
}

function rowToSessionEvent(row: Record<string, unknown>): HarnessSessionEventRecord {
  return {
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    eventId: String(row.event_id),
    epoch: String(row.epoch),
    sequence: Number(row.sequence),
    event: parseJson(row.event) as JsonValue,
    emittedAt: Number(row.emitted_at),
    storedAt: Number(row.stored_at),
  };
}

function rowToWorkspaceActionJournalEntry(row: Record<string, unknown>): WorkspaceActionJournalEntry {
  const entry: WorkspaceActionJournalEntry = {
    id: String(row.id),
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    actionKind: String(row.action_kind) as WorkspaceActionJournalEntry['actionKind'],
    ...(row.operation == null ? {} : { operation: String(row.operation) }),
    action: parseJson(row.action) as JsonValue,
    policyDecision: String(row.policy_decision) as WorkspaceActionJournalEntry['policyDecision'],
    policyReasons: (parseJson(row.policy_reasons) ?? []) as string[],
    matchedRules: (parseJson(row.matched_rules) ?? []) as JsonValue[],
    ...(row.path == null ? {} : { path: parseJson(row.path) as WorkspaceActionJournalEntry['path'] }),
    ...(row.to_path == null ? {} : { toPath: parseJson(row.to_path) as WorkspaceActionJournalEntry['toPath'] }),
    ...(row.cwd == null ? {} : { cwd: parseJson(row.cwd) as WorkspaceActionJournalEntry['cwd'] }),
    ...(row.actor == null ? {} : { actor: parseJson(row.actor) as JsonValue }),
    ...(row.request_id == null ? {} : { requestId: String(row.request_id) }),
    ...(row.trace_id == null ? {} : { traceId: String(row.trace_id) }),
    ...(row.span_id == null ? {} : { spanId: String(row.span_id) }),
    ...(row.result == null ? {} : { result: parseJson(row.result) as JsonValue }),
    createdAt: Number(row.created_at),
  };
  assertWorkspaceActionKindMatches(entry);
  return entry;
}

function assertWorkspaceActionKindMatches(record: WorkspaceActionJournalEntry): void {
  const action = record.action;
  if (action && typeof action === 'object' && !Array.isArray(action) && 'kind' in action) {
    const actionKind = (action as { kind?: unknown }).kind;
    if (actionKind !== undefined && actionKind !== record.actionKind) {
      throw new Error(`Workspace action journal kind mismatch: ${String(actionKind)} != ${record.actionKind}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Plan-task helpers (§5.1k)
// ---------------------------------------------------------------------------

function rowToPlanTask(row: Record<string, unknown>): HarnessPlanTask {
  const task: HarnessPlanTask = {
    taskId: String(row.task_id),
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    order: Number(row.order),
    status: String(row.status) as HarnessPlanTask['status'],
    statusSource: String(row.status_source) as HarnessPlanTask['statusSource'],
    content: String(row.content),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    version: Number(row.version),
  };
  if (row.idempotency_key != null) task.idempotencyKey = String(row.idempotency_key);
  if (row.idempotency_input_hash != null) task.idempotencyInputHash = String(row.idempotency_input_hash);
  if (row.parent_task_id != null) task.parentTaskId = String(row.parent_task_id);
  if (row.active_form != null) task.activeForm = String(row.active_form);
  if (row.priority != null) task.priority = Number(row.priority);
  if (row.blocked_by != null) task.blockedBy = (parseJson(row.blocked_by) ?? []) as string[];
  if (row.origin != null) task.origin = String(row.origin);
  if (row.delegated_subagent_session_id != null) {
    task.delegatedSubagentSessionId = String(row.delegated_subagent_session_id);
  }
  if (row.delegated_subagent_type_id != null) {
    task.delegatedSubagentTypeId = String(row.delegated_subagent_type_id);
  }
  if (row.metadata != null) task.metadata = parseJson(row.metadata) as JsonValue;
  if (row.started_at != null) task.startedAt = Number(row.started_at);
  if (row.completed_at != null) task.completedAt = Number(row.completed_at);
  return task;
}

function planTaskColumnValues(task: HarnessPlanTask): { names: string[]; values: QueryValues } {
  const names = [
    'harness_name',
    'session_id',
    'task_id',
    'idempotency_key',
    'idempotency_input_hash',
    'resource_id',
    'thread_id',
    'parent_task_id',
    '"order"',
    'status',
    'status_source',
    'content',
    'active_form',
    'priority',
    'blocked_by',
    'origin',
    'delegated_subagent_session_id',
    'delegated_subagent_type_id',
    'metadata',
    'created_at',
    'updated_at',
    'started_at',
    'completed_at',
    'version',
  ];
  const values: QueryValues = [
    task.harnessName,
    task.sessionId,
    task.taskId,
    task.idempotencyKey ?? null,
    task.idempotencyInputHash ?? null,
    task.resourceId,
    task.threadId,
    task.parentTaskId ?? null,
    task.order,
    task.status,
    task.statusSource,
    task.content,
    task.activeForm ?? null,
    task.priority ?? null,
    task.blockedBy === undefined ? null : JSON.stringify(task.blockedBy),
    task.origin ?? null,
    task.delegatedSubagentSessionId ?? null,
    task.delegatedSubagentTypeId ?? null,
    task.metadata === undefined ? null : JSON.stringify(task.metadata),
    task.createdAt,
    task.updatedAt,
    task.startedAt ?? null,
    task.completedAt ?? null,
    task.version,
  ];
  return { names, values };
}

function rowToRunSummary(row: Record<string, unknown>): HarnessRunSummary {
  const summary: HarnessRunSummary = {
    harnessName: String(row.harness_name),
    runId: String(row.run_id),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    agentId: String(row.agent_id),
    modeId: String(row.mode_id),
    modelId: String(row.model_id),
    status: String(row.status) as HarnessRunSummary['status'],
    finishReason: String(row.finish_reason),
    reconstructed: row.reconstructed === true || row.reconstructed === 1 || row.reconstructed === '1',
    completedAt: Number(row.completed_at),
    usage: (parseJson(row.usage) ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }) as HarnessRunSummary['usage'],
    createdAt: Number(row.created_at),
  };
  if (row.parent_session_id != null) summary.parentSessionId = String(row.parent_session_id);
  if (row.trace_id != null) summary.traceId = String(row.trace_id);
  if (row.operation_kind != null)
    summary.operationKind = String(row.operation_kind) as HarnessRunSummary['operationKind'];
  if (row.started_at != null) summary.startedAt = Number(row.started_at);
  if (row.duration_ms != null) summary.durationMs = Number(row.duration_ms);
  if (row.tool_rollup != null) summary.toolRollup = parseJson(row.tool_rollup) as HarnessRunSummary['toolRollup'];
  return summary;
}

function runSummaryColumnValues(summary: HarnessRunSummary): { names: string[]; values: QueryValues } {
  const names = [
    'harness_name',
    'run_id',
    'session_id',
    'resource_id',
    'thread_id',
    'parent_session_id',
    'agent_id',
    'mode_id',
    'model_id',
    'trace_id',
    'operation_kind',
    'status',
    'finish_reason',
    'reconstructed',
    'started_at',
    'completed_at',
    'duration_ms',
    'usage',
    'tool_rollup',
    'created_at',
  ];
  const values: QueryValues = [
    summary.harnessName,
    summary.runId,
    summary.sessionId,
    summary.resourceId,
    summary.threadId,
    summary.parentSessionId ?? null,
    summary.agentId,
    summary.modeId,
    summary.modelId,
    summary.traceId ?? null,
    summary.operationKind ?? null,
    summary.status,
    summary.finishReason,
    summary.reconstructed,
    summary.startedAt ?? null,
    summary.completedAt,
    summary.durationMs ?? null,
    JSON.stringify(summary.usage),
    summary.toolRollup === undefined ? null : JSON.stringify(summary.toolRollup),
    summary.createdAt,
  ];
  return { names, values };
}

function assertWorkspaceActionTraceScope(record: WorkspaceActionJournalEntry): void {
  if (record.spanId !== undefined && record.traceId === undefined) {
    throw new Error('Workspace action journal spanId requires traceId');
  }
}

function addWorkspaceActionPathFilter(
  conditions: string[],
  args: QueryValues,
  filter: ListWorkspaceActionJournalInput['affectedPath'],
): void {
  if (filter === undefined) return;
  if (!workspaceActionPathFilterHasSelector(filter)) {
    conditions.push('1 = 0');
    return;
  }
  const pathCondition = buildPgWorkspaceActionPathCondition('path', filter, args);
  if (filter.includeToPath === true) {
    const toPathCondition = buildPgWorkspaceActionPathCondition('to_path', filter, args);
    conditions.push(`(${pathCondition} OR ${toPathCondition})`);
    return;
  }
  conditions.push(pathCondition);
}

function buildPgWorkspaceActionPathCondition(
  column: 'path' | 'to_path',
  filter: NonNullable<ListWorkspaceActionJournalInput['affectedPath']>,
  args: QueryValues,
): string {
  const predicates = [`${column} IS NOT NULL`];
  if (filter.rootId !== undefined) {
    predicates.push(`${column}->>'rootId' = ?`);
    args.push(filter.rootId);
  }
  if (filter.path !== undefined) {
    predicates.push(`${column}->>'path' = ?`);
    args.push(filter.path);
  }
  if (filter.relativePath !== undefined) {
    predicates.push(`${column}->>'relativePath' = ?`);
    args.push(filter.relativePath);
  }
  return `(${predicates.join(' AND ')})`;
}

function workspaceActionPathFilterHasSelector(
  filter: NonNullable<ListWorkspaceActionJournalInput['affectedPath']>,
): boolean {
  return filter.rootId !== undefined || filter.path !== undefined || filter.relativePath !== undefined;
}

function rowToMessageResultEvidence(row: Record<string, unknown>): AgentSignalResultEvidence {
  const base = {
    harnessName: String(row.harness_name),
    sessionId: String(row.session_id),
    resourceId: String(row.resource_id),
    threadId: String(row.thread_id),
    signalId: String(row.signal_id),
    ...(row.run_id == null ? {} : { runId: String(row.run_id) }),
    ...(row.mode_id == null ? {} : { modeId: String(row.mode_id) }),
    ...(row.model_id == null ? {} : { modelId: String(row.model_id) }),
    ...(row.admission_id == null ? {} : { admissionId: String(row.admission_id) }),
    ...(row.admission_hash == null ? {} : { admissionHash: String(row.admission_hash) }),
    ...(row.operation_kind == null
      ? {}
      : { operationKind: String(row.operation_kind) as AgentSignalResultEvidence['operationKind'] }),
    ...(row.dispatch == null ? {} : { dispatch: parseJson(row.dispatch) as AgentSignalDispatchState }),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
  const status = String(row.status);
  if (status === 'completed') {
    const runId = completedMessageEvidenceRunId(base);
    return {
      ...base,
      status: 'completed',
      runId,
      result: parseJson(row.result),
    };
  }
  if (status === 'failed') {
    return {
      ...base,
      status: 'failed',
      error: parseJson(row.error) ?? { code: 'harness.message_failed', message: 'Message failed' },
    };
  }
  return { ...base, status: 'pending' };
}

function tombstoneId(record: OperationAdmissionTombstone): string {
  const publicId = record.kind === 'signal' ? record.signalId : record.queuedItemId;
  return stableHarnessRowId([
    record.harnessName,
    record.sessionId,
    record.kind,
    publicId ?? record.admissionId ?? record.compactedAt,
  ]);
}

function messageEvidenceId(record: Pick<AgentSignalResultEvidence, 'harnessName' | 'sessionId' | 'signalId'>): string {
  return stableHarnessRowId([record.harnessName, record.sessionId, record.signalId]);
}

function normalizedSignalDispatch(record: AgentSignalResultEvidence): AgentSignalDispatchState | undefined {
  if (record.dispatch !== undefined) return record.dispatch;
  return record.status === 'pending' && record.runId === undefined ? { state: 'reserved' } : undefined;
}

function signalDispatchMatches(record: AgentSignalResultEvidence, expected: AgentSignalDispatchState): boolean {
  // This branch is reached only after `isSignalAdmissionEvidence` proved an
  // explicit or narrowly migratable signal row. `runId` matches state; it
  // never classifies the operation as a signal.
  if (record.dispatch === undefined && record.status === 'pending' && record.runId !== undefined) {
    return expected.state === 'accepted' && expected.runId === record.runId;
  }
  return sameSignalDispatch(normalizedSignalDispatch(record), expected);
}

function sameSignalDispatch(a: AgentSignalDispatchState | undefined, b: AgentSignalDispatchState | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (a.state !== b.state) return false;
  if (a.state === 'reserved' || b.state === 'reserved') return a.state === b.state;
  if (
    !sameOptionalDispatchField(a.attemptId, b.attemptId) ||
    !sameOptionalDispatchField(a.delivery, b.delivery) ||
    !sameOptionalDispatchField(a.runId, b.runId)
  ) {
    return false;
  }
  if (a.state === 'dispatching' && b.state === 'dispatching') {
    return sameOptionalDispatchField(a.claimExpiresAt, b.claimExpiresAt);
  }
  return a.state === 'accepted' && b.state === 'accepted' && sameOptionalDispatchField(a.acceptedAt, b.acceptedAt);
}

function sameOptionalDispatchField(a: unknown, b: unknown): boolean {
  return (a ?? undefined) === (b ?? undefined);
}

function stableHarnessRowId(parts: unknown[]): string {
  return createHash('sha256')
    .update(parts.map(part => String(part)).join('\u001f'))
    .digest('hex');
}

/** Completed message evidence is only useful for recovery when it preserves the runtime run id. */
function completedMessageEvidenceRunId(record: { runId?: string; sessionId: string; signalId: string }): string {
  if (record.runId !== undefined && record.runId.length > 0) return record.runId;
  throw new Error(
    `Invalid Harness message result evidence for session "${record.sessionId}" signal "${record.signalId}": completed status requires run_id`,
  );
}

function sameTombstoneIdentity(a: OperationAdmissionTombstone, b: OperationAdmissionTombstone): boolean {
  return (
    a.kind === b.kind &&
    a.harnessName === b.harnessName &&
    a.sessionId === b.sessionId &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash &&
    a.queuedItemId === b.queuedItemId &&
    a.signalId === b.signalId &&
    a.runId === b.runId
  );
}

function sameMessageEvidenceIdentity(a: AgentSignalResultEvidence, b: AgentSignalResultEvidence): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.sessionId === b.sessionId &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.signalId === b.signalId &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash
  );
}

function isTerminalMessageEvidence(record: AgentSignalResultEvidence): boolean {
  return record.status === 'completed' || record.status === 'failed';
}

function isSignalAdmissionEvidence(record: AgentSignalResultEvidence): boolean {
  if (record.operationKind !== undefined) return record.operationKind === 'signal';
  return record.dispatch !== undefined || record.signalId.startsWith('harness-channel-signal-');
}

function isDispatchFencedAdmission(record: AgentSignalResultEvidence): boolean {
  return record.admissionId !== undefined && record.admissionHash !== undefined && isSignalAdmissionEvidence(record);
}

function isTerminalQueueReceipt(receipt: QueueAdmissionReceipt): boolean {
  return receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'dead';
}

function isTerminalChannelInboxStatus(status: ChannelInboxItem['status']): boolean {
  return status === 'accepted' || status === 'queued' || status === 'dead';
}

function isTerminalChannelActionReceiptStatus(status: ChannelActionReceipt['status']): boolean {
  return status === 'applied' || status === 'conflict' || status === 'dead';
}

function isTerminalChannelOutboxStatus(status: ChannelOutboxItem['status']): boolean {
  return status === 'sent' || status === 'dead';
}

function isTerminalHarnessWakeupStatus(status: HarnessWakeupItem['status']): boolean {
  return status === 'queued' || status === 'completed' || status === 'dead';
}

function isChannelInboxClaimable(item: ChannelInboxItem, now: number): boolean {
  if (isTerminalChannelInboxStatus(item.status)) return false;
  if (item.nextAttemptAt !== undefined && item.nextAttemptAt > now) return false;
  return item.claimId === undefined || item.claimExpiresAt === undefined || item.claimExpiresAt <= now;
}

function isChannelActionReceiptClaimable(receipt: ChannelActionReceipt, now: number): boolean {
  if (isTerminalChannelActionReceiptStatus(receipt.status)) return false;
  if (receipt.nextAttemptAt !== undefined && receipt.nextAttemptAt > now) return false;
  return receipt.claimId === undefined || receipt.claimExpiresAt === undefined || receipt.claimExpiresAt <= now;
}

function isHarnessWakeupClaimable(item: HarnessWakeupItem, now: number): boolean {
  if (isTerminalHarnessWakeupStatus(item.status)) return false;
  if (item.dueAt > now) return false;
  if (item.nextAttemptAt !== undefined && item.nextAttemptAt > now) return false;
  return item.claimId === undefined || item.claimExpiresAt === undefined || item.claimExpiresAt <= now;
}

function claimHarnessWakeupItem(
  item: HarnessWakeupItem,
  claimId: string,
  now: number,
  claimTtlMs: number,
): HarnessWakeupItem {
  return {
    ...item,
    status: 'claimed',
    attempts: item.attempts + 1,
    claimId,
    claimExpiresAt: now + claimTtlMs,
    claimedAt: now,
    queuedItemId: undefined,
    queuedAt: undefined,
    completedAt: undefined,
    deadAt: undefined,
    runId: undefined,
    signalId: undefined,
    result: undefined,
    nextAttemptAt: undefined,
    failedAt: undefined,
    lastError: undefined,
    updatedAt: now,
  };
}

function assertLegalChannelInboxUpdate(current: ChannelInboxItem, next: ChannelInboxItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.admissionId !== next.admissionId ||
    current.externalMessageId !== next.externalMessageId ||
    current.receivedAt !== next.receivedAt;
  if (immutableMismatch) {
    throw new HarnessStorageChannelInboxTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable provider identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'received' &&
      (next.status === 'admitted' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'admitted' &&
      (next.status === 'accepted' || next.status === 'queued' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'failed' &&
      (next.status === 'received' || next.status === 'admitted' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalChannelInboxStatus(current.status)) {
    throw new HarnessStorageChannelInboxTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel inbox state machine',
    );
  }
  assertValidChannelInboxState(next, current.status);
}

function assertValidChannelInboxState(record: ChannelInboxItem, currentStatus?: ChannelInboxItem['status']): void {
  if (
    record.status === 'admitted' &&
    (record.delivery === undefined ||
      (record.delivery !== 'signal' && record.delivery !== 'queue') ||
      record.admittedAt == null)
  ) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'admitted rows require delivery and admittedAt',
    );
  }
  if (
    record.status === 'accepted' &&
    (record.delivery !== 'signal' || !record.runId || !record.signalId || record.acceptedAt == null)
  ) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'accepted rows require signal delivery, runId, signalId, and acceptedAt',
    );
  }
  if (record.status === 'queued' && (record.delivery !== 'queue' || !record.queuedItemId || record.queuedAt == null)) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued rows require queue delivery, queuedItemId, and queuedAt',
    );
  }
  if ((record.status === 'failed' || record.status === 'dead') && record.lastError == null) {
    throw new HarnessStorageChannelInboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed and dead rows require lastError',
    );
  }
}

function assertLegalChannelActionReceiptUpdate(current: ChannelActionReceipt, next: ChannelActionReceipt): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.actionTokenId !== next.actionTokenId ||
    current.actionId !== next.actionId ||
    current.bindingId !== next.bindingId ||
    current.bindingGeneration !== next.bindingGeneration ||
    current.resourceId !== next.resourceId ||
    current.owningSessionId !== next.owningSessionId ||
    current.itemId !== next.itemId ||
    current.kind !== next.kind ||
    current.runId !== next.runId ||
    current.pendingRequestedAt !== next.pendingRequestedAt ||
    stableJsonString(current.audience) !== stableJsonString(next.audience) ||
    current.responseHash !== next.responseHash;
  if (immutableMismatch) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable token, item, and response identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'received' &&
      (next.status === 'accepted' ||
        next.status === 'failed' ||
        next.status === 'conflict' ||
        next.status === 'dead')) ||
    (current.status === 'accepted' &&
      (next.status === 'applied' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'failed' &&
      (next.status === 'received' || next.status === 'accepted' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalChannelActionReceiptStatus(current.status)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel action receipt state machine',
    );
  }
  assertValidChannelActionReceiptState(next, current.status);
}

function assertValidChannelActionReceiptState(
  record: ChannelActionReceipt,
  currentStatus?: ChannelActionReceipt['status'],
): void {
  const validStatus =
    record.status === 'received' ||
    record.status === 'accepted' ||
    record.status === 'applied' ||
    record.status === 'conflict' ||
    record.status === 'failed' ||
    record.status === 'dead';
  if (!validStatus) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known channel action receipt state',
    );
  }
  if (record.status === 'accepted' && record.acceptedAt == null) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'accepted receipts require acceptedAt',
    );
  }
  if (record.status === 'applied' && (record.appliedAt == null || record.result === undefined)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'applied receipts require appliedAt and result',
    );
  }
  if (record.status === 'conflict' && record.conflictReason == null) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'conflict receipts require conflictReason',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed receipts require failedAt and lastError',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead receipts require deadAt and lastError',
    );
  }
  if (
    record.conflictReason !== undefined &&
    record.conflictReason !== 'response_mismatch' &&
    record.conflictReason !== 'stale_item' &&
    record.conflictReason !== 'kind_mismatch' &&
    record.conflictReason !== 'run_mismatch' &&
    record.conflictReason !== 'binding_mismatch' &&
    record.conflictReason !== 'session_closed' &&
    record.conflictReason !== 'actor_not_allowed' &&
    record.conflictReason !== 'token_expired' &&
    record.conflictReason !== 'token_revoked'
  ) {
    throw new HarnessStorageChannelActionReceiptTransitionError(
      record.id,
      currentStatus,
      record.status,
      'conflictReason is not a known channel action receipt reason',
    );
  }
}

function assertLegalChannelOutboxUpdate(current: ChannelOutboxItem, next: ChannelOutboxItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.channelId !== next.channelId ||
    current.providerId !== next.providerId ||
    current.bindingId !== next.bindingId ||
    current.bindingGeneration !== next.bindingGeneration ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.resourceId !== next.resourceId ||
    current.threadId !== next.threadId ||
    current.sessionId !== next.sessionId ||
    current.owningSessionId !== next.owningSessionId ||
    stableJsonString(current.source) !== stableJsonString(next.source) ||
    stableJsonString(current.target) !== stableJsonString(next.target) ||
    current.kind !== next.kind ||
    current.operationKind !== next.operationKind ||
    current.operationName !== next.operationName ||
    stableJsonString(current.payload) !== stableJsonString(next.payload) ||
    current.deliverySemantics !== next.deliverySemantics ||
    current.createdAt !== next.createdAt;
  if (immutableMismatch) {
    throw new HarnessStorageChannelOutboxTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable delivery identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    ((current.status === 'pending' || current.status === 'failed' || current.status === 'claimed') &&
      (next.status === 'claimed' || next.status === 'failed' || next.status === 'sent' || next.status === 'dead'));
  if (!allowed || isTerminalChannelOutboxStatus(current.status)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for channel outbox state machine',
    );
  }
  assertValidChannelOutboxState(next, current.status);
}

function assertValidChannelOutboxState(record: ChannelOutboxItem, currentStatus?: ChannelOutboxItem['status']): void {
  const validStatus =
    record.status === 'pending' ||
    record.status === 'claimed' ||
    record.status === 'sent' ||
    record.status === 'failed' ||
    record.status === 'dead';
  if (!validStatus) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known channel outbox state',
    );
  }
  if (currentStatus === undefined && record.status !== 'pending') {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'new outbox rows must start pending',
    );
  }
  if (record.status === 'pending' && record.attempts !== 0) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'new pending rows must start with zero attempts',
    );
  }
  if (
    record.status === 'pending' &&
    (record.claimId !== undefined ||
      record.claimExpiresAt !== undefined ||
      record.nextAttemptAt !== undefined ||
      record.sentAt !== undefined ||
      record.failedAt !== undefined ||
      record.deadAt !== undefined ||
      record.providerMessageId !== undefined ||
      record.providerReceipt !== undefined ||
      record.lastError !== undefined)
  ) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'pending rows must not include claim, retry, terminal, provider, or error metadata',
    );
  }
  if (record.status === 'claimed' && (!record.claimId || record.claimExpiresAt == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed rows require claimId and claimExpiresAt',
    );
  }
  if (record.status === 'sent' && record.sentAt == null) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'sent rows require sentAt',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed rows require failedAt and lastError',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageChannelOutboxTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead rows require deadAt and lastError',
    );
  }
}

function channelInboxItemsEqual(a: ChannelInboxItem, b: ChannelInboxItem): boolean {
  const aValues = channelInboxComparableValues(a);
  const bValues = channelInboxComparableValues(b);
  return aValues.length === bValues.length && aValues.every((value, index) => Object.is(value, bValues[index]));
}

function assertLegalHarnessWakeupUpdate(current: HarnessWakeupItem, next: HarnessWakeupItem): void {
  const immutableMismatch =
    current.id !== next.id ||
    current.harnessName !== next.harnessName ||
    current.source !== next.source ||
    current.sourceId !== next.sourceId ||
    current.fireId !== next.fireId ||
    current.idempotencyKey !== next.idempotencyKey ||
    current.payloadHash !== next.payloadHash ||
    current.admissionId !== next.admissionId ||
    current.admissionHash !== next.admissionHash ||
    current.resourceId !== next.resourceId ||
    current.threadId !== next.threadId ||
    current.sessionId !== next.sessionId ||
    current.dueAt !== next.dueAt ||
    current.createdAt !== next.createdAt ||
    current.mode !== next.mode ||
    current.model !== next.model ||
    (current.yolo === true) !== (next.yolo === true) ||
    current.content !== next.content ||
    stableJsonString(current.requestContext) !== stableJsonString(next.requestContext) ||
    stableJsonString(current.attachments) !== stableJsonString(next.attachments);
  if (immutableMismatch) {
    throw new HarnessStorageWakeupTransitionError(
      current.id,
      current.status,
      next.status,
      'immutable wakeup identity fields cannot change',
    );
  }
  const allowed =
    current.status === next.status ||
    (current.status === 'due' && (next.status === 'claimed' || next.status === 'failed' || next.status === 'dead')) ||
    (current.status === 'claimed' &&
      (next.status === 'queued' ||
        next.status === 'completed' ||
        next.status === 'failed' ||
        next.status === 'dead')) ||
    (current.status === 'failed' && (next.status === 'claimed' || next.status === 'failed' || next.status === 'dead'));
  if (!allowed || isTerminalHarnessWakeupStatus(current.status)) {
    throw new HarnessStorageWakeupTransitionError(
      current.id,
      current.status,
      next.status,
      'transition is not legal for wakeup state machine',
    );
  }
  assertValidHarnessWakeupState(next, current.status);
}

function assertValidHarnessWakeupState(record: HarnessWakeupItem, currentStatus?: HarnessWakeupItem['status']): void {
  const hasClaimMetadata = record.claimId != null || record.claimExpiresAt != null || record.claimedAt != null;
  const hasQueueMetadata = record.queuedItemId != null || record.queuedAt != null;
  const hasCompletedMetadata = record.completedAt != null || record.result !== undefined;
  const hasFailedMetadata = record.failedAt != null || record.lastError != null;
  const hasDeadMetadata = record.deadAt != null;

  if (record.source !== 'schedule' && record.source !== 'proactive') {
    throw new HarnessStorageWakeupTransitionError(record.id, currentStatus, record.status, 'source is not supported');
  }
  if (
    record.status !== 'due' &&
    record.status !== 'claimed' &&
    record.status !== 'queued' &&
    record.status !== 'completed' &&
    record.status !== 'failed' &&
    record.status !== 'dead'
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'status is not a known wakeup state',
    );
  }
  if (
    record.status === 'due' &&
    (hasClaimMetadata || hasQueueMetadata || hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'due wakeups must not include claim, queue, terminal, or error metadata',
    );
  }
  if (
    record.status === 'claimed' &&
    (record.claimId == null || record.claimExpiresAt == null || record.claimedAt == null)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed wakeups require claimId, claimExpiresAt, and claimedAt',
    );
  }
  if (
    record.status === 'claimed' &&
    (hasQueueMetadata || hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)
  ) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'claimed wakeups must not include queue, terminal, or error metadata',
    );
  }
  if (record.status !== 'claimed' && hasClaimMetadata) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'only claimed wakeups may carry claim metadata',
    );
  }
  if (record.status === 'queued' && (record.queuedItemId == null || record.queuedAt == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued wakeups require queuedItemId and queuedAt',
    );
  }
  if (record.status === 'queued' && (hasCompletedMetadata || hasFailedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'queued wakeups must not include terminal or error metadata',
    );
  }
  if (record.status === 'completed' && (record.completedAt == null || record.result === undefined)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'completed wakeups require completedAt and result',
    );
  }
  if (record.status === 'completed' && (hasQueueMetadata || hasFailedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'completed wakeups must not include queue, error, or dead metadata',
    );
  }
  if (record.status === 'failed' && (record.failedAt == null || record.lastError == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed wakeups require failedAt and lastError',
    );
  }
  if (record.status === 'failed' && (hasQueueMetadata || hasCompletedMetadata || hasDeadMetadata)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'failed wakeups must not include queue, completed, or dead metadata',
    );
  }
  if (record.status === 'dead' && (record.deadAt == null || record.lastError == null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead wakeups require deadAt and lastError',
    );
  }
  if (record.status === 'dead' && (hasQueueMetadata || hasCompletedMetadata || record.failedAt != null)) {
    throw new HarnessStorageWakeupTransitionError(
      record.id,
      currentStatus,
      record.status,
      'dead wakeups must not include queue, completed, or failed metadata',
    );
  }
}

function harnessWakeupItemsEquivalentForCreate(a: HarnessWakeupItem, b: HarnessWakeupItem): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.source === b.source &&
    a.sourceId === b.sourceId &&
    a.fireId === b.fireId &&
    a.idempotencyKey === b.idempotencyKey &&
    a.payloadHash === b.payloadHash &&
    a.admissionId === b.admissionId &&
    a.admissionHash === b.admissionHash &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.sessionId === b.sessionId &&
    a.dueAt === b.dueAt &&
    a.mode === b.mode &&
    a.model === b.model &&
    (a.yolo === true) === (b.yolo === true) &&
    stableJsonString(a.requestContext) === stableJsonString(b.requestContext) &&
    a.content === b.content &&
    stableJsonString(a.attachments) === stableJsonString(b.attachments)
  );
}

function channelActionTokensEquivalent(a: ChannelActionToken, b: ChannelActionToken): boolean {
  return (
    a.actionTokenId === b.actionTokenId &&
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.resourceId === b.resourceId &&
    a.owningSessionId === b.owningSessionId &&
    a.itemId === b.itemId &&
    a.kind === b.kind &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.runId === b.runId &&
    a.pendingRequestedAt === b.pendingRequestedAt &&
    stableJsonString(a.audience) === stableJsonString(b.audience) &&
    a.metadataHash === b.metadataHash &&
    a.transportHash === b.transportHash &&
    a.keyId === b.keyId &&
    a.expiresAt === b.expiresAt
  );
}

function channelActionReceiptsEquivalentForCreate(a: ChannelActionReceipt, b: ChannelActionReceipt): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.actionTokenId === b.actionTokenId &&
    a.actionId === b.actionId &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.resourceId === b.resourceId &&
    a.owningSessionId === b.owningSessionId &&
    a.itemId === b.itemId &&
    a.kind === b.kind &&
    a.runId === b.runId &&
    a.pendingRequestedAt === b.pendingRequestedAt &&
    stableJsonString(a.audience) === stableJsonString(b.audience) &&
    a.responseHash === b.responseHash
  );
}

function channelActionReceiptsEqual(a: ChannelActionReceipt, b: ChannelActionReceipt): boolean {
  const aValues = channelActionReceiptComparableValues(a);
  const bValues = channelActionReceiptComparableValues(b);
  return aValues.length === bValues.length && aValues.every((value, index) => Object.is(value, bValues[index]));
}

function channelOutboxItemsEquivalentForEnqueue(a: ChannelOutboxItem, b: ChannelOutboxItem): boolean {
  return (
    a.harnessName === b.harnessName &&
    a.channelId === b.channelId &&
    a.providerId === b.providerId &&
    a.bindingId === b.bindingId &&
    a.bindingGeneration === b.bindingGeneration &&
    a.idempotencyKey === b.idempotencyKey &&
    a.resourceId === b.resourceId &&
    a.threadId === b.threadId &&
    a.sessionId === b.sessionId &&
    a.owningSessionId === b.owningSessionId &&
    stableJsonString(a.source) === stableJsonString(b.source) &&
    stableJsonString(a.target) === stableJsonString(b.target) &&
    a.kind === b.kind &&
    a.payloadHash === b.payloadHash &&
    stableJsonString(a.payload) === stableJsonString(b.payload) &&
    a.operationKind === b.operationKind &&
    a.operationName === b.operationName &&
    a.deliverySemantics === b.deliverySemantics
  );
}

function channelActionReceiptComparableValues(record: ChannelActionReceipt): unknown[] {
  return [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.actionTokenId,
    record.actionId,
    record.bindingId,
    record.bindingGeneration,
    record.resourceId,
    record.owningSessionId,
    record.itemId,
    record.kind,
    record.runId,
    record.pendingRequestedAt,
    stableJsonString(record.audience),
    stableJsonString(record.verifiedActor),
    record.responseHash,
    stableJsonString(record.response),
    record.status,
    record.conflictReason,
    record.attempts,
    record.claimId,
    record.claimExpiresAt,
    record.nextAttemptAt,
    record.acceptedAt,
    record.appliedAt,
    record.failedAt,
    record.deadAt,
    stableJsonString(record.result),
    record.lastError ? stableJsonString(record.lastError) : undefined,
    record.createdAt,
    record.updatedAt,
  ];
}

function channelInboxComparableValues(record: ChannelInboxItem): unknown[] {
  return [
    record.id,
    record.harnessName,
    record.channelId,
    record.providerId,
    record.idempotencyKey,
    record.payloadHash,
    record.admissionHash,
    record.admissionId,
    record.bindingId,
    record.resourceId,
    record.threadId,
    record.sessionId,
    record.runId,
    record.signalId,
    record.queuedItemId,
    record.externalMessageId,
    record.receivedAt,
    record.admittedAt,
    record.acceptedAt,
    record.queuedAt,
    record.failedAt,
    record.deadAt,
    record.updatedAt,
    record.status,
    record.delivery,
    record.mode,
    record.model,
    record.attempts,
    record.claimId,
    record.claimExpiresAt,
    record.nextAttemptAt,
    stableJsonString(record.requestContext),
    record.content,
    stableJsonString(record.attachments),
    record.rawFiles ? stableJsonString(record.rawFiles) : undefined,
    record.lastError ? stableJsonString(record.lastError) : undefined,
  ];
}

function stableJsonString(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalJsonValue(entry)]),
    );
  }
  return value;
}

function toAttachmentReferenceSource(value: unknown): AttachmentReference['source'] {
  if (
    value === 'queued_item' ||
    value === 'queue_receipt' ||
    value === 'current_run' ||
    value === 'message_history' ||
    value === 'channel_inbox' ||
    value === 'wakeup' ||
    value === 'outbox'
  ) {
    return value;
  }
  return 'queued_item';
}
