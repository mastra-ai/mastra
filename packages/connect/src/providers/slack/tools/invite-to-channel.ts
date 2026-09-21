// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

function stripNullProperties(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNullProperties);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== null)
        .map(([key, nestedValue]) => [key, stripNullProperties(nestedValue)]),
    );
  }

  return value;
}

export const inviteToChannelInputSchema = z.object({
  channel_id: z.string().describe('The ID of the public or private channel to invite user(s) to. Example: "C024BE91L"'),
  user_ids: z
    .array(z.string())
    .describe(
      'Array of user IDs to invite to the channel. Up to 1000 users may be invited at once. Example: ["U024BE7LH", "U12345678"]',
    ),
  force: z
    .boolean()
    .optional()
    .describe(
      'When set to true and multiple user IDs are provided, continue inviting the valid ones while ignoring invalid IDs. Defaults to false.',
    ),
});

export const inviteToChannelOutputSchema = z.object({
  ok: z.boolean(),
  channel: z.any().optional(),
  error: z.string().optional(),
});

export function inviteToChannelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_invite_to_channel',
    description: 'Invite users to a Slack channel',
    inputSchema: inviteToChannelInputSchema,
    outputSchema: inviteToChannelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof inviteToChannelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.user_ids.length > 1000) {
        throw new platformProxy.ActionError({
          type: 'validation_error',
          message: 'Cannot invite more than 1000 users at once',
        });
      }

      const response = await platformProxy.post({
        // https://api.slack.com/methods/conversations.invite
        endpoint: 'conversations.invite',
        data: {
          channel: input.channel_id,
          users: input.user_ids.join(','),
          ...(input.force !== undefined && { force: input.force }),
        },
        retries: 3,
      });

      const data = inviteToChannelOutputSchema.parse({
        ...response.data,
        channel: stripNullProperties(response.data.channel),
      });

      if (!data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: data.error || 'Unknown error from Slack API',
          channel_id: input.channel_id,
          user_ids: input.user_ids,
        });
      }

      return {
        ok: data.ok,
        channel: data.channel,
      };
    },
  });
}
