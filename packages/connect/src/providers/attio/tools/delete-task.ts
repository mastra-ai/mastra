// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTaskInputSchema = z.object({
  task_id: z.string().describe('The unique ID of the task to delete. Example: "6805054f-0fef-478d-99a3-b864bd09ee2a"'),
});

export const deleteTaskOutputSchema = z.object({
  success: z.boolean(),
  task_id: z.string(),
});

export function deleteTaskTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_delete_task',
    description: 'Delete or archive a task in Attio.',
    inputSchema: deleteTaskInputSchema,
    outputSchema: deleteTaskOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTaskOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api/tasks#delete-tasks-task-id
      await platformProxy.delete({
        endpoint: `/v2/tasks/${input.task_id}`,
        retries: 3,
      });

      return {
        success: true,
        task_id: input.task_id,
      };
    },
  });
}
