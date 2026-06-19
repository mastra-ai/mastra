export type SlackRtmMessageEvent = {
  type: 'message';
  user?: string;
  text?: string;
  ts: string;
  threadTs?: string;
  channel: string;
  channelType?: string;
  subtype?: string;
  botId?: string;
  username?: string;
  eventTs: string;
};

export type SlackRtmEvent = {
  type: string;
  [key: string]: unknown;
};

export type SlackRtmLifecycleState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export type SlackRtmClientOptions = {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  pingIntervalMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
};

type MessageHandler = (event: SlackRtmMessageEvent) => void;
type EventHandler = (event: SlackRtmEvent) => void;
type LifecycleHandler = (state: SlackRtmLifecycleState, error?: Error) => void;

const DEFAULT_SLACK_BASE_URL = 'https://slack.com/api/';
const DEFAULT_PING_INTERVAL_MS = 30_000;
const DEFAULT_RECONNECT_BASE_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const normalized = baseUrl ?? DEFAULT_SLACK_BASE_URL;
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export class SlackRtmClient {
  readonly #token: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #pingIntervalMs: number;
  readonly #reconnectBaseMs: number;
  readonly #reconnectMaxMs: number;

  #ws?: WebSocket;
  #state: SlackRtmLifecycleState = 'disconnected';
  #manuallyDisconnected = false;
  #reconnectAttempts = 0;
  #pingTimer?: ReturnType<typeof setInterval>;
  #lastPongMs = 0;
  #reconnectUrl: string | undefined;
  #eventHandlers = new Map<string, Set<EventHandler>>();
  #messageHandlers = new Set<MessageHandler>();
  #lifecycleHandlers = new Set<LifecycleHandler>();

  constructor(options: SlackRtmClientOptions) {
    this.#token = options.token;
    this.#baseUrl = normalizeBaseUrl(options.baseUrl);
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#pingIntervalMs = options.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
    this.#reconnectBaseMs = options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
    this.#reconnectMaxMs = options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS;
  }

  get connected(): boolean {
    return this.#state === 'connected';
  }

  get state(): SlackRtmLifecycleState {
    return this.#state;
  }

  onMessage(handler: MessageHandler): void {
    this.#messageHandlers.add(handler);
  }

  onEvent(type: string, handler: EventHandler): void {
    let handlers = this.#eventHandlers.get(type);
    if (!handlers) {
      handlers = new Set();
      this.#eventHandlers.set(type, handlers);
    }
    handlers.add(handler);
  }

  onLifecycle(handler: LifecycleHandler): void {
    this.#lifecycleHandlers.add(handler);
  }

  async connect(): Promise<void> {
    this.#manuallyDisconnected = false;
    this.#setState('connecting');
    await this.#openConnection();
  }

  disconnect(): void {
    this.#manuallyDisconnected = true;
    this.#clearPingTimer();
    if (this.#ws) {
      try {
        this.#ws.close(1000, 'client disconnect');
      } catch {
        // ignore
      }
      this.#ws = undefined;
    }
    this.#setState('disconnected');
  }

  async #openConnection(): Promise<void> {
    const wsUrl = await this.#getWebSocketUrl();
    this.#openSocket(wsUrl);
  }

  async #getWebSocketUrl(): Promise<string> {
    if (this.#reconnectUrl) {
      const url = this.#reconnectUrl;
      this.#reconnectUrl = undefined;
      return url;
    }

    const params = new URLSearchParams();
    params.set('token', this.#token);
    const response = await this.#fetch(`${this.#baseUrl}rtm.connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`rtm.connect HTTP ${response.status}`);
    }

    const body: unknown = await response.json();
    if (!isPlainObject(body)) {
      throw new Error('rtm.connect returned invalid response');
    }
    if (body['ok'] !== true) {
      const error = readString(body['error']) ?? 'unknown';
      throw new Error(`rtm.connect failed: ${error}`);
    }

    const url = readString(body['url']);
    if (!url) {
      throw new Error('rtm.connect returned no WebSocket URL');
    }

    return url;
  }

  #openSocket(url: string): void {
    this.#ws = new WebSocket(url);

    this.#ws.addEventListener('open', () => {
      this.#reconnectAttempts = 0;
      this.#lastPongMs = Date.now();
      this.#startPingTimer();
    });

    this.#ws.addEventListener('message', (event: MessageEvent) => {
      this.#handleMessage(event.data);
    });

    this.#ws.addEventListener('error', () => {
      this.#setState('error', new Error('WebSocket error'));
    });

    this.#ws.addEventListener('close', () => {
      this.#clearPingTimer();
      this.#ws = undefined;

      if (this.#manuallyDisconnected) {
        this.#setState('disconnected');
        return;
      }

      this.#scheduleReconnect();
    });
  }

  #handleMessage(data: unknown): void {
    let parsed: unknown;
    try {
      parsed = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {
      return;
    }

    if (!isPlainObject(parsed)) return;

    const type = readString(parsed.type);
    if (!type) return;

    const event = parsed as SlackRtmEvent;

    // Lifecycle events
    if (type === 'hello') {
      this.#setState('connected');
      return;
    }

    if (type === 'pong') {
      this.#lastPongMs = Date.now();
      return;
    }

    if (type === 'reconnect_url') {
      this.#reconnectUrl = readString(parsed.url);
      return;
    }

    if (type === 'team_migration_started') {
      this.#clearPingTimer();
      if (this.#ws) {
        try {
          this.#ws.close(1000, 'migration');
        } catch {
          // ignore
        }
      }
      return;
    }

    if (type === 'error') {
      const msg = readString((parsed as Record<string, unknown>)['error']);
      const error = new Error(msg ?? 'RTM error');
      this.#setState('error', error);
      return;
    }

    // Dispatch to type-specific handlers
    const handlers = this.#eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) handler(event);
    }

    // Dispatch message events
    if (type === 'message') {
      const messageEvent = this.#mapMessageEvent(parsed);
      if (messageEvent) {
        for (const handler of this.#messageHandlers) {
          handler(messageEvent);
        }
      }
    }
  }

  #mapMessageEvent(raw: Record<string, unknown>): SlackRtmMessageEvent | undefined {
    const ts = readString(raw.ts);
    const channel = readString(raw.channel);
    if (!ts || !channel) return undefined;

    return {
      type: 'message',
      ts,
      channel,
      ...(readString(raw.channel_type) ? { channelType: readString(raw.channel_type)! } : {}),
      ...(readString(raw.subtype) ? { subtype: readString(raw.subtype)! } : {}),
      ...(readString(raw.user) ? { user: readString(raw.user)! } : {}),
      ...(readString(raw.text) ? { text: readString(raw.text)! } : {}),
      ...(readString(raw.thread_ts) ? { threadTs: readString(raw.thread_ts)! } : {}),
      ...(readString(raw.bot_id) ? { botId: readString(raw.bot_id)! } : {}),
      ...(readString(raw.username) ? { username: readString(raw.username)! } : {}),
      eventTs: readString(raw.event_ts) ?? ts,
    };
  }

  #startPingTimer(): void {
    this.#clearPingTimer();
    this.#pingTimer = setInterval(() => {
      if (this.#ws?.readyState === WebSocket.OPEN) {
        try {
          this.#ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore send errors
        }
      }

      // Check for missed pong — if we haven't received one in 2x the interval, reconnect
      if (this.#lastPongMs > 0 && Date.now() - this.#lastPongMs > this.#pingIntervalMs * 2) {
        this.#clearPingTimer();
        if (this.#ws) {
          try {
            this.#ws.close(4000, 'ping timeout');
          } catch {
            // ignore
          }
        }
      }
    }, this.#pingIntervalMs);
  }

  #clearPingTimer(): void {
    if (this.#pingTimer) {
      clearInterval(this.#pingTimer);
      this.#pingTimer = undefined;
    }
  }

  #scheduleReconnect(): void {
    if (this.#manuallyDisconnected) return;

    this.#reconnectAttempts += 1;
    const delay = Math.min(
      this.#reconnectBaseMs * Math.pow(2, this.#reconnectAttempts - 1),
      this.#reconnectMaxMs,
    );

    this.#setState('reconnecting');

    setTimeout(() => {
      if (this.#manuallyDisconnected) return;
      this.#setState('connecting');
      this.#openConnection().catch((error: unknown) => {
        this.#setState('error', error instanceof Error ? error : new Error(String(error)));
        this.#scheduleReconnect();
      });
    }, delay);
  }

  #setState(state: SlackRtmLifecycleState, error?: Error): void {
    this.#state = state;
    for (const handler of this.#lifecycleHandlers) {
      handler(state, error);
    }
  }
}
