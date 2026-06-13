import { z } from 'zod';
import { createStep } from '../../../../workflows';
import { MessageList } from '../../../message-list';
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
      const {
        llmOutput,
        toolResults,
        runId: _runId,
        agentId: _agentId,
        messageId,
        state,
      } = inputData as {
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
        for (const toolResult of toolResults) {
          const result = toolResult.error ? toolResult.error.message : toolResult.result;
          const updated = messageList.updateToolInvocation({
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              args: toolResult.args,
              result,
            },
          });

          if (!updated) {
            messageList.add(
              [
                {
                  role: 'tool' as const,
                  content: [
                    {
                      type: 'tool-result' as const,
                      toolCallId: toolResult.toolCallId,
                      toolName: toolResult.toolName,
                      result,
                      isError: toolResult.error !== undefined,
                    },
                  ],
                },
              ],
              'response',
            );
          }
        }
      }

      // 3. Determine if we should continue.
      // Preserve the LLM step's isContinued (which respects finishReason). Tool
      // error results are already written to the message list above, so keeping
      // the loop going lets the model see them and self-correct on the next step,
      // matching the non-durable Agent.stream() loop. maxSteps bounds runaway
      // loops, so we don't terminate the run just because a step's tools errored.
      const isContinued = llmOutput.stepResult.isContinued;

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
          text: llmOutput.text,
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
