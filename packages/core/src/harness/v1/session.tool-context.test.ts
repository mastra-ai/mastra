/**
 * Harness v1 — HarnessRequestContext (§6.1).
 *
 * These tests check the slot the harness exposes to tools via
 * `requestContext.get('harness')`. They run against `MockAgent`, which
 * records every `stream`/`generate` call's options — including the
 * RequestContext we hand it. That lets us assert the slot's identity
 * fields, state reads/writes, abort plumbing, and event emission without
 * actually wiring a real tool execution.
 */

import { describe, expect, it } from 'vitest';

import { setupHarness } from './__test-utils__/setup';
import type { HarnessRequestContext } from './types';

function getHarnessSlot(streamCalls: any[]): HarnessRequestContext {
  const ctx = streamCalls.at(-1)!.options.requestContext;
  expect(ctx).toBeDefined();
  const slot = ctx.get('harness');
  expect(slot).toBeDefined();
  return slot as HarnessRequestContext;
}

describe('HarnessRequestContext — identity fields', () => {
  it('populates harnessId / sessionId / threadId / resourceId / modeId', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.harnessId).toBe(harness.ownerId);
    expect(slot.sessionId).toBe(session.id);
    expect(slot.threadId).toBe(session.threadId);
    expect(slot.resourceId).toBe('u1');
    expect(slot.modeId).toBe('default');
    expect(slot.source).toBe('parent');
    expect(slot.subagentDepth).toBe(0);
    expect(slot.parentSessionId).toBeUndefined();
  });

  it('reflects per-turn mode override on modeId', async () => {
    const { harness, agent } = setupHarness({
      modes: [
        { id: 'modeA', agentId: 'default' },
        { id: 'modeB', agentId: 'default' },
      ],
      defaultModeId: 'modeA',
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi', mode: 'modeB' });
    expect(getHarnessSlot(agent.streamCalls).modeId).toBe('modeB');
  });
});

describe('HarnessRequestContext — state reads/writes', () => {
  it('exposes a state snapshot that reflects setState writes', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ counter: number }>({ counter: 5 });
    await session.message({ content: 'hi' });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.state).toEqual({ counter: 5 });
    expect(slot.getState()).toEqual({ counter: 5 });
  });

  it('object-form setState shallow-merges into state', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ a: number; b?: number }>({ a: 1 });
    await session.message({ content: 'hi' });
    const slot = getHarnessSlot(agent.streamCalls);

    await slot.setState({ b: 2 });
    expect(await session.getState()).toEqual({ a: 1, b: 2 });
  });

  it('functional-form setState runs an atomic read-modify-write', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.setState<{ counter: number }>({ counter: 0 });
    await session.message({ content: 'hi' });
    const slot = getHarnessSlot(agent.streamCalls);

    await Promise.all([
      slot.setState((prev: { counter: number }) => ({ counter: prev.counter + 1 })),
      slot.setState((prev: { counter: number }) => ({ counter: prev.counter + 1 })),
      slot.setState((prev: { counter: number }) => ({ counter: prev.counter + 1 })),
    ]);
    expect(await session.getState()).toEqual({ counter: 3 });
  });
});

describe('HarnessRequestContext — abort plumbing', () => {
  it('aborts the slot signal when the caller-supplied signal aborts', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const controller = new AbortController();
    await session.message({ content: 'hi', abortSignal: controller.signal });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.abortSignal).toBeInstanceOf(AbortSignal);
    expect(slot.abortSignal).not.toBe(controller.signal);
    controller.abort('caller-cancelled');
    expect(slot.abortSignal.aborted).toBe(true);
  });

  it('mints a fresh signal when the caller did not supply one', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.abortSignal).toBeInstanceOf(AbortSignal);
    expect(slot.abortSignal.aborted).toBe(false);
  });
});

describe('HarnessRequestContext — queued turns', () => {
  it('queued turn surfaces the same slot shape to tools', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.queue({ content: 'queued' });
    // Drain to completion.
    await new Promise(r => setImmediate(r));

    const slot = getHarnessSlot(agent.streamCalls);
    expect(slot.sessionId).toBe(session.id);
    expect(slot.modeId).toBe('default');
    expect(slot.abortSignal).toBeInstanceOf(AbortSignal);
  });
});
