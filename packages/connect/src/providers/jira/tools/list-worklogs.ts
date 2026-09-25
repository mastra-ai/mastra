// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listWorklogsInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "PROJ-123" or "10001"'),
  startAt: z.number().optional().describe('The index of the first item to return in a page of results. Default: 0'),
  maxResults: z.number().optional().describe('The maximum number of items to return per page. Default: 50'),
});

const AuthorSchema = z.object({
  accountId: z.string().optional(),
  accountType: z.string().optional(),
  active: z.boolean().optional(),
  avatarUrls: z.record(z.string(), z.string()).optional(),
  displayName: z.string().optional(),
  emailAddress: z.string().optional(),
  key: z.string().optional(),
  name: z.string().optional(),
  self: z.string().optional(),
  timeZone: z.string().optional(),
});

const VisibilitySchema = z.object({
  identifier: z.string().optional(),
  type: z.string().optional(),
  value: z.string().optional(),
});

const WorklogSchema = z.object({
  id: z.string(),
  issueId: z.string().optional(),
  author: AuthorSchema.optional(),
  updateAuthor: AuthorSchema.optional(),
  comment: z.unknown().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  started: z.string().optional(),
  timeSpent: z.string().optional(),
  timeSpentSeconds: z.number().optional(),
  visibility: VisibilitySchema.optional(),
  self: z.string().optional(),
});

export const listWorklogsOutputSchema = z.object({
  worklogs: z.array(WorklogSchema),
  total: z.number().optional(),
  startAt: z.number().optional(),
  maxResults: z.number().optional(),
  isLast: z.boolean().optional(),
});

export function listWorklogsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_worklogs',
    description: 'List worklogs on a Jira issue',
    inputSchema: listWorklogsInputSchema,
    outputSchema: listWorklogsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWorklogsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId = connection.connection_config?.['cloudId'];

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string; baseUrl?: string }>();
        cloudId = metadata?.cloudId;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'invalid_connection',
          message: 'Could not resolve cloudId from connection or metadata',
        });
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/#api-rest-api-3-issue-issueidorkey-worklog-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/worklog`,
        params: {
          ...(input.startAt !== undefined && { startAt: String(input.startAt) }),
          ...(input.maxResults !== undefined && { maxResults: String(input.maxResults) }),
        },
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      const PageOfWorklogsSchema = z.object({
        worklogs: z.array(z.unknown()).optional(),
        total: z.number().optional(),
        startAt: z.number().optional(),
        maxResults: z.number().optional(),
      });

      const parsedData = PageOfWorklogsSchema.parse(response.data);

      const worklogs = parsedData.worklogs || [];
      const startAt = parsedData.startAt ?? 0;
      const maxResults = parsedData.maxResults ?? worklogs.length;
      const total = parsedData.total ?? worklogs.length;

      const parsedWorklogs = worklogs
        .map((worklog: unknown) => {
          const parsed = WorklogSchema.safeParse(worklog);
          return parsed.success ? parsed.data : null;
        })
        .filter((w): w is z.infer<typeof WorklogSchema> => w !== null);

      return {
        worklogs: parsedWorklogs,
        total,
        startAt,
        maxResults,
        isLast: startAt + worklogs.length >= total,
      };
    },
  });
}
