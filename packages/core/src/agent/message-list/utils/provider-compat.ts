import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type { ModelMessage, ToolResultPart } from '@internal/ai-sdk-v5';

import { MastraError, ErrorDomain, ErrorCategory } from '../../../error';
import type { MastraDBMessage } from '../state/types';

/**
 * Tool result with input field (Anthropic requirement)
 */
export type ToolResultWithInput = ToolResultPart & {
  input: Record<string, unknown>;
};

// ============================================================================
// Gemini Compatibility
// ============================================================================

/**
 * Ensures message array is compatible with Gemini API requirements.
 *
 * Gemini API requires:
 * 1. The first non-system message must be from the user role
 * 2. Cannot have only system messages - at least one user/assistant is required
 *
 * @param messages - Array of model messages to validate and fix
 * @returns Modified messages array that satisfies Gemini requirements
 * @throws MastraError if no user or assistant messages are present
 *
 * @see https://github.com/mastra-ai/mastra/issues/7287 - Tool call ordering
 * @see https://github.com/mastra-ai/mastra/issues/8053 - Single turn validation
 */
export function ensureGeminiCompatibleMessages<T extends ModelMessage | CoreMessageV4>(messages: T[]): T[] {
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

// ============================================================================
// Anthropic Compatibility
// ============================================================================

/**
 * Ensures model messages are compatible with Anthropic API requirements.
 *
 * Anthropic API requires tool-result parts to include an 'input' field
 * that matches the original tool call arguments.
 *
 * @param messages - Array of model messages to transform
 * @param dbMessages - MastraDB messages to look up tool call args from
 * @returns Messages with tool-result parts enriched with input field
 *
 * @see https://github.com/mastra-ai/mastra/issues/11376 - Anthropic models fail with empty object tool input
 */
export function ensureAnthropicCompatibleMessages(
  messages: ModelMessage[],
  dbMessages: MastraDBMessage[],
): ModelMessage[] {
  return messages.map(msg => enrichToolResultsWithInput(msg, dbMessages));
}

/**
 * Enriches a single message's tool-result parts with input field
 */
function enrichToolResultsWithInput(message: ModelMessage, dbMessages: MastraDBMessage[]): ModelMessage {
  if (message.role !== 'tool' || !Array.isArray(message.content)) {
    return message;
  }

  return {
    ...message,
    content: message.content.map(part => {
      if (part.type === 'tool-result') {
        return {
          ...part,
          input: findToolCallArgs(dbMessages, part.toolCallId),
        } as ToolResultWithInput;
      }
      return part;
    }),
  } as ModelMessage;
}

// ============================================================================
// OpenAI Compatibility
// ============================================================================

/**
 * Checks if a message part has OpenAI reasoning itemId
 *
 * OpenAI reasoning items are tracked via `providerMetadata.openai.itemId` (e.g., `rs_...`).
 * Each reasoning item has a unique itemId that must be preserved for proper deduplication.
 *
 * @param part - A message part to check
 * @returns true if the part has an OpenAI itemId
 *
 * @see https://github.com/mastra-ai/mastra/issues/9005 - OpenAI reasoning items filtering
 */
export function hasOpenAIReasoningItemId(part: unknown): boolean {
  if (!part || typeof part !== 'object') return false;
  const partAny = part as Record<string, unknown>;

  if (!('providerMetadata' in partAny) || !partAny.providerMetadata) return false;
  const metadata = partAny.providerMetadata as Record<string, unknown>;

  if (!('openai' in metadata) || !metadata.openai) return false;
  const openai = metadata.openai as Record<string, unknown>;

  return 'itemId' in openai && typeof openai.itemId === 'string';
}

/**
 * Extracts the OpenAI itemId from a message part if present
 *
 * @param part - A message part to extract from
 * @returns The itemId string or undefined if not present
 */
export function getOpenAIReasoningItemId(part: unknown): string | undefined {
  if (!hasOpenAIReasoningItemId(part)) return undefined;

  const partAny = part as Record<string, unknown>;
  const metadata = partAny.providerMetadata as Record<string, unknown>;
  const openai = metadata.openai as Record<string, unknown>;

  return openai.itemId as string;
}

// ============================================================================
// Tool Call Args Lookup
// ============================================================================

/**
 * Finds the tool call args for a given toolCallId by searching through messages.
 * This is used to reconstruct the input field when converting tool-result parts to StaticToolResult.
 *
 * Searches through messages in reverse order (most recent first) for better performance.
 * Checks both content.parts (v2 format) and toolInvocations (legacy AIV4 format).
 *
 * @param messages - Array of MastraDB messages to search through
 * @param toolCallId - The ID of the tool call to find args for
 * @returns The args object from the matching tool call, or an empty object if not found
 */
export function findToolCallArgs(messages: MastraDBMessage[], toolCallId: string): Record<string, unknown> {
  // Search through all messages in reverse order (most recent first) for better performance
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') {
      continue;
    }

    // Check both content.parts (v2 format) and toolInvocations (legacy format)
    if (msg.content.parts) {
      // Look for tool-invocation with matching toolCallId (can be in 'call' or 'result' state)
      const toolCallPart = msg.content.parts.find(
        p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === toolCallId,
      );

      if (toolCallPart && toolCallPart.type === 'tool-invocation') {
        // Return the args even if it's undefined or empty object
        return toolCallPart.toolInvocation.args || {};
      }
    }

    // Also check toolInvocations array (AIV4 format)
    if (msg.content.toolInvocations) {
      const toolInvocation = msg.content.toolInvocations.find(inv => inv.toolCallId === toolCallId);

      if (toolInvocation) {
        return toolInvocation.args || {};
      }
    }
  }

  // If not found in DB messages, return empty object
  return {};
}
