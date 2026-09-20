import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { EventEmitterPubSub } from '@mastra/core/events';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { afterEach, describe, expect, it } from 'vitest';

import { createSessionThreadAdvertisement } from '../session-advertisement.js';

/**
 * Loading another thread must not make the previous one unreachable. Peers
 * address a saved agent by its `(agentId, resourceId, threadId)` id, so a thread
 * that stops being advertised silently breaks every saved connection to it —
 * exactly what happens when a session moves on after `/new`.
 */
describe('session thread advertisement', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it('keeps a thread advertised after the session moves to a new one', async () => {
    const pubsub = new EventEmitterPubSub();
    const resourceId = `session-advertisement-${Date.now()}`;
    const agent = new Agent({
      id: 'code-agent',
      name: 'advertisement-test',
      instructions: 'advertisement test',
      model: createMockModel({ mockText: 'ok' }),
      pubsub,
    });
    const controller = new AgentController({
      id: 'advertisement-controller',
      resourceId,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      pubsub,
    } as any);
    await controller.init();
    const session = await controller.createSession({ id: 'advertisement-session', ownerId: 'owner', resourceId });

    const advertisement = createSessionThreadAdvertisement({
      session,
      controller,
      projectName: 'advertisement-project',
    });
    cleanups.push(() => advertisement.close());

    const firstThread = await session.thread.create({ id: 'first-thread' });
    await advertisement.claim(firstThread.id);

    const advertisedThreads = async () =>
      (await agent.discoverThreadPeers({ timeoutMs: 500 })).map(peer => peer.threadId).sort();
    expect(await advertisedThreads()).toEqual(['first-thread']);

    // `/new`: the session detaches and binds a brand-new thread on the next prompt.
    session.thread.detachFromCurrent();
    const secondThread = await session.thread.create();

    await expect
      .poll(advertisedThreads, { timeout: 5_000 })
      .toEqual([firstThread.id, secondThread.id].sort());
  }, 30_000);

  it('delivers a wake signal to a thread the session has moved away from', async () => {
    const pubsub = new EventEmitterPubSub();
    const resourceId = `session-advertisement-delivery-${Date.now()}`;
    // A peer process (terminal 1) that saved the session we are about to move.
    const peerAgent = new Agent({
      id: 'code-agent',
      name: 'peer',
      instructions: 'peer',
      model: createMockModel({ mockText: 'peer response' }),
      pubsub,
    });
    const sessionAgent = new Agent({
      id: 'code-agent',
      name: 'session',
      instructions: 'session',
      model: createMockModel({ mockText: 'session response' }),
      pubsub,
    });
    const controller = new AgentController({
      id: 'advertisement-delivery-controller',
      resourceId,
      modes: [{ id: 'default', name: 'Default', default: true, agent: sessionAgent }],
      pubsub,
    } as any);
    await controller.init();
    const session = await controller.createSession({
      id: 'advertisement-delivery-session',
      ownerId: 'owner',
      resourceId,
    });

    const advertisement = createSessionThreadAdvertisement({
      session,
      controller,
      projectName: 'advertisement-project',
    });
    cleanups.push(() => advertisement.close());

    const firstThread = await session.thread.create({ id: 'saved-thread' });
    await advertisement.claim(firstThread.id);

    // The peer saves the advertised endpoint, exactly as `agent_connect` does.
    const saved = (await peerAgent.discoverThreadPeers({ timeoutMs: 500 })).find(
      peer => peer.threadId === firstThread.id,
    );
    expect(saved).toBeDefined();

    // The session moves on (`/new`), and the peer keeps only its saved id.
    session.thread.detachFromCurrent();
    await session.thread.create();
    await new Promise(resolve => setTimeout(resolve, 100));

    // A wake signal aimed at the saved endpoint must still be accepted, and we
    // need to know which thread the run actually lands on.
    const firstSubscription = await sessionAgent.subscribeToThread({ resourceId, threadId: firstThread.id });
    const secondThreadId = session.thread.getId()!;
    const secondSubscription = await sessionAgent.subscribeToThread({ resourceId, threadId: secondThreadId });
    cleanups.push(() => firstSubscription.unsubscribe());
    cleanups.push(() => secondSubscription.unsubscribe());

    const readThread = async (subscription: typeof firstSubscription) => {
      const iterator = subscription.stream[Symbol.asyncIterator]();
      let text = '';
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        const next = await Promise.race([
          iterator.next(),
          new Promise<{ done: true }>(resolve => setTimeout(() => resolve({ done: true }), 2_000)),
        ]);
        if (next.done) break;
        const part = (next as { value: any }).value;
        if (part.type === 'text-delta') text += part.payload.text;
        if (part.type === 'finish') break;
      }
      return text;
    };

    const signal = await peerAgent.sendSignal(
      { type: 'user-message', contents: 'message to the saved thread' },
      { resourceId, threadId: saved!.threadId, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
    );
    const accepted = await signal.accepted;
    expect(accepted.action).toBe('wake');

    const [addressedText, currentText] = await Promise.all([
      readThread(firstSubscription),
      readThread(secondSubscription),
    ]);
    // The run answers on the thread the signal addressed — not on whichever
    // thread the session happens to be showing.
    expect(addressedText).toContain('session response');
    expect(currentText).toBe('');
  }, 30_000);

  it('releases every claimed thread when the session is torn down', async () => {
    const pubsub = new EventEmitterPubSub();
    const resourceId = `session-advertisement-close-${Date.now()}`;
    const agent = new Agent({
      id: 'code-agent',
      name: 'advertisement-test',
      instructions: 'advertisement test',
      model: createMockModel({ mockText: 'ok' }),
      pubsub,
    });
    const controller = new AgentController({
      id: 'advertisement-controller',
      resourceId,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      pubsub,
    } as any);
    await controller.init();
    const session = await controller.createSession({ id: 'advertisement-session', ownerId: 'owner', resourceId });

    const advertisement = createSessionThreadAdvertisement({
      session,
      controller,
      projectName: 'advertisement-project',
    });
    const firstThread = await session.thread.create({ id: 'first-thread' });
    await advertisement.claim(firstThread.id);
    const secondThread = await session.thread.create({ id: 'second-thread' });
    await advertisement.claim(secondThread.id);

    expect((await agent.discoverThreadPeers({ timeoutMs: 500 })).map(peer => peer.threadId).sort()).toEqual([
      'first-thread',
      'second-thread',
    ]);

    advertisement.close();

    expect(await agent.discoverThreadPeers({ timeoutMs: 500 })).toEqual([]);
  }, 30_000);
});
