import type { RouteResponse } from '@mastra/client-js';

export { memoryConfig, workingMemory } from '@/domains/agents/context/__tests__/fixtures/thread-preferences';
export const voiceSpeakers: RouteResponse<'GET /agents/:agentId/voice/speakers'> = [];
export const mcpServers: RouteResponse<'GET /mcp/v0/servers'> = { servers: [] };
export const preferenceThread: RouteResponse<'GET /memory/threads/:threadId'> = {
  id: 'thread-1',
  resourceId: 'chef-agent',
  title: 'Pasta night',
  createdAt: new Date('2026-09-11'),
  updatedAt: new Date('2026-09-11'),
};

export const preferenceModelProviders: RouteResponse<'GET /agents/providers'> = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
      connected: true,
      models: ['gpt-5-mini', 'gpt-4o-mini'],
    },
  ],
};
