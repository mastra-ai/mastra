/**
 * Harness v1 — `Session` thread-subscription lifecycle.
 *
 * Slice A/B introduced a per-session, lazy-acquired `AgentThreadSubscription`
 * that the drain loop reads chunks from for every run on the thread. These
 * tests pin the lifecycle contract:
 *
 *   - the subscription is NOT opened until the first `message()` call
 *     (i.e. session creation alone should not subscribe),
 *   - a single subscription is re-used across multiple sequential
 *     `message()` calls on the same session,
 *   - closing the session unsubscribes and rejects any outstanding run
 *     completion waiters so callers don't hang,
 *   - subagent sessions don't share the parent's subscription — each gets
 *     its own (different agent / thread).
 */

import { describe, expect, it } from 'vitest';

import { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';

describe('Session thread-subscription lifecycle', () => {
  it('does not open a thread subscription until the first message() call', async () => {
    const agent = new MockAgent({ id: 'default' });
    let subscribeCalls = 0;
    const originalSubscribe = agent.subscribeToThread.bind(agent);
    agent.subscribeToThread = (opts: any) => {
      subscribeCalls += 1;
      return originalSubscribe(opts);
    };

    const { harness } = setupHarness({ agents: { default: agent } });
    await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    expect(subscribeCalls).toBe(0);
  });

  it('reuses a single subscription across sequential message() calls on the same session', async () => {
    const agent = new MockAgent({ id: 'default' });
    let subscribeCalls = 0;
    const originalSubscribe = agent.subscribeToThread.bind(agent);
    agent.subscribeToThread = (opts: any) => {
      subscribeCalls += 1;
      return originalSubscribe(opts);
    };

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'one' });
    await session.message({ content: 'two' });
    await session.message({ content: 'three' });

    // One subscription, three runs.
    expect(subscribeCalls).toBe(1);
    expect(agent.streamCalls).toHaveLength(3);
  });

  it('unsubscribes when the session is closed', async () => {
    const agent = new MockAgent({ id: 'default' });
    let unsubscribeCalls = 0;
    const originalSubscribe = agent.subscribeToThread.bind(agent);
    agent.subscribeToThread = async (opts: any) => {
      const sub = await originalSubscribe(opts);
      const origUnsubscribe = sub.unsubscribe.bind(sub);
      sub.unsubscribe = () => {
        unsubscribeCalls += 1;
        return origUnsubscribe();
      };
      return sub;
    };

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hello' });
    expect(unsubscribeCalls).toBe(0);

    await session.close();
    expect(unsubscribeCalls).toBe(1);
  });

  it('subagent sessions do not share the parent session subscription', async () => {
    // Subagent + parent use different agents and different threads, so
    // each one opens its own subscription.
    const parentAgent = new MockAgent({ id: 'parent' });
    const childAgent = new MockAgent({ id: 'child' });

    let parentSubs = 0;
    let childSubs = 0;
    const parentOrig = parentAgent.subscribeToThread.bind(parentAgent);
    const childOrig = childAgent.subscribeToThread.bind(childAgent);
    parentAgent.subscribeToThread = (opts: any) => {
      parentSubs += 1;
      return parentOrig(opts);
    };
    childAgent.subscribeToThread = (opts: any) => {
      childSubs += 1;
      return childOrig(opts);
    };

    const { harness } = setupHarness({
      agents: { parent: parentAgent, child: childAgent },
      modes: [
        { id: 'default', agentId: 'parent' },
        { id: 'child-mode', agentId: 'child' },
      ],
    });
    const parent = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await parent.message({ content: 'kickoff' });

    // A child session bound to a different agent + fresh thread should
    // open its own subscription, not piggyback on the parent's.
    const child = await harness.session({
      resourceId: 'u1',
      threadId: { fresh: true },
      modeId: 'child-mode',
      parentSessionId: parent.id,
    } as any);
    await child.message({ content: 'child task' });

    expect(parentSubs).toBe(1);
    expect(childSubs).toBe(1);
  });
});
