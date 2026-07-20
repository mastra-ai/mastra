import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod/v4';
import { MODEL_TOKENS } from '../../../../../../docs/src/plugins/remark-model-tokens/models';
import { MessageList } from '../../../agent/message-list';
import { SpanType } from '../../../observability';
import { StreamErrorRetryProcessor } from '../../../processors';
import { ProviderHistoryCompat } from '../../../processors/provider-history-compat';
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

  it('does not continue when finishReason is content-filter', async () => {
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
                  type: 'finish',
                  finishReason: 'content-filter',
                  providerMetadata: {
                    anthropic: {
                      stopDetails: { type: 'refusal', category: 'cyber', explanation: 'blocked' },
                    },
                  },
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
    } as unknown as OuterLLMRun);

    const result = await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    // A content-filter refusal is terminal: continuing would re-send the same
    // request and re-trigger the refusal, hanging the run until maxSteps.
    expect(result.stepResult.reason).toBe('content-filter');
    expect(result.stepResult.isContinued).toBe(false);
  });

  it('does not continue when finishReason is content-filter even with a pending tool call', async () => {
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
                  finishReason: 'content-filter',
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

    expect(result.stepResult.reason).toBe('content-filter');
    expect(result.stepResult.isContinued).toBe(false);
  });

  it('does not continue when finishReason is error even with a pending tool call', async () => {
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
                  finishReason: 'error',
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

    // An error finish is terminal: a pending tool call must not flip the loop
    // back into continuing, otherwise the failed request is re-sent instead of
    // surfacing the terminal error.
    expect(result.stepResult.reason).toBe('error');
    expect(result.stepResult.isContinued).toBe(false);
  });

  it('creates a client tool observability span early and ends it with streamed args', async () => {
    const carrier = {
      traceparent: '00-1234567890abcdef1234567890abcdef-abcdef1234567890-01',
    };
    const clientToolSpan = {
      id: 'abcdef1234567890',
      traceId: '1234567890abcdef1234567890abcdef',
      type: SpanType.CLIENT_TOOL_CALL,
      end: vi.fn(),
    };
    const agentRunSpan = {
      id: 'agent-span',
      traceId: '1234567890abcdef1234567890abcdef',
      type: SpanType.AGENT_RUN,
      createChildSpan: vi.fn(() => clientToolSpan),
      findParent: vi.fn(),
    };
    const inject = vi.fn(() => carrier);

    const tools = {
      getWeather: {
        id: 'getWeather',
        description: 'Get weather',
        inputSchema: z.object({ location: z.string() }),
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
                  type: 'tool-input-start',
                  id: 'call-1',
                  toolName: 'getWeather',
                  providerExecuted: false,
                },
                {
                  type: 'tool-input-delta',
                  id: 'call-1',
                  delta: '{"location":"Paris"}',
                },
                {
                  type: 'tool-input-end',
                  id: 'call-1',
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
      toolCallStreaming: true,
      mastra: {
        observability: {
          getClientObservabilityProxy: () => ({ inject }),
        },
      } as any,
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

    const executeParams = createExecuteParams(createIterationInput());
    executeParams.tracingContext = { currentSpan: agentRunSpan } as any;

    const result = await llmExecutionStep.execute(executeParams);
    const enqueuedChunks = (controller.enqueue as Mock).mock.calls.map(([chunk]) => chunk);
    const streamingStartChunk = enqueuedChunks.find(chunk => chunk.type === 'tool-call-input-streaming-start');

    expect(agentRunSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.CLIENT_TOOL_CALL,
        name: "client_tool: 'getWeather'",
        entityType: 'tool',
        entityId: 'getWeather',
        entityName: 'getWeather',
        attributes: expect.objectContaining({
          toolDescription: 'Get weather',
          toolType: 'client-tool',
        }),
      }),
    );
    expect(inject).toHaveBeenCalledWith(clientToolSpan);
    expect(streamingStartChunk?.payload.observability).toEqual(carrier);
    expect(clientToolSpan.end).toHaveBeenCalledWith({ metadata: { args: { location: 'Paris' } } });
    expect(result.output.toolCalls?.[0]).toMatchObject({
      toolCallId: 'call-1',
      toolName: 'getWeather',
      args: { location: 'Paris' },
      observability: carrier,
    });
  });

  it('resolves streamed tool payload transforms without rescanning tools per delta', async () => {
    const onInputDelta = vi.fn();
    const rawTools = {
      registeredLookup: {
        id: 'lookup_by_model_name',
        inputSchema: z.object({ query: z.string() }),
        onInputDelta,
        transform: {
          display: {
            inputDelta: ({ inputTextDelta }: { inputTextDelta?: string }) => inputTextDelta?.toUpperCase(),
          },
        },
      },
    };
    let toolEnumerationCount = 0;
    const tools = new Proxy(rawTools, {
      ownKeys(target) {
        toolEnumerationCount += 1;
        return Reflect.ownKeys(target);
      },
    });
    const toolInputDeltas = ['{"query":"', ...Array.from({ length: 12 }, (_, index) => `part-${index} `), '"}'];

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
            modelId: MODEL_TOKENS.__GATEWAY_OPENAI_MODEL_BASE__,
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: vi.fn(async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'tool-input-start',
                  id: 'call-1',
                  toolName: 'lookup_by_model_name',
                  providerExecuted: false,
                },
                ...toolInputDeltas.map(delta => ({
                  type: 'tool-input-delta' as const,
                  id: 'call-1',
                  delta,
                })),
                {
                  type: 'tool-input-end',
                  id: 'call-1',
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
      toolCallStreaming: true,
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

    const enqueuedChunks = (controller.enqueue as Mock).mock.calls.map(([chunk]) => chunk);
    const deltaChunks = enqueuedChunks.filter(chunk => chunk.type === 'tool-call-delta');

    expect(toolEnumerationCount).toBeLessThanOrEqual(5);
    expect(onInputDelta).toHaveBeenCalledTimes(toolInputDeltas.length);
    expect(deltaChunks).toHaveLength(toolInputDeltas.length);
    expect(deltaChunks.map(chunk => chunk.metadata?.mastra?.toolPayloadTransform?.display?.['input-delta'])).toEqual(
      toolInputDeltas.map(delta => ({ transformed: delta.toUpperCase() })),
    );
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

  it('updates model step tracing with final input messages', async () => {
    messageList.addSystem(
      'WORKING_MEMORY_SYSTEM_INSTRUCTION:\n<working_memory_data>saved</working_memory_data>',
      'memory',
    );
    const modelSpanTracker = {
      getTracingContext: vi.fn(() => ({})),
      startStep: vi.fn(),
      updateStep: vi.fn(),
    };

    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([]),
      request: {
        body: JSON.stringify({
          model: 'mock-model-id',
          messages: [{ role: 'user', content: 'Find the latest AI agent news' }],
        }),
      },
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
      modelSpanTracker,
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const input = createIterationInput();
    input.stepResult.isContinued = false;

    await llmExecutionStep.execute(createExecuteParams(input));

    expect(modelSpanTracker.updateStep).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMessages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('WORKING_MEMORY_SYSTEM_INSTRUCTION'),
          }),
          expect.objectContaining({
            role: 'user',
          }),
        ]),
      }),
    );
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'step-start',
        payload: expect.not.objectContaining({
          inputMessages: expect.any(Array),
        }),
      }),
    );
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

  it('runs processLLMRequest before invoking the model without persisting prompt changes', async () => {
    const processLLMRequest = vi.fn(async ({ prompt }: any) => ({
      prompt: prompt.map((message: any) =>
        message.role === 'user'
          ? {
              ...message,
              content: [{ type: 'text' as const, text: 'rewritten outbound prompt' }],
            }
          : message,
      ),
    }));
    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
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
      inputProcessors: [{ id: 'rewrite-prompt', processLLMRequest }],
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

    await llmExecutionStep.execute(
      createExecuteParams({
        ...createIterationInput(),
        processorRetryCount: 2,
      }),
    );

    expect(processLLMRequest).toHaveBeenCalledOnce();
    expect(processLLMRequest).toHaveBeenCalledWith(expect.objectContaining({ retryCount: 2 }));
    expect(doStream).toHaveBeenCalledOnce();
    expect(doStream.mock.calls[0]?.[0]?.prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: [{ type: 'text', text: 'rewritten outbound prompt' }],
        }),
      ]),
    );
    expect(messageList.get.input.aiV5.model()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'text', text: 'Find the latest AI agent news' }),
          ]),
        }),
      ]),
    );
  });

  it('runs processLLMRequest from both request-specific and direct input processor lists', async () => {
    const appendToUserRequestPrompt =
      (suffix: string) =>
      async ({ prompt }: any) => ({
        prompt: prompt.map((message: any) => {
          if (message.role !== 'user') return message;
          const text = Array.isArray(message.content)
            ? message.content.find((part: any) => part.type === 'text')?.text
            : message.content;
          return {
            ...message,
            content: [{ type: 'text' as const, text: `${text} ${suffix}` }],
          };
        }),
      });
    const llmRequestProcessor = vi.fn(appendToUserRequestPrompt('from request list'));
    const inputProcessor = vi.fn(appendToUserRequestPrompt('from input list'));
    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
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
      llmRequestInputProcessors: [{ id: 'llm-request-processor', processLLMRequest: llmRequestProcessor }],
      inputProcessors: [{ id: 'input-request-processor', processLLMRequest: inputProcessor }],
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

    await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    expect(llmRequestProcessor).toHaveBeenCalledOnce();
    expect(inputProcessor).toHaveBeenCalledOnce();
    expect(doStream.mock.calls[0]?.[0]?.prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: [{ type: 'text', text: 'Find the latest AI agent news from request list from input list' }],
        }),
      ]),
    );
  });

  it('strips foreign reasoning history before sending prompts to Anthropic models', async () => {
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'OpenAI-only reasoning trace',
            providerOptions: {
              openai: {
                itemId: 'rs_openai_123',
              },
            },
          },
          { type: 'text', text: 'Previous answer' },
        ],
      } as any,
      'response',
    );

    const doStream = vi.fn(async ({ prompt }) => {
      const hasForeignReasoning = prompt.some(
        (message: any) =>
          message.role === 'assistant' &&
          Array.isArray(message.content) &&
          message.content.some((part: any) => part.type === 'reasoning' && !part.providerOptions?.anthropic),
      );

      if (hasForeignReasoning) {
        throw new APICallError({
          message: 'messages: reasoning content is not supported from non-Anthropic providers',
          url: 'https://api.anthropic.com/v1/messages',
          requestBodyValues: {},
          statusCode: 400,
          responseHeaders: {},
          responseBody: JSON.stringify({
            error: {
              type: 'invalid_request_error',
              message: 'reasoning content is not supported',
            },
          }),
          isRetryable: false,
        });
      }

      return {
        stream: convertArrayToReadableStream([
          {
            type: 'finish',
            finishReason: 'stop',
            usage: testUsage,
          },
        ]),
        request: {},
        response: { headers: undefined },
        warnings: [],
      };
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
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'anthropic.messages',
            modelId: 'claude-3-7-sonnet-20250219',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream,
          } as any,
        },
      ],
      inputProcessors: [new ProviderHistoryCompat()],
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

    await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    expect(doStream).toHaveBeenCalledOnce();
    expect(doStream.mock.calls[0]?.[0]?.prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Previous answer' })]),
        }),
      ]),
    );
    expect(messageList.get.response.aiV5.model()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.arrayContaining([expect.objectContaining({ type: 'reasoning' })]),
        }),
      ]),
    );
  });

  it('bails with a tripwire response when processLLMRequest aborts', async () => {
    const doStream = vi.fn(async () => ({
      stream: convertArrayToReadableStream([
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
      inputProcessors: [
        {
          id: 'prompt-abort',
          processLLMRequest: vi.fn(async ({ abort }) => {
            abort('Prompt aborted', { metadata: { phase: 'prompt' } });
          }),
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

    const result = await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    expect(doStream).not.toHaveBeenCalled();
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tripwire',
        payload: expect.objectContaining({
          reason: 'Prompt aborted',
          metadata: { phase: 'prompt' },
          processorId: 'prompt-abort',
        }),
      }),
    );
    expect(result).toMatchObject({
      stepResult: { reason: 'tripwire', isContinued: false },
      output: { text: '' },
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

  it('does not signal a processor retry when aborted during the retry delay', async () => {
    const abortController = new AbortController();
    const onAbort = vi.fn();
    const doStream = vi.fn(async () => {
      throw new APICallError({
        message: 'provider unavailable',
        url: 'https://provider.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 503,
        isRetryable: true,
      });
    });
    const processor = new StreamErrorRetryProcessor({
      maxRetries: 1,
      delayMs: () => {
        setTimeout(() => abortController.abort(), 0);
        return 60_000;
      },
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
      errorProcessors: [processor],
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'test-model',
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
      options: {
        abortSignal: abortController.signal,
        onAbort,
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const result = await llmExecutionStep.execute(createExecuteParams(createIterationInput()));

    expect(doStream).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledOnce();
    expect(result.stepResult).toMatchObject({ reason: 'tripwire', isContinued: false });
  });

  it('emits a processor_run span when an error processor handles an API error', async () => {
    const processorSpan = {
      id: 'processor-span',
      type: SpanType.PROCESSOR_RUN,
      end: vi.fn(),
      error: vi.fn(),
      update: vi.fn(),
    };
    const agentRunSpan = {
      id: 'agent-span',
      type: SpanType.AGENT_RUN,
      createChildSpan: vi.fn(() => processorSpan),
      findParent: vi.fn(),
    };

    const failingStream = vi.fn(async () => {
      throw new APICallError({
        message: 'model rejected the request',
        url: 'https://primary.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 400,
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
          id: 'observe-api-error',
          processAPIError: vi.fn(async () => ({ retry: false })),
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
            doStream: failingStream,
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
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const executeParams = createExecuteParams(createIterationInput());
    executeParams.tracingContext = { currentSpan: agentRunSpan } as any;

    await llmExecutionStep.execute(executeParams);

    // The error-processor run must show up in observability exports; without a
    // tracingContext the runner falls back to a no-op context and silently
    // skips the span.
    expect(agentRunSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.PROCESSOR_RUN,
        name: 'request error processor: observe-api-error',
      }),
    );
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

describe('PROVIDER_TOOL_CALL observability spans', () => {
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
      name: 'web_search',
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
    messageList.add({ role: 'user', content: 'Search the web for AI news' }, 'input');

    bail = vi.fn(data => data);
  });

  it('creates a PROVIDER_TOOL_CALL span for provider-executed tools and closes it on tool-result', async () => {
    const providerToolSpan = {
      id: 'server-span-1',
      type: SpanType.PROVIDER_TOOL_CALL,
      end: vi.fn(),
    };
    const agentRunSpan = {
      id: 'agent-span',
      type: SpanType.AGENT_RUN,
      createChildSpan: vi.fn(() => providerToolSpan),
      findParent: vi.fn(),
    };

    const tools = {
      web_search: {
        type: 'provider' as const,
        id: 'anthropic.web_search',
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
            provider: 'anthropic',
            modelId: 'claude-sonnet-4-20250514',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: vi.fn(async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'resp-1',
                  modelId: 'claude-sonnet-4-20250514',
                  timestamp: new Date(0),
                },
                {
                  type: 'tool-call',
                  toolCallId: 'srvtoolu_123',
                  toolName: 'web_search',
                  input: '{"query":"AI news"}',
                },
                {
                  type: 'tool-result',
                  toolCallId: 'srvtoolu_123',
                  toolName: 'web_search',
                  result: { answer: 'Latest AI news results' },
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

    const executeParams = createExecuteParams(createIterationInput());
    executeParams.tracingContext = { currentSpan: agentRunSpan } as any;

    await llmExecutionStep.execute(executeParams);

    // Verify span was created with correct attributes
    expect(agentRunSpan.createChildSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SpanType.PROVIDER_TOOL_CALL,
        name: "provider_tool: 'web_search'",
        entityType: 'tool',
        entityId: 'web_search',
        entityName: 'web_search',
        attributes: expect.objectContaining({
          toolType: 'provider-tool',
          toolCallId: 'srvtoolu_123',
        }),
      }),
    );

    // Verify span was ended with the result
    expect(providerToolSpan.end).toHaveBeenCalledWith({
      output: { answer: 'Latest AI news results' },
      attributes: { success: true },
    });
  });

  it('does not create a PROVIDER_TOOL_CALL span when tracingContext is absent', async () => {
    const tools = {
      web_search: {
        type: 'provider' as const,
        id: 'anthropic.web_search',
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
            provider: 'anthropic',
            modelId: 'claude-sonnet-4-20250514',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: vi.fn(async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'resp-1',
                  modelId: 'claude-sonnet-4-20250514',
                  timestamp: new Date(0),
                },
                {
                  type: 'tool-call',
                  toolCallId: 'srvtoolu_456',
                  toolName: 'web_search',
                  input: '{"query":"test"}',
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

    const executeParams = createExecuteParams(createIterationInput());
    // No tracingContext — should not crash

    // Should complete without throwing
    const result = await llmExecutionStep.execute(executeParams);
    expect(result).toBeDefined();
  });

  it('does not create a PROVIDER_TOOL_CALL span for non-provider-executed tools', async () => {
    const agentRunSpan = {
      id: 'agent-span',
      type: SpanType.AGENT_RUN,
      createChildSpan: vi.fn(),
      findParent: vi.fn(),
    };

    const tools = {
      myTool: {
        id: 'myTool',
        description: 'A regular tool',
        inputSchema: z.object({ input: z.string() }),
        execute: vi.fn(),
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
            modelId: 'mock-model',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: vi.fn(async () => ({
              stream: convertArrayToReadableStream([
                {
                  type: 'response-metadata',
                  id: 'resp-1',
                  modelId: 'mock-model',
                  timestamp: new Date(0),
                },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'myTool',
                  input: '{"input":"hello"}',
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

    const executeParams = createExecuteParams(createIterationInput());
    executeParams.tracingContext = { currentSpan: agentRunSpan } as any;

    await llmExecutionStep.execute(executeParams);

    // createChildSpan should NOT have been called with PROVIDER_TOOL_CALL
    const serverToolCalls = (agentRunSpan.createChildSpan as Mock).mock.calls.filter(
      ([opts]: any[]) => opts.type === SpanType.PROVIDER_TOOL_CALL,
    );
    expect(serverToolCalls).toHaveLength(0);
  });
});
