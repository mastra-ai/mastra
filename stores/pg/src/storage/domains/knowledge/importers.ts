import type { KnowledgeImportOwnedPage, KnowledgeImportRun, KnowledgeImporterStore } from '@mastra/core/storage';

import type { DbClient } from '../../client';

/** Kept here, not imported, so the adapter still loads on a core without importers. */
export const PG_KNOWLEDGE_IMPORTER_TABLES = {
  state: 'mastra_knowledge_importer_state',
  runs: 'mastra_knowledge_importer_runs',
  pages: 'mastra_knowledge_importer_pages',
} as const;
const T = PG_KNOWLEDGE_IMPORTER_TABLES;

const DEFAULT_RUNS_LIMIT = 20;

const qualify = (schemaName: string | undefined, table: string) =>
  schemaName ? `"${schemaName}"."${table}"` : `"${table}"`;

export function pgKnowledgeImporterDDL(schemaName?: string): string[] {
  const q = (table: string) => qualify(schemaName, table);
  const idx = (name: string) => `"${schemaName ? `${schemaName}_` : ''}${name}"`;
  return [
    `CREATE TABLE IF NOT EXISTS ${q(T.state)} (
      "importerId" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL,
      PRIMARY KEY ("importerId", "key")
    )`,
    `CREATE TABLE IF NOT EXISTS ${q(T.runs)} (
      "id" TEXT PRIMARY KEY,
      "importerId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "dryRun" BOOLEAN NOT NULL,
      "incremental" BOOLEAN NOT NULL,
      "counts" JSONB NOT NULL,
      "error" TEXT,
      "startedAt" TIMESTAMPTZ NOT NULL,
      "completedAt" TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS ${idx('idx_kimporter_runs')} ON ${q(T.runs)} ("importerId", "startedAt")`,
    `CREATE INDEX IF NOT EXISTS ${idx('idx_kimporter_runs_started')} ON ${q(T.runs)} ("startedAt")`,
    `CREATE TABLE IF NOT EXISTS ${q(T.pages)} (
      "importerId" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "path" TEXT NOT NULL,
      PRIMARY KEY ("importerId", "scope", "path")
    )`,
  ];
}

interface RunRow {
  id: string;
  importerId: string;
  status: KnowledgeImportRun['status'];
  dryRun: boolean;
  incremental: boolean;
  counts: KnowledgeImportRun['counts'];
  error: string | null;
  startedAt: Date | string;
  completedAt: Date | string | null;
}

function toRun(row: RunRow): KnowledgeImportRun {
  return {
    id: row.id,
    importerId: row.importerId,
    status: row.status,
    dryRun: row.dryRun,
    incremental: row.incremental,
    counts: { ...row.counts },
    ...(row.error != null ? { error: row.error } : {}),
    startedAt: new Date(row.startedAt),
    ...(row.completedAt != null ? { completedAt: new Date(row.completedAt) } : {}),
  };
}

export class PgKnowledgeImporters implements KnowledgeImporterStore {
  readonly #client: DbClient;
  readonly #schemaName?: string;

  constructor(options: { client: DbClient; schemaName?: string }) {
    this.#client = options.client;
    this.#schemaName = options.schemaName;
  }

  #q(table: string) {
    return qualify(this.#schemaName, table);
  }

  async init(): Promise<void> {
    for (const statement of pgKnowledgeImporterDDL(this.#schemaName)) await this.#client.query(statement);
  }

  async clearAll(): Promise<void> {
    await this.#client.query(`TRUNCATE ${[T.state, T.runs, T.pages].map(t => this.#q(t)).join(', ')}`);
  }

  async getImportState(input: { importerId: string; key: string }): Promise<unknown> {
    const row = await this.#client.oneOrNone<{ value: unknown }>(
      `SELECT "value" FROM ${this.#q(T.state)} WHERE "importerId" = $1 AND "key" = $2`,
      [input.importerId, input.key],
    );
    return row ? row.value : undefined;
  }

  async setImportState(input: { importerId: string; key: string; value: unknown }): Promise<void> {
    if (input.value === undefined) {
      await this.#client.none(`DELETE FROM ${this.#q(T.state)} WHERE "importerId" = $1 AND "key" = $2`, [
        input.importerId,
        input.key,
      ]);
      return;
    }
    await this.#client.none(
      `INSERT INTO ${this.#q(T.state)} ("importerId", "key", "value") VALUES ($1, $2, $3::jsonb)
       ON CONFLICT ("importerId", "key") DO UPDATE SET "value" = EXCLUDED."value"`,
      [input.importerId, input.key, JSON.stringify(input.value)],
    );
  }

  async createImportRun(run: KnowledgeImportRun): Promise<KnowledgeImportRun> {
    const row = await this.#client.one<RunRow>(
      `INSERT INTO ${this.#q(T.runs)}
        ("id", "importerId", "status", "dryRun", "incremental", "counts", "error", "startedAt", "completedAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9) RETURNING *`,
      [
        run.id,
        run.importerId,
        run.status,
        run.dryRun,
        run.incremental,
        JSON.stringify(run.counts),
        run.error ?? null,
        run.startedAt,
        run.completedAt ?? null,
      ],
    );
    return toRun(row);
  }

  async updateImportRun(input: {
    id: string;
    status: KnowledgeImportRun['status'];
    counts: KnowledgeImportRun['counts'];
    error?: string;
    completedAt?: Date;
  }): Promise<KnowledgeImportRun> {
    const row = await this.#client.oneOrNone<RunRow>(
      `UPDATE ${this.#q(T.runs)} SET "status" = $2, "counts" = $3::jsonb, "error" = $4, "completedAt" = $5
       WHERE "id" = $1 RETURNING *`,
      [input.id, input.status, JSON.stringify(input.counts), input.error ?? null, input.completedAt ?? null],
    );
    if (!row) throw new Error(`Knowledge import run "${input.id}" does not exist.`);
    return toRun(row);
  }

  async getImportRun(input: { id: string }): Promise<KnowledgeImportRun | null> {
    const row = await this.#client.oneOrNone<RunRow>(`SELECT * FROM ${this.#q(T.runs)} WHERE "id" = $1`, [input.id]);
    return row ? toRun(row) : null;
  }

  async listImportRuns(input: { importerId?: string; limit?: number }): Promise<KnowledgeImportRun[]> {
    const limit = input.limit ?? DEFAULT_RUNS_LIMIT;
    const rows = input.importerId
      ? await this.#client.any<RunRow>(
          `SELECT * FROM ${this.#q(T.runs)} WHERE "importerId" = $1 ORDER BY "startedAt" DESC, "id" DESC LIMIT $2`,
          [input.importerId, limit],
        )
      : await this.#client.any<RunRow>(
          `SELECT * FROM ${this.#q(T.runs)} ORDER BY "startedAt" DESC, "id" DESC LIMIT $1`,
          [limit],
        );
    return rows.map(toRun);
  }

  async listImportOwnedPages(input: { importerId: string }): Promise<KnowledgeImportOwnedPage[]> {
    return this.#client.any<KnowledgeImportOwnedPage>(
      `SELECT "scope", "path" FROM ${this.#q(T.pages)} WHERE "importerId" = $1`,
      [input.importerId],
    );
  }

  async updateImportOwnedPages(input: {
    importerId: string;
    add?: readonly KnowledgeImportOwnedPage[];
    remove?: readonly KnowledgeImportOwnedPage[];
  }): Promise<void> {
    await this.#client.tx(async tx => {
      for (const page of input.remove ?? []) {
        await tx.none(`DELETE FROM ${this.#q(T.pages)} WHERE "importerId" = $1 AND "scope" = $2 AND "path" = $3`, [
          input.importerId,
          page.scope,
          page.path,
        ]);
      }
      for (const page of input.add ?? []) {
        await tx.none(
          `INSERT INTO ${this.#q(T.pages)} ("importerId", "scope", "path") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [input.importerId, page.scope, page.path],
        );
      }
    });
  }
}
