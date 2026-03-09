import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/prebuilt';
import { runEvals } from '@mastra/core/evals';
import { ycAgent } from '../agents';

const scorer = createAnswerRelevancyScorer({
  model: 'openai/gpt-4o',
  options: {
    scale: 1,
    uncertaintyWeight: 0.3,
  },
});

runEvals({
  data: [{ input: 'Can you tell me what recent YC companies are working on AI Frameworks?' }],
  scorers: [scorer],
  target: ycAgent,
});
