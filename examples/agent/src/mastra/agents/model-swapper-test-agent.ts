import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { ModelSwapperProcessor } from '@mastra/core/processors';
import type { ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';
import { extractInputMessages, extractToolCalls } from '@mastra/evals/scorers/utils';
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

const expectedToolAliases: Record<string, string> = {
  'get-weather': 'weatherTool',
  'general-search': 'searchTool',
};

const normalizeExpectedTool = (toolName: string) => expectedToolAliases[toolName] ?? toolName;

const getExpectedTool = (groundTruth: unknown, inputText: string) => {
  if (
    typeof groundTruth === 'string' &&
    ['get-weather', 'general-search', 'weatherTool', 'searchTool'].includes(groundTruth)
  ) {
    return normalizeExpectedTool(groundTruth);
  }

  if (typeof groundTruth === 'object' && groundTruth !== null && 'expectedTool' in groundTruth) {
    const expectedTool = (groundTruth as { expectedTool?: unknown }).expectedTool;
    if (
      typeof expectedTool === 'string' &&
      ['get-weather', 'general-search', 'weatherTool', 'searchTool'].includes(expectedTool)
    ) {
      return normalizeExpectedTool(expectedTool);
    }
  }

  return /weather|temperature|forecast/i.test(inputText) ? 'weatherTool' : 'searchTool';
};

export const modelSwapperToolCallAccuracyScorer = createScorer({
  id: 'model-swapper-tool-call-accuracy',
  name: 'Model Swapper Tool Call Accuracy',
  description: 'Checks whether the model swapper test agent called the expected weather or search tool.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const inputText = extractInputMessages(run.input).join('\n');
    const expectedTool = getExpectedTool(run.groundTruth, inputText);
    const { tools } = extractToolCalls(run.output);

    return {
      expectedTool,
      actualTools: tools,
    };
  })
  .generateScore(({ results }) => {
    const result = results.preprocessStepResult;
    if (!result) return 0;

    return result.actualTools.includes(result.expectedTool) ? 1 : 0;
  });

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
  description: 'Test agent for validating mini-by-default routing with gpt-5.5 for research and planning.',
  instructions: `You are a test agent for dynamic model routing.

Use get-weather for direct weather questions.
Use general-search for research, planning, comparisons, or anything that needs synthesis beyond a single weather lookup.
Keep responses concise and mention which tool you used.`,
  model: 'openai/gpt-5.5',
  tools: {
    weatherTool,
    searchTool,
  },
  inputProcessors: [
    new LoggingModelSwapperProcessor({
      model: 'cerebras/gpt-oss-120b',
      defaultModel: 'openai/gpt-5-mini',
      rules: [
        {
          description:
            'Research, planning, comparison, synthesis, strategy, or multi-step analysis tasks that benefit from a stronger model.',
          model: 'openai/gpt-5.5',
        },
      ],
    }),
  ],
  scorers: {
    toolCallAccuracy: {
      scorer: modelSwapperToolCallAccuracyScorer,
    },
  },
});
