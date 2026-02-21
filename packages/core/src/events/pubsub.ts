import type { Event } from './types';

/**
 * Callback type for PubSub event handlers.
 * @param event - The event received
 * @param ack - Optional acknowledgment function for backends that support it
 */
export type EventCallback = (event: Event, ack?: () => Promise<void>) => void;

export abstract class PubSub {
  abstract publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void>;
  abstract subscribe(topic: string, cb: EventCallback): Promise<void>;
  abstract unsubscribe(topic: string, cb: EventCallback): Promise<void>;
  abstract flush(): Promise<void>;

  /**
   * Get historical events for a topic.
   * Default implementation returns empty array (no history support).
   * Override in implementations that support event caching.
   *
   * @param topic - The topic to get history for
   * @param offset - Starting index (0-based), defaults to 0
   * @returns Array of events from the specified index
   */
  getHistory(_topic: string, _offset?: number): Promise<Event[]> {
    return Promise.resolve([]);
  }

  /**
   * Subscribe to a topic with automatic replay of cached events.
   * First replays any cached history, then subscribes to live events.
   * Default implementation falls back to regular subscribe (no replay).
   * Override in implementations that support event caching.
   *
   * @param topic - The topic to subscribe to
   * @param cb - Callback invoked for each event (both cached and live)
   */
  subscribeWithReplay(topic: string, cb: EventCallback): Promise<void> {
    return this.subscribe(topic, cb);
  }

  /**
   * Subscribe to a topic with replay starting from a specific index.
   * This is more efficient than full replay when the client knows their last position.
   * Default implementation falls back to subscribeWithReplay (full replay).
   * Override in implementations that support indexed event caching.
   *
   * @param topic - The topic to subscribe to
   * @param offset - Start replaying from this index (0-based)
   * @param cb - Callback invoked for each event
   */
  subscribeFromOffset(topic: string, _offset: number, cb: EventCallback): Promise<void> {
    return this.subscribeWithReplay(topic, cb);
  }
}
