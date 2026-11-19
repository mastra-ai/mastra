import type {
  KnowledgeImporterBindingRecord,
  KnowledgeImporterFlushRecord,
  KnowledgeImporterNodeRecord,
  KnowledgeImporterPage,
  KnowledgeImporterRunChangeRecord,
  KnowledgeImporterRunRecord,
  KnowledgeImporterRunStartResult,
  KnowledgeImporterRunStatus,
  KnowledgeImportersStorage,
  KnowledgeImporterWriterGuard,
} from '@mastra/core/storage';

import type { SqliteInValue as InValue, SqliteResultSet as ResultSet } from '../../db/client';

interface Executor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

export const LIBSQL_KNOWLEDGE_IMPORTER_TABLES = {
  bindings: 'mastra_knowledge_importer_bindings',
  nodes: 'mastra_knowledge_importer_nodes',
  state: 'mastra_knowledge_importer_state',
  runs: 'mastra_knowledge_importer_runs',
  flushes: 'mastra_knowledge_importer_flushes',
  changes: 'mastra_knowledge_importer_run_changes',
  guard: 'mastra_knowledge_importer_writer_guard',
} as const;

const T = LIBSQL_KNOWLEDGE_IMPORTER_TABLES;

/**
 * SQLite compares TEXT with BINARY (byte order) unless told otherwise; no column here asks for
 * NOCASE, so source IDs that differ only by case or Unicode form stay distinct.
 */
export const KNOWLEDGE_IMPORTER_DDL = [
  `CREATE TABLE IF NOT EXISTS "${T.bindings}" (
    id TEXT PRIMARY KEY,
    importer TEXT NOT NULL,
    target TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.nodes}" (
    bindingId TEXT NOT NULL REFERENCES "${T.bindings}" (id) ON DELETE CASCADE,
    sourceId TEXT NOT NULL,
    pageId TEXT NOT NULL UNIQUE,
    kind TEXT,
    parentSourceId TEXT,
    aliases TEXT NOT NULL DEFAULT '[]',
    unresolvedLinks TEXT NOT NULL DEFAULT '[]',
    stub INTEGER NOT NULL DEFAULT 0,
    updatedAt INTEGER NOT NULL,
    PRIMARY KEY (bindingId, sourceId)
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.state}" (
    bindingId TEXT NOT NULL REFERENCES "${T.bindings}" (id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (bindingId, key)
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.runs}" (
    id TEXT PRIMARY KEY,
    bindingId TEXT NOT NULL REFERENCES "${T.bindings}" (id) ON DELETE CASCADE,
    generation INTEGER NOT NULL,
    status TEXT NOT NULL,
    fireKey TEXT,
    deadlineAt INTEGER,
    cancelRequestedAt INTEGER,
    lastSeq INTEGER NOT NULL DEFAULT 0,
    finish TEXT,
    counts TEXT NOT NULL DEFAULT '{}',
    startedAt INTEGER NOT NULL,
    completedAt INTEGER
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kimp_runs_one_running ON "${T.runs}" (bindingId) WHERE status = 'running'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kimp_runs_fire_key ON "${T.runs}" (bindingId, fireKey) WHERE fireKey IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_kimp_runs_recent ON "${T.runs}" (bindingId, startedAt DESC)`,
  `CREATE TABLE IF NOT EXISTS "${T.flushes}" (
    runId TEXT NOT NULL REFERENCES "${T.runs}" (id) ON DELETE CASCADE,
    generation INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    digest TEXT NOT NULL,
    receipt TEXT NOT NULL,
    PRIMARY KEY (runId, generation, seq)
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.changes}" (
    ord INTEGER PRIMARY KEY AUTOINCREMENT,
    runId TEXT NOT NULL REFERENCES "${T.runs}" (id) ON DELETE CASCADE,
    sourceId TEXT NOT NULL,
    pageId TEXT,
    change TEXT NOT NULL,
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    UNIQUE (runId, sourceId)
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.guard}" (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    activePath TEXT NOT NULL,
    generation INTEGER NOT NULL,
    firstWriteAt INTEGER
  )`,
];

type RunStateReason = 'not_found' | 'not_running' | 'generation' | 'stale_guard' | 'seq';
let coreErrors:
  | Promise<{
      KnowledgeImporterBindingConflictError: new (bindingId: string) => Error;
      KnowledgeImporterRunStateError: new (runId: string, reason: RunStateReason) => Error;
    }>
  | undefined;
/** Loaded when first needed, so this adapter keeps loading on cores without `knowledge-importers`. */
const loadCoreErrors = () => (coreErrors ??= import('@mastra/core/storage') as Promise<any>);
const runStateError = async (runId: string, reason: RunStateReason) =>
  new (await loadCoreErrors()).KnowledgeImporterRunStateError(runId, reason);

const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  /UNIQUE constraint failed|SQLITE_CONSTRAINT/.test(`${error.message} ${String((error as { code?: unknown }).code)}`);

type Row = Record<string, any>;
const date = (value: unknown) => (value === null || value === undefined ? null : new Date(Number(value)));

const toRun = (row: Row): KnowledgeImporterRunRecord => ({
  id: String(row.id),
  bindingId: String(row.bindingId),
  generation: Number(row.generation),
  status: row.status as KnowledgeImporterRunStatus,
  fireKey: row.fireKey === null ? null : String(row.fireKey),
  deadlineAt: date(row.deadlineAt),
  cancelRequestedAt: date(row.cancelRequestedAt),
  lastSeq: Number(row.lastSeq),
  finish: row.finish === null ? null : JSON.parse(String(row.finish)),
  counts: JSON.parse(String(row.counts)),
  startedAt: new Date(Number(row.startedAt)),
  completedAt: date(row.completedAt),
});

const toNode = (row: Row): KnowledgeImporterNodeRecord => ({
  bindingId: String(row.bindingId),
  sourceId: String(row.sourceId),
  pageId: String(row.pageId),
  kind: row.kind === null ? null : String(row.kind),
  parentSourceId: row.parentSourceId === null ? null : String(row.parentSourceId),
  aliases: JSON.parse(String(row.aliases)),
  unresolvedLinks: JSON.parse(String(row.unresolvedLinks)),
  stub: Number(row.stub) === 1,
  updatedAt: new Date(Number(row.updatedAt)),
});

const toGuard = (row: Row): KnowledgeImporterWriterGuard => ({
  activePath: String(row.activePath),
  generation: Number(row.generation),
  firstWriteAt: date(row.firstWriteAt),
});

const toBinding = (row: Row): KnowledgeImporterBindingRecord => ({
  id: String(row.id),
  importer: String(row.importer),
  target: String(row.target),
  createdAt: new Date(Number(row.createdAt)),
});

/**
 * Importer bookkeeping on LibSQL, over the same executor as the page store: on a transaction view
 * the view's write transaction, so these writes commit with the page writes. Writes go through
 * `transaction` (a savepoint inside a view), so a refusal writes nothing. SQLite's write
 * transaction already excludes every other writer, so `lockWriterGuard` only reads the row.
 */
export class LibSQLKnowledgeImporters implements KnowledgeImportersStorage {
  readonly #read: Executor;
  readonly #transaction: <R>(operation: (tx: Executor) => Promise<R>) => Promise<R>;

  constructor(config: { read: Executor; transaction: <R>(operation: (tx: Executor) => Promise<R>) => Promise<R> }) {
    this.#read = config.read;
    this.#transaction = config.transaction;
  }

  async init(): Promise<void> {
    await this.#transaction(async tx => {
      for (const statement of KNOWLEDGE_IMPORTER_DDL) await tx.execute(statement);
      await tx.execute(`INSERT OR IGNORE INTO "${T.guard}" (id, activePath, generation) VALUES (1, 'new', 1)`);
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#transaction(async tx => {
      for (const table of [T.changes, T.flushes, T.runs, T.state, T.nodes, T.bindings]) {
        await tx.execute(`DELETE FROM "${table}"`);
      }
      await tx.execute(`UPDATE "${T.guard}" SET activePath = 'new', generation = 1, firstWriteAt = NULL`);
    });
  }

  async registerBinding(input: { id: string; importer: string; target: string }) {
    return this.#transaction(async tx => {
      const existing = (await tx.execute({ sql: `SELECT * FROM "${T.bindings}" WHERE id = ?`, args: [input.id] }))
        .rows[0];
      if (existing) {
        const binding = toBinding(existing);
        if (binding.importer !== input.importer || binding.target !== input.target) {
          throw new (await loadCoreErrors()).KnowledgeImporterBindingConflictError(input.id);
        }
        return { status: 'unchanged' as const, binding };
      }
      const createdAt = Date.now();
      await tx.execute({
        sql: `INSERT INTO "${T.bindings}" (id, importer, target, createdAt) VALUES (?, ?, ?, ?)`,
        args: [input.id, input.importer, input.target, createdAt],
      });
      return { status: 'created' as const, binding: { ...input, createdAt: new Date(createdAt) } };
    });
  }
  async getBinding(id: string) {
    const row = (await this.#read.execute({ sql: `SELECT * FROM "${T.bindings}" WHERE id = ?`, args: [id] })).rows[0];
    return row ? toBinding(row) : null;
  }
  async listBindings() {
    return (await this.#read.execute(`SELECT * FROM "${T.bindings}" ORDER BY id`)).rows.map(toBinding);
  }

  async startRun(input: {
    bindingId: string;
    runId: string;
    generation: number;
    fireKey?: string;
    deadlineAt?: Date;
  }): Promise<KnowledgeImporterRunStartResult> {
    return this.#transaction(async tx => {
      if (input.fireKey) {
        const fired = (
          await tx.execute({
            sql: `SELECT * FROM "${T.runs}" WHERE bindingId = ? AND fireKey = ?`,
            args: [input.bindingId, input.fireKey],
          })
        ).rows[0];
        if (fired) return { status: 'duplicate' as const, run: toRun(fired) };
      }
      const running = (
        await tx.execute({
          sql: `SELECT 1 FROM "${T.runs}" WHERE bindingId = ? AND status = 'running'`,
          args: [input.bindingId],
        })
      ).rows[0];
      const now = Date.now();
      await tx.execute({
        sql: `INSERT INTO "${T.runs}" (id, bindingId, generation, status, fireKey, deadlineAt, startedAt, completedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.runId,
          input.bindingId,
          input.generation,
          running ? 'skipped' : 'running',
          input.fireKey ?? null,
          input.deadlineAt ? input.deadlineAt.getTime() : null,
          now,
          running ? now : null,
        ],
      });
      const row = (await tx.execute({ sql: `SELECT * FROM "${T.runs}" WHERE id = ?`, args: [input.runId] })).rows[0]!;
      return { status: running ? ('skipped' as const) : ('started' as const), run: toRun(row) };
    });
  }
  async getRun(runId: string) {
    const row = (await this.#read.execute({ sql: `SELECT * FROM "${T.runs}" WHERE id = ?`, args: [runId] })).rows[0];
    return row ? toRun(row) : null;
  }
  async listRuns(bindingId: string, options: { limit?: number } = {}) {
    const rows = await this.#read.execute({
      sql: `SELECT * FROM "${T.runs}" WHERE bindingId = ? ORDER BY startedAt DESC, id LIMIT ?`,
      args: [bindingId, options.limit ?? 50],
    });
    return rows.rows.map(toRun);
  }
  async requestCancel(runId: string) {
    return this.#transaction(async tx => {
      await tx.execute({
        sql: `UPDATE "${T.runs}" SET cancelRequestedAt = COALESCE(cancelRequestedAt, ?) WHERE id = ? AND status = 'running'`,
        args: [Date.now(), runId],
      });
      const row = (
        await tx.execute({ sql: `SELECT * FROM "${T.runs}" WHERE id = ? AND status = 'running'`, args: [runId] })
      ).rows[0];
      return row ? toRun(row) : null;
    });
  }

  async #activeRun(tx: Executor, runId: string, generation: number): Promise<KnowledgeImporterRunRecord> {
    const row = (await tx.execute({ sql: `SELECT * FROM "${T.runs}" WHERE id = ?`, args: [runId] })).rows[0];
    if (!row) throw await runStateError(runId, 'not_found');
    const run = toRun(row);
    if (run.status !== 'running') throw await runStateError(runId, 'not_running');
    if (run.generation !== generation) throw await runStateError(runId, 'generation');
    const guard = toGuard((await tx.execute(`SELECT * FROM "${T.guard}" WHERE id = 1`)).rows[0]!);
    if (guard.generation !== generation) throw await runStateError(runId, 'stale_guard');
    return run;
  }

  async getFlush(runId: string, generation: number, seq: number) {
    const row = (
      await this.#read.execute({
        sql: `SELECT * FROM "${T.flushes}" WHERE runId = ? AND generation = ? AND seq = ?`,
        args: [runId, generation, seq],
      })
    ).rows[0];
    return row
      ? {
          runId: String(row.runId),
          generation: Number(row.generation),
          seq: Number(row.seq),
          digest: String(row.digest),
          receipt: JSON.parse(String(row.receipt)),
        }
      : null;
  }
  async recordFlush(input: KnowledgeImporterFlushRecord & { counts: Record<string, number> }) {
    await this.#transaction(async tx => {
      const run = await this.#activeRun(tx, input.runId, input.generation);
      if (run.lastSeq !== input.seq - 1) throw await runStateError(input.runId, 'seq');
      await tx.execute({
        sql: `INSERT INTO "${T.flushes}" (runId, generation, seq, digest, receipt) VALUES (?, ?, ?, ?, ?)`,
        args: [input.runId, input.generation, input.seq, input.digest, JSON.stringify(input.receipt)],
      });
      const counts = { ...run.counts };
      for (const [name, value] of Object.entries(input.counts)) counts[name] = (counts[name] ?? 0) + value;
      await tx.execute({
        sql: `UPDATE "${T.runs}" SET lastSeq = ?, counts = ? WHERE id = ?`,
        args: [input.seq, JSON.stringify(counts), input.runId],
      });
    });
  }
  async finishRun(input: {
    runId: string;
    generation: number;
    lastSeq: number;
    status: Exclude<KnowledgeImporterRunStatus, 'running' | 'skipped'>;
    finish: unknown;
  }) {
    return this.#transaction(async tx => {
      const run = await this.#activeRun(tx, input.runId, input.generation);
      if (run.lastSeq !== input.lastSeq) throw await runStateError(input.runId, 'seq');
      await tx.execute({
        sql: `UPDATE "${T.runs}" SET status = ?, finish = ?, completedAt = ? WHERE id = ?`,
        args: [input.status, JSON.stringify(input.finish), Date.now(), input.runId],
      });
      return toRun((await tx.execute({ sql: `SELECT * FROM "${T.runs}" WHERE id = ?`, args: [input.runId] })).rows[0]!);
    });
  }

  async getNode(bindingId: string, sourceId: string) {
    const row = (
      await this.#read.execute({
        sql: `SELECT * FROM "${T.nodes}" WHERE bindingId = ? AND sourceId = ?`,
        args: [bindingId, sourceId],
      })
    ).rows[0];
    return row ? toNode(row) : null;
  }
  async getNodeByPage(pageId: string) {
    const row = (await this.#read.execute({ sql: `SELECT * FROM "${T.nodes}" WHERE pageId = ?`, args: [pageId] }))
      .rows[0];
    return row ? toNode(row) : null;
  }
  async saveNode(node: Omit<KnowledgeImporterNodeRecord, 'updatedAt'>) {
    try {
      await this.#transaction(tx =>
        tx.execute({
          sql: `INSERT INTO "${T.nodes}" (bindingId, sourceId, pageId, kind, parentSourceId, aliases, unresolvedLinks, stub, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (bindingId, sourceId) DO UPDATE SET
                  pageId = excluded.pageId, kind = excluded.kind, parentSourceId = excluded.parentSourceId,
                  aliases = excluded.aliases, unresolvedLinks = excluded.unresolvedLinks, stub = excluded.stub,
                  updatedAt = excluded.updatedAt`,
          args: [
            node.bindingId,
            node.sourceId,
            node.pageId,
            node.kind,
            node.parentSourceId,
            JSON.stringify(node.aliases),
            JSON.stringify(node.unresolvedLinks),
            node.stub ? 1 : 0,
            Date.now(),
          ],
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error(`Knowledge page ${node.pageId} is already mapped to another imported node`, { cause: error });
      }
      throw error;
    }
  }
  async deleteNode(bindingId: string, sourceId: string) {
    await this.#transaction(tx =>
      tx.execute({ sql: `DELETE FROM "${T.nodes}" WHERE bindingId = ? AND sourceId = ?`, args: [bindingId, sourceId] }),
    );
  }
  async listNodes(
    bindingId: string,
    options: { after?: string; limit?: number } = {},
  ): Promise<KnowledgeImporterPage<KnowledgeImporterNodeRecord>> {
    const limit = options.limit ?? 500;
    const rows = (
      await this.#read.execute({
        sql: `SELECT * FROM "${T.nodes}" WHERE bindingId = ? AND (? IS NULL OR sourceId > ?) ORDER BY sourceId LIMIT ?`,
        args: [bindingId, options.after ?? null, options.after ?? null, limit + 1],
      })
    ).rows;
    const items = rows.slice(0, limit).map(toNode);
    return { items, next: rows.length > limit ? items[items.length - 1]!.sourceId : null };
  }
  async findNodeByAlias(bindingId: string, alias: string) {
    const row = (
      await this.#read.execute({
        sql: `SELECT n.* FROM "${T.nodes}" n WHERE n.bindingId = ?
              AND EXISTS (SELECT 1 FROM json_each(n.aliases) WHERE json_each.value = ?) ORDER BY n.sourceId LIMIT 1`,
        args: [bindingId, alias],
      })
    ).rows[0];
    return row ? toNode(row) : null;
  }

  async getState(bindingId: string) {
    const out: Record<string, string> = {};
    const rows = await this.#read.execute({
      sql: `SELECT key, value FROM "${T.state}" WHERE bindingId = ?`,
      args: [bindingId],
    });
    for (const row of rows.rows) {
      Object.defineProperty(out, String(row.key), {
        value: String(row.value),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  }
  async setState(bindingId: string, state: Record<string, string>) {
    const keys = Object.keys(state);
    if (keys.length === 0) return;
    await this.#transaction(async tx => {
      for (const name of keys) {
        await tx.execute({
          sql: `INSERT INTO "${T.state}" (bindingId, key, value) VALUES (?, ?, ?)
                ON CONFLICT (bindingId, key) DO UPDATE SET value = excluded.value`,
          args: [bindingId, name, state[name]!],
        });
      }
    });
  }

  async recordRunChange(change: KnowledgeImporterRunChangeRecord) {
    await this.#transaction(tx =>
      tx.execute({
        sql: `INSERT INTO "${T.changes}" (runId, sourceId, pageId, change, title, path) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (runId, sourceId) DO UPDATE SET
                pageId = excluded.pageId, change = excluded.change, title = excluded.title, path = excluded.path`,
        args: [change.runId, change.sourceId, change.pageId, change.change, change.title, change.path],
      }),
    );
  }
  async listRunChanges(
    runId: string,
    options: { after?: string; limit?: number } = {},
  ): Promise<KnowledgeImporterPage<KnowledgeImporterRunChangeRecord>> {
    const limit = options.limit ?? 500;
    const rows = (
      await this.#read.execute({
        sql: `SELECT * FROM "${T.changes}" WHERE runId = ? AND ord > ? ORDER BY ord LIMIT ?`,
        args: [runId, Number(options.after ?? 0), limit + 1],
      })
    ).rows;
    const page = rows.slice(0, limit);
    return {
      items: page.map(row => ({
        runId: String(row.runId),
        sourceId: String(row.sourceId),
        pageId: row.pageId === null ? null : String(row.pageId),
        change: row.change as KnowledgeImporterRunChangeRecord['change'],
        title: String(row.title),
        path: String(row.path),
      })),
      next: rows.length > limit ? String(page[page.length - 1]!.ord) : null,
    };
  }

  async readWriterGuard() {
    const row = (await this.#read.execute(`SELECT * FROM "${T.guard}" WHERE id = 1`)).rows[0];
    if (!row) throw new Error('Knowledge importer tables are not provisioned: call importers.init() first.');
    return toGuard(row);
  }
  async lockWriterGuard(_mode: 'share' | 'update') {
    return this.readWriterGuard();
  }
  async markFirstWrite() {
    return this.#transaction(async tx => {
      const result = await tx.execute({
        sql: `UPDATE "${T.guard}" SET firstWriteAt = ? WHERE id = 1 AND firstWriteAt IS NULL`,
        args: [Date.now()],
      });
      return result.rowsAffected === 1;
    });
  }
  async advanceWriterGuard(input: { activePath: string; generation: number }) {
    return this.#transaction(async tx => {
      const result = await tx.execute({
        sql: `UPDATE "${T.guard}" SET activePath = ?, generation = ?, firstWriteAt = NULL WHERE id = 1 AND generation < ?`,
        args: [input.activePath, input.generation, input.generation],
      });
      if (result.rowsAffected !== 1) {
        throw new Error(`Knowledge importer writer generation must move forward (to ${input.generation})`);
      }
      return toGuard((await tx.execute(`SELECT * FROM "${T.guard}" WHERE id = 1`)).rows[0]!);
    });
  }
}
