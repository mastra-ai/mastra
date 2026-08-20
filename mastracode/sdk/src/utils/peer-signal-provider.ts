import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PeerBus, PeerMessage } from './peer-bus.js';

export type PeerSignalProviderOptions = {
  bus: PeerBus;
  /**
   * Resolve the notification target (active thread) at delivery time.
   * Returns undefined when there is no session to deliver into, in which
   * case the message is dropped (v1: no offline queue beyond what
   * notification storage already provides).
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
    await this.#bus.stop();
    await super.stop();
  }

  getTools() {
    const bus = this.#bus;
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
          'Send a fire-and-forget message to another Mastra Code instance (peer) by instanceId, or to all peers with "broadcast". The peer receives it as a peer-origin notification (never as a user message) and may choose to reply the same way.',
        inputSchema: z.object({
          to: z.string().describe('Target peer instanceId from list_peers, or "broadcast"'),
          body: z.string().min(1).describe('Message content'),
          replyTo: z.string().optional().describe('Id of the peer message this replies to'),
        }),
        execute: async ({ to, body, replyTo }) => {
          if (to !== 'broadcast' && !bus.listPeers().some(peer => peer.instanceId === to)) {
            return { sent: false, reason: `No live peer with instanceId "${to}". Use list_peers.` };
          }
          const message = await bus.send(to, body, replyTo ? { replyTo } : undefined);
          return { sent: true, messageId: message.id };
        },
      }),
    };
  }

  async #deliver(message: PeerMessage): Promise<void> {
    const target = this.#getTarget();
    if (!target) return;
    await this.notify(
      {
        source: 'peer',
        kind: message.to === 'broadcast' ? 'peer-broadcast' : 'peer-message',
        summary: `Peer message from ${message.from.label ?? message.from.instanceId} (${message.from.branch ?? message.from.cwd})`,
        priority: 'medium',
        sourceId: message.from.instanceId,
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
}
