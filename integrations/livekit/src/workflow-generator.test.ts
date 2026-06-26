import type { ReadableStream } from 'node:stream/web';
import { llm } from '@livekit/agents';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceTurnContext } from './bridge';
import { createWorkflowReplyGenerator, unwrapStepText } from './workflow-generator';

interface FakeChunk {
  type: string;
  payload?: Record<string, unknown>;
}

/**
 * Builds a fake Mastra workflow whose run streams `chunks` from `run.stream().fullStream` and
 * resolves `run.stream().result` to `result`. `park` keeps the stream open after the last chunk
 * so cancellation can be exercised; `throwError` makes the fullStream throw after the chunks.
 */
function fakeWorkflow(chunks: FakeChunk[], opts: { result?: unknown; park?: boolean; throwError?: Error } = {}) {
  const cancel = vi.fn(async () => {});
  const stream = vi.fn((_args: { inputData: unknown; tracingContext?: unknown }) => ({
    fullStream: (async function* () {
      for (const chunk of chunks) yield chunk;
      if (opts.throwError) throw opts.throwError;
      if (opts.park) await new Promise<void>(() => {});
    })(),
    result: Promise.resolve(opts.result),
  }));
  const createRun = vi.fn(async () => ({ stream, cancel }));
  const workflow = { id: 'wf', createRun } as unknown as Parameters<typeof createWorkflowReplyGenerator>[0]['workflow'];
  return { workflow, createRun, stream, cancel };
}

function turnContext(overrides: Partial<VoiceTurnContext> = {}): VoiceTurnContext {
  return {
    messages: [{ role: 'user', content: 'hi' }],
    chatCtx: llm.ChatContext.empty(),
    memory: false,
    ...overrides,
  };
}

async function readAll(stream: ReadableStream<string>): Promise<string[]> {
  const reader = stream.getReader();
  const out: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

const stepOutput = (output: unknown, stepName = 'generateResponse'): FakeChunk => ({
  type: 'workflow-step-output',
  payload: { output, stepName },
});

describe('unwrapStepText', () => {
  it('returns plain string output (writer.pipeTo)', () => {
    expect(unwrapStepText('hello')).toBe('hello');
  });

  it('unwraps a text-delta chunk (createStep(agent))', () => {
    expect(unwrapStepText({ type: 'text-delta', payload: { text: 'world' } })).toBe('world');
  });

  it('returns undefined for unrelated shapes', () => {
    expect(unwrapStepText({ type: 'tool-call', payload: {} })).toBeUndefined();
    expect(unwrapStepText(42)).toBeUndefined();
    expect(unwrapStepText(undefined)).toBeUndefined();
  });
});

describe('createWorkflowReplyGenerator', () => {
  it('streams text from string step outputs and ignores non-text events', async () => {
    const { workflow, stream } = fakeWorkflow([
      { type: 'workflow-start' },
      stepOutput('Hello '),
      { type: 'workflow-step-result', payload: { output: { assistantMessage: 'Hello world' } } },
      stepOutput('world'),
      { type: 'workflow-finish' },
    ]);
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({ x: 1 }) });
    const result = await generate(turnContext());
    expect(await readAll(result!)).toEqual(['Hello ', 'world']);
    // input mapping reached run.stream
    expect(stream).toHaveBeenCalledWith(expect.objectContaining({ inputData: { x: 1 } }));
  });

  it('unwraps text-delta step outputs (agent-as-step)', async () => {
    const { workflow } = fakeWorkflow([
      stepOutput({ type: 'text-delta', payload: { text: 'Hi ' } }),
      stepOutput({ type: 'text-delta', payload: { text: 'there' } }),
    ]);
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}) });
    const result = await generate(turnContext());
    expect(await readAll(result!)).toEqual(['Hi ', 'there']);
  });

  it('filters to replyStep when set', async () => {
    const { workflow } = fakeWorkflow([
      stepOutput('thinking…', 'classifyIntent'),
      stepOutput('The answer ', 'generateResponse'),
      stepOutput('is 42', 'generateResponse'),
    ]);
    const generate = createWorkflowReplyGenerator({
      workflow,
      workflowInput: () => ({}),
      replyStep: 'generateResponse',
    });
    const result = await generate(turnContext());
    expect(await readAll(result!)).toEqual(['The answer ', 'is 42']);
  });

  it('falls back to resultText when the workflow streams no text', async () => {
    const { workflow } = fakeWorkflow([{ type: 'workflow-step-result', payload: {} }], {
      result: { status: 'success', result: { assistantMessage: 'From the result' } },
    });
    const generate = createWorkflowReplyGenerator({
      workflow,
      workflowInput: () => ({}),
      resultText: r => (r as { result?: { assistantMessage?: string } }).result?.assistantMessage,
    });
    const result = await generate(turnContext());
    expect(await readAll(result!)).toEqual(['From the result']);
  });

  it('does not use resultText when text was already streamed', async () => {
    const resultText = vi.fn(() => 'should not be used');
    const { workflow } = fakeWorkflow([stepOutput('Streamed')], { result: {} });
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}), resultText });
    const result = await generate(turnContext());
    expect(await readAll(result!)).toEqual(['Streamed']);
    expect(resultText).not.toHaveBeenCalled();
  });

  it('threads tracingContext into run.stream when present', async () => {
    const { workflow, stream } = fakeWorkflow([stepOutput('ok')]);
    const tracingContext = { currentSpan: {} } as VoiceTurnContext['tracingContext'];
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}) });
    await readAll((await generate(turnContext({ tracingContext })))!);
    expect(stream).toHaveBeenCalledWith(expect.objectContaining({ tracingContext }));
  });

  it('cancels the workflow run on barge-in', async () => {
    const { workflow, cancel } = fakeWorkflow([stepOutput('Hello ')], { park: true });
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}) });
    const result = await generate(turnContext());
    const reader = result!.getReader();
    expect((await reader.read()).value).toBe('Hello ');
    await reader.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('propagates workflow stream errors', async () => {
    const { workflow } = fakeWorkflow([stepOutput('partial')], { throwError: new Error('boom') });
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}) });
    const result = await generate(turnContext());
    await expect(readAll(result!)).rejects.toThrow('boom');
  });
});
