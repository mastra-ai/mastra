import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute } from '@mastra/core/server';
import { generateHandler, getAgentByIdHandler, listAgentsHandler, streamGenerateHandler } from '../handlers/agents';

type ServerRouteHandler<TParams = Record<string, unknown>, TResponse = unknown> = (
  params: TParams & { mastra: Mastra },
) => Promise<TResponse>;

export type ServerRoute<TParams = Record<string, unknown>, TResponse = unknown> = Omit<
  ApiRoute,
  'handler' | 'createHandler'
> & {
  responseType: 'stream' | 'json';
  handler: ServerRouteHandler<TParams, TResponse>;
};

export const SERVER_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: listAgentsHandler as unknown as ServerRouteHandler,
    path: '/api/agents',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getAgentByIdHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId',
  },
  {
    method: 'POST',
    responseType: 'json',
    handler: generateHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId/generate',
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: streamGenerateHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId/stream',
  },
];

export abstract class MastraServerAdapter<TApp, TRequest, TResponse> {
  protected mastra: Mastra;

  constructor({ mastra }: { mastra: Mastra }) {
    this.mastra = mastra;
  }

  abstract stream(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract getParams(route: ServerRoute, request: TRequest): Promise<Record<string, unknown>>;
  abstract sendResponse(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract registerRoute(app: TApp, route: ServerRoute): Promise<void>;

  async registerRoutes(app: TApp): Promise<void> {
    await Promise.all(SERVER_ROUTES.map(route => this.registerRoute(app, route)));
  }
}
