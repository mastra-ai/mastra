export const contextRelevanceScorer = {
  id: 'context-relevance',
  name: 'Context Relevance',
  description: 'Evaluates how relevant and useful provided context was for generating agent responses',
  category: 'context-quality',
  filename: 'context-relevance-scorer.ts',
  type: 'llm',
  content: `
import { openai } from '@ai-sdk/openai';
import { createContextRelevanceScorerLLM } from '@mastra/evals';
 
const scorer = createContextRelevanceScorerLLM({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      'The Great Barrier Reef is located in Australia.',
      'Coral reefs need warm water to survive.',
      'Many fish species live in coral reefs.',
      'Australia has six states and two territories.',
      'The capital of Australia is Canberra.',
    ],
    scale: 1,
  },
});
 
const result = await scorer.run({
  input: {
    inputMessages: [
      {
        id: '1',
        role: 'user',
        content: 'What is the capital of Australia?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content: 'The capital of Australia is Canberra.',
    },
  ],
});
 
console.log(result);
  `
};