import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import {
  boundText,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  readWatermark,
  writeWatermark,
} from '../../importer-runtime.js';

const NOTION_WATERMARK_KEY = 'notion:watermark';

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
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      // Search sorts newest-first; walk pages until we cross the watermark or exhaust the source.
      // If we hit maxPages/maxRecords before crossing the watermark, `drainedFully` is false and
      // we advance to the OLDEST processed rather than the newest — otherwise the un-fetched
      // older tail would be skipped forever.
      const collected: NotionSearchResult[] = [];
      let cursor: string | undefined;
      let drainedFully = false;
      let recordsCollected = 0;
      pager: for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const body: Record<string, unknown> = {
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          page_size: 50,
        };
        if (cursor) body.start_cursor = cursor;
        const parsed = searchResponseSchema.parse(await ctx.request({ method: 'POST', path: 'v1/search', body }));
        for (const result of parsed.results) {
          if (previousWatermark !== undefined && result.last_edited_time < previousWatermark) {
            // Sorted descending — anything past this is already imported.
            drainedFully = true;
            break pager;
          }
          collected.push(result);
          recordsCollected++;
          if (recordsCollected >= DEFAULT_MAX_RECORDS_PER_RUN) break pager;
        }
        if (!parsed.has_more || !parsed.next_cursor) {
          drainedFully = true;
          break;
        }
        cursor = parsed.next_cursor;
      }
      // First-ever run: if nothing was collected, treat as drained.
      if (previousWatermark === undefined && collected.length === 0) drainedFully = true;

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
      // If we drained fully (walked back to previousWatermark or exhausted the source), the
      // newest processed timestamp is a safe boundary. If we bailed on maxPages/maxRecords,
      // the un-fetched tail is OLDER than everything collected — keep the watermark where it
      // was so a subsequent run refetches this window (idempotent via contentRecordId) and
      // continues toward the older tail.
      if (drainedFully && lastProcessed) {
        await writeWatermark(context.state, NOTION_WATERMARK_KEY, lastProcessed);
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
