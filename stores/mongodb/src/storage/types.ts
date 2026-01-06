import type { MongoClientOptions, IndexSpecification, CreateIndexesOptions } from 'mongodb';
import type { ConnectorHandler } from './connectors/base';
import type { MongoDBConnector } from './connectors/MongoDBConnector';

/**
 * Base configuration options shared across MongoDB configurations
 */
export type MongoDBBaseConfig = {
  id: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new MongoDBStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new MongoDBStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
  /**
   * When true, default indexes will not be created during initialization.
   * This is useful when:
   * 1. You want to manage indexes separately or use custom indexes only
   * 2. Default indexes don't match your query patterns
   * 3. You want to reduce initialization time in development
   *
   * @default false
   */
  skipDefaultIndexes?: boolean;
  /**
   * Custom indexes to create during initialization.
   * These indexes are created in addition to default indexes (unless skipDefaultIndexes is true).
   *
   * Each index must specify which collection it belongs to. The store will route each index
   * to the appropriate domain based on the collection name.
   *
   * @example
   * ```typescript
   * const store = new MongoDBStore({
   *   url: 'mongodb://localhost:27017',
   *   dbName: 'mastra',
   *   indexes: [
   *     { collection: 'mastra_threads', keys: { 'metadata.type': 1 } },
   *     { collection: 'mastra_messages', keys: { 'metadata.status': 1 }, options: { sparse: true } },
   *   ],
   * });
   * ```
   */
  indexes?: MongoDBIndexConfig[];
};

export type MongoDBConfig =
  | DatabaseConfig
  | (MongoDBBaseConfig & {
      connectorHandler: ConnectorHandler;
    });

export type DatabaseConfig = MongoDBBaseConfig & {
  url: string;
  dbName: string;
  options?: MongoClientOptions;
};

/**
 * Configuration for MongoDB domains.
 * Domains can receive either:
 * - An existing connector (internal: passed from main store)
 * - A connectorHandler (user: custom connection management)
 * - Database config (user: standard url/dbName config)
 */
export type MongoDBDomainConfig =
  | { connector: MongoDBConnector; skipDefaultIndexes?: boolean; indexes?: MongoDBIndexConfig[] }
  | {
      connectorHandler: ConnectorHandler;
      disableInit?: boolean;
      skipDefaultIndexes?: boolean;
      indexes?: MongoDBIndexConfig[];
    }
  | {
      url: string;
      dbName: string;
      options?: MongoClientOptions;
      disableInit?: boolean;
      skipDefaultIndexes?: boolean;
      indexes?: MongoDBIndexConfig[];
    };

/**
 * MongoDB index definition for the getDefaultIndexDefinitions pattern.
 */
export interface MongoDBIndexConfig {
  /** Collection name */
  collection: string;
  /** Index specification (e.g., { id: 1 } or { thread_id: 1, createdAt: -1 }) */
  keys: IndexSpecification;
  /** Index options (e.g., { unique: true }) */
  options?: CreateIndexesOptions;
}
