// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addCommentInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue to add the comment to. Example: "PROJ-123" or "10001"'),
  body: z.string().describe('The plain text content of the comment to add.'),
});

const ProviderCommentSchema = z.object({
  id: z.string(),
  self: z.string(),
  author: z
    .object({
      accountId: z.string(),
      displayName: z.string(),
      emailAddress: z.string().optional(),
    })
    .passthrough()
    .optional(),
  body: z.object({}).passthrough(),
  created: z.string().optional(),
  updated: z.string().optional(),
  jsdPublic: z.boolean().optional(),
});

export const addCommentOutputSchema = z.object({
  id: z.string().describe('The ID of the created comment.'),
  self: z.string().describe('The REST API URL of the comment.'),
  author: z
    .object({
      accountId: z.string(),
      displayName: z.string(),
      emailAddress: z.string().optional(),
    })
    .optional(),
  created: z.string().optional().describe('When the comment was created.'),
  updated: z.string().optional().describe('When the comment was last updated.'),
});

export function addCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_add_comment',
    description: 'Add a comment to a Jira issue.',
    inputSchema: addCommentInputSchema,
    outputSchema: addCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Resolve cloudId from connection config or metadata
      const connection = await platformProxy.getConnection();
      let cloudId = connection.connection_config?.['cloudId'];
      let baseUrl = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string; baseUrl?: string }>();
        cloudId = cloudId || metadata?.cloudId;
        baseUrl = baseUrl || metadata?.baseUrl;
      }

      if (!cloudId) {
        // Discover cloudId via accessible-resources endpoint
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#other-integrations
        const discoveryResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z
          .array(
            z.object({
              id: z.string(),
              url: z.string(),
              name: z.string(),
            }),
          )
          .parse(discoveryResponse.data);

        if (resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection.',
          });
        }

        const discoveredCloudId = resources[0]?.id;
        const discoveredBaseUrl = resources[0]?.url;
        if (!discoveredCloudId) {
          throw new platformProxy.ActionError({
            type: 'invalid_resource',
            message: 'Accessible resource missing required id field.',
          });
        }

        cloudId = discoveredCloudId;
        baseUrl = discoveredBaseUrl;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Could not determine Jira cloud ID.',
        });
      }

      // Build Atlassian Document Format body
      const adfBody = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: input.body,
              },
            ],
          },
        ],
      };

      // POST /rest/api/3/issue/{issueIdOrKey}/comment
      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-post
      const response = await platformProxy.post({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/comment`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        data: {
          body: adfBody,
        },
        retries: 1,
      });

      const comment = ProviderCommentSchema.parse(response.data);

      return {
        id: comment.id,
        self: comment.self,
        ...(comment.author && {
          author: {
            accountId: comment.author.accountId,
            displayName: comment.author.displayName,
            ...(comment.author.emailAddress && { emailAddress: comment.author.emailAddress }),
          },
        }),
        ...(comment.created && { created: comment.created }),
        ...(comment.updated && { updated: comment.updated }),
      };
    },
  });
}
