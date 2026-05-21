/**
 * Tests for Session.getDisplayState() adapted from the fork's v1 display-state
 * coverage. The v1 shape is session-scoped: identity fields, transient run
 * fields, activity projections, cumulative token usage, pending interrupts,
 * queue depth, and optional goal state.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';
import { Harness } from './harness';

interface FakeRun {
  text?: string;
  runId?: string;
  traceId?: string;
  finishReason?: 'stop' | 'suspended';
  chunks?: unknown[];
  holdUntil?: Promise<void>;
  suspendPayload?: {
    toolCallId: string;
    toolName: string;
    args?: unknown;
    suspendPayload?: unknown;
  };
}

class FakeAgent extends Agent<any, any, any> {
  runs: FakeRun[] = [];

  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  enqueueRun(run: FakeRun): void {
    this.runs.push(run);
  }

  async stream(_messages: unknown, options?: any): Promise<MastraModelOutput> {
    const run = this.runs.shift() ?? {};
    const output = buildOutput({
      ...run,
      runId: run.runId ?? options?.runId ?? 'fake-run',
    });
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
  }
}

function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent };
}

describe('Session.getDisplayState()', () => {
  it('reports the documented identity fields', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const ds = session.getDisplayState();

    expect(ds.sessionId).toBe(session.id);
    expect(ds.threadId).toBe(session.threadId);
    expect(ds.resourceId).toBe('u');
    expect(ds.lifecycleState).toBe('live');
    expect(ds.modeId).toBeTypeOf('string');
    expect(ds.modelId).toBeTypeOf('string');
    expect(ds.createdAt).toBe(session.createdAt);
    expect(ds.lastActivityAt).toBeTypeOf('number');
  });

  it('idle state has no run fields, empty activity maps, zero usage, and no pending work', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const ds = session.getDisplayState();

    expect(ds.isRunning).toBe(false);
    expect(ds.currentRunId).toBeUndefined();
    expect(ds.currentMessageId).toBeUndefined();
    expect(ds.currentTraceId).toBeUndefined();
    expect(ds.activeTools).toEqual({});
    expect(ds.toolInputBuffers).toEqual({});
    expect(ds.activeSubagents).toEqual({});
    expect(ds.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(ds.pending).toBeNull();
    expect(ds.queueDepth).toBe(0);
    expect(ds.currentQueuedItemId).toBeUndefined();
    expect(ds.goal).toBeUndefined();
  });

  it('flips isRunning while a turn is in flight and clears run fields after completion', async () => {
    const { harness, agent } = setup();
    let release!: () => void;
    agent.enqueueRun({
      runId: 'run-display',
      finishReason: 'stop',
      holdUntil: new Promise(resolve => {
        release = resolve;
      }),
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const inFlight = session.message({ content: 'hi' });
    while (!session.isRunning()) await Promise.resolve();

    expect(session.getDisplayState().isRunning).toBe(true);

    release();
    await inFlight;

    const after = session.getDisplayState();
    expect(after.isRunning).toBe(false);
    expect(after.currentRunId).toBeUndefined();
    expect(after.tokenUsage.totalTokens).toBeGreaterThanOrEqual(2);
  });

  it('accumulates token usage across multiple turns', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({ runId: 'r1', finishReason: 'stop' });
    agent.enqueueRun({ runId: 'r2', finishReason: 'stop' });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.message({ content: 'one' });
    const after1 = session.getDisplayState().tokenUsage.totalTokens;
    await session.message({ content: 'two' });
    const after2 = session.getDisplayState().tokenUsage.totalTokens;

    expect(after2).toBeGreaterThan(after1);
  });

  it('surfaces full pending payloads instead of legacy booleans', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-pending',
      suspendPayload: {
        toolCallId: 'tc-1',
        toolName: 'ask_user',
        args: { question: 'pick one', options: [{ label: 'a' }, { label: 'b' }] },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.message({ content: 'ask' });

    const ds = session.getDisplayState();
    expect(ds.pending).toMatchObject({
      kind: 'question',
      toolCallId: 'tc-1',
      payload: {
        question: 'pick one',
        options: [{ label: 'a' }, { label: 'b' }],
      },
    });
    expect((ds as unknown as Record<string, unknown>).hasPendingQuestion).toBeUndefined();
  });

  it('returns fresh activity collections and token usage on each call', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const a = session.getDisplayState();
    const b = session.getDisplayState();

    expect(a.activeTools).not.toBe(b.activeTools);
    expect(a.toolInputBuffers).not.toBe(b.toolInputBuffers);
    expect(a.activeSubagents).not.toBe(b.activeSubagents);
    expect(a.tokenUsage).not.toBe(b.tokenUsage);
  });

  it('tracks active tool calls from stream chunks', async () => {
    const { harness, agent } = setup();
    let release!: () => void;
    agent.enqueueRun({
      runId: 'run-tools',
      finishReason: 'stop',
      chunks: [{ type: 'tool-call', payload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'pwd' } } }],
      holdUntil: new Promise(resolve => {
        release = resolve;
      }),
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const inFlight = session.message({ content: 'tool' });
    await waitFor(() => session.getDisplayState().activeTools['tc-1'] !== undefined);

    expect(session.getDisplayState().activeTools['tc-1']).toMatchObject({
      toolCallId: 'tc-1',
      toolName: 'shell',
      args: { cmd: 'pwd' },
    });

    release();
    await inFlight;
    expect(session.getDisplayState().activeTools).toEqual({});
  });

  it('omits parentSessionId for top-level sessions', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    expect(session.getDisplayState().parentSessionId).toBeUndefined();
  });
});

async function waitFor(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('condition was not met before timeout');
}

function buildOutput(run: FakeRun): MastraModelOutput {
  const fullOutput = {
    text: run.text ?? 'ok',
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    finishReason: run.finishReason ?? 'stop',
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
    response: { id: 'response-1', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    error: undefined,
    tripwire: undefined,
    traceId: run.traceId,
    spanId: undefined,
    runId: run.runId ?? 'fake-run',
    suspendPayload: run.suspendPayload,
    messages: [],
    rememberedMessages: [],
  };
  let finished!: () => void;
  const finishedPromise = new Promise<void>(resolve => {
    finished = resolve;
  });
  const fullStream = (async function* () {
    for (const chunk of run.chunks ?? []) yield chunk;
    if (run.holdUntil) await run.holdUntil;
    finished();
  })();
  return {
    runId: fullOutput.runId,
    getFullOutput: async () => {
      if (run.holdUntil) await run.holdUntil;
      return fullOutput;
    },
    fullStream,
    text: Promise.resolve(fullOutput.text),
    finishReason: Promise.resolve(fullOutput.finishReason),
    usage: Promise.resolve(fullOutput.usage),
    _waitUntilFinished: () => finishedPromise,
  } as unknown as MastraModelOutput;
}
