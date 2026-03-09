/**
 * Message format conversion utilities for Braintrust.
 *
 * Converts AI SDK message format (v4/v5) to OpenAI Chat Completion format,
 * which Braintrust requires for proper rendering of threads.
 */

// ==============================================================================
// Utility functions
// ==============================================================================

/**
 * Remove null and undefined values from an object (shallow)
 */
export function removeNullish<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null)) as Partial<T>;
}

// ==============================================================================
// Type definitions for AI SDK message format conversion to OpenAI format
// ==============================================================================

/**
 * AI SDK content part types (both v4 and v5)
 */
interface AISDKTextPart {
  type: 'text';
  text: string;
}

interface AISDKImagePart {
  type: 'image';
  image?: string | Uint8Array | URL;
  mimeType?: string;
}

interface AISDKFilePart {
  type: 'file';
  data?: string | Uint8Array | URL;
  filename?: string;
  name?: string;
  mimeType?: string;
}

interface AISDKReasoningPart {
  type: 'reasoning';
  text?: string;
}

interface AISDKToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args?: unknown; // AI SDK v4
  input?: unknown; // AI SDK v5
}

interface AISDKToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  result?: unknown; // AI SDK v4
  output?: unknown; // AI SDK v5
}

type AISDKContentPart =
  | AISDKTextPart
  | AISDKImagePart
  | AISDKFilePart
  | AISDKReasoningPart
  | AISDKToolCallPart
  | AISDKToolResultPart
  | { type: string; [key: string]: unknown }; // Catch-all for unknown types

/**
 * AI SDK message format (input format for conversion)
 */
interface AISDKMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | AISDKContentPart[];
  [key: string]: unknown; // Allow additional properties
}

/**
 * OpenAI Chat Completion tool call format
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenAI Chat Completion message format (output format)
 */
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  [key: string]: unknown; // Allow additional properties
}

// ==============================================================================
// Message conversion functions
// ==============================================================================

/**
 * Converts a content part to a string representation.
 * Handles text, image, file, reasoning, and other content types.
 */
function convertContentPart(part: AISDKContentPart | null | undefined): string | null {
  if (!part || typeof part !== 'object') {
    return null;
  }

  switch (part.type) {
    case 'text':
      return (part as AISDKTextPart).text || null;

    case 'image':
      // Represent image content with a placeholder
      return '[image]';

    case 'file': {
      // Represent file content with filename if available
      const filePart = part as AISDKFilePart;
      if (filePart.filename || filePart.name) {
        return `[file: ${filePart.filename || filePart.name}]`;
      }
      return '[file]';
    }

    case 'reasoning': {
      // Represent reasoning/thinking content
      const reasoningPart = part as AISDKReasoningPart;
      if (typeof reasoningPart.text === 'string' && reasoningPart.text.length > 0) {
        return `[reasoning: ${reasoningPart.text.substring(0, 100)}${reasoningPart.text.length > 100 ? '...' : ''}]`;
      }
      return '[reasoning]';
    }

    case 'tool-call':
      // Tool calls are handled separately in assistant messages
      return null;

    case 'tool-result':
      // Tool results are handled separately in tool messages
      return null;

    default: {
      // For unknown types, try to extract any text-like content
      const unknownPart = part as { type?: string; text?: string; content?: string };
      if (typeof unknownPart.text === 'string') {
        return unknownPart.text;
      }
      if (typeof unknownPart.content === 'string') {
        return unknownPart.content;
      }
      // Represent unknown content type
      return `[${unknownPart.type || 'unknown'}]`;
    }
  }
}

/**
 * Serializes tool result data to a string for OpenAI format.
 */
function serializeToolResult(resultData: unknown): string {
  if (typeof resultData === 'string') {
    return resultData;
  }
  if (resultData && typeof resultData === 'object' && 'value' in resultData) {
    const valueData = (resultData as { value: unknown }).value;
    return typeof valueData === 'string' ? valueData : JSON.stringify(valueData);
  }
  if (resultData === undefined || resultData === null) {
    return '';
  }
  try {
    return JSON.stringify(resultData);
  } catch {
    return '[unserializable result]';
  }
}

/**
 * Converts AI SDK message format to OpenAI Chat Completion format for Braintrust.
 *
 * Supports both AI SDK v4 and v5 formats:
 *   - v4 uses 'args' for tool calls and 'result' for tool results
 *   - v5 uses 'input' for tool calls and 'output' for tool results
 *
 * AI SDK format:
 *   { role: "user", content: [{ type: "text", text: "hello" }] }
 *   { role: "assistant", content: [{ type: "text", text: "..." }, { type: "tool-call", toolCallId: "...", toolName: "...", args: {...} }] }
 *   { role: "tool", content: [{ type: "tool-result", toolCallId: "...", result: {...} }] }
 *
 * OpenAI format (what Braintrust expects):
 *   { role: "user", content: "hello" }
 *   { role: "assistant", content: "...", tool_calls: [{ id: "...", type: "function", function: { name: "...", arguments: "..." } }] }
 *   { role: "tool", content: "result", tool_call_id: "..." }
 */
export function convertAISDKMessage(message: AISDKMessage | OpenAIMessage | unknown): OpenAIMessage | unknown {
  if (!message || typeof message !== 'object') {
    return message;
  }

  const { role, content, ...rest } = message as AISDKMessage;

  // If content is already a string, return as-is (already in OpenAI format)
  if (typeof content === 'string') {
    return message;
  }

  // If content is an array (AI SDK format), convert based on role
  if (Array.isArray(content)) {
    // Handle empty content arrays
    if (content.length === 0) {
      return { role, content: '', ...rest };
    }

    // For user/system messages, extract text and represent non-text content
    if (role === 'user' || role === 'system') {
      const contentParts = content.map((part: AISDKContentPart) => convertContentPart(part)).filter(Boolean);

      return {
        role,
        content: contentParts.length > 0 ? contentParts.join('\n') : '',
        ...rest,
      };
    }

    // For assistant messages, extract text, non-text content, AND tool calls
    if (role === 'assistant') {
      const contentParts = content
        .filter((part: AISDKContentPart) => part?.type !== 'tool-call')
        .map((part: AISDKContentPart) => convertContentPart(part))
        .filter(Boolean);

      const toolCallParts = content.filter((part: AISDKContentPart) => part?.type === 'tool-call');

      const result: OpenAIMessage = {
        role,
        content: contentParts.length > 0 ? (contentParts as string[]).join('\n') : '',
        ...rest,
      };

      // Add tool_calls array if there are tool calls
      if (toolCallParts.length > 0) {
        result.tool_calls = toolCallParts.map((tc: AISDKContentPart) => {
          const toolCall = tc as AISDKToolCallPart;
          const toolCallId = toolCall.toolCallId;
          const toolName = toolCall.toolName;
          // Support both v4 'args' and v5 'input'
          const args = toolCall.args ?? toolCall.input;

          let argsString: string;
          if (typeof args === 'string') {
            argsString = args;
          } else if (args !== undefined && args !== null) {
            argsString = JSON.stringify(args);
          } else {
            argsString = '{}';
          }

          return {
            id: toolCallId,
            type: 'function' as const,
            function: {
              name: toolName,
              arguments: argsString,
            },
          };
        });
      }

      return result;
    }

    // For tool messages, convert to OpenAI tool message format
    if (role === 'tool') {
      const toolResult = content.find((part): part is AISDKToolResultPart => part?.type === 'tool-result');
      if (toolResult) {
        // Support both v4 'result' and v5 'output' fields
        const resultData = toolResult.output ?? toolResult.result;
        const resultContent = serializeToolResult(resultData);

        return {
          role: 'tool',
          content: resultContent,
          tool_call_id: toolResult.toolCallId,
        } as OpenAIMessage;
      }
    }
  }

  return message;
}
