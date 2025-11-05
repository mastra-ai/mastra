import { getToolByIdHandler, listToolsHandler } from '../../handlers/tools';
import { listToolsResponseSchema, serializedToolSchema, toolIdPathParams } from '../../schemas/agents';
import { createRoute } from './route-builder';
import type { ServerRoute, ServerRouteHandler } from '.';

export const TOOLS_ROUTES: ServerRoute[] = [
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: listToolsHandler as unknown as ServerRouteHandler,
    path: '/api/tools',
    responseSchema: listToolsResponseSchema,
    summary: 'List all tools',
    description: 'Returns a list of all available tools in the system',
    tags: ['Tools'],
  }),
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: getToolByIdHandler as unknown as ServerRouteHandler,
    path: '/api/tools/:toolId',
    pathParamSchema: toolIdPathParams,
    responseSchema: serializedToolSchema,
    summary: 'Get tool by ID',
    description: 'Returns details for a specific tool including its schema and configuration',
    tags: ['Tools'],
  }),
];
