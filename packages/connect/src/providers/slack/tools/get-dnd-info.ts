// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDndInfoInputSchema = z.object({
  user_id: z
    .string()
    .optional()
    .describe(
      'User ID to fetch DND status for. If omitted, returns status for the authenticated user. Example: "U1234567890"',
    ),
});

export const getDndInfoOutputSchema = z.object({
  dnd_enabled: z.boolean().describe('Whether Do Not Disturb is enabled'),
  next_dnd_start_ts: z
    .number()
    .optional()
    .describe('Unix timestamp for the next DND window start. Omitted if no DND window scheduled'),
  next_dnd_end_ts: z
    .number()
    .optional()
    .describe('Unix timestamp for the next DND window end. Omitted if no DND window scheduled'),
  snooze_enabled: z.boolean().describe('Whether snooze mode is currently enabled'),
  snooze_endtime: z
    .number()
    .optional()
    .describe('Unix timestamp when snooze will end. Omitted if snooze is not enabled'),
  snooze_remaining: z
    .number()
    .optional()
    .describe('Seconds remaining until snooze ends. Omitted if snooze is not enabled'),
  snooze_is_indefinite: z
    .boolean()
    .optional()
    .describe('Whether snooze is indefinite. Omitted if snooze is not enabled'),
});

export function getDndInfoTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_get_dnd_info',
    description: "Get a user's Do Not Disturb status and next scheduled DND window",
    inputSchema: getDndInfoInputSchema,
    outputSchema: getDndInfoOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDndInfoOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.slack.dev/reference/methods/dnd.info/
      const config = {
        endpoint: 'dnd.info',
        params: input.user_id ? { user: input.user_id } : {},
        retries: 3,
      };

      const response = await platformProxy.get(config);

      if (!response.data || response.data.ok !== true) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to retrieve DND info',
          user_id: input.user_id,
        });
      }

      const data = response.data;

      return {
        dnd_enabled: data.dnd_enabled ?? false,
        next_dnd_start_ts: data.next_dnd_start_ts ?? undefined,
        next_dnd_end_ts: data.next_dnd_end_ts ?? undefined,
        snooze_enabled: data.snooze_enabled ?? false,
        snooze_endtime: data.snooze_endtime ?? undefined,
        snooze_remaining: data.snooze_remaining ?? undefined,
        snooze_is_indefinite: data.snooze_is_indefinite ?? undefined,
      };
    },
  });
}
