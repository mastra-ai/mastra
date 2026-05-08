import { createScorer } from '@mastra/core/evals';

export const responseQualityScorer = createScorer({
  id: 'response-quality',
  name: 'Response Quality Scorer',
  description: 'Evaluates the quality of agent responses',
}).generateScore(async () => 0.85);

export const responseTimeScorer = createScorer({
  id: 'response-time',
  name: 'Response Time Scorer',
  description: 'Measures response latency performance',
}).generateScore(async () => 0.92);
