import type { RouteResponse } from '@mastra/client-js';
import { http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';
import { setupServer } from 'msw/node';

const authCapabilities = {
  enabled: false,
  login: null,
} satisfies RouteResponse<'GET /auth/capabilities'>;

const builderSettings = {
  enabled: false,
} satisfies RouteResponse<'GET /editor/builder/settings'>;

const availableModels = {
  providers: [],
} satisfies RouteResponse<'GET /editor/builder/models/available'>;

const agentProviders = {
  providers: [],
} satisfies RouteResponse<'GET /agents/providers'>;

const memoryConfig = {
  config: {},
} satisfies RouteResponse<'GET /memory/config'>;

const workingMemory = {
  workingMemory: null,
  source: 'thread',
  workingMemoryTemplate: null,
  threadExists: false,
} satisfies RouteResponse<'GET /memory/threads/:threadId/working-memory'>;

const voiceSpeakers = [] satisfies RouteResponse<'GET /agents/:agentId/voice/speakers'>;

export const defaultHandlers: HttpHandler[] = [
  http.get('*/api/auth/capabilities', () => HttpResponse.json(authCapabilities)),
  http.get('*/api/editor/builder/settings', () => HttpResponse.json(builderSettings)),
  http.get('*/api/editor/builder/models/available', () => HttpResponse.json(availableModels)),
  http.get('*/api/agents/providers', () => HttpResponse.json(agentProviders)),
  http.get('*/api/memory/config', () => HttpResponse.json(memoryConfig)),
  http.get('*/api/memory/threads/:threadId/working-memory', () => HttpResponse.json(workingMemory)),
  http.get('*/api/agents/:agentId/voice/speakers', () => HttpResponse.json(voiceSpeakers)),
  http.get('*/api/stored/skills', () =>
    HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
  ),
];

export const server = setupServer(...defaultHandlers);
