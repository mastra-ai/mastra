// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listIssueCommentsInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "10001" or "PROJ-123"'),
  startAt: z.number().optional().describe('The index of the first item to return in a page of results. Example: 0'),
  maxResults: z.number().optional().describe('The maximum number of items to return per page. Example: 50'),
  orderBy: z
    .enum(['created', '-created', 'updated', '-updated'])
    .optional()
    .describe('Order comments by created or updated date. Use - prefix for descending order.'),
  expand: z
    .string()
    .optional()
    .describe('A comma-separated list of fields to expand in the response. Example: "renderedBody"'),
});

const AuthorSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  active: z.boolean().optional(),
  self: z.string().optional(),
});

const VisibilitySchema = z
  .object({
    type: z.string(),
    value: z.string().optional(),
    identifier: z.string().optional(),
  })
  .optional();

const CommentSchema = z.object({
  id: z.string(),
  author: AuthorSchema.optional(),
  body: z.unknown().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  updateAuthor: AuthorSchema.optional(),
  self: z.string().optional(),
  visibility: VisibilitySchema,
});

export const listIssueCommentsOutputSchema = z.object({
  comments: z.array(CommentSchema),
  maxResults: z.number(),
  startAt: z.number(),
  total: z.number(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export function listIssueCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_issue_comments',
    description: 'List comments on a Jira issue with pagination',
    inputSchema: listIssueCommentsInputSchema,
    outputSchema: listIssueCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIssueCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      let cloudId = connection.connection_config?.['cloudId'];
      let baseUrl = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata();
        cloudId = metadata?.cloudId;
        baseUrl = metadata?.baseUrl;
      }

      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#oauth-2-0--3lo-
        const response = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        const resource = response.data[0];
        if (resource.id && typeof resource.id === 'string') {
          cloudId = resource.id;
        }
        if (resource.url && typeof resource.url === 'string') {
          baseUrl = resource.url;
        }

        if (cloudId && baseUrl) {
          await platformProxy.updateMetadata({
            cloudId,
            baseUrl,
          });
        }
      }

      const params: Record<string, string | number> = {};
      if (input.startAt !== undefined) {
        params['startAt'] = input.startAt;
      }
      if (input.maxResults !== undefined) {
        params['maxResults'] = input.maxResults;
      }
      if (input.orderBy !== undefined) {
        params['orderBy'] = input.orderBy;
      }
      if (input.expand !== undefined) {
        params['expand'] = input.expand;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/comment`,
        params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'no_data',
          message: 'No data returned from Jira API',
        });
      }

      if (typeof response.data !== 'object' || response.data === null) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Jira API',
        });
      }

      const data = response.data;
      const comments = Array.isArray(data.comments) ? data.comments : [];
      const maxResults = typeof data.maxResults === 'number' ? data.maxResults : 0;
      const startAt = typeof data.startAt === 'number' ? data.startAt : 0;
      const total = typeof data.total === 'number' ? data.total : 0;

      return {
        comments,
        maxResults,
        startAt,
        total,
      };
    },
  });
}
