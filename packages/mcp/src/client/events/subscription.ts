import type { MastraError } from '@mastra/core/error';
import { DEFAULT_EVENTS_HEARTBEAT_INTERVAL_MS, DEFAULT_MIN_POLL_INTERVAL_MS } from '../../shared/events';
import type { EventOccurrence } from '../../shared/events';
import { eventsError, isFatal, toFatalError, toTransientError } from './errors';
import type { DeliveryContext, DeliveryDriver, ResolvedDeliveryOptions } from './mode';
import type {
  EventsPort,
  MCPEventDeliveryMode,
  MCPEventOccurrence,
  MCPEventSubscribeOptions,
  MCPEventSubscription,
  MCPEventSubscriptionError,
} from './types';

const DEFAULT_DEDUP_WINDOW = 1000;
const DEFAULT_RETRY = { initialDelayMs: 1000, maxDelayMs: 30_000, factor: 2, maxAttempts: Infinity };

export interface EventSubscriptionConfig {
  port: EventsPort;
  serverName: string;
  name: string;
  arguments?: Record<string, unknown>;
  driver: DeliveryDriver;
  options?: MCPEventSubscribeOptions;
  /** Used when `options.streamOpenTimeoutMs` is not set. */
  defaultStreamOpenTimeoutMs: number;
  /** Called once, synchronously, when the subscription is created. */
  onOpen?: (subscription: EventSubscription) => void;
  /** Called once when the subscription ends for any reason. */
  onClose?: (subscription: EventSubscription) => void;
  /** Source of jitter; tests pin it. */
  random?: () => number;
}

type Waiter = {
  resolve: (result: IteratorResult<MCPEventOccurrence>) => void;
  reject: (error: unknown) => void;
};

/**
 * A client-side MCP Events subscription: owns the cursor, de-duplication, the occurrence queue and
 * the retry loop, and delegates the wire work for each session to a {@link DeliveryDriver}.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export class EventSubscription implements MCPEventSubscription {
  readonly name: string;
  readonly arguments: Record<string, unknown> | undefined;
  readonly mode: MCPEventDeliveryMode;

  /** Latest position the server confirmed; the next request resumes from it. */
  private resumeCursor: string | null;
  /** Position covering only occurrences already handed to the consumer. */
  private yieldedCursor: string | null;
  private currentTruncated = false;
  /** A gap was reported and the next delivered occurrence is the first one after it. */
  private pendingGap = false;
  private readonly port: EventsPort;
  private readonly driver: DeliveryDriver;
  private readonly resolved: ResolvedDeliveryOptions;
  private readonly retry: typeof DEFAULT_RETRY;
  private readonly random: () => number;
  private readonly details: { serverName: string; eventName: string };
  private readonly onClose?: (subscription: EventSubscription) => void;

  private readonly abort = new AbortController();
  private readonly errorHandlers = new Set<(error: MCPEventSubscriptionError) => void>();
  private readonly dedupWindow: number;
  private readonly seenIds = new Set<string>();
  private readonly seenOrder: string[] = [];

  /** Undelivered occurrences, each with the position that becomes safe once it is yielded. */
  private readonly buffer: {
    value: MCPEventOccurrence;
    cursorAfter?: { cursor: string | null };
    /** First occurrence after a reported gap. */
    afterGap?: boolean;
  }[] = [];
  private readonly waiters: Waiter[] = [];
  private ending?: { error?: MastraError };
  private endingDelivered = false;

  private isEstablished = false;
  private sessionHealthy = false;
  private resolveReady!: () => void;
  private rejectReady!: (error: unknown) => void;
  private readonly ready: Promise<void>;
  private loopDone: Promise<void> = Promise.resolve();

  /** Bumped by {@link onReconnected}; a session that sees it change skips its backoff. */
  private reconnectEpoch = 0;
  private wakeBackoff?: () => void;

  private constructor(config: EventSubscriptionConfig) {
    const options = config.options ?? {};
    this.port = config.port;
    this.driver = config.driver;
    this.mode = config.driver.mode;
    this.name = config.name;
    this.arguments = config.arguments;
    this.resumeCursor = options.cursor ?? null;
    this.yieldedCursor = this.resumeCursor;
    this.details = { serverName: config.serverName, eventName: config.name };
    this.onClose = config.onClose;
    this.random = config.random ?? Math.random;
    this.dedupWindow = options.dedupWindow ?? DEFAULT_DEDUP_WINDOW;
    this.retry = { ...DEFAULT_RETRY, ...options.retry };
    this.resolved = {
      maxAgeMs: options.maxAgeMs,
      maxEvents: options.maxEvents,
      minPollIntervalMs: options.minPollIntervalMs ?? DEFAULT_MIN_POLL_INTERVAL_MS,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 2 * DEFAULT_EVENTS_HEARTBEAT_INTERVAL_MS,
      streamOpenTimeoutMs: options.streamOpenTimeoutMs ?? config.defaultStreamOpenTimeoutMs,
    };
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.ready.catch(() => {});

    const signal = options.signal;
    if (signal) {
      if (signal.aborted) this.abort.abort();
      else signal.addEventListener('abort', () => void this.cancel(), { once: true });
    }
  }

  /** Starts the subscription and resolves once the server has accepted it. */
  static async start(config: EventSubscriptionConfig): Promise<EventSubscription> {
    const subscription = new EventSubscription(config);
    config.onOpen?.(subscription);
    subscription.loopDone = subscription.run();
    await subscription.ready;
    return subscription;
  }

  get cursor(): string | null {
    return this.yieldedCursor;
  }

  get truncated(): boolean {
    return this.currentTruncated;
  }

  onError(handler: (error: MCPEventSubscriptionError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  async cancel(): Promise<void> {
    this.abort.abort();
    this.wakeBackoff?.();
    await this.loopDone;
  }

  /**
   * Called by the client after a (re)connect: a subscription waiting out a backoff starts its
   * next session right away, on the new connection.
   *
   * @internal
   */
  onReconnected(): void {
    this.reconnectEpoch++;
    this.wakeBackoff?.();
  }

  [Symbol.asyncIterator](): AsyncIterator<MCPEventOccurrence> {
    return {
      next: () => this.next(),
      return: async () => {
        await this.cancel();
        return { value: undefined, done: true };
      },
    };
  }

  private next(): Promise<IteratorResult<MCPEventOccurrence>> {
    const entry = this.buffer.shift();
    if (entry) {
      if (entry.cursorAfter) this.yieldedCursor = entry.cursorAfter.cursor;
      this.currentTruncated = entry.afterGap === true;
      return Promise.resolve({ value: entry.value, done: false });
    }
    if (this.ending) {
      if (this.ending.error && !this.endingDelivered) {
        this.endingDelivered = true;
        return Promise.reject(this.ending.error);
      }
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  private enqueue(occurrence: EventOccurrence): void {
    if (this.ending) return;
    if (this.dedupWindow > 0) {
      if (this.seenIds.has(occurrence.eventId)) return;
      this.seenIds.add(occurrence.eventId);
      this.seenOrder.push(occurrence.eventId);
      if (this.seenOrder.length > this.dedupWindow) this.seenIds.delete(this.seenOrder.shift()!);
    }
    const afterGap = this.pendingGap;
    this.pendingGap = false;
    const waiter = this.waiters.shift();
    if (waiter) {
      this.currentTruncated = afterGap;
      waiter.resolve({ value: occurrence, done: false });
    } else this.buffer.push({ value: occurrence, ...(afterGap ? { afterGap } : {}) });
  }

  /**
   * Records a gap reported by the server. `truncated` turns true now if nothing is waiting to be
   * yielded, and stays true until an occurrence received after the gap has been yielded and the
   * next one is requested, so a consumer reading it per occurrence sees the gap exactly once.
   */
  private markGap(): void {
    this.pendingGap = true;
    if (this.buffer.length === 0) this.currentTruncated = true;
  }

  /**
   * Moves the resume position now, and the public cursor once every occurrence buffered before
   * this point has been yielded, so a persisted cursor never skips an undelivered occurrence.
   */
  private setPosition(cursor: string | null): void {
    this.resumeCursor = cursor;
    const last = this.buffer.at(-1);
    if (last) last.cursorAfter = { cursor };
    else this.yieldedCursor = cursor;
  }

  private end(error?: MastraError): void {
    if (this.ending) return;
    this.ending = { error };
    if (!this.isEstablished) this.rejectReady(error ?? this.cancelledError());
    const waiters = this.waiters.splice(0);
    for (const [index, waiter] of waiters.entries()) {
      if (error && index === 0) {
        this.endingDelivered = true;
        waiter.reject(error);
      } else {
        waiter.resolve({ value: undefined, done: true });
      }
    }
    this.onClose?.(this);
  }

  private cancelledError(): MastraError {
    return eventsError(
      'MCP_EVENTS_SUBSCRIPTION_CANCELLED',
      `Subscription to '${this.name}' was cancelled`,
      this.details,
    );
  }

  private emitError(error: MastraError): void {
    if (this.errorHandlers.size === 0) {
      this.port.log('warning', error.message, { ...this.details, id: error.id });
      return;
    }
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (handlerError) {
        this.port.log('error', 'Event subscription onError handler threw', {
          ...this.details,
          error: handlerError instanceof Error ? handlerError.message : String(handlerError),
        });
      }
    }
  }

  private context(): DeliveryContext {
    const resumeCursor = () => this.resumeCursor;
    return {
      port: this.port,
      name: this.name,
      arguments: this.arguments,
      options: this.resolved,
      signal: this.abort.signal,
      get cursor() {
        return resumeCursor();
      },
      deliver: occurrence => this.enqueue(occurrence),
      setPosition: (cursor, truncated) => {
        if (truncated) this.markGap();
        this.setPosition(cursor ?? null);
      },
      markGap: () => this.markGap(),
      established: () => {
        this.sessionHealthy = true;
        if (!this.isEstablished) {
          this.isEstablished = true;
          this.resolveReady();
        }
      },
      reportError: error => this.emitError(error),
      sleep: ms => this.sleep(ms, false),
    };
  }

  /** Resolves after `ms`, on cancel, and (for backoff waits) on {@link onReconnected}. */
  private sleep(ms: number, wakeOnReconnect: boolean): Promise<void> {
    if (this.abort.signal.aborted) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer);
        this.abort.signal.removeEventListener('abort', done);
        if (this.wakeBackoff === done) this.wakeBackoff = undefined;
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.abort.signal.addEventListener('abort', done, { once: true });
      if (wakeOnReconnect) this.wakeBackoff = done;
    });
  }

  private backoffDelay(attempt: number): number {
    const { initialDelayMs, maxDelayMs, factor } = this.retry;
    const ceiling = Math.min(maxDelayMs, initialDelayMs * factor ** (attempt - 1));
    return Math.floor(this.random() * ceiling);
  }

  private async run(): Promise<void> {
    const signal = this.abort.signal;
    let attempt = 0;
    let first = true;
    while (!signal.aborted) {
      const epoch = this.reconnectEpoch;
      this.sessionHealthy = false;
      try {
        if (!first) await this.port.ensureConnected();
        first = false;
        await this.driver.session(this.context());
        if (!signal.aborted && !this.isEstablished) {
          throw eventsError(
            'MCP_EVENTS_SUBSCRIPTION_FAILED',
            `Server never confirmed the '${this.name}' subscription`,
            this.details,
          );
        }
      } catch (error) {
        if (signal.aborted) break;
        if (!this.isEstablished || isFatal(error)) {
          this.end(toFatalError(error, this.details));
          return;
        }
        this.emitError(toTransientError(error, this.details));
      }
      if (signal.aborted) break;

      attempt = this.sessionHealthy ? 1 : attempt + 1;
      if (attempt > this.retry.maxAttempts) {
        this.end(
          eventsError(
            'MCP_EVENTS_RETRIES_EXHAUSTED',
            `Gave up on the '${this.name}' subscription after ${this.retry.maxAttempts} failed attempts`,
            { ...this.details, maxAttempts: this.retry.maxAttempts },
          ),
        );
        return;
      }
      if (this.reconnectEpoch === epoch) await this.sleep(this.backoffDelay(attempt), true);
    }
    this.end();
  }
}
