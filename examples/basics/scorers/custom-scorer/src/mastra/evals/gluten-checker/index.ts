import { openai } from '@ai-sdk/openai';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';
import { generateGlutenPrompt, generateReasonPrompt, GLUTEN_INSTRUCTIONS } from './prompts';

export const glutenCheckerScorer = createScorer({
  name: 'Gluten Checker',
  description: 'Check if the output contains any gluten',
  judge: {
    model: openai('gpt-4o'),
    instructions: GLUTEN_INSTRUCTIONS,
  },
})
  .analyze({
    description: 'Analyze the output for gluten',
    outputSchema: z.object({
      isGlutenFree: z.boolean(),
      glutenSources: z.array(z.string()),
    }),
    createPrompt: ({ run }) => {
      const { output } = run;
      return generateGlutenPrompt({ output: output.text });
    },
  })
  .generateScore(({ results }) => {
    return results.analyzeStepResult.isGlutenFree ? 1 : 0;
  })
  .generateReason({
    description: 'Generate a reason for the score',
    createPrompt: ({ results }) => {
      return generateReasonPrompt({
        glutenSources: results.analyzeStepResult.glutenSources,
        isGlutenFree: results.analyzeStepResult.isGlutenFree,
      });
    },
  });
