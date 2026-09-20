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

const LINEAR_WATERMARK_KEY = 'linear:watermark';

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
      cron: {
        schedule: ctx.schedule,
        bindings: Object.keys(ctx.access).map(scope => ({ source: `linear:${ctx.connection.id}`, scope })),
      },
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, LINEAR_WATERMARK_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      const collected: LinearIssue[] = [];
      let cursor: string | undefined;

      await walkPages(
        { signal: context.signal, maxRecords: DEFAULT_MAX_RECORDS_PER_RUN, maxPages: DEFAULT_MAX_PAGES_PER_RUN },
        async () => {
          const variables: Record<string, unknown> = { after: cursor };
          if (previousWatermark) {
            variables.filter = { updatedAt: { gte: previousWatermark } };
          }
          const parsed = issuesResponseSchema.parse(
            await ctx.request({
              method: 'POST',
              path: 'graphql',
              body: { query: ISSUES_QUERY, variables },
            }),
          );
          for (const issue of parsed.data.issues.nodes) collected.push(issue);
          if (!parsed.data.issues.pageInfo.hasNextPage || !parsed.data.issues.pageInfo.endCursor) return undefined;
          cursor = parsed.data.issues.pageInfo.endCursor;
          return { pageIndex: 0 };
        },
        async ({ recordsProcessed }) => recordsProcessed,
      );

      // Oldest-first so a mid-run failure leaves the watermark low.
      collected.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

      let latestSeen: string | undefined;
      for (const issue of collected) {
        if (context.signal.aborted) return;
        const address = `linear:issue:${issue.id}`;
        const archived = Boolean(issue.archivedAt || issue.trashed);
        if (archived) {
          if (!canRemove) continue;
          const existing = await importer.getNode(address);
          if (!existing) continue;
          const records = await existing.listRecords();
          for (const record of records) await existing.removeRecord(record.id);
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
        if (!latestSeen || issue.updatedAt > latestSeen) latestSeen = issue.updatedAt;
      }

      if (latestSeen) await writeWatermark(context.state, LINEAR_WATERMARK_KEY, latestSeen);
    },
  };
}

export const linearImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'linear',
  envVar: 'MASTRA_LINEAR_CONNECTION_ID',
  defaultSchedule: '*/30 * * * *',
  createImporter: createLinearImporter,
};
