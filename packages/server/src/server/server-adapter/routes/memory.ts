import {
  getMemoryConfigHandler,
  getMemoryStatusHandler,
  getMessagesHandler,
  getThreadByIdHandler,
  getWorkingMemoryHandler,
  listThreadsHandler,
} from '../../handlers/memory';
import {
  getMemoryConfigQuerySchema,
  memoryConfigResponseSchema,
  getMemoryStatusQuerySchema,
  getMessagesQuerySchema,
  getMessagesResponseSchema,
  getThreadByIdQuerySchema,
  getThreadByIdResponseSchema,
  getWorkingMemoryQuerySchema,
  getWorkingMemoryResponseSchema,
  listThreadsQuerySchema,
  listThreadsResponseSchema,
  memoryStatusResponseSchema,
} from '../../schemas/memory';
import type { ServerRoute, ServerRouteHandler } from '.';

export const MEMORY_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: getMemoryStatusHandler as unknown as ServerRouteHandler,
    path: '/api/memory/status',
    queryParamSchema: getMemoryStatusQuerySchema,
    responseSchema: memoryStatusResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getMemoryConfigHandler as unknown as ServerRouteHandler,
    path: '/api/memory/config',
    queryParamSchema: getMemoryConfigQuerySchema,
    responseSchema: memoryConfigResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: listThreadsHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads',
    queryParamSchema: listThreadsQuerySchema,
    responseSchema: listThreadsResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getThreadByIdHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads/:threadId',
    queryParamSchema: getThreadByIdQuerySchema,
    responseSchema: getThreadByIdResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getMessagesHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads/:threadId/messages',
    queryParamSchema: getMessagesQuerySchema,
    responseSchema: getMessagesResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getWorkingMemoryHandler as unknown as ServerRouteHandler,
    path: '/api/memory/threads/:threadId/working-memory',
    queryParamSchema: getWorkingMemoryQuerySchema,
    responseSchema: getWorkingMemoryResponseSchema,
  },
];
