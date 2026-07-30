/**
 * Shared tool invocation extraction from MastraDBMessages.
 *
 * Used by both the Outcome and Efficiency scorers to extract completed
 * tool calls from message content, handling both the `parts` array (primary)
 * and the legacy `toolInvocations` array.
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraMessagePart, MastraToolInvocation } from '@mastra/core/agent/message-list';

export type ExtractedToolCall = {
  toolCallId?: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  isError: boolean;
  index: number;
};

function isToolInvocationPart(part: MastraMessagePart): part is MastraMessagePart & {
  type: 'tool-invocation';
  toolInvocation: MastraToolInvocation;
} {
  return 'type' in part && part.type === 'tool-invocation' && 'toolInvocation' in part;
}

function isCompleted(inv: { state: string }): boolean {
  return (
    inv.state === 'result' || inv.state === 'error' || inv.state === 'output-error' || inv.state === 'output-denied'
  );
}

function isErrorState(inv: { state: string }): boolean {
  return inv.state === 'error' || inv.state === 'output-error' || inv.state === 'output-denied';
}

/**
 * Extract completed tool invocations from MastraDBMessages.
 *
 * Handles both:
 * - `content.parts` (primary format, MastraToolInvocationPart)
 * - `content.toolInvocations` (legacy format, AI SDK ToolInvocation[])
 */
export function extractToolCalls(messages: MastraDBMessage[]): ExtractedToolCall[] {
  const results: ExtractedToolCall[] = [];
  const seenToolCallIds = new Set<string>();
  let index = 0;

  for (const msg of messages) {
    if (!msg.content) continue;

    // Primary format: parts array with tool-invocation parts
    for (const part of msg.content.parts ?? []) {
      if (isToolInvocationPart(part)) {
        const inv = part.toolInvocation;
        if (isCompleted(inv)) {
          const toolCallId = 'toolCallId' in inv ? (inv.toolCallId as string) : undefined;
          if (toolCallId) seenToolCallIds.add(toolCallId);

          results.push({
            toolCallId,
            toolName: inv.toolName ?? '',
            args: (inv.args ?? {}) as Record<string, unknown>,
            result: inv.result,
            isError: isErrorState(inv),
            index: index++,
          });
        }
      }
    }

    // Legacy format: toolInvocations array (AI SDK ToolInvocation)
    // Only states here are 'partial-call' | 'call' | 'result' — no error state.
    if (msg.content.toolInvocations) {
      for (const inv of msg.content.toolInvocations) {
        if (inv.state === 'result') {
          // Skip if we already extracted this from parts (deduplicate by toolCallId)
          const toolCallId = 'toolCallId' in inv ? inv.toolCallId : undefined;
          if (toolCallId && seenToolCallIds.has(toolCallId)) continue;
          if (toolCallId) seenToolCallIds.add(toolCallId);

          results.push({
            toolCallId,
            toolName: inv.toolName ?? '',
            args: (inv.args ?? {}) as Record<string, unknown>,
            result: inv.result,
            isError: false,
            index: index++,
          });
        }
      }
    }
  }

  return results;
}
