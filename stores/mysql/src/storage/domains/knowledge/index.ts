import { createKnowledgeCoreLoader } from '@internal/core/knowledge-compat';
import { coreFeatures } from '@mastra/core/features';
import { KnowledgeStorage } from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';

const loadKnowledgeCore = createKnowledgeCoreLoader(coreFeatures, () => import('@mastra/core/storage'));

/**
 * MySQL does not yet implement the canonical Knowledge storage contract.
 * The domain remains registered so callers receive the standard typed unsupported error.
 */
export class KnowledgeMySQL extends KnowledgeStorage {
  static getExportDDL(): string[] {
    return [];
  }

  constructor(_config: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
  }

  async init(): Promise<void> {}

  async dangerouslyClearAll(): Promise<void> {
    const { KnowledgeUnsupportedError } = await loadKnowledgeCore();
    throw new KnowledgeUnsupportedError('MySQL');
  }
}
