import {
  removeWorkingMemoryTags,
  removeWorkingMemoryToolInvocationParts,
  removeWorkingMemoryToolInvocations,
} from '../memory/working-memory-utils';
import { isTransientSignalMessage } from './signals';
import type { MastraDBMessage } from './types';

/**
 * Filters messages before persisting to storage:
 * 1. Removes system messages - these are runtime instructions and should never be stored
 * 2. Removes transient signals (`transient: true`) - delivery-only, must never be retained
 * 3. Removes streaming tool calls (state === 'partial-call') - these are intermediate states
 * 4. Removes updateWorkingMemory tool invocations (hide args from message history)
 * 5. Strips <working_memory> tags from text content
 *
 * Note: We preserve 'call' state tool invocations because:
 * - For server-side tools, 'call' should have been converted to 'result' by the time OUTPUT is processed
 * - For client-side tools (no execute function), 'call' is the final state from the server's perspective
 */
export function filterMessagesForPersistence(messages: MastraDBMessage[]): MastraDBMessage[] {
  return messages
    .filter(m => m.role !== 'system' && !isTransientSignalMessage(m))
    .map(m => {
      const newMessage = { ...m };
      // Only spread content if it's a proper V2 object
      if (m.content && typeof m.content === 'object' && !Array.isArray(m.content)) {
        newMessage.content = { ...m.content };
      }

      // Strip working memory tags from string content
      if (typeof newMessage.content?.content === 'string' && newMessage.content.content.length > 0) {
        const cleanedContent = removeWorkingMemoryTags(newMessage.content.content);
        newMessage.content.content =
          cleanedContent !== newMessage.content.content ? cleanedContent.trim() : newMessage.content.content;
      }

      if (Array.isArray(newMessage.content?.parts)) {
        if (Array.isArray(newMessage.content.toolInvocations)) {
          newMessage.content.toolInvocations = removeWorkingMemoryToolInvocations(newMessage.content.toolInvocations);
        }
        // Filter out updateWorkingMemory tool invocations (hide args from message history)
        newMessage.content.parts = removeWorkingMemoryToolInvocationParts(newMessage.content.parts)
          .map(p => {
            // Filter out streaming tool calls (partial-call is an intermediate state during streaming)
            if (p.type === `tool-invocation` && p.toolInvocation.state === `partial-call`) {
              return null;
            }
            // Strip working memory tags from text parts
            if (p.type === `text`) {
              const text = typeof p.text === 'string' ? p.text : '';
              const cleaned = removeWorkingMemoryTags(text);
              return {
                ...p,
                text: cleaned !== text ? cleaned.trim() : text,
              };
            }
            return p;
          })
          .filter((p): p is NonNullable<typeof p> => Boolean(p));

        // If all parts were filtered out, skip the whole message
        if (newMessage.content.parts.length === 0) {
          return null;
        }
      }

      return newMessage;
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
}
