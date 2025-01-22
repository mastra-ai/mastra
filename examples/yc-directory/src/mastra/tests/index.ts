import { evaluate } from '@mastra/evals';
import { AnswerRelevancyMetric } from '@mastra/evals/llm';

import { ycAgent } from '../agents';

const model = {
  provider: 'OPEN_AI',
  name: 'gpt-40',
} as const;

const metric = new AnswerRelevancyMetric(model, {
  scale: 1,
});

const result = await evaluate(ycAgent, 'Can you tell me about AI Frameworks in recent YC companies?', metric);

console.log(result);
