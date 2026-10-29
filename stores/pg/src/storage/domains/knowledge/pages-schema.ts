import {
  inspectKnowledgePagesSchema,
  KNOWLEDGE_PAGES_SCHEMA_VERSION,
  KNOWLEDGE_RESETTABLE_TABLE_NAMES,
  knowledgePagesResetMessage,
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
  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = COALESCE($1, current_schema()) AND table_name LIKE 'mastra\\_knowledge\\_%'`,
    [schemaName ?? null],
  );
  const tableNames = tables.rows.map(row => String(row.table_name));
  let schemaVersion: number | undefined;
  if (tableNames.includes(PG_KNOWLEDGE_PAGES_TABLES.state)) {
    const state = await db.query(
      `SELECT "schemaVersion" FROM ${qualify(schemaName, PG_KNOWLEDGE_PAGES_TABLES.state)} WHERE "id" = 'knowledge'`,
    );
    // The state table name is reused from schema 2, whose rows have a different shape.
    schemaVersion = state.rows[0] ? Number(state.rows[0].schemaVersion) : undefined;
  }
  return inspectKnowledgePagesSchema({ tableNames, schemaVersion });
}

/** Creates the schema-4 tables, refusing (with the reset message) over anything older. */
export async function initPgKnowledgePagesSchema(client: DbClient, schemaName?: string): Promise<void> {
  await client.tx(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mastra-knowledge-schema:${schemaName ?? ''}`]);
    const inspection = await inspectPgKnowledgePagesSchemaSafe(tx, schemaName);
    if (inspection.status === 'incompatible-reset-required') throw new PgKnowledgeResetRequiredError(inspection);
    for (const statement of pgKnowledgePagesDDL(schemaName)) await tx.query(statement);
    await tx.query(
      `INSERT INTO ${qualify(schemaName, PG_KNOWLEDGE_PAGES_TABLES.state)} ("id","schemaVersion") VALUES ('knowledge', $1) ON CONFLICT ("id") DO NOTHING`,
      [KNOWLEDGE_PAGES_SCHEMA_VERSION],
    );
  });
}

/**
 * A schema-2 state table has no `schemaVersion` column under that name's schema-4 meaning; reading
 * it can fail on the missing `knowledge` row shape. Any failure there means the tables are legacy.
 */
async function inspectPgKnowledgePagesSchemaSafe(
  db: Queryable,
  schemaName?: string,
): Promise<KnowledgePagesSchemaInspection> {
  try {
    return await inspectPgKnowledgePagesSchema(db, schemaName);
  } catch {
    return inspectKnowledgePagesSchema({ tableNames: [PG_KNOWLEDGE_PAGES_TABLES.state, 'mastra_knowledge_nodes'] });
  }
}

/** Drops exactly the Knowledge tables (never Memory's) and recreates schema 4. */
export async function resetPgKnowledgePagesSchema(client: DbClient, schemaName?: string): Promise<void> {
  const tables = KNOWLEDGE_RESETTABLE_TABLE_NAMES.map(table => qualify(schemaName, table)).join(', ');
  await client.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
  await initPgKnowledgePagesSchema(client, schemaName);
}
