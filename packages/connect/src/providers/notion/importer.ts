import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import {
  boundText,
  clearHighWater,
  clearResumeCursor,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  readHighWater,
  readResumeCursor,
  readWatermark,
  writeHighWater,
  writeResumeCursor,
  writeWatermark,
} from '../../importer-runtime.js';

const NOTION_WATERMARK_KEY = 'notion:watermark';
const NOTION_RESUME_CURSOR_KEY = 'notion:resume-cursor';
const NOTION_HIGH_WATER_KEY = 'notion:high-water';

const richTextItemSchema = z.object({
  plain_text: z.string().default(''),
});

const titlePropertySchema = z
  .object({ type: z.literal('title'), title: z.array(richTextItemSchema).default([]) })
  .passthrough();

const genericPropertySchema = z.object({ type: z.string() }).passthrough();

const propertySchema = z.union([titlePropertySchema, genericPropertySchema]);

const pageResultSchema = z.object({
  object: z.literal('page'),
  id: z.string(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  url: z.string().optional(),
  last_edited_time: z.string(),
  properties: z.record(z.string(), propertySchema).default({}),
});

const databaseResultSchema = z.object({
  object: z.literal('database'),
  id: z.string(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  url: z.string().optional(),
  last_edited_time: z.string(),
  title: z.array(richTextItemSchema).default([]),
});

const searchResultSchema = z.union([pageResultSchema, databaseResultSchema]);

const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  has_more: z.boolean().default(false),
  next_cursor: z.string().nullish(),
});

type NotionSearchResult = z.infer<typeof searchResultSchema>;

function extractTitle(result: NotionSearchResult): string {
  if (result.object === 'database') {
    return (
      result.title
        .map(t => t.plain_text)
        .join('')
        .trim() || 'Untitled'
    );
  }
  for (const value of Object.values(result.properties)) {
    if (value.type === 'title' && 'title' in value) {
      const text = (value.title as z.infer<typeof richTextItemSchema>[])
        .map(t => t.plain_text)
        .join('')
        .trim();
      if (text) return text;
    }
  }
  return 'Untitled';
}

function extractPropertyText(result: NotionSearchResult): string {
  if (result.object === 'database') return '';
  const parts: string[] = [];
  for (const [name, value] of Object.entries(result.properties)) {
    if (value.type === 'title') continue;
    if ('rich_text' in value && Array.isArray(value.rich_text)) {
      const text = (value.rich_text as { plain_text?: string }[])
        .map(t => t.plain_text ?? '')
        .join('')
        .trim();
      if (text) parts.push(`${name}: ${text}`);
    }
  }
  return parts.join('\n');
}

function nodeAddress(result: NotionSearchResult): string {
  return `notion:${result.object}:${result.id}`;
}

function nodeKind(result: NotionSearchResult): 'connect:notion:page' | 'connect:notion:database' {
  return result.object === 'page' ? 'connect:notion:page' : 'connect:notion:database';
}

function createNotionImporter(ctx: ImporterProviderContext) {
  return {
    id: 'notion',
    access: ctx.access,
    triggers: {
      cron: {
        schedule: ctx.schedule,
        bindings: Object.keys(ctx.access).map(scope => ({ source: `notion:${ctx.connection.id}`, scope })),
      },
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, NOTION_WATERMARK_KEY);
      const resumeCursor = await readResumeCursor(context.state, NOTION_RESUME_CURSOR_KEY);
      const persistedHighWater = await readHighWater(context.state, NOTION_HIGH_WATER_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      // Search sorts newest-first; walk pages until we cross the watermark or exhaust the source.
      // On truncation (maxPages/maxRecords) we persist the next_cursor so the following run resumes
      // where we stopped — critical for initial backfills larger than one bounded run can drain.
      const collected: NotionSearchResult[] = [];
      // Resume mid-backfill if the previous run left a cursor; otherwise start from the newest.
      let cursor: string | undefined = resumeCursor;
      let nextCursorAfterLastPage: string | undefined;
      let drainedFully = false;
      let recordsCollected = 0;
      // Track the newest timestamp actually observed in the API response, before any ASC sort.
      // When a drain run follows one or more cap-truncated runs, `lastProcessed` (max of this
      // run's collected only) is OLDER than the previous run's items. Seed from the persisted
      // high-water so the drain run can write the true high across the multi-run backfill.
      let newestObserved: string | undefined = persistedHighWater;
      pager: for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const body: Record<string, unknown> = {
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          page_size: 50,
        };
        if (cursor) body.start_cursor = cursor;
        const parsed = searchResponseSchema.parse(await ctx.request({ method: 'POST', path: 'v1/search', body }));
        for (const result of parsed.results) {
          if (!newestObserved || result.last_edited_time > newestObserved) newestObserved = result.last_edited_time;
          if (previousWatermark !== undefined && result.last_edited_time < previousWatermark) {
            // Sorted descending — anything past this is already imported.
            drainedFully = true;
            break pager;
          }
          collected.push(result);
          recordsCollected++;
          if (recordsCollected >= DEFAULT_MAX_RECORDS_PER_RUN) {
            if (parsed.next_cursor && parsed.has_more) {
              nextCursorAfterLastPage = parsed.next_cursor;
            } else {
              // Cap tripped on the final page — no cursor to resume with, but the source
              // is exhausted. Treat as drained so the watermark can still advance.
              drainedFully = true;
            }
            break pager;
          }
        }
        if (!parsed.has_more || !parsed.next_cursor) {
          drainedFully = true;
          break;
        }
        cursor = parsed.next_cursor;
        nextCursorAfterLastPage = parsed.next_cursor;
      }

      // Process oldest-first so a mid-run failure leaves the watermark low.
      collected.sort((a, b) => a.last_edited_time.localeCompare(b.last_edited_time));

      let lastProcessed: string | undefined;
      for (const result of collected) {
        if (context.signal.aborted) return;
        const address = nodeAddress(result);
        const archived = Boolean(result.archived ?? result.in_trash);
        if (archived) {
          if (canRemove) {
            const existing = await importer.getNode(address);
            if (existing) {
              const records = await existing.listRecords();
              for (const record of records) await existing.removeRecord(record.id);
            }
          }
          lastProcessed = result.last_edited_time;
          continue;
        }

        const title = extractTitle(result);
        const propertyText = extractPropertyText(result);
        const recordPayload = {
          address,
          title,
          propertyText,
          lastEditedTime: result.last_edited_time,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, { name: title, kind: nodeKind(result) });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(propertyText ? `${title}\n\n${propertyText}` : title),
            metadata: { url: result.url, lastEditedTime: result.last_edited_time },
          });
        }
        // Remove stale records the importer previously owned for this node.
        if (canRemove) {
          for (const previous of existingRecords) {
            if (previous.id !== recordId) await node.removeRecord(previous.id);
          }
        }
        lastProcessed = result.last_edited_time;
      }

      // Single trailing checkpoint — advance watermark only after every mutation committed.
      // On drain: the correct watermark is the newest timestamp EVER observed across the
      // multi-run backfill — not `lastProcessed` (this run's newest), because a drain that
      // resumed from a cursor only saw the older tail. Use max(previousWatermark, newestObserved).
      // Also clear the resume cursor. Clear FIRST so a failure between the two leaves state
      // consistent (cursor gone, watermark old — next run does a clean restart).
      // On truncation: persist the cursor so the next run resumes deeper into the tail.
      if (drainedFully && (lastProcessed || newestObserved)) {
        const candidate =
          newestObserved && (!previousWatermark || newestObserved > previousWatermark)
            ? newestObserved
            : previousWatermark;
        // Clear the resume/high-water first so a failed watermark write still leaves the
        // per-backfill state consistent (next run does a clean restart from the newest edge).
        await clearResumeCursor(context.state, NOTION_RESUME_CURSOR_KEY);
        await clearHighWater(context.state, NOTION_HIGH_WATER_KEY);
        if (candidate) await writeWatermark(context.state, NOTION_WATERMARK_KEY, candidate);
      } else if (!drainedFully && nextCursorAfterLastPage) {
        await writeResumeCursor(context.state, NOTION_RESUME_CURSOR_KEY, nextCursorAfterLastPage);
        if (newestObserved) await writeHighWater(context.state, NOTION_HIGH_WATER_KEY, newestObserved);
      }
    },
  };
}

export const notionImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'notion',
  envVar: 'MASTRA_NOTION_CONNECTION_ID',
  defaultSchedule: '0 * * * *',
  createImporter: createNotionImporter,
};
