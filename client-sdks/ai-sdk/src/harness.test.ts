import { defaultDisplayState } from '@mastra/core/harness';
import type { HarnessDisplayState, HarnessDisplayStateListener, HarnessMessage } from '@mastra/core/harness';
import { describe, expect, it } from 'vitest';

import { harnessToUIMessageStream } from './harness';
import type { HarnessUIMessageStreamChunk, HarnessUISnapshotDataPart } from './harness';

class FakeHarness {
  state: HarnessDisplayState;
  listeners = new Set<HarnessDisplayStateListener>();
  options: { windowMs?: number; maxWaitMs?: number } | undefined;
  unsubscribed = false;
  subscribeCalls = 0;
  currentRunId: string | null = null;

  constructor(state: HarnessDisplayState) {
    this.state = state;
  }

  getDisplayState(): Readonly<HarnessDisplayState> {
    return this.state;
  }

  getCurrentRunId(): string | null {
    return this.currentRunId;
  }

  subscribeDisplayState(
    listener: HarnessDisplayStateListener,
    options?: { windowMs?: number; maxWaitMs?: number },
  ): () => void {
    this.options = options;
    this.subscribeCalls += 1;
    this.listeners.add(listener);
    return () => {
      this.unsubscribed = true;
      this.listeners.delete(listener);
    };
  }

  emit(state: HarnessDisplayState): void {
    this.state = state;
    for (const listener of this.listeners) {
      void listener(state);
    }
  }
}

function createState(
  overrides: Partial<HarnessDisplayState> & {
    message?: {
      id?: string;
      text?: string;
      reasoning?: string;
    };
  } = {},
): HarnessDisplayState {
  const { message, ...stateOverrides } = overrides;
  const state = defaultDisplayState();

  Object.assign(state, stateOverrides);

  if (message) {
    const content: HarnessMessage['content'] = [];
    if (message.reasoning !== undefined) {
      content.push({ type: 'thinking', thinking: message.reasoning });
    }
    if (message.text !== undefined) {
      content.push({ type: 'text', text: message.text });
    }
    state.currentMessage = {
      id: message.id ?? 'message-1',
      role: 'assistant',
      content,
      createdAt: new Date('2026-05-01T12:00:00.000Z'),
    };
  }

  return state;
}

async function readChunk(
  reader: ReadableStreamDefaultReader<HarnessUIMessageStreamChunk>,
): Promise<HarnessUIMessageStreamChunk> {
  const result = await reader.read();
  expect(result.done).toBe(false);
  return result.value;
}

async function readChunks(
  reader: ReadableStreamDefaultReader<HarnessUIMessageStreamChunk>,
  count: number,
): Promise<HarnessUIMessageStreamChunk[]> {
  const chunks: HarnessUIMessageStreamChunk[] = [];
  for (let i = 0; i < count; i++) {
    chunks.push(await readChunk(reader));
  }
  return chunks;
}

function expectSnapshot(chunk: HarnessUIMessageStreamChunk): HarnessUISnapshotDataPart {
  expect(chunk.type).toBe('data-mastra-harness-snapshot');
  return chunk as HarnessUISnapshotDataPart;
}

async function expectNoImmediateChunk(reader: ReadableStreamDefaultReader<HarnessUIMessageStreamChunk>): Promise<void> {
  const result = await Promise.race([
    reader.read().then(() => 'chunk' as const),
    new Promise<'none'>(resolve => setTimeout(() => resolve('none'), 10)),
  ]);
  expect(result).toBe('none');
}

describe('harnessToUIMessageStream', () => {
  it('emits the initial getDisplayState snapshot before subscription updates', async () => {
    const harness = new FakeHarness(createState({ isRunning: true, message: { id: 'm1', text: 'Hello' } }));
    const stream = harnessToUIMessageStream(harness);
    const reader = stream.getReader();

    const initial = await readChunks(reader, 4);
    expect(initial).toMatchObject([
      { type: 'start', messageId: 'm1' },
      { type: 'text-start', id: 'm1:text' },
      { type: 'text-delta', id: 'm1:text', delta: 'Hello' },
      {
        type: 'data-mastra-harness-snapshot',
        id: 'mastra-harness:snapshot',
        data: { sequence: 1, messageId: 'm1' },
      },
    ]);

    harness.emit(createState({ isRunning: true, message: { id: 'm1', text: 'Hello world' } }));

    const update = await readChunks(reader, 2);
    expect(update).toMatchObject([
      { type: 'text-delta', id: 'm1:text', delta: ' world' },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 2, currentMessage: { text: 'Hello world' } } },
    ]);

    await reader.cancel();
  });

  it('passes coalescing options through and emits one snapshot for each harness callback', async () => {
    const harness = new FakeHarness(createState({ isRunning: true }));
    const stream = harnessToUIMessageStream(harness, {
      include: ['usage'],
      windowMs: 123,
      maxWaitMs: 456,
    });
    const reader = stream.getReader();

    expect(harness.options).toEqual({ windowMs: 123, maxWaitMs: 456 });

    await readChunks(reader, 2);

    harness.emit(
      createState({ isRunning: true, tokenUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } }),
    );
    harness.emit(
      createState({ isRunning: true, tokenUsage: { promptTokens: 2, completionTokens: 4, totalTokens: 6 } }),
    );

    const first = expectSnapshot(await readChunk(reader));
    const second = expectSnapshot(await readChunk(reader));
    expect(first.data.sequence).toBe(2);
    expect(second.data.sequence).toBe(3);
    expect(second.data.domains.usage).toEqual({ promptTokens: 2, completionTokens: 4, totalTokens: 6 });

    await reader.cancel();
  });

  it('filters domains and message content with include', async () => {
    const state = createState({
      isRunning: false,
      message: { id: 'm1', text: 'Hidden text' },
      pendingApproval: { toolCallId: 'call-1', toolName: 'write_file', args: { path: 'a.ts' } },
    });
    const harness = new FakeHarness(state);
    const reader = harnessToUIMessageStream(harness, { include: ['hitl'] }).getReader();

    const chunks = await readChunks(reader, 4);
    expect(chunks[0]).toEqual({ type: 'start', messageId: 'm1' });
    expect(chunks[1]).toEqual({
      type: 'tool-approval-request',
      approvalId: 'call-1',
      toolCallId: 'call-1',
    });
    const snapshot = expectSnapshot(chunks[2]);
    expect(snapshot.data.domains).toEqual({
      hitl: {
        approval: { toolCallId: 'call-1', toolName: 'write_file', args: { path: 'a.ts' } },
        suspension: null,
        question: null,
        planApproval: null,
      },
    });
    expect(snapshot.data.currentMessage?.text).toBeUndefined();
    expect(snapshot.data.currentMessage?.content).toEqual([]);
    expect(chunks[3]).toEqual({ type: 'finish' });
  });

  it('emits native AI SDK approval requests once from pending HITL approval state', async () => {
    const state = createState({
      isRunning: true,
      pendingApproval: { toolCallId: 'call-1', toolName: 'write_file', args: { path: 'a.ts' } },
    });
    const harness = new FakeHarness(state);
    harness.currentRunId = 'run-123';
    const reader = harnessToUIMessageStream(harness, { include: ['hitl'], sendStart: false }).getReader();

    expect(await readChunks(reader, 2)).toMatchObject([
      {
        type: 'tool-approval-request',
        approvalId: 'run-123::call-1',
        toolCallId: 'call-1',
      },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 1 } },
    ]);

    harness.emit(state);
    expect(await readChunk(reader)).toMatchObject({
      type: 'data-mastra-harness-snapshot',
      data: { sequence: 2 },
    });

    harness.emit(createState({ isRunning: true }));
    expect(await readChunk(reader)).toMatchObject({
      type: 'data-mastra-harness-snapshot',
      data: { sequence: 3 },
    });

    harness.emit(
      createState({
        isRunning: true,
        pendingApproval: { toolCallId: 'call-1', toolName: 'write_file', args: { path: 'a.ts' } },
      }),
    );
    expect(await readChunks(reader, 2)).toMatchObject([
      {
        type: 'tool-approval-request',
        approvalId: 'run-123::call-1',
        toolCallId: 'call-1',
      },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 4 } },
    ]);

    await reader.cancel();
  });

  it('emits native plan approval request data once from pending HITL plan state', async () => {
    const state = createState({
      isRunning: true,
      pendingPlanApproval: {
        planId: 'plan-1',
        title: 'Implementation Plan',
        plan: '# Plan\n\n1. Build it.',
      },
    });
    const harness = new FakeHarness(state);
    harness.currentRunId = 'run-123';
    const reader = harnessToUIMessageStream(harness, { include: ['hitl'], sendStart: false }).getReader();

    expect(await readChunks(reader, 2)).toMatchObject([
      {
        type: 'data-mastra-plan-approval-request',
        id: 'run-123::plan-1',
        data: {
          approvalId: 'run-123::plan-1',
          planId: 'plan-1',
          title: 'Implementation Plan',
          plan: '# Plan\n\n1. Build it.',
        },
      },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 1 } },
    ]);

    harness.emit(state);
    expect(await readChunk(reader)).toMatchObject({
      type: 'data-mastra-harness-snapshot',
      data: { sequence: 2 },
    });

    harness.emit(createState({ isRunning: true }));
    expect(await readChunk(reader)).toMatchObject({
      type: 'data-mastra-harness-snapshot',
      data: { sequence: 3 },
    });

    harness.emit(
      createState({
        isRunning: true,
        pendingPlanApproval: {
          planId: 'plan-1',
          title: 'Implementation Plan',
          plan: '# Plan\n\n1. Build it.',
        },
      }),
    );
    expect(await readChunks(reader, 2)).toMatchObject([
      {
        type: 'data-mastra-plan-approval-request',
        id: 'run-123::plan-1',
        data: {
          approvalId: 'run-123::plan-1',
          planId: 'plan-1',
        },
      },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 4 } },
    ]);

    await reader.cancel();
  });

  it('represents HITL state appearing and clearing in replacing snapshots', async () => {
    const harness = new FakeHarness(createState({ isRunning: true }));
    const reader = harnessToUIMessageStream(harness, { include: ['hitl'], sendStart: false }).getReader();

    expectSnapshot(await readChunk(reader));

    harness.emit(
      createState({
        isRunning: true,
        pendingQuestion: {
          questionId: 'q1',
          question: 'Proceed?',
          options: [{ label: 'Yes' }],
          selectionMode: 'single_select',
        },
      }),
    );
    const pending = expectSnapshot(await readChunk(reader));
    expect(pending.data.domains.hitl).toMatchObject({
      question: { questionId: 'q1', question: 'Proceed?' },
    });

    harness.emit(createState({ isRunning: true }));
    const cleared = expectSnapshot(await readChunk(reader));
    expect(cleared.data.domains.hitl).toMatchObject({
      approval: null,
      suspension: null,
      question: null,
      planApproval: null,
    });

    await reader.cancel();
  });

  it('emits native AI SDK tool lifecycle chunks from display-state snapshots', async () => {
    const initial = createState({ isRunning: true });
    initial.activeTools.set('tool-1', { name: 'write_file', args: {}, status: 'streaming_input' });
    initial.toolInputBuffers.set('tool-1', { toolName: 'write_file', text: '{"path"' });

    const harness = new FakeHarness(initial);
    const reader = harnessToUIMessageStream(harness, { include: ['tools'], sendStart: false }).getReader();

    expect(await readChunks(reader, 3)).toMatchObject([
      { type: 'tool-input-start', toolCallId: 'tool-1', toolName: 'write_file' },
      { type: 'tool-input-delta', toolCallId: 'tool-1', inputTextDelta: '{"path"' },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 1 } },
    ]);

    const running = createState({ isRunning: true });
    running.activeTools.set('tool-1', {
      name: 'write_file',
      args: { path: 'src/app.ts', content: 'hello' },
      status: 'running',
    });
    harness.emit(running);

    expect(await readChunks(reader, 2)).toMatchObject([
      {
        type: 'tool-input-available',
        toolCallId: 'tool-1',
        toolName: 'write_file',
        input: { path: 'src/app.ts', content: 'hello' },
      },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 2 } },
    ]);

    const completed = createState({ isRunning: true });
    completed.activeTools.set('tool-1', {
      name: 'write_file',
      args: { path: 'src/app.ts', content: 'hello' },
      status: 'completed',
      result: { ok: true },
      isError: false,
    });
    harness.emit(completed);

    expect(await readChunks(reader, 2)).toMatchObject([
      { type: 'tool-output-available', toolCallId: 'tool-1', output: { ok: true } },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 3 } },
    ]);

    harness.emit(completed);

    expect(await readChunk(reader)).toMatchObject({
      type: 'data-mastra-harness-snapshot',
      data: { sequence: 4 },
    });

    await reader.cancel();
  });

  it('emits native AI SDK tool error chunks once', async () => {
    const state = createState({ isRunning: true });
    state.activeTools.set('tool-1', {
      name: 'read_file',
      args: { path: 'missing.ts' },
      status: 'error',
      result: new Error('not found'),
      isError: true,
    });

    const harness = new FakeHarness(state);
    const reader = harnessToUIMessageStream(harness, {
      include: ['tools'],
      sendStart: false,
    }).getReader();

    expect(await readChunks(reader, 3)).toMatchObject([
      {
        type: 'tool-input-available',
        toolCallId: 'tool-1',
        toolName: 'read_file',
        input: { path: 'missing.ts' },
      },
      { type: 'tool-output-error', toolCallId: 'tool-1', errorText: 'not found' },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 1 } },
    ]);

    const repeated = createState({ isRunning: true });
    repeated.activeTools.set('tool-1', {
      name: 'read_file',
      args: { path: 'missing.ts' },
      status: 'error',
      result: new Error('not found'),
      isError: true,
    });
    harness.emit(repeated);

    expect(await readChunk(reader)).toMatchObject({
      type: 'data-mastra-harness-snapshot',
      data: { sequence: 2 },
    });
  });

  it('supports delta mode with an initial snapshot and append-only changed-domain parts', async () => {
    const harness = new FakeHarness(
      createState({ isRunning: true, tokenUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );
    const reader = harnessToUIMessageStream(harness, {
      mode: 'delta',
      include: ['usage'],
      sendStart: false,
    }).getReader();

    const initial = expectSnapshot(await readChunk(reader));
    expect(initial.data).toMatchObject({
      mode: 'snapshot',
      sequence: 1,
      domains: { usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
    });

    harness.emit(
      createState({ isRunning: true, tokenUsage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } }),
    );
    const delta = await readChunk(reader);
    expect(delta).toEqual({
      type: 'data-mastra-harness-delta',
      id: 'mastra-harness:delta:2',
      data: {
        version: 1,
        sequence: 2,
        emittedAt: expect.any(String),
        mode: 'delta',
        messageId: 'mastra-harness',
        domains: { usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } },
      },
    });

    await reader.cancel();
  });

  it('emits null clears in delta mode', async () => {
    const harness = new FakeHarness(
      createState({
        isRunning: true,
        pendingQuestion: {
          questionId: 'q1',
          question: 'Proceed?',
        },
      }),
    );
    const reader = harnessToUIMessageStream(harness, {
      mode: 'delta',
      include: ['hitl'],
      sendStart: false,
    }).getReader();

    expectSnapshot(await readChunk(reader));

    harness.emit(createState({ isRunning: true }));
    const delta = await readChunk(reader);

    expect(delta).toMatchObject({
      type: 'data-mastra-harness-delta',
      data: {
        domains: {
          hitl: {
            approval: null,
            suspension: null,
            question: null,
            planApproval: null,
          },
        },
      },
    });

    await reader.cancel();
  });

  it('suppresses no-op display-state deltas', async () => {
    const state = createState({
      isRunning: true,
      tokenUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
    const harness = new FakeHarness(state);
    const reader = harnessToUIMessageStream(harness, {
      mode: 'delta',
      include: ['usage'],
      sendStart: false,
    }).getReader();

    expectSnapshot(await readChunk(reader));
    harness.emit(
      createState({ isRunning: true, tokenUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    );

    await expectNoImmediateChunk(reader);
    await reader.cancel();
  });

  it('does not emit invalid text replacement chunks for same-message shrink in delta mode', async () => {
    const harness = new FakeHarness(createState({ isRunning: true, message: { id: 'm1', text: 'abcdef' } }));
    const reader = harnessToUIMessageStream(harness, {
      mode: 'delta',
      include: ['text'],
      sendStart: false,
    }).getReader();

    expect(await readChunks(reader, 3)).toMatchObject([
      { type: 'text-start', id: 'm1:text' },
      { type: 'text-delta', id: 'm1:text', delta: 'abcdef' },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 1 } },
    ]);

    harness.emit(createState({ isRunning: true, message: { id: 'm1', text: 'abc' } }));

    expect(await readChunk(reader)).toMatchObject({
      type: 'data-mastra-harness-delta',
      data: {
        sequence: 2,
        currentMessage: { text: 'abc' },
      },
    });

    await reader.cancel();
  });

  it('closes old text and starts new text when message id changes in delta mode', async () => {
    const harness = new FakeHarness(createState({ isRunning: true, message: { id: 'm1', text: 'First' } }));
    const reader = harnessToUIMessageStream(harness, {
      mode: 'delta',
      include: ['text'],
      sendStart: false,
    }).getReader();

    await readChunks(reader, 3);
    harness.emit(createState({ isRunning: true, message: { id: 'm2', text: 'Second' } }));

    expect(await readChunks(reader, 4)).toMatchObject([
      { type: 'text-end', id: 'm1:text' },
      { type: 'text-start', id: 'm2:text' },
      { type: 'text-delta', id: 'm2:text', delta: 'Second' },
      {
        type: 'data-mastra-harness-delta',
        data: { sequence: 2, messageId: 'm2', currentMessage: { text: 'Second' } },
      },
    ]);

    await reader.cancel();
  });

  it('serializes maps, sets, dates, errors, bigints, shared objects, and circular values safely', async () => {
    const circular: Record<string, unknown> = { ok: true };
    circular.self = circular;
    const shared = { id: 'shared' };
    const state = createState({ isRunning: false });
    state.activeTools.set('tool-1', {
      name: 'inspect',
      args: {
        circular,
        sharedA: shared,
        sharedB: shared,
        createdAt: new Date('2026-05-01T12:34:56.000Z'),
        ids: new Set(['a', 'b']),
        count: 1n,
        error: new Error('boom'),
      },
      status: 'running',
    });
    state.modifiedFiles.set('src/app.ts', {
      operations: ['write_file'],
      firstModified: new Date('2026-05-01T00:00:00.000Z'),
    });

    const reader = harnessToUIMessageStream(new FakeHarness(state), {
      include: ['tools', 'files'],
      sendStart: false,
      sendFinish: false,
    }).getReader();
    const [, snapshotChunk] = await readChunks(reader, 2);
    const snapshot = expectSnapshot(snapshotChunk);

    expect(snapshot.data.domains.tools).toMatchObject({
      active: {
        'tool-1': {
          args: {
            circular: { ok: true, self: '[Circular]' },
            sharedA: { id: 'shared' },
            sharedB: { id: 'shared' },
            createdAt: '2026-05-01T12:34:56.000Z',
            ids: ['a', 'b'],
            count: '1',
            error: { name: 'Error', message: 'boom' },
          },
        },
      },
    });
    expect(snapshot.data.domains.files).toEqual({
      'src/app.ts': {
        operations: ['write_file'],
        firstModified: '2026-05-01T00:00:00.000Z',
      },
    });
  });

  it('closes text and reasoning parts, unsubscribes, and finishes on terminal state', async () => {
    const harness = new FakeHarness(
      createState({ isRunning: true, message: { id: 'm1', text: 'Hello', reasoning: 'Thinking' } }),
    );
    const reader = harnessToUIMessageStream(harness).getReader();

    await readChunks(reader, 6);
    harness.emit(createState({ isRunning: false, message: { id: 'm1', text: 'Hello', reasoning: 'Thinking done' } }));

    const terminal = await readChunks(reader, 5);
    expect(terminal).toMatchObject([
      { type: 'reasoning-delta', id: 'm1:reasoning', delta: ' done' },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 2, isRunning: false } },
      { type: 'text-end', id: 'm1:text' },
      { type: 'reasoning-end', id: 'm1:reasoning' },
      { type: 'finish' },
    ]);

    const done = await reader.read();
    expect(done.done).toBe(true);
    expect(harness.unsubscribed).toBe(true);
  });

  it('rehydrates reconnects from the latest display state with stable replacing snapshot identity', async () => {
    const harness = new FakeHarness(createState({ isRunning: true, message: { id: 'm1', text: 'Initial' } }));

    const firstReader = harnessToUIMessageStream(harness, { include: ['text'] }).getReader();
    await readChunks(firstReader, 4);
    await firstReader.cancel();

    harness.state = createState({ isRunning: true, message: { id: 'm1', text: 'Recovered text' } });
    const secondReader = harnessToUIMessageStream(harness, { include: ['text'] }).getReader();
    const chunks = await readChunks(secondReader, 4);

    expect(chunks).toMatchObject([
      { type: 'start', messageId: 'm1' },
      { type: 'text-start', id: 'm1:text' },
      { type: 'text-delta', id: 'm1:text', delta: 'Recovered text' },
      {
        type: 'data-mastra-harness-snapshot',
        id: 'mastra-harness:snapshot',
        data: { sequence: 1, currentMessage: { text: 'Recovered text' } },
      },
    ]);

    await secondReader.cancel();
  });

  it('does not let late updates reach a canceled superseded stream', async () => {
    const harness = new FakeHarness(createState({ isRunning: true, message: { id: 'old', text: 'Old run' } }));
    const oldReader = harnessToUIMessageStream(harness, { include: ['text'] }).getReader();

    await readChunks(oldReader, 4);
    await oldReader.cancel();

    harness.state = createState({ isRunning: true, message: { id: 'new', text: 'New run' } });
    const newReader = harnessToUIMessageStream(harness, { include: ['text'] }).getReader();
    await readChunks(newReader, 4);

    harness.emit(createState({ isRunning: false, message: { id: 'old', text: 'Old terminal' } }));

    await expect(oldReader.read()).resolves.toEqual({ done: true, value: undefined });

    await newReader.cancel();
  });

  it('restarts text chunks when text shrinks or the message id changes', async () => {
    const harness = new FakeHarness(createState({ isRunning: true, message: { id: 'm1', text: 'abcdef' } }));
    const reader = harnessToUIMessageStream(harness).getReader();

    await readChunks(reader, 4);
    harness.emit(createState({ isRunning: true, message: { id: 'm1', text: 'abc' } }));

    const reset = await readChunks(reader, 4);
    expect(reset).toMatchObject([
      { type: 'text-end', id: 'm1:text' },
      { type: 'text-start', id: 'm1:text' },
      { type: 'text-delta', id: 'm1:text', delta: 'abc' },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 2 } },
    ]);

    harness.emit(createState({ isRunning: true, message: { id: 'm2', text: 'abc' } }));
    const newMessage = await readChunks(reader, 4);
    expect(newMessage).toMatchObject([
      { type: 'text-end', id: 'm1:text' },
      { type: 'text-start', id: 'm2:text' },
      { type: 'text-delta', id: 'm2:text', delta: 'abc' },
      { type: 'data-mastra-harness-snapshot', data: { sequence: 3, messageId: 'm2' } },
    ]);

    await reader.cancel();
  });

  it('unsubscribes when the consumer cancels the stream', async () => {
    const harness = new FakeHarness(createState({ isRunning: true }));
    const reader = harnessToUIMessageStream(harness, { include: ['usage'] }).getReader();

    await readChunks(reader, 2);
    await reader.cancel();

    expect(harness.unsubscribed).toBe(true);
  });

  it('includes terminal subagent history when the Harness display state provides it', async () => {
    const state = createState({ isRunning: false }) as HarnessDisplayState & {
      subagentHistory: Array<{
        toolCallId: string;
        agentType: string;
        task: string;
        toolCalls: Array<{ name: string; isError: boolean }>;
        textDelta: string;
        status: 'completed' | 'error' | 'aborted';
        endedAt: Date;
        order: number;
      }>;
    };
    state.subagentHistory = [
      {
        toolCallId: 'subagent-1',
        agentType: 'research',
        task: 'Find papers',
        toolCalls: [{ name: 'search', isError: false }],
        textDelta: 'done',
        status: 'completed',
        endedAt: new Date('2026-05-01T13:00:00.000Z'),
        order: 0,
      },
    ];

    const reader = harnessToUIMessageStream(new FakeHarness(state), {
      include: ['subagents'],
      sendStart: false,
      sendFinish: false,
    }).getReader();

    const snapshot = expectSnapshot(await readChunk(reader));
    expect(snapshot.data.domains.subagents).toEqual({
      active: {},
      history: [
        {
          toolCallId: 'subagent-1',
          agentType: 'research',
          task: 'Find papers',
          toolCalls: [{ name: 'search', isError: false }],
          textDelta: 'done',
          status: 'completed',
          endedAt: '2026-05-01T13:00:00.000Z',
          order: 0,
        },
      ],
    });
  });

  it('errors the stream and unsubscribes when mapping fails after subscription', async () => {
    const harness = new FakeHarness(createState({ isRunning: true }));
    const reader = harnessToUIMessageStream(harness, {
      include: ['usage'],
      messageId: state => {
        if (state.currentMessage?.id === 'boom') {
          throw new Error('message id failed');
        }
        return 'ok';
      },
    }).getReader();

    await readChunks(reader, 2);
    harness.emit(createState({ isRunning: true, message: { id: 'boom', text: 'bad' } }));

    await expect(reader.read()).rejects.toThrow('message id failed');
    expect(harness.unsubscribed).toBe(true);
  });
});
