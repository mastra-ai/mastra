import { z } from 'zod';

import { resolveClient, stripTrailingSlashes } from './client.js';
import type { ConnectClientOptions, ResolvedClient } from './client.js';
import { MastraConnectError, parseRetryAfterMs } from './errors.js';

const DEFAULT_EVENTS_URL = 'https://events.mastra.ai';
const REGIONAL_EVENTS_URLS: Record<'us' | 'eu', string> = {
  us: 'https://events.us.mastra.ai',
  eu: 'https://events.eu.mastra.ai',
};

const TOPIC_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;
const CURSOR_PATTERN = /^-?\d{1,20}$/;

const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;
/** Three missed 15s server pings. */
const DEFAULT_IDLE_TIMEOUT_MS = 45_000;
/** Floor for a server-sent `retry`, so `retry: 0` can't cause a reconnect hot loop. */
const MIN_SERVER_RETRY_MS = 100;
/** Longest line the parser buffers; well above the largest provider webhook. */
const MAX_LINE_LENGTH = 32 * 1024 * 1024;

export interface EventsClientOptions extends ConnectClientOptions {
  /**
   * Events service base URL. Falls back to MASTRA_EVENTS_API_URL, then the
   * regional default from MASTRA_PLATFORM_REGION ('us' | 'eu'), then
   * https://events.mastra.ai.
   */
  eventsUrl?: string;
  /**
   * First reconnect delay. Defaults to the `retry` the server sends, or 1000.
   * Later attempts back off exponentially with jitter.
   */
  reconnectDelayMs?: number;
  /** Upper bound for the reconnect delay. Defaults to 30000. */
  maxReconnectDelayMs?: number;
  /**
   * Reconnect when nothing (not even a keep-alive ping) arrives for this long.
   * Defaults to 45000, three missed server pings.
   */
  idleTimeoutMs?: number;
}

export interface SubscribeOptions {
  /** Resume after this event id (exclusive). Omit to start at the tail. */
  after?: string;
  /** Ends the subscription when aborted. */
  signal?: AbortSignal;
  /** Project whose topic to read. Defaults to the client's project. */
  projectId?: string;
}

/** One event from a project topic. */
export interface TopicEvent {
  id: string;
  /** Milliseconds since the epoch, as recorded by the event store. */
  timestamp: number;
  fields: Record<string, string>;
}

/** A provider event from a project's `connect` topic. */
export interface ConnectEvent {
  id: string;
  timestamp: number;
  connectionId: string;
  integrationId: string;
  eventType: string;
  /** The provider's delivery id, when the platform could identify one. */
  sourceEventId: string | null;
  /** The raw provider body, parsed from JSON. */
  payload: unknown;
  /** Set when `payload` was not valid JSON; `payload` is then the raw string. */
  payloadParseError?: true;
  /**
   * True when the platform could not verify the provider's signature. Never
   * act on such a payload; at most use it as a trigger to re-fetch state.
   */
  unverified: boolean;
}

const topicEventSchema = z.object({
  id: z.string().regex(CURSOR_PATTERN),
  timestamp: z.number(),
  fields: z.record(z.string(), z.string()),
});

/** Resolves the events service base URL from options and the environment. */
export function resolveEventsUrl(options?: { eventsUrl?: string }): string {
  const explicit = options?.eventsUrl?.trim() || process.env.MASTRA_EVENTS_API_URL?.trim();
  if (explicit) {
    // The URL may carry credentials, so error messages never echo it.
    let url: URL;
    try {
      url = new URL(explicit);
    } catch {
      throw new MastraConnectError('invalid_options', 'Invalid events service URL: not an absolute URL.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new MastraConnectError('invalid_options', 'Invalid events service URL: expected http or https.');
    }
    return stripTrailingSlashes(explicit);
  }
  const region = process.env.MASTRA_PLATFORM_REGION?.trim().toLowerCase();
  if (region === 'us' || region === 'eu') return REGIONAL_EVENTS_URLS[region];
  return DEFAULT_EVENTS_URL;
}

/** Largest delay `setTimeout` honors; larger values fire almost immediately. */
const MAX_TIMER_MS = 2_147_483_647;

function assertPositiveMs(name: string, value: number | undefined): void {
  if (value !== undefined && !(Number.isFinite(value) && value > 0 && value <= MAX_TIMER_MS)) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid ${name}: expected a positive number of milliseconds up to ${MAX_TIMER_MS}.`,
    );
  }
}

/**
 * Client for the Mastra platform events service: reads a project's topics as
 * server-sent events, reconnecting and resuming without gaps.
 *
 * The caller owns the cursor. Persist `subscription.cursor` (or each event's
 * id) once an event is handled, and pass it back as `after` to resume after a
 * restart. Delivery is at-least-once, so handlers should be idempotent.
 *
 * @example
 * ```ts
 * const events = new EventsClient();
 * const subscription = events.connectEvents({ after: savedCursor });
 * for await (const event of subscription) {
 *   await handle(event);
 *   await saveCursor(event.id);
 * }
 * ```
 */
export class EventsClient {
  readonly #client: ResolvedClient;
  readonly #eventsUrl: string;
  readonly #options: EventsClientOptions;

  constructor(options: EventsClientOptions = {}) {
    assertPositiveMs('reconnectDelayMs', options.reconnectDelayMs);
    assertPositiveMs('maxReconnectDelayMs', options.maxReconnectDelayMs);
    assertPositiveMs('idleTimeoutMs', options.idleTimeoutMs);
    this.#client = resolveClient(options);
    this.#eventsUrl = resolveEventsUrl(options);
    this.#options = options;
  }

  /** The events service base URL this client reads from. */
  get eventsUrl(): string {
    return this.#eventsUrl;
  }

  /** Subscribes to a project topic. The connection opens when iteration starts. */
  subscribe(topic: string, options: SubscribeOptions = {}): EventSubscription<TopicEvent> {
    return this.#subscribe(topic, options, event => event);
  }

  /** Subscribes to the project's `connect` topic of provider events. */
  connectEvents(options: SubscribeOptions = {}): EventSubscription<ConnectEvent> {
    return this.#subscribe('connect', options, toConnectEvent);
  }

  #subscribe<T>(topic: string, options: SubscribeOptions, map: (event: TopicEvent) => T): EventSubscription<T> {
    if (!TOPIC_PATTERN.test(topic)) {
      throw new MastraConnectError(
        'invalid_options',
        `Invalid topic '${topic}': expected lowercase letters, digits and hyphens, starting with a letter (max 63).`,
      );
    }
    if (options.after !== undefined && !CURSOR_PATTERN.test(options.after)) {
      throw new MastraConnectError('invalid_options', `Invalid event cursor '${options.after}'.`);
    }
    const projectId = options.projectId?.trim() || this.#client.headers['x-mastra-project-id'];
    if (!projectId) {
      throw new MastraConnectError(
        'missing_project_id',
        'Missing Mastra project id: set MASTRA_PROJECT_ID, or pass projectId to the client or subscribe().',
      );
    }
    const url = `${this.#eventsUrl}/v1/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topic)}`;
    return new EventSubscription<T>({
      url,
      projectId,
      client: this.#client,
      after: options.after,
      signal: options.signal,
      map,
      reconnectDelayMs: this.#options.reconnectDelayMs,
      maxReconnectDelayMs: this.#options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS,
      idleTimeoutMs: this.#options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
    });
  }
}

function toConnectEvent(event: TopicEvent): ConnectEvent {
  const { fields } = event;
  const raw = fields.payload;
  let payload: unknown = null;
  let payloadParseError = false;
  if (raw !== undefined) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
      payloadParseError = true;
    }
  }
  return {
    id: event.id,
    timestamp: event.timestamp,
    connectionId: fields.connectionId ?? '',
    integrationId: fields.integrationId ?? '',
    eventType: fields.eventType ?? '',
    sourceEventId: fields.sourceEventId || null,
    payload,
    ...(payloadParseError ? { payloadParseError: true as const } : {}),
    unverified: fields.unverified === 'true',
  };
}

interface SubscriptionInit<T> {
  url: string;
  projectId: string;
  client: ResolvedClient;
  after?: string;
  signal?: AbortSignal;
  map: (event: TopicEvent) => T;
  reconnectDelayMs?: number;
  maxReconnectDelayMs: number;
  idleTimeoutMs: number;
}

/**
 * A live subscription to one project topic. Iterate it once; it reconnects on
 * server closes, `error` frames, 5xx responses and network failures, and ends
 * with a `MastraConnectError` on 400, 401, 403 and 404.
 */
export class EventSubscription<T = TopicEvent> implements AsyncIterable<T> {
  readonly #init: SubscriptionInit<T>;
  readonly #abort = new AbortController();
  readonly #ready: Promise<string>;
  #resolveReady!: (cursor: string) => void;
  #rejectReady!: (error: unknown) => void;
  #cursor: string | undefined;
  #iterating = false;
  readonly #onCallerAbort = () => this.close();

  constructor(init: SubscriptionInit<T>) {
    this.#init = init;
    this.#cursor = init.after;
    this.#ready = new Promise<string>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    // Callers that never await `ready` must not see an unhandled rejection.
    this.#ready.catch(() => {});
    if (init.signal?.aborted) this.close();
  }

  /** The last delivered event id, or the start cursor before any event. */
  get cursor(): string | undefined {
    return this.#cursor;
  }

  /**
   * Resolves to the start cursor once the first stream opens (after iteration
   * starts). Rejects if the subscription fails or closes before that.
   */
  get ready(): Promise<string> {
    return this.#ready;
  }

  /** Ends the subscription; a pending iteration finishes cleanly. */
  close(): void {
    if (this.#abort.signal.aborted) return;
    this.#init.signal?.removeEventListener('abort', this.#onCallerAbort);
    this.#abort.abort();
    this.#rejectReady(new MastraConnectError('invalid_options', 'Event subscription closed before it was ready.'));
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.#iterating) {
      throw new MastraConnectError('invalid_options', 'An event subscription can only be iterated once.');
    }
    this.#iterating = true;
    // Attached only while iterating, so a subscription that is never iterated holds no listener.
    if (!this.#abort.signal.aborted) {
      if (this.#init.signal?.aborted) this.close();
      else this.#init.signal?.addEventListener('abort', this.#onCallerAbort, { once: true });
    }
    return this.#run();
  }

  async *#run(): AsyncGenerator<T, void, undefined> {
    const closed = this.#abort.signal;
    let attempt = 0;
    let serverRetryMs: number | undefined;
    let retryAfterMs: number | undefined;
    try {
      while (!closed.aborted) {
        const connection = new AbortController();
        const abortConnection = () => connection.abort();
        closed.addEventListener('abort', abortConnection, { once: true });
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        const idle = {
          touch: () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(abortConnection, this.#init.idleTimeoutMs);
          },
          // The consumer may hold an event for a long time; that isn't a silent stream.
          pause: () => clearTimeout(idleTimer),
        };
        try {
          retryAfterMs = undefined;
          idle.touch();
          // Transport failures, idle timeouts and retryable statuses all fall
          // through to the backoff below; fatal statuses throw.
          const response = await this.#init.client
            .fetch(this.#init.url, { headers: this.#headers(), signal: connection.signal })
            .catch(() => undefined);
          if (closed.aborted) return;
          if (response && (!response.ok || !response.body)) {
            await response.body?.cancel().catch(() => {});
            this.#throwIfFatal(response);
            retryAfterMs = parseRetryAfterMs(response);
          } else if (response?.body) {
            yield* this.#readStream(
              response.body,
              idle,
              retry => (serverRetryMs = Math.max(retry, MIN_SERVER_RETRY_MS)),
              () => (attempt = 0),
            );
            if (closed.aborted) return;
          }
        } finally {
          clearTimeout(idleTimer);
          connection.abort();
          closed.removeEventListener('abort', abortConnection);
        }
        await this.#backoff(attempt++, serverRetryMs, retryAfterMs);
      }
    } catch (error) {
      this.#rejectReady(error);
      throw error;
    } finally {
      this.close();
    }
  }

  /** Yields one stream's events until it ends, errors, or sends an `error` frame. */
  async *#readStream(
    body: ReadableStream<Uint8Array>,
    idle: { touch: () => void; pause: () => void },
    onRetry: (ms: number) => void,
    onReady: () => void,
  ): AsyncGenerator<T, void, undefined> {
    const closed = this.#abort.signal;
    try {
      for await (const frame of parseServerSentEvents(body, idle.touch)) {
        if (frame.retry !== undefined) onRetry(frame.retry);
        if (frame.event === 'ready') {
          if (frame.id !== undefined) this.#cursor = frame.id;
          onReady();
          this.#resolveReady(this.#cursor ?? '');
        } else if (frame.event === 'event') {
          const event = parseTopicEvent(frame.data);
          const mapped = this.#init.map(event);
          this.#cursor = event.id;
          idle.pause();
          yield mapped;
          if (closed.aborted) return;
          idle.touch();
        } else if (frame.event === 'error') {
          return;
        }
      }
    } catch (error) {
      // Contract violations are fatal; a dropped connection reconnects.
      if (error instanceof MastraConnectError && !closed.aborted) throw error;
    }
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.#init.client.headers,
      'x-mastra-project-id': this.#init.projectId,
      accept: 'text/event-stream',
      'cache-control': 'no-store',
    };
    if (this.#cursor !== undefined) headers['last-event-id'] = this.#cursor;
    return headers;
  }

  #throwIfFatal(response: Response): void {
    const status = response.status;
    if (status === 400) {
      if (this.#cursor !== undefined) {
        throw new MastraConnectError(
          'invalid_cursor',
          `The events service rejected cursor ${this.#cursor}. Restart without a cursor and reconcile.`,
          { status, source: 'platform' },
        );
      }
      throw new MastraConnectError('invalid_options', 'The events service rejected the subscription (400).', {
        status,
        source: 'platform',
      });
    }
    if (status === 401 || status === 403) {
      throw new MastraConnectError('unauthorized', `The events service refused the subscription (${status}).`, {
        status,
        source: 'platform',
      });
    }
    if (status === 404 || (status >= 400 && status < 500 && status !== 408 && status !== 429)) {
      throw new MastraConnectError('platform_error', `The events service returned ${status}.`, {
        status,
        source: 'platform',
      });
    }
  }

  async #backoff(attempt: number, serverRetryMs: number | undefined, retryAfterMs: number | undefined): Promise<void> {
    const { maxReconnectDelayMs } = this.#init;
    const base = this.#init.reconnectDelayMs ?? serverRetryMs ?? DEFAULT_RECONNECT_DELAY_MS;
    const ceiling = Math.min(maxReconnectDelayMs, base * 2 ** Math.min(attempt, 20));
    // Jitter in [ceiling/2, ceiling] spreads reconnects after a server restart.
    const jittered = ceiling / 2 + Math.random() * (ceiling / 2);
    // A Retry-After on a 429/503 is a floor, capped so it can't stall the stream indefinitely.
    const delay = Math.max(jittered, Math.min(retryAfterMs ?? 0, maxReconnectDelayMs));
    await sleep(delay, this.#abort.signal);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

function parseTopicEvent(data: string): TopicEvent {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    throw new MastraConnectError('invalid_response', 'The events service sent an event frame that is not JSON.');
  }
  const parsed = topicEventSchema.safeParse(json);
  if (!parsed.success) {
    throw new MastraConnectError('invalid_response', 'The events service sent an event with an unexpected shape.');
  }
  return parsed.data;
}

/** One dispatched server-sent event. */
export interface ServerSentEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Streaming parser for `text/event-stream` (WHATWG HTML §9.2). Handles CRLF,
 * LF and CR line endings, comments, multi-line `data`, and frames split
 * across chunks. A final block without its terminating blank line is
 * discarded, as the spec requires. `onChunk` runs for every chunk received,
 * including keep-alive comments.
 *
 * One deliberate difference from the spec: a block dispatches when it has any
 * field (`event`, `data`, `id` or `retry`), not only when it has `data`, so a
 * `retry`-only block still reaches the caller. Lines longer than 32 MiB throw
 * `invalid_response`.
 */
export async function* parseServerSentEvents(
  body: ReadableStream<Uint8Array>,
  onChunk?: () => void,
): AsyncGenerator<ServerSentEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  // Text after the last line break, kept as chunks so a long line isn't re-copied on every chunk.
  let pending: string[] = [];
  let pendingLength = 0;
  let event = '';
  let data: string[] = [];
  let id: string | undefined;
  let retry: number | undefined;
  let hasField = false;
  let skipLeadingLf = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      onChunk?.();
      const decoded = decoder.decode(value, { stream: true });
      if (!decoded.includes('\n') && !decoded.includes('\r')) {
        pending.push(decoded);
        pendingLength += decoded.length;
        if (pendingLength > MAX_LINE_LENGTH) {
          throw new MastraConnectError('invalid_response', 'The events service sent a line longer than 32 MiB.');
        }
        continue;
      }
      // The pending text holds no line break, so scanning resumes where it ended.
      const scanFrom = pendingLength;
      pending.push(decoded);
      const buffer = pending.join('');

      let start = 0;
      for (let i = scanFrom; i < buffer.length; i++) {
        const char = buffer[i];
        if (char === '\n' && skipLeadingLf && i === start) {
          // Second half of a CRLF split across chunks.
          skipLeadingLf = false;
          start = i + 1;
          continue;
        }
        skipLeadingLf = false;
        if (char !== '\n' && char !== '\r') continue;
        const line = buffer.slice(start, i);
        if (char === '\r') {
          if (buffer[i + 1] === '\n') i++;
          else if (i + 1 === buffer.length) skipLeadingLf = true;
        }
        start = i + 1;

        if (line === '') {
          if (hasField) {
            yield {
              event: event || 'message',
              data: data.join('\n'),
              ...(id !== undefined ? { id } : {}),
              ...(retry !== undefined ? { retry } : {}),
            };
          }
          event = '';
          data = [];
          id = undefined;
          retry = undefined;
          hasField = false;
          continue;
        }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let fieldValue = colon === -1 ? '' : line.slice(colon + 1);
        if (fieldValue.startsWith(' ')) fieldValue = fieldValue.slice(1);
        if (field === 'event') {
          event = fieldValue;
          hasField = true;
        } else if (field === 'data') {
          data.push(fieldValue);
          hasField = true;
        } else if (field === 'id') {
          if (!fieldValue.includes('\0')) id = fieldValue;
          hasField = true;
        } else if (field === 'retry') {
          if (/^\d+$/.test(fieldValue)) retry = Number(fieldValue);
          hasField = true;
        }
      }
      const rest = buffer.slice(start);
      pending = [rest];
      pendingLength = rest.length;
      if (pendingLength > MAX_LINE_LENGTH) {
        throw new MastraConnectError('invalid_response', 'The events service sent a line longer than 32 MiB.');
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
