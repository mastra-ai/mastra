import type { CoreMessage } from '@internal/ai-sdk-v4/message';
import type { ModelMessage } from 'ai-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../../error';

type GeminiCompatibleMessage = ModelMessage | CoreMessage;

/**
 * Filters out problematic message patterns that Gemini rejects.
 *
 * This removes:
 * 1. Empty tool messages (messages with role='tool' but no content)
 * 2. Duplicate assistant messages with only tool-calls (artifacts from convertToModelMessages)
 *
 * These patterns can occur when historical conversation messages with tool-calls
 * are passed through the AI SDK's convertToModelMessages function, which splits
 * them in ways that create invalid message structures for Gemini.
 *
 * @param messages - Array of model messages to filter
 * @returns Filtered messages array without problematic patterns
 */
export function filterGeminiIncompatibleMessages<T extends GeminiCompatibleMessage>(messages: T[]): T[] {
  return messages.filter((msg, idx) => {
    // Remove empty tool messages
    if (msg.role === 'tool' && Array.isArray(msg.content) && msg.content.length === 0) {
      return false;
    }

    // Remove duplicate assistant messages with only tool-calls
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const hasOnlyToolCalls = msg.content.every(p => p.type === 'tool-call');
      if (hasOnlyToolCalls && msg.content.length > 0) {
        const toolCallIds = msg.content.filter(p => p.type === 'tool-call').map(p => p.toolCallId);

        // Check if there's another assistant message later with the same tool-call IDs
        const hasDuplicateLater = messages.slice(idx + 1).some(laterMsg => {
          if (laterMsg.role !== 'assistant' || !Array.isArray(laterMsg.content)) return false;

          const laterToolCallIds = laterMsg.content.filter(p => p.type === 'tool-call').map(p => p.toolCallId);

          return toolCallIds.some(id => laterToolCallIds.includes(id));
        });

        if (hasDuplicateLater) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Ensures message array is compatible with Gemini API requirements.
 *
 * Gemini requires that the first non-system message must be from the user role.
 * This fixes "single turn requests" errors where messages start with assistant
 * or contain only system messages.
 *
 * This function modifies the messages array by inserting a placeholder user
 * message when needed to satisfy this requirement.
 *
 * @param messages - Array of model messages to validate and fix
 * @returns Modified messages array that satisfies Gemini requirements
 *
 * @see https://github.com/mastra-ai/mastra/issues/7287 - Tool call ordering
 * @see https://github.com/mastra-ai/mastra/issues/8053 - Single turn validation
 */
export function ensureGeminiCompatibleMessages<T extends GeminiCompatibleMessage>(messages: T[]): T[] {
  const result = [...messages];

  // Ensure first non-system message is user
  const firstNonSystemIndex = result.findIndex(m => m.role !== 'system');
  if (firstNonSystemIndex === -1) {
    // Only system messages or empty - this is an error condition
    throw new MastraError({
      id: 'NO_USER_OR_ASSISTANT_MESSAGES',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'This request does not contain any user or assistant messages. At least one user or assistant message is required to generate a response.',
    });
  } else if (result[firstNonSystemIndex]?.role === 'assistant') {
    // First non-system is assistant, insert user message before it
    result.splice(firstNonSystemIndex, 0, {
      role: 'user',
      content: '.',
    } as T);
  }

  return result;
}
