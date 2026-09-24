import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMastraLogger } from '../../logger';
import type { Processor } from '../../processors';
import { __resetProcessorRetryWarnings, DEFAULT_MAX_PROCESSOR_RETRIES } from '../../processors/retry-budget';
import { Agent } from '../agent';

/**
 * Regression tests for the implicit `maxProcessorRetries` budget.
 *
 * An error processor that always asks to retry used to be granted an
 * undocumented budget of 10 retries, turning a single turn into 11 model
 * calls even when the model itself was configured with `maxRetries: 0`.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/24435
 */

function createAlwaysFailingModel() {
  let callCount = 0;

  const failure = () =>
    new APICallError({
      message: 'bad request',
      url: 'https://api.example.com/v1/messages',
      requestBodyValues: {},
      statusCode: 400,
      responseBody: JSON.stringify({ error: { message: 'bad request' } }),
      isRetryable: false,
    });

  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      throw failure();
    },
    doStream: async () => {
      callCount++;
      throw failure();
    },
  });

  return { model, getCallCount: () => callCount };
}

function createSucceedOnRetryModel(responseText: string, failuresBeforeSuccess: number) {
  let callCount = 0;

  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount <= failuresBeforeSuccess) {
        throw new APICallError({
          message: 'bad request',
          url: 'https://api.example.com/v1/messages',
          requestBodyValues: {},
          statusCode: 400,
          responseBody: JSON.stringify({ error: { message: 'bad request' } }),
          isRetryable: false,
        });
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },
    doStream: async () => {
      callCount++;
      if (callCount <= failuresBeforeSuccess) {
        throw new APICallError({
          message: 'bad request',
          url: 'https://api.example.com/v1/messages',
          requestBodyValues: {},
          statusCode: 400,
          responseBody: JSON.stringify({ error: { message: 'bad request' } }),
          isRetryable: false,
        });
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });

  return { model, getCallCount: () => callCount };
}

/** A deliberately badly behaved processor: it never stops asking for a retry. */
function createAlwaysRetryProcessor(): Processor {
  return {
    id: 'always-retry',
    name: 'Always Retry',
    async processAPIError() {
      return { retry: true };
    },
  };
}

/** Runs a generate call that is expected to fail, swallowing however it reports failure. */
async function runExpectingFailure(run: () => Promise<unknown>) {
  try {
    await run();
  } catch {
    // The budget-exhausted path may reject or resolve empty; both are covered below.
  }
}

describe('implicit maxProcessorRetries budget', () => {
  beforeEach(() => {
    __resetProcessorRetryWarnings();
  });

  it('caps a runaway error processor well below the old implicit budget of 10', async () => {
    const { model, getCallCount } = createAlwaysFailingModel();

    const agent = new Agent({
      id: 'retry-budget-runaway',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [createAlwaysRetryProcessor()],
    });

    await runExpectingFailure(() => agent.generate('hello'));

    // 1 initial call + the implicit safety cap. Previously this was 11.
    expect(getCallCount()).toBe(DEFAULT_MAX_PROCESSOR_RETRIES + 1);
  });

  it('makes no processor retries when maxProcessorRetries is explicitly 0', async () => {
    const { model, getCallCount } = createAlwaysFailingModel();

    const agent = new Agent({
      id: 'retry-budget-zero',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [createAlwaysRetryProcessor()],
    });

    await runExpectingFailure(() => agent.generate('hello', { maxProcessorRetries: 0 }));

    expect(getCallCount()).toBe(1);
  });

  it('honors an explicit maxProcessorRetries above the implicit cap', async () => {
    const { model, getCallCount } = createAlwaysFailingModel();

    const agent = new Agent({
      id: 'retry-budget-explicit',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [createAlwaysRetryProcessor()],
    });

    // maxSteps is raised too, since processor retries consume the step budget.
    await runExpectingFailure(() => agent.generate('hello', { maxProcessorRetries: 6, maxSteps: 30 }));

    expect(getCallCount()).toBe(7);
  });

  it('counts each processor retry against the agent step budget', async () => {
    const { model, getCallCount } = createAlwaysFailingModel();

    const agent = new Agent({
      id: 'retry-budget-steps',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [createAlwaysRetryProcessor()],
    });

    // `stopWhen` defaults to stepCountIs(5), and processor retries are loop
    // iterations, so the step budget bounds the retries before the retry budget
    // does. This is why a high maxProcessorRetries needs a raised maxSteps too.
    await runExpectingFailure(() => agent.generate('hello', { maxProcessorRetries: 20 }));

    expect(getCallCount()).toBe(5);
  });

  it('still lets a well-behaved processor recover on its first retry', async () => {
    const { model, getCallCount } = createSucceedOnRetryModel('recovered', 1);

    const agent = new Agent({
      id: 'retry-budget-recovers',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [createAlwaysRetryProcessor()],
    });

    const result = await agent.generate('hello');

    expect(result.text).toBe('recovered');
    expect(getCallCount()).toBe(2);
  });
});

describe('implicit maxProcessorRetries warning', () => {
  function capturingLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trackException: vi.fn(),
      getTransports: vi.fn().mockReturnValue(new Map()),
      listLogs: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
      listLogsByRunId: vi.fn().mockResolvedValue({ logs: [], total: 0, page: 1, perPage: 10, hasMore: false }),
    } satisfies IMastraLogger;
  }

  const budgetWarning = (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('maxProcessorRetries');

  beforeEach(() => {
    __resetProcessorRetryWarnings();
  });

  it('warns once when the caller configured error processors without maxProcessorRetries', async () => {
    const { model } = createAlwaysFailingModel();
    const logger = capturingLogger();

    const agent = new Agent({
      id: 'retry-budget-warns',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [createAlwaysRetryProcessor()],
    });
    agent.__registerPrimitives({ logger });

    await runExpectingFailure(() => agent.generate('hello'));

    const warnings = logger.warn.mock.calls.filter(budgetWarning);
    expect(warnings.length).toBe(1);
  });

  it('does not warn for a bare agent whose only error processors are the framework defaults', async () => {
    const { model, getCallCount } = createSucceedOnRetryModel('recovered', 1);
    const logger = capturingLogger();

    const agent = new Agent({
      id: 'retry-budget-quiet',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
    });
    agent.__registerPrimitives({ logger });

    const result = await agent.generate('hello');

    // The framework default retry processor recovered the transient 400…
    expect(result.text).toBe('recovered');
    expect(getCallCount()).toBe(2);
    // …and the safety cap still applied, but silently.
    expect(logger.warn.mock.calls.filter(budgetWarning).length).toBe(0);
  });

  it('does not warn when maxProcessorRetries is set explicitly', async () => {
    const { model } = createAlwaysFailingModel();
    const logger = capturingLogger();

    const agent = new Agent({
      id: 'retry-budget-explicit-quiet',
      name: 'Retry Budget Agent',
      instructions: 'You are a test agent',
      model: [{ model, maxRetries: 0 }],
      errorProcessors: [createAlwaysRetryProcessor()],
      maxProcessorRetries: 1,
    });
    agent.__registerPrimitives({ logger });

    await runExpectingFailure(() => agent.generate('hello'));

    expect(logger.warn.mock.calls.filter(budgetWarning).length).toBe(0);
  });
});
