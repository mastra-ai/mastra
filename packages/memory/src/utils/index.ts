import type { MessageType } from "@mastra/core/memory";

/**
 * Self-heals message ordering to ensure tool calls are directly before their corresponding tool results.
 * Fixes cases where messages may be stored in incorrect order in the database.
 * This is needed to account for previous versions of memory where the new user message and an assistant message 
 * had the exact same timestamp. In some cases it would be fine, in others the two messages would have 
 * their order swapped so it went tool call, user message, tool result.
 */
export function reorderToolCallsAndResults(messages: MessageType[]): MessageType[] {
  if (!messages.length) return messages;

  const result = [...messages];

  // Find all tool result messages
  for (let i = 0; i < result.length; i++) {
    const message = result[i];

    // Skip if not a message with content array
    if (!message || !Array.isArray(message.content)) continue;

    // Check each content item for tool results
    for (const content of message.content) {
      if (content.type === 'tool-result' && content.toolCallId) {
        // If this is a tool result, find the corresponding tool call
        const toolCallId = content.toolCallId;
        let toolCallIndex = -1;
        let toolCallMessage = null;

        // Find the message with matching tool call ID
        for (let j = 0; j < result.length; j++) {
          const candidateMessage = result[j];
          if (!candidateMessage || !Array.isArray(candidateMessage.content)) continue;

          for (const candidateContent of candidateMessage.content) {
            if (candidateContent.type === 'tool-call' && candidateContent.toolCallId === toolCallId) {
              toolCallIndex = j;
              toolCallMessage = candidateMessage;
              break;
            }
          }

          if (toolCallIndex !== -1) break;
        }

        // If tool call found and it's not directly before the tool result
        if (toolCallIndex !== -1 && toolCallMessage && toolCallIndex !== i - 1) {
          // Remove the tool call message from its current position
          result.splice(toolCallIndex, 1);

          // Adjust current index if needed (if tool call was before current position)
          if (toolCallIndex < i) i--;

          // Insert the tool call message directly before the tool result message
          result.splice(i, 0, toolCallMessage);
          i++; // Increment i since we inserted a message
        }
      }
    }
  }

  return result;
} 