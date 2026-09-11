import type { RouteResponse } from '@mastra/client-js';

export const allowedModels: RouteResponse<'GET /editor/builder/models/available'> = {
  providers: [{ id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o-mini'] }],
};
export const restrictedModels: RouteResponse<'GET /editor/builder/models/available'> = {
  providers: allowedModels.providers.map(provider => ({ ...provider, models: ['gpt-5-mini'] })),
};
export const currentUser: RouteResponse<'GET /auth/me'> = { id: 'user-1' };
export const memoryConfig: RouteResponse<'GET /memory/config'> = { config: {} };
export const workingMemory: RouteResponse<'GET /memory/threads/:threadId/working-memory'> = {
  workingMemory: null,
  source: 'thread',
  workingMemoryTemplate: null,
  threadExists: false,
};
