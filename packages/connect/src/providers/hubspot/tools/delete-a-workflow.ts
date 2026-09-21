// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAWorkflowInputSchema = z.object({
  workflowId: z.string().describe('The unique identifier for the workflow to delete. Example: "123456789"'),
});

export const deleteAWorkflowOutputSchema = z.object({
  success: z.boolean(),
  workflowId: z.string(),
});

export function deleteAWorkflowTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_a_workflow',
    description: 'Delete an automation workflow',
    inputSchema: deleteAWorkflowInputSchema,
    outputSchema: deleteAWorkflowOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAWorkflowOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/automation-automation-v4-v4/workflows/delete-automation-v4-flows-flowId
      await platformProxy.delete({
        endpoint: `/automation/v4/flows/${input.workflowId}`,
        retries: 3,
      });

      return {
        success: true,
        workflowId: input.workflowId,
      };
    },
  });
}
