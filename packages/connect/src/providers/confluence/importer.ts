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

const CONFLUENCE_WATERMARK_KEY = 'confluence:watermark';

const searchResultSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  title: z.string().default(''),
  status: z.string().optional(),
  version: z.object({ number: z.number(), when: z.string().optional() }).optional(),
  space: z.object({ key: z.string().optional() }).optional(),
  body: z
    .object({
      storage: z.object({ value: z.string().default('') }).optional(),
    })
    .optional(),
  _links: z.object({ webui: z.string().optional() }).optional(),
  history: z.object({ lastUpdated: z.object({ when: z.string() }).optional() }).optional(),
});

const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  _links: z.object({ next: z.string().optional() }).optional(),
  start: z.number().optional(),
  limit: z.number().optional(),
  size: z.number().optional(),
});

type ConfluenceResult = z.infer<typeof searchResultSchema>;

/** Storage-format → plain text: drop tags, collapse whitespace, decode a handful of entities. */
function storageToText(input: string): string {
  const stripped = input.replace(/<[^>]+>/g, ' ');
  const decoded = stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/\s+/g, ' ').trim();
}

function lastModifiedOf(result: ConfluenceResult): string | undefined {
  return result.history?.lastUpdated?.when ?? result.version?.when;
}

function createConfluenceImporter(ctx: ImporterProviderContext) {
  return {
    id: 'confluence',
    access: ctx.access,
    triggers: {
      cron: {
        schedule: ctx.schedule,
        bindings: Object.keys(ctx.access).map(scope => ({ source: `confluence:${ctx.connection.id}`, scope })),
      },
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, CONFLUENCE_WATERMARK_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      const cql = previousWatermark
        ? `type=page and lastmodified >= "${previousWatermark}" order by lastmodified asc`
        : 'type=page order by lastmodified asc';

      let start = 0;
      let latestSeen: string | undefined;
      const processed: ConfluenceResult[] = [];
      const pageSize = 25;
      for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const parsed = searchResponseSchema.parse(
          await ctx.request({
            method: 'GET',
            path: 'wiki/rest/api/content/search',
            query: { cql, expand: 'body.storage,version,space,history.lastUpdated', start, limit: pageSize },
          }),
        );
        for (const result of parsed.results) processed.push(result);
        if (parsed.results.length === 0 || !parsed._links?.next) break;
        start += parsed.results.length;
        if (processed.length >= DEFAULT_MAX_RECORDS_PER_RUN) break;
      }

      for (const result of processed) {
        if (context.signal.aborted) return;
        const address = `confluence:page:${result.id}`;
        const lastModified = lastModifiedOf(result);
        if (result.status === 'trashed' || result.status === 'deleted') {
          if (!canRemove) continue;
          const existing = await importer.getNode(address);
          if (!existing) continue;
          const records = await existing.listRecords();
          for (const record of records) await existing.removeRecord(record.id);
          continue;
        }
        const bodyText = storageToText(result.body?.storage?.value ?? '');
        const title = result.title || 'Untitled';
        const recordPayload = {
          address,
          title,
          bodyText,
          version: result.version?.number,
          lastModified,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, { name: title, kind: 'connect:confluence:page' });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(bodyText ? `${title}\n\n${bodyText}` : title),
            metadata: {
              spaceKey: result.space?.key,
              version: result.version?.number,
              url: result._links?.webui,
            },
          });
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (previous.id !== recordId) await node.removeRecord(previous.id);
          }
        }
        if (lastModified && (!latestSeen || lastModified > latestSeen)) latestSeen = lastModified;
      }

      if (latestSeen) await writeWatermark(context.state, CONFLUENCE_WATERMARK_KEY, latestSeen);
    },
  };
}

export const confluenceImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'confluence',
  envVar: 'MASTRA_CONFLUENCE_CONNECTION_ID',
  defaultSchedule: '0 * * * *',
  createImporter: createConfluenceImporter,
};
