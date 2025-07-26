/**
 * Vercel AI SDK v5 Data Format Converter
 * 
 * This module provides functions to convert incoming data to Vercel AI SDK v5 format.
 * It supports conversion to both UIMessage (for frontend display) and ModelMessage (for AI models).
 * 
 * Key changes in v5:
 * - Messages use 'parts' array instead of 'content' string
 * - UIMessage vs ModelMessage separation
 * - Tool calls are type-safe with specific naming: tool-${toolName}
 * - File parts use 'mediaType' instead of 'mimeType'
 * - Reasoning is now a separate part type
 */

import { generateId } from 'ai';

// Types for Vercel AI SDK v5
export interface UIMessage<TMetadata = never, TDataTypes = never, TUIToolTypes = never> {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: UIMessagePart<TDataTypes, TUIToolTypes>[];
  metadata?: TMetadata;
  createdAt?: Date;
}

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: ModelMessageContent;
}

export type ModelMessageContent = string | Array<TextPart | ImagePart | FilePart | ToolCallPart | ToolResultPart>;

export interface UIMessagePart<TDataTypes = never, TUIToolTypes = never> {
  type: 'text' | 'image' | 'file' | 'reasoning' | 'source' | `tool-${string}` | `data-${string}`;
  [key: string]: any;
}

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  image: string | Uint8Array | Buffer | ArrayBuffer | URL;
  mediaType?: string;
}

export interface FilePart {
  type: 'file';
  data: string | Uint8Array | Buffer | ArrayBuffer | URL;
  mediaType: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: unknown;
  isError?: boolean;
}

export interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

export interface SourcePart {
  type: 'source';
  sourceType: 'url' | 'document' | 'api';
  id: string;
  url?: string;
  title?: string;
  description?: string;
}

// Legacy v4 formats for conversion
export interface LegacyMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  content?: string;
  experimental_attachments?: Array<{
    name?: string;
    contentType?: string;
    url: string;
  }>;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
    state?: 'partial-call' | 'call' | 'result';
  }>;
  reasoning?: string;
  data?: any;
}

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content?: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

// Configuration options
export interface ConversionOptions {
  generateId?: () => string;
  includeTimestamp?: boolean;
  preserveOriginalId?: boolean;
  defaultMediaType?: string;
}

/**
 * Main converter class for Vercel AI SDK v5 data formats
 */
export class VercelAISDKv5Converter {
  private options: Required<ConversionOptions>;

  constructor(options: ConversionOptions = {}) {
    this.options = {
      generateId: options.generateId || (() => generateId()),
      includeTimestamp: options.includeTimestamp ?? true,
      preserveOriginalId: options.preserveOriginalId ?? true,
      defaultMediaType: options.defaultMediaType || 'application/octet-stream',
    };
  }

  /**
   * Convert various data formats to UIMessage format (for frontend display)
   */
  toUIMessage(
    input: LegacyMessage | OpenAIMessage | any,
    metadata?: any
  ): UIMessage {
    const id = this.getMessageId(input);
    const role = this.normalizeRole(input.role);
    const parts = this.convertToParts(input);
    const createdAt = this.options.includeTimestamp ? new Date() : undefined;

    return {
      id,
      role,
      parts,
      metadata,
      ...(createdAt && { createdAt }),
    };
  }

  /**
   * Convert various data formats to ModelMessage format (for AI models)
   */
  toModelMessage(input: LegacyMessage | OpenAIMessage | any): ModelMessage {
    const role = this.normalizeRole(input.role);
    const content = this.convertToModelContent(input);

    return {
      role: role as 'user' | 'assistant' | 'system' | 'tool',
      content,
    };
  }

  /**
   * Convert an array of messages to UIMessage format
   */
  toUIMessages(
    inputs: Array<LegacyMessage | OpenAIMessage | any>,
    metadata?: any[]
  ): UIMessage[] {
    return inputs.map((input, index) => 
      this.toUIMessage(input, metadata?.[index])
    );
  }

  /**
   * Convert an array of messages to ModelMessage format
   */
  toModelMessages(inputs: Array<LegacyMessage | OpenAIMessage | any>): ModelMessage[] {
    return inputs.map(input => this.toModelMessage(input));
  }

  /**
   * Convert tool invocations from v4 to v5 format
   */
  convertToolInvocations(toolInvocations: any[]): UIMessagePart[] {
    return toolInvocations.map(invocation => {
      const toolType = `tool-${invocation.toolName}` as const;
      
      // Handle different tool states
      switch (invocation.state) {
        case 'partial-call':
          return {
            type: toolType,
            state: 'input-streaming',
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            input: invocation.args,
          };
        case 'call':
          return {
            type: toolType,
            state: 'input-available',
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            input: invocation.args,
          };
        case 'result':
          return {
            type: toolType,
            state: 'output-available',
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            input: invocation.args,
            output: invocation.result,
          };
        default:
          return {
            type: toolType,
            state: 'input-available',
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            input: invocation.args,
            ...(invocation.result && { output: invocation.result }),
          };
      }
    });
  }

  /**
   * Convert attachments from v4 to v5 file parts
   */
  convertAttachmentsToFileParts(attachments: any[]): FilePart[] {
    return attachments.map(attachment => ({
      type: 'file',
      data: attachment.url,
      mediaType: attachment.contentType || attachment.mimeType || this.options.defaultMediaType,
      ...(attachment.name && { name: attachment.name }),
    }));
  }

  /**
   * Create a data part for custom data streaming
   */
  createDataPart(type: string, data: any, id?: string): UIMessagePart {
    return {
      type: `data-${type}`,
      id: id || this.options.generateId(),
      data,
    };
  }

  /**
   * Create a source part for citations and references
   */
  createSourcePart(
    sourceType: 'url' | 'document' | 'api',
    options: {
      id?: string;
      url?: string;
      title?: string;
      description?: string;
    }
  ): SourcePart {
    return {
      type: 'source',
      sourceType,
      id: options.id || this.options.generateId(),
      ...(options.url && { url: options.url }),
      ...(options.title && { title: options.title }),
      ...(options.description && { description: options.description }),
    };
  }

  /**
   * Convert reasoning text to reasoning part
   */
  createReasoningPart(text: string): ReasoningPart {
    return {
      type: 'reasoning',
      text,
    };
  }

  // Private helper methods
  private getMessageId(input: any): string {
    if (this.options.preserveOriginalId && input.id) {
      return input.id;
    }
    return this.options.generateId();
  }

  private normalizeRole(role: string): 'user' | 'assistant' | 'system' {
    switch (role) {
      case 'user':
      case 'assistant':
      case 'system':
        return role;
      case 'data':
        return 'assistant'; // Convert data role to assistant
      default:
        return 'user'; // Default fallback
    }
  }

  private convertToParts(input: any): UIMessagePart[] {
    const parts: UIMessagePart[] = [];

    // Handle reasoning first (appears before text in v5)
    if (input.reasoning) {
      parts.push(this.createReasoningPart(input.reasoning));
    }

    // Handle main content
    if (input.content) {
      if (typeof input.content === 'string') {
        parts.push({ type: 'text', text: input.content });
      } else if (Array.isArray(input.content)) {
        // Handle OpenAI-style content array
        input.content.forEach((item: any) => {
          if (item.type === 'text') {
            parts.push({ type: 'text', text: item.text });
          } else if (item.type === 'image_url') {
            parts.push({
              type: 'image',
              image: item.image_url.url,
              mediaType: 'image/jpeg', // Default, could be inferred
            });
          }
        });
      }
    }

    // Handle tool invocations (convert to v5 format)
    if (input.toolInvocations) {
      parts.push(...this.convertToolInvocations(input.toolInvocations));
    }

    // Handle tool calls (OpenAI format)
    if (input.tool_calls) {
      input.tool_calls.forEach((toolCall: any) => {
        const toolType = `tool-${toolCall.function.name}` as const;
        parts.push({
          type: toolType,
          state: 'input-available',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      });
    }

    // Handle experimental attachments
    if (input.experimental_attachments) {
      const fileParts = this.convertAttachmentsToFileParts(input.experimental_attachments);
      parts.push(...fileParts);
    }

    // Handle custom data
    if (input.data) {
      parts.push(this.createDataPart('custom', input.data));
    }

    return parts;
  }

  private convertToModelContent(input: any): ModelMessageContent {
    // For ModelMessage, we need simpler content format
    if (typeof input.content === 'string') {
      return input.content;
    }

    const contentParts: Array<TextPart | ImagePart | FilePart | ToolCallPart | ToolResultPart> = [];

    if (input.content) {
      if (Array.isArray(input.content)) {
        input.content.forEach((item: any) => {
          if (item.type === 'text') {
            contentParts.push({ type: 'text', text: item.text });
          } else if (item.type === 'image_url') {
            contentParts.push({
              type: 'image',
              image: item.image_url.url,
              mediaType: 'image/jpeg',
            });
          }
        });
      } else {
        contentParts.push({ type: 'text', text: String(input.content) });
      }
    }

    // Handle tool calls for ModelMessage
    if (input.tool_calls) {
      input.tool_calls.forEach((toolCall: any) => {
        contentParts.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      });
    }

    // Handle tool results
    if (input.toolInvocations) {
      input.toolInvocations.forEach((invocation: any) => {
        if (invocation.result !== undefined) {
          contentParts.push({
            type: 'tool-result',
            toolCallId: invocation.toolCallId,
            toolName: invocation.toolName,
            output: invocation.result,
          });
        }
      });
    }

    return contentParts.length === 1 && contentParts[0].type === 'text' 
      ? (contentParts[0] as TextPart).text
      : contentParts;
  }
}

// Convenience functions for quick conversion
export function convertToUIMessage(
  input: any,
  options?: ConversionOptions,
  metadata?: any
): UIMessage {
  const converter = new VercelAISDKv5Converter(options);
  return converter.toUIMessage(input, metadata);
}

export function convertToModelMessage(
  input: any,
  options?: ConversionOptions
): ModelMessage {
  const converter = new VercelAISDKv5Converter(options);
  return converter.toModelMessage(input);
}

export function convertToUIMessages(
  inputs: any[],
  options?: ConversionOptions,
  metadata?: any[]
): UIMessage[] {
  const converter = new VercelAISDKv5Converter(options);
  return converter.toUIMessages(inputs, metadata);
}

export function convertToModelMessages(
  inputs: any[],
  options?: ConversionOptions
): ModelMessage[] {
  const converter = new VercelAISDKv5Converter(options);
  return converter.toModelMessages(inputs);
}

// Example usage:
/*
// Convert legacy v4 message to v5 UIMessage
const legacyMessage = {
  id: 'msg-1',
  role: 'user',
  content: 'Hello AI!',
  experimental_attachments: [{
    name: 'image.jpg',
    contentType: 'image/jpeg',
    url: 'data:image/jpeg;base64,/9j/4AAQ...'
  }]
};

const uiMessage = convertToUIMessage(legacyMessage);

// Convert for use with AI models
const modelMessage = convertToModelMessage(legacyMessage);

// Convert OpenAI format
const openaiMessage = {
  role: 'user',
  content: [
    { type: 'text', text: 'What do you see in this image?' },
    { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
  ]
};

const convertedMessage = convertToUIMessage(openaiMessage);
*/