import { Agent } from '@mastra/core/agent';
import { ModelSwapperProcessor } from '@mastra/core/processors';
import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { weatherTool } from '../tools/weather-tool';

class LoggingModelSwapperProcessor extends ModelSwapperProcessor {
  processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult {
    const result = super.processInputStep(args);

    if (args.stepNumber === 0) {
      console.log('[model-swapper-test-agent] selected model:', result.model ?? args.model);
    }

    return result;
  }
}

const searchTool = createTool({
  id: 'general-search',
  description: 'Search for general information and return mocked source snippets for testing model routing.',
  inputSchema: z.object({
    query: z.string().describe('The search query to run'),
  }),
  outputSchema: z.object({
    query: z.string(),
    results: z.array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
      }),
    ),
  }),
  execute: async ({ query }) => ({
    query,
    results: [
      {
        title: `Mock result for ${query}`,
        snippet: 'This is a mocked search result for validating the model swapper example agent.',
        url: 'https://example.com/search-result',
      },
      {
        title: `Background on ${query}`,
        snippet: 'Use this result when answering requests that require broader research or synthesis.',
        url: 'https://example.com/background',
      },
    ],
  }),
});

export const modelSwapperTestAgent = new Agent({
  id: 'model-swapper-test-agent',
  name: 'Model Swapper Test Agent',
  description: 'Test agent for validating simple requests use gpt-5-mini and complex requests use gpt-5.5.',
  instructions: `You are a test agent for dynamic model routing.

Use get-weather for direct weather questions.
Use general-search for broader research questions, comparisons, or anything that needs synthesis beyond a single weather lookup.
Keep responses concise and mention which tool you used.`,
  model: 'openai/gpt-5-mini',
  tools: {
    weatherTool,
    searchTool,
  },
  inputProcessors: [
    new LoggingModelSwapperProcessor({
      model: 'openai/gpt-5-mini',
      defaultModel: 'openai/gpt-5-mini',
      rules: [
        {
          description: 'Direct weather lookups that only need the weather tool for one location.',
          model: 'openai/gpt-5-mini',
        },
        {
          description:
            'Research, comparison, planning, synthesis, or multi-part questions that benefit from a stronger model.',
          model: 'openai/gpt-5.5',
        },
      ],
    }),
  ],
});
