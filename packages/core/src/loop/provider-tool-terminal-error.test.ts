import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../mastra';
import { loop } from './loop';
import { MastraLanguageModelV2Mock } from './test-utils/MastraLanguageModelV2Mock';
import { convertAsyncIterableToArray } from './test-utils/stream-helpers';
import {
  createMessageListWithUserMessage,
  createTestMastra,
  defaultSettings,
  mockDate,
  testUsage,
} from './test-utils/utils';

// This suite reproduces the issue where a provider-executed tool call is left
// unresolved (state: 'call') in the final message list when the model stream
// terminates with an error before the provider result arrives. After the fix,
// the abandoned provider tool call must be reconciled to an `output-error`
// state so no orphaned `call` part survives into persisted history.
describe('provider-executed tool call + terminal error', () => {
  let mastraRef: { current?: Mastra } = {};
  const loopFn: typeof loop = opts => loop({ ...opts, mastra: mastraRef.current as any });

  let dispose: (() => Promise<void>) | undefined;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(mockDate);
    const created = await createTestMastra();
    mastraRef.current = created.mastra;
    dispose = created.dispose;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await dispose?.();
    mastraRef.current = undefined;
    dispose = undefined;
  });

  const runLoop = async (streams: any | any[]) => {
    const streamQueue = Array.isArray(streams) ? [...streams] : [streams];
    const messageList = createMessageListWithUserMessage();
    const model = new MastraLanguageModelV2Mock({
      doStream: async () => ({ stream: streamQueue.shift() ?? streamQueue[0], warnings: [] }),
    } as any);

    const result = loopFn({
      methodType: 'stream',
      runId: 'test-run-id',
      models: [{ maxRetries: 0, id: 'test-model', model }],
      messageList,
      ...defaultSettings(),
    });

    // Drain the stream; a terminal error may surface as an error chunk or throw.
    const chunks: any[] = [];
    let thrownError: unknown;
    try {
      for await (const chunk of result.fullStream) {
        chunks.push(chunk);
      }
    } catch (err) {
      thrownError = err;
    }

    return { messageList, result, chunks, thrownError };
  };

  // The original provider error must always be surfaced, either as an error chunk
  // in the stream or as a thrown error — reconciliation must not swallow it.
  const expectProviderErrorSurfaced = (chunks: any[], thrownError: unknown, message = 'provider blew up') => {
    const errorChunk = chunks.find(c => c.type === 'error');
    const surfaced =
      (errorChunk && JSON.stringify(errorChunk.payload ?? errorChunk).includes(message)) ||
      (thrownError && String((thrownError as any)?.message ?? thrownError).includes(message)) ||
      Boolean(errorChunk);
    expect(surfaced).toBe(true);
  };

  const assistantToolParts = (messageList: ReturnType<typeof createMessageListWithUserMessage>) => {
    const responseMessages = messageList.get.response.db();
    const assistant = responseMessages.find(m => m.role === 'assistant');
    const parts = assistant?.content.parts ?? [];
    return parts.filter(p => p.type === 'tool-invocation') as Array<
      Extract<(typeof parts)[number], { type: 'tool-invocation' }>
    >;
  };

  it('reconciles an abandoned provider tool call to output-error after a terminal error', async () => {
    const { messageList, result, chunks, thrownError } = await runLoop(
      convertArrayToReadableStream([
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'web_search',
          input: `{"query":"mastra"}`,
          providerExecuted: true,
        },
        { type: 'error', error: new Error('provider blew up') },
        { type: 'finish', finishReason: 'error', usage: testUsage },
      ] as any),
    );

    const toolParts = assistantToolParts(messageList);
    // No orphaned pending provider tool call may survive.
    expect(toolParts.some(p => p.toolInvocation.state === 'call')).toBe(false);
    expect(toolParts.some(p => p.toolInvocation.state === 'partial-call')).toBe(false);

    const reconciled = toolParts.find(p => p.toolInvocation.toolCallId === 'call-1');
    expect(reconciled?.toolInvocation.state).toBe('output-error');

    // Regression for the ordering bug: the returned step snapshot (not just the
    // live MessageList) must also reflect the reconciled call, since reconciliation
    // now runs before those snapshots are built.
    const steps = await result.steps;
    const stepResponseParts = steps.flatMap(s =>
      (s.response?.messages ?? []).flatMap(m => (Array.isArray(m.content) ? m.content : [])),
    );
    const returnedToolResult = stepResponseParts.find(
      (p: any) => p?.type === 'tool-result' && p?.toolCallId === 'call-1',
    ) as any;
    expect(returnedToolResult).toBeDefined();
    // The returned snapshot represents the abandoned call as a failed provider result,
    // not a dangling unresolved tool-call.
    expect(returnedToolResult?.output?.type).toBe('error-json');

    // The original provider error must still be surfaced, not swallowed.
    expectProviderErrorSurfaced(chunks, thrownError);
  });

  it('captures a streamed provider tool call id when the stream errors right after argument streaming', async () => {
    // The tool arguments arrive via streaming deltas and a streaming-end (which
    // assembles the complete call), then the stream terminates with an error before
    // any provider result. The loop must still capture that tool-call id and
    // reconcile it — proving the id is captured from the streamed call, not only
    // from a pre-baked `tool-call` chunk.
    const { messageList, chunks, thrownError } = await runLoop(
      convertArrayToReadableStream([
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'tool-input-start', id: 'stream-1', toolName: 'web_search', providerExecuted: true },
        { type: 'tool-input-delta', id: 'stream-1', delta: `{"query":` },
        { type: 'tool-input-delta', id: 'stream-1', delta: `"mastra"}` },
        { type: 'tool-input-end', id: 'stream-1' },
        { type: 'error', error: new Error('provider blew up') },
        { type: 'finish', finishReason: 'error', usage: testUsage },
      ] as any),
    );

    const toolParts = assistantToolParts(messageList);
    // The streamed call must have been captured and reconciled — not left as an
    // unresolved call/partial-call, and not silently dropped.
    const streamed = toolParts.find(p => p.toolInvocation.toolCallId === 'stream-1');
    expect(streamed).toBeDefined();
    expect(streamed?.toolInvocation.state).toBe('output-error');
    expect(toolParts.some(p => p.toolInvocation.state === 'call')).toBe(false);
    expect(toolParts.some(p => p.toolInvocation.state === 'partial-call')).toBe(false);

    expectProviderErrorSurfaced(chunks, thrownError);
  });

  it('does not add a spurious error to a fallback provider tool call that later succeeds', async () => {
    // First attempt fails at the transport level → the loop falls back to the second
    // model. The second model completes a provider tool call successfully. The final
    // message list must NOT carry a fabricated output-error: reconciliation only
    // targets the terminal-error step, never a subsequent successful fallback result.
    const messageList = createMessageListWithUserMessage();
    const failing = new MastraLanguageModelV2Mock({
      doStream: async () => {
        throw new Error('provider blew up');
      },
    } as any);
    const succeeding = new MastraLanguageModelV2Mock({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id-2', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'web_search',
            input: `{"query":"mastra"}`,
            providerExecuted: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'web_search',
            result: { answer: 'ok' },
            providerExecuted: true,
          },
          { type: 'text-start', id: 't-0' },
          { type: 'text-delta', id: 't-0', delta: 'done' },
          { type: 'text-end', id: 't-0' },
          { type: 'finish', finishReason: 'stop', usage: testUsage },
        ] as any),
        warnings: [],
      }),
    } as any);

    const result = loopFn({
      methodType: 'stream',
      runId: 'test-run-id',
      models: [
        { maxRetries: 0, id: 'failing-model', model: failing },
        { maxRetries: 0, id: 'succeeding-model', model: succeeding },
      ],
      messageList,
      ...defaultSettings(),
    });

    try {
      await convertAsyncIterableToArray(result.fullStream);
    } catch {
      // ignored
    }

    const toolParts = assistantToolParts(messageList);
    const succeeded = toolParts.find(p => p.toolInvocation.toolCallId === 'call-2');
    expect(succeeded?.toolInvocation.state).toBe('result');
    // The successful fallback result must never be turned into an output-error.
    expect(succeeded?.toolInvocation.state).not.toBe('output-error');
  });

  it('preserves a completed provider tool result on a terminal error', async () => {
    const { messageList, chunks, thrownError } = await runLoop(
      convertArrayToReadableStream([
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'done-1',
          toolName: 'web_search',
          input: `{"query":"ok"}`,
          providerExecuted: true,
        },
        {
          type: 'tool-result',
          toolCallId: 'done-1',
          toolName: 'web_search',
          result: { answer: 'done' },
          providerExecuted: true,
        },
        {
          type: 'tool-call',
          toolCallId: 'abandoned-1',
          toolName: 'web_search',
          input: `{"query":"later"}`,
          providerExecuted: true,
        },
        { type: 'error', error: new Error('provider blew up') },
        { type: 'finish', finishReason: 'error', usage: testUsage },
      ] as any),
    );

    const toolParts = assistantToolParts(messageList);

    const completed = toolParts.find(p => p.toolInvocation.toolCallId === 'done-1');
    expect(completed?.toolInvocation.state).toBe('result');

    const abandoned = toolParts.find(p => p.toolInvocation.toolCallId === 'abandoned-1');
    expect(abandoned?.toolInvocation.state).toBe('output-error');

    expect(toolParts.some(p => p.toolInvocation.state === 'call')).toBe(false);

    expectProviderErrorSurfaced(chunks, thrownError);
  });
});
