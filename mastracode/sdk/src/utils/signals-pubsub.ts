import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { PubSub, UnixSocketPubSub } from '@mastra/core/events';
import type { Event, EventCallback, LeaseProvider, PubSubDeliveryMode, SubscribeOptions } from '@mastra/core/events';

const DEFAULT_SOCKET_ROOT = '/tmp/mc';
const SHARED_SCOPE_DIR = '_shared';
const THREAD_STREAM_PREFIX = 'agent.thread-stream.';
const THREAD_KEY_SEPARATOR = '\0';
const THREAD_CLAIM_LEASE_PREFIX = 'thread-claim:';
const NOTIFICATION_DISPATCH_LEASE_PREFIX = 'notification-dispatch:';
const OWNER_DISCOVERY_TOPIC = 'agent.thread-owner-discovery';
const MAX_PATH_SEGMENT_LENGTH = 128;
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const DISCOVERY_REPLY_TOPIC = new RegExp(`^agent\\.thread-(?:peer|owner)-discovery\\.${UUID_PATTERN}$`, 'i');
const IDLE_ACCEPTANCE_REPLY_TOPIC = new RegExp(`^agent\\.thread-stream\\..+\\.idle-acceptance\\.${UUID_PATTERN}$`, 'i');

/**
 * One-shot reply topics are minted per request (`<topic>.<uuid>`), used for a
 * single round trip, and never published to again once the request settles.
 */
function isEphemeralTopic(topic: string): boolean {
  return DISCOVERY_REPLY_TOPIC.test(topic) || IDLE_ACCEPTANCE_REPLY_TOPIC.test(topic);
}

export type SignalsPubSubOptions = {
  /** Directory that holds every resource's socket directory. Defaults to `/tmp/mc`. */
  rootDir?: string;
};

/**
 * Whether an id can name a single directory: no path separators or control
 * characters, not `.`/`..`, and bounded in length.
 */
function isSafePathSegment(value: string): boolean {
  if (!value || value.length > MAX_PATH_SEGMENT_LENGTH || value === '.' || value === '..') return false;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === '/' || char === '\\' || code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/** The resource a thread key (`<resourceId>\0<threadId>`) belongs to. */
function resourceOfThreadKey(key: string): string | undefined {
  const separatorIdx = key.indexOf(THREAD_KEY_SEPARATOR);
  if (separatorIdx <= 0) return undefined;
  const resourceId = key.slice(0, separatorIdx);
  return isSafePathSegment(resourceId) ? resourceId : undefined;
}

/** Decodes `agent.thread-stream.<encoded resourceId\0threadId>[...]`. */
function decodeThreadTopic(topic: string): string | undefined {
  if (!topic.startsWith(THREAD_STREAM_PREFIX)) return undefined;
  try {
    return decodeURIComponent(topic.slice(THREAD_STREAM_PREFIX.length));
  } catch {
    return undefined;
  }
}

/**
 * The lease that lets exactly one process dispatch a resource's due
 * notifications. Held in that resource's directory, so every process serving
 * the resource contends for it whichever project it was started in.
 */
export function notificationDispatchLeaseKey(resourceId: string): string {
  return `${NOTIFICATION_DISPATCH_LEASE_PREFIX}${resourceId}`;
}

/**
 * The resource a lease key belongs to: a thread's run lease and claim lease,
 * and a resource's notification dispatch lease.
 */
function resourceOfLeaseKey(key: string): string | undefined {
  if (key.startsWith(NOTIFICATION_DISPATCH_LEASE_PREFIX)) {
    const resourceId = key.slice(NOTIFICATION_DISPATCH_LEASE_PREFIX.length);
    return isSafePathSegment(resourceId) ? resourceId : undefined;
  }
  return resourceOfThreadKey(
    key.startsWith(THREAD_CLAIM_LEASE_PREFIX) ? key.slice(THREAD_CLAIM_LEASE_PREFIX.length) : key,
  );
}

function isOwnerDiscoveryTopic(topic: string): boolean {
  return topic === OWNER_DISCOVERY_TOPIC || topic.startsWith(`${OWNER_DISCOVERY_TOPIC}.`);
}

/**
 * Derive a filesystem-safe key for the topic. Thread-stream topics embed
 * a threadId; all other topics use a sanitized version of the topic name.
 */
function topicKey(topic: string): string {
  const decoded = decodeThreadTopic(topic);
  if (decoded !== undefined) {
    const separatorIdx = decoded.indexOf(THREAD_KEY_SEPARATOR);
    if (separatorIdx !== -1) return decoded.slice(separatorIdx + 1);
  }
  return topic.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * A PubSub that manages one Unix socket per topic for cross-process signal
 * coordination between mastracode processes on this machine.
 *
 * Socket paths use `<root>/<dir>/<sanitized-topic>.sock` (root `/tmp/mc`)
 * for inspectability and automatic OS cleanup. Each topic gets its own
 * socket, so broker election and message routing are per-topic.
 *
 * Every process shares one database, so any process can act on any project's
 * thread — the notification dispatcher, for one, delivers whatever is due.
 * Whatever coordinates a thread therefore lives with the thread, not with the
 * process touching it:
 *
 * - A thread's stream topic and its leases (the run lease and the claim
 *   lease) live in the directory of the resource that owns the thread, so a
 *   process from another project sees that thread's active run and claim.
 * - Thread-owner discovery lives in `<root>/_shared/`, so a process that finds
 *   a thread claimed can reach the owner and hand it the signal. It only
 *   answers for a thread the asker names, so it discloses nothing new.
 * - Everything else, including peer discovery (which lists threads), stays in
 *   this process's own resource directory.
 *
 * Stale sockets from crashed processes are handled by
 * {@link UnixSocketPubSub}'s built-in election logic: it detects
 * ECONNREFUSED on a dead broker socket, unlinks it, and re-elects.
 * No blanket cleanup is needed here — that would break concurrent
 * mc instances sharing a directory.
 *
 * One-shot reply topics (discovery and idle-acceptance replies) are
 * reference-counted: every in-flight publish/subscribe and every live
 * subscription holds a reference, and the topic's socket is closed as soon as
 * the count drops to zero. Without this each request would keep a socket, a
 * file descriptor and (for the broker) a socket file for the process lifetime.
 */
class SignalsPubSub extends PubSub {
  readonly #resourceId: string;
  readonly #rootDir: string;
  readonly #leaseSockets = new Map<string, UnixSocketPubSub>();
  readonly #sockets = new Map<string, UnixSocketPubSub>();
  readonly #pending = new Map<string, Promise<UnixSocketPubSub>>();
  readonly #refs = new Map<string, number>();
  readonly #liveSubscriptions = new Map<string, Set<EventCallback>>();
  readonly #clearGenerations = new Map<string, number>();
  readonly #closing = new Map<string, Promise<void>>();
  readonly #leaseProvider: LeaseProvider;
  #closed = false;

  constructor(resourceId: string, options: SignalsPubSubOptions = {}) {
    super();
    this.#resourceId = resourceId;
    this.#rootDir = options.rootDir ?? DEFAULT_SOCKET_ROOT;
    // Created eagerly, as before, so this resource's lease socket exists from the start.
    this.#leasesFor(resourceId);
    const route = (key: string) => this.#leasesFor(resourceOfLeaseKey(key) ?? this.#resourceId);
    this.#leaseProvider = {
      acquireLease: (key, owner, ttlMs) => route(key).acquireLease(key, owner, ttlMs),
      getLeaseOwner: key => route(key).getLeaseOwner(key),
      releaseLease: (key, owner) => route(key).releaseLease(key, owner),
      renewLease: (key, owner, ttlMs) => route(key).renewLease(key, owner, ttlMs),
      transferLease: (key, fromOwner, toOwner, ttlMs) => route(key).transferLease(key, fromOwner, toOwner, ttlMs),
    };
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }

  /**
   * Filesystem leases. A thread's run and claim leases are held in the
   * directory of the thread's resource, so every process contends for the
   * same lease; any other key stays in this resource's directory.
   */
  getLeaseProvider(): LeaseProvider {
    return this.#leaseProvider;
  }

  async publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    if (!isEphemeralTopic(topic)) {
      const socket = await this.#getOrCreate(topic);
      await socket.publish(topic, event, options);
      return;
    }
    const key = this.#socketKey(topic);
    // Retain synchronously so a concurrent release cannot close the socket
    // this publish is about to use.
    this.#retain(key);
    try {
      const socket = await this.#getOrCreate(topic);
      await socket.publish(topic, event, options);
    } finally {
      this.#release(key);
    }
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (!isEphemeralTopic(topic)) {
      const socket = await this.#getOrCreate(topic);
      await socket.subscribe(topic, cb, options);
      return;
    }
    const key = this.#socketKey(topic);
    this.#retain(key);
    const generation = this.#clearGenerations.get(key) ?? 0;
    try {
      const socket = await this.#getOrCreate(topic);
      await socket.subscribe(topic, cb, options);
      if ((this.#clearGenerations.get(key) ?? 0) !== generation) {
        // The topic was cleared while this subscribe was in flight.
        await socket.unsubscribe(topic, cb);
        return;
      }
      let subscriptions = this.#liveSubscriptions.get(key);
      if (!subscriptions) {
        subscriptions = new Set();
        this.#liveSubscriptions.set(key, subscriptions);
      }
      if (!subscriptions.has(cb)) {
        subscriptions.add(cb);
        this.#retain(key);
      }
    } finally {
      this.#release(key);
    }
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const key = this.#socketKey(topic);
    const socket = this.#sockets.get(key);
    const subscriptions = isEphemeralTopic(topic) ? this.#liveSubscriptions.get(key) : undefined;
    if (!subscriptions?.delete(cb)) {
      if (!socket) return;
      await socket.unsubscribe(topic, cb);
      return;
    }
    if (subscriptions.size === 0) this.#liveSubscriptions.delete(key);
    try {
      await socket?.unsubscribe(topic, cb);
    } finally {
      this.#release(key);
    }
  }

  /**
   * Drops a one-shot reply topic: its remaining subscriptions release their
   * references and the socket closes once no operation still uses it. Other
   * topics (workflow events, thread streams) have subscribers in other
   * processes that need the broker, so clearing them is a no-op.
   */
  override async clearTopic(topic: string): Promise<void> {
    if (!isEphemeralTopic(topic)) return;
    const key = this.#socketKey(topic);
    if (!this.#refs.has(key)) return;
    this.#clearGenerations.set(key, (this.#clearGenerations.get(key) ?? 0) + 1);
    const subscriptions = this.#liveSubscriptions.get(key);
    if (!subscriptions) return;
    this.#liveSubscriptions.delete(key);
    for (let i = 0; i < subscriptions.size; i++) this.#release(key);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#sockets.values()].map(s => s.flush()));
  }

  async close(): Promise<void> {
    this.#closed = true;
    await Promise.allSettled([
      ...[...this.#leaseSockets.values()].map(s => s.close()),
      ...[...this.#sockets.values()].map(s => s.close()),
      ...this.#closing.values(),
    ]);
    this.#sockets.clear();
    this.#leaseSockets.clear();
    this.#refs.clear();
    this.#liveSubscriptions.clear();
    this.#clearGenerations.clear();
  }

  /** Get the underlying socket for a topic (for testing/inspection). */
  getSocket(topic: string): UnixSocketPubSub | undefined {
    return this.#sockets.get(this.#socketKey(topic));
  }

  #leasesFor(resourceId: string): UnixSocketPubSub {
    let socket = this.#leaseSockets.get(resourceId);
    if (!socket) {
      socket = new UnixSocketPubSub(join(this.#rootDir, resourceId, '.leases.sock'));
      this.#leaseSockets.set(resourceId, socket);
    }
    return socket;
  }

  /** The directory, under the root, that holds a topic's socket. */
  #dirFor(topic: string): string {
    if (isOwnerDiscoveryTopic(topic)) return SHARED_SCOPE_DIR;
    const decoded = decodeThreadTopic(topic);
    if (decoded !== undefined) return resourceOfThreadKey(decoded) ?? this.#resourceId;
    return this.#resourceId;
  }

  #socketKey(topic: string): string {
    return `${this.#dirFor(topic)}/${topicKey(topic)}`;
  }

  #retain(key: string): void {
    this.#refs.set(key, (this.#refs.get(key) ?? 0) + 1);
  }

  #release(key: string): void {
    const refs = (this.#refs.get(key) ?? 0) - 1;
    if (refs > 0) {
      this.#refs.set(key, refs);
      return;
    }
    this.#refs.delete(key);
    this.#clearGenerations.delete(key);
    this.#liveSubscriptions.delete(key);
    const socket = this.#sockets.get(key);
    if (!socket) return;
    this.#sockets.delete(key);
    const closing: Promise<void> = socket
      .close()
      .catch(() => {})
      .finally(() => {
        if (this.#closing.get(key) === closing) this.#closing.delete(key);
      });
    this.#closing.set(key, closing);
  }

  async #getOrCreate(topic: string): Promise<UnixSocketPubSub> {
    if (this.#closed) throw new Error('SignalsPubSub is closed');
    const key = this.#socketKey(topic);
    // A socket for this key may still be closing after its last reference
    // was released; never hand out the closing instance.
    const closing = this.#closing.get(key);
    if (closing) {
      await closing;
      if (this.#closed) throw new Error('SignalsPubSub is closed');
    }
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
    let key = topicKey(topic);
    const dir = join(this.#rootDir, this.#dirFor(topic));
    await mkdir(dir, { recursive: true });
    const candidate = join(dir, `${key}.sock`);
    // macOS sun_path limit is 104 bytes; Linux is 108. Use 104 as the
    // conservative bound. When the path is too long, replace the key with
    // a short hash so the socket can still be created.
    if (Buffer.byteLength(candidate) > 104) {
      key = Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))
        .toString('hex')
        .slice(0, 16);
      return join(dir, `${key}.sock`);
    }
    return candidate;
  }
}

/**
 * Creates a per-topic PubSub backed by Unix sockets for cross-process signal
 * and workflow event coordination between mastracode processes.
 *
 * Topics live under `/tmp/mc/<resourceId>/`, except that a thread's stream and
 * leases live under its own resource's directory and thread-owner discovery
 * under `/tmp/mc/_shared/` (see {@link SignalsPubSub}). Stale sockets from
 * crashed processes are handled by the underlying {@link UnixSocketPubSub}'s
 * broker election logic.
 */
export function createSignalsPubSub(resourceId: string, options?: SignalsPubSubOptions): SignalsPubSub {
  return new SignalsPubSub(resourceId, options);
}
