import { listScorersHandler } from '../../handlers/scores';
import { listScorersResponseSchema } from '../../schemas/scores';
import { createRoute } from './route-builder';
import type { ServerRoute, ServerRouteHandler } from '.';

export const SCORES_ROUTES: ServerRoute[] = [
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: listScorersHandler as unknown as ServerRouteHandler,
    path: '/api/scores/scorers',
    responseSchema: listScorersResponseSchema,
    summary: 'List all scorers',
    description: 'Returns a list of all registered scorers with their configuration and associated agents and workflows',
    tags: ['Scoring'],
  }),
];
