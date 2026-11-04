import { createTool } from '@mastra/core/tools';
import type { SlackAdapter } from '@mastra/slack';
import type { Chat } from 'chat';
import {
  fetchChannelMessages,
  fetchMessages,
  fetchThread,
  getChannelInfo,
  getThreadParticipants,
  listThreads,
  postChannelMessage,
  postMessage,
} from 'chat/ai';
import { z } from 'zod';

import type { IntegrationTools } from '../base.js';
import type { SlackToolSettings } from './tool-settings.js';

/** Pages read per lookup, so one call can't walk a huge workspace. */
const MAX_LOOKUP_PAGES = 10;
/** Most messages searchMessages reads per channel. */
const MAX_SEARCH_SCAN = 1000;

/** Treats a bare Slack id (`C0123`, `D0123`) as `slack:C0123`. */
function withPrefix(id: string): string {
  return id.startsWith('slack:') ? id : `slack:${id}`;
}

/** Same resolution the Chat SDK's own scope guard uses. */
function channelOf(chat: Chat, id: string): string {
  const prefix = id.split(':')[0];
  const adapter = prefix ? chat.getAdapter(prefix) : undefined;
  return adapter?.channelIdFromThreadId?.(id) ?? id.split(':').slice(0, 2).join(':');
}

const slackClient = (chat: Chat) => (chat.getAdapter('slack') as SlackAdapter).webClient;

/**
 * Reads a paginated Slack list until it runs out of pages or hits the cap.
 * `incomplete` is set when the cap stopped it, so a lookup that found nothing
 * isn't mistaken for "doesn't exist".
 */
async function listAll<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items?: T[]; response_metadata?: { next_cursor?: string } }>,
): Promise<{ items: T[]; incomplete?: true }> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LOOKUP_PAGES; page++) {
    const result = await fetchPage(cursor);
    items.push(...(result.items ?? []));
    cursor = result.response_metadata?.next_cursor || undefined;
    if (!cursor) return { items };
  }
  return { items, incomplete: true };
}

const normalize = (text: string) => text.toLowerCase().replace(/^[#@]/, '').trim();

/**
 * The Chat SDK's read and post tools, plus channel/person lookup, search and
 * DMs, confined to the channels `settings` grant. They act as the app, so a
 * session never reaches a channel the app isn't in, and posting needs no
 * approval.
 */
export function createSlackChatTools({
  chat,
  sessionThreadId,
  settings,
}: {
  chat: Chat;
  /** The session's own chat thread id, e.g. `slack:C123:1700000000.000100`. */
  sessionThreadId: string;
  settings: SlackToolSettings;
}): IntegrationTools {
  const all = settings.channels === 'all';
  const allowed = new Set([
    channelOf(chat, sessionThreadId),
    ...(settings.channels === 'selected' ? settings.channelIds.map(id => `slack:${id}`) : []),
  ]);
  const scope = all ? 'any channel the app is a member of' : [...allowed].join(', ');
  // Passing our own guard (a bare function for reads, `guard` for writes)
  // replaces the Chat SDK's, which would otherwise confine the tools to the
  // Slack conversation being handled.
  const ownChannel = channelOf(chat, sessionThreadId);
  const guard = (id: string) => {
    const channel = channelOf(chat, withPrefix(id));
    // Other people's DMs with the app are theirs, even when every channel is granted.
    if (channel.startsWith('slack:D') && channel !== ownChannel) {
      throw new Error(`"${id}" is someone else's direct message with the app. Use sendDirectMessage to message a person.`);
    }
    if (all) return;
    if (!allowed.has(channel)) {
      throw new Error(`"${id}" is outside the channels this session can use: ${scope}.`);
    }
  };
  const postGuard =
    settings.channelAccess === 'read'
      ? (id: string) => {
          if (channelOf(chat, id) !== ownChannel) {
            throw new Error(`"${id}" is read only for this session: it can only post in its own channel, ${ownChannel}.`);
          }
        }
      : guard;
  const note = <T extends { description?: unknown }>(tool: T): T => ({
    ...tool,
    description: `${String(tool.description)} Channels this session can use: ${scope}${
      settings.channelAccess === 'read' ? " (read only: post only in this session's own channel)" : ''
    }. This session's thread is ${sessionThreadId}.`,
  });

  return {
    fetchMessages: note(fetchMessages(chat, guard)),
    fetchChannelMessages: note(fetchChannelMessages(chat, guard)),
    fetchThread: fetchThread(chat, guard),
    listThreads: note(listThreads(chat, guard)),
    getThreadParticipants: getThreadParticipants(chat, guard),
    getChannelInfo: getChannelInfo(chat, guard),
    postMessage: note(postMessage(chat, { needsApproval: false, guard: postGuard })),
    // Given a thread id, Slack would silently post a new top-level message
    // instead of replying in that thread.
    postChannelMessage: note(
      postChannelMessage(chat, {
        needsApproval: false,
        guard: id => {
          if (id.split(':').length > 2) {
            throw new Error(`"${id}" is a thread, not a channel. Use postMessage to reply in a thread.`);
          }
          postGuard(id);
        },
      }),
    ),
    findChannel: createTool({
      id: 'findChannel',
      description:
        'Find Slack channels by name, e.g. "eng" or "#eng-proj-factories". Returns full channel ids (slack:C…) to pass to the other Slack tools, and whether the app is a member. `incomplete: true` means the workspace was too large to check every channel.',
      inputSchema: z.object({ name: z.string().min(1).describe('All or part of the channel name') }),
      execute: async ({ name }) => {
        const query = normalize(name);
        const { items: found, incomplete } = await listAll(async cursor => {
          const page = await slackClient(chat).conversations.list({
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 1000,
            cursor,
          });
          return { items: page.channels, response_metadata: page.response_metadata };
        });
        const matches = found.filter(c => c.name?.toLowerCase().includes(query));
        return {
          channels: matches.slice(0, 20).map(c => ({
            id: `slack:${c.id}`,
            name: c.name,
            isPrivate: Boolean(c.is_private),
            isMember: Boolean(c.is_member),
          })),
          ...(incomplete && { incomplete }),
        };
      },
    }),
    searchMessages: createTool({
      id: 'searchMessages',
      description:
        "Search recent top-level messages in Slack channels for words. Matches messages containing every word, ignoring case. Reads each channel's newest messages (not thread replies), so older messages are missed. Defaults to this session's channel; use findChannel to get other channel ids.",
      inputSchema: z.object({
        query: z.string().min(1).describe('Words to look for'),
        channelIds: z
          .array(z.string().min(1))
          .max(10)
          .optional()
          .describe('Channels to search, as slack:C… ids. Defaults to the channel this session started in.'),
        scan: z
          .number()
          .int()
          .min(1)
          .max(MAX_SEARCH_SCAN)
          .default(200)
          .describe('How many of the newest messages to read in each channel'),
        limit: z.number().int().min(1).max(50).default(20).describe('Most matches to return'),
      }),
      execute: async ({ query, channelIds, scan, limit }) => {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const channels = channelIds?.length ? channelIds : [channelOf(chat, sessionThreadId)];
        const matches: Array<{ channelId: string; ts: string; userId?: string; text: string }> = [];
        const errors: Array<{ channelId: string; error: string }> = [];
        let scanned = 0;
        for (const channelId of channels) {
          // Read the channel the guard checked, not whatever string was passed.
          const id = withPrefix(channelId);
          const channel = channelOf(chat, id).replace(/^slack:/, '');
          let cursor: string | undefined;
          let read = 0;
          try {
            guard(id);
            while (read < scan) {
              const page = await slackClient(chat).conversations.history({
                channel,
                limit: Math.min(200, scan - read),
                cursor,
              });
              for (const message of (page.messages ?? []).slice(0, scan - read)) {
                read++;
                scanned++;
                const text = message.text ?? '';
                if (words.every(word => text.toLowerCase().includes(word))) {
                  matches.push({ channelId: `slack:${channel}`, ts: message.ts ?? '', userId: message.user, text });
                }
              }
              cursor = page.response_metadata?.next_cursor || undefined;
              if (!cursor || (page.messages?.length ?? 0) === 0) break;
            }
          } catch (error) {
            errors.push({
              channelId: `slack:${channel}`,
              error: (error as { data?: { error?: string } }).data?.error ?? String(error),
            });
          }
        }
        return {
          matches: matches.slice(0, limit),
          scanned,
          ...(errors.length ? { errors } : {}),
        };
      },
    }),
    findUser: createTool({
      id: 'findUser',
      description:
        'Find people in Slack by name, e.g. "Caleb" or "@caleb". Returns their user ids (U…), to mention them as <@U…> in a message or to DM them. `incomplete: true` means the workspace was too large to check everyone.',
      inputSchema: z.object({ name: z.string().min(1).describe('All or part of their name or display name') }),
      execute: async ({ name }) => {
        const query = normalize(name);
        const { items: people, incomplete } = await listAll(async cursor => {
          const page = await slackClient(chat).users.list({ limit: 200, cursor });
          return { items: page.members, response_metadata: page.response_metadata };
        });
        const matches = people.filter(
          p =>
            !p.deleted &&
            !p.is_bot &&
            p.id !== 'USLACKBOT' &&
            [p.name, p.profile?.real_name, p.profile?.display_name].some(n => n?.toLowerCase().includes(query)),
        );
        return {
          users: matches.slice(0, 20).map(p => ({
            id: p.id,
            name: p.profile?.real_name || p.name,
            displayName: p.profile?.display_name || undefined,
          })),
          ...(incomplete && { incomplete }),
        };
      },
    }),
    // The Chat SDK's own sendDirectMessage asks for approval; this one doesn't.
    ...(settings.directMessages === 'anyone'
      ? {
          sendDirectMessage: createTool({
            id: 'sendDirectMessage',
            description: 'Send a direct message to a person in Slack. Use findUser to get their user id (U…) from a name.',
            inputSchema: z.object({
              userId: z.string().min(1).describe('Slack user id, e.g. U123456'),
              text: z.string().min(1).describe('The message, in markdown'),
            }),
            execute: async ({ userId, text }) => {
              const dm = await chat.openDM(userId);
              const sent = await dm.post({ markdown: text });
              return { messageId: sent.id, threadId: sent.threadId };
            },
          }),
        }
      : {}),
  };
}
