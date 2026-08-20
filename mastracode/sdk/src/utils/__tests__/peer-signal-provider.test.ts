import { randomUUID } from 'node:crypto';

import type { Event, EventCallback, PubSub } from '@mastra/core/events';
import { describe, it, expect, vi } from 'vitest';

import { PeerBus } from '../peer-bus.js';
import { PeerSignalProvider } from '../peer-signal-provider.js';

/**
 * In-memory PubSub shared between two PeerBus instances — same semantics as
 * the Unix-socket transport (push-only, no retention, async delivery) but
 * in-process so the provider's notification path can be asserted directly.
 */
class InMemoryPubSub {
  readonly #subscribers = new Map<string, Set<EventCallback>>();

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const full: Event = { ...event, id: randomUUID(), createdAt: new Date() };
    const callbacks = [...(this.#subscribers.get(topic) ?? [])];
    await new Promise(resolve => setImmediate(resolve));
    for (const callback of callbacks) callback(full);
  }

  async subscribe(topic: string, callback: EventCallback): Promise<void> {
    if (!this.#subscribers.has(topic)) this.#subscribers.set(topic, new Set());
    this.#subscribers.get(topic)!.add(callback);
  }

  async unsubscribe(topic: string, callback: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(callback);
  }

  async flush(): Promise<void> {}
}

const identity = (instanceId: string) => ({
  instanceId,
  pid: process.pid,
  cwd: `/tmp/${instanceId}`,
  branch: `${instanceId}-branch`,
});

const target = { resourceId: 'resource-1', threadId: 'thread-1' };

async function setup(options?: { getTarget?: () => typeof target | undefined }) {
  const pubsub = new InMemoryPubSub() as unknown as PubSub;
  const receiverBus = new PeerBus({ pubsub, self: identity('receiver'), heartbeatMs: 60_000 });
  const senderBus = new PeerBus({ pubsub, self: identity('sender'), heartbeatMs: 60_000 });

  const provider = new PeerSignalProvider({
    bus: receiverBus,
    getTarget: options?.getTarget ?? (() => target),
  });
  const sendNotificationSignal = vi.fn(async (_notification: any, _target: any) => {});
  provider.connect({ sendNotificationSignal } as any);

  await provider.start();
  await senderBus.start();
  // Let hello probes settle so both sides know each other.
  await vi.waitFor(() => {
    expect(senderBus.listPeers().map(peer => peer.instanceId)).toContain('receiver');
    expect(receiverBus.listPeers().map(peer => peer.instanceId)).toContain('sender');
  });

  return { provider, senderBus, receiverBus, sendNotificationSignal };
}

describe('PeerSignalProvider', () => {
  it('delivers an inbound peer message as a peer-origin notification signal', async () => {
    const { provider, senderBus, sendNotificationSignal } = await setup();

    const sent = await senderBus.send('receiver', 'hello from sender');

    await vi.waitFor(() => expect(sendNotificationSignal).toHaveBeenCalledTimes(1));
    const [notification, notifyTarget] = sendNotificationSignal.mock.calls[0]! as unknown as [any, any];
    expect(notification.source).toBe('peer');
    expect(notification.kind).toBe('peer-message');
    expect(notification.sourceId).toBe('sender');
    expect(notification.summary).toContain('sender');
    expect(notification.payload).toMatchObject({
      messageId: sent.id,
      body: 'hello from sender',
      from: expect.objectContaining({ instanceId: 'sender', branch: 'sender-branch' }),
    });
    expect(notifyTarget).toMatchObject(target);

    await provider.stop();
    await senderBus.stop();
  });

  it('marks broadcasts with kind peer-broadcast', async () => {
    const { provider, senderBus, sendNotificationSignal } = await setup();

    await senderBus.send('broadcast', 'hello everyone');

    await vi.waitFor(() => expect(sendNotificationSignal).toHaveBeenCalledTimes(1));
    expect((sendNotificationSignal.mock.calls[0]![0] as any).kind).toBe('peer-broadcast');

    await provider.stop();
    await senderBus.stop();
  });

  it('drops inbound messages when there is no delivery target', async () => {
    const { provider, senderBus, sendNotificationSignal } = await setup({ getTarget: () => undefined });

    await senderBus.send('receiver', 'nobody home');
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(sendNotificationSignal).not.toHaveBeenCalled();

    await provider.stop();
    await senderBus.stop();
  });

  it('stops delivering after stop()', async () => {
    const { provider, senderBus, sendNotificationSignal } = await setup();

    await provider.stop();
    await senderBus.send('receiver', 'too late');
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(sendNotificationSignal).not.toHaveBeenCalled();

    await senderBus.stop();
  });

  describe('tools', () => {
    it('list_peers returns self and live peers', async () => {
      const { provider, senderBus, receiverBus } = await setup();

      const tools = provider.getTools();
      const result = (await tools.list_peers.execute!({} as any, {} as any)) as any;

      expect(result.self.instanceId).toBe('receiver');
      expect(result.peers).toHaveLength(1);
      expect(result.peers[0]).toMatchObject({ instanceId: 'sender', branch: 'sender-branch' });

      await provider.stop();
      await senderBus.stop();
      void receiverBus;
    });

    it('send_to_peer delivers to a live peer and reports the message id', async () => {
      const { provider, senderBus } = await setup();
      const received: any[] = [];
      senderBus.onMessage(message => received.push(message));

      const tools = provider.getTools();
      const result = (await tools.send_to_peer.execute!({ to: 'sender', body: 'hi sender' } as any, {} as any)) as any;

      expect(result.sent).toBe(true);
      await vi.waitFor(() => expect(received).toHaveLength(1));
      expect(received[0]).toMatchObject({ id: result.messageId, body: 'hi sender', to: 'sender' });

      await provider.stop();
      await senderBus.stop();
    });

    it('send_to_peer refuses unknown instanceIds', async () => {
      const { provider, senderBus } = await setup();

      const tools = provider.getTools();
      const result = (await tools.send_to_peer.execute!({ to: 'ghost', body: 'anyone?' } as any, {} as any)) as any;

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('ghost');

      await provider.stop();
      await senderBus.stop();
    });
  });
});
