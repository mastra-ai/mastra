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

const JIRA_WATERMARK_KEY = 'jira:watermark';

/**
 * Jira JQL accepts `"yyyy-MM-dd HH:mm"` for date literals — not ISO 8601 with T or timezone.
 * The stored watermark keeps Jira's own format for round-tripping, but the JQL literal is
 * derived from a Date parse. Round DOWN to the minute (JQL granularity) and re-issue the
 * boundary inclusively so the record whose timestamp matches the minute isn't skipped.
 */
function jqlDateLiteral(watermark: string): string {
  const parsed = new Date(watermark);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Jira importer: cannot parse stored watermark '${watermark}' as a date`);
  }
  // Truncate to minute; JQL's `updated >=` is inclusive at the granularity given.
  const iso = parsed.toISOString(); // e.g. 2026-09-02T10:00:00.123Z
  const yyyyMmDd = iso.slice(0, 10);
  const hhmm = iso.slice(11, 16);
  return `${yyyyMmDd} ${hhmm}`;
}

const issueSchema = z.object({
  id: z.string().nullish(),
  key: z.string(),
  self: z.string().nullish(),
  fields: z
    .object({
      summary: z.string().nullish(),
      description: z.string().nullish(),
      status: z.object({ name: z.string().nullish() }).nullish(),
      project: z.object({ key: z.string().nullish(), name: z.string().nullish() }).nullish(),
      updated: z.string(),
    })
    .passthrough(),
});

const searchResponseSchema = z.object({
  issues: z.array(issueSchema),
  startAt: z.number().nullish(),
  maxResults: z.number().nullish(),
  total: z.number().nullish(),
});

type JiraIssue = z.infer<typeof issueSchema>;

function createJiraImporter(ctx: ImporterProviderContext) {
  return {
    id: 'jira',
    access: ctx.access,
    triggers: {
      cron: importerCronTrigger(`jira:${ctx.connection.id}`, ctx),
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, JIRA_WATERMARK_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      const jql = previousWatermark
        ? `updated >= "${jqlDateLiteral(previousWatermark)}" ORDER BY updated ASC`
        : 'ORDER BY updated ASC';

      const collected: JiraIssue[] = [];
      let startAt = 0;
      const pageSize = 50;
      for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const parsed = searchResponseSchema.parse(
          await ctx.request({
            method: 'GET',
            path: 'rest/api/3/search',
            query: {
              jql,
              fields: 'summary,description,status,project,updated',
              startAt,
              maxResults: pageSize,
            },
          }),
        );
        for (const issue of parsed.issues) collected.push(issue);
        if (parsed.issues.length < pageSize) break;
        startAt += parsed.issues.length;
        if (collected.length >= DEFAULT_MAX_RECORDS_PER_RUN) break;
      }

      let latestSeen: string | undefined;
      for (const issue of collected) {
        if (context.signal.aborted) return;
        const address = `jira:issue:${issue.key}`;
        const title = issue.fields.summary ?? issue.key;
        const description = issue.fields.description ?? '';
        const updated = issue.fields.updated;
        const recordPayload = {
          address,
          title,
          description,
          updated,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, { name: title, kind: 'connect:jira:issue' });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(description ? `${title}\n\n${description}` : title),
            metadata: {
              key: issue.key,
              status: issue.fields.status?.name,
              project: issue.fields.project?.key ?? issue.fields.project?.name,
              url: issue.self,
            },
          });
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (previous.id !== recordId) await node.removeRecord(previous.id);
          }
        }
        if (!latestSeen || updated > latestSeen) latestSeen = updated;
      }

      if (latestSeen) await writeWatermark(context.state, JIRA_WATERMARK_KEY, latestSeen);
    },
  };
}

export const jiraImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'jira',
  envVar: 'MASTRA_JIRA_CONNECTION_ID',
  defaultSchedule: '*/30 * * * *',
  createImporter: createJiraImporter,
};
