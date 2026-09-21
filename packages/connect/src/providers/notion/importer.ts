import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import type { RecordLink } from '../../importer-runtime.js';
import {
  boundText,
  clearHighWater,
  clearResumeCursor,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  importerCronTrigger,
  linksMetadata,
  neutralizeWikilinks,
  nodeSelfMetadata,
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

/** Maximum block-children requests per Notion page per run (≤100 blocks each), shared across nesting levels. */
export const MAX_BLOCK_REQUESTS_PER_ENTITY = 8;

/** Maximum nesting depth followed into `has_children` blocks (columns, toggles, tables, …). */
const MAX_BLOCK_DEPTH = 3;

const richTextItemSchema = z.object({
  plain_text: z.string().default(''),
});

const parentSchema = z
  .object({
    type: z.string(),
    page_id: z.string().nullish(),
    database_id: z.string().nullish(),
  })
  .passthrough();

const titlePropertySchema = z
  .object({ type: z.literal('title'), title: z.array(richTextItemSchema).default([]) })
  .passthrough();

const genericPropertySchema = z.object({ type: z.string() }).passthrough();

const propertySchema = z.union([titlePropertySchema, genericPropertySchema]);

const pageResultSchema = z.object({
  object: z.literal('page'),
  id: z.string(),
  archived: z.boolean().nullish(),
  in_trash: z.boolean().nullish(),
  url: z.string().nullish(),
  last_edited_time: z.string(),
  parent: parentSchema.nullish(),
  properties: z.record(z.string(), propertySchema).default({}),
});

const databaseResultSchema = z.object({
  object: z.literal('database'),
  id: z.string(),
  archived: z.boolean().nullish(),
  in_trash: z.boolean().nullish(),
  url: z.string().nullish(),
  last_edited_time: z.string(),
  parent: parentSchema.nullish(),
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

const blockRichTextItemSchema = z
  .object({
    plain_text: z.string().default(''),
    href: z.string().nullish(),
    mention: z
      .object({
        type: z.string(),
        page: z.object({ id: z.string() }).nullish(),
        database: z.object({ id: z.string() }).nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const blockSchema = z
  .object({
    type: z.string(),
    id: z.string().nullish(),
    has_children: z.boolean().nullish(),
    link_to_page: z
      .object({
        type: z.string().nullish(),
        page_id: z.string().nullish(),
        database_id: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const blockChildrenResponseSchema = z.object({
  results: z.array(blockSchema).default([]),
  has_more: z.boolean().default(false),
  next_cursor: z.string().nullish(),
});

type NotionBlock = z.infer<typeof blockSchema>;

/** Block types whose rich text becomes record body text. */
const TEXT_BLOCK_TYPES = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'quote',
  'callout',
  'toggle',
  'to_do',
  'code',
  'table_row',
]);

/** Blocks whose children are separate entities (or opaque) — never descended into. */
const NO_RECURSE_BLOCK_TYPES = new Set(['child_page', 'child_database', 'unsupported']);

/** notion.so URL carrying a 32-hex-char page/database id (dashes optional). */
const NOTION_URL_ID_PATTERN =
  /notion\.so\/(?:[^\s"')]*-)?([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i;

/** Normalize a Notion id to the canonical dashed UUID form used by the search API. */
function normalizeNotionId(id: string): string {
  const hex = id.replaceAll('-', '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return id;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseRichTextArray(raw: unknown): z.infer<typeof blockRichTextItemSchema>[] {
  if (!Array.isArray(raw)) return [];
  const items: z.infer<typeof blockRichTextItemSchema>[] = [];
  for (const item of raw) {
    const parsed = blockRichTextItemSchema.safeParse(item);
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

function richTextItems(block: NotionBlock): z.infer<typeof blockRichTextItemSchema>[] {
  const payload = (block as Record<string, unknown>)[block.type];
  if (!payload || typeof payload !== 'object') return [];
  if (block.type === 'table_row') {
    // Table rows carry `cells: RichText[][]` instead of `rich_text`.
    const cells = (payload as Record<string, unknown>).cells;
    if (!Array.isArray(cells)) return [];
    return cells.flatMap(cell => parseRichTextArray(cell));
  }
  return parseRichTextArray((payload as Record<string, unknown>).rich_text);
}

interface BlockExtraction {
  readonly text: string;
  readonly links: RecordLink[];
}

/**
 * Extracts body text and cross-page reference links from a page's blocks.
 * `child_page`/`child_database` blocks are deliberately skipped — containment
 * is emitted one-directionally by the child via its `parent` field.
 */
function extractFromBlocks(blocks: readonly NotionBlock[]): BlockExtraction {
  const textParts: string[] = [];
  const links: RecordLink[] = [];
  const addLink = (object: 'page' | 'database', id: string) =>
    links.push({ address: `notion:${object}:${normalizeNotionId(id)}`, rel: 'references' });
  for (const block of blocks) {
    if (block.type === 'link_to_page' && block.link_to_page) {
      if (block.link_to_page.page_id) addLink('page', block.link_to_page.page_id);
      else if (block.link_to_page.database_id) addLink('database', block.link_to_page.database_id);
      continue;
    }
    const items = richTextItems(block);
    for (const item of items) {
      if (item.mention?.type === 'page' && item.mention.page?.id) addLink('page', item.mention.page.id);
      else if (item.mention?.type === 'database' && item.mention.database?.id)
        addLink('database', item.mention.database.id);
      else if (item.href) {
        const match = NOTION_URL_ID_PATTERN.exec(item.href);
        if (match?.[1]) addLink('page', match[1]);
      }
    }
    if (TEXT_BLOCK_TYPES.has(block.type)) {
      const text = items
        .map(item => item.plain_text)
        .join('')
        .trim();
      if (text) textParts.push(text);
    }
  }
  return { text: textParts.join('\n'), links };
}

/**
 * Bounded block fetch for one page: a depth-first walk that descends into
 * `has_children` blocks (columns, toggles, tables, …) so nested content is
 * captured. Bounded by a shared request budget (`MAX_BLOCK_REQUESTS_PER_ENTITY`)
 * and `MAX_BLOCK_DEPTH`; blocks are returned in document order. Returns
 * `undefined` on any fetch/parse failure — the caller degrades per-page
 * instead of failing the run.
 */
async function fetchPageBlocks(
  ctx: ImporterProviderContext,
  pageId: string,
  signal: AbortSignal,
): Promise<NotionBlock[] | undefined> {
  const blocks: NotionBlock[] = [];
  let requestsUsed = 0;
  const fetchChildren = async (blockId: string, depth: number): Promise<void> => {
    let cursor: string | undefined;
    do {
      if (signal.aborted || requestsUsed >= MAX_BLOCK_REQUESTS_PER_ENTITY) return;
      requestsUsed++;
      const query: Record<string, string | number> = { page_size: 100 };
      if (cursor) query.start_cursor = cursor;
      const parsed = blockChildrenResponseSchema.parse(
        await ctx.request({ method: 'GET', path: `v1/blocks/${blockId}/children`, query }),
      );
      for (const block of parsed.results) {
        blocks.push(block);
        if (block.has_children && block.id && depth < MAX_BLOCK_DEPTH && !NO_RECURSE_BLOCK_TYPES.has(block.type)) {
          await fetchChildren(block.id, depth + 1);
        }
      }
      cursor = parsed.has_more && parsed.next_cursor ? parsed.next_cursor : undefined;
    } while (cursor);
  };
  try {
    await fetchChildren(pageId, 0);
    return blocks;
  } catch {
    return undefined;
  }
}

/** Structure link toward the entity's parent page/database, if any. */
function parentLink(result: NotionSearchResult): RecordLink | undefined {
  const parent = result.parent;
  if (!parent) return undefined;
  if (parent.type === 'page_id' && parent.page_id)
    return { address: `notion:page:${normalizeNotionId(parent.page_id)}`, rel: 'child-of' };
  if (parent.type === 'database_id' && parent.database_id)
    return { address: `notion:database:${normalizeNotionId(parent.database_id)}`, rel: 'child-of' };
  return undefined;
}

function createNotionImporter(ctx: ImporterProviderContext) {
  return {
    id: 'notion',
    access: ctx.access,
    triggers: {
      cron: importerCronTrigger(`notion:${ctx.connection.id}`, ctx),
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
        const links: RecordLink[] = [];
        const parent = parentLink(result);
        if (parent) links.push(parent);

        // Page bodies (and in-content links) live in blocks, not search results.
        // A failed block fetch degrades per-page — it never fails the run.
        let blockText = '';
        let blockFetchFailed = false;
        if (result.object === 'page') {
          const blocks = await fetchPageBlocks(ctx, result.id, context.signal);
          if (blocks === undefined) {
            blockFetchFailed = true;
          } else {
            const extraction = extractFromBlocks(blocks);
            blockText = extraction.text;
            links.push(...extraction.links);
          }
        }

        const linkMeta = linksMetadata(links.filter(link => link.address !== address));
        const node = await importer.upsertNode(address, {
          name: title,
          kind: nodeKind(result),
          metadata: nodeSelfMetadata(address),
        });
        const existingRecords = await node.listRecords();
        if (blockFetchFailed && existingRecords.length > 0) {
          // Keep the existing good record rather than replace it with a degraded
          // title-only one — the page is revisited on its next edit.
          lastProcessed = result.last_edited_time;
          continue;
        }
        const recordPayload = {
          address,
          title,
          propertyText,
          blockText,
          links: linkMeta.links ?? [],
          lastEditedTime: result.last_edited_time,
        };
        const recordId = contentRecordId(recordPayload);
        if (!existingRecords.some(r => r.id === recordId)) {
          const bodyParts = [title];
          if (propertyText) bodyParts.push(propertyText);
          if (blockText) bodyParts.push(blockText);
          await node.appendRecord({
            id: recordId,
            text: boundText(neutralizeWikilinks(bodyParts.join('\n\n'))),
            metadata: { url: result.url, lastEditedTime: result.last_edited_time, ...linkMeta },
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
