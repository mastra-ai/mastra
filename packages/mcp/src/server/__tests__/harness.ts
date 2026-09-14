import http from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { ClientOptions } from '@modelcontextprotocol/client';
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from '@modelcontextprotocol/server';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { MCPServer } from '../server';
import type { MCPServerHTTPRequestOptions } from '../types';

export interface ServedHTTP {
  url: URL;
  close(): Promise<void>;
}

/** Serves `server` on a free port at `/mcp`, attaching `auth` to every request when provided. */
export async function serveHTTP(
  server: MCPServer,
  {
    auth,
    options,
  }: {
    auth?: AuthInfo | ((req: http.IncomingMessage) => AuthInfo | undefined);
    options?: MCPServerHTTPRequestOptions;
  } = {},
): Promise<ServedHTTP> {
  const httpServer = http.createServer(async (req, res) => {
    const authInfo = typeof auth === 'function' ? auth(req) : auth;
    if (authInfo) (req as http.IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
    await server.startHTTP({ url: new URL(req.url ?? '', 'http://localhost'), httpPath: '/mcp', req, res, options });
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('HTTP server did not bind to a port');
  return {
    url: new URL(`http://127.0.0.1:${address.port}/mcp`),
    close: async () => {
      await server.close();
      httpServer.closeAllConnections();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    },
  };
}

/** A client pinned to 2026-07-28: it never negotiates a legacy revision. */
export function modernClient(options: ClientOptions = {}): Client {
  return new Client(
    { name: 'test-client', version: '1.0.0' },
    { ...options, versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
}

export async function connectModern(
  url: URL,
  options: ClientOptions = {},
  headers?: Record<string, string>,
): Promise<Client> {
  const client = modernClient(options);
  await client.connect(new StreamableHTTPClientTransport(url, headers ? { requestInit: { headers } } : undefined));
  return client;
}

export interface RawResponse {
  status: number;
  headers: Headers;
  text: string;
  json: () => any;
}

/** Sends one hand-built JSON-RPC request, optionally with the 2026-07-28 envelope. */
export async function rawRequest(
  url: URL,
  {
    method,
    params = {},
    envelope = true,
    headers = {},
    httpMethod = 'POST',
    id = 1,
  }: {
    method?: string;
    params?: Record<string, unknown>;
    envelope?: boolean;
    headers?: Record<string, string>;
    httpMethod?: string;
    id?: number | null;
  },
): Promise<RawResponse> {
  const meta = envelope
    ? {
        [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
        [CLIENT_INFO_META_KEY]: { name: 'raw', version: '1.0.0' },
        [CLIENT_CAPABILITIES_META_KEY]: {},
      }
    : undefined;
  const body = method
    ? JSON.stringify({
        jsonrpc: '2.0',
        ...(id === null ? {} : { id }),
        method,
        params: { ...params, ...(meta ? { _meta: { ...(params._meta as object | undefined), ...meta } } : {}) },
      })
    : undefined;
  // node:http rather than fetch so tests can set forbidden headers such as Host.
  const response = await new Promise<{ status: number; headers: Headers; text: string }>((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: httpMethod,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(envelope ? { 'mcp-protocol-version': '2026-07-28' } : {}),
          ...(method && envelope ? { 'mcp-method': method } : {}),
          ...headers,
        },
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.from(chunk)));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: new Headers(
              Object.entries(res.headers).flatMap(([k, v]) =>
                v === undefined ? [] : [[k, Array.isArray(v) ? v.join(',') : v] as [string, string]],
              ),
            ),
            text: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('error', reject);
    request.end(body);
  });
  const { text } = response;
  return {
    status: response.status,
    headers: response.headers,
    text,
    json: () => {
      // Modern responses may arrive as a single-event SSE stream.
      const data = text.startsWith('event:') || text.startsWith('data:') ? text.match(/^data: (.*)$/m)?.[1] : text;
      return JSON.parse(data ?? text);
    },
  };
}

export function textOf(result: unknown): string | undefined {
  return (result as { content?: Array<{ text?: string }> }).content?.[0]?.text;
}
