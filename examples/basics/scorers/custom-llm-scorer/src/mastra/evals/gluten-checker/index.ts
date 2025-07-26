import { openai } from '@ai-sdk/openai';
import { createLLMScorer } from '@mastra/core/scores';
import { z } from 'zod';
import { generateGlutenPrompt, generateReasonPrompt, GLUTEN_INSTRUCTIONS } from './prompts';

export const glutenCheckerScorer = createLLMScorer({
  name: 'Gluten Checker',
  description: 'Check if the output contains any gluten',
  judge: {
    model: openai('gpt-4o'),
    instructions: GLUTEN_INSTRUCTIONS,
  },
  analyze: {
    description: 'Analyze the output for gluten',
    outputSchema: z.object({
      glutenSources: z.array(z.string()),
    }),
    createPrompt: ({ run }) => {
      const { output } = run;
      const prompt = generateGlutenPrompt({ output: output.text });
      return prompt;
    },
  },
  calculateScore: ({ run }) => {
    return run.analyzeStepResult.glutenSources.length > 0 ? 0 : 1;
  },
  reason: {
    createPrompt: ({ run }) => {
      const { analyzeStepResult } = run;
      return generateReasonPrompt({
        glutenSources: analyzeStepResult.glutenSources,
        isGlutenFree: analyzeStepResult.glutenSources.length === 0,
      });
    },
  },
});
