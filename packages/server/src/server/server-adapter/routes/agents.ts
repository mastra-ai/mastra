import {
  generateHandler,
  getAgentByIdHandler,
  getProvidersHandler,
  listAgentsHandler,
  streamGenerateHandler,
} from '../../handlers/agents';
import { executeAgentToolHandler } from '../../handlers/tools';
import { getSpeakersHandler } from '../../handlers/voice';
import {
  listAgentsResponseSchema,
  providersResponseSchema,
  serializedAgentSchema,
} from '../../schemas/agents';
import type { ServerRoute, ServerRouteHandler } from '.';

export const AGENTS_ROUTES: ServerRoute[] = [
  {
    method: 'GET',
    responseType: 'json',
    handler: listAgentsHandler as unknown as ServerRouteHandler,
    path: '/api/agents',
    responseSchema: listAgentsResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getProvidersHandler as unknown as ServerRouteHandler,
    path: '/api/agents/providers',
    responseSchema: providersResponseSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getAgentByIdHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId',
    responseSchema: serializedAgentSchema,
  },
  {
    method: 'GET',
    responseType: 'json',
    handler: getSpeakersHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId/voice/speakers',
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
    method: 'POST',
    responseType: 'json',
    handler: executeAgentToolHandler as unknown as ServerRouteHandler,
    path: '/api/agents/:agentId/tools/:toolId/execute',
  },
];
