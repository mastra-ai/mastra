import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { PubSub } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import { Mastra } from '../../mastra';
import { dispatchDueNotifications } from '../../notifications/dispatcher';
import { InMemoryNotificationsStorage } from '../../notifications/storage';
import { MastraCompositeStore } from '../../storage/base';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const OWNER_DISCOVERY_PREFIX = 'agent.thread-owner-discovery';

function createOwnerModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

/**
 * One transport, delivered in-process. `ownerAnswersDiscovery: false` models a
 * peer process that is still alive, still claimed, and still advertising, but
 * that cannot answer owner discovery in time (busy host, blocked loop, or the
 * reply never reaching the wire). Presence discovery keeps working, so the peer
 * stays listed as sendable the whole time.
 */
class TestPubSub extends PubSub {
  #subscribers = new Map<string, Set<EventCallback>>();
  ownerAnswersDiscovery = true;

  async publish(topic: string, event: any): Promise<void> {
    if (
      !this.ownerAnswersDiscovery &&
      topic.startsWith(OWNER_DISCOVERY_PREFIX) &&
      event?.data?.type === 'thread-owner-response'
    ) {
      return;
    }
    for (const callback of [...(this.#subscribers.get(topic) ?? [])]) {
      await callback(event);
    }
  }

  async subscribe(topic: string, callback: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(callback);
    this.#subscribers.set(topic, subscribers);
  }

  async unsubscribe(topic: string, callback: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(callback);
  }

  async flush(): Promise<void> {}
}

function createAgent(id: string, pubsub: TestPubSub) {
  return new Agent({
    id,
    name: id,
    instructions: 'Test',
    model: createOwnerModel(`${id} ran`),
    pubsub,
  });
}

const target = { resourceId: 'claimed-owner-resource', threadId: 'claimed-owner-thread' };
const requiredOwnerWake = { ...target, ifIdle: { behavior: 'wake' as const, requireClaimedOwner: true } };

describe('claimed-owner wake conditions', () => {
  it('keeps an earlier thread reachable after the session moves to a new one', async () => {
    // mastracode claims every thread a session loads and releases only on
    // thread_deleted or session close, so `/new` adds a claim rather than
    // replacing one. Reported failures were suspected to come from that flow.
    const pubsub = new TestPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const owner = createAgent('owner', pubsub);
    const sender = createAgent('sender', pubsub);

    const firstClaim = await ownerRuntime.claimThreadOwnership(owner, target, pubsub);
    const newThreadClaim = await ownerRuntime.claimThreadOwnership(
      owner,
      { resourceId: target.resourceId, threadId: 'claimed-owner-new-thread' },
      pubsub,
    );
    expect(firstClaim.claimed).toBe(true);
    expect(newThreadClaim.claimed).toBe(true);

    // The thread the user moved away from is still advertised and still answers
    // a wake that requires its claimed owner.
    const peers = await ownerRuntime.discoverThreadPeers({ timeoutMs: 50 }, pubsub);
    expect(peers.map(peer => peer.threadId)).toEqual(
      expect.arrayContaining([target.threadId, 'claimed-owner-new-thread']),
    );

    const result = sender.sendSignal(
      { type: 'user-message', contents: 'sent after the user opened a new thread' },
      requiredOwnerWake,
    );
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver' });

    firstClaim.unsubscribe();
    newThreadClaim.unsubscribe();
  });

  it('rejects a required-owner wake when the owner stays advertised but cannot answer discovery', async () => {
    const pubsub = new TestPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const owner = createAgent('owner', pubsub);
    const sender = createAgent('sender', pubsub);

    const claim = await ownerRuntime.claimThreadOwnership(owner, target, pubsub);
    expect(claim.claimed).toBe(true);

    pubsub.ownerAnswersDiscovery = false;

    // Presence is unaffected: the peer still looks reachable to the sender, so
    // nothing upstream stops the send.
    await expect(senderRuntime.discoverThreadPeers({ timeoutMs: 50 }, pubsub)).resolves.toEqual([
      expect.objectContaining({ threadId: target.threadId }),
    ]);

    const result = sender.sendSignal({ type: 'user-message', contents: 'are you there' }, requiredOwnerWake);
    await expect(result.accepted).rejects.toThrow(
      `No claimed thread owner responded for ${target.resourceId}\u0000${target.threadId}`,
    );

    // The owner is still there, so the same send succeeds as soon as it can answer.
    pubsub.ownerAnswersDiscovery = true;
    const retry = sender.sendSignal({ type: 'user-message', contents: 'are you there now' }, requiredOwnerWake);
    await expect(retry.accepted).resolves.toMatchObject({ action: 'deliver' });

    claim.unsubscribe();
  });

  it('leaves the notification deliverable when the required-owner wake fails', async () => {
    // This is the state the sender tool misreads: the wake fails, but the
    // notification was persisted first and survives for the recipient to read.
    const pubsub = new TestPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'claimed-owner-storage', domains: { notifications } });
    const owner = createAgent('owner', pubsub);
    const sender = createAgent('sender', pubsub);
    const mastra = new Mastra({ agents: { sender }, storage, logger: false });

    const claim = await ownerRuntime.claimThreadOwnership(owner, target, pubsub);
    pubsub.ownerAnswersDiscovery = false;

    const result = await sender.sendNotificationSignal(
      { source: 'agent-connection', kind: 'peer-signal', priority: 'high', summary: 'are you there' },
      requiredOwnerWake,
    );

    expect(result.accepted).toBeUndefined();
    expect(result.record).toMatchObject({
      status: 'pending',
      lastDeliveryError: expect.stringContaining('No claimed thread owner responded'),
    });

    // Once the owner can answer, the same send through the wake path succeeds.
    pubsub.ownerAnswersDiscovery = true;
    const retry = await sender.sendNotificationSignal(
      { source: 'agent-connection', kind: 'peer-signal', priority: 'high', summary: 'are you there again' },
      requiredOwnerWake,
    );
    await expect(retry.accepted).resolves.toMatchObject({ action: 'deliver' });

    // An immediate-deliver record carries neither deliverAt nor summaryAt, so
    // dueTime is +Infinity and the deferred dispatcher never schedules it. The
    // pending record is the recipient's only trace: it surfaces when the
    // recipient's inbox is read, which is how the peer saw the reported sends.
    expect(result.record.deliverAt).toBeUndefined();
    expect(result.record.summaryAt).toBeUndefined();
    const dispatchResult = await dispatchDueNotifications({
      mastra,
      storage: notifications,
      now: new Date(Date.now() + 60_000),
    });
    expect(dispatchResult.delivered).toEqual([]);
    expect(dispatchResult.failed).toEqual([]);
    const pendingInbox = await notifications.listNotifications({ threadId: target.threadId, status: 'pending' });
    expect(pendingInbox.map(record => record.id)).toContain(result.record.id);

    claim.unsubscribe();
  }, 30_000);
});
