import { randomUUID } from 'node:crypto';

import type { AgentSignalInput } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { StorageThreadType } from '@mastra/core/memory';
import type { InputProcessorOrWorkflow, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import { SignalProvider, type SignalSubscription } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import z from 'zod';

import { SlackWebApiSyncClient } from './slack-client.js';
export { SlackSignalsApiError, SlackWebApiSyncClient } from './slack-client.js';
export type { SlackWebApiSyncClientOptions } from './slack-client.js';

export const SLACK_SIGNALS_PROVIDER_ID = 'slack-signals';
export const SLACK_SIGNALS_METADATA_KEY = 'slackSignals';
export const SLACK_SUBSCRIBE_TAG = 'slack-subscribe';
export const SLACK_UNSUBSCRIBE_TAG = 'slack-unsubscribe';
export const SLACK_SYNC_STATUS_TAG = 'slack-sync-status';
export const DEFAULT_SLACK_SIGNALS_POLL_INTERVAL_MS = 60_000;

export type SlackConversationType = 'public_channel' | 'private_channel' | 'im' | 'mpim';

export type SlackSignalsIncludeConfig = {
  publicChannels?: boolean;
  privateChannels?: boolean;
  dms?: boolean;
  groupDms?: boolean;
};

export const DEFAULT_SLACK_SIGNALS_INCLUDE: Required<SlackSignalsIncludeConfig> = {
  publicChannels: true,
  privateChannels: true,
  dms: true,
  groupDms: true,
};

export type SlackSignalsWorkspace = {
  teamId: string;
  teamName?: string;
  userId?: string;
  botId?: string;
  url?: string;
};

export type SlackSignalsConversation = {
  id: string;
  name?: string;
  type: SlackConversationType;
  isArchived?: boolean;
  isMember?: boolean;
};

export type SlackSignalsMessage = {
  channelId: string;
  channelName?: string;
  channelType: SlackConversationType;
  ts: string;
  threadTs?: string;
  user?: string;
  username?: string;
  botId?: string;
  text?: string;
  permalink?: string;
};

export type SlackListConversationsInput = {
  types: SlackConversationType[];
  limit?: number;
  abortSignal?: AbortSignal;
};

export type SlackListConversationsResult = {
  conversations: SlackSignalsConversation[];
};

export type SlackListMessagesInput = {
  conversation: SlackSignalsConversation;
  oldest?: string;
  inclusive?: boolean;
  limit?: number;
  abortSignal?: AbortSignal;
};

export type SlackListMessagesResult = {
  messages: SlackSignalsMessage[];
  latestTs?: string;
};

export type SlackSignalsSyncClient = {
  getWorkspace(input?: { abortSignal?: AbortSignal }): Promise<SlackSignalsWorkspace>;
  listConversations(input: SlackListConversationsInput): Promise<SlackListConversationsResult>;
  listMessages(input: SlackListMessagesInput): Promise<SlackListMessagesResult>;
};

export type SlackSignalsChannelState = {
  id: string;
  name?: string;
  type: SlackConversationType;
  latestTs?: string;
  latestMessageHash?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  lastSyncError?: string;
};

export type SlackSignalsSubscription = {
  workspaceId: string;
  workspaceName?: string;
  workspaceUrl?: string;
  userId?: string;
  botId?: string;
  conversationTypes: SlackConversationType[];
  subscribedAt: string;
  updatedAt: string;
  lastSubscribeSignalId: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'skipped';
  lastSyncError?: string;
  channels: Record<string, SlackSignalsChannelState>;
};

export type SlackSignalsThreadMetadata = {
  subscription?: SlackSignalsSubscription;
};

export type SlackNotificationPayload = {
  teamId: string;
  teamName?: string;
  channelId: string;
  channelName?: string;
  channelType: SlackConversationType;
  messageTs: string;
  threadTs?: string;
  user?: string;
  username?: string;
  botId?: string;
  text?: string;
  permalink?: string;
};

export type SlackSignalsThreadStore = {
  getThreadById(input: { threadId: string; resourceId: string }): Promise<StorageThreadType | null | undefined>;
  saveThread(input: { thread: StorageThreadType }): Promise<StorageThreadType>;
};

export type SlackSignalsProviderConfig = {
  token: string;
  pollIntervalMs?: number;
  include?: SlackSignalsIncludeConfig;
  syncClient?: SlackSignalsSyncClient;
  threadStore?: SlackSignalsThreadStore;
  maxMessagesPerChannel?: number;
};

export type SlackSignalsOptions = SlackSignalsProviderConfig;

export type SlackSubscribeSignalInput = void | Record<string, never>;
export type SlackUnsubscribeSignalInput = void | Record<string, never>;

export type SlackOperationResult = {
  workspaceId?: string;
  workspaceName?: string;
  subscription?: SlackSignalsSubscription;
  subscribed?: boolean;
  alreadySubscribed?: boolean;
  alreadyProcessed?: boolean;
  removed?: boolean;
};

export type SlackPollingThread = {
  threadId: string;
  resourceId: string;
};

export type SlackPollResult = {
  notificationsSent: number;
  channelsSynced: number;
  channelsFailed: number;
};

function normalizeIncludeConfig(include: SlackSignalsIncludeConfig = {}): Required<SlackSignalsIncludeConfig> {
  return {
    publicChannels: include.publicChannels ?? DEFAULT_SLACK_SIGNALS_INCLUDE.publicChannels,
    privateChannels: include.privateChannels ?? DEFAULT_SLACK_SIGNALS_INCLUDE.privateChannels,
    dms: include.dms ?? DEFAULT_SLACK_SIGNALS_INCLUDE.dms,
    groupDms: include.groupDms ?? DEFAULT_SLACK_SIGNALS_INCLUDE.groupDms,
  };
}

export function getSlackConversationTypes(include: SlackSignalsIncludeConfig = {}): SlackConversationType[] {
  const normalized = normalizeIncludeConfig(include);
  const types: SlackConversationType[] = [];
  if (normalized.publicChannels) types.push('public_channel');
  if (normalized.privateChannels) types.push('private_channel');
  if (normalized.dms) types.push('im');
  if (normalized.groupDms) types.push('mpim');
  return types;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function compareSlackTimestamps(a: string, b: string): number {
  return Number(a) - Number(b);
}

function isNewerSlackTimestamp(candidate: string, previous?: string): boolean {
  return !previous || compareSlackTimestamps(candidate, previous) > 0;
}

function isSlackConversationType(value: unknown): value is SlackConversationType {
  return value === 'public_channel' || value === 'private_channel' || value === 'im' || value === 'mpim';
}

function getSignalMetadata(message: MastraDBMessage): Record<string, unknown> | undefined {
  if (message.role !== 'signal') return undefined;
  const signal = message.content.metadata?.signal;
  return isPlainObject(signal) ? signal : undefined;
}

function getWorkspaceExternalResourceId(workspaceId: string): string {
  return `slack:workspace:${workspaceId}`;
}

function parseChannelState(rawChannel: unknown): SlackSignalsChannelState | undefined {
  if (!isPlainObject(rawChannel)) return undefined;
  const id = readString(rawChannel.id);
  const type = rawChannel.type;
  if (!id || !isSlackConversationType(type)) return undefined;
  return {
    id,
    type,
    ...(readString(rawChannel.name) ? { name: readString(rawChannel.name)! } : {}),
    ...(readString(rawChannel.latestTs) ? { latestTs: readString(rawChannel.latestTs)! } : {}),
    ...(readString(rawChannel.latestMessageHash) ? { latestMessageHash: readString(rawChannel.latestMessageHash)! } : {}),
    ...(readString(rawChannel.lastSyncAt) ? { lastSyncAt: readString(rawChannel.lastSyncAt)! } : {}),
    ...(rawChannel.lastSyncStatus === 'success' || rawChannel.lastSyncStatus === 'error' || rawChannel.lastSyncStatus === 'skipped'
      ? { lastSyncStatus: rawChannel.lastSyncStatus }
      : {}),
    ...(readString(rawChannel.lastSyncError) ? { lastSyncError: readString(rawChannel.lastSyncError)! } : {}),
  };
}

export function getSlackSignalsMetadata(threadMetadata: Record<string, unknown> | undefined): SlackSignalsThreadMetadata {
  const mastra = isPlainObject(threadMetadata?.mastra) ? threadMetadata.mastra : {};
  const slackSignals = isPlainObject(mastra[SLACK_SIGNALS_METADATA_KEY]) ? mastra[SLACK_SIGNALS_METADATA_KEY] : {};
  const rawSubscription = slackSignals.subscription;

  if (!isPlainObject(rawSubscription)) return {};

  const workspaceId = readString(rawSubscription.workspaceId);
  const subscribedAt = readString(rawSubscription.subscribedAt);
  const updatedAt = readString(rawSubscription.updatedAt);
  const lastSubscribeSignalId = readString(rawSubscription.lastSubscribeSignalId);
  if (!workspaceId || !subscribedAt || !updatedAt || !lastSubscribeSignalId) return {};

  const rawConversationTypes = Array.isArray(rawSubscription.conversationTypes)
    ? rawSubscription.conversationTypes
    : [];
  const conversationTypes = rawConversationTypes.filter(isSlackConversationType);
  const rawChannels = isPlainObject(rawSubscription.channels) ? rawSubscription.channels : {};
  const channels: Record<string, SlackSignalsChannelState> = {};
  for (const [channelId, rawChannel] of Object.entries(rawChannels)) {
    const channel = parseChannelState(rawChannel);
    if (channel) channels[channelId] = channel;
  }

  return {
    subscription: {
      workspaceId,
      ...(readString(rawSubscription.workspaceName) ? { workspaceName: readString(rawSubscription.workspaceName)! } : {}),
      ...(readString(rawSubscription.workspaceUrl) ? { workspaceUrl: readString(rawSubscription.workspaceUrl)! } : {}),
      ...(readString(rawSubscription.userId) ? { userId: readString(rawSubscription.userId)! } : {}),
      ...(readString(rawSubscription.botId) ? { botId: readString(rawSubscription.botId)! } : {}),
      conversationTypes,
      subscribedAt,
      updatedAt,
      lastSubscribeSignalId,
      ...(readString(rawSubscription.lastSyncAt) ? { lastSyncAt: readString(rawSubscription.lastSyncAt)! } : {}),
      ...(rawSubscription.lastSyncStatus === 'success' ||
      rawSubscription.lastSyncStatus === 'error' ||
      rawSubscription.lastSyncStatus === 'skipped'
        ? { lastSyncStatus: rawSubscription.lastSyncStatus }
        : {}),
      ...(readString(rawSubscription.lastSyncError) ? { lastSyncError: readString(rawSubscription.lastSyncError)! } : {}),
      channels,
    },
  };
}

export function setSlackSignalsMetadata(
  threadMetadata: Record<string, unknown> | undefined,
  slackSignals: SlackSignalsThreadMetadata,
): Record<string, unknown> {
  const existing = threadMetadata ?? {};
  const mastra = isPlainObject(existing.mastra) ? existing.mastra : {};
  const existingSlackSignals = isPlainObject(mastra[SLACK_SIGNALS_METADATA_KEY])
    ? mastra[SLACK_SIGNALS_METADATA_KEY]
    : {};
  const nextSlackSignals = { ...existingSlackSignals, ...slackSignals };
  if (!slackSignals.subscription) delete nextSlackSignals.subscription;

  return {
    ...existing,
    mastra: {
      ...mastra,
      [SLACK_SIGNALS_METADATA_KEY]: nextSlackSignals,
    },
  };
}

function getMessageDedupeKey(subscription: SlackSignalsSubscription, message: SlackSignalsMessage): string {
  return `${subscription.workspaceId}:${message.channelId}:${message.ts}`;
}

function getMessageSummary(message: SlackSignalsMessage): string {
  const channel = message.channelName ? `#${message.channelName}` : message.channelId;
  const author = message.username ?? message.user ?? message.botId ?? 'Someone';
  const text = message.text?.trim();
  return text ? `${author} in ${channel}: ${text}` : `${author} posted in ${channel}.`;
}

function createSlackNotificationInput(subscription: SlackSignalsSubscription, message: SlackSignalsMessage) {
  const dedupeKey = getMessageDedupeKey(subscription, message);
  const payload: SlackNotificationPayload = {
    teamId: subscription.workspaceId,
    ...(subscription.workspaceName ? { teamName: subscription.workspaceName } : {}),
    channelId: message.channelId,
    ...(message.channelName ? { channelName: message.channelName } : {}),
    channelType: message.channelType,
    messageTs: message.ts,
    ...(message.threadTs ? { threadTs: message.threadTs } : {}),
    ...(message.user ? { user: message.user } : {}),
    ...(message.username ? { username: message.username } : {}),
    ...(message.botId ? { botId: message.botId } : {}),
    ...(message.text ? { text: message.text } : {}),
    ...(message.permalink ? { permalink: message.permalink } : {}),
  };

  return {
    source: 'slack',
    kind: 'slack-message',
    summary: getMessageSummary(message),
    priority: 'medium' as const,
    sourceId: dedupeKey,
    dedupeKey,
    coalesceKey: `${subscription.workspaceId}:${message.channelId}`,
    payload,
    attributes: {
      teamId: subscription.workspaceId,
      channelId: message.channelId,
      channelType: message.channelType,
      messageTs: message.ts,
    },
  };
}

export class SlackSignalsProvider extends SignalProvider<'slack-signals'> {
  readonly id = SLACK_SIGNALS_PROVIDER_ID;
  override readonly name = 'Slack Signals';
  override readonly pollInterval?: number;

  static signals = {
    subscribe(): AgentSignalInput {
      return {
        type: 'reactive',
        tagName: SLACK_SUBSCRIBE_TAG,
        contents: 'Subscribe to Slack',
        metadata: {
          slack: {
            action: 'subscribe',
          },
        },
      };
    },
    unsubscribe(): AgentSignalInput {
      return {
        type: 'reactive',
        tagName: SLACK_UNSUBSCRIBE_TAG,
        contents: 'Unsubscribe from Slack',
        metadata: {
          slack: {
            action: 'unsubscribe',
          },
        },
      };
    },
  };

  readonly #options: SlackSignalsProviderConfig;
  readonly #include: Required<SlackSignalsIncludeConfig>;
  readonly #syncClient: SlackSignalsSyncClient;

  constructor(options: SlackSignalsProviderConfig) {
    super();
    this.#options = options;
    this.#include = normalizeIncludeConfig(options.include);
    this.#syncClient = options.syncClient ?? new SlackWebApiSyncClient({ token: options.token });
    this.pollInterval = options.pollIntervalMs ?? DEFAULT_SLACK_SIGNALS_POLL_INTERVAL_MS;
  }

  get include(): Required<SlackSignalsIncludeConfig> {
    return this.#include;
  }

  get conversationTypes(): SlackConversationType[] {
    return getSlackConversationTypes(this.#include);
  }

  get token(): string {
    return this.#options.token;
  }

  async poll(subscriptions: SignalSubscription[]): Promise<void> {
    const seen = new Set<string>();
    for (const subscription of subscriptions) {
      const key = `${subscription.resourceId}:${subscription.threadId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await this.#pollThread({ threadId: subscription.threadId, resourceId: subscription.resourceId });
    }
  }

  async pollThreadNow(input: SlackPollingThread): Promise<SlackPollResult> {
    return this.#pollThread(input);
  }

  getInputProcessors(): InputProcessorOrWorkflow[] {
    return [this];
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const tools = this.#createTools(args);
    if (args.stepNumber !== 0) return { tools };

    const signal = this.#findLatestSlackSignal(args.messages);
    if (!signal) return { tools };

    const threadContext = this.#getThreadContext(args);
    if (signal.tagName === SLACK_UNSUBSCRIBE_TAG) {
      const result = await this.#unsubscribe({ ...signal, ...threadContext });
      await this.#sendStatus(args, result, {
        status: result.removed ? 'unsubscribed' : 'not_subscribed',
        action: 'unsubscribe',
        message: result.removed
          ? `Unsubscribed this thread from Slack workspace ${result.workspaceName ?? result.workspaceId}.`
          : 'This thread is not subscribed to Slack.',
      });
      return { tools };
    }

    const result = await this.#subscribe({ ...signal, ...threadContext, abortSignal: args.abortSignal });
    if (result.alreadyProcessed) return { tools };
    await this.#sendStatus(args, result, {
      status: result.alreadySubscribed ? 'already_subscribed' : 'subscribed',
      action: 'subscribe',
      message: result.alreadySubscribed
        ? `This thread is already subscribed to Slack workspace ${result.workspaceName ?? result.workspaceId}.`
        : `Subscribed this thread to Slack workspace ${result.workspaceName ?? result.workspaceId}.`,
    });
    return { tools };
  }

  async subscribeThreadToSlack(input: { threadId?: string; resourceId?: string; abortSignal?: AbortSignal }): Promise<SlackOperationResult> {
    return this.#subscribe({ id: `slack-command-subscribe-${randomUUID()}`, ...input });
  }

  async unsubscribeThreadFromSlack(input: { threadId?: string; resourceId?: string }): Promise<SlackOperationResult> {
    return this.#unsubscribe({ id: `slack-command-unsubscribe-${randomUUID()}`, ...input });
  }

  async #pollThread(input: SlackPollingThread): Promise<SlackPollResult> {
    const { threadStore, loadedThread } = await this.#loadThread(input);
    const slackMetadata = getSlackSignalsMetadata(loadedThread.metadata);
    const subscription = slackMetadata.subscription;
    if (!subscription) {
      this.unsubscribeAll(input);
      return { notificationsSent: 0, channelsSynced: 0, channelsFailed: 0 };
    }

    const now = new Date().toISOString();
    const channels: Record<string, SlackSignalsChannelState> = { ...subscription.channels };
    let notificationsSent = 0;
    let channelsSynced = 0;
    let channelsFailed = 0;
    let lastSyncStatus: 'success' | 'error' = 'success';
    let lastSyncError: string | undefined;

    let conversations: SlackSignalsConversation[] = [];
    try {
      conversations = (
        await this.#syncClient.listConversations({
          types: subscription.conversationTypes.length > 0 ? subscription.conversationTypes : this.conversationTypes,
        })
      ).conversations;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextSubscription: SlackSignalsSubscription = {
        ...subscription,
        updatedAt: now,
        lastSyncAt: now,
        lastSyncStatus: 'error',
        lastSyncError: message,
        channels,
      };
      await this.#saveSubscription(threadStore, loadedThread, input, nextSubscription);
      return { notificationsSent: 0, channelsSynced: 0, channelsFailed: 0 };
    }

    for (const conversation of conversations) {
      const previous = channels[conversation.id];
      try {
        const result = await this.#syncClient.listMessages({
          conversation,
          oldest: previous?.latestTs,
          inclusive: false,
          limit: this.#options.maxMessagesPerChannel,
        });
        const newMessages = result.messages.filter(message => isNewerSlackTimestamp(message.ts, previous?.latestTs));
        const latestTs = result.latestTs && isNewerSlackTimestamp(result.latestTs, previous?.latestTs)
          ? result.latestTs
          : previous?.latestTs;

        if (!previous?.latestTs) {
          channels[conversation.id] = {
            id: conversation.id,
            ...(conversation.name ? { name: conversation.name } : {}),
            type: conversation.type,
            ...(latestTs ? { latestTs } : {}),
            lastSyncAt: now,
            lastSyncStatus: 'success',
          };
          channelsSynced += 1;
          continue;
        }

        for (const message of newMessages) {
          await this.notify(createSlackNotificationInput(subscription, message), input);
          notificationsSent += 1;
        }

        channels[conversation.id] = {
          id: conversation.id,
          ...(conversation.name ? { name: conversation.name } : previous?.name ? { name: previous.name } : {}),
          type: conversation.type,
          ...(latestTs ? { latestTs } : {}),
          lastSyncAt: now,
          lastSyncStatus: 'success',
        };
        channelsSynced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        channels[conversation.id] = {
          id: conversation.id,
          ...(conversation.name ? { name: conversation.name } : previous?.name ? { name: previous.name } : {}),
          type: conversation.type,
          ...(previous?.latestTs ? { latestTs: previous.latestTs } : {}),
          ...(previous?.latestMessageHash ? { latestMessageHash: previous.latestMessageHash } : {}),
          lastSyncAt: now,
          lastSyncStatus: 'error',
          lastSyncError: message,
        };
        channelsFailed += 1;
        lastSyncStatus = 'error';
        lastSyncError = message;
      }
    }

    const nextSubscription: SlackSignalsSubscription = {
      ...subscription,
      updatedAt: now,
      lastSyncAt: now,
      lastSyncStatus,
      ...(lastSyncError ? { lastSyncError } : {}),
      channels,
    };
    if (!lastSyncError) delete nextSubscription.lastSyncError;
    await this.#saveSubscription(threadStore, loadedThread, input, nextSubscription);

    return { notificationsSent, channelsSynced, channelsFailed };
  }

  async #saveSubscription(
    threadStore: SlackSignalsThreadStore,
    loadedThread: StorageThreadType,
    input: SlackPollingThread,
    subscription: SlackSignalsSubscription,
  ): Promise<void> {
    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        id: input.threadId,
        resourceId: input.resourceId,
        createdAt: loadedThread.createdAt ?? new Date(),
        updatedAt: new Date(),
        metadata: setSlackSignalsMetadata(loadedThread.metadata, { subscription }),
      },
    });
  }

  async #resolveThreadStore(): Promise<SlackSignalsThreadStore | undefined> {
    if (this.#options.threadStore) return this.#options.threadStore;
    const storage = this.mastra?.getStorage?.();
    const memoryStore = storage?.getStore ? await storage.getStore('memory') : undefined;
    return memoryStore as SlackSignalsThreadStore | undefined;
  }

  #getThreadContext(args: { requestContext?: ProcessInputStepArgs['requestContext'] }): {
    threadId?: string;
    resourceId?: string;
  } {
    const memoryContext = args.requestContext?.get('MastraMemory') as
      | { thread?: { id?: string }; resourceId?: string }
      | undefined;
    return { threadId: memoryContext?.thread?.id, resourceId: memoryContext?.resourceId };
  }

  #createTools(args: ProcessInputStepArgs): Record<string, unknown> {
    const threadContext = this.#getThreadContext(args);
    const getExecutionThreadContext = (context?: { agent?: { threadId?: string; resourceId?: string } }) => ({
      threadId: context?.agent?.threadId ?? threadContext.threadId,
      resourceId: context?.agent?.resourceId ?? threadContext.resourceId,
    });

    return {
      ...args.tools,
      slack_subscribe: createTool({
        id: 'slack_subscribe',
        description:
          'Subscribe this thread to Slack activity. Watches all reachable DMs, group DMs, public channels, and private channels for the configured token.',
        inputSchema: z.object({}).optional(),
        execute: async (_input, context) => {
          const executionThreadContext = getExecutionThreadContext(context);
          const result = await this.#subscribe({
            id: `slack-tool-subscribe-${randomUUID()}`,
            threadId: executionThreadContext.threadId,
            resourceId: executionThreadContext.resourceId,
            abortSignal: context?.abortSignal,
          });
          return {
            subscribed: true,
            alreadySubscribed: result.alreadySubscribed ?? false,
            workspaceId: result.workspaceId,
            workspaceName: result.workspaceName,
            message: result.alreadySubscribed
              ? `This thread is already subscribed to Slack workspace ${result.workspaceName ?? result.workspaceId}.`
              : `Subscribed this thread to Slack workspace ${result.workspaceName ?? result.workspaceId}.`,
          };
        },
      }),
      slack_unsubscribe: createTool({
        id: 'slack_unsubscribe',
        description: 'Unsubscribe this thread from Slack activity.',
        inputSchema: z.object({}).optional(),
        execute: async (_input, context) => {
          const executionThreadContext = getExecutionThreadContext(context);
          const result = await this.#unsubscribe({
            id: `slack-tool-unsubscribe-${randomUUID()}`,
            threadId: executionThreadContext.threadId,
            resourceId: executionThreadContext.resourceId,
          });
          return {
            unsubscribed: result.removed ?? false,
            workspaceId: result.workspaceId,
            workspaceName: result.workspaceName,
            message: result.removed
              ? `Unsubscribed this thread from Slack workspace ${result.workspaceName ?? result.workspaceId}.`
              : 'This thread is not subscribed to Slack.',
          };
        },
      }),
    };
  }

  async #loadThread(input: { threadId?: string; resourceId?: string }) {
    const threadStore = await this.#resolveThreadStore();
    if (!threadStore) throw new Error('Slack subscription requires memory-backed thread storage.');
    if (!input.threadId || !input.resourceId) throw new Error('Slack subscription requires threadId and resourceId.');
    const loadedThread =
      (await threadStore.getThreadById({ threadId: input.threadId, resourceId: input.resourceId })) ?? undefined;
    if (!loadedThread) throw new Error(`Could not load thread ${input.threadId}.`);
    return { threadStore, loadedThread };
  }

  async #subscribe(input: {
    id: string;
    threadId?: string;
    resourceId?: string;
    abortSignal?: AbortSignal;
  }): Promise<SlackOperationResult> {
    const workspace = await this.#syncClient.getWorkspace({ abortSignal: input.abortSignal });
    const { threadStore, loadedThread } = await this.#loadThread(input);
    const slackMetadata = getSlackSignalsMetadata(loadedThread.metadata);
    const existing = slackMetadata.subscription;
    if (existing?.lastSubscribeSignalId === input.id) {
      return {
        workspaceId: existing.workspaceId,
        workspaceName: existing.workspaceName,
        subscription: existing,
        alreadySubscribed: true,
        alreadyProcessed: true,
      };
    }

    const now = new Date().toISOString();
    const subscription: SlackSignalsSubscription = {
      workspaceId: workspace.teamId,
      ...(workspace.teamName ? { workspaceName: workspace.teamName } : {}),
      ...(workspace.url ? { workspaceUrl: workspace.url } : {}),
      ...(workspace.userId ? { userId: workspace.userId } : {}),
      ...(workspace.botId ? { botId: workspace.botId } : {}),
      conversationTypes: this.conversationTypes,
      subscribedAt: existing?.subscribedAt ?? now,
      updatedAt: now,
      lastSubscribeSignalId: input.id,
      ...(existing?.lastSyncAt ? { lastSyncAt: existing.lastSyncAt } : {}),
      ...(existing?.lastSyncStatus ? { lastSyncStatus: existing.lastSyncStatus } : {}),
      ...(existing?.lastSyncError ? { lastSyncError: existing.lastSyncError } : {}),
      channels: existing?.channels ?? {},
    };

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        id: input.threadId!,
        resourceId: input.resourceId!,
        createdAt: loadedThread.createdAt ?? new Date(),
        updatedAt: new Date(),
        metadata: setSlackSignalsMetadata(loadedThread.metadata, { subscription }),
      },
    });
    this.subscribe(
      { threadId: input.threadId!, resourceId: input.resourceId! },
      getWorkspaceExternalResourceId(workspace.teamId),
      { workspaceId: workspace.teamId, workspaceName: workspace.teamName },
    );

    return {
      workspaceId: workspace.teamId,
      workspaceName: workspace.teamName,
      subscription,
      subscribed: true,
      alreadySubscribed: Boolean(existing),
    };
  }

  async #unsubscribe(input: { id: string; threadId?: string; resourceId?: string }): Promise<SlackOperationResult> {
    const { threadStore, loadedThread } = await this.#loadThread(input);
    const slackMetadata = getSlackSignalsMetadata(loadedThread.metadata);
    const existing = slackMetadata.subscription;
    if (!existing) return { removed: false };

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        id: input.threadId!,
        resourceId: input.resourceId!,
        createdAt: loadedThread.createdAt ?? new Date(),
        updatedAt: new Date(),
        metadata: setSlackSignalsMetadata(loadedThread.metadata, {}),
      },
    });
    this.unsubscribe({ threadId: input.threadId!, resourceId: input.resourceId! }, getWorkspaceExternalResourceId(existing.workspaceId));

    return {
      workspaceId: existing.workspaceId,
      workspaceName: existing.workspaceName,
      subscription: existing,
      removed: true,
    };
  }

  #findLatestSlackSignal(messages: MastraDBMessage[]): { tagName: string; id: string } | undefined {
    const message = messages.at(-1);
    if (!message) return undefined;

    const signal = getSignalMetadata(message);
    if (!signal || (signal.tagName !== SLACK_SUBSCRIBE_TAG && signal.tagName !== SLACK_UNSUBSCRIBE_TAG)) {
      return undefined;
    }

    return {
      tagName: String(signal.tagName),
      id: readString(signal.id) ?? message.id,
    };
  }

  async #sendStatus(
    args: ProcessInputStepArgs,
    signal: SlackOperationResult,
    status: {
      status: 'subscribed' | 'already_subscribed' | 'unsubscribed' | 'not_subscribed';
      action: 'subscribe' | 'unsubscribe';
      message: string;
    },
  ) {
    await args.sendSignal?.({
      type: 'reactive',
      tagName: SLACK_SYNC_STATUS_TAG,
      contents: status.message,
      attributes: {
        status: status.status,
        ...(signal.workspaceId ? { workspaceId: signal.workspaceId } : {}),
        ...(signal.workspaceName ? { workspaceName: signal.workspaceName } : {}),
      },
      metadata: {
        slack: {
          action: status.action,
          status: status.status,
          ...(signal.workspaceId ? { workspaceId: signal.workspaceId } : {}),
          ...(signal.workspaceName ? { workspaceName: signal.workspaceName } : {}),
        },
      },
    });
  }
}

export const SlackSignals = SlackSignalsProvider;
