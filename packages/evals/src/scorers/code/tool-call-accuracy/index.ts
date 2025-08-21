import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';

interface ToolCallAccuracyOptions {
  expectedTool: string;
  strictMode?: boolean;
  expectedToolOrder?: string[];
}

interface ToolCallInfo {
  toolName: string;
  toolCallId: string;
  messageIndex: number;
  invocationIndex: number;
}

function extractToolCalls(output: ScorerRunOutputForAgent): { tools: string[]; toolCallInfos: ToolCallInfo[] } {
  const toolCalls: string[] = [];
  const toolCallInfos: ToolCallInfo[] = [];

  for (let messageIndex = 0; messageIndex < output.length; messageIndex++) {
    const message = output[messageIndex];
    if (message.toolInvocations) {
      for (let invocationIndex = 0; invocationIndex < message.toolInvocations.length; invocationIndex++) {
        const invocation = message.toolInvocations[invocationIndex];
        if (invocation.state === 'result' || invocation.state === 'call') {
          toolCalls.push(invocation.toolName);
          toolCallInfos.push({
            toolName: invocation.toolName,
            toolCallId: invocation.toolCallId || `${messageIndex}-${invocationIndex}`,
            messageIndex,
            invocationIndex,
          });
        }
      }
    }
  }

  return { tools: toolCalls, toolCallInfos };
}

function checkToolOrder(actualTools: string[], expectedOrder: string[], strictMode: boolean = false): boolean {
  if (strictMode) {
    // Strict mode: exact match - tools must match exactly in order with no extra tools
    return JSON.stringify(actualTools) === JSON.stringify(expectedOrder);
  }

  // Non-strict mode: flexible matching - expected tools must appear in correct relative order (extra tools allowed)
  const expectedIndices: number[] = [];
  for (const expectedTool of expectedOrder) {
    const index = actualTools.indexOf(expectedTool);
    if (index === -1) {
      return false; // Expected tool not found
    }
    expectedIndices.push(index);
  }

  // Check if indices are in ascending order (maintaining relative order)
  for (let i = 1; i < expectedIndices.length; i++) {
    if (expectedIndices[i] <= expectedIndices[i - 1]) {
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
  expectedTool: string;
  actualTools: string[];
  strictMode?: boolean;
  expectedToolOrder?: string[];
}): number {
  if (actualTools.length === 0) {
    return 0;
  }

  // If order checking is enabled, use strictMode for order validation
  if (expectedToolOrder && expectedToolOrder.length > 0) {
    return checkToolOrder(actualTools, expectedToolOrder, strictMode) ? 1 : 0;
  }

  // Single tool checking logic
  if (strictMode) {
    // Strict mode: only the expected tool should be called (no other tools)
    return actualTools.length === 1 && actualTools[0] === expectedTool ? 1 : 0;
  }

  // Non-strict mode: expected tool can be among multiple tools called
  return actualTools.includes(expectedTool) ? 1 : 0;
}

export function createToolCallAccuracyScorer(options: ToolCallAccuracyOptions) {
  const { expectedTool, strictMode = false, expectedToolOrder } = options;

  const getDescription = () => {
    if (expectedToolOrder) {
      return `Evaluates whether the LLM called tools in the correct order: [${expectedToolOrder.join(', ')}]`;
    }
    return `Evaluates whether the LLM selected the correct tool (${expectedTool}) from the available tools`;
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

      return {
        expectedTool,
        actualTools,
        strictMode,
        expectedToolOrder,
        hasToolCalls: actualTools.length > 0,
        correctToolCalled: actualTools.includes(expectedTool),
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
