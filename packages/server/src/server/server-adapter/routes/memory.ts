import {
  getMemoryConfigHandler,
  getMemoryStatusHandler,
  getMessagesHandler,
  getThreadByIdHandler,
  getWorkingMemoryHandler,
  listThreadsHandler,
} from '../../handlers/memory';
import type { ServerRoute, ServerRouteHandler } from '.';

export const MEMORY_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: getMemoryStatusHandler as unknown as ServerRouteHandler,
    path: '/api/memory/status',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getMemoryConfigHandler as unknown as ServerRouteHandler,
    path: '/api/memory/config',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: listThreadsHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getThreadByIdHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads/:threadId',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getMessagesHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads/:threadId/messages',
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkingMemoryHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads/:threadId/working-memory',
  },
];
