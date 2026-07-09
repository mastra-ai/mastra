import type {
  ListStoredAgentsResponse,
  ListStoredPromptBlocksResponse,
  StoredPromptBlockResponse,
} from '@mastra/client-js';

/**
 * A prompt block record as returned by `GET /stored/prompt-blocks[/:id]`.
 * A block is "published" when it has an `activeVersionId`; without one it is a
 * draft that runtime instruction resolution skips. `hasDraft` marks a published
 * block that has newer, still-unpublished edits.
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

/** An empty `GET /stored/agents` list — the ref block's "Used by" lookup needs a response. */
export const emptyStoredAgents: ListStoredAgentsResponse = {
  agents: [],
  total: 0,
  page: 0,
  perPage: 100,
  hasMore: false,
};
