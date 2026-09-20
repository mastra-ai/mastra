import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import {
  boundText,
  clearHighWater,
  clearResumeCursor,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  importerCronTrigger,
  readHighWater,
  readResumeCursor,
  readWatermark,
  writeHighWater,
  writeResumeCursor,
  writeWatermark,
} from '../../importer-runtime.js';

const LINEAR_WATERMARK_KEY = 'linear:watermark';
const LINEAR_RESUME_CURSOR_KEY = 'linear:resume-cursor';
const LINEAR_HIGH_WATER_KEY = 'linear:high-water';

const issueSchema = z.object({
  id: z.string(),
  identifier: z.string().optional(),
  title: z.string().default(''),
  description: z.string().nullish(),
  url: z.string().optional(),
  updatedAt: z.string(),
  archivedAt: z.string().nullish(),
  trashed: z.boolean().optional(),
  state: z.object({ name: z.string().optional() }).nullish(),
  team: z.object({ key: z.string().optional(), name: z.string().optional() }).nullish(),
});

const issuesResponseSchema = z.object({
  data: z.object({
    issues: z.object({
      nodes: z.array(issueSchema),
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        endCursor: z.string().nullish(),
      }),
    }),
  }),
});

type LinearIssue = z.infer<typeof issueSchema>;

const ISSUES_QUERY = `
query Issues($filter: IssueFilter, $after: String) {
  issues(filter: $filter, orderBy: updatedAt, first: 50, after: $after) {
    nodes {
      id
      identifier
      title
      description
      url
      updatedAt
      archivedAt
      trashed
      state { name }
      team { key name }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

function createLinearImporter(ctx: ImporterProviderContext) {
  return {
    id: 'linear',
    access: ctx.access,
    triggers: {
      cron: importerCronTrigger(`linear:${ctx.connection.id}`, ctx),
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, LINEAR_WATERMARK_KEY);
      const resumeCursor = await readResumeCursor(context.state, LINEAR_RESUME_CURSOR_KEY);
      const persistedHighWater = await readHighWater(context.state, LINEAR_HIGH_WATER_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      // Linear's default orderBy: updatedAt walks newest→oldest. On truncation
      // (maxPages/maxRecords) we persist endCursor so the next run resumes further into
      // the tail. Only when the source exhausts pagination do we advance the watermark
      // and clear the resume cursor.
      const collected: LinearIssue[] = [];
      let cursor: string | undefined = resumeCursor;
      let nextCursorAfterLastPage: string | undefined;
      let drainedFully = false;
      // Track the newest timestamp across the raw API responses, before ASC sort — needed to
      // prevent the watermark regressing on a drain run that resumed from a cursor. Seeded
      // from the persisted high-water so the drain writes the true high across the backfill.
      let newestObserved: string | undefined = persistedHighWater;
      for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const variables: Record<string, unknown> = { after: cursor };
        if (previousWatermark) variables.filter = { updatedAt: { gte: previousWatermark } };
        const parsed = issuesResponseSchema.parse(
          await ctx.request({
            method: 'POST',
            path: 'graphql',
            body: { query: ISSUES_QUERY, variables },
          }),
        );
        for (const issue of parsed.data.issues.nodes) {
          if (!newestObserved || issue.updatedAt > newestObserved) newestObserved = issue.updatedAt;
          collected.push(issue);
        }
        if (!parsed.data.issues.pageInfo.hasNextPage || !parsed.data.issues.pageInfo.endCursor) {
          drainedFully = true;
          break;
        }
        cursor = parsed.data.issues.pageInfo.endCursor;
        nextCursorAfterLastPage = parsed.data.issues.pageInfo.endCursor;
        if (collected.length >= DEFAULT_MAX_RECORDS_PER_RUN) break;
      }

      // Oldest-first so a mid-run failure leaves the watermark low.
      collected.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

      let lastProcessed: string | undefined;
      for (const issue of collected) {
        if (context.signal.aborted) return;
        const address = `linear:issue:${issue.id}`;
        const archived = Boolean(issue.archivedAt || issue.trashed);
        if (archived) {
          if (canRemove) {
            const existing = await importer.getNode(address);
            if (existing) {
              const records = await existing.listRecords();
              for (const record of records) await existing.removeRecord(record.id);
            }
          }
          lastProcessed = issue.updatedAt;
          continue;
        }
        const title = issue.title || issue.identifier || issue.id;
        const description = issue.description ?? '';
        const recordPayload = {
          address,
          title,
          description,
          updatedAt: issue.updatedAt,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, { name: title, kind: 'connect:linear:issue' });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(description ? `${title}\n\n${description}` : title),
            metadata: {
              identifier: issue.identifier,
              state: issue.state?.name,
              team: issue.team?.key ?? issue.team?.name,
              url: issue.url,
            },
          });
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (previous.id !== recordId) await node.removeRecord(previous.id);
          }
        }
        lastProcessed = issue.updatedAt;
      }

      if (drainedFully && (lastProcessed || newestObserved)) {
        const candidate =
          newestObserved && (!previousWatermark || newestObserved > previousWatermark)
            ? newestObserved
            : previousWatermark;
        await clearResumeCursor(context.state, LINEAR_RESUME_CURSOR_KEY);
        await clearHighWater(context.state, LINEAR_HIGH_WATER_KEY);
        if (candidate) await writeWatermark(context.state, LINEAR_WATERMARK_KEY, candidate);
      } else if (!drainedFully && nextCursorAfterLastPage) {
        await writeResumeCursor(context.state, LINEAR_RESUME_CURSOR_KEY, nextCursorAfterLastPage);
        if (newestObserved) await writeHighWater(context.state, LINEAR_HIGH_WATER_KEY, newestObserved);
      }
    },
  };
}

export const linearImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'linear',
  envVar: 'MASTRA_LINEAR_CONNECTION_ID',
  defaultSchedule: '*/30 * * * *',
  createImporter: createLinearImporter,
};
