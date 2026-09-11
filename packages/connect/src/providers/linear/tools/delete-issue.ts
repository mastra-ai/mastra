// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteIssueInputSchema = z.object({
  id: z.string().describe('The identifier of the issue to delete. Example: "3e03fa02-a23a-40ac-93f4-bbdfd6120caf"'),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      issueDelete: z
        .object({
          success: z.boolean(),
          lastSyncId: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        path: z.array(z.string()).optional(),
        extensions: z
          .object({
            code: z.string().optional(),
            userPresentableMessage: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export const deleteIssueOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

export function deleteIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_delete_issue',
    description: 'Delete a Linear issue.',
    inputSchema: deleteIssueInputSchema,
    outputSchema: deleteIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: `
                    mutation IssueDelete($id: String!) {
                        issueDelete(id: $id) {
                            success
                            lastSyncId
                        }
                    }
                `,
          variables: {
            id: input.id,
          },
        },
        retries: 3,
      });

      const parsed = GraphQLResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Linear API',
          details: parsed.error.message,
        });
      }

      const issueDelete = parsed.data.data?.issueDelete;
      if (!issueDelete || !issueDelete.success) {
        const errorMessage = parsed.data.errors?.[0]?.message ?? 'Failed to delete the issue';
        throw new platformProxy.ActionError({
          type: 'deletion_failed',
          message: errorMessage,
          issue_id: input.id,
        });
      }

      return {
        success: issueDelete.success,
        id: input.id,
      };
    },
  });
}
