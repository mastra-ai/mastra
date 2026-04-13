import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ToolStream } from '../../../tools/stream';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../../../workflows/constants';
import type { ExecuteFunctionParams } from '../../../workflows/step';
import { testUsage } from '../../test-utils/utils';
import type { OuterLLMRun } from '../../types';
import { createLLMExecutionStep } from './llm-execution-step';
import { createToolCallStep } from './tool-call-step';

type IterationData = {
  messageId: string;
  messages: {
    all: any[];
    user: any[];
    nonUser: any[];
  };
  output: {
    text?: string;
    usage: typeof testUsage;
    steps: any[];
  };
  metadata: {};
  stepResult: {
    reason: 'stop';
    warnings: [];
    isContinued: boolean;
  };
  processorRetryCount?: number;
  fallbackModelIndex?: number;
};

describe('createLLMExecutionStep gateway provider tools', () => {
  let controller: ReadableStreamDefaultController;
  let messageList: MessageList;
  let bail: Mock;

  const createIterationInput = (): IterationData => ({
    messageId: 'msg-0',
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
      reason: 'stop',
      warnings: [],
      isContinued: true,
    },
  });

  const createExecuteParams = (
    inputData: IterationData,
  ): ExecuteFunctionParams<{}, IterationData, any, any, any, any> => ({
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
      name: 'perplexity_search',
      runId: 'test-run',
    }),
    validateSchemas: false,
    inputData,
    [PUBSUB_SYMBOL]: {} as any,
    [STREAM_FORMAT_SYMBOL]: undefined,
  });

  beforeEach(() => {
    controller = {
      enqueue: vi.fn(),
      desiredSize: 1,
      close: vi.fn(),
      error: vi.fn(),
    } as unknown as ReadableStreamDefaultController;

    messageList = new MessageList();
    messageList.add({ role: 'user', content: 'Find the latest AI agent news' }, 'input');

    bail = vi.fn(data => data);
  });

  it('should infer providerExecuted for gateway tools and not merge streamed results onto toolCalls', async () => {
    const executeSpy = vi.fn();
    const tools = {
      perplexitySearch: {
        type: 'provider' as const,
        id: 'gateway.perplexity_search',
        args: {},
        execute: executeSpy,
      },
    };

    const llmExecutionStep = createLLMExecutionStep({
      agentId: 'test-agent',
      messageId: 'msg-0',
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
                  toolName: 'perplexity_search',
                  input: '{"query":"latest AI agent news"}',
                },
                {
                  type: 'tool-call',
                  toolCallId: 'call-2',
                  toolName: 'perplexity_search',
                  input: '{"query":"latest AI agent funding news"}',
                },
                {
                  type: 'tool-result',
                  toolCallId: 'call-2',
                  toolName: 'perplexity_search',
                  result: { answer: 'fresh gateway funding result' },
                },
                {
                  type: 'tool-result',
                  toolCallId: 'call-1',
                  toolName: 'perplexity_search',
                  result: { answer: 'fresh gateway result' },
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: testUsage,
                },
              ]),
              request: {},
              response: {
                headers: undefined,
              },
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
        threadId: 'thread-123',
        resourceId: 'resource-456',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const input = createIterationInput();
    input.stepResult.isContinued = false;

    const llmResult = await llmExecutionStep.execute(createExecuteParams(input));
    const toolCallResult = llmResult.output.toolCalls;
    const toolCallStep = createToolCallStep({
      tools,
      _internal: {
        stepTools: tools,
      },
    } as OuterLLMRun<typeof tools>);

    const toolCallById = Object.fromEntries(toolCallResult.map(call => [call.toolCallId, call]));

    const toolResult = await toolCallStep.execute({
      ...createExecuteParams(createIterationInput()),
      inputData: toolCallById['call-1'],
    });

    expect(toolResult).toEqual(toolCallById['call-1']);
    expect(toolResult.result).toBeUndefined();
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('merges model config headers with explicit modelSettings headers and lets modelSettings override duplicates', async () => {
    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        {
          type: 'response-metadata',
          id: 'resp-1',
          modelId: 'mock-model-id',
          timestamp: new Date(0),
        },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: testUsage,
        },
      ]),
      request: {},
      response: {
        headers: undefined,
      },
      warnings: [],
    }));

    const llmExecutionStep = createLLMExecutionStep({
      agentId: 'test-agent',
      messageId: 'msg-0',
      runId: 'test-run',
      startTimestamp: Date.now(),
      methodType: 'stream',
      controller,
      outputWriter: vi.fn(),
      messageList,
      modelSettings: {
        headers: {
          authorization: 'Bearer settings-token',
          'x-thread-id': 'thread-from-settings',
          'x-resource-id': 'resource-from-settings',
          'x-custom-header': 'settings-value',
        },
      },
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          headers: {
            authorization: 'Bearer model-token',
            'x-model-header': 'model-value',
          },
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'mock-model-id',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream,
          } as any,
        },
      ],
      tools: {},
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      _internal: {
        generateId: () => 'generated-id',
        threadId: 'thread-123',
        resourceId: 'resource-456',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const input = createIterationInput();
    input.stepResult.isContinued = false;

    await llmExecutionStep.execute(createExecuteParams(input));

    expect(doStream).toHaveBeenCalledOnce();
    expect(doStream.mock.calls[0]?.[0]?.headers).toEqual({
      authorization: 'Bearer settings-token',
      'x-model-header': 'model-value',
      'x-thread-id': 'thread-from-settings',
      'x-resource-id': 'resource-from-settings',
      'x-custom-header': 'settings-value',
    });
  });

  it('preserves model config headers when modelSettings adds non-conflicting headers', async () => {
    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        {
          type: 'response-metadata',
          id: 'resp-1',
          modelId: 'mock-model-id',
          timestamp: new Date(0),
        },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: testUsage,
        },
      ]),
      request: {},
      response: {
        headers: undefined,
      },
      warnings: [],
    }));

    const llmExecutionStep = createLLMExecutionStep({
      agentId: 'test-agent',
      messageId: 'msg-0',
      runId: 'test-run',
      startTimestamp: Date.now(),
      methodType: 'stream',
      controller,
      outputWriter: vi.fn(),
      messageList,
      modelSettings: {
        headers: {
          'x-custom-header': 'settings-value',
        },
      },
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          headers: {
            authorization: 'Bearer model-token',
          },
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'mock-model-id',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream,
          } as any,
        },
      ],
      tools: {},
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      _internal: {
        generateId: () => 'generated-id',
        threadId: 'thread-123',
        resourceId: 'resource-456',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const input = createIterationInput();
    input.stepResult.isContinued = false;

    await llmExecutionStep.execute(createExecuteParams(input));

    expect(doStream).toHaveBeenCalledOnce();
    expect(doStream.mock.calls[0]?.[0]?.headers).toEqual({
      authorization: 'Bearer model-token',
      'x-custom-header': 'settings-value',
      'x-thread-id': 'thread-123',
      'x-resource-id': 'resource-456',
    });
  });

  it('should not create headers when neither model nor modelSettings provide them', async () => {
    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        {
          type: 'response-metadata',
          id: 'resp-1',
          modelId: 'mock-model-id',
          timestamp: new Date(0),
        },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: testUsage,
        },
      ]),
      request: {},
      response: {
        headers: undefined,
      },
      warnings: [],
    }));

    const llmExecutionStep = createLLMExecutionStep({
      agentId: 'test-agent',
      messageId: 'msg-0',
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
            doStream,
          } as any,
        },
      ],
      tools: {},
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      _internal: {
        generateId: () => 'generated-id',
        threadId: 'thread-123',
        resourceId: 'resource-456',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const input = createIterationInput();
    input.stepResult.isContinued = false;

    await llmExecutionStep.execute(createExecuteParams(input));

    expect(doStream).toHaveBeenCalledOnce();
    expect(doStream.mock.calls[0]?.[0]?.headers).toEqual({
      'x-thread-id': 'thread-123',
      'x-resource-id': 'resource-456',
    });
  });

  it('preserves fallback model index when processAPIError requests a retry', async () => {
    const firstModelStream = vi.fn(async () => {
      throw new APICallError({
        message: 'primary failed',
        url: 'https://primary.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 503,
        isRetryable: true,
      });
    });
    const secondModelStream = vi
      .fn()
      .mockRejectedValueOnce(
        new APICallError({
          message: 'secondary needs processor retry',
          url: 'https://secondary.example.com/v1/messages',
          requestBodyValues: {},
          statusCode: 400,
          isRetryable: false,
        }),
      )
      .mockResolvedValue({
        stream: convertArrayToReadableStream([
          {
            type: 'response-metadata',
            id: 'resp-1',
            modelId: 'secondary-model',
            timestamp: new Date(0),
          },
          {
            type: 'text-delta',
            textDelta: 'Recovered on secondary model',
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: testUsage,
          },
        ]),
        request: {},
        response: {
          headers: undefined,
        },
        warnings: [],
      });

    const llmExecutionStep = createLLMExecutionStep({
      agentId: 'test-agent',
      messageId: 'msg-0',
      runId: 'test-run',
      startTimestamp: Date.now(),
      methodType: 'stream',
      controller,
      outputWriter: vi.fn(),
      messageList,
      maxProcessorRetries: 1,
      errorProcessors: [
        {
          id: 'retry-secondary-api-error',
          processAPIError: vi.fn(async ({ error }) => ({
            retry: error.message === 'secondary needs processor retry',
          })),
        },
      ],
      models: [
        {
          id: 'primary-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'primary-model',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: firstModelStream,
          } as any,
        },
        {
          id: 'secondary-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'secondary-model',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: secondModelStream,
          } as any,
        },
      ],
      tools: {},
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      _internal: {
        generateId: () => 'generated-id',
        threadId: 'thread-123',
        resourceId: 'resource-456',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const retryResult = await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    expect(retryResult.stepResult.reason).toBe('retry');
    expect(retryResult.fallbackModelIndex).toBe(1);
    expect(firstModelStream).toHaveBeenCalledTimes(1);
    expect(secondModelStream).toHaveBeenCalledTimes(1);
    expect(retryResult.messages.nonUser).toEqual([]);
    expect(retryResult.stepResult.isContinued).toBe(true);

    const retryInput = createIterationInput();
    retryInput.processorRetryCount = retryResult.processorRetryCount;
    retryInput.fallbackModelIndex = retryResult.fallbackModelIndex;

    await llmExecutionStep.execute(createExecuteParams(retryInput));

    expect(secondModelStream).toHaveBeenCalledTimes(2);
    expect(firstModelStream).toHaveBeenCalledTimes(1);
  });
});
