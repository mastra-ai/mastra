import { evaluate } from '@mastra/evals';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

import { ycAgent } from '../agents';

const model = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
} as const;

const metric = new AnswerRelevancyMetric(model, {
  scale: 1,
});

const result = await evaluate(
  ycAgent,
  'Can you tell me what recent YC companies are working on AI Frameworks?',
  metric,
);

console.log(result);
