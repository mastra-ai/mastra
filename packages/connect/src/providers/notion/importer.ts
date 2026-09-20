import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import {
  boundText,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  readWatermark,
  walkPages,
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

      // Search sorts newest-first; walk pages until we cross the watermark, then process oldest-first.
      const collected: NotionSearchResult[] = [];
      let cursor: string | undefined;
      let latestSeen: string | undefined;
      await walkPages(
        { signal: context.signal, maxRecords: DEFAULT_MAX_RECORDS_PER_RUN, maxPages: DEFAULT_MAX_PAGES_PER_RUN },
        async () => {
          const body: Record<string, unknown> = {
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: 50,
          };
          if (cursor) body.start_cursor = cursor;
          const parsed = searchResponseSchema.parse(await ctx.request({ method: 'POST', path: 'v1/search', body }));
          const stopAtWatermark = previousWatermark !== undefined;
          for (const result of parsed.results) {
            if (!latestSeen || result.last_edited_time > latestSeen) latestSeen = result.last_edited_time;
            if (stopAtWatermark && result.last_edited_time < previousWatermark) {
              // Sorted descending — anything past this is already imported.
              return undefined;
            }
            collected.push(result);
          }
          if (!parsed.has_more || !parsed.next_cursor) return undefined;
          cursor = parsed.next_cursor;
          return { pageIndex: 0 };
        },
        async ({ recordsProcessed }) => recordsProcessed,
      );

      // Process oldest-first so a mid-run failure leaves the watermark low.
      collected.sort((a, b) => a.last_edited_time.localeCompare(b.last_edited_time));

      for (const result of collected) {
        if (context.signal.aborted) return;
        const address = nodeAddress(result);
        const archived = Boolean(result.archived ?? result.in_trash);
        if (archived) {
          if (!canRemove) continue;
          const existing = await importer.getNode(address);
          if (!existing) continue;
          const records = await existing.listRecords();
          for (const record of records) await existing.removeRecord(record.id);
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
      }

      // Single trailing checkpoint — advance watermark only after every mutation committed.
      if (latestSeen) await writeWatermark(context.state, NOTION_WATERMARK_KEY, latestSeen);
    },
  };
}

export const notionImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'notion',
  envVar: 'MASTRA_NOTION_CONNECTION_ID',
  defaultSchedule: '0 * * * *',
  createImporter: createNotionImporter,
};
