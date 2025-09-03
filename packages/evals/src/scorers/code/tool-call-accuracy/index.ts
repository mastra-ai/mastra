import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';
import { extractToolCalls } from '../../utils';

interface ToolCallAccuracyOptions {
  expectedTool?: string;
  strictMode?: boolean;
  expectedToolOrder?: string[];
}

function checkToolOrder(actualTools: string[], expectedOrder: string[], strictMode: boolean = false): boolean {
  if (strictMode) {
    return JSON.stringify(actualTools) === JSON.stringify(expectedOrder);
  }

  const expectedIndices: number[] = [];
  for (const expectedTool of expectedOrder) {
    const index = actualTools.indexOf(expectedTool);
    if (index === -1) {
      return false;
    }
    expectedIndices.push(index);
  }

  for (let i = 1; i < expectedIndices.length; i++) {
    const currentIndex = expectedIndices[i];
    const prevIndex = expectedIndices[i - 1];
    if (currentIndex !== undefined && prevIndex !== undefined && currentIndex <= prevIndex) {
      return false;
    }
  }

  return true;
}

function calculateAccuracy({
  expectedTool,
  actualTools,
  strictMode = false,
  expectedToolOrder,
}: {
  expectedTool?: string;
  actualTools: string[];
  strictMode?: boolean;
  expectedToolOrder?: string[];
}): number {
  if (actualTools.length === 0) {
    return 0;
  }

  if (expectedToolOrder && expectedToolOrder.length > 0) {
    return checkToolOrder(actualTools, expectedToolOrder, strictMode) ? 1 : 0;
  }

  if (!expectedTool) {
    return 0;
  }

  if (strictMode) {
    return actualTools.length === 1 && actualTools[0] === expectedTool ? 1 : 0;
  }

  return actualTools.includes(expectedTool) ? 1 : 0;
}

export function createToolCallAccuracyScorerCode(options: ToolCallAccuracyOptions) {
  const { expectedTool, strictMode = false, expectedToolOrder } = options;

  if (!expectedTool && !expectedToolOrder) {
    throw new Error('Either expectedTool or expectedToolOrder must be provided');
  }

  const getDescription = () => {
    return expectedToolOrder
      ? `Evaluates whether the LLM called tools in the correct order: [${expectedToolOrder.join(', ')}]`
      : `Evaluates whether the LLM selected the correct tool (${expectedTool}) from the available tools`;
  };

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Tool Call Accuracy',
    description: getDescription(),
  })
    .preprocess(async ({ run }) => {
      const isInputInvalid = !run.input || !run.input.inputMessages || run.input.inputMessages.length === 0;
      const isOutputInvalid = !run.output || run.output.length === 0;

      if (isInputInvalid || isOutputInvalid) {
        throw new Error('Input and output messages cannot be null or empty');
      }

      const { tools: actualTools, toolCallInfos } = extractToolCalls(run.output);

      const correctToolCalled = expectedTool
        ? strictMode
          ? actualTools.length === 1 && actualTools[0] === expectedTool
          : actualTools.includes(expectedTool)
        : false;

      return {
        expectedTool,
        actualTools,
        strictMode,
        expectedToolOrder,
        hasToolCalls: actualTools.length > 0,
        correctToolCalled,
        toolCallInfos,
        correctOrderCalled: expectedToolOrder ? checkToolOrder(actualTools, expectedToolOrder, strictMode) : null,
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
        expectedToolOrder: preprocessResult.expectedToolOrder,
      });
    });
}
