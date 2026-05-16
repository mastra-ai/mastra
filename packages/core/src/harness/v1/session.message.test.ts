/**
 * Harness v1 — Session.message() variants.
 *
 * Covers the three return shapes (default, streaming, structured + sync) plus
 * the per-turn override surface (mode, additionalTools, abortSignal). The
 * tests record the call shape received by a fake agent so we can assert what
 * the session forwarded without standing up a real model.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { buildFakeOutput, extractSignalContents } from './__test-utils__/fake-output';
import { HarnessAdmissionConflictError, HarnessValidationError } from './errors';
import { Harness } from './harness';

// ---------------------------------------------------------------------------
// Fake agent: skips the model layer entirely. Records what message() passed
// in so the test can assert the call shape.
// ---------------------------------------------------------------------------

interface FakeCall {
  type: 'stream' | 'generate';
  messages: unknown;
  options: any;
}

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

class FakeAgent extends Agent<any, any, any> {
  calls: FakeCall[] = [];
  fullOutput: any = {
    text: 'hello back',
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
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
    totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };

  constructor(name: string) {
    super({
      id: name,
      name,
      instructions: 'fake',
      model: 'openai/gpt-4o-mini' as any,
    });
  }

  async stream(messages: any, options?: any): Promise<any> {
    this.calls.push({ type: 'stream', messages, options });
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }

  async generate(messages: any, options?: any): Promise<any> {
    this.calls.push({ type: 'generate', messages, options });
    return this.fullOutput;
  }
}

function setup(modes?: any) {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: modes ?? [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, storage };
}

describe('Session.message() — default path', () => {
  it('returns a fully-resolved AgentResult bundle', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const result = await session.message({ content: 'hi' });

    expect(result.text).toBe('hello back');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });

    // Under signal-routed message(), agent.stream() receives a
    // CreatedAgentSignal whose contents is the caller-supplied prompt.
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]!.type).toBe('stream');
    expect((agent.calls[0]!.messages as { type: string; contents: unknown }).type).toBe('user-message');
    expect(extractSignalContents(agent.calls[0]!.messages)).toBe('hi');
  });

  it('threads memory.thread + memory.resource through to the agent', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'r-mem', threadId: { fresh: true } });

    await session.message({ content: 'hi' });
    expect(agent.calls[0]!.options.memory).toEqual({
      thread: session.threadId,
      resource: 'r-mem',
    });
  });

  it('forwards the caller-supplied abortSignal (chained into the per-turn signal)', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ac = new AbortController();
    await session.message({ content: 'hi', abortSignal: ac.signal });
    // Session mints its own per-turn AbortController so `session.abort()` can
    // also cancel the run. Caller's signal is linked into it, so aborting the
    // caller's controller must abort the signal handed to the agent.
    const turnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    expect(turnSignal).toBeInstanceOf(AbortSignal);
    expect(turnSignal).not.toBe(ac.signal);
    expect(turnSignal.aborted).toBe(false);
  });

  it('aborting the caller signal aborts the per-turn signal handed to the agent', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const ac = new AbortController();
    await session.message({ content: 'hi', abortSignal: ac.signal });
    const turnSignal = agent.calls[0]!.options.abortSignal as AbortSignal;
    ac.abort('caller-cancelled');
    expect(turnSignal.aborted).toBe(true);
    expect((turnSignal as { reason?: unknown }).reason).toBe('caller-cancelled');
  });

  it('deduplicates an exact admissionId retry without accepting a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = await session.message({ content: 'hi', admissionId: 'admission-1' });
    const second = await session.message({ content: 'hi', admissionId: 'admission-1' });

    expect(first.text).toBe('hello back');
    expect(second.text).toBe('hello back');
    expect(agent.calls).toHaveLength(1);
  });

  it('deduplicates concurrent exact admissionId retries before dispatching a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const [first, second] = await Promise.all([
      session.message({ content: 'hi', admissionId: 'admission-1' }),
      session.message({ content: 'hi', admissionId: 'admission-1' }),
    ]);

    expect(first.text).toBe('hello back');
    expect(second.text).toBe('hello back');
    expect(agent.calls).toHaveLength(1);
  });

  it('rejects a same admissionId retry with different message inputs before a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi', admissionId: 'admission-1' });
    await expect(session.message({ content: 'changed', admissionId: 'admission-1' })).rejects.toBeInstanceOf(
      HarnessAdmissionConflictError,
    );
    expect(agent.calls).toHaveLength(1);
  });

  it('rejects concurrent conflicting admissionId retries without dispatching a second signal', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const results = await Promise.allSettled([
      session.message({ content: 'hi', admissionId: 'admission-1' }),
      session.message({ content: 'changed', admissionId: 'admission-1' }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(HarnessAdmissionConflictError);
    expect(agent.calls).toHaveLength(1);
  });

  it('rejects admissionId with non-hash-safe additionalTools', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      session.message({ content: 'hi', admissionId: 'admission-1', additionalTools: { local: {} as any } }),
    ).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects an empty admissionId', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'hi', admissionId: '' })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects a stream retry after a completed admissionId result', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi', admissionId: 'admission-1' });

    await expect(session.message({ content: 'hi', admissionId: 'admission-1', stream: true })).rejects.toBeInstanceOf(
      HarnessValidationError,
    );
    expect(agent.calls).toHaveLength(1);
  });

  it('normalizes duplicate stream retries when the pending run output was rejected', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(undefined);
    vi.spyOn(agent, 'waitForRunOutput').mockRejectedValue(new Error('raw runtime tombstone'));
    (session as any)._completedRuns.set('rejected-run', { ok: false, err: new Error('cached failed run') });

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'rejected-run' },
        { stream: true },
      ),
    ).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
  });

  it('returns a duplicate stream retry when the pending run output registers after recovery starts', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const output = buildFakeOutput({
      runId: 'pending-retry-run',
      fullOutput: agent.fullOutput,
    });
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(undefined);
    vi.spyOn(agent, 'waitForRunOutput').mockResolvedValue(output);

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'pending-retry-run' },
        { stream: true },
      ),
    ).resolves.toBe(output);
  });

  it('does not wait for duplicate stream retries when the pending run already completed', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const waitForRunOutput = vi.spyOn(agent, 'waitForRunOutput');
    (session as any)._completedRuns.set('completed-pending-run', { ok: true, full: agent.fullOutput });

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'completed-pending-run' },
        { stream: true },
      ),
    ).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
    expect(waitForRunOutput).not.toHaveBeenCalled();
  });

  it('does not return retained completed output for duplicate stream retries', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    const output = buildFakeOutput({
      runId: 'retained-completed-run',
      fullOutput: agent.fullOutput,
    }) as any;
    output.status = 'success';
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(output);

    await expect(
      (session as any)._returnDuplicateMessageResult(
        { status: 'pending', signalId: 'signal-1', runId: 'retained-completed-run' },
        { stream: true },
      ),
    ).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
  });

  it('short-circuits duplicate stream retries when pending run completion settles first', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    let resolveCompletion!: (full: unknown) => void;
    const completion = new Promise<unknown>(resolve => {
      resolveCompletion = resolve;
    });
    vi.spyOn(agent, 'getRunOutput').mockReturnValue(undefined);
    vi.spyOn(agent, 'waitForRunOutput').mockReturnValue(new Promise(() => {}));
    (session as any)._runCompletionPromises.set('settling-pending-run', {
      promise: completion,
      resolve: resolveCompletion,
      reject: vi.fn(),
    });

    const retry = (session as any)._returnDuplicateMessageResult(
      { status: 'pending', signalId: 'signal-1', runId: 'settling-pending-run' },
      { stream: true },
    );
    await nextTick();
    resolveCompletion(agent.fullOutput);

    await expect(retry).rejects.toMatchObject({
      name: 'HarnessValidationError',
      message: expect.stringContaining('duplicate stream is no longer live'),
    });
  });
});

describe('Session.message() — streaming path', () => {
  it('returns the live MastraModelOutput when stream: true', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const stream = await session.message({ content: 'go', stream: true });

    // Duck-typed output is what we returned from FakeAgent.stream — i.e. it
    // exposes the awaitable promises directly.
    expect(await (stream as any).text).toBe('hello back');
    expect(agent.calls[0]!.type).toBe('stream');
  });
});

describe('Session.message() — structured + sync path', () => {
  const Schema = z.object({ answer: z.string() });

  it('returns the parsed object via agent.generate', async () => {
    const { harness, agent } = setup();
    agent.fullOutput = { ...agent.fullOutput, object: { answer: '42' } };
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const out = await session.message({ content: 'compute', output: Schema, sync: true });

    expect(out).toEqual({ answer: '42' });
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]!.type).toBe('generate');
    expect(agent.calls[0]!.options.structuredOutput).toEqual({ schema: Schema });
  });

  it('rejects when sync is omitted', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'compute', output: Schema } as any)).rejects.toThrow(/sync: true/);
  });

  it('rejects stream + output combination', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.message({ content: 'go', stream: true, output: Schema, sync: true } as any)).rejects.toThrow(
      /mutually exclusive/,
    );
  });

  it('rejects admissionId on the sync structured-output path', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(
      session.message({ content: 'compute', admissionId: 'admission-1', output: Schema, sync: true } as any),
    ).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Session.message() — per-turn overrides', () => {
  it('honors a `mode` override and resolves the matching agent', async () => {
    const agentA = new FakeAgent('a');
    const agentB = new FakeAgent('b');
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const harness = new Harness({
      agents: { a: agentA, b: agentB } as any,
      modes: [
        { id: 'modeA', agentId: 'a' },
        { id: 'modeB', agentId: 'b', additionalTools: { tool_b: { id: 'tool_b' } as any } },
      ],
      defaultModeId: 'modeA',
      sessions: { storage },
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.message({ content: 'hi' });
    expect(agentA.calls).toHaveLength(1);
    expect(agentB.calls).toHaveLength(0);

    await session.message({ content: 'hi B', mode: 'modeB' });
    expect(agentB.calls).toHaveLength(1);
    // modeB has additionalTools — they must show up in the toolsets surface.
    expect(agentB.calls[0]!.options.toolsets).toBeDefined();
    expect(Object.keys(agentB.calls[0]!.options.toolsets)).toContain('mode:modeB:add');
  });

  it('passes per-call additionalTools alongside mode tools', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const tools = { extra: { id: 'extra' } as any };
    await session.message({ content: 'hi', additionalTools: tools });
    expect(agent.calls[0]!.options.toolsets).toEqual({ 'call:additional': tools });
  });
});

describe('Session.message() — closed sessions reject', () => {
  it('throws when called on a closed session', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await harness.closeSession({ sessionId: session.id });

    await expect(session.message({ content: 'hi' })).rejects.toThrow(/closed/);
  });
});
