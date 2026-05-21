import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PubSub } from './pubsub';
import type { PubSubDeliveryMode } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';
import { UnixSocketPubSub } from './unix-socket-pubsub';

/**
 * A PubSub that manages one Unix socket per topic (i.e. per thread).
 *
 * Instead of funneling all thread-stream traffic through a single socket
 * (where 15 threads cause the broker to serialize and forward events
 * between unrelated processes), each thread gets its own isolated socket.
 *
 * Benefits:
 * - Processes on different threads never exchange data
 * - A solo process on a thread has zero serialization overhead
 * - The broker role is scoped to just that thread's participants
 *
 * Socket paths are placed in `/tmp` so the OS cleans them up automatically.
 */
export class PerThreadPubSub extends PubSub {
  readonly #prefix: string;
  readonly #sockets = new Map<string, UnixSocketPubSub>();
  #closed = false;

  /**
   * @param prefix A stable identifier for namespacing sockets (e.g. resourceId).
   *              Combined with the topic to derive a unique socket path per thread.
   */
  constructor(prefix: string) {
    super();
    this.#prefix = prefix;
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const socket = this.#getOrCreate(topic);
    await socket.publish(topic, event);
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    const socket = this.#getOrCreate(topic);
    await socket.subscribe(topic, cb, options);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const socket = this.#sockets.get(topic);
    if (!socket) return;
    await socket.unsubscribe(topic, cb);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#sockets.values()].map(s => s.flush()));
  }

  async close(): Promise<void> {
    this.#closed = true;
    await Promise.allSettled([...this.#sockets.values()].map(s => s.close()));
    this.#sockets.clear();
  }

  /** Get the underlying socket for a topic (for testing/inspection). */
  getSocket(topic: string): UnixSocketPubSub | undefined {
    return this.#sockets.get(topic);
  }

  #getOrCreate(topic: string): UnixSocketPubSub {
    if (this.#closed) throw new Error('PerThreadPubSub is closed');
    let socket = this.#sockets.get(topic);
    if (!socket) {
      socket = new UnixSocketPubSub(this.#socketPath(topic));
      this.#sockets.set(topic, socket);
    }
    return socket;
  }

  #socketPath(topic: string): string {
    // Derive a short deterministic path in /tmp from prefix + topic.
    // Use /tmp so the OS cleans up stale sockets on reboot.
    const hash = createHash('sha256').update(`${this.#prefix}\0${topic}`).digest('hex').slice(0, 16);
    return join(tmpdir(), `mastra-sig-${hash}.sock`);
  }
}
