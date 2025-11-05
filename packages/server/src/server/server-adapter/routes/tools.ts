import { getToolByIdHandler, listToolsHandler } from '../../handlers/tools';
import type { ServerRoute, ServerRouteHandler } from '.';
export const TOOLS_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: listToolsHandler as unknown as ServerRouteHandler,
    path: '/api/tools',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getToolByIdHandler as unknown as ServerRouteHandler,
    path: '/api/tools/:toolId',
  },
];
