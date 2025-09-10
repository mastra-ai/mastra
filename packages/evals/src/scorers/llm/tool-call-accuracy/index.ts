import type { Tool } from '@mastra/core';
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
import { TOOL_SELECTION_ACCURACY_INSTRUCTIONS, createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface ToolCallAccuracyOptions {
  model: MastraLanguageModel;
  availableTools: Tool[];
}

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
  const toolDefinitions = availableTools.map(tool => `${tool.id}: ${tool.description}`).join('\n');

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Tool Call Accuracy (LLM)',
    description: 'Evaluates whether an agent selected appropriate tools for the given task using LLM analysis',
    judge: {
      model,
      instructions: TOOL_SELECTION_ACCURACY_INSTRUCTIONS,
    },
  })
    .preprocess(async ({ run }) => {
      const isInputInvalid = !run.input || !run.input.inputMessages || run.input.inputMessages.length === 0;
      const isOutputInvalid = !run.output || run.output.length === 0;

      if (isInputInvalid || isOutputInvalid) {
        throw new Error('Input and output messages cannot be null or empty');
      }

      const { tools: actualTools, toolCallInfos } = extractToolCalls(run.output);

      return {
        actualTools,
        hasToolCalls: actualTools.length > 0,
        toolCallInfos,
      };
    })
    .analyze({
      description: 'Analyze the appropriateness of tool selections',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run, results }) => {
        const userInput = getUserMessageFromRunInput(run.input) ?? '';
        const agentResponse = getAssistantMessageFromRunOutput(run.output) ?? '';

        const toolsCalled = results.preprocessStepResult?.actualTools || [];

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
