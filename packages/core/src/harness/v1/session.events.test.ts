/**
 * Harness v1 — event surface (§10).
 *
 * Covers Session.subscribe() + Harness.subscribe() lifecycle:
 *   - subscribers receive events emitted after subscribe() returns
 *   - unsubscribe stops delivery
 *   - mode_changed / model_changed / session_closed lifecycle events
 *   - agent_start / text_delta / tool_start / tool_end / agent_end produced
 *     while draining a streaming agent's fullStream
 *   - suspension_required / suspension_resolved on suspend/resume round-trip
 *   - throwing subscriber is isolated; other subscribers still see events
 *   - harness-level subscribers see session_created and forwarded session events
 *   - event ids share a single epoch and are monotonic
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';

// ---------------------------------------------------------------------------
// Fake agent that drives a programmable fullStream + getFullOutput.
// ---------------------------------------------------------------------------

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(_messages: any, _options?: any): Promise<any> {
    const chunks = this.chunks;
    const fullOutput = this.fullOutput;
    const fullStream = (async function* () {
      for (const chunk of chunks) yield chunk;
    })();
    const out = {
      getFullOutput: async () => fullOutput,
      fullStream,
      text: Promise.resolve(fullOutput.text),
      finishReason: Promise.resolve(fullOutput.finishReason),
      usage: Promise.resolve(fullOutput.usage),
      runId: fullOutput.runId,
    } as unknown as MastraModelOutput;
    return out;
  }

  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }

  async resumeStream(_resumeData: any, _opts?: any): Promise<any> {
    return this.stream(undefined);
  }
}

function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [
      { id: 'default', agentId: 'default' },
      { id: 'other', agentId: 'default' },
    ],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, storage };
}

describe('Session.subscribe()', () => {
  it('delivers events emitted after subscribe()', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    const off = session.subscribe(e => {
      events.push(e);
    });

    await session.message({ content: 'hi' });

    const types = events.map(e => e.type);
    expect(types).toContain('agent_start');
    expect(types).toContain('agent_end');
    expect(events.every(e => e.sessionId === session.id)).toBe(true);
    off();
  });

  it('stops delivering after unsubscribe()', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    const off = session.subscribe(e => {
      events.push(e);
    });
    off();
    await session.message({ content: 'hi' });

    expect(events).toEqual([]);
  });

  it('isolates a throwing subscriber from other subscribers', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const ok: HarnessEvent[] = [];
    session.subscribe(() => {
      throw new Error('boom');
    });
    session.subscribe(e => {
      ok.push(e);
    });

    // Producer must not throw.
    await expect(session.message({ content: 'hi' })).resolves.toBeDefined();

    expect(ok.some(e => e.type === 'agent_start')).toBe(true);
    expect(ok.some(e => e.type === 'agent_end')).toBe(true);
  });

  it('emits mode_changed and model_changed with previous ids', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.switchMode({ mode: 'other' });
    await session.switchModel({ model: 'gpt-5' });

    const mode = events.find(e => e.type === 'mode_changed');
    const model = events.find(e => e.type === 'model_changed');
    expect(mode).toMatchObject({ type: 'mode_changed', modeId: 'other', previousModeId: 'default' });
    expect(model).toMatchObject({ type: 'model_changed', modelId: 'gpt-5' });
  });

  it('skips mode_changed when the modeId is unchanged', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.switchMode({ mode: 'default' });
    expect(events.find(e => e.type === 'mode_changed')).toBeUndefined();
  });

  it('produces monotonic ids that share a single epoch', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'hi' });

    expect(events.length).toBeGreaterThan(1);
    const epochs = new Set(events.map(e => e.id.split('-').slice(0, 5).join('-')));
    expect(epochs.size).toBe(1);
    const seqs = events.map(e => Number(e.id.split('-').slice(-1)[0]));
    for (let i = 1; i < seqs.length; i += 1) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]!);
    }
  });
});

describe('Session events — fullStream drain', () => {
  it('emits text_delta for each text-delta chunk', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      { type: 'text-delta', payload: { text: 'hel' }, runId: 'fake-run' },
      { type: 'text-delta', payload: { text: 'lo' }, runId: 'fake-run' },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'hi' });

    const deltas = events.filter(e => e.type === 'text_delta');
    expect(deltas.map((e: any) => e.delta)).toEqual(['hel', 'lo']);
  });

  it('emits tool_start and tool_end around a tool-call/tool-result pair', async () => {
    const { harness, agent } = setup();
    agent.chunks = [
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'lookup', args: { q: 'mastra' } },
        runId: 'fake-run',
      },
      {
        type: 'tool-result',
        payload: { toolCallId: 'tc1', result: { hits: 3 } },
        runId: 'fake-run',
      },
    ];
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });
    await session.message({ content: 'hi' });

    const start = events.find(e => e.type === 'tool_start');
    const end = events.find(e => e.type === 'tool_end');
    expect(start).toMatchObject({ type: 'tool_start', toolCallId: 'tc1', toolName: 'lookup' });
    expect(end).toMatchObject({ type: 'tool_end', toolCallId: 'tc1', isError: false });
  });
});

describe('Session events — suspension round-trip', () => {
  it('emits suspension_required on capture and suspension_resolved on resume', async () => {
    const { harness, agent } = setup();
    agent.fullOutput = {
      ...agent.fullOutput,
      finishReason: 'suspended',
      suspendPayload: {
        toolCallId: 'tc1',
        toolName: 'do_thing',
        args: { x: 1 },
      },
    };
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const events: HarnessEvent[] = [];
    session.subscribe(e => {
      events.push(e);
    });

    await session.message({ content: 'do it' });
    expect(events.some(e => e.type === 'suspension_required')).toBe(true);

    // Flip the agent so the resumed run completes.
    agent.fullOutput = { ...agent.fullOutput, finishReason: 'stop', suspendPayload: undefined };

    await session.respondToToolApproval({ approved: true });
    expect(events.some(e => e.type === 'suspension_resolved')).toBe(true);
  });
});

describe('Harness.subscribe()', () => {
  it('delivers session_created when a session is opened', async () => {
    const { harness } = setup();
    const events: HarnessEvent[] = [];
    harness.subscribe(e => {
      events.push(e);
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const created = events.find(e => e.type === 'session_created');
    expect(created).toMatchObject({
      type: 'session_created',
      sessionId: session.id,
      resourceId: 'u1',
      modeId: 'default',
    });
  });

  it('forwards session-level events to harness subscribers without re-stamping', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const sessionEvents: HarnessEvent[] = [];
    const harnessEvents: HarnessEvent[] = [];
    session.subscribe(e => {
      sessionEvents.push(e);
    });
    harness.subscribe(e => {
      harnessEvents.push(e);
    });

    await session.message({ content: 'hi' });

    // Every session-level event reaches the harness subscriber too.
    const sessionStart = sessionEvents.find(e => e.type === 'agent_start');
    const harnessStart = harnessEvents.find(e => e.type === 'agent_start');
    expect(sessionStart).toBeDefined();
    expect(harnessStart).toBeDefined();
    // Forwarded events keep their original id (no double-stamping).
    expect(harnessStart!.id).toBe(sessionStart!.id);
    expect(harnessStart!.sessionId).toBe(session.id);
  });

  it('emits session_closed when a session is closed', async () => {
    const { harness } = setup();
    const events: HarnessEvent[] = [];
    harness.subscribe(e => {
      events.push(e);
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await session.close();

    const closed = events.find(e => e.type === 'session_closed');
    expect(closed).toMatchObject({
      type: 'session_closed',
      sessionId: session.id,
      reason: 'requested',
    });
  });

  it('emits session_evicted on shutdown', async () => {
    const { harness } = setup();
    const events: HarnessEvent[] = [];
    harness.subscribe(e => {
      events.push(e);
    });

    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    await harness.shutdown();

    const evicted = events.find(e => e.type === 'session_evicted');
    expect(evicted).toMatchObject({
      type: 'session_evicted',
      sessionId: session.id,
      reason: 'shutdown',
    });
  });
});
