import { EventEmitter } from 'events';
// Make the event manager generic over an event map
export type EventMap = Record<string, unknown>;

export interface EventConfig {
  debug: boolean;
}

export class EventManager<TEvents extends EventMap = Record<string, unknown>> {
  private eventEmitter: EventEmitter;
  private readonly debug: boolean;
  private eventCounts: Record<string, number> = {};

  constructor(config: EventConfig) {
    this.eventEmitter = new EventEmitter();
    this.debug = config.debug;
  }

  /**
   * Emit an event with data
   */
  emit<K extends Extract<keyof TEvents, string>>(event: K, data: TEvents[K]): boolean {
    this.incrementEventCount(event);
    const result = this.eventEmitter.emit(event, data);

    if (this.debug) {
      this.log(`Emitted event: ${event}`, data);
    }

    return result;
  }

  /**
   * Add event listener
   */
  on<E extends Extract<keyof TEvents, string>>(event: E, callback: (data: TEvents[E]) => void): void {
    this.eventEmitter.on(event, callback);

    if (this.debug) {
      this.log(`Added listener for event: ${event}`);
    }
  }

  /**
   * Remove event listener
   */
  off<E extends Extract<keyof TEvents, string>>(event: E, callback: (data: TEvents[E]) => void): void {
    this.eventEmitter.off(event, callback);

    if (this.debug) {
      this.log(`Removed listener for event: ${event}`);
    }
  }

  /**
   * Add one-time event listener
   */
  once<E extends Extract<keyof TEvents, string>>(event: E, callback: (data: TEvents[E]) => void): void {
    this.eventEmitter.once(event, callback);

    if (this.debug) {
      this.log(`Added one-time listener for event: ${event}`);
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    this.eventEmitter.removeAllListeners(event);

    if (this.debug) {
      this.log(`Removed all listeners${event ? ` for event: ${event}` : ''}`);
    }
  }

  /**
   * Get event listener count
   */
  getListenerCount(event: string): number {
    return this.eventEmitter.listenerCount(event);
  }

  /**
   * Get event listener info
   */
  getEventListenerInfo(): Record<string, number> {
    const events = this.eventEmitter.eventNames();
    const info: Record<string, number> = {};

    events.forEach(event => {
      const eventName = typeof event === 'string' ? event : event.toString();
      info[eventName] = this.eventEmitter.listenerCount(event);
    });

    return info;
  }

  /**
   * Get event emission counts
   */
  getEventCounts(): Record<string, number> {
    return { ...this.eventCounts };
  }

  /**
   * Reset event counts
   */
  resetEventCounts(): void {
    this.eventCounts = {};
  }

  /**
   * Clean up event listeners
   */
  cleanup(): void {
    this.eventEmitter.removeAllListeners();
    this.resetEventCounts();

    if (this.debug) {
      this.log('Cleaned up all event listeners');
    }
  }

  /**
   * Get the underlying EventEmitter
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Increment event count for tracking
   */
  private incrementEventCount(event: string): void {
    this.eventCounts[event] = (this.eventCounts[event] || 0) + 1;
  }

  /**
   * Log message if debug is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.info(`[EventManager] ${message}`, ...args);
    }
  }
}
