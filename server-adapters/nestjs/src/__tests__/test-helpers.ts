import { IncomingMessage, ServerResponse } from 'node:http';
import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';
import type { Application } from 'express';

export type MockHttpRequest = {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  rawBody?: string | Buffer;
};

export type MockHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  stream?: Readable;
};

function normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

export async function executeExpressRequest(app: Application, req: MockHttpRequest): Promise<MockHttpResponse> {
  return await new Promise((resolve, reject) => {
    const socket = new PassThrough() as any;
    socket.remoteAddress = '127.0.0.1';

    const request = new IncomingMessage(socket);
    request.method = req.method.toUpperCase();
    request.url = req.path;
    request.headers = normalizeHeaders(req.headers);
    (request as any).res = undefined;

    let pendingRawBody: Buffer | null = null;

    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (req.rawBody !== undefined) {
        const payload = Buffer.from(req.rawBody);
        if (!request.headers['content-length']) {
          request.headers['content-length'] = String(payload.length);
        }
        pendingRawBody = payload;
      } else if (req.body !== undefined) {
        // If body is already provided, mark it as parsed to avoid body-parser hangs.
        (request as any).body = req.body;
        (request as any)._body = true;
      }
    }
    if (!pendingRawBody) {
      request.push(null);
    }

    const response = new ServerResponse(request);
    response.assignSocket(socket);
    (response as any).req = request;
    (request as any).res = response;

    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    let isStream = false;
    let resolved = false;

    const getHeaders = () => {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.getHeaders())) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value);
      }
      return headers;
    };

    const updateStreamFlag = () => {
      const contentType = String(response.getHeader('content-type') || '').toLowerCase();
      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        isStream = true;
      }
    };

    const resolveStream = () => {
      if (resolved || !isStream) return;
      resolved = true;
      resolve({
        status: response.statusCode,
        headers: getHeaders(),
        body: undefined,
        stream,
      });
    };

    const originalWrite = response.write.bind(response);
    response.write = (chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        stream.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      updateStreamFlag();
      resolveStream();
      return originalWrite(chunk, ...args);
    };

    const originalEnd = response.end.bind(response);
    response.end = (chunk?: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        stream.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      updateStreamFlag();
      if (isStream) {
        stream.end();
        resolveStream();
      }
      return originalEnd(chunk, ...args);
    };

    response.on('finish', () => {
      if (resolved) return;
      const headers = getHeaders();

      const bodyBuffer = Buffer.concat(chunks);
      const contentType = headers['content-type'] || '';

      if (String(contentType).includes('text/plain')) {
        resolveStream();
        return;
      }

      if (String(contentType).includes('application/json')) {
        try {
          const parsed = JSON.parse(bodyBuffer.toString('utf-8') || '{}');
          resolve({ status: response.statusCode, headers, body: parsed });
          return;
        } catch {
          resolve({ status: response.statusCode, headers, body: {} });
          return;
        }
      }

      resolved = true;
      resolve({ status: response.statusCode, headers, body: bodyBuffer.toString('utf-8') });
    });

    response.on('error', reject);
    request.on('error', reject);

    (app as unknown as { handle: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void }).handle(
      request,
      response,
    );

    if (pendingRawBody) {
      setImmediate(() => {
        request.push(pendingRawBody);
        request.push(null);
      });
    }
  });
}
