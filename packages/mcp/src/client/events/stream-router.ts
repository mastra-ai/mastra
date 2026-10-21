import type { z } from 'zod/v4';
import {
  EVENTS_NOTIFICATIONS,
  EVENTS_SUBSCRIPTION_ID_META_KEY,
  EventActiveNotificationParamsSchema,
  EventErrorNotificationParamsSchema,
  EventHeartbeatNotificationParamsSchema,
  EventNotificationParamsSchema,
  EventTerminatedNotificationParamsSchema,
} from '../../shared/events';
import type { StreamEventsRequestParams } from '../../shared/events';
import { eventsError } from './errors';
import type { EventStreamHandle, EventStreamSink, EventsPort } from './types';

/** The transport operations the router needs from the MCP client. */
export interface EventStreamChannel {
  /**
   * Sends `events/stream` and settles when the request ends. Calls `onSent` with the request's
   * JSON-RPC id when the message goes out on the transport.
   */
  request(params: StreamEventsRequestParams, signal: AbortSignal, onSent: (id: string) => void): Promise<unknown>;
  /** Registers a handler for a notification method; receives the raw `params`. */
  onNotification(method: string, handler: (params: unknown) => void): void;
}

interface PendingOpen {
  sink: EventStreamSink;
  /** JSON-RPC id of the pending `events/stream` request, once it is sent. */
  sentId?: string;
  bind(id: string): void;
}

/**
 * Routes push-stream notifications for one MCP server to the subscription that owns them.
 *
 * The server identifies a stream by the JSON-RPC id of its `events/stream` request. The SDK
 * doesn't return that id, so the channel reports it as the request is sent, and opens are
 * serialized so the reported id always belongs to the pending open. A pending open binds only to
 * an `active` carrying its own id; after that, every notification is routed by
 * `_meta["io.modelcontextprotocol/subscriptionId"]`. A late `active` for an open that timed out,
 * was aborted, or was released never matches a pending open's id, so it is dropped.
 */
export class EventStreamRouter {
  private readonly sinks = new Map<string, EventStreamSink>();
  private pending?: PendingOpen;
  private openLock: Promise<void> = Promise.resolve();
  private listening = false;

  constructor(
    private readonly channel: EventStreamChannel,
    private readonly log: EventsPort['log'],
  ) {}

  /** Opens a stream and resolves once the server confirms it with `notifications/events/active`. */
  async open(
    params: StreamEventsRequestParams,
    sink: EventStreamSink,
    options: { signal: AbortSignal; openTimeoutMs: number },
  ): Promise<EventStreamHandle> {
    this.listen();
    const release = await this.acquire();
    const requestAbort = new AbortController();
    const onAbort = () => requestAbort.abort();
    options.signal.addEventListener('abort', onAbort, { once: true });
    if (options.signal.aborted) requestAbort.abort();

    let boundId: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let confirm!: () => void;
    const confirmed = new Promise<void>(resolve => {
      confirm = resolve;
    });
    const pending: PendingOpen = {
      sink,
      bind: id => {
        boundId = id;
        this.sinks.set(id, sink);
        confirm();
      },
    };
    // Set before sending: the transport can report the id synchronously.
    this.pending = pending;
    const request = this.channel.request(params, requestAbort.signal, id => {
      pending.sentId = id;
    });
    const done = request.then(() => undefined);
    done
      .finally(() => {
        options.signal.removeEventListener('abort', onAbort);
        this.release(boundId, sink);
      })
      .catch(() => {});

    try {
      await new Promise<void>((resolve, reject) => {
        void confirmed.then(resolve);
        request.then(
          () =>
            reject(
              eventsError(
                'MCP_EVENTS_DELIVERY_INTERRUPTED',
                `The '${params.name}' event stream closed before it was confirmed`,
                { eventName: params.name },
              ),
            ),
          reject,
        );
        timer = setTimeout(() => {
          requestAbort.abort();
          reject(
            eventsError(
              'MCP_EVENTS_STREAM_OPEN_TIMEOUT',
              `The server did not confirm the '${params.name}' event stream within ${options.openTimeoutMs}ms`,
              { eventName: params.name, streamOpenTimeoutMs: options.openTimeoutMs },
            ),
          );
        }, options.openTimeoutMs);
      });
    } catch (error) {
      requestAbort.abort();
      throw error;
    } finally {
      clearTimeout(timer);
      this.pending = undefined;
      release();
    }

    return {
      done,
      abort: () => {
        this.release(boundId, sink);
        requestAbort.abort();
      },
    };
  }

  private release(id: string | undefined, sink: EventStreamSink): void {
    if (id === undefined || this.sinks.get(id) !== sink) return;
    this.sinks.delete(id);
  }

  private acquire(): Promise<() => void> {
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const previous = this.openLock;
    this.openLock = previous.then(() => held);
    return previous.then(() => release);
  }

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    this.route(EVENTS_NOTIFICATIONS.active, EventActiveNotificationParamsSchema, (id, params) => {
      const sink = this.sinks.get(id);
      if (sink) return sink.active(params);
      const pending = this.pending;
      if (!pending || pending.sentId !== id) return false;
      pending.bind(id);
      pending.sink.active(params);
    });
    this.route(
      EVENTS_NOTIFICATIONS.event,
      EventNotificationParamsSchema,
      (id, params) => this.sinks.get(id)?.event(params) ?? false,
    );
    this.route(
      EVENTS_NOTIFICATIONS.heartbeat,
      EventHeartbeatNotificationParamsSchema,
      (id, params) => this.sinks.get(id)?.heartbeat(params) ?? false,
    );
    this.route(
      EVENTS_NOTIFICATIONS.error,
      EventErrorNotificationParamsSchema,
      (id, params) => this.sinks.get(id)?.error(params) ?? false,
    );
    this.route(
      EVENTS_NOTIFICATIONS.terminated,
      EventTerminatedNotificationParamsSchema,
      (id, params) => this.sinks.get(id)?.terminated(params) ?? false,
    );
  }

  /** `deliver` returns `false` when no stream owns the id. */
  private route<S extends z.ZodType<{ _meta: Record<string, unknown> }>>(
    method: string,
    schema: S,
    deliver: (id: string, params: z.infer<S>) => void | false,
  ): void {
    this.channel.onNotification(method, raw => {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        this.log('debug', `Dropping malformed ${method} notification`, { error: parsed.error.message });
        return;
      }
      const id = String(parsed.data._meta[EVENTS_SUBSCRIPTION_ID_META_KEY]);
      if (deliver(id, parsed.data) === false) {
        this.log('debug', `Dropping ${method} for unknown event stream ${id}`);
      }
    });
  }
}
