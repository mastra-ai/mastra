import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PeerBus, PeerMessage } from './peer-bus.js';

/** Inbound messages held while there is no valid thread to deliver into. */
const MAX_QUEUED_MESSAGES = 50;

export type PeerSignalProviderOptions = {
  bus: PeerBus;
  /**
   * Resolve the notification target (active thread) at delivery time.
   * Returns undefined when there is no session/thread to deliver into, in
   * which case inbound messages are queued until {@link PeerSignalProvider.resumeDelivery}
   * flushes them into a fresh target.
   */
  getTarget: () => SignalProviderTarget | undefined;
};

/**
 * First-class mc-to-mc communication.
 *
 * Inbound peer messages arrive over the {@link PeerBus} and are delivered as
 * notification signals — NOT user messages. That is the whole point: peer
 * traffic gets a structural, peer-origin channel (queued while a user turn is
 * active, wakes idle threads via the normal notification delivery policy)
 * instead of impersonating the user through pane keystrokes.
 *
 * Delivery correctness guards:
 * - **Suspension** — when the UI detaches from its thread (`/new` before the
 *   first message), `suspendDelivery()` queues inbound messages instead of
 *   routing them to the stale binding; `resumeDelivery()` flushes the queue
 *   once a thread exists again.
 * - **Echo guard** — messages carry the sender's `originThreadId`; a receiver
 *   whose target is that same thread (two instances viewing one thread) skips
 *   delivery instead of echoing the sender's message back into its own thread.
 * - **Cross-process dedupe** — notifications carry a `dedupeKey` derived from
 *   the message id, so when multiple local instances deliver the same message
 *   into the same thread, notification storage coalesces them into one record.
 *
 * Outbound surface is two agent tools:
 * - `list_peers`   — live sibling mc instances on this repo's peer bus
 * - `send_to_peer` — fire-and-forget message to one peer (or broadcast)
 *
 * @experimental Prototype for the inter-mc-comms design.
 */
export class PeerSignalProvider extends SignalProvider<'peer-signals'> {
  readonly id = 'peer-signals';

  readonly #bus: PeerBus;
  readonly #getTarget: () => SignalProviderTarget | undefined;
  #unsubscribe?: () => void;
  #suspended = false;
  readonly #queue: PeerMessage[] = [];

  constructor(options: PeerSignalProviderOptions) {
    super();
    this.#bus = options.bus;
    this.#getTarget = options.getTarget;
  }

  override async start(): Promise<void> {
    await this.#bus.start();
    this.#unsubscribe = this.#bus.onMessage(message => {
      void this.#deliver(message).catch(() => {});
    });
  }

  override async stop(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#queue.length = 0;
    await this.#bus.stop();
    await super.stop();
  }

  /**
   * Stop delivering into the current thread binding — it is stale (e.g. the
   * user started a new conversation and no thread exists yet). Inbound
   * messages queue until {@link resumeDelivery}.
   */
  suspendDelivery(): void {
    this.#suspended = true;
  }

  /** Deliveries may resolve a target again; flush anything queued meanwhile. */
  resumeDelivery(): void {
    this.#suspended = false;
    if (this.#queue.length === 0) return;
    const queued = this.#queue.splice(0, this.#queue.length);
    void (async () => {
      for (const message of queued) {
        await this.#deliver(message).catch(() => {});
      }
    })();
  }

  getTools() {
    const bus = this.#bus;
    const getTarget = this.#getTarget;
    return {
      list_peers: createTool({
        id: 'list_peers',
        description:
          'List other live Mastra Code instances (peers) working on this repo. Returns their instanceId, cwd, branch, and pid. Use an instanceId with send_to_peer.',
        inputSchema: z.object({}),
        execute: async () => {
          return {
            self: bus.self,
            peers: bus.listPeers().map(peer => ({
              instanceId: peer.instanceId,
              cwd: peer.cwd,
              branch: peer.branch,
              label: peer.label,
              pid: peer.pid,
              lastSeenAt: new Date(peer.lastSeenAt).toISOString(),
            })),
          };
        },
      }),
      send_to_peer: createTool({
        id: 'send_to_peer',
        description:
          'Send a fire-and-forget message to another Mastra Code instance (peer) by instanceId, or to all peers with "broadcast". The peer receives it as a peer-origin notification (never as a user message) and may choose to reply the same way. `accepted: true` means the message was handed to the transport — it is NOT proof of delivery or of the peer acting on it.',
        inputSchema: z.object({
          to: z.string().describe('Target peer instanceId from list_peers, or "broadcast"'),
          body: z.string().min(1).describe('Message content'),
          replyTo: z.string().optional().describe('Id of the peer message this replies to'),
        }),
        execute: async ({ to, body, replyTo }) => {
          if (to !== 'broadcast' && !bus.listPeers().some(peer => peer.instanceId === to)) {
            return { accepted: false, reason: `No live peer with instanceId "${to}". Use list_peers.` };
          }
          const originThreadId = getTarget()?.threadId;
          const message = await bus.send(to, body, {
            ...(replyTo ? { replyTo } : {}),
            ...(originThreadId ? { originThreadId } : {}),
          });
          return { accepted: true, messageId: message.id };
        },
      }),
    };
  }

  async #deliver(message: PeerMessage): Promise<void> {
    if (this.#suspended) {
      this.#enqueue(message);
      return;
    }
    const target = this.#getTarget();
    if (!target) {
      this.#enqueue(message);
      return;
    }
    // Echo guard: the sender's own thread already contains this message.
    if (message.originThreadId && message.originThreadId === target.threadId) return;
    await this.notify(
      {
        source: 'peer',
        kind: message.to === 'broadcast' ? 'peer-broadcast' : 'peer-message',
        summary: `Peer message from ${message.from.label ?? message.from.instanceId} (${message.from.branch ?? message.from.cwd})`,
        priority: 'medium',
        sourceId: message.from.instanceId,
        // Multiple local instances can deliver the same message into the same
        // thread (shared thread, shared notification storage) — coalesce.
        dedupeKey: `peer-msg:${message.id}`,
        payload: {
          messageId: message.id,
          from: message.from,
          body: message.body,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          sentAt: new Date(message.sentAt).toISOString(),
        },
      },
      target,
    );
  }

  #enqueue(message: PeerMessage): void {
    this.#queue.push(message);
    if (this.#queue.length > MAX_QUEUED_MESSAGES) this.#queue.shift();
  }
}
