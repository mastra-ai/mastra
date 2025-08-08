/**
 * AI SDK v5 to v4 Stream Transformer
 * Converts v5 UIMessageStream format to v4 DataStream format for backwards compatibility
 *
 * Single file implementation with inline tool call tracking and ID generation
 */

// Import actual AI SDK v5 types and extend them for broader compatibility
import type { UIMessageChunk as BaseUIMessageStreamPart } from 'ai';

// Extended type that includes common events we might encounter
export type UIMessageChunk =
  | BaseUIMessageStreamPart
  | { type: 'response-metadata'; id: string; modelId: string; timestamp: Date }
  | { type: 'source'; id: string; title?: string; url?: string; content?: unknown } // Legacy source format
  | { type: 'file'; id: string; name: string; mimeType: string; content: unknown } // Legacy file format for tests
  | { type: 'data'; data: unknown }
  | { type: 'reasoning-signature'; signature: string; hash: string; metadata?: object }
  | { type: 'redacted-reasoning'; text: string; redactionReason: string; originalLength: number }
  // These events exist in AI SDK v5 but may not be in our base type
  | { type: 'reasoning'; text: string; providerMetadata?: Record<string, any> }
  | { type: 'reasoning-part-finish' };

// V4 Stream Prefixes (from AI SDK v4)
const DataStreamStringPrefixes = {
  text: '0',
  data: '2',
  error: '3',
  message_annotations: '8',
  tool_call: '9',
  tool_result: 'a',
  tool_call_streaming_start: 'b',
  tool_call_delta: 'c',
  finish_message: 'd',
  finish_step: 'e',
  start_step: 'f',
  reasoning: 'g',
  source: 'h',
  redacted_reasoning: 'i',
  reasoning_signature: 'j',
  file: 'k',
} as const;

// Per-stream state interface
interface StreamState {
  messageCounter: number;
  stepCounter: number;
  toolCalls: Map<string, { name: string; input?: unknown }>;
}

export function createStreamState(): StreamState {
  return {
    messageCounter: 0,
    stepCounter: 0,
    toolCalls: new Map<string, { name: string; input?: unknown }>(),
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse Server-Sent Events stream into individual JSON objects
 */
export function parseSSEStream(): TransformStream<Uint8Array, UIMessageChunk> {
  const decoder = new TextDecoder();
  let buffer = '';
  const maxBufferSize = 1024 * 1024; // 1MB limit

  return new TransformStream({
    transform(chunk, controller) {
      try {
        const text = decoder.decode(chunk, { stream: true });

        // Prevent unbounded buffer growth
        if (buffer.length + text.length > maxBufferSize) {
          console.warn('SSE parser: Buffer size limit exceeded, truncating');
          buffer = buffer.slice(buffer.length / 2);
        }

        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            // Check for stream end marker
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data) as UIMessageChunk;
              controller.enqueue(parsed);
            } catch {
              console.warn('Failed to parse SSE data:', data.slice(0, 50) + '...');
            }
          }
        }
      } catch (streamError) {
        console.error('Stream processing error:', streamError);
        controller.error(streamError);
      }
    },

    flush(controller) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice('data: '.length);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data) as UIMessageChunk;
            controller.enqueue(parsed);
          } catch {
            console.warn('Failed to parse final SSE data:', data.slice(0, 50) + '...');
          }
        }
      }
    },
  });
}

/**
 * Transform v5 UIMessageChunk to v4 DataStream format
 */
export function transformV5ToV4Part(part: UIMessageChunk, state: StreamState): string | null {
  switch (part.type) {
    case 'text-start':
      // Start of text block - no output needed for v4
      return null;
    case 'text-delta':
      return `${DataStreamStringPrefixes.text}:${JSON.stringify(part.delta)}\n`;
    case 'text-end':
      // End of text block - no output needed for v4
      return null;

    case 'error':
      try {
        const errorData =
          typeof part.errorText === 'string'
            ? { message: part.errorText, code: 'STREAM_ERROR', timestamp: Date.now() }
            : part.errorText;
        return `${DataStreamStringPrefixes.error}:${JSON.stringify(errorData)}\n`;
      } catch (err) {
        console.warn('Error formatting error part:', err);
        return `${DataStreamStringPrefixes.error}:${JSON.stringify({ message: 'Stream error', code: 'TRANSFORM_ERROR' })}\n`;
      }

    case 'tool-input-start':
      state.toolCalls.set(part.toolCallId, { name: part.toolName });
      return `${DataStreamStringPrefixes.tool_call_streaming_start}:${JSON.stringify({
        toolCallId: part.toolCallId,
        toolName: part.toolName,
      })}\n`;

    case 'tool-input-delta':
      return `${DataStreamStringPrefixes.tool_call_delta}:${JSON.stringify({
        toolCallId: part.toolCallId,
        argsTextDelta: part.inputTextDelta,
      })}\n`;

    case 'tool-input-available':
      const toolCall = state.toolCalls.get(part.toolCallId);
      if (toolCall) {
        toolCall.input = part.input;
      }
      return `${DataStreamStringPrefixes.tool_call}:${JSON.stringify({
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input,
      })}\n`;

    case 'tool-output-available':
      state.toolCalls.delete(part.toolCallId); // Clean up
      return `${DataStreamStringPrefixes.tool_result}:${JSON.stringify({
        toolCallId: part.toolCallId,
        result: part.output,
      })}\n`;

    case 'reasoning-start':
      // Start of reasoning block - no output needed for v4
      return null;
    case 'reasoning-delta':
      return `${DataStreamStringPrefixes.reasoning}:${JSON.stringify(part.delta)}\n`;
    case 'reasoning-end':
      // End of reasoning block - no output needed for v4
      return null;

    case 'start':
      state.messageCounter++;
      const messageId = part.messageId || generateId(`msg-${state.messageCounter}`);
      return `${DataStreamStringPrefixes.message_annotations}:${JSON.stringify([
        {
          messageId,
          metadata: part.messageMetadata,
        },
      ])}\n`;

    case 'finish':
      return `${DataStreamStringPrefixes.finish_message}:${JSON.stringify({
        finishReason: 'stop',
        metadata: part.messageMetadata,
      })}\n`;

    case 'start-step':
      state.stepCounter++;
      const stepId = generateId(`step-${state.stepCounter}`);
      return `${DataStreamStringPrefixes.start_step}:${JSON.stringify({ messageId: stepId })}\n`;

    case 'finish-step':
      return `${DataStreamStringPrefixes.finish_step}:${JSON.stringify({
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
        isContinued: false,
      })}\n`;

    case 'message-metadata':
      return `${DataStreamStringPrefixes.message_annotations}:${JSON.stringify([
        {
          messageId: generateId('msg'),
          metadata: part.messageMetadata,
        },
      ])}\n`;

    case 'file':
      // Handle both new AI SDK v5 format and legacy test format
      if ('url' in part && 'mediaType' in part) {
        // New AI SDK v5 format
        return `${DataStreamStringPrefixes.file}:${JSON.stringify({
          url: part.url,
          mediaType: part.mediaType,
        })}\n`;
      } else if ('id' in part && 'name' in part) {
        // Legacy test format
        return `${DataStreamStringPrefixes.file}:${JSON.stringify({
          id: part.id,
          name: part.name,
          type: part.mimeType,
          content: part.content,
        })}\n`;
      }
      return null;

    case 'source-url':
      return `${DataStreamStringPrefixes.source}:${JSON.stringify({
        id: part.sourceId,
        title: part.title,
        url: part.url,
      })}\n`;

    case 'source-document':
      return `${DataStreamStringPrefixes.source}:${JSON.stringify({
        id: part.sourceId,
        title: part.title,
        mediaType: part.mediaType,
        filename: part.filename,
      })}\n`;

    case 'source': // Legacy source format for backward compatibility with tests
      return `${DataStreamStringPrefixes.source}:${JSON.stringify({
        id: part.id,
        title: part.title,
        url: part.url,
        content: part.content,
      })}\n`;

    case 'response-metadata':
      // Map to message_annotations with metadata info
      return `${DataStreamStringPrefixes.message_annotations}:${JSON.stringify([
        {
          messageId: part.id,
          metadata: {
            modelId: part.modelId,
            timestamp: part.timestamp.toISOString(),
          },
        },
      ])}\n`;

    case 'data':
      return `${DataStreamStringPrefixes.data}:${JSON.stringify(part.data)}\n`;

    case 'reasoning-signature':
      return `${DataStreamStringPrefixes.reasoning_signature}:${JSON.stringify({
        signature: part.signature,
        hash: part.hash,
        metadata: part.metadata,
      })}\n`;

    case 'redacted-reasoning':
      return `${DataStreamStringPrefixes.redacted_reasoning}:${JSON.stringify({
        text: part.text,
        redactionReason: part.redactionReason,
        originalLength: part.originalLength,
      })}\n`;

    // Handle legacy reasoning format that still exists in v5
    case 'reasoning':
      return `${DataStreamStringPrefixes.reasoning}:${JSON.stringify((part as any).text)}\n`;
    case 'reasoning-part-finish':
      return null; // Skip this event type

    default:
      console.warn('Unknown v5 stream part type:', (part as any).type);
      return null;
  }
}

/**
 * Create a TransformStream that converts v5 parts to v4 format
 */
export function createV5ToV4Transformer(): TransformStream<UIMessageChunk, string> {
  // Create isolated state for this specific stream instance
  const streamState = createStreamState();

  return new TransformStream({
    transform(part, controller) {
      try {
        const v4Part = transformV5ToV4Part(part, streamState);
        if (v4Part) {
          controller.enqueue(v4Part);
        }
      } catch (transformError) {
        console.warn('Transform error for part type:', (part as any).type, transformError);
        // Continue processing - don't break the whole stream
      }
    },
  });
}

/**
 * Main function to transform a v5 stream to v4 format
 */
export function transformV5StreamToV4(v5Stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  return v5Stream
    .pipeThrough(parseSSEStream())
    .pipeThrough(createV5ToV4Transformer())
    .pipeThrough(new TextEncoderStream());
}

/**
 * Response helper for Next.js API routes
 */
export function createV4CompatibleResponse(v5Stream: ReadableStream<Uint8Array>): Response {
  const v4Stream = transformV5StreamToV4(v5Stream);

  return new Response(v4Stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Vercel-AI-Data-Stream': 'v1',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Express/Node.js helper - pipes Web API Response to Express response
 */
export async function pipeV4ResponseToExpress(v4Response: Response, expressRes: any): Promise<void> {
  // Set headers
  v4Response.headers.forEach((value, key) => {
    expressRes.setHeader(key, value);
  });

  // Set status
  expressRes.status(v4Response.status);

  // Pipe the stream
  if (!v4Response.body) {
    expressRes.end();
    return;
  }

  const reader = v4Response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      expressRes.write(value);
    }
    expressRes.end();
  } catch (error) {
    console.error('Stream error:', error);
    expressRes.status(500).end();
  }
}

/**
 * One-liner for Express: Transform v5 stream and pipe to Express response
 */
export async function streamV5ToV4Express(v5Stream: ReadableStream<Uint8Array>, expressRes: any): Promise<void> {
  const v4Response = createV4CompatibleResponse(v5Stream);
  await pipeV4ResponseToExpress(v4Response, expressRes);
}
