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

  const runLoop = async (stream: any) => {
    const messageList = createMessageListWithUserMessage();
    const model = new MastraLanguageModelV2Mock({
      doStream: async () => ({ stream, warnings: [] }),
    } as any);

    const result = loopFn({
      methodType: 'stream',
      runId: 'test-run-id',
      models: [{ maxRetries: 0, id: 'test-model', model }],
      messageList,
      ...defaultSettings(),
    });

    // Drain the stream; a terminal error may surface as an error chunk or throw.
    try {
      await convertAsyncIterableToArray(result.fullStream);
    } catch {
      // ignored — we assert on the persisted message list, not the thrown error
    }

    return messageList;
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
    const messageList = await runLoop(
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
  });

  it('preserves a completed provider tool result on a terminal error', async () => {
    const messageList = await runLoop(
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
  });
});
