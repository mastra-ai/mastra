// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteIssueRelationInputSchema = z.object({
  id: z.string().describe('The identifier of the issue relation to delete. Example: "abc123-def456"'),
});

const ProviderDeletePayloadSchema = z.object({
  success: z.boolean(),
  entityId: z.string().optional(),
  lastSyncId: z.number().optional(),
});

export const deleteIssueRelationOutputSchema = z.object({
  success: z.boolean(),
  entityId: z.string().optional(),
  lastSyncId: z.number().optional(),
});

export function deleteIssueRelationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_delete_issue_relation',
    description: 'Delete a relationship between two Linear issues.',
    inputSchema: deleteIssueRelationInputSchema,
    outputSchema: deleteIssueRelationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteIssueRelationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation IssueRelationDelete($id: String!) {
                        issueRelationDelete(id: $id) {
                            success
                            entityId
                            lastSyncId
                        }
                    }
                `,
          variables: {
            id: input.id,
          },
        },
        retries: 10,
      });

      const payload =
        typeof response.data === 'object' &&
        response.data !== null &&
        'data' in response.data &&
        typeof response.data.data === 'object' &&
        response.data.data !== null &&
        'issueRelationDelete' in response.data.data
          ? response.data.data.issueRelationDelete
          : undefined;

      if (!payload) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Unexpected response from Linear GraphQL API',
          response: response.data,
        });
      }

      const providerPayload = ProviderDeletePayloadSchema.parse(payload);

      return {
        success: providerPayload.success,
        ...(providerPayload.entityId !== undefined && { entityId: providerPayload.entityId }),
        ...(providerPayload.lastSyncId !== undefined && { lastSyncId: providerPayload.lastSyncId }),
      };
    },
  });
}
