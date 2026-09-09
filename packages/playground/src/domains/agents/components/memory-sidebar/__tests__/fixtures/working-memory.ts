import type { GetMemoryConfigResponse, RouteResponse } from '@mastra/client-js';

export type WorkingMemoryResponse = RouteResponse<'GET /memory/threads/:threadId/working-memory'>;

export const workingMemoryConfigEnabled: GetMemoryConfigResponse = {
  memoryType: 'local',
  config: {
    lastMessages: 10,
    workingMemory: { enabled: true },
  },
};

export const workingMemoryConfigDisabled: GetMemoryConfigResponse = {
  memoryType: 'local',
  config: {
    lastMessages: 10,
    workingMemory: { enabled: false },
  },
};

export const markdownWorkingMemory = (workingMemory: string | null): WorkingMemoryResponse => ({
  workingMemory,
  source: 'thread',
  workingMemoryTemplate: null,
  threadExists: true,
});

export const markdownWorkingMemoryWithTemplate = (
  workingMemory: string | null,
  templateContent: string,
): WorkingMemoryResponse => ({
  workingMemory,
  source: 'thread',
  workingMemoryTemplate: { format: 'markdown', content: templateContent },
  threadExists: true,
});

export const jsonWorkingMemory = (workingMemory: string | null, templateContent = ''): WorkingMemoryResponse => ({
  workingMemory,
  source: 'thread',
  workingMemoryTemplate: { format: 'json', content: templateContent },
  threadExists: true,
});
