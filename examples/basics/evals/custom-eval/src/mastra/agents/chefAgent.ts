import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { RecipeCompletenessMetric } from '../evals';

const model = openai('gpt-4o-mini');
export const chefAgent = new Agent({
  name: 'chef-agent',
  instructions:
    'You are Michel, a practical and experienced home chef' +
    'You help people cook with whatever ingredients they have available.',
  model,
  evals: {
    recipeCompleteness: new RecipeCompletenessMetric(model),
  },
});
