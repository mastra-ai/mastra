/**
 * Harness v1 — `Session.injectSystemReminder()`.
 *
 * System-reminder injection primitive used by goal-judge continuations
 * and other harness-internal nudges. Behaves like `signal()` but with
 * signal type `'system-reminder'` and no exposed `result` promise.
 */

import { describe, expect, it } from 'vitest';

import { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';
import { HarnessConfigError, HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';

describe('Session.injectSystemReminder()', () => {
  it('dispatches a system-reminder signal on an idle thread (willInterleave: false)', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const handle = await session.injectSystemReminder('remember X');

    expect(typeof handle.id).toBe('string');
    expect(handle.willInterleave).toBe(false);
    expect(handle.accepted).toBe(true);
    expect(typeof handle.runId).toBe('string');

    // Let the woken turn run through so we can inspect the stream call.
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(agent.streamCalls).toHaveLength(1);
    const messages = agent.streamCalls[0]!.messages as {
      __isCreatedSignal?: boolean;
      type?: string;
      contents?: unknown;
    };
    expect(messages.__isCreatedSignal).toBe(true);
    expect(messages.type).toBe('system-reminder');
    expect(messages.contents).toBe('remember X');
  });

  it('drains into an active run (willInterleave: true)', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ holdUntil: hold });

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const firstPromise = session.message({ content: 'first' });
    await new Promise<void>(resolve => setImmediate(resolve));

    const handle = await session.injectSystemReminder('reminder');
    expect(handle.willInterleave).toBe(true);

    release();
    await firstPromise;
  });

  it('passes attributes and metadata through to the signal envelope', async () => {
    const { harness, agent } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const handle = await session.injectSystemReminder('check', {
      attributes: { type: 'goal-judge' },
      metadata: { goalId: 'g1' },
    });

    expect(handle.signal.type).toBe('system-reminder');
    expect(handle.signal.attributes).toEqual({ type: 'goal-judge' });
    expect(handle.signal.metadata).toEqual({ goalId: 'g1' });

    // Drain through.
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(agent.streamCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty content', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.injectSystemReminder('')).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects on a closed session', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.close();

    await expect(session.injectSystemReminder('hi')).rejects.toBeInstanceOf(HarnessConfigError);
  });

  it('emits agent_start + agent_end when the reminder wakes a new run', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.injectSystemReminder('hi');
    // Wait for the background continuation to settle.
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));

    const types = events.map(e => e.type);
    expect(types).toContain('agent_start');
    expect(types).toContain('agent_end');
  });
});
