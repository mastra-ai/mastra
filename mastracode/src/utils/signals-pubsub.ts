import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { EventEmitterPubSub, PubSub, UnixSocketPubSub } from '@mastra/core/events';
import type { PubSubDeliveryMode, Event, EventCallback, SubscribeOptions } from '@mastra/core/events';

const THREAD_STREAM_PREFIX = 'agent.thread-stream.';

/**
 * A PubSub that manages one Unix socket per thread for cross-process signal
 * coordination within a mastracode resource.
 *
 * Socket paths use `/tmp/mc/<resourceId>/<threadId>.sock` for inspectability
 * and automatic OS cleanup. Each thread gets its own isolated socket so
 * processes on different threads never exchange data. A solo process on a
 * thread has zero serialization overhead.
 *
 * Topics that are NOT `agent.thread-stream.*` (e.g. `workflows`,
 * `workflows-finish`) are handled by an in-memory {@link EventEmitterPubSub}.
 * The evented workflow engine relies on in-process publish/subscribe semantics
 * where the publisher and subscriber share the same process — routing these
 * through Unix socket IPC breaks execution-workflow resolution because the
 * socket's broker/client model has different delivery guarantees.
 */
class SignalsPubSub extends PubSub {
  readonly #resourceId: string;
  readonly #sockets = new Map<string, UnixSocketPubSub>();
  readonly #pending = new Map<string, Promise<UnixSocketPubSub>>();
  readonly #inMemory = new EventEmitterPubSub();
  #closed = false;

  constructor(resourceId: string) {
    super();
    this.#resourceId = resourceId;
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    if (!topic.startsWith(THREAD_STREAM_PREFIX)) {
      return this.#inMemory.publish(topic, event);
    }
    const socket = await this.#getOrCreate(topic);
    await socket.publish(topic, event);
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (!topic.startsWith(THREAD_STREAM_PREFIX)) {
      return this.#inMemory.subscribe(topic, cb, options);
    }
    const socket = await this.#getOrCreate(topic);
    await socket.subscribe(topic, cb, options);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    if (!topic.startsWith(THREAD_STREAM_PREFIX)) {
      return this.#inMemory.unsubscribe(topic, cb);
    }
    const socket = this.#sockets.get(topic);
    if (!socket) return;
    await socket.unsubscribe(topic, cb);
  }

  async flush(): Promise<void> {
    await Promise.all([this.#inMemory.flush(), ...[...this.#sockets.values()].map(s => s.flush())]);
  }

  async close(): Promise<void> {
    this.#closed = true;
    await Promise.allSettled([this.#inMemory.close(), ...[...this.#sockets.values()].map(s => s.close())]);
    this.#sockets.clear();
  }

  /** Get the underlying socket for a topic (for testing/inspection). */
  getSocket(topic: string): UnixSocketPubSub | undefined {
    return this.#sockets.get(topic);
  }

  async #getOrCreate(topic: string): Promise<UnixSocketPubSub> {
    if (this.#closed) throw new Error('SignalsPubSub is closed');
    const existing = this.#sockets.get(topic);
    if (existing) return existing;
    // Deduplicate concurrent callers so only one socket is created per topic.
    let inflight = this.#pending.get(topic);
    if (!inflight) {
      inflight = this.#initSocket(topic);
      this.#pending.set(topic, inflight);
    }
    const socket = await inflight;
    if (this.#closed) throw new Error('SignalsPubSub is closed');
    return socket;
  }

  async #initSocket(topic: string): Promise<UnixSocketPubSub> {
    try {
      const socketPath = await this.#socketPath(topic);
      if (this.#closed) throw new Error('SignalsPubSub is closed');
      const socket = new UnixSocketPubSub(socketPath);
      this.#sockets.set(topic, socket);
      return socket;
    } finally {
      this.#pending.delete(topic);
    }
  }

  async #socketPath(topic: string): Promise<string> {
    // Extract threadId from the topic. Topics follow the format:
    // agent.thread-stream.<encoded key> where key = resourceId\0threadId
    const threadId = this.#extractThreadId(topic);
    const dir = join('/tmp/mc', this.#resourceId);
    await mkdir(dir, { recursive: true });
    return join(dir, `${threadId}.sock`);
  }

  #extractThreadId(topic: string): string {
    // Topic format: agent.thread-stream.<encodeURIComponent(resourceId + '\0' + threadId)>
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
 * Creates a per-thread PubSub for cross-process signal coordination.
 *
 * Each thread gets its own Unix socket under `/tmp/mc/<resourceId>/`.
 * Processes on different threads never exchange data. A solo process on a
 * thread has zero serialization overhead — the broker only serializes when
 * another process joins the same thread's socket.
 *
 * Non-signal topics (e.g. `workflows`) use an in-memory EventEmitterPubSub
 * so that the evented workflow engine's in-process pub/sub works correctly.
 */
export function createSignalsPubSub(resourceId: string): SignalsPubSub {
  return new SignalsPubSub(resourceId);
}
