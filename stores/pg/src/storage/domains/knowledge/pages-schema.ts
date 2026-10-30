import {
  inspectKnowledgePagesSchema,
  KNOWLEDGE_PAGES_SCHEMA_VERSION,
  KNOWLEDGE_RESETTABLE_TABLE_NAMES,
  knowledgePagesResetMessage,
  legacyKnowledgeTablesToDrop,
} from '@internal/core/knowledge-compat';
import type { KnowledgePagesSchemaInspection } from '@internal/core/knowledge-compat';

import type { DbClient, TxClient } from '../../client';
import { PG_KNOWLEDGE_PAGES_TABLES, pgKnowledgePagesDDL } from './pages';

type Queryable = Pick<DbClient, 'query'> | Pick<TxClient, 'query'>;

const qualify = (schemaName: string | undefined, table: string) =>
  schemaName ? `"${schemaName}"."${table}"` : `"${table}"`;

/** Thrown when existing Knowledge tables can't be used as schema 4 without a reset. */
export class PgKnowledgeResetRequiredError extends Error {
  readonly inspection: Extract<KnowledgePagesSchemaInspection, { status: 'incompatible-reset-required' }>;

  constructor(inspection: Extract<KnowledgePagesSchemaInspection, { status: 'incompatible-reset-required' }>) {
    super(knowledgePagesResetMessage(inspection.reason));
    this.name = 'KnowledgeSchemaResetRequiredError';
    this.inspection = inspection;
  }
}

/** Looks at every `mastra_knowledge_*` table and the version row without changing anything. */
export async function inspectPgKnowledgePagesSchema(
  db: Queryable,
  schemaName?: string,
): Promise<KnowledgePagesSchemaInspection> {
  return inspectKnowledgePagesSchema(await pgKnowledgeSnapshot(db, schemaName));
}

/** Creates the schema-4 tables, refusing (with the reset message) over anything older. */
export async function initPgKnowledgePagesSchema(client: DbClient, schemaName?: string): Promise<void> {
  await client.tx(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mastra-knowledge-schema:${schemaName ?? ''}`]);
    // Knowledge before schema 4 was experimental and is not migrated: drop its tables, rows included.
    const drop = legacyKnowledgeTablesToDrop(await pgKnowledgeSnapshot(tx, schemaName));
    if (drop.length > 0) {
      await tx.query(`DROP TABLE IF EXISTS ${drop.map(table => qualify(schemaName, table)).join(', ')} CASCADE`);
    }
    const inspection = await inspectPgKnowledgePagesSchema(tx, schemaName);
    if (inspection.status === 'incompatible-reset-required') throw new PgKnowledgeResetRequiredError(inspection);
    for (const statement of pgKnowledgePagesDDL(schemaName)) await tx.query(statement);
    await tx.query(
      `INSERT INTO ${qualify(schemaName, PG_KNOWLEDGE_PAGES_TABLES.state)} ("id","schemaVersion") VALUES ('knowledge', $1) ON CONFLICT ("id") DO NOTHING`,
      [KNOWLEDGE_PAGES_SCHEMA_VERSION],
    );
  });
}

/**
 * Every `mastra_knowledge_*` table and the schema-4 version, if any. The state table is read as
 * whole rows because schema 2 used the same name with a different shape, and a failed query would
 * abort the init transaction.
 */
async function pgKnowledgeSnapshot(
  db: Queryable,
  schemaName?: string,
): Promise<{ tableNames: string[]; schemaVersion?: number }> {
  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = COALESCE($1, current_schema()) AND table_name LIKE 'mastra\\_knowledge\\_%'`,
    [schemaName ?? null],
  );
  const tableNames = tables.rows.map(row => String(row.table_name));
  if (!tableNames.includes(PG_KNOWLEDGE_PAGES_TABLES.state)) return { tableNames };
  const state = await db.query(
    `SELECT to_jsonb(s) AS row FROM ${qualify(schemaName, PG_KNOWLEDGE_PAGES_TABLES.state)} s`,
  );
  const row = state.rows.map(r => r.row as Record<string, unknown>).find(r => r.id === 'knowledge');
  return { tableNames, schemaVersion: typeof row?.schemaVersion === 'number' ? row.schemaVersion : undefined };
}

/** Drops exactly the Knowledge tables (never Memory's) and recreates schema 4. */
export async function resetPgKnowledgePagesSchema(client: DbClient, schemaName?: string): Promise<void> {
  const tables = KNOWLEDGE_RESETTABLE_TABLE_NAMES.map(table => qualify(schemaName, table)).join(', ');
  await client.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
  await initPgKnowledgePagesSchema(client, schemaName);
}
