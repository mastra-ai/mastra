import { APICallError } from '@internal/ai-sdk-v5';
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
  processorRetryFeedback?: string;
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
    const tools = {
      perplexitySearch: {
        type: 'provider' as const,
        id: 'gateway.perplexity_search',
        args: {},
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
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<typeof tools>);

    const llmResult = await llmExecutionStep.execute(createExecuteParams(createIterationInput()));
    const toolCalls = llmResult.output.toolCalls ?? [];
    const toolCallById = Object.fromEntries(toolCalls.map(toolCall => [toolCall.toolCallId, toolCall]));

    // providerExecuted is inferred from the tool definition (type: 'provider')
    // even though the raw model stream doesn't include it
    expect(toolCallById['call-1']).toEqual(
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'perplexity_search',
        providerExecuted: true,
      }),
    );
    expect(toolCallById['call-2']).toEqual(
      expect.objectContaining({
        toolCallId: 'call-2',
        toolName: 'perplexity_search',
        providerExecuted: true,
      }),
    );
    // output is no longer merged onto toolCalls — results are handled inline
    // via case 'tool-result' in processOutputStream
    expect(toolCallById['call-1'].output).toBeUndefined();
    expect(toolCallById['call-2'].output).toBeUndefined();

    expect(llmResult.stepResult.isContinued).toBe(true);

    // tool-call-step returns inputData as-is for provider-executed tools (no client execution)
    const toolCallStep = createToolCallStep({
      agentId: 'test-agent',
      controller,
      messageList,
      runId: 'test-run',
      tools,
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      _internal: {
        stepTools: tools,
      },
    } as unknown as OuterLLMRun<typeof tools>);

    const toolResult = await toolCallStep.execute({
      ...createExecuteParams(createIterationInput()),
      inputData: toolCallById['call-1'],
    });

    expect(toolResult).toEqual(toolCallById['call-1']);
    expect(toolResult.result).toBeUndefined();
  });

  it('does not continue when finishReason is length with pending tool calls', async () => {
    const tools = {
      echo: createTool({
        id: 'echo',
        description: 'Echo input text',
        inputSchema: z.object({
          text: z.string(),
        }),
        execute: vi.fn(async ({ text }) => ({ text })),
      }),
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
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'echo',
                  input: '{"text":"partial"}',
                },
                {
                  type: 'finish',
                  finishReason: 'length',
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
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<typeof tools>);

    const result = await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    expect(result.output.toolCalls).toEqual([
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'echo',
      }),
    ]);
    expect(result.stepResult.reason).toBe('length');
    expect(result.stepResult.isContinued).toBe(false);
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

  it('stamps step-start.model from the processor-updated model', async () => {
    const initialDoStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([]),
      request: {},
      response: { headers: undefined },
      warnings: [],
    }));
    const overrideDoStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        {
          type: 'response-metadata',
          id: 'resp-override',
          modelId: 'override-model-id',
          timestamp: new Date(0),
        },
        {
          type: 'text-start',
          id: 'text-1',
        },
        {
          type: 'text-delta',
          id: 'text-1',
          delta: 'hello from override model',
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
    const overrideModel = {
      specificationVersion: 'v2' as const,
      provider: 'override-provider',
      modelId: 'override-model-id',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: overrideDoStream,
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
            provider: 'initial-provider',
            modelId: 'initial-model-id',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: initialDoStream,
          } as any,
        },
      ],
      inputProcessors: [
        {
          id: 'override-model',
          processInputStep: vi.fn(async () => ({
            model: overrideModel as any,
          })),
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

    const firstInput = createIterationInput();
    firstInput.stepResult.isContinued = false;

    await llmExecutionStep.execute(createExecuteParams(firstInput));

    const secondInput = createIterationInput();
    secondInput.stepResult.isContinued = false;
    secondInput.output.steps = [{} as any];

    await llmExecutionStep.execute(createExecuteParams(secondInput));

    expect(initialDoStream).not.toHaveBeenCalled();
    expect(overrideDoStream).toHaveBeenCalledTimes(2);

    const assistantMessage = messageList.get.all
      .db()
      .find(message => message.role === 'assistant' && message.content.parts.some(part => part.type === 'step-start'));
    const stepStartPart = assistantMessage?.content.parts.find(part => part.type === 'step-start');

    expect(stepStartPart).toMatchObject({
      type: 'step-start',
      model: 'override-provider/override-model-id',
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

  it('re-stamps MODEL_GENERATION span attributes when a fallback model takes over', async () => {
    const primaryStream = vi.fn(async () => {
      throw new APICallError({
        message: 'primary down',
        url: 'https://primary.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 503,
        isRetryable: true,
      });
    });
    const secondaryStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        {
          type: 'response-metadata',
          id: 'resp-secondary',
          modelId: 'secondary-model',
          timestamp: new Date(0),
        },
        {
          type: 'text-delta',
          textDelta: 'from secondary',
        },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: testUsage,
        },
      ]),
      request: {},
      response: { headers: undefined },
      warnings: [],
    }));

    const modelSpanTracker = {
      getTracingContext: vi.fn(() => ({})),
      reportGenerationError: vi.fn(),
      endGeneration: vi.fn(),
      updateGeneration: vi.fn(),
      wrapStream: vi.fn(<T>(stream: T) => stream),
      startStep: vi.fn(),
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
      modelSpanTracker: modelSpanTracker as any,
      models: [
        {
          id: 'primary-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'primary-provider',
            modelId: 'primary-model',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: primaryStream,
          } as any,
        },
        {
          id: 'secondary-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'secondary-provider',
            modelId: 'secondary-model',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: secondaryStream,
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

    expect(primaryStream).toHaveBeenCalledTimes(1);
    expect(secondaryStream).toHaveBeenCalledTimes(1);
    expect(modelSpanTracker.updateGeneration).toHaveBeenCalledWith({
      name: `llm: 'secondary-model'`,
      attributes: {
        model: 'secondary-model',
        provider: 'secondary-provider',
      },
    });
  });

  it('syncs outputStream.messageId with the rotated id on the API-error retry path', async () => {
    const doStream = vi.fn(async () => {
      throw new APICallError({
        message: 'upstream failed',
        url: 'https://model.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 500,
        isRetryable: false,
      });
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
          id: 'rotate-on-api-error',
          processAPIError: vi.fn(async ({ rotateResponseMessageId }) => {
            rotateResponseMessageId?.();
            return { retry: true };
          }),
        },
      ],
      models: [
        {
          id: 'only-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'only-model',
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
        generateId: () => 'rotated-response-id',
        threadId: 'thread-123',
        resourceId: 'resource-456',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const result = await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    // The retry payload reports outputStream.messageId; if rotateResponseMessageId
    // did not sync it, the retry would be tagged with the stale `msg-0` and any
    // subsequent chunks written through the stream would split across two ids.
    expect(result.stepResult.reason).toBe('retry');
    expect(result.messageId).toBe('rotated-response-id');
  });

  it('passes the rotated response message id to processor custom data writers', async () => {
    const outputWriter = vi.fn(async () => {});
    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: testUsage },
      ]),
      request: {},
      response: { headers: undefined },
      warnings: [],
    }));

    const llmExecutionStep = createLLMExecutionStep({
      agentId: 'test-agent',
      messageId: 'msg-0',
      runId: 'test-run',
      startTimestamp: Date.now(),
      methodType: 'stream',
      controller,
      outputWriter,
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
      inputProcessors: [
        {
          id: 'rotate-and-emit-data',
          processInputStep: vi.fn(async ({ writer, rotateResponseMessageId }) => {
            rotateResponseMessageId?.();
            await writer?.custom({ type: 'data-om-status', data: { status: 'complete' } });
            return {};
          }),
        },
      ],
      tools: {},
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      _internal: {
        generateId: () => 'rotated-response-id',
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

    expect(outputWriter).toHaveBeenCalledWith(
      { type: 'data-om-status', data: { status: 'complete' } },
      { messageId: 'rotated-response-id' },
    );
  });

  it('should use configured modelId in message metadata instead of API response modelId', async () => {
    const configuredModelId = 'gpt-5.4';
    const apiResponseModelId = 'gpt-5.4-2026-03-05'; // Versioned model ID returned by API

    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
        {
          type: 'response-metadata',
          id: 'resp-1',
          modelId: apiResponseModelId, // API returns versioned model ID
          timestamp: new Date(0),
        },
        {
          type: 'text-start',
          id: 'text-1',
        },
        {
          type: 'text-delta',
          id: 'text-1',
          delta: 'Hello!',
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
            provider: 'openai',
            modelId: configuredModelId, // Configured model ID
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

    // Find the assistant message with metadata
    const assistantMessage = messageList.get.all
      .db()
      .find(message => message.role === 'assistant' && message.content.metadata);

    // The message metadata should use the configured modelId, not the API response modelId
    expect(assistantMessage?.content.metadata?.modelId).toBe(configuredModelId);
    expect(assistantMessage?.content.metadata?.modelId).not.toBe(apiResponseModelId);
    expect(assistantMessage?.content.metadata?.provider).toBe('openai');
  });
});
