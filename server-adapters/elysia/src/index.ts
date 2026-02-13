import type { ToolsInput } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import { formatZodError } from '@mastra/server/handlers/error';
import type { MCPHttpTransportResult, MCPSseTransportResult } from '@mastra/server/handlers/mcp';
import type { ParsedRequestParams, ServerRoute } from '@mastra/server/server-adapter';
import {
  MastraServer as MastraServerBase,
  normalizeQueryParams,
  redactStreamChunk,
} from '@mastra/server/server-adapter';
import type { Elysia } from 'elysia';
import { sse } from 'elysia';


export class MastraServer extends MastraServerBase<Elysia, Request, Response> {
  stream(route: ServerRoute, res: Response, result: { fullStream: ReadableStream }): Promise<unknown> {
    throw new Error('Method not implemented.');
  }
  getParams(route: ServerRoute, request: Request): Promise<ParsedRequestParams> {
    throw new Error('Method not implemented.');
  }
  sendResponse(route: ServerRoute, response: Response, result: unknown): Promise<unknown> {
    throw new Error('Method not implemented.');
  }
  registerRoute(app: Elysia, route: ServerRoute, { prefix }: { prefix?: string; }): Promise<void> {
    throw new Error('Method not implemented.');
  }
  registerContextMiddleware(): void {
    throw new Error('Method not implemented.');
  }
  registerAuthMiddleware(): void {
    throw new Error('Method not implemented.');
  }
}
