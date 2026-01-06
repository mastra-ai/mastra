import { convertToCoreMessages as convertToCoreMessagesV4 } from '@internal/ai-sdk-v4';
import type { CoreMessage as CoreMessageV4, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
import * as AIV5 from '@internal/ai-sdk-v5';

import { AIV4Adapter, AIV5Adapter } from '../adapters';
import type { AdapterContext } from '../adapters';
import { TypeDetector } from '../detection/TypeDetector';
import type { MastraDBMessage, MessageSource } from '../state/types';
import type { AIV5Type, AIV5ModelMessageWithId } from '../types';
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
 * Sanitizes AIV5 UI messages by filtering out streaming states and optionally incomplete tool calls.
 */
export function sanitizeV5UIMessages(
  messages: AIV5Type.UIMessage[],
  filterIncompleteToolCalls = false,
): AIV5Type.UIMessage[] {
  const msgs = messages
    .map(m => {
      if (m.parts.length === 0) return false;
      // Filter out streaming states and optionally input-available (which aren't supported by convertToModelMessages)
      const safeParts = m.parts.filter(p => {
        if (!AIV5.isToolUIPart(p)) return true;

        // When sending messages TO the LLM: only keep completed tool calls (output-available/output-error)
        // This filters out input-available (incomplete client-side tool calls) and input-streaming
        if (filterIncompleteToolCalls) {
          return p.state === 'output-available' || p.state === 'output-error';
        }

        // When processing response messages FROM the LLM: keep input-available states
        // (tool calls waiting for client-side execution) but filter out input-streaming
        return p.state !== 'input-streaming';
      });

      if (!safeParts.length) return false;

      const sanitized = {
        ...m,
        parts: safeParts.map(part => {
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
 * Handles sanitization, step-start insertion, ID preservation, provider options restoration, and Anthropic compatibility.
 *
 * @param messages - AIV5 UI messages to convert
 * @param dbMessages - MastraDB messages used to look up tool call args for Anthropic compatibility
 * @param filterIncompleteToolCalls - Whether to filter out incomplete tool calls
 */
export function aiV5UIMessagesToAIV5ModelMessages(
  messages: AIV5Type.UIMessage[],
  dbMessages: MastraDBMessage[],
  filterIncompleteToolCalls = false,
): AIV5ModelMessageWithId[] {
  const sanitized = sanitizeV5UIMessages(messages, filterIncompleteToolCalls);
  const preprocessed = addStartStepPartsForAIV5(sanitized);
  const result = AIV5.convertToModelMessages(preprocessed);

  // Restore message-level properties from UIMessage that convertToModelMessages strips
  // This preserves id and providerOptions through the DB → UI → Model conversion
  const withIdAndProviderOptions: AIV5ModelMessageWithId[] = result.map((modelMsg, index) => {
    const uiMsg = preprocessed[index];

    // Start with the model message and restore id from UIMessage (fixes issue #11615)
    // convertToModelMessages strips the id, but we need it for onFinish callback
    let updatedMsg: AIV5ModelMessageWithId = {
      ...modelMsg,
      id: uiMsg?.id ?? `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Restore providerOptions from metadata.providerMetadata if present
    if (
      uiMsg?.metadata &&
      typeof uiMsg.metadata === 'object' &&
      'providerMetadata' in uiMsg.metadata &&
      uiMsg.metadata.providerMetadata
    ) {
      updatedMsg = {
        ...updatedMsg,
        providerOptions: uiMsg.metadata.providerMetadata as AIV5Type.ProviderMetadata,
      };
    }

    return updatedMsg;
  });

  // Add input field to tool-result parts for Anthropic API compatibility (fixes issue #11376)
  return ensureAnthropicCompatibleMessages(withIdAndProviderOptions, dbMessages) as AIV5ModelMessageWithId[];
}

/**
 * Converts AIV4 Core messages to AIV5 Model messages.
 */
export function aiV4CoreMessagesToAIV5ModelMessages(
  messages: CoreMessageV4[],
  source: MessageSource,
  adapterContext: AdapterContext,
  dbMessages: MastraDBMessage[],
): AIV5ModelMessageWithId[] {
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
