/**
 * Thread view reconstruction for Braintrust.
 *
 * Reconstructs LLM output in OpenAI Chat Completion format by examining
 * child MODEL_STEP and TOOL_CALL spans. This enables Braintrust's Thread
 * view to properly display the full conversation flow including tool calls.
 *
 * See THREAD_VIEW_RECONSTRUCTION.md for details.
 */

import { removeNullish } from './formatter';
import type { OpenAIMessage } from './formatter';

// ==============================================================================
// Thread view reconstruction types
// ==============================================================================

/**
 * Tool call data accumulated from MODEL_STEP and TOOL_CALL spans
 */
export interface ThreadToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown; // filled in when TOOL_CALL ends
  startTime?: Date; // from TOOL_CALL span, for ordering multiple tool calls within a step
}

/**
 * Step data accumulated from MODEL_STEP spans for Thread view reconstruction
 */
export interface ThreadStepData {
  stepSpanId: string;
  stepIndex: number; // for ordering steps correctly
  text?: string;
  toolCalls?: ThreadToolCall[];
}

/**
 * Accumulated data for reconstructing Braintrust Thread view.
 * Populated for MODEL_GENERATION spans as child MODEL_STEP and TOOL_CALL spans complete.
 */
export type ThreadData = ThreadStepData[];

/**
 * Tool result data stored when TOOL_CALL spans end (before MODEL_STEP ends)
 */
export interface PendingToolResult {
  result: unknown;
  startTime: Date;
}

// ==============================================================================
// Thread view reconstruction
// ==============================================================================

/**
 * Reconstruct the Thread view output from accumulated threadData.
 * Converts to OpenAI Chat Completion message format.
 */
export function reconstructThreadOutput(threadData: ThreadData, originalOutput: unknown): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];

  // Sort steps by stepIndex
  const sortedSteps = [...threadData].sort((a, b) => a.stepIndex - b.stepIndex);

  for (const step of sortedSteps) {
    // Sort tool calls by startTime within each step
    const sortedToolCalls = step.toolCalls
      ? [...step.toolCalls].sort((a, b) => {
          if (!a.startTime || !b.startTime) return 0;
          return a.startTime.getTime() - b.startTime.getTime();
        })
      : [];

    if (sortedToolCalls.length > 0) {
      // Add assistant message with tool_calls
      messages.push({
        role: 'assistant',
        content: step.text || '',
        tool_calls: sortedToolCalls.map(tc => {
          // Clean null/undefined values from args before stringifying
          const cleanArgs =
            tc.args && typeof tc.args === 'object' && !Array.isArray(tc.args)
              ? removeNullish(tc.args as Record<string, unknown>)
              : tc.args;
          return {
            id: tc.toolCallId,
            type: 'function' as const,
            function: {
              name: tc.toolName,
              arguments: typeof cleanArgs === 'string' ? cleanArgs : JSON.stringify(cleanArgs),
            },
          };
        }),
      });

      // Add tool messages for each result
      for (const tc of sortedToolCalls) {
        if (tc.result !== undefined) {
          messages.push({
            role: 'tool',
            content: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result),
            tool_call_id: tc.toolCallId,
          });
        }
      }
    } else if (step.text) {
      // Step with text only (final response)
      messages.push({
        role: 'assistant',
        content: step.text,
      });
    }
  }

  // If we have messages and the last one is a tool message,
  // add the final assistant text from original output
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1]!;
    const originalText = (originalOutput as { text?: string })?.text;

    // If the last message is a tool response and we have final text, add it
    if (originalText && lastMessage.role === 'tool') {
      messages.push({
        role: 'assistant',
        content: originalText,
      });
    }
  }

  return messages;
}
