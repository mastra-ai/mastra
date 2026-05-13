/**
 * Harness v1 — `Session.signal()`.
 *
 * `signal()` is the optimistic user-message primitive. It resolves on the
 * first await tick with the routing decision (`id`, `runId`,
 * `willInterleave`) so callers can render an optimistic transcript row
 * before the turn completes, then await `result` for the eventual
 * `AgentResult`.
 *
 * These tests pin the observable contract:
 *
 *   - idle dispatch returns `willInterleave: false` and resolves `result`
 *     with the AgentResult for the freshly-woken run,
 *   - active-delivery dispatch returns `willInterleave: true` and reuses
 *     the in-flight run's completion,
 *   - per-turn overrides (`mode`, `additionalTools`) on active-delivery
 *     reject with `HarnessOverrideConflictError`,
 *   - `agent_start`/`agent_end` are emitted only for owned (idle-wake) turns,
 *   - closed sessions reject.
 */

import { describe, expect, it } from 'vitest';

import { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';
import { HarnessConfigError, HarnessOverrideConflictError } from './errors';
import type { HarnessEvent } from './events';

/**
 * Wait until the agent has been asked to run at least `expected` times.
 * Useful when we kick a held run and need to be sure the runtime has
 * reserved the active-run slot before dispatching a follow-up signal.
 */
async function waitForStreamCalls(agent: MockAgent, expected: number): Promise<void> {
  for (let i = 0; i < 100 && agent.streamCalls.length < expected; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

describe('Session.signal()', () => {
  it('returns id/runId/willInterleave on the first await tick and resolves result with the AgentResult', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const handle = await session.signal({ content: 'hello' });

    expect(typeof handle.id).toBe('string');
    expect(handle.id.length).toBeGreaterThan(0);
    expect(handle.willInterleave).toBe(false);
    expect(handle.accepted).toBe(true);
    expect(typeof handle.runId).toBe('string');

    const result = await handle.result;
    expect(result.runId).toBe(handle.runId);
  });

  it('idle dispatch wakes a fresh run and the stream call carries that runId', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const handle = await session.signal({ content: 'hi' });
    await handle.result;

    expect(agent.streamCalls).toHaveLength(1);
    const call = agent.streamCalls[0]!;
    expect((call.options as { runId: string }).runId).toBe(handle.runId);

    const messages = call.messages as { __isCreatedSignal?: boolean; type?: string; contents?: unknown };
    expect(messages.__isCreatedSignal).toBe(true);
    expect(messages.type).toBe('user-message');
    expect(messages.contents).toBe('hi');
  });

  it('active-delivery dispatch returns willInterleave: true and reuses the in-flight runId', async () => {
    const { harness, agent } = setupHarness();
    let releaseFirst!: () => void;
    const hold = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    agent.enqueueRun({ holdUntil: hold, text: 'first' });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const firstPromise = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    const second = await session.signal({ content: 'second' });

    expect(second.willInterleave).toBe(true);

    releaseFirst();
    const firstResult = await firstPromise;
    expect(second.runId).toBe(firstResult.runId);

    const secondResult = await second.result;
    expect(secondResult.runId).toBe(firstResult.runId);
  });

  it('rejects active-delivery dispatch with a mode override', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ holdUntil: hold });

    const { harness } = setupHarness({
      agents: { default: agent },
      modes: [
        { id: 'default', agentId: 'default' },
        { id: 'other', agentId: 'default' },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const firstPromise = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    await expect(session.signal({ content: 'x', mode: 'other' })).rejects.toBeInstanceOf(HarnessOverrideConflictError);

    release();
    await firstPromise;
  });

  it('rejects active-delivery dispatch with additionalTools', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ holdUntil: hold });

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const firstPromise = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    await expect(
      session.signal({ content: 'x', additionalTools: { extra: { id: 'extra', execute: async () => 'ok' } as any } }),
    ).rejects.toBeInstanceOf(HarnessOverrideConflictError);

    release();
    await firstPromise;
  });

  it('emits agent_start + agent_end for an owned (idle-wake) turn', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    const handle = await session.signal({ content: 'hi' });
    await handle.result;

    const types = events.map(e => e.type);
    expect(types).toContain('agent_start');
    expect(types).toContain('agent_end');
  });

  it('does not emit agent_start for active-delivery (the live run owns the lifecycle)', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ holdUntil: hold });

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const firstPromise = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    // Capture events AFTER the first turn's agent_start has fired so we
    // only count events triggered by the signal() dispatch itself.
    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.signal({ content: 'second' });

    expect(events.filter(e => e.type === 'agent_start')).toHaveLength(0);

    release();
    await firstPromise;
  });

  it('rejects on a closed session', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.close();

    await expect(session.signal({ content: 'hi' })).rejects.toBeInstanceOf(HarnessConfigError);
  });

  it('rejects non-string content', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    // @ts-expect-error - intentional invalid input.
    await expect(session.signal({ content: 123 })).rejects.toThrow();
  });
});
