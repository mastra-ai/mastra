import type {
  SlackConversationType,
  SlackListConversationsInput,
  SlackListConversationsResult,
  SlackListMessagesInput,
  SlackListMessagesResult,
  SlackSignalsConversation,
  SlackSignalsMessage,
  SlackSignalsSyncClient,
  SlackSignalsUser,
  SlackSignalsWorkspace,
} from './index.js';

export type SlackWebApiSyncClientOptions = {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
};

export class SlackSignalsApiError extends Error {
  readonly method: string;
  readonly code: string;
  readonly status?: number;
  readonly response?: unknown;

  constructor(input: { method: string; code: string; message?: string; status?: number; response?: unknown }) {
    super(input.message ?? `Slack API ${input.method} failed: ${input.code}`);
    this.name = 'SlackSignalsApiError';
    this.method = input.method;
    this.code = input.code;
    this.status = input.status;
    this.response = input.response;
  }
}

type SlackApiResponse = Record<string, unknown> & {
  ok?: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
};

type SlackRawConversation = Record<string, unknown> & {
  id?: string;
  name?: string;
  user?: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  is_member?: boolean;
};

type SlackRawMessage = Record<string, unknown> & {
  ts?: string;
  thread_ts?: string;
  user?: string;
  username?: string;
  bot_id?: string;
  text?: string;
  permalink?: string;
};

type SlackRawUser = Record<string, unknown> & {
  id?: string;
  name?: string;
  profile?: {
    display_name?: string;
    real_name?: string;
  };
};

function mapUser(raw: SlackRawUser): SlackSignalsUser | undefined {
  const id = readString(raw.id);
  if (!id) return undefined;
  return {
    id,
    name: readString(raw.name) ?? id,
    displayName: readString(raw.profile?.display_name) ?? readString(raw.name) ?? id,
    realName: readString(raw.profile?.real_name) ?? readString(raw.name) ?? id,
  };
}

const DEFAULT_SLACK_BASE_URL = 'https://slack.com/api/';
const DEFAULT_PAGE_LIMIT = 200;
const DEFAULT_MAX_RETRIES = 2;

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const normalized = baseUrl ?? DEFAULT_SLACK_BASE_URL;
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isSlackConversationType(value: unknown): value is SlackConversationType {
  return value === 'public_channel' || value === 'private_channel' || value === 'im' || value === 'mpim';
}

function getConversationType(conversation: SlackRawConversation): SlackConversationType {
  if (isSlackConversationType(conversation.type)) return conversation.type;
  if (conversation.is_im) return 'im';
  if (conversation.is_mpim) return 'mpim';
  if (conversation.is_group || conversation.is_private) return 'private_channel';
  return 'public_channel';
}

function mapConversation(conversation: SlackRawConversation): SlackSignalsConversation | undefined {
  const id = readString(conversation.id);
  if (!id) return undefined;
  return {
    id,
    type: getConversationType(conversation),
    ...(readString(conversation.name) ? { name: readString(conversation.name)! } : {}),
    ...(readString(conversation.user) ? { user: readString(conversation.user)! } : {}),
    ...(typeof conversation.is_archived === 'boolean' ? { isArchived: conversation.is_archived } : {}),
    ...(typeof conversation.is_member === 'boolean' ? { isMember: conversation.is_member } : {}),
  };
}

function mapMessage(message: SlackRawMessage, conversation: SlackSignalsConversation): SlackSignalsMessage | undefined {
  const ts = readString(message.ts);
  if (!ts) return undefined;
  return {
    channelId: conversation.id,
    ...(conversation.name ? { channelName: conversation.name } : {}),
    channelType: conversation.type,
    ts,
    ...(readString(message.thread_ts) ? { threadTs: readString(message.thread_ts)! } : {}),
    ...(readString(message.user) ? { user: readString(message.user)! } : {}),
    ...(readString(message.username) ? { username: readString(message.username)! } : {}),
    ...(readString(message.bot_id) ? { botId: readString(message.bot_id)! } : {}),
    ...(readString(message.text) ? { text: readString(message.text)! } : {}),
    ...(readString(message.permalink) ? { permalink: readString(message.permalink)! } : {}),
  };
}

function compareSlackTimestamps(a: string, b: string): number {
  return Number(a) - Number(b);
}

function getLatestTimestamp(messages: SlackSignalsMessage[]): string | undefined {
  let latest: string | undefined;
  for (const message of messages) {
    if (!latest || compareSlackTimestamps(message.ts, latest) > 0) latest = message.ts;
  }
  return latest;
}

function appendParam(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  params.set(key, String(value));
}

export class SlackWebApiSyncClient implements SlackSignalsSyncClient {
  readonly #token: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #maxRetries: number;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(options: SlackWebApiSyncClientOptions) {
    this.#token = options.token;
    this.#baseUrl = normalizeBaseUrl(options.baseUrl);
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#sleep = options.sleep ?? defaultSleep;
  }

  async getWorkspace(input: { abortSignal?: AbortSignal } = {}): Promise<SlackSignalsWorkspace> {
    const response = await this.#request('auth.test', {}, input.abortSignal);
    const teamId = readString(response.team_id);
    if (!teamId) {
      throw new SlackSignalsApiError({ method: 'auth.test', code: 'missing_team_id', response });
    }
    return {
      teamId,
      ...(readString(response.team) ? { teamName: readString(response.team)! } : {}),
      ...(readString(response.user_id) ? { userId: readString(response.user_id)! } : {}),
      ...(readString(response.bot_id) ? { botId: readString(response.bot_id)! } : {}),
      ...(readString(response.url) ? { url: readString(response.url)! } : {}),
    };
  }

  async listConversations(input: SlackListConversationsInput): Promise<SlackListConversationsResult> {
    const conversations: SlackSignalsConversation[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.#request(
        'conversations.list',
        {
          types: input.types.join(','),
          exclude_archived: true,
          limit: input.limit ?? DEFAULT_PAGE_LIMIT,
          cursor,
        },
        input.abortSignal,
      );
      const rawConversations = Array.isArray(response.channels) ? response.channels : [];
      for (const rawConversation of rawConversations) {
        if (!isPlainObject(rawConversation)) continue;
        const conversation = mapConversation(rawConversation);
        if (conversation) conversations.push(conversation);
      }
      cursor = readString(response.response_metadata?.next_cursor);
    } while (cursor);

    return { conversations };
  }

  async listMessages(input: SlackListMessagesInput): Promise<SlackListMessagesResult> {
    const messages: SlackSignalsMessage[] = [];
    let cursor: string | undefined;
    let page = 0;
    const maxPages = input.maxPages ?? Infinity;

    do {
      page++;
      const response = await this.#request(
        'conversations.history',
        {
          channel: input.conversation.id,
          limit: input.limit ?? DEFAULT_PAGE_LIMIT,
          oldest: input.oldest,
          inclusive: input.inclusive,
          cursor,
        },
        input.abortSignal,
      );
      const rawMessages = Array.isArray(response.messages) ? response.messages : [];
      for (const rawMessage of rawMessages) {
        if (!isPlainObject(rawMessage)) continue;
        const message = mapMessage(rawMessage, input.conversation);
        if (message) messages.push(message);
      }
      cursor = readString(response.response_metadata?.next_cursor);
    } while (cursor && page < maxPages);

    messages.sort((a, b) => compareSlackTimestamps(a.ts, b.ts));
    return { messages, latestTs: getLatestTimestamp(messages) };
  }

  async getConversation(input: { channelId: string; abortSignal?: AbortSignal }): Promise<SlackSignalsConversation> {
    const response = await this.#request(
      'conversations.info',
      { channel: input.channelId },
      input.abortSignal,
    );
    const rawChannel = isPlainObject(response.channel) ? (response.channel as SlackRawConversation) : undefined;
    if (!rawChannel) {
      throw new SlackSignalsApiError({ method: 'conversations.info', code: 'not_found', response });
    }
    const conversation = mapConversation(rawChannel);
    if (!conversation) {
      throw new SlackSignalsApiError({ method: 'conversations.info', code: 'invalid_channel', response });
    }
    return conversation;
  }

  async listUsers(input: { abortSignal?: AbortSignal } = {}): Promise<SlackSignalsUser[]> {
    const users: SlackSignalsUser[] = [];
    let cursor: string | undefined;
    do {
      const response = await this.#request('users.list', { cursor, limit: 200 }, input.abortSignal);
      const rawMembers = Array.isArray(response.members) ? response.members : [];
      for (const raw of rawMembers) {
        if (!isPlainObject(raw)) continue;
        const user = mapUser(raw as SlackRawUser);
        if (user) users.push(user);
      }
      cursor = readString(response.response_metadata?.next_cursor);
    } while (cursor);
    return users;
  }

  async #request(method: string, params: Record<string, unknown>, abortSignal?: AbortSignal): Promise<SlackApiResponse> {
    let attempt = 0;
    for (;;) {
      const response = await this.#fetch(`${this.#baseUrl}${method}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#token}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: this.#createBody(params),
        signal: abortSignal,
      });

      if (response.status === 429 && attempt < this.#maxRetries) {
        attempt += 1;
        const retryAfterSeconds = Number(response.headers.get('retry-after') ?? '1');
        await this.#sleep(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 1000);
        continue;
      }

      const bodyText = await response.text();
      let body: unknown;
      try {
        body = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        body = bodyText;
      }

      if (!response.ok) {
        throw new SlackSignalsApiError({
          method,
          code: 'http_error',
          status: response.status,
          response: body,
        });
      }

      if (!isPlainObject(body)) {
        throw new SlackSignalsApiError({ method, code: 'invalid_response', response: body });
      }

      if (body.ok !== true) {
        const code = readString(body.error) ?? 'api_error';
        throw new SlackSignalsApiError({ method, code, response: body });
      }

      return body as SlackApiResponse;
    }
  }

  #createBody(params: Record<string, unknown>): URLSearchParams {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) appendParam(body, key, value);
    return body;
  }
}
