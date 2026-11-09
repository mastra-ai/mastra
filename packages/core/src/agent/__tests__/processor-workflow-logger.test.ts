import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { expect, it, vi } from 'vitest';
import { noopLogger } from '../../logger';
import type { Processor } from '../../processors/index';
import { Agent } from '../index';

// MockLanguageModelV2: the processor fails before any model call, and the assertion is on the
// agent logger, which aimock scenarios cannot observe.
it('logs a failing input processor through the agent logger', async () => {
  const failingProcessor = {
    id: 'failing-processor',
    processInput: async () => {
      throw new Error('processor failed');
    },
  } satisfies Processor;

  const agent = new Agent({
    id: 'logger-propagation-test-agent',
    name: 'Logger Propagation Test Agent',
    instructions: 'You are a helpful assistant.',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        content: [{ type: 'text', text: 'should not get here' }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    }),
    inputProcessors: [failingProcessor],
  });

  const logger = { ...noopLogger, debug: vi.fn(), error: vi.fn(), trackException: vi.fn() };
  agent.__setLogger(logger);

  await expect(agent.generate('trigger failure')).rejects.toThrow('Input processor error');
  expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('processor:failing-processor'));
  expect(logger.trackException).toHaveBeenCalledTimes(1);
});
