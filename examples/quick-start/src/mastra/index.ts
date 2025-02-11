import { Mastra } from '@mastra/core';
import { ToneConsistencyMetric } from '@mastra/evals/nlp';

import { catOne } from './agents/agent';

export const mastra = new Mastra({
  agents: { catOne },
  logger: false,
  metrics: [new ToneConsistencyMetric()],
});
