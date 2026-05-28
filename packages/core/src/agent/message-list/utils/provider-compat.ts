import type { ToolResultPart } from '@internal/ai-sdk-v5';

import type { MastraDBMessage } from '../state/types';
import { getResponseProviderItemId } from './response-item-metadata';
import type { ResponseItemIdProvider } from './response-item-metadata';

/**
 * Tool result with input field (Anthropic requirement)
 */
export type ToolResultWithInput = ToolResultPart & {
  input: Record<string, unknown>;
};

// ============================================================================
// OpenAI-compatible Responses Compatibility
// ============================================================================

/**
 * Checks if a message part has an OpenAI reasoning itemId.
 *
 * OpenAI Responses reasoning items are tracked via `providerMetadata.openai.itemId`.
 * Each reasoning item has a unique itemId that must be preserved for proper deduplication.
 *
 * @param part - A message part to check
 * @returns true if the part has an OpenAI itemId
 *
 * @see https://github.com/mastra-ai/mastra/issues/9005 - OpenAI reasoning items filtering
 */
export function hasOpenAIReasoningItemId(part: unknown): boolean {
  return Boolean(getOpenAIReasoningItemId(part));
}

/**
 * Checks if a message part has an OpenAI-compatible Responses itemId.
 *
 * Provider-neutral Responses item IDs are tracked via provider metadata or
 * provider options fields such as `openai.itemId` or `azure.itemId`.
 */
export function hasResponseProviderItemId(part: unknown): boolean {
  return Boolean(getResponseProviderItemIdFromPart(part));
}

/**
 * Extracts an OpenAI itemId from a message part if present.
 *
 * This only inspects `providerMetadata.openai.itemId`; use
 * `getResponseProviderItemIdFromPart` for provider-aware Azure/OpenAI lookups.
 *
 * @param part - A message part to extract from
 * @returns The itemId string or undefined if not present
 */
export function getOpenAIReasoningItemId(part: unknown): string | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const partAny = part as Record<string, unknown>;
  const providerMetadata = partAny.providerMetadata as Record<string, unknown> | undefined;
  const openaiMetadata = providerMetadata?.openai as Record<string, unknown> | undefined;
  return typeof openaiMetadata?.itemId === 'string' ? openaiMetadata.itemId : undefined;
}

export function getResponseProviderItemIdFromPart(
  part: unknown,
): { provider: ResponseItemIdProvider; itemId: string } | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const partAny = part as Record<string, unknown>;

  return (
    getResponseProviderItemId(partAny.providerMetadata as Record<string, unknown> | undefined) ||
    getResponseProviderItemId(partAny.providerOptions as Record<string, unknown> | undefined)
  );
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
        const args = toolCallPart.toolInvocation.args || {};
        if (typeof args === 'object' && Object.keys(args).length > 0) {
          return args;
        }
      }
    }

    // Also check toolInvocations array (AIV4 format)
    if (msg.content.toolInvocations) {
      const toolInvocation = msg.content.toolInvocations.find(inv => inv.toolCallId === toolCallId);

      if (toolInvocation) {
        const args = toolInvocation.args || {};
        if (typeof args === 'object' && Object.keys(args).length > 0) {
          return args;
        }
      }
    }
  }

  // If not found in DB messages, return empty object
  return {};
}
