import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId } from '@mastra/core/storage';
import { MongoDBConnector } from '../connectors/MongoDBConnector';
import type { MongoDBConfig, MongoDBDomainConfig } from '../types';

// Re-export types for convenience
export type { MongoDBConfig, MongoDBDomainConfig } from '../types';
export { MongoDBConnector } from '../connectors/MongoDBConnector';

/**
 * Resolves a config to a MongoDBConnector instance.
 * Accepts both MongoDBConfig (main store) and MongoDBDomainConfig (domains).
 */
export function resolveMongoDBConfig(config: MongoDBConfig | MongoDBDomainConfig): MongoDBConnector {
  // Internal: main store passes existing connector to domains
  if ('connector' in config) {
    return config.connector;
  }

  // User: custom connection management via handler
  if ('connectorHandler' in config) {
    try {
      return MongoDBConnector.fromConnectionHandler(config.connectorHandler);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CONSTRUCTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { connectionHandler: true },
        },
        error,
      );
    }
  }

  // User: standard url/dbName config
  try {
    return MongoDBConnector.fromDatabaseConfig({
      id: 'id' in config ? config.id : 'domain',
      options: config.options,
      url: config.url,
      dbName: config.dbName,
    });
  } catch (error) {
    throw new MastraError(
      {
        id: createStorageErrorId('MONGODB', 'CONSTRUCTOR', 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { url: config?.url, dbName: config?.dbName },
      },
      error,
    );
  }
}
