import type { AgentSignalInput } from '@mastra/core/agent';
import { SignalProvider } from '@mastra/core/signals';

export const SLACK_SIGNALS_PROVIDER_ID = 'slack-signals';
export const SLACK_SIGNALS_METADATA_KEY = 'slackSignals';
export const SLACK_SUBSCRIBE_TAG = 'slack-subscribe';
export const SLACK_UNSUBSCRIBE_TAG = 'slack-unsubscribe';
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
  subscribedAt: string;
  updatedAt: string;
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

export type SlackSignalsProviderConfig = {
  token: string;
  pollIntervalMs?: number;
  include?: SlackSignalsIncludeConfig;
  syncClient?: SlackSignalsSyncClient;
};

export type SlackSignalsOptions = SlackSignalsProviderConfig;

export type SlackSubscribeSignalInput = void | Record<string, never>;
export type SlackUnsubscribeSignalInput = void | Record<string, never>;

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

  constructor(options: SlackSignalsProviderConfig) {
    super();
    this.#options = options;
    this.#include = normalizeIncludeConfig(options.include);
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
}

export const SlackSignals = SlackSignalsProvider;
