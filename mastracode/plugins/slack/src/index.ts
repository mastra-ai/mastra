/**
 * Slack plugin for Mastra Code.
 *
 * Authorizes YOUR Slack user account (PKCE user-token OAuth against a
 * pre-existing Slack app — the Mastra app by default, BYO via `clientId`)
 * and exposes read tools (+ optional write tools) that act as that user.
 * Message plumbing is chat-sdk's Slack adapter + `chat/ai` tools driven by
 * the user token; auth/refresh/persistence is `SlackUserAuth` from
 * `@mastra/slack`.
 */
import { spawn } from 'node:child_process';

import { SlackUserAuth } from '@mastra/slack';
import {
  fetchChannelMessages,
  fetchMessages,
  fetchThread,
  getChannelInfo,
  getThreadParticipants,
  getUser,
  listThreads,
  postChannelMessage,
  postMessage,
  sendDirectMessage,
  addReaction,
} from 'chat/ai';
import { createTool, defineMastraCodePlugin, writeToolProgress, z } from 'mastracode/plugin';
import type { MastraCodePluginToolEntries, MastraCodePluginTool } from 'mastracode/plugin';
import type { Tool as AiTool } from 'ai';

import { createUserTokenChat } from './chat.js';

const READ_SCOPES = [
  'channels:history',
  'groups:history',
  'im:history',
  'mpim:history',
  'channels:read',
  'groups:read',
  'im:read',
  'mpim:read',
  'users:read',
  'users:read.email',
  // search.messages requires the legacy umbrella scope; the granular
  // search:read.public/.private pair is rejected by that API.
  'search:read',
];

const WRITE_SCOPES = ['chat:write', 'reactions:write'];

/** Adapt a `chat/ai` AI SDK tool to a Mastra tool. */
function wrapAiTool(id: string, aiTool: AiTool<any, any>): MastraCodePluginTool {
  return createTool({
    id,
    description: aiTool.description ?? id,
    inputSchema: aiTool.inputSchema as z.ZodObject<any>,
    execute: async (input: Record<string, unknown>) => {
      return aiTool.execute!(input, { toolCallId: id, messages: [] });
    },
  });
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(command, [url], { stdio: 'ignore', detached: true }).unref();
  } catch {
    // best-effort; the URL is also surfaced in tool progress
  }
}

export default defineMastraCodePlugin({
  id: 'slack',
  name: 'Slack',
  description: 'Read (and optionally write) Slack as your own user account.',
  config: {
    clientId: {
      type: 'string',
      label: 'Slack app client_id',
      description:
        'OAuth client_id of a Slack app configured as a PKCE public client. Falls back to the MASTRA_SLACK_CLIENT_ID env var.',
    },
    readWrite: {
      type: 'boolean',
      label: 'Enable write tools',
      description:
        'Adds message/reaction posting tools and requests write scopes on connect. Reconnect after changing this.',
      default: false,
    },
  },
  instructions: [
    'The Slack tools act as the connected user account (not a bot).',
    'If a Slack tool fails with "Not connected" or "Reconnect required", run slack_connect first.',
    'ID formats: channelId is `slack:C…`, threadId is `slack:C…:<message ts>`, userId is a raw `U…` id.',
    'slack_search uses Slack search syntax: `from:@name`, `in:#channel`, `after:2026-01-01`, quoted phrases.',
    "To find someone's @-mentions, search their raw user id (e.g. `U01ABCDEF`) as a plain keyword.",
  ].join('\n'),
  tools: context => {
    const configClientId = typeof context.config.clientId === 'string' ? context.config.clientId : undefined;
    const readWrite = context.config.readWrite === true;

    const auth = new SlackUserAuth({
      clientId: configClientId,
      scopes: readWrite ? [...READ_SCOPES, ...WRITE_SCOPES] : READ_SCOPES,
    });
    const chat = createUserTokenChat(auth);

    const entries: MastraCodePluginToolEntries = {
      slack_connect: {
        tool: createTool({
          id: 'slack_connect',
          description:
            'Connect a Slack user account via browser OAuth (PKCE). Opens the authorize URL and waits for the redirect. Run this when other Slack tools report they are not connected.',
          inputSchema: z.object({}),
          execute: async (_input, toolContext) => {
            const credentials = await auth.connect({
              onAuthUrl: async url => {
                openBrowser(url);
                await writeToolProgress(toolContext, {
                  status: 'Waiting for Slack authorization in your browser…',
                  detail: url,
                });
              },
            });
            return {
              connected: true,
              team: credentials.teamName ?? credentials.teamId,
              userId: credentials.userId,
            };
          },
        }),
      },
      slack_status: {
        tool: createTool({
          id: 'slack_status',
          description: 'Show the Slack connection status (team, user, token expiry, whether reconnect is needed).',
          inputSchema: z.object({}),
          execute: async () => auth.getStatus(),
        }),
      },
      slack_disconnect: {
        tool: createTool({
          id: 'slack_disconnect',
          description: 'Disconnect Slack and remove the stored user credentials.',
          inputSchema: z.object({}),
          execute: async () => {
            await auth.disconnect();
            return { disconnected: true };
          },
        }),
      },
      slack_search: {
        tool: createTool({
          id: 'slack_search',
          description:
            'Search Slack messages the connected user can see, using Slack search syntax (from:, in:, after:, quoted phrases). Returns matches with channel, author, ts, text, and permalink.',
          inputSchema: z.object({
            query: z.string().describe('Slack search query'),
            count: z.number().int().min(1).max(50).default(20).describe('Max results'),
            sort: z.enum(['score', 'timestamp']).default('score'),
          }),
          execute: async input => {
            const token = await auth.getToken();
            const params = new URLSearchParams({
              query: input.query,
              count: String(input.count ?? 20),
              sort: input.sort ?? 'score',
            });
            const response = await fetch(`https://slack.com/api/search.messages?${params}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = (await response.json()) as {
              ok: boolean;
              error?: string;
              messages?: { total: number; matches: any[] };
            };
            if (!json.ok) throw new Error(`Slack search failed: ${json.error}`);
            return {
              total: json.messages?.total ?? 0,
              matches: (json.messages?.matches ?? []).map(match => ({
                channel: match.channel?.name ?? match.channel?.id,
                channelId: match.channel?.id,
                user: match.username ?? match.user,
                ts: match.ts,
                text: match.text,
                permalink: match.permalink,
              })),
            };
          },
        }),
      },
      slack_get_channel_info: { tool: wrapAiTool('slack_get_channel_info', getChannelInfo(chat)) },
      slack_fetch_channel_messages: { tool: wrapAiTool('slack_fetch_channel_messages', fetchChannelMessages(chat)) },
      slack_fetch_thread: { tool: wrapAiTool('slack_fetch_thread', fetchThread(chat)) },
      slack_fetch_messages: { tool: wrapAiTool('slack_fetch_messages', fetchMessages(chat)) },
      slack_list_threads: { tool: wrapAiTool('slack_list_threads', listThreads(chat)) },
      slack_get_thread_participants: {
        tool: wrapAiTool('slack_get_thread_participants', getThreadParticipants(chat)),
      },
      slack_get_user: { tool: wrapAiTool('slack_get_user', getUser(chat)) },
    };

    if (readWrite) {
      entries.slack_post_message = { tool: wrapAiTool('slack_post_message', postMessage(chat)) };
      entries.slack_post_channel_message = {
        tool: wrapAiTool('slack_post_channel_message', postChannelMessage(chat)),
      };
      entries.slack_send_direct_message = {
        tool: wrapAiTool('slack_send_direct_message', sendDirectMessage(chat)),
      };
      entries.slack_add_reaction = { tool: wrapAiTool('slack_add_reaction', addReaction(chat)) };
    }

    return entries;
  },
});
