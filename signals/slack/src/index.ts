import { randomUUID } from 'node:crypto';

import type { AgentSignalInput } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { StorageThreadType } from '@mastra/core/memory';
import type { InputProcessorOrWorkflow, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget } from '@mastra/core/signals';
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

export type SlackNotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SlackSignalsFilterConfig = {
  includeChannelIds?: string[];
  excludeChannelIds?: string[];
  includeChannelNames?: string[];
  excludeChannelNames?: string[];
  keywords?: string[];
  ignoreBotMessages?: boolean;
  ignoredBotIds?: string[];
  ignoredUserIds?: string[];
  maxPreviewLength?: number;
  priority?: {
    channels?: SlackNotificationPriority;
    dms?: SlackNotificationPriority;
    groupDms?: SlackNotificationPriority;
    mentions?: SlackNotificationPriority;
  };
};

type NormalizedSlackSignalsFilterConfig = Required<Omit<SlackSignalsFilterConfig, 'priority'>> & {
  priority: Required<NonNullable<SlackSignalsFilterConfig['priority']>>;
};

export const DEFAULT_SLACK_SIGNALS_INCLUDE: Required<SlackSignalsIncludeConfig> = {
  publicChannels: true,
  privateChannels: true,
  dms: true,
  groupDms: true,
};

export const DEFAULT_SLACK_SIGNALS_FILTERS: NormalizedSlackSignalsFilterConfig = {
  includeChannelIds: [],
  excludeChannelIds: [],
  includeChannelNames: [],
  excludeChannelNames: [],
  keywords: [],
  ignoreBotMessages: false,
  ignoredBotIds: [],
  ignoredUserIds: [],
  maxPreviewLength: 240,
  priority: {
    channels: 'low',
    dms: 'high',
    groupDms: 'high',
    mentions: 'high',
  },
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
  /** User ID that this IM conversation is with (only for type='im') */
  user?: string;
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

export type SlackMessageRef = {
  teamId?: string;
  channelId: string;
  channelName?: string;
  channelType?: SlackConversationType;
  messageTs: string;
  threadTs?: string;
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
  latest?: string;
  inclusive?: boolean;
  limit?: number;
  maxPages?: number;
  abortSignal?: AbortSignal;
};

export type SlackListThreadMessagesInput = {
  conversation: SlackSignalsConversation;
  threadTs: string;
  limit?: number;
  maxPages?: number;
  abortSignal?: AbortSignal;
};

export type SlackListMessagesResult = {
  messages: SlackSignalsMessage[];
  latestTs?: string;
};

export type SlackListThreadMessagesResult = {
  messages: SlackSignalsMessage[];
};

export type SlackGetConversationInput = {
  channelId: string;
  abortSignal?: AbortSignal;
};

export type SlackSignalsSyncClient = {
  getWorkspace(input?: { abortSignal?: AbortSignal }): Promise<SlackSignalsWorkspace>;
  listConversations(input: SlackListConversationsInput): Promise<SlackListConversationsResult>;
  listMessages(input: SlackListMessagesInput): Promise<SlackListMessagesResult>;
  listThreadMessages(input: SlackListThreadMessagesInput): Promise<SlackListThreadMessagesResult>;
  getConversation(input: SlackGetConversationInput): Promise<SlackSignalsConversation>;
  listUsers(input?: { abortSignal?: AbortSignal }): Promise<SlackSignalsUser[]>;
};

export type SlackSignalsUser = {
  id: string;
  name: string;
  displayName: string;
  realName: string;
};

export type SlackSignalsChannelState = {
  id: string;
  name?: string;
  type: SlackConversationType;
  latestTs?: string;
  latestMessageHash?: string;
  subscribedAt?: string;
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
  slackMessageRef: SlackMessageRef;
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


export type SlackReadConversationInput = {
  channelId?: string;
  channelName?: string;
  aroundTs: string;
  before?: number;
  after?: number;
  abortSignal?: AbortSignal;
};

export type SlackReadConversationResult = {
  slackMessageRef: SlackMessageRef;
  channel: SlackSignalsConversation;
  messages: SlackSignalsMessage[];
};

export type SlackReadThreadInput = {
  channelId?: string;
  channelName?: string;
  threadTs: string;
  limit?: number;
  abortSignal?: AbortSignal;
};

export type SlackReadThreadResult = {
  slackMessageRef: SlackMessageRef;
  channel: SlackSignalsConversation;
  messages: SlackSignalsMessage[];
};

export type SlackSignalsThreadStore = {
  getThreadById(input: { threadId: string; resourceId: string }): Promise<StorageThreadType | null | undefined>;
  saveThread(input: { thread: StorageThreadType }): Promise<StorageThreadType>;
};

export type SlackSignalsProviderConfig = {
  token: string;
  pollIntervalMs?: number;
  include?: SlackSignalsIncludeConfig;
  filters?: SlackSignalsFilterConfig;
  syncClient?: SlackSignalsSyncClient;
  threadStore?: SlackSignalsThreadStore;
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
  addedChannels?: string[];
  removedChannels?: string[];
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

function normalizeStringList(values: string[] | undefined): string[] {
  return values?.map(value => value.trim()).filter(Boolean) ?? [];
}

function normalizeSlackFilters(filters: SlackSignalsFilterConfig = {}): NormalizedSlackSignalsFilterConfig {
  return {
    includeChannelIds: normalizeStringList(filters.includeChannelIds),
    excludeChannelIds: normalizeStringList(filters.excludeChannelIds),
    includeChannelNames: normalizeStringList(filters.includeChannelNames).map(value => value.toLowerCase()),
    excludeChannelNames: normalizeStringList(filters.excludeChannelNames).map(value => value.toLowerCase()),
    keywords: normalizeStringList(filters.keywords).map(value => value.toLowerCase()),
    ignoreBotMessages: filters.ignoreBotMessages ?? DEFAULT_SLACK_SIGNALS_FILTERS.ignoreBotMessages,
    ignoredBotIds: normalizeStringList(filters.ignoredBotIds),
    ignoredUserIds: normalizeStringList(filters.ignoredUserIds),
    maxPreviewLength: filters.maxPreviewLength ?? DEFAULT_SLACK_SIGNALS_FILTERS.maxPreviewLength,
    priority: {
      channels: filters.priority?.channels ?? DEFAULT_SLACK_SIGNALS_FILTERS.priority.channels,
      dms: filters.priority?.dms ?? DEFAULT_SLACK_SIGNALS_FILTERS.priority.dms,
      groupDms: filters.priority?.groupDms ?? DEFAULT_SLACK_SIGNALS_FILTERS.priority.groupDms,
      mentions: filters.priority?.mentions ?? DEFAULT_SLACK_SIGNALS_FILTERS.priority.mentions,
    },
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

function normalizeSlackToolChannel(channel: string): { channelId?: string; channelName?: string } {
  const normalized = channel.trim().replace(/^#/, '');
  if (/^[CGD][A-Z0-9]+$/.test(normalized)) return { channelId: normalized };
  return { channelName: normalized };
}

function isSlackConversationType(value: unknown): value is SlackConversationType {
  return value === 'public_channel' || value === 'private_channel' || value === 'im' || value === 'mpim';
}

function compareSlackTimestamps(a: string, b: string): number {
  return Number(a) - Number(b);
}

function isNewerSlackTimestamp(a: string, b: string): boolean {
  return compareSlackTimestamps(a, b) > 0;
}

function sortSlackMessages(messages: SlackSignalsMessage[]): SlackSignalsMessage[] {
  return [...messages].sort((a, b) => compareSlackTimestamps(a.ts, b.ts));
}

function mergeSlackMessages(...messageGroups: SlackSignalsMessage[][]): SlackSignalsMessage[] {
  const byTs = new Map<string, SlackSignalsMessage>();
  for (const messages of messageGroups) {
    for (const message of messages) byTs.set(message.ts, message);
  }
  return sortSlackMessages([...byTs.values()]);
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
  const subscribedAt = readString(rawChannel.subscribedAt);
  if (!id || !isSlackConversationType(type) || !subscribedAt) return undefined;
  return {
    id,
    type,
    ...(readString(rawChannel.name) ? { name: readString(rawChannel.name)! } : {}),
    ...(readString(rawChannel.latestTs) ? { latestTs: readString(rawChannel.latestTs)! } : {}),
    ...(readString(rawChannel.latestMessageHash) ? { latestMessageHash: readString(rawChannel.latestMessageHash)! } : {}),
    subscribedAt,
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

function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 0 || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function getMessageSummary(message: SlackSignalsMessage, filters: NormalizedSlackSignalsFilterConfig): string {
  const channel = message.channelName ? `#${message.channelName}` : message.channelId;
  const author = message.username ?? message.user ?? message.botId ?? 'Someone';
  const text = message.text?.trim();
  return text ? `${author} in ${channel}: ${truncateText(text, filters.maxPreviewLength)}` : `${author} posted in ${channel}.`;
}

function isMention(
  subscription: SlackSignalsSubscription,
  message: SlackSignalsMessage,
): boolean {
  const text = message.text ?? '';
  return Boolean(
    (subscription.userId && text.includes(`<@${subscription.userId}>`)) ||
      (subscription.botId && text.includes(`<@${subscription.botId}>`)),
  );
}

function getMessagePriority(
  subscription: SlackSignalsSubscription,
  message: SlackSignalsMessage,
  filters: NormalizedSlackSignalsFilterConfig,
): SlackNotificationPriority {
  if (isMention(subscription, message)) return filters.priority.mentions;
  if (message.channelType === 'im') return filters.priority.dms;
  if (message.channelType === 'mpim') return filters.priority.groupDms;
  return filters.priority.channels;
}

function shouldNotifyMessage(message: SlackSignalsMessage, filters: NormalizedSlackSignalsFilterConfig): boolean {
  if (filters.includeChannelIds.length > 0 && !filters.includeChannelIds.includes(message.channelId)) return false;
  if (filters.excludeChannelIds.includes(message.channelId)) return false;

  const channelName = message.channelName?.toLowerCase();
  if (filters.includeChannelNames.length > 0 && (!channelName || !filters.includeChannelNames.includes(channelName))) {
    return false;
  }
  if (channelName && filters.excludeChannelNames.includes(channelName)) return false;

  if (message.user && filters.ignoredUserIds.includes(message.user)) return false;
  if (message.botId && filters.ignoredBotIds.includes(message.botId)) return false;
  if (filters.ignoreBotMessages && message.botId) return false;

  if (filters.keywords.length > 0) {
    const text = message.text?.toLowerCase() ?? '';
    if (!filters.keywords.some(keyword => text.includes(keyword))) return false;
  }

  return true;
}

function createSlackNotificationInput(
  subscription: SlackSignalsSubscription,
  message: SlackSignalsMessage,
  filters: NormalizedSlackSignalsFilterConfig,
) {
  const dedupeKey = getMessageDedupeKey(subscription, message);
  const slackMessageRef: SlackMessageRef = {
    teamId: subscription.workspaceId,
    channelId: message.channelId,
    ...(message.channelName ? { channelName: message.channelName } : {}),
    channelType: message.channelType,
    messageTs: message.ts,
    ...(message.threadTs ? { threadTs: message.threadTs } : {}),
  };
  const payload: SlackNotificationPayload = {
    slackMessageRef,
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
    summary: getMessageSummary(message, filters),
    priority: getMessagePriority(subscription, message, filters),
    sourceId: dedupeKey,
    dedupeKey,
    coalesceKey: `${subscription.workspaceId}:${message.channelId}`,
    payload,
    attributes: {
      teamId: subscription.workspaceId,
      channelId: message.channelId,
      channelType: message.channelType,
      messageTs: message.ts,
      ...(message.threadTs ? { threadTs: message.threadTs } : {}),
    },
  };
}

function inferChannelType(channelId: string): SlackConversationType {
  if (channelId.startsWith('D')) return 'im';
  if (channelId.startsWith('G')) return 'private_channel';
  return 'public_channel';
}

export class SlackSignalsProvider extends SignalProvider<'slack-signals'> {
  readonly id = SLACK_SIGNALS_PROVIDER_ID;
  override readonly name = 'Slack Signals';

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
  readonly #filters: NormalizedSlackSignalsFilterConfig;
  readonly #syncClient: SlackSignalsSyncClient;
  override readonly pollInterval: number;

  constructor(options: SlackSignalsProviderConfig) {
    super();
    this.#options = options;
    this.#include = normalizeIncludeConfig(options.include);
    this.#filters = normalizeSlackFilters(options.filters);
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

  // ── Per-thread polling ──────────────────────────────────────────────

  async pollThread(target: SignalProviderTarget): Promise<SlackPollResult> {
    const { threadStore, loadedThread } = await this.#loadThread(target);
    const subscription = getSlackSignalsMetadata(loadedThread.metadata).subscription;
    if (!subscription || Object.keys(subscription.channels).length === 0) {
      return { notificationsSent: 0, channelsSynced: 0, channelsFailed: 0 };
    }

    let notificationsSent = 0;
    let channelsSynced = 0;
    let channelsFailed = 0;
    const updatedChannels = { ...subscription.channels };
    const now = new Date().toISOString();

    for (const [channelId, channel] of Object.entries(subscription.channels)) {
      try {
        const conversation: SlackSignalsConversation = {
          id: channelId,
          type: channel.type,
          ...(channel.name ? { name: channel.name } : {}),
        };

        // Resolve DM channel names so notifications show user names not raw IDs
        if (!conversation.name && conversation.type === 'im') {
          try {
            const info = await this.#syncClient.getConversation({ channelId });
            if (info.user) {
              const userMap = await this.#resolveUserNames();
              const resolved = userMap.get(info.user);
              if (resolved) conversation.name = resolved;
            }
          } catch {
            // Best-effort — notification falls back to channelId if resolution fails
          }
        }

        const result = await this.#syncClient.listMessages({
          conversation,
          oldest: channel.latestTs,
          limit: 50,
          maxPages: channel.latestTs ? 5 : 1,
        });

        // On first poll (no latestTs), establish baseline without notifying
        const newMessages = channel.latestTs
          ? result.messages.filter(msg => isNewerSlackTimestamp(msg.ts, channel.latestTs!))
          : [];

        for (const message of newMessages) {
          if (!shouldNotifyMessage(message, this.#filters)) continue;
          await this.notify(createSlackNotificationInput(subscription, message, this.#filters), target);
          notificationsSent++;
        }

        if (result.latestTs) {
          updatedChannels[channelId] = {
            ...channel,
            latestTs: result.latestTs,
            lastSyncAt: now,
            lastSyncStatus: 'success',
            lastSyncError: undefined,
          };
        }
        channelsSynced++;
      } catch (error) {
        updatedChannels[channelId] = {
          ...channel,
          lastSyncAt: now,
          lastSyncStatus: 'error',
          lastSyncError: error instanceof Error ? error.message : String(error),
        };
        channelsFailed++;
      }
    }

    const updatedSubscription: SlackSignalsSubscription = {
      ...subscription,
      channels: updatedChannels,
      lastSyncAt: now,
      lastSyncStatus: channelsFailed > 0 ? 'error' : 'success',
    };

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        updatedAt: new Date(),
        metadata: setSlackSignalsMetadata(loadedThread.metadata, { subscription: updatedSubscription }),
      },
    });

    return { notificationsSent, channelsSynced, channelsFailed };
  }

  // ── Subscription management ──────────────────────────────────────────

  async subscribeThreadToSlack(input: {
    threadId?: string;
    resourceId?: string;
    channels?: string[];
    abortSignal?: AbortSignal;
  }): Promise<SlackOperationResult> {
    const result = await this.#ensureSubscription({
      id: `slack-command-subscribe-${randomUUID()}`,
      ...input,
    });
    if (input.channels && input.channels.length > 0 && result.subscription) {
      return this.#addChannels({
        threadId: input.threadId,
        resourceId: input.resourceId,
        channels: input.channels,
        abortSignal: input.abortSignal,
      });
    }
    return result;
  }

  async unsubscribeThreadFromSlack(input: {
    threadId?: string;
    resourceId?: string;
    channels?: string[];
  }): Promise<SlackOperationResult> {
    if (input.channels && input.channels.length > 0) {
      return this.#removeChannels({
        threadId: input.threadId,
        resourceId: input.resourceId,
        channels: input.channels,
      });
    }
    return this.#removeSubscription({
      id: `slack-command-unsubscribe-${randomUUID()}`,
      ...input,
    });
  }

  async listAvailableChannels(input: { abortSignal?: AbortSignal } = {}): Promise<SlackSignalsConversation[]> {
    const result = await this.#syncClient.listConversations({
      types: this.conversationTypes,
      abortSignal: input.abortSignal,
    });

    // Resolve DM user IDs to display names — batch via users.list (1 API call)
    const dmConversations = result.conversations.filter(c => c.type === 'im' && c.user && !c.name);
    if (dmConversations.length > 0) {
      const userMap = await this.#resolveUserNames(input.abortSignal);
      for (const conversation of result.conversations) {
        if (conversation.type === 'im' && conversation.user && userMap.has(conversation.user)) {
          conversation.name = userMap.get(conversation.user);
        }
      }
    }

    return result.conversations;
  }

  async readConversation(input: SlackReadConversationInput): Promise<SlackReadConversationResult> {
    const before = Math.max(0, Math.min(input.before ?? 20, 100));
    const after = Math.max(0, Math.min(input.after ?? 10, 100));
    const channel = await this.#resolveConversationForRead(input);

    const [beforeResult, afterResult] = await Promise.all([
      before > 0
        ? this.#syncClient.listMessages({
            conversation: channel,
            latest: input.aroundTs,
            inclusive: true,
            limit: before + 1,
            maxPages: 1,
            abortSignal: input.abortSignal,
          })
        : Promise.resolve({ messages: [] }),
      after > 0
        ? this.#syncClient.listMessages({
            conversation: channel,
            oldest: input.aroundTs,
            inclusive: false,
            limit: after,
            maxPages: 1,
            abortSignal: input.abortSignal,
          })
        : Promise.resolve({ messages: [] }),
    ]);

    return {
      slackMessageRef: {
        channelId: channel.id,
        ...(channel.name ? { channelName: channel.name } : {}),
        channelType: channel.type,
        messageTs: input.aroundTs,
      },
      channel,
      messages: mergeSlackMessages(beforeResult.messages, afterResult.messages),
    };
  }

  async readThread(input: SlackReadThreadInput): Promise<SlackReadThreadResult> {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 200));
    const channel = await this.#resolveConversationForRead(input);
    const result = await this.#syncClient.listThreadMessages({
      conversation: channel,
      threadTs: input.threadTs,
      limit,
      maxPages: 5,
      abortSignal: input.abortSignal,
    });

    return {
      slackMessageRef: {
        channelId: channel.id,
        ...(channel.name ? { channelName: channel.name } : {}),
        channelType: channel.type,
        messageTs: input.threadTs,
        threadTs: input.threadTs,
      },
      channel,
      messages: result.messages,
    };
  }

  // ── Input processor ─────────────────────────────────────────────────

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
      const result = await this.#removeSubscription({ ...signal, ...threadContext });
      await this.#sendStatus(args, result, {
        status: result.removed ? 'unsubscribed' : 'not_subscribed',
        action: 'unsubscribe',
        message: result.removed
          ? `Unsubscribed this thread from Slack workspace ${result.workspaceName ?? result.workspaceId}.`
          : 'This thread is not subscribed to Slack.',
      });
      return { tools };
    }

    const result = await this.#ensureSubscription({ ...signal, ...threadContext, abortSignal: args.abortSignal });
    if (result.alreadyProcessed) return { tools };
    await this.#sendStatus(args, result, {
      status: result.alreadySubscribed ? 'already_subscribed' : 'subscribed',
      action: 'subscribe',
      message: result.alreadySubscribed
        ? `This thread is already subscribed to Slack workspace ${result.workspaceName ?? result.workspaceId}. Use /slack subscribe #channel to add channels.`
        : `Subscribed this thread to Slack workspace ${result.workspaceName ?? result.workspaceId}. Use /slack subscribe #channel to add channels.`,
    });
    return { tools };
  }

  // ── Private helpers ─────────────────────────────────────────────────

  async #resolveThreadStore(): Promise<SlackSignalsThreadStore | undefined> {
    if (this.#options.threadStore) return this.#options.threadStore;
    const storage = this.mastra?.getStorage?.();
    const memoryStore = storage?.getStore ? await storage.getStore('memory') : undefined;
    return memoryStore as SlackSignalsThreadStore | undefined;
  }

  /** Resolve user IDs to display names via users.list, with in-memory cache (5 min) */
  #userCache: Map<string, string> | undefined;
  #userCacheTime = 0;
  async #resolveUserNames(abortSignal?: AbortSignal): Promise<Map<string, string>> {
    if (this.#userCache && Date.now() - this.#userCacheTime < 300_000) {
      return this.#userCache;
    }
    const users = await this.#syncClient.listUsers({ abortSignal });
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.id, user.displayName || user.realName || user.name);
    }
    this.#userCache = map;
    this.#userCacheTime = Date.now();
    return map;
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
          'Subscribe this thread to specific Slack channels. Pass channel names (e.g. "general") or IDs. Creates a workspace subscription if none exists.',
        inputSchema: z.object({
          channels: z.array(z.string()).optional().describe('Channel names (e.g. "general") or channel IDs to subscribe to'),
        }),
        execute: async (input, context) => {
          const executionThreadContext = getExecutionThreadContext(context);
          const result = await this.subscribeThreadToSlack({
            threadId: executionThreadContext.threadId,
            resourceId: executionThreadContext.resourceId,
            channels: input?.channels,
            abortSignal: context?.abortSignal,
          });
          return {
            subscribed: true,
            alreadySubscribed: result.alreadySubscribed ?? false,
            workspaceId: result.workspaceId,
            workspaceName: result.workspaceName,
            addedChannels: result.addedChannels,
            message: result.addedChannels?.length
              ? `Subscribed to ${result.addedChannels.length} channel(s) in workspace ${result.workspaceName ?? result.workspaceId}.`
              : result.alreadySubscribed
                ? `This thread is already subscribed to Slack workspace ${result.workspaceName ?? result.workspaceId}.`
                : `Subscribed this thread to Slack workspace ${result.workspaceName ?? result.workspaceId}. Use /slack subscribe #channel to add channels.`,
          };
        },
      }),
      slack_unsubscribe: createTool({
        id: 'slack_unsubscribe',
        description:
          'Unsubscribe from specific Slack channels, or remove the entire subscription if no channels specified.',
        inputSchema: z.object({
          channels: z.array(z.string()).optional().describe('Channel names or IDs to unsubscribe from. Omit to remove entire subscription.'),
        }),
        execute: async (input, context) => {
          const executionThreadContext = getExecutionThreadContext(context);
          const result = await this.unsubscribeThreadFromSlack({
            threadId: executionThreadContext.threadId,
            resourceId: executionThreadContext.resourceId,
            channels: input?.channels,
          });
          return {
            unsubscribed: result.removed ?? false,
            workspaceId: result.workspaceId,
            workspaceName: result.workspaceName,
            removedChannels: result.removedChannels,
            message: result.removedChannels?.length
              ? `Unsubscribed from ${result.removedChannels.length} channel(s).`
              : result.removed
                ? `Unsubscribed this thread from Slack workspace ${result.workspaceName ?? result.workspaceId}.`
                : 'This thread is not subscribed to Slack.',
          };
        },
      }),
      slack_read_conversation: createTool({
        id: 'slack_read_conversation',
        description:
          'Read Slack messages around a notification or message timestamp. Pass channel as either a Slack channel ID (C/G/D...) or a channel name (for example, general).',
        inputSchema: z.object({
          channel: z.string().describe('Slack channel/conversation ID or channel name, e.g. C123, D123, general, or #general'),
          aroundTs: z.string().describe('Slack message timestamp to center the transcript around'),
          before: z.number().int().min(0).max(100).optional().describe('Number of messages before/including aroundTs to fetch'),
          after: z.number().int().min(0).max(100).optional().describe('Number of messages after aroundTs to fetch'),
        }),
        execute: async (input, context) =>
          this.readConversation({
            ...normalizeSlackToolChannel(input.channel),
            aroundTs: input.aroundTs,
            before: input?.before,
            after: input?.after,
            abortSignal: context?.abortSignal,
          }),
      }),
      slack_read_thread: createTool({
        id: 'slack_read_thread',
        description: 'Read a Slack thread. Pass channel as either a Slack channel ID (C/G/D...) or a channel name.',
        inputSchema: z.object({
          channel: z.string().describe('Slack channel/conversation ID or channel name, e.g. C123, D123, general, or #general'),
          threadTs: z.string().describe('Slack thread timestamp'),
          limit: z.number().int().min(1).max(200).optional().describe('Maximum messages to fetch from the thread'),
        }),
        execute: async (input, context) =>
          this.readThread({
            ...normalizeSlackToolChannel(input.channel),
            threadTs: input.threadTs,
            limit: input?.limit,
            abortSignal: context?.abortSignal,
          }),
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

  async #ensureSubscription(input: {
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

  async #addChannels(input: {
    threadId?: string;
    resourceId?: string;
    channels: string[];
    abortSignal?: AbortSignal;
  }): Promise<SlackOperationResult> {
    const { threadStore, loadedThread } = await this.#loadThread(input);
    const subscription = getSlackSignalsMetadata(loadedThread.metadata).subscription;
    if (!subscription) {
      throw new Error('No Slack subscription found. Subscribe first with /slack subscribe.');
    }

    const resolved = await this.#resolveChannelInputs(input.channels, input.abortSignal);

    // Resolve DM user names so we store display names instead of channel IDs
    let userMap: Map<string, string> | undefined;
    for (const c of resolved) {
      if (c.type === 'im' && c.user && !c.name) {
        userMap ??= await this.#resolveUserNames(input.abortSignal);
        if (userMap.has(c.user)) c.name = userMap.get(c.user);
      }
    }
    const now = new Date().toISOString();
    const updatedChannels = { ...subscription.channels };
    const added: string[] = [];

    for (const conversation of resolved) {
      if (!updatedChannels[conversation.id]) {
        updatedChannels[conversation.id] = {
          id: conversation.id,
          type: conversation.type,
          ...(conversation.name ? { name: conversation.name } : {}),
          subscribedAt: now,
        };
        added.push(conversation.name ?? conversation.id);
      }
    }

    const updatedSubscription: SlackSignalsSubscription = {
      ...subscription,
      channels: updatedChannels,
      updatedAt: now,
    };

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        updatedAt: new Date(),
        metadata: setSlackSignalsMetadata(loadedThread.metadata, { subscription: updatedSubscription }),
      },
    });

    return {
      workspaceId: subscription.workspaceId,
      workspaceName: subscription.workspaceName,
      subscription: updatedSubscription,
      addedChannels: added,
    };
  }

  async #removeChannels(input: {
    threadId?: string;
    resourceId?: string;
    channels: string[];
  }): Promise<SlackOperationResult> {
    const { threadStore, loadedThread } = await this.#loadThread(input);
    const subscription = getSlackSignalsMetadata(loadedThread.metadata).subscription;
    if (!subscription) return { removed: false };

    const normalized = input.channels.map(c => c.replace(/^#/, '').toLowerCase());
    const updatedChannels = { ...subscription.channels };
    const removed: string[] = [];

    for (const [channelId, channel] of Object.entries(updatedChannels)) {
      const nameMatch = channel.name?.toLowerCase();
      if (normalized.includes(channelId.toLowerCase()) || (nameMatch && normalized.includes(nameMatch))) {
        delete updatedChannels[channelId];
        removed.push(channel.name ?? channelId);
      }
    }

    const now = new Date().toISOString();

    // If all channels removed, remove entire subscription
    if (Object.keys(updatedChannels).length === 0) {
      await threadStore.saveThread({
        thread: {
          ...loadedThread,
          updatedAt: new Date(),
          metadata: setSlackSignalsMetadata(loadedThread.metadata, {}),
        },
      });
      this.unsubscribe(
        { threadId: input.threadId!, resourceId: input.resourceId! },
        getWorkspaceExternalResourceId(subscription.workspaceId),
      );
      return {
        workspaceId: subscription.workspaceId,
        workspaceName: subscription.workspaceName,
        removed: true,
        removedChannels: removed,
      };
    }

    const updatedSubscription: SlackSignalsSubscription = {
      ...subscription,
      channels: updatedChannels,
      updatedAt: now,
    };

    await threadStore.saveThread({
      thread: {
        ...loadedThread,
        updatedAt: new Date(),
        metadata: setSlackSignalsMetadata(loadedThread.metadata, { subscription: updatedSubscription }),
      },
    });

    return {
      workspaceId: subscription.workspaceId,
      workspaceName: subscription.workspaceName,
      subscription: updatedSubscription,
      removedChannels: removed,
    };
  }

  async #removeSubscription(input: { id: string; threadId?: string; resourceId?: string }): Promise<SlackOperationResult> {
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
    this.unsubscribe(
      { threadId: input.threadId!, resourceId: input.resourceId! },
      getWorkspaceExternalResourceId(existing.workspaceId),
    );

    return {
      workspaceId: existing.workspaceId,
      workspaceName: existing.workspaceName,
      subscription: existing,
      removed: true,
    };
  }

  async #resolveConversationForRead(input: {
    channelId?: string;
    channelName?: string;
    abortSignal?: AbortSignal;
  }): Promise<SlackSignalsConversation> {
    if (input.channelId) {
      try {
        const conversation = await this.#syncClient.getConversation({ channelId: input.channelId, abortSignal: input.abortSignal });
        if (conversation.type === 'im' && conversation.user && !conversation.name) {
          const userMap = await this.#resolveUserNames(input.abortSignal);
          if (userMap.has(conversation.user)) conversation.name = userMap.get(conversation.user);
        }
        return conversation;
      } catch {
        return { id: input.channelId, type: inferChannelType(input.channelId) };
      }
    }

    if (input.channelName) {
      const [conversation] = await this.#resolveChannelInputs([input.channelName], input.abortSignal);
      if (conversation) return conversation;
    }

    throw new Error('Slack read requires a channelId or resolvable channelName.');
  }

  async #resolveChannelInputs(
    channelInputs: string[],
    abortSignal?: AbortSignal,
  ): Promise<SlackSignalsConversation[]> {
    const resolved: SlackSignalsConversation[] = [];
    const byName: string[] = [];

    for (const input of channelInputs) {
      const normalized = input.replace(/^#/, '').trim();
      if (!normalized) continue;
      // Channel IDs start with C, G, or D — resolve via conversations.info
      if (/^[CGD][A-Z0-9]+$/.test(normalized)) {
        try {
          const conversation = await this.#syncClient.getConversation({ channelId: normalized, abortSignal });
          resolved.push(conversation);
        } catch {
          // If info fails, use inferred type
          resolved.push({ id: normalized, type: inferChannelType(normalized) });
        }
      } else {
        byName.push(normalized);
      }
    }

    if (byName.length > 0) {
      const result = await this.#syncClient.listConversations({
        types: this.conversationTypes,
        abortSignal,
      });
      const byNameLower = byName.map(n => n.toLowerCase());
      for (const conversation of result.conversations) {
        if (conversation.name && byNameLower.includes(conversation.name.toLowerCase())) {
          resolved.push(conversation);
        }
      }
    }

    return resolved;
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
export type SlackSignals = SlackSignalsProvider;
