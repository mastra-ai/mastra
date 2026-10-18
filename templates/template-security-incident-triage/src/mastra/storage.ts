import { createMastraLocalClient } from '../db/mastra-local-client.js';

import { LibSQLStore } from '@mastra/libsql';

import { readStorageConfig, type StorageConfig } from '../db/config.js';

export function createMastraStorage(config: StorageConfig = readStorageConfig()) {
  return new LibSQLStore({
    id: 'security-incident-storage',
    ...(config.url.startsWith('file:') ? { client: createMastraLocalClient(config), connectionTimeoutMs: 0 } : config),
  });
}

export const storage = createMastraStorage();
