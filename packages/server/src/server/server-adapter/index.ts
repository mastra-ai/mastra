import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute } from '@mastra/core/server';
import z from 'zod';
import { generateHandler, getAgentByIdHandler, listAgentsHandler, streamGenerateHandler } from '../handlers/agents';
import { getAITracesPaginatedHandler } from '../handlers/observability';
import {
  createWorkflowRunHandler,
  getWorkflowByIdHandler,
  getWorkflowRunByIdHandler,
  listWorkflowRunsHandler,
  listWorkflowsHandler,
  streamWorkflowHandler,
} from '../handlers/workflows';
import { listToolsHandler } from '../handlers/tools';

type ServerRouteHandler<TParams = Record<string, unknown>, TResponse = unknown> = (
  params: TParams & { mastra: Mastra },
) => Promise<TResponse>;

export type ServerRoute<TParams = Record<string, unknown>, TResponse = unknown> = Omit<
  ApiRoute,
  'handler' | 'createHandler'
> & {
  responseType: 'stream' | 'json';
  handler: ServerRouteHandler<TParams, TResponse>;
  queryParamSchema?: z.ZodSchema;
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
  {
    method: 'GET',
    responseType: 'json',
    handler: listWorkflowsHandler as unknown as ServerRouteHandler,
    path: '/api/workflows',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkflowByIdHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: listWorkflowRunsHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/runs',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkflowRunByIdHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/runs/:runId',
  },
  {
    method: 'POST',
    responseType: 'json',
    handler: createWorkflowRunHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/create-run',
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: streamWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/stream',
  },
  {
    method: 'POST',
    responseType: 'stream',
    handler: streamWorkflowHandler as unknown as ServerRouteHandler,
    path: '/api/workflows/:workflowId/streamVNext',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: listToolsHandler as unknown as ServerRouteHandler,
    path: '/api/tools',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getAITracesPaginatedHandler as unknown as ServerRouteHandler,
    path: '/api/observability/traces',
    queryParamSchema: z.object({
      page: z.coerce.number().optional().default(0),
      perPage: z.coerce.number().optional().default(10),
      name: z.string().optional(),
      spanType: z.string().optional(),
      dateRange: z.string().optional(),
      entityId: z.string().optional(),
      entityType: z.string().optional(),
    }),
  },
];

export abstract class MastraServerAdapter<TApp, TRequest, TResponse> {
  protected mastra: Mastra;

  constructor({ mastra }: { mastra: Mastra }) {
    this.mastra = mastra;
  }

  abstract stream(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract getParams(
    route: ServerRoute,
    request: TRequest,
  ): Promise<{ urlParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }>;
  abstract sendResponse(route: ServerRoute, response: TResponse, result: unknown): Promise<unknown>;
  abstract registerRoute(app: TApp, route: ServerRoute): Promise<void>;

  async registerRoutes(app: TApp): Promise<void> {
    await Promise.all(SERVER_ROUTES.map(route => this.registerRoute(app, route)));
  }

  async parseQueryParams(route: ServerRoute, params: Record<string, string>): Promise<Record<string, any>> {
    const queryParamSchema = route.queryParamSchema;
    if (!queryParamSchema) {
      return params;
    }

    return queryParamSchema.parseAsync(params);
  }
}
