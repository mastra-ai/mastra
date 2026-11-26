import { createClient } from '@libsql/client';
import type { KnowledgeStorage } from '@mastra/core/knowledge';
import type { WriterContext } from './writer-lock.ts';

type SeedNote = { id: string; pageId: string; text: string; createdAt: string };
const batchSize = 100;

/** Native listNotes is page-scoped. Filter the retained-note candidates in SQL across each page batch. */
export async function reportRetainedSeedRecords(
  storage: KnowledgeStorage,
  datasetId: string,
  selectedNotes: ReadonlyMap<string, ReadonlySet<string>>,
  { libsql, postgres }: WriterContext,
) {
  const author = `seed:${datasetId}`;
  const notePrefix = `Seed note: ${datasetId}/`;
  const pagePrefix = `<!-- knowledge-seed:page:${datasetId}:`;
  const client = libsql && createClient({ url: libsql.url, authToken: libsql.authToken });
  const schema = postgres ? '"public".' : '';
  const position = '(n."pageId", n."createdAt", n."id")';
  const retained: string[] = [];

  async function readNotes(pageIds: string[], after: SeedNote | undefined): Promise<SeedNote[]> {
    const filter = postgres
      ? `n."pageId" = ANY($1::text[]) AND n."provenance"->>'author' = $2 AND starts_with(n."text", $3)`
      : `n."pageId" IN (SELECT value FROM json_each(?1)) AND json_extract(n."provenance", '$.author') = ?2
         AND instr(n."text", ?3) = 1`;
    const next = after ? `AND ${position} > ${postgres ? '($4, $5::timestamptz, $6)' : '(?4, ?5, ?6)'}` : '';
    const sql = `SELECT n."id", n."pageId", n."text", ${postgres ? 'n."createdAt"::text' : 'n."createdAt"'} AS "createdAt"
      FROM ${schema}"mastra_knowledge_notes" n
      WHERE n."deletedAt" IS NULL AND ${filter} ${next}
        AND EXISTS (
          SELECT 1 FROM ${schema}"mastra_knowledge_note_stamps" st
          JOIN ${schema}"mastra_knowledge_pages" s ON s."id" = st."scopeId"
          WHERE st."noteId" = n."id" AND s."isScope"
        )
      ORDER BY n."pageId", n."createdAt", n."id"
      LIMIT ${batchSize}`;
    const args = [author, notePrefix, ...(after ? [after.pageId, after.createdAt, after.id] : [])];
    if (postgres) return postgres.manyOrNone<SeedNote>(sql, [pageIds, ...args]);
    const { rows } = await client!.execute({ sql, args: [JSON.stringify(pageIds), ...args] });
    return rows.map(row => ({
      id: String(row.id),
      pageId: String(row.pageId),
      text: String(row.text),
      createdAt: String(row.createdAt),
    }));
  }

  try {
    let cursor: string | undefined;
    do {
      const batch = await storage.listPages({ read: 'all', cursor, limit: batchSize });
      if (!batch.pages.length) break;
      const pageIds = batch.pages.map(page => page.id);
      const retainedNotes = new Map<string, string[]>();
      let after: SeedNote | undefined;
      do {
        const notes = await readNotes(pageIds, after);
        for (const note of notes) {
          if (selectedNotes.get(note.pageId)?.has(note.text.split('\n', 1)[0]!)) continue;
          const entries = retainedNotes.get(note.pageId) ?? [];
          entries.push(`note:${note.id}`);
          retainedNotes.set(note.pageId, entries);
        }
        after = notes.length === batchSize ? notes.at(-1) : undefined;
      } while (after);
      for (const page of batch.pages) {
        if (page.createdBy.author === author && page.body?.startsWith(pagePrefix) && !selectedNotes.has(page.id))
          retained.push(`page:${page.id}`);
        for (const note of retainedNotes.get(page.id) ?? []) retained.push(note);
      }
      cursor = batch.nextCursor;
    } while (cursor);
    return retained;
  } finally {
    client?.close();
  }
}
