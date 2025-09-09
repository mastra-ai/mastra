export const contextPrecisionScorer = {
  id: 'context-precision',
  name: 'Context Precision',
  description: 'Evaluates how relevant and well-positioned retrieved context pieces are for generating expected outputs.',
  category: 'context-quality',
  filename: 'context-precision-scorer.ts',
  type: 'llm',
  content:
`
import { openai } from '@ai-sdk/openai';
import { createContextPrecisionScorer } from '@mastra/evals';
 
const scorer = createContextPrecisionScorer({
  model: openai('gpt-4o-mini'),
  options: {
    context: [
      'The weather forecast shows sunny skies this weekend.',
      'Coffee is one of the world\'s most popular beverages.',
      'Machine learning requires large amounts of training data.',
      'Cats typically sleep 12-16 hours per day.',
      'The capital of France is Paris.',
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
        content: 'How does photosynthesis work?',
      },
    ],
  },
  output: [
    {
      id: '2',
      role: 'assistant',
      content: 'Photosynthesis is the process by which plants convert sunlight into energy using chlorophyll.',
    },
  ],
});
 
console.log(result);
` 
};