import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';
import { HarnessAdmissionConflictError, HarnessQueueFullError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

interface FakeCall {
  messages: unknown;
  options: any;
}

interface FakeRun {
  text?: string;
  runId?: string;
  chunks?: unknown[];
  holdUntil?: Promise<void>;
}

class FakeAgent extends Agent<any, any, any> {
  calls: FakeCall[] = [];
  runs: FakeRun[] = [];

  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  enqueueRun(run: FakeRun): void {
    this.runs.push(run);
  }

  async stream(messages: unknown, options?: any): Promise<MastraModelOutput> {
    this.calls.push({ messages, options });
    const run = this.runs.shift() ?? {};
    const output = buildOutput({
      ...run,
      runId: run.runId ?? options?.runId ?? `${this.id}-run-${this.calls.length}`,
    });
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
  }
}

function setup(opts?: { maxQueueDepth?: number }) {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage, ...(opts?.maxQueueDepth !== undefined ? { maxQueueDepth: opts.maxQueueDepth } : {}) },
  });
  return { harness, agent, storage };
}

describe('Session.queue()', () => {
  it('appends a queued turn, drains it, and resolves with the agent result', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({ text: 'queued reply' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const result = await session.queue({ content: 'do work' });

    expect(result.text).toBe('queued reply');
    expect(agent.calls).toHaveLength(1);
    expect(agent.calls[0]!.messages).toMatchObject({
      __isCreatedSignal: true,
      type: 'user-message',
      contents: 'do work',
    });
    expect(session.getQueueDepth()).toBe(0);
    expect(session.getRecord().pendingQueue).toEqual([]);
  });

  it('drains queued turns in FIFO order', async () => {
    const { harness, agent } = setup();
    let releaseFirst!: () => void;
    agent.enqueueRun({
      text: 'first reply',
      holdUntil: new Promise(resolve => {
        releaseFirst = resolve;
      }),
    });
    agent.enqueueRun({ text: 'second reply' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const first = session.queue({ content: 'first' });
    await new Promise(resolve => setImmediate(resolve));
    const second = session.queue({ content: 'second' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getQueueDepth()).toBe(2);
    expect(agent.calls).toHaveLength(1);
    releaseFirst();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.text).toBe('first reply');
    expect(secondResult.text).toBe('second reply');
    expect(agent.calls).toHaveLength(2);
    expect(extractSignalContents(agent.calls[0]!.messages)).toBe('first');
    expect(extractSignalContents(agent.calls[1]!.messages)).toBe('second');
    expect(session.getQueueDepth()).toBe(0);
  });

  it('rejects admission when pendingQueue reaches maxQueueDepth', async () => {
    const { harness, agent } = setup({ maxQueueDepth: 1 });
    let releaseFirst!: () => void;
    agent.enqueueRun({
      text: 'first reply',
      holdUntil: new Promise(resolve => {
        releaseFirst = resolve;
      }),
    });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const first = session.queue({ content: 'first' });
    await new Promise(resolve => setImmediate(resolve));

    await expect(session.queue({ content: 'second' })).rejects.toBeInstanceOf(HarnessQueueFullError);
    releaseFirst();
    await first;
  });

  it('dedupes exact admissionId retries without appending a second item', async () => {
    const { harness, agent } = setup();
    let release!: () => void;
    agent.enqueueRun({
      text: 'queued reply',
      holdUntil: new Promise(resolve => {
        release = resolve;
      }),
    });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const first = session.queue({ content: 'do work', admissionId: 'queue-1' });
    await new Promise(resolve => setImmediate(resolve));
    const second = session.queue({ content: 'do work', admissionId: 'queue-1' });

    expect(session.getRecord().pendingQueue).toHaveLength(1);
    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.text).toBe('queued reply');
    expect(secondResult.text).toBe('queued reply');
    expect(agent.calls).toHaveLength(1);
    expect(Object.values(session.getRecord().queueAdmissionReceipts ?? {})[0]).toMatchObject({
      admissionId: 'queue-1',
      status: 'completed',
      result: expect.objectContaining({ text: 'queued reply' }),
    });
  });

  it('rejects conflicting admissionId retries', async () => {
    const { harness, agent } = setup();
    let release!: () => void;
    agent.enqueueRun({
      text: 'queued reply',
      holdUntil: new Promise(resolve => {
        release = resolve;
      }),
    });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const first = session.queue({ content: 'do work', admissionId: 'queue-conflict' });
    await new Promise(resolve => setImmediate(resolve));

    await expect(session.queue({ content: 'different work', admissionId: 'queue-conflict' })).rejects.toBeInstanceOf(
      HarnessAdmissionConflictError,
    );
    release();
    await first;
  });

  it('admits remote queue items and emits queued turn events with queuedItemId', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      text: 'queued reply',
      chunks: [
        { type: 'text-start', payload: { id: 'msg-1' } },
        { type: 'text-delta', payload: { id: 'msg-1', text: 'hi' } },
        { type: 'text-end', payload: { id: 'msg-1' } },
      ],
    });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));

    const admitted = await session.admitQueue({ content: 'do work', admissionId: 'queue-admit-1' });
    const duplicate = await session.admitQueue({ content: 'do work', admissionId: 'queue-admit-1' });
    await session.waitForIdle({ timeoutMs: 1000 });

    expect(duplicate).toEqual({ accepted: true, queuedItemId: admitted.queuedItemId, duplicate: true });
    expect(events.find(event => event.type === 'queue_item_started')).toMatchObject({
      queuedItemId: admitted.queuedItemId,
    });
    expect(events.filter(event => event.type !== 'queue_item_started')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'agent_start', queuedItemId: admitted.queuedItemId }),
        expect.objectContaining({ type: 'message_update', queuedItemId: admitted.queuedItemId, delta: 'hi' }),
        expect.objectContaining({ type: 'agent_end', queuedItemId: admitted.queuedItemId }),
      ]),
    );
  });

  it('persists queued attachment references and replays them into the message signal', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({ text: 'queued reply' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
    const attachment = await harness.attachments.upload({
      sessionId: session.id,
      data: new Uint8Array([1, 2, 3]),
      filename: 'clip.mp4',
      contentType: 'video/mp4',
    });

    await session.queue({ content: 'use this', attachments: [attachment] });

    expect(agent.calls[0]!.messages).toMatchObject({
      __isCreatedSignal: true,
      contents: [
        { type: 'text', text: 'use this' },
        { type: 'file', mediaType: 'video/mp4', filename: 'clip.mp4' },
      ],
    });
  });
});

function buildOutput(run: FakeRun): MastraModelOutput {
  const fullOutput = {
    text: run.text ?? 'ok',
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
    runId: run.runId ?? 'fake-run',
    suspendPayload: undefined,
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

function extractSignalContents(messages: unknown): unknown {
  if (!messages || typeof messages !== 'object') return undefined;
  return (messages as { contents?: unknown }).contents;
}
