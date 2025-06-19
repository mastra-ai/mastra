import { parseJsonEventStream } from '@ai-sdk/provider-utils';
import { UIMessage, TextUIPart, ReasoningUIPart } from 'ai';
import { z } from 'zod';

/**
 * @fileoverview Mastra UI Message Streaming Client
 *
 * This module provides a generic client for processing Mastra agent streams using proper AI SDK v5 patterns.
 * It constructs official UIMessage objects and provides real-time callbacks for UI updates.
 *
 * @example
 * ```typescript
 * const client = new MastraUIMessageClient({
 *   onTextPart: (text) => console.log('New text:', text),
 *   onToolCall: (toolCall) => console.log('Tool called:', toolCall),
 *   onMessageUpdate: (message) => updateUI(message),
 *   onComplete: (finalMessage) => console.log('Stream complete:', finalMessage),
 * });
 *
 * const response = await agent.stream({ messages: [...] });
 * const finalMessage = await client.processStream(response);
 * ```
 */

// TODO: Use official uiMessageStreamPartSchema when it's exported from 'ai'
const uiMessageStreamPartSchema = z.union([
  z.strictObject({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.strictObject({
    type: z.literal('error'),
    errorText: z.string(),
  }),
  z.strictObject({
    type: z.literal('tool-input-start'),
    toolCallId: z.string(),
    toolName: z.string(),
  }),
  z.strictObject({
    type: z.literal('tool-input-delta'),
    toolCallId: z.string(),
    inputTextDelta: z.string(),
  }),
  z.strictObject({
    type: z.literal('tool-input-available'),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.unknown(),
  }),
  z.strictObject({
    type: z.literal('tool-output-available'),
    toolCallId: z.string(),
    output: z.unknown(),
    providerMetadata: z.any().optional(),
  }),
  z.strictObject({
    type: z.literal('reasoning'),
    text: z.string(),
    providerMetadata: z.record(z.any()).optional(),
  }),
  z.strictObject({
    type: z.literal('reasoning-part-finish'),
  }),
  z.strictObject({
    type: z.literal('start-step'),
  }),
  z.strictObject({
    type: z.literal('finish-step'),
  }),
  z.strictObject({
    type: z.literal('start'),
    messageId: z.string().optional(),
    messageMetadata: z.unknown().optional(),
  }),
  z.strictObject({
    type: z.literal('finish'),
    messageMetadata: z.unknown().optional(),
  }),
  z.strictObject({
    type: z.literal('message-metadata'),
    messageMetadata: z.unknown(),
  }),
]);

/**
 * Type representing a stream part from the AI SDK v5 stream
 */
export type UIMessageStreamPart = z.infer<typeof uiMessageStreamPartSchema>;

/**
 * Tool call information extracted from stream parts
 */
export interface ToolCall {
  /** Unique identifier for the tool call */
  toolCallId: string;
  /** Name of the tool being called */
  toolName: string;
  /** Arguments passed to the tool */
  args: unknown;
}

/**
 * Tool result information extracted from stream parts
 */
export interface ToolResult {
  /** Unique identifier for the tool call this result belongs to */
  toolCallId: string;
  /** Result returned by the tool */
  result: unknown;
}

/**
 * Callback functions for handling different types of stream events
 */
export interface MastraStreamCallbacks {
  /** Called when a text chunk is received */
  onTextPart?: (text: string) => void;
  /** Called when a tool call is initiated */
  onToolCall?: (toolCall: ToolCall) => void;
  /** Called when a tool call result is received */
  onToolResult?: (toolResult: ToolResult) => void;
  /** Called when reasoning text is received */
  onReasoning?: (reasoning: string) => void;
  /** Called when an error occurs during streaming */
  onError?: (error: string) => void;
  /** Called whenever the UIMessage is updated (for real-time UI updates) */
  onMessageUpdate?: (message: UIMessage) => void;
  /** Called when the stream is complete */
  onComplete?: (message: UIMessage) => void;
}

/**
 * Interface representing a stream response from a Mastra agent
 */
export interface StreamResponse {
  /** The readable stream containing the response data */
  body: ReadableStream<Uint8Array> | null;
}

/**
 * Mastra UI Message Streaming Client
 *
 * A generic client that processes Mastra agent streams using proper AI SDK v5 patterns.
 * It constructs official UIMessage objects and provides real-time callbacks for UI updates.
 *
 * Key features:
 * - Uses AI SDK's parseJsonEventStream for robust parsing
 * - Constructs proper UIMessage objects with correct IDs
 * - Handles all stream part types (text, tools, reasoning, etc.)
 * - Framework-agnostic with callback-based updates
 * - Reusable across different Mastra applications
 */
export class MastraUIMessageClient {
  private callbacks: MastraStreamCallbacks;

  constructor(callbacks: MastraStreamCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Process a stream response from a Mastra agent
   * @param streamResponse The response from agent.stream()
   * @param userMessage Optional user message to include in conversation
   * @returns Promise that resolves with the complete assistant message
   */
  async processStream(streamResponse: StreamResponse, userMessage?: UIMessage): Promise<UIMessage | null> {
    if (!streamResponse.body) {
      const error = 'Stream response body is null';
      this.callbacks.onError?.(error);
      throw new Error(error);
    }

    try {
      // Parse the SSE stream using AI SDK utilities
      const stream = parseJsonEventStream({
        stream: streamResponse.body,
        schema: uiMessageStreamPartSchema,
      });

      // Initialize the assistant message structure
      const assistantMessage: UIMessage = {
        id: '', // Will be set from stream 'start' part
        role: 'assistant',
        parts: [],
      };

      // Current active parts for accumulation
      let activeTextPart: TextUIPart | null = null;
      let activeReasoningPart: ReasoningUIPart | null = null;
      const toolCalls = new Map<string, any>();

      // Process the stream and construct UIMessage parts
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value.success) {
            const streamPart = value.value;

            switch (streamPart.type) {
              case 'text':
                if (!activeTextPart) {
                  activeTextPart = { type: 'text', text: streamPart.text };
                  assistantMessage.parts.push(activeTextPart);
                } else {
                  activeTextPart.text += streamPart.text;
                }
                this.callbacks.onTextPart?.(streamPart.text);
                this.callbacks.onMessageUpdate?.(assistantMessage);
                break;

              case 'reasoning':
                if (!activeReasoningPart) {
                  activeReasoningPart = {
                    type: 'reasoning',
                    text: streamPart.text,
                    providerMetadata: streamPart.providerMetadata,
                  };
                  assistantMessage.parts.push(activeReasoningPart);
                } else {
                  activeReasoningPart.text += streamPart.text;
                  activeReasoningPart.providerMetadata = streamPart.providerMetadata;
                }
                this.callbacks.onReasoning?.(streamPart.text);
                this.callbacks.onMessageUpdate?.(assistantMessage);
                break;

              case 'reasoning-part-finish':
                activeReasoningPart = null;
                break;

              case 'start-step':
                // Add step boundary marker to message parts
                assistantMessage.parts.push({ type: 'step-start' } as any);
                this.callbacks.onMessageUpdate?.(assistantMessage);
                break;

              case 'finish-step':
                // Reset active parts for next step
                activeTextPart = null;
                activeReasoningPart = null;
                this.callbacks.onMessageUpdate?.(assistantMessage);
                break;

              case 'tool-input-start':
                toolCalls.set(streamPart.toolCallId, {
                  type: `tool-${streamPart.toolName}`,
                  toolCallId: streamPart.toolCallId,
                  state: 'input-streaming',
                  input: undefined,
                  toolName: streamPart.toolName,
                });
                break;

              case 'tool-input-available':
                const toolInputPart = {
                  type: `tool-${streamPart.toolName}`,
                  toolCallId: streamPart.toolCallId,
                  state: 'input-available' as const,
                  input: streamPart.input,
                  toolName: streamPart.toolName,
                };
                toolCalls.set(streamPart.toolCallId, toolInputPart);
                assistantMessage.parts.push(toolInputPart as any);

                this.callbacks.onToolCall?.({
                  toolCallId: streamPart.toolCallId,
                  toolName: streamPart.toolName,
                  args: streamPart.input,
                });
                this.callbacks.onMessageUpdate?.(assistantMessage);
                break;

              case 'tool-output-available':
                const existingTool = toolCalls.get(streamPart.toolCallId);
                if (existingTool) {
                  existingTool.state = 'output-available';
                  existingTool.output = streamPart.output;

                  this.callbacks.onToolResult?.({
                    toolCallId: streamPart.toolCallId,
                    result: streamPart.output,
                  });
                  this.callbacks.onMessageUpdate?.(assistantMessage);
                }
                break;

              case 'start':
                // The AI SDK provides the official message ID
                if (streamPart.messageId) {
                  assistantMessage.id = streamPart.messageId;
                } else {
                  // Fallback if no ID is provided
                  assistantMessage.id = `assistant-${Date.now()}`;
                }
                if (streamPart.messageMetadata) {
                  assistantMessage.metadata = streamPart.messageMetadata;
                }
                break;

              case 'finish':
                if (streamPart.messageMetadata) {
                  assistantMessage.metadata = streamPart.messageMetadata;
                }
                break;

              case 'error':
                const errorText = streamPart.errorText;
                this.callbacks.onError?.(errorText);
                throw new Error(`Stream error: ${errorText}`);

              case 'message-metadata':
                if (streamPart.messageMetadata) {
                  assistantMessage.metadata = streamPart.messageMetadata;
                  this.callbacks.onMessageUpdate?.(assistantMessage);
                }
                break;

              default:
                // Handle other stream part types if needed
                break;
            }
          } else {
            const errorMessage = `Parse error: ${value.error.message}`;
            this.callbacks.onError?.(errorMessage);
            throw new Error(errorMessage);
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Notify completion
      this.callbacks.onComplete?.(assistantMessage);
      return assistantMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onError?.(errorMessage);
      throw error;
    }
  }

  /**
   * Update callbacks for this client instance
   */
  updateCallbacks(callbacks: MastraStreamCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

/**
 * Helper function to create a user message in UIMessage format
 *
 * @param content - The text content of the message
 * @param attachments - Optional array of attachments
 * @returns A properly formatted UIMessage for user input
 *
 * @example
 * ```typescript
 * const userMessage = createUserMessage("Hello, how are you?");
 * const messageWithAttachment = createUserMessage("Analyze this image", [
 *   { type: 'image', url: 'data:image/png;base64,...', filename: 'chart.png' }
 * ]);
 * ```
 */
export function createUserMessage(content: string, attachments?: any[]): UIMessage {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    parts: [
      { type: 'text', text: content },
      ...(attachments?.map(attachment => ({
        type: attachment.type || 'file',
        ...attachment,
      })) || []),
    ],
  };
}

/**
 * Extract text content from a UIMessage
 *
 * @param message - The UIMessage to extract text from
 * @returns The concatenated text content from all text parts
 *
 * @example
 * ```typescript
 * const message = { role: 'assistant', parts: [{ type: 'text', text: 'Hello' }] };
 * const text = getTextContent(message); // "Hello"
 * ```
 */
export function getTextContent(message: UIMessage): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => (part as any).text)
    .join('');
}

// Re-export types for external use
export type { UIMessage, TextUIPart, ReasoningUIPart } from 'ai';
