import { KnowledgeStorage, KnowledgeUnsupportedError } from '@mastra/core/storage';

import type { MongoDBDomainConfig } from '../../types';

/**
 * MongoDB does not yet implement the canonical Knowledge storage contract.
 * The domain remains registered so callers receive the standard typed unsupported error.
 */
export class KnowledgeMongoDB extends KnowledgeStorage {
  static readonly MANAGED_COLLECTIONS = [] as const;

  constructor(_config: MongoDBDomainConfig) {
    super();
  }

  async init(): Promise<void> {}

  async dangerouslyClearAll(): Promise<void> {
    throw new KnowledgeUnsupportedError('MongoDB');
  }
}
