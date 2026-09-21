// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTaskInputSchema = z.object({
  task_id: z.string().uuid().describe('The ID of the task. Example: "649e34f4-c39a-4f4d-99ef-48a36bef8f04"'),
});

const TaskIdSchema = z.object({
  workspace_id: z.string().uuid(),
  task_id: z.string().uuid(),
});

const LinkedRecordSchema = z.object({
  target_object_id: z.string(),
  target_record_id: z.string().uuid(),
});

const AssigneeSchema = z.object({
  referenced_actor_type: z.string(),
  referenced_actor_id: z.string().uuid(),
});

const CreatedByActorSchema = z.object({
  id: z.string().nullable(),
  type: z.string().nullable(),
});

const TaskSchema = z.object({
  id: TaskIdSchema,
  content_plaintext: z.string(),
  deadline_at: z.string().nullable(),
  is_completed: z.boolean(),
  completed_at: z.string().nullable(),
  linked_records: z.array(LinkedRecordSchema),
  assignees: z.array(AssigneeSchema),
  created_by_actor: CreatedByActorSchema,
  created_at: z.string(),
});

export const getTaskOutputSchema = TaskSchema;

export function getTaskTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_get_task',
    description: 'Retrieve a single task from Attio.',
    inputSchema: getTaskInputSchema,
    outputSchema: getTaskOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTaskOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.attio.com/rest-api/endpoint-reference/tasks#get-v2tasks-task-id
        endpoint: `/v2/tasks/${input.task_id}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Task not found',
          task_id: input.task_id,
        });
      }

      const providerResponse = z
        .object({
          data: TaskSchema,
        })
        .parse(response.data);

      return providerResponse.data;
    },
  });
}
