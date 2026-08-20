import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { PubSub, Event } from '@mastra/core/events';

const PRESENCE_TOPIC = 'peers.presence';
const BROADCAST_TOPIC = 'peers.broadcast';
const inboxTopic = (instanceId: string) => `peers.inbox.${instanceId}`;

/** Identity a peer advertises about itself on the presence topic. */
export type PeerIdentity = {
  instanceId: string;
  pid: number;
  cwd: string;
  branch?: string;
  /** Human-friendly label (e.g. worktree dir name or user-set role). */
  label?: string;
};

/** A peer as seen by this instance (identity + liveness bookkeeping). */
export type Peer = PeerIdentity & {
  lastSeenAt: number;
};

/** Envelope for a peer-to-peer message. */
export type PeerMessage = {
  id: string;
  from: PeerIdentity;
  /** Target instanceId, or 'broadcast'. */
  to: string;
  body: string;
  /** Optional id of the message this replies to. */
  replyTo?: string;
  /**
   * The sender's active thread at send time. Receivers targeting the same
   * thread skip delivery — the sender's own transcript already has the
   * message, so notifying that thread would just echo it back.
   */
  originThreadId?: string;
  sentAt: number;
};

/**
 * Derive a peer instanceId that is stable across restarts of the same
 * terminal: `<name>-<tty basename>` when the process is attached to a TTY
 * (each terminal pane has its own device, and a restarted mc in the same
 * pane keeps it), falling back to `<name>-<pid>` for non-interactive runs.
 */
export function derivePeerInstanceId(name: string): string {
  if (process.stdin.isTTY) {
    try {
      // `tty` prints the device of fd 0 (e.g. /dev/ttys014).
      const device = execFileSync('tty', { stdio: ['inherit', 'pipe', 'ignore'] }).toString().trim();
      if (device.startsWith('/dev/')) return `${name}-${path.basename(device)}`;
    } catch {
      // Fall through to the pid-based id.
    }
  }
  return `${name}-${process.pid}`;
}

type PresenceData = PeerIdentity & {
  /** Set on first announce — asks existing peers to re-announce immediately. */
  hello?: boolean;
  /** Set on graceful shutdown — removes the peer without waiting for expiry. */
  bye?: boolean;
};

export type PeerBusOptions = {
  /** Transport. In mastracode this is the existing SignalsPubSub, whose
   * per-repo socket namespace (`/tmp/mc/<resourceId>/`) is already shared
   * across sibling worktrees of the same remote. */
  pubsub: PubSub;
  self: PeerIdentity;
  heartbeatMs?: number;
  staleAfterMs?: number;
};

/**
 * Cross-instance peer presence + messaging over the existing per-repo
 * Unix-socket pubsub namespace.
 *
 * Topics:
 * - `peers.presence`   — heartbeats, hello probes, and goodbyes
 * - `peers.broadcast`  — messages to every peer
 * - `peers.inbox.<id>` — direct messages to one instance
 *
 * Presence is push-only (the transport retains nothing), so discovery is
 * heartbeat-driven: on `start()` we announce with `hello: true`, and every
 * live peer that sees a hello re-announces immediately. That makes a new
 * joiner's peer list converge in one round-trip instead of one heartbeat
 * interval.
 */
export class PeerBus {
  readonly #pubsub: PubSub;
  readonly #self: PeerIdentity;
  readonly #heartbeatMs: number;
  readonly #staleAfterMs: number;
  readonly #peers = new Map<string, Peer>();
  readonly #messageListeners = new Set<(message: PeerMessage) => void>();
  #heartbeatTimer?: NodeJS.Timeout;
  #started = false;

  readonly #onPresence = (event: Event) => {
    const data = event.data as PresenceData;
    if (!data?.instanceId || data.instanceId === this.#self.instanceId) return;
    if (data.bye) {
      this.#peers.delete(data.instanceId);
      return;
    }
    const { hello: _hello, bye: _bye, ...identity } = data;
    this.#peers.set(data.instanceId, { ...identity, lastSeenAt: Date.now() });
    if (data.hello) {
      // A new peer joined and asked who's here — re-announce immediately.
      void this.#announce().catch(() => {});
    }
  };

  readonly #onMessage = (event: Event) => {
    const message = event.data as PeerMessage;
    if (!message?.id || message.from?.instanceId === this.#self.instanceId) return;
    // Seeing a message from a peer is as good as a heartbeat.
    if (message.from?.instanceId) {
      this.#peers.set(message.from.instanceId, { ...message.from, lastSeenAt: Date.now() });
    }
    for (const listener of this.#messageListeners) {
      try {
        listener(message);
      } catch {
        // Listener errors must not break delivery to other listeners.
      }
    }
  };

  constructor(options: PeerBusOptions) {
    this.#pubsub = options.pubsub;
    this.#self = options.self;
    this.#heartbeatMs = options.heartbeatMs ?? 10_000;
    this.#staleAfterMs = options.staleAfterMs ?? this.#heartbeatMs * 3;
  }

  get self(): PeerIdentity {
    return this.#self;
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    await this.#pubsub.subscribe(PRESENCE_TOPIC, this.#onPresence);
    await this.#pubsub.subscribe(BROADCAST_TOPIC, this.#onMessage);
    await this.#pubsub.subscribe(inboxTopic(this.#self.instanceId), this.#onMessage);
    await this.#announce({ hello: true });
    this.#heartbeatTimer = setInterval(() => {
      void this.#announce().catch(() => {});
    }, this.#heartbeatMs);
    this.#heartbeatTimer.unref?.();
  }

  async stop(): Promise<void> {
    if (!this.#started) return;
    this.#started = false;
    if (this.#heartbeatTimer) clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = undefined;
    try {
      await this.#publish(PRESENCE_TOPIC, 'peers.presence', { ...this.#self, bye: true } satisfies PresenceData);
    } catch {
      // Graceful goodbye is best-effort; peers expire us via staleness anyway.
    }
    await this.#pubsub.unsubscribe(PRESENCE_TOPIC, this.#onPresence);
    await this.#pubsub.unsubscribe(BROADCAST_TOPIC, this.#onMessage);
    await this.#pubsub.unsubscribe(inboxTopic(this.#self.instanceId), this.#onMessage);
    this.#peers.clear();
  }

  /** Live peers (heartbeat seen within the staleness window), excluding self. */
  listPeers(): Peer[] {
    const cutoff = Date.now() - this.#staleAfterMs;
    const live: Peer[] = [];
    for (const [id, peer] of this.#peers) {
      if (peer.lastSeenAt < cutoff) {
        this.#peers.delete(id);
        continue;
      }
      live.push(peer);
    }
    return live.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  /** Send a message to one peer by instanceId, or to all with 'broadcast'. */
  async send(to: string, body: string, options?: { replyTo?: string; originThreadId?: string }): Promise<PeerMessage> {
    const message: PeerMessage = {
      id: randomUUID(),
      from: this.#self,
      to,
      body,
      ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
      ...(options?.originThreadId ? { originThreadId: options.originThreadId } : {}),
      sentAt: Date.now(),
    };
    const topic = to === 'broadcast' ? BROADCAST_TOPIC : inboxTopic(to);
    await this.#publish(topic, 'peers.message', message);
    return message;
  }

  /** Register a listener for inbound peer messages (inbox + broadcast). */
  onMessage(listener: (message: PeerMessage) => void): () => void {
    this.#messageListeners.add(listener);
    return () => this.#messageListeners.delete(listener);
  }

  async #announce(extra?: Pick<PresenceData, 'hello'>): Promise<void> {
    await this.#publish(PRESENCE_TOPIC, 'peers.presence', { ...this.#self, ...extra } satisfies PresenceData);
  }

  async #publish(topic: string, type: string, data: unknown): Promise<void> {
    await this.#pubsub.publish(topic, { type, data, runId: this.#self.instanceId });
  }
}
