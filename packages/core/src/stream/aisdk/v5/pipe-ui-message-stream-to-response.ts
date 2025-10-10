import type { ServerResponse } from 'node:http';
import { TextEncoder } from 'node:util';
import type { ReadableStream } from 'stream/web';
import { TransformStream } from 'stream/web';

class JsonToSseTransformStream extends TransformStream<unknown, string> {
  constructor() {
    super({
      transform(part, controller) {
        controller.enqueue(`data: ${JSON.stringify(part)}\n\n`);
      },
      flush(controller) {
        controller.enqueue('data: [DONE]\n\n');
      },
    });
  }
}

export type UIMessageStreamResponseInit = {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  consumeSseStream?: (args: { stream: globalThis.ReadableStream<string> }) => void | Promise<void>;
};

/**
 * Default headers for UI message streams in SSE format.
 * Compatible with Vercel AI SDK's UI message stream headers.
 */
const UI_MESSAGE_STREAM_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'X-Vercel-AI-UI-Message-Stream': 'v1',
};

/**
 * Pipes a UI message stream to a Node.js ServerResponse (Express/NestJS compatible).
 * Converts the stream to Server-Sent Events (SSE) format and writes to the response.
 *
 * This function provides Node.js/Express equivalent functionality to Vercel's
 * `pipeUIMessageStreamToResponse` for Web Response objects.
 *
 * @param response - Node.js ServerResponse object (e.g., Express res object)
 * @param stream - ReadableStream of UI message parts to pipe
 * @param status - HTTP status code (default: 200)
 * @param statusText - HTTP status message (optional)
 * @param headers - Additional headers to merge with default SSE headers
 * @param consumeSseStream - Optional callback to consume a copy of the SSE stream (non-blocking)
 *
 * @example
 * ```typescript
 * Express route
 * app.get('/chat', (req, res) => {
 *   const stream = agent.generate({ prompt: 'Hello' });
 *   pipeUIMessageStreamToResponse({
 *     response: res,
 *     stream: stream.toUIMessageStream(),
 *     headers: { 'X-Custom': 'value' }
 *   });
 * });
 * ```
 */
export function pipeUIMessageStreamToResponse({
  response,
  status = 200,
  statusText,
  headers,
  stream,
  consumeSseStream,
}: {
  response: ServerResponse;
  stream: ReadableStream<unknown>;
} & UIMessageStreamResponseInit): void {
  let sseStream = stream.pipeThrough(new JsonToSseTransformStream()) as ReadableStream<string>;

  if (consumeSseStream) {
    const [s1, s2] = sseStream.tee();
    sseStream = s1;
    // Do not block response - run consumeSseStream asynchronously
    void Promise.resolve(consumeSseStream({ stream: s2 as unknown as globalThis.ReadableStream<string> })).catch(
      () => {},
    );
  }

  response.statusCode = status;
  if (statusText) response.statusMessage = statusText;

  const finalHeaders = { ...UI_MESSAGE_STREAM_HEADERS, ...(headers ?? {}) };
  for (const [k, v] of Object.entries(finalHeaders)) response.setHeader(k, v);

  // @ts-ignore - flushHeaders is present on Express Response
  response.flushHeaders?.();

  const encoder = new TextEncoder();
  const reader = sseStream.getReader();

  void (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        // value is string (from JsonToSseTransformStream); encode for Node write
        response.write(Buffer.from(encoder.encode(value as string)));
      }
    } catch (err) {
      try {
        response.write(`data: ${JSON.stringify({ type: 'error', errorText: String(err) })}\n\n`);
      } catch {}
    } finally {
      response.end();
    }
  })();
}
