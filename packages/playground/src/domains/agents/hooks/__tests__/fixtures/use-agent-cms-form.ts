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

/** No override has been saved yet for a code-defined agent. */
export const noAgentVersions: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 0,
  perPage: 20,
  hasMore: false,
};

/** The first override version, created by the save and left unpublished. */
export const oneUnpublishedAgentVersion: ListAgentVersionsResponse = {
  ...noAgentVersions,
  versions: [
    {
      id: 'version-1',
      agentId: 'code-override-editable',
      versionNumber: 1,
      name: 'Code Override Editable',
      instructions: 'User edited prompt',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      createdAt: '2026-06-16T00:00:01.000Z',
    },
  ],
  total: 1,
};
