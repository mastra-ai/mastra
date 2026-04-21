import type { Request, Response } from '@loopback/rest';
import type { ServerRoute } from '@mastra/server/server-adapter';

import { joinPath } from './path-utils.js';
import { buildRequestUrl } from './request-utils.js';
import type {
  FetchLikeResponse,
  McpHttpResult,
  McpSseResult,
  RegisteredMastraRoute,
  ResponseEnvelope,
} from './types.js';

export interface LoopbackResponseWriterOptions {
  prefix?: string;
  applyStreamRedaction: (chunk: unknown) => Promise<unknown>;
}

export class LoopbackResponseWriter {
  constructor(private readonly options: LoopbackResponseWriterOptions) {}

  async sendResponse(route: ServerRoute, res: Response, result: unknown, request?: Request): Promise<void> {
    const responseType = getResponseType(route);

    if (responseType === 'stream') {
      await this.stream(route, res, result);
      return;
    }

    if (responseType === 'datastream-response') {
      if (isFetchLikeResponse(result)) {
        await writeFetchLikeResponse(res, result);
        return;
      }
      res.setHeader('x-vercel-ai-data-stream', 'v1');
      await this.stream(route, res, result);
      return;
    }

    if (responseType === 'mcp-http') {
      await this.handleMcpHttpResponse(result, res, request);
      return;
    }

    if (responseType === 'mcp-sse') {
      await this.handleMcpSseResponse(result, res, request);
      return;
    }

    if (result === undefined) {
      res.status(204).end();
      return;
    }

    if (isFetchLikeResponse(result)) {
      await writeFetchLikeResponse(res, result);
      return;
    }

    if (isResponseEnvelope(result)) {
      applyHeaders(res, result.headers);
      const status = result.statusCode ?? result.status ?? 200;
      res.status(status);
      if (result.body === undefined) {
        res.end();
        return;
      }
      writeBodyValue(res, result.body);
      return;
    }

    writeBodyValue(res, result);
  }

  async stream(route: ServerRoute, res: Response, result: unknown): Promise<void> {
    const responseType = getResponseType(route);
    const streamRoute = route as RegisteredMastraRoute;
    const sseMode = streamRoute.streamFormat === 'sse' || responseType === 'mcp-sse';

    if (sseMode) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    } else {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
    }
    res.flushHeaders?.();

    const iterable = toAsyncIterable(result);
    if (!iterable) {
      writeStreamChunk(res, result, sseMode);
      if (sseMode) {
        res.write('event: done\ndata: [DONE]\n\n');
      }
      res.end();
      return;
    }

    for await (const originalChunk of iterable) {
      const chunk = await this.options.applyStreamRedaction(originalChunk);
      writeStreamChunk(res, chunk, sseMode);
    }

    if (sseMode) {
      res.write('event: done\ndata: [DONE]\n\n');
    }
    res.end();
  }

  sendErrorResponse(res: Response, error: unknown): void {
    const fallbackMessage = 'Internal Server Error';
    if (!error || typeof error !== 'object') {
      res.status(500).json({ error: fallbackMessage });
      return;
    }

    const knownError = error as { status?: number; statusCode?: number; message?: string };
    const status = knownError.statusCode ?? knownError.status ?? 500;
    const message = knownError.message ?? fallbackMessage;
    res.status(status).json({ error: message });
  }

  private async handleMcpHttpResponse(result: unknown, res: Response, request?: Request): Promise<void> {
    if (!request) {
      throw new Error('Request is required for mcp-http response handling.');
    }
    const mcpResult = result as McpHttpResult;
    if (typeof mcpResult?.server?.startHTTP !== 'function') {
      throw new Error('Invalid mcp-http result. Expected server.startHTTP(...)');
    }

    const httpPath = joinPath(this.options.prefix, mcpResult.httpPath ?? '');
    await mcpResult.server.startHTTP({
      url: buildRequestUrl(request),
      httpPath,
      req: request,
      res,
      options: mcpResult.mcpOptions,
    });
  }

  private async handleMcpSseResponse(result: unknown, res: Response, request?: Request): Promise<void> {
    if (!request) {
      throw new Error('Request is required for mcp-sse response handling.');
    }
    const mcpResult = result as McpSseResult;
    if (typeof mcpResult?.server?.startSSE !== 'function') {
      throw new Error('Invalid mcp-sse result. Expected server.startSSE(...)');
    }

    const ssePath = joinPath(this.options.prefix, mcpResult.ssePath ?? '');
    const messagePath = joinPath(this.options.prefix, mcpResult.messagePath ?? '');
    await mcpResult.server.startSSE({
      url: buildRequestUrl(request),
      ssePath,
      messagePath,
      req: request,
      res,
      options: mcpResult.mcpOptions,
    });
  }
}

function getResponseType(route: ServerRoute): string | undefined {
  return (route as RegisteredMastraRoute).responseType;
}

async function writeFetchLikeResponse(res: Response, response: FetchLikeResponse): Promise<void> {
  res.status(response.status);
  applyHeaders(res, response.headers);

  if (response.body) {
    for await (const chunk of webStreamToAsyncIterable(response.body)) {
      res.write(chunk);
    }
    res.end();
    return;
  }

  if (typeof response.text === 'function') {
    res.end(await response.text());
    return;
  }

  res.end();
}

function applyHeaders(res: Response, headers: unknown): void {
  if (!headers) {
    return;
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => res.setHeader(key, value));
    return;
  }

  if (typeof headers !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      res.setHeader(
        key,
        value.filter(entry => entry !== undefined && entry !== null).map(entry => String(entry)),
      );
    } else {
      res.setHeader(key, String(value));
    }
  }
}

function writeBodyValue(res: Response, body: unknown): void {
  if (body === undefined) {
    res.end();
    return;
  }

  if (Buffer.isBuffer(body)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(body);
    return;
  }

  if (typeof body === 'object' && body !== null) {
    res.json(body);
    return;
  }

  res.send(String(body));
}

function isResponseEnvelope(value: unknown): value is ResponseEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return 'status' in candidate || 'statusCode' in candidate || 'body' in candidate;
}

function isFetchLikeResponse(value: unknown): value is FetchLikeResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === 'number' &&
    (candidate.headers instanceof Headers ||
      isWebReadableStream(candidate.body) ||
      typeof candidate.text === 'function')
  );
}

function toAsyncIterable(value: unknown): AsyncIterable<unknown> | null {
  if (!value) {
    return null;
  }

  if (isAsyncIterable(value)) {
    return value;
  }

  if (isSyncIterable(value)) {
    return fromIterable(value);
  }

  if (typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (candidate.fullStream && isAsyncIterable(candidate.fullStream)) {
      return candidate.fullStream;
    }
    if (candidate.fullStream && isWebReadableStream(candidate.fullStream)) {
      return webStreamToAsyncIterable(candidate.fullStream);
    }
    if (candidate.body && isWebReadableStream(candidate.body)) {
      return webStreamToAsyncIterable(candidate.body);
    }
    if (candidate.body && isAsyncIterable(candidate.body)) {
      return candidate.body;
    }
    if (isWebReadableStream(value)) {
      return webStreamToAsyncIterable(value);
    }
  }

  return null;
}

async function* fromIterable(value: Iterable<unknown>): AsyncIterable<unknown> {
  for (const item of value) {
    yield item;
  }
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    Symbol.asyncIterator in value &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
  );
}

function isSyncIterable(value: unknown): value is Iterable<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    Symbol.iterator in value &&
    typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function'
  );
}

function isWebReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    !!value &&
    typeof value === 'object' &&
    'getReader' in value &&
    typeof (value as { getReader?: unknown }).getReader === 'function'
  );
}

async function* webStreamToAsyncIterable(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      if (value) {
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function writeStreamChunk(res: Response, chunk: unknown, sseMode: boolean): void {
  if (sseMode) {
    res.write(toSseChunk(chunk));
    return;
  }

  if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
    res.write(chunk);
    return;
  }

  if (chunk instanceof Uint8Array) {
    res.write(Buffer.from(chunk));
    return;
  }

  if (chunk === undefined || chunk === null) {
    return;
  }

  res.write(`${JSON.stringify(chunk)}\x1E`);
}

function toSseChunk(chunk: unknown): string {
  if (chunk === undefined || chunk === null) {
    return 'data: null\n\n';
  }

  if (Buffer.isBuffer(chunk)) {
    return toSseChunk(chunk.toString('utf8'));
  }

  if (chunk instanceof Uint8Array) {
    return toSseChunk(Buffer.from(chunk).toString('utf8'));
  }

  if (typeof chunk === 'string') {
    const trimmed = chunk.trimStart();
    const alreadyFramed = trimmed.startsWith('data:') || trimmed.startsWith('event:') || trimmed.startsWith(':');
    if (alreadyFramed) {
      return chunk.endsWith('\n\n') ? chunk : `${chunk}\n\n`;
    }
    return `data: ${chunk}\n\n`;
  }

  return `data: ${JSON.stringify(chunk)}\n\n`;
}
