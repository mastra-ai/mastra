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
import { HarnessOverrideConflictError, HarnessSessionClosedError, HarnessSessionDeletedError } from './errors';
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

    const messages = call.messages as {
      __isCreatedSignal?: boolean;
      type?: string;
      tagName?: string;
      contents?: unknown;
    };
    expect(messages.__isCreatedSignal).toBe(true);
    expect(messages.type).toBe('user');
    expect(messages.tagName).toBe('user');
    expect(messages.contents).toBe('hi');
  });

  it('threads replacement mode semantics through an idle signal wake', async () => {
    const agent = new MockAgent({ id: 'default' });
    const { harness } = setupHarness({
      agents: { default: agent },
      modes: [{ id: 'default', agentId: 'default', tools: { signalTool: {} as any } }],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const handle = await session.signal({ content: 'hi' });
    await handle.result;

    expect(agent.streamCalls[0]!.options.toolsetsMode).toBe('replace');
    expect(agent.streamCalls[0]!.options.toolsets['mode:default']).toHaveProperty('signalTool');
    await session.close();
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

  it('keeps a full response identity when active attachment preparation falls back to idle wake', async () => {
    const agent = new MockAgent({ id: 'default' });
    let releaseFirst!: () => void;
    agent.enqueueRun({
      holdUntil: new Promise<void>(resolve => {
        releaseFirst = resolve;
      }),
      text: 'first',
    });
    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const firstPromise = session.message({ content: 'first' });
    await waitForStreamCalls(agent, 1);

    let releaseContents!: () => void;
    let contentsStarted!: () => void;
    const contentsStartedPromise = new Promise<void>(resolve => {
      contentsStarted = resolve;
    });
    const contentsGate = new Promise<void>(resolve => {
      releaseContents = resolve;
    });
    (session as any)._buildSignalContentsWithAttachments = async () => {
      contentsStarted();
      await contentsGate;
      return 'second';
    };

    const second = session.signal({
      content: 'second',
      logicalMessageIdentity: { input: 'input-2', response: 'response-2' },
    });
    await contentsStartedPromise;
    releaseFirst();
    await firstPromise;
    releaseContents();

    const handle = await second;
    await handle.result;
    expect(agent.streamCalls).toHaveLength(2);
    expect(agent.streamCalls[1]!.options.logicalMessageIdentity).toEqual({
      input: 'input-2',
      response: 'response-2',
    });
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

  it('owned-turn settles by signalId: emits signal_completed and writes durable result evidence (§4.2f/§10.2)', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    const handle = await session.signal({ content: 'hi' });
    await handle.result;

    // §10.2 OperationEvent — settlement is by signalId, not agent_end.
    const completed = events.find(e => e.type === 'signal_completed');
    expect(completed).toBeDefined();
    expect((completed as { signalId: string }).signalId).toBe(handle.id);
    expect((completed as { runId: string }).runId).toBe(handle.runId);

    // §4.2f durable per-signalId result evidence is queryable after the turn.
    const lookup = await session.lookupMessageResult(handle.id);
    expect(lookup && 'status' in lookup ? lookup.status : null).toBe('completed');
  });

  it('rejects an owned idle-wake result when the live session is marked deleted', async () => {
    const agent = new MockAgent({ id: 'default' });
    let release!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });
    agent.enqueueRun({ holdUntil: hold });

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const handle = await session.signal({ content: 'hi' });
    await waitForStreamCalls(agent, 1);
    expect(session.isRunning()).toBe(true);

    (session as any)._markDeleted();

    expect(session.isRunning()).toBe(false);
    try {
      await expect(handle.result).rejects.toBeInstanceOf(HarnessSessionDeletedError);
    } finally {
      release();
    }
  });

  it('rejects when the live session is marked deleted while opening the thread subscription', async () => {
    const agent = new MockAgent({ id: 'default' });
    let started!: () => void;
    const subscribeStarted = new Promise<void>(resolve => {
      started = resolve;
    });
    agent.subscribeToThread = async () => {
      started();
      return new Promise(() => {}) as any;
    };

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const signal = session.signal({ content: 'hi' });
    await subscribeStarted;

    (session as any)._markDeleted();

    await expect(signal).rejects.toBeInstanceOf(HarnessSessionDeletedError);
  });

  it('§13.3f.1: redacts a raw dispatch failure on the public signal() boundary', async () => {
    const agent = new MockAgent({ id: 'default' });
    // The idle-wake dispatch setup (`_buildRequestContext` /
    // `_buildSignalContentsWithAttachments` / `agent.sendSignal`) rejects with a
    // RAW provider/runtime error. `signal()` is a public §4.2b boundary, so its
    // promise rejection must be REDACTED: a generic `harness.internal` message
    // with the raw original preserved local-only on `.cause`.
    agent.sendSignal = (() => {
      throw new Error('provider dispatch exploded: dsn=postgres://secret@db');
    }) as any;

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const thrown = await session.signal({ content: 'hi' }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect((thrown as Error).name).toBe('HarnessExecutionError');
    expect((thrown as Error).message).toBe('An internal harness error occurred');
    expect(((thrown as { cause?: Error }).cause as Error).message).toBe(
      'provider dispatch exploded: dsn=postgres://secret@db',
    );
  });

  it('§13.3f.1: passes a Harness-own dispatch failure (deleted) through unredacted', async () => {
    const agent = new MockAgent({ id: 'default' });
    let started!: () => void;
    const subscribeStarted = new Promise<void>(resolve => {
      started = resolve;
    });
    agent.subscribeToThread = async () => {
      started();
      return new Promise(() => {}) as any;
    };

    const { harness } = setupHarness({ agents: { default: agent } });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const signal = session.signal({ content: 'hi' });
    await subscribeStarted;
    (session as any)._markDeleted();

    // The redaction wrap is a pass-through for construction-safe Harness errors:
    // the caller still receives the concrete HarnessSessionDeletedError it
    // branches on, NOT a HarnessExecutionError.
    await expect(signal).rejects.toBeInstanceOf(HarnessSessionDeletedError);
  });

  it('§13.3f.1: redacts a raw dispatch failure on the ACTIVE-DELIVERY public signal() boundary', async () => {
    // Stage a held in-flight run so the follow-up signal() routes through the
    // ACTIVE-DELIVERY branch (`willInterleave: true`), NOT idle-wake. There the
    // dispatch setup (`_buildSignalContentsWithAttachments` / `agent.sendSignal`)
    // is wrapped in its own try/catch. A RAW provider/runtime error escaping that
    // dispatch must be REDACTED on this public §4.2b boundary: a generic
    // `harness.internal` message with the raw original preserved local-only on
    // `.cause`. Mirrors the idle-wake redaction assertion exactly.
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
    // Confirm the run is genuinely in-flight: the next signal() will hit the
    // active-delivery branch (not idle-wake) because a run owns the active slot.
    expect(session.isRunning()).toBe(true);

    // Make the active-delivery dispatch reject with a RAW error AFTER the run is
    // already active. `sendSignal` is the active-delivery dispatch call inside the
    // wrapped try/catch.
    agent.sendSignal = (() => {
      throw new Error('active-delivery dispatch exploded: dsn=postgres://secret@db');
    }) as any;

    const thrown = await session.signal({ content: 'second' }).then(
      () => undefined,
      (e: unknown) => e,
    );

    try {
      expect((thrown as Error).name).toBe('HarnessExecutionError');
      expect((thrown as Error).message).toBe('An internal harness error occurred');
      expect(((thrown as { cause?: Error }).cause as Error).message).toBe(
        'active-delivery dispatch exploded: dsn=postgres://secret@db',
      );
    } finally {
      release();
      await firstPromise;
    }
  });

  it('§13.3f.1: ACTIVE-DELIVERY channel-ingress (internal) dispatch failure passes through RAW (recovery-worker exemption)', async () => {
    // Same active-delivery staging as above, but the dispatch is the trusted
    // channel-ingress recovery hook (`internal !== undefined`). That hook is NOT
    // a public §4.2b caller — the recovery worker needs the concrete error for
    // failure classification / re-dispatch, so the raw error passes through
    // UNREDACTED (no HarnessExecutionError wrap).
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
    expect(session.isRunning()).toBe(true);

    agent.sendSignal = (() => {
      throw new Error('active-delivery dispatch exploded: dsn=postgres://secret@db');
    }) as any;

    // The second positional `internal` arg flags the trusted channel-ingress
    // path. `_buildSignalContentsWithAttachments` is called with no attachments,
    // so the throw originates from `agent.sendSignal`.
    const thrown = await (session.signal as any)({ content: 'second' }, { signalId: 'ingress-1' }).then(
      () => undefined,
      (e: unknown) => e,
    );

    try {
      // RAW error preserved — no redaction for the trusted recovery worker.
      expect((thrown as Error).name).toBe('Error');
      expect((thrown as Error).message).toBe('active-delivery dispatch exploded: dsn=postgres://secret@db');
    } finally {
      release();
      await firstPromise;
    }
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

    await expect(session.signal({ content: 'hi' })).rejects.toBeInstanceOf(HarnessSessionClosedError);
  });

  it('rejects non-string content', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    // @ts-expect-error - intentional invalid input.
    await expect(session.signal({ content: 123 })).rejects.toThrow();
  });
});
