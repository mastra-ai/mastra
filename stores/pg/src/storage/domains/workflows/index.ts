import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  materializeState,
  materializeWorkflowRun,
  mergeWorkflowStepResult,
  normalizePerPage,
  stateBaseOf,
  STEP_RESULT_SUMMARY_FIELDS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_WORKFLOW_RUNS,
  TABLE_WORKFLOW_RUN_ENTRIES,
  TABLE_SCHEMAS,
  RUN_FENCING_TABLE_SCHEMAS,
  WORKFLOW_RUN_JOURNAL_TABLE_CONFIGS,
  matchesExpectedWorkflowStatus,
  WorkflowsStorage,
  createStorageErrorId,
  isRunFenceConflictError,
  resolveRunFence,
} from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
  UpdateWorkflowStateOptions,
  StatePatchOp,
  StateRef,
  StateVersion,
  StorageListWorkflowRunsInput,
  StoredWorkflowRun,
  StoredWorkflowRunHeader,
  WorkflowRun,
  WorkflowRunEntry,
  WorkflowRunHeader,
  WorkflowRuns,
  CreateIndexOptions,
  TABLE_NAMES,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { schemaNamePrefix } from '../../../shared/schema-name';
import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { buildConstraintName } from '../../db/constraint-utils';
import { assertRunFence, DB_NOW_MS, withRunFence } from '../../db/run-fencing';
import type { Queryable } from '../../db/run-fencing';
import { toPgJson } from '../../db/sanitize-json';
import { runPrune, resolveTargets } from '../../retention';

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName({ indexName, schemaName }: { indexName: string; schemaName?: string }) {
  const quotedIndexName = `"${indexName}"`;
  return schemaName ? `${schemaName}.${quotedIndexName}` : quotedIndexName;
}

interface RunOwnerRow {
  /** BIGINT columns come back as strings. */
  generation: string | number;
  ownerId: string;
  leaseExpiresAt: string | number | null;
  nowMs: string | number;
}

const RUN_OWNER_COLUMNS = `generation, "ownerId", "leaseExpiresAt", ${DB_NOW_MS} AS "nowMs"`;

function toRunOwnershipRecord(runId: string, row: RunOwnerRow): RunOwnershipRecord {
  const leaseExpiresAt = row.leaseExpiresAt === null ? null : Number(row.leaseExpiresAt);
  return {
    runId,
    generation: Number(row.generation),
    ownerId: row.ownerId,
    leaseExpiresAt: leaseExpiresAt === null ? null : new Date(leaseExpiresAt),
    live: leaseExpiresAt !== null && leaseExpiresAt > Number(row.nowMs),
  };
}

/** Base name (before any schema prefix) of the expression index backing the status filter. */
const WORKFLOW_SNAPSHOT_STATUS_INDEX = 'mastra_workflow_snapshot_name_status_createdat_idx';

/**
 * Schema-prefixed name of the status index, lowercased and truncated the same way Postgres
 * stores it, so the init snapshot's index set answers "does it exist?" without a probe or a
 * no-op `CREATE INDEX` (schema-prefixed names routinely exceed the 63-byte limit).
 * Exported for tests.
 */
export function workflowSnapshotStatusIndexName(schemaName?: string): string {
  return buildConstraintName({
    baseName: WORKFLOW_SNAPSHOT_STATUS_INDEX,
    schemaName: schemaName && schemaName !== 'public' ? schemaName : undefined,
  });
}

/**
 * Expression index on `(workflow_name, snapshot->>'status', "createdAt" DESC)` so
 * listWorkflowRuns() status filters can use an index instead of scanning every snapshot.
 *
 * `concurrently` is set by init, which may build the index on a large existing table while
 * other processes keep writing to it. The exported DDL stays plain because migration
 * tooling often wraps statements in a transaction, where CONCURRENTLY is rejected.
 */
function workflowSnapshotStatusIndexSQL(indexName: string, schemaName?: string, concurrently = false): string {
  const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(schemaName) });
  return `CREATE INDEX ${concurrently ? 'CONCURRENTLY ' : ''}IF NOT EXISTS "${indexName}" ON ${tableName} (workflow_name, (snapshot ->> 'status'), "createdAt" DESC)`;
}

/**
 * Storage v2 index names share the long `<schema>_mastra_workflow_runs_` prefix, so a long
 * schema name would collapse them to one 63-byte identifier under plain truncation; hash instead.
 */
function runIndexName(schemaPrefix: string, baseName: string): string {
  return buildConstraintName({ baseName: `${schemaPrefix}${baseName}`, hashWhenTruncated: true });
}

/** Base name (before any schema prefix) of the expression index backing the threadId filter. */
const WORKFLOW_SNAPSHOT_THREAD_ID_INDEX = 'mastra_workflow_snapshot_threadid_idx';

/**
 * Schema-prefixed name of the threadId index (see workflowSnapshotStatusIndexName).
 *
 * Unlike the status index, truncation appends a collision hash: both index names share the
 * long `<schema>_mastra_workflow_snapshot_` prefix, so with a schema name of 37+ bytes plain
 * truncation collapses them to the same 63-byte identifier and `CREATE INDEX IF NOT EXISTS`
 * silently skips this index. The status index keeps plain truncation because its truncated
 * name already exists in deployed catalogs; this index is new and free to adopt the rule.
 * Exported for tests.
 */
export function workflowSnapshotThreadIdIndexName(schemaName?: string): string {
  return buildConstraintName({
    baseName: WORKFLOW_SNAPSHOT_THREAD_ID_INDEX,
    schemaName: schemaName && schemaName !== 'public' ? schemaName : undefined,
    hashWhenTruncated: true,
  });
}

/**
 * Expression extracting the thread id embedded in a snapshot (jsonb columns only). Mirrors
 * the canonical extraction in `@mastra/core` (`getSnapshotMemoryInfo`), which reads one of
 * two layouts:
 * 1. agentic-loop: `context.<suspended step>.suspendPayload.__streamState.messageList.memoryInfo.threadId`
 * 2. durable loop: `context.input.messageListState.memoryInfo.threadId`
 *
 * `jsonb_path_query_first(jsonb, jsonpath)` is IMMUTABLE, so the expression is valid in an
 * expression index. The WHERE clause in listWorkflowRuns() must use this exact expression
 * text so the planner can match it against the index. If the snapshot layout changes in
 * core, this expression must be updated in lockstep or it will wrongly exclude rows.
 */
export const WORKFLOW_SNAPSHOT_THREAD_ID_EXPR = `COALESCE(jsonb_path_query_first(snapshot, '$.context.* ? (@.status == "suspended").suspendPayload.__streamState.messageList.memoryInfo.threadId') #>> '{}', snapshot #>> '{context,input,messageListState,memoryInfo,threadId}')`;

/**
 * Expression index on the snapshot-embedded thread id so listWorkflowRuns() threadId filters
 * (Agent.listSuspendedRuns) can use an index instead of detoasting every snapshot.
 * See {@link workflowSnapshotStatusIndexSQL} for `concurrently`.
 */
function workflowSnapshotThreadIdIndexSQL(indexName: string, schemaName?: string, concurrently = false): string {
  const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(schemaName) });
  return `CREATE INDEX ${concurrently ? 'CONCURRENTLY ' : ''}IF NOT EXISTS "${indexName}" ON ${tableName} ((${WORKFLOW_SNAPSHOT_THREAD_ID_EXPR}))`;
}

/** Base name (before any schema prefix) of the index finding the `state-base` entries built on a run. */
const WORKFLOW_RUN_ENTRIES_STATE_BASE_INDEX = 'mastra_workflow_run_entries_state_base_idx';

/** The run a `state-base` entry builds on; `#detachStateChildren` must use these exact expressions. */
const STATE_BASE_RUN_EXPR = `(payload ->> 'workflowName'), (payload ->> 'runId')`;

/**
 * Partial expression index finding the `state-base` entries built on a run, so deleting a run whose
 * state others build on doesn't scan every entry. See {@link workflowSnapshotStatusIndexSQL} for
 * `concurrently`.
 */
function stateBaseIndexSQL(indexName: string, schemaName?: string, concurrently = false): string {
  const tableName = getTableName({ indexName: TABLE_WORKFLOW_RUN_ENTRIES, schemaName: getSchemaName(schemaName) });
  return `CREATE INDEX ${concurrently ? 'CONCURRENTLY ' : ''}IF NOT EXISTS "${indexName}" ON ${tableName} (${STATE_BASE_RUN_EXPR}) WHERE kind = 'state-base'`;
}

/** A storage v2 entry as written: one element of the jsonb array the write statements unpack. */
interface EntryInput {
  kind: WorkflowRunEntry['kind'];
  step_id: string | null;
  payload: unknown;
}

/** A storage v2 entry as read back by `#entriesSql` or `#stateEntriesSql`. */
interface EntryRow {
  seq: number;
  kind: WorkflowRunEntry['kind'];
  step_id: string | null;
  payload: unknown;
  /** The payload was undefined when written (SQL NULL), as opposed to JSON null. */
  absent: boolean;
  /** Read in summary mode, and `payload` is the step's summary. */
  summarized?: boolean;
}

/** The header row fields of a storage v2 write. */
interface RunWrite {
  workflowName: string;
  runId: string;
  resourceId?: string;
  threadId?: string;
  header: WorkflowRunHeader;
}

/** The state fields of a storage v2 write. */
interface StateWrite {
  state?: Record<string, any>;
  stateBase?: StateRef;
  statePatch?: StatePatchOp[];
}

/**
 * The entries a storage v2 write adds: one per step, in order, then the state or state base (a
 * checkpoint with neither starts the state over at `{}`), then the state patch unless a full state
 * was given.
 */
function journalEntries(
  steps: Record<string, StepResult<any, any, any, any>>,
  { state, stateBase, statePatch }: StateWrite,
  checkpoint: boolean,
) {
  const entries: EntryInput[] = Object.entries(steps).map(([stepId, result]) => ({
    kind: 'step',
    step_id: stepId,
    payload: result,
  }));
  if (state !== undefined) entries.push({ kind: 'state', step_id: null, payload: state });
  else if (stateBase !== undefined) entries.push({ kind: 'state-base', step_id: null, payload: stateBase });
  else if (checkpoint) entries.push({ kind: 'state', step_id: null, payload: {} });
  if (state === undefined && statePatch !== undefined) {
    entries.push({ kind: 'state-patch', step_id: null, payload: statePatch });
  }
  return entries;
}

/** A `state-draft` entry's payload. */
type DraftPayload = { state: Record<string, any> } | { on: StateVersion; ops: StatePatchOp[] };

/**
 * Rows `e(elem, ord)` of the jsonb array parameter `param` of {@link EntryInput}, and the
 * entry columns they insert. `elem -> 'payload'` keeps a JSON null apart from an undefined
 * payload (dropped by `JSON.stringify`), which becomes SQL NULL.
 */
const entryRows = (param: string) => `jsonb_array_elements(${param}::jsonb) WITH ORDINALITY AS e(elem, ord)`;
const ENTRY_VALUES = `e.elem ->> 'kind', e.elem ->> 'step_id', e.elem -> 'payload'`;

/** The entries of `#entriesSql` rows; an undefined payload reads back as undefined, as in v1. */
function toEntries(rows: EntryRow[]): WorkflowRunEntry[] {
  return rows.map((row): WorkflowRunEntry => {
    const payload = row.absent ? undefined : row.payload;
    switch (row.kind) {
      case 'step':
        return { seq: row.seq, kind: 'step', stepId: row.step_id!, result: payload };
      case 'state':
        return { seq: row.seq, kind: 'state', state: payload as Record<string, any> };
      case 'state-patch':
        return { seq: row.seq, kind: 'state-patch', ops: payload as StatePatchOp[] };
      case 'state-base':
        return { seq: row.seq, kind: 'state-base', base: payload as StateRef };
      case 'state-draft': {
        const draft = payload as DraftPayload;
        return 'state' in draft
          ? { seq: row.seq, kind: 'state-draft', state: draft.state }
          : { seq: row.seq, kind: 'state-draft', on: draft.on, ops: draft.ops };
      }
    }
  });
}

export class WorkflowsPG extends WorkflowsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_SNAPSHOT, TABLE_WORKFLOW_RUNS, TABLE_WORKFLOW_RUN_ENTRIES] as const;

  /**
   * Workflow run snapshots accumulate as runs execute. Anchored on the
   * timezone-aware `updatedAtZ` mirror column (last activity) so suspended or
   * long-running runs are not pruned by start age.
   *
   * Run ownership rows are anchored on `updatedAt` (epoch ms), which every
   * claim, renewal and release refreshes, so a live execution's row is never
   * older than its renew interval.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    workflowSnapshot: { table: TABLE_WORKFLOW_SNAPSHOT, column: 'updatedAtZ', indexed: true },
    runOwnership: { table: TABLE_WORKFLOW_RUN_OWNERS, column: 'updatedAt', indexed: true, anchorType: 'epoch-ms' },
  };

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, readClient, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (WorkflowsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  supportsConcurrentUpdates(): boolean {
    return true;
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

  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}mastra_workflow_snapshot_name_createdat_idx`,
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['workflow_name', 'createdAt DESC'],
      },
      // Storage v2 runs: the same listing, status and thread indexes as v1, on plain columns.
      {
        name: runIndexName(schemaPrefix, 'mastra_workflow_runs_name_createdat_idx'),
        table: TABLE_WORKFLOW_RUNS,
        columns: ['workflow_name', 'createdAt DESC'],
      },
      {
        name: runIndexName(schemaPrefix, 'mastra_workflow_runs_name_status_createdat_idx'),
        table: TABLE_WORKFLOW_RUNS,
        columns: ['workflow_name', 'status', 'createdAt DESC'],
      },
      {
        name: runIndexName(schemaPrefix, 'mastra_workflow_runs_threadid_idx'),
        table: TABLE_WORKFLOW_RUNS,
        columns: ['threadId'],
      },
      // Backs the latest-entry-per-step read.
      {
        name: runIndexName(schemaPrefix, 'mastra_workflow_run_entries_step_idx'),
        table: TABLE_WORKFLOW_RUN_ENTRIES,
        columns: ['workflow_name', 'run_id', 'kind', 'step_id', 'seq'],
      },
    ];
  }

  /**
   * Returns all DDL statements for this domain: table with unique constraint.
   * Used by exportSchemas to produce a complete, reproducible schema export.
   */
  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? schemaNamePrefix(schemaName) : '';
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

    for (const [tableName, config] of Object.entries(WORKFLOW_RUN_JOURNAL_TABLE_CONFIGS)) {
      statements.push(
        generateTableSQL({
          tableName: tableName as TABLE_NAMES,
          schema: config.columns,
          schemaName,
          compositePrimaryKey: config.compositePrimaryKey,
          includeAllConstraints: true,
        }),
      );
    }

    for (const idx of WorkflowsPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    statements.push(`${workflowSnapshotStatusIndexSQL(workflowSnapshotStatusIndexName(parsedSchema), schemaName)};`);
    statements.push(
      `${workflowSnapshotThreadIdIndexSQL(workflowSnapshotThreadIdIndexName(parsedSchema), schemaName)};`,
    );
    statements.push(
      `${stateBaseIndexSQL(runIndexName(schemaPrefix, WORKFLOW_RUN_ENTRIES_STATE_BASE_INDEX), schemaName)};`,
    );

    statements.push(
      generateTableSQL({
        tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES,
        schema: RUN_FENCING_TABLE_SCHEMAS[TABLE_WORKFLOW_RUN_OWNERS],
        schemaName,
        includeAllConstraints: true,
      }),
    );

    return statements;
  }

  /**
   * Returns default index definitions for the workflows domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${schemaNamePrefix(this.#schema)}_` : '';
    return WorkflowsPG.getDefaultIndexDefs(schemaPrefix);
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }

    const schemaPrefix = this.#schema !== 'public' ? `${schemaNamePrefix(this.#schema)}_` : '';
    const stateBaseIndexName = runIndexName(schemaPrefix, WORKFLOW_RUN_ENTRIES_STATE_BASE_INDEX);
    try {
      await this.#db.createIndexFromStatement(
        stateBaseIndexName,
        stateBaseIndexSQL(stateBaseIndexName, this.#schema, true),
      );
    } catch (error) {
      this.logger?.warn?.(`Failed to create index ${stateBaseIndexName}:`, error);
    }

    // Expression index backing the status filter in listWorkflowRuns(). Only valid on jsonb
    // columns — legacy json/text snapshot columns still go through the sanitizing regexp,
    // which cannot use an index anyway.
    const snapshotType = await this.#db.getColumnType(TABLE_WORKFLOW_SNAPSHOT, 'snapshot');
    if (snapshotType !== 'jsonb') return;

    const indexName = workflowSnapshotStatusIndexName(this.#schema);
    try {
      await this.#db.createIndexFromStatement(indexName, workflowSnapshotStatusIndexSQL(indexName, this.#schema, true));
    } catch (error) {
      this.logger?.warn?.(`Failed to create index ${indexName}:`, error);
    }

    // Expression index backing the threadId filter in listWorkflowRuns() — jsonb only, like
    // the status index above.
    const threadIdIndexName = workflowSnapshotThreadIdIndexName(this.#schema);
    try {
      await this.#db.createIndexFromStatement(
        threadIdIndexName,
        workflowSnapshotThreadIdIndexSQL(threadIdIndexName, this.#schema, true),
      );
    } catch (error) {
      this.logger?.warn?.(`Failed to create index ${threadIdIndexName}:`, error);
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] });
    await this.#db.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      ifNotExists: ['resourceId'],
    });
    await this.#db.createTable({
      tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES,
      schema: RUN_FENCING_TABLE_SCHEMAS[TABLE_WORKFLOW_RUN_OWNERS],
    });
    for (const [tableName, config] of Object.entries(WORKFLOW_RUN_JOURNAL_TABLE_CONFIGS)) {
      await this.#db.createTable({
        tableName: tableName as TABLE_NAMES,
        schema: config.columns,
        compositePrimaryKey: config.compositePrimaryKey,
      });
    }
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
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
    const prefix = this.#schema && this.#schema !== 'public' ? `${schemaNamePrefix(this.#schema)}_` : '';
    for (const [key, entry] of Object.entries(WorkflowsPG.retentionTables)) {
      if (!entry.indexed || !policies[key]) continue;
      try {
        await this.#db.ensureIndex({
          indexName: `${prefix}mastra_${key}_retention_idx`,
          tableName: entry.table as TABLE_NAMES,
          column: entry.column,
        });
      } catch (error) {
        this.logger?.warn?.(`Failed to create retention index for ${entry.table}:`, error);
      }
    }
    if (!policies.workflowSnapshot) return;
    try {
      await this.#db.ensureIndex({
        indexName: `${prefix}mastra_workflow_runs_retention_idx`,
        tableName: TABLE_WORKFLOW_RUNS,
        column: 'updatedAtZ',
      });
    } catch (error) {
      this.logger?.warn?.(`Failed to create retention index for ${TABLE_WORKFLOW_RUNS}:`, error);
    }
  }

  /**
   * Delete workflow runs and run ownership rows older than their policy's `maxAge`, batched.
   * The `workflowSnapshot` policy covers both storage versions: storage v2 runs are pruned by
   * their header's last write, together with their entries.
   */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    await this.ensureRetentionIndexes(policies);
    const targets = resolveTargets({
      policies,
      descriptor: WorkflowsPG.retentionTables,
      order: ['workflowSnapshot', 'runOwnership'],
    });
    const snapshotTarget = targets.findIndex(target => target.table === TABLE_WORKFLOW_SNAPSHOT);
    if (snapshotTarget !== -1) {
      targets.splice(snapshotTarget + 1, 0, { ...targets[snapshotTarget]!, table: TABLE_WORKFLOW_RUNS });
    }
    return runPrune({
      db: this.#db,
      domain: 'workflows',
      targets,
      options,
      deleteBatch: (target, cutoff, limit) =>
        target.table === TABLE_WORKFLOW_RUNS ? this.#pruneRunsBatch(cutoff, limit) : undefined,
    });
  }

  /**
   * Deletes up to `limit` aged storage v2 runs, header and entries together, first detaching the
   * runs whose state others build on (see `#detachStateChildren`).
   */
  async #pruneRunsBatch(cutoff: Date | number, limit: number): Promise<number> {
    return this.#db.client.tx(async t => {
      const doomed = await t.manyOrNone<{ workflow_name: string; run_id: string; stateShared: boolean }>(
        `SELECT workflow_name, run_id, "stateShared" FROM ${this.#runsTable()}
         WHERE "updatedAtZ" < $1
         ORDER BY "updatedAtZ"
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [cutoff, limit],
      );
      if (!doomed.length) return 0;
      for (const run of doomed) {
        if (run.stateShared) await this.#detachStateChildren(t, run.workflow_name, run.run_id);
      }
      const result = await t.query(
        `WITH doomed AS (
           SELECT * FROM unnest($1::text[], $2::text[]) AS d(workflow_name, run_id)
         ), entries AS (
           DELETE FROM ${this.#entriesTable()} e USING doomed d
           WHERE e.workflow_name = d.workflow_name AND e.run_id = d.run_id
         )
         DELETE FROM ${this.#runsTable()} r USING doomed d
         WHERE r.workflow_name = d.workflow_name AND r.run_id = d.run_id`,
        [doomed.map(run => run.workflow_name), doomed.map(run => run.run_id)],
      );
      return result.rowCount ?? 0;
    });
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
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES });
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_RUNS as TABLE_NAMES });
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_RUN_ENTRIES as TABLE_NAMES });
  }

  supportsRunJournal(): boolean {
    return true;
  }

  #runsTable(): string {
    return getTableName({ indexName: TABLE_WORKFLOW_RUNS, schemaName: getSchemaName(this.#schema) });
  }

  #entriesTable(): string {
    return getTableName({ indexName: TABLE_WORKFLOW_RUN_ENTRIES, schemaName: getSchemaName(this.#schema) });
  }

  /**
   * A jsonb array of {@link EntryRow} for the storage v2 run `alias` refers to: each step's
   * latest entry, ordered by when each step was first written so `context` keys keep their write
   * order, and the entries `materializeState` uses for the latest state: the latest full state or
   * state base and every state patch after it, in `seq` order. Drafts are left out.
   *
   * With `summaryFieldsParam` (the parameter holding `STEP_RESULT_SUMMARY_FIELDS`), successful
   * steps other than `input` come back as their summary, built here so their data is never sent.
   * Like `summarizeStepResult`, it keeps a field that is JSON null and leaves out one that is absent.
   */
  #entriesSql(alias: string, { summaryFieldsParam }: { summaryFieldsParam?: string } = {}): string {
    let payload = 'x.payload';
    if (summaryFieldsParam) {
      const summarized = `(x.kind = 'step' AND x.step_id <> 'input' AND x.payload ->> 'status' = 'success')`;
      payload = `CASE WHEN ${summarized} THEN (
          SELECT COALESCE(jsonb_object_agg(f.key, f.value), '{}'::jsonb)
          FROM jsonb_each(x.payload) f WHERE f.key = ANY(${summaryFieldsParam}::text[])
        ) ELSE x.payload END, 'summarized', ${summarized}`;
    }
    return `(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'seq', x.seq, 'kind', x.kind, 'step_id', x.step_id, 'absent', x.payload IS NULL, 'payload', ${payload}
        ) ORDER BY CASE WHEN x.kind = 'step' THEN x.first_seq ELSE x.seq END), '[]'::jsonb)
      FROM (
        SELECT e.seq, e.kind, e.step_id, e.payload,
          ROW_NUMBER() OVER (PARTITION BY e.kind, e.step_id ORDER BY e.seq DESC) AS rn,
          MIN(e.seq) OVER (PARTITION BY e.kind, e.step_id) AS first_seq,
          MAX(CASE WHEN e.kind IN ('state', 'state-base') THEN e.seq END) OVER () AS base_seq
        FROM ${this.#entriesTable()} e
        WHERE e.workflow_name = ${alias}.workflow_name AND e.run_id = ${alias}.run_id AND e.kind <> 'state-draft'
      ) x
      WHERE CASE WHEN x.kind = 'step' THEN x.rn = 1 ELSE x.base_seq IS NULL OR x.seq >= x.base_seq END)`;
  }

  /**
   * A jsonb array of {@link EntryRow} with the entries `materializeState` uses for the state of the
   * storage v2 run `alias` refers to as of a version: `seqParam` its `seq`, `draftParam` whether
   * it is a draft. For a draft, every state entry up to it, as the drafts it is on can build on
   * any earlier version; otherwise the latest full state or state base up to it and the state
   * patches after it.
   */
  #stateEntriesSql(alias: string, seqParam: string, draftParam: string): string {
    return `(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'seq', x.seq, 'kind', x.kind, 'step_id', x.step_id, 'absent', x.payload IS NULL, 'payload', x.payload
        ) ORDER BY x.seq), '[]'::jsonb)
      FROM (
        SELECT e.seq, e.kind, e.step_id, e.payload,
          MAX(CASE WHEN e.kind IN ('state', 'state-base') THEN e.seq END) OVER () AS base_seq
        FROM ${this.#entriesTable()} e
        WHERE e.workflow_name = ${alias}.workflow_name AND e.run_id = ${alias}.run_id
          AND e.kind <> 'step' AND e.seq <= ${seqParam}::int
      ) x
      WHERE ${draftParam}::boolean OR (x.kind <> 'state-draft' AND (x.base_seq IS NULL OR x.seq >= x.base_seq)))`;
  }

  /**
   * Selects v1 snapshot rows and storage v2 runs as one result, newest first. Each version
   * has its own WHERE clause; `null` leaves it out. Storage v2 rows carry their header and
   * entries, or in summary mode only the summary snapshot. `page` is appended to the
   * combined, ordered rows (e.g. `LIMIT 1`).
   */
  async #runsQuery({
    v1Where,
    v2Where,
    v1Snapshot = 'snapshot',
    summary,
    page = '',
  }: {
    v1Where: string | null;
    v2Where: string | null;
    v1Snapshot?: string;
    summary?: boolean;
    page?: string;
  }): Promise<string> {
    const branches: string[] = [];
    if (v1Where !== null) {
      // Legacy snapshot tables may lack these columns; v1 reads used to select `*`.
      const optional = { resourceId: 'text', createdAtZ: 'timestamptz', updatedAtZ: 'timestamptz' };
      const columns: Record<string, string> = {};
      for (const [column, type] of Object.entries(optional)) {
        const exists = (await this.#db.getColumnType(TABLE_WORKFLOW_SNAPSHOT, column)) !== null;
        columns[column] = exists ? `"${column}"` : `NULL::${type} AS "${column}"`;
      }
      branches.push(
        `SELECT workflow_name, run_id, ${columns.resourceId}, ${v1Snapshot} AS snapshot, NULL::jsonb AS header,
           "createdAt", ${columns.createdAtZ}, "updatedAt", ${columns.updatedAtZ}, 1 AS version
         FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} ${v1Where}`,
      );
    }
    if (v2Where !== null) {
      const columns = summary
        ? `jsonb_build_object('status', header -> 'status', 'timestamp', header -> 'timestamp') AS snapshot, NULL::jsonb AS header`
        : `NULL AS snapshot, header`;
      branches.push(
        `SELECT workflow_name, run_id, "resourceId", ${columns},
           "createdAt", "createdAtZ", "updatedAt", "updatedAtZ", 2 AS version
         FROM ${this.#runsTable()} ${v2Where}`,
      );
    }
    const entries = summary ? '' : `, CASE WHEN p.version = 2 THEN ${this.#entriesSql('p')} END AS entries`;
    return `SELECT p.*${entries}
      FROM (${branches.join(' UNION ALL ')} ORDER BY "createdAt" DESC ${page}) p
      ORDER BY p."createdAt" DESC`;
  }

  /**
   * The `base` that `materializeState` takes for a run's entries (as of `at`, or latest): the state
   * version of another run it builds on (`stateBaseOf`), resolved recursively, else undefined. `{}`
   * when that run isn't stored. One query per run in the chain.
   */
  async #stateBase(
    q: Queryable,
    entries: readonly WorkflowRunEntry[],
    at?: StateVersion,
  ): Promise<Record<string, any> | undefined> {
    const ref = stateBaseOf(entries, at);
    if (!ref) return undefined;
    return (await this.#stateAt(q, ref.workflowName, ref.runId, ref))?.state ?? {};
  }

  /** A storage v2 run's state as of the version `at`, or null when the run isn't stored. */
  async #stateAt(
    q: Queryable,
    workflowName: string,
    runId: string,
    at: StateVersion,
  ): Promise<{ state: Record<string, any>; statePatchBytes: number } | null> {
    const row = await q.oneOrNone<{ entries: EntryRow[] }>(
      `SELECT ${this.#stateEntriesSql('r', '$3', '$4')} AS entries
       FROM ${this.#runsTable()} r WHERE r.workflow_name = $1 AND r.run_id = $2`,
      [workflowName, runId, at.seq, at.draft === true],
    );
    if (!row) return null;
    const entries = toEntries(row.entries);
    return materializeState(entries, { at, base: await this.#stateBase(q, entries, at) });
  }

  /**
   * Before a run is deleted, stores the full state in place of every `state-base` entry built on
   * it, so the runs built on it keep reading the same state. Runs inside the delete's transaction.
   */
  async #detachStateChildren(q: Queryable, workflowName: string, runId: string): Promise<void> {
    const children = await q.manyOrNone<{ workflow_name: string; run_id: string; seq: number; payload: StateRef }>(
      `SELECT workflow_name, run_id, seq, payload FROM ${this.#entriesTable()}
       WHERE kind = 'state-base' AND (${STATE_BASE_RUN_EXPR}) = ($1, $2)`,
      [workflowName, runId],
    );
    const states = new Map<string, Record<string, any>>();
    for (const child of children) {
      const version = `${child.payload.seq}:${child.payload.draft === true}`;
      let state = states.get(version);
      if (!state) {
        state = (await this.#stateAt(q, workflowName, runId, child.payload))?.state ?? {};
        states.set(version, state);
      }
      await q.none(
        `UPDATE ${this.#entriesTable()} SET kind = 'state', payload = $4::jsonb
         WHERE workflow_name = $1 AND run_id = $2 AND seq = $3`,
        [child.workflow_name, child.run_id, child.seq, toPgJson(state)],
      );
    }
  }

  /** Rebuilds a storage v2 run's `WorkflowRunState` from its header and `#entriesSql` rows. */
  async #materializeRun(client: Queryable, header: WorkflowRunHeader, rows: EntryRow[]): Promise<WorkflowRunState> {
    const entries = toEntries(rows);
    return materializeWorkflowRun(header, entries, await this.#stateBase(client, entries));
  }

  /** Parses a row of `#runsQuery`. */
  async #parseRun(client: Queryable, row: Record<string, any>): Promise<WorkflowRun> {
    if (row.version !== 2) return this.parseWorkflowRun(row);
    const snapshot = row.entries ? await this.#materializeRun(client, row.header, row.entries) : row.snapshot;
    return { ...this.parseWorkflowRun({ ...row, snapshot }), storageVersion: 2 };
  }

  #runError(operation: string, workflowName: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('PG', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { workflowName, runId },
      },
      error,
    );
  }

  async loadWorkflowRunHeader({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<StoredWorkflowRunHeader | null> {
    try {
      return await this.#db.client.oneOrNone<StoredWorkflowRunHeader>(
        `SELECT header, "lastSeq", "startStateSeq" FROM ${this.#runsTable()} WHERE workflow_name = $1 AND run_id = $2`,
        [workflowName, runId],
      );
    } catch (error) {
      throw this.#runError('LOAD_WORKFLOW_RUN_HEADER', workflowName, runId, error);
    }
  }

  async loadWorkflowRun({
    workflowName,
    runId,
    successfulSteps,
  }: {
    workflowName: string;
    runId: string;
    successfulSteps: 'full' | 'summary';
  }): Promise<StoredWorkflowRun | null> {
    try {
      const summary = successfulSteps === 'summary';
      const run = await this.#db.client.oneOrNone<StoredWorkflowRunHeader & { entries: EntryRow[] }>(
        `SELECT r.header, r."lastSeq", r."startStateSeq", ${this.#entriesSql('r', { summaryFieldsParam: summary ? '$3' : undefined })} AS entries
         FROM ${this.#runsTable()} r WHERE r.workflow_name = $1 AND r.run_id = $2`,
        summary ? [workflowName, runId, STEP_RESULT_SUMMARY_FIELDS] : [workflowName, runId],
      );
      if (!run) return null;

      const entries = toEntries(run.entries);
      const steps: StoredWorkflowRun['steps'] = {};
      const summarizedStepIds: string[] = [];
      entries.forEach((entry, i) => {
        if (entry.kind !== 'step') return;
        steps[entry.stepId] = entry.result as StoredWorkflowRun['steps'][string];
        if (run.entries[i]!.summarized) summarizedStepIds.push(entry.stepId);
      });
      const base = await this.#stateBase(this.#db.client, entries);
      const { state, statePatchBytes } = materializeState(entries, { base });
      return {
        header: run.header,
        lastSeq: run.lastSeq,
        startStateSeq: run.startStateSeq,
        state,
        statePatchBytes,
        steps,
        summarizedStepIds,
      };
    } catch (error) {
      throw this.#runError('LOAD_WORKFLOW_RUN', workflowName, runId, error);
    }
  }

  async loadWorkflowRunSteps({
    workflowName,
    runId,
    stepIds,
  }: {
    workflowName: string;
    runId: string;
    stepIds: string[];
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    if (!stepIds.length) return {};
    try {
      const rows = await this.#db.client.any<{ step_id: string; payload: StepResult<any, any, any, any> }>(
        `SELECT DISTINCT ON (step_id) step_id, payload
         FROM ${this.#entriesTable()}
         WHERE workflow_name = $1 AND run_id = $2 AND kind = 'step' AND step_id = ANY($3::text[])
         ORDER BY step_id, seq DESC`,
        [workflowName, runId, stepIds],
      );
      return Object.fromEntries(rows.map(row => [row.step_id, row.payload]));
    } catch (error) {
      throw this.#runError('LOAD_WORKFLOW_RUN_STEPS', workflowName, runId, error);
    }
  }

  async updateWorkflowRunHeader({
    workflowName,
    runId,
    opts,
    fence: explicitFence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<StoredWorkflowRunHeader | undefined> {
    const fence = resolveRunFence(this, explicitFence, runId);
    try {
      return await this.#db.client.tx(async t => {
        if (fence) await assertRunFence(t, this.#runOwnersTable(), fence, 'updateWorkflowRunHeader');
        const run = await t.oneOrNone<{ header: WorkflowRunHeader }>(
          `SELECT header FROM ${this.#runsTable()} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );
        if (!run) return undefined;
        const { expectedStatus, ...patch } = opts;
        if (!matchesExpectedWorkflowStatus(run.header.status, expectedStatus)) return undefined;
        const header = { ...run.header, ...patch };
        const now = new Date();
        return await t.one<StoredWorkflowRunHeader>(
          `UPDATE ${this.#runsTable()}
           SET header = $3::jsonb, status = $4, "updatedAt" = $5, "updatedAtZ" = $6
           WHERE workflow_name = $1 AND run_id = $2
           RETURNING header, "lastSeq", "startStateSeq"`,
          [workflowName, runId, toPgJson(header), header.status, now, now],
        );
      });
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw this.#runError('UPDATE_WORKFLOW_RUN_HEADER', workflowName, runId, error);
    }
  }

  /**
   * Upserts a storage v2 run's header from `$1`–`$11` ({@link #headerParams}), adds `$7` (the
   * number of entries the write adds) to `lastSeq`, and returns the new `lastSeq` and
   * `stateShared`. A checkpoint's state entries come last, so its `startStateSeq` is the new
   * `lastSeq`; an append keeps the stored one unless given `$12`. The header's row lock is held
   * until commit, so the writes to one run commit in `seq` order.
   */
  #upsertHeaderSql(checkpoint: boolean): string {
    const startStateSeq = checkpoint
      ? { insert: '$7::int', update: 'r."lastSeq" + EXCLUDED."lastSeq"' }
      : { insert: 'COALESCE($12::int, 0)', update: 'COALESCE($12::int, r."startStateSeq")' };
    return `INSERT INTO ${this.#runsTable()} AS r
         (workflow_name, run_id, "resourceId", "threadId", status, header, "lastSeq", "startStateSeq", "stateShared",
          "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::int, ${startStateSeq.insert}, false, $8, $9, $10, $11)
       ON CONFLICT (workflow_name, run_id) DO UPDATE
       SET "resourceId" = COALESCE(EXCLUDED."resourceId", r."resourceId"), "threadId" = EXCLUDED."threadId",
           status = EXCLUDED.status, header = EXCLUDED.header, "lastSeq" = r."lastSeq" + EXCLUDED."lastSeq",
           "startStateSeq" = ${startStateSeq.update},
           "updatedAt" = EXCLUDED."updatedAt", "updatedAtZ" = EXCLUDED."updatedAtZ"
       RETURNING "lastSeq", "stateShared"`;
  }

  #headerParams(run: RunWrite, entryCount: number): unknown[] {
    const now = new Date();
    return [
      run.workflowName,
      run.runId,
      run.resourceId,
      run.threadId ?? null,
      run.header.status,
      toPgJson(run.header),
      entryCount,
      now,
      now,
      now,
      now,
    ];
  }

  async writeWorkflowRunCheckpoint({
    fence: explicitFence,
    steps,
    state,
    stateBase,
    statePatch,
    ...run
  }: RunWrite & {
    steps: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    stateBase?: StateRef;
    statePatch?: StatePatchOp[];
    fence?: RunFence;
  }): Promise<{ lastSeq: number }> {
    const entries = journalEntries(steps, { state, stateBase, statePatch }, true);
    const fence = resolveRunFence(this, explicitFence, run.runId);
    try {
      return await this.#db.client.tx(async t => {
        if (fence) await assertRunFence(t, this.#runOwnersTable(), fence, 'writeWorkflowRunCheckpoint');
        if (state === undefined && stateBase !== undefined) {
          // Before this run's own rows, so it locks the base run's header before a delete of the
          // base run (which locks it, then rewrites this run's entries) could wait on this run.
          await t.none(
            `UPDATE ${this.#runsTable()} SET "stateShared" = true
             WHERE workflow_name = $1 AND run_id = $2 AND NOT "stateShared"`,
            [stateBase.workflowName, stateBase.runId],
          );
        }
        const { lastSeq, stateShared } = await t.one<{ lastSeq: number; stateShared: boolean }>(
          this.#upsertHeaderSql(true),
          this.#headerParams(run, entries.length),
        );
        // A new statement under READ COMMITTED: with the header locked above, it sees every
        // append that committed before this checkpoint, so none of their entries survive it.
        // The state entries do when another run's state builds on this one's, which can name
        // an earlier version.
        await t.none(
          `DELETE FROM ${this.#entriesTable()}
           WHERE workflow_name = $1 AND run_id = $2${stateShared ? ` AND kind = 'step'` : ''}`,
          [run.workflowName, run.runId],
        );
        await t.none(
          `INSERT INTO ${this.#entriesTable()} (workflow_name, run_id, seq, kind, step_id, payload)
           SELECT $1, $2, $3::int - $4::int + e.ord, ${ENTRY_VALUES}
           FROM ${entryRows('$5')}`,
          [run.workflowName, run.runId, lastSeq, entries.length, toPgJson(entries)],
        );
        return { lastSeq };
      });
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw this.#runError('WRITE_WORKFLOW_RUN_CHECKPOINT', run.workflowName, run.runId, error);
    }
  }

  /** One statement: the header upsert numbers the entries inserted after it. */
  async appendWorkflowRunEntries({
    fence,
    steps,
    state,
    statePatch,
    startStateSeq,
    ...run
  }: RunWrite & {
    steps: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    statePatch?: StatePatchOp[];
    startStateSeq?: number;
    fence?: RunFence;
  }): Promise<{ lastSeq: number }> {
    const entries = journalEntries(steps, { state, statePatch }, false);
    try {
      return await withRunFence(
        this.#db.client,
        this.#runOwnersTable(),
        resolveRunFence(this, fence, run.runId),
        'appendWorkflowRunEntries',
        q =>
          q.one<{ lastSeq: number }>(
            `WITH h AS (${this.#upsertHeaderSql(false)}),
             e AS (
               INSERT INTO ${this.#entriesTable()} (workflow_name, run_id, seq, kind, step_id, payload)
               SELECT $1, $2, h."lastSeq" - $7::int + e.ord, ${ENTRY_VALUES}
               FROM h, ${entryRows('$13')}
             )
             SELECT "lastSeq" FROM h`,
            [...this.#headerParams(run, entries.length), startStateSeq ?? null, toPgJson(entries)],
          ),
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw this.#runError('APPEND_WORKFLOW_RUN_ENTRIES', run.workflowName, run.runId, error);
    }
  }

  async loadWorkflowRunState({
    workflowName,
    runId,
    seq,
  }: {
    workflowName: string;
    runId: string;
    seq: number;
  }): Promise<Record<string, any> | null> {
    try {
      return (await this.#stateAt(this.#db.client, workflowName, runId, { seq }))?.state ?? null;
    } catch (error) {
      throw this.#runError('LOAD_WORKFLOW_RUN_STATE', workflowName, runId, error);
    }
  }

  async appendWorkflowRunStateDraft(
    args: { workflowName: string; runId: string } & (
      | { on: StateVersion; ops: StatePatchOp[] }
      | { state: Record<string, any> }
    ),
  ): Promise<{ seq: number }> {
    const { workflowName, runId } = args;
    const payload: DraftPayload =
      'state' in args
        ? { state: args.state }
        : { on: args.on.draft ? { seq: args.on.seq, draft: true } : { seq: args.on.seq }, ops: args.ops };
    let row: { seq: number } | null;
    try {
      row = await this.#db.client.oneOrNone<{ seq: number }>(
        `WITH h AS (
           UPDATE ${this.#runsTable()} SET "lastSeq" = "lastSeq" + 1, "stateShared" = true
           WHERE workflow_name = $1 AND run_id = $2
           RETURNING "lastSeq"
         )
         INSERT INTO ${this.#entriesTable()} (workflow_name, run_id, seq, kind, step_id, payload)
         SELECT $1, $2, h."lastSeq", 'state-draft', NULL, $3::jsonb FROM h
         RETURNING seq`,
        [workflowName, runId, toPgJson(payload)],
      );
    } catch (error) {
      throw this.#runError('APPEND_WORKFLOW_RUN_STATE_DRAFT', workflowName, runId, error);
    }
    if (!row) throw new Error(`Storage v2 run ${workflowName}/${runId} is not stored`);
    return row;
  }

  // Ownership reads and writes always go to the primary client: a replica's
  // stale view of a lease would let a claim or a fenced write act on old data.

  supportsRunFencing(): boolean {
    return true;
  }

  #runOwnersTable(): string {
    return getTableName({ indexName: TABLE_WORKFLOW_RUN_OWNERS, schemaName: getSchemaName(this.#schema) });
  }

  async #readRunOwner(q: Queryable, runId: string): Promise<RunOwnershipRecord | null> {
    const row = await q.oneOrNone<RunOwnerRow>(
      `SELECT ${RUN_OWNER_COLUMNS} FROM ${this.#runOwnersTable()} WHERE "runId" = $1`,
      [runId],
    );
    return row ? toRunOwnershipRecord(runId, row) : null;
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('PG', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { runId },
      },
      error,
    );
  }

  async claimRunOwnership({
    runId,
    ownerId,
    leaseMs,
    force,
    expectedGeneration,
  }: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    const table = this.#runOwnersTable();
    try {
      return await this.#db.client.tx(async t => {
        const existing = await t.oneOrNone(`SELECT 1 FROM ${table} WHERE "runId" = $1 FOR UPDATE`, [runId]);
        if (!existing) {
          if (expectedGeneration !== undefined && expectedGeneration !== 0) {
            return { acquired: false, record: null };
          }
          // A first claim seeds its generation from the database clock, so a run
          // whose ownership row was pruned starts above every generation it had.
          const inserted = await t.oneOrNone<RunOwnerRow>(
            `INSERT INTO ${table} ("runId", generation, "ownerId", "leaseExpiresAt", "updatedAt")
             VALUES ($1, GREATEST(1, ${DB_NOW_MS}), $2, ${DB_NOW_MS} + $3, ${DB_NOW_MS})
             ON CONFLICT ("runId") DO NOTHING
             RETURNING ${RUN_OWNER_COLUMNS}`,
            [runId, ownerId, leaseMs],
          );
          if (inserted) return { acquired: true, record: toRunOwnershipRecord(runId, inserted) };
          // A concurrent first claim inserted the row; the update below claims against it.
        }
        // The lease check runs in this statement, after the row lock is held, so
        // it reads the database clock at the moment the claim actually happens.
        const claimed = await t.oneOrNone<RunOwnerRow>(
          `UPDATE ${table}
           SET generation = generation + 1, "ownerId" = $2, "leaseExpiresAt" = ${DB_NOW_MS} + $3,
               "updatedAt" = ${DB_NOW_MS}
           WHERE "runId" = $1
             AND ($4::bigint IS NULL OR generation = $4)
             AND ($5::boolean OR "leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${DB_NOW_MS})
           RETURNING ${RUN_OWNER_COLUMNS}`,
          [runId, ownerId, leaseMs, expectedGeneration ?? null, force === true],
        );
        if (claimed) return { acquired: true, record: toRunOwnershipRecord(runId, claimed) };
        return { acquired: false, record: await this.#readRunOwner(t, runId) };
      });
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', runId, error);
    }
  }

  async renewRunOwnership({ leaseMs, ...fence }: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      const renewed = await this.#db.client.oneOrNone<RunOwnerRow>(
        `UPDATE ${this.#runOwnersTable()}
         SET "leaseExpiresAt" = ${DB_NOW_MS} + $4, "updatedAt" = ${DB_NOW_MS}
         WHERE "runId" = $1 AND generation = $2 AND "ownerId" = $3 AND "leaseExpiresAt" IS NOT NULL
         RETURNING ${RUN_OWNER_COLUMNS}`,
        [fence.runId, fence.generation, fence.ownerId, leaseMs],
      );
      if (renewed) return { renewed: true, record: toRunOwnershipRecord(fence.runId, renewed) };
      return { renewed: false, record: await this.#readRunOwner(this.#db.client, fence.runId) };
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      const released = await this.#db.client.oneOrNone(
        `UPDATE ${this.#runOwnersTable()}
         SET "leaseExpiresAt" = NULL, "updatedAt" = ${DB_NOW_MS}
         WHERE "runId" = $1 AND generation = $2 AND "ownerId" = $3
         RETURNING "runId"`,
        [fence.runId, fence.generation, fence.ownerId],
      );
      return released !== null;
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await this.#readRunOwner(this.#db.client, runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
    }
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
    state,
    fence: explicitFence,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
    state?: Record<string, any>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const fence = resolveRunFence(this, explicitFence, runId);
    try {
      // Use a transaction with row-level locking to ensure atomicity
      return await this.#db.client.tx(async t => {
        if (fence) await assertRunFence(t, this.#runOwnersTable(), fence, 'updateWorkflowResults');
        const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) });

        // Load existing snapshot within transaction with FOR UPDATE to lock the row
        // This prevents concurrent updates from reading stale data
        const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState }>(
          `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );

        if (!existingSnapshotResult) {
          const v2 = await t.oneOrNone(`SELECT 1 FROM ${this.#runsTable()} WHERE workflow_name = $1 AND run_id = $2`, [
            workflowName,
            runId,
          ]);
          if (v2) throw new Error(`updateWorkflowResults does not support storage v2 runs (run ${runId})`);
          return {};
        }

        const existingSnapshot = existingSnapshotResult.snapshot;
        const snapshot: WorkflowRunState =
          typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

        // Merge the new step result using element-wise array merging
        // (critical for concurrent foreach iteration results)
        mergeWorkflowStepResult({ snapshot, stepId, result, requestContext, state });

        // Upsert the snapshot within the same transaction
        const now = new Date();
        const sanitizedSnapshot = toPgJson(snapshot);
        await t.none(
          `INSERT INTO ${tableName}
           (workflow_name, run_id, snapshot, "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (workflow_name, run_id) DO UPDATE
           SET snapshot = $3, "updatedAt" = $5, "updatedAtZ" = $7`,
          [workflowName, runId, sanitizedSnapshot, now, now, now, now],
        );

        return snapshot.context;
      });
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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
    fence: explicitFence,
    storageVersion,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRunState | undefined> {
    const fence = resolveRunFence(this, explicitFence, runId);
    try {
      // Use a transaction with row-level locking to ensure atomicity
      return await this.#db.client.tx(async t => {
        if (fence) await assertRunFence(t, this.#runOwnersTable(), fence, 'updateWorkflowState');

        if (storageVersion !== 1) {
          const run = await t.oneOrNone<{ header: WorkflowRunHeader }>(
            `SELECT header FROM ${this.#runsTable()} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
            [workflowName, runId],
          );
          if (run) {
            const { expectedStatus, ...patch } = opts;
            if (!matchesExpectedWorkflowStatus(run.header.status, expectedStatus)) {
              return undefined;
            }
            const header = { ...run.header, ...patch };
            const now = new Date();
            // The header lock is held, so this statement sees every append committed before it.
            const { entries } = await t.one<{ entries: EntryRow[] }>(
              `UPDATE ${this.#runsTable()} r
               SET header = $3::jsonb, status = $4, "updatedAt" = $5, "updatedAtZ" = $6
               WHERE r.workflow_name = $1 AND r.run_id = $2
               RETURNING ${this.#entriesSql('r')} AS entries`,
              [workflowName, runId, toPgJson(header), header.status, now, now],
            );
            return this.#materializeRun(t, header, entries);
          }
          if (storageVersion === 2) return undefined;
        }

        const tableName = getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) });

        // Load existing snapshot within transaction with FOR UPDATE to lock the row
        // This prevents concurrent updates from reading stale data
        const existingSnapshotResult = await t.oneOrNone<{ snapshot: WorkflowRunState }>(
          `SELECT snapshot FROM ${tableName} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );

        if (!existingSnapshotResult) {
          return undefined;
        }

        // Parse existing snapshot
        const existingSnapshot = existingSnapshotResult.snapshot;
        const snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

        if (!snapshot || !snapshot?.context) {
          throw new Error(`Snapshot not found for runId ${runId}`);
        }

        // `expectedStatus` is a compare-and-set guard, not state. It is checked here, inside the
        // row lock, and stripped so it can never be merged into the persisted snapshot.
        const { expectedStatus, ...state } = opts;
        if (!matchesExpectedWorkflowStatus(snapshot.status, expectedStatus)) {
          return undefined;
        }

        // Merge the new options with the existing snapshot
        const updatedSnapshot = { ...snapshot, ...state };

        // Update the snapshot within the same transaction
        const sanitizedSnapshot = toPgJson(updatedSnapshot);
        const now = new Date();
        await t.none(
          `UPDATE ${tableName}
           SET snapshot = $1, "updatedAt" = $2, "updatedAtZ" = $3
           WHERE workflow_name = $4 AND run_id = $5`,
          [sanitizedSnapshot, now, now, workflowName, runId],
        );

        return updatedSnapshot;
      });
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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
    fence,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
  }): Promise<void> {
    try {
      const now = new Date();
      const createdAtValue = createdAt ? createdAt : now;
      const updatedAtValue = updatedAt ? updatedAt : now;
      // Sanitize the snapshot JSON to remove problematic Unicode sequences
      const sanitizedSnapshot = toPgJson(snapshot);
      await withRunFence(
        this.#db.client,
        this.#runOwnersTable(),
        resolveRunFence(this, fence, runId),
        'persistWorkflowSnapshot',
        q =>
          q.none(
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
          ),
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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
    storageVersion,
  }: {
    workflowName: string;
    runId: string;
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRunState | null> {
    try {
      if (storageVersion !== 1) {
        const run = await this.#db.client.oneOrNone<{ header: WorkflowRunHeader; entries: EntryRow[] }>(
          `SELECT r.header, ${this.#entriesSql('r')} AS entries
           FROM ${this.#runsTable()} r WHERE r.workflow_name = $1 AND r.run_id = $2`,
          [workflowName, runId],
        );
        if (run) return await this.#materializeRun(this.#db.client, run.header, run.entries);
        if (storageVersion === 2) return null;
      }
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

  async getWorkflowRunById({
    runId,
    workflowName,
    storageVersion,
  }: {
    runId: string;
    workflowName?: string;
    storageVersion?: 1 | 2;
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

      const query = await this.#runsQuery({
        v1Where: storageVersion === 2 ? null : whereClause,
        v2Where: storageVersion === 1 ? null : whereClause,
        page: 'LIMIT 1',
      });

      const result = await this.#db.readClient.oneOrNone(query, values);

      if (!result) {
        return null;
      }

      return await this.#parseRun(this.#db.readClient, result);
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

  async deleteWorkflowRunById({
    runId,
    workflowName,
    fence,
  }: {
    runId: string;
    workflowName: string;
    fence?: RunFence;
  }): Promise<void> {
    const resolvedFence = resolveRunFence(this, fence, runId);
    try {
      await this.#db.client.tx(async t => {
        if (resolvedFence) await assertRunFence(t, this.#runOwnersTable(), resolvedFence, 'deleteWorkflowRunById');
        // The storage v2 header is locked first: its row lock waits out an in-flight append, and the
        // entries delete, a later statement, then sees that append's entries. The runs built on
        // this one's state are detached while its entries can still be read.
        const run = await t.oneOrNone<{ stateShared: boolean }>(
          `SELECT "stateShared" FROM ${this.#runsTable()} WHERE workflow_name = $1 AND run_id = $2 FOR UPDATE`,
          [workflowName, runId],
        );
        if (run?.stateShared) await this.#detachStateChildren(t, workflowName, runId);
        for (const table of [
          this.#runsTable(),
          this.#entriesTable(),
          getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) }),
        ]) {
          await t.none(`DELETE FROM ${table} WHERE run_id = $1 AND workflow_name = $2`, [runId, workflowName]);
        }
      });
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
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
    threadId,
    status,
    summary,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      // v1 rows filter on their snapshot JSON, storage v2 runs on their header columns.
      const conditions: string[] = [];
      const v2Conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (workflowName) {
        conditions.push(`workflow_name = $${paramIndex}`);
        v2Conditions.push(`workflow_name = $${paramIndex}`);
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
        const snapshotType = await this.#db.getColumnType(TABLE_WORKFLOW_SNAPSHOT, 'snapshot');
        const statusExpr =
          snapshotType === 'jsonb'
            ? `snapshot ->> 'status'`
            : `regexp_replace(snapshot::text, '\\\\u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})', '', 'g')::jsonb ->> 'status'`;
        conditions.push(`${statusExpr} = $${paramIndex}`);
        v2Conditions.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (resourceId) {
        const hasResourceId = await this.#db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`"resourceId" = $${paramIndex}`);
        } else {
          this.logger?.warn?.(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
        v2Conditions.push(`"resourceId" = $${paramIndex}`);
        values.push(resourceId);
        paramIndex++;
      }

      if (threadId) {
        // The thread id lives inside the snapshot JSON, not in a column. Push the filter
        // down only on jsonb columns, where the expression (and its backing index) can be
        // evaluated; legacy json/text snapshot columns skip it. Skipping only returns a
        // superset — callers (Agent.listSuspendedRuns) re-verify the thread id in-process.
        // Storage v2 runs keep the thread id in a header column, set on every write.
        const snapshotType = await this.#db.getColumnType(TABLE_WORKFLOW_SNAPSHOT, 'snapshot');
        if (snapshotType === 'jsonb') {
          conditions.push(`${WORKFLOW_SNAPSHOT_THREAD_ID_EXPR} = $${paramIndex}`);
        } else {
          this.logger?.warn?.(`[${TABLE_WORKFLOW_SNAPSHOT}] snapshot column is not jsonb. Skipping threadId filter.`);
        }
        v2Conditions.push(`"threadId" = $${paramIndex}`);
        values.push(threadId);
        paramIndex++;
      }

      if (fromDate) {
        conditions.push(`"createdAt" >= $${paramIndex}`);
        v2Conditions.push(`"createdAt" >= $${paramIndex}`);
        values.push(fromDate);
        paramIndex++;
      }

      if (toDate) {
        conditions.push(`"createdAt" <= $${paramIndex}`);
        v2Conditions.push(`"createdAt" <= $${paramIndex}`);
        values.push(toDate);
        paramIndex++;
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const v2WhereClause = v2Conditions.length > 0 ? `WHERE ${v2Conditions.join(' AND ')}` : '';

      let total = 0;
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      if (usePagination) {
        const countResult = await this.#db.client.one(
          `SELECT (SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_WORKFLOW_SNAPSHOT, schemaName: getSchemaName(this.#schema) })} ${whereClause})
             + (SELECT COUNT(*) FROM ${this.#runsTable()} ${v2WhereClause}) AS count`,
          values,
        );
        total = Number(countResult.count);
      }

      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : undefined;

      // In summary mode only read status/timestamp out of the snapshot so large snapshots aren't transferred.
      // Legacy json/text columns get the same sanitizing path as the status filter so bad escapes can't fail the list.
      let v1Snapshot = 'snapshot';
      if (summary) {
        const snapshotType = await this.#db.getColumnType(TABLE_WORKFLOW_SNAPSHOT, 'snapshot');
        const snapshotJson =
          snapshotType === 'jsonb'
            ? 'snapshot'
            : `regexp_replace(snapshot::text, '\\\\u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})', '', 'g')::jsonb`;
        v1Snapshot = `jsonb_build_object('status', ${snapshotJson} -> 'status', 'timestamp', ${snapshotJson} -> 'timestamp')`;
      }

      const query = await this.#runsQuery({
        v1Where: whereClause,
        v2Where: v2WhereClause,
        v1Snapshot,
        summary,
        page: usePagination ? `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : '',
      });

      const queryValues = usePagination ? [...values, normalizedPerPage, offset] : values;

      const result = await this.#db.client.manyOrNone(query, queryValues);

      const runs = await Promise.all((result || []).map(row => this.#parseRun(this.#db.client, row)));

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
