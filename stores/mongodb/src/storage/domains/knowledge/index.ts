import { createKnowledgeCoreLoader } from '@internal/core/knowledge-compat';
import { coreFeatures } from '@mastra/core/features';
import { KnowledgeStorage } from '@mastra/core/storage';

import type { MongoDBDomainConfig } from '../../types';

const loadKnowledgeCore = createKnowledgeCoreLoader(coreFeatures, () => import('@mastra/core/storage'));

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
    const { KnowledgeUnsupportedError } = await loadKnowledgeCore();
    throw new KnowledgeUnsupportedError('MongoDB');
  }
}
