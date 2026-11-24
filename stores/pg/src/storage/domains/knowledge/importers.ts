import type {
  KnowledgeImportersStorage,
  KnowledgeImporterBindingRecord,
  KnowledgeImporterFlushRecord,
  KnowledgeImporterNodeRecord,
  KnowledgeImporterPage,
  KnowledgeImporterRunChangeRecord,
  KnowledgeImporterRunRecord,
  KnowledgeImporterRunStartResult,
  KnowledgeImporterRunStatus,
  KnowledgeImporterWriterGuard,
} from '@mastra/core/storage';

import type { DbClient, TxClient } from '../../client';

type Queryable = Pick<TxClient, 'none' | 'one' | 'oneOrNone' | 'any' | 'query'>;

export const PG_KNOWLEDGE_IMPORTER_TABLES = {
  bindings: 'mastra_knowledge_importer_bindings',
  nodes: 'mastra_knowledge_importer_nodes',
  nodeLinks: 'mastra_knowledge_importer_node_links',
  state: 'mastra_knowledge_importer_state',
  runs: 'mastra_knowledge_importer_runs',
  flushes: 'mastra_knowledge_importer_flushes',
  changes: 'mastra_knowledge_importer_run_changes',
  guard: 'mastra_knowledge_importer_writer_guard',
} as const;

/**
 * Core's importer error classes, loaded when first needed so this adapter keeps loading on cores
 * older than the `knowledge-importers` feature (KnowledgePG only offers importers when it is there).
 */
let coreErrors:
  | Promise<{
      KnowledgeImporterBindingConflictError: new (bindingId: string) => Error;
      KnowledgeImporterRunStateError: new (
        runId: string,
        reason: 'not_found' | 'not_running' | 'generation' | 'stale_guard' | 'seq',
      ) => Error;
    }>
  | undefined;
const loadCoreErrors = () => (coreErrors ??= import('@mastra/core/storage') as Promise<any>);
const runStateError = async (
  runId: string,
  reason: 'not_found' | 'not_running' | 'generation' | 'stale_guard' | 'seq',
) => new (await loadCoreErrors()).KnowledgeImporterRunStateError(runId, reason);

const PG_UNIQUE_VIOLATION = '23505';
const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION;

/** The importer tables in `schemaName`, next to the page tables. */
export function pgKnowledgeImportersDDL(schemaName?: string): string[] {
  const t = tables(schemaName);
  return [
    `CREATE TABLE IF NOT EXISTS ${t.bindings} (
      id text PRIMARY KEY,
      importer text NOT NULL,
      target text NOT NULL,
      anchor_page_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.nodes} (
      binding_id text NOT NULL REFERENCES ${t.bindings} (id) ON DELETE CASCADE,
      source_id text NOT NULL,
      page_id text NOT NULL UNIQUE,
      kind text,
      parent_source_id text,
      aliases text[] NOT NULL DEFAULT '{}',
      unresolved_links text[] NOT NULL DEFAULT '{}',
      links jsonb NOT NULL DEFAULT '[]',
      link_section text,
      stub boolean NOT NULL DEFAULT false,
      adopted boolean NOT NULL DEFAULT false,
      unsettled boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (binding_id, source_id)
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.nodeLinks} (
      binding_id text NOT NULL,
      source_id text NOT NULL,
      target_source_id text NOT NULL,
      PRIMARY KEY (binding_id, source_id, target_source_id),
      FOREIGN KEY (binding_id, source_id) REFERENCES ${t.nodes} (binding_id, source_id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_importer_node_links_target ON ${t.nodeLinks} (binding_id, target_source_id, source_id COLLATE "C")`,
    `CREATE TABLE IF NOT EXISTS ${t.state} (
      binding_id text NOT NULL REFERENCES ${t.bindings} (id) ON DELETE CASCADE,
      key text NOT NULL,
      value text NOT NULL,
      PRIMARY KEY (binding_id, key)
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.runs} (
      id text PRIMARY KEY,
      binding_id text NOT NULL REFERENCES ${t.bindings} (id) ON DELETE CASCADE,
      generation integer NOT NULL,
      status text NOT NULL,
      fire_key text,
      deadline_at timestamptz,
      cancel_requested_at timestamptz,
      heartbeat_at timestamptz,
      last_seq integer NOT NULL DEFAULT 0,
      finish jsonb,
      counts jsonb NOT NULL DEFAULT '{}',
      started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      completed_at timestamptz
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS mastra_knowledge_importer_runs_one_running ON ${t.runs} (binding_id) WHERE status = 'running'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS mastra_knowledge_importer_runs_fire_key ON ${t.runs} (binding_id, fire_key) WHERE fire_key IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_importer_runs_recent ON ${t.runs} (binding_id, started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS mastra_knowledge_importer_nodes_unsettled ON ${t.nodes} (binding_id, source_id COLLATE "C") WHERE unsettled`,
    `CREATE TABLE IF NOT EXISTS ${t.flushes} (
      run_id text NOT NULL REFERENCES ${t.runs} (id) ON DELETE CASCADE,
      generation integer NOT NULL,
      seq integer NOT NULL,
      digest text NOT NULL,
      receipt jsonb NOT NULL,
      PRIMARY KEY (run_id, generation, seq)
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.changes} (
      run_id text NOT NULL REFERENCES ${t.runs} (id) ON DELETE CASCADE,
      source_id text NOT NULL,
      ord bigserial NOT NULL,
      page_id text,
      change text NOT NULL,
      title text NOT NULL,
      path text NOT NULL,
      PRIMARY KEY (run_id, source_id)
    )`,
    `CREATE TABLE IF NOT EXISTS ${t.guard} (
      id boolean PRIMARY KEY DEFAULT true CHECK (id),
      active_path text NOT NULL,
      generation integer NOT NULL,
      first_write_at timestamptz
    )`,
    // The writer guard's one row: the exported DDL has to provision it too, so init can be skipped.
    `INSERT INTO ${t.guard} (id, active_path, generation) VALUES (true, 'new', 1) ON CONFLICT (id) DO NOTHING`,
  ];
}

function tables(schemaName?: string) {
  const qualify = (table: string) => (schemaName ? `"${schemaName}"."${table}"` : `"${table}"`);
  return Object.fromEntries(
    Object.entries(PG_KNOWLEDGE_IMPORTER_TABLES).map(([name, table]) => [name, qualify(table)]),
  ) as { [K in keyof typeof PG_KNOWLEDGE_IMPORTER_TABLES]: string };
}

type Row = Record<string, any>;

const toRun = (row: Row): KnowledgeImporterRunRecord => ({
  id: row.id,
  bindingId: row.binding_id,
  generation: Number(row.generation),
  status: row.status,
  fireKey: row.fire_key ?? null,
  deadlineAt: row.deadline_at ?? null,
  cancelRequestedAt: row.cancel_requested_at ?? null,
  heartbeatAt: row.heartbeat_at ?? null,
  lastSeq: Number(row.last_seq),
  finish: row.finish ?? null,
  counts: row.counts ?? {},
  startedAt: row.started_at,
  completedAt: row.completed_at ?? null,
});

const toNode = (row: Row): KnowledgeImporterNodeRecord => ({
  bindingId: row.binding_id,
  sourceId: row.source_id,
  pageId: row.page_id,
  kind: row.kind ?? null,
  parentSourceId: row.parent_source_id ?? null,
  aliases: row.aliases ?? [],
  unresolvedLinks: row.unresolved_links ?? [],
  links: row.links ?? [],
  linkSection: row.link_section ?? null,
  stub: row.stub,
  adopted: row.adopted,
  unsettled: row.unsettled,
  updatedAt: row.updated_at,
});

const toGuard = (row: Row): KnowledgeImporterWriterGuard => ({
  activePath: row.active_path,
  generation: Number(row.generation),
  firstWriteAt: row.first_write_at ?? null,
});

const toBinding = (row: Row): KnowledgeImporterBindingRecord => ({
  id: row.id,
  importer: row.importer,
  target: row.target,
  anchorPageId: row.anchor_page_id ?? null,
  createdAt: row.created_at,
});

/**
 * Importer bookkeeping on PostgreSQL. Built over the same client as the page store: on a
 * transaction view that is the view's transaction, so these writes commit with the page writes and
 * `lockWriterGuard` holds its row lock until that transaction ends. Multi-statement methods run in
 * a savepoint (or their own transaction on a pool) so a refusal writes nothing.
 */
export class PgKnowledgeImporters implements KnowledgeImportersStorage {
  readonly #client: DbClient;
  readonly #schemaName?: string;
  readonly #t: ReturnType<typeof tables>;

  constructor(config: { client: DbClient; schemaName?: string }) {
    this.#client = config.client;
    this.#schemaName = config.schemaName;
    this.#t = tables(config.schemaName);
  }

  async init(): Promise<void> {
    await this.#client.tx(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `mastra-knowledge-importers-schema:${this.#schemaName ?? ''}`,
      ]);
      for (const statement of pgKnowledgeImportersDDL(this.#schemaName)) await tx.query(statement);
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    const t = this.#t;
    await this.#client.tx(async tx => {
      await tx.query(
        `TRUNCATE ${t.changes}, ${t.flushes}, ${t.runs}, ${t.state}, ${t.nodeLinks}, ${t.nodes}, ${t.bindings}`,
      );
      await tx.query(`UPDATE ${t.guard} SET active_path = 'new', generation = 1, first_write_at = NULL`);
    });
  }

  /**
   * Part of the Knowledge store's reset, inside its transaction: empties the importer tables, if
   * they were ever created, and moves the generation forward so nothing from before can write.
   * Creates nothing. Writers must be stopped first.
   */
  async clearOnReset(): Promise<void> {
    const provisioned = await this.#client.oneOrNone(`SELECT to_regclass($1) AS t`, [this.#t.guard]);
    if (!provisioned?.t) return;
    const t = this.#t;
    await this.#client.query(
      `TRUNCATE ${t.changes}, ${t.flushes}, ${t.runs}, ${t.state}, ${t.nodeLinks}, ${t.nodes}, ${t.bindings}`,
    );
    await this.#client.query(`UPDATE ${t.guard} SET generation = generation + 1, first_write_at = NULL`);
  }

  async registerBinding(input: { id: string; importer: string; target: string }) {
    return this.#client.tx(async tx => {
      const inserted = await tx.oneOrNone(
        `INSERT INTO ${this.#t.bindings} (id, importer, target) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING *`,
        [input.id, input.importer, input.target],
      );
      if (inserted) return { status: 'created' as const, binding: toBinding(inserted) };
      const existing = toBinding(await tx.one(`SELECT * FROM ${this.#t.bindings} WHERE id = $1`, [input.id]));
      if (existing.importer !== input.importer || existing.target !== input.target) {
        throw new (await loadCoreErrors()).KnowledgeImporterBindingConflictError(input.id);
      }
      return { status: 'unchanged' as const, binding: existing };
    });
  }
  async getBinding(id: string) {
    const row = await this.#client.oneOrNone(`SELECT * FROM ${this.#t.bindings} WHERE id = $1`, [id]);
    return row ? toBinding(row) : null;
  }
  async setBindingAnchor(input: { bindingId: string; expected: string | null; pageId: string | null }) {
    const row = await this.#client.oneOrNone(
      `UPDATE ${this.#t.bindings} SET anchor_page_id = $3 WHERE id = $1 AND anchor_page_id IS NOT DISTINCT FROM $2 RETURNING id`,
      [input.bindingId, input.expected, input.pageId],
    );
    return row !== null;
  }
  async listBindings() {
    return (await this.#client.any(`SELECT * FROM ${this.#t.bindings} ORDER BY id COLLATE "C"`)).map(toBinding);
  }
  /** Nodes, their links, state, runs and runs' flushes and changes go with it, by ON DELETE CASCADE. */
  async retireBinding(id: string) {
    await this.#client.none(`DELETE FROM ${this.#t.bindings} WHERE id = $1`, [id]);
  }

  async startRun(input: {
    bindingId: string;
    runId: string;
    generation: number;
    fireKey?: string;
    deadlineAt?: Date;
  }): Promise<KnowledgeImporterRunStartResult> {
    return this.#client.tx(async tx => {
      // Serializes starts of one binding, so "is one running?" and the insert can't interleave.
      await tx.one(`SELECT id FROM ${this.#t.bindings} WHERE id = $1 FOR UPDATE`, [input.bindingId]);
      if (input.fireKey) {
        const fired = await tx.oneOrNone(`SELECT * FROM ${this.#t.runs} WHERE binding_id = $1 AND fire_key = $2`, [
          input.bindingId,
          input.fireKey,
        ]);
        if (fired) return { status: 'duplicate', run: toRun(fired) };
      }
      const running = await tx.oneOrNone(`SELECT 1 FROM ${this.#t.runs} WHERE binding_id = $1 AND status = 'running'`, [
        input.bindingId,
      ]);
      const status = running ? 'skipped' : 'running';
      const row = await tx.one(
        `INSERT INTO ${this.#t.runs} (id, binding_id, generation, status, fire_key, deadline_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $4 = 'skipped' THEN clock_timestamp() END) RETURNING *`,
        [input.runId, input.bindingId, input.generation, status, input.fireKey ?? null, input.deadlineAt ?? null],
      );
      return { status: running ? 'skipped' : 'started', run: toRun(row) };
    });
  }
  async getRun(runId: string) {
    const row = await this.#client.oneOrNone(`SELECT * FROM ${this.#t.runs} WHERE id = $1`, [runId]);
    return row ? toRun(row) : null;
  }
  async listRuns(bindingId: string, options: { limit?: number } = {}) {
    const rows = await this.#client.any(
      `SELECT * FROM ${this.#t.runs} WHERE binding_id = $1 ORDER BY started_at DESC, id LIMIT $2`,
      [bindingId, options.limit ?? 50],
    );
    return rows.map(toRun);
  }
  async requestCancel(runId: string) {
    const row = await this.#client.oneOrNone(
      `UPDATE ${this.#t.runs} SET cancel_requested_at = COALESCE(cancel_requested_at, clock_timestamp())
       WHERE id = $1 AND status = 'running' RETURNING *`,
      [runId],
    );
    return row ? toRun(row) : null;
  }
  async heartbeat(runId: string) {
    const row = await this.#client.oneOrNone(
      `UPDATE ${this.#t.runs} SET heartbeat_at = clock_timestamp() WHERE id = $1 AND status = 'running' RETURNING *`,
      [runId],
    );
    return row ? toRun(row) : null;
  }
  async abandonRun(input: { runId: string; finish: unknown; status?: 'failed' | 'canceled' }) {
    const row = await this.#client.oneOrNone(
      `UPDATE ${this.#t.runs} SET status = $3, finish = $2::jsonb, completed_at = clock_timestamp()
       WHERE id = $1 AND status = 'running' RETURNING *`,
      [input.runId, JSON.stringify(input.finish), input.status ?? 'failed'],
    );
    return row ? toRun(row) : null;
  }
  /** The database clock: run timestamps are written with `clock_timestamp()`. */
  async now() {
    const row = await this.#client.one<{ now: Date }>('SELECT clock_timestamp() AS now');
    return row.now;
  }
  async lockRun(runId: string) {
    const row = await this.#client.oneOrNone(`SELECT * FROM ${this.#t.runs} WHERE id = $1 FOR UPDATE`, [runId]);
    return row ? toRun(row) : null;
  }

  /**
   * Locks the guard shared, then the run, and checks the run can still write at `generation`. Always
   * guard before run: a first-write flush already holds the guard FOR UPDATE when it gets here, and a
   * standalone finish that took the run first would wait on the guard while the flush waits on the run.
   */
  async #activeRun(tx: Queryable, runId: string, generation: number): Promise<KnowledgeImporterRunRecord> {
    const guard = toGuard(await tx.one(`SELECT * FROM ${this.#t.guard} FOR SHARE`));
    const row = await tx.oneOrNone(`SELECT * FROM ${this.#t.runs} WHERE id = $1 FOR UPDATE`, [runId]);
    if (!row) throw await runStateError(runId, 'not_found');
    const run = toRun(row);
    if (run.status !== 'running') throw await runStateError(runId, 'not_running');
    if (run.generation !== generation) throw await runStateError(runId, 'generation');
    if (guard.generation !== generation) throw await runStateError(runId, 'stale_guard');
    return run;
  }

  async getFlush(runId: string, generation: number, seq: number) {
    const row = await this.#client.oneOrNone(
      `SELECT * FROM ${this.#t.flushes} WHERE run_id = $1 AND generation = $2 AND seq = $3`,
      [runId, generation, seq],
    );
    return row
      ? {
          runId: row.run_id,
          generation: Number(row.generation),
          seq: Number(row.seq),
          digest: row.digest,
          receipt: row.receipt,
        }
      : null;
  }
  async recordFlush(input: KnowledgeImporterFlushRecord & { counts: Record<string, number> }) {
    await this.#client.tx(async tx => {
      const run = await this.#activeRun(tx, input.runId, input.generation);
      if (run.lastSeq !== input.seq - 1) throw await runStateError(input.runId, 'seq');
      await tx.none(
        `INSERT INTO ${this.#t.flushes} (run_id, generation, seq, digest, receipt) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [input.runId, input.generation, input.seq, input.digest, JSON.stringify(input.receipt)],
      );
      const counts = { ...run.counts };
      for (const [name, value] of Object.entries(input.counts)) counts[name] = (counts[name] ?? 0) + value;
      await tx.none(`UPDATE ${this.#t.runs} SET last_seq = $2, counts = $3::jsonb WHERE id = $1`, [
        input.runId,
        input.seq,
        JSON.stringify(counts),
      ]);
    });
  }
  async finishRun(input: {
    runId: string;
    generation: number;
    lastSeq: number;
    status: Exclude<KnowledgeImporterRunStatus, 'running' | 'skipped'>;
    finish: unknown;
  }) {
    return this.#client.tx(async tx => {
      const run = await this.#activeRun(tx, input.runId, input.generation);
      if (run.lastSeq !== input.lastSeq) throw await runStateError(input.runId, 'seq');
      const row = await tx.one(
        `UPDATE ${this.#t.runs} SET status = $2, finish = $3::jsonb, completed_at = clock_timestamp() WHERE id = $1 RETURNING *`,
        [input.runId, input.status, JSON.stringify(input.finish)],
      );
      return toRun(row);
    });
  }

  async getNode(bindingId: string, sourceId: string) {
    const row = await this.#client.oneOrNone(
      `SELECT * FROM ${this.#t.nodes} WHERE binding_id = $1 AND source_id = $2`,
      [bindingId, sourceId],
    );
    return row ? toNode(row) : null;
  }
  async getNodeByPage(pageId: string) {
    const row = await this.#client.oneOrNone(`SELECT * FROM ${this.#t.nodes} WHERE page_id = $1`, [pageId]);
    return row ? toNode(row) : null;
  }
  async saveNode(node: Omit<KnowledgeImporterNodeRecord, 'updatedAt'>) {
    try {
      await this.#client.tx(async tx => {
        await tx.none(
          `INSERT INTO ${this.#t.nodes} (binding_id, source_id, page_id, kind, parent_source_id, aliases, unresolved_links, links, link_section, stub, adopted, unsettled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
           ON CONFLICT (binding_id, source_id) DO UPDATE SET
             page_id = EXCLUDED.page_id, kind = EXCLUDED.kind, parent_source_id = EXCLUDED.parent_source_id,
             aliases = EXCLUDED.aliases, unresolved_links = EXCLUDED.unresolved_links, links = EXCLUDED.links,
             link_section = EXCLUDED.link_section, stub = EXCLUDED.stub, adopted = EXCLUDED.adopted,
             unsettled = EXCLUDED.unsettled, updated_at = clock_timestamp()`,
          [
            node.bindingId,
            node.sourceId,
            node.pageId,
            node.kind,
            node.parentSourceId,
            node.aliases,
            node.unresolvedLinks,
            JSON.stringify(node.links),
            node.linkSection,
            node.stub,
            node.adopted,
            node.unsettled,
          ],
        );
        await tx.none(`DELETE FROM ${this.#t.nodeLinks} WHERE binding_id = $1 AND source_id = $2`, [
          node.bindingId,
          node.sourceId,
        ]);
        const targets = [...new Set(node.links.map(link => link.sourceId))];
        if (targets.length) {
          await tx.none(
            `INSERT INTO ${this.#t.nodeLinks} (binding_id, source_id, target_source_id)
             SELECT $1, $2, unnest($3::text[])`,
            [node.bindingId, node.sourceId, targets],
          );
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new Error(`Knowledge page ${node.pageId} is already mapped to another imported node`, { cause: error });
      }
      throw error;
    }
  }
  async deleteNode(bindingId: string, sourceId: string) {
    await this.#client.none(`DELETE FROM ${this.#t.nodes} WHERE binding_id = $1 AND source_id = $2`, [
      bindingId,
      sourceId,
    ]);
  }
  async listNodes(
    bindingId: string,
    options: { after?: string; limit?: number; unsettled?: boolean } = {},
  ): Promise<KnowledgeImporterPage<KnowledgeImporterNodeRecord>> {
    const limit = options.limit ?? 500;
    const rows = await this.#client.any(
      `SELECT * FROM ${this.#t.nodes}
       WHERE binding_id = $1 AND ($2::text IS NULL OR source_id COLLATE "C" > $2::text COLLATE "C")
         AND (NOT $4::boolean OR unsettled)
       ORDER BY source_id COLLATE "C" LIMIT $3`,
      [bindingId, options.after ?? null, limit + 1, options.unsettled ?? false],
    );
    const items = rows.slice(0, limit).map(toNode);
    return { items, next: rows.length > limit ? items[items.length - 1]!.sourceId : null };
  }
  async listLinkingNodes(
    bindingId: string,
    targetSourceIds: string[],
    options: { after?: string; limit?: number } = {},
  ): Promise<KnowledgeImporterPage<string>> {
    const limit = options.limit ?? 500;
    const rows = await this.#client.any(
      `SELECT DISTINCT source_id COLLATE "C" AS source_id FROM ${this.#t.nodeLinks}
       WHERE binding_id = $1 AND target_source_id = ANY ($2::text[])
         AND ($3::text IS NULL OR source_id COLLATE "C" > $3::text COLLATE "C")
       ORDER BY source_id COLLATE "C" LIMIT $4`,
      [bindingId, targetSourceIds, options.after ?? null, limit + 1],
    );
    const items = rows.slice(0, limit).map(row => row.source_id as string);
    return { items, next: rows.length > limit ? items[items.length - 1]! : null };
  }
  async markLinkingNodesUnsettled(bindingId: string, targetSourceIds: string[]) {
    await this.#client.none(
      `UPDATE ${this.#t.nodes} SET unsettled = true
       WHERE binding_id = $1 AND NOT unsettled AND source_id IN (
         SELECT source_id FROM ${this.#t.nodeLinks} WHERE binding_id = $1 AND target_source_id = ANY ($2::text[])
       )`,
      [bindingId, targetSourceIds],
    );
  }
  async findNodeByAlias(bindingId: string, alias: string) {
    const row = await this.#client.oneOrNone(
      `SELECT * FROM ${this.#t.nodes} WHERE binding_id = $1 AND $2 = ANY (aliases) ORDER BY source_id COLLATE "C" LIMIT 1`,
      [bindingId, alias],
    );
    return row ? toNode(row) : null;
  }

  async getState(bindingId: string) {
    const out: Record<string, string> = {};
    const rows = await this.#client.any(`SELECT key, value FROM ${this.#t.state} WHERE binding_id = $1`, [bindingId]);
    for (const row of rows) {
      Object.defineProperty(out, row.key, { value: row.value, enumerable: true, writable: true, configurable: true });
    }
    return out;
  }
  async setState(bindingId: string, state: Record<string, string>) {
    const keys = Object.keys(state);
    if (keys.length === 0) return;
    await this.#client.none(
      `INSERT INTO ${this.#t.state} (binding_id, key, value)
       SELECT $1, k, v FROM unnest($2::text[], $3::text[]) AS s(k, v)
       ON CONFLICT (binding_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [bindingId, keys, keys.map(name => state[name]!)],
    );
  }

  async recordRunChange(change: KnowledgeImporterRunChangeRecord) {
    await this.#client.none(
      `INSERT INTO ${this.#t.changes} (run_id, source_id, page_id, change, title, path) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id, source_id) DO UPDATE SET
         page_id = EXCLUDED.page_id, change = EXCLUDED.change, title = EXCLUDED.title, path = EXCLUDED.path`,
      [change.runId, change.sourceId, change.pageId, change.change, change.title, change.path],
    );
  }
  async listRunChanges(
    runId: string,
    options: { after?: string; limit?: number } = {},
  ): Promise<KnowledgeImporterPage<KnowledgeImporterRunChangeRecord>> {
    const limit = options.limit ?? 500;
    const rows = await this.#client.any(
      `SELECT * FROM ${this.#t.changes} WHERE run_id = $1 AND ord > $2 ORDER BY ord LIMIT $3`,
      [runId, options.after ?? '0', limit + 1],
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map(row => ({
        runId: row.run_id,
        sourceId: row.source_id,
        pageId: row.page_id ?? null,
        change: row.change,
        title: row.title,
        path: row.path,
      })),
      next: rows.length > limit ? String(page[page.length - 1]!.ord) : null,
    };
  }

  async readWriterGuard() {
    return toGuard(await this.#client.one(`SELECT * FROM ${this.#t.guard}`));
  }
  async lockWriterGuard(mode: 'share' | 'update') {
    return toGuard(
      await this.#client.one(`SELECT * FROM ${this.#t.guard} FOR ${mode === 'share' ? 'SHARE' : 'UPDATE'}`),
    );
  }
  async markFirstWrite() {
    const row = await this.#client.oneOrNone(
      `UPDATE ${this.#t.guard} SET first_write_at = clock_timestamp() WHERE first_write_at IS NULL RETURNING id`,
    );
    return row !== null;
  }
  async advanceWriterGuard(input: { activePath: string; generation: number }) {
    const row = await this.#client.oneOrNone(
      `UPDATE ${this.#t.guard} SET active_path = $1, generation = $2, first_write_at = NULL WHERE generation < $2 RETURNING *`,
      [input.activePath, input.generation],
    );
    if (!row) throw new Error(`Knowledge importer writer generation must move forward (to ${input.generation})`);
    return toGuard(row);
  }
}
