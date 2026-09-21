import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import type { RecordLink } from '../../importer-runtime.js';
import {
  boundText,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  importerCronTrigger,
  linksMetadata,
  neutralizeWikilinks,
  nodeSelfMetadata,
  readWatermark,
  writeWatermark,
} from '../../importer-runtime.js';

const CONFLUENCE_WATERMARK_KEY = 'confluence:watermark';

const searchResultSchema = z.object({
  id: z.string(),
  type: z.string().nullish(),
  title: z.string().default(''),
  status: z.string().nullish(),
  version: z.object({ number: z.number(), when: z.string().nullish() }).nullish(),
  space: z.object({ key: z.string().nullish() }).nullish(),
  body: z
    .object({
      storage: z.object({ value: z.string().default('') }).nullish(),
    })
    .nullish(),
  _links: z.object({ webui: z.string().nullish() }).nullish(),
  history: z.object({ lastUpdated: z.object({ when: z.string() }).nullish() }).nullish(),
  ancestors: z.array(z.object({ id: z.string(), title: z.string().nullish() })).nullish(),
});

const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  _links: z.object({ next: z.string().nullish() }).nullish(),
  start: z.number().nullish(),
  limit: z.number().nullish(),
  size: z.number().nullish(),
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
  return result.history?.lastUpdated?.when ?? result.version?.when ?? undefined;
}

/** `<ri:page .../>` elements inside storage-format `<ac:link>` bodies. */
const RI_PAGE_PATTERN = /<ri:page\b[^>]*>/gi;

function riAttribute(tag: string, attribute: string): string | undefined {
  const match = new RegExp(`${attribute}="([^"]*)"`, 'i').exec(tag);
  const value = match?.[1]?.trim();
  return value || undefined;
}

/**
 * Extracts cross-page reference links from storage-format markup. Must run
 * BEFORE `storageToText` strips tags. `ri:content-id` gives a stable address;
 * title-only links fall back to name resolution in the graph route.
 */
function extractStorageLinks(storage: string): RecordLink[] {
  const links: RecordLink[] = [];
  for (const [tag] of storage.matchAll(RI_PAGE_PATTERN)) {
    const contentId = riAttribute(tag, 'ri:content-id');
    if (contentId) {
      links.push({ address: `confluence:page:${contentId}`, rel: 'references' });
      continue;
    }
    const title = riAttribute(tag, 'ri:content-title');
    if (title) links.push({ name: title, rel: 'references' });
  }
  return links;
}

function createConfluenceImporter(ctx: ImporterProviderContext) {
  return {
    id: 'confluence',
    access: ctx.access,
    triggers: {
      cron: importerCronTrigger(`confluence:${ctx.connection.id}`, ctx),
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
            query: { cql, expand: 'body.storage,version,space,history.lastUpdated,ancestors', start, limit: pageSize },
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
        const storage = result.body?.storage?.value ?? '';
        // Links live in storage-format markup — extract BEFORE tags are stripped.
        const links: RecordLink[] = extractStorageLinks(storage);
        // Direct parent = last ancestor (ancestors are ordered root → parent).
        const parent = result.ancestors?.at(-1);
        if (parent) links.push({ address: `confluence:page:${parent.id}`, rel: 'child-of' });
        const linkMeta = linksMetadata(links.filter(link => link.address !== address));
        const bodyText = storageToText(storage);
        const title = result.title || 'Untitled';
        const recordPayload = {
          address,
          title,
          bodyText,
          links: linkMeta.links ?? [],
          version: result.version?.number,
          lastModified,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, {
          name: title,
          kind: 'connect:confluence:page',
          metadata: nodeSelfMetadata(address),
        });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(neutralizeWikilinks(bodyText ? `${title}\n\n${bodyText}` : title)),
            metadata: {
              spaceKey: result.space?.key,
              version: result.version?.number,
              url: result._links?.webui,
              ...linkMeta,
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
