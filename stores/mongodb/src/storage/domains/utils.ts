import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import { createStorageErrorId, safelyParseJSON, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { MongoDBConnector } from '../connectors/MongoDBConnector';
import type { MongoDBConfig, MongoDBDomainConfig } from '../types';

export function formatDateForMongoDB(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

export function createExecuteOperationWithRetry({
  logger,
  maxRetries = 3,
  initialBackoffMs = 100,
}: {
  logger: IMastraLogger;
  maxRetries?: number;
  initialBackoffMs?: number;
}) {
  return async function executeOperationWithRetry<T>(
    operationFn: () => Promise<T>,
    operationDescription: string,
  ): Promise<T> {
    let retries = 0;

    while (true) {
      try {
        return await operationFn();
      } catch (error: any) {
        if (
          ((error.message && error.message.includes('connection')) || error.code === 'ECONNRESET') &&
          retries < maxRetries
        ) {
          retries++;
          const backoffTime = initialBackoffMs * Math.pow(2, retries - 1);
          logger.warn(
            `MongoDBStore: Encountered connection error during ${operationDescription}. Retrying (${retries}/${maxRetries}) in ${backoffTime}ms...`,
          );
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        } else {
          logger.error(`MongoDBStore: Error during ${operationDescription} after ${retries} retries: ${error}`);
          throw error;
        }
      }
    }
  };
}

export const transformRow = ({ row, tableName }: { row: Record<string, any>; tableName: TABLE_NAMES }) => {
  const tableSchema = TABLE_SCHEMAS[tableName];
  const result: Record<string, any> = {};

  Object.entries(tableSchema).forEach(([key, columnSchema]) => {
    const value = row[key];
    if (value === undefined || value === null) {
      return;
    }
    if (columnSchema.type === 'jsonb' && typeof value === 'string') {
      result[key] = safelyParseJSON(value);
    } else if (columnSchema.type === 'timestamp' && typeof value === 'string') {
      result[key] = new Date(value);
    } else {
      result[key] = value;
    }
  });

  return result;
};

/**
 * Resolves a config to a MongoDBConnector instance.
 * Accepts both MongoDBConfig (main store) and MongoDBDomainConfig (domains).
 */
export const resolveConnector = (config: MongoDBConfig | MongoDBDomainConfig): MongoDBConnector => {
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
};
