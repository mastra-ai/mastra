// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateTaskInputSchema = z.object({
  task_id: z.string().describe('The ID of the task to update. Example: "649e34f4-c39a-4f4d-99ef-48a36bef8f04"'),
  deadline_at: z
    .string()
    .nullable()
    .optional()
    .describe('The deadline of the task, in ISO 8601 format. Example: "2023-01-01T15:00:00.000000000Z"'),
  is_completed: z.boolean().optional().describe('Whether the task has been completed.'),
  linked_records: z
    .array(
      z.object({
        target_object: z.string().describe('The ID or slug of the parent object the task refers to. Example: "people"'),
        target_record_id: z
          .string()
          .describe('The ID of the parent record the task refers to. Example: "891dcbfc-9141-415d-9b2a-2238a6cc012d"'),
      }),
    )
    .optional()
    .describe('Records linked to the task.'),
  assignees: z
    .array(
      z.object({
        referenced_actor_type: z
          .string()
          .describe('The actor type of the task assignee. Only "workspace-member" is supported for tasks.'),
        referenced_actor_id: z.string().describe('The ID of the actor assigned to this task.'),
      }),
    )
    .optional()
    .describe('Workspace members assigned to this task.'),
});

const ProviderTaskSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    task_id: z.string(),
  }),
  content_plaintext: z.string(),
  deadline_at: z.string().nullable(),
  is_completed: z.boolean(),
  completed_at: z.string().nullable(),
  linked_records: z.array(
    z.object({
      target_object_id: z.string(),
      target_record_id: z.string(),
    }),
  ),
  assignees: z.array(
    z.object({
      referenced_actor_type: z.string(),
      referenced_actor_id: z.string(),
    }),
  ),
  created_by_actor: z.object({
    id: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  }),
  created_at: z.string(),
});

export const updateTaskOutputSchema = z.object({
  task_id: z.string(),
  content_plaintext: z.string().optional(),
  deadline_at: z.string().nullable().optional(),
  is_completed: z.boolean().optional(),
  completed_at: z.string().nullable().optional(),
  linked_records: z
    .array(
      z.object({
        target_object_id: z.string(),
        target_record_id: z.string(),
      }),
    )
    .optional(),
  assignees: z
    .array(
      z.object({
        referenced_actor_type: z.string(),
        referenced_actor_id: z.string(),
      }),
    )
    .optional(),
  created_by_actor: z
    .object({
      id: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
    })
    .optional(),
  created_at: z.string().optional(),
});

export function updateTaskTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_update_task',
    description: 'Update a task in Attio.',
    inputSchema: updateTaskInputSchema,
    outputSchema: updateTaskOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTaskOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://docs.attio.com/rest-api/endpoint-reference/tasks/update-a-task
        endpoint: `/v2/tasks/${input.task_id}`,
        data: {
          data: {
            ...(input.deadline_at !== undefined && { deadline_at: input.deadline_at }),
            ...(input.is_completed !== undefined && { is_completed: input.is_completed }),
            ...(input.linked_records !== undefined && {
              linked_records: input.linked_records.map(record => ({
                target_object: record.target_object,
                target_record_id: record.target_record_id,
              })),
            }),
            ...(input.assignees !== undefined && { assignees: input.assignees }),
          },
        },
        retries: 3,
      });

      const responseData = z.object({ data: z.unknown() }).parse(response.data);
      const providerTask = ProviderTaskSchema.parse(responseData.data);

      return {
        task_id: providerTask.id.task_id,
        ...(providerTask.content_plaintext !== undefined && { content_plaintext: providerTask.content_plaintext }),
        ...(providerTask.deadline_at !== null && { deadline_at: providerTask.deadline_at }),
        ...(providerTask.deadline_at === null && { deadline_at: null }),
        is_completed: providerTask.is_completed,
        ...(providerTask.completed_at !== null && { completed_at: providerTask.completed_at }),
        ...(providerTask.completed_at === null && { completed_at: null }),
        linked_records: providerTask.linked_records,
        assignees: providerTask.assignees,
        created_by_actor: providerTask.created_by_actor,
        created_at: providerTask.created_at,
      };
    },
  });
}
