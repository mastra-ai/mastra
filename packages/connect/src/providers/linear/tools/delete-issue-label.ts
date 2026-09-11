// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteIssueLabelInputSchema = z.object({
  labelId: z.string().describe('The ID of the issue label to delete. Example: "label-uuid"'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    issueLabelDelete: z.object({
      entityId: z.string(),
      lastSyncId: z.number(),
      success: z.boolean(),
    }),
  }),
});

export const deleteIssueLabelOutputSchema = z.object({
  success: z.boolean(),
  entityId: z.string().optional(),
  lastSyncId: z.number().optional(),
});

export function deleteIssueLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_delete_issue_label',
    description: 'Delete a Linear issue label.',
    inputSchema: deleteIssueLabelInputSchema,
    outputSchema: deleteIssueLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteIssueLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query:
            'mutation IssueLabelDelete($id: String!) { issueLabelDelete(id: $id) { entityId lastSyncId success } }',
          variables: {
            id: input.labelId,
          },
        },
        retries: 10,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      if (!providerResponse.data.issueLabelDelete.success) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: 'Failed to delete issue label',
          labelId: input.labelId,
        });
      }

      return {
        success: providerResponse.data.issueLabelDelete.success,
        entityId: providerResponse.data.issueLabelDelete.entityId,
        lastSyncId: providerResponse.data.issueLabelDelete.lastSyncId,
      };
    },
  });
}
