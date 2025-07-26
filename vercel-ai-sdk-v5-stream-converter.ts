/**
 * Vercel AI SDK v5 Streaming Data Format Converter
 * 
 * Converts incoming data to Vercel AI SDK v5 streaming format.
 * Focuses on the new Server-Sent Events (SSE) protocol and streaming architecture.
 * 
 * Key v5 streaming changes:
 * - Proprietary protocol → Server-Sent Events (SSE)
 * - Single chunks → Start/Delta/End pattern with unique IDs
 * - Enhanced streaming for text, reasoning, tool inputs, sources, etc.
 * - New stream part types and lifecycle events
 */

import { generateId } from 'ai';

// V5 Stream Part Types
export type V5StreamPart = 
  // Text streaming with start/delta/end pattern
  | { type: 'text-start'; id: string; }
  | { type: 'text-delta'; id: string; delta: string; }
  | { type: 'text-end'; id: string; }
  
  // Reasoning streaming
  | { type: 'reasoning-start'; id: string; }
  | { type: 'reasoning-delta'; id: string; delta: string; }
  | { type: 'reasoning-end'; id: string; }
  
  // Tool input streaming (new in v5)
  | { type: 'tool-input-start'; id: string; toolName: string; toolCallId: string; }
  | { type: 'tool-input-delta'; id: string; delta: string; }
  | { type: 'tool-input-end'; id: string; }
  
  // Tool calls and results
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown; }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown; isError?: boolean; }
  
  // Sources and citations
  | { type: 'source'; sourceType: 'url' | 'document' | 'api'; id: string; url?: string; title?: string; description?: string; }
  
  // File generation
  | { type: 'file'; mediaType: string; data: string; url?: string; }
  
  // Custom data parts
  | { type: 'data'; data: unknown; }
  
  // Stream lifecycle events
  | { type: 'start'; }
  | { type: 'finish-step'; finishReason: string; usage?: any; }
  | { type: 'finish'; totalUsage?: any; }
  | { type: 'error'; error: string; };

// Legacy v4 stream part types for conversion
export type LegacyStreamPart = 
  | { type: 'text-delta'; textDelta: string; }
  | { type: 'reasoning'; text: string; }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown; }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown; }
  | { type: 'source'; source: { sourceType: string; id: string; url?: string; title?: string; } }
  | { type: 'file'; file: { mediaType: string; data: string; } }
  | { type: 'step-finish'; finishReason: string; usage?: any; }
  | { type: 'finish'; usage?: any; };

// Server-Sent Events format
export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

// Configuration options
export interface StreamConversionOptions {
  generateId?: () => string;
  enableCompression?: boolean;
  bufferSize?: number;
  includeMetadata?: boolean;
}

/**
 * Converts various streaming formats to Vercel AI SDK v5 streaming format
 */
export class VercelAISDKv5StreamConverter {
  private options: Required<StreamConversionOptions>;
  private activeStreams: Map<string, { type: string; content: string; }> = new Map();

  constructor(options: StreamConversionOptions = {}) {
    this.options = {
      generateId: options.generateId || (() => generateId()),
      enableCompression: options.enableCompression ?? false,
      bufferSize: options.bufferSize || 1024,
      includeMetadata: options.includeMetadata ?? true,
    };
  }

  /**
   * Convert legacy v4 stream part to v5 format
   */
  convertLegacyStreamPart(legacyPart: LegacyStreamPart): V5StreamPart[] {
    const parts: V5StreamPart[] = [];

    switch (legacyPart.type) {
      case 'text-delta':
        // V4 had single text-delta, V5 uses start/delta/end pattern
        const textId = this.getOrCreateStreamId('text');
        if (!this.activeStreams.has(textId)) {
          parts.push({ type: 'text-start', id: textId });
          this.activeStreams.set(textId, { type: 'text', content: '' });
        }
        parts.push({ type: 'text-delta', id: textId, delta: legacyPart.textDelta });
        break;

      case 'reasoning':
        // V4 had single reasoning chunk, V5 streams it
        const reasoningId = this.options.generateId();
        parts.push(
          { type: 'reasoning-start', id: reasoningId },
          { type: 'reasoning-delta', id: reasoningId, delta: legacyPart.text },
          { type: 'reasoning-end', id: reasoningId }
        );
        break;

      case 'tool-call':
        // Convert args to input
        parts.push({
          type: 'tool-call',
          toolCallId: legacyPart.toolCallId,
          toolName: legacyPart.toolName,
          input: legacyPart.args
        });
        break;

      case 'tool-result':
        // Convert result to output
        parts.push({
          type: 'tool-result',
          toolCallId: legacyPart.toolCallId,
          toolName: legacyPart.toolName,
          output: legacyPart.result
        });
        break;

      case 'source':
        // Flatten source structure
        parts.push({
          type: 'source',
          sourceType: legacyPart.source.sourceType as 'url' | 'document' | 'api',
          id: legacyPart.source.id,
          ...(legacyPart.source.url && { url: legacyPart.source.url }),
          ...(legacyPart.source.title && { title: legacyPart.source.title })
        });
        break;

      case 'file':
        // Flatten file structure
        parts.push({
          type: 'file',
          mediaType: legacyPart.file.mediaType,
          data: legacyPart.file.data
        });
        break;

      case 'step-finish':
        // Rename to finish-step
        parts.push({
          type: 'finish-step',
          finishReason: legacyPart.finishReason,
          ...(legacyPart.usage && { usage: legacyPart.usage })
        });
        break;

      case 'finish':
        // Update usage to totalUsage
        parts.push({
          type: 'finish',
          ...(legacyPart.usage && { totalUsage: legacyPart.usage })
        });
        break;
    }

    return parts;
  }

  /**
   * Convert OpenAI streaming format to v5
   */
  convertOpenAIStreamChunk(chunk: any): V5StreamPart[] {
    const parts: V5StreamPart[] = [];

    if (chunk.choices?.[0]?.delta?.content) {
      const textId = this.getOrCreateStreamId('text');
      if (!this.activeStreams.has(textId)) {
        parts.push({ type: 'text-start', id: textId });
        this.activeStreams.set(textId, { type: 'text', content: '' });
      }
      parts.push({
        type: 'text-delta',
        id: textId,
        delta: chunk.choices[0].delta.content
      });
    }

    if (chunk.choices?.[0]?.delta?.tool_calls) {
      chunk.choices[0].delta.tool_calls.forEach((toolCall: any) => {
        if (toolCall.function?.name) {
          // Tool input streaming
          const toolInputId = this.getOrCreateStreamId(`tool-input-${toolCall.id}`);
          if (!this.activeStreams.has(toolInputId)) {
            parts.push({
              type: 'tool-input-start',
              id: toolInputId,
              toolName: toolCall.function.name,
              toolCallId: toolCall.id
            });
            this.activeStreams.set(toolInputId, { type: 'tool-input', content: '' });
          }
          
          if (toolCall.function.arguments) {
            parts.push({
              type: 'tool-input-delta',
              id: toolInputId,
              delta: toolCall.function.arguments
            });
          }
        }
      });
    }

    if (chunk.choices?.[0]?.finish_reason) {
      parts.push({
        type: 'finish-step',
        finishReason: chunk.choices[0].finish_reason
      });
    }

    return parts;
  }

  /**
   * Convert any stream chunk to v5 format
   */
  convertStreamChunk(input: any): V5StreamPart[] {
    // Auto-detect format and convert
    if (input.choices) {
      // OpenAI format
      return this.convertOpenAIStreamChunk(input);
    } else if (input.type) {
      // Legacy v4 format
      return this.convertLegacyStreamPart(input as LegacyStreamPart);
    } else {
      // Custom format - create data part
      return [{ type: 'data', data: input }];
    }
  }

  /**
   * Convert v5 stream part to Server-Sent Events format
   */
  toServerSentEvent(part: V5StreamPart, eventId?: string): SSEEvent {
    return {
      id: eventId || this.options.generateId(),
      event: 'stream-part',
      data: JSON.stringify(part)
    };
  }

  /**
   * Format SSE event as string for HTTP response
   */
  formatSSEEvent(event: SSEEvent): string {
    let formatted = '';
    
    if (event.id) {
      formatted += `id: ${event.id}\n`;
    }
    
    if (event.event) {
      formatted += `event: ${event.event}\n`;
    }
    
    if (event.retry) {
      formatted += `retry: ${event.retry}\n`;
    }
    
    // Handle multiline data
    const dataLines = event.data.split('\n');
    dataLines.forEach(line => {
      formatted += `data: ${line}\n`;
    });
    
    formatted += '\n'; // Empty line to separate events
    
    return formatted;
  }

  /**
   * Create a streaming text response with start/delta/end pattern
   */
  createTextStream(text: string, chunkSize: number = 50): V5StreamPart[] {
    const parts: V5StreamPart[] = [];
    const textId = this.options.generateId();
    
    parts.push({ type: 'text-start', id: textId });
    
    // Split text into chunks
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      parts.push({ type: 'text-delta', id: textId, delta: chunk });
    }
    
    parts.push({ type: 'text-end', id: textId });
    
    return parts;
  }

  /**
   * Create a reasoning stream
   */
  createReasoningStream(reasoning: string, chunkSize: number = 30): V5StreamPart[] {
    const parts: V5StreamPart[] = [];
    const reasoningId = this.options.generateId();
    
    parts.push({ type: 'reasoning-start', id: reasoningId });
    
    for (let i = 0; i < reasoning.length; i += chunkSize) {
      const chunk = reasoning.slice(i, i + chunkSize);
      parts.push({ type: 'reasoning-delta', id: reasoningId, delta: chunk });
    }
    
    parts.push({ type: 'reasoning-end', id: reasoningId });
    
    return parts;
  }

  /**
   * Create tool input streaming parts
   */
  createToolInputStream(
    toolName: string, 
    toolCallId: string, 
    input: any,
    chunkSize: number = 100
  ): V5StreamPart[] {
    const parts: V5StreamPart[] = [];
    const inputId = this.options.generateId();
    const inputJson = JSON.stringify(input);
    
    parts.push({
      type: 'tool-input-start',
      id: inputId,
      toolName,
      toolCallId
    });
    
    // Stream the JSON input
    for (let i = 0; i < inputJson.length; i += chunkSize) {
      const chunk = inputJson.slice(i, i + chunkSize);
      parts.push({ type: 'tool-input-delta', id: inputId, delta: chunk });
    }
    
    parts.push({ type: 'tool-input-end', id: inputId });
    
    // Final tool call with complete input
    parts.push({
      type: 'tool-call',
      toolCallId,
      toolName,
      input
    });
    
    return parts;
  }

  /**
   * Create source citation part
   */
  createSourcePart(
    sourceType: 'url' | 'document' | 'api',
    options: {
      id?: string;
      url?: string;
      title?: string;
      description?: string;
    }
  ): V5StreamPart {
    return {
      type: 'source',
      sourceType,
      id: options.id || this.options.generateId(),
      ...(options.url && { url: options.url }),
      ...(options.title && { title: options.title }),
      ...(options.description && { description: options.description })
    };
  }

  /**
   * Create file generation part
   */
  createFilePart(
    mediaType: string,
    data: string,
    url?: string
  ): V5StreamPart {
    return {
      type: 'file',
      mediaType,
      data,
      ...(url && { url })
    };
  }

  /**
   * Create custom data part
   */
  createDataPart(data: any): V5StreamPart {
    return {
      type: 'data',
      data
    };
  }

  /**
   * Finalize active text streams
   */
  finalizeActiveStreams(): V5StreamPart[] {
    const parts: V5StreamPart[] = [];
    
    for (const [id, stream] of this.activeStreams) {
      if (stream.type === 'text') {
        parts.push({ type: 'text-end', id });
      } else if (stream.type === 'reasoning') {
        parts.push({ type: 'reasoning-end', id });
      } else if (stream.type === 'tool-input') {
        parts.push({ type: 'tool-input-end', id });
      }
    }
    
    this.activeStreams.clear();
    return parts;
  }

  /**
   * Create a complete streaming response with lifecycle events
   */
  createStreamingResponse(parts: V5StreamPart[]): string {
    let response = '';
    
    // Start event
    const startEvent = this.toServerSentEvent({ type: 'start' });
    response += this.formatSSEEvent(startEvent);
    
    // Stream parts
    parts.forEach(part => {
      const event = this.toServerSentEvent(part);
      response += this.formatSSEEvent(event);
    });
    
    // Finish event
    const finishEvent = this.toServerSentEvent({ type: 'finish' });
    response += this.formatSSEEvent(finishEvent);
    
    return response;
  }

  // Private helper methods
  private getOrCreateStreamId(prefix: string): string {
    const existing = Array.from(this.activeStreams.keys()).find(id => id.startsWith(prefix));
    if (existing) return existing;
    
    const newId = `${prefix}-${this.options.generateId()}`;
    return newId;
  }
}

// Convenience functions for quick conversion
export function convertToV5StreamPart(input: any): V5StreamPart[] {
  const converter = new VercelAISDKv5StreamConverter();
  return converter.convertStreamChunk(input);
}

export function convertToSSE(part: V5StreamPart): string {
  const converter = new VercelAISDKv5StreamConverter();
  const event = converter.toServerSentEvent(part);
  return converter.formatSSEEvent(event);
}

export function createStreamingTextResponse(text: string, chunkSize?: number): string {
  const converter = new VercelAISDKv5StreamConverter();
  const parts = converter.createTextStream(text, chunkSize);
  return converter.createStreamingResponse(parts);
}

// Stream builder utility for complex scenarios
export class V5StreamBuilder {
  private parts: V5StreamPart[] = [];
  private converter: VercelAISDKv5StreamConverter;

  constructor(options?: StreamConversionOptions) {
    this.converter = new VercelAISDKv5StreamConverter(options);
  }

  addText(text: string, chunkSize?: number): this {
    this.parts.push(...this.converter.createTextStream(text, chunkSize));
    return this;
  }

  addReasoning(reasoning: string, chunkSize?: number): this {
    this.parts.push(...this.converter.createReasoningStream(reasoning, chunkSize));
    return this;
  }

  addToolCall(toolName: string, toolCallId: string, input: any): this {
    this.parts.push(...this.converter.createToolInputStream(toolName, toolCallId, input));
    return this;
  }

  addToolResult(toolCallId: string, toolName: string, output: any, isError?: boolean): this {
    this.parts.push({
      type: 'tool-result',
      toolCallId,
      toolName,
      output,
      ...(isError && { isError })
    });
    return this;
  }

  addSource(
    sourceType: 'url' | 'document' | 'api',
    options: { id?: string; url?: string; title?: string; description?: string; }
  ): this {
    this.parts.push(this.converter.createSourcePart(sourceType, options));
    return this;
  }

  addFile(mediaType: string, data: string, url?: string): this {
    this.parts.push(this.converter.createFilePart(mediaType, data, url));
    return this;
  }

  addData(data: any): this {
    this.parts.push(this.converter.createDataPart(data));
    return this;
  }

  build(): string {
    return this.converter.createStreamingResponse(this.parts);
  }

  getParts(): V5StreamPart[] {
    return [...this.parts];
  }

  clear(): this {
    this.parts = [];
    return this;
  }
}

export { VercelAISDKv5StreamConverter, V5StreamBuilder };