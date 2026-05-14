/**
 * Harness v1 — discrete accessors (§4.2).
 *
 * Covers the four narrow read-only accessors that TUI / playground status
 * surfaces lean on:
 *
 *   - `getTokenUsage()`  — cumulative usage across completed turns
 *   - `isBusy()`          — broader than `isRunning()`; reflects queue + pending
 *   - `getQueueDepth()`   — raw `pendingQueue.length`
 *   - `waitForIdle()`    — resolves when `!isBusy()`; rejects on close / timeout
 *
 * The accessors are thin shims over existing internal state, so the tests focus
 * on the *boundaries* — timing of state transitions, copy semantics on returned
 * objects, and the close-while-waiting + timeout rejection paths for
 * `waitForIdle`.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { buildFakeOutput } from './__test-utils__/fake-output';
import { Harness } from './harness';

interface FakeCall {
  type: 'stream';
  messages: unknown;
  options: any;
}

class FakeAgent extends Agent<any, any, any> {
  calls: FakeCall[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };
  /** When set, agent.stream() awaits this gate before returning. */
  gate?: Promise<void>;

  constructor(name = 'default') {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(messages: any, options?: any): Promise<any> {
    this.calls.push({ type: 'stream', messages, options });
    if (this.gate) await this.gate;
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }
}

function setup() {
  const agent = new FakeAgent();
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent };
}

// ---------------------------------------------------------------------------
// getTokenUsage()
// ---------------------------------------------------------------------------

describe('Session.getTokenUsage()', () => {
  it('starts at zero before any turn runs', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    expect(session.getTokenUsage()).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('accumulates token counts across completed turns', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });

    await session.message({ content: 'one' });
    expect(session.getTokenUsage()).toEqual({ promptTokens: 3, completionTokens: 5, totalTokens: 8 });

    await session.message({ content: 'two' });
    expect(session.getTokenUsage()).toEqual({ promptTokens: 6, completionTokens: 10, totalTokens: 16 });
  });

  it('returns a fresh copy — mutating the result does not affect future reads', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    await session.message({ content: 'hi' });

    const snapshot = session.getTokenUsage();
    snapshot.promptTokens = 999;
    expect(session.getTokenUsage().promptTokens).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getQueueDepth()
// ---------------------------------------------------------------------------

describe('Session.getQueueDepth()', () => {
  it('is zero on a fresh session', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    expect(session.getQueueDepth()).toBe(0);
  });

  it('reflects items appended to pendingQueue', async () => {
    const { harness, agent } = setup();
    let releaseGate!: () => void;
    agent.gate = new Promise<void>(r => (releaseGate = r));

    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    // Start a manual turn that blocks on the gate so the queued items can
    // pile up before the drain kicks in.
    const turn = session.message({ content: 'go' });
    // Yield so message() acquires the turn controller before queueing.
    await Promise.resolve();
    const q1 = session.queue({ content: 'q1' });
    const q2 = session.queue({ content: 'q2' });
    // queue() resolves on completion, not on append; wait for the durable
    // append (_flushUpdate) to land before sampling depth.
    await new Promise(r => setTimeout(r, 0));
    // Two items waiting in pendingQueue; manual turn doesn't count.
    expect(session.getQueueDepth()).toBe(2);

    // Let the turn finish + drain.
    releaseGate();
    await Promise.all([turn, q1, q2]);
    await session.waitForIdle();
    expect(session.getQueueDepth()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isBusy()
// ---------------------------------------------------------------------------

describe('Session.isBusy()', () => {
  it('is false on a fresh session', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    expect(session.isBusy()).toBe(false);
    expect(session.isRunning()).toBe(false);
  });

  it('is true while a manual turn is in flight', async () => {
    const { harness, agent } = setup();
    let releaseGate!: () => void;
    agent.gate = new Promise<void>(r => (releaseGate = r));

    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    const turn = session.message({ content: 'go' });
    await Promise.resolve();
    expect(session.isBusy()).toBe(true);
    expect(session.isRunning()).toBe(true);

    releaseGate();
    await turn;
    expect(session.isBusy()).toBe(false);
  });

  it('is true while queued items are pending, even without a live turn', async () => {
    const { harness, agent } = setup();
    let releaseGate!: () => void;
    agent.gate = new Promise<void>(r => (releaseGate = r));

    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    const manual = session.message({ content: 'manual' });
    await Promise.resolve();
    const queuedP = session.queue({ content: 'queued' });
    expect(session.isBusy()).toBe(true);

    releaseGate();
    await manual;
    await queuedP;
    await session.waitForIdle();
    expect(session.isBusy()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// waitForIdle()
// ---------------------------------------------------------------------------

describe('Session.waitForIdle()', () => {
  it('resolves synchronously-ish when the session is already idle', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    await session.waitForIdle();
  });

  it('resolves once an in-flight turn settles', async () => {
    const { harness, agent } = setup();
    let releaseGate!: () => void;
    agent.gate = new Promise<void>(r => (releaseGate = r));

    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    const turn = session.message({ content: 'go' });
    await Promise.resolve();
    const idle = session.waitForIdle();

    let resolved = false;
    void idle.then(() => {
      resolved = true;
    });
    await new Promise(r => setTimeout(r, 10));
    expect(resolved).toBe(false);

    releaseGate();
    await turn;
    await idle;
  });

  it('resolves after the queue has fully drained, not just after the live turn', async () => {
    const { harness, agent } = setup();
    let releaseGate!: () => void;
    agent.gate = new Promise<void>(r => (releaseGate = r));

    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    const manual = session.message({ content: 'm' });
    await Promise.resolve();
    void session.queue({ content: 'q' });

    releaseGate();
    await manual;
    // Queue drain may still be processing the queued item here.
    await session.waitForIdle();
    expect(session.isBusy()).toBe(false);
    expect(session.getQueueDepth()).toBe(0);
  });

  it('rejects with HarnessValidationError when timeoutMs elapses', async () => {
    const { harness, agent } = setup();
    let releaseGate!: () => void;
    agent.gate = new Promise<void>(r => (releaseGate = r));

    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    const turn = session.message({ content: 'go' });
    await Promise.resolve();

    await expect(session.waitForIdle({ timeoutMs: 20 })).rejects.toMatchObject({
      name: 'HarnessValidationError',
    });

    releaseGate();
    await turn;
  });

  it('rejects with HarnessSessionClosedError when the session closes while waiting', async () => {
    const { harness, agent } = setup();
    let releaseGate!: () => void;
    agent.gate = new Promise<void>(r => (releaseGate = r));

    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    const turn = session.message({ content: 'go' });
    await Promise.resolve();

    const idle = session.waitForIdle();
    // Closing the session while a turn is still in flight should reject any
    // waiter so callers don't hang on a dead session.
    void session.close().catch(() => {});
    await expect(idle).rejects.toMatchObject({ name: 'HarnessSessionClosedError' });

    releaseGate();
    await turn.catch(() => {});
  });

  it('rejects when called on an already-closed session', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'r', threadId: { fresh: true } });
    await session.close();
    expect(() => session.waitForIdle()).toThrow();
  });
});
