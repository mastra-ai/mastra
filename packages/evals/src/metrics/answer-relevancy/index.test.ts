import { it, expect, jest } from '@jest/globals';
import { type ModelConfig } from '@mastra/core';

import { AnswerRelevancyMetric } from './index';

const SECONDS = 1000;
jest.setTimeout(15 * SECONDS);

const modelConfig: ModelConfig = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
  toolChoice: 'auto',
  apiKey: process.env.OPENAI_API_KEY,
};

it('should be able to measure answer relevancy', async () => {
  const metric = new AnswerRelevancyMetric(modelConfig);

  const result = await metric.measure({
    input: `We offer a 30-day full refund at no extra cost.`,
    output: 'Shoes. The shoes can be refunded at no extra cost. Thanks for asking the question!',
  });

  expect(result.score).toBe(3);
});
