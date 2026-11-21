import { createClient } from '@libsql/client';
import type { DbClient } from '@mastra/pg';
import { resolveStoreConfiguration } from '../database/store.ts';

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

  const database = resolveStoreConfiguration();
  if (database.backend !== 'libsql') throw new Error('PostgreSQL duplicate lookup requires the configured client');
  const client = createClient({ url: database.url, authToken: database.authToken });
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
