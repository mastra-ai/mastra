import { listScorersHandler } from '../../handlers/scores';
import type { ServerRoute, ServerRouteHandler } from '.';

export const SCORES_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: listScorersHandler as unknown as ServerRouteHandler,
    path: '/api/scores/scorers',
  },
];
