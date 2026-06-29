import type { ListAgentVersionsResponse, StoredAgentResponse } from '@mastra/client-js';

/**
 * Minimal stored-agent record returned by `POST /stored/agents` when Studio
 * creates the first override for a code-defined agent. Only the required shape
 * of `StoredAgentResponse` is populated — the create mutation's onSuccess
 * handler only reads `id`.
 */
export const createdCodeAgent: StoredAgentResponse = {
  id: 'code-override-editable',
  status: 'draft',
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
  name: 'Code Override Editable',
  instructions: 'Original code instructions for editable override agent.',
  model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
};

export const emptyAgentVersions: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const savedCodeAgentVersions: ListAgentVersionsResponse = {
  versions: [
    {
      id: 'version-1',
      agentId: 'code-override-editable',
      versionNumber: 1,
      name: 'Code Override Editable',
      instructions: [{ type: 'prompt_block', content: 'User edited prompt' }],
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      tools: {},
      workflows: {},
      agents: {},
      createdAt: '2026-06-16T00:00:00.000Z',
      changeMessage: 'Saved to filesystem',
    },
  ],
  total: 1,
  page: 1,
  perPage: 20,
  hasMore: false,
};
