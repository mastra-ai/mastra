import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

interface FakeCall {
  type: 'stream' | 'generate';
  messages: unknown;
  options: any;
}

interface FakeRun {
  text?: string;
  object?: unknown;
  runId?: string;
  traceId?: string;
  chunks?: unknown[];
  holdUntil?: Promise<void>;
}

class FakeAgent extends Agent<any, any, any> {
  calls: FakeCall[] = [];
  nextRun: FakeRun = {};

  constructor(id = 'default') {
    super({
      id,
      name: id,
      instructions: 'fake',
      model: 'openai/gpt-4o-mini' as any,
    });
  }

  async stream(messages: unknown, options?: any): Promise<MastraModelOutput> {
    this.calls.push({ type: 'stream', messages, options });
    const output = buildOutput({
      ...this.nextRun,
      runId: this.nextRun.runId ?? options?.runId ?? 'fake-run',
    });
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
  }

  async generate(messages: unknown, options?: any): Promise<unknown> {
    this.calls.push({ type: 'generate', messages, options });
    return buildFullOutput(this.nextRun);
  }
}

function makeHarness(modes?: any[]) {
  const agent = new FakeAgent('default');
  const other = new FakeAgent('other');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent, other } as any,
    modes: modes ?? [{ id: 'default', agentId: 'default', tools: { baseTool: vi.fn() as never } }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  return { harness, agent, other, storage };
}

describe('Session.message()', () => {
  it('returns the full output and forwards the created signal with memory context', async () => {
    const { harness, agent } = makeHarness();
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const result = await session.message({ content: 'hello' });

    expect(result.text).toBe('ok');
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]).toMatchObject({ type: 'stream' });
    expect(agent.calls[0]!.messages).toMatchObject({
      __isCreatedSignal: true,
      type: 'user-message',
      contents: 'hello',
    });
    expect(agent.calls[0]!.options.memory).toEqual({ thread: session.threadId, resource: 'resource-a' });
  });

  it('applies per-turn mode, model, tools, instructions, and harness request context', async () => {
    const { harness, other } = makeHarness([
      { id: 'default', agentId: 'default' },
      { id: 'other', agentId: 'other', instructions: 'other instructions', tools: { modeTool: vi.fn() as never } },
    ]);
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    await session.message({
      content: 'hello',
      mode: 'other',
      model: 'openai/gpt-4.1',
      additionalTools: { callTool: vi.fn() as never },
    });

    expect(other.calls).toHaveLength(1);
    expect(other.calls[0]!.options.model).toBe('openai/gpt-4.1');
    expect(other.calls[0]!.options.instructions).toBe('other instructions');
    expect(Object.keys(other.calls[0]!.options.toolsets)).toEqual(['harness:builtin', 'mode:other', 'call:additional']);
    expect(other.calls[0]!.options.requestContext.get('harness')).toMatchObject({
      sessionId: session.id,
      threadId: session.threadId,
      resourceId: 'resource-a',
      modeId: 'other',
    });
  });

  it('returns a live stream without waiting for completion', async () => {
    const { harness, agent } = makeHarness();
    let release!: () => void;
    agent.nextRun = {
      holdUntil: new Promise(resolve => {
        release = resolve;
      }),
    };
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const stream = await session.message({ content: 'stream please', stream: true });

    expect(stream.runId).toBe('fake-run');
    expect(session.isRunning()).toBe(true);
    release();
    await session.waitForIdle({ timeoutMs: 1000 });
    expect(session.isRunning()).toBe(false);
  });

  it('runs structured sync messages through generate and returns the typed object', async () => {
    const { harness, agent } = makeHarness();
    agent.nextRun = { object: { answer: 42 } };
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const result = await session.message({
      content: 'structure it',
      output: z.object({ answer: z.number() }),
      sync: true,
    });

    expect(result).toEqual({ answer: 42 });
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]).toMatchObject({ type: 'generate' });
    expect(agent.calls[0]!.options.structuredOutput.schema).toBeDefined();
  });

  it('emits stream chunk events and accumulates token usage', async () => {
    const { harness, agent } = makeHarness();
    agent.nextRun = {
      traceId: 'trace-1',
      chunks: [
        { type: 'text-start', payload: { id: 'msg-1' }, runId: 'run-1' },
        { type: 'text-delta', payload: { id: 'msg-1', text: 'hel' }, runId: 'run-1' },
        { type: 'text-delta', payload: { id: 'msg-1', text: 'lo' }, runId: 'run-1' },
        { type: 'text-end', payload: { id: 'msg-1' }, runId: 'run-1' },
        { type: 'tool-call', payload: { toolCallId: 'tc-1', toolName: 'lookup', args: { q: 'mastra' } } },
        { type: 'tool-result', payload: { toolCallId: 'tc-1', result: { hits: 3 } } },
        { type: 'data-task-updated', data: { tasks: [{ content: 'A', status: 'completed' }] } },
      ],
    };
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));

    await session.message({ content: 'hello' });

    expect(events.map(event => event.type)).toEqual([
      'agent_start',
      'message_start',
      'message_update',
      'message_update',
      'message_end',
      'tool_start',
      'tool_end',
      'task_updated',
      'agent_end',
    ]);
    expect(events.find(event => event.type === 'message_update')).toMatchObject({ delta: 'hel' });
    expect(events.find(event => event.type === 'tool_end')).toMatchObject({ isError: false });
    expect(events.find(event => event.type === 'task_updated')).toMatchObject({
      tasks: [{ content: 'A', status: 'completed' }],
    });
    expect(session.getTokenUsage()).toEqual({ promptTokens: 2, completionTokens: 3, totalTokens: 5 });
    expect(session.getCurrentRunId()).toBe('fake-run');
    expect(session.getCurrentTraceId()).toBe('trace-1');
  });

  it('passes uploaded attachments as file signal parts and verifies metadata', async () => {
    const { harness, agent, storage } = makeHarness();
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
    const attachment = await harness.attachments.upload({
      sessionId: session.id,
      data: new Uint8Array([1, 2, 3]),
      filename: 'clip.mp4',
      contentType: 'video/mp4',
    });

    await session.message({ content: 'use this', attachments: [attachment] });

    expect(agent.calls[0]!.messages).toMatchObject({
      __isCreatedSignal: true,
      contents: [
        { type: 'text', text: 'use this' },
        { type: 'file', mediaType: 'video/mp4', filename: 'clip.mp4' },
      ],
    });
    await expect(
      storage.loadAttachment({ sessionId: session.id, attachmentId: attachment.attachmentId }),
    ).resolves.not.toBeNull();
  });
});

function buildFullOutput(run: FakeRun) {
  return {
    text: run.text ?? 'ok',
    usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    finishReason: 'stop',
    object: run.object,
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
    totalUsage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    error: undefined,
    tripwire: undefined,
    traceId: run.traceId,
    spanId: undefined,
    runId: run.runId ?? 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };
}

function buildOutput(run: FakeRun): MastraModelOutput {
  const fullOutput = buildFullOutput(run);
  let finished!: () => void;
  const finishedPromise = new Promise<void>(resolve => {
    finished = resolve;
  });
  const chunks = run.chunks ?? [];
  const fullStream = (async function* () {
    for (const chunk of chunks) yield chunk;
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
    object: Promise.resolve(fullOutput.object),
    _waitUntilFinished: () => finishedPromise,
  } as unknown as MastraModelOutput;
}
