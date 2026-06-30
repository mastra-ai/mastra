import { z } from 'zod';
import type { Mastra } from '../../../../mastra';
import type { ExportedSpan, SpanType } from '../../../../observability';
import { createStep } from '../../../../workflows/workflow';
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
    execute: async ({ inputData, mastra, requestContext }) => {
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
          const isDeniedApproval = toolResult.approval?.approved === false;
          const result = toolResult.error
            ? toolResult.error.message
            : isDeniedApproval
              ? (toolResult.approval?.reason ?? 'Tool call was not approved by the user')
              : toolResult.result;
          const updated = messageList.updateToolInvocation({
            type: 'tool-invocation' as const,
            toolInvocation: isDeniedApproval
              ? {
                  state: 'output-denied' as const,
                  toolCallId: toolResult.toolCallId,
                  toolName: toolResult.toolName,
                  args: toolResult.args,
                  approval: {
                    ...toolResult.approval!,
                    reason: toolResult.approval?.reason ?? 'Tool call was not approved by the user',
                  },
                }
              : {
                  state: 'result' as const,
                  toolCallId: toolResult.toolCallId,
                  toolName: toolResult.toolName,
                  args: toolResult.args,
                  result,
                  ...(toolResult.approval ? { approval: toolResult.approval } : {}),
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

      // 3. Determine if we should continue
      // Preserve the LLM step's isContinued (which respects finishReason).
      // Keep ToolNotFoundError recoverable so the model can see the error and
      // retry with one of the currently available tool names.
      const allToolsErrored = toolResults.length > 0 && toolResults.every(r => r.error !== undefined);
      const allToolsNotFound = allToolsErrored && toolResults.every(r => r.error?.name === 'ToolNotFoundError');
      const isContinued = llmOutput.stepResult.isContinued && (!allToolsErrored || allToolsNotFound);

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

      // Close the MODEL_STEP span for tool-calling iterations: the LLM step defers it so
      // tool calls can nest under it, and the tools have now run. No-ops without tool calls.
      if (llmOutput.stepSpanData) {
        try {
          const observability = (mastra as Mastra | undefined)?.observability?.getSelectedInstance({ requestContext });
          const stepSpan = observability?.rebuildSpan(llmOutput.stepSpanData as ExportedSpan<SpanType.MODEL_STEP>);
          const pendingPayload = llmOutput.stepFinishPayload as any;
          stepSpan?.end({
            output: {
              text: llmOutput.text,
              toolCalls: llmOutput.toolCalls,
            },
            attributes: {
              usage: pendingPayload?.output?.usage,
              finishReason: pendingPayload?.stepResult?.reason,
              isContinued: pendingPayload?.stepResult?.isContinued,
            },
          });
        } catch (error) {
          // Span bookkeeping must never break the merge step.
          (mastra as Mastra | undefined)
            ?.getLogger?.()
            ?.warn?.(`[DurableAgent] Failed to close model_step span: ${error}`);
        }
      }

      return output;
    },
  });
}
