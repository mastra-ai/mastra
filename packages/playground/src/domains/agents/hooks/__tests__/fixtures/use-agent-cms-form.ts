import type { ListStoredPromptBlocksResponse, StoredAgentResponse, StoredPromptBlockResponse } from '@mastra/client-js';

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

/**
 * A prompt block record as returned by `GET /stored/prompt-blocks[/:id]`.
 * A block is "published" when it has an `activeVersionId`; without one it is a
 * draft that runtime instruction resolution skips.
 */
export const promptBlock = (overrides: Partial<StoredPromptBlockResponse>): StoredPromptBlockResponse => ({
  id: 'block',
  status: 'draft',
  name: 'Block',
  content: 'Block content.',
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
  ...overrides,
});

/** A single-page `GET /stored/prompt-blocks` list response wrapping the given blocks. */
export const storedPromptBlockList = (blocks: StoredPromptBlockResponse[]): ListStoredPromptBlocksResponse => ({
  promptBlocks: blocks,
  total: blocks.length,
  page: 0,
  perPage: 100,
  hasMore: false,
});
