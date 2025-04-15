import type { MessageType } from '@mastra/core/memory';

const isToolCallWithId = (message: MessageType | undefined, targetToolCallId: string): boolean => {
  if (!message || !Array.isArray(message.content)) return false;
  return message.content.some(
    part =>
      part &&
      typeof part === 'object' &&
      'type' in part &&
      part.type === 'tool-call' &&
      'toolCallId' in part &&
      part.toolCallId === targetToolCallId,
  );
};

/**
 * Self-heals message ordering to ensure tool calls are directly before their matching tool results.
 */
export function reorderToolCallsAndResults(messages: MessageType[]): MessageType[] {
  if (!messages.length) return messages;

  // Create a copy of messages to avoid modifying the original
  const results = [...messages];

  const toolCallIds = new Set<string>();

  // First loop: collect all tool result IDs in a set
  for (const message of results) {
    if (!Array.isArray(message.content)) continue;

    for (const part of message.content) {
      if (
        part &&
        typeof part === 'object' &&
        'type' in part &&
        part.type === 'tool-result' &&
        'toolCallId' in part &&
        part.toolCallId
      ) {
        toolCallIds.add(part.toolCallId);
      }
    }
  }

  // Second loop: for each tool ID, ensure tool calls come before tool results
  for (const toolCallId of toolCallIds) {
    // Find tool result index
    const resultIndex = results.findIndex(message => {
      if (!Array.isArray(message?.content)) return false;
      return message.content.some(
        part =>
          part &&
          typeof part === 'object' &&
          'type' in part &&
          part.type === 'tool-result' &&
          'toolCallId' in part &&
          part.toolCallId === toolCallId,
      );
    });

    // If no tool result found or it's the first message, continue to next ID
    if (resultIndex <= 0) continue;

    // Check if tool call is at resultIndex - 1
    const oneMessagePrev = results[resultIndex - 1];
    if (isToolCallWithId(oneMessagePrev, toolCallId)) {
      continue; // Tool call is already in the correct position
    }

    // Check if tool call is at resultIndex - 2
    const secondMessagePrev = results[resultIndex - 2];
    if (secondMessagePrev && isToolCallWithId(secondMessagePrev, toolCallId)) {
      // Move the tool call to be directly before the tool result
      results.splice(resultIndex - 2, 1); // Remove from -2 position
      results.splice(resultIndex - 1, 0, secondMessagePrev); // Insert at the new -1 position
    }
  }

  return results;
}
