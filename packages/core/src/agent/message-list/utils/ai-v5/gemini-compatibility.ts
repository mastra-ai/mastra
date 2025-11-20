import type { CoreMessage } from '@internal/ai-sdk-v4';
import type { ModelMessage } from 'ai-v5';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../../error';

type GeminiCompatibleMessage = ModelMessage | CoreMessage;

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
