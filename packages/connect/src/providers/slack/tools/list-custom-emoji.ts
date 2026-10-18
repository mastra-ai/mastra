// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCustomEmojiInputSchema = z.object({
  include_categories: z
    .boolean()
    .optional()
    .describe('Include a list of categories for Unicode emoji and the emoji in each category'),
});

const EmojiSchema = z.object({
  name: z.string(),
  type: z.enum(['custom', 'alias']).or(z.string()),
  url: z.string().optional(),
  alias_for: z.string().optional(),
});

export const listCustomEmojiOutputSchema = z.object({
  emoji: z.array(EmojiSchema),
  total_count: z.number(),
});

const EmojiListResponseSchema = z.object({
  ok: z.boolean().optional(),
  error: z.string().optional(),
  emoji: z.record(z.string(), z.string()).optional(),
});

export function listCustomEmojiTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_custom_emoji',
    description: 'List workspace custom emoji mappings, including alias-based emoji entries',
    inputSchema: listCustomEmojiInputSchema,
    outputSchema: listCustomEmojiOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCustomEmojiOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/emoji.list
      const response = await platformProxy.get({
        endpoint: 'emoji.list',
        params: {
          ...(input.include_categories && { include_categories: String(input.include_categories) }),
        },
        retries: 3,
      });

      const data = EmojiListResponseSchema.parse(response.data);

      if (!data.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: data.error || 'Failed to fetch emoji list',
        });
      }

      const emoji: z.infer<typeof EmojiSchema>[] = Object.entries(data.emoji || {}).map(([name, value]) => {
        if (value.startsWith('alias:')) {
          return {
            name,
            type: 'alias',
            url: undefined,
            alias_for: value.replace('alias:', ''),
          };
        }

        return {
          name,
          type: 'custom',
          url: value,
          alias_for: undefined,
        };
      });

      return {
        emoji,
        total_count: emoji.length,
      };
    },
  });
}
