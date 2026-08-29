import { KnowledgeStorage, KnowledgeUnsupportedError } from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';

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
    throw new KnowledgeUnsupportedError('MySQL');
  }
}
