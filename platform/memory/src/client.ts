export interface PlatformMemoryClientOptions {
  /** Platform access token. Falls back to `MASTRA_PLATFORM_ACCESS_TOKEN`, then `MASTRA_PLATFORM_SECRET_KEY`. */
  accessToken?: string;
  /** Memory instance id. Falls back to `MASTRA_MEMORY_INSTANCE_ID`. */
  instanceId?: string;
  /** Falls back to `MASTRA_PROJECT_ID`. Sent as a hint; ownership is enforced server-side from the token. */
  projectId?: string;
  /** Falls back to `MASTRA_ENVIRONMENT_ID`. */
  environmentId?: string;
  /** Sent as `x-acting-user-id`, used by the API when the token is not tied to a user. */
  actingUserId?: string;
  /** Platform API URL. Falls back to `MASTRA_PLATFORM_API_URL`, then `https://platform.mastra.ai`. */
  apiUrl?: string;
  fetch?: typeof fetch;
}

export interface MemoryThread {
  id: string;
  resourceId: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type MemoryMessagePart = { type: string; [key: string]: unknown };

export interface MemoryMessage {
  id: string;
  role: string;
  content: string;
  /** Mastra V2 parts (text, tool-invocation, reasoning, file, …), stored verbatim. */
  parts: MemoryMessagePart[];
  createdAt: string;
}

export interface MemoryMessageInput {
  id?: string;
  role: 'user' | 'assistant';
  /** Text content. Optional when `parts` is set. */
  content?: string;
  parts?: MemoryMessagePart[];
  createdAt?: string;
}

export interface MemoryContext {
  /** Rendered observations, ready to use as a system message. */
  system: string | null;
  /**
   * User-role reminder that goes before `messages` once observations exist, so the model
   * continues the conversation instead of treating the observations as a new prompt.
   * Older servers omit it.
   */
  continuation?: string | null;
  /** Messages not yet folded into observations, oldest first. */
  messages: MemoryMessage[];
  /**
   * Ready-to-send prefix in `@mastra/memory` order: system (`om-system`), continuation
   * (`om-continuation`), then `messages`. Older servers omit it; use `promptOf`.
   */
  prompt?: MemoryMessage[];
  observedAt: string | null;
}

export interface MemoryObservationRecord {
  activeObservations: string | null;
  lastObservedAt: string | null;
  [key: string]: unknown;
}

type SerializedMessageList = ReturnType<import('@mastra/core/agent').MessageList['serialize']>;

export type RunMemoryProcessorsInput =
  | {
      phase: 'inputStep';
      resourceId: string;
      stepNumber: number;
      messageList: SerializedMessageList;
      model?: { provider: string; modelId: string };
    }
  | { phase: 'output'; resourceId: string; messageList: SerializedMessageList; finishReason?: string };

export interface MemoryProcessorsResult {
  /** Null when a processor aborted the run. */
  messageList: SerializedMessageList | null;
  chunks: unknown[];
  rotations: number;
  aborted: string | null;
}

export interface MemoryObservationMatch {
  text: string;
  threadId: string | null;
  observedAt: string | null;
}

export interface MemoryThreadConfigUpdate {
  observationTokens?: number | null;
  reflectionTokens?: number | null;
}

export interface MemoryThreadConfig {
  observationTokens: number;
  reflectionTokens: number;
  overrides: { observationTokens: number | null; reflectionTokens: number | null };
}

export interface MemoryObservationRun {
  id: string;
  threadId: string;
  resourceId: string;
  startedAt: string;
  durationMs: number;
  observed: boolean;
  reflected: boolean;
  tokensBefore: number;
  tokensAfter: number | null;
  error: string | null;
}

const DEFAULT_API_URL = 'https://platform.mastra.ai';

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`PlatformMemory: ${name} is required`);
  return value;
}

export function resolvePlatformMemoryOptions(options: PlatformMemoryClientOptions = {}) {
  return {
    accessToken: required(
      options.accessToken ?? env('MASTRA_PLATFORM_ACCESS_TOKEN') ?? env('MASTRA_PLATFORM_SECRET_KEY'),
      'accessToken',
    ),
    instanceId: required(options.instanceId ?? env('MASTRA_MEMORY_INSTANCE_ID'), 'instanceId'),
    projectId: options.projectId ?? env('MASTRA_PROJECT_ID'),
    environmentId: options.environmentId ?? env('MASTRA_ENVIRONMENT_ID'),
    actingUserId: options.actingUserId,
    apiUrl: (options.apiUrl ?? env('MASTRA_PLATFORM_API_URL') ?? DEFAULT_API_URL).replace(/\/$/, ''),
    fetch: options.fetch ?? fetch,
  };
}

export class PlatformMemoryApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Platform Memory request failed with ${status}${body ? `: ${body}` : ''}`);
    this.name = 'PlatformMemoryApiError';
  }
}

type Query = Record<string, string | number | undefined>;

/** Typed client for the Platform Memory API (`/v1/memory/:instanceId/*`). */
export class PlatformMemoryClient {
  readonly instanceId: string;
  private readonly opts: ReturnType<typeof resolvePlatformMemoryOptions>;

  constructor(options: PlatformMemoryClientOptions = {}) {
    this.opts = resolvePlatformMemoryOptions(options);
    this.instanceId = this.opts.instanceId;
  }

  /** MCP endpoint for this instance, for clients that speak MCP directly. */
  get mcpUrl(): string {
    return `${this.base}/mcp`;
  }

  listThreads(query: { resourceId?: string; page?: number; perPage?: number } = {}) {
    return this.request<{ threads: MemoryThread[]; hasMore: boolean }>('GET', '/threads', { query });
  }

  createThread(body: { id?: string; resourceId: string; title?: string; metadata?: Record<string, unknown> }) {
    return this.request<MemoryThread>('POST', '/threads', { body });
  }

  /** Returns null when the thread does not exist. */
  async getThread(threadId: string): Promise<MemoryThread | null> {
    try {
      return await this.request<MemoryThread>('GET', `/threads/${encodeURIComponent(threadId)}`);
    } catch (error) {
      if (error instanceof PlatformMemoryApiError && error.status === 404) return null;
      throw error;
    }
  }

  updateThread(threadId: string, body: { title?: string; metadata?: Record<string, unknown> }) {
    return this.request<MemoryThread>('PATCH', `/threads/${encodeURIComponent(threadId)}`, { body });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.request('DELETE', `/threads/${encodeURIComponent(threadId)}`);
  }

  listMessages(threadId: string, query: { page?: number; perPage?: number } = {}) {
    return this.request<{ messages: MemoryMessage[]; hasMore: boolean }>(
      'GET',
      `/threads/${encodeURIComponent(threadId)}/messages`,
      { query },
    );
  }

  /** Saves messages and schedules observation in the background. Creates the thread if needed. */
  saveMessages(threadId: string, body: { resourceId: string; messages: MemoryMessageInput[] }) {
    return this.request<{ messages: MemoryMessage[] }>('POST', `/threads/${encodeURIComponent(threadId)}/messages`, {
      body,
    });
  }

  getContext(threadId: string, resourceId: string, opts: { workingMemory?: 'readonly' | 'tool' | 'off' } = {}) {
    return this.request<MemoryContext>('GET', `/threads/${encodeURIComponent(threadId)}/context`, {
      query: { resourceId, ...(opts.workingMemory ? { workingMemory: opts.workingMemory } : {}) },
    });
  }

  async getWorkingMemory(resourceId: string): Promise<string | null> {
    const res = await this.request<{ workingMemory: string | null }>('GET', '/working-memory', {
      query: { resourceId },
    });
    return res.workingMemory;
  }

  async updateWorkingMemory(resourceId: string, workingMemory: string): Promise<void> {
    await this.request('PUT', '/working-memory', { body: { resourceId, workingMemory } });
  }

  /** Omit resourceId to search the instance's most recently active threads. */
  async search(body: { resourceId?: string; threadId?: string; query: string; limit?: number }) {
    const res = await this.request<{ matches: MemoryObservationMatch[] }>('POST', '/search', { body });
    return res.matches;
  }

  /** Current observational-memory record for the thread, or null before the first observation. */
  async getObservations(threadId: string): Promise<MemoryObservationRecord | null> {
    const res = await this.request<{ record: MemoryObservationRecord | null }>(
      'GET',
      `/threads/${encodeURIComponent(threadId)}/observations`,
    );
    return res.record;
  }

  /** Runs observation/reflection now instead of waiting for the background worker. */
  /** Runs the instance's memory processors for one agent phase on a serialized message list. */
  runProcessors(threadId: string, body: RunMemoryProcessorsInput) {
    return this.request<MemoryProcessorsResult>('POST', `/threads/${encodeURIComponent(threadId)}/processors`, {
      body,
    });
  }

  async listObservationRuns(query: { threadId?: string; limit?: number } = {}) {
    const res = await this.request<{ runs: MemoryObservationRun[] }>('GET', '/runs', { query });
    return res.runs;
  }

  /** Effective observation thresholds for the thread and which ones it overrides. */
  getThreadConfig(threadId: string) {
    return this.request<MemoryThreadConfig>('GET', `/threads/${encodeURIComponent(threadId)}/config`);
  }

  /** Overrides thresholds for one thread. Pass `null` to fall back to the instance value. */
  updateThreadConfig(threadId: string, config: MemoryThreadConfigUpdate) {
    return this.request<MemoryThreadConfig>('PATCH', `/threads/${encodeURIComponent(threadId)}/config`, {
      body: config,
    });
  }

  /** Copies a thread, its messages, and its observations. */
  cloneThread(
    threadId: string,
    body: { newThreadId?: string; title?: string; metadata?: Record<string, unknown>; messageLimit?: number } = {},
  ) {
    return this.request<{ thread: MemoryThread; clonedMessageCount: number }>(
      'POST',
      `/threads/${encodeURIComponent(threadId)}/clone`,
      { body },
    );
  }

  /** Deletes messages from a thread. Ids that belong to other threads are ignored. */
  async deleteMessages(threadId: string, messageIds: string[]): Promise<number> {
    const res = await this.request<{ deleted: number }>(
      'POST',
      `/threads/${encodeURIComponent(threadId)}/messages/delete`,
      { body: { messageIds } },
    );
    return res.deleted;
  }

  /** Everything stored for one resource (user): working memory and threads. */
  getResource(resourceId: string, query: { page?: number; perPage?: number } = {}) {
    return this.request<{
      resourceId: string;
      workingMemory: string | null;
      threads: MemoryThread[];
      totalThreads: number;
      hasMore: boolean;
    }>('GET', `/resources/${encodeURIComponent(resourceId)}`, { query });
  }

  /** Resources (users) in the instance, most recently active first. */
  listResources(query: { page?: number; perPage?: number } = {}) {
    return this.request<{
      resources: { resourceId: string; threadCount: number; lastActiveAt: string }[];
      hasMore: boolean;
    }>('GET', '/resources', { query });
  }

  /** Deletes every thread, message, observation and the working memory for a resource. */
  async deleteResource(resourceId: string): Promise<number> {
    const res = await this.request<{ deletedThreads: number }>(
      'DELETE',
      `/resources/${encodeURIComponent(resourceId)}`,
    );
    return res.deletedThreads;
  }

  private get base(): string {
    return `${this.opts.apiUrl}/v1/memory/${encodeURIComponent(this.opts.instanceId)}`;
  }

  private async request<T>(method: string, path: string, init: { query?: Query; body?: unknown } = {}): Promise<T> {
    const url = new URL(this.base + path);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = { authorization: `Bearer ${this.opts.accessToken}` };
    if (this.opts.actingUserId) headers['x-acting-user-id'] = this.opts.actingUserId;
    if (this.opts.projectId) headers['x-mastra-project-id'] = this.opts.projectId;
    if (this.opts.environmentId) headers['x-mastra-environment-id'] = this.opts.environmentId;
    if (init.body !== undefined) headers['content-type'] = 'application/json';

    const res = await this.opts.fetch(url, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!res.ok) throw new PlatformMemoryApiError(res.status, await res.text().catch(() => ''));
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
