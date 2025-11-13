import { MastraBase } from '../../../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { CreateIndexOptions, IndexInfo, StorageIndexStats } from '../../types';

export abstract class IndexManagementBase extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'INDEX_MANAGEMENT',
    });
  }

  /**
   * DATABASE INDEX MANAGEMENT
   * Optional methods for database index management.
   * Storage adapters can override these to provide index management capabilities.
   */

  /**
   * Creates a database index on specified columns
   * @throws {MastraError} if not supported by the storage adapter
   */
  async createIndex(_options: CreateIndexOptions): Promise<void> {
    throw new MastraError({
      id: 'MASTRA_STORAGE_CREATE_INDEX_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter`,
    });
  }

  /**
   * Drops a database index by name
   * @throws {MastraError} if not supported by the storage adapter
   */
  async dropIndex(_indexName: string): Promise<void> {
    throw new MastraError({
      id: 'MASTRA_STORAGE_DROP_INDEX_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter`,
    });
  }

  /**
   * Lists database indexes for a table or all tables
   * @throws {MastraError} if not supported by the storage adapter
   */
  async listIndexes(_tableName?: string): Promise<IndexInfo[]> {
    throw new MastraError({
      id: 'MASTRA_STORAGE_LIST_INDEXES_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter`,
    });
  }

  /**
   * Gets detailed statistics for a specific index
   * @throws {MastraError} if not supported by the storage adapter
   */
  async describeIndex(_indexName: string): Promise<StorageIndexStats> {
    throw new MastraError({
      id: 'MASTRA_STORAGE_DESCRIBE_INDEX_NOT_SUPPORTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      text: `Index management is not supported by this storage adapter`,
    });
  }

  /**
   * Returns definitions for automatic performance indexes
   * Storage adapters can override this to define indexes that should be created during initialization
   * @returns Array of index definitions to create automatically
   */
  protected getAutomaticIndexDefinitions(): CreateIndexOptions[] {
    return [];
  }
}
