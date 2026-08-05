import { WritableStream } from 'node:stream/web';
import type { ReadableStream } from 'node:stream/web';
import { llm } from '@livekit/agents';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceTurnContext } from './bridge';
import {
  createWorkflowReplyGenerator,
  pipeAgentReplyToWriter,
  unwrapStepText,
  unwrapStepToolCall,
} from './workflow-generator';

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
  // When parked, the stream stays open after the last chunk until `cancel` releases it — modeling
  // a real run that ends when `run.cancel()` tears it down on barge-in.
  let releasePark: () => void = () => {};
  const cancel = vi.fn(async () => {
    releasePark();
  });
  const stream = vi.fn((_args: { inputData: unknown; tracingContext?: unknown; requestContext?: unknown }) => ({
    fullStream: (async function* () {
      for (const chunk of chunks) yield chunk;
      if (opts.throwError) throw opts.throwError;
      if (opts.park)
        await new Promise<void>(resolve => {
          releasePark = resolve;
        });
    })(),
    result: Promise.resolve(opts.result),
  }));
  const createRun = vi.fn(async () => ({ stream, cancel }));
  const workflow = { id: 'wf', createRun } as unknown as Parameters<typeof createWorkflowReplyGenerator>[0]['workflow'];
  return { workflow, createRun, stream, cancel };
}

const toolCallOutput = (toolCallId: string, toolName: string, args?: unknown): FakeChunk => ({
  type: 'workflow-step-output',
  payload: { output: { type: 'tool-call', payload: { toolCallId, toolName, args } }, stepName: 'generateResponse' },
});

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

describe('unwrapStepToolCall', () => {
  it('unwraps a tool-call chunk (agent fullStream piped to writer)', () => {
    expect(
      unwrapStepToolCall({ type: 'tool-call', payload: { toolCallId: 't1', toolName: 'lookup', args: { q: 1 } } }),
    ).toEqual({
      toolCallId: 't1',
      toolName: 'lookup',
      args: { q: 1 },
    });
  });

  it('returns undefined for text and unrelated shapes', () => {
    expect(unwrapStepToolCall('hello')).toBeUndefined();
    expect(unwrapStepToolCall({ type: 'text-delta', payload: { text: 'x' } })).toBeUndefined();
    expect(unwrapStepToolCall({ type: 'tool-call', payload: { toolName: 'lookup' } })).toBeUndefined();
    expect(unwrapStepToolCall(undefined)).toBeUndefined();
  });
});

describe('pipeAgentReplyToWriter', () => {
  const fakeAgentStream = (chunks: FakeChunk[]) => ({
    fullStream: (async function* () {
      for (const c of chunks) yield c;
    })(),
  });

  it('forwards only text-delta and tool-call chunks and returns the accumulated text', async () => {
    const written: FakeChunk[] = [];
    const writer = new WritableStream<unknown>({
      write: c => {
        written.push(c as FakeChunk);
      },
    });
    const stream = fakeAgentStream([
      { type: 'text-start' },
      { type: 'text-delta', payload: { text: 'Hello ' } },
      { type: 'tool-call', payload: { toolCallId: 't1', toolName: 'lookup', args: { q: 1 } } },
      { type: 'reasoning-delta', payload: { text: 'thinking' } },
      { type: 'text-delta', payload: { text: 'world' } },
      { type: 'finish' },
    ]);
    const text = await pipeAgentReplyToWriter(stream, writer);
    expect(text).toBe('Hello world');
    expect(written.map(c => c.type)).toEqual(['text-delta', 'tool-call', 'text-delta']);
    // The forwarded chunks are exactly what the workflow generator unwraps on the read side.
    expect(unwrapStepText(written[0])).toBe('Hello ');
    expect(unwrapStepToolCall(written[1])).toEqual({ toolCallId: 't1', toolName: 'lookup', args: { q: 1 } });
  });

  it('skips empty text deltas', async () => {
    const written: FakeChunk[] = [];
    const writer = new WritableStream<unknown>({
      write: c => {
        written.push(c as FakeChunk);
      },
    });
    const stream = fakeAgentStream([
      { type: 'text-delta', payload: { text: '' } },
      { type: 'text-delta', payload: { text: 'Hi' } },
    ]);
    expect(await pipeAgentReplyToWriter(stream, writer)).toBe('Hi');
    expect(written).toHaveLength(1);
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

  it('threads requestContext into run.stream when present', async () => {
    const { workflow, stream } = fakeWorkflow([stepOutput('ok')]);
    const requestContext = { get: () => undefined } as unknown as VoiceTurnContext['requestContext'];
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}) });
    await readAll((await generate(turnContext({ requestContext })))!);
    expect(stream).toHaveBeenCalledWith(expect.objectContaining({ requestContext }));
  });

  it('surfaces tool calls and speaks toolFeedback filler from fullStream tool-call outputs', async () => {
    const toolFeedback = vi.fn(({ toolName }: { toolName: string }) =>
      toolName === 'lookup' ? 'One moment.' : undefined,
    );
    const { workflow } = fakeWorkflow([toolCallOutput('t1', 'lookup', { q: 1 }), stepOutput('Found it.')]);
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}), toolFeedback });
    const result = await generate(turnContext());
    // Filler is enqueued before the reply text, with a trailing space added.
    expect(await readAll(result!)).toEqual(['One moment. ', 'Found it.']);
    expect(toolFeedback).toHaveBeenCalledWith({ toolCallId: 't1', toolName: 'lookup', args: { q: 1 } });
  });

  it('fires onTurnComplete with the produced text and surfaced tool calls', async () => {
    const onTurnComplete = vi.fn();
    const { workflow } = fakeWorkflow([toolCallOutput('t1', 'lookup'), stepOutput('Hello '), stepOutput('world')]);
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}), onTurnComplete });
    await readAll((await generate(turnContext()))!);
    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    expect(onTurnComplete.mock.calls[0]![0].result).toEqual({
      text: 'Hello world',
      toolCalls: [{ toolCallId: 't1', toolName: 'lookup', args: undefined }],
      interrupted: false,
    });
  });

  it('fires onTurnComplete with interrupted: true on barge-in', async () => {
    const onTurnComplete = vi.fn();
    const { workflow } = fakeWorkflow([stepOutput('Hello ')], { park: true });
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}), onTurnComplete });
    const result = await generate(turnContext());
    const reader = result!.getReader();
    expect((await reader.read()).value).toBe('Hello ');
    await reader.cancel();
    await vi.waitFor(() => expect(onTurnComplete).toHaveBeenCalledTimes(1));
    expect(onTurnComplete.mock.calls[0]![0].result.interrupted).toBe(true);
    expect(onTurnComplete.mock.calls[0]![0].result.text).toBe('Hello ');
  });

  it('logs and swallows a throwing onTurnComplete hook without breaking the turn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTurnComplete = vi.fn(() => {
      throw new Error('hook boom');
    });
    const { workflow } = fakeWorkflow([stepOutput('Hello')]);
    const generate = createWorkflowReplyGenerator({ workflow, workflowInput: () => ({}), onTurnComplete });
    expect(await readAll((await generate(turnContext()))!)).toEqual(['Hello']);
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('@mastra/livekit: onTurnComplete hook threw', expect.any(Error)),
    );
    warn.mockRestore();
  });
});
