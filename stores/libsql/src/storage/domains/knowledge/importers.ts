import type { KnowledgeImportOwnedPage, KnowledgeImportRun, KnowledgeImporterStore } from '@mastra/core/storage';
import type { SqliteInValue as InValue, SqliteResultSet as ResultSet } from '../../db/client';

interface Executor {
  execute(statement: string | { sql: string; args?: InValue[] }): Promise<ResultSet>;
}

/** Kept here, not imported, so the adapter still loads on a core without importers. */
export const KNOWLEDGE_IMPORTER_TABLES = {
  state: 'mastra_knowledge_importer_state',
  runs: 'mastra_knowledge_importer_runs',
  pages: 'mastra_knowledge_importer_pages',
} as const;
const T = KNOWLEDGE_IMPORTER_TABLES;

const DEFAULT_RUNS_LIMIT = 20;

export const KNOWLEDGE_IMPORTER_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "${T.state}" (
    importerId TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (importerId, key)
  )`,
  `CREATE TABLE IF NOT EXISTS "${T.runs}" (
    id TEXT PRIMARY KEY,
    importerId TEXT NOT NULL,
    status TEXT NOT NULL,
    dryRun INTEGER NOT NULL,
    incremental INTEGER NOT NULL,
    counts TEXT NOT NULL,
    error TEXT,
    startedAt TEXT NOT NULL,
    completedAt TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kimporter_runs ON "${T.runs}" (importerId, startedAt)`,
  `CREATE INDEX IF NOT EXISTS idx_kimporter_runs_started ON "${T.runs}" (startedAt)`,
  `CREATE TABLE IF NOT EXISTS "${T.pages}" (
    importerId TEXT NOT NULL,
    scope TEXT NOT NULL,
    path TEXT NOT NULL,
    PRIMARY KEY (importerId, scope, path)
  )`,
];

function toRun(row: Record<string, unknown>): KnowledgeImportRun {
  return {
    id: String(row.id),
    importerId: String(row.importerId),
    status: String(row.status) as KnowledgeImportRun['status'],
    dryRun: Number(row.dryRun) === 1,
    incremental: Number(row.incremental) === 1,
    counts: JSON.parse(String(row.counts)),
    ...(row.error != null && { error: String(row.error) }),
    startedAt: new Date(String(row.startedAt)),
    ...(row.completedAt != null && { completedAt: new Date(String(row.completedAt)) }),
  };
}

export class LibSQLKnowledgeImporters implements KnowledgeImporterStore {
  readonly #read: Executor;
  readonly #write: <R>(operation: (tx: Executor) => Promise<R>) => Promise<R>;

  constructor(options: { read: Executor; transaction: <R>(operation: (tx: Executor) => Promise<R>) => Promise<R> }) {
    this.#read = options.read;
    this.#write = options.transaction;
  }

  async getImportState({ importerId, key }: { importerId: string; key: string }) {
    const result = await this.#read.execute({
      sql: `SELECT value FROM "${T.state}" WHERE importerId = ? AND key = ?`,
      args: [importerId, key],
    });
    const row = result.rows[0];
    return row ? JSON.parse(String(row.value)) : undefined;
  }

  async setImportState({ importerId, key, value }: { importerId: string; key: string; value: unknown }) {
    await this.#write(tx =>
      value === undefined
        ? tx.execute({ sql: `DELETE FROM "${T.state}" WHERE importerId = ? AND key = ?`, args: [importerId, key] })
        : tx.execute({
            sql: `INSERT INTO "${T.state}" (importerId, key, value) VALUES (?, ?, ?)
                  ON CONFLICT (importerId, key) DO UPDATE SET value = excluded.value`,
            args: [importerId, key, JSON.stringify(value)],
          }),
    );
  }

  async createImportRun(run: KnowledgeImportRun) {
    await this.#write(tx =>
      tx.execute({
        sql: `INSERT INTO "${T.runs}" (id, importerId, status, dryRun, incremental, counts, error, startedAt, completedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          run.id,
          run.importerId,
          run.status,
          run.dryRun ? 1 : 0,
          run.incremental ? 1 : 0,
          JSON.stringify(run.counts),
          run.error ?? null,
          run.startedAt.toISOString(),
          run.completedAt?.toISOString() ?? null,
        ],
      }),
    );
    return (await this.getImportRun({ id: run.id }))!;
  }

  async updateImportRun(input: Parameters<KnowledgeImporterStore['updateImportRun']>[0]) {
    const result = await this.#write(tx =>
      tx.execute({
        sql: `UPDATE "${T.runs}" SET status = ?, counts = ?, error = ?, completedAt = ? WHERE id = ?`,
        args: [
          input.status,
          JSON.stringify(input.counts),
          input.error ?? null,
          input.completedAt?.toISOString() ?? null,
          input.id,
        ],
      }),
    );
    if (result.rowsAffected === 0) throw new Error(`Knowledge import run ${input.id} not found.`);
    return (await this.getImportRun({ id: input.id }))!;
  }

  async getImportRun({ id }: { id: string }) {
    const result = await this.#read.execute({ sql: `SELECT * FROM "${T.runs}" WHERE id = ?`, args: [id] });
    return result.rows[0] ? toRun(result.rows[0] as Record<string, unknown>) : null;
  }

  async listImportRuns({ importerId, limit }: { importerId?: string; limit?: number }) {
    const where = importerId === undefined ? '' : 'WHERE importerId = ?';
    const args: InValue[] = importerId === undefined ? [] : [importerId];
    const result = await this.#read.execute({
      sql: `SELECT * FROM "${T.runs}" ${where} ORDER BY startedAt DESC, id DESC LIMIT ?`,
      args: [...args, limit ?? DEFAULT_RUNS_LIMIT],
    });
    return result.rows.map(row => toRun(row as Record<string, unknown>));
  }

  async listImportOwnedPages({ importerId }: { importerId: string }) {
    const result = await this.#read.execute({
      sql: `SELECT scope, path FROM "${T.pages}" WHERE importerId = ?`,
      args: [importerId],
    });
    return result.rows.map(row => ({ scope: String(row.scope), path: String(row.path) }));
  }

  async updateImportOwnedPages(input: {
    importerId: string;
    add?: readonly KnowledgeImportOwnedPage[];
    remove?: readonly KnowledgeImportOwnedPage[];
  }) {
    if (!input.add?.length && !input.remove?.length) return;
    await this.#write(async tx => {
      for (const page of input.remove ?? []) {
        await tx.execute({
          sql: `DELETE FROM "${T.pages}" WHERE importerId = ? AND scope = ? AND path = ?`,
          args: [input.importerId, page.scope, page.path],
        });
      }
      for (const page of input.add ?? []) {
        await tx.execute({
          sql: `INSERT OR IGNORE INTO "${T.pages}" (importerId, scope, path) VALUES (?, ?, ?)`,
          args: [input.importerId, page.scope, page.path],
        });
      }
    });
  }

  async clearAll() {
    await this.#write(async tx => {
      for (const table of Object.values(T)) await tx.execute(`DELETE FROM "${table}"`);
    });
  }
}
