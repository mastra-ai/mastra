export type Event = {
  type: string;
  id: string;
  // TODO: we'll want to type this better
  data: any;
  runId: string;
  createdAt: Date;
  /**
   * How many times this message has been delivered (including this attempt).
   * Starts at 1 for the first delivery. Incremented on each nack/redelivery.
   * Not all PubSub backends support this — defaults to 1 if unknown.
   */
  deliveryAttempt?: number;
};

export interface SubscribeOptions {
  /**
   * When set, subscribers with the same group compete for messages.
   * Each message is delivered to exactly one subscriber in the group.
   * When not set, behaves as fan-out (all subscribers get every message).
   */
  group?: string;
}

/**
 * Callback signature for PubSub subscribers.
 *
 * @param event - The delivered event
 * @param ack - Acknowledge successful processing. Message is removed from the queue.
 * @param nack - Negative acknowledge. Message is requeued for redelivery after a delay.
 *               Not calling either ack or nack leaves the message in-flight until the
 *               backend's ack deadline expires (typically 10s for GCP).
 */
export type EventCallback = (event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>) => void;
