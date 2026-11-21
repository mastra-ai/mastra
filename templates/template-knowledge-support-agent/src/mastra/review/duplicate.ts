import { createClient } from '@libsql/client';
import type { DbClient } from '@mastra/pg';
import { resolveStoreConfiguration } from '../database/store.ts';

function openLibSQL() {
  const database = resolveStoreConfiguration();
  if (database.backend !== 'libsql') throw new Error('PostgreSQL lookup requires the configured client');
  return createClient({ url: database.url, authToken: database.authToken });
}

/** The ranked Knowledge search cannot guarantee an exact body substring match. */
export async function hasDuplicatePage(
  scopeId: string,
  content: string,
  excludedId: string | undefined,
  postgres?: DbClient,
) {
  const parameters = [scopeId, content, excludedId ?? ''];
  if (postgres) {
    const match = await postgres.oneOrNone(
      `SELECT 1 FROM "public"."mastra_knowledge_pages"
       WHERE "scopeId" = $1 AND NOT "isScope" AND "deletedAt" IS NULL AND "id" <> $3 AND strpos("body", $2) > 0
       LIMIT 1`,
      parameters,
    );
    return match !== null;
  }

  const client = openLibSQL();
  try {
    const match = await client.execute({
      sql: `SELECT 1 FROM "mastra_knowledge_pages"
            WHERE "scopeId" = ? AND "isScope" = 0 AND "deletedAt" IS NULL AND instr("body", ?) > 0 AND "id" <> ?
            LIMIT 1`,
      args: parameters,
    });
    return match.rows.length > 0;
  } finally {
    client.close();
  }
}

/** Legacy approvals need a unique marker match even when the effect is now a tombstone. */
export async function matchingNoteIds(
  pageId: string,
  text: string,
  match: 'legacy-marker' | 'live-content',
  postgres?: DbClient,
) {
  const parameters = [pageId, text];
  const legacy = match === 'legacy-marker';
  if (postgres) {
    const rows = await postgres.manyOrNone<{ id: string }>(
      `SELECT "id" FROM "public"."mastra_knowledge_notes" WHERE "pageId" = $1 AND ${
        legacy ? 'strpos("text", $2) = 1 LIMIT 2' : '"deletedAt" IS NULL AND strpos("text", $2) > 0 LIMIT 1'
      }`,
      parameters,
    );
    return rows.map(row => row.id);
  }
  const client = openLibSQL();
  try {
    const { rows } = await client.execute({
      sql: `SELECT "id" FROM "mastra_knowledge_notes" WHERE "pageId" = ? AND ${
        legacy ? 'instr("text", ?) = 1 LIMIT 2' : '"deletedAt" IS NULL AND instr("text", ?) > 0 LIMIT 1'
      }`,
      args: parameters,
    });
    return rows.map(row => String(row.id));
  } finally {
    client.close();
  }
}
