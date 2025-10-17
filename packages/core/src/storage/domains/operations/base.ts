import { MastraBase } from '../../../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { TABLE_NAMES } from '../../constants';
import type { StorageColumn, CreateIndexOptions, IndexInfo, StorageIndexStats } from '../../types';

export abstract class StoreOperations extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OPERATIONS',
    });
  }

  abstract hasColumn(table: string, column: string): Promise<boolean>;

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return 'TEXT';
      case 'timestamp':
        return 'TIMESTAMP';
      case 'float':
        return 'FLOAT';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'jsonb':
        return 'JSONB';
      default:
        return 'TEXT';
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
      case 'uuid':
        return "DEFAULT ''";
      case 'timestamp':
        return "DEFAULT '1970-01-01 00:00:00'";
      case 'integer':
      case 'bigint':
      case 'float':
        return 'DEFAULT 0';
      case 'jsonb':
        return "DEFAULT '{}'";
      default:
        return "DEFAULT ''";
    }
  }

  abstract createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void>;

  abstract clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void>;

  abstract insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void>;

  abstract batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void>;

  abstract load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null>;

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
