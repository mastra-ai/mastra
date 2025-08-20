import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';

interface ToolCallAccuracyOptions {
  expectedTool: string;
  strictMode?: boolean;
}

function extractToolCalls(output: ScorerRunOutputForAgent): string[] {
  const toolCalls: string[] = [];
  
  for (const message of output) {
    if (message.toolInvocations) {
      for (const invocation of message.toolInvocations) {
        if (invocation.state === 'result' || invocation.state === 'call') {
          toolCalls.push(invocation.toolName);
        }
      }
    }
  }
  
  return toolCalls;
}

function calculateAccuracy({
  expectedTool,
  actualTools,
  strictMode = false,
}: {
  expectedTool: string;
  actualTools: string[];
  strictMode?: boolean;
}): number {
  if (actualTools.length === 0) {
    return 0;
  }

  if (strictMode) {
    return actualTools.length === 1 && actualTools[0] === expectedTool ? 1 : 0;
  }

  return actualTools.includes(expectedTool) ? 1 : 0;
}

export function createToolCallAccuracyScorer(options: ToolCallAccuracyOptions) {
  const { expectedTool, strictMode = false } = options;

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Tool Call Accuracy',
    description: `Evaluates whether the LLM selected the correct tool (${expectedTool}) from the available tools`,
  })
    .preprocess(async ({ run }) => {
      const isInputInvalid = !run.input || !run.input.inputMessages || run.input.inputMessages.length === 0;
      const isOutputInvalid = !run.output || run.output.length === 0;

      if (isInputInvalid || isOutputInvalid) {
        throw new Error('Input and output messages cannot be null or empty');
      }

      const actualTools = extractToolCalls(run.output);

      return {
        expectedTool,
        actualTools,
        strictMode,
        hasToolCalls: actualTools.length > 0,
        correctToolCalled: actualTools.includes(expectedTool),
      };
    })
    .generateScore(({ results }) => {
      const preprocessResult = results.preprocessStepResult;
      if (!preprocessResult) {
        return 0;
      }

      return calculateAccuracy({
        expectedTool: preprocessResult.expectedTool,
        actualTools: preprocessResult.actualTools,
        strictMode: preprocessResult.strictMode,
      });
    });
}