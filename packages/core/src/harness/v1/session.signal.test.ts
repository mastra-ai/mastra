import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

interface FakeCall {
  messages: unknown;
  options: any;
}

class FakeAgent extends Agent<any, any, any> {
  calls: FakeCall[] = [];
  text = 'ok';
  chunks: unknown[] = [];

  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(messages: unknown, options?: any): Promise<MastraModelOutput> {
    this.calls.push({ messages, options });
    const output = buildOutput({
      runId: options?.runId ?? `${this.id}-run`,
      text: this.text,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
  }
}

function setup() {
  const agent = new FakeAgent('default');
  const other = new FakeAgent('other');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent, other } as any,
    modes: [
      { id: 'default', agentId: 'default' },
      { id: 'other', agentId: 'other', tools: { modeTool: vi.fn() as never } },
    ],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, other };
}

describe('Session.signal()', () => {
  it('admits a user signal and exposes the eventual agent result', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));

    const receipt = await session.signal({ content: 'follow up' });
    const result = await receipt.result;

    expect(receipt).toMatchObject({
      accepted: true,
      willInterleave: false,
      runId: 'default-run',
    });
    expect(receipt.signal).toMatchObject({
      __isCreatedSignal: true,
      type: 'user-message',
      contents: 'follow up',
    });
    expect(result.text).toBe('ok');
    expect(agent.calls[0]!.messages).toBe(receipt.signal);
    expect(events.map(event => event.type)).toEqual(['agent_start', 'agent_end']);
    expect(session.isRunning()).toBe(false);
  });

  it('supports mode and tool overrides on an admitted signal', async () => {
    const { harness, other } = setup();
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    await session.signal({
      content: 'route elsewhere',
      mode: 'other',
      additionalTools: { callTool: vi.fn() as never },
    });

    expect(other.calls).toHaveLength(1);
    expect(Object.keys(other.calls[0]!.options.toolsets)).toEqual(['harness:builtin', 'mode:other', 'call:additional']);
    expect(other.calls[0]!.options.requestContext.get('harness')).toMatchObject({
      sessionId: session.id,
      modeId: 'other',
    });
  });
});

describe('Session.injectSystemReminder()', () => {
  it('dispatches a system-reminder signal with attributes and metadata', async () => {
    const { harness, agent } = setup();
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const receipt = await session.injectSystemReminder('remember the goal', {
      attributes: { reason: 'goal' },
      metadata: { source: 'test' },
    });
    await session.waitForIdle({ timeoutMs: 1000 });

    expect(receipt).toMatchObject({
      accepted: true,
      willInterleave: false,
      runId: 'default-run',
      signal: {
        __isCreatedSignal: true,
        type: 'system-reminder',
        contents: 'remember the goal',
        attributes: { reason: 'goal' },
        metadata: { source: 'test' },
      },
    });
    expect(agent.calls[0]!.messages).toBe(receipt.signal);
  });
});

function buildOutput(opts: { runId: string; text: string; chunks: unknown[] }): MastraModelOutput {
  const fullOutput = {
    text: opts.text,
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
    response: { id: 'response-1', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: opts.runId,
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };
  let finished!: () => void;
  const finishedPromise = new Promise<void>(resolve => {
    finished = resolve;
  });
  const fullStream = (async function* () {
    for (const chunk of opts.chunks) yield chunk;
    finished();
  })();
  return {
    runId: opts.runId,
    getFullOutput: async () => fullOutput,
    fullStream,
    text: Promise.resolve(fullOutput.text),
    finishReason: Promise.resolve(fullOutput.finishReason),
    usage: Promise.resolve(fullOutput.usage),
    _waitUntilFinished: () => finishedPromise,
  } as unknown as MastraModelOutput;
}
