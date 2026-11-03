import type { ChannelContext } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../base.js';
import { postTarget } from './share-file-tool.js';
import type { ShareFileToolDeps } from './share-file-tool.js';

export const SLACK_SEARCH_TOOL_NAME = 'slack_search';
export const SLACK_READ_TOOL_NAME = 'slack_read';
export const SLACK_SEND_TOOL_NAME = 'slack_send';

type SlackResponse = Record<string, any>;

/** The slice of `@chat-adapter/slack`'s adapter these tools use. */
interface SlackAdapterLike {
  webClient: { apiCall(method: string, args?: Record<string, unknown>): Promise<SlackResponse> };
  postMessage(threadId: string, message: { markdown: string }): Promise<{ raw?: unknown }>;
}

/** A conversation or person named by a Slack id, mention or permalink. */
type Target =
  { kind: 'conversation'; channel: string; ts?: string; threadTs?: string } | { kind: 'user'; user: string };

/**
 * Accepts the forms a model actually sees: permalinks
 * (`https://x.slack.com/archives/C1/p1700000000123456?thread_ts=…`),
 * mentions (`<#C1|general>`, `<@U1>`) and bare ids (`C1`, `U1`).
 * Names (`#general`, `@nik`) are not resolved; the error says so.
 */
export function parseSlackTarget(input: string): Target {
  const value = input.trim();
  const link = value.match(/\/archives\/([CDG][A-Z0-9]+)(?:\/p(\d{10})(\d{6}))?/);
  if (link) {
    const [, channel, secs, micros] = link;
    const ts = secs ? `${secs}.${micros}` : undefined;
    const threadTs = value.match(/[?&]thread_ts=(\d+\.\d+)/)?.[1];
    return { kind: 'conversation', channel: channel!, ...(ts ? { ts } : {}), ...(threadTs ? { threadTs } : {}) };
  }
  const user = value.match(/^<?@([UW][A-Z0-9]+)(?:\|[^>]*)?>?$/) ?? value.match(/^([UW][A-Z0-9]+)$/);
  if (user) return { kind: 'user', user: user[1]! };
  const channel = value.match(/^<?#([CDG][A-Z0-9]+)(?:\|[^>]*)?>?$/) ?? value.match(/^([CDG][A-Z0-9]+)$/);
  if (channel) return { kind: 'conversation', channel: channel[1]! };
  throw new Error(
    `Could not read "${input}" as a Slack target. Use a channel id (C…), a user id (U…), a mention like <#C…> or <@U…>, or a message permalink. Names like #general or @someone are not looked up.`,
  );
}

function slackError(error: unknown, action: string): Error {
  const code = (error as { data?: { error?: unknown; needed?: unknown } } | undefined)?.data?.error;
  switch (code) {
    case 'missing_scope': {
      const needed = (error as { data: { needed?: unknown } }).data.needed;
      return new Error(
        `The Slack app is missing the \`${typeof needed === 'string' ? needed : 'required'}\` scope, so it cannot ${action}. Add the scope to the app and reinstall it.`,
      );
    }
    case 'not_in_channel':
    case 'channel_not_found':
      return new Error(`Cannot ${action}: the Slack app is not a member of that channel, or it does not exist.`);
    case 'user_not_found':
      return new Error(`Cannot ${action}: no such Slack user.`);
    case 'thread_not_found':
    case 'message_not_found':
      return new Error(`Cannot ${action}: that message or thread does not exist.`);
    default:
      return error instanceof Error ? error : new Error(String(error));
  }
}

interface SlackSession {
  adapter: SlackAdapterLike;
  call(method: string, args: Record<string, unknown>, action: string): Promise<SlackResponse>;
  /** The channel and thread this session replies into. */
  origin: { channel: string; threadTs: string };
  /** Who the session is working for: the last person to write in its thread. */
  requester?: string;
  auth(): Promise<{ teamId?: string; url?: string }>;
  userName(id: string): Promise<string>;
  /**
   * Whether the requester is a full member of this workspace. Guests, people
   * from another organization and deactivated accounts are limited to
   * conversations they are in.
   */
  requesterIsLimited(): Promise<boolean>;
  /** Rejects reading or posting into a conversation the requester could not see themselves. */
  assertVisible(channel: string, action: string): Promise<SlackResponse>;
}

function decodeThread(id: string): { channel: string; threadTs: string } {
  const [, channel = '', threadTs = ''] = id.split(':');
  return { channel, threadTs };
}

async function requesterOf(requestContext: RequestContext, deps: ShareFileToolDeps): Promise<string | undefined> {
  const channel = requestContext.get('channel') as ChannelContext | undefined;
  if (channel?.userId) return channel.userId;
  const threadId = (requestContext.get('controller') as { threadId?: string } | undefined)?.threadId;
  if (!threadId) return undefined;
  const linked = await deps.channels?.()?.buildChannelContextForThread(threadId);
  return linked?.channel.userId || undefined;
}

async function openSession(requestContext: RequestContext, deps: ShareFileToolDeps): Promise<SlackSession> {
  const render = await postTarget(requestContext, deps);
  const adapter = render.chatThread.adapter as unknown as SlackAdapterLike;
  const origin = decodeThread(render.chatThread.id);
  const requester = await requesterOf(requestContext, deps);

  const call = async (method: string, args: Record<string, unknown>, action: string) => {
    try {
      return await adapter.webClient.apiCall(method, args);
    } catch (error) {
      throw slackError(error, action);
    }
  };

  let auth: Promise<{ teamId?: string; url?: string }> | undefined;
  const names = new Map<string, Promise<string>>();
  const visible = new Map<string, Promise<SlackResponse>>();
  let limited: Promise<boolean> | undefined;

  const getAuth = () =>
    (auth ??= call('auth.test', {}, 'identify the workspace').then(r => ({
      teamId: r.team_id,
      url: r.url,
    })));

  const isMember = async (channel: string, user: string, action: string) => {
    let cursor: string | undefined;
    do {
      const page = await call('conversations.members', { channel, limit: 1000, ...(cursor ? { cursor } : {}) }, action);
      if ((page.members as string[] | undefined)?.includes(user)) return true;
      const next: string | undefined = page.response_metadata?.next_cursor || undefined;
      if (next && next === cursor) {
        throw new Error(`Cannot ${action}: Slack returned the same page of channel members twice.`);
      }
      cursor = next;
    } while (cursor);
    return false;
  };

  const requesterIsLimited = () => {
    if (limited) return limited;
    limited = (async () => {
      if (!requester) return false;
      const user = (await call('users.info', { user: requester }, 'look up the person you are working for')).user ?? {};
      const { teamId } = await getAuth();
      return Boolean(
        user.deleted ||
        user.is_restricted ||
        user.is_ultra_restricted ||
        user.is_stranger ||
        (teamId && user.team_id && user.team_id !== teamId),
      );
    })();
    // A failed lookup refuses this call but is retried on the next one.
    limited.catch(() => (limited = undefined));
    return limited;
  };

  const session: SlackSession = {
    adapter,
    call,
    origin,
    ...(requester ? { requester } : {}),
    auth: getAuth,
    requesterIsLimited,
    userName: id => {
      let name = names.get(id);
      if (!name) {
        name = call('users.info', { user: id }, 'look up a user').then(
          r => r.user?.profile?.display_name || r.user?.real_name || r.user?.name || id,
          () => id,
        );
        names.set(id, name);
      }
      return name;
    },
    assertVisible: (channel, action) => {
      let check = visible.get(channel);
      if (!check) {
        check = (async () => {
          const info = (await call('conversations.info', { channel }, action)).channel ?? {};
          if (channel === origin.channel) return info;
          if (info.is_im) {
            throw new Error(`Cannot ${action}: that is someone else's direct message with the app.`);
          }
          const isPrivate = Boolean(info.is_private || info.is_mpim || channel.startsWith('G'));
          if (isPrivate || (await requesterIsLimited())) {
            if (!requester) {
              throw new Error(`Cannot ${action}: it is private and this session has no requester to check access for.`);
            }
            if (!(await isMember(channel, requester, action))) {
              throw new Error(
                isPrivate
                  ? `Cannot ${action}: it is a private conversation the person you are working for is not in.`
                  : `Cannot ${action}: the person you are working for is a guest or outside this workspace, and is not in that channel.`,
              );
            }
          }
          return info;
        })();
        visible.set(channel, check);
        check.catch(() => visible.delete(channel));
      }
      return check;
    },
  };
  return session;
}

async function permalink(
  session: SlackSession,
  channel: string,
  ts: string,
  threadTs?: string,
): Promise<string | undefined> {
  const { url } = await session.auth();
  if (!url) return undefined;
  const base = `${url.replace(/\/$/, '')}/archives/${channel}/p${ts.replace('.', '')}`;
  return threadTs && threadTs !== ts ? `${base}?thread_ts=${threadTs}&cid=${channel}` : base;
}

async function present(session: SlackSession, channel: string, messages: SlackResponse[]) {
  return Promise.all(
    messages.map(async m => ({
      ts: m.ts as string,
      author: m.user ? await session.userName(m.user) : (m.username ?? m.bot_profile?.name ?? 'unknown'),
      ...(m.user ? { userId: m.user as string } : {}),
      text: (m.text as string | undefined) ?? '',
      ...(m.reply_count ? { replyCount: m.reply_count as number } : {}),
      permalink: await permalink(session, channel, m.ts, m.thread_ts),
    })),
  );
}

const targetDescription =
  'A channel id (C…/G…), a mention like <#C…> or <@U…>, a user id (U…), or a message permalink. Names like #general are not looked up.';

/**
 * Slack tools for reaching beyond the session's own thread: search a
 * channel, read a thread or channel, and post to a channel, thread or DM.
 *
 * They act with the app's bot token, so they only see conversations the app
 * is in. Private conversations other than the session's own are refused unless
 * the person the session works for is a member. When that person is a guest
 * or from another organization, every other conversation needs their
 * membership and direct messages are refused. Posting refuses Slack
 * Connect channels, people outside the workspace, bots, and the session's own
 * thread (which `reply_in_thread` already covers).
 */
export function createSlackWorkspaceTools(
  requestContext: RequestContext,
  deps: ShareFileToolDeps = {},
): IntegrationTools {
  let session: Promise<SlackSession> | undefined;
  const open = () => {
    session ??= openSession(requestContext, deps);
    session.catch(() => (session = undefined));
    return session;
  };

  return {
    [SLACK_SEARCH_TOOL_NAME]: createTool({
      id: SLACK_SEARCH_TOOL_NAME,
      description:
        "Search recent Slack messages in specific channels for text. Matches messages containing every word of the query (case-insensitive), scanning each channel's newest top-level messages back to `scan`. Defaults to this session's channel. Returns matches with author and permalink; pass a permalink to slack_read to read the whole thread.",
      inputSchema: z.object({
        query: z.string().min(1).describe('Words that must all appear in the message'),
        channels: z
          .array(z.string().min(1))
          .max(10)
          .optional()
          .describe(`Channels to search; defaults to this session's channel. Each is ${targetDescription}`),
        limit: z.number().int().min(1).max(50).optional().describe('Maximum matches to return (default 20)'),
        scan: z
          .number()
          .int()
          .min(1)
          .max(2000)
          .optional()
          .describe('How many recent messages to scan per channel (default 500)'),
      }),
      execute: async ({ query, channels, limit = 20, scan = 500 }) => {
        const s = await open();
        const ids = channels?.length
          ? channels.map(c => {
              const target = parseSlackTarget(c);
              if (target.kind !== 'conversation') throw new Error(`${c} is a person, not a channel.`);
              return target.channel;
            })
          : [s.origin.channel];
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const matches: Array<SlackResponse & { channel: string }> = [];
        const scanned: Record<string, number> = {};
        for (const channel of ids) {
          await s.assertVisible(channel, `search ${channel}`);
          let cursor: string | undefined;
          scanned[channel] = 0;
          while (scanned[channel]! < scan && matches.length < limit) {
            const page = await s.call(
              'conversations.history',
              { channel, limit: Math.min(200, scan - scanned[channel]!), ...(cursor ? { cursor } : {}) },
              `search ${channel}`,
            );
            const messages = (page.messages ?? []) as SlackResponse[];
            scanned[channel]! += messages.length;
            for (const m of messages) {
              const text = String(m.text ?? '').toLowerCase();
              if (words.every(w => text.includes(w))) matches.push({ ...m, channel });
              if (matches.length >= limit) break;
            }
            cursor = page.response_metadata?.next_cursor || undefined;
            if (!cursor || messages.length === 0) break;
          }
        }
        const results = await Promise.all(
          matches.map(async ({ channel, ...m }) => ({ channel, ...(await present(s, channel, [m]))[0]! })),
        );
        return { matches: results, scanned };
      },
    }),

    [SLACK_READ_TOOL_NAME]: createTool({
      id: SLACK_READ_TOOL_NAME,
      description:
        "Read Slack messages. Given a message permalink, returns that message's whole thread. Given a channel, returns its newest top-level messages (pass `thread` with a message ts to read one thread instead). Authors are resolved to names. Defaults to this session's own thread.",
      inputSchema: z.object({
        target: z.string().min(1).optional().describe(`What to read: ${targetDescription}`),
        thread: z.string().optional().describe('With a channel target, the ts of the thread root to read'),
        limit: z.number().int().min(1).max(200).optional().describe('Maximum messages to return (default 50)'),
      }),
      execute: async ({ target, thread, limit = 50 }) => {
        const s = await open();
        let channel: string;
        let root: string | undefined;
        if (target) {
          const parsed = parseSlackTarget(target);
          if (parsed.kind !== 'conversation') throw new Error(`${target} is a person, not a conversation.`);
          channel = parsed.channel;
          root = thread ?? parsed.threadTs ?? parsed.ts;
        } else {
          channel = s.origin.channel;
          root = thread ?? (s.origin.threadTs || undefined);
        }
        const info = await s.assertVisible(channel, `read ${channel}`);
        const page = root
          ? await s.call('conversations.replies', { channel, ts: root, limit }, `read ${channel}`)
          : await s.call('conversations.history', { channel, limit }, `read ${channel}`);
        const messages = ((page.messages ?? []) as SlackResponse[]).slice(0, limit);
        // History is newest first; read it in the order it was written.
        if (!root) messages.reverse();
        return {
          channel: { id: channel, ...(info.name ? { name: `#${info.name}` } : {}) },
          ...(root ? { thread: root } : {}),
          messages: await present(s, channel, messages),
          hasMore: Boolean(page.has_more),
        };
      },
    }),

    [SLACK_SEND_TOOL_NAME]: createTool({
      id: SLACK_SEND_TOOL_NAME,
      description:
        "Post a message somewhere in Slack other than this session's own thread (use reply_in_thread for that): a channel, a reply in another thread (pass its permalink), or a direct message to a teammate (pass their user id or <@U…> mention). The recipient has none of this conversation's context, so make the message self-contained and say what it is about. Slack Connect channels, people outside the workspace and bots are refused.",
      inputSchema: z.object({
        to: z.string().min(1).describe(`Where to post: ${targetDescription}`),
        text: z.string().min(1).max(12000).describe('The message, in markdown'),
        thread: z.string().optional().describe('With a channel target, the ts of a thread to reply in'),
      }),
      execute: async ({ to, text, thread }) => {
        const s = await open();
        const target = parseSlackTarget(to);
        let channel: string;
        let threadTs = '';
        if (target.kind === 'user') {
          if (await s.requesterIsLimited()) {
            throw new Error(
              'Cannot message that person: the person you are working for is a guest or outside this workspace.',
            );
          }
          const user = (await s.call('users.info', { user: target.user }, 'message that person')).user ?? {};
          const { teamId } = await s.auth();
          if (user.deleted) throw new Error(`${to} is a deactivated account.`);
          if (user.is_bot || target.user === 'USLACKBOT') throw new Error(`${to} is a bot, not a teammate.`);
          if (user.is_stranger || (teamId && user.team_id && user.team_id !== teamId)) {
            throw new Error(`${to} is outside this Slack workspace; the app only messages teammates.`);
          }
          const opened = await s.call('conversations.open', { users: target.user }, 'open a direct message');
          channel = opened.channel?.id;
          if (!channel) throw new Error('Slack did not open a direct message channel.');
        } else {
          channel = target.channel;
          threadTs = thread ?? target.threadTs ?? target.ts ?? '';
          const info = await s.assertVisible(channel, `post in ${channel}`);
          if (info.is_ext_shared || info.is_pending_ext_shared) {
            throw new Error(
              `${to} is a Slack Connect channel shared with another organization; the app does not post there.`,
            );
          }
          if (info.is_archived) throw new Error(`${to} is archived.`);
          if (info.is_im && channel !== s.origin.channel) {
            throw new Error(`Cannot post into someone else's direct message; message them by user id instead.`);
          }
        }
        if (channel === s.origin.channel && threadTs === s.origin.threadTs) {
          throw new Error(`That is this session's own thread; use reply_in_thread instead.`);
        }
        let posted: { raw?: unknown };
        try {
          posted = await s.adapter.postMessage(`slack:${channel}:${threadTs}`, { markdown: text });
        } catch (error) {
          throw slackError(error, `post in ${channel}`);
        }
        const ts = (posted.raw as { ts?: string } | undefined)?.ts;
        return {
          posted: true,
          channel,
          ...(threadTs ? { thread: threadTs } : {}),
          ...(ts ? { ts, permalink: await permalink(s, channel, ts, threadTs || undefined) } : {}),
        };
      },
    }),
  };
}
