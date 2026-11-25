import type { Adapter, Chat } from 'chat';

import { createTool } from '../tools/tool';
import type { ToolAction, ToolExecutionContext } from '../tools/types';

import type { AgentChannels } from './agent-channels';

/** What the channel tools may reach. Every field is optional. */
export interface ChannelToolsOptions {
  /**
   * Which channels the tools may read and post in: only the conversation's
   * own channel (`'session'`), that channel plus `channelIds` (`'selected'`),
   * or any channel the bot is a member of (`'all'`).
   *
   * @default 'session'
   */
  channels?: 'session' | 'selected' | 'all';
  /**
   * Full channel ids (e.g. `'slack:C0123ABC'`) the tools may use when
   * `channels` is `'selected'`.
   *
   * @default []
   */
  channelIds?: string[];
  /**
   * `'post'` lets the tools post wherever they can read; `'read'` lets them
   * read those channels but post only in the conversation's own channel.
   *
   * @default 'post'
   */
  access?: 'read' | 'post';
  /**
   * `'anyone'` adds a `sendDirectMessage` tool that messages any person.
   * Other people's direct messages with the bot, including group DMs, are never
   * readable either way.
   *
   * @default 'none'
   */
  directMessages?: 'none' | 'anyone';
}

/** {@link ChannelToolsOptions} with every default filled in. */
export type ChannelToolsSettings = Required<ChannelToolsOptions>;

/**
 * The conversation a channel tool runs in and the checks it must pass. The
 * tools resolve it from the run each time they are called, unless one is
 * passed in as `scope`.
 */
export interface ChannelToolScope {
  chat: Chat;
  /** The adapter of the conversation's platform. */
  adapter: Adapter;
  /** The conversation's platform, e.g. `'slack'`. */
  platform: string;
  /** The conversation's own thread id, e.g. `'slack:C123:1712345678.000100'`. */
  threadId: string;
  /** The conversation's own channel id, e.g. `'slack:C123'`. */
  channelId: string;
  settings: ChannelToolsSettings;
  /** The channel a thread or channel id belongs to. */
  channelOf(id: string): string;
  /** Rejects unless the tool may read `id` (a thread or channel id). */
  assertReadable(id: string): Promise<void>;
  /** Rejects unless the tool may post in `id` (a thread or channel id). */
  assertPostable(id: string): Promise<void>;
  /** One sentence naming the channels this conversation can use. */
  describe(): string;
}

/** Options for {@link createChannelTools} and platform tool sets built the same way. */
export interface CreateChannelToolsOptions extends ChannelToolsOptions {
  /**
   * A fixed conversation for every call, from {@link createChannelToolScope}.
   * Its settings replace the options above. Without it, each call uses the
   * conversation the run is in.
   */
  scope?: ChannelToolScope;
}

export type ChannelTools = Record<string, ToolAction<any, any, any, any, any>>;

export const DEFAULT_CHANNEL_TOOLS_SETTINGS: ChannelToolsSettings = {
  channels: 'session',
  channelIds: [],
  access: 'post',
  directMessages: 'none',
};

export function resolveChannelToolsSettings(options: ChannelToolsOptions = {}): ChannelToolsSettings {
  // An explicit `undefined` means "use the default", not "unset it".
  const granted = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
  const settings: ChannelToolsSettings = { ...DEFAULT_CHANNEL_TOOLS_SETTINGS, ...granted };
  const bare = settings.channelIds.filter(id => !id.includes(':'));
  if (bare.length) {
    throw new Error(
      `channelIds must be full chat ids with the platform prefix, e.g. "slack:${bare[0]}". Got: ${bare.join(', ')}.`,
    );
  }
  return settings;
}

/** The channel a thread or channel id belongs to, as the Chat SDK resolves it. */
function channelOf(chat: Chat, id: string): string {
  const prefix = id.split(':')[0];
  const adapter = prefix ? (chat.getAdapter(prefix as never) as Adapter | undefined) : undefined;
  return adapter?.channelIdFromThreadId?.(id) ?? id.split(':').slice(0, 2).join(':');
}

/** `undefined` when the platform can't tell whether the channel is a DM. */
function isDirectMessage(chat: Chat, channelId: string): boolean | undefined {
  const prefix = channelId.split(':')[0];
  const adapter = prefix ? (chat.getAdapter(prefix as never) as Adapter | undefined) : undefined;
  return adapter?.isDM?.(channelId);
}

function describeSettings(settings: ChannelToolsSettings, own: string): string {
  const channels =
    settings.channels === 'all'
      ? 'any channel the bot is a member of'
      : [own, ...(settings.channels === 'selected' ? settings.channelIds : [])].join(', ');
  const readOnly = settings.access === 'read' ? " (read only: post only in this conversation's own channel)" : '';
  return `Channels this conversation can use: ${channels}${readOnly}.`;
}

/**
 * The checks every channel tool runs before it reads or posts: the
 * conversation may use its own channel, plus whatever `settings` grant.
 * Other people's direct messages with the bot stay off limits even when every
 * channel is granted.
 */
export function createChannelToolScope({
  chat,
  adapter,
  platform,
  threadId,
  settings,
}: {
  chat: Chat;
  adapter: Adapter;
  platform: string;
  threadId: string;
  settings: ChannelToolsSettings;
}): ChannelToolScope {
  const ownChannel = channelOf(chat, threadId);
  const all = settings.channels === 'all';
  const allowed = new Set([ownChannel, ...(settings.channels === 'selected' ? settings.channelIds : [])]);
  const describe = () => `${describeSettings(settings, ownChannel)} This conversation's thread is ${threadId}.`;

  // Group DMs can look like ordinary channels to `adapter.isDM`, so channels
  // other than the conversation's own are also checked against their metadata.
  const dmLookups = new Map<string, Promise<boolean>>();
  const isDirectMessageChannel = (channel: string) => {
    let lookup = dmLookups.get(channel);
    if (!lookup) {
      lookup = chat
        .channel(channel)
        .fetchMetadata()
        .then(info => Boolean(info.isDM));
      lookup.catch(() => dmLookups.delete(channel));
      dmLookups.set(channel, lookup);
    }
    return lookup;
  };
  const refuseDirectMessage = (id: string): never => {
    throw new Error(
      `"${id}" is someone else's direct message with the bot.${
        settings.directMessages === 'anyone' ? ' Use sendDirectMessage to message a person.' : ''
      }`,
    );
  };

  const assertReadable = async (id: string) => {
    const prefix = id.split(':')[0];
    if (!prefix || !chat.getAdapter(prefix as never)) {
      throw new Error(`"${id}" isn't a full chat id. Use the platform prefix, e.g. "${ownChannel}".`);
    }
    const channel = channelOf(chat, id);
    const dm = channel === ownChannel ? false : isDirectMessage(chat, channel);
    if (dm) refuseDirectMessage(id);
    // A platform that can't classify DMs could hide one behind `channels: 'all'`,
    // so there only channels granted by id are allowed.
    if (dm === undefined && !allowed.has(channel)) {
      throw new Error(
        `"${id}" can't be checked for being someone else's direct message, so this conversation can only use channels granted by id. ${describe()}`,
      );
    }
    if (!all && !allowed.has(channel)) {
      throw new Error(`"${id}" is outside the channels this conversation can use. ${describe()}`);
    }
    if (channel !== ownChannel && (await isDirectMessageChannel(channel))) refuseDirectMessage(id);
  };

  const assertPostable = async (id: string) => {
    if (settings.access === 'read') {
      await assertReadable(id);
      if (channelOf(chat, id) !== ownChannel) {
        throw new Error(
          `"${id}" is read only for this conversation: it can only post in its own channel, ${ownChannel}.`,
        );
      }
      return;
    }
    await assertReadable(id);
  };

  return {
    chat,
    adapter,
    platform,
    threadId,
    channelId: ownChannel,
    settings,
    channelOf: id => channelOf(chat, id),
    assertReadable,
    assertPostable,
    describe,
  };
}

/**
 * The conversation a tool call runs in: the fixed `scope` when one was given,
 * otherwise the channel thread of the run calling the tool, found through the
 * calling agent's channels the same way `add_reaction` finds it. For tools
 * built like {@link createChannelTools}, e.g. a platform's own tool set.
 */
export function channelToolScopeResolver(options: CreateChannelToolsOptions = {}): {
  settings: ChannelToolsSettings;
  resolve(context: ToolExecutionContext | undefined): Promise<ChannelToolScope>;
} {
  const { scope, ...granted } = options;
  const settings = scope?.settings ?? resolveChannelToolsSettings(granted);
  return {
    settings,
    resolve: async context => {
      if (scope) return scope;
      const agentId = context?.agent?.agentId;
      const mastra = context?.mastra as
        | { getAgentById?(id: string): { getChannels?(): AgentChannels | null } }
        | undefined;
      let channels: AgentChannels | null | undefined;
      try {
        channels = agentId ? mastra?.getAgentById?.(agentId)?.getChannels?.() : undefined;
      } catch {
        channels = undefined;
      }
      if (!channels) {
        throw new Error('Channel tools only work for an agent with channels, in a run linked to a channel thread.');
      }
      return channels.__resolveToolScope(context, settings);
    },
  };
}

/**
 * The Chat SDK's own tool definitions, through its TanStack entry because it
 * needs only `zod` (`chat/ai` also needs `ai`). Loaded lazily like `chat`
 * itself, which is ESM only. Requires zod 4.2 or newer.
 */
async function loadSpecs(chat: Chat) {
  const { createTanStackTools } = await import(/* @vite-ignore */ /* webpackIgnore: true */ 'chat/ai/tanstack');
  let specs: ReturnType<typeof createTanStackTools>;
  try {
    // Workspace-wide on the SDK side: the scope checks decide what is allowed.
    specs = createTanStackTools({ chat, scope: false, requireApproval: false });
  } catch (error) {
    throw new Error(`Channel tools could not be loaded: ${(error as Error).message}`, { cause: error });
  }
  return Object.fromEntries(specs.map(spec => [spec.name, spec]));
}

type ChatToolSpecs = Awaited<ReturnType<typeof loadSpecs>>;

// Specs bind the Chat they were built with, so each Chat gets its own.
const specsByChat = new WeakMap<Chat, Promise<ChatToolSpecs>>();
function specsFor(chat: Chat): Promise<ChatToolSpecs> {
  let specs = specsByChat.get(chat);
  if (!specs) {
    specs = loadSpecs(chat);
    specsByChat.set(chat, specs);
  }
  return specs;
}

/** Which id each tool targets, and whether it reads or posts there. */
const CHAT_TOOLS = {
  fetchMessages: { target: 'threadId', post: false },
  fetchChannelMessages: { target: 'channelId', post: false },
  fetchThread: { target: 'threadId', post: false },
  listThreads: { target: 'channelId', post: false },
  getThreadParticipants: { target: 'threadId', post: false },
  getChannelInfo: { target: 'channelId', post: false },
  postMessage: { target: 'threadId', post: true },
  postChannelMessage: { target: 'channelId', post: true },
} as const;

export type ChannelToolName = keyof typeof CHAT_TOOLS | 'sendDirectMessage';

/**
 * The Chat SDK's read and post tools, for an agent with channels:
 * fetchMessages, fetchChannelMessages, fetchThread, listThreads,
 * getThreadParticipants, getChannelInfo, postMessage, postChannelMessage, and
 * sendDirectMessage when `directMessages` is `'anyone'`. Names, inputs and
 * outputs are the SDK's; posting needs no approval.
 *
 * Each call works in the channel thread of the run calling it and stays
 * inside the channels the options grant (by default, only that
 * conversation's own channel). Nothing is added to the agent for you:
 *
 * ```ts
 * const agent = new Agent({
 *   tools: { ...(await createChannelTools({ access: 'read' })) },
 *   channels: { adapters: { slack: createSlackAdapter() } },
 * });
 * ```
 *
 * Requires zod 4.2 or newer.
 */
export async function createChannelTools(options: CreateChannelToolsOptions = {}): Promise<ChannelTools> {
  const { settings, resolve } = channelToolScopeResolver(options);
  // The schemas and descriptions don't depend on the Chat; execution does.
  const templates = options.scope ? await specsFor(options.scope.chat) : await loadSpecs({} as Chat);
  const note = ` ${options.scope ? options.scope.describe() : describeSettings(settings, "this conversation's own channel")}`;
  const tools: ChannelTools = {};

  const build = (
    name: ChannelToolName,
    check: (scope: ChannelToolScope, input: Record<string, unknown>) => void | Promise<void>,
  ) => {
    const template = templates[name];
    if (!template) return;
    tools[name] = createTool({
      id: name,
      description: name === 'sendDirectMessage' ? template.description : `${template.description}${note}`,
      inputSchema: template.inputSchema,
      execute: async (input: unknown, context) => {
        const scope = await resolve(context);
        await check(scope, input as Record<string, unknown>);
        const spec = (await specsFor(scope.chat))[name]!;
        return spec.execute(input);
      },
    });
  };

  for (const [name, { target, post }] of Object.entries(CHAT_TOOLS)) {
    build(name as ChannelToolName, async (scope, input) => {
      const id = String(input[target]);
      // Given a thread id, some platforms (Slack) silently post a new
      // top-level message instead of replying in that thread.
      if (name === 'postChannelMessage' && scope.channelOf(id) !== id) {
        throw new Error(`"${id}" is a thread, not a channel. Use postMessage to reply in a thread.`);
      }
      if (post) await scope.assertPostable(id);
      else await scope.assertReadable(id);
    });
  }
  if (settings.directMessages === 'anyone') {
    build('sendDirectMessage', scope => {
      if (scope.settings.access === 'read') {
        throw new Error(`This conversation is read only: it can only post in its own channel, ${scope.channelId}.`);
      }
    });
  }
  return tools;
}
