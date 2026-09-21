import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import {
  boundText,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  importerCronTrigger,
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
  updated_at: z.string().nullish(),
  html_url: z.string().nullish(),
});

const incrementalArticlesSchema = z.object({
  articles: z.array(articleSchema),
  end_time: z.number().nullish(),
  next_page: z.string().nullish(),
});

type ZendeskArticle = z.infer<typeof articleSchema>;

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
        const body = stripHtml(article.body ?? '');
        const recordPayload = {
          address,
          title,
          body,
          updatedAt: article.updated_at,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, { name: title, kind: 'connect:zendesk:article' });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(body ? `${title}\n\n${body}` : title),
            metadata: {
              locale: article.locale,
              updatedAt: article.updated_at,
              url: article.html_url,
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
