import { EVENTS_SUBSCRIPTION_ID_META_KEY } from '../../shared/events';
import { eventsError } from './errors';
import type { DeliveryDriver } from './mode';
import type { EventStreamHandle, EventStreamSink } from './types';

/**
 * Delivers a subscription over one `events/stream` request. The session ends when the stream
 * closes, fails, goes silent for `heartbeatTimeoutMs`, or the server terminates it.
 */
export const pushDriver: DeliveryDriver = {
  mode: 'push',
  async session(context) {
    const { port, options, signal } = context;
    const details = { eventName: context.name };
    const sessionAbort = new AbortController();
    const onCancel = () => sessionAbort.abort();
    signal.addEventListener('abort', onCancel, { once: true });

    let fail!: (error: unknown) => void;
    const ended = new Promise<never>((_, reject) => {
      fail = reject;
    });
    // Rejections before the race below is attached must not surface as unhandled.
    ended.catch(() => {});

    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        fail(
          eventsError(
            'MCP_EVENTS_HEARTBEAT_TIMEOUT',
            `No notification on the '${context.name}' event stream for ${options.heartbeatTimeoutMs}ms; reopening it`,
            { ...details, heartbeatTimeoutMs: options.heartbeatTimeoutMs },
          ),
        );
      }, options.heartbeatTimeoutMs);
    };

    const sink: EventStreamSink = {
      active: params => {
        armWatchdog();
        context.setPosition(params.cursor, params.truncated ?? false);
      },
      event: params => {
        armWatchdog();
        const { _meta, ...occurrence } = params;
        const { [EVENTS_SUBSCRIPTION_ID_META_KEY]: _subscriptionId, ...meta } = _meta;
        context.deliver({ ...occurrence, ...(Object.keys(meta).length > 0 ? { _meta: meta } : {}) });
        context.setPosition(params.cursor);
      },
      heartbeat: params => {
        armWatchdog();
        context.setPosition(params.cursor);
      },
      error: params => {
        armWatchdog();
        context.reportError(
          eventsError(
            'MCP_EVENTS_STREAM_ERROR',
            `Server reported an error on the '${context.name}' event stream: ${params.error.message}`,
            { ...details, code: params.error.code },
          ),
        );
      },
      terminated: params => {
        fail(
          eventsError(
            'MCP_EVENTS_SUBSCRIPTION_TERMINATED',
            `Server terminated the '${context.name}' event subscription: ${params.error.message}`,
            { ...details, code: params.error.code },
          ),
        );
      },
    };

    let handle: EventStreamHandle | undefined;
    try {
      handle = await port.openStream(
        {
          name: context.name,
          ...(context.arguments ? { arguments: context.arguments } : {}),
          cursor: context.cursor,
          ...(options.maxAgeMs !== undefined ? { maxAgeMs: options.maxAgeMs } : {}),
        },
        sink,
        { signal: sessionAbort.signal, openTimeoutMs: options.streamOpenTimeoutMs },
      );
      context.established();
      await Promise.race([handle.done, ended]);
    } finally {
      clearTimeout(watchdog);
      signal.removeEventListener('abort', onCancel);
      handle?.abort();
    }
  },
};
