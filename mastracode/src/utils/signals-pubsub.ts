import { readdir, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { PubSub, UnixSocketPubSub } from '@mastra/core/events';
import type { PubSubDeliveryMode, Event, EventCallback, SubscribeOptions } from '@mastra/core/events';

const THREAD_STREAM_PREFIX = 'agent.thread-stream.';

/**
 * A PubSub that manages one Unix socket per topic for cross-process signal
 * coordination within a mastracode resource.
 *
 * Socket paths use `/tmp/mc/<resourceId>/<sanitized-topic>.sock` for
 * inspectability and automatic OS cleanup. Each topic gets its own isolated
 * socket so broker election and message routing are per-topic.
 *
 * On construction, stale `.sock` files from previous runs are cleaned up so
 * a new process always becomes the sole broker rather than connecting as a
 * client to a dead socket.
 */
class SignalsPubSub extends PubSub {
  readonly #resourceId: string;
  readonly #sockets = new Map<string, UnixSocketPubSub>();
  readonly #pending = new Map<string, Promise<UnixSocketPubSub>>();
  #closed = false;
  /** Resolves once stale socket cleanup from previous runs has completed. */
  readonly #cleanupDone: Promise<void>;

  constructor(resourceId: string) {
    super();
    this.#resourceId = resourceId;
    // Fire-and-forget cleanup; #getOrCreate awaits this before creating sockets
    // so new sockets never race with stale file removal.
    this.#cleanupDone = this.#cleanupStaleSockets();
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const socket = await this.#getOrCreate(topic);
    await socket.publish(topic, event);
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    const socket = await this.#getOrCreate(topic);
    await socket.subscribe(topic, cb, options);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const socket = this.#sockets.get(this.#topicKey(topic));
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
    return this.#sockets.get(this.#topicKey(topic));
  }

  async #getOrCreate(topic: string): Promise<UnixSocketPubSub> {
    if (this.#closed) throw new Error('SignalsPubSub is closed');
    // Ensure stale sockets from previous runs are cleaned before creating new ones.
    await this.#cleanupDone;
    const key = this.#topicKey(topic);
    const existing = this.#sockets.get(key);
    if (existing) return existing;
    // Deduplicate concurrent callers so only one socket is created per topic.
    let inflight = this.#pending.get(key);
    if (!inflight) {
      inflight = this.#initSocket(topic, key);
      this.#pending.set(key, inflight);
    }
    const socket = await inflight;
    if (this.#closed) throw new Error('SignalsPubSub is closed');
    return socket;
  }

  async #initSocket(topic: string, key: string): Promise<UnixSocketPubSub> {
    try {
      const socketPath = await this.#socketPath(topic);
      if (this.#closed) throw new Error('SignalsPubSub is closed');
      const socket = new UnixSocketPubSub(socketPath);
      this.#sockets.set(key, socket);
      return socket;
    } finally {
      this.#pending.delete(key);
    }
  }

  async #socketPath(topic: string): Promise<string> {
    const key = this.#topicKey(topic);
    const dir = join('/tmp/mc', this.#resourceId);
    await mkdir(dir, { recursive: true });
    return join(dir, `${key}.sock`);
  }

  /**
   * Derive a filesystem-safe key for the topic. Thread-stream topics embed
   * a threadId; all other topics use a sanitized version of the topic name.
   */
  #topicKey(topic: string): string {
    if (topic.startsWith(THREAD_STREAM_PREFIX)) {
      const encoded = topic.slice(THREAD_STREAM_PREFIX.length);
      try {
        const decoded = decodeURIComponent(encoded);
        const separatorIdx = decoded.indexOf('\0');
        if (separatorIdx !== -1) {
          return decoded.slice(separatorIdx + 1);
        }
      } catch {
        // Malformed URI — fall through to sanitized fallback.
      }
    }
    // Fallback: use the topic directly (sanitized for filesystem)
    return topic.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Remove stale `.sock` files left by previous mc processes. Without this,
   * a new process would connect as a client to the dead socket (whose broker
   * no longer exists), causing duplicate or lost event delivery.
   */
  async #cleanupStaleSockets(): Promise<void> {
    const dir = join('/tmp/mc', this.#resourceId);
    try {
      const entries = await readdir(dir);
      await Promise.allSettled(entries.filter(f => f.endsWith('.sock')).map(f => rm(join(dir, f), { force: true })));
    } catch {
      // Directory doesn't exist yet — nothing to clean.
    }
  }
}

/**
 * Creates a per-topic PubSub backed by Unix sockets for cross-process signal
 * and workflow event coordination within a mastracode resource.
 *
 * Each topic gets its own Unix socket under `/tmp/mc/<resourceId>/`.
 * Stale sockets from previous runs are cleaned on startup so the new
 * process always becomes the sole broker.
 */
export function createSignalsPubSub(resourceId: string): SignalsPubSub {
  return new SignalsPubSub(resourceId);
}
