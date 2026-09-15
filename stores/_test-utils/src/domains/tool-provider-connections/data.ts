import type { StorageUpsertToolProviderConnectionInput } from '@mastra/core/storage';

/**
 * Creates a sample tool provider connection for tests.
 */
export function createSampleConnection(
  overrides?: Partial<StorageUpsertToolProviderConnectionInput>,
): StorageUpsertToolProviderConnectionInput {
  return {
    authorId: `author_${globalThis.crypto.randomUUID()}`,
    providerId: 'composio',
    toolkit: 'gmail',
    connectionId: `conn_${globalThis.crypto.randomUUID()}`,
    label: 'Work Gmail',
    scope: 'per-author',
    ...overrides,
  };
}
