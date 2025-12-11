import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  safelyParseJSON,
  StoreOperations,
  TABLE_SCHEMAS,
  TABLE_SPANS,
} from '@mastra/core/storage';
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

  async createTable(args?: { tableName?: TABLE_NAMES }): Promise<void> {
    // MongoDB is schemaless, so no table creation needed
    // However, we create indexes for performance on the spans collection
    if (args?.tableName === TABLE_SPANS) {
      await this.createSpansIndexes();
    }
  }

  /**
   * Creates indexes for the spans collection for optimal query performance
   * MongoDB indexes are idempotent - creating an existing index is a no-op
   */
  private async createSpansIndexes(): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_SPANS);

      // Composite primary key equivalent - unique index on traceId + spanId
      await collection.createIndex({ traceId: 1, spanId: 1 }, { unique: true, name: 'spans_traceid_spanid_unique' });

      // Root spans partial index - for listTraces() which always filters parentSpanId: null
      await collection.createIndex(
        { startedAt: -1 },
        { name: 'spans_root_spans_idx', partialFilterExpression: { parentSpanId: null } },
      );

      // Entity identification indexes
      await collection.createIndex({ entityType: 1, entityId: 1 }, { name: 'spans_entitytype_entityid_idx' });
      await collection.createIndex({ entityType: 1, entityName: 1 }, { name: 'spans_entitytype_entityname_idx' });

      // Multi-tenant filtering
      await collection.createIndex({ organizationId: 1, userId: 1 }, { name: 'spans_orgid_userid_idx' });

      this.logger?.info?.('Created indexes for spans collection');
    } catch (error) {
      // Log warning but don't fail - index creation should be best-effort
      this.logger?.warn?.('Failed to create indexes for spans collection:', error);
    }
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
          id: createStorageErrorId('MONGODB', 'CLEAR_TABLE', 'FAILED'),
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
          id: createStorageErrorId('MONGODB', 'DROP_TABLE', 'FAILED'),
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
          id: createStorageErrorId('MONGODB', 'INSERT', 'FAILED'),
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
          id: createStorageErrorId('MONGODB', 'BATCH_INSERT', 'FAILED'),
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
          id: createStorageErrorId('MONGODB', 'LOAD', 'FAILED'),
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
          id: createStorageErrorId('MONGODB', 'UPDATE', 'FAILED'),
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
          id: createStorageErrorId('MONGODB', 'BATCH_UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }
}
