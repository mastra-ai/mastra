import { convertToCoreMessages as convertToCoreMessagesV4 } from '@internal/ai-sdk-v4';
import type { CoreMessage as CoreMessageV4, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
import * as AIV5 from '@internal/ai-sdk-v5';

import { AIV4Adapter, AIV5Adapter, AIV6Adapter } from '../adapters';
import type { AdapterContext } from '../adapters';
import { TypeDetector } from '../detection/TypeDetector';
import type { MastraDBMessage, MessageSource } from '../state/types';
import type { AIV5Type, AIV6Type } from '../types';
import { ensureAnthropicCompatibleMessages } from '../utils/provider-compat';

/**
 * Merges text parts that share the same OpenAI itemId.
 *
 * When OpenAI streams a response with web search, it interleaves `source` chunks
 * with text-deltas. If the streaming pipeline flushes text on these source chunks,
 * it creates multiple text parts all sharing the same `providerMetadata.openai.itemId`.
 *
 * When these parts are later converted to model messages, each part with an itemId
 * becomes an `item_reference` pointing to the same ID, causing OpenAI to reject
 * the request with: "Duplicate item found with id msg_*"
 *
 * This function merges consecutive text parts with the same itemId into a single part,
 * concatenating their text content and keeping the metadata from the first part.
 */
function mergeTextPartsWithDuplicateItemIds<T extends { type: string }>(parts: T[]): T[] {
  const result: T[] = [];

  for (const part of parts) {
    // Only process text parts with OpenAI itemId
    if (part.type !== 'text') {
      result.push(part);
      continue;
    }

    const textPart = part as T & { text: string; providerMetadata?: Record<string, unknown> };
    const itemId = (textPart.providerMetadata?.openai as Record<string, unknown> | undefined)?.itemId as
      | string
      | undefined;
    if (!itemId) {
      result.push(part);
      continue;
    }

    // Find an existing text part in result with the same itemId
    const existingIndex = result.findIndex(p => {
      if (p.type !== 'text') return false;
      const existingTextPart = p as T & { providerMetadata?: Record<string, unknown> };
      const existingItemId = (existingTextPart.providerMetadata?.openai as Record<string, unknown> | undefined)?.itemId;
      return existingItemId === itemId;
    });

    if (existingIndex !== -1) {
      // Merge: concatenate text into the existing part
      const existing = result[existingIndex] as T & { text: string };
      result[existingIndex] = {
        ...existing,
        text: existing.text + textPart.text,
      };
    } else {
      result.push(part);
    }
  }

  return result;
}

/**
 * Sanitizes AIV4 UI messages by filtering out incomplete tool calls.
 * Removes messages with empty parts arrays after sanitization.
 */
export function sanitizeAIV4UIMessages(messages: UIMessageV4[]): UIMessageV4[] {
  const msgs = messages
    .map(m => {
      if (m.parts.length === 0) return false;
      const safeParts = m.parts.filter(
        p =>
          p.type !== `tool-invocation` ||
          // calls and partial-calls should be updated to be results at this point
          // if they haven't we can't send them back to the llm and need to remove them.
          (p.toolInvocation.state !== `call` && p.toolInvocation.state !== `partial-call`),
      );

      // fully remove this message if it has an empty parts array after stripping out incomplete tool calls.
      if (!safeParts.length) return false;

      const sanitized = {
        ...m,
        parts: safeParts,
      };

      // ensure toolInvocations are also updated to only show results
      if (`toolInvocations` in m && m.toolInvocations) {
        sanitized.toolInvocations = m.toolInvocations.filter(t => t.state === `result`);
      }

      return sanitized;
    })
    .filter((m): m is UIMessageV4 => Boolean(m));
  return msgs;
}

/**
 * Sanitizes AIV5 UI messages by filtering out streaming states, data-* parts, empty text parts, and optionally incomplete tool calls.
 * Handles legacy data by filtering empty text parts that may exist in pre-existing DB records.
 */
export function sanitizeV5UIMessages(
  messages: AIV5Type.UIMessage[],
  filterIncompleteToolCalls = false,
): AIV5Type.UIMessage[] {
  const msgs = messages
    .map(m => {
      if (m.parts.length === 0) return false;

      // When building a prompt TO the LLM (filterIncompleteToolCalls=true),
      // check if this message contains OpenAI reasoning parts (rs_* itemIds).
      // If so, we need to strip them AND clear providerMetadata.openai from remaining
      // parts to prevent item_reference linking to the stripped reasoning items.
      const hasOpenAIReasoning =
        filterIncompleteToolCalls &&
        m.parts.some(
          p =>
            p.type === 'reasoning' &&
            'providerMetadata' in p &&
            p.providerMetadata &&
            typeof p.providerMetadata === 'object' &&
            'openai' in (p.providerMetadata as Record<string, unknown>),
        );

      // Filter out streaming states and optionally input-available (which aren't supported by convertToModelMessages)
      const safeParts = m.parts.filter(p => {
        // Filter out data-* parts (custom streaming data from writer.custom())
        // These are Mastra extensions not supported by LLM providers.
        // If not filtered, convertToModelMessages produces empty content arrays
        // which causes some models to fail with "must include at least one parts field"
        if (typeof p.type === 'string' && p.type.startsWith('data-')) {
          return false;
        }

        // Strip OpenAI reasoning parts when building a prompt TO the LLM.
        // OpenAI's Responses API uses item_reference linking (rs_*/msg_* itemIds) that
        // creates mandatory pairing between reasoning and message items. Replaying
        // reasoning from history causes:
        //   "Item 'rs_*' of type 'reasoning' was provided without its required following item"
        //   "Item 'msg_*' of type 'message' was provided without its required 'reasoning' item"
        // Reasoning data is preserved in the database — only stripped from LLM input.
        // See: https://github.com/mastra-ai/mastra/issues/12980
        if (p.type === 'reasoning' && hasOpenAIReasoning) {
          return false;
        }

        // Filter out empty text parts to handle legacy data from before this filtering was implemented.
        // For assistant messages, preserve empty text parts if they are the only parts (placeholder messages).
        // For user messages, always filter them out — Anthropic rejects empty user text content blocks.
        if (p.type === 'text' && (!('text' in p) || p.text === '' || p.text?.trim() === '')) {
          // Always filter empty text parts from user messages
          if (m.role === 'user') return false;

          // For non-user messages, only filter if there are other non-empty parts
          const hasNonEmptyParts = m.parts.some(
            part => !(part.type === 'text' && (!('text' in part) || part.text === '' || part.text?.trim() === '')),
          );
          if (hasNonEmptyParts) return false;
        }

        if (!AIV5.isToolUIPart(p)) return true;

        // When sending messages TO the LLM: keep completed tool calls and provider-executed tools.
        // Filter out incomplete client-side tool calls (input-available without providerExecuted)
        // and input-streaming states.
        if (filterIncompleteToolCalls) {
          // Completed tools (client or provider) — keep them
          if (p.state === 'output-available' || p.state === 'output-error') return true;
          // Provider-executed tools may be deferred by the provider (e.g. Anthropic non-deterministically
          // defers web_search when mixed with client tool calls). Keep these so the provider API sees
          // the server_tool_use block on the next request.
          if (p.state === 'input-available' && p.providerExecuted) return true;
          return false;
        }

        // When processing response messages FROM the LLM: keep input-available states
        // (tool calls waiting for client-side execution) but filter out input-streaming
        return p.state !== 'input-streaming';
      });

      if (!safeParts.length) return false;

      // Merge text parts with duplicate OpenAI itemIds to prevent "Duplicate item found" errors.
      // This can happen when streaming flushes text multiple times for the same response
      // (e.g., when source citations are interleaved with text-deltas).
      const mergedParts = mergeTextPartsWithDuplicateItemIds(safeParts);

      const sanitized = {
        ...m,
        parts: mergedParts.map(part => {
          // When OpenAI reasoning was stripped, clear openai metadata from ALL remaining
          // parts so the SDK sends inline content instead of item_reference. This covers:
          //   - providerMetadata.openai on text/reasoning parts (msg_*/rs_* itemIds)
          //   - callProviderMetadata.openai on tool parts (fc_* itemIds used by convertToModelMessages)
          // Without paired reasoning items, OpenAI rejects orphaned item_references with:
          //   "function_call was provided without its required reasoning item"
          if (hasOpenAIReasoning) {
            if ('providerMetadata' in part && part.providerMetadata) {
              const meta = part.providerMetadata as Record<string, unknown>;
              if ('openai' in meta) {
                const { openai: _, ...restMeta } = meta;
                part = {
                  ...part,
                  providerMetadata:
                    Object.keys(restMeta).length > 0 ? (restMeta as typeof part.providerMetadata) : undefined,
                };
              }
            }
            if ('callProviderMetadata' in part && part.callProviderMetadata) {
              const callMeta = part.callProviderMetadata as Record<string, unknown>;
              if ('openai' in callMeta) {
                const { openai: _, ...restCallMeta } = callMeta;
                part = {
                  ...part,
                  callProviderMetadata:
                    Object.keys(restCallMeta).length > 0
                      ? (restCallMeta as typeof part.callProviderMetadata)
                      : undefined,
                } as typeof part;
              }
            }
          }

          if (AIV5.isToolUIPart(part) && part.state === 'output-available') {
            return {
              ...part,
              output:
                typeof part.output === 'object' && part.output && 'value' in part.output
                  ? part.output.value
                  : part.output,
            };
          }
          return part;
        }),
      };

      return sanitized;
    })
    .filter((m): m is AIV5Type.UIMessage => Boolean(m));
  return msgs;
}

/**
 * Adds step-start parts between tool parts and non-tool parts for proper AIV5 message conversion.
 * This ensures AIV5.convertToModelMessages produces the correct message order.
 */
export function addStartStepPartsForAIV5(messages: AIV5Type.UIMessage[]): AIV5Type.UIMessage[] {
  for (const message of messages) {
    if (message.role !== `assistant`) continue;
    for (const [index, part] of message.parts.entries()) {
      if (!AIV5.isToolUIPart(part)) continue;
      const nextPart = message.parts.at(index + 1);
      // If we don't insert step-start between tools and other parts, AIV5.convertToModelMessages will incorrectly add extra tool parts in the wrong order
      // ex: ui message with parts: [tool-result, text] becomes [assistant-message-with-both-parts, tool-result-message], when it should become [tool-call-message, tool-result-message, text-message]
      // However, we should NOT add step-start between consecutive tool parts (parallel tool calls)
      if (nextPart && nextPart.type !== `step-start` && !AIV5.isToolUIPart(nextPart)) {
        message.parts.splice(index + 1, 0, { type: 'step-start' });
      }

      // Split client tools from completed provider-executed tools.
      // Anthropic requires tool_result to immediately follow tool_use. When a client tool_use and
      // a server_tool_use (with inline result) are in the same block, convertToModelMessages produces:
      //   assistant: [tool_use(client), server_tool_use(provider), tool_result(provider)]
      //   user:      [tool_result(client)]
      // Anthropic rejects this because tool_result(client) doesn't immediately follow tool_use(client).
      // Splitting them into separate blocks fixes the ordering.
      if (
        nextPart &&
        AIV5.isToolUIPart(nextPart) &&
        !part.providerExecuted &&
        nextPart.providerExecuted &&
        (nextPart.state === 'output-available' || nextPart.state === 'output-error')
      ) {
        message.parts.splice(index + 1, 0, { type: 'step-start' });
      }
    }
  }
  return messages;
}

/**
 * Converts AIV4 UI messages to AIV4 Core messages.
 */
export function aiV4UIMessagesToAIV4CoreMessages(messages: UIMessageV4[]): CoreMessageV4[] {
  return convertToCoreMessagesV4(sanitizeAIV4UIMessages(messages));
}

/**
 * Restores `providerOptions` on assistant file parts after `convertToModelMessages`.
 *
 * The vendored AI SDK v5 `convertToModelMessages` drops `providerMetadata` from
 * assistant file parts (fixed in v6 but not backported). This causes providers
 * like Google Gemini to reject round-tripped responses that require metadata
 * (e.g. `thoughtSignature` on generated images).
 *
 * We collect all `providerMetadata` values from assistant `file` UI parts in
 * order, then walk the model messages and assign them to assistant `file` parts
 * in the same order. The ordering is guaranteed to be preserved.
 */
function restoreAssistantFileProviderMetadata(
  modelMessages: AIV5Type.ModelMessage[],
  uiMessages: AIV5Type.UIMessage[],
): AIV5Type.ModelMessage[] {
  // Collect providerMetadata from ALL assistant file UI parts in order,
  // using undefined as a placeholder for parts without metadata so that
  // the indices stay aligned with the model-side file parts.
  const fileMetadata: (AIV5Type.ProviderMetadata | undefined)[] = [];
  for (const msg of uiMessages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (part.type === 'file') {
        fileMetadata.push(part.providerMetadata ?? undefined);
      }
    }
  }

  if (fileMetadata.length === 0 || fileMetadata.every(m => m == null)) return modelMessages;

  // Walk model messages and restore providerOptions on assistant file parts
  let metadataIndex = 0;
  return modelMessages.map(msg => {
    if (msg.role !== 'assistant' || typeof msg.content === 'string') return msg;

    let modified = false;
    const content = msg.content.map(part => {
      if (part.type !== 'file' || metadataIndex >= fileMetadata.length) return part;
      const metadata = fileMetadata[metadataIndex++];
      if (part.providerOptions || !metadata) return part;
      modified = true;
      return { ...part, providerOptions: metadata };
    });

    return modified ? { ...msg, content } : msg;
  });
}

/**
 * Converts AIV5 UI messages to AIV5 Model messages.
 * Handles sanitization, step-start insertion, provider options restoration, and Anthropic compatibility.
 *
 * @param messages - AIV5 UI messages to convert
 * @param dbMessages - MastraDB messages used to look up tool call args for Anthropic compatibility
 * @param filterIncompleteToolCalls - Whether to filter out incomplete tool calls
 */
export function aiV5UIMessagesToAIV5ModelMessages(
  messages: AIV5Type.UIMessage[],
  dbMessages: MastraDBMessage[],
  filterIncompleteToolCalls = false,
): AIV5Type.ModelMessage[] {
  const sanitized = sanitizeV5UIMessages(messages, filterIncompleteToolCalls);
  const preprocessed = addStartStepPartsForAIV5(sanitized);

  const result = restoreAssistantFileProviderMetadata(AIV5.convertToModelMessages(preprocessed), preprocessed);

  // Restore message-level providerOptions from metadata.providerMetadata
  // This preserves providerOptions through the DB → UI → Model conversion
  const withProviderOptions = result.map((modelMsg, index) => {
    const uiMsg = preprocessed[index];

    if (
      uiMsg?.metadata &&
      typeof uiMsg.metadata === 'object' &&
      'providerMetadata' in uiMsg.metadata &&
      uiMsg.metadata.providerMetadata
    ) {
      return {
        ...modelMsg,
        providerOptions: uiMsg.metadata.providerMetadata as AIV5Type.ProviderMetadata,
      } satisfies AIV5Type.ModelMessage;
    }

    return modelMsg;
  });

  // Add input field to tool-result parts for Anthropic API compatibility (fixes issue #11376)
  return ensureAnthropicCompatibleMessages(withProviderOptions, dbMessages);
}

/**
 * Converts AIV4 Core messages to AIV5 Model messages.
 */
export function aiV4CoreMessagesToAIV5ModelMessages(
  messages: CoreMessageV4[],
  source: MessageSource,
  adapterContext: AdapterContext,
  dbMessages: MastraDBMessage[],
): AIV5Type.ModelMessage[] {
  return aiV5UIMessagesToAIV5ModelMessages(
    messages.map(m => AIV4Adapter.fromCoreMessage(m, adapterContext, source)).map(m => AIV5Adapter.toUIMessage(m)),
    dbMessages,
  );
}

/**
 * Converts various message formats to AIV4 CoreMessage format for system messages.
 * Supports string, MastraDBMessage, or AI SDK message types.
 */
export function systemMessageToAIV4Core(
  message: CoreMessageV4 | AIV5Type.ModelMessage | AIV6Type.ModelMessage | MastraDBMessage | string,
): CoreMessageV4 {
  if (typeof message === `string`) {
    return { role: 'system', content: message };
  }

  if (TypeDetector.isAIV6CoreMessage(message)) {
    const dbMsg = AIV6Adapter.fromModelMessage(message as AIV6Type.ModelMessage, 'system');
    return AIV4Adapter.systemToV4Core(dbMsg);
  }

  if (TypeDetector.isAIV5CoreMessage(message)) {
    const dbMsg = AIV5Adapter.fromModelMessage(message as AIV5Type.ModelMessage, 'system');
    return AIV4Adapter.systemToV4Core(dbMsg);
  }

  if (TypeDetector.isMastraDBMessage(message)) {
    return AIV4Adapter.systemToV4Core(message);
  }

  return message;
}
