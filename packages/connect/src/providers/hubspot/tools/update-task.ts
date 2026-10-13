// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateTaskInputSchema = z.object({
  taskId: z.string().describe('The HubSpot task ID to update. Example: "12345"'),
  subject: z.string().optional().describe('The title of the task.'),
  body: z.string().optional().describe('The task notes/description.'),
  dueDate: z.string().optional().describe('The task due date in ISO 8601 format or Unix timestamp in milliseconds.'),
  status: z.enum(['COMPLETED', 'NOT_STARTED']).optional().describe('The status of the task.'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().describe('The priority of the task.'),
  taskType: z.enum(['EMAIL', 'CALL', 'TODO']).optional().describe('The type of the task.'),
  ownerId: z.string().optional().describe('The HubSpot owner ID to assign the task to.'),
  reminder: z.string().optional().describe('Reminder timestamp in Unix milliseconds.'),
});

export const updateTaskOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  body: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['COMPLETED', 'NOT_STARTED']).or(z.string()).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).or(z.string()).optional(),
  taskType: z.enum(['EMAIL', 'CALL', 'TODO']).or(z.string()).optional(),
  ownerId: z.string().optional(),
  reminder: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function updateTaskTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_update_task',
    description: "Update a HubSpot task's fields, owner, due date, and associations",
    inputSchema: updateTaskInputSchema,
    outputSchema: updateTaskOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTaskOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const properties: Record<string, string> = {};

      if (input.subject !== undefined) properties['hs_task_subject'] = input.subject;
      if (input.body !== undefined) properties['hs_task_body'] = input.body;
      if (input.dueDate !== undefined) properties['hs_timestamp'] = input.dueDate;
      if (input.status !== undefined) properties['hs_task_status'] = input.status;
      if (input.priority !== undefined) properties['hs_task_priority'] = input.priority;
      if (input.taskType !== undefined) properties['hs_task_type'] = input.taskType;
      if (input.ownerId !== undefined) properties['hubspot_owner_id'] = input.ownerId;
      if (input.reminder !== undefined) properties['hs_task_reminders'] = input.reminder;

      // https://developers.hubspot.com/docs/api-reference/crm-tasks-v3/guide
      const response = await platformProxy.patch({
        endpoint: `/crm/v3/objects/tasks/${input.taskId}`,
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        subject: data.properties?.['hs_task_subject'] ?? undefined,
        body: data.properties?.['hs_task_body'] ?? undefined,
        dueDate: data.properties?.['hs_timestamp'] ?? undefined,
        status: data.properties?.['hs_task_status'] ?? undefined,
        priority: data.properties?.['hs_task_priority'] ?? undefined,
        taskType: data.properties?.['hs_task_type'] ?? undefined,
        ownerId: data.properties?.['hubspot_owner_id'] ?? undefined,
        reminder: data.properties?.['hs_task_reminders'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
