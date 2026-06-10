import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
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
 * Stale sockets from crashed processes are handled by
 * {@link UnixSocketPubSub}'s built-in election logic: it detects
 * ECONNREFUSED on a dead broker socket, unlinks it, and re-elects.
 * No blanket cleanup is needed here — that would break concurrent
 * mc instances sharing the same resourceId.
 */
class SignalsPubSub extends PubSub {
  readonly #resourceId: string;
  readonly #sockets = new Map<string, UnixSocketPubSub>();
  readonly #pending = new Map<string, Promise<UnixSocketPubSub>>();
  #closed = false;

  constructor(resourceId: string) {
    super();
    this.#resourceId = resourceId;
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
    let key = this.#topicKey(topic);
    const dir = join('/tmp/mc', this.#resourceId);
    await mkdir(dir, { recursive: true });
    const candidate = join(dir, `${key}.sock`);
    // macOS sun_path limit is 104 bytes; Linux is 108. Use 104 as the
    // conservative bound. When the path is too long, replace the key with
    // a short hash so the socket can still be created.
    if (Buffer.byteLength(candidate) > 104) {
      key = createHash('sha256').update(key).digest('hex').slice(0, 16);
      return join(dir, `${key}.sock`);
    }
    return candidate;
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
}

/**
 * Creates a per-topic PubSub backed by Unix sockets for cross-process signal
 * and workflow event coordination within a mastracode resource.
 *
 * Each topic gets its own Unix socket under `/tmp/mc/<resourceId>/`.
 * Stale sockets from crashed processes are handled by the underlying
 * {@link UnixSocketPubSub}'s broker election logic.
 */
export function createSignalsPubSub(resourceId: string): SignalsPubSub {
  return new SignalsPubSub(resourceId);
}
