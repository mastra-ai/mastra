import { processThreadSignalStream } from './stream';
import type {
  ProcessThreadSignalsOptions,
  ThreadMessageAccepted,
  ThreadMessageHistory,
  ThreadMessageHistoryOptions,
  ThreadMessageInput,
  ThreadSignalChunk,
  ThreadSignalRunSnapshot,
  ThreadSignalsClientOptions,
  ThreadSignalsSubscription,
  ThreadTarget,
  ThreadToolApprovalAccepted,
  ThreadToolApprovalInput,
} from './types';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const THREAD_RUN_STATUSES = new Set(['idle', 'running', 'suspended', 'completed', 'failed', 'aborted']);

function normalizePath(path: string): string {
  const normalized = path.trim().replace(/\/+/g, '/').replace(/\/$/, '');
  if (!normalized || normalized === '/') return '';
  if (normalized.includes('..') || normalized.includes('?') || normalized.includes('#')) {
    throw new Error(`Invalid API prefix: "${path}"`);
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function encodeBase64Utf8(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    result += BASE64_ALPHABET[(combined >> 18) & 63];
    result += BASE64_ALPHABET[(combined >> 12) & 63];
    result += second === undefined ? '=' : BASE64_ALPHABET[(combined >> 6) & 63];
    result += third === undefined ? '=' : BASE64_ALPHABET[combined & 63];
  }
  return result;
}

function snapshotFromChunk(
  current: ThreadSignalRunSnapshot,
  chunk: ThreadSignalChunk,
): ThreadSignalRunSnapshot | undefined {
  if (
    chunk.type === 'data-thread-state' &&
    chunk.data &&
    typeof chunk.data === 'object' &&
    'status' in chunk.data &&
    typeof chunk.data.status === 'string' &&
    THREAD_RUN_STATUSES.has(chunk.data.status) &&
    'updatedAt' in chunk.data &&
    typeof chunk.data.updatedAt === 'string'
  ) {
    return chunk.data as unknown as ThreadSignalRunSnapshot;
  }

  const runId = typeof chunk.runId === 'string' ? chunk.runId : current.runId;
  const updatedAt = new Date().toISOString();
  if (chunk.type === 'start' || chunk.type === 'agent-execution-start') {
    return { runId, status: 'running', updatedAt };
  }
  if (
    chunk.type === 'suspended' ||
    chunk.type === 'tool-call-suspended' ||
    chunk.type === 'agent-execution-suspended'
  ) {
    return { runId, status: 'suspended', updatedAt };
  }
  if (chunk.type === 'finish' || chunk.type === 'agent-execution-end') {
    return { runId, status: 'completed', updatedAt };
  }
  if (chunk.type === 'error') return { runId, status: 'failed', updatedAt };
  if (chunk.type === 'abort' || chunk.type === 'agent-execution-abort') {
    return { runId, status: 'aborted', updatedAt };
  }
  return undefined;
}

export class ThreadSignalsClient {
  readonly #options: ThreadSignalsClientOptions;
  readonly #apiPrefix: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: ThreadSignalsClientOptions) {
    this.#options = options;
    this.#apiPrefix = normalizePath(options.apiPrefix ?? '/api');
    this.#fetch = options.fetch ?? globalThis.fetch;
    if (!this.#fetch) {
      throw new Error('ThreadSignalsClient requires a fetch implementation');
    }
  }

  async #request<T>(path: string, init: RequestInit = {}, stream = false): Promise<T> {
    const response = await this.#fetch(`${this.#options.baseUrl.replace(/\/$/, '')}${this.#apiPrefix}${path}`, {
      ...init,
      credentials: init.credentials ?? this.#options.credentials,
      signal: init.signal ?? this.#options.abortSignal,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...this.#options.headers,
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Mastra thread request failed (${response.status}): ${await response.text()}`);
    }
    return (stream ? response : await response.json()) as T;
  }

  sendMessage(params: ThreadMessageInput): Promise<ThreadMessageAccepted> {
    return this.#request(`/agents/${this.#options.agentId}/send-message`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  queueMessage(params: ThreadMessageInput): Promise<ThreadMessageAccepted> {
    return this.#request(`/agents/${this.#options.agentId}/queue-message`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  sendToolApproval(params: ThreadToolApprovalInput): Promise<ThreadToolApprovalAccepted> {
    return this.#request(`/agents/${this.#options.agentId}/send-tool-approval`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  listMessages<TMessage = unknown>(
    threadId: string,
    options: ThreadMessageHistoryOptions = {},
  ): Promise<ThreadMessageHistory<TMessage>> {
    const { requestContext, ...queryOptions } = options;
    const query = new URLSearchParams();
    query.set('agentId', this.#options.agentId);
    for (const [key, value] of Object.entries(queryOptions)) {
      if (value === undefined) continue;
      query.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    if (requestContext) query.set('requestContext', encodeBase64Utf8(requestContext));
    return this.#request(`/memory/threads/${encodeURIComponent(threadId)}/messages?${query.toString()}`);
  }

  async subscribeToThread(target: ThreadTarget): Promise<ThreadSignalsSubscription> {
    const localAbort = new AbortController();
    let unsubscribed = false;
    let response = await this.#openSubscription(target, localAbort.signal);
    let snapshot: ThreadSignalRunSnapshot = {
      status: 'idle',
      updatedAt: new Date().toISOString(),
    };

    const subscription: ThreadSignalsSubscription = {
      get snapshot() {
        return snapshot;
      },
      processDataStream: async options => {
        const reconnect =
          options.reconnect === true
            ? { maxRetries: Infinity, delayMs: 1000 }
            : options.reconnect
              ? {
                  maxRetries: options.reconnect.maxRetries ?? Infinity,
                  delayMs: options.reconnect.delayMs ?? 1000,
                }
              : undefined;
        let attempts = 0;

        while (!unsubscribed) {
          if (!response.body) throw new Error('Mastra thread subscription returned no response body');
          try {
            await processThreadSignalStream({
              stream: response.body,
              signal: localAbort.signal,
              onChunk: async chunk => {
                const nextSnapshot = snapshotFromChunk(snapshot, chunk);
                if (nextSnapshot) {
                  snapshot = nextSnapshot;
                  await options.onSnapshot?.(snapshot);
                }
                await options.onChunk(chunk);
              },
            });
          } catch (error) {
            if (unsubscribed || localAbort.signal.aborted) return;
            if (!reconnect || attempts >= reconnect.maxRetries) throw error;
          }

          if (!reconnect || attempts >= reconnect.maxRetries) return;
          attempts += 1;
          await new Promise(resolve => setTimeout(resolve, reconnect.delayMs));
          if (unsubscribed || localAbort.signal.aborted) return;
          response = await this.#openSubscription(target, localAbort.signal);
        }
      },
      abort: async () => {
        const result = await this.#request<{ aborted: boolean }>(`/agents/${this.#options.agentId}/threads/abort`, {
          method: 'POST',
          body: JSON.stringify(target),
        });
        return result.aborted;
      },
      unsubscribe: () => {
        if (unsubscribed) return;
        unsubscribed = true;
        localAbort.abort();
        void response.body?.cancel().catch(() => {});
      },
    };

    return subscription;
  }

  #openSubscription(target: ThreadTarget, signal: AbortSignal): Promise<Response> {
    return this.#request(
      `/agents/${this.#options.agentId}/threads/subscribe`,
      {
        method: 'POST',
        body: JSON.stringify(target),
        signal,
      },
      true,
    );
  }
}

export function createThreadSignalsClient(options: ThreadSignalsClientOptions): ThreadSignalsClient {
  return new ThreadSignalsClient(options);
}
