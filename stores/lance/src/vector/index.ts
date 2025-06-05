import { connect, Index } from '@lancedb/lancedb';
import type { Connection, ConnectionOptions, CreateTableOptions, Table, TableLike } from '@lancedb/lancedb';

import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '@mastra/core';

import { MastraVector } from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { LanceFilterTranslator } from './filter';
import type { IndexConfig } from './types';

interface LanceCreateIndexParams extends CreateIndexParams {
  indexConfig?: LanceIndexConfig;
  tableName?: string;
}

interface LanceIndexConfig extends IndexConfig {
  numPartitions?: number;
  numSubVectors?: number;
}

interface LanceUpsertVectorParams extends UpsertVectorParams {
  tableName: string;
}

interface LanceQueryVectorParams extends QueryVectorParams {
  tableName: string;
  columns?: string[];
  includeAllColumns?: boolean;
}

export class LanceVectorStore extends MastraVector {
  private lanceClient!: Connection;

  /**
   * Creates a new instance of LanceVectorStore
   * @param uri The URI to connect to LanceDB
   * @param options connection options
   *
   * Usage:
   *
   * Connect to a local database
   * ```ts
   * const store = await LanceVectorStore.create('/path/to/db');
   * ```
   *
   * Connect to a LanceDB cloud database
   * ```ts
   * const store = await LanceVectorStore.create('db://host:port');
   * ```
   *
   * Connect to a cloud database
   * ```ts
   * const store = await LanceVectorStore.create('s3://bucket/db', { storageOptions: { timeout: '60s' } });
   * ```
   */
  public static async create(uri: string, options?: ConnectionOptions): Promise<LanceVectorStore> {
    const instance = new LanceVectorStore();
    try {
      instance.lanceClient = await connect(uri, options);
      return instance;
    } catch (e) {
      throw new Error(`Failed to connect to LanceDB: ${e}`);
    }
  }

  /**
   * @internal
   * Private constructor to enforce using the create factory method
   */
  private constructor() {
    super();
  }

  close() {
    if (this.lanceClient) {
      this.lanceClient.close();
    }
  }

  async query({
    tableName,
    queryVector,
    filter,
    includeVector = false,
    topK = 10,
    columns = [],
    includeAllColumns = false,
  }: LanceQueryVectorParams): Promise<QueryResult[]> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    if (!tableName) {
      throw new Error('tableName is required');
    }

    if (!queryVector) {
      throw new Error('queryVector is required');
    }

    try {
      // Open the table
      const table = await this.lanceClient.openTable(tableName);

      // Prepare the list of columns to select
      const selectColumns = [...columns];
      if (!selectColumns.includes('id')) {
        selectColumns.push('id');
      }

      // Create the query builder
      let query = table.search(queryVector);

      // Add filter if provided
      if (filter && Object.keys(filter).length > 0) {
        const whereClause = this.filterTranslator(filter);
        this.logger.debug(`Where clause generated: ${whereClause}`);
        query = query.where(whereClause);
      }

      // Apply column selection and limit
      if (!includeAllColumns && selectColumns.length > 0) {
        query = query.select(selectColumns);
      }
      query = query.limit(topK);

      // Execute the query
      const results = await query.toArray();

      return results.map(result => {
        // Collect all metadata_ prefixed fields
        const flatMetadata: Record<string, any> = {};

        // Get all keys from the result object
        Object.keys(result).forEach(key => {
          // Skip reserved keys (id, score, and the vector column)
          if (key !== 'id' && key !== 'score' && key !== 'vector' && key !== '_distance') {
            if (key.startsWith('metadata_')) {
              // Remove the prefix and add to flat metadata
              const metadataKey = key.substring('metadata_'.length);
              flatMetadata[metadataKey] = result[key];
            }
          }
        });

        // Reconstruct nested metadata object
        const metadata = this.unflattenObject(flatMetadata);

        return {
          id: String(result.id || ''),
          metadata,
          vector:
            includeVector && result.vector
              ? Array.isArray(result.vector)
                ? result.vector
                : Array.from(result.vector as any[])
              : undefined,
          document: result.document,
          score: result._distance,
        };
      });
    } catch (error: any) {
      throw new Error(`Failed to query vectors: ${error.message}`);
    }
  }

  private filterTranslator(filter: VectorFilter): string {
    // Add metadata_ prefix to filter keys if they don't already have it
    const processFilterKeys = (filterObj: Record<string, any>): Record<string, any> => {
      const result: Record<string, any> = {};

      Object.entries(filterObj).forEach(([key, value]) => {
        // Don't add prefix to logical operators
        if (key === '$or' || key === '$and' || key === '$not' || key === '$in') {
          // For logical operators, process their array contents
          if (Array.isArray(value)) {
            result[key] = value.map(item =>
              typeof item === 'object' && item !== null ? processFilterKeys(item as Record<string, any>) : item,
            );
          } else {
            result[key] = value;
          }
        }
        // Don't add prefix if it already has metadata_ prefix
        else if (key.startsWith('metadata_')) {
          result[key] = value;
        }
        // Add metadata_ prefix to regular field keys
        else {
          // Convert dot notation to underscore notation for nested fields
          if (key.includes('.')) {
            const convertedKey = `metadata_${key.replace(/\./g, '_')}`;
            result[convertedKey] = value;
          } else {
            result[`metadata_${key}`] = value;
          }
        }
      });

      return result;
    };

    const prefixedFilter = filter && typeof filter === 'object' ? processFilterKeys(filter as Record<string, any>) : {};

    const translator = new LanceFilterTranslator();
    return translator.translate(prefixedFilter);
  }

  async upsert({ tableName, vectors, metadata = [], ids = [] }: LanceUpsertVectorParams): Promise<string[]> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    if (!tableName) {
      throw new Error('tableName is required');
    }

    if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
      throw new Error('vectors array is required and must not be empty');
    }

    try {
      const tables = await this.lanceClient.tableNames();
      if (!tables.includes(tableName)) {
        throw new Error(`Table ${tableName} does not exist`);
      }

      const table = await this.lanceClient.openTable(tableName);

      // Generate IDs if not provided
      const vectorIds = ids.length === vectors.length ? ids : vectors.map((_, i) => ids[i] || crypto.randomUUID());

      // Create data with metadata fields expanded at the top level
      const data = vectors.map((vector, i) => {
        const id = String(vectorIds[i]);
        const metadataItem = metadata[i] || {};

        // Create the base object with id and vector
        const rowData: Record<string, any> = {
          id,
          vector: vector,
        };

        // Flatten the metadata object and prefix all keys with 'metadata_'
        if (Object.keys(metadataItem).length > 0) {
          const flattenedMetadata = this.flattenObject(metadataItem, 'metadata');
          // Add all flattened metadata properties to the row data object
          Object.entries(flattenedMetadata).forEach(([key, value]) => {
            rowData[key] = value;
          });
        }

        return rowData;
      });

      await table.add(data, { mode: 'overwrite' });

      return vectorIds;
    } catch (error: any) {
      throw new Error(`Failed to upsert vectors: ${error.message}`);
    }
  }

  /**
   * Flattens a nested object, creating new keys with underscores for nested properties.
   * Example: { metadata: { text: 'test' } } → { metadata_text: 'test' }
   */
  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    return Object.keys(obj).reduce((acc: Record<string, unknown>, k: string) => {
      const pre = prefix.length ? `${prefix}_` : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, this.flattenObject(obj[k] as Record<string, unknown>, pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }

  async createTable(
    tableName: string,
    data: Record<string, unknown>[] | TableLike,
    options?: Partial<CreateTableOptions>,
  ): Promise<Table> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    try {
      // Flatten nested objects if data is an array of records
      if (Array.isArray(data)) {
        data = data.map(record => this.flattenObject(record));
      }

      return await this.lanceClient.createTable(tableName, data, options);
    } catch (error: any) {
      throw new Error(`Failed to create table: ${error.message}`);
    }
  }

  async listTables(): Promise<string[]> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }
    return await this.lanceClient.tableNames();
  }

  async getTableSchema(tableName: string): Promise<any> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }
    const table = await this.lanceClient.openTable(tableName);
    return await table.schema();
  }

  /**
   * indexName is actually a column name in a table in lanceDB
   */
  async createIndex({
    tableName,
    indexName,
    dimension,
    metric = 'cosine',
    indexConfig = {},
  }: LanceCreateIndexParams): Promise<void> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    try {
      if (!tableName) {
        throw new Error('tableName is required');
      }

      if (!indexName) {
        throw new Error('indexName is required');
      }

      if (typeof dimension !== 'number' || dimension <= 0) {
        throw new Error('dimension must be a positive number');
      }

      const tables = await this.lanceClient.tableNames();
      if (!tables.includes(tableName)) {
        throw new Error(
          `Table ${tableName} does not exist. Please create the table first by calling createTable() method.`,
        );
      }

      const table = await this.lanceClient.openTable(tableName);

      // Convert metric to LanceDB metric
      type LanceMetric = 'cosine' | 'l2' | 'dot';
      let metricType: LanceMetric | undefined;
      if (metric === 'euclidean') {
        metricType = 'l2';
      } else if (metric === 'dotproduct') {
        metricType = 'dot';
      } else if (metric === 'cosine') {
        metricType = 'cosine';
      }

      if (indexConfig.type === 'ivfflat') {
        await table.createIndex(indexName, {
          config: Index.ivfPq({
            numPartitions: indexConfig.numPartitions || 128,
            numSubVectors: indexConfig.numSubVectors || 16,
            distanceType: metricType,
          }),
        });
      } else {
        // Default to HNSW PQ index
        this.logger.debug('Creating HNSW PQ index with config:', indexConfig);
        await table.createIndex(indexName, {
          config: Index.hnswPq({
            m: indexConfig?.hnsw?.m || 16,
            efConstruction: indexConfig?.hnsw?.efConstruction || 100,
            distanceType: metricType,
          }),
        });
      }
    } catch (error: any) {
      throw new Error(`Failed to create index: ${error.message}`);
    }
  }

  async listIndexes(): Promise<string[]> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    try {
      const tables = await this.lanceClient.tableNames();
      const allIndices: string[] = [];

      for (const tableName of tables) {
        const table = await this.lanceClient.openTable(tableName);
        const tableIndices = await table.listIndices();
        allIndices.push(...tableIndices.map(index => index.name));
      }

      return allIndices;
    } catch (error: any) {
      throw new Error(`Failed to list indexes: ${error.message}`);
    }
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    if (!indexName) {
      throw new Error('indexName is required');
    }

    try {
      const tables = await this.lanceClient.tableNames();

      for (const tableName of tables) {
        this.logger.debug('Checking table:' + tableName);
        const table = await this.lanceClient.openTable(tableName);
        const tableIndices = await table.listIndices();
        const foundIndex = tableIndices.find(index => index.name === indexName);

        if (foundIndex) {
          const stats = await table.indexStats(foundIndex.name);

          if (!stats) {
            throw new Error(`Index stats not found for index: ${indexName}`);
          }

          const schema = await table.schema();
          const vectorCol = foundIndex.columns[0] || 'vector';

          // Find the vector column in the schema
          const vectorField = schema.fields.find(field => field.name === vectorCol);
          const dimension = vectorField?.type?.['listSize'] || 0;

          return {
            dimension: dimension,
            metric: stats.distanceType as 'cosine' | 'euclidean' | 'dotproduct' | undefined,
            count: stats.numIndexedRows,
          };
        }
      }

      throw new Error(`IndexName: ${indexName} not found`);
    } catch (error: any) {
      throw new Error(`Failed to describe index: ${error.message}`);
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    if (!indexName) {
      throw new Error('indexName is required');
    }

    try {
      const tables = await this.lanceClient.tableNames();

      for (const tableName of tables) {
        const table = await this.lanceClient.openTable(tableName);
        const tableIndices = await table.listIndices();
        const foundIndex = tableIndices.find(index => index.name === indexName);

        if (foundIndex) {
          await table.dropIndex(indexName);
          return;
        }
      }

      throw new Error(`Index ${indexName} not found`);
    } catch (error: any) {
      throw new Error(`Failed to delete index: ${error.message}`);
    }
  }

  /**
   * Deletes all tables in the database
   */
  async deleteAllTables(): Promise<void> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    try {
      await this.lanceClient.dropAllTables();
    } catch (error: any) {
      throw new Error(`Failed to delete tables: ${error.message}`);
    }
  }

  async deleteTable(tableName: string): Promise<void> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    try {
      await this.lanceClient.dropTable(tableName);
    } catch (error: any) {
      throw new Error(`Failed to delete tables: ${error.message}`);
    }
  }

  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    if (!indexName) {
      throw new Error('indexName is required');
    }

    if (!id) {
      throw new Error('id is required');
    }

    try {
      // In LanceDB, the indexName is actually a column name in a table
      // We need to find which table has this column as an index
      const tables = await this.lanceClient.tableNames();

      for (const tableName of tables) {
        this.logger.debug('Checking table:' + tableName);
        const table = await this.lanceClient.openTable(tableName);

        try {
          const schema = await table.schema();
          const hasColumn = schema.fields.some(field => field.name === indexName);

          if (hasColumn) {
            this.logger.debug(`Found column ${indexName} in table ${tableName}`);

            // First, query the existing record to preserve values that aren't being updated
            const existingRecord = await table
              .query()
              .where(`id = '${id}'`)
              .select(schema.fields.map(field => field.name))
              .limit(1)
              .toArray();

            if (existingRecord.length === 0) {
              throw new Error(`Record with id '${id}' not found in table ${tableName}`);
            }

            // Create a clean data object for update
            const rowData: Record<string, any> = {
              id,
            };

            // Copy all existing field values except special fields
            Object.entries(existingRecord[0]).forEach(([key, value]) => {
              // Skip special fields
              if (key !== 'id' && key !== '_distance') {
                // Handle vector field specially to avoid nested properties
                if (key === indexName) {
                  // If we're about to update this vector anyway, skip copying
                  if (!update.vector) {
                    // Ensure vector is a plain array
                    if (Array.isArray(value)) {
                      rowData[key] = [...value];
                    } else if (typeof value === 'object' && value !== null) {
                      // Handle vector objects by converting to array if needed
                      rowData[key] = Array.from(value as any[]);
                    } else {
                      rowData[key] = value;
                    }
                  }
                } else {
                  rowData[key] = value;
                }
              }
            });

            // Apply the vector update if provided
            if (update.vector) {
              rowData[indexName] = update.vector;
            }

            // Apply metadata updates if provided
            if (update.metadata) {
              Object.entries(update.metadata).forEach(([key, value]) => {
                rowData[`metadata_${key}`] = value;
              });
            }

            // Update the record
            await table.add([rowData], { mode: 'overwrite' });
            return;
          }
        } catch (err) {
          this.logger.error(`Error checking schema for table ${tableName}:` + err);
          // Continue to the next table if there's an error
          continue;
        }
      }

      throw new Error(`No table found with column/index '${indexName}'`);
    } catch (error: any) {
      throw new Error(`Failed to update index: ${error.message}`);
    }
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    if (!this.lanceClient) {
      throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
    }

    if (!indexName) {
      throw new Error('indexName is required');
    }

    if (!id) {
      throw new Error('id is required');
    }

    try {
      // In LanceDB, the indexName is actually a column name in a table
      // We need to find which table has this column as an index
      const tables = await this.lanceClient.tableNames();

      for (const tableName of tables) {
        this.logger.debug('Checking table:' + tableName);
        const table = await this.lanceClient.openTable(tableName);

        try {
          // Try to get the schema to check if this table has the column we're looking for
          const schema = await table.schema();
          const hasColumn = schema.fields.some(field => field.name === indexName);

          if (hasColumn) {
            this.logger.debug(`Found column ${indexName} in table ${tableName}`);
            await table.delete(`id = '${id}'`);
            return;
          }
        } catch (err) {
          this.logger.error(`Error checking schema for table ${tableName}:` + err);
          // Continue to the next table if there's an error
          continue;
        }
      }

      throw new Error(`No table found with column/index '${indexName}'`);
    } catch (error: any) {
      throw new Error(`Failed to delete index: ${error.message}`);
    }
  }

  /**
   * Converts a flattened object with keys using underscore notation back to a nested object.
   * Example: { name: 'test', details_text: 'test' } → { name: 'test', details: { text: 'test' } }
   */
  private unflattenObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const parts = key.split('_');

      // Start with the result object
      let current = result;

      // Process all parts except the last one
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        // Skip empty parts
        if (!part) continue;

        // Create nested object if it doesn't exist
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }

      // Set the value at the last part
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        current[lastPart] = value;
      }
    });

    return result;
  }
}
