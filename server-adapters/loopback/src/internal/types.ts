import type { OperationObject, Request, Response } from '@loopback/rest';
import type { ApiRoute } from '@mastra/core/server';
import type { ServerRoute } from '@mastra/server/server-adapter';

export type RegisteredMastraRoute = ServerRoute & {
  handler?: (params: unknown) => unknown | Promise<unknown>;
  responseType?: string;
  streamFormat?: 'sse' | 'json-seq' | string;
  openapi?: OperationObject;
};

export type AuthError = {
  status: number;
  error: string;
};

export type ResponseEnvelope = {
  status?: number;
  statusCode?: number;
  headers?: unknown;
  body?: unknown;
};

export type FetchLikeResponse = {
  status: number;
  headers?: Headers;
  body?: ReadableStream<Uint8Array> | null;
  text?: () => Promise<string>;
};

export type McpHttpResult = {
  server?: {
    startHTTP?: (args: { url: URL; httpPath: string; req: Request; res: Response; options?: unknown }) => Promise<void>;
  };
  httpPath?: string;
  mcpOptions?: unknown;
};

export type McpSseResult = {
  server?: {
    startSSE?: (args: {
      url: URL;
      ssePath: string;
      messagePath: string;
      req: Request;
      res: Response;
      options?: unknown;
    }) => Promise<void>;
  };
  ssePath?: string;
  messagePath?: string;
  mcpOptions?: unknown;
};

export type RequestLogPayload = {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
};

export type LoopbackApiRouteMethod = ApiRoute['method'];
