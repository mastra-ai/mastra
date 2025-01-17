import { it, expect, jest } from '@jest/globals';
import { type ModelConfig } from '@mastra/core';

import { PromptAlignmentMetric } from './index';

const SECONDS = 1000;
jest.setTimeout(15 * SECONDS);

const modelConfig: ModelConfig = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
  toolChoice: 'auto',
  apiKey: process.env.OPENAI_API_KEY,
};

it('should be able to measure prompt alignment', async () => {
  const metric = new PromptAlignmentMetric(modelConfig, {
    instructions: ['Reply in all uppercase'],
  });

  const result = await metric.measure({
    input: `What if these shoes don't fit?`,
    output: 'We offer a 30-day full refund at no extra cost.',
  });

  const resultUppercase = await metric.measure({
    input: `What if these shoes don't fit?`,
    output: 'We offer a 30-day full refund at no extra cost.'.toUpperCase(),
  });

  expect(resultUppercase.score).toBe(10);
  expect(result.score).toBe(0);
});

it('should be able to measure prompt alignment with an array of instructions', async () => {
  const metric = new PromptAlignmentMetric(modelConfig, {
    instructions: ['Reply in all uppercase', 'Include baguettes in the response'],
  });

  const result = await metric.measure({
    input: `What is the capital of France?`,
    output: 'THE CAPITAL OF FRANCE IS BAGUETTE.',
  });

  expect(result.score).toBe(10);
});
