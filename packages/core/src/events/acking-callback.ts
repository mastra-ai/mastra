import type { Event, EventCallback } from './types';

/**
 * Adapt an event-only handler into an `EventCallback` that acknowledges every
 * delivery.
 *
 * Handlers that only need the event cannot honour the `EventCallback` contract
 * themselves: on a durable backend (Redis consumer groups, GCP Pub/Sub) every
 * delivery — including the ones a handler inspects and filters out — has to be
 * acked, or it stays in the subscription's pending set and is redelivered.
 * Wrapping is the only way an event-only handler can satisfy that.
 *
 * A throwing handler leaves the delivery unacked and rejects the callback, which
 * a backend that honours redelivery treats as a nack.
 */
export function withAck(handler: (event: Event) => void | Promise<void>): EventCallback {
  return async (event, ack) => {
    await handler(event);
    await ack?.();
  };
}
