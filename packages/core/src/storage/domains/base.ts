import { MastraBase } from '../../base';
import { TABLE_SCHEMAS } from '../constants';
import type { TABLE_NAMES } from '../constants';
import type { StorageColumn } from '../types';

/**
 * Schema registry type - maps table names to their column schemas.
 */
export type SchemaRegistry = Record<TABLE_NAMES, Record<string, StorageColumn>>;

/**
 * Base class for all storage domains.
 * Provides common interface for initialization and data clearing.
 */
export abstract class StorageDomain extends MastraBase {
  /**
   * Initialize the storage domain.
   * This should create any necessary tables/collections.
   * Default implementation is a no-op - override in adapters that need initialization.
   */
  async init(): Promise<void> {
    // Default no-op - adapters override if they need to create tables/collections
  }

  /**
   * Clears all data from this storage domain.
   * This is a destructive operation - use with caution.
   * Primarily used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;

  /**
   * Returns all available table schemas from this version of core.
   * This provides a backwards-compatible way to access schemas - the method
   * exists in all versions, returning the schemas available in that version.
   *
   * Use this instead of directly importing TABLE_SCHEMAS to ensure compatibility
   * with different versions of @mastra/core.
   *
   * @example
   * ```typescript
   * const schemas = this.getSchemas();
   * if ('mastra_agent_versions' in schemas) {
   *   // Agent versioning is supported in this core version
   *   await db.createTable({ tableName: 'mastra_agent_versions', schema: schemas['mastra_agent_versions'] });
   * }
   * ```
   */
  getSchemas(): SchemaRegistry {
    return TABLE_SCHEMAS;
  }

  /**
   * Returns the schema for a specific table if it exists in this version of core.
   * Returns undefined if the table schema is not available.
   *
   * @param tableName - The name of the table to get the schema for
   * @returns The table schema or undefined if not available
   *
   * @example
   * ```typescript
   * const agentVersionsSchema = this.getSchema('mastra_agent_versions');
   * if (agentVersionsSchema) {
   *   await db.createTable({ tableName: 'mastra_agent_versions', schema: agentVersionsSchema });
   * }
   * ```
   */
  getSchema(tableName: string): Record<string, StorageColumn> | undefined {
    return (TABLE_SCHEMAS as Record<string, Record<string, StorageColumn>>)[tableName];
  }

  /**
   * Checks if a table schema is available in this version of core.
   *
   * @param tableName - The name of the table to check
   * @returns true if the schema exists, false otherwise
   *
   * @example
   * ```typescript
   * if (this.hasSchema('mastra_agent_versions')) {
   *   // Agent versioning is supported
   * }
   * ```
   */
  hasSchema(tableName: string): boolean {
    return tableName in TABLE_SCHEMAS;
  }
}
