import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod/v4';
import { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ToolStream } from '../../../tools/stream';
import { createTool } from '../../../tools/tool';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../../../workflows/constants';
import type { ExecuteFunctionParams } from '../../../workflows/step';
import { testUsage } from '../../test-utils/utils';
import type { OuterLLMRun } from '../../types';
import { createLLMExecutionStep } from './llm-execution-step';

// Regression for https://github.com/mastra-ai/mastra/issues/16893
// In long conversations, MessageList.generateCreatedAt inflates input message
// timestamps past wall-clock time (each rapidly-added message gets lastCreatedAt+1ms).
// Without a fix, the assistant response message stamped with `new Date()` lands
// *before* the latest input message, and addOne's sort-by-createdAt misplaces
// the response in the middle of the history, causing the model to re-issue
// tool calls in the next loop step.
describe('llm-execution-step response createdAt ordering (#16893)', () => {
  let controller: ReadableStreamDefaultController;
  let messageList: MessageList;
  let bail: Mock;

  beforeEach(() => {
    controller = {
      enqueue: vi.fn(),
      desiredSize: 1,
      close: vi.fn(),
      error: vi.fn(),
    } as unknown as ReadableStreamDefaultController;

    messageList = new MessageList();
    // Simulate a long prior conversation. Without explicit createdAt,
    // generateCreatedAt inflates each message by +1ms past wall-clock when many
    // messages are added rapidly.
    const HISTORY_COUNT = 80;
    for (let i = 0; i < HISTORY_COUNT; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      messageList.add(
        {
          role,
          content: `filler conversation message #${i}`,
        },
        role === 'assistant' ? 'response' : 'input',
      );
    }
    messageList.add({ role: 'user', content: 'Please echo the exact word: hello' }, 'input');

    bail = vi.fn(data => data);
  });

  const createIterationInput = () => ({
    messageId: 'msg-resp-0',
    messages: {
      all: messageList.get.all.aiV5.model(),
      user: messageList.get.input.aiV5.model(),
      nonUser: messageList.get.response.aiV5.model(),
    },
    output: {
      usage: testUsage,
      steps: [],
    },
    metadata: {},
    stepResult: {
      reason: 'stop' as const,
      warnings: [] as const,
      isContinued: true,
    },
  });

  const createExecuteParams = (inputData: any): ExecuteFunctionParams<{}, any, any, any, any, any> =>
    ({
      runId: 'test-run',
      workflowId: 'test-workflow',
      mastra: {} as any,
      requestContext: new RequestContext(),
      state: {},
      setState: vi.fn(),
      retryCount: 1,
      tracingContext: {} as any,
      getInitData: vi.fn(),
      getStepResult: vi.fn(),
      suspend: vi.fn(),
      bail,
      abort: vi.fn(),
      engine: 'default' as any,
      abortSignal: new AbortController().signal,
      writer: new ToolStream({
        prefix: 'tool',
        callId: 'call-1',
        name: 'echo',
        runId: 'test-run',
      }),
      validateSchemas: false,
      inputData,
      [PUBSUB_SYMBOL]: {} as any,
      [STREAM_FORMAT_SYMBOL]: undefined,
    }) as any;

  it('places assistant response after the last user message in long histories', async () => {
    const tools = {
      echo: createTool({
        id: 'echo',
        description: 'Echo input',
        inputSchema: z.object({ message: z.string() }),
        execute: vi.fn(async ({ message }) => ({ echoed: message })),
      }),
    };

    const triggerMsg = messageList.get.all.db().find(m => {
      if (m.role !== 'user') return false;
      const text = JSON.stringify(m.content);
      return text.includes('hello');
    });
    expect(triggerMsg).toBeDefined();
    const triggerCreatedAt = triggerMsg!.createdAt.getTime();

    const llmExecutionStep = createLLMExecutionStep({
      agentId: 'test-agent',
      messageId: 'msg-resp-0',
      runId: 'test-run',
      startTimestamp: Date.now(),
      methodType: 'stream',
      controller,
      outputWriter: vi.fn(),
      messageList,
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'mock-model-id',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: vi.fn(async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'resp-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'echo',
                  input: '{"message":"hello"}',
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: testUsage,
                },
              ]),
              request: {},
              response: { headers: undefined },
              warnings: [],
            })),
          } as any,
        },
      ],
      tools,
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      _internal: {
        generateId: () => 'generated-id',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<typeof tools>);

    await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    const all = messageList.get.all.db();
    const assistantToolCallIdx = all.findIndex(
      m =>
        m.role === 'assistant' &&
        Array.isArray(m.content.parts) &&
        m.content.parts.some((p: any) => p.type === 'tool-invocation' || p.type === 'tool-call'),
    );
    const triggerIdx = all.findIndex(m => m === triggerMsg);

    expect(assistantToolCallIdx).toBeGreaterThan(triggerIdx);
    expect(all[assistantToolCallIdx].createdAt.getTime()).toBeGreaterThan(triggerCreatedAt);
  });
});
