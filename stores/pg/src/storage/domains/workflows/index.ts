import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  getSnapshotMemoryInfo,
  materializeWorkflowRun,
  mergeWorkflowStepResult,
  normalizePerPage,
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
  StorageListWorkflowRunsInput,
  WorkflowRun,
  WorkflowRunChanges,
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

/** A storage v2 entry as written: one element of the jsonb array the write statements unpack. */
interface EntryInput {
  kind: 'step' | 'state';
  step_id: string | null;
  payload: unknown;
}

/** A storage v2 entry as read back by `#entriesSql`. */
interface EntryRow {
  seq: number;
  kind: 'step' | 'state';
  step_id: string | null;
  payload: unknown;
  /** The payload was undefined when written (SQL NULL), as opposed to JSON null. */
  absent: boolean;
}

/** The header columns of a storage v2 write. */
interface RunWrite {
  workflowName: string;
  runId: string;
  resourceId?: string;
  threadId: string | null;
  status: string;
  header: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The entries a storage v2 write adds: the listed steps and, when it changed, the state.
 * A checkpoint (no `changes`) adds every `context` key and the state.
 */
function journalEntries(snapshot: WorkflowRunState, changes?: WorkflowRunChanges): EntryInput[] {
  const stepIds = changes ? changes.stepIds : Object.keys(snapshot.context);
  const entries: EntryInput[] = stepIds.map(stepId => ({
    kind: 'step',
    step_id: stepId,
    payload: snapshot.context[stepId],
  }));
  if (!changes || changes.state) entries.push({ kind: 'state', step_id: null, payload: snapshot.value });
  return entries;
}

/**
 * Rows `e(elem, ord)` of the jsonb array parameter `param` of {@link EntryInput}, and the
 * entry columns they insert. `elem -> 'payload'` keeps a JSON null apart from an undefined
 * payload (dropped by `JSON.stringify`), which becomes SQL NULL.
 */
const entryRows = (param: string) => `jsonb_array_elements(${param}::jsonb) WITH ORDINALITY AS e(elem, ord)`;
const ENTRY_VALUES = `e.elem ->> 'kind', e.elem ->> 'step_id', e.elem -> 'payload'`;

/** Rebuilds a storage v2 run's state; an undefined payload reads back as undefined, as in v1. */
function materializeRun(header: WorkflowRunHeader, rows: EntryRow[]): WorkflowRunState {
  const entries = rows.map((row): WorkflowRunEntry => {
    const payload = row.absent ? undefined : row.payload;
    return row.kind === 'step'
      ? { seq: row.seq, kind: 'step', stepId: row.step_id!, result: payload }
      : { seq: row.seq, kind: 'state', state: payload as Record<string, any> };
  });
  return materializeWorkflowRun(header, entries);
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

  /** Deletes up to `limit` aged storage v2 runs, header and entries together, in one statement. */
  async #pruneRunsBatch(cutoff: Date | number, limit: number): Promise<number> {
    const result = await this.#db.client.query(
      `WITH doomed AS (
         SELECT workflow_name, run_id FROM ${this.#runsTable()}
         WHERE "updatedAtZ" < $1
         ORDER BY "updatedAtZ"
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       ), entries AS (
         DELETE FROM ${this.#entriesTable()} e USING doomed d
         WHERE e.workflow_name = d.workflow_name AND e.run_id = d.run_id
       )
       DELETE FROM ${this.#runsTable()} r USING doomed d
       WHERE r.workflow_name = d.workflow_name AND r.run_id = d.run_id`,
      [cutoff, limit],
    );
    return result.rowCount ?? 0;
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
   * latest entry and the latest state entry, ordered by when each was first written so
   * `context` keys keep their write order.
   */
  #entriesSql(alias: string): string {
    return `(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'seq', x.seq, 'kind', x.kind, 'step_id', x.step_id, 'payload', x.payload, 'absent', x.payload IS NULL
        ) ORDER BY x.first_seq), '[]'::jsonb)
      FROM (
        SELECT e.seq, e.kind, e.step_id, e.payload,
          ROW_NUMBER() OVER (PARTITION BY e.kind, e.step_id ORDER BY e.seq DESC) AS rn,
          MIN(e.seq) OVER (PARTITION BY e.kind, e.step_id) AS first_seq
        FROM ${this.#entriesTable()} e
        WHERE e.workflow_name = ${alias}.workflow_name AND e.run_id = ${alias}.run_id
      ) x
      WHERE x.rn = 1)`;
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

  /** Parses a row of `#runsQuery`. */
  #parseRun(row: Record<string, any>): WorkflowRun {
    if (row.version !== 2) return this.parseWorkflowRun(row);
    const snapshot = row.entries ? materializeRun(row.header, row.entries) : row.snapshot;
    return { ...this.parseWorkflowRun({ ...row, snapshot }), storageVersion: 2 };
  }

  /**
   * Writes a storage v2 run. An append is one statement: it bumps the header's `lastSeq` by
   * the number of entries (holding the header's row lock until commit, so entries commit in
   * `seq` order) and inserts the entries numbered up to it. It writes a checkpoint instead when
   * the run has no header (never written, deleted or pruned).
   */
  async #persistRun(
    run: RunWrite,
    snapshot: WorkflowRunState,
    changes: WorkflowRunChanges | undefined,
    fence: RunFence | undefined,
  ): Promise<void> {
    if (changes) {
      const appended = await withRunFence(
        this.#db.client,
        this.#runOwnersTable(),
        fence,
        'persistWorkflowSnapshot',
        q => this.#appendRun(q, run, journalEntries(snapshot, changes)),
      );
      if (appended) return;
    }
    await this.#db.client.tx(async t => {
      if (fence) await assertRunFence(t, this.#runOwnersTable(), fence, 'persistWorkflowSnapshot');
      await this.#checkpointRun(t, run, journalEntries(snapshot));
    });
  }

  async #appendRun(q: Queryable, run: RunWrite, entries: EntryInput[]): Promise<boolean> {
    const { found } = await q.one<{ found: number }>(
      `WITH h AS (
         UPDATE ${this.#runsTable()}
         SET "resourceId" = COALESCE($3, "resourceId"), "threadId" = $4, status = $5, header = $6::jsonb,
             "lastSeq" = "lastSeq" + $7::int, "updatedAt" = $8, "updatedAtZ" = $9
         WHERE workflow_name = $1 AND run_id = $2
         RETURNING "lastSeq"
       ), ins AS (
         INSERT INTO ${this.#entriesTable()} (workflow_name, run_id, seq, kind, step_id, payload)
         SELECT $1, $2, h."lastSeq" - $7::int + e.ord, ${ENTRY_VALUES}
         FROM h, ${entryRows('$10')}
       )
       SELECT count(*)::int AS found FROM h`,
      [
        run.workflowName,
        run.runId,
        run.resourceId,
        run.threadId,
        run.status,
        run.header,
        entries.length,
        run.updatedAt,
        run.updatedAt,
        toPgJson(entries),
      ],
    );
    return found > 0;
  }

  /** Replaces a storage v2 run's entries. Must run in a transaction. */
  async #checkpointRun(t: Queryable, run: RunWrite, entries: EntryInput[]): Promise<void> {
    const { lastSeq } = await t.one<{ lastSeq: number }>(
      `INSERT INTO ${this.#runsTable()} AS r
         (workflow_name, run_id, "resourceId", "threadId", status, header, "lastSeq", "createdAt", "updatedAt", "createdAtZ", "updatedAtZ")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::int, $8, $9, $10, $11)
       ON CONFLICT (workflow_name, run_id) DO UPDATE
       SET "resourceId" = COALESCE(EXCLUDED."resourceId", r."resourceId"), "threadId" = EXCLUDED."threadId",
           status = EXCLUDED.status, header = EXCLUDED.header, "lastSeq" = r."lastSeq" + EXCLUDED."lastSeq",
           "updatedAt" = EXCLUDED."updatedAt", "updatedAtZ" = EXCLUDED."updatedAtZ"
       RETURNING "lastSeq"`,
      [
        run.workflowName,
        run.runId,
        run.resourceId,
        run.threadId,
        run.status,
        run.header,
        entries.length,
        run.createdAt,
        run.updatedAt,
        run.createdAt,
        run.updatedAt,
      ],
    );
    // A new statement under READ COMMITTED: with the header locked above, it sees every
    // append that committed before this checkpoint, so none of their entries survive it.
    await t.none(`DELETE FROM ${this.#entriesTable()} WHERE workflow_name = $1 AND run_id = $2`, [
      run.workflowName,
      run.runId,
    ]);
    await t.none(
      `INSERT INTO ${this.#entriesTable()} (workflow_name, run_id, seq, kind, step_id, payload)
       SELECT $1, $2, $3::int - $4::int + e.ord, ${ENTRY_VALUES}
       FROM ${entryRows('$5')}`,
      [run.workflowName, run.runId, lastSeq, entries.length, toPgJson(entries)],
    );
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
            return materializeRun(header, entries);
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
    storageVersion,
    changes,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
    storageVersion?: 1 | 2;
    changes?: WorkflowRunChanges;
  }): Promise<void> {
    try {
      const now = new Date();
      const createdAtValue = createdAt ? createdAt : now;
      const updatedAtValue = updatedAt ? updatedAt : now;
      if (storageVersion === 2) {
        const { context, value, ...header } = snapshot;
        await this.#persistRun(
          {
            workflowName,
            runId,
            resourceId,
            threadId: getSnapshotMemoryInfo(snapshot)?.threadId ?? null,
            status: snapshot.status,
            header: toPgJson(header),
            createdAt: createdAtValue,
            updatedAt: updatedAtValue,
          },
          snapshot,
          changes,
          resolveRunFence(this, fence, runId),
        );
        return;
      }
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
        if (run) return materializeRun(run.header, run.entries);
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

      return this.#parseRun(result);
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
        // The storage v2 header goes first: its row lock waits out an in-flight append, and the
        // entries delete, a later statement, then sees that append's entries.
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

      const runs = (result || []).map(row => this.#parseRun(row));

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
