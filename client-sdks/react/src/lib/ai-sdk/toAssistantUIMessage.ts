import {
  ThreadMessageLike,
  MessageStatus,
  CompleteAttachment,
  TextMessagePart,
  ReasoningMessagePart,
  SourceMessagePart,
  FileMessagePart,
  ToolCallMessagePart,
} from '@assistant-ui/react';
import { MastraUIMessage } from './toUIMessage';

/**
 * Extended type for MastraUIMessage that may include additional properties
 * from different sources (generateVNext, toUIMessage, toNetworkUIMessage)
 */
type ExtendedMastraUIMessage = MastraUIMessage & {
  createdAt?: Date;
  metadata?: Record<string, unknown>;
  experimental_attachments?: readonly CompleteAttachment[];
};

/**
 * Converts a Mastra UIMessage (from AI SDK) to a ThreadMessageLike format compatible with @assistant-ui/react.
 *
 * This function handles UIMessages from three sources:
 * - agent.generateVNext: Full output with all message parts
 * - toUIMessage: Streaming chunks accumulated into UIMessages
 * - toNetworkUIMessage: Network execution events accumulated into UIMessages
 *
 * @param message - The MastraUIMessage to convert
 * @returns A ThreadMessageLike compatible with @assistant-ui/react
 */
export const toAssistantUIMessage = (message: MastraUIMessage): ThreadMessageLike => {
  const extendedMessage = message as ExtendedMastraUIMessage;

  // Convert parts array to content array
  type ContentPart = Exclude<ThreadMessageLike['content'], string> extends readonly (infer T)[] ? T : never;

  const content: ThreadMessageLike['content'] = message.parts.map((part): ContentPart => {
    // Handle text parts
    if (part.type === 'text') {
      return {
        type: 'text',
        text: part.text,
      };
    }

    // Handle reasoning parts (extended thinking)
    if (part.type === 'reasoning') {
      return {
        type: 'reasoning',
        text: part.text,
      };
    }

    // Handle source-url parts
    if (part.type === 'source-url') {
      return {
        type: 'source',
        sourceType: 'url',
        id: part.sourceId,
        url: part.url,
        title: part.title,
      };
    }

    // Handle source-document parts (not directly supported by ThreadMessageLike)
    // Convert to file part for compatibility
    if (part.type === 'source-document') {
      return {
        type: 'file',
        filename: part.filename,
        mimeType: part.mediaType,
        data: '', // Source documents don't have inline data
      };
    }

    // Handle file parts
    if (part.type === 'file') {
      return {
        type: 'file',
        mimeType: part.mediaType,
        data: part.url, // Use URL as data source
      };
    }

    // Handle dynamic-tool parts (tool calls)
    if (part.type === 'dynamic-tool') {
      // Build the tool call matching the inline type from ThreadMessageLike
      const baseToolCall = {
        type: 'tool-call' as const,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        argsText: JSON.stringify(part.input),
      };

      // Only add result and isError if the tool has completed
      if (part.state === 'output-available' && 'output' in part) {
        return { ...baseToolCall, result: part.output };
      } else if (part.state === 'output-error' && 'errorText' in part) {
        return { ...baseToolCall, result: part.errorText, isError: true };
      }

      return baseToolCall;
    }

    // Handle typed tool parts (tool-{NAME} pattern from AI SDK)
    if (part.type.startsWith('tool-')) {
      const toolName = 'toolName' in part && typeof part.toolName === 'string' ? part.toolName : part.type.substring(5);

      const baseToolCall = {
        type: 'tool-call' as const,
        toolCallId: 'toolCallId' in part && typeof part.toolCallId === 'string' ? part.toolCallId : '',
        toolName,
        argsText: 'input' in part ? JSON.stringify(part.input) : '{}',
      };

      // Add result if available
      if ('output' in part) {
        return { ...baseToolCall, result: part.output };
      } else if ('error' in part) {
        return { ...baseToolCall, result: part.error, isError: true };
      }

      return baseToolCall;
    }

    // For any other part types, return a minimal text part
    // This ensures forward compatibility with new part types
    return {
      type: 'text',
      text: '',
    };
  });

  // Determine status for assistant messages
  let status: MessageStatus | undefined;
  if (message.role === 'assistant' && content.length > 0) {
    // Check for streaming parts
    const hasStreamingParts = message.parts.some(
      part =>
        (part.type === 'text' && 'state' in part && part.state === 'streaming') ||
        (part.type === 'reasoning' && 'state' in part && part.state === 'streaming'),
    );

    // Check for tool calls (both dynamic-tool and tool-{NAME} patterns)
    const hasToolCalls = message.parts.some(part => part.type === 'dynamic-tool' || part.type.startsWith('tool-'));

    const hasInputAvailableTools = message.parts.some(
      part => part.type === 'dynamic-tool' && part.state === 'input-available',
    );

    const hasErrorTools = message.parts.some(
      part =>
        (part.type === 'dynamic-tool' && part.state === 'output-error') ||
        (part.type.startsWith('tool-') && 'error' in part),
    );

    // Determine message status based on part states
    if (hasStreamingParts) {
      status = { type: 'running' };
    } else if (hasInputAvailableTools && hasToolCalls) {
      status = { type: 'requires-action', reason: 'tool-calls' };
    } else if (hasErrorTools) {
      status = { type: 'incomplete', reason: 'error' };
    } else {
      status = { type: 'complete', reason: 'stop' };
    }
  }

  // Build metadata if present
  const metadata = extendedMessage.metadata
    ? {
        custom: extendedMessage.metadata,
      }
    : undefined;

  // Build the ThreadMessageLike object
  const threadMessage: ThreadMessageLike = {
    role: message.role,
    content,
    id: message.id,
    createdAt: extendedMessage.createdAt,
    status,
    metadata,
    attachments: extendedMessage.experimental_attachments,
  };

  return threadMessage;
};
