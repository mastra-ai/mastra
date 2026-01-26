import { z } from 'zod';
import { createStep } from '../../../../workflows';
import { MessageList } from '../../../message-list';
import type { MastraDBMessage } from '../../../message-list';
import { DurableStepIds } from '../../constants';
import type {
  DurableLLMStepOutput,
  DurableToolCallOutput,
  DurableAgenticExecutionOutput,
  SerializableDurableState,
} from '../../types';

/**
 * Input schema for the durable LLM mapping step.
 * This combines the LLM execution output with tool call results.
 */
const durableLLMMappingInputSchema = z.object({
  llmOutput: z.any(), // DurableLLMStepOutput
  toolResults: z.array(z.any()), // DurableToolCallOutput[]
  runId: z.string(),
  agentId: z.string(),
  messageId: z.string(),
  state: z.any(), // SerializableDurableState
});

/**
 * Output schema for the durable LLM mapping step
 */
const durableLLMMappingOutputSchema = z.object({
  messageListState: z.any(),
  messageId: z.string(),
  stepResult: z.any(),
  toolResults: z.array(z.any()),
  output: z.object({
    text: z.string().optional(),
    toolCalls: z.array(z.any()).optional(),
    usage: z.any(),
    steps: z.array(z.any()),
  }),
  state: z.any(),
  processorRetryCount: z.number().optional(),
  processorRetryFeedback: z.string().optional(),
});

/**
 * Create a durable LLM mapping step.
 *
 * This step:
 * 1. Takes the LLM execution output and tool call results
 * 2. Updates the message list with tool results
 * 3. Combines everything into the final iteration output
 *
 * This is the "merge" step that combines parallel tool call results
 * back into a single coherent state.
 */
export function createDurableLLMMappingStep() {
  return createStep({
    id: DurableStepIds.LLM_MAPPING,
    inputSchema: durableLLMMappingInputSchema,
    outputSchema: durableLLMMappingOutputSchema,
    execute: async ({ inputData }) => {
      const { llmOutput, toolResults, runId, agentId, messageId, state } = inputData as {
        llmOutput: DurableLLMStepOutput;
        toolResults: DurableToolCallOutput[];
        runId: string;
        agentId: string;
        messageId: string;
        state: SerializableDurableState;
      };

      // 1. Deserialize message list
      const messageList = new MessageList({
        threadId: state.threadId,
        resourceId: state.resourceId,
      });
      messageList.deserialize(llmOutput.messageListState);

      // 2. Add tool results to message list
      if (toolResults.length > 0) {
        // Create tool result parts for each tool call
        const toolResultParts = toolResults.map(toolResult => {
          // Determine the result content
          let resultContent: string;
          if (toolResult.error) {
            resultContent = `Error: ${toolResult.error.message}`;
          } else if (toolResult.result !== undefined) {
            resultContent =
              typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result);
          } else {
            resultContent = '';
          }

          return {
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              args: toolResult.args,
              result: resultContent,
            },
          };
        });

        // Add as assistant message with tool results
        const toolResultMessage: MastraDBMessage = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: {
            format: 2,
            parts: toolResultParts,
          },
          createdAt: new Date(),
        };

        messageList.add(toolResultMessage, 'response');
      }

      // 3. Determine if we should continue
      const hasToolCalls = llmOutput.toolCalls.length > 0;
      const allToolsErrored = toolResults.length > 0 && toolResults.every(r => r.error !== undefined);

      // Continue if there were tool calls and not all errored
      // The finish reason 'tool-calls' or having pending tool calls indicates we should continue
      const isContinued = hasToolCalls && !allToolsErrored;

      // 4. Build the output
      const output: DurableAgenticExecutionOutput = {
        messageListState: messageList.serialize(),
        messageId,
        stepResult: {
          ...llmOutput.stepResult,
          isContinued,
        },
        toolResults,
        output: {
          text: undefined, // Text is in the LLM output, would be extracted from assistant message
          toolCalls: llmOutput.toolCalls,
          usage: llmOutput.stepResult.totalUsage ?? {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          steps: [], // Steps are accumulated at the loop level
        },
        state: {
          ...state,
          threadExists: state.threadExists,
        },
        processorRetryCount: llmOutput.processorRetryCount,
        processorRetryFeedback: llmOutput.processorRetryFeedback,
      };

      return output;
    },
  });
}
