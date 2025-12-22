import type { MongoClientOptions } from 'mongodb';
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
  | { connector: MongoDBConnector }
  | { connectorHandler: ConnectorHandler; disableInit?: boolean }
  | { url: string; dbName: string; options?: MongoClientOptions; disableInit?: boolean };
