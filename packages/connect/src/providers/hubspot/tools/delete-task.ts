// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTaskInputSchema = z.object({
  taskId: z.string().describe('HubSpot task record ID to delete. Example: "12345"'),
});

export const deleteTaskOutputSchema = z.object({
  success: z.boolean(),
  taskId: z.string(),
});

export function deleteTaskTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_task',
    description: 'Delete a HubSpot task by record ID',
    inputSchema: deleteTaskInputSchema,
    outputSchema: deleteTaskOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTaskOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm/tasks
      await platformProxy.delete({
        endpoint: `/crm/v3/objects/tasks/${input.taskId}`,
        retries: 3,
      });

      return {
        success: true,
        taskId: input.taskId,
      };
    },
  });
}
