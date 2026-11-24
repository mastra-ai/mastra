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

function createOwnerModel(responseText: string, onStream?: (responseText: string) => void) {
  return new MockLanguageModelV2({
    doStream: async () => {
      onStream?.(responseText);
      return {
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
      };
    },
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

function createAgent(id: string, pubsub: TestPubSub, streams?: string[]) {
  return new Agent({
    id,
    name: id,
    instructions: 'Test',
    model: createOwnerModel(`${id} ran`, text => streams?.push(text)),
    pubsub,
  });
}

const target = { resourceId: 'claimed-owner-resource', threadId: 'claimed-owner-thread' };
const requiredOwnerWake = { ...target, ifIdle: { behavior: 'wake' as const, requireClaimedOwner: true } };

/** Waits for a condition a run reaches asynchronously, so assertions do not race it. */
async function waitFor(condition: () => boolean, description: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

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
      `No claimed thread owner responded for thread ${target.threadId} (resource ${target.resourceId})`,
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
    const ownerRuns: string[] = [];
    const senderRuns: string[] = [];
    const owner = createAgent('owner', pubsub, ownerRuns);
    const sender = createAgent('sender', pubsub, senderRuns);
    const mastra = new Mastra({ agents: { sender }, storage, logger: false });

    // The claim carries the owner's own stream options, which is what its
    // session uses to drive a woken run to completion. Without them the run
    // starts but is never drained, so the owner's model is never called.
    const claim = await ownerRuntime.claimThreadOwnership(
      owner,
      { ...target, streamOptions: { untilIdle: true } },
      pubsub,
    );
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

    // The failed immediate delivery leaves the record pending, but with a due
    // time, so it is both readable from the recipient's inbox now and
    // recoverable by the dispatcher afterwards. Without that due time nothing
    // would ever retry it, and the terminal `failed` state would be
    // unreachable for immediate-deliver records, so a sender that queued a
    // signal could never learn it had terminally failed.
    expect(result.record.deliverAt).toBeInstanceOf(Date);
    const pendingInbox = await notifications.listNotifications({ threadId: target.threadId, status: 'pending' });
    expect(pendingInbox.map(record => record.id)).toContain(result.record.id);

    // Once the owner answers discovery again, the dispatcher retry delivers it.
    pubsub.ownerAnswersDiscovery = true;
    const dispatchResult = await dispatchDueNotifications({
      mastra,
      storage: notifications,
      now: new Date(Date.now() + 60_000),
    });
    expect(dispatchResult.delivered).toHaveLength(1);
    expect(dispatchResult.failed).toEqual([]);

    // The retry has to reach the process that claims the thread. A retry that
    // rebuilds the target without the claimed-owner requirement would take the
    // execution lease here instead and run the peer's thread in this process,
    // with this process's agent, workspace, and stream options.
    await waitFor(() => ownerRuns.length > 0, 'the claiming owner to run the woken turn');
    expect(ownerRuns).toEqual(['owner ran']);
    // The dispatching process must not have run the turn itself. Its model
    // streams during the dispatch call, so an empty record here is a real
    // negative rather than a race the assertion lost.
    expect(senderRuns).toEqual([]);

    claim.unsubscribe();
  }, 30_000);

  it('keeps the record pending and counts the attempt while the owner stays silent', async () => {
    const pubsub = new TestPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const notifications = new InMemoryNotificationsStorage();
    const storage = new MastraCompositeStore({ id: 'claimed-owner-silent-storage', domains: { notifications } });
    const owner = createAgent('owner', pubsub);
    const sender = createAgent('sender', pubsub);
    const mastra = new Mastra({ agents: { sender }, storage, logger: false });

    const claim = await ownerRuntime.claimThreadOwnership(owner, target, pubsub);
    pubsub.ownerAnswersDiscovery = false;

    const result = await sender.sendNotificationSignal(
      { source: 'agent-connection', kind: 'peer-signal', priority: 'high', summary: 'still quiet' },
      requiredOwnerWake,
    );
    expect(result.record).toMatchObject({ status: 'pending', deliveryAttempts: 1 });

    const dispatchResult = await dispatchDueNotifications({
      mastra,
      storage: notifications,
      now: new Date(Date.now() + 60_000),
    });
    expect(dispatchResult.delivered).toEqual([]);
    expect(dispatchResult.failed.map(entry => entry.error)).toEqual([
      expect.stringContaining('No claimed thread owner responded'),
    ]);

    // A retry that cannot reach the owner is an attempt, not a delivery, and
    // the record stays readable in the recipient's inbox until the attempt cap
    // is reached.
    const record = await notifications.getNotification({ threadId: target.threadId, id: result.record.id });
    expect(record).toMatchObject({
      status: 'pending',
      deliveryAttempts: 2,
      lastDeliveryError: expect.stringContaining('No claimed thread owner responded'),
    });

    claim.unsubscribe();
  }, 30_000);
});
