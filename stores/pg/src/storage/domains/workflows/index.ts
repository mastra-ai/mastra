import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  mergeWorkflowStepResult,
  normalizePerPage,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_WORKFLOW_SNAPSHOT_HANDOFF,
  TABLE_SCHEMAS,
  matchesExpectedWorkflowState,
  WorkflowsStorage,
  applyWorkflowTerminalParentContinuationPatch,
  copyWorkflowTerminalParentContinuationContract,
  WorkflowTerminalContinuationStoredStateError,
  MAX_WORKFLOW_TERMINALIZATION_LEASE_MS,
  MAX_WORKFLOW_TERMINAL_PARENT_EXECUTION_PATH_LENGTH,
  advanceWorkflowTerminalizationRecord,
  authorizeWorkflowTerminalStateRecord,
  bindWorkflowNestedRunOwnershipRecord,
  captureWorkflowRunIdentity,
  captureWorkflowNestedRunAdmissionInput,
  claimWorkflowTerminalizationRecord,
  createStorageErrorId,
  createWorkflowTerminalDestinationReceiptRecord,
  materializeWorkflowTerminalEffectDescriptor,
  materializeWorkflowTerminalEffectKind,
  observeWorkflowTerminalizationRecord,
  observeWorkflowTerminalEffectRecord,
  copyWorkflowTerminalEffectRecord,
  copyWorkflowTerminalDestinationReceiptRecord,
  copyWorkflowTerminalContinuationPlanRecord,
  getWorkflowTerminalDestinationReceiptRecord,
  getWorkflowTerminalContinuationPlanRecord,
  getWorkflowTerminalSnapshotRecordHash,
  persistWorkflowTerminalStateRecord,
  prepareWorkflowTerminalEffectRecord,
  reserveWorkflowTerminalDestinationReceiptRecord,
  getWorkflowTerminalEffectForDispatchRecord,
  releaseWorkflowTerminalizationRecord,
  validateWorkflowTerminalizationClaim,
  validateWorkflowTerminalEffectIntegrity,
  validateWorkflowTerminalEffectJournalLink,
  validateWorkflowTerminalSnapshotJournalLink,
  validateWorkflowTerminalSnapshotRecordIntegrity,
  validateWorkflowTerminalEffectRecoveryLink,
  createWorkflowTerminalRecoveryAncestryRecord,
  copyWorkflowTerminalRecoveryAncestryRecord,
  validateWorkflowTerminalRecoveryAncestryRecord,
  sameWorkflowTerminalRecoveryAncestry,
  validateWorkflowTerminalDestinationReceiptIntegrity,
  validateWorkflowTerminalizationFence,
  validateWorkflowTerminalizationRunIdentity,
  validateWorkflowTerminalizationIdentity,
  validateWorkflowNestedRunOwnershipInput,
  validateWorkflowNestedRunInitialSnapshot,
  inspectWorkflowNestedRunRetainedSnapshot,
  validateWorkflowRunSnapshotShape,
  validateWorkflowSnapshotTimestampForFinalState,
  prepareWorkflowTerminalParentApplicationRecords,
  finalizeWorkflowTerminalParentApplicationRecords,
  observeWorkflowTerminalContinuationPlanRecord,
  validateWorkflowTerminalContinuationPlanIntegrity,
  WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID,
  admitWorkflowResumeRecord,
  consumeWorkflowResumeResultRecord,
  finalizeWorkflowResumeRecord,
  persistWorkflowStepUpdateRecord,
  rollbackWorkflowResumeRecord,
  WorkflowSnapshotHandoffFenceError,
  validateWorkflowSnapshotHandoffFence,
  validateWorkflowSnapshotHandoffLimit,
  workflowSnapshotHandoffCanonicalStatesEqual,
  workflowSnapshotHandoffSnapshotsEqual,
} from '@mastra/core/storage';
import type {
  AdvanceWorkflowTerminalizationInput,
  AdvanceWorkflowTerminalizationResult,
  ClaimWorkflowTerminalizationInput,
  ClaimWorkflowTerminalizationResult,
  DeleteCompletedWorkflowTerminalizationsInput,
  DeleteCompletedWorkflowTerminalizationsResult,
  GetWorkflowTerminalizationInput,
  GetWorkflowTerminalizationResult,
  GetWorkflowRunTerminalStatusInput,
  GetWorkflowRunTerminalStatusResult,
  GetWorkflowTerminalEffectForDispatchInput,
  GetWorkflowTerminalEffectForDispatchResult,
  GetWorkflowTerminalDestinationReceiptInput,
  GetWorkflowTerminalDestinationReceiptResult,
  GetWorkflowTerminalParentContextInput,
  GetWorkflowTerminalParentContextResult,
  GetWorkflowTerminalContinuationPlanInput,
  GetWorkflowTerminalContinuationPlanResult,
  PersistWorkflowTerminalStateInput,
  PersistWorkflowTerminalStateResult,
  PrepareWorkflowTerminalEffectInput,
  PrepareWorkflowTerminalEffectResult,
  ReserveWorkflowTerminalDestinationReceiptInput,
  ReserveWorkflowTerminalDestinationReceiptResult,
  ApplyWorkflowTerminalParentEffectInput,
  ApplyWorkflowTerminalParentEffectResult,
  BindWorkflowNestedRunOwnershipInput,
  BindWorkflowNestedRunOwnershipResult,
  AdmitWorkflowNestedRunInput,
  AdmitWorkflowNestedRunResult,
  AdmitWorkflowResumeInput,
  AdmitWorkflowResumeResult,
  ConsumeWorkflowResumeResult,
  ConsumeWorkflowResumeResultInput,
  FinalizeWorkflowResumeInput,
  FinalizeWorkflowResumeResult,
  PersistWorkflowStepUpdateInput,
  PersistWorkflowStepUpdateResult,
  PersistWorkflowTerminalRecoveryAncestryInput,
  PersistWorkflowTerminalRecoveryAncestryResult,
  GetWorkflowTerminalRecoveryAncestryResult,
  ReleaseWorkflowTerminalizationInput,
  ReleaseWorkflowTerminalizationResult,
  RollbackWorkflowResumeInput,
  RollbackWorkflowResumeResult,
  UpdateWorkflowStateOptions,
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRuns,
  WorkflowExecutionState,
  CreateIndexOptions,
  WorkflowTerminalContinuationPlanRecord,
  WorkflowTerminalizationCapabilities,
  WorkflowResumeCapabilities,
  WorkflowSnapshotHandoffCapabilities,
  WorkflowSnapshotHandoffCanonicalState,
  WorkflowSnapshotHandoffRecord,
  ClaimWorkflowSnapshotHandoffInput,
  ClaimWorkflowSnapshotHandoffResult,
  TransitionWorkflowSnapshotHandoffInput,
  TransitionWorkflowSnapshotHandoffResult,
  CompleteWorkflowSnapshotHandoffInput,
  CompleteWorkflowSnapshotHandoffResult,
  ListWorkflowSnapshotHandoffsInput,
  ListWorkflowSnapshotHandoffsResult,
  WorkflowTerminalRecoveryAncestryRecord,
  TABLE_NAMES,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type {
  StepResult,
  WorkflowRunState,
  WorkflowTerminalRecoveryEnvelopeV1,
  WorkflowTerminalEffectRecord,
  WorkflowTerminalDestinationReceiptRecord,
  WorkflowTerminalSnapshotRecord,
  WorkflowTerminalizationRecord,
} from '@mastra/core/workflows';
import {
  materializeWorkflowTerminalCanonicalJsonObject,
  materializeWorkflowTerminalRecoveryEnvelope,
  validateWorkflowTerminalRecoveryEnvelopeIntegrity,
  validateWorkflowTerminalRecoveryParentFrameGraphBinding,
} from '@mastra/core/workflows';
import type { DbClient, TxClient } from '../../client';
import { PgDB, resolvePgConfig, generateIndexSQL, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { truncateIdentifierWithHash } from '../../db/constraint-utils';
import { PG_UNSAFE_JSON_UNICODE_ESCAPE_PATTERN, sanitizeJsonForPg } from '../../db/sanitize-json';
import { getSchemaSnapshot } from '../../db/schema-snapshot';
import type { SchemaCheckConstraint } from '../../db/schema-snapshot';
import { runPrune, resolveTargets } from '../../retention';

class CorruptWorkflowTerminalSnapshotRecordError extends TypeError {
  constructor() {
    super('Invalid workflow terminal snapshot record');
    this.name = 'CorruptWorkflowTerminalSnapshotRecordError';
  }
}

const TABLE_WORKFLOW_TERMINALIZATIONS = 'mastra_workflow_terminalizations';
// PF-1782 defines one canonical v2 namespace for its linked retained evidence.
const TABLE_WORKFLOW_TERMINAL_EFFECTS = 'mastra_workflow_terminal_effects_v2';
const TABLE_WORKFLOW_TERMINAL_SNAPSHOTS = 'mastra_workflow_terminal_snapshots_v2';
const TABLE_WORKFLOW_TERMINAL_RECOVERY_ANCESTRIES = 'mastra_workflow_terminal_recovery_ancestries';
const TABLE_WORKFLOW_TERMINAL_DESTINATION_RECEIPTS = 'mastra_workflow_terminal_destination_receipts_v2';
const TABLE_WORKFLOW_TERMINAL_CONTINUATION_PLANS = 'mastra_workflow_terminal_continuation_plans_v2';
const TABLE_WORKFLOW_PARENT_REVISIONS = 'mastra_workflow_parent_revisions';
const TABLE_WORKFLOW_SCHEMA_MIGRATIONS = 'mastra_workflow_schema_migrations';
const TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH = 'mastra_workflow_parent_revision_migration_epoch';
const WORKFLOW_PARENT_REVISION_MIGRATION = 'workflow-parent-revision-v1';
const WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH = 1;
const TERMINAL_WORKFLOW_RUN_STATUSES = ['success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped'] as const;
const WORKFLOW_TERMINALIZATION_STATUSES = ['success', 'failed', 'canceled'] as const;
type TerminalWorkflowRunStatus = (typeof TERMINAL_WORKFLOW_RUN_STATUSES)[number];
type WorkflowSnapshotColumnType = 'jsonb' | 'json' | 'text';
const WORKFLOW_PARENT_REVISION_BASE_CHECKS = ['generation >= 0', 'updated_at >= 0'] as const;
const WORKFLOW_PARENT_REVISION_TERMINAL_STATUS_CHECK =
  "terminal_status IS NULL OR (terminal_status = ANY (ARRAY['success'::text, 'failed'::text, 'canceled'::text, 'tripwire'::text, 'bailed'::text, 'skipped'::text]))";
const WORKFLOW_SCHEMA_MIGRATION_CHECKS = [
  'length(migration_key) >= 1 AND length(migration_key) <= 256',
  'applied_at >= 0',
] as const;
const WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH_CHECKS = ['epoch = 1', 'created_at >= 0'] as const;
const WORKFLOW_PARENT_REVISION_EXPORT_MIGRATION_REQUIRED =
  'WORKFLOW_PARENT_REVISION_MIGRATION_REQUIRED: run PostgresStore.init() with disableInit=false before applying exported schema to populated workflow storage';

type WorkflowSchemaRelationShape = 'absent' | 'legacy' | 'current' | 'incompatible';

interface WorkflowMigrationSchemaState {
  markerTable: 'absent' | 'current' | 'incompatible';
  epochTable: 'absent' | 'current' | 'incompatible';
  parentRevisions: WorkflowSchemaRelationShape;
  snapshotColumnType: string | null;
}

interface WorkflowParentRevisionMigrationEvidence {
  marker: boolean;
  epoch: boolean;
}

interface WorkflowCatalogRelation {
  kind: string;
  isPartition: boolean;
  hasInheritance: boolean;
  persistence: string;
  columns: Map<string, string>;
  notNullColumns: Set<string>;
  columnsWithDefaults: Set<string>;
  primaryKeyColumns: string[];
  primaryKeyImmediate: boolean;
  checkConstraints: SchemaCheckConstraint[];
}

interface WorkflowParentRevisionLock {
  generation: number;
  terminalStatus: TerminalWorkflowRunStatus | null;
}

interface WorkflowParentRevisionCreationLock extends WorkflowParentRevisionLock {
  created: boolean;
}

function isTerminalWorkflowRunStatus(value: unknown): value is TerminalWorkflowRunStatus {
  return typeof value === 'string' && TERMINAL_WORKFLOW_RUN_STATUSES.includes(value as TerminalWorkflowRunStatus);
}

function isWorkflowTerminalizationStatus(value: unknown): value is (typeof WORKFLOW_TERMINALIZATION_STATUSES)[number] {
  return (
    typeof value === 'string' &&
    WORKFLOW_TERMINALIZATION_STATUSES.includes(value as (typeof WORKFLOW_TERMINALIZATION_STATUSES)[number])
  );
}

function isInvalidLegacyWorkflowSnapshotJsonError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === '22P02' || code === '22P05';
}
export { sanitizeJsonForPg };

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const quotedIndexName = `"${indexName}"`;
  return schemaName ? `${schemaName}.${quotedIndexName}` : quotedIndexName;
}

/** Base name (before any schema prefix) of the `(workflow_name, "createdAt" DESC)` snapshot index. */
const WORKFLOW_SNAPSHOT_CREATEDAT_INDEX = 'mastra_workflow_snapshot_name_createdat_idx';

/**
 * Schema-prefixed name of the createdAt snapshot index, normalized exactly like
 * {@link workflowSnapshotStatusIndexName}. Raw concatenation is not safe here: the base name is
 * 43 bytes, so any schema of 20 bytes or more overflows Postgres' 63-byte identifier limit, and
 * `parseSqlIdentifier` throws on that — which would make `getExportDDL()` fail outright and make
 * `createDefaultIndexes()` silently drop this index (its per-index catch only logs).
 */
function workflowSnapshotCreatedAtIndexName(schemaPrefix: string): string {
  return truncateIdentifierWithHash(`${schemaPrefix}${WORKFLOW_SNAPSHOT_CREATEDAT_INDEX}`.toLowerCase());
}

/** Base name (before any schema prefix) of the expression index backing the status filter. */
const WORKFLOW_SNAPSHOT_STATUS_INDEX = 'mastra_workflow_snapshot_name_status_createdat_idx';

/**
 * Schema-prefixed name of the status index, lowercased and truncated the same way Postgres
 * stores it, so the init snapshot's index set answers "does it exist?" without a probe or a
 * no-op `CREATE INDEX` (schema-prefixed names routinely exceed the 63-byte limit).
 */
function workflowSnapshotStatusIndexName(schemaName?: string): string {
  const prefix = schemaName && schemaName !== 'public' ? `${schemaName}_` : '';
  return truncateIdentifierWithHash(`${prefix}${WORKFLOW_SNAPSHOT_STATUS_INDEX}`.toLowerCase());
}

/**
 * Expression index on `(workflow_name, snapshot->>'status', "createdAt" DESC)` so
 * listWorkflowRuns() status filters can use an index instead of scanning every snapshot.
 */
function workflowSnapshotStatusIndexSQL(indexName: string, schemaName?: string): string {
  const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(schemaName) });
  return `CREATE INDEX IF NOT EXISTS "${indexName}" ON ${tableName} (workflow_name, (snapshot ->> 'status'), "createdAt" DESC)`;
}

export class WorkflowsPG extends WorkflowsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];
  #initializedWorkflowSnapshotColumnType?: WorkflowSnapshotColumnType;

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [
    TABLE_WORKFLOW_SNAPSHOT,
    TABLE_WORKFLOW_SNAPSHOT_HANDOFF,
    TABLE_WORKFLOW_TERMINALIZATIONS,
    TABLE_WORKFLOW_TERMINAL_EFFECTS,
    TABLE_WORKFLOW_TERMINAL_SNAPSHOTS,
    TABLE_WORKFLOW_TERMINAL_RECOVERY_ANCESTRIES,
    TABLE_WORKFLOW_TERMINAL_DESTINATION_RECEIPTS,
    TABLE_WORKFLOW_TERMINAL_CONTINUATION_PLANS,
    TABLE_WORKFLOW_PARENT_REVISIONS,
    TABLE_WORKFLOW_SCHEMA_MIGRATIONS,
  ] as const;

  /**
   * Workflow run snapshots accumulate as runs execute. Anchored on the
   * timezone-aware `updatedAtZ` mirror column (last activity) so suspended or
   * long-running runs are not pruned by start age.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    workflowSnapshot: { table: TABLE_WORKFLOW_SNAPSHOT, column: 'updatedAtZ', indexed: true },
  };

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, disableInit, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, readClient, schemaName, disableInit, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (WorkflowsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  supportsWorkflowTerminalizationJournal(): boolean {
    return true;
  }

  getWorkflowTerminalizationCapabilities(): WorkflowTerminalizationCapabilities {
    return {
      journalVersion: 1,
      producerOutboxVersion: 1,
      destinationReceiptVersion: 1,
      parentApplicationVersion: 1,
      recoveryVersion: 1,
    };
  }

  getWorkflowResumeCapabilities(): WorkflowResumeCapabilities {
    return { atomicResumeVersion: 1, fencedStepUpdateVersion: 1 };
  }

  getWorkflowSnapshotHandoffCapabilities(): WorkflowSnapshotHandoffCapabilities {
    return { handoffVersion: 1, recoveryVersion: 1 };
  }

  private materializeResumeSnapshot(snapshot: WorkflowRunState): WorkflowRunState {
    return JSON.parse(sanitizeJsonForPg(JSON.stringify(snapshot))) as WorkflowRunState;
  }

  private async mutateWorkflowResume<T extends { status: string }>(
    workflowName: string,
    runId: string,
    resourceId: string | undefined,
    mutate: (snapshot: WorkflowRunState | undefined) => T & { snapshot?: WorkflowRunState },
    operation: string,
  ): Promise<T> {
    try {
      return await this.#db.client.tx(async t => {
        const revision = await this.lockExistingWorkflowParentRevision(t, workflowName, runId);
        const row = await t.oneOrNone<{ snapshot: WorkflowRunState | string; resourceId?: string | null }>(
          `SELECT snapshot, "resourceId" FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );
        await this.assertWorkflowSnapshotHandoffAvailable(t, workflowName, runId);
        if (!revision && row) {
          throw new TypeError('Workflow snapshot is missing parent revision evidence');
        }
        const snapshot = row?.snapshot
          ? this.materializeResumeSnapshot(typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot)
          : undefined;
        const outcome = mutate(snapshot);
        const { snapshot: updatedSnapshot, ...publicResult } = outcome;
        if (updatedSnapshot && row) {
          const retainedResourceId = row.resourceId ?? updatedSnapshot.resourceId ?? resourceId ?? null;
          const now = new Date();
          await t.none(
            `UPDATE ${this.workflowSnapshotTableName()}
             SET "resourceId" = $1, snapshot = $2, "updatedAt" = $3, "updatedAtZ" = $4
             WHERE workflow_name = $5 AND run_id = $6`,
            [retainedResourceId, sanitizeJsonForPg(JSON.stringify(updatedSnapshot)), now, now, workflowName, runId],
          );
          await this.bumpWorkflowParentRevision(t, workflowName, runId, revision!.generation);
        }
        return publicResult as T;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', operation.toUpperCase(), 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async admitWorkflowResume(input: AdmitWorkflowResumeInput): Promise<AdmitWorkflowResumeResult> {
    return this.mutateWorkflowResume(
      input.workflowName,
      input.runId,
      input.resourceId,
      snapshot =>
        admitWorkflowResumeRecord(snapshot, input, Date.now(), value => this.materializeResumeSnapshot(value)),
      'admit_workflow_resume',
    );
  }

  async rollbackWorkflowResume(input: RollbackWorkflowResumeInput): Promise<RollbackWorkflowResumeResult> {
    return this.mutateWorkflowResume(
      input.workflowName,
      input.runId,
      input.resourceId,
      snapshot =>
        rollbackWorkflowResumeRecord(snapshot, input, Date.now(), value => this.materializeResumeSnapshot(value)),
      'rollback_workflow_resume',
    );
  }

  async finalizeWorkflowResume(input: FinalizeWorkflowResumeInput): Promise<FinalizeWorkflowResumeResult> {
    return this.mutateWorkflowResume(
      input.workflowName,
      input.runId,
      input.resourceId,
      snapshot =>
        finalizeWorkflowResumeRecord(snapshot, input, Date.now(), value => this.materializeResumeSnapshot(value)),
      'finalize_workflow_resume',
    );
  }

  async consumeWorkflowResumeResult(input: ConsumeWorkflowResumeResultInput): Promise<ConsumeWorkflowResumeResult> {
    return this.mutateWorkflowResume(
      input.workflowName,
      input.runId,
      undefined,
      snapshot =>
        consumeWorkflowResumeResultRecord(snapshot, input, Date.now(), value => this.materializeResumeSnapshot(value)),
      'consume_workflow_resume_result',
    );
  }

  async persistWorkflowStepUpdate(input: PersistWorkflowStepUpdateInput): Promise<PersistWorkflowStepUpdateResult> {
    try {
      return await this.#db.client.tx(async t => {
        const revision = await this.lockWorkflowParentRevisionForSnapshotUpsert(t, input.workflowName, input.runId);
        await this.assertWorkflowSnapshotHandoffAvailable(t, input.workflowName, input.runId);
        const row = await t.oneOrNone<{ snapshot: WorkflowRunState | string; resourceId?: string | null }>(
          `SELECT snapshot, "resourceId" FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [input.workflowName, input.runId],
        );
        if (revision.created && row) {
          throw new TypeError('Workflow snapshot is missing parent revision evidence');
        }
        const snapshot = row?.snapshot
          ? this.materializeResumeSnapshot(typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot)
          : undefined;
        const outcome = persistWorkflowStepUpdateRecord(snapshot, input, value =>
          this.materializeResumeSnapshot(value),
        );
        const { snapshot: updatedSnapshot, ...result } = outcome;
        if (updatedSnapshot) {
          const now = new Date();
          const retainedResourceId = row?.resourceId ?? updatedSnapshot.resourceId ?? input.resourceId ?? null;
          await t.none(
            `INSERT INTO ${this.workflowSnapshotTableName()}
               (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (workflow_name, run_id) DO UPDATE
             SET "resourceId" = $3, snapshot = $4, "updatedAt" = $6, "updatedAtZ" = $8`,
            [
              input.workflowName,
              input.runId,
              retainedResourceId,
              sanitizeJsonForPg(JSON.stringify(updatedSnapshot)),
              now,
              now,
              now,
              now,
            ],
          );
          await this.bumpWorkflowParentRevision(t, input.workflowName, input.runId, revision.generation);
        } else {
          await this.deleteProvisionalWorkflowParentRevision(t, input.workflowName, input.runId, revision.created);
        }
        return result;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PERSIST_WORKFLOW_STEP_UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: input.workflowName, runId: input.runId },
        },
        error,
      );
    }
  }

  private terminalizationTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_TERMINALIZATIONS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private workflowSnapshotTableName(): string {
    return getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) });
  }

  private workflowSnapshotHandoffTableName(): string {
    return getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT_HANDOFF, schemaName: getSchemaName(this.#schema) });
  }

  private terminalEffectTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_EFFECTS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private terminalSnapshotTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_SNAPSHOTS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private terminalRecoveryAncestryTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_RECOVERY_ANCESTRIES,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private terminalDestinationReceiptTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_DESTINATION_RECEIPTS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private terminalContinuationPlanTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_CONTINUATION_PLANS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private workflowParentRevisionTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_PARENT_REVISIONS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private workflowSchemaMigrationTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_SCHEMA_MIGRATIONS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private workflowParentRevisionMigrationEpochTableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private decodeWorkflowParentRevision(
    row: { generation: number | string; terminal_status: string | null },
    minimumGeneration: 0 | 1,
  ): WorkflowParentRevisionLock {
    const generation = typeof row.generation === 'string' ? Number(row.generation) : row.generation;
    if (!Number.isSafeInteger(generation) || generation < minimumGeneration) {
      throw new TypeError('Invalid workflow parent revision generation');
    }
    if (row.terminal_status !== null && !isTerminalWorkflowRunStatus(row.terminal_status)) {
      throw new TypeError('Invalid workflow parent terminal status');
    }
    return { generation, terminalStatus: row.terminal_status };
  }

  /**
   * Locks revision evidence that must already exist for durable workflow state.
   * Missing evidence is returned to the caller so its existing structured
   * missing/corruption contract can be preserved without manufacturing a new
   * identity. A committed generation zero is always corruption.
   */
  private async lockExistingWorkflowParentRevision(
    t: TxClient,
    workflowName: string,
    runId: string,
  ): Promise<WorkflowParentRevisionLock | undefined> {
    const row = await t.oneOrNone<{ generation: number | string; terminal_status: string | null }>(
      `SELECT generation, terminal_status FROM ${this.workflowParentRevisionTableName()}
       WHERE workflow_name = $1 AND run_id = $2
       FOR UPDATE`,
      [workflowName, runId],
    );
    return row ? this.decodeWorkflowParentRevision(row, 1) : undefined;
  }

  /**
   * Reserves revision evidence for a path that is authorized to create a new
   * canonical snapshot. The generation-zero row is provisional: every caller
   * must either create the snapshot and bump it to generation one or remove it
   * before returning. Discovering a pre-existing snapshot after creating this
   * row is corruption, not permission to repair the missing evidence.
   */
  private async lockWorkflowParentRevisionForSnapshotUpsert(
    t: TxClient,
    workflowName: string,
    runId: string,
  ): Promise<WorkflowParentRevisionCreationLock> {
    const inserted = await t.oneOrNone<{ generation: number | string }>(
      `INSERT INTO ${this.workflowParentRevisionTableName()}
       (workflow_name, run_id, generation, updated_at)
       VALUES ($1, $2, 0, floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)
       ON CONFLICT (workflow_name, run_id) DO NOTHING
       RETURNING generation`,
      [workflowName, runId],
    );
    const row = await t.one<{ generation: number | string; terminal_status: string | null }>(
      `SELECT generation, terminal_status FROM ${this.workflowParentRevisionTableName()}
       WHERE workflow_name = $1 AND run_id = $2
       FOR UPDATE`,
      [workflowName, runId],
    );
    const created = inserted !== null;
    const decoded = this.decodeWorkflowParentRevision(row, created ? 0 : 1);
    if (created && decoded.generation !== 0) {
      throw new TypeError('Invalid provisional workflow parent revision generation');
    }
    return { ...decoded, created };
  }

  private async deleteProvisionalWorkflowParentRevision(
    t: TxClient,
    workflowName: string,
    runId: string,
    created: boolean,
    generation = 0,
  ): Promise<void> {
    if (!created) return;
    const result = await t.query(
      `DELETE FROM ${this.workflowParentRevisionTableName()}
       WHERE workflow_name = $1 AND run_id = $2 AND generation = $3 AND terminal_status IS NULL`,
      [workflowName, runId, generation],
    );
    if ((result.rowCount ?? 0) !== 1) {
      throw new TypeError('Provisional workflow parent revision could not be rolled back');
    }
  }

  private decodeWorkflowSnapshotHandoff(row: Record<string, unknown>): WorkflowSnapshotHandoffRecord {
    const numberValue = (value: unknown, field: string): number => {
      const parsed = typeof value === 'string' ? Number(value) : value;
      if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0) {
        throw new TypeError(`Invalid workflow snapshot handoff ${field}`);
      }
      return parsed;
    };
    if (row.version !== 1 && row.version !== '1') throw new TypeError('Invalid workflow snapshot handoff version');
    if (row.status !== 'pending' && row.status !== 'completed') {
      throw new TypeError('Invalid workflow snapshot handoff status');
    }
    if (typeof row.workflow_name !== 'string' || typeof row.run_id !== 'string') {
      throw new TypeError('Invalid workflow snapshot handoff identity');
    }
    if (typeof row.mutation_fence !== 'string') throw new TypeError('Invalid workflow snapshot handoff fence');
    const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new TypeError('Invalid workflow snapshot handoff snapshot');
    }
    const createdAt = numberValue(row.created_at, 'created_at');
    const updatedAt = numberValue(row.updated_at, 'updated_at');
    const completedAt =
      row.completed_at === null || row.completed_at === undefined
        ? undefined
        : numberValue(row.completed_at, 'completed_at');
    return {
      version: 1,
      workflowName: row.workflow_name,
      runId: row.run_id,
      status: row.status,
      ...(row.resource_id === null || row.resource_id === undefined ? {} : { resourceId: String(row.resource_id) }),
      snapshot: snapshot as WorkflowRunState,
      mutationFence: row.mutation_fence,
      createdAt,
      updatedAt,
      ...(completedAt === undefined ? {} : { completedAt }),
    };
  }

  private async lockWorkflowSnapshotHandoff(
    t: TxClient,
    workflowName: string,
    runId: string,
  ): Promise<WorkflowSnapshotHandoffRecord | undefined> {
    const row = await t.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${this.workflowSnapshotHandoffTableName()}
       WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
      [workflowName, runId],
    );
    return row ? this.decodeWorkflowSnapshotHandoff(row) : undefined;
  }

  private async assertWorkflowSnapshotHandoffAvailable(
    t: TxClient,
    workflowName: string,
    runId: string,
  ): Promise<void> {
    const handoff = await this.lockWorkflowSnapshotHandoff(t, workflowName, runId);
    if (handoff) {
      throw new WorkflowSnapshotHandoffFenceError({
        workflowName,
        runId,
        handoffStatus: handoff.status,
      });
    }
  }

  private async lockWorkflowSnapshotHandoffCanonicalState(
    t: TxClient,
    workflowName: string,
    runId: string,
  ): Promise<WorkflowSnapshotHandoffCanonicalState> {
    const row = await t.oneOrNone<{ snapshot: WorkflowRunState | string; resourceId?: string | null }>(
      `SELECT snapshot, "resourceId" FROM ${this.workflowSnapshotTableName()}
       WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
      [workflowName, runId],
    );
    if (!row) return { kind: 'absent' };
    const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new TypeError('Workflow snapshot handoff canonical snapshot is invalid');
    }
    return {
      kind: 'present',
      ...(row.resourceId === null || row.resourceId === undefined ? {} : { resourceId: row.resourceId }),
      snapshot: snapshot as WorkflowRunState,
    };
  }

  /** Serializes a handoff claim with both existing and first native snapshot writers. */
  private async lockWorkflowParentRevisionForSnapshotHandoff(
    t: TxClient,
    workflowName: string,
    runId: string,
  ): Promise<WorkflowParentRevisionCreationLock> {
    const inserted = await t.oneOrNone<{ generation: number | string }>(
      `INSERT INTO ${this.workflowParentRevisionTableName()}
       (workflow_name, run_id, generation, updated_at)
       VALUES ($1, $2, 1, floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)
       ON CONFLICT (workflow_name, run_id) DO NOTHING
       RETURNING generation`,
      [workflowName, runId],
    );
    const row = await t.one<{ generation: number | string; terminal_status: string | null }>(
      `SELECT generation, terminal_status FROM ${this.workflowParentRevisionTableName()}
       WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
      [workflowName, runId],
    );
    return { ...this.decodeWorkflowParentRevision(row, 1), created: inserted !== null };
  }

  private async bumpWorkflowParentRevision(
    t: TxClient,
    workflowName: string,
    runId: string,
    generation: number,
  ): Promise<number> {
    const next = generation + 1;
    if (!Number.isSafeInteger(next)) throw new TypeError('Workflow parent revision exhausted');
    const snapshotColumnType = await this.resolveWorkflowSnapshotColumnType(t);
    const snapshotStatus = this.workflowSnapshotStatusExpression(snapshotColumnType, 'snapshot.snapshot');
    const result = await t.query(
      `UPDATE ${this.workflowParentRevisionTableName()} AS revision
       SET generation = $1,
           terminal_status = COALESCE(
             revision.terminal_status,
             (
               SELECT CASE
                 WHEN ${snapshotStatus} IN ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')
                   THEN ${snapshotStatus}
                 ELSE NULL
               END
               FROM ${this.workflowSnapshotTableName()} AS snapshot
               WHERE snapshot.workflow_name = $2 AND snapshot.run_id = $3
             )
           ),
           updated_at = floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint
       WHERE workflow_name = $2 AND run_id = $3 AND generation = $4
         AND (
           revision.terminal_status IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM ${this.workflowSnapshotTableName()} AS snapshot
             WHERE snapshot.workflow_name = $2 AND snapshot.run_id = $3
           )
           OR revision.terminal_status = (
             SELECT CASE
               WHEN ${snapshotStatus} IN ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')
                 THEN ${snapshotStatus}
               ELSE NULL
             END
             FROM ${this.workflowSnapshotTableName()} AS snapshot
             WHERE snapshot.workflow_name = $2 AND snapshot.run_id = $3
           )
         )`,
      [next, workflowName, runId, generation],
    );
    if ((result.rowCount ?? 0) !== 1) throw new TypeError('Workflow parent revision conflict');
    return next;
  }

  private async latchWorkflowParentTerminalStatus(
    t: TxClient,
    workflowName: string,
    runId: string,
    terminalStatus: TerminalWorkflowRunStatus,
  ): Promise<number> {
    const result = await t.oneOrNone<{ generation: number | string; terminal_status: string }>(
      `UPDATE ${this.workflowParentRevisionTableName()}
       SET generation = CASE WHEN terminal_status IS NULL THEN generation + 1 ELSE generation END,
           terminal_status = COALESCE(terminal_status, $1),
           updated_at = floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint
       WHERE workflow_name = $2 AND run_id = $3
       RETURNING generation, terminal_status`,
      [terminalStatus, workflowName, runId],
    );
    if (!result) throw new TypeError('Workflow parent terminal marker is unavailable');
    const generation = typeof result.generation === 'string' ? Number(result.generation) : result.generation;
    if (!Number.isSafeInteger(generation) || generation < 1) {
      throw new TypeError('Workflow parent revision exhausted');
    }
    if (result.terminal_status !== terminalStatus) {
      throw new TypeError('Workflow parent terminal marker conflicts with authoritative terminal status');
    }
    return generation;
  }

  private decodeTerminalizationRow(row: Record<string, unknown>, now: number): WorkflowTerminalizationRecord {
    const toSafeInteger = (value: unknown, field: string): number => {
      const parsed = typeof value === 'string' ? Number(value) : value;
      if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0) {
        throw new TypeError(`Invalid workflow terminalization ${field}`);
      }
      return parsed;
    };
    const record = {
      version: toSafeInteger(row.version, 'version'),
      eventKey: row.event_key,
      terminalStatus: row.terminal_status,
      phase: row.phase,
      ownerId: row.owner_id ?? undefined,
      claimToken: row.claim_token ?? undefined,
      claimGeneration: toSafeInteger(row.claim_generation, 'claim_generation'),
      leaseExpiresAt:
        row.lease_expires_at === null || row.lease_expires_at === undefined
          ? undefined
          : toSafeInteger(row.lease_expires_at, 'lease_expires_at'),
      createdAt: toSafeInteger(row.created_at, 'created_at'),
      updatedAt: toSafeInteger(row.updated_at, 'updated_at'),
      completedAt:
        row.completed_at === null || row.completed_at === undefined
          ? undefined
          : toSafeInteger(row.completed_at, 'completed_at'),
    } as WorkflowTerminalizationRecord;

    const phases = new Set([
      'terminalization_pending',
      'run_state_persisted',
      'parent_outbox_pending',
      'parent_effect_recorded',
      'finish_outbox_pending',
      'finish_effect_recorded',
      'complete',
    ]);
    const validOptionalIdentity = (value: unknown, maxLength: number) =>
      value === undefined || (typeof value === 'string' && value.length > 0 && value.length <= maxLength);
    if (
      record.version !== 1 ||
      typeof record.eventKey !== 'string' ||
      record.eventKey.length === 0 ||
      record.eventKey.length > 1024 ||
      !['success', 'failed', 'canceled'].includes(record.terminalStatus) ||
      !phases.has(record.phase) ||
      record.claimGeneration <= 0 ||
      !validOptionalIdentity(record.ownerId, 256) ||
      !validOptionalIdentity(record.claimToken, 256) ||
      record.createdAt > now ||
      record.updatedAt > now ||
      record.createdAt > record.updatedAt ||
      (record.phase === 'complete' &&
        (record.ownerId !== undefined ||
          record.claimToken !== undefined ||
          record.leaseExpiresAt !== undefined ||
          record.completedAt === undefined ||
          record.completedAt !== record.updatedAt)) ||
      (record.phase !== 'complete' &&
        (record.completedAt !== undefined ||
          (record.ownerId === undefined) !== (record.claimToken === undefined) ||
          (record.claimToken === undefined) !== (record.leaseExpiresAt === undefined) ||
          (record.leaseExpiresAt !== undefined &&
            (record.leaseExpiresAt <= record.updatedAt ||
              record.leaseExpiresAt - record.updatedAt > MAX_WORKFLOW_TERMINALIZATION_LEASE_MS))))
    ) {
      throw new TypeError('Invalid workflow terminalization record');
    }
    return record;
  }

  private decodeTerminalEffectRow(row: Record<string, unknown>, now: number): WorkflowTerminalEffectRecord {
    const toSafeInteger = (value: unknown, field: string): number => {
      const parsed = typeof value === 'string' ? Number(value) : value;
      if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0) {
        throw new TypeError(`Invalid workflow terminal effect ${field}`);
      }
      return parsed;
    };
    const resourceId = row.resource_id === null || row.resource_id === undefined ? undefined : row.resource_id;
    const common = {
      version: toSafeInteger(row.version, 'version'),
      effectKey: row.effect_key,
      kind: row.effect_kind,
      workflowName: row.workflow_name,
      runId: row.run_id,
      sourceEventKey: row.source_event_key,
      terminalStatus: row.terminal_status,
      recoveryEnvelopeHash: row.recovery_envelope_hash,
      retainedRecordHash: row.retained_record_hash,
      ...(resourceId === undefined ? {} : { resourceId }),
      payloadHash: row.payload_hash,
      createdAt: toSafeInteger(row.created_at, 'created_at'),
    };
    const validIdentity = (value: unknown, maxLength: number) =>
      typeof value === 'string' && value.length > 0 && value.length <= maxLength;
    const parentFields = [row.parent_workflow_name, row.parent_run_id, row.parent_step_id];
    const parentExecutionPath = row.parent_execution_path;
    if (
      common.version !== 1 ||
      !['parent-workflow-step-end', 'workflow-finish'].includes(common.kind as string) ||
      !validIdentity(common.workflowName, 512) ||
      !validIdentity(common.runId, 512) ||
      !validIdentity(common.sourceEventKey, 1024) ||
      !['success', 'failed', 'canceled'].includes(common.terminalStatus as string) ||
      typeof common.effectKey !== 'string' ||
      !/^wte:v1:[a-f0-9]{64}$/.test(common.effectKey) ||
      typeof common.payloadHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(common.payloadHash) ||
      typeof common.recoveryEnvelopeHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(common.recoveryEnvelopeHash) ||
      typeof common.retainedRecordHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(common.retainedRecordHash) ||
      (resourceId !== undefined && !validIdentity(resourceId, 512)) ||
      common.createdAt > now ||
      (common.kind === 'parent-workflow-step-end' && !parentFields.every(value => validIdentity(value, 512))) ||
      (common.kind === 'parent-workflow-step-end' &&
        (!Array.isArray(parentExecutionPath) ||
          parentExecutionPath.length === 0 ||
          parentExecutionPath.length > MAX_WORKFLOW_TERMINAL_PARENT_EXECUTION_PATH_LENGTH ||
          !parentExecutionPath.every(value => Number.isSafeInteger(value) && value >= 0))) ||
      (common.kind === 'workflow-finish' &&
        (!parentFields.every(value => value === null || value === undefined) ||
          (parentExecutionPath !== null && parentExecutionPath !== undefined)))
    ) {
      throw new TypeError('Invalid workflow terminal effect record');
    }
    const effect =
      common.kind === 'parent-workflow-step-end'
        ? ({
            ...common,
            version: 1,
            kind: common.kind,
            terminalStatus: common.terminalStatus,
            parentWorkflowName: row.parent_workflow_name,
            parentRunId: row.parent_run_id,
            parentStepId: row.parent_step_id,
            parentExecutionPath: [...(parentExecutionPath as number[])],
          } as WorkflowTerminalEffectRecord)
        : ({
            ...common,
            version: 1,
            kind: common.kind,
            terminalStatus: common.terminalStatus,
          } as WorkflowTerminalEffectRecord);
    validateWorkflowTerminalEffectIntegrity(effect);
    return effect;
  }

  private async getTerminalizationContext(
    t: TxClient,
    workflowName: string,
    runId: string,
  ): Promise<{ record?: WorkflowTerminalizationRecord; snapshotExists: boolean; now: number }> {
    await t.none(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [JSON.stringify([workflowName, runId])]);
    const row = await t.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${this.terminalizationTableName()}
       WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
      [workflowName, runId],
    );
    const snapshot = await t.oneOrNone<{ exists: boolean }>(
      `SELECT TRUE AS exists FROM ${this.workflowSnapshotTableName()}
       WHERE workflow_name = $1 AND run_id = $2`,
      [workflowName, runId],
    );
    const time = await t.one<{ now_ms: string }>(
      `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
    );
    const now = Number(time.now_ms);
    if (!Number.isSafeInteger(now)) throw new TypeError('Invalid PostgreSQL terminalization clock');
    return {
      record: row ? this.decodeTerminalizationRow(row, now) : undefined,
      snapshotExists: Boolean(snapshot),
      now,
    };
  }

  private async getTerminalizationObservation(
    workflowName: string,
    runId: string,
  ): Promise<GetWorkflowTerminalizationResult> {
    const row = await this.#db.client.one<Record<string, unknown>>(
      `SELECT terminalization.*,
              terminalization.run_id IS NOT NULL AS terminalization_exists,
              snapshot.run_id IS NOT NULL AS snapshot_exists,
              floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS observation_now_ms
       FROM (SELECT $1::text AS workflow_name, $2::text AS run_id) AS identity
       LEFT JOIN ${this.terminalizationTableName()} AS terminalization
         ON terminalization.workflow_name = identity.workflow_name AND terminalization.run_id = identity.run_id
       LEFT JOIN ${this.workflowSnapshotTableName()} AS snapshot
         ON snapshot.workflow_name = identity.workflow_name AND snapshot.run_id = identity.run_id`,
      [workflowName, runId],
    );
    if (row.terminalization_exists) {
      const now = Number(row.observation_now_ms);
      if (!Number.isSafeInteger(now)) throw new TypeError('Invalid PostgreSQL terminalization clock');
      return {
        status: 'found',
        record: observeWorkflowTerminalizationRecord(this.decodeTerminalizationRow(row, now)),
      };
    }
    return row.snapshot_exists ? { status: 'missing_record' } : { status: 'missing_run' };
  }

  private async saveTerminalizationRecord(
    t: TxClient,
    workflowName: string,
    runId: string,
    record: WorkflowTerminalizationRecord,
  ): Promise<void> {
    await t.none(
      `INSERT INTO ${this.terminalizationTableName()}
       (workflow_name, run_id, version, event_key, terminal_status, phase, owner_id, claim_token,
        claim_generation, lease_expires_at, created_at, updated_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (workflow_name, run_id) DO UPDATE SET
         version = EXCLUDED.version,
         event_key = EXCLUDED.event_key,
         terminal_status = EXCLUDED.terminal_status,
         phase = EXCLUDED.phase,
         owner_id = EXCLUDED.owner_id,
         claim_token = EXCLUDED.claim_token,
         claim_generation = EXCLUDED.claim_generation,
         lease_expires_at = EXCLUDED.lease_expires_at,
         updated_at = EXCLUDED.updated_at,
         completed_at = EXCLUDED.completed_at`,
      [
        workflowName,
        runId,
        record.version,
        record.eventKey,
        record.terminalStatus,
        record.phase,
        record.ownerId ?? null,
        record.claimToken ?? null,
        record.claimGeneration,
        record.leaseExpiresAt ?? null,
        record.createdAt,
        record.updatedAt,
        record.completedAt ?? null,
      ],
    );
  }

  private async getTerminalEffectRecord(
    t: TxClient,
    workflowName: string,
    runId: string,
    kind: string,
    now: number,
  ): Promise<WorkflowTerminalEffectRecord | undefined> {
    const row = await t.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${this.terminalEffectTableName()}
       WHERE workflow_name = $1 AND run_id = $2 AND effect_kind = $3
       FOR UPDATE`,
      [workflowName, runId, kind],
    );
    return row ? this.decodeTerminalEffectRow(row, now) : undefined;
  }

  private async insertTerminalEffectRecord(t: TxClient, effect: WorkflowTerminalEffectRecord): Promise<void> {
    await t.none(
      `INSERT INTO ${this.terminalEffectTableName()}
       (workflow_name, run_id, effect_kind, version, effect_key, source_event_key, terminal_status,
       parent_workflow_name, parent_run_id, parent_step_id, parent_execution_path, recovery_envelope_hash,
        retained_record_hash, resource_id, payload_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        effect.workflowName,
        effect.runId,
        effect.kind,
        effect.version,
        effect.effectKey,
        effect.sourceEventKey,
        effect.terminalStatus,
        effect.kind === 'parent-workflow-step-end' ? effect.parentWorkflowName : null,
        effect.kind === 'parent-workflow-step-end' ? effect.parentRunId : null,
        effect.kind === 'parent-workflow-step-end' ? effect.parentStepId : null,
        effect.kind === 'parent-workflow-step-end' ? JSON.stringify(effect.parentExecutionPath) : null,
        effect.recoveryEnvelopeHash,
        effect.retainedRecordHash,
        effect.resourceId ?? null,
        effect.payloadHash,
        effect.createdAt,
      ],
    );
  }

  private decodeTerminalSnapshotRow(row: Record<string, unknown>, now: number): WorkflowTerminalSnapshotRecord {
    const version = typeof row.version === 'string' ? Number(row.version) : row.version;
    const createdAt = typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at;
    const resourceId = row.resource_id === null || row.resource_id === undefined ? undefined : row.resource_id;
    const recordHash = row.record_hash;
    let envelope = row.envelope;
    if (typeof envelope === 'string') envelope = JSON.parse(envelope);
    if (
      version !== 1 ||
      typeof row.workflow_name !== 'string' ||
      row.workflow_name.length === 0 ||
      row.workflow_name.length > 512 ||
      typeof row.run_id !== 'string' ||
      row.run_id.length === 0 ||
      row.run_id.length > 512 ||
      (resourceId !== undefined && typeof resourceId !== 'string') ||
      !['success', 'failed', 'canceled'].includes(row.terminal_status as string) ||
      typeof createdAt !== 'number' ||
      !Number.isSafeInteger(createdAt) ||
      createdAt < 0 ||
      createdAt > now ||
      typeof row.envelope_hash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(row.envelope_hash) ||
      typeof recordHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(recordHash) ||
      !envelope ||
      typeof envelope !== 'object' ||
      Array.isArray(envelope)
    ) {
      throw new TypeError('Invalid workflow terminal snapshot record');
    }
    const retained = {
      version: 1,
      workflowName: row.workflow_name,
      runId: row.run_id,
      ...(resourceId === undefined ? {} : { resourceId }),
      terminalStatus: row.terminal_status as WorkflowTerminalSnapshotRecord['terminalStatus'],
      envelopeHash: row.envelope_hash,
      recordHash,
      envelope,
      createdAt,
    } as WorkflowTerminalSnapshotRecord;
    validateWorkflowTerminalRecoveryEnvelopeIntegrity(
      { version: 1, envelopeHash: retained.envelopeHash, envelope: retained.envelope },
      {
        workflowName: retained.workflowName,
        runId: retained.runId,
        terminalStatus: retained.terminalStatus,
      },
    );
    validateWorkflowTerminalSnapshotRecordIntegrity(retained);
    return retained;
  }

  private decodeTerminalRecoveryAncestryRow(
    row: Record<string, unknown>,
    now: number,
  ): WorkflowTerminalRecoveryAncestryRecord {
    const version = typeof row.version === 'string' ? Number(row.version) : row.version;
    const createdAt = typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at;
    let ancestry = row.ancestry;
    if (typeof ancestry === 'string') ancestry = JSON.parse(ancestry);
    const record = {
      version,
      workflowName: row.workflow_name,
      runId: row.run_id,
      ancestryHash: row.ancestry_hash,
      ancestry,
      createdAt,
    } as WorkflowTerminalRecoveryAncestryRecord;
    if (version !== 1 || typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt > now) {
      throw new TypeError('Invalid workflow terminal recovery ancestry record');
    }
    validateWorkflowTerminalRecoveryAncestryRecord(record, {
      workflowName: String(row.workflow_name),
      runId: String(row.run_id),
      now,
    });
    const immediate = record.ancestry[0];
    if (
      row.immediate_parent_workflow_name !== (immediate?.parentWorkflowName ?? null) ||
      row.immediate_parent_run_id !== (immediate?.parentRunId ?? null)
    ) {
      throw new TypeError('Invalid workflow terminal recovery ancestry parent binding');
    }
    return record;
  }

  private async getTerminalSnapshotRecord(
    t: TxClient,
    workflowName: string,
    runId: string,
    now: number,
  ): Promise<WorkflowTerminalSnapshotRecord | undefined> {
    const row = await t.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${this.terminalSnapshotTableName()}
       WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
      [workflowName, runId],
    );
    if (!row) return undefined;
    try {
      return this.decodeTerminalSnapshotRow(row, now);
    } catch {
      throw new CorruptWorkflowTerminalSnapshotRecordError();
    }
  }

  private decodeTerminalDestinationReceiptRow(
    row: Record<string, unknown>,
    effect: WorkflowTerminalEffectRecord,
    now: number,
  ): WorkflowTerminalDestinationReceiptRecord {
    const integer = (value: unknown, field: string, optional = false): number | undefined => {
      if (optional && (value === null || value === undefined)) return undefined;
      const parsed = typeof value === 'string' ? Number(value) : value;
      if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0 || parsed > now) {
        throw new TypeError(`Invalid workflow terminal destination receipt ${field}`);
      }
      return parsed;
    };
    const appliedAt = integer(row.applied_at, 'applied_at', true);
    const dispatchPendingAt = integer(row.dispatch_pending_at, 'dispatch_pending_at', true);
    const destinationAppliedAt = integer(row.destination_applied_at, 'destination_applied_at', true);
    const quarantinedAt = integer(row.quarantined_at, 'quarantined_at', true);
    const record = {
      version: integer(row.version, 'version'),
      receiptKey: row.receipt_key,
      workflowName: row.workflow_name,
      runId: row.run_id,
      effectKey: row.effect_key,
      consumerId: row.consumer_id,
      effectKind: row.effect_kind,
      producerPayloadHash: row.producer_payload_hash,
      destinationHash: row.destination_hash,
      applicationState: row.application_state,
      dispatchState: row.dispatch_state,
      createdAt: integer(row.created_at, 'created_at'),
      updatedAt: integer(row.updated_at, 'updated_at'),
      ...(appliedAt === undefined ? {} : { appliedAt }),
      ...(dispatchPendingAt === undefined ? {} : { dispatchPendingAt }),
      ...(destinationAppliedAt === undefined ? {} : { destinationAppliedAt }),
      ...(quarantinedAt === undefined ? {} : { quarantinedAt }),
    } as WorkflowTerminalDestinationReceiptRecord;
    if (
      record.version !== 1 ||
      typeof record.receiptKey !== 'string' ||
      !/^wtr:v1:[a-f0-9]{64}$/.test(record.receiptKey) ||
      typeof record.consumerId !== 'string' ||
      typeof record.destinationHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(record.destinationHash)
    ) {
      throw new TypeError('Invalid workflow terminal destination receipt record');
    }
    validateWorkflowTerminalizationIdentity(record.consumerId, 'consumerId', 256);
    validateWorkflowTerminalDestinationReceiptIntegrity(record, effect, now);
    return record;
  }

  private async getTerminalDestinationReceiptRecord(
    t: TxClient,
    effect: WorkflowTerminalEffectRecord,
    consumerId: string,
    now: number,
  ): Promise<WorkflowTerminalDestinationReceiptRecord | undefined> {
    const expectedReceiptKey = createWorkflowTerminalDestinationReceiptRecord(effect, consumerId, now).receiptKey;
    const rows = await t.manyOrNone<Record<string, unknown>>(
      `SELECT * FROM ${this.terminalDestinationReceiptTableName()}
       WHERE receipt_key = $1
          OR (effect_key = $2 AND consumer_id = $3)
          OR (workflow_name = $4 AND run_id = $5 AND effect_kind = $6 AND consumer_id = $3)
       FOR UPDATE`,
      [expectedReceiptKey, effect.effectKey, consumerId, effect.workflowName, effect.runId, effect.kind],
    );
    if (rows.length > 1) {
      throw new TypeError('Conflicting workflow terminal destination receipt storage');
    }
    return rows[0] ? this.decodeTerminalDestinationReceiptRow(rows[0], effect, now) : undefined;
  }

  private async insertTerminalDestinationReceiptRecord(
    t: TxClient,
    receipt: WorkflowTerminalDestinationReceiptRecord,
  ): Promise<void> {
    await t.none(
      `INSERT INTO ${this.terminalDestinationReceiptTableName()}
       (version, workflow_name, run_id, effect_key, consumer_id, receipt_key, effect_kind,
        producer_payload_hash, destination_hash, application_state, dispatch_state, created_at, updated_at,
        applied_at, dispatch_pending_at, destination_applied_at, quarantined_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        receipt.version,
        receipt.workflowName,
        receipt.runId,
        receipt.effectKey,
        receipt.consumerId,
        receipt.receiptKey,
        receipt.effectKind,
        receipt.producerPayloadHash,
        receipt.destinationHash,
        receipt.applicationState,
        receipt.dispatchState,
        receipt.createdAt,
        receipt.updatedAt,
        receipt.appliedAt ?? null,
        receipt.dispatchPendingAt ?? null,
        receipt.destinationAppliedAt ?? null,
        receipt.quarantinedAt ?? null,
      ],
    );
  }

  private async countTerminalDestinationReceiptRecords(
    t: TxClient,
    effect: WorkflowTerminalEffectRecord,
  ): Promise<number> {
    const row = await t.one<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM ${this.terminalDestinationReceiptTableName()}
       WHERE effect_key = $1
          OR (workflow_name = $2 AND run_id = $3 AND effect_kind = $4)`,
      [effect.effectKey, effect.workflowName, effect.runId, effect.kind],
    );
    const count = Number(row.count);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new TypeError('Invalid workflow terminal destination receipt count');
    }
    return count;
  }

  private decodeTerminalContinuationPlanRow(
    row: Record<string, unknown>,
    effect: WorkflowTerminalEffectRecord,
    receipt: WorkflowTerminalDestinationReceiptRecord,
    now: number,
  ): WorkflowTerminalContinuationPlanRecord {
    const createdAt = typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at;
    if (row.version !== 1 && row.version !== '1') {
      throw new TypeError('Invalid workflow terminal continuation plan version');
    }
    if (typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt < 0 || createdAt > now) {
      throw new TypeError('Invalid workflow terminal continuation plan created_at');
    }
    const contract = typeof row.contract === 'string' ? JSON.parse(row.contract) : row.contract;
    const frameworkActionKey =
      row.framework_action_key === null || row.framework_action_key === undefined
        ? undefined
        : row.framework_action_key;
    const record = {
      version: 1 as const,
      planKey: row.plan_key,
      planHash: row.plan_hash,
      receiptKey: row.receipt_key,
      effectKey: row.effect_key,
      consumerId: row.consumer_id,
      workflowName: row.workflow_name,
      runId: row.run_id,
      parentWorkflowName: row.parent_workflow_name,
      parentRunId: row.parent_run_id,
      parentRevision: row.parent_revision,
      contract,
      ...(frameworkActionKey === undefined ? {} : { frameworkActionKey }),
      createdAt,
    } as WorkflowTerminalContinuationPlanRecord;
    if (
      typeof record.planKey !== 'string' ||
      !/^wtp:v1:[a-f0-9]{64}$/.test(record.planKey) ||
      typeof record.planHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(record.planHash) ||
      typeof record.parentRevision !== 'string' ||
      typeof record.contract !== 'object' ||
      record.contract === null ||
      typeof row.contract_hash !== 'string' ||
      row.contract_hash !== record.contract.contractHash ||
      (frameworkActionKey !== undefined &&
        (typeof frameworkActionKey !== 'string' || !/^wta:v1:[a-f0-9]{64}$/.test(frameworkActionKey)))
    ) {
      throw new TypeError('Invalid workflow terminal continuation plan record');
    }
    validateWorkflowTerminalContinuationPlanIntegrity(record, effect, receipt, now);
    return record;
  }

  private async getTerminalContinuationPlanRecord(
    t: TxClient,
    effect: Extract<WorkflowTerminalEffectRecord, { kind: 'parent-workflow-step-end' }>,
    receipt: WorkflowTerminalDestinationReceiptRecord,
    now: number,
  ): Promise<WorkflowTerminalContinuationPlanRecord | undefined> {
    const rows = await t.manyOrNone<Record<string, unknown>>(
      `SELECT * FROM ${this.terminalContinuationPlanTableName()}
       WHERE receipt_key = $1
          OR (effect_key = $2 AND consumer_id = $5)
          OR (workflow_name = $3 AND run_id = $4 AND consumer_id = $5)
       FOR UPDATE`,
      [
        receipt.receiptKey,
        effect.effectKey,
        effect.workflowName,
        effect.runId,
        WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID,
      ],
    );
    if (rows.length > 1) {
      throw new TypeError('Conflicting workflow terminal continuation plan storage');
    }
    return rows[0] ? this.decodeTerminalContinuationPlanRow(rows[0], effect, receipt, now) : undefined;
  }

  private async insertTerminalContinuationPlanRecord(
    t: TxClient,
    plan: WorkflowTerminalContinuationPlanRecord,
  ): Promise<void> {
    await t.none(
      `INSERT INTO ${this.terminalContinuationPlanTableName()}
       (version, plan_key, plan_hash, receipt_key, effect_key, consumer_id, workflow_name, run_id,
        parent_workflow_name, parent_run_id, parent_revision, contract_hash, contract,
        framework_action_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        plan.version,
        plan.planKey,
        plan.planHash,
        plan.receiptKey,
        plan.effectKey,
        plan.consumerId,
        plan.workflowName,
        plan.runId,
        plan.parentWorkflowName,
        plan.parentRunId,
        plan.parentRevision,
        plan.contract.contractHash,
        sanitizeJsonForPg(JSON.stringify(plan.contract)),
        plan.frameworkActionKey ?? null,
        plan.createdAt,
      ],
    );
  }

  private async saveTerminalDestinationReceiptRecord(
    t: TxClient,
    receipt: WorkflowTerminalDestinationReceiptRecord,
    existing: boolean,
  ): Promise<void> {
    if (existing) {
      await t.none(
        `UPDATE ${this.terminalDestinationReceiptTableName()} SET
           application_state = $1,
           dispatch_state = $2,
           updated_at = $3,
           applied_at = $4,
           dispatch_pending_at = $5,
           destination_applied_at = $6,
           quarantined_at = $7
         WHERE receipt_key = $8`,
        [
          receipt.applicationState,
          receipt.dispatchState,
          receipt.updatedAt,
          receipt.appliedAt ?? null,
          receipt.dispatchPendingAt ?? null,
          receipt.destinationAppliedAt ?? null,
          receipt.quarantinedAt ?? null,
          receipt.receiptKey,
        ],
      );
      return;
    }
    await t.none(
      `INSERT INTO ${this.terminalDestinationReceiptTableName()}
       (version, workflow_name, run_id, effect_key, consumer_id, receipt_key, effect_kind,
        producer_payload_hash, destination_hash, application_state, dispatch_state, created_at, updated_at,
        applied_at, dispatch_pending_at, destination_applied_at, quarantined_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        receipt.version,
        receipt.workflowName,
        receipt.runId,
        receipt.effectKey,
        receipt.consumerId,
        receipt.receiptKey,
        receipt.effectKind,
        receipt.producerPayloadHash,
        receipt.destinationHash,
        receipt.applicationState,
        receipt.dispatchState,
        receipt.createdAt,
        receipt.updatedAt,
        receipt.appliedAt ?? null,
        receipt.dispatchPendingAt ?? null,
        receipt.destinationAppliedAt ?? null,
        receipt.quarantinedAt ?? null,
      ],
    );
  }

  private async saveTerminalWorkflowSnapshot(
    t: TxClient,
    input: PersistWorkflowTerminalStateInput,
    snapshot: WorkflowRunState,
    recovery: { envelopeHash: string; envelope: unknown },
    now: number,
    parentRevision: number,
  ): Promise<void> {
    const timestamp = new Date(now);
    const sanitizedSnapshot = sanitizeJsonForPg(JSON.stringify(snapshot));
    const serializedEnvelope = JSON.stringify(recovery.envelope);
    const retainedRecordHash = getWorkflowTerminalSnapshotRecordHash({
      version: 1,
      workflowName: input.workflowName,
      runId: input.runId,
      ...(input.resourceId === undefined ? {} : { resourceId: input.resourceId }),
      terminalStatus: snapshot.status as WorkflowTerminalSnapshotRecord['terminalStatus'],
      envelopeHash: recovery.envelopeHash as `sha256:${string}`,
      createdAt: now,
    });
    await this.assertWorkflowSnapshotHandoffAvailable(t, input.workflowName, input.runId);
    const update = await t.query(
      `UPDATE ${this.workflowSnapshotTableName()}
       SET "resourceId" = $3, snapshot = $4, "updatedAt" = $5, "updatedAtZ" = $6
       WHERE workflow_name = $1 AND run_id = $2`,
      [input.workflowName, input.runId, input.resourceId, sanitizedSnapshot, timestamp, timestamp],
    );
    if ((update.rowCount ?? 0) !== 1) {
      throw new TypeError('Workflow terminal snapshot disappeared under lock');
    }
    await t.none(
      `INSERT INTO ${this.terminalSnapshotTableName()}
       (workflow_name, run_id, version, resource_id, terminal_status, envelope_hash, record_hash, envelope, created_at)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)`,
      [
        input.workflowName,
        input.runId,
        input.resourceId,
        snapshot.status,
        recovery.envelopeHash,
        retainedRecordHash,
        serializedEnvelope,
        now,
      ],
    );
    await this.bumpWorkflowParentRevision(t, input.workflowName, input.runId, parentRevision);
  }

  private terminalizationError(operation: string, workflowName: string, runId: string, error: unknown): never {
    if (error instanceof TypeError || error instanceof RangeError) throw error;
    throw new MastraError(
      {
        id: createStorageErrorId('PG', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { workflowName, runId },
      },
      error,
    );
  }

  async persistWorkflowTerminalRecoveryAncestry(
    input: PersistWorkflowTerminalRecoveryAncestryInput,
  ): Promise<PersistWorkflowTerminalRecoveryAncestryResult> {
    const requested = createWorkflowTerminalRecoveryAncestryRecord(input.workflowName, input.runId, input.ancestry, 0);
    const operation = {
      workflowName: requested.workflowName,
      runId: requested.runId,
      ancestry: requested.ancestry,
    };
    try {
      return await this.#db.client.tx(async t => {
        const lockedIdentities = new Set([
          JSON.stringify([operation.workflowName, operation.runId]),
          ...operation.ancestry.map(frame => JSON.stringify([frame.parentWorkflowName, frame.parentRunId])),
        ]);
        for (const identity of [...lockedIdentities].sort()) {
          await t.none(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [identity]);
        }
        const clock = await t.one<{ now_ms: string }>(
          `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
        );
        const now = Number(clock.now_ms);
        if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Invalid PostgreSQL recovery ancestry clock');
        const row = await t.oneOrNone<Record<string, unknown>>(
          `SELECT * FROM ${this.terminalRecoveryAncestryTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.workflowName, operation.runId],
        );
        const desired = createWorkflowTerminalRecoveryAncestryRecord(
          operation.workflowName,
          operation.runId,
          operation.ancestry,
          now,
        );
        if (row) {
          const existing = this.decodeTerminalRecoveryAncestryRow(row, now);
          return sameWorkflowTerminalRecoveryAncestry(existing, desired)
            ? { status: 'already_persisted', record: copyWorkflowTerminalRecoveryAncestryRecord(existing) }
            : { status: 'ancestry_conflict' };
        }
        for (const frame of desired.ancestry) {
          let parentRevision: WorkflowParentRevisionLock | undefined;
          try {
            parentRevision = await this.lockExistingWorkflowParentRevision(
              t,
              frame.parentWorkflowName,
              frame.parentRunId,
            );
          } catch (error) {
            if (error instanceof TypeError) {
              throw new TypeError('Workflow terminal recovery ancestry parent evidence is unavailable');
            }
            throw error;
          }
          if (!parentRevision || parentRevision.terminalStatus !== null) {
            throw new TypeError('Workflow terminal recovery ancestry parent evidence is unavailable');
          }
          const parentEvidence = await t.oneOrNone<{ snapshot: unknown }>(
            `SELECT snapshot FROM ${this.workflowSnapshotTableName()}
             WHERE workflow_name = $1 AND run_id = $2`,
            [frame.parentWorkflowName, frame.parentRunId],
          );
          let parentSnapshot = parentEvidence?.snapshot;
          if (typeof parentSnapshot === 'string') parentSnapshot = JSON.parse(parentSnapshot);
          const parentStatus =
            parentSnapshot && typeof parentSnapshot === 'object' && !Array.isArray(parentSnapshot)
              ? (parentSnapshot as Record<string, unknown>).status
              : undefined;
          if (parentStatus === undefined || isTerminalWorkflowRunStatus(parentStatus)) {
            throw new TypeError('Workflow terminal recovery ancestry parent evidence is unavailable');
          }
          if (!parentSnapshot || typeof parentSnapshot !== 'object' || Array.isArray(parentSnapshot)) {
            throw new TypeError('Workflow terminal recovery ancestry parent graph is unavailable');
          }
          validateWorkflowTerminalRecoveryParentFrameGraphBinding(
            frame,
            (parentSnapshot as WorkflowRunState).serializedStepGraph,
          );
        }
        const immediate = desired.ancestry[0];
        if (immediate) {
          const parentRecoveryRow = await t.oneOrNone<Record<string, unknown>>(
            `SELECT * FROM ${this.terminalRecoveryAncestryTableName()}
             WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
            [immediate.parentWorkflowName, immediate.parentRunId],
          );
          const parentRecovery = parentRecoveryRow
            ? this.decodeTerminalRecoveryAncestryRow(parentRecoveryRow, now)
            : undefined;
          const expectedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
            immediate.parentWorkflowName,
            immediate.parentRunId,
            desired.ancestry.slice(1),
            now,
          ).ancestryHash;
          const retainedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
            immediate.parentWorkflowName,
            immediate.parentRunId,
            parentRecovery?.ancestry ?? [],
            now,
          ).ancestryHash;
          if (expectedTailHash !== retainedTailHash) return { status: 'ancestry_conflict' };
        }
        await t.none(
          `INSERT INTO ${this.terminalRecoveryAncestryTableName()}
           (workflow_name, run_id, version, ancestry_hash, ancestry,
            immediate_parent_workflow_name, immediate_parent_run_id, created_at)
           VALUES ($1, $2, 1, $3, $4, $5, $6, $7)`,
          [
            operation.workflowName,
            operation.runId,
            desired.ancestryHash,
            JSON.stringify(desired.ancestry),
            desired.ancestry[0]?.parentWorkflowName ?? null,
            desired.ancestry[0]?.parentRunId ?? null,
            desired.createdAt,
          ],
        );
        return { status: 'persisted', record: copyWorkflowTerminalRecoveryAncestryRecord(desired) };
      });
    } catch (error) {
      return this.terminalizationError(
        'PERSIST_WORKFLOW_TERMINAL_RECOVERY_ANCESTRY',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async getWorkflowTerminalRecoveryAncestry(
    input: GetWorkflowTerminalizationInput,
  ): Promise<GetWorkflowTerminalRecoveryAncestryResult> {
    try {
      return await this.#db.client.tx(async t => {
        const clock = await t.one<{ now_ms: string }>(
          `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
        );
        const now = Number(clock.now_ms);
        if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Invalid PostgreSQL recovery ancestry clock');
        const row = await t.oneOrNone<Record<string, unknown>>(
          `SELECT * FROM ${this.terminalRecoveryAncestryTableName()}
           WHERE workflow_name = $1 AND run_id = $2`,
          [input.workflowName, input.runId],
        );
        return row
          ? { status: 'found', record: this.decodeTerminalRecoveryAncestryRow(row, now) }
          : { status: 'missing_ancestry' };
      });
    } catch (error) {
      return this.terminalizationError(
        'GET_WORKFLOW_TERMINAL_RECOVERY_ANCESTRY',
        input.workflowName,
        input.runId,
        error,
      );
    }
  }

  async claimWorkflowTerminalization(
    input: ClaimWorkflowTerminalizationInput,
  ): Promise<ClaimWorkflowTerminalizationResult> {
    const operation: ClaimWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      eventKey: input.eventKey,
      terminalStatus: input.terminalStatus,
      ownerId: input.ownerId,
      leaseMs: input.leaseMs,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
    };
    validateWorkflowTerminalizationClaim(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const result = claimWorkflowTerminalizationRecord(context.record, operation, context.now, randomUUID());
        if (result.status === 'acquired' || result.status === 'renewed') {
          const revisionLock = await this.lockExistingWorkflowParentRevision(
            t,
            operation.workflowName,
            operation.runId,
          );
          if (!revisionLock) {
            throw new TypeError('Workflow terminalization is missing parent revision evidence');
          }
          if (!context.record) {
            const snapshot = await t.oneOrNone<{ exists: boolean }>(
              `SELECT TRUE AS exists FROM ${this.workflowSnapshotTableName()}
               WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
              [operation.workflowName, operation.runId],
            );
            if (!snapshot) {
              return { status: 'missing_run' };
            }
          }
          await this.latchWorkflowParentTerminalStatus(
            t,
            operation.workflowName,
            operation.runId,
            result.record.terminalStatus,
          );
          await this.saveTerminalizationRecord(t, operation.workflowName, operation.runId, result.record);
          return result;
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'CLAIM_WORKFLOW_TERMINALIZATION',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async getWorkflowTerminalization(input: GetWorkflowTerminalizationInput): Promise<GetWorkflowTerminalizationResult> {
    const operation: GetWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
    };
    try {
      return await this.getTerminalizationObservation(operation.workflowName, operation.runId);
    } catch (error) {
      return this.terminalizationError('GET_WORKFLOW_TERMINALIZATION', operation.workflowName, operation.runId, error);
    }
  }

  async getWorkflowRunTerminalStatus(
    input: GetWorkflowRunTerminalStatusInput,
  ): Promise<GetWorkflowRunTerminalStatusResult> {
    const operation = captureWorkflowRunIdentity(input);
    try {
      const snapshotColumnType = await this.resolveWorkflowSnapshotColumnType(this.#db.client);
      const snapshotStatus = this.workflowSnapshotStatusExpression(snapshotColumnType, 'snapshot.snapshot');
      const row = await this.#db.client.one<{
        revision_exists: boolean;
        generation: number | string | null;
        terminal_status: string | null;
        journal_exists: boolean;
        journal_terminal_status: string | null;
        snapshot_exists: boolean;
        snapshot_status: string | null;
      }>(
        `SELECT revision.run_id IS NOT NULL AS revision_exists,
                revision.generation,
                revision.terminal_status,
                journal.run_id IS NOT NULL AS journal_exists,
                journal.terminal_status AS journal_terminal_status,
                snapshot.run_id IS NOT NULL AS snapshot_exists,
                ${snapshotStatus} AS snapshot_status
         FROM (SELECT $1::text AS workflow_name, $2::text AS run_id) AS identity
         LEFT JOIN ${this.workflowParentRevisionTableName()} AS revision
           ON revision.workflow_name = identity.workflow_name AND revision.run_id = identity.run_id
         LEFT JOIN ${this.workflowSnapshotTableName()} AS snapshot
           ON snapshot.workflow_name = identity.workflow_name AND snapshot.run_id = identity.run_id
         LEFT JOIN ${this.terminalizationTableName()} AS journal
           ON journal.workflow_name = identity.workflow_name AND journal.run_id = identity.run_id`,
        [operation.workflowName, operation.runId],
      );
      if (!row.revision_exists) {
        if (row.snapshot_exists || row.journal_exists) {
          throw new TypeError('Workflow run is missing parent revision evidence');
        }
        return { status: 'missing_run' };
      }
      const generation = typeof row.generation === 'string' ? Number(row.generation) : row.generation;
      if (!Number.isSafeInteger(generation) || generation === null || generation < 1) {
        throw new TypeError('Invalid workflow parent revision generation');
      }
      const snapshotIsTerminal = isTerminalWorkflowRunStatus(row.snapshot_status);
      const snapshotIsNonterminal = ['running', 'suspended', 'waiting', 'pending', 'paused'].includes(
        row.snapshot_status ?? '',
      );
      if (row.snapshot_exists && !snapshotIsTerminal && !snapshotIsNonterminal) {
        throw new TypeError('Invalid workflow run status');
      }
      if (row.journal_exists) {
        if (!isWorkflowTerminalizationStatus(row.journal_terminal_status)) {
          throw new TypeError('Invalid workflow terminalization status');
        }
        if (row.terminal_status !== row.journal_terminal_status) {
          throw new TypeError('Workflow parent revision conflicts with terminalization status');
        }
        if (snapshotIsTerminal && row.snapshot_status !== row.journal_terminal_status) {
          throw new TypeError('Workflow terminalization conflicts with terminal snapshot status');
        }
      }
      if (row.terminal_status !== null) {
        if (!isTerminalWorkflowRunStatus(row.terminal_status)) {
          throw new TypeError('Invalid workflow parent terminal status');
        }
        if (!row.journal_exists && row.snapshot_exists && !snapshotIsTerminal) {
          throw new TypeError('Workflow parent revision conflicts with nonterminal snapshot status');
        }
        if (snapshotIsTerminal && row.snapshot_status !== row.terminal_status) {
          throw new TypeError('Workflow parent revision conflicts with terminal snapshot status');
        }
        return { status: 'terminal', terminalStatus: row.terminal_status };
      }
      if (!row.snapshot_exists) return { status: 'missing_run' };
      if (snapshotIsTerminal) {
        throw new TypeError('Workflow terminal snapshot is missing terminal revision evidence');
      }
      return { status: 'nonterminal' };
    } catch (error) {
      return this.terminalizationError(
        'GET_WORKFLOW_RUN_TERMINAL_STATUS',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async advanceWorkflowTerminalization(
    input: AdvanceWorkflowTerminalizationInput,
  ): Promise<AdvanceWorkflowTerminalizationResult> {
    const operation: AdvanceWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      expectedPhase: input.expectedPhase,
      nextPhase: input.nextPhase,
      leaseMs: input.leaseMs,
    };
    validateWorkflowTerminalizationFence(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const result = advanceWorkflowTerminalizationRecord(context.record, operation, context.now);
        if (result.status === 'advanced') {
          await this.saveTerminalizationRecord(t, operation.workflowName, operation.runId, result.record);
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'ADVANCE_WORKFLOW_TERMINALIZATION',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async releaseWorkflowTerminalization(
    input: ReleaseWorkflowTerminalizationInput,
  ): Promise<ReleaseWorkflowTerminalizationResult> {
    const operation: ReleaseWorkflowTerminalizationInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
    };
    validateWorkflowTerminalizationFence(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const result = releaseWorkflowTerminalizationRecord(context.record, operation, context.now);
        if (result.status === 'released') {
          await this.saveTerminalizationRecord(t, operation.workflowName, operation.runId, result.record);
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'RELEASE_WORKFLOW_TERMINALIZATION',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async deleteCompletedWorkflowTerminalizations(
    input: DeleteCompletedWorkflowTerminalizationsInput,
  ): Promise<DeleteCompletedWorkflowTerminalizationsResult> {
    const operation: DeleteCompletedWorkflowTerminalizationsInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      olderThan: input.olderThan,
    };
    const olderThan = operation.olderThan.getTime();
    if (Number.isNaN(olderThan)) throw new TypeError('olderThan must be a valid Date');
    try {
      return await this.#db.client.tx(async t => {
        const identity = JSON.stringify([operation.workflowName, operation.runId]);
        await t.none(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [identity]);
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run', count: 0 };
        const eligible =
          context.record?.phase === 'complete' &&
          context.record.completedAt !== undefined &&
          context.record.completedAt < olderThan;
        if (!eligible) return { status: 'deleted', count: 0 };

        // Follow both pre-terminal ancestry and retained parent effects. The
        // ancestry edge exists before a child journal/effect and closes the
        // crash window where parent recovery evidence could otherwise be
        // deleted while a nested child is only partially admitted.
        const dependencyState = await t.one<{ pending: boolean }>(
          `WITH RECURSIVE descendants(workflow_name, run_id) AS (
             SELECT child.workflow_name, child.run_id
             FROM (
               SELECT effect.workflow_name, effect.run_id
               FROM ${this.terminalEffectTableName()} AS effect
               WHERE effect.effect_kind = 'parent-workflow-step-end'
                 AND effect.parent_workflow_name = $1 AND effect.parent_run_id = $2
               UNION
               SELECT ancestry.workflow_name, ancestry.run_id
               FROM ${this.terminalRecoveryAncestryTableName()} AS ancestry
               WHERE ancestry.immediate_parent_workflow_name = $1
                 AND ancestry.immediate_parent_run_id = $2
             ) AS child
             UNION
             SELECT child.workflow_name, child.run_id
             FROM descendants AS parent
             CROSS JOIN LATERAL (
               SELECT effect.workflow_name, effect.run_id
               FROM ${this.terminalEffectTableName()} AS effect
               WHERE effect.effect_kind = 'parent-workflow-step-end'
                 AND effect.parent_workflow_name = parent.workflow_name
                 AND effect.parent_run_id = parent.run_id
               UNION
               SELECT ancestry.workflow_name, ancestry.run_id
               FROM ${this.terminalRecoveryAncestryTableName()} AS ancestry
               WHERE ancestry.immediate_parent_workflow_name = parent.workflow_name
                 AND ancestry.immediate_parent_run_id = parent.run_id
             ) AS child
           )
           SELECT EXISTS (
             SELECT 1
             FROM descendants AS child
             LEFT JOIN ${this.terminalizationTableName()} AS journal
               ON journal.workflow_name = child.workflow_name AND journal.run_id = child.run_id
             WHERE journal.phase IS DISTINCT FROM 'complete'
           ) AS pending`,
          [operation.workflowName, operation.runId],
        );
        if (dependencyState.pending) return { status: 'deleted', count: 0 };

        const revision = await this.lockExistingWorkflowParentRevision(t, operation.workflowName, operation.runId);
        if (!revision) {
          throw new TypeError('Workflow terminalization is missing parent revision evidence');
        }
        await this.latchWorkflowParentTerminalStatus(
          t,
          operation.workflowName,
          operation.runId,
          context.record!.terminalStatus,
        );

        // Delete leaf evidence first and the journal last. The transaction
        // preserves all-or-nothing cleanup when any dependent delete fails.
        await t.none(
          `DELETE FROM ${this.terminalContinuationPlanTableName()}
           WHERE workflow_name = $1 AND run_id = $2`,
          [operation.workflowName, operation.runId],
        );
        await t.none(
          `DELETE FROM ${this.terminalDestinationReceiptTableName()}
           WHERE workflow_name = $1 AND run_id = $2`,
          [operation.workflowName, operation.runId],
        );
        await t.none(
          `DELETE FROM ${this.terminalEffectTableName()}
           WHERE workflow_name = $1 AND run_id = $2`,
          [operation.workflowName, operation.runId],
        );
        await t.none(
          `DELETE FROM ${this.terminalSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2`,
          [operation.workflowName, operation.runId],
        );
        await t.none(
          `DELETE FROM ${this.terminalRecoveryAncestryTableName()}
           WHERE workflow_name = $1 AND run_id = $2`,
          [operation.workflowName, operation.runId],
        );
        const result = await t.query(
          `DELETE FROM ${this.terminalizationTableName()}
           WHERE workflow_name = $1 AND run_id = $2 AND phase = 'complete'
             AND completed_at IS NOT NULL AND completed_at < $3`,
          [operation.workflowName, operation.runId, olderThan],
        );
        const count = result.rowCount ?? 0;
        if (count !== 1) {
          throw new TypeError('Workflow terminal cleanup eligibility changed under lock');
        }
        return { status: 'deleted', count };
      });
    } catch (error) {
      return this.terminalizationError(
        'DELETE_COMPLETED_WORKFLOW_TERMINALIZATIONS',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async persistWorkflowTerminalState(
    input: PersistWorkflowTerminalStateInput,
  ): Promise<PersistWorkflowTerminalStateResult> {
    // Capture only scalar identity/fence fields before locking. Caller-owned
    // snapshot and recovery values are read in deterministic order only after
    // the live journal fence and canonical rows authorize this operation.
    const operation = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      resourceId: input.resourceId,
      leaseMs: input.leaseMs,
    };
    validateWorkflowTerminalizationFence(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const authorization = authorizeWorkflowTerminalStateRecord(context.record, operation, context.now);
        if (authorization.status !== 'authorized') {
          return 'record' in authorization
            ? { status: authorization.status, record: observeWorkflowTerminalizationRecord(authorization.record) }
            : authorization;
        }
        const revisionLock = await this.lockExistingWorkflowParentRevision(t, operation.workflowName, operation.runId);
        if (!revisionLock) {
          throw new TypeError('Workflow terminal state is missing parent revision evidence');
        }
        const snapshotRow = await t.oneOrNone<{ resource_id: unknown }>(
          `SELECT "resourceId" AS resource_id FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.workflowName, operation.runId],
        );
        if (!snapshotRow) {
          return { status: 'missing_run' };
        }
        const ancestryRow = await t.oneOrNone<Record<string, unknown>>(
          `SELECT * FROM ${this.terminalRecoveryAncestryTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.workflowName, operation.runId],
        );
        const ancestry = ancestryRow ? this.decodeTerminalRecoveryAncestryRow(ancestryRow, context.now) : undefined;
        const snapshotCapture:
          | { status: 'captured'; value: PersistWorkflowTerminalStateInput['snapshot'] }
          | { status: 'invalid_snapshot' } = (() => {
          try {
            const serializedSnapshot = JSON.stringify(input.snapshot);
            if (serializedSnapshot === undefined) return { status: 'invalid_snapshot' };
            return { status: 'captured', value: JSON.parse(sanitizeJsonForPg(serializedSnapshot)) };
          } catch {
            return { status: 'invalid_snapshot' };
          }
        })();
        if (snapshotCapture.status === 'invalid_snapshot') {
          return snapshotCapture;
        }
        const recoveryCapture:
          | { status: 'captured'; value: WorkflowTerminalRecoveryEnvelopeV1 }
          | { status: 'invalid_recovery_envelope' } = (() => {
          try {
            return { status: 'captured', value: materializeWorkflowTerminalRecoveryEnvelope(input.recoveryEnvelope) };
          } catch {
            return { status: 'invalid_recovery_envelope' };
          }
        })();
        if (recoveryCapture.status === 'invalid_recovery_envelope') {
          return recoveryCapture;
        }
        const authorizedOperation: PersistWorkflowTerminalStateInput = {
          ...operation,
          snapshot: snapshotCapture.value,
          recoveryEnvelope: recoveryCapture.value,
        };
        const result = persistWorkflowTerminalStateRecord(
          context.record,
          ancestry,
          authorizedOperation,
          context.now,
          snapshot => snapshot,
          (_envelope): WorkflowTerminalRecoveryEnvelopeV1 => recoveryCapture.value,
        );
        if (result.status === 'advanced') {
          const currentResourceId =
            snapshotRow.resource_id === null || snapshotRow.resource_id === undefined
              ? undefined
              : snapshotRow.resource_id;
          const resourceId = operation.resourceId ?? currentResourceId;
          if (resourceId !== undefined) {
            validateWorkflowTerminalizationIdentity(resourceId as string, 'resourceId', 512);
          }
          await this.saveTerminalWorkflowSnapshot(
            t,
            { ...authorizedOperation, resourceId: resourceId as string | undefined },
            result.snapshot,
            result.recovery,
            context.now,
            revisionLock.generation,
          );
          await this.saveTerminalizationRecord(t, operation.workflowName, operation.runId, result.record);
          return { status: 'persisted', record: observeWorkflowTerminalizationRecord(result.record) };
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'PERSIST_WORKFLOW_TERMINAL_STATE',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async prepareWorkflowTerminalEffect(
    input: PrepareWorkflowTerminalEffectInput,
  ): Promise<PrepareWorkflowTerminalEffectResult> {
    const operation: PrepareWorkflowTerminalEffectInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      expectedPhase: input.expectedPhase,
      effect: materializeWorkflowTerminalEffectDescriptor(input.effect),
      leaseMs: input.leaseMs,
    };
    validateWorkflowTerminalizationFence(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const existingEffect = await this.getTerminalEffectRecord(
          t,
          operation.workflowName,
          operation.runId,
          operation.effect.kind,
          context.now,
        );
        if (existingEffect && context.record) {
          if (existingEffect.kind !== operation.effect.kind) {
            throw new TypeError('Invalid workflow terminal effect kind');
          }
          validateWorkflowTerminalEffectJournalLink(
            existingEffect,
            context.record,
            operation.workflowName,
            operation.runId,
          );
        }
        const retained = await this.getTerminalSnapshotRecord(t, operation.workflowName, operation.runId, context.now);
        const result = prepareWorkflowTerminalEffectRecord(
          context.record,
          existingEffect,
          retained,
          operation,
          context.now,
        );
        if (result.status === 'prepared' || result.status === 'already_prepared') {
          if (!retained) return { status: 'missing_terminal_state' };
          validateWorkflowTerminalSnapshotJournalLink(retained, result.record, operation.workflowName, operation.runId);
          validateWorkflowTerminalEffectRecoveryLink(result.effect, retained);
        }
        if (result.status === 'prepared') {
          await this.insertTerminalEffectRecord(t, result.effect);
          await this.saveTerminalizationRecord(t, operation.workflowName, operation.runId, result.record);
          return { status: result.status, effect: result.effect };
        }
        if (result.status === 'already_prepared') {
          if (operation.leaseMs !== undefined) {
            await this.saveTerminalizationRecord(t, operation.workflowName, operation.runId, result.record);
          }
          return { status: result.status, effect: result.effect };
        }
        if (result.status === 'effect_conflict') {
          return {
            status: result.status,
            effect: observeWorkflowTerminalEffectRecord(result.effect),
            record: observeWorkflowTerminalizationRecord(result.record),
          };
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'PREPARE_WORKFLOW_TERMINAL_EFFECT',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async getWorkflowTerminalEffectForDispatch(
    input: GetWorkflowTerminalEffectForDispatchInput,
  ): Promise<GetWorkflowTerminalEffectForDispatchResult> {
    const operation: GetWorkflowTerminalEffectForDispatchInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      kind: materializeWorkflowTerminalEffectKind(input.kind),
    };
    validateWorkflowTerminalizationFence(operation);
    validateWorkflowTerminalizationRunIdentity(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const existingEffect = await this.getTerminalEffectRecord(
          t,
          operation.workflowName,
          operation.runId,
          operation.kind,
          context.now,
        );
        if (existingEffect && context.record) {
          if (existingEffect.kind !== operation.kind) {
            throw new TypeError('Invalid workflow terminal effect kind');
          }
          validateWorkflowTerminalEffectJournalLink(
            existingEffect,
            context.record,
            operation.workflowName,
            operation.runId,
          );
        }
        const result = getWorkflowTerminalEffectForDispatchRecord(
          context.record,
          existingEffect,
          operation,
          context.now,
        );
        const retained =
          result.status === 'found'
            ? await this.getTerminalSnapshotRecord(t, operation.workflowName, operation.runId, context.now)
            : undefined;
        if (result.status === 'found' && !retained) return { status: 'missing_terminal_state' };
        if (result.status === 'found') {
          validateWorkflowTerminalSnapshotJournalLink(
            retained!,
            context.record!,
            operation.workflowName,
            operation.runId,
          );
          validateWorkflowTerminalEffectRecoveryLink(result.effect, retained!);
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result.status === 'found'
            ? { ...result, recovery: retained! }
            : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'GET_WORKFLOW_TERMINAL_EFFECT_FOR_DISPATCH',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async reserveWorkflowTerminalDestinationReceipt(
    input: ReserveWorkflowTerminalDestinationReceiptInput,
  ): Promise<ReserveWorkflowTerminalDestinationReceiptResult> {
    const operation: ReserveWorkflowTerminalDestinationReceiptInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      effectKind: materializeWorkflowTerminalEffectKind(input.effectKind),
      consumerId: input.consumerId,
    };
    validateWorkflowTerminalizationFence(operation);
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationIdentity(operation.consumerId, 'consumerId', 256);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const effect = await this.getTerminalEffectRecord(
          t,
          operation.workflowName,
          operation.runId,
          operation.effectKind,
          context.now,
        );
        if (effect && context.record) {
          validateWorkflowTerminalEffectJournalLink(effect, context.record, operation.workflowName, operation.runId);
        }
        const receipt = effect
          ? await this.getTerminalDestinationReceiptRecord(t, effect, operation.consumerId, context.now)
          : undefined;
        const receiptCount = effect ? await this.countTerminalDestinationReceiptRecords(t, effect) : 0;
        const result = reserveWorkflowTerminalDestinationReceiptRecord(
          context.record,
          effect,
          receipt,
          receiptCount,
          operation,
          context.now,
        );
        if (result.status === 'reserved' || result.status === 'already_exists') {
          const retained = await this.getTerminalSnapshotRecord(
            t,
            operation.workflowName,
            operation.runId,
            context.now,
          );
          if (!retained) return { status: 'missing_terminal_state' };
          validateWorkflowTerminalSnapshotJournalLink(
            retained,
            context.record!,
            operation.workflowName,
            operation.runId,
          );
          validateWorkflowTerminalEffectRecoveryLink(effect!, retained);
          if (result.status === 'reserved') {
            await this.insertTerminalDestinationReceiptRecord(t, result.receipt);
          }
          return { status: result.status, receipt: copyWorkflowTerminalDestinationReceiptRecord(result.receipt) };
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'RESERVE_WORKFLOW_TERMINAL_DESTINATION_RECEIPT',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async getWorkflowTerminalDestinationReceipt(
    input: GetWorkflowTerminalDestinationReceiptInput,
  ): Promise<GetWorkflowTerminalDestinationReceiptResult> {
    const operation: GetWorkflowTerminalDestinationReceiptInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      effectKind: materializeWorkflowTerminalEffectKind(input.effectKind),
      consumerId: input.consumerId,
    };
    validateWorkflowTerminalizationFence(operation);
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationIdentity(operation.consumerId, 'consumerId', 256);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const effect = await this.getTerminalEffectRecord(
          t,
          operation.workflowName,
          operation.runId,
          operation.effectKind,
          context.now,
        );
        if (effect && context.record) {
          validateWorkflowTerminalEffectJournalLink(effect, context.record, operation.workflowName, operation.runId);
        }
        const receipt = effect
          ? await this.getTerminalDestinationReceiptRecord(t, effect, operation.consumerId, context.now)
          : undefined;
        const result = getWorkflowTerminalDestinationReceiptRecord(
          context.record,
          effect,
          receipt,
          operation,
          context.now,
        );
        if (result.status === 'found') {
          const retained = await this.getTerminalSnapshotRecord(
            t,
            operation.workflowName,
            operation.runId,
            context.now,
          );
          if (!retained) return { status: 'missing_terminal_state' };
          validateWorkflowTerminalSnapshotJournalLink(
            retained,
            context.record!,
            operation.workflowName,
            operation.runId,
          );
          validateWorkflowTerminalEffectRecoveryLink(effect!, retained);
          return { status: 'found', receipt: copyWorkflowTerminalDestinationReceiptRecord(result.receipt) };
        }
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'GET_WORKFLOW_TERMINAL_DESTINATION_RECEIPT',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async getWorkflowTerminalParentContext(
    input: GetWorkflowTerminalParentContextInput,
  ): Promise<GetWorkflowTerminalParentContextResult> {
    const operation = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      kind: 'parent-workflow-step-end' as const,
    };
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationFence(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const effect = await this.getTerminalEffectRecord(
          t,
          operation.workflowName,
          operation.runId,
          operation.kind,
          context.now,
        );
        const result = getWorkflowTerminalEffectForDispatchRecord(context.record, effect, operation, context.now);
        if (result.status !== 'found') {
          return 'record' in result
            ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
            : result;
        }
        if (result.effect.kind !== 'parent-workflow-step-end') return { status: 'missing_effect' };
        if (context.record?.phase !== 'parent_outbox_pending') {
          return context.record
            ? { status: 'phase_conflict', record: observeWorkflowTerminalizationRecord(context.record) }
            : { status: 'missing_record' };
        }
        validateWorkflowTerminalEffectJournalLink(
          result.effect,
          context.record,
          operation.workflowName,
          operation.runId,
        );
        const retained = await this.getTerminalSnapshotRecord(t, operation.workflowName, operation.runId, context.now);
        if (!retained) return { status: 'missing_terminal_state' };
        validateWorkflowTerminalSnapshotJournalLink(retained, context.record, operation.workflowName, operation.runId);
        validateWorkflowTerminalEffectRecoveryLink(result.effect, retained);
        const parentWorkflowName = result.effect.parentWorkflowName;
        const parentRunId = result.effect.parentRunId;
        let revisionLock: WorkflowParentRevisionLock | undefined;
        try {
          revisionLock = await this.lockExistingWorkflowParentRevision(t, parentWorkflowName, parentRunId);
        } catch (error) {
          if (error instanceof TypeError) return { status: 'corrupt_parent_state' };
          throw error;
        }
        const row = await t.oneOrNone<{ snapshot: WorkflowRunState | string }>(
          `SELECT snapshot FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [parentWorkflowName, parentRunId],
        );
        if (!row) {
          return { status: 'missing_parent' };
        }
        if (!revisionLock) return { status: 'corrupt_parent_state' };
        let generation = revisionLock.generation;
        const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
        const snapshotTerminalStatus = isTerminalWorkflowRunStatus(snapshot.status) ? snapshot.status : undefined;
        if (revisionLock.terminalStatus && revisionLock.terminalStatus !== snapshotTerminalStatus) {
          return { status: 'parent_conflict' };
        }
        if (!revisionLock.terminalStatus && snapshotTerminalStatus) {
          generation = await this.latchWorkflowParentTerminalStatus(
            t,
            result.effect.parentWorkflowName,
            result.effect.parentRunId,
            snapshotTerminalStatus,
          );
        }
        return {
          status: 'found',
          effect: copyWorkflowTerminalEffectRecord(result.effect) as Extract<
            WorkflowTerminalEffectRecord,
            { kind: 'parent-workflow-step-end' }
          >,
          retainedChild: structuredClone(retained),
          parentWorkflowName: result.effect.parentWorkflowName,
          parentRunId: result.effect.parentRunId,
          revision: `pg:v1:${generation}`,
          snapshot: structuredClone(snapshot),
        };
      });
    } catch (error) {
      return this.terminalizationError(
        'GET_WORKFLOW_TERMINAL_PARENT_CONTEXT',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async getWorkflowTerminalContinuationPlan(
    input: GetWorkflowTerminalContinuationPlanInput,
  ): Promise<GetWorkflowTerminalContinuationPlanResult> {
    const operation: GetWorkflowTerminalContinuationPlanInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
    };
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationFence(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const effect = await this.getTerminalEffectRecord(
          t,
          operation.workflowName,
          operation.runId,
          'parent-workflow-step-end',
          context.now,
        );
        const receipt =
          effect?.kind === 'parent-workflow-step-end'
            ? await this.getTerminalDestinationReceiptRecord(
                t,
                effect,
                WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID,
                context.now,
              )
            : undefined;
        const plan =
          effect?.kind === 'parent-workflow-step-end' && receipt
            ? await this.getTerminalContinuationPlanRecord(t, effect, receipt, context.now)
            : undefined;
        const result = getWorkflowTerminalContinuationPlanRecord(
          context.record,
          effect,
          receipt,
          plan,
          operation,
          context.now,
        );
        return 'record' in result
          ? { status: result.status, record: observeWorkflowTerminalizationRecord(result.record) }
          : result;
      });
    } catch (error) {
      return this.terminalizationError(
        'GET_WORKFLOW_TERMINAL_CONTINUATION_PLAN',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  async applyWorkflowTerminalParentEffect(
    input: ApplyWorkflowTerminalParentEffectInput,
  ): Promise<ApplyWorkflowTerminalParentEffectResult> {
    let contract: ApplyWorkflowTerminalParentEffectInput['contract'];
    try {
      contract = copyWorkflowTerminalParentContinuationContract(input.contract);
    } catch {
      return { status: 'invalid_contract' };
    }
    const operation: ApplyWorkflowTerminalParentEffectInput = {
      workflowName: input.workflowName,
      runId: input.runId,
      ownerId: input.ownerId,
      claimToken: input.claimToken,
      claimGeneration: input.claimGeneration,
      contract,
    };
    validateWorkflowTerminalizationRunIdentity(operation);
    validateWorkflowTerminalizationFence(operation);
    try {
      return await this.#db.client.tx(async t => {
        const context = await this.getTerminalizationContext(t, operation.workflowName, operation.runId);
        if (!context.record && !context.snapshotExists) return { status: 'missing_run' };
        const effect = await this.getTerminalEffectRecord(
          t,
          operation.workflowName,
          operation.runId,
          'parent-workflow-step-end',
          context.now,
        );
        const receipt =
          effect?.kind === 'parent-workflow-step-end'
            ? await this.getTerminalDestinationReceiptRecord(
                t,
                effect,
                WORKFLOW_TERMINAL_PARENT_APPLICATION_CONSUMER_ID,
                context.now,
              )
            : undefined;
        const existingPlan =
          effect?.kind === 'parent-workflow-step-end' && receipt
            ? await this.getTerminalContinuationPlanRecord(t, effect, receipt, context.now)
            : undefined;
        let prepared = prepareWorkflowTerminalParentApplicationRecords(
          context.record,
          effect,
          receipt,
          existingPlan,
          operation,
          context.now,
        );
        if (prepared.status === 'contract_conflict') {
          return { status: prepared.status, plan: observeWorkflowTerminalContinuationPlanRecord(prepared.plan) };
        }
        if ('record' in prepared) {
          return { status: prepared.status, record: observeWorkflowTerminalizationRecord(prepared.record) };
        }
        if (!('journal' in prepared)) return { status: prepared.status };
        if (prepared.status === 'already_applied' || prepared.status === 'already_quarantined') {
          return { status: prepared.status, plan: copyWorkflowTerminalContinuationPlanRecord(prepared.plan) };
        }
        if (!effect || effect.kind !== 'parent-workflow-step-end') {
          throw new TypeError('Parent application became ready without a parent effect');
        }

        let retained: WorkflowTerminalSnapshotRecord | undefined;
        try {
          retained = await this.getTerminalSnapshotRecord(t, operation.workflowName, operation.runId, context.now);
        } catch (error) {
          if (error instanceof CorruptWorkflowTerminalSnapshotRecordError) {
            return { status: 'corrupt_child_terminal_state' };
          }
          throw error;
        }
        if (!retained) return { status: 'missing_child_terminal_state' };
        try {
          validateWorkflowTerminalSnapshotJournalLink(
            retained,
            prepared.journal,
            operation.workflowName,
            operation.runId,
          );
          validateWorkflowTerminalEffectRecoveryLink(effect, retained);
        } catch {
          return { status: 'corrupt_child_terminal_state' };
        }
        const revisionRow = await t.oneOrNone<{ generation: number | string; terminal_status: string | null }>(
          `SELECT generation, terminal_status FROM ${this.workflowParentRevisionTableName()}
           WHERE workflow_name = $1 AND run_id = $2
           FOR UPDATE`,
          [effect.parentWorkflowName, effect.parentRunId],
        );
        const parentRow = await t.oneOrNone<{ snapshot: WorkflowRunState | string }>(
          `SELECT snapshot FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [effect.parentWorkflowName, effect.parentRunId],
        );
        if (!parentRow) return { status: 'missing_parent' };
        if (!revisionRow) return { status: 'corrupt_parent_state' };
        const parentGeneration =
          typeof revisionRow.generation === 'string' ? Number(revisionRow.generation) : revisionRow.generation;
        if (!Number.isSafeInteger(parentGeneration) || parentGeneration < 1) {
          return { status: 'corrupt_parent_state' };
        }
        let parentSnapshot: WorkflowRunState;
        try {
          parentSnapshot = structuredClone(
            typeof parentRow.snapshot === 'string' ? JSON.parse(parentRow.snapshot) : parentRow.snapshot,
          );
        } catch {
          return { status: 'corrupt_parent_state' };
        }

        if (`pg:v1:${parentGeneration}` !== operation.contract.expectedParentRevision) {
          return { status: 'parent_conflict' };
        }
        const snapshotTerminalStatus = isTerminalWorkflowRunStatus(parentSnapshot.status)
          ? parentSnapshot.status
          : undefined;
        const terminalNoop = operation.contract.action.kind === 'noop' && operation.contract.patch.kind === 'none';
        if (revisionRow.terminal_status !== null || snapshotTerminalStatus !== undefined) {
          if (
            !isTerminalWorkflowRunStatus(revisionRow.terminal_status) ||
            snapshotTerminalStatus === undefined ||
            revisionRow.terminal_status !== snapshotTerminalStatus ||
            !terminalNoop
          ) {
            return { status: 'parent_conflict' };
          }
        }

        const finalClock = await t.one<{ now_ms: string }>(
          `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
        );
        const finalNow = Number(finalClock.now_ms);
        if (!Number.isSafeInteger(finalNow)) throw new TypeError('Invalid PostgreSQL terminalization clock');
        const revalidated = prepareWorkflowTerminalParentApplicationRecords(
          context.record,
          effect,
          receipt,
          existingPlan,
          operation,
          finalNow,
        );
        if (revalidated.status === 'contract_conflict') {
          return {
            status: revalidated.status,
            plan: observeWorkflowTerminalContinuationPlanRecord(revalidated.plan),
          };
        }
        if ('record' in revalidated) {
          return { status: revalidated.status, record: observeWorkflowTerminalizationRecord(revalidated.record) };
        }
        if (!('journal' in revalidated)) return { status: revalidated.status };
        if (revalidated.status === 'already_applied' || revalidated.status === 'already_quarantined') {
          return {
            status: revalidated.status,
            plan: copyWorkflowTerminalContinuationPlanRecord(revalidated.plan),
          };
        }
        prepared = revalidated;

        const storageTimestamp = finalNow;
        let patchTimestamp: number;
        try {
          patchTimestamp = validateWorkflowSnapshotTimestampForFinalState(parentSnapshot.timestamp, storageTimestamp);
        } catch {
          return { status: 'corrupt_parent_state' };
        }
        let patchedParent: WorkflowRunState;
        try {
          patchedParent = applyWorkflowTerminalParentContinuationPatch({
            contract: prepared.plan.contract,
            effect,
            parentRevision: operation.contract.expectedParentRevision,
            parentWorkflowName: effect.parentWorkflowName,
            parentSnapshot,
            retainedChild: retained,
            storageTimestamp: patchTimestamp,
            executionMode: 'continuous',
          });
        } catch (error) {
          if (error instanceof WorkflowTerminalContinuationStoredStateError) {
            return {
              status: error.state === 'child' ? 'corrupt_child_terminal_state' : 'corrupt_parent_state',
            };
          }
          return { status: 'invalid_contract' };
        }
        const finalized = finalizeWorkflowTerminalParentApplicationRecords(
          prepared.journal,
          prepared.receipt,
          prepared.plan,
          storageTimestamp,
        );
        if (finalized.status === 'applied' && finalized.plan.contract.patch.kind !== 'none') {
          await this.assertWorkflowSnapshotHandoffAvailable(t, effect.parentWorkflowName, effect.parentRunId);
          const serializedParent = sanitizeJsonForPg(JSON.stringify(patchedParent));
          const timestamp = new Date(storageTimestamp);
          const update = await t.query(
            `UPDATE ${this.workflowSnapshotTableName()}
             SET snapshot = $1, "updatedAt" = $2, "updatedAtZ" = $3
             WHERE workflow_name = $4 AND run_id = $5`,
            [serializedParent, timestamp, timestamp, effect.parentWorkflowName, effect.parentRunId],
          );
          if ((update.rowCount ?? 0) !== 1) return { status: 'parent_conflict' };
          await this.bumpWorkflowParentRevision(t, effect.parentWorkflowName, effect.parentRunId, parentGeneration);
        }
        await this.saveTerminalDestinationReceiptRecord(t, finalized.receipt, receipt !== undefined);
        await this.insertTerminalContinuationPlanRecord(t, finalized.plan);
        await this.saveTerminalizationRecord(t, operation.workflowName, operation.runId, finalized.journal);
        return { status: finalized.status, plan: copyWorkflowTerminalContinuationPlanRecord(finalized.plan) };
      });
    } catch (error) {
      return this.terminalizationError(
        'APPLY_WORKFLOW_TERMINAL_PARENT_EFFECT',
        operation.workflowName,
        operation.runId,
        error,
      );
    }
  }

  private parseWorkflowRun(row: Record<string, any>): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        this.logger.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }
    return {
      workflowName: row.workflow_name as string,
      runId: row.run_id as string,
      snapshot: parsedSnapshot,
      resourceId: row.resourceId as string,
      createdAt: new Date(row.createdAtZ || (row.createdAt as string)),
      updatedAt: new Date(row.updatedAtZ || (row.updatedAt as string)),
    };
  }

  /**
   * Returns the workflow snapshot index plus the terminalization recovery and retention indexes.
   *
   * Only the snapshot index carries the schema prefix (truncated to Postgres' identifier limit
   * by {@link workflowSnapshotCreatedAtIndexName}). The terminalization index names stay
   * schema-unprefixed on purpose: they are created inside the target schema and the durable
   * terminal-recovery contract asserts those stable identifiers in every schema.
   */
  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: workflowSnapshotCreatedAtIndexName(schemaPrefix),
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['workflow_name', 'createdAt DESC'],
      },
      {
        name: 'mastra_workflow_terminalizations_phase_lease_idx',
        table: TABLE_WORKFLOW_TERMINALIZATIONS,
        columns: ['phase', 'lease_expires_at'],
      },
      {
        name: 'mastra_workflow_terminalizations_completed_idx',
        table: TABLE_WORKFLOW_TERMINALIZATIONS,
        columns: ['completed_at'],
      },
      {
        name: 'mastra_workflow_terminal_destination_receipts_v2_lookup_idx',
        table: TABLE_WORKFLOW_TERMINAL_DESTINATION_RECEIPTS,
        columns: ['workflow_name', 'run_id', 'effect_kind', 'consumer_id'],
      },
      {
        name: 'mastra_workflow_terminal_continuation_plans_v2_run_idx',
        table: TABLE_WORKFLOW_TERMINAL_CONTINUATION_PLANS,
        columns: ['workflow_name', 'run_id'],
      },
      {
        name: 'mastra_workflow_terminal_recovery_ancestries_parent_idx',
        table: TABLE_WORKFLOW_TERMINAL_RECOVERY_ANCESTRIES,
        columns: ['immediate_parent_workflow_name', 'immediate_parent_run_id'],
      },
      {
        name: 'mastra_workflow_terminal_effects_v2_parent_idx',
        table: TABLE_WORKFLOW_TERMINAL_EFFECTS,
        columns: ['parent_workflow_name', 'parent_run_id'],
        where: `"effect_kind" = 'parent-workflow-step-end'`,
      },
      {
        name: 'mastra_workflow_snapshot_handoffs_recovery_idx',
        table: TABLE_WORKFLOW_SNAPSHOT_HANDOFF,
        columns: ['status', 'updated_at', 'workflow_name', 'run_id'],
      },
    ];
  }

  /**
   * Returns all DDL statements for this domain: table with unique constraint.
   * Used by exportSchemas to produce a complete, reproducible schema export.
   */
  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    // Table (includes the UNIQUE constraint on workflow_name, run_id via generateTableSQL)
    statements.push(
      generateTableSQL({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
        schemaName,
        includeAllConstraints: true,
      }),
    );
    statements.push(WorkflowsPG.getWorkflowSnapshotStatusIndexExportDDL(schemaName));
    statements.push(WorkflowsPG.getTerminalizationTableDDL(schemaName));
    statements.push(WorkflowsPG.getTerminalEffectTableDDL(schemaName));
    statements.push(WorkflowsPG.getTerminalSnapshotTableDDL(schemaName));
    statements.push(WorkflowsPG.getTerminalRecoveryAncestryTableDDL(schemaName));
    statements.push(WorkflowsPG.getTerminalDestinationReceiptTableDDL(schemaName));
    statements.push(WorkflowsPG.getWorkflowSnapshotHandoffTableDDL(schemaName));
    statements.push(WorkflowsPG.getWorkflowSchemaMigrationTableDDL(schemaName));
    statements.push(WorkflowsPG.getWorkflowParentRevisionExportDDL(schemaName));
    statements.push(WorkflowsPG.getTerminalContinuationPlanTableDDL(schemaName));
    for (const idx of WorkflowsPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  private static getWorkflowSnapshotStatusIndexExportDDL(schemaName?: string): string {
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : 'public';
    const indexSql = workflowSnapshotStatusIndexSQL(workflowSnapshotStatusIndexName(parsedSchema), parsedSchema);
    return `DO $mastra_workflow_snapshot_status_index$
    DECLARE
      snapshot_column_type text;
    BEGIN
      SELECT format_type(column_row.atttypid, column_row.atttypmod)
      INTO snapshot_column_type
      FROM pg_catalog.pg_class AS table_row
      JOIN pg_catalog.pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
      JOIN pg_catalog.pg_attribute AS column_row ON column_row.attrelid = table_row.oid
      WHERE namespace_row.nspname = '${parsedSchema}'
        AND table_row.relname = '${TABLE_WORKFLOW_SNAPSHOT}'
        AND table_row.relkind IN ('r', 'p')
        AND column_row.attname = 'snapshot'
        AND column_row.attnum > 0
        AND NOT column_row.attisdropped;

      IF snapshot_column_type = 'jsonb' THEN
        EXECUTE $mastra_snapshot_status_index_sql$${indexSql}$mastra_snapshot_status_index_sql$;
      ELSIF snapshot_column_type IN ('json', 'text') THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'Workflow parent revision migration does not support snapshot column type %',
          COALESCE(snapshot_column_type, 'missing');
      END IF;
    END
    $mastra_workflow_snapshot_status_index$;`;
  }

  private static getTerminalizationTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINALIZATIONS,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "event_key" TEXT NOT NULL,
      "terminal_status" TEXT NOT NULL,
      "phase" TEXT NOT NULL,
      "owner_id" TEXT,
      "claim_token" TEXT,
      "claim_generation" BIGINT NOT NULL,
      "lease_expires_at" BIGINT,
      "created_at" BIGINT NOT NULL,
      "updated_at" BIGINT NOT NULL,
      "completed_at" BIGINT,
      PRIMARY KEY ("workflow_name", "run_id")
    );`;
  }

  private static getWorkflowSnapshotHandoffTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_SNAPSHOT_HANDOFF,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "resource_id" TEXT,
      "snapshot" JSONB NOT NULL,
      "mutation_fence" TEXT NOT NULL,
      "created_at" BIGINT NOT NULL,
      "updated_at" BIGINT NOT NULL,
      "completed_at" BIGINT,
      PRIMARY KEY ("workflow_name", "run_id"),
      CHECK ("version" = 1),
      CHECK ("status" IN ('pending', 'completed')),
      CHECK (length("mutation_fence") BETWEEN 1 AND 4096),
      CHECK ((jsonb_typeof("snapshot") = 'object') IS TRUE),
      CHECK ("created_at" >= 0 AND "updated_at" >= "created_at"),
      CHECK (("status" = 'pending' AND "completed_at" IS NULL)
        OR ("status" = 'completed' AND "completed_at" IS NOT NULL AND "completed_at" >= "created_at"))
    );`;
  }

  private static getTerminalEffectTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_EFFECTS,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "effect_kind" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "effect_key" TEXT NOT NULL UNIQUE,
      "source_event_key" TEXT NOT NULL,
      "terminal_status" TEXT NOT NULL,
      "parent_workflow_name" TEXT,
      "parent_run_id" TEXT,
      "parent_step_id" TEXT,
      "parent_execution_path" JSONB,
      "recovery_envelope_hash" TEXT NOT NULL,
      "retained_record_hash" TEXT NOT NULL,
      "resource_id" TEXT,
      "payload_hash" TEXT NOT NULL,
      "created_at" BIGINT NOT NULL,
      PRIMARY KEY ("workflow_name", "run_id", "effect_kind")
    );`;
  }

  private static getTerminalSnapshotTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_SNAPSHOTS,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "resource_id" TEXT,
      "terminal_status" TEXT NOT NULL,
      "envelope_hash" TEXT NOT NULL,
      "record_hash" TEXT NOT NULL,
      "envelope" JSONB NOT NULL,
      "created_at" BIGINT NOT NULL,
      CHECK ("version" = 1),
      CHECK ("envelope_hash" ~ '^sha256:[a-f0-9]{64}$'),
      CHECK ("record_hash" ~ '^sha256:[a-f0-9]{64}$'),
      CHECK ((jsonb_typeof("envelope") = 'object') IS TRUE),
      CHECK ("created_at" >= 0),
      PRIMARY KEY ("workflow_name", "run_id")
    );`;
  }

  private static getTerminalRecoveryAncestryTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_RECOVERY_ANCESTRIES,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "ancestry_hash" TEXT NOT NULL,
      "ancestry" JSONB NOT NULL,
      "immediate_parent_workflow_name" TEXT,
      "immediate_parent_run_id" TEXT,
      "created_at" BIGINT NOT NULL,
      CHECK ("version" = 1),
      CHECK ("ancestry_hash" ~ '^sha256:[a-f0-9]{64}$'),
      CHECK ((jsonb_typeof("ancestry") = 'array') IS TRUE),
      CHECK (("immediate_parent_workflow_name" IS NULL) = ("immediate_parent_run_id" IS NULL)),
      CHECK (
        (jsonb_array_length("ancestry") = 0 AND "immediate_parent_workflow_name" IS NULL)
        OR (
          jsonb_array_length("ancestry") > 0
          AND "immediate_parent_workflow_name" = "ancestry" #>> '{0,parentWorkflowName}'
          AND "immediate_parent_run_id" = "ancestry" #>> '{0,parentRunId}'
        )
      ),
      CHECK ("created_at" >= 0),
      PRIMARY KEY ("workflow_name", "run_id")
    );`;
  }

  private static getTerminalDestinationReceiptTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_DESTINATION_RECEIPTS,
      schemaName: getSchemaName(schemaName),
    });
    const effectTableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_EFFECTS,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "version" INTEGER NOT NULL,
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "effect_key" TEXT NOT NULL,
      "consumer_id" TEXT NOT NULL,
      "receipt_key" TEXT NOT NULL UNIQUE,
      "effect_kind" TEXT NOT NULL,
      "producer_payload_hash" TEXT NOT NULL,
      "destination_hash" TEXT NOT NULL,
      "application_state" TEXT NOT NULL,
      "dispatch_state" TEXT NOT NULL,
      "created_at" BIGINT NOT NULL,
      "updated_at" BIGINT NOT NULL,
      "applied_at" BIGINT,
      "dispatch_pending_at" BIGINT,
      "destination_applied_at" BIGINT,
      "quarantined_at" BIGINT,
      PRIMARY KEY ("effect_key", "consumer_id"),
      FOREIGN KEY ("effect_key") REFERENCES ${effectTableName} ("effect_key") ON DELETE CASCADE,
      CHECK ("version" = 1),
      CHECK ("created_at" >= 0 AND "updated_at" >= "created_at"),
      CHECK (
        ("application_state" = 'reserved' AND "dispatch_state" = 'none'
          AND "updated_at" = "created_at"
          AND "applied_at" IS NULL AND "dispatch_pending_at" IS NULL
          AND "destination_applied_at" IS NULL AND "quarantined_at" IS NULL)
        OR
        ("application_state" = 'applied' AND "dispatch_state" = 'none'
          AND "applied_at" IS NOT NULL AND "applied_at" = "updated_at" AND "dispatch_pending_at" IS NULL
          AND "destination_applied_at" IS NULL AND "quarantined_at" IS NULL)
        OR
        ("application_state" = 'applied' AND "dispatch_state" = 'pending'
          AND "applied_at" IS NOT NULL AND "dispatch_pending_at" IS NOT NULL
          AND "dispatch_pending_at" = "updated_at"
          AND "created_at" <= "applied_at"
          AND "applied_at" <= "dispatch_pending_at"
          AND "destination_applied_at" IS NULL AND "quarantined_at" IS NULL)
        OR
        ("application_state" = 'applied' AND "dispatch_state" = 'destination_applied'
          AND "applied_at" IS NOT NULL AND "dispatch_pending_at" IS NOT NULL
          AND "destination_applied_at" IS NOT NULL AND "destination_applied_at" = "updated_at"
          AND "created_at" <= "applied_at"
          AND "applied_at" <= "dispatch_pending_at"
          AND "dispatch_pending_at" <= "destination_applied_at" AND "quarantined_at" IS NULL)
        OR
        ("application_state" = 'quarantined' AND "dispatch_state" = 'none'
          AND "quarantined_at" IS NOT NULL AND "quarantined_at" = "updated_at"
          AND "applied_at" IS NULL AND "dispatch_pending_at" IS NULL AND "destination_applied_at" IS NULL)
      )
    );`;
  }

  private static getWorkflowParentRevisionTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_PARENT_REVISIONS,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "generation" BIGINT NOT NULL,
      "terminal_status" TEXT,
      "updated_at" BIGINT NOT NULL,
      PRIMARY KEY ("workflow_name", "run_id"),
      CHECK ("generation" >= 0),
      CONSTRAINT "mastra_workflow_parent_revisions_terminal_status_check"
        CHECK ("terminal_status" IS NULL OR "terminal_status" IN ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')),
      CHECK ("updated_at" >= 0)
    );`;
  }

  private static getWorkflowParentRevisionExportDDL(schemaName?: string): string {
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : 'public';
    const revisionRegclass = `${getSchemaName(parsedSchema)}."${TABLE_WORKFLOW_PARENT_REVISIONS}"`;
    const revisionTableName = getTableName({
      indexName: TABLE_WORKFLOW_PARENT_REVISIONS,
      schemaName: getSchemaName(parsedSchema),
    });
    const markerTableName = getTableName({
      indexName: TABLE_WORKFLOW_SCHEMA_MIGRATIONS,
      schemaName: getSchemaName(parsedSchema),
    });
    const epochTableName = getTableName({
      indexName: TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH,
      schemaName: getSchemaName(parsedSchema),
    });
    const snapshotTableName = getTableName({
      indexName: TABLE_WORKFLOW_SNAPSHOT,
      schemaName: getSchemaName(parsedSchema),
    });
    const terminalizationTableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINALIZATIONS,
      schemaName: getSchemaName(parsedSchema),
    });
    return `DO $mastra_workflow_parent_revision_export$
    DECLARE
      marker_oid oid;
      marker_kind "char";
      marker_is_partition boolean;
      marker_has_inheritance boolean;
      marker_persistence "char";
      marker_present boolean;
      epoch_oid oid;
      epoch_kind "char";
      epoch_is_partition boolean;
      epoch_has_inheritance boolean;
      epoch_persistence "char";
      epoch_row_count bigint;
      revision_oid oid;
      revision_kind "char";
      revision_is_partition boolean;
      revision_has_inheritance boolean;
      revision_persistence "char";
      revision_columns jsonb;
      revision_primary_key text[];
      revision_primary_key_immediate boolean;
      revision_checks text[];
      revision_checks_valid boolean;
    BEGIN
      PERFORM pg_advisory_xact_lock(
        hashtextextended(current_database() || E'\\n' || '${parsedSchema}' || E'\\n' || '${WORKFLOW_PARENT_REVISION_MIGRATION}', 0)
      );
      marker_oid := to_regclass('${getSchemaName(parsedSchema)}."${TABLE_WORKFLOW_SCHEMA_MIGRATIONS}"');
      SELECT relation_row.relkind,
             relation_row.relispartition,
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_inherits AS inheritance_row
               WHERE inheritance_row.inhrelid = relation_row.oid
                  OR inheritance_row.inhparent = relation_row.oid
             ),
             relation_row.relpersistence
      INTO marker_kind, marker_is_partition, marker_has_inheritance, marker_persistence
      FROM pg_catalog.pg_class AS relation_row
      WHERE relation_row.oid = marker_oid;
      IF marker_oid IS NULL
         OR marker_kind <> 'r'
         OR marker_is_partition
         OR marker_has_inheritance
         OR marker_persistence <> 'p' THEN
        RAISE EXCEPTION 'Workflow parent revision migration marker table has an incompatible shape';
      END IF;
      LOCK TABLE ${markerTableName} IN ACCESS SHARE MODE;

      SELECT COALESCE(
               jsonb_object_agg(
                 column_row.attname,
                 jsonb_build_object(
                   'type', format_type(column_row.atttypid, column_row.atttypmod),
                   'not_null', column_row.attnotnull,
                   'has_default', (column_row.atthasdef OR column_row.attidentity <> '')
                 )
               ),
               '{}'::jsonb
             )
      INTO revision_columns
      FROM pg_catalog.pg_attribute AS column_row
      WHERE column_row.attrelid = marker_oid
        AND column_row.attnum > 0
        AND NOT column_row.attisdropped;
      SELECT COALESCE(array_agg(primary_column.attname::text ORDER BY key_column.ordinal_position), ARRAY[]::text[]),
             COALESCE(bool_and(primary_index.indimmediate), FALSE)
      INTO revision_primary_key, revision_primary_key_immediate
      FROM pg_catalog.pg_index AS primary_index
      CROSS JOIN LATERAL unnest(primary_index.indkey)
        WITH ORDINALITY AS key_column(attnum, ordinal_position)
      JOIN pg_catalog.pg_attribute AS primary_column
        ON primary_column.attrelid = primary_index.indrelid
       AND primary_column.attnum = key_column.attnum
      WHERE primary_index.indrelid = marker_oid
        AND primary_index.indisprimary
        AND key_column.ordinal_position <= primary_index.indnkeyatts;
      SELECT COALESCE(
               array_agg(
                 btrim(regexp_replace(pg_get_expr(check_row.conbin, check_row.conrelid, true), '[[:space:]]+', ' ', 'g'))
                 ORDER BY btrim(
                   regexp_replace(pg_get_expr(check_row.conbin, check_row.conrelid, true), '[[:space:]]+', ' ', 'g')
                 )
               ),
               ARRAY[]::text[]
             ),
             COALESCE(bool_and(check_row.convalidated), TRUE)
      INTO revision_checks, revision_checks_valid
      FROM pg_catalog.pg_constraint AS check_row
      WHERE check_row.conrelid = marker_oid
        AND check_row.contype = 'c';
      IF revision_columns <> '{
           "migration_key": {"type": "text", "not_null": true, "has_default": false},
           "applied_at": {"type": "bigint", "not_null": true, "has_default": false}
         }'::jsonb
         OR revision_primary_key <> ARRAY['migration_key']::text[]
         OR NOT revision_primary_key_immediate
         OR revision_checks <> ARRAY[
           'applied_at >= 0',
           'length(migration_key) >= 1 AND length(migration_key) <= 256'
         ]::text[]
         OR NOT revision_checks_valid THEN
        RAISE EXCEPTION 'Workflow parent revision migration marker table has an incompatible shape';
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM ${markerTableName}
        WHERE migration_key = '${WORKFLOW_PARENT_REVISION_MIGRATION}'
      )
      INTO marker_present;

      epoch_oid := to_regclass('${getSchemaName(parsedSchema)}."${TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH}"');
      IF epoch_oid IS NOT NULL THEN
        SELECT relation_row.relkind,
               relation_row.relispartition,
               EXISTS (
                 SELECT 1 FROM pg_catalog.pg_inherits AS inheritance_row
                 WHERE inheritance_row.inhrelid = relation_row.oid
                    OR inheritance_row.inhparent = relation_row.oid
               ),
               relation_row.relpersistence
        INTO epoch_kind, epoch_is_partition, epoch_has_inheritance, epoch_persistence
        FROM pg_catalog.pg_class AS relation_row
        WHERE relation_row.oid = epoch_oid;
        IF epoch_kind <> 'r' OR epoch_is_partition OR epoch_has_inheritance OR epoch_persistence <> 'p' THEN
          RAISE EXCEPTION 'Workflow parent revision migration epoch table has an incompatible shape';
        END IF;
        LOCK TABLE ${epochTableName} IN ACCESS SHARE MODE;

        SELECT COALESCE(
                 jsonb_object_agg(
                   column_row.attname,
                   jsonb_build_object(
                     'type', format_type(column_row.atttypid, column_row.atttypmod),
                     'not_null', column_row.attnotnull,
                     'has_default', (column_row.atthasdef OR column_row.attidentity <> '')
                   )
                 ),
                 '{}'::jsonb
               )
        INTO revision_columns
        FROM pg_catalog.pg_attribute AS column_row
        WHERE column_row.attrelid = epoch_oid
          AND column_row.attnum > 0
          AND NOT column_row.attisdropped;

        SELECT COALESCE(array_agg(primary_column.attname::text ORDER BY key_column.ordinal_position), ARRAY[]::text[]),
               COALESCE(bool_and(primary_index.indimmediate), FALSE)
        INTO revision_primary_key, revision_primary_key_immediate
        FROM pg_catalog.pg_index AS primary_index
        CROSS JOIN LATERAL unnest(primary_index.indkey)
          WITH ORDINALITY AS key_column(attnum, ordinal_position)
        JOIN pg_catalog.pg_attribute AS primary_column
          ON primary_column.attrelid = primary_index.indrelid
         AND primary_column.attnum = key_column.attnum
        WHERE primary_index.indrelid = epoch_oid
          AND primary_index.indisprimary
          AND key_column.ordinal_position <= primary_index.indnkeyatts;

        SELECT COALESCE(
                 array_agg(
                   btrim(regexp_replace(pg_get_expr(check_row.conbin, check_row.conrelid, true), '[[:space:]]+', ' ', 'g'))
                   ORDER BY btrim(
                     regexp_replace(pg_get_expr(check_row.conbin, check_row.conrelid, true), '[[:space:]]+', ' ', 'g')
                   )
                 ),
                 ARRAY[]::text[]
               ),
               COALESCE(bool_and(check_row.convalidated), TRUE)
        INTO revision_checks, revision_checks_valid
        FROM pg_catalog.pg_constraint AS check_row
        WHERE check_row.conrelid = epoch_oid
          AND check_row.contype = 'c';

        IF revision_columns <> '{
             "epoch": {"type": "smallint", "not_null": true, "has_default": false},
             "created_at": {"type": "bigint", "not_null": true, "has_default": false}
           }'::jsonb
           OR revision_primary_key <> ARRAY['epoch']::text[]
           OR NOT revision_primary_key_immediate
           OR revision_checks <> ARRAY['created_at >= 0', 'epoch = 1']::text[]
           OR NOT revision_checks_valid THEN
          RAISE EXCEPTION 'Workflow parent revision migration epoch table has an incompatible shape';
        END IF;

        SELECT count(*) INTO epoch_row_count FROM ${epochTableName};
      END IF;

      IF (marker_present AND (epoch_oid IS NULL OR epoch_row_count <> 1))
         OR (NOT marker_present AND epoch_oid IS NOT NULL) THEN
        RAISE EXCEPTION 'Workflow parent revision migration provenance is damaged or incomplete';
      END IF;

      revision_oid := to_regclass('${revisionRegclass}');

      IF revision_oid IS NULL THEN
        LOCK TABLE ${terminalizationTableName} IN EXCLUSIVE MODE;
        LOCK TABLE ${snapshotTableName} IN EXCLUSIVE MODE;
        revision_oid := to_regclass('${revisionRegclass}');
        IF revision_oid IS NULL THEN
          IF marker_present THEN
            RAISE EXCEPTION 'Workflow parent revision migration marker conflicts with the durable schema';
          ELSIF EXISTS (SELECT 1 FROM ${snapshotTableName})
             OR EXISTS (SELECT 1 FROM ${terminalizationTableName}) THEN
            RAISE EXCEPTION '${WORKFLOW_PARENT_REVISION_EXPORT_MIGRATION_REQUIRED}';
          ELSE
            ${WorkflowsPG.getWorkflowParentRevisionTableDDL(parsedSchema)}
          END IF;
          RETURN;
        END IF;
      END IF;

      SELECT relation_row.relkind,
             relation_row.relispartition,
             EXISTS (
               SELECT 1 FROM pg_catalog.pg_inherits AS inheritance_row
               WHERE inheritance_row.inhrelid = relation_row.oid
                  OR inheritance_row.inhparent = relation_row.oid
             ),
             relation_row.relpersistence
      INTO revision_kind, revision_is_partition, revision_has_inheritance, revision_persistence
      FROM pg_catalog.pg_class AS relation_row
      WHERE relation_row.oid = revision_oid;
      IF revision_kind <> 'r'
         OR revision_is_partition
         OR revision_has_inheritance
         OR revision_persistence <> 'p' THEN
        RAISE EXCEPTION 'Workflow parent revision table has an incompatible shape';
      END IF;
      LOCK TABLE ${revisionTableName} IN ACCESS SHARE MODE;

      SELECT COALESCE(
               jsonb_object_agg(
                 column_row.attname,
                 jsonb_build_object(
                   'type', format_type(column_row.atttypid, column_row.atttypmod),
                   'not_null', column_row.attnotnull,
                   'has_default', (column_row.atthasdef OR column_row.attidentity <> '')
                 )
               ),
               '{}'::jsonb
             )
      INTO revision_columns
      FROM pg_catalog.pg_attribute AS column_row
      WHERE column_row.attrelid = revision_oid
        AND column_row.attnum > 0
        AND NOT column_row.attisdropped;

      SELECT COALESCE(array_agg(primary_column.attname::text ORDER BY key_column.ordinal_position), ARRAY[]::text[]),
             COALESCE(bool_and(primary_index.indimmediate), FALSE)
      INTO revision_primary_key, revision_primary_key_immediate
      FROM pg_catalog.pg_index AS primary_index
      CROSS JOIN LATERAL unnest(primary_index.indkey)
        WITH ORDINALITY AS key_column(attnum, ordinal_position)
      JOIN pg_catalog.pg_attribute AS primary_column
        ON primary_column.attrelid = primary_index.indrelid
       AND primary_column.attnum = key_column.attnum
      WHERE primary_index.indrelid = revision_oid
        AND primary_index.indisprimary
        AND key_column.ordinal_position <= primary_index.indnkeyatts;

      SELECT COALESCE(
               array_agg(
                 btrim(regexp_replace(pg_get_expr(check_row.conbin, check_row.conrelid, true), '[[:space:]]+', ' ', 'g'))
                 ORDER BY btrim(
                   regexp_replace(pg_get_expr(check_row.conbin, check_row.conrelid, true), '[[:space:]]+', ' ', 'g')
                 )
               ),
               ARRAY[]::text[]
             ),
             COALESCE(bool_and(check_row.convalidated), TRUE)
      INTO revision_checks, revision_checks_valid
      FROM pg_catalog.pg_constraint AS check_row
      WHERE check_row.conrelid = revision_oid
        AND check_row.contype = 'c';

      IF revision_columns = '{
           "workflow_name": {"type": "text", "not_null": true, "has_default": false},
           "run_id": {"type": "text", "not_null": true, "has_default": false},
           "generation": {"type": "bigint", "not_null": true, "has_default": false},
           "terminal_status": {"type": "text", "not_null": false, "has_default": false},
           "updated_at": {"type": "bigint", "not_null": true, "has_default": false}
         }'::jsonb
         AND revision_primary_key = ARRAY['workflow_name', 'run_id']::text[]
         AND revision_primary_key_immediate
         AND revision_checks = ARRAY[
           'generation >= 0',
           $mastra_revision_check$${WORKFLOW_PARENT_REVISION_TERMINAL_STATUS_CHECK}$mastra_revision_check$,
           'updated_at >= 0'
         ]::text[]
         AND revision_checks_valid THEN
        RETURN;
      END IF;

      IF revision_columns = '{
           "workflow_name": {"type": "text", "not_null": true, "has_default": false},
           "run_id": {"type": "text", "not_null": true, "has_default": false},
           "generation": {"type": "bigint", "not_null": true, "has_default": false},
           "updated_at": {"type": "bigint", "not_null": true, "has_default": false}
         }'::jsonb
         AND revision_primary_key = ARRAY['workflow_name', 'run_id']::text[]
         AND revision_primary_key_immediate
         AND revision_checks = ARRAY['generation >= 0', 'updated_at >= 0']::text[]
         AND revision_checks_valid THEN
        IF marker_present THEN
          RAISE EXCEPTION 'Workflow parent revision migration marker conflicts with the durable schema';
        END IF;
        RAISE EXCEPTION '${WORKFLOW_PARENT_REVISION_EXPORT_MIGRATION_REQUIRED}';
      END IF;

      RAISE EXCEPTION 'Workflow parent revision table has an incompatible shape';
    END
    $mastra_workflow_parent_revision_export$;`;
  }

  private static getWorkflowSchemaMigrationTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_SCHEMA_MIGRATIONS,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "migration_key" TEXT NOT NULL PRIMARY KEY,
      "applied_at" BIGINT NOT NULL,
      CHECK (length("migration_key") BETWEEN 1 AND 256),
      CHECK ("applied_at" >= 0)
    );`;
  }

  private static getWorkflowParentRevisionMigrationEpochTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE ${tableName} (
      "epoch" SMALLINT NOT NULL PRIMARY KEY,
      "created_at" BIGINT NOT NULL,
      CHECK ("epoch" = ${WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH}),
      CHECK ("created_at" >= 0)
    );`;
  }

  private static getTerminalContinuationPlanTableDDL(schemaName?: string): string {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_CONTINUATION_PLANS,
      schemaName: getSchemaName(schemaName),
    });
    const receiptTableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_DESTINATION_RECEIPTS,
      schemaName: getSchemaName(schemaName),
    });
    const effectTableName = getTableName({
      indexName: TABLE_WORKFLOW_TERMINAL_EFFECTS,
      schemaName: getSchemaName(schemaName),
    });
    return `CREATE TABLE IF NOT EXISTS ${tableName} (
      "version" INTEGER NOT NULL,
      "plan_key" TEXT NOT NULL UNIQUE,
      "plan_hash" TEXT NOT NULL,
      "receipt_key" TEXT NOT NULL PRIMARY KEY,
      "effect_key" TEXT NOT NULL,
      "consumer_id" TEXT NOT NULL,
      "workflow_name" TEXT NOT NULL,
      "run_id" TEXT NOT NULL,
      "parent_workflow_name" TEXT NOT NULL,
      "parent_run_id" TEXT NOT NULL,
      "parent_revision" TEXT NOT NULL,
      "contract_hash" TEXT NOT NULL,
      "contract" JSONB NOT NULL,
      "framework_action_key" TEXT,
      "created_at" BIGINT NOT NULL,
      UNIQUE ("effect_key", "consumer_id"),
      FOREIGN KEY ("effect_key") REFERENCES ${effectTableName} ("effect_key") ON DELETE CASCADE,
      FOREIGN KEY ("effect_key", "consumer_id")
        REFERENCES ${receiptTableName} ("effect_key", "consumer_id") ON DELETE CASCADE,
      FOREIGN KEY ("receipt_key") REFERENCES ${receiptTableName} ("receipt_key") ON DELETE CASCADE,
      CHECK ("version" = 1),
      CHECK ("consumer_id" = 'mastra.parent-application.v1'),
      CHECK ("plan_key" ~ '^wtp:v1:[a-f0-9]{64}$'),
      CHECK ("plan_hash" ~ '^sha256:[a-f0-9]{64}$'),
      CHECK ("contract_hash" ~ '^sha256:[a-f0-9]{64}$'),
      CHECK (length("parent_revision") BETWEEN 1 AND 256),
      CHECK ((jsonb_typeof("contract") = 'object') IS TRUE),
      CHECK (("contract"->>'version' = '1') IS TRUE),
      CHECK (("contract"->>'contractHash' = "contract_hash") IS TRUE),
      CHECK (("contract"->>'executionMode' = 'continuous') IS TRUE),
      CHECK (("contract"->>'expectedParentRevision' = "parent_revision") IS TRUE),
      CHECK (("contract"->>'terminalEffectKey' = "effect_key") IS TRUE),
      CHECK (
        ((("contract"#>>'{action,kind}') IN ('wait', 'noop', 'quarantine')
          AND "framework_action_key" IS NULL) IS TRUE)
        OR ((("contract"#>>'{action,kind}') IN
          ('run-entry', 'complete-entry', 'fail-parent', 'finish-parent', 'cancel-parent', 'suspend-parent')
          AND "framework_action_key" ~ '^wta:v1:[a-f0-9]{64}$') IS TRUE)
      ),
      CHECK ("created_at" >= 0)
    );`;
  }

  private classifyWorkflowMigrationSchema(
    relations: Map<string, WorkflowCatalogRelation>,
  ): WorkflowMigrationSchemaState {
    const matches = (
      relation: WorkflowCatalogRelation,
      expectedColumns: Readonly<Record<string, { type: string; notNull: boolean }>>,
      expectedPrimaryKey: readonly string[],
      expectedCheckExpressions: readonly string[],
    ): boolean => {
      const expectedEntries = Object.entries(expectedColumns);
      const expectedNotNull = expectedEntries.filter(([, column]) => column.notNull).map(([column]) => column);
      const actualChecks = relation.checkConstraints
        .map(check => ({ ...check, expression: check.expression.replace(/\s+/g, ' ').trim() }))
        .sort((a, b) => a.expression.localeCompare(b.expression));
      const expectedChecks = [...expectedCheckExpressions].sort((a, b) => a.localeCompare(b));
      return (
        relation.kind === 'r' &&
        !relation.isPartition &&
        !relation.hasInheritance &&
        relation.persistence === 'p' &&
        relation.columns.size === expectedEntries.length &&
        expectedEntries.every(([column, expected]) => relation.columns.get(column) === expected.type) &&
        relation.notNullColumns.size === expectedNotNull.length &&
        expectedNotNull.every(column => relation.notNullColumns.has(column)) &&
        relation.columnsWithDefaults.size === 0 &&
        relation.primaryKeyImmediate &&
        relation.primaryKeyColumns.length === expectedPrimaryKey.length &&
        relation.primaryKeyColumns.every((column, index) => column === expectedPrimaryKey[index]) &&
        actualChecks.length === expectedChecks.length &&
        actualChecks.every((check, index) => check.validated && check.expression === expectedChecks[index])
      );
    };

    const marker = relations.get(TABLE_WORKFLOW_SCHEMA_MIGRATIONS);
    const markerTable = !marker
      ? 'absent'
      : matches(
            marker,
            {
              migration_key: { type: 'text', notNull: true },
              applied_at: { type: 'bigint', notNull: true },
            },
            ['migration_key'],
            WORKFLOW_SCHEMA_MIGRATION_CHECKS,
          )
        ? 'current'
        : 'incompatible';

    const epoch = relations.get(TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH);
    const epochTable = !epoch
      ? 'absent'
      : matches(
            epoch,
            {
              epoch: { type: 'smallint', notNull: true },
              created_at: { type: 'bigint', notNull: true },
            },
            ['epoch'],
            WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH_CHECKS,
          )
        ? 'current'
        : 'incompatible';

    const revision = relations.get(TABLE_WORKFLOW_PARENT_REVISIONS);
    let parentRevisions: WorkflowSchemaRelationShape;
    if (!revision) {
      parentRevisions = 'absent';
    } else if (
      matches(
        revision,
        {
          workflow_name: { type: 'text', notNull: true },
          run_id: { type: 'text', notNull: true },
          generation: { type: 'bigint', notNull: true },
          updated_at: { type: 'bigint', notNull: true },
        },
        ['workflow_name', 'run_id'],
        WORKFLOW_PARENT_REVISION_BASE_CHECKS,
      )
    ) {
      parentRevisions = 'legacy';
    } else if (
      matches(
        revision,
        {
          workflow_name: { type: 'text', notNull: true },
          run_id: { type: 'text', notNull: true },
          generation: { type: 'bigint', notNull: true },
          terminal_status: { type: 'text', notNull: false },
          updated_at: { type: 'bigint', notNull: true },
        },
        ['workflow_name', 'run_id'],
        [...WORKFLOW_PARENT_REVISION_BASE_CHECKS, WORKFLOW_PARENT_REVISION_TERMINAL_STATUS_CHECK],
      )
    ) {
      parentRevisions = 'current';
    } else {
      parentRevisions = 'incompatible';
    }

    const snapshotColumnType = relations.get(TABLE_WORKFLOW_SNAPSHOT)?.columns.get('snapshot') ?? null;

    return { markerTable, epochTable, parentRevisions, snapshotColumnType };
  }

  private async inspectWorkflowMigrationSchema(
    client: Pick<DbClient, 'manyOrNone'>,
    useInitSnapshot: boolean,
  ): Promise<WorkflowMigrationSchemaState> {
    const snapshot = useInitSnapshot ? getSchemaSnapshot(this.#db.client, this.#schema) : null;
    if (snapshot) {
      const relations = new Map<string, WorkflowCatalogRelation>();
      for (const table of [
        TABLE_WORKFLOW_SCHEMA_MIGRATIONS,
        TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH,
        TABLE_WORKFLOW_PARENT_REVISIONS,
        TABLE_WORKFLOW_SNAPSHOT,
      ] as const) {
        if (!snapshot.tables.has(table)) continue;
        const columns = new Map<string, string>();
        for (const column of snapshot.columns.get(table) ?? []) {
          columns.set(column, snapshot.columnTypes.get(table)?.get(column) ?? '');
        }
        relations.set(table, {
          kind: snapshot.tableKinds.get(table) ?? '',
          isPartition: snapshot.partitionedTables.has(table),
          hasInheritance: snapshot.inheritedTables.has(table),
          persistence: snapshot.tablePersistence.get(table) ?? '',
          columns,
          notNullColumns: new Set(snapshot.notNullColumns.get(table) ?? []),
          columnsWithDefaults: new Set(snapshot.columnsWithDefaults.get(table) ?? []),
          primaryKeyColumns: [...(snapshot.primaryKeyColumns.get(table) ?? [])],
          primaryKeyImmediate: snapshot.immediatePrimaryKeyTables.has(table),
          checkConstraints: [...(snapshot.checkConstraints.get(table) ?? [])],
        });
      }
      return this.classifyWorkflowMigrationSchema(relations);
    }

    const rows = await client.manyOrNone<{
      table_name: string;
      column_name: string | null;
      data_type: string | null;
      is_not_null: boolean | null;
      has_default: boolean | null;
      kind: string;
      is_partition: boolean;
      has_inheritance: boolean;
      persistence: string;
      primary_key_columns: string[];
      primary_key_immediate: boolean;
      check_constraints: SchemaCheckConstraint[];
    }>(
      `SELECT table_row.relname AS table_name,
              table_row.relkind AS kind,
              table_row.relispartition AS is_partition,
              EXISTS (
                SELECT 1
                FROM pg_catalog.pg_inherits AS inheritance_row
                WHERE inheritance_row.inhrelid = table_row.oid
                   OR inheritance_row.inhparent = table_row.oid
              ) AS has_inheritance,
              table_row.relpersistence AS persistence,
              column_row.attname AS column_name,
              CASE WHEN column_row.attname IS NULL THEN NULL
                   ELSE format_type(column_row.atttypid, column_row.atttypmod)
              END AS data_type,
              column_row.attnotnull AS is_not_null,
              (column_row.atthasdef OR column_row.attidentity <> '') AS has_default,
              ARRAY(
                SELECT primary_column.attname::text
                FROM pg_catalog.pg_index AS primary_index
                CROSS JOIN LATERAL unnest(primary_index.indkey)
                  WITH ORDINALITY AS key_column(attnum, ordinal_position)
                JOIN pg_catalog.pg_attribute AS primary_column
                  ON primary_column.attrelid = primary_index.indrelid
                 AND primary_column.attnum = key_column.attnum
                WHERE primary_index.indrelid = table_row.oid
                  AND primary_index.indisprimary
                  AND key_column.ordinal_position <= primary_index.indnkeyatts
                ORDER BY key_column.ordinal_position
              ) AS primary_key_columns,
              COALESCE(
                (
                  SELECT primary_index.indimmediate
                  FROM pg_catalog.pg_index AS primary_index
                  WHERE primary_index.indrelid = table_row.oid
                    AND primary_index.indisprimary
                ),
                FALSE
              ) AS primary_key_immediate,
              COALESCE(
                (
                  SELECT jsonb_agg(
                           jsonb_build_object(
                             'expression', pg_get_expr(check_row.conbin, check_row.conrelid, true),
                             'validated', check_row.convalidated
                           )
                           ORDER BY check_row.oid
                         )
                  FROM pg_catalog.pg_constraint AS check_row
                  WHERE check_row.conrelid = table_row.oid
                    AND check_row.contype = 'c'
                ),
                '[]'::jsonb
              ) AS check_constraints
       FROM pg_catalog.pg_class AS table_row
       JOIN pg_catalog.pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
       LEFT JOIN pg_catalog.pg_attribute AS column_row
         ON column_row.attrelid = table_row.oid
        AND column_row.attnum > 0
        AND NOT column_row.attisdropped
       WHERE namespace_row.nspname = $1
         AND table_row.relkind IN ('r', 'p')
         AND table_row.relname IN ($2, $3, $4, $5)
       ORDER BY table_row.relname, column_row.attnum`,
      [
        this.#schema,
        TABLE_WORKFLOW_SCHEMA_MIGRATIONS,
        TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH,
        TABLE_WORKFLOW_PARENT_REVISIONS,
        TABLE_WORKFLOW_SNAPSHOT,
      ],
    );
    const relations = new Map<string, WorkflowCatalogRelation>();
    for (const row of rows) {
      let relation = relations.get(row.table_name);
      if (!relation) {
        relation = {
          kind: row.kind,
          isPartition: row.is_partition,
          hasInheritance: row.has_inheritance,
          persistence: row.persistence,
          columns: new Map(),
          notNullColumns: new Set(),
          columnsWithDefaults: new Set(),
          primaryKeyColumns: row.primary_key_columns,
          primaryKeyImmediate: row.primary_key_immediate,
          checkConstraints: row.check_constraints,
        };
        relations.set(row.table_name, relation);
      }
      if (row.column_name !== null && row.data_type !== null) {
        relation.columns.set(row.column_name, row.data_type);
        if (row.is_not_null) relation.notNullColumns.add(row.column_name);
        if (row.has_default) relation.columnsWithDefaults.add(row.column_name);
      }
    }
    return this.classifyWorkflowMigrationSchema(relations);
  }

  private async hasWorkflowParentRevisionMigrationMarker(client: Pick<DbClient, 'oneOrNone'>): Promise<boolean> {
    const marker = await client.oneOrNone<{ migration_key: string }>(
      `SELECT migration_key FROM ${this.workflowSchemaMigrationTableName()} WHERE migration_key = $1`,
      [WORKFLOW_PARENT_REVISION_MIGRATION],
    );
    return marker?.migration_key === WORKFLOW_PARENT_REVISION_MIGRATION;
  }

  private async readWorkflowParentRevisionMigrationEvidence(
    client: Pick<DbClient, 'one'>,
  ): Promise<WorkflowParentRevisionMigrationEvidence> {
    return client.one<WorkflowParentRevisionMigrationEvidence>(
      `SELECT
         EXISTS (
           SELECT 1 FROM ${this.workflowSchemaMigrationTableName()} WHERE migration_key = $1
         ) AS marker,
         EXISTS (
           SELECT 1 FROM ${this.workflowParentRevisionMigrationEpochTableName()} WHERE epoch = $2
         ) AS epoch`,
      [WORKFLOW_PARENT_REVISION_MIGRATION, WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH],
    );
  }

  private workflowSnapshotStatusExpression(snapshotColumnType: string, columnReference: string): string {
    if (snapshotColumnType === 'jsonb') {
      return `${columnReference}->>'status'`;
    }
    if (snapshotColumnType === 'json' || snapshotColumnType === 'text') {
      return this.sanitizedWorkflowSnapshotStatusExpression(columnReference);
    }
    throw new TypeError(
      `Workflow parent revision migration does not support snapshot column type ${snapshotColumnType || 'missing'}`,
    );
  }

  private sanitizedWorkflowSnapshotStatusExpression(columnReference: string): string {
    return `regexp_replace((${columnReference}::json)::text, '${PG_UNSAFE_JSON_UNICODE_ESCAPE_PATTERN}', E'\\\\1\\\\2', 'g')::jsonb->>'status'`;
  }

  private requireSupportedWorkflowSnapshotColumnType(snapshotColumnType: string | null): WorkflowSnapshotColumnType {
    if (snapshotColumnType === 'jsonb' || snapshotColumnType === 'json' || snapshotColumnType === 'text') {
      return snapshotColumnType;
    }
    throw new TypeError(
      `Workflow parent revision migration does not support snapshot column type ${snapshotColumnType || 'missing'}`,
    );
  }

  private async resolveWorkflowSnapshotColumnType(
    client: Pick<DbClient, 'oneOrNone'> | Pick<TxClient, 'oneOrNone'>,
  ): Promise<WorkflowSnapshotColumnType> {
    if (this.#initializedWorkflowSnapshotColumnType) {
      return this.#initializedWorkflowSnapshotColumnType;
    }
    const row = await client.oneOrNone<{ data_type: string }>(
      `SELECT format_type(column_row.atttypid, column_row.atttypmod) AS data_type
       FROM pg_catalog.pg_attribute AS column_row
       JOIN pg_catalog.pg_class AS table_row ON table_row.oid = column_row.attrelid
       JOIN pg_catalog.pg_namespace AS namespace_row ON namespace_row.oid = table_row.relnamespace
       WHERE namespace_row.nspname = $1
         AND table_row.relname = $2
         AND table_row.relkind IN ('r', 'p')
         AND column_row.attname = 'snapshot'
         AND column_row.attnum > 0
         AND NOT column_row.attisdropped`,
      [this.#schema, TABLE_WORKFLOW_SNAPSHOT],
    );
    const snapshotColumnType = this.requireSupportedWorkflowSnapshotColumnType(row?.data_type ?? null);
    this.#initializedWorkflowSnapshotColumnType = snapshotColumnType;
    return snapshotColumnType;
  }

  private async withWorkflowSnapshotJsonValidation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isInvalidLegacyWorkflowSnapshotJsonError(error)) {
        throw new TypeError('Workflow parent revision migration found invalid legacy snapshot JSON', { cause: error });
      }
      throw error;
    }
  }

  private noteCurrentWorkflowMigrationSchema(): void {
    const snapshot = getSchemaSnapshot(this.#db.client, this.#schema);
    if (!snapshot) return;
    const noteRelation = (
      table: string,
      columns: Readonly<Record<string, { type: string; notNull: boolean }>>,
      primaryKeyColumns: readonly string[],
      checkExpressions: readonly string[],
    ): void => {
      snapshot.tables.add(table);
      snapshot.tableKinds.set(table, 'r');
      snapshot.partitionedTables.delete(table);
      snapshot.inheritedTables.delete(table);
      snapshot.tablePersistence.set(table, 'p');
      snapshot.columns.set(table, new Set(Object.keys(columns)));
      snapshot.columnTypes.set(table, new Map(Object.entries(columns).map(([column, shape]) => [column, shape.type])));
      snapshot.notNullColumns.set(
        table,
        new Set(Object.entries(columns).flatMap(([column, shape]) => (shape.notNull ? [column] : []))),
      );
      snapshot.columnsWithDefaults.set(table, new Set());
      snapshot.checkConstraints.set(
        table,
        checkExpressions.map(expression => ({ expression, validated: true })),
      );
      snapshot.primaryKeyColumns.set(table, [...primaryKeyColumns]);
      snapshot.immediatePrimaryKeyTables.add(table);
      const primaryKeyName = `${table}_pkey`.toLowerCase();
      snapshot.indexes.add(primaryKeyName);
      snapshot.primaryKeyIndexes.add(primaryKeyName);
    };
    noteRelation(
      TABLE_WORKFLOW_SCHEMA_MIGRATIONS,
      {
        migration_key: { type: 'text', notNull: true },
        applied_at: { type: 'bigint', notNull: true },
      },
      ['migration_key'],
      WORKFLOW_SCHEMA_MIGRATION_CHECKS,
    );
    noteRelation(
      TABLE_WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH,
      {
        epoch: { type: 'smallint', notNull: true },
        created_at: { type: 'bigint', notNull: true },
      },
      ['epoch'],
      WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH_CHECKS,
    );
    noteRelation(
      TABLE_WORKFLOW_PARENT_REVISIONS,
      {
        workflow_name: { type: 'text', notNull: true },
        run_id: { type: 'text', notNull: true },
        generation: { type: 'bigint', notNull: true },
        terminal_status: { type: 'text', notNull: false },
        updated_at: { type: 'bigint', notNull: true },
      },
      ['workflow_name', 'run_id'],
      [...WORKFLOW_PARENT_REVISION_BASE_CHECKS, WORKFLOW_PARENT_REVISION_TERMINAL_STATUS_CHECK],
    );
  }

  private async assertWorkflowParentRevisionIdentityCoverage(t: TxClient, snapshotColumnType: string): Promise<void> {
    const snapshotStatus = this.workflowSnapshotStatusExpression(snapshotColumnType, 'snapshot.snapshot');
    const result = await this.withWorkflowSnapshotJsonValidation(() =>
      t.one<{
        missing_revision: boolean;
        invalid_generation: boolean;
        invalid_updated_at: boolean;
        invalid_snapshot_status: boolean;
        invalid_journal_status: boolean;
        conflicting_terminal_evidence: boolean;
      }>(
        `WITH evidence AS (
         SELECT identity.workflow_name,
                identity.run_id,
                snapshot.run_id IS NOT NULL AS snapshot_exists,
                ${snapshotStatus} AS snapshot_status,
                journal.run_id IS NOT NULL AS journal_exists,
                journal.terminal_status AS journal_terminal_status
         FROM (
           SELECT workflow_name, run_id FROM ${this.workflowSnapshotTableName()}
           UNION
           SELECT workflow_name, run_id FROM ${this.terminalizationTableName()}
         ) AS identity
         LEFT JOIN ${this.workflowSnapshotTableName()} AS snapshot
           ON snapshot.workflow_name = identity.workflow_name AND snapshot.run_id = identity.run_id
         LEFT JOIN ${this.terminalizationTableName()} AS journal
           ON journal.workflow_name = identity.workflow_name AND journal.run_id = identity.run_id
       )
       SELECT
         EXISTS (
           SELECT workflow_name, run_id FROM evidence
           EXCEPT
           SELECT workflow_name, run_id FROM ${this.workflowParentRevisionTableName()}
         ) AS missing_revision,
         EXISTS (
           SELECT 1 FROM ${this.workflowParentRevisionTableName()}
           WHERE generation IS NULL OR generation < 1 OR generation > 9007199254740991
         ) AS invalid_generation,
         EXISTS (
           SELECT 1 FROM ${this.workflowParentRevisionTableName()}
           WHERE updated_at IS NULL OR updated_at < 0
         ) AS invalid_updated_at,
         EXISTS (
           SELECT 1 FROM evidence
           WHERE snapshot_exists
             AND (
               snapshot_status IS NULL
               OR snapshot_status NOT IN (
                 'running', 'success', 'failed', 'tripwire', 'suspended', 'waiting', 'pending',
                 'canceled', 'bailed', 'paused', 'skipped'
               )
             )
         ) AS invalid_snapshot_status,
         EXISTS (
           SELECT 1 FROM evidence
           WHERE journal_exists
             AND (
               journal_terminal_status IS NULL
               OR journal_terminal_status NOT IN ('success', 'failed', 'canceled')
             )
         ) AS invalid_journal_status,
         EXISTS (
           SELECT 1 FROM evidence
           WHERE journal_exists
             AND snapshot_status IN ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')
             AND journal_terminal_status IS DISTINCT FROM snapshot_status
         ) AS conflicting_terminal_evidence`,
      ),
    );
    if (result.missing_revision) {
      throw new TypeError('Workflow parent revision migration found durable identities without revision evidence');
    }
    if (result.invalid_generation) {
      throw new TypeError('Workflow parent revision migration found a non-durable generation');
    }
    if (result.invalid_updated_at) {
      throw new TypeError('Workflow parent revision migration found an invalid update timestamp');
    }
    if (result.invalid_snapshot_status) {
      throw new TypeError('Workflow parent revision migration found an invalid snapshot status');
    }
    if (result.invalid_journal_status) {
      throw new TypeError('Workflow parent revision migration found an invalid terminalization status');
    }
    if (result.conflicting_terminal_evidence) {
      throw new TypeError('Workflow parent revision migration found conflicting terminal evidence');
    }
  }

  private async verifyWorkflowParentRevisionInvariants(t: TxClient, snapshotColumnType: string): Promise<void> {
    await this.assertWorkflowParentRevisionIdentityCoverage(t, snapshotColumnType);
    const snapshotStatus = this.workflowSnapshotStatusExpression(snapshotColumnType, 'snapshot.snapshot');
    const result = await this.withWorkflowSnapshotJsonValidation(() =>
      t.one<{ invalid_terminal_status: boolean; terminal_status_mismatch: boolean }>(
        `WITH evidence AS (
         SELECT identity.workflow_name,
                identity.run_id,
                journal.terminal_status AS journal_terminal_status,
                CASE
                  WHEN ${snapshotStatus} IN ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')
                    THEN ${snapshotStatus}
                  ELSE NULL
                END AS snapshot_terminal_status
         FROM (
           SELECT workflow_name, run_id FROM ${this.workflowSnapshotTableName()}
           UNION
           SELECT workflow_name, run_id FROM ${this.terminalizationTableName()}
         ) AS identity
         LEFT JOIN ${this.terminalizationTableName()} AS journal
           ON journal.workflow_name = identity.workflow_name AND journal.run_id = identity.run_id
         LEFT JOIN ${this.workflowSnapshotTableName()} AS snapshot
           ON snapshot.workflow_name = identity.workflow_name AND snapshot.run_id = identity.run_id
       )
       SELECT
         EXISTS (
           SELECT 1 FROM ${this.workflowParentRevisionTableName()}
           WHERE terminal_status IS NOT NULL
             AND terminal_status NOT IN ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')
         ) AS invalid_terminal_status,
         EXISTS (
           SELECT 1
           FROM evidence
           JOIN ${this.workflowParentRevisionTableName()} AS revision
             ON revision.workflow_name = evidence.workflow_name AND revision.run_id = evidence.run_id
           WHERE revision.terminal_status IS DISTINCT FROM
             COALESCE(evidence.journal_terminal_status, evidence.snapshot_terminal_status)
         ) AS terminal_status_mismatch`,
      ),
    );
    if (result.invalid_terminal_status) {
      throw new TypeError('Workflow parent revision migration found an invalid terminal status');
    }
    if (result.terminal_status_mismatch) {
      throw new TypeError('Workflow parent revision migration found mismatched terminal status evidence');
    }
  }

  private async migrateWorkflowParentRevisions(): Promise<WorkflowSnapshotColumnType> {
    const initial = await this.inspectWorkflowMigrationSchema(this.#db.client, true);
    if (initial.markerTable === 'incompatible') {
      throw new TypeError('Workflow parent revision migration marker table has an incompatible shape');
    }
    if (initial.epochTable === 'incompatible') {
      throw new TypeError('Workflow parent revision migration epoch table has an incompatible shape');
    }
    if (initial.epochTable === 'current') {
      if (initial.markerTable !== 'current') {
        throw new TypeError('Workflow parent revision migration provenance is damaged or incomplete');
      }
      const evidence = await this.readWorkflowParentRevisionMigrationEvidence(this.#db.client);
      if (!evidence.marker || !evidence.epoch) {
        throw new TypeError('Workflow parent revision migration provenance is damaged or incomplete');
      }
      if (initial.parentRevisions !== 'current') {
        throw new TypeError('Workflow parent revision migration marker conflicts with the durable schema');
      }
      if (initial.snapshotColumnType !== null) {
        return this.requireSupportedWorkflowSnapshotColumnType(initial.snapshotColumnType);
      }
      const live = await this.inspectWorkflowMigrationSchema(this.#db.client, false);
      return this.requireSupportedWorkflowSnapshotColumnType(live.snapshotColumnType);
    }
    if (initial.markerTable === 'current' && (await this.hasWorkflowParentRevisionMigrationMarker(this.#db.client))) {
      throw new TypeError('Workflow parent revision migration provenance is damaged or incomplete');
    }

    const snapshotColumnType = await this.#db.client.tx(async t => {
      await t.none(
        `SELECT pg_advisory_xact_lock(
           hashtextextended(current_database() || E'\\n' || $1 || E'\\n' || $2, 0)
         )`,
        [this.#schema, WORKFLOW_PARENT_REVISION_MIGRATION],
      );

      let state = await this.inspectWorkflowMigrationSchema(t, false);
      if (state.markerTable === 'incompatible') {
        throw new TypeError('Workflow parent revision migration marker table has an incompatible shape');
      }
      if (state.epochTable === 'incompatible') {
        throw new TypeError('Workflow parent revision migration epoch table has an incompatible shape');
      }
      if (state.epochTable === 'current' && state.markerTable !== 'current') {
        throw new TypeError('Workflow parent revision migration provenance is damaged or incomplete');
      }
      if (
        state.markerTable === 'current' &&
        state.epochTable === 'absent' &&
        (await this.hasWorkflowParentRevisionMigrationMarker(t))
      ) {
        throw new TypeError('Workflow parent revision migration provenance is damaged or incomplete');
      }
      if (state.markerTable === 'absent') {
        await t.none(WorkflowsPG.getWorkflowSchemaMigrationTableDDL(this.#schema));
      }
      if (state.epochTable === 'absent') {
        await t.none(WorkflowsPG.getWorkflowParentRevisionMigrationEpochTableDDL(this.#schema));
      }
      state = await this.inspectWorkflowMigrationSchema(t, false);
      if (state.markerTable !== 'current') {
        throw new TypeError('Workflow parent revision migration marker table has an incompatible shape');
      }
      if (state.epochTable !== 'current') {
        throw new TypeError('Workflow parent revision migration epoch table has an incompatible shape');
      }

      const evidence = await this.readWorkflowParentRevisionMigrationEvidence(t);
      if (evidence.marker || evidence.epoch) {
        if (!evidence.marker || !evidence.epoch) {
          throw new TypeError('Workflow parent revision migration provenance is damaged or incomplete');
        }
        if (state.parentRevisions !== 'current') {
          throw new TypeError('Workflow parent revision migration marker conflicts with the durable schema');
        }
        return this.requireSupportedWorkflowSnapshotColumnType(state.snapshotColumnType);
      }

      if (state.parentRevisions === 'incompatible') {
        throw new TypeError('Workflow parent revision table has an incompatible shape');
      }
      const preLockRevisionShape = state.parentRevisions;

      // Acquire each relation's final blocking mode up front. Journal-first
      // matches terminalization, while EXCLUSIVE revision/snapshot locks drain
      // both SELECT ... FOR UPDATE and DML before migration inspects evidence.
      await t.none(`LOCK TABLE ${this.terminalizationTableName()} IN EXCLUSIVE MODE`);
      if (preLockRevisionShape === 'legacy') {
        await t.none(`LOCK TABLE ${this.workflowParentRevisionTableName()} IN ACCESS EXCLUSIVE MODE`);
      } else if (preLockRevisionShape === 'current') {
        await t.none(`LOCK TABLE ${this.workflowParentRevisionTableName()} IN EXCLUSIVE MODE`);
      }
      await t.none(`LOCK TABLE ${this.workflowSnapshotTableName()} IN EXCLUSIVE MODE`);

      state = await this.inspectWorkflowMigrationSchema(t, false);
      if (state.markerTable !== 'current' || state.epochTable !== 'current') {
        throw new TypeError('Workflow parent revision migration provenance changed during migration');
      }
      const evidenceAfterLocks = await this.readWorkflowParentRevisionMigrationEvidence(t);
      if (evidenceAfterLocks.marker || evidenceAfterLocks.epoch) {
        if (!evidenceAfterLocks.marker || !evidenceAfterLocks.epoch) {
          throw new TypeError('Workflow parent revision migration provenance is damaged or incomplete');
        }
        if (state.parentRevisions !== 'current') {
          throw new TypeError('Workflow parent revision migration marker conflicts with the durable schema');
        }
        return this.requireSupportedWorkflowSnapshotColumnType(state.snapshotColumnType);
      }
      if (state.parentRevisions !== preLockRevisionShape) {
        throw new TypeError('Workflow parent revision table changed during migration');
      }
      const snapshotColumnType = this.requireSupportedWorkflowSnapshotColumnType(state.snapshotColumnType);
      const snapshotStatus = this.workflowSnapshotStatusExpression(snapshotColumnType, 'snapshot.snapshot');

      if (state.parentRevisions === 'absent') {
        await t.none(WorkflowsPG.getWorkflowParentRevisionTableDDL(this.#schema));
        await this.withWorkflowSnapshotJsonValidation(() =>
          t.none(
            `INSERT INTO ${this.workflowParentRevisionTableName()}
           (workflow_name, run_id, generation, terminal_status, updated_at)
           SELECT identity.workflow_name,
                  identity.run_id,
                  1,
                  COALESCE(
                    journal.terminal_status,
                    CASE
                      WHEN ${snapshotStatus} IN
                        ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')
                        THEN ${snapshotStatus}
                      ELSE NULL
                    END
                  ),
                  floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint
           FROM (
             SELECT workflow_name, run_id FROM ${this.workflowSnapshotTableName()}
             UNION
             SELECT workflow_name, run_id FROM ${this.terminalizationTableName()}
           ) AS identity
           LEFT JOIN ${this.terminalizationTableName()} AS journal
             ON journal.workflow_name = identity.workflow_name AND journal.run_id = identity.run_id
           LEFT JOIN ${this.workflowSnapshotTableName()} AS snapshot
             ON snapshot.workflow_name = identity.workflow_name AND snapshot.run_id = identity.run_id`,
          ),
        );
      } else if (state.parentRevisions === 'legacy') {
        await this.assertWorkflowParentRevisionIdentityCoverage(t, snapshotColumnType);
        await t.none(`ALTER TABLE ${this.workflowParentRevisionTableName()} ADD COLUMN "terminal_status" TEXT`);
        await t.none(
          `ALTER TABLE ${this.workflowParentRevisionTableName()}
           ADD CONSTRAINT "mastra_workflow_parent_revisions_terminal_status_check"
           CHECK ("terminal_status" IS NULL OR "terminal_status" IN
             ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped'))`,
        );
        await this.withWorkflowSnapshotJsonValidation(() =>
          t.none(
            `WITH evidence AS (
             SELECT identity.workflow_name,
                    identity.run_id,
                    COALESCE(
                      journal.terminal_status,
                      CASE
                        WHEN ${snapshotStatus} IN
                          ('success', 'failed', 'canceled', 'tripwire', 'bailed', 'skipped')
                          THEN ${snapshotStatus}
                        ELSE NULL
                      END
                    ) AS terminal_status
             FROM (
               SELECT workflow_name, run_id FROM ${this.workflowSnapshotTableName()}
               UNION
               SELECT workflow_name, run_id FROM ${this.terminalizationTableName()}
             ) AS identity
             LEFT JOIN ${this.terminalizationTableName()} AS journal
               ON journal.workflow_name = identity.workflow_name AND journal.run_id = identity.run_id
             LEFT JOIN ${this.workflowSnapshotTableName()} AS snapshot
               ON snapshot.workflow_name = identity.workflow_name AND snapshot.run_id = identity.run_id
           )
           UPDATE ${this.workflowParentRevisionTableName()} AS revision
           SET terminal_status = evidence.terminal_status
           FROM evidence
           WHERE revision.workflow_name = evidence.workflow_name
             AND revision.run_id = evidence.run_id
             AND evidence.terminal_status IS NOT NULL`,
          ),
        );
      } else if (state.parentRevisions !== 'current') {
        throw new TypeError('Workflow parent revision table has an incompatible shape');
      }

      const converged = await this.inspectWorkflowMigrationSchema(t, false);
      if (converged.parentRevisions !== 'current') {
        throw new TypeError('Workflow parent revision migration did not produce the current schema');
      }
      await this.verifyWorkflowParentRevisionInvariants(t, snapshotColumnType);
      await t.none(
        `INSERT INTO ${this.workflowParentRevisionMigrationEpochTableName()} (epoch, created_at)
         VALUES ($1, floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)`,
        [WORKFLOW_PARENT_REVISION_MIGRATION_EPOCH],
      );
      await t.none(
        `INSERT INTO ${this.workflowSchemaMigrationTableName()} (migration_key, applied_at)
         VALUES ($1, floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)`,
        [WORKFLOW_PARENT_REVISION_MIGRATION],
      );
      return snapshotColumnType;
    });

    this.noteCurrentWorkflowMigrationSchema();
    return snapshotColumnType;
  }

  /**
   * Returns the workflow snapshot index plus the terminalization recovery and retention indexes.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return WorkflowsPG.getDefaultIndexDefs(schemaPrefix);
  }

  /**
   * Creates default indexes for optimal query performance, including the
   * terminalization recovery and retention indexes.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        if (this.#db.isExternalSchemaMode()) throw error;
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }

    // Expression index backing the status filter in listWorkflowRuns(). Only valid on jsonb
    // columns — legacy json/text snapshot columns still go through the sanitizing regexp,
    // which cannot use an index anyway.
    const snapshotType = await this.#db.getColumnType(TABLE_WORKFLOW_SNAPSHOT, 'snapshot');
    if (snapshotType !== 'jsonb') return;

    const indexName = workflowSnapshotStatusIndexName(this.#schema);
    try {
      await this.#db.createIndexFromStatement(indexName, workflowSnapshotStatusIndexSQL(indexName, this.#schema));
    } catch (error) {
      if (this.#db.isExternalSchemaMode()) throw error;
      this.logger?.warn?.(`Failed to create index ${indexName}:`, error);
    }
  }

  async init(): Promise<void> {
    if (this.#db.isExternalSchemaMode()) {
      // Validate the snapshot table and indexes without running the terminal
      // table migrations below. The store-level initializer already skips
      // this path; this covers direct and composite overrides.
      await this.#db.validateExternalSchemaTables(WorkflowsPG.MANAGED_TABLES);
      await this.#db.createTable({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      });
      await this.createDefaultIndexes();
      await this.createCustomIndexes();
      return;
    }

    await this.#db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] });
    await this.#db.client.none(WorkflowsPG.getTerminalizationTableDDL(this.#schema));
    await this.#db.client.none(WorkflowsPG.getTerminalEffectTableDDL(this.#schema));
    await this.#db.client.none(WorkflowsPG.getTerminalSnapshotTableDDL(this.#schema));
    await this.#db.client.none(WorkflowsPG.getTerminalRecoveryAncestryTableDDL(this.#schema));
    await this.#db.client.none(WorkflowsPG.getTerminalDestinationReceiptTableDDL(this.#schema));
    await this.#db.client.none(WorkflowsPG.getWorkflowSnapshotHandoffTableDDL(this.#schema));
    const snapshotColumnType = await this.migrateWorkflowParentRevisions();
    await this.#db.client.none(WorkflowsPG.getTerminalContinuationPlanTableDDL(this.#schema));
    await this.#db.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      ifNotExists: ['resourceId'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
    this.#initializedWorkflowSnapshotColumnType = snapshotColumnType;
  }

  /**
   * Lazily ensures a btree index exists on each configured policy's retention
   * anchor column so age-based `prune()` deletes stay fast on large tables.
   * Called from the prune path (not init) so only deployments that configure
   * retention pay the index's write/disk overhead. Best-effort: failures are
   * logged and pruning proceeds (correct, just slower).
   * Created even with `skipDefaultIndexes` — retention is an explicit opt-in,
   * so its supporting index is not part of the default index set.
   */
  private async ensureRetentionIndexes(policies: Record<string, TableRetentionPolicy>): Promise<void> {
    const prefix = this.#schema && this.#schema !== 'public' ? `${this.#schema}_` : '';
    for (const [key, entry] of Object.entries(WorkflowsPG.retentionTables)) {
      if (!entry.indexed || !policies[key]) continue;
      try {
        await this.#db.ensureIndex({
          indexName: `${prefix}mastra_${key}_retention_idx`,
          tableName: entry.table as TABLE_NAMES,
          column: entry.column,
        });
      } catch (error) {
        if (this.#db.isExternalSchemaMode()) throw error;
        this.logger?.warn?.(`Failed to create retention index for ${entry.table}:`, error);
      }
    }
  }

  /** Delete workflow run snapshots older than the `workflowSnapshot` policy's `maxAge`, batched. */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    await this.ensureRetentionIndexes(policies);
    const targets = resolveTargets({
      policies,
      descriptor: WorkflowsPG.retentionTables,
      order: ['workflowSnapshot'],
    });
    return runPrune({ db: this.#db, domain: 'workflows', targets, options });
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        if (this.#db.isExternalSchemaMode()) throw error;
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.client.none(
      `TRUNCATE TABLE ${this.terminalContinuationPlanTableName()}, ${this.terminalDestinationReceiptTableName()}, ${this.terminalEffectTableName()}, ${this.terminalSnapshotTableName()}, ${this.terminalRecoveryAncestryTableName()}, ${this.terminalizationTableName()}, ${this.workflowSnapshotHandoffTableName()}, ${this.workflowSnapshotTableName()}, ${this.workflowParentRevisionTableName()} CASCADE`,
    );
  }

  async bindWorkflowNestedRunOwnership(
    input: BindWorkflowNestedRunOwnershipInput,
  ): Promise<BindWorkflowNestedRunOwnershipResult> {
    const operation = {
      workflowName: input.workflowName,
      runId: input.runId,
      stepId: input.stepId,
      nestedRunId: input.nestedRunId,
      forEachIndex: input.forEachIndex,
      result: input.result,
      requestContext: input.requestContext,
    };
    validateWorkflowNestedRunOwnershipInput(operation);
    try {
      return await this.#db.client.tx(async t => {
        const tableName = this.workflowSnapshotTableName();
        const revisionLock = await this.lockExistingWorkflowParentRevision(t, operation.workflowName, operation.runId);
        await this.assertWorkflowSnapshotHandoffAvailable(t, operation.workflowName, operation.runId);
        const row = await t.oneOrNone<{ snapshot: WorkflowRunState }>(
          `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.workflowName, operation.runId],
        );
        if (!row) {
          return { status: 'missing_run' };
        }
        if (!revisionLock) {
          throw new TypeError('Workflow snapshot is missing parent revision evidence');
        }
        const revision = revisionLock.generation;
        const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
        const ownership = bindWorkflowNestedRunOwnershipRecord(snapshot, operation);
        if (ownership.status === 'ownership_conflict') return ownership;
        if (ownership.status === 'already_bound') {
          return { status: 'already_bound', stepResults: ownership.snapshot.context };
        }
        const serialized = sanitizeJsonForPg(JSON.stringify(ownership.snapshot));
        const now = new Date();
        await t.none(
          `UPDATE ${tableName}
           SET snapshot = $1, "updatedAt" = $2, "updatedAtZ" = $3
           WHERE workflow_name = $4 AND run_id = $5`,
          [serialized, now, now, operation.workflowName, operation.runId],
        );
        await this.bumpWorkflowParentRevision(t, operation.workflowName, operation.runId, revision);
        return {
          status: 'bound',
          stepResults: ownership.snapshot.context,
        };
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'BIND_WORKFLOW_NESTED_RUN_OWNERSHIP', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName: operation.workflowName, runId: operation.runId, stepId: operation.stepId },
        },
        error,
      );
    }
  }

  async admitWorkflowNestedRun(input: AdmitWorkflowNestedRunInput): Promise<AdmitWorkflowNestedRunResult> {
    const capturedInput = captureWorkflowNestedRunAdmissionInput(input);
    const requestedInitialChildSnapshot = capturedInput.initialChildSnapshot;
    const expectedChildGraphFingerprint = capturedInput.expectedChildGraphFingerprint;
    const initialChildSnapshot = validateWorkflowNestedRunInitialSnapshot(
      requestedInitialChildSnapshot,
      capturedInput.nestedRunId,
      expectedChildGraphFingerprint,
    );
    const serializedInitialChildSnapshot = initialChildSnapshot
      ? sanitizeJsonForPg(JSON.stringify(initialChildSnapshot.snapshot))
      : undefined;
    const requested = createWorkflowTerminalRecoveryAncestryRecord(
      capturedInput.nestedWorkflowName,
      capturedInput.nestedRunId,
      capturedInput.recoveryAncestry,
      0,
    );
    const operation = {
      workflowName: capturedInput.workflowName,
      runId: capturedInput.runId,
      stepId: capturedInput.stepId,
      nestedWorkflowName: requested.workflowName,
      nestedRunId: requested.runId,
      forEachIndex: capturedInput.forEachIndex,
      result: capturedInput.result,
      requestContext: capturedInput.requestContext,
      recoveryAncestry: requested.ancestry,
    };
    validateWorkflowNestedRunOwnershipInput(operation);
    validateWorkflowTerminalizationIdentity(operation.nestedWorkflowName, 'nestedWorkflowName', 512);

    try {
      return await this.#db.client.tx(async t => {
        const lockedIdentities = new Set([
          JSON.stringify([operation.nestedWorkflowName, operation.nestedRunId]),
          ...operation.recoveryAncestry.map(frame => JSON.stringify([frame.parentWorkflowName, frame.parentRunId])),
        ]);
        for (const identity of [...lockedIdentities].sort()) {
          await t.none(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [identity]);
        }
        const clock = await t.one<{ now_ms: string }>(
          `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
        );
        const now = Number(clock.now_ms);
        if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Invalid PostgreSQL admission clock');
        const recovery = createWorkflowTerminalRecoveryAncestryRecord(
          operation.nestedWorkflowName,
          operation.nestedRunId,
          operation.recoveryAncestry,
          now,
        );
        const immediate = recovery.ancestry[0];
        const expectedSource =
          immediate &&
          immediate.parentWorkflowName === operation.workflowName &&
          immediate.parentRunId === operation.runId &&
          immediate.source.stepId === operation.stepId &&
          (operation.forEachIndex === undefined
            ? immediate.source.kind === 'step'
            : immediate.source.kind === 'foreach-iteration' &&
              immediate.source.iterationIndex === operation.forEachIndex);
        if (!expectedSource) return { status: 'ancestry_conflict' };

        let revisionLock: WorkflowParentRevisionLock | undefined;
        try {
          revisionLock = await this.lockExistingWorkflowParentRevision(t, operation.workflowName, operation.runId);
        } catch (error) {
          if (error instanceof TypeError) return { status: 'parent_snapshot_conflict' };
          throw error;
        }
        const parentRow = await t.oneOrNone<{ snapshot: WorkflowRunState | string }>(
          `SELECT snapshot FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.workflowName, operation.runId],
        );
        await this.assertWorkflowSnapshotHandoffAvailable(t, operation.workflowName, operation.runId);
        if (!parentRow) {
          return { status: 'missing_run' };
        }
        if (!revisionLock) return { status: 'parent_snapshot_conflict' };
        if (revisionLock.terminalStatus !== null) return { status: 'parent_terminal' };
        const snapshot = typeof parentRow.snapshot === 'string' ? JSON.parse(parentRow.snapshot) : parentRow.snapshot;
        try {
          validateWorkflowRunSnapshotShape(snapshot, operation.runId, 'Nested workflow parent snapshot');
        } catch {
          return { status: 'parent_snapshot_conflict' };
        }
        if (isTerminalWorkflowRunStatus(snapshot.status)) {
          await this.latchWorkflowParentTerminalStatus(t, operation.workflowName, operation.runId, snapshot.status);
          return { status: 'parent_terminal' };
        }
        const revision = revisionLock.generation;
        validateWorkflowTerminalRecoveryParentFrameGraphBinding(immediate, snapshot.serializedStepGraph);

        const parentRecoveryRow = await t.oneOrNone<Record<string, unknown>>(
          `SELECT * FROM ${this.terminalRecoveryAncestryTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.workflowName, operation.runId],
        );
        const parentRecovery = parentRecoveryRow
          ? this.decodeTerminalRecoveryAncestryRow(parentRecoveryRow, now)
          : undefined;
        const expectedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
          operation.workflowName,
          operation.runId,
          recovery.ancestry.slice(1),
          now,
        ).ancestryHash;
        const retainedTailHash = createWorkflowTerminalRecoveryAncestryRecord(
          operation.workflowName,
          operation.runId,
          parentRecovery?.ancestry ?? [],
          now,
        ).ancestryHash;
        if (expectedTailHash !== retainedTailHash) return { status: 'ancestry_conflict' };

        const childRecoveryRow = await t.oneOrNone<Record<string, unknown>>(
          `SELECT * FROM ${this.terminalRecoveryAncestryTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.nestedWorkflowName, operation.nestedRunId],
        );
        const existingRecovery = childRecoveryRow
          ? this.decodeTerminalRecoveryAncestryRow(childRecoveryRow, now)
          : undefined;
        if (existingRecovery && !sameWorkflowTerminalRecoveryAncestry(existingRecovery, recovery)) {
          return { status: 'ancestry_conflict' };
        }

        const ownership = bindWorkflowNestedRunOwnershipRecord(snapshot, operation);
        if (ownership.status === 'ownership_conflict') return ownership;
        if (ownership.status === 'bound' && existingRecovery) {
          return { status: 'ancestry_conflict' };
        }

        // The child revision is the serialization point shared with generic
        // snapshot writers. Inspect the retained row while that lock is held,
        // before mutating parent ownership or recovery ancestry.
        let childRevision: WorkflowParentRevisionCreationLock;
        try {
          childRevision = await this.lockWorkflowParentRevisionForSnapshotUpsert(
            t,
            operation.nestedWorkflowName,
            operation.nestedRunId,
          );
        } catch (error) {
          if (error instanceof TypeError) return { status: 'child_snapshot_conflict' };
          throw error;
        }
        await this.assertWorkflowSnapshotHandoffAvailable(t, operation.nestedWorkflowName, operation.nestedRunId);
        if (childRevision.terminalStatus !== null) return { status: 'child_terminal' };
        const childRow = await t.oneOrNone<{ snapshot: WorkflowRunState | string }>(
          `SELECT snapshot FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [operation.nestedWorkflowName, operation.nestedRunId],
        );
        let retainedChildSnapshot: WorkflowRunState | undefined;
        if (childRow) {
          if (childRevision.created) {
            await this.deleteProvisionalWorkflowParentRevision(
              t,
              operation.nestedWorkflowName,
              operation.nestedRunId,
              true,
            );
            return { status: 'child_snapshot_conflict' };
          }
          try {
            retainedChildSnapshot =
              typeof childRow.snapshot === 'string' ? JSON.parse(childRow.snapshot) : childRow.snapshot;
          } catch {
            return { status: 'child_snapshot_conflict' };
          }
          const inspection = inspectWorkflowNestedRunRetainedSnapshot(
            retainedChildSnapshot,
            operation.nestedRunId,
            expectedChildGraphFingerprint,
          );
          if (inspection.status === 'conflict') {
            return { status: 'child_snapshot_conflict' };
          }
          if (inspection.status === 'terminal') {
            await this.latchWorkflowParentTerminalStatus(
              t,
              operation.nestedWorkflowName,
              operation.nestedRunId,
              inspection.terminalStatus,
            );
            return { status: 'child_terminal' };
          }
        }

        const ensureInitialChildSnapshot = async (): Promise<'initialized' | 'retained' | 'not_requested'> => {
          if (retainedChildSnapshot) {
            return initialChildSnapshot ? 'retained' : 'not_requested';
          }
          if (!initialChildSnapshot || serializedInitialChildSnapshot === undefined) {
            await this.deleteProvisionalWorkflowParentRevision(
              t,
              operation.nestedWorkflowName,
              operation.nestedRunId,
              childRevision.created,
            );
            return 'not_requested';
          }
          const timestamp = new Date(now);
          await t.none(
            `INSERT INTO ${this.workflowSnapshotTableName()}
             (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              operation.nestedWorkflowName,
              operation.nestedRunId,
              initialChildSnapshot.resourceId ?? null,
              serializedInitialChildSnapshot,
              timestamp,
              timestamp,
              timestamp,
              timestamp,
            ],
          );
          await this.bumpWorkflowParentRevision(
            t,
            operation.nestedWorkflowName,
            operation.nestedRunId,
            childRevision.generation,
          );
          return 'initialized';
        };
        if (ownership.status === 'already_bound' && existingRecovery) {
          const childSnapshotState = await ensureInitialChildSnapshot();
          return {
            status: 'already_admitted',
            stepResults: ownership.snapshot.context,
            recovery: copyWorkflowTerminalRecoveryAncestryRecord(existingRecovery),
            childSnapshotState,
          };
        }
        // A nested run may begin transiently and become durable only after it
        // suspends. In that path the parent owner is already bound while the
        // retained child snapshot exists without recovery ancestry. Promote
        // that exact owner under the same transaction; missing child evidence
        // still fails closed.
        if (ownership.status === 'already_bound' && !retainedChildSnapshot && !initialChildSnapshot) {
          await this.deleteProvisionalWorkflowParentRevision(
            t,
            operation.nestedWorkflowName,
            operation.nestedRunId,
            childRevision.created,
          );
          return { status: 'ancestry_conflict' };
        }
        const serialized = sanitizeJsonForPg(JSON.stringify(ownership.snapshot));
        const timestamp = new Date(now);
        await t.none(
          `INSERT INTO ${this.terminalRecoveryAncestryTableName()}
           (workflow_name, run_id, version, ancestry_hash, ancestry,
            immediate_parent_workflow_name, immediate_parent_run_id, created_at)
           VALUES ($1, $2, 1, $3, $4, $5, $6, $7)`,
          [
            recovery.workflowName,
            recovery.runId,
            recovery.ancestryHash,
            JSON.stringify(recovery.ancestry),
            immediate.parentWorkflowName,
            immediate.parentRunId,
            recovery.createdAt,
          ],
        );
        if (ownership.status === 'bound') {
          await this.assertWorkflowSnapshotHandoffAvailable(t, operation.workflowName, operation.runId);
          await t.none(
            `UPDATE ${this.workflowSnapshotTableName()}
             SET snapshot = $1, "updatedAt" = $2, "updatedAtZ" = $3
             WHERE workflow_name = $4 AND run_id = $5`,
            [serialized, timestamp, timestamp, operation.workflowName, operation.runId],
          );
          await this.bumpWorkflowParentRevision(t, operation.workflowName, operation.runId, revision);
        }
        const childSnapshotState = await ensureInitialChildSnapshot();
        return {
          status: 'admitted',
          stepResults: ownership.snapshot.context,
          recovery: copyWorkflowTerminalRecoveryAncestryRecord(recovery),
          childSnapshotState,
        };
      });
    } catch (error) {
      return this.terminalizationError(
        'ADMIT_WORKFLOW_NESTED_RUN',
        operation.nestedWorkflowName,
        operation.nestedRunId,
        error,
      );
    }
  }

  async claimWorkflowSnapshotHandoff(
    input: ClaimWorkflowSnapshotHandoffInput,
  ): Promise<ClaimWorkflowSnapshotHandoffResult> {
    validateWorkflowSnapshotHandoffFence(input.mutationFence);
    const serializedSnapshot = sanitizeJsonForPg(JSON.stringify(input.snapshot));
    return this.#db.client.tx(async t => {
      const revision = await this.lockWorkflowParentRevisionForSnapshotHandoff(t, input.workflowName, input.runId);
      const observedCanonical = await this.lockWorkflowSnapshotHandoffCanonicalState(
        t,
        input.workflowName,
        input.runId,
      );
      if (!workflowSnapshotHandoffCanonicalStatesEqual(input.expectedCanonical, observedCanonical)) {
        await this.deleteProvisionalWorkflowParentRevision(t, input.workflowName, input.runId, revision.created, 1);
        return { status: 'conflict', observedCanonical };
      }
      const existing = await this.lockWorkflowSnapshotHandoff(t, input.workflowName, input.runId);
      if (existing) {
        const same =
          existing.mutationFence === input.mutationFence &&
          existing.resourceId === input.resourceId &&
          workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, input.snapshot);
        if (existing.status === 'completed' && existing.mutationFence !== input.mutationFence) {
          return { status: 'conflict', record: existing };
        }
        return {
          status: existing.status === 'completed' ? 'completed' : same ? 'existing' : 'conflict',
          record: existing,
        } as ClaimWorkflowSnapshotHandoffResult;
      }
      const clock = await t.one<{ now_ms: string }>(
        `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
      );
      const now = Number(clock.now_ms);
      if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Invalid PostgreSQL workflow handoff clock');
      await t.none(
        `INSERT INTO ${this.workflowSnapshotHandoffTableName()}
         (workflow_name, run_id, version, status, resource_id, snapshot, mutation_fence, created_at, updated_at)
         VALUES ($1, $2, 1, 'pending', $3, $4, $5, $6, $6)`,
        [input.workflowName, input.runId, input.resourceId ?? null, serializedSnapshot, input.mutationFence, now],
      );
      return {
        status: 'created',
        record: {
          version: 1,
          workflowName: input.workflowName,
          runId: input.runId,
          status: 'pending',
          ...(input.resourceId === undefined ? {} : { resourceId: input.resourceId }),
          snapshot: JSON.parse(serializedSnapshot) as WorkflowRunState,
          mutationFence: input.mutationFence,
          createdAt: now,
          updatedAt: now,
        },
      };
    });
  }

  async transitionWorkflowSnapshotHandoff(
    input: TransitionWorkflowSnapshotHandoffInput,
  ): Promise<TransitionWorkflowSnapshotHandoffResult> {
    validateWorkflowSnapshotHandoffFence(input.mutationFence);
    const serializedSnapshot = sanitizeJsonForPg(JSON.stringify(input.snapshot));
    return this.#db.client.tx(async t => {
      await this.lockExistingWorkflowParentRevision(t, input.workflowName, input.runId);
      const existing = await this.lockWorkflowSnapshotHandoff(t, input.workflowName, input.runId);
      if (!existing) return { status: 'missing' };
      if (existing.status === 'completed') {
        return existing.mutationFence === input.mutationFence
          ? { status: 'completed', record: existing }
          : { status: 'conflict', record: existing };
      }
      const expectedMatches =
        existing.mutationFence === input.mutationFence &&
        existing.resourceId === input.expectedResourceId &&
        workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, input.expectedSnapshot);
      if (!expectedMatches) return { status: 'conflict', record: existing };
      const sameReplacement =
        existing.resourceId === input.resourceId &&
        workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, input.snapshot);
      if (sameReplacement) return { status: 'existing', record: existing };
      const clock = await t.one<{ now_ms: string }>(
        `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
      );
      const now = Number(clock.now_ms);
      if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Invalid PostgreSQL workflow handoff clock');
      await t.none(
        `UPDATE ${this.workflowSnapshotHandoffTableName()}
         SET resource_id = $1, snapshot = $2, updated_at = $3
         WHERE workflow_name = $4 AND run_id = $5`,
        [input.resourceId ?? null, serializedSnapshot, now, input.workflowName, input.runId],
      );
      return {
        status: 'transitioned',
        record: {
          ...existing,
          ...(input.resourceId === undefined ? { resourceId: undefined } : { resourceId: input.resourceId }),
          snapshot: JSON.parse(serializedSnapshot) as WorkflowRunState,
          updatedAt: now,
        },
      };
    });
  }

  async completeWorkflowSnapshotHandoff(
    input: CompleteWorkflowSnapshotHandoffInput,
  ): Promise<CompleteWorkflowSnapshotHandoffResult> {
    validateWorkflowSnapshotHandoffFence(input.mutationFence);
    const serializedSnapshot = sanitizeJsonForPg(JSON.stringify(input.snapshot));
    return this.#db.client.tx(async t => {
      await this.lockExistingWorkflowParentRevision(t, input.workflowName, input.runId);
      const existing = await this.lockWorkflowSnapshotHandoff(t, input.workflowName, input.runId);
      if (!existing) return { status: 'missing' };
      if (existing.status === 'completed') {
        return existing.mutationFence === input.mutationFence
          ? { status: 'already_completed', record: existing }
          : { status: 'conflict', record: existing };
      }
      const expectedMatches =
        existing.mutationFence === input.mutationFence &&
        existing.resourceId === input.expectedResourceId &&
        workflowSnapshotHandoffSnapshotsEqual(existing.snapshot, input.expectedSnapshot);
      if (!expectedMatches) return { status: 'conflict', record: existing };
      const clock = await t.one<{ now_ms: string }>(
        `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
      );
      const now = Number(clock.now_ms);
      if (!Number.isSafeInteger(now) || now < 0) throw new TypeError('Invalid PostgreSQL workflow handoff clock');
      await t.none(
        `UPDATE ${this.workflowSnapshotHandoffTableName()}
         SET status = 'completed', resource_id = $1, snapshot = $2, updated_at = $3, completed_at = $3
         WHERE workflow_name = $4 AND run_id = $5`,
        [input.resourceId ?? null, serializedSnapshot, now, input.workflowName, input.runId],
      );
      return {
        status: 'completed',
        record: {
          ...existing,
          status: 'completed',
          ...(input.resourceId === undefined ? { resourceId: undefined } : { resourceId: input.resourceId }),
          snapshot: JSON.parse(serializedSnapshot) as WorkflowRunState,
          updatedAt: now,
          completedAt: now,
        },
      };
    });
  }

  async listWorkflowSnapshotHandoffs(
    input: ListWorkflowSnapshotHandoffsInput = {},
  ): Promise<ListWorkflowSnapshotHandoffsResult> {
    const limit = validateWorkflowSnapshotHandoffLimit(input.limit);
    const values: unknown[] = [];
    const clauses: string[] = [];
    const add = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };
    if (input.workflowName !== undefined) clauses.push(`workflow_name = ${add(input.workflowName)}`);
    if (input.status !== undefined) clauses.push(`status = ${add(input.status)}`);
    if (input.after) {
      const updatedAt = add(input.after.updatedAt);
      const workflowName = add(input.after.workflowName);
      const runId = add(input.after.runId);
      clauses.push(`(updated_at, workflow_name, run_id) > (${updatedAt}, ${workflowName}, ${runId})`);
    }
    values.push(limit + 1);
    const rows = await this.#db.client.any<Record<string, unknown>>(
      `SELECT * FROM ${this.workflowSnapshotHandoffTableName()}
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY updated_at ASC, workflow_name ASC, run_id ASC
       LIMIT $${values.length}`,
      values,
    );
    const decoded = rows.map(row => this.decodeWorkflowSnapshotHandoff(row));
    const page = decoded.slice(0, limit);
    const hasMore = decoded.length > limit;
    const last = page.at(-1);
    return {
      records: page,
      hasMore,
      ...(hasMore && last
        ? { nextCursor: { updatedAt: last.updatedAt, workflowName: last.workflowName, runId: last.runId } }
        : {}),
    };
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    try {
      // Use a transaction with row-level locking to ensure atomicity
      return await this.#db.client.tx(async t => {
        const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) });
        const revision = await this.lockWorkflowParentRevisionForSnapshotUpsert(t, workflowName, runId);
        await this.assertWorkflowSnapshotHandoffAvailable(t, workflowName, runId);

        // Load existing snapshot within transaction with FOR UPDATE to lock the row
        // This prevents concurrent updates from reading stale data
        const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState }>(
          `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );
        if (revision.created && existingSnapshotResult) {
          throw new TypeError('Workflow snapshot is missing parent revision evidence');
        }

        let snapshot: WorkflowRunState;
        if (!existingSnapshotResult) {
          // Create new snapshot if none exists
          snapshot = {
            context: {},
            activePaths: [],
            timestamp: Date.now(),
            suspendedPaths: {},
            activeStepsPath: {},
            resumeLabels: {},
            serializedStepGraph: [],
            status: 'pending',
            value: {},
            waitingPaths: {},
            runId: runId,
            requestContext: {},
          } as WorkflowRunState;
        } else {
          // Parse existing snapshot
          const existingSnapshot = existingSnapshotResult.snapshot;
          snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;
        }

        // Merge the new step result using element-wise array merging
        // (critical for concurrent foreach iteration results)
        mergeWorkflowStepResult({ snapshot, stepId, result, requestContext });

        // Upsert the snapshot within the same transaction
        const now = new Date();
        const sanitizedSnapshot = sanitizeJsonForPg(JSON.stringify(snapshot));
        await t.none(
          `INSERT INTO ${tableName}
           (workflow_name, run_id, snapshot, "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (workflow_name, run_id) DO UPDATE
           SET snapshot = $3, "updatedAt" = $5, "updatedAtZ" = $7`,
          [workflowName, runId, sanitizedSnapshot, now, now, now, now],
        );
        await this.bumpWorkflowParentRevision(t, workflowName, runId, revision.generation);

        return snapshot.context;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_WORKFLOW_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
            stepId,
          },
        },
        error,
      );
    }
  }
  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    try {
      // Use a transaction with row-level locking to ensure atomicity
      return await this.#db.client.tx(async t => {
        const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) });
        const revision = await this.lockExistingWorkflowParentRevision(t, workflowName, runId);
        await this.assertWorkflowSnapshotHandoffAvailable(t, workflowName, runId);

        // Load existing snapshot within transaction with FOR UPDATE to lock the row
        // This prevents concurrent updates from reading stale data
        const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState }>(
          `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );

        if (!existingSnapshotResult) {
          return undefined;
        }
        if (!revision) {
          throw new TypeError('Workflow snapshot is missing parent revision evidence');
        }

        // Parse existing snapshot
        const existingSnapshot = existingSnapshotResult.snapshot;
        const snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

        if (!snapshot || !snapshot?.context) {
          throw new Error(`Snapshot not found for runId ${runId}`);
        }

        // `expectedStatus` is a compare-and-set guard, not state. It is checked here, inside the
        // row lock, and stripped so it can never be merged into the persisted snapshot.
        // `finalState` is likewise a directive rather than snapshot state.
        const {
          expectedStatus,
          expectedExecutionGeneration,
          expectedLifecycleResumeAttempt,
          finalState,
          ...stateOptions
        } = opts;
        if (
          !matchesExpectedWorkflowState(snapshot, {
            expectedStatus,
            expectedExecutionGeneration,
            expectedLifecycleResumeAttempt,
          })
        ) {
          return undefined;
        }

        // Merge the new options with the existing snapshot. A terminal
        // final-state write replaces both persisted state views under the same
        // row lock and uses the database clock for the workflow timestamp.
        const updatedSnapshot = { ...snapshot, ...stateOptions };
        if (finalState !== undefined) {
          const clock = await t.one<{ now_ms: string }>(
            `SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms`,
          );
          const storageTimestamp = Number(clock.now_ms);
          if (!Number.isSafeInteger(storageTimestamp) || storageTimestamp < 0) {
            throw new TypeError('Invalid PostgreSQL workflow state clock');
          }
          const finalTimestamp = validateWorkflowSnapshotTimestampForFinalState(snapshot.timestamp, storageTimestamp);
          const canonicalFinalState = materializeWorkflowTerminalCanonicalJsonObject(finalState, 'finalState');
          updatedSnapshot.context = { ...updatedSnapshot.context, __state: canonicalFinalState };
          updatedSnapshot.value = canonicalFinalState;
          updatedSnapshot.timestamp = finalTimestamp;
        }

        // Update the snapshot within the same transaction
        const sanitizedSnapshot = sanitizeJsonForPg(JSON.stringify(updatedSnapshot));
        const now = new Date();
        await t.none(
          `UPDATE ${tableName}
           SET snapshot = $1, "updatedAt" = $2, "updatedAtZ" = $3
           WHERE workflow_name = $4 AND run_id = $5`,
          [sanitizedSnapshot, now, now, workflowName, runId],
        );
        await this.bumpWorkflowParentRevision(t, workflowName, runId, revision.generation);

        return updatedSnapshot;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_WORKFLOW_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    try {
      const now = new Date();
      const createdAtValue = createdAt ? createdAt : now;
      const updatedAtValue = updatedAt ? updatedAt : now;
      // Sanitize the snapshot JSON to remove problematic Unicode sequences
      const sanitizedSnapshot = sanitizeJsonForPg(JSON.stringify(snapshot));
      await this.#db.client.tx(async t => {
        const revision = await this.lockWorkflowParentRevisionForSnapshotUpsert(t, workflowName, runId);
        await this.assertWorkflowSnapshotHandoffAvailable(t, workflowName, runId);
        const existingSnapshot = await t.oneOrNone<{ exists: boolean }>(
          `SELECT TRUE AS exists FROM ${this.workflowSnapshotTableName()}
           WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );
        if (revision.created && existingSnapshot) {
          throw new TypeError('Workflow snapshot is missing parent revision evidence');
        }
        await t.none(
          `INSERT INTO ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} AS t
                 (workflow_name, run_id, "resourceId", snapshot, "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (workflow_name, run_id) DO UPDATE
                 SET "resourceId" = COALESCE($3, t."resourceId"), snapshot = $4, "updatedAt" = $6, "updatedAtZ" = $8`,
          [
            workflowName,
            runId,
            resourceId,
            sanitizedSnapshot,
            createdAtValue,
            updatedAtValue,
            createdAtValue,
            updatedAtValue,
          ],
        );
        await this.bumpWorkflowParentRevision(t, workflowName, runId, revision.generation);
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PERSIST_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const result = await this.#db.load<{ snapshot: WorkflowRunState }>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: workflowName, run_id: runId },
      });

      return result ? result.snapshot : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LOAD_WORKFLOW_SNAPSHOT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getWorkflowExecutionState({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowExecutionState | null> {
    try {
      const snapshotColumnType = await this.resolveWorkflowSnapshotColumnType(this.#db.client);
      if (snapshotColumnType !== 'jsonb') {
        return super.getWorkflowExecutionState({ workflowName, runId });
      }
      const row = await this.#db.client.oneOrNone<{
        snapshot_type: string | null;
        status_json: string | null;
        status_present: boolean;
        execution_generation_json: string | null;
        execution_generation_present: boolean;
      }>(
        `SELECT jsonb_typeof(snapshot.snapshot) AS snapshot_type,
                CASE WHEN jsonb_typeof(snapshot.snapshot) = 'object' AND snapshot.snapshot ? 'status'
                  THEN (snapshot.snapshot->'status')::text END AS status_json,
                jsonb_typeof(snapshot.snapshot) = 'object' AND snapshot.snapshot ? 'status' AS status_present,
                CASE WHEN jsonb_typeof(snapshot.snapshot) = 'object' AND snapshot.snapshot ? 'executionGeneration'
                  THEN (snapshot.snapshot->'executionGeneration')::text END AS execution_generation_json,
                jsonb_typeof(snapshot.snapshot) = 'object' AND snapshot.snapshot ? 'executionGeneration' AS execution_generation_present
         FROM ${this.workflowSnapshotTableName()} AS snapshot
         WHERE workflow_name = $1 AND run_id = $2`,
        [workflowName, runId],
      );
      if (!row) return null;
      if (row.snapshot_type !== 'object') {
        return super.getWorkflowExecutionState({ workflowName, runId });
      }

      const parseProjectedJson = (value: string | null): unknown => (value === null ? null : JSON.parse(value));
      return {
        status: row.status_present ? parseProjectedJson(row.status_json) : undefined,
        ...(row.execution_generation_present
          ? { executionGeneration: parseProjectedJson(row.execution_generation_json) }
          : {}),
      } as WorkflowExecutionState;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_WORKFLOW_EXECUTION_STATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workflowName, runId },
        },
        error,
      );
    }
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (runId) {
        conditions.push(`run_id = $${paramIndex}`);
        values.push(runId);
        paramIndex++;
      }

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })}
          ${whereClause}
          ORDER BY "createdAt" DESC LIMIT 1
        `;

      const queryValues = values;

      const result = await this.#db.readClient.oneOrNone(query, queryValues);

      if (!result) {
        return null;
      }

      return this.parseWorkflowRun(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId,
            workflowName: workflowName || '',
          },
        },
        error,
      );
    }
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    try {
      await this.#db.client.tx(async t => {
        const revision = await this.lockExistingWorkflowParentRevision(t, workflowName, runId);
        await this.assertWorkflowSnapshotHandoffAvailable(t, workflowName, runId);
        const snapshot = await t.oneOrNone<{ exists: boolean }>(
          `SELECT TRUE AS exists FROM ${this.workflowSnapshotTableName()}
           WHERE run_id = $1 AND workflow_name = $2 FOR UPDATE`,
          [runId, workflowName],
        );
        if (!snapshot) return;
        if (!revision) {
          throw new TypeError('Workflow snapshot is missing parent revision evidence');
        }
        const result = await t.query(
          `DELETE FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })}
           WHERE run_id = $1 AND workflow_name = $2`,
          [runId, workflowName],
        );
        if ((result.rowCount ?? 0) > 0) {
          await this.bumpWorkflowParentRevision(t, workflowName, runId, revision.generation);
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId,
            workflowName,
          },
        },
        error,
      );
    }
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        values.push(workflowName);
        paramIndex++;
      }

      if (status) {
        // On jsonb columns PostgreSQL already rejects problematic Unicode escape sequences at
        // insert time, so the sanitizing regexp is a no-op there — and it prevents the planner
        // from using any index on the status field, forcing a sequential scan.
        // Legacy tables whose snapshot column is still json/text can contain those sequences,
        // so they keep the regexp_replace path:
        // - \u0000 (null character) fails the jsonb cast with 22P05 "unsupported Unicode escape sequence"
        // - \uD800-\uDFFF (unpaired surrogates) fail with "Unicode low surrogate must follow a high surrogate"
        // See: https://github.com/mastra-ai/mastra/issues/11563
        const snapshotType = await this.resolveWorkflowSnapshotColumnType(this.#db.client);
        const statusExpr = this.workflowSnapshotStatusExpression(snapshotType, 'snapshot');
        conditions.push(`${statusExpr} = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (resourceId) {
        const hasResourceId = await this.#db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`"resourceId" = $${paramIndex}`);
          values.push(resourceId);
          paramIndex++;
        } else {
          this.logger?.warn?.(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate) {
        conditions.push(`"createdAt" >= $${paramIndex}`);
        values.push(fromDate);
        paramIndex++;
      }

      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex}`);
        values.push(toDate);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let total = 0;
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      if (usePagination) {
        const countResult = await this.#db.client.one(
          `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} ${whereClause}`,
          values,
        );
        total = Number(countResult.count);
      }

      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : undefined;

      const query = `
          SELECT * FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })}
          ${whereClause}
          ORDER BY "createdAt" DESC
          ${usePagination ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ''}
        `;

      const queryValues = usePagination ? [...values, normalizedPerPage, offset] : values;

      const result = await this.#db.client.manyOrNone(query, queryValues);

      const runs = (result || []).map(row => {
        return this.parseWorkflowRun(row);
      });

      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName: workflowName || 'all',
          },
        },
        error,
      );
    }
  }
}
