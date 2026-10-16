import { EVENTS_NOTIFICATIONS, EVENTS_SUBSCRIPTION_ID_META_KEY } from '../../shared/events';
import type { EventOccurrence } from '../../shared/events';
import type { BufferedEvent } from './ring-buffer';

type SubscriptionId = string | number;

export interface StreamNotification {
  method: string;
  params: Record<string, unknown>;
}

export interface EventStreamOptions {
  subscriptionId: SubscriptionId;
  /** Sends a notification related to the `events/stream` request. */
  notify: (notification: StreamNotification) => Promise<void>;
  heartbeatIntervalMs: number;
  /** Subscription filter, already bound to the subscription's arguments. */
  match?: (data: Record<string, unknown>) => boolean;
  onError?: (error: unknown) => void;
}

/**
 * Server side of one push subscription (`events/stream`).
 *
 * Every notification goes through one promise chain, so `active` is always first and events
 * arrive in emit order. A heartbeat is sent whenever `heartbeatIntervalMs` passes without
 * another message.
 */
export class EventStream {
  /** Resolves once the stream is closed. */
  readonly closed: Promise<void>;

  private queue: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cursor: string | null = null;
  private isClosed = false;
  private started = false;
  private readonly pending: Array<[method: string, params: Record<string, unknown>]> = [];
  private readonly cleanups: Array<() => void> = [];
  private resolveClosed!: () => void;

  constructor(private readonly options: EventStreamOptions) {
    this.closed = new Promise(resolve => {
      this.resolveClosed = resolve;
    });
  }

  get subscriptionId(): SubscriptionId {
    return this.options.subscriptionId;
  }

  /** Runs `cleanup` when the stream closes. */
  onClose(cleanup: () => void): void {
    if (this.isClosed) cleanup();
    else this.cleanups.push(cleanup);
  }

  /** Sends `active`, then the replayed events, and starts the heartbeat. */
  start(start: { cursor: string | null; truncated: boolean; replay?: EventOccurrence[] }): void {
    this.cursor = start.cursor;
    this.started = true;
    this.send(EVENTS_NOTIFICATIONS.active, { cursor: start.cursor, truncated: start.truncated });
    for (const [method, params] of this.pending.splice(0)) this.send(method, params);
    for (const event of start.replay ?? []) this.sendEvent(event);
  }

  /** Live listener: forwards an emitted event if it matches the subscription. */
  deliver(entry: BufferedEvent): void {
    if (this.isClosed) return;
    if (this.matches(entry.occurrence.data)) {
      this.sendEvent({ ...entry.occurrence, cursor: entry.cursor });
    } else {
      this.cursor = entry.cursor;
    }
  }

  /** `match` for replay and live delivery. A throwing `match` is reported on the stream as a recoverable error. */
  matches(data: Record<string, unknown>): boolean {
    if (!this.options.match) return true;
    try {
      return this.options.match(data);
    } catch (error) {
      this.options.onError?.(error);
      this.send(EVENTS_NOTIFICATIONS.error, {
        error: {
          code: -32603,
          message: `Event filter failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
      return false;
    }
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.resolveClosed();
  }

  private sendEvent(event: EventOccurrence): void {
    if (event.cursor !== undefined) this.cursor = event.cursor;
    this.send(EVENTS_NOTIFICATIONS.event, { ...event });
  }

  private send(method: string, params: Record<string, unknown>): void {
    if (this.isClosed) return;
    // Errors raised while the replay is computed wait until `active` has been queued.
    if (!this.started) {
      this.pending.push([method, params]);
      return;
    }
    const notification = {
      method,
      params: { ...params, _meta: { [EVENTS_SUBSCRIPTION_ID_META_KEY]: this.options.subscriptionId } },
    };
    this.queue = this.queue
      .then(async () => {
        if (this.isClosed) return;
        await this.options.notify(notification);
        this.armHeartbeat();
      })
      .catch(error => {
        this.options.onError?.(error);
        this.close();
      });
  }

  private armHeartbeat(): void {
    if (this.isClosed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.send(EVENTS_NOTIFICATIONS.heartbeat, { cursor: this.cursor });
    }, this.options.heartbeatIntervalMs);
  }
}
