import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { AnswerRelevancyScorer } from '@mastra/evals/scorers/llm';

const model = openai('gpt-4o-mini');

export const evalAgent = new Agent({
  name: 'Eval Agent',
  instructions: 'You are a helpful assistant that can evaluate code.',
  model: model,
  scorers: {
    answerRelevancy: {
      scorer: new AnswerRelevancyScorer({ model }),
      sampling: {
        type: 'ratio',
        rate: 0.5,
      },
    },
  },
});
