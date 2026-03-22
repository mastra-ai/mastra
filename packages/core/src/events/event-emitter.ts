import EventEmitter from 'node:events';
import { PubSub } from './pubsub';
import type { Event, SubscribeOptions } from './types';

type EventCallback = (event: Event, ack?: () => Promise<void>) => void;

export class EventEmitterPubSub extends PubSub {
  private emitter: EventEmitter;

  // group → topic → callbacks[]
  private groups: Map<string, Map<string, EventCallback[]>> = new Map();
  // "topic:group" → round-robin counter
  private groupCounters: Map<string, number> = new Map();
  // "topic:group" → the single listener registered on the emitter for this group
  private groupListeners: Map<string, (event: Event) => void> = new Map();

  constructor(existingEmitter?: EventEmitter) {
    super();
    this.emitter = existingEmitter ?? new EventEmitter();
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    this.emitter.emit(topic, {
      ...event,
      id,
      createdAt,
    });
  }

  async subscribe(
    topic: string,
    cb: (event: Event, ack?: () => Promise<void>) => void,
    options?: SubscribeOptions,
  ): Promise<void> {
    if (options?.group) {
      this.subscribeWithGroup(topic, cb, options.group);
    } else {
      this.emitter.on(topic, cb);
    }
  }

  async unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    // Check if this callback is in any group for this topic
    for (const [group, topicMap] of this.groups) {
      const members = topicMap.get(topic);
      if (members) {
        const idx = members.indexOf(cb);
        if (idx !== -1) {
          members.splice(idx, 1);
          // If group is now empty for this topic, remove the emitter listener
          if (members.length === 0) {
            topicMap.delete(topic);
            const listenerKey = `${topic}:${group}`;
            const listener = this.groupListeners.get(listenerKey);
            if (listener) {
              this.emitter.off(topic, listener);
              this.groupListeners.delete(listenerKey);
              this.groupCounters.delete(listenerKey);
            }
          }
          if (topicMap.size === 0) {
            this.groups.delete(group);
          }
          return;
        }
      }
    }

    // Not in a group — remove as fan-out listener
    this.emitter.off(topic, cb);
  }

  async flush(): Promise<void> {
    // no-op
  }

  /**
   * Clean up all listeners during graceful shutdown.
   */
  async close(): Promise<void> {
    this.emitter.removeAllListeners();
    this.groups.clear();
    this.groupCounters.clear();
    this.groupListeners.clear();
  }

  private subscribeWithGroup(topic: string, cb: EventCallback, group: string): void {
    let topicMap = this.groups.get(group);
    if (!topicMap) {
      topicMap = new Map();
      this.groups.set(group, topicMap);
    }

    let members = topicMap.get(topic);
    if (!members) {
      members = [];
      topicMap.set(topic, members);
    }

    members.push(cb);

    // Register a single emitter listener per topic:group pair
    const listenerKey = `${topic}:${group}`;
    if (!this.groupListeners.has(listenerKey)) {
      const listener = (event: Event) => {
        const currentMembers = this.groups.get(group)?.get(topic);
        if (!currentMembers || currentMembers.length === 0) return;

        const counter = this.groupCounters.get(listenerKey) ?? 0;
        const idx = counter % currentMembers.length;
        this.groupCounters.set(listenerKey, counter + 1);

        currentMembers[idx]!(event);
      };

      this.groupListeners.set(listenerKey, listener);
      this.emitter.on(topic, listener);
    }
  }
}
