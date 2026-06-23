import type {
  ActivatePromptBlockVersionResponse,
  DeletePromptBlockVersionResponse,
  ListPromptBlockVersionsResponse,
  ListStoredPromptBlocksResponse,
  PromptBlockVersionResponse,
  StoredPromptBlockResponse,
} from '@mastra/client-js';

export const PROMPT_BLOCK_ID = 'prompt-block-1';
export const PROMPT_BLOCK_VERSION_ID = 'prompt-block-version-1';

export const makeStoredPromptBlock = (
  overrides: Partial<StoredPromptBlockResponse> = {},
): StoredPromptBlockResponse => ({
  id: overrides.id ?? PROMPT_BLOCK_ID,
  status: overrides.status ?? 'draft',
  activeVersionId: overrides.activeVersionId ?? PROMPT_BLOCK_VERSION_ID,
  hasDraft: overrides.hasDraft ?? true,
  authorId: overrides.authorId ?? 'user-1',
  metadata: overrides.metadata ?? { domain: 'editor' },
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  name: overrides.name ?? 'Support Instructions',
  description: overrides.description ?? 'Reusable support tone block',
  content: overrides.content ?? 'Answer with context: {{customerTier}}',
  rules: overrides.rules,
  requestContextSchema: overrides.requestContextSchema ?? { customerTier: { type: 'string' } },
});

export const makeStoredPromptBlocksList = (
  promptBlocks: StoredPromptBlockResponse[],
): ListStoredPromptBlocksResponse => ({
  promptBlocks,
  total: promptBlocks.length,
  page: 1,
  perPage: 50,
  hasMore: false,
});

export const makePromptBlockVersion = (
  overrides: Partial<PromptBlockVersionResponse> = {},
): PromptBlockVersionResponse => ({
  id: overrides.id ?? PROMPT_BLOCK_VERSION_ID,
  blockId: overrides.blockId ?? PROMPT_BLOCK_ID,
  versionNumber: overrides.versionNumber ?? 1,
  name: overrides.name ?? 'Support Instructions',
  description: overrides.description ?? 'Reusable support tone block',
  content: overrides.content ?? 'Answer with context: {{customerTier}}',
  rules: overrides.rules,
  requestContextSchema: overrides.requestContextSchema ?? { customerTier: { type: 'string' } },
  changedFields: overrides.changedFields ?? ['content'],
  changeMessage: overrides.changeMessage ?? 'Initial prompt block version',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
});

export const makePromptBlockVersionsList = (
  versions: PromptBlockVersionResponse[],
): ListPromptBlockVersionsResponse => ({
  versions,
  total: versions.length,
  page: 1,
  perPage: 50,
  hasMore: false,
});

export const activatedPromptBlockVersion: ActivatePromptBlockVersionResponse = {
  success: true,
  message: 'Prompt block version activated',
  activeVersionId: 'prompt-block-version-2',
};

export const deletedPromptBlockVersion: DeletePromptBlockVersionResponse = {
  success: true,
  message: 'Prompt block version deleted',
};
