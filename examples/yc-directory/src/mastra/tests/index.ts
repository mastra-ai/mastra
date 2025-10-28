import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/llm';
import { runExperiment } from '@mastra/core/scores';
import { ycAgent } from '../agents';

const scorer = createAnswerRelevancyScorer({
  model: 'openai/gpt-4o',
  options: {
    scale: 1,
    uncertaintyWeight: 0.3,
  },
});

runExperiment({
  data: [{ input: 'Can you tell me what recent YC companies are working on AI Frameworks?' }],
  scorers: [scorer],
  target: ycAgent,
});
