import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { safelyParseJSON, StoreOperations, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { ConnectorHandler } from '../../connectors/base';

export interface MongoDBOperationsConfig {
  connector: ConnectorHandler;
}
export class StoreOperationsMongoDB extends StoreOperations {
  readonly #connector: ConnectorHandler;

  constructor(config: MongoDBOperationsConfig) {
    super();
    this.#connector = config.connector;
  }

  async getCollection(collectionName: string) {
    return this.#connector.getCollection(collectionName);
  }

  async hasColumn(_table: string, _column: string): Promise<boolean> {
    // MongoDB is schemaless, so we can assume any column exists
    // We could check a sample document, but for now return true
    return true;
  }

  async createTable(): Promise<void> {
    // Nothing to do here, MongoDB is schemaless
  }

  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // Nothing to do here, MongoDB is schemaless
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const collection = await this.getCollection(tableName);
      await collection.deleteMany({});
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
      this.logger.error(mastraError.message);
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const collection = await this.getCollection(tableName);
      await collection.drop();
    } catch (error) {
      // Collection might not exist, which is fine
      if (error instanceof Error && error.message.includes('ns not found')) {
        return;
      }
      throw new MastraError(
        {
          id: 'MONGODB_STORE_DROP_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  private processJsonbFields(tableName: TABLE_NAMES, record: Record<string, any>): Record<string, any> {
    const schema = TABLE_SCHEMAS[tableName];

    // If no schema is found, return the record as-is (MongoDB can handle dynamic schemas)
    if (!schema) {
      return record;
    }

    return Object.fromEntries(
      Object.entries(schema).map(([key, value]) => {
        if (value.type === 'jsonb' && record[key] && typeof record[key] === 'string') {
          return [key, safelyParseJSON(record[key])];
        }
        return [key, record[key]];
      }),
    );
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const collection = await this.getCollection(tableName);
      const recordToInsert = this.processJsonbFields(tableName, record);
      await collection.insertOne(recordToInsert);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
      this.logger.error(mastraError.message);
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    if (!records.length) {
      return;
    }

    try {
      const collection = await this.getCollection(tableName);
      const processedRecords = records.map(record => this.processJsonbFields(tableName, record));
      await collection.insertMany(processedRecords);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    this.logger.info(`Loading ${tableName} with keys ${JSON.stringify(keys)}`);
    try {
      const collection = await this.getCollection(tableName);
      return (await collection.find(keys).toArray()) as R;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async update({
    tableName,
    keys,
    data,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, any>;
    data: Record<string, any>;
  }): Promise<void> {
    try {
      const collection = await this.getCollection(tableName);
      const processedData = this.processJsonbFields(tableName, data);

      // Filter out undefined values to prevent MongoDB from removing fields
      const cleanData = Object.fromEntries(Object.entries(processedData).filter(([_, value]) => value !== undefined));

      await collection.updateOne(keys, { $set: cleanData });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchUpdate({
    tableName,
    updates,
  }: {
    tableName: TABLE_NAMES;
    updates: Array<{
      keys: Record<string, any>;
      data: Record<string, any>;
    }>;
  }): Promise<void> {
    if (!updates.length) {
      return;
    }

    try {
      const collection = await this.getCollection(tableName);
      const bulkOps = updates.map(({ keys, data }) => {
        const processedData = this.processJsonbFields(tableName, data);

        // Filter out undefined values to prevent MongoDB from removing fields
        const cleanData = Object.fromEntries(Object.entries(processedData).filter(([_, value]) => value !== undefined));

        return {
          updateOne: {
            filter: keys,
            update: { $set: cleanData },
          },
        };
      });

      await collection.bulkWrite(bulkOps);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_BATCH_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }
}
