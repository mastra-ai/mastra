/**
 * Harness v1 — Session.message() variants.
 *
 * Covers the three return shapes (default, streaming, structured + sync) plus
 * the per-turn override surface (mode, additionalTools, abortSignal). The
 * tests record the call shape received by a fake agent so we can assert what
 * the session forwarded without standing up a real model.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';

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
    const fullOutput = this.fullOutput;
    // Build a minimal duck-typed MastraModelOutput. Only the bits Session
    // touches are exercised; everything else stays loose.
    const out = {
      // Awaitable promises read by .getFullOutput()
      getFullOutput: async () => fullOutput,
      // Used by streaming-path callers directly.
      text: Promise.resolve(fullOutput.text),
      finishReason: Promise.resolve(fullOutput.finishReason),
      usage: Promise.resolve(fullOutput.usage),
    } as unknown as MastraModelOutput;
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

    // Forwarded the user prompt as the first arg.
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]!.type).toBe('stream');
    expect(agent.calls[0]!.messages).toBe('hi');
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
