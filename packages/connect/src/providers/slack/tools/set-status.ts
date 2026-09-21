// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const setStatusInputSchema = z.object({
  status_text: z
    .string()
    .max(100)
    .describe('The displayed text of up to 100 characters. We strongly encourage brevity.'),
  status_emoji: z
    .string()
    .describe('The displayed emoji that is enabled for the Slack team, such as `:train:` or `:coffee:`.'),
  status_expiration: z
    .number()
    .optional()
    .describe(
      'The Unix timestamp of when the status will expire. Providing 0 or omitting this field results in a custom status that will not expire.',
    ),
});

export const setStatusOutputSchema = z.object({
  profile: z.object({
    title: z.string(),
    phone: z.string(),
    skype: z.string(),
    real_name: z.string(),
    real_name_normalized: z.string(),
    display_name: z.string(),
    display_name_normalized: z.string(),
    status_text: z.string(),
    status_emoji: z.string(),
    status_emoji_display_info: z.array(z.any()),
    status_expiration: z.number(),
    avatar_hash: z.string(),
    email: z.string(),
    pronouns: z.string(),
    huddle_state: z.string(),
    huddle_state_expiration_ts: z.number(),
    first_name: z.string(),
    last_name: z.string(),
    image_24: z.string(),
    image_32: z.string(),
    image_48: z.string(),
    image_72: z.string(),
    image_192: z.string(),
    image_512: z.string(),
  }),
});

export function setStatusTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_set_status',
    description: "Set a user's status",
    inputSchema: setStatusInputSchema,
    outputSchema: setStatusOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof setStatusOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/users.profile.set
      const response = await platformProxy.post({
        endpoint: 'users.profile.set',
        data: {
          profile: {
            status_text: input.status_text,
            status_emoji: input.status_emoji,
            ...(input.status_expiration !== undefined && { status_expiration: input.status_expiration }),
          },
        },
        retries: 3,
      });

      if (!response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data.error || 'Failed to set user status',
        });
      }

      return {
        profile: response.data.profile,
      };
    },
  });
}
