// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const inviteSharedInputSchema = z.object({
  channel_id: z
    .string()
    .describe('The ID of the channel on your team to share via Slack Connect. Example: "C024BE91L"'),
  emails: z
    .array(z.string())
    .optional()
    .describe(
      'Emails of external users to invite. Either emails or user_ids must be provided. Example: ["partner@example.com"]',
    ),
  user_ids: z
    .array(z.string())
    .optional()
    .describe(
      'User IDs of external users to invite. Either emails or user_ids must be provided. Example: ["U024BE7LH"]',
    ),
  external_limited: z
    .boolean()
    .optional()
    .describe(
      'When true, invite the users as external limited members rather than full members. Defaults to true on Slack side.',
    ),
});

export const inviteSharedOutputSchema = z.object({
  ok: z.boolean(),
  invite_id: z.string().optional(),
  conf_code: z.string().optional(),
  url: z.string().optional(),
  is_legacy_shared_channel: z.boolean().optional(),
  error: z.string().optional(),
});

export function inviteSharedTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_invite_shared',
    description: 'Invite external people to a channel via Slack Connect (shared channels), by email or Slack user ID.',
    inputSchema: inviteSharedInputSchema,
    outputSchema: inviteSharedOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof inviteSharedOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if ((!input.emails || input.emails.length === 0) && (!input.user_ids || input.user_ids.length === 0)) {
        throw new platformProxy.ActionError({
          type: 'validation_error',
          message: 'Either emails or user_ids must be provided',
        });
      }

      const response = await platformProxy.post({
        // https://api.slack.com/methods/conversations.inviteShared
        endpoint: 'conversations.inviteShared',
        data: {
          channel: input.channel_id,
          ...(input.emails && input.emails.length > 0 && { emails: input.emails.join(',') }),
          ...(input.user_ids && input.user_ids.length > 0 && { user_ids: input.user_ids.join(',') }),
          ...(input.external_limited !== undefined && { external_limited: input.external_limited }),
        },
        retries: 3,
      });

      const data = inviteSharedOutputSchema.parse(response.data);

      if (!data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: data.error || 'Unknown error from Slack API',
          channel_id: input.channel_id,
        });
      }

      return {
        ok: data.ok,
        invite_id: data.invite_id,
        conf_code: data.conf_code,
        url: data.url,
        is_legacy_shared_channel: data.is_legacy_shared_channel,
      };
    },
  });
}
