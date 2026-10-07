// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
// Slack exposes no channel-search Web API method to bot tokens, so this tool
// pages conversations.list server-side and filters by name, saving agents from
// manually paging through workspaces with thousands of channels.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ConversationSchema = z.object({
  id: z.string(),
  name: z.string(),
  created: z.number(),
  creator: z.string(),
  is_archived: z.boolean(),
  is_general: z.boolean(),
  is_private: z.boolean(),
  is_mpim: z.boolean(),
  is_im: z.boolean(),
  num_members: z.number().optional(),
});

export const searchChannelsInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Channel name to search for. Case-insensitive substring match; a leading # is ignored.'),
  types: z
    .string()
    .optional()
    .describe(
      'Comma-separated list of conversation types to search. Options: public_channel, private_channel, mpim, im. Default: public_channel.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of matching channels to return. Default: 20.'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from a previous response to continue scanning. Omit to start from the beginning.'),
});

export const searchChannelsOutputSchema = z.object({
  conversations: z.array(ConversationSchema),
  total: z.number(),
  next_cursor: z
    .string()
    .optional()
    .describe('Present when the workspace was not fully scanned; pass back as cursor to continue searching.'),
});

const PAGE_SIZE = 200;
const MAX_PAGES_PER_CALL = 10;

/**
 * The continuation cursor is either a raw Slack conversations.list cursor or,
 * when a call stopped mid-page because the match limit was reached, an
 * `offset:<n>:<slack cursor>` composite that re-fetches the same page and
 * resumes from channel index `<n>` so no matches are skipped.
 */
function parseContinuationCursor(raw: string | undefined): { pageCursor: string | undefined; offset: number } {
  if (!raw) return { pageCursor: undefined, offset: 0 };
  const match = /^offset:(\d+):(.*)$/.exec(raw);
  if (match) return { pageCursor: match[2] || undefined, offset: Number.parseInt(match[1]!, 10) };
  return { pageCursor: raw, offset: 0 };
}

export function searchChannelsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_search_channels',
    description:
      'Find Slack channels by name without paging manually. Scans conversations.list and returns channels whose name contains the query (case-insensitive).',
    inputSchema: searchChannelsInputSchema,
    outputSchema: searchChannelsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchChannelsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = input.query.replace(/^#/, '').toLowerCase();
      const maxMatches = input.limit ?? 20;

      const matches: Array<z.infer<typeof ConversationSchema>> = [];
      let { pageCursor, offset } = parseContinuationCursor(input.cursor);
      let nextCursor: string | undefined;

      for (let page = 0; page < MAX_PAGES_PER_CALL; page++) {
        const config = {
          // https://api.slack.com/methods/conversations.list
          endpoint: 'conversations.list',
          params: {
            types: input.types || 'public_channel',
            limit: PAGE_SIZE,
            ...(pageCursor && { cursor: pageCursor }),
          },
          retries: 3,
        };

        const response = await platformProxy.get(config);

        const channels: any[] = response.data.channels || [];
        const responseMetadata = response.data.response_metadata || {};
        const slackNextCursor: string | undefined = responseMetadata.next_cursor || undefined;

        for (let index = offset; index < channels.length; index++) {
          const channel = channels[index];
          const name: string = channel.name || '';
          if (!name.toLowerCase().includes(query)) continue;
          matches.push({
            id: channel.id,
            name,
            created: channel.created || 0,
            creator: channel.creator || '',
            is_archived: channel.is_archived || false,
            is_general: channel.is_general || false,
            is_private: channel.is_private || false,
            is_mpim: channel.is_mpim || false,
            is_im: channel.is_im || false,
            num_members: channel.num_members,
          });
          if (matches.length >= maxMatches) {
            // Stopped mid-page: point the continuation at the remainder of
            // this page so the unscanned channels are not skipped.
            nextCursor = index + 1 < channels.length ? `offset:${index + 1}:${pageCursor ?? ''}` : slackNextCursor;
            return {
              conversations: matches,
              total: matches.length,
              ...(nextCursor !== undefined && { next_cursor: nextCursor }),
            };
          }
        }

        offset = 0;
        if (!slackNextCursor) {
          nextCursor = undefined;
          break;
        }
        pageCursor = slackNextCursor;
        nextCursor = slackNextCursor;
      }

      return {
        conversations: matches,
        total: matches.length,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
