import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ToolStream } from '../../../tools/stream';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../../../workflows/constants';
import type { ExecuteFunctionParams } from '../../../workflows/step';
import type { OuterLLMRun } from '../../types';
import { testUsage } from '../../test-utils/utils';
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

  it('should infer providerExecuted and merge streamed gateway tool results into tool calls', async () => {
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
    const [toolCall] = llmResult.output.toolCalls ?? [];

    expect(toolCall).toEqual(
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'perplexity_search',
        providerExecuted: true,
        output: { answer: 'fresh gateway result' },
      }),
    );
    expect(llmResult.stepResult.isContinued).toBe(true);

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
      inputData: toolCall,
    });

    expect(toolResult).toEqual(
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'perplexity_search',
        result: { answer: 'fresh gateway result' },
      }),
    );
    expect(executeSpy).not.toHaveBeenCalled();
  });
});
