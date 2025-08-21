import type { MastraLanguageModel } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';
import {
  extractToolCalls,
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
  roundToTwoDecimals,
} from '../../utils';
import {
  TOOL_SELECTION_ACCURACY_INSTRUCTIONS,
  createAnalyzePrompt,
  createExtractToolsPrompt,
  createReasonPrompt,
} from './prompts';

export interface ToolCallAccuracyOptions {
  model: MastraLanguageModel;
  availableTools: Array<{ name: string; description: string }>;
}

const extractOutputSchema = z.object({
  toolsCalled: z.array(z.string()),
});

const analyzeOutputSchema = z.object({
  evaluations: z.array(
    z.object({
      toolCalled: z.string(),
      wasAppropriate: z.boolean(),
      reasoning: z.string(),
    }),
  ),
  missingTools: z.array(z.string()).optional(),
});

export function createToolCallAccuracyScorerLLM({ model, availableTools }: ToolCallAccuracyOptions) {
  const toolDefinitions = availableTools.map(tool => `${tool.name}: ${tool.description}`).join('\n');

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Tool Call Accuracy (LLM)',
    description: 'Evaluates whether an agent selected appropriate tools for the given task using LLM analysis',
    judge: {
      model,
      instructions: TOOL_SELECTION_ACCURACY_INSTRUCTIONS,
    },
  })
    .preprocess({
      description: 'Extract tool calls from the agent output',
      outputSchema: extractOutputSchema,
      createPrompt: ({ run }) => {
        const agentResponse = getAssistantMessageFromRunOutput(run.output) ?? '';
        return createExtractToolsPrompt(agentResponse);
      },
    })
    .analyze({
      description: 'Analyze the appropriateness of tool selections',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run, results }) => {
        const userInput = getUserMessageFromRunInput(run.input) ?? '';
        const agentResponse = getAssistantMessageFromRunOutput(run.output) ?? '';

        // Also extract actual tool calls from the output for comparison
        const { tools: actualToolCalls } = extractToolCalls(run.output);

        // Use actual tool calls if available, otherwise use LLM-extracted ones
        const toolsCalled =
          actualToolCalls.length > 0 ? actualToolCalls : results.preprocessStepResult?.toolsCalled || [];

        return createAnalyzePrompt({
          userInput,
          agentResponse,
          toolsCalled,
          availableTools: toolDefinitions,
        });
      },
    })
    .generateScore(({ results }) => {
      const evaluations = results.analyzeStepResult?.evaluations || [];

      // Handle edge case: no tools called
      if (evaluations.length === 0) {
        // Check if tools should have been called
        const missingTools = results.analyzeStepResult?.missingTools || [];
        return missingTools.length > 0 ? 0.0 : 1.0;
      }

      const appropriateToolCalls = evaluations.filter(e => e.wasAppropriate).length;
      const totalToolCalls = evaluations.length;

      return roundToTwoDecimals(appropriateToolCalls / totalToolCalls);
    })
    .generateReason({
      description: 'Generate human-readable explanation of tool selection evaluation',
      createPrompt: ({ run, results, score }) => {
        const userInput = getUserMessageFromRunInput(run.input) ?? '';
        const evaluations = results.analyzeStepResult?.evaluations || [];
        const missingTools = results.analyzeStepResult?.missingTools || [];

        return createReasonPrompt({
          userInput,
          score,
          evaluations,
          missingTools,
        });
      },
    });
}
