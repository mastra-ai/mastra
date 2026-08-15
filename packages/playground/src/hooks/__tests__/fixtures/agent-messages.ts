import type { ListMemoryThreadMessagesResponse, RouteResponse } from '@mastra/client-js';

export const authenticatedUser: RouteResponse<'GET /auth/me'> = { id: 'user-1' };

export const authDisabled: RouteResponse<'GET /auth/capabilities'> = { enabled: false, login: null };

export const emptyMemoryConfig: RouteResponse<'GET /memory/config'> = { config: {} };

export const memoryDisabled: RouteResponse<'GET /memory/status'> = { result: false };

export const emptyWorkingMemory: RouteResponse<'GET /memory/threads/:threadId/working-memory'> = {
  workingMemory: null,
  source: 'thread',
  workingMemoryTemplate: null,
  threadExists: true,
};

export const emptyObservationalMemory: RouteResponse<'GET /memory/observational-memory'> = { record: null };

export const emptyAgentProviders: RouteResponse<'GET /agents/providers'> = { providers: [] };

export const emptyVoiceSpeakers: RouteResponse<'GET /agents/:agentId/voice/speakers'> = [];

export const builderDisabled: RouteResponse<'GET /editor/builder/settings'> = {
  enabled: false,
  modelPolicy: { active: false },
};

export const emptyBuilderModels: RouteResponse<'GET /editor/builder/models/available'> = { providers: [] };

const makeMessage = (number: number): ListMemoryThreadMessagesResponse['messages'][number] => ({
  id: `message-${String(number).padStart(3, '0')}`,
  role: number % 2 === 0 ? 'assistant' : 'user',
  createdAt: new Date(Date.UTC(2026, 7, 15, 0, number)),
  threadId: 'thread-pagination',
  resourceId: 'agent-pagination',
  content: {
    format: 2,
    parts: [{ type: 'text', text: `Message ${number}` }],
  },
});

export const latestAgentMessagesPage: ListMemoryThreadMessagesResponse = {
  messages: Array.from({ length: 40 }, (_, index) => makeMessage(index + 40)),
  total: 79,
  page: 0,
  perPage: 40,
  hasMore: true,
};

export const olderAgentMessagesPage: ListMemoryThreadMessagesResponse = {
  messages: Array.from({ length: 40 }, (_, index) => makeMessage(index + 1)),
  total: 79,
  page: 1,
  perPage: 40,
  hasMore: false,
};

export const refreshedLatestAgentMessagesPage: ListMemoryThreadMessagesResponse = {
  messages: Array.from({ length: 40 }, (_, index) => makeMessage(index + 41)),
  total: 80,
  page: 0,
  perPage: 40,
  hasMore: true,
};
