// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPinsInputSchema = z.object({
  channel_id: z.string().describe('The channel ID to list pinned items for. Example: "C1234567890"'),
});

const MessageSchema = z.object({
  type: z.string(),
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  permalink: z.string(),
  pinned_to: z.array(z.string()).optional(),
});

const FileSchema = z.object({
  id: z.string(),
  created: z.number(),
  timestamp: z.number(),
  name: z.string().optional(),
  title: z.string().optional(),
  mimetype: z.string().optional(),
  filetype: z.string().optional(),
  user: z.string(),
  permalink: z.string(),
});

const CommentSchema = z.object({
  id: z.string(),
  created: z.number(),
  timestamp: z.number(),
  user: z.string(),
  comment: z.string(),
});

const PinnedItemSchema = z.object({
  type: z.enum(['message', 'file', 'file_comment']).or(z.string()),
  created: z.number().describe('Unix timestamp when the item was pinned'),
  created_by: z.string().describe('User ID who pinned the item'),
  channel: z.string().describe('Channel ID where the item is pinned'),
  message: MessageSchema.optional(),
  file: FileSchema.optional(),
  comment: CommentSchema.optional(),
});

export const listPinsOutputSchema = z.object({
  items: z.array(PinnedItemSchema).describe('List of pinned items in the channel'),
});

export function listPinsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_pins',
    description: 'List all items pinned in a specific channel',
    inputSchema: listPinsInputSchema,
    outputSchema: listPinsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPinsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/pins.list
      const response = await platformProxy.get({
        endpoint: 'pins.list',
        params: {
          channel: input.channel_id,
        },
        retries: 3,
      });

      if (!response.data || !response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'slack_api_error',
          message: response.data?.error || 'Failed to list pinned items',
          channel_id: input.channel_id,
        });
      }

      return {
        items: response.data.items || [],
      };
    },
  });
}
