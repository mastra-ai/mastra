// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createReminderInputSchema = z.object({
  text: z.string().describe('The content of the reminder. Example: "eat a banana"'),
  time: z
    .union([z.string(), z.number()])
    .describe(
      'When the reminder should happen. Can be a Unix timestamp or natural language like "in 5 minutes", "tomorrow at 9am"',
    ),
  user_id: z
    .string()
    .optional()
    .describe(
      'The user ID to set the reminder for. If omitted, sets a reminder for the authenticated user. Note: Setting reminders for other users requires a bot token.',
    ),
});

export const createReminderOutputSchema = z.object({
  id: z.string().describe('The unique identifier of the reminder'),
  creator: z.string().describe('The user ID of the user who created the reminder'),
  user: z.string().describe('The user ID of the user the reminder is set for'),
  text: z.string().describe('The content of the reminder'),
  recurring: z.boolean().describe('Whether the reminder is recurring'),
  time: z
    .number()
    .optional()
    .describe('The Unix timestamp when the reminder will trigger (for non-recurring reminders)'),
  complete_ts: z
    .number()
    .optional()
    .describe('The Unix timestamp when the reminder was completed (0 if not completed)'),
});

export function createReminderTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_create_reminder',
    description: 'Create a reminder for a user',
    inputSchema: createReminderInputSchema,
    outputSchema: createReminderOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createReminderOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.slack.dev/reference/methods/reminders.add
      const response = await platformProxy.post({
        endpoint: 'reminders.add',
        data: {
          text: input.text,
          time: input.time,
          ...(input.user_id && { user: input.user_id }),
        },
        retries: 3,
      });

      if (!response.data || response.data.ok !== true) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data?.error || 'Failed to create reminder',
          slack_response: response.data,
        });
      }

      const reminder = response.data.reminder;

      return {
        id: reminder.id,
        creator: reminder.creator,
        user: reminder.user,
        text: reminder.text,
        recurring: reminder.recurring,
        time: reminder.time,
        complete_ts: reminder.complete_ts,
      };
    },
  });
}
