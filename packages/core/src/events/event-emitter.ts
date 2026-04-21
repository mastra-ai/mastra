import EventEmitter from 'node:events';
import { PubSub } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

export class EventEmitterPubSub extends PubSub {
  private emitter: EventEmitter;

  // group → topic → callbacks[]
  private groups: Map<string, Map<string, EventCallback[]>> = new Map();
  // "topic:group" → round-robin counter
  private groupCounters: Map<string, number> = new Map();
  // "topic:group" → the single listener registered on the emitter for this group
  private groupListeners: Map<string, (event: Event) => void> = new Map();

  // Track pending nack redeliveries so flush() can wait and close() can cancel them
  private pendingNacks: Set<ReturnType<typeof setTimeout>> = new Set();

  // Track delivery attempts per message id
  private deliveryAttempts: Map<string, number> = new Map();

  // topic → (original callback → wrapped listener) for fan-out (non-group) subscribers.
  // Nested keying so the same callback registered on multiple topics keeps
  // a distinct wrapper per topic.
  private fanoutWrappers: Map<string, Map<EventCallback, (event: Event) => void>> = new Map();

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
      deliveryAttempt: 1,
    });
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (options?.group) {
      this.subscribeWithGroup(topic, cb, options.group);
    } else {
      const wrapper = (event: Event) => {
        cb(
          event,
          async () => {},
          async () => {},
        );
      };
      let byCb = this.fanoutWrappers.get(topic);
      if (!byCb) {
        byCb = new Map();
        this.fanoutWrappers.set(topic, byCb);
      }
      byCb.set(cb, wrapper);
      this.emitter.on(topic, wrapper);
    }
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
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
    const byCb = this.fanoutWrappers.get(topic);
    const wrapper = byCb?.get(cb);
    if (wrapper && byCb) {
      this.emitter.off(topic, wrapper);
      byCb.delete(cb);
      if (byCb.size === 0) this.fanoutWrappers.delete(topic);
    } else {
      this.emitter.off(topic, cb);
    }
  }

  async flush(): Promise<void> {
    // Wait for any pending nack redeliveries to fire
    if (this.pendingNacks.size > 0) {
      await new Promise<void>(resolve => {
        const check = () => {
          if (this.pendingNacks.size === 0) {
            resolve();
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }
  }

  /**
   * Clean up all listeners during graceful shutdown.
   */
  async close(): Promise<void> {
    // Cancel pending nack redeliveries
    for (const handle of this.pendingNacks) {
      clearTimeout(handle);
    }
    this.pendingNacks.clear();
    this.deliveryAttempts.clear();

    this.emitter.removeAllListeners();
    this.groups.clear();
    this.groupCounters.clear();
    this.groupListeners.clear();
    this.fanoutWrappers.clear();
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
        this.deliverToGroup(topic, group, listenerKey, event);
      };

      this.groupListeners.set(listenerKey, listener);
      this.emitter.on(topic, listener);
    }
  }

  private deliverToGroup(topic: string, group: string, listenerKey: string, event: Event): void {
    const currentMembers = this.groups.get(group)?.get(topic);
    if (!currentMembers || currentMembers.length === 0) return;

    const counter = this.groupCounters.get(listenerKey) ?? 0;
    const idx = counter % currentMembers.length;
    this.groupCounters.set(listenerKey, counter + 1);

    // Track delivery attempts scoped per group listener, so ack/nack in one
    // group doesn't disturb another group's attempt counter for the same event.
    const attemptKey = `${listenerKey}:${event.id}`;
    const attempt = this.deliveryAttempts.get(attemptKey) ?? 1;
    const eventWithAttempt = { ...event, deliveryAttempt: attempt };

    const ack = async () => {
      // Message successfully processed — clean up attempt tracking
      this.deliveryAttempts.delete(attemptKey);
    };

    const nack = async () => {
      // Message processing failed — redeliver to the group after a short delay
      // Increment delivery attempt counter
      this.deliveryAttempts.set(attemptKey, attempt + 1);

      const handle = setTimeout(() => {
        this.pendingNacks.delete(handle);
        this.deliverToGroup(topic, group, listenerKey, event);
      }, 0);
      this.pendingNacks.add(handle);
    };

    currentMembers[idx]!(eventWithAttempt, ack, nack);
  }
}
