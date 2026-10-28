import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
  TABLE_NAMES,
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
  StoredWorkflowRun,
  StoredWorkflowRunHeader,
  StatePatchOp,
  StateRef,
  StateVersion,
  WorkflowRunEntry,
  WorkflowRunHeader,
} from '@mastra/core/storage';
import {
  createStorageErrorId,
  isRunFenceConflictError,
  materializeState,
  materializeWorkflowRun,
  mergeWorkflowStepResult,
  normalizePerPage,
  resolveRunFence,
  RUN_FENCING_TABLE_SCHEMAS,
  stateBaseOf,
  STEP_RESULT_SUMMARY_FIELDS,
  TABLE_WORKFLOW_RUN_ENTRIES,
  TABLE_WORKFLOW_RUN_OWNERS,
  TABLE_WORKFLOW_RUNS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCHEMAS,
  matchesExpectedWorkflowStatus,
  WORKFLOW_RUN_JOURNAL_TABLE_CONFIGS,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type { WorkflowRunState, StepResult } from '@mastra/core/workflows';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client, SqliteInValue as InValue, SqliteStatement, SqliteValue } from '../../db/client';
import { assertRunFence, DB_NOW_MS, inWriteTransaction, withRunFence } from '../../db/run-fencing';
import type { RunFenceCheck } from '../../db/run-fencing';
import { createExecuteWriteOperationWithRetry, safeStringify } from '../../db/utils';
import { withClientWriteLock } from '../../db/write-lock';
import { runPrune, resolveTargets } from '../../retention';

const RUN_OWNER_COLUMNS = `generation, ownerId, leaseExpiresAt, ${DB_NOW_MS} AS nowMs`;

/** A storage v2 entry as written: one element of the JSON array the write statements unpack. */
interface EntryInput {
  kind: WorkflowRunEntry['kind'];
  step_id: string | null;
  payload: unknown;
}

/** A storage v2 entry as read back by `entriesSql` or `stateEntriesSql`. */
interface EntryRow {
  seq: number;
  /**
   * The order to apply the entries in: for a step the `seq` of its first entry, so `context`
   * keys keep their write order, else the entry's own `seq`.
   */
  ord: number;
  kind: WorkflowRunEntry['kind'];
  step_id: string | null;
  payload: unknown;
  /** 1 when the payload was undefined when written (SQL NULL), as opposed to JSON null. */
  absent: number;
  /** 1 when read in summary mode and `payload` is the step's summary. */
  summarized?: number | null;
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
 * Upserts a storage v2 run's header, adds `entryCount` (the number of entries the write adds) to
 * its `lastSeq`, for {@link insertEntries} to number them up to, and returns the new `lastSeq`. A
 * checkpoint's state entries come last, so its `startStateSeq` is the new `lastSeq`; an append
 * keeps the stored one unless given `startStateSeq`.
 */
function upsertHeader(
  run: RunWrite,
  entryCount: number,
  write: { checkpoint: true } | { checkpoint: false; startStateSeq?: number },
): SqliteStatement {
  const now = new Date().toISOString();
  const startStateSeq = write.checkpoint
    ? { insert: '?', update: `${TABLE_WORKFLOW_RUNS}.lastSeq + excluded.lastSeq`, args: [entryCount] }
    : {
        insert: 'COALESCE(?, 0)',
        update: `COALESCE(?, ${TABLE_WORKFLOW_RUNS}.startStateSeq)`,
        args: [write.startStateSeq ?? null],
      };
  return {
    sql: `INSERT INTO ${TABLE_WORKFLOW_RUNS}
        (workflow_name, run_id, resourceId, threadId, status, header, lastSeq, startStateSeq, stateShared, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, jsonb(?), ?, ${startStateSeq.insert}, 0, ?, ?)
      ON CONFLICT(workflow_name, run_id) DO UPDATE SET
        resourceId = COALESCE(excluded.resourceId, ${TABLE_WORKFLOW_RUNS}.resourceId), threadId = excluded.threadId,
        status = excluded.status, header = excluded.header, lastSeq = ${TABLE_WORKFLOW_RUNS}.lastSeq + excluded.lastSeq,
        startStateSeq = ${startStateSeq.update}, updatedAt = excluded.updatedAt
      RETURNING lastSeq`,
    args: [
      run.workflowName,
      run.runId,
      run.resourceId ?? null,
      run.threadId ?? null,
      run.header.status,
      safeStringify(run.header),
      entryCount,
      ...startStateSeq.args,
      now,
      now,
      ...(write.checkpoint ? [] : startStateSeq.args),
    ],
  };
}

/**
 * Inserts the entries in the JSON array parameter after the run's header has been bumped by
 * their count, numbering them up to the header's `lastSeq`. `-> '$.payload'` keeps a JSON null
 * apart from an undefined payload (dropped by `JSON.stringify`), which becomes SQL NULL.
 * Args: entry count, entries JSON, workflow name, run id.
 */
const INSERT_ENTRIES = `INSERT INTO ${TABLE_WORKFLOW_RUN_ENTRIES} (workflow_name, run_id, seq, kind, step_id, payload)
  SELECT h.workflow_name, h.run_id, h.lastSeq - ? + j.key + 1, j.value ->> '$.kind', j.value ->> '$.step_id', jsonb(j.value -> '$.payload')
  FROM ${TABLE_WORKFLOW_RUNS} h, json_each(?) j
  WHERE h.workflow_name = ? AND h.run_id = ?`;

function insertEntries(run: RunWrite, entries: EntryInput[]): SqliteStatement {
  return { sql: INSERT_ENTRIES, args: [entries.length, safeStringify(entries), run.workflowName, run.runId] };
}

/**
 * The run a `state-base` entry's payload names: the expressions of the state base index, which
 * a lookup must repeat exactly to use it.
 */
const STATE_BASE_WORKFLOW_EXPR = `payload ->> '$.workflowName'`;
const STATE_BASE_RUN_EXPR = `payload ->> '$.runId'`;

/**
 * A JSON array of {@link EntryRow} for the storage v2 run `alias` refers to: each step's
 * latest entry, and the entries `materializeState` uses for the latest state: the latest full
 * state or state base and every state patch after it. Drafts are left out.
 *
 * With `summary`, successful steps other than `input` come back as their summary, built here
 * so their data is never sent. Like `summarizeStepResult`, it keeps a field that is JSON null
 * and leaves out one that is absent. It then takes one arg, `STEP_RESULT_SUMMARY_FIELDS` as
 * JSON, bound where this SQL sits in the statement.
 */
function entriesSql(alias: string, { summary }: { summary?: boolean } = {}): string {
  let payload = 'json(x.payload)';
  if (summary) {
    const summarized = `(x.kind = 'step' AND x.step_id <> 'input' AND x.payload ->> '$.status' = 'success')`;
    payload = `json(CASE WHEN ${summarized} THEN (
          SELECT json_group_object(f.key, json(x.payload -> f.fullkey))
          FROM json_each(x.payload) f WHERE f.key IN (SELECT value FROM json_each(?))
        ) ELSE x.payload END), 'summarized', ${summarized}`;
  }
  return `(SELECT json_group_array(json_object(
        'seq', x.seq, 'ord', CASE WHEN x.kind = 'step' THEN x.first_seq ELSE x.seq END, 'kind', x.kind, 'step_id', x.step_id,
        'absent', x.payload IS NULL, 'payload', ${payload}
      ))
    FROM (
      SELECT e.seq, e.kind, e.step_id, e.payload,
        ROW_NUMBER() OVER (PARTITION BY e.kind, e.step_id ORDER BY e.seq DESC) AS rn,
        MIN(e.seq) OVER (PARTITION BY e.kind, e.step_id) AS first_seq,
        MAX(CASE WHEN e.kind IN ('state', 'state-base') THEN e.seq END) OVER () AS base_seq
      FROM ${TABLE_WORKFLOW_RUN_ENTRIES} e
      WHERE e.workflow_name = ${alias}.workflow_name AND e.run_id = ${alias}.run_id AND e.kind <> 'state-draft'
    ) x
    WHERE CASE WHEN x.kind = 'step' THEN x.rn = 1 ELSE x.base_seq IS NULL OR x.seq >= x.base_seq END)`;
}

/**
 * A JSON array of {@link EntryRow} with the entries `materializeState` uses for the state of the
 * storage v2 run `alias` refers to as of a version. For a draft, every state entry up to it, as
 * the drafts it is on can build on any earlier version; otherwise the latest full state or state
 * base up to it and the state patches after it. Takes two args, bound where this SQL sits in the
 * statement: the version's `seq`, then 1 when it is a draft, else 0.
 */
function stateEntriesSql(alias: string): string {
  return `(SELECT json_group_array(json_object(
        'seq', x.seq, 'ord', x.seq, 'kind', x.kind, 'step_id', x.step_id, 'absent', x.payload IS NULL, 'payload', json(x.payload)
      ))
    FROM (
      SELECT e.seq, e.kind, e.step_id, e.payload,
        MAX(CASE WHEN e.kind IN ('state', 'state-base') THEN e.seq END) OVER () AS base_seq
      FROM ${TABLE_WORKFLOW_RUN_ENTRIES} e
      WHERE e.workflow_name = ${alias}.workflow_name AND e.run_id = ${alias}.run_id
        AND e.kind <> 'step' AND e.seq <= ?
    ) x
    WHERE ? OR (x.kind <> 'state-draft' AND (x.base_seq IS NULL OR x.seq >= x.base_seq)))`;
}

/** `entriesSql` or `stateEntriesSql` rows, in the order to apply them. */
function entryRows(json: string): EntryRow[] {
  return (JSON.parse(json) as EntryRow[]).sort((a, b) => a.ord - b.ord);
}

/** The entries of {@link entryRows}; an undefined payload reads back as undefined, as in v1. */
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

type Queryable = { execute: Client['execute'] };

function toRunOwnershipRecord(runId: string, row: Record<string, SqliteValue>): RunOwnershipRecord {
  const leaseExpiresAt = row.leaseExpiresAt === null ? null : Number(row.leaseExpiresAt);
  return {
    runId,
    generation: Number(row.generation),
    ownerId: String(row.ownerId),
    leaseExpiresAt: leaseExpiresAt === null ? null : new Date(leaseExpiresAt),
    live: leaseExpiresAt !== null && leaseExpiresAt > Number(row.nowMs),
  };
}

export class WorkflowsLibSQL extends WorkflowsStorage {
  /**
   * Workflow run snapshots accumulate as runs execute. Anchored on `updatedAt`
   * (last activity) so suspended/long-running runs are not pruned by start age.
   *
   * Run ownership rows are anchored on `updatedAt` (epoch ms), which every
   * claim, renewal and release refreshes, so a live execution's row is never
   * older than its renew interval.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    workflowSnapshot: { table: TABLE_WORKFLOW_SNAPSHOT, column: 'updatedAt', indexed: true },
    runOwnership: { table: TABLE_WORKFLOW_RUN_OWNERS, column: 'updatedAt', indexed: true, anchorType: 'epoch-ms' },
  };

  #db: LibSQLDB;
  #client: Client;
  private readonly executeWithRetry: <T>(operationFn: () => Promise<T>, operationDescription: string) => Promise<T>;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    const maxRetries = config.maxRetries ?? 5;
    const initialBackoffMs = config.initialBackoffMs ?? 500;

    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries, initialBackoffMs });
    this.executeWithRetry = createExecuteWriteOperationWithRetry({
      logger: this.logger,
      maxRetries,
      initialBackoffMs,
    });

    // Set PRAGMA settings to help with database locks
    // Note: This is async but we can't await in constructor, so we'll handle it as a fire-and-forget
    this.setupPragmaSettings().catch(err =>
      this.logger.warn('LibSQL Workflows: Failed to setup PRAGMA settings.', err),
    );
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
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  async init(): Promise<void> {
    const schema = TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT];
    await this.#db.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema });
    // Add resourceId column for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema,
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
    await withClientWriteLock(this.#client, () =>
      this.#client.batch(
        [
          `CREATE INDEX IF NOT EXISTS mastra_workflow_runs_name_createdat_idx ON ${TABLE_WORKFLOW_RUNS} (workflow_name, createdAt DESC)`,
          `CREATE INDEX IF NOT EXISTS mastra_workflow_runs_name_status_createdat_idx ON ${TABLE_WORKFLOW_RUNS} (workflow_name, status, createdAt DESC)`,
          `CREATE INDEX IF NOT EXISTS mastra_workflow_runs_threadid_idx ON ${TABLE_WORKFLOW_RUNS} (threadId)`,
          // Backs the latest-entry-per-step read.
          `CREATE INDEX IF NOT EXISTS mastra_workflow_run_entries_step_idx ON ${TABLE_WORKFLOW_RUN_ENTRIES} (workflow_name, run_id, kind, step_id, seq)`,
          // Backs finding the runs built on a run's state, to detach them when it is deleted.
          `CREATE INDEX IF NOT EXISTS mastra_workflow_run_entries_state_base_idx ON ${TABLE_WORKFLOW_RUN_ENTRIES}
            (${STATE_BASE_WORKFLOW_EXPR}, ${STATE_BASE_RUN_EXPR}) WHERE kind = 'state-base'`,
        ].map(sql => ({ sql, args: [] })),
        'write',
      ),
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_RUN_OWNERS as TABLE_NAMES });
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_RUNS as TABLE_NAMES });
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_RUN_ENTRIES as TABLE_NAMES });
  }

  supportsRunFencing(): boolean {
    return true;
  }

  /** @experimental */
  supportsRunJournal(): boolean {
    return true;
  }

  #runFenceCheck(fence: RunFence | undefined, runId: string, operation: string): RunFenceCheck | undefined {
    const resolved = resolveRunFence(this, fence, runId);
    return resolved && { claimsTable: TABLE_WORKFLOW_RUN_OWNERS, fence: resolved, operation };
  }

  /**
   * Selects v1 snapshot rows and storage v2 runs as one result, newest first. Each version
   * has its own WHERE clause; `null` leaves it out. Storage v2 rows carry their header and
   * entries, or in summary mode only the summary snapshot. `page` is appended to the
   * combined, ordered rows (e.g. `LIMIT 1`). Bind the v1 args, then the v2 args, then `page`'s.
   */
  #runsSql({
    v1Where,
    v2Where,
    summary,
    page = '',
  }: {
    v1Where: string | null;
    v2Where: string | null;
    summary?: boolean;
    page?: string;
  }): string {
    const branches: string[] = [];
    if (v1Where !== null) {
      const snapshot = summary
        ? `json_object('status', json_extract(snapshot, '$.status'), 'timestamp', json_extract(snapshot, '$.timestamp'))`
        : 'json(snapshot)';
      branches.push(
        `SELECT workflow_name, run_id, resourceId, ${snapshot} AS snapshot, NULL AS header, createdAt, updatedAt, 1 AS version
         FROM ${TABLE_WORKFLOW_SNAPSHOT} ${v1Where}`,
      );
    }
    if (v2Where !== null) {
      const columns = summary
        ? `json_object('status', status, 'timestamp', json_extract(header, '$.timestamp')) AS snapshot, NULL AS header`
        : 'NULL AS snapshot, json(header) AS header';
      branches.push(
        `SELECT workflow_name, run_id, resourceId, ${columns}, createdAt, updatedAt, 2 AS version
         FROM ${TABLE_WORKFLOW_RUNS} ${v2Where}`,
      );
    }
    const entries = summary ? '' : `, CASE WHEN p.version = 2 THEN ${entriesSql('p')} END AS entries`;
    return `SELECT p.*${entries}
      FROM (${branches.join(' UNION ALL ')} ORDER BY createdAt DESC ${page}) p
      ORDER BY p.createdAt DESC`;
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
    const result = await q.execute({
      sql: `SELECT ${stateEntriesSql('r')} AS entries
        FROM ${TABLE_WORKFLOW_RUNS} r WHERE r.workflow_name = ? AND r.run_id = ?`,
      args: [at.seq, at.draft === true ? 1 : 0, workflowName, runId],
    });
    const row = result.rows[0];
    if (!row) return null;
    const entries = toEntries(entryRows(row.entries as string));
    return materializeState(entries, { at, base: await this.#stateBase(q, entries, at) });
  }

  /**
   * Before a run is deleted, stores the full state in place of every `state-base` entry built on
   * it, so the runs built on it keep reading the same state. Runs inside the delete's transaction.
   */
  async #detachStateChildren(q: Queryable, workflowName: string, runId: string): Promise<void> {
    const children = await q.execute({
      sql: `SELECT workflow_name, run_id, seq, json(payload) AS payload FROM ${TABLE_WORKFLOW_RUN_ENTRIES}
        WHERE kind = 'state-base' AND ${STATE_BASE_WORKFLOW_EXPR} = ? AND ${STATE_BASE_RUN_EXPR} = ?`,
      args: [workflowName, runId],
    });
    const states = new Map<string, Record<string, any>>();
    for (const child of children.rows) {
      const ref: StateRef = JSON.parse(child.payload as string);
      const version = `${ref.seq}:${ref.draft === true}`;
      let state = states.get(version);
      if (!state) {
        state = (await this.#stateAt(q, workflowName, runId, ref))?.state ?? {};
        states.set(version, state);
      }
      await q.execute({
        sql: `UPDATE ${TABLE_WORKFLOW_RUN_ENTRIES} SET kind = 'state', payload = jsonb(?)
          WHERE workflow_name = ? AND run_id = ? AND seq = ?`,
        args: [safeStringify(state), child.workflow_name as string, child.run_id as string, child.seq as number],
      });
    }
  }

  /** Rebuilds a storage v2 run's `WorkflowRunState` from its header and `entriesSql` JSON. */
  async #materializeRun(q: Queryable, header: WorkflowRunHeader | string, rows: string): Promise<WorkflowRunState> {
    const parsedHeader: WorkflowRunHeader = typeof header === 'string' ? JSON.parse(header) : header;
    const entries = toEntries(entryRows(rows));
    return materializeWorkflowRun(parsedHeader, entries, await this.#stateBase(q, entries));
  }

  /** Parses a row of `#runsSql`. */
  async #parseRun(row: Record<string, any>): Promise<WorkflowRun> {
    if (Number(row.version) !== 2) return this.parseWorkflowRun(row);
    const snapshot = row.entries ? await this.#materializeRun(this.#client, row.header, row.entries) : row.snapshot;
    return { ...this.parseWorkflowRun({ ...row, snapshot }), storageVersion: 2 };
  }

  #runError(operation: string, workflowName: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('LIBSQL', operation, 'FAILED'),
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
      const result = await this.#client.execute({
        sql: `SELECT json(header) AS header, lastSeq, startStateSeq FROM ${TABLE_WORKFLOW_RUNS} WHERE workflow_name = ? AND run_id = ?`,
        args: [workflowName, runId],
      });
      const row = result.rows[0];
      return row
        ? {
            header: JSON.parse(row.header as string),
            lastSeq: Number(row.lastSeq),
            startStateSeq: Number(row.startStateSeq),
          }
        : null;
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
      // One statement, so the header and entries come from the same snapshot of the database.
      const result = await this.#client.execute({
        sql: `SELECT json(r.header) AS header, r.lastSeq, r.startStateSeq, ${entriesSql('r', { summary })} AS entries
          FROM ${TABLE_WORKFLOW_RUNS} r WHERE r.workflow_name = ? AND r.run_id = ?`,
        args: summary ? [JSON.stringify(STEP_RESULT_SUMMARY_FIELDS), workflowName, runId] : [workflowName, runId],
      });
      const run = result.rows[0];
      if (!run) return null;

      const header: WorkflowRunHeader = JSON.parse(run.header as string);
      const rows = entryRows(run.entries as string);
      const entries = toEntries(rows);
      const steps: StoredWorkflowRun['steps'] = {};
      const summarizedStepIds: string[] = [];
      entries.forEach((entry, i) => {
        if (entry.kind !== 'step') return;
        steps[entry.stepId] = entry.result as StoredWorkflowRun['steps'][string];
        if (rows[i]!.summarized) summarizedStepIds.push(entry.stepId);
      });
      const base = await this.#stateBase(this.#client, entries);
      const { state, statePatchBytes } = materializeState(entries, { base });
      return {
        header,
        lastSeq: Number(run.lastSeq),
        startStateSeq: Number(run.startStateSeq),
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
      const result = await this.#client.execute({
        sql: `SELECT step_id, json(payload) AS payload FROM (
            SELECT step_id, payload, ROW_NUMBER() OVER (PARTITION BY step_id ORDER BY seq DESC) AS rn
            FROM ${TABLE_WORKFLOW_RUN_ENTRIES}
            WHERE workflow_name = ? AND run_id = ? AND kind = 'step' AND step_id IN (SELECT value FROM json_each(?))
          ) WHERE rn = 1`,
        args: [workflowName, runId, JSON.stringify(stepIds)],
      });
      return Object.fromEntries(
        result.rows.map(row => [
          row.step_id as string,
          row.payload == null ? undefined : JSON.parse(row.payload as string),
        ]),
      );
    } catch (error) {
      throw this.#runError('LOAD_WORKFLOW_RUN_STEPS', workflowName, runId, error);
    }
  }

  async updateWorkflowRunHeader({
    workflowName,
    runId,
    opts,
    fence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<StoredWorkflowRunHeader | undefined> {
    const check = this.#runFenceCheck(fence, runId, 'updateWorkflowRunHeader');
    try {
      return await this.executeWithRetry(
        () =>
          inWriteTransaction(this.#client, async tx => {
            if (check) await assertRunFence(tx, check);
            const result = await tx.execute({
              sql: `SELECT json(header) AS header, lastSeq, startStateSeq FROM ${TABLE_WORKFLOW_RUNS} WHERE workflow_name = ? AND run_id = ?`,
              args: [workflowName, runId],
            });
            const row = result.rows[0];
            if (!row) return undefined;
            const current: WorkflowRunHeader = JSON.parse(row.header as string);
            const { expectedStatus, ...patch } = opts;
            if (!matchesExpectedWorkflowStatus(current.status, expectedStatus)) return undefined;
            const header = { ...current, ...patch };
            await tx.execute({
              sql: `UPDATE ${TABLE_WORKFLOW_RUNS} SET header = jsonb(?), status = ?, updatedAt = ? WHERE workflow_name = ? AND run_id = ?`,
              args: [safeStringify(header), header.status, new Date().toISOString(), workflowName, runId],
            });
            return { header, lastSeq: Number(row.lastSeq), startStateSeq: Number(row.startStateSeq) };
          }),
        'updateWorkflowRunHeader',
      );
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw this.#runError('UPDATE_WORKFLOW_RUN_HEADER', workflowName, runId, error);
    }
  }

  /**
   * One batch behind the write lock: marking the run a state base builds on as shared, the header
   * upsert, then the deletion of the run's entries (only its steps when another run builds on its
   * state, see `stateShared`), then the new ones.
   */
  async writeWorkflowRunCheckpoint({
    fence,
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
    const check = this.#runFenceCheck(fence, run.runId, 'writeWorkflowRunCheckpoint');
    try {
      const statements: SqliteStatement[] = [];
      if (stateBase !== undefined) {
        statements.push({
          sql: `UPDATE ${TABLE_WORKFLOW_RUNS} SET stateShared = 1 WHERE workflow_name = ? AND run_id = ? AND NOT stateShared`,
          args: [stateBase.workflowName, stateBase.runId],
        });
      }
      statements.push(
        upsertHeader(run, entries.length, { checkpoint: true }),
        {
          sql: `DELETE FROM ${TABLE_WORKFLOW_RUN_ENTRIES} WHERE workflow_name = ? AND run_id = ?
            AND (kind = 'step' OR NOT (SELECT stateShared FROM ${TABLE_WORKFLOW_RUNS} WHERE workflow_name = ? AND run_id = ?))`,
          args: [run.workflowName, run.runId, run.workflowName, run.runId],
        },
        insertEntries(run, entries),
      );
      const results = await this.executeWithRetry(
        () => withRunFence(this.#client, check, writer => writer.batch(statements)),
        'writeWorkflowRunCheckpoint',
      );
      return { lastSeq: Number(results[statements.length - 3]!.rows[0]!.lastSeq) };
    } catch (error) {
      if (isRunFenceConflictError(error)) throw error;
      throw this.#runError('WRITE_WORKFLOW_RUN_CHECKPOINT', run.workflowName, run.runId, error);
    }
  }

  /**
   * One batch behind the write lock: the header upsert adds the entry count to `lastSeq`,
   * and the insert numbers the entries up to it, so writes to one run never interleave.
   */
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
    const check = this.#runFenceCheck(fence, run.runId, 'appendWorkflowRunEntries');
    try {
      const [header] = await this.executeWithRetry(
        () =>
          withRunFence(this.#client, check, writer =>
            writer.batch([
              upsertHeader(run, entries.length, { checkpoint: false, startStateSeq }),
              insertEntries(run, entries),
            ]),
          ),
        'appendWorkflowRunEntries',
      );
      return { lastSeq: Number(header!.rows[0]!.lastSeq) };
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
      return (await this.#stateAt(this.#client, workflowName, runId, { seq }))?.state ?? null;
    } catch (error) {
      throw this.#runError('LOAD_WORKFLOW_RUN_STATE', workflowName, runId, error);
    }
  }

  /** One batch behind the write lock: the header's `lastSeq` bump, then the draft numbered at it. */
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
    let row: Record<string, SqliteValue> | undefined;
    try {
      const [header] = await this.executeWithRetry(
        () =>
          withClientWriteLock(this.#client, () =>
            this.#client.batch(
              [
                {
                  sql: `UPDATE ${TABLE_WORKFLOW_RUNS} SET lastSeq = lastSeq + 1, stateShared = 1
                    WHERE workflow_name = ? AND run_id = ? RETURNING lastSeq`,
                  args: [workflowName, runId],
                },
                {
                  sql: `INSERT INTO ${TABLE_WORKFLOW_RUN_ENTRIES} (workflow_name, run_id, seq, kind, step_id, payload)
                    SELECT workflow_name, run_id, lastSeq, 'state-draft', NULL, jsonb(?)
                    FROM ${TABLE_WORKFLOW_RUNS} WHERE workflow_name = ? AND run_id = ?`,
                  args: [safeStringify(payload), workflowName, runId],
                },
              ],
              'write',
            ),
          ),
        'appendWorkflowRunStateDraft',
      );
      row = header!.rows[0];
    } catch (error) {
      throw this.#runError('APPEND_WORKFLOW_RUN_STATE_DRAFT', workflowName, runId, error);
    }
    if (!row) throw new Error(`Storage v2 run ${workflowName}/${runId} is not stored`);
    return { seq: Number(row.lastSeq) };
  }

  async #readRunOwner(q: { execute: Client['execute'] }, runId: string): Promise<RunOwnershipRecord | null> {
    const result = await q.execute({
      sql: `SELECT ${RUN_OWNER_COLUMNS} FROM ${TABLE_WORKFLOW_RUN_OWNERS} WHERE runId = ?`,
      args: [runId],
    });
    const row = result.rows[0];
    return row ? toRunOwnershipRecord(runId, row) : null;
  }

  #ownershipError(operation: string, runId: string, error: unknown): MastraError {
    return new MastraError(
      {
        id: createStorageErrorId('LIBSQL', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details: { runId },
      },
      error,
    );
  }

  // Claims, renewals and releases run in write transactions: the read that
  // judges the current claim and the write that replaces it hold the
  // database's write lock together, so racing claimers resolve one at a time.

  async claimRunOwnership({
    runId,
    ownerId,
    leaseMs,
    force,
    expectedGeneration,
  }: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    try {
      return await this.executeWithRetry(
        () =>
          inWriteTransaction(this.#client, async tx => {
            const current = await this.#readRunOwner(tx, runId);
            const generation = current?.generation ?? 0;
            if (expectedGeneration !== undefined && expectedGeneration !== generation) {
              return { acquired: false, record: current };
            }
            if (current?.live && !force) {
              return { acquired: false, record: current };
            }
            // A run's first generation is the database clock, so a run claimed
            // again after its record was pruned still gets a higher generation.
            await tx.execute({
              sql: `INSERT INTO ${TABLE_WORKFLOW_RUN_OWNERS} (runId, generation, ownerId, leaseExpiresAt, updatedAt)
                VALUES (?, COALESCE(?, MAX(1, ${DB_NOW_MS})), ?, ${DB_NOW_MS} + ?, ${DB_NOW_MS})
                ON CONFLICT(runId) DO UPDATE SET
                  generation = excluded.generation,
                  ownerId = excluded.ownerId,
                  leaseExpiresAt = excluded.leaseExpiresAt,
                  updatedAt = excluded.updatedAt`,
              args: [runId, current ? generation + 1 : null, ownerId, leaseMs],
            });
            return { acquired: true, record: (await this.#readRunOwner(tx, runId))! };
          }),
        'claimRunOwnership',
      );
    } catch (error) {
      throw this.#ownershipError('CLAIM_RUN_OWNERSHIP', runId, error);
    }
  }

  async renewRunOwnership({ leaseMs, ...fence }: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    try {
      return await this.executeWithRetry(
        () =>
          inWriteTransaction(this.#client, async tx => {
            const renewed = await tx.execute({
              sql: `UPDATE ${TABLE_WORKFLOW_RUN_OWNERS} SET leaseExpiresAt = ${DB_NOW_MS} + ?, updatedAt = ${DB_NOW_MS}
                WHERE runId = ? AND generation = ? AND ownerId = ? AND leaseExpiresAt IS NOT NULL`,
              args: [leaseMs, fence.runId, fence.generation, fence.ownerId],
            });
            const record = await this.#readRunOwner(tx, fence.runId);
            return renewed.rowsAffected > 0 ? { renewed: true, record: record! } : { renewed: false, record };
          }),
        'renewRunOwnership',
      );
    } catch (error) {
      throw this.#ownershipError('RENEW_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    try {
      const released = await this.executeWithRetry(
        () =>
          withClientWriteLock(this.#client, () =>
            this.#client.execute({
              sql: `UPDATE ${TABLE_WORKFLOW_RUN_OWNERS} SET leaseExpiresAt = NULL, updatedAt = ${DB_NOW_MS}
                WHERE runId = ? AND generation = ? AND ownerId = ?`,
              args: [fence.runId, fence.generation, fence.ownerId],
            }),
          ),
        'releaseRunOwnership',
      );
      return released.rowsAffected > 0;
    } catch (error) {
      throw this.#ownershipError('RELEASE_RUN_OWNERSHIP', fence.runId, error);
    }
  }

  async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    try {
      return await this.#readRunOwner(this.#client, runId);
    } catch (error) {
      throw this.#ownershipError('GET_RUN_OWNERSHIP', runId, error);
    }
  }

  /**
   * Delete workflow runs and run ownership rows older than their policy's `maxAge`, batched.
   * The `workflowSnapshot` policy covers both storage versions: storage v2 runs are pruned by
   * their header's last write, together with their entries.
   */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    const targets = resolveTargets({
      policies,
      descriptor: WorkflowsLibSQL.retentionTables,
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
      logger: this.logger,
      deleteBatch: (target, cutoff, limit) =>
        target.table === TABLE_WORKFLOW_RUNS ? this.#pruneRunsBatch(cutoff, limit) : undefined,
    });
  }

  /**
   * Deletes up to `limit` aged storage v2 runs in one write transaction: detaches the runs built on
   * their state, then deletes their entries and headers. Every statement selects the same runs, and
   * the transaction holds the write lock, so they agree.
   */
  async #pruneRunsBatch(cutoff: string | number, limit: number): Promise<number> {
    const doomed = `SELECT workflow_name, run_id FROM ${TABLE_WORKFLOW_RUNS}
      WHERE updatedAt < ? ORDER BY updatedAt, workflow_name, run_id LIMIT ?`;
    return this.executeWithRetry(
      () =>
        inWriteTransaction(this.#client, async tx => {
          const shared = await tx.execute({
            sql: `SELECT d.workflow_name, d.run_id FROM (${doomed}) d
              JOIN ${TABLE_WORKFLOW_RUNS} r USING (workflow_name, run_id) WHERE r.stateShared`,
            args: [cutoff, limit],
          });
          for (const run of shared.rows) {
            await this.#detachStateChildren(tx, run.workflow_name as string, run.run_id as string);
          }
          await tx.execute({
            sql: `DELETE FROM ${TABLE_WORKFLOW_RUN_ENTRIES} WHERE (workflow_name, run_id) IN (${doomed})`,
            args: [cutoff, limit],
          });
          const runs = await tx.execute({
            sql: `DELETE FROM ${TABLE_WORKFLOW_RUNS} WHERE (workflow_name, run_id) IN (${doomed})`,
            args: [cutoff, limit],
          });
          return runs.rowsAffected;
        }),
      `prune ${TABLE_WORKFLOW_RUNS}`,
    );
  }

  private async setupPragmaSettings() {
    try {
      // Set busy timeout to wait longer before returning busy errors
      await this.#client.execute('PRAGMA busy_timeout = 10000;');
      this.logger.debug('LibSQL Workflows: PRAGMA busy_timeout=10000 set.');

      // Enable WAL mode for better concurrency (if supported)
      try {
        await this.#client.execute('PRAGMA journal_mode = WAL;');
        this.logger.debug('LibSQL Workflows: PRAGMA journal_mode=WAL set.');
      } catch {
        this.logger.debug('LibSQL Workflows: WAL mode not supported, using default journal mode.');
      }

      // Set synchronous mode for better durability vs performance trade-off
      try {
        await this.#client.execute('PRAGMA synchronous = NORMAL;');
        this.logger.debug('LibSQL Workflows: PRAGMA synchronous=NORMAL set.');
      } catch {
        this.logger.debug('LibSQL Workflows: Failed to set synchronous mode.');
      }
    } catch (err) {
      this.logger.warn('LibSQL Workflows: Failed to set PRAGMA settings.', err);
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
    const check = this.#runFenceCheck(explicitFence, runId, 'updateWorkflowResults');
    return this.executeWithRetry(
      () =>
        // Serialize the interactive transaction against all other writes on the shared
        // connection so a concurrent autocommit write can't leak into this open BEGIN.
        withClientWriteLock(this.#client, async () => {
          // Use a transaction to ensure atomicity
          const tx = await this.#client.transaction('write');
          try {
            if (check) await assertRunFence(tx, check);
            // Load existing snapshot within transaction
            const existingSnapshotResult = await tx.execute({
              sql: `SELECT json(snapshot) as snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = ? AND run_id = ?`,
              args: [workflowName, runId],
            });

            if (!existingSnapshotResult.rows?.[0]) {
              const v2 = await tx.execute({
                sql: `SELECT 1 FROM ${TABLE_WORKFLOW_RUNS} WHERE workflow_name = ? AND run_id = ?`,
                args: [workflowName, runId],
              });
              if (v2.rows.length > 0) {
                throw new Error(`updateWorkflowResults does not support storage v2 runs (run ${runId})`);
              }
              await tx.rollback();
              return {};
            }

            const existingSnapshot = existingSnapshotResult.rows[0].snapshot;
            const snapshot: WorkflowRunState =
              typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

            // Merge the new step result using element-wise array merging
            // (critical for concurrent foreach iteration results)
            mergeWorkflowStepResult({ snapshot, stepId, result, requestContext, state });

            // Upsert the snapshot within the same transaction
            const now = new Date().toISOString();
            await tx.execute({
              sql: `INSERT INTO ${TABLE_WORKFLOW_SNAPSHOT} (workflow_name, run_id, snapshot, createdAt, updatedAt)
                VALUES (?, ?, jsonb(?), ?, ?)
                ON CONFLICT(workflow_name, run_id)
                DO UPDATE SET snapshot = excluded.snapshot, updatedAt = excluded.updatedAt`,
              args: [workflowName, runId, safeStringify(snapshot), now, now],
            });

            await tx.commit();
            return snapshot.context;
          } catch (error) {
            if (!tx.closed) {
              await tx.rollback();
            }
            throw error;
          }
        }),
      'updateWorkflowResults',
    );
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
    const check = this.#runFenceCheck(explicitFence, runId, 'updateWorkflowState');
    return this.executeWithRetry(
      () =>
        // Serialize the interactive transaction against all other writes on the shared
        // connection so a concurrent autocommit write can't leak into this open BEGIN.
        withClientWriteLock(this.#client, async () => {
          // Use a transaction to ensure atomicity
          const tx = await this.#client.transaction('write');
          try {
            if (check) await assertRunFence(tx, check);

            if (storageVersion !== 1) {
              const run = await tx.execute({
                sql: `SELECT json(header) AS header FROM ${TABLE_WORKFLOW_RUNS} WHERE workflow_name = ? AND run_id = ?`,
                args: [workflowName, runId],
              });
              const row = run.rows[0];
              if (row) {
                const current: WorkflowRunHeader = JSON.parse(row.header as string);
                const { expectedStatus, ...patch } = opts;
                if (!matchesExpectedWorkflowStatus(current.status, expectedStatus)) {
                  await tx.rollback();
                  return undefined;
                }
                const header = { ...current, ...patch };
                await tx.execute({
                  sql: `UPDATE ${TABLE_WORKFLOW_RUNS} SET header = jsonb(?), status = ?, updatedAt = ? WHERE workflow_name = ? AND run_id = ?`,
                  args: [safeStringify(header), header.status, new Date().toISOString(), workflowName, runId],
                });
                const entries = await tx.execute({
                  sql: `SELECT ${entriesSql('r')} AS entries FROM ${TABLE_WORKFLOW_RUNS} r WHERE r.workflow_name = ? AND r.run_id = ?`,
                  args: [workflowName, runId],
                });
                const snapshot = await this.#materializeRun(tx, header, entries.rows[0]!.entries as string);
                await tx.commit();
                return snapshot;
              }
              if (storageVersion === 2) {
                await tx.rollback();
                return undefined;
              }
            }

            // Load existing snapshot within transaction
            const existingSnapshotResult = await tx.execute({
              sql: `SELECT json(snapshot) as snapshot FROM ${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = ? AND run_id = ?`,
              args: [workflowName, runId],
            });

            if (!existingSnapshotResult.rows?.[0]) {
              await tx.rollback();
              return undefined;
            }

            // Parse existing snapshot
            const existingSnapshot = existingSnapshotResult.rows[0].snapshot;
            const snapshot = typeof existingSnapshot === 'string' ? JSON.parse(existingSnapshot) : existingSnapshot;

            if (!snapshot || !snapshot?.context) {
              await tx.rollback();
              throw new Error(`Snapshot not found for runId ${runId}`);
            }

            const { expectedStatus, ...state } = opts;
            if (!matchesExpectedWorkflowStatus(snapshot.status, expectedStatus)) {
              await tx.rollback();
              return undefined;
            }

            // Merge the new options with the existing snapshot
            const updatedSnapshot = { ...snapshot, ...state };

            // Update the snapshot within the same transaction
            await tx.execute({
              sql: `UPDATE ${TABLE_WORKFLOW_SNAPSHOT} SET snapshot = jsonb(?), updatedAt = ? WHERE workflow_name = ? AND run_id = ?`,
              args: [safeStringify(updatedSnapshot), new Date().toISOString(), workflowName, runId],
            });

            await tx.commit();
            return updatedSnapshot;
          } catch (error) {
            if (!tx.closed) {
              await tx.rollback();
            }
            throw error;
          }
        }),
      'updateWorkflowState',
    );
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
  }) {
    const now = new Date();
    const createdAtValue = (createdAt ?? now).toISOString();
    const updatedAtValue = (updatedAt ?? now).toISOString();

    this.logger.debug('Persisting workflow snapshot', { workflowName, runId });

    const check = this.#runFenceCheck(fence, runId, 'persistWorkflowSnapshot');
    // Upsert keyed on (workflow_name, run_id) so re-persisting an existing run preserves the
    // original createdAt and only advances updatedAt. The generic INSERT OR REPLACE helper
    // would rewrite the whole row, resetting createdAt on every step persist. This mirrors
    // updateWorkflowResults above and the pg/mysql/mongodb stores.
    await this.executeWithRetry(
      () =>
        withRunFence(this.#client, check, writer =>
          writer.execute({
            sql: `INSERT INTO ${TABLE_WORKFLOW_SNAPSHOT} (workflow_name, run_id, resourceId, snapshot, createdAt, updatedAt)
                VALUES (?, ?, ?, jsonb(?), ?, ?)
                ON CONFLICT(workflow_name, run_id)
                DO UPDATE SET resourceId = COALESCE(excluded.resourceId, ${TABLE_WORKFLOW_SNAPSHOT}.resourceId), snapshot = excluded.snapshot, updatedAt = excluded.updatedAt`,
            args: [workflowName, runId, resourceId ?? null, safeStringify(snapshot), createdAtValue, updatedAtValue],
          }),
        ),
      'persistWorkflowSnapshot',
    );
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
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });
    if (storageVersion !== 1) {
      // One statement, so the header and entries come from the same snapshot of the database.
      const result = await this.#client.execute({
        sql: `SELECT json(r.header) AS header, ${entriesSql('r')} AS entries
          FROM ${TABLE_WORKFLOW_RUNS} r WHERE r.workflow_name = ? AND r.run_id = ?`,
        args: [workflowName, runId],
      });
      const row = result.rows[0];
      if (row) return this.#materializeRun(this.#client, row.header as string, row.entries as string);
      if (storageVersion === 2) return null;
    }
    const d = await this.#db.select<{ snapshot: WorkflowRunState }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    return d ? d.snapshot : null;
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
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (runId) {
      conditions.push('run_id = ?');
      args.push(runId);
    }

    if (workflowName) {
      conditions.push('workflow_name = ?');
      args.push(workflowName);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const result = await this.#client.execute({
        sql: this.#runsSql({
          v1Where: storageVersion === 2 ? null : whereClause,
          v2Where: storageVersion === 1 ? null : whereClause,
          page: 'LIMIT 1',
        }),
        args: [...(storageVersion === 2 ? [] : args), ...(storageVersion === 1 ? [] : args)],
      });

      if (!result.rows?.[0]) {
        return null;
      }

      return await this.#parseRun(result.rows[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_WORKFLOW_RUN_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
    const check = this.#runFenceCheck(fence, runId, 'deleteWorkflowRunById');
    return this.executeWithRetry(async () => {
      try {
        // Detaches the runs built on its state first, while its entries are still there to read.
        await inWriteTransaction(this.#client, async tx => {
          if (check) await assertRunFence(tx, check);
          const run = await tx.execute({
            sql: `SELECT stateShared FROM ${TABLE_WORKFLOW_RUNS} WHERE workflow_name = ? AND run_id = ?`,
            args: [workflowName, runId],
          });
          if (Number(run.rows[0]?.stateShared)) await this.#detachStateChildren(tx, workflowName, runId);
          for (const table of [TABLE_WORKFLOW_RUNS, TABLE_WORKFLOW_RUN_ENTRIES, TABLE_WORKFLOW_SNAPSHOT]) {
            await tx.execute({
              sql: `DELETE FROM ${table} WHERE workflow_name = ? AND run_id = ?`,
              args: [workflowName, runId],
            });
          }
        });
      } catch (error) {
        if (isRunFenceConflictError(error)) throw error;
        throw new MastraError(
          {
            id: createStorageErrorId('LIBSQL', 'DELETE_WORKFLOW_RUN_BY_ID', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { runId, workflowName },
          },
          error,
        );
      }
    }, 'deleteWorkflowRunById');
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    page,
    perPage,
    resourceId,
    threadId,
    status,
    summary,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    try {
      // v1 rows filter on their snapshot JSON, storage v2 runs on their header columns.
      const conditions: string[] = [];
      const args: InValue[] = [];
      const v2Conditions: string[] = [];
      const v2Args: InValue[] = [];

      if (workflowName) {
        conditions.push('workflow_name = ?');
        args.push(workflowName);
        v2Conditions.push('workflow_name = ?');
        v2Args.push(workflowName);
      }

      if (status) {
        conditions.push("json_extract(snapshot, '$.status') = ?");
        args.push(status);
        v2Conditions.push('status = ?');
        v2Args.push(status);
      }

      if (fromDate) {
        conditions.push('createdAt >= ?');
        args.push(fromDate.toISOString());
        v2Conditions.push('createdAt >= ?');
        v2Args.push(fromDate.toISOString());
      }

      if (toDate) {
        conditions.push('createdAt <= ?');
        args.push(toDate.toISOString());
        v2Conditions.push('createdAt <= ?');
        v2Args.push(toDate.toISOString());
      }

      if (resourceId) {
        const hasResourceId = await this.#db.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push('resourceId = ?');
          args.push(resourceId);
        } else {
          this.logger.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
        v2Conditions.push('resourceId = ?');
        v2Args.push(resourceId);
      }

      if (threadId) {
        // The thread id lives inside the snapshot JSON, in one of two layouts. This mirrors
        // the canonical extraction in `@mastra/core` (`getSnapshotMemoryInfo`) and must stay
        // in lockstep with it — otherwise rows the caller would match get wrongly excluded:
        // 1. agentic-loop: under a dynamic suspended-step key, hence the json_each() scan
        // 2. durable loop: under the serialized workflow input at a fixed path
        conditions.push(
          `(EXISTS (SELECT 1 FROM json_each(snapshot, '$.context') AS je WHERE json_extract(je.value, '$.status') = 'suspended' AND json_extract(je.value, '$.suspendPayload.__streamState.messageList.memoryInfo.threadId') = ?) OR json_extract(snapshot, '$.context.input.messageListState.memoryInfo.threadId') = ?)`,
        );
        args.push(threadId, threadId);
        // Storage v2 runs store the same extraction, taken when they were written.
        v2Conditions.push('threadId = ?');
        v2Args.push(threadId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const v2WhereClause = v2Conditions.length > 0 ? `WHERE ${v2Conditions.join(' AND ')}` : '';

      let total = 0;
      // Only get total count when using pagination
      const usePagination = typeof perPage === 'number' && typeof page === 'number';
      if (usePagination) {
        const countResult = await this.#client.execute({
          sql: `SELECT (SELECT COUNT(*) FROM ${TABLE_WORKFLOW_SNAPSHOT} ${whereClause})
            + (SELECT COUNT(*) FROM ${TABLE_WORKFLOW_RUNS} ${v2WhereClause}) AS count`,
          args: [...args, ...v2Args],
        });
        total = Number(countResult.rows?.[0]?.count ?? 0);
      }

      // Get results
      const normalizedPerPage = usePagination ? normalizePerPage(perPage, Number.MAX_SAFE_INTEGER) : 0;
      const offset = usePagination ? page! * normalizedPerPage : 0;
      const result = await this.#client.execute({
        sql: this.#runsSql({
          v1Where: whereClause,
          v2Where: v2WhereClause,
          summary,
          page: usePagination ? 'LIMIT ? OFFSET ?' : '',
        }),
        args: [...args, ...v2Args, ...(usePagination ? [normalizedPerPage, offset] : [])],
      });

      const runs = await Promise.all((result.rows || []).map(row => this.#parseRun(row)));

      // Use runs.length as total when not paginating
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_WORKFLOW_RUNS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
