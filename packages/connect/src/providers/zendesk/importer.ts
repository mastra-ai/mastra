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

// Namespaced under `articles` — earlier revisions synced tickets under
// `zendesk:cursor`, and that opaque ticket cursor is meaningless here.
const ZENDESK_WATERMARK_KEY = 'zendesk:articles:watermark';

// Zendesk tickets are operational work — not knowledge. This importer syncs
// Help Center (Guide) articles: the durable, document-shaped content in a
// Zendesk instance.
const articleSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  body: z.string().nullish(),
  draft: z.boolean().nullish(),
  locale: z.string().nullish(),
  section_id: z.union([z.number(), z.string()]).nullish(),
  updated_at: z.string().nullish(),
  html_url: z.string().nullish(),
});

const incrementalArticlesSchema = z.object({
  articles: z.array(articleSchema),
  end_time: z.number().nullish(),
  next_page: z.string().nullish(),
});

type ZendeskArticle = z.infer<typeof articleSchema>;

/** Maximum section-list pages fetched per run (sections are few; 10 × 100 is generous). */
export const MAX_SECTION_PAGES = 10;

const sectionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().nullish(),
});

const sectionsResponseSchema = z.object({
  sections: z.array(sectionSchema).default([]),
  next_page: z.string().nullish(),
  meta: z.object({ has_more: z.boolean().nullish(), after_cursor: z.string().nullish() }).nullish(),
});

/**
 * Fetches Help Center sections once per run, bounded by `MAX_SECTION_PAGES`.
 * Returns `undefined` on any failure — the run then imports NEW articles
 * without section containers or `in` links, while sectioned articles that
 * already have a record are left untouched (a transient outage must never
 * replace a good record with one missing its containment link).
 */
async function fetchSectionNames(
  ctx: ImporterProviderContext,
  signal: AbortSignal,
): Promise<Map<string, string> | undefined> {
  const names = new Map<string, string>();
  try {
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < MAX_SECTION_PAGES; pageIndex++) {
      if (signal.aborted) break;
      const query: Record<string, string | number> = { 'page[size]': 100 };
      if (cursor) query['page[after]'] = cursor;
      const parsed = sectionsResponseSchema.parse(
        await ctx.request({ method: 'GET', path: 'api/v2/help_center/sections.json', query }),
      );
      for (const section of parsed.sections) {
        const name = section.name?.trim();
        if (name) names.set(String(section.id), name);
      }
      const after = parsed.meta?.after_cursor ?? undefined;
      if (!parsed.meta?.has_more || !after) break;
      cursor = after;
    }
    return names;
  } catch {
    return undefined;
  }
}

/** Help Center article hrefs, e.g. `/hc/en-us/articles/123456-some-slug`. */
const ARTICLE_HREF_PATTERN = /<a\b[^>]*href="[^"]*\/hc\/[^"]*\/articles\/(\d+)[^"]*"/gi;

/** Extract article→article reference links from raw HTML, before tags are stripped. */
function extractArticleLinks(html: string): RecordLink[] {
  const links: RecordLink[] = [];
  for (const match of html.matchAll(ARTICLE_HREF_PATTERN)) {
    links.push({ address: `zendesk:article:${match[1]}`, rel: 'references' });
  }
  return links;
}

/** Strip HTML tags from article bodies — enough for semantic search, no DOM needed. */
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function createZendeskImporter(ctx: ImporterProviderContext) {
  return {
    id: 'zendesk',
    access: ctx.access,
    triggers: {
      cron: importerCronTrigger(`zendesk:${ctx.connection.id}`, ctx),
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, ZENDESK_WATERMARK_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      // Help Center's incremental articles export is time-based: each page
      // returns articles updated since start_time plus an end_time to use as
      // the next start_time. When end_time stops advancing (or no articles
      // return), the export is drained.
      const collected: ZendeskArticle[] = [];
      let startTime = previousWatermark ? Number(previousWatermark) : 0;
      if (!Number.isFinite(startTime) || startTime < 0) startTime = 0;
      let lastEndTime: number | undefined;
      for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const parsed = incrementalArticlesSchema.parse(
          await ctx.request({
            method: 'GET',
            path: 'api/v2/help_center/incremental/articles.json',
            query: { start_time: startTime },
          }),
        );
        for (const article of parsed.articles) collected.push(article);
        const endTime = parsed.end_time ?? undefined;
        if (endTime !== undefined && endTime > startTime) lastEndTime = endTime;
        // Drained: nothing new, no forward progress, or no continuation page.
        if (parsed.articles.length === 0 || endTime === undefined || endTime <= startTime || !parsed.next_page) break;
        startTime = endTime;
        if (collected.length >= DEFAULT_MAX_RECORDS_PER_RUN) break;
      }

      // Section names resolve container nodes and `in` links. Fetched once per
      // run, only when there's something to import; on failure articles still
      // import (no containers, no `in` links this run).
      const nonDraft = collected.filter(article => !article.draft);
      const sectionNames =
        nonDraft.length > 0 ? await fetchSectionNames(ctx, context.signal) : new Map<string, string>();
      const upsertedSections = new Set<string>();

      for (const article of collected) {
        if (context.signal.aborted) return;
        const address = `zendesk:article:${article.id}`;
        if (article.draft) {
          // Drafts aren't published knowledge — remove any previously
          // published records when an article moves back to draft.
          if (!canRemove) continue;
          const existing = await importer.getNode(address);
          if (!existing) continue;
          const records = await existing.listRecords();
          for (const record of records) await existing.removeRecord(record.id);
          continue;
        }
        const title = article.title ?? `Article #${article.id}`;
        const rawHtml = article.body ?? '';
        // Links live in the HTML — extract BEFORE tags are stripped.
        const links: RecordLink[] = extractArticleLinks(rawHtml);
        const sectionId = article.section_id != null ? String(article.section_id) : undefined;
        const sectionName = sectionId ? sectionNames?.get(sectionId) : undefined;
        if (sectionId && sectionName) {
          const sectionAddress = `zendesk:section:${sectionId}`;
          if (!upsertedSections.has(sectionAddress)) {
            upsertedSections.add(sectionAddress);
            const sectionNode = await importer.upsertNode(sectionAddress, {
              name: sectionName,
              kind: 'connect:zendesk:section',
              metadata: nodeSelfMetadata(sectionAddress),
            });
            const sectionRecordId = contentRecordId({ address: sectionAddress, name: sectionName });
            const sectionRecords = await sectionNode.listRecords();
            if (!sectionRecords.some(r => r.id === sectionRecordId)) {
              await sectionNode.appendRecord({
                id: sectionRecordId,
                text: neutralizeWikilinks(sectionName),
                metadata: { sectionId },
              });
            }
            if (canRemove) {
              for (const previous of sectionRecords) {
                if (previous.id !== sectionRecordId) await sectionNode.removeRecord(previous.id);
              }
            }
          }
          links.push({ address: sectionAddress, rel: 'in' });
        }
        const linkMeta = linksMetadata(links.filter(link => link.address !== address));
        const body = stripHtml(rawHtml);
        const recordPayload = {
          address,
          title,
          body,
          links: linkMeta.links ?? [],
          updatedAt: article.updated_at,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, {
          name: title,
          kind: 'connect:zendesk:article',
          metadata: nodeSelfMetadata(address),
        });
        const existingRecords = await node.listRecords();
        // Sections fetch failed and this article belongs to a section: its
        // computed record is missing the `in` link. Never replace an existing
        // good record with the degraded one — keep what we have; the article
        // re-records on its next edit or a later run with sections available.
        if (sectionNames === undefined && sectionId && existingRecords.length > 0) continue;
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(neutralizeWikilinks(body ? `${title}\n\n${body}` : title)),
            metadata: {
              locale: article.locale,
              updatedAt: article.updated_at,
              url: article.html_url,
              ...linkMeta,
            },
          });
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (previous.id !== recordId) await node.removeRecord(previous.id);
          }
        }
      }

      // The runner's pending-state batching commits this only if the handler
      // returns cleanly, so a mid-run failure re-reads the old window.
      if (lastEndTime !== undefined) {
        await writeWatermark(context.state, ZENDESK_WATERMARK_KEY, String(lastEndTime));
      }
    },
  };
}

export const zendeskImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'zendesk',
  envVar: 'MASTRA_ZENDESK_CONNECTION_ID',
  defaultSchedule: '*/30 * * * *',
  createImporter: createZendeskImporter,
};
