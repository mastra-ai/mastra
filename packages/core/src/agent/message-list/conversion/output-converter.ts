import { convertToCoreMessages as convertToCoreMessagesV4 } from '@internal/ai-sdk-v4';
import type { CoreMessage as CoreMessageV4, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
import * as AIV5 from '@internal/ai-sdk-v5';

import { AIV4Adapter, AIV5Adapter } from '../adapters';
import type { AdapterContext } from '../adapters';
import { TypeDetector } from '../detection/TypeDetector';
import type { MastraDBMessage, MessageSource } from '../state/types';
import type { AIV5Type } from '../types';
import { ensureAnthropicCompatibleMessages } from '../utils/provider-compat';

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

        // Filter out empty text parts to handle legacy data from before this filtering was implemented
        // But preserve them if they are the only parts (legitimate placeholder messages)
        if (p.type === 'text' && (!('text' in p) || p.text === '' || p.text?.trim() === '')) {
          const hasNonEmptyParts = m.parts.some(
            part => !(part.type === 'text' && (!('text' in part) || part.text === '' || part.text?.trim() === '')),
          );
          if (hasNonEmptyParts) return false;
        }

        if (!AIV5.isToolUIPart(p)) return true;

        // When sending messages TO the LLM: only keep completed tool calls (output-available/output-error)
        // This filters out input-available (incomplete client-side tool calls) and input-streaming
        if (filterIncompleteToolCalls) {
          if (p.state === 'output-available' || p.state === 'output-error') {
            // Strip completed provider-executed tools (e.g. Anthropic web_search). The provider
            // already handled these internally — sending tool_result for server_tool_use is invalid.
            if (p.providerExecuted) return false;
            return true;
          }
          // Provider-executed tools (e.g. Anthropic web_search) remain in input-available state
          // because no client-side result is added. Keep them so the provider API sees the
          // server_tool_use block and can execute the deferred tool on the next request.
          if (p.state === 'input-available' && p.providerExecuted) return true;
          return false;
        }

        // When processing response messages FROM the LLM: keep input-available states
        // (tool calls waiting for client-side execution) but filter out input-streaming
        return p.state !== 'input-streaming';
      });

      if (!safeParts.length) return false;

      const sanitized = {
        ...m,
        parts: safeParts.map(part => {
          // When OpenAI reasoning was stripped, also clear providerMetadata.openai from
          // remaining parts. Text parts carry msg_* itemIds that reference the stripped
          // rs_* reasoning items — if retained, the SDK sends item_reference instead of
          // inline content, and the API rejects the orphaned reference.
          if (hasOpenAIReasoning && 'providerMetadata' in part && part.providerMetadata) {
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
  const result = AIV5.convertToModelMessages(preprocessed);

  // Build a lookup of toolCallId → stored modelOutput from providerMetadata.mastra.modelOutput.
  // This allows toModelOutput results computed at tool execution time to be preserved
  // in the model prompt without re-running the transformation.
  const storedModelOutputs = new Map<string, unknown>();
  for (const dbMsg of dbMessages) {
    if (dbMsg.content?.format === 2 && dbMsg.content.parts) {
      for (const part of dbMsg.content.parts) {
        if (
          part.type === 'tool-invocation' &&
          part.toolInvocation?.state === 'result' &&
          part.providerMetadata?.mastra &&
          typeof part.providerMetadata.mastra === 'object' &&
          'modelOutput' in (part.providerMetadata.mastra as Record<string, unknown>)
        ) {
          storedModelOutputs.set(
            part.toolInvocation.toolCallId,
            (part.providerMetadata.mastra as Record<string, unknown>).modelOutput,
          );
        }
      }
    }
  }

  // Apply stored modelOutput to tool-result parts in model messages
  if (storedModelOutputs.size > 0) {
    for (const modelMsg of result) {
      if (modelMsg.role === 'tool' && Array.isArray(modelMsg.content)) {
        for (let i = 0; i < modelMsg.content.length; i++) {
          const part = modelMsg.content[i]!;
          if (part.type === 'tool-result' && storedModelOutputs.has(part.toolCallId)) {
            modelMsg.content[i] = {
              ...part,
              output: storedModelOutputs.get(part.toolCallId) as any,
            };
          }
        }
      }
    }
  }

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
  message: CoreMessageV4 | AIV5Type.ModelMessage | MastraDBMessage | string,
): CoreMessageV4 {
  if (typeof message === `string`) {
    return { role: 'system', content: message };
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
