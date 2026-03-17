import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type { ModelMessage, ToolResultPart } from '@internal/ai-sdk-v5';

import type { IMastraLogger } from '../../../logger';
import type { MastraDBMessage } from '../state/types';

/**
 * Tool result with input field (Anthropic requirement)
 */
export type ToolResultWithInput = ToolResultPart & {
  input: Record<string, unknown>;
};

// ============================================================================
// System Message Merging
// ============================================================================

/**
 * Merges multiple system messages into a single system message.
 *
 * Some LLM providers (e.g., Qwen, some OpenAI-compatible local models) only support
 * a single system message at the beginning of the conversation. This function
 * consolidates multiple system messages into one by concatenating their content
 * with double newlines.
 *
 * @param messages - Array of messages that may contain multiple system messages
 * @returns Messages array with all consecutive system messages merged into one
 *
 * @see https://github.com/mastra-ai/mastra/issues/14384 - Multiple system messages issue
 */
export function mergeSystemMessages<T extends { role: string; content: unknown }>(messages: T[]): T[] {
  if (messages.length === 0) return messages;

  const result: T[] = [];
  let currentSystemContent: string[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      // Collect system message content
      const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
      if (content.trim()) {
        currentSystemContent.push(content);
      }
    } else {
      // Non-system message: flush any accumulated system content first
      if (currentSystemContent.length > 0) {
        result.push({
          ...message,
          role: 'system',
          content: currentSystemContent.join('\n\n'),
        } as T);
        currentSystemContent = [];
      }
      result.push(message);
    }
  }

  // Handle trailing system messages
  if (currentSystemContent.length > 0) {
    // Find the last system message to use as template, or create a new one
    let lastSystem: T | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === 'system') {
        lastSystem = messages[i]!;
        break;
      }
    }
    if (lastSystem) {
      result.push({
        ...lastSystem,
        role: 'system',
        content: currentSystemContent.join('\n\n'),
      } as T);
    } else {
      // Should not happen, but handle gracefully
      result.push({
        role: 'system',
        content: currentSystemContent.join('\n\n'),
      } as T);
    }
  }

  return result;
}

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
 * @param logger - Optional logger for warnings
 * @returns Modified messages array that satisfies Gemini requirements
 *
 * @see https://github.com/mastra-ai/mastra/issues/7287 - Tool call ordering
 * @see https://github.com/mastra-ai/mastra/issues/8053 - Single turn validation
 * @see https://github.com/mastra-ai/mastra/issues/13045 - Empty thread support
 */
export function ensureGeminiCompatibleMessages<T extends ModelMessage | CoreMessageV4>(
  messages: T[],
  logger?: IMastraLogger,
): T[] {
  const result = [...messages];

  // Ensure first non-system message is user
  const firstNonSystemIndex = result.findIndex(m => m.role !== 'system');

  if (firstNonSystemIndex === -1) {
    // Only system messages or empty — warn and pass through unchanged.
    // Providers that support system-only prompts (Anthropic, OpenAI) will work natively.
    // Providers that don't (Gemini) will return their own error.
    if (result.length > 0) {
      logger?.warn(
        'No user or assistant messages in the request. Some providers (e.g. Gemini) require at least one user message to generate a response.',
      );
    }
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
