import type { MastraMessageV2 } from '@mastra/core/agent';

const isToolCallWithId = (message: MastraMessageV2 | undefined, targetToolCallId: string): boolean => {
  if (!message || !message.content || !Array.isArray(message.content.parts)) return false;
  return message.content.parts.some(
    part =>
      part &&
      part.type === 'tool-invocation' &&
      part.toolInvocation.state === 'call' &&
      part.toolInvocation.toolCallId === targetToolCallId,
  );
};

const getToolResultIndexById = (id: string, results: MastraMessageV2[]) =>
  results.findIndex(message => {
    if (!message || !message.content || !Array.isArray(message.content.parts)) return false;
    return message.content.parts.some(
      part =>
        part &&
        part.type === 'tool-invocation' &&
        part.toolInvocation.state === 'result' &&
        part.toolInvocation.toolCallId === id,
    );
  });

/**
 * Self-heals message ordering to ensure tool calls are directly before their matching tool results.
 * This is needed due to a bug where messages were saved in the wrong order. That bug is fixed, but this code ensures any tool calls saved in the wrong order in the past will still be usable now.
 */
export function reorderToolCallsAndResults(messages: MastraMessageV2[]): MastraMessageV2[] {
  if (!messages.length) return messages;

  // Create a copy of messages to avoid modifying the original
  const results = [...messages];

  const toolCallIds = new Set<string>();

  // First loop: collect all tool result IDs in a set
  for (const message of results) {
    if (!message.content || !Array.isArray(message.content.parts)) continue;

    for (const part of message.content.parts) {
      if (
        part &&
        part.type === 'tool-invocation' &&
        part.toolInvocation.state === 'result' &&
        part.toolInvocation.toolCallId
      ) {
        toolCallIds.add(part.toolInvocation.toolCallId);
      }
    }
  }

  // Second loop: for each tool ID, ensure tool calls come before tool results
  for (const toolCallId of toolCallIds) {
    // Find tool result index
    const resultIndex = getToolResultIndexById(toolCallId, results);

    // Check if tool call is at resultIndex - 1
    const oneMessagePrev = results[resultIndex - 1];
    if (isToolCallWithId(oneMessagePrev, toolCallId)) {
      continue; // Tool call is already in the correct position
    }

    // Find the tool call anywhere in the array
    const toolCallIndex = results.findIndex(message => isToolCallWithId(message, toolCallId));

    if (toolCallIndex !== -1 && toolCallIndex !== resultIndex - 1) {
      // Store the tool call message
      const toolCall = results[toolCallIndex];
      if (!toolCall) continue;

      // Remove the tool call from its current position
      results.splice(toolCallIndex, 1);

      // Insert right before the tool result
      // Need to re-calculate resultIndex as splice might have shifted indices
      results.splice(getToolResultIndexById(toolCallId, results), 0, toolCall);
    }
  }

  return results;
}
