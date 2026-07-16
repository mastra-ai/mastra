import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { SpanType } from '../observability';
import { StreamErrorRetryProcessor } from '../processors';
import { createMockModel } from '../test-utils/llm-mock';
import { createScorer } from './base';
import {
  AsyncFunctionBasedScorerBuilders,
  FunctionBasedScorerBuilders,
  MixedScorerBuilders,
  PromptBasedScorerBuilders,
} from './base.test-utils';

const createTestData = () => ({
  inputText: 'test input',
  outputText: 'test output',
  get userInput() {
    return [{ role: 'user', content: this.inputText }];
  },
  get agentOutput() {
    return { role: 'assistant', text: this.outputText };
  },
  get scoringInput() {
    return { input: this.userInput, output: this.agentOutput };
  },
});

type JudgeModelResponse = Error | string;

function createJudgeModel(responses: JudgeModelResponse[]) {
  let callCount = 0;
  const prompts: unknown[] = [];

  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected non-streaming judge call');
    },
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      const response = responses[callCount] ?? responses.at(-1);
      callCount += 1;
      if (response instanceof Error) throw response;

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'judge-response', modelId: 'judge-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: response },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });

  return { model, getCallCount: () => callCount, getPrompts: () => prompts };
}

function createProviderError(statusCode: number, isRetryable: boolean, message = 'provider failed'): APICallError {
  const error = new APICallError({
    message,
    url: 'https://api.example.com/v1/responses',
    requestBodyValues: {},
    statusCode,
    responseHeaders: { 'retry-after': '1', 'x-request-id': 'request-123' },
    isRetryable,
  });
  Object.assign(error, { requestId: 'request-123' });
  return error;
}

function findAPICallError(error: unknown): APICallError | undefined {
  const visited = new WeakSet<object>();
  let candidate = error;

  while (candidate && typeof candidate === 'object') {
    if (APICallError.isInstance(candidate) || ('statusCode' in candidate && 'isRetryable' in candidate)) {
      return candidate as APICallError;
    }
    if (visited.has(candidate)) return undefined;
    visited.add(candidate);
    candidate = 'cause' in candidate ? candidate.cause : undefined;
  }

  return undefined;
}

function createMockSpan(traceId: string, type: SpanType) {
  const span: any = {
    id: `${type}-${Math.random().toString(36).slice(2)}`,
    traceId,
    type,
    isValid: true,
    isInternal: false,
    parent: undefined,
    end: vi.fn(),
    update: vi.fn(),
    error: vi.fn(),
    executeInContext: async (fn: () => Promise<unknown>) => fn(),
    findParent: vi.fn((targetType: SpanType) => {
      let current = span.parent;
      while (current) {
        if (current.type === targetType) {
          return current;
        }
        current = current.parent;
      }
      return undefined;
    }),
  };

  span.createChildSpan = vi.fn((options: { type: SpanType }) => {
    const child = createMockSpan(traceId, options.type);
    child.parent = span;
    return child;
  });

  return span;
}

function createMockMastra(options?: { addScoreImpl?: ReturnType<typeof vi.fn>; startSpan?: () => unknown }) {
  const logger = {
    debug: vi.fn(),
    warn: vi.fn(),
  };

  return {
    observability: {
      addScore: options?.addScoreImpl ?? vi.fn().mockResolvedValue(undefined),
      getSelectedInstance: vi.fn().mockReturnValue(
        options?.startSpan
          ? {
              startSpan: vi.fn().mockImplementation(options.startSpan),
            }
          : undefined,
      ),
    },
    getLogger: vi.fn().mockReturnValue(logger),
  };
}

describe('createScorer', () => {
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    testData = createTestData();
  });

  describe('Steps as functions scorer', () => {
    it('should create a basic scorer with functions', async () => {
      const scorer = FunctionBasedScorerBuilders.basic;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and analyze', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess only', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess, analyze, and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze only', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Steps as prompt objects scorer', () => {
    it('with analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess and analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withPreprocessAndAnalyze;

      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with analyze and reason prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(typeof result.reason).toBe('string');
      expect(result).toMatchSnapshot();
    });

    it('with generate score as prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withGenerateScoreAsPromptObject;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with all steps', async () => {
      const scorer = PromptBasedScorerBuilders.withAllSteps;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('forwards judge.jsonPromptInjection to agent.stream', async () => {
      const streamSpy = vi.spyOn(Agent.prototype, 'stream');
      try {
        const model = createMockModel({ mockText: { score: 1 }, version: 'v2' });

        const scorer = createScorer({
          id: 'json-prompt-injection-scorer',
          name: 'json-prompt-injection-scorer',
          description: 'Verifies jsonPromptInjection plumbing',
          judge: {
            model,
            instructions: 'Test instructions',
            jsonPromptInjection: true,
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        await scorer.run(testData.scoringInput);

        const [, options] = (streamSpy.mock.calls[0] ?? []) as any[];
        expect(options?.structuredOutput?.jsonPromptInjection).toBe(true);
      } finally {
        streamSpy.mockRestore();
      }
    });

    it('uses automatic structured output routing by default', async () => {
      const streamSpy = vi.spyOn(Agent.prototype, 'stream');
      try {
        const model = createMockModel({ mockText: { score: 1 }, version: 'v2' });

        const scorer = createScorer({
          id: 'automatic-json-routing-scorer',
          name: 'automatic-json-routing-scorer',
          description: 'Verifies the default structured output routing',
          judge: {
            model,
            instructions: 'Test instructions',
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        await scorer.run(testData.scoringInput);

        const [, options] = (streamSpy.mock.calls[0] ?? []) as any[];
        expect(options?.structuredOutput?.jsonPromptInjection).toBe('auto');
      } finally {
        streamSpy.mockRestore();
      }
    });

    it('forwards judge memory to the internal judge agent run', async () => {
      const streamSpy = vi
        .spyOn(Agent.prototype, 'stream')
        .mockResolvedValue({ object: Promise.resolve({ score: 1 }) } as any);
      try {
        const model = createMockModel({ mockText: { score: 1 }, version: 'v2' });
        const memory = { id: 'judge-memory' } as any;

        const scorer = createScorer({
          id: 'judge-memory-scorer',
          name: 'judge-memory-scorer',
          description: 'Verifies scorer judge memory plumbing',
          judge: {
            model,
            instructions: 'Test instructions',
            memory,
            defaultMemoryOptions: {
              thread: {
                id: 'thread-1-goal-1',
                metadata: { goalJudge: true, parentThreadId: 'thread-1', goalId: 'goal-1' },
              },
              resource: 'resource-1',
            },
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        await scorer.run(testData.scoringInput);

        const [, options] = (streamSpy.mock.calls[0] ?? []) as any[];
        expect(options?.memory).toEqual({
          thread: {
            id: 'thread-1-goal-1',
            metadata: { goalJudge: true, parentThreadId: 'thread-1', goalId: 'goal-1' },
          },
          resource: 'resource-1',
        });
      } finally {
        streamSpy.mockRestore();
      }
    });

    it('merges per-step judge memory options onto scorer defaults', async () => {
      const streamSpy = vi
        .spyOn(Agent.prototype, 'stream')
        .mockResolvedValue({ object: Promise.resolve({ value: 1 }) } as any);
      try {
        const model = createMockModel({ mockText: { value: 1 }, version: 'v2' });
        const memory = { id: 'judge-memory' } as any;

        const scorer = createScorer({
          id: 'judge-memory-merge-scorer',
          name: 'judge-memory-merge-scorer',
          description: 'Verifies per-step judge memory options merge with defaults',
          judge: {
            model,
            instructions: 'Top-level instructions',
            memory,
            defaultMemoryOptions: {
              thread: 'default-thread',
              resource: 'default-resource',
              options: { lastMessages: 3 } as any,
            },
          },
        })
          .analyze({
            description: 'analyze',
            outputSchema: z.object({ value: z.number() }),
            createPrompt: () => 'analyze this',
            judge: {
              model,
              instructions: 'Step instructions',
              memory: {
                thread: 'step-thread',
                options: { semanticRecall: { topK: 2 } } as any,
              },
            },
          })
          .generateScore(({ results }) => results.analyzeStepResult?.value ?? 0);

        await scorer.run(testData.scoringInput);

        const [, options] = (streamSpy.mock.calls[0] ?? []) as any[];
        expect(options?.memory).toEqual({
          thread: 'step-thread',
          resource: 'default-resource',
          options: { lastMessages: 3, semanticRecall: { topK: 2 } },
        });
      } finally {
        streamSpy.mockRestore();
      }
    });

    it('exposes the internal judge stream when it starts', async () => {
      let resolveObject!: (value: { score: number }) => void;
      const judgeStream = {
        object: new Promise(resolve => (resolveObject = resolve)),
        fullStream: new ReadableStream(),
      } as any;
      const streamSpy = vi.spyOn(Agent.prototype, 'stream').mockResolvedValue(judgeStream);
      try {
        const model = createMockModel({ mockText: { score: 1 }, version: 'v2' });
        const onStream = vi.fn(() => resolveObject({ score: 1 }));

        const scorer = createScorer({
          id: 'judge-stream-scorer',
          name: 'judge-stream-scorer',
          description: 'Verifies scorer judge stream observer plumbing',
          judge: {
            model,
            instructions: 'Test instructions',
            onStream,
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        await scorer.run(testData.scoringInput);

        expect(onStream).toHaveBeenCalledWith(judgeStream);
      } finally {
        streamSpy.mockRestore();
      }
    });

    it('forwards scorer-level judge processors to the internal judge agent', async () => {
      const streamSpy = vi
        .spyOn(Agent.prototype, 'stream')
        .mockResolvedValue({ object: Promise.resolve({ score: 1 }) } as any);
      try {
        const model = createMockModel({ mockText: { score: 1 }, version: 'v2' });
        const inputProcessor = { id: 'test-input-processor', processInput: ({ messages }: any) => messages };
        const outputProcessor = { id: 'test-output-processor', processOutputResult: ({ messages }: any) => messages };
        const errorProcessor = { id: 'test-error-retry-processor', processAPIError: () => ({ retry: true }) };

        const scorer = createScorer({
          id: 'judge-processors-scorer',
          name: 'judge-processors-scorer',
          description: 'Verifies scorer judge processor plumbing',
          judge: {
            model,
            instructions: 'Test instructions',
            inputProcessors: [inputProcessor],
            outputProcessors: [outputProcessor],
            errorProcessors: [errorProcessor],
            maxProcessorRetries: 3,
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        await scorer.run(testData.scoringInput);

        const judge = streamSpy.mock.instances[0] as Agent;
        expect(await judge.listConfiguredInputProcessors()).toContain(inputProcessor);
        expect(await judge.listConfiguredOutputProcessors()).toContain(outputProcessor);
        expect(await judge.listErrorProcessors()).toContain(errorProcessor);
      } finally {
        streamSpy.mockRestore();
      }
    });

    it('lets the per-step judge override the scorer-level error processors', async () => {
      const streamSpy = vi
        .spyOn(Agent.prototype, 'stream')
        .mockResolvedValue({ object: Promise.resolve({ value: 1 }) } as any);
      try {
        const model = createMockModel({ mockText: { value: 1 }, version: 'v2' });
        const scorerLevelErrorProcessor = { id: 'scorer-error-processor', processAPIError: () => ({ retry: true }) };
        const stepLevelErrorProcessor = { id: 'step-error-processor', processAPIError: () => ({ retry: true }) };

        const scorer = createScorer({
          id: 'judge-processors-override-scorer',
          name: 'judge-processors-override-scorer',
          description: 'Per-step override of judge error processors',
          judge: {
            model,
            instructions: 'Top-level instructions',
            errorProcessors: [scorerLevelErrorProcessor],
          },
        })
          .analyze({
            description: 'analyze',
            outputSchema: z.object({ value: z.number() }),
            createPrompt: () => 'analyze this',
            judge: {
              model,
              instructions: 'Step instructions',
              errorProcessors: [stepLevelErrorProcessor],
            },
          })
          .generateScore(({ results }) => results.analyzeStepResult?.value ?? 0);

        await scorer.run(testData.scoringInput);

        const judge = streamSpy.mock.instances[0] as Agent;
        const errorProcessors = await judge.listErrorProcessors();
        expect(errorProcessors).toContain(stepLevelErrorProcessor);
        expect(errorProcessors).not.toContain(scorerLevelErrorProcessor);
      } finally {
        streamSpy.mockRestore();
      }
    });

    it.each([408, 429, 500])(
      'retries a retryable V2 judge HTTP %s request within the failed scorer step',
      async statusCode => {
        const { model, getCallCount } = createJudgeModel([
          createProviderError(statusCode, true, 'transient provider failure'),
          JSON.stringify({ score: 1 }),
        ]);
        const scorer = createScorer({
          id: `v2-judge-retry-${statusCode}-scorer`,
          name: 'v2-judge-retry-scorer',
          description: 'Retries only the failed V2 judge generation',
          judge: {
            model,
            instructions: 'Test instructions',
            errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, maxRetryAfterMs: 0 })],
            maxProcessorRetries: 2,
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        await expect(scorer.run(testData.scoringInput)).resolves.toMatchObject({ score: 1 });
        expect(getCallCount()).toBe(2);
      },
    );

    describe('given a V2 judge with an error processor but no agent retry cap', () => {
      it('retries until the processor retry limit is reached', async () => {
        const { model, getCallCount } = createJudgeModel([
          createProviderError(429, true, 'rate limited'),
          createProviderError(429, true, 'rate limited'),
          JSON.stringify({ score: 1 }),
        ]);
        const scorer = createScorer({
          id: 'v2-judge-default-processor-cap-scorer',
          name: 'v2-judge-default-processor-cap-scorer',
          description: 'Uses the runtime error-processor retry cap when no agent cap is configured',
          judge: {
            model,
            instructions: 'Test instructions',
            errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, maxRetryAfterMs: 0 })],
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        await expect(scorer.run(testData.scoringInput)).resolves.toMatchObject({ score: 1 });
        expect(getCallCount()).toBe(3);
      });
    });

    it('does not retry a V2 judge request when processor configuration is omitted', async () => {
      const { model, getCallCount } = createJudgeModel([createProviderError(429, true, 'rate limited')]);
      const scorer = createScorer({
        id: 'v2-judge-no-retry-scorer',
        name: 'v2-judge-no-retry-scorer',
        description: 'Leaves V2 judge retries disabled without an error processor',
        judge: { model, instructions: 'Test instructions' },
      }).generateScore({
        description: 'score',
        createPrompt: () => 'score this',
      });

      await expect(scorer.run(testData.scoringInput)).rejects.toBeDefined();
      expect(getCallCount()).toBe(1);
    });

    it.each([
      ['authentication failure', 401, 'authentication failed'],
      ['invalid request', 400, 'invalid request'],
      ['context-length failure', 400, 'maximum context length exceeded'],
    ])('does not retry terminal V2 judge %s', async (_description, statusCode, message) => {
      const { model, getCallCount } = createJudgeModel([createProviderError(statusCode, false, message)]);
      const scorer = createScorer({
        id: `v2-judge-terminal-${statusCode}-${message}`,
        name: 'v2-judge-terminal-scorer',
        description: 'Fails terminal V2 judge errors immediately',
        judge: {
          model,
          instructions: 'Test instructions',
          errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, maxRetryAfterMs: 0 })],
          maxProcessorRetries: 2,
        },
      }).generateScore({
        description: 'score',
        createPrompt: () => 'score this',
      });

      await expect(scorer.run(testData.scoringInput)).rejects.toBeDefined();
      expect(getCallCount()).toBe(1);
    });

    it('retries a narrowly matched V2 judge network error', async () => {
      const networkError = Object.assign(new Error('socket hung up'), { code: 'ECONNRESET' });
      const { model, getCallCount } = createJudgeModel([networkError, JSON.stringify({ score: 1 })]);
      const scorer = createScorer({
        id: 'v2-judge-network-retry-scorer',
        name: 'v2-judge-network-retry-scorer',
        description: 'Retries a narrowly matched V2 judge network error',
        judge: {
          model,
          instructions: 'Test instructions',
          errorProcessors: [
            new StreamErrorRetryProcessor({
              maxRetries: 2,
              matchers: [
                error => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ECONNRESET',
              ],
            }),
          ],
          maxProcessorRetries: 2,
        },
      }).generateScore({
        description: 'score',
        createPrompt: () => 'score this',
      });

      await expect(scorer.run(testData.scoringInput)).resolves.toMatchObject({ score: 1 });
      expect(getCallCount()).toBe(2);
    });

    it('caps exhausted V2 judge retries and preserves provider context', async () => {
      const providerError = createProviderError(503, true, 'service unavailable');
      const { model, getCallCount } = createJudgeModel([providerError, providerError, providerError]);
      const scorer = createScorer({
        id: 'v2-judge-retry-exhaustion-scorer',
        name: 'v2-judge-retry-exhaustion-scorer',
        description: 'Preserves exhausted V2 judge provider errors',
        judge: {
          model,
          instructions: 'Test instructions',
          errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, maxRetryAfterMs: 0 })],
          maxProcessorRetries: 2,
        },
      }).generateScore({
        description: 'score',
        createPrompt: () => 'score this',
      });

      const error = await scorer.run(testData.scoringInput).catch(error => error);

      expect(getCallCount()).toBe(3);
      expect(findAPICallError(error)).toMatchObject({
        statusCode: 503,
        requestId: 'request-123',
        isRetryable: true,
        responseHeaders: { 'retry-after': '1', 'x-request-id': 'request-123' },
      });
    });

    it('does not rerun a successful score step when the reason step retries', async () => {
      const { model, getCallCount, getPrompts } = createJudgeModel([
        JSON.stringify({ score: 1 }),
        createProviderError(429, true, 'rate limited while generating reason'),
        'The score is supported by the output.',
      ]);
      const scorer = createScorer({
        id: 'v2-judge-reason-retry-scorer',
        name: 'v2-judge-reason-retry-scorer',
        description: 'Retries only the failed reason step',
        judge: {
          model,
          instructions: 'Test instructions',
          errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, maxRetryAfterMs: 0 })],
          maxProcessorRetries: 2,
        },
      })
        .generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        })
        .generateReason({
          description: 'reason',
          createPrompt: () => 'explain this score',
        });

      await expect(scorer.run(testData.scoringInput)).resolves.toMatchObject({
        score: 1,
        reason: 'The score is supported by the output.',
      });
      expect(getCallCount()).toBe(3);

      const serializedPrompts = getPrompts().map(prompt => JSON.stringify(prompt));
      expect(serializedPrompts.filter(prompt => prompt.includes('score this'))).toHaveLength(1);
      expect(serializedPrompts.filter(prompt => prompt.includes('explain this score'))).toHaveLength(2);
    });

    it('routes V1 judges through generateLegacy without error processors', async () => {
      const model = createMockModel({ mockText: { score: 1 }, version: 'v1' });
      const errorProcessor = { id: 'v1-error-processor', processAPIError: vi.fn(() => ({ retry: true })) };
      const generateLegacySpy = vi
        .spyOn(Agent.prototype, 'generateLegacy')
        .mockRejectedValueOnce(createProviderError(429, true));
      try {
        const scorer = createScorer({
          id: 'v1-legacy-judge-scorer',
          description: 'V1 scorer judges bypass error processors',
          judge: {
            model,
            instructions: 'Return a score.',
            errorProcessors: [errorProcessor],
            maxProcessorRetries: 2,
          },
        }).generateScore({ description: 'score', createPrompt: () => 'score this' });

        await expect(scorer.run(testData.scoringInput)).rejects.toThrow('provider failed');
        expect(generateLegacySpy).toHaveBeenCalledTimes(1);
        expect(errorProcessor.processAPIError).not.toHaveBeenCalled();
      } finally {
        generateLegacySpy.mockRestore();
      }
    });

    it('lets the per-step judge override the scorer-level jsonPromptInjection', async () => {
      const streamSpy = vi.spyOn(Agent.prototype, 'stream');
      try {
        const model = createMockModel({ mockText: { value: 1 }, version: 'v2' });

        const scorer = createScorer({
          id: 'json-prompt-injection-override-scorer',
          name: 'json-prompt-injection-override-scorer',
          description: 'Per-step override of jsonPromptInjection',
          judge: {
            model,
            instructions: 'Top-level instructions',
            jsonPromptInjection: true,
          },
        })
          .analyze({
            description: 'analyze',
            outputSchema: z.object({ value: z.number() }),
            createPrompt: () => 'analyze this',
            judge: {
              model,
              instructions: 'Step instructions',
              jsonPromptInjection: false,
            },
          })
          .generateScore(({ results }) => results.analyzeStepResult?.value ?? 0);

        await scorer.run(testData.scoringInput);

        const [, options] = (streamSpy.mock.calls[0] ?? []) as any[];
        expect(options?.structuredOutput?.jsonPromptInjection).toBe(false);
      } finally {
        streamSpy.mockRestore();
      }
    });

    it('retries the judge with jsonPromptInjection when the first attempt yields no structured object', async () => {
      // Regression guard: a judge model can resolve *without throwing* but
      // produce no parseable structured object. The judge must recover via the
      // jsonPromptInjection retry instead of crashing when it reads result.object.
      const model = createMockModel({ mockText: { score: 1 }, version: 'v2' });
      const streamSpy = vi
        .spyOn(Agent.prototype, 'stream')
        .mockResolvedValueOnce({ object: Promise.resolve(undefined) } as any)
        .mockResolvedValueOnce({ object: Promise.resolve({ score: 1 }) } as any);
      try {
        const scorer = createScorer({
          id: 'json-fallback-recovery-scorer',
          name: 'json-fallback-recovery-scorer',
          description: 'Recovers from an undefined structured object via jsonPromptInjection',
          judge: {
            model,
            instructions: 'Test instructions',
          },
        }).generateScore({
          description: 'score',
          createPrompt: () => 'score this',
        });

        const result = await scorer.run(testData.scoringInput);

        // Two stream calls: automatic routing first, then the existing fallback retry.
        expect(streamSpy).toHaveBeenCalledTimes(2);
        expect(((streamSpy.mock.calls as any)[0]?.[1] as any)?.structuredOutput?.jsonPromptInjection).toBe('auto');
        expect(((streamSpy.mock.calls as any)[1]?.[1] as any)?.structuredOutput?.jsonPromptInjection).toBe(true);
        // The scorer recovered and produced the retried score.
        expect(result.score).toBe(1);
      } finally {
        streamSpy.mockRestore();
      }
    });
  });

  describe('Mixed scorer', () => {
    it('with preprocess function and analyze prompt object', async () => {
      const scorer = MixedScorerBuilders.withPreprocessFunctionAnalyzePrompt;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withPreprocessPromptAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with reason function and analyze prompt', async () => {
      const scorer = MixedScorerBuilders.withReasonFunctionAnalyzePrompt;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with reason prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withReasonPromptAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Async scorer', () => {
    it('with basic', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.basic;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess function and analyze as prompt object', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessFunctionAndAnalyzePromptObject;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt object and analyze function', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessPromptObjectAndAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in analyze', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateScore', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateScore;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateReason', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Observability score emission', () => {
    it('should emit addScore when targetTraceId is provided', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'observed-scorer',
        description: 'Observed scorer',
      })
        .generateScore(() => 0.9)
        .generateReason(() => 'great');

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'live',
        targetTraceId: 'trace-123',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-123',
        score: {
          scorerId: 'observed-scorer',
          scorerName: 'observed-scorer',
          scoreSource: 'live',
          score: 0.9,
          reason: 'great',
          metadata: {
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should emit addScore without a target trace id when unanchored scoring is allowed', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'unanchored-scorer',
        description: 'Unanchored scorer',
      }).generateScore(() => 0.75);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'experiment',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        score: {
          scorerId: 'unanchored-scorer',
          scorerName: 'unanchored-scorer',
          scoreSource: 'experiment',
          score: 0.75,
          metadata: {
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should include scoreTraceId when scorer tracing is enabled', async () => {
      const mockMastra = createMockMastra({
        startSpan: () => createMockSpan('score-trace-1', SpanType.SCORER_RUN),
      });

      const scorer = createScorer({
        id: 'traced-scorer',
        description: 'Traced scorer',
      })
        .generateScore(() => 0.42)
        .generateReason(() => 'ok');

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'trace',
        targetTraceId: 'trace-abc',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-abc',
        score: expect.objectContaining({
          scorerId: 'traced-scorer',
          scorerName: 'traced-scorer',
          scoreSource: 'trace',
          score: 0.42,
          reason: 'ok',
          scoreTraceId: 'score-trace-1',
          metadata: {
            hasGroundTruth: false,
          },
        }),
      });
    });

    it('should include hasGroundTruth metadata when ground truth is provided', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'ground-truth-scorer',
        description: 'Ground truth scorer',
      }).generateScore(() => 1);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        groundTruth: { expected: 'answer' },
        targetTraceId: 'trace-gt',
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-gt',
        spanId: undefined,
        score: expect.objectContaining({
          scorerId: 'ground-truth-scorer',
          scorerName: 'ground-truth-scorer',
          metadata: {
            hasGroundTruth: true,
          },
        }),
      });
    });

    it('should forward live target correlation context and metadata to addScore', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'contextual-scorer',
        description: 'Contextual scorer',
      }).generateScore(() => 0.91);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'live',
        targetTraceId: 'trace-live',
        targetSpanId: 'span-live',
        targetCorrelationContext: {
          traceId: 'trace-live',
          spanId: 'span-live',
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
        targetMetadata: {
          sessionId: 'session-1',
          inherited: true,
        },
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        traceId: 'trace-live',
        spanId: 'span-live',
        correlationContext: {
          traceId: 'trace-live',
          spanId: 'span-live',
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
        score: {
          scorerId: 'contextual-scorer',
          scorerName: 'contextual-scorer',
          scoreSource: 'live',
          score: 0.91,
          metadata: {
            sessionId: 'session-1',
            inherited: true,
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should emit addScore with correlation context even when targetTraceId is absent', async () => {
      const mockMastra = createMockMastra();

      const scorer = createScorer({
        id: 'unanchored-contextual-scorer',
        description: 'Unanchored contextual scorer',
      }).generateScore(() => 0.67);

      scorer.__registerMastra(mockMastra as any);

      await scorer.run({
        ...testData.scoringInput,
        scoreSource: 'live',
        targetCorrelationContext: {
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
      });

      expect(mockMastra.observability.addScore).toHaveBeenCalledWith({
        correlationContext: {
          entityName: 'tool-call',
          parentEntityName: 'agent-run',
          rootEntityName: 'workflow-root',
          source: 'cloud',
          serviceName: 'test-service',
        },
        score: {
          scorerId: 'unanchored-contextual-scorer',
          scorerName: 'unanchored-contextual-scorer',
          scoreSource: 'live',
          score: 0.67,
          metadata: {
            hasGroundTruth: false,
          },
        },
      });
    });

    it('should not fail scorer.run when addScore throws', async () => {
      const mockMastra = createMockMastra({
        addScoreImpl: vi.fn().mockRejectedValue(new Error('observability failed')),
      });

      const scorer = createScorer({
        id: 'resilient-scorer',
        description: 'Resilient scorer',
      }).generateScore(() => 0.8);

      scorer.__registerMastra(mockMastra as any);

      await expect(
        scorer.run({
          ...testData.scoringInput,
          scoreSource: 'live',
          targetTraceId: 'trace-456',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          score: 0.8,
        }),
      );

      expect(mockMastra.observability.addScore).toHaveBeenCalledTimes(1);
      expect(mockMastra.getLogger().warn).toHaveBeenCalled();
    });
  });
});
