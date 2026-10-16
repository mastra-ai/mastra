import type { MastraError } from '@mastra/core/error';

import { generateWebhookSecret } from '../../shared/events';
import type { SubscribeEventsResult } from '../../shared/events';
import { eventsError } from './errors';
import type { DeliveryContext, DeliveryDriver } from './mode';
import type { WebhookBody } from './webhook-receiver';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 1000;

/** Waits `ms`, resolving early on abort or when `wake` is called. */
function pause(ms: number, signal: AbortSignal, onWake: (wake: () => void) => void): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    onWake(done);
  });
}

/**
 * Webhook delivery: registers the client's webhook URL with `events/subscribe`, routes verified
 * deliveries from the shared receiver into the subscription, and refreshes before the server's
 * `refreshBefore`. Cancelling unregisters the route and sends a best-effort `events/unsubscribe`.
 */
export const webhookDriver: DeliveryDriver = {
  mode: 'webhook',
  async session(context: DeliveryContext): Promise<void> {
    const { port, signal } = context;
    const setup = port.webhook();
    if (!setup) {
      throw eventsError('MCP_EVENTS_WEBHOOK_NOT_CONFIGURED', 'Webhook delivery needs the client `webhook` option');
    }
    const { options, receiver } = setup;
    const details = { eventName: context.name };
    const secret = options.secret ?? generateWebhookSecret();
    const args = context.arguments;

    let terminated: MastraError | undefined;
    let wake: (() => void) | undefined;
    let current: { id: string; unregister: () => void } | undefined;

    const onBody = (body: WebhookBody) => {
      if (body.kind === 'event') {
        const { cursor, ...occurrence } = body.event;
        context.deliver(occurrence);
        if (cursor !== undefined) context.setPosition(cursor);
        return;
      }
      if (body.control.type === 'gap') {
        context.setPosition(body.control.cursor, true);
        return;
      }
      terminated = eventsError(
        'MCP_EVENTS_SUBSCRIPTION_TERMINATED',
        `Server terminated the '${context.name}' webhook subscription: ${body.control.error.message}`,
        { ...details, code: body.control.error.code },
      );
      wake?.();
    };

    const subscribe = async (): Promise<SubscribeEventsResult> => {
      // The handshake arrives before the server tells us the id, so it is matched by secret.
      const release = receiver.expect(secret);
      try {
        const result = await port.subscribe(
          {
            name: context.name,
            ...(args ? { arguments: args } : {}),
            delivery: { mode: 'webhook', url: options.url, secret },
            cursor: context.cursor,
            ...(context.options.maxAgeMs !== undefined ? { maxAgeMs: context.options.maxAgeMs } : {}),
            ...(options.ttlMs !== undefined ? { ttlMs: options.ttlMs } : {}),
          },
          signal,
        );
        if (current?.id !== result.id) {
          current?.unregister();
          current = { id: result.id, unregister: receiver.register(result.id, { secret, onBody }) };
        }
        return result;
      } finally {
        release();
      }
    };

    try {
      while (!signal.aborted && !terminated) {
        const requestedAt = Date.now();
        const result = await subscribe();
        context.setPosition(result.cursor, result.truncated ?? false);
        context.established();
        context.setDeliveryStatus(result.deliveryStatus);
        const status = result.deliveryStatus;
        if (status && (!status.active || status.lastError)) {
          context.reportError(
            eventsError(
              'MCP_EVENTS_WEBHOOK_DELIVERY_FAILING',
              `Server reports failing webhook delivery for '${context.name}': ${status.lastError ?? 'suspended'}`,
              { ...details, active: status.active, lastError: status.lastError ?? null },
            ),
          );
        }

        let delay = DAY_MS;
        if (result.refreshBefore !== null) {
          const grant = Date.parse(result.refreshBefore) - requestedAt;
          const margin = options.refreshMarginMs ?? Math.min(MAX_MARGIN_MS, grant * 0.2);
          delay = Math.max(grant - margin - (Date.now() - requestedAt), MIN_REFRESH_DELAY_MS);
        }
        await pause(Math.min(delay, DAY_MS), signal, done => (wake = done));
        wake = undefined;
      }
      if (terminated) throw terminated;
    } finally {
      current?.unregister();
      if (signal.aborted && current) {
        await port
          .unsubscribe({ name: context.name, ...(args ? { arguments: args } : {}), delivery: { url: options.url } })
          .catch(error =>
            port.log('warning', `Webhook unsubscribe for '${context.name}' failed`, {
              ...details,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
      }
    }
  },
};
