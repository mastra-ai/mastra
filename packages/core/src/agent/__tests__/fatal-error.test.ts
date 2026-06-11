import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../index';
import { FatalError } from '../fatal-error';

class QuotaExceededError extends Error {
  public readonly code = 'QUOTA_EXCEEDED' as const;
  public readonly retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'QuotaExceededError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function makeMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'ok' }],
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
  });
}

describe('FatalError propagation', () => {
  it('input processor abort.fatal(err) re-throws the original error instance', async () => {
    const fatalProcessor: any = {
      id: 'fatal-input',
      name: 'Fatal Input',
      processInput: async ({ abort, messages }: any) => {
        abort.fatal(new QuotaExceededError('over quota', 60));
        return messages;
      },
    };

    const agent = new Agent({
      id: 'fatal-input-agent',
      name: 'Fatal Input Agent',
      instructions: 'noop',
      model: makeMockModel(),
      inputProcessors: [fatalProcessor],
    });

    await expect(agent.generate('hello')).rejects.toMatchObject({
      name: 'QuotaExceededError',
      code: 'QUOTA_EXCEEDED',
      retryAfterSeconds: 60,
    });

    try {
      await agent.generate('hello');
    } catch (err) {
      expect(err).toBeInstanceOf(QuotaExceededError);
      expect(err).not.toBeInstanceOf(FatalError);
    }
  });

  it('FatalError thrown directly from a workflow step is captured on result.fatal', async () => {
    const failingStep = createStep({
      id: 'failing',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        throw new FatalError(new QuotaExceededError('over quota', 30));
      },
    });

    const workflow = createWorkflow({
      id: 'fatal-step-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(failingStep)
      .commit();

    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('failed');
    const fatal = (result as { fatal?: { cause: unknown; processorId?: string } }).fatal;
    expect(fatal).toBeDefined();
    expect(fatal!.cause).toBeInstanceOf(QuotaExceededError);
    expect((fatal!.cause as QuotaExceededError).code).toBe('QUOTA_EXCEEDED');
    expect((fatal!.cause as QuotaExceededError).retryAfterSeconds).toBe(30);
  });

  it('isFatalError detects FatalError instances', async () => {
    const { isFatalError } = await import('../fatal-error');
    expect(isFatalError(new FatalError(new Error('x')))).toBe(true);
    expect(isFatalError(new Error('x'))).toBe(false);
    expect(isFatalError(null)).toBe(false);
    expect(isFatalError(undefined)).toBe(false);
  });

  it('FatalError preserves cause as the original error instance', () => {
    const original = new QuotaExceededError('x', 1);
    const fatal = new FatalError(original, 'my-processor');
    expect(fatal.cause).toBe(original);
    expect(fatal.processorId).toBe('my-processor');
    expect(fatal.name).toBe('FatalError');
  });
});
