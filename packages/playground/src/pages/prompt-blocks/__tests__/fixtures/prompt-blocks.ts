import type {
  GetSystemPackagesResponse,
  ListStoredPromptBlocksResponse,
  StoredPromptBlockResponse,
} from '@mastra/client-js';

export const systemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
};

export const makePromptBlock = (index: number): StoredPromptBlockResponse => ({
  id: `block-${index}`,
  status: 'published',
  activeVersionId: `version-${index}`,
  hasDraft: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: `Prompt Block ${index}`,
  description: `Description for prompt block ${index}`,
  content: `Content for prompt block ${index}`,
});

export const allPromptBlocks: StoredPromptBlockResponse[] = Array.from({ length: 120 }, (_, index) =>
  makePromptBlock(index + 1),
);

export const pagedPromptBlocks = (page: number, perPage: number): ListStoredPromptBlocksResponse => {
  const start = page * perPage;
  const promptBlocks = allPromptBlocks.slice(start, start + perPage);

  return {
    promptBlocks,
    total: allPromptBlocks.length,
    page,
    perPage,
    hasMore: start + promptBlocks.length < allPromptBlocks.length,
  };
};

export const fewPromptBlocks: ListStoredPromptBlocksResponse = {
  promptBlocks: allPromptBlocks.slice(0, 3),
  total: 3,
  page: 0,
  perPage: 50,
  hasMore: false,
};
