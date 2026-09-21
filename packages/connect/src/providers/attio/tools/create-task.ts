// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

const LinkedRecordInputSchema = z.object({
  target_object: z.string().describe('The ID or slug of the parent object the task refers to. Example: "people"'),
  target_record_id: z
    .string()
    .describe('The ID of the parent record the task refers to. Example: "891dcbfc-9141-415d-9b2a-2238a6cc012d"'),
});

const AssigneeInputSchema = z.object({
  referenced_actor_type: z
    .literal('workspace-member')
    .describe('The actor type of the task assignee. Only workspace-member actors can be assigned to tasks.'),
  referenced_actor_id: z
    .string()
    .describe('The ID of the actor assigned to this task. Example: "50cf242c-7fa3-4cad-87d0-75b1af71c57b"'),
});

export const createTaskInputSchema = z.object({
  content: z
    .string()
    .max(2000)
    .describe('The text content of the task. Example: "Follow up on current software solutions"'),
  format: z.literal('plaintext').optional().describe('The format of the task content. Only "plaintext" is supported.'),
  deadline_at: z
    .string()
    .nullable()
    .optional()
    .describe('The deadline of the task, in ISO 8601 format. Example: "2023-01-01T15:00:00.000000000Z"'),
  is_completed: z.boolean().optional().describe('Whether the task has been completed. Defaults to false.'),
  linked_records: z.array(LinkedRecordInputSchema).optional().describe('Records linked to the task.'),
  assignees: z.array(AssigneeInputSchema).optional().describe('Workspace members assigned to this task.'),
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
    id: z.string().nullable(),
    type: z.string().nullable(),
  }),
  created_at: z.string(),
});

export const createTaskOutputSchema = z.object({
  workspace_id: z.string(),
  task_id: z.string(),
  content_plaintext: z.string(),
  deadline_at: z.string().optional(),
  is_completed: z.boolean(),
  completed_at: z.string().optional(),
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
    id: z.string().optional(),
    type: z.string().optional(),
  }),
  created_at: z.string(),
});

export function createTaskTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_create_task',
    description: 'Create a task in Attio.',
    inputSchema: createTaskInputSchema,
    outputSchema: createTaskOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTaskOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.attio.com/rest-api
        endpoint: '/v2/tasks',
        data: {
          data: {
            content: input.content,
            format: input.format ?? 'plaintext',
            deadline_at: input.deadline_at ?? null,
            is_completed: input.is_completed ?? false,
            linked_records: input.linked_records ?? [],
            assignees: input.assignees ?? [],
          },
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);
      const providerTask = ProviderTaskSchema.parse(response.data.data);

      return {
        workspace_id: providerTask.id.workspace_id,
        task_id: providerTask.id.task_id,
        content_plaintext: providerTask.content_plaintext,
        ...(providerTask.deadline_at != null && { deadline_at: providerTask.deadline_at }),
        is_completed: providerTask.is_completed,
        ...(providerTask.completed_at != null && { completed_at: providerTask.completed_at }),
        linked_records: providerTask.linked_records,
        assignees: providerTask.assignees,
        created_by_actor: {
          ...(providerTask.created_by_actor.id != null && { id: providerTask.created_by_actor.id }),
          ...(providerTask.created_by_actor.type != null && { type: providerTask.created_by_actor.type }),
        },
        created_at: providerTask.created_at,
      };
    },
  });
}
