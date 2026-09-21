// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createTaskInputSchema = z.object({
  subject: z.string().describe('The title/subject of the task. Example: "Call John about the proposal"'),
  type: z
    .string()
    .optional()
    .describe(
      'The type of task. Example: "CALL", "EMAIL", "TODO", "MEETING", "LINKED_IN", "LINKED_IN_MESSAGE", "LINKED_IN_CONNECT", "WHATSAPP", "SMS", "NEXT_STEP", "SCHEDULE_MEETING", "DEMO". Defaults to "TODO"',
    ),
  priority: z
    .string()
    .optional()
    .describe('The priority of the task. Options: "LOW", "MEDIUM", "HIGH". Defaults to "MEDIUM"'),
  dueDate: z
    .string()
    .describe(
      'The due date for the task in ISO 8601 format (e.g., "2024-03-15T10:00:00Z"). Example: "2024-03-15T10:00:00Z"',
    ),
  notes: z
    .string()
    .optional()
    .describe('The body/notes of the task. Example: "Remember to mention the discount offer"'),
  assigneeId: z
    .string()
    .optional()
    .describe('The HubSpot owner ID (user ID) to assign the task to. Example: "12345678"'),
  contactIds: z
    .array(z.string())
    .optional()
    .describe('Array of contact IDs to associate the task with. Example: ["123", "456"]'),
  companyIds: z
    .array(z.string())
    .optional()
    .describe('Array of company IDs to associate the task with. Example: ["789", "012"]'),
  dealIds: z
    .array(z.string())
    .optional()
    .describe('Array of deal IDs to associate the task with. Example: ["345", "678"]'),
});

export const createTaskOutputSchema = z.object({
  id: z.string().describe('The unique ID of the created task'),
  subject: z.string().optional().describe('The title/subject of the task'),
  type: z.string().optional().describe('The type of task'),
  priority: z.string().optional().describe('The priority of the task'),
  dueDate: z.string().optional().describe('The due date of the task'),
  notes: z.string().optional().describe('The body/notes of the task'),
  status: z.string().optional().describe('The status of the task'),
  assigneeId: z.string().optional().describe('The HubSpot owner ID assigned to the task'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function createTaskTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_task',
    description:
      'Create a HubSpot task with type, title, priority, assignee, due date, notes, and optional associations to contacts, companies, or deals',
    inputSchema: createTaskInputSchema,
    outputSchema: createTaskOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTaskOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const properties: Record<string, string> = {
        hs_task_subject: input.subject,
        hs_task_type: input.type || 'TODO',
        hs_task_priority: input.priority || 'MEDIUM',
        hs_timestamp: input.dueDate,
        hs_task_status: 'NOT_STARTED',
      };

      if (input.notes) {
        properties['hs_task_body'] = input.notes;
      }

      if (input.assigneeId) {
        properties['hubspot_owner_id'] = input.assigneeId;
      }

      const associations: Array<{
        to: { id: string };
        types: Array<{ associationCategory: string; associationTypeId: number }>;
      }> = [];

      if (input.contactIds && input.contactIds.length > 0) {
        for (const contactId of input.contactIds) {
          associations.push({
            to: { id: contactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
          });
        }
      }

      if (input.companyIds && input.companyIds.length > 0) {
        for (const companyId of input.companyIds) {
          associations.push({
            to: { id: companyId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }],
          });
        }
      }

      if (input.dealIds && input.dealIds.length > 0) {
        for (const dealId of input.dealIds) {
          associations.push({
            to: { id: dealId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 216 }],
          });
        }
      }

      const requestBody: {
        properties: Record<string, string>;
        associations?: Array<{
          to: { id: string };
          types: Array<{ associationCategory: string; associationTypeId: number }>;
        }>;
      } = {
        properties,
      };

      if (associations.length > 0) {
        requestBody.associations = associations;
      }

      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/tasks',
        data: requestBody,
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        subject: data.properties?.['hs_task_subject'] ?? undefined,
        type: data.properties?.['hs_task_type'] ?? undefined,
        priority: data.properties?.['hs_task_priority'] ?? undefined,
        dueDate: data.properties?.['hs_timestamp'] ?? undefined,
        notes: data.properties?.['hs_task_body'] ?? undefined,
        status: data.properties?.['hs_task_status'] ?? undefined,
        assigneeId: data.properties?.['hubspot_owner_id'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
