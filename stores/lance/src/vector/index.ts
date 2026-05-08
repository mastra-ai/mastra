import { connect, Index } from '@lancedb/lancedb';
import type { Connection, ConnectionOptions, CreateTableOptions, Table, TableLike } from '@lancedb/lancedb';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
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
  DeleteVectorsParams,
} from '@mastra/core/vector';

import { MastraVector } from '@mastra/core/vector';
import type { LanceVectorFilter } from './filter';
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
  tableName?: string;
}

interface LanceQueryVectorParams extends QueryVectorParams<LanceVectorFilter> {
  tableName?: string;
  columns?: string[];
  includeAllColumns?: boolean;
}

export class LanceVectorStore extends MastraVector<LanceVectorFilter> {
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
  public static async create(uri: string, options?: ConnectionOptions & { id: string }): Promise<LanceVectorStore> {
    const instance = new LanceVectorStore(options?.id || crypto.randomUUID());
    try {
      instance.lanceClient = await connect(uri, options);
      return instance;
    } catch (e) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'CONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { uri },
        },
        e,
      );
    }
  }

  /**
   * @internal
   * Private constructor to enforce using the create factory method
   */
  private constructor(id: string) {
    super({ id });
  }

  close() {
    if (this.lanceClient) {
      this.lanceClient.close();
    }
  }

  async query({
    tableName,
    indexName,
    queryVector,
    filter,
    includeVector = false,
    topK = 10,
    columns = [],
    includeAllColumns = false,
  }: LanceQueryVectorParams): Promise<QueryResult[]> {
    // Default tableName to indexName for compatibility with the standard QueryVectorParams interface.
    // This allows Memory and other consumers to call query without explicitly providing tableName.
    const resolvedTableName = tableName ?? indexName;

    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Lance queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName: resolvedTableName },
      });
    }

    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!resolvedTableName) {
        throw new Error('tableName or indexName is required');
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'QUERY', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: error instanceof Error ? error.message : 'Invalid query arguments',
          details: { tableName: resolvedTableName },
        },
        error,
      );
    }

    try {
      // Check if table exists - return empty array if not
      const tables = await this.lanceClient.tableNames();
      if (!tables.includes(resolvedTableName)) {
        this.logger.debug(`Table ${resolvedTableName} does not exist. Returning empty results.`);
        return [];
      }

      // Open the table
      const table = await this.lanceClient.openTable(resolvedTableName);

      // Create the query builder
      let query = table.search(queryVector);

      // Add filter if provided
      if (filter && Object.keys(filter).length > 0) {
        const whereClause = this.filterTranslator(filter);
        this.logger.debug(`Where clause generated: ${whereClause}`);

        // Validate that filter columns exist in the table schema.
        // When Memory.recall() runs before any saveMessages(), the table has no metadata columns yet.
        // Filtering on non-existent columns would throw a LanceDB schema error.
        const schema = await table.schema();
        const schemaColumns = new Set(schema.fields.map((f: any) => f.name));
        const filterColumns = this.extractFilterColumns(whereClause);
        const missingColumns = filterColumns.filter(col => !schemaColumns.has(col));

        if (missingColumns.length > 0) {
          this.logger.debug(
            `Filter references columns not in schema: ${missingColumns.join(', ')}. Returning empty results.`,
          );
          return [];
        }

        query = query.where(whereClause);
      }

      // Apply column selection only if specific columns were requested
      // If columns is empty and includeAllColumns is false, return all columns by default
      if (!includeAllColumns && columns.length > 0) {
        const selectColumns = [...columns];
        if (!selectColumns.includes('id')) {
          selectColumns.push('id');
        }
        query = query.select(selectColumns);
      }
      query = query.limit(topK);

      // Execute the query
      const results = await query.toArray();

      return results.map(result => {
        let metadata: Record<string, any> = {};

        if (result._metadata_json) {
          // New data: parse the lossless JSON column
          try {
            metadata = JSON.parse(result._metadata_json);
          } catch {
            metadata = this.extractFlatMetadata(result);
          }
        } else {
          // Legacy data or empty metadata: extract flat metadata keys as-is
          metadata = this.extractFlatMetadata(result);
        }

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
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: resolvedTableName, includeVector, columnsCount: columns?.length, includeAllColumns },
        },
        error,
      );
    }
  }

  private filterTranslator(filter: LanceVectorFilter): string {
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

  async upsert({ tableName, indexName, vectors, metadata = [], ids = [] }: LanceUpsertVectorParams): Promise<string[]> {
    // Default tableName to indexName for compatibility with the standard UpsertVectorParams interface.
    // This allows Memory and other consumers to call upsert without explicitly providing tableName.
    const resolvedTableName = tableName ?? indexName;

    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!resolvedTableName) {
        throw new Error('tableName or indexName is required');
      }

      if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
        throw new Error('vectors array is required and must not be empty');
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'UPSERT', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: error instanceof Error ? error.message : 'Invalid upsert arguments',
          details: { tableName: resolvedTableName },
        },
        error,
      );
    }

    try {
      const tables = await this.lanceClient.tableNames();
      const tableExists = tables.includes(resolvedTableName);
      let table: Table | null = null;

      if (!tableExists) {
        this.logger.debug(`Table ${resolvedTableName} does not exist. Creating it with the first upsert data.`);
      } else {
        table = await this.lanceClient.openTable(resolvedTableName);
      }

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
          // Store lossless JSON representation for round-trip fidelity
          rowData['_metadata_json'] = JSON.stringify(metadataItem);
        } else {
          rowData['_metadata_json'] = '';
        }

        return rowData;
      });

      if (table !== null) {
        // Table exists - check if we need to recreate it due to schema differences
        // This can happen when createIndex creates an empty table with minimal schema
        // and then upsert is called with metadata fields
        const rowCount = await table.countRows();
        const schema = await table.schema();
        const existingColumns = new Set(schema.fields.map(f => f.name));

        // Check for schema mismatches:
        // - extraColumns: columns in data not in schema (will be dropped)
        // - missingSchemaColumns: columns in schema not in data (will be set to null)
        const dataColumns = new Set(Object.keys(data[0] || {}));
        const extraColumns = [...dataColumns].filter(col => !existingColumns.has(col));
        const missingSchemaColumns = [...existingColumns].filter(col => !dataColumns.has(col));
        const hasSchemaMismatch = extraColumns.length > 0 || missingSchemaColumns.length > 0;

        if (rowCount === 0 && extraColumns.length > 0) {
          // Empty table with extra columns in data - recreate it with the correct schema
          // Note: This operation is not atomic. Concurrent upserts during table recreation
          // may fail and should be retried by the caller.
          this.logger.warn(
            `Table ${resolvedTableName} is empty and data has extra columns ${extraColumns.join(', ')}. Recreating with new schema.`,
          );
          await this.lanceClient.dropTable(resolvedTableName);
          await this.lanceClient.createTable(resolvedTableName, data);
        } else if (hasSchemaMismatch) {
          // Non-empty table or schema mismatch - normalize data to match existing schema
          // LanceDB requires data to match table schema exactly, in the same column order
          if (extraColumns.length > 0) {
            this.logger.warn(
              `Table ${resolvedTableName} has ${rowCount} rows. Columns ${extraColumns.join(', ')} will be dropped from upsert.`,
            );
          }
          // Use schema field order to ensure columns are in the correct order
          const schemaFieldNames = schema.fields.map(f => f.name);
          const normalizedData = data.map(row => {
            const normalized: Record<string, any> = {};
            for (const col of schemaFieldNames) {
              // Include column from row if present, otherwise set to null
              normalized[col] = col in row ? row[col] : null;
            }
            return normalized;
          });
          // Use mergeInsert for true upsert behavior: update existing rows, insert new ones
          await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(normalizedData);
        } else {
          // Schema matches exactly - use mergeInsert for true upsert behavior
          await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(data);
        }
      } else {
        // Table doesn't exist, create it with the data
        this.logger.debug(`Creating table ${resolvedTableName} with initial data`);
        await this.lanceClient.createTable(resolvedTableName, data);
      }

      return vectorIds;
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: resolvedTableName,
            vectorCount: vectors.length,
            metadataCount: metadata.length,
            idsCount: ids.length,
          },
        },
        error,
      );
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
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'CREATE_TABLE', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'LanceDB client not initialized. Use LanceVectorStore.create() to create an instance',
        details: { tableName },
      });
    }

    // Flatten nested objects if data is an array of records
    if (Array.isArray(data)) {
      data = data.map(record => this.flattenObject(record));
    }

    try {
      return await this.lanceClient.createTable(tableName, data, options);
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'CREATE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async listTables(): Promise<string[]> {
    if (!this.lanceClient) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'LIST_TABLES', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'LanceDB client not initialized. Use LanceVectorStore.create() to create an instance',
        details: { methodName: 'listTables' },
      });
    }
    try {
      return await this.lanceClient.tableNames();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'LIST_TABLES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTableSchema(tableName: string): Promise<any> {
    if (!this.lanceClient) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'GET_TABLE_SCHEMA', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'LanceDB client not initialized. Use LanceVectorStore.create() to create an instance',
        details: { tableName },
      });
    }

    try {
      const table = await this.lanceClient.openTable(tableName);
      return await table.schema();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'GET_TABLE_SCHEMA', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Creates a vector index on a table.
   *
   * The behavior of `indexName` depends on whether `tableName` is provided:
   * - With `tableName`: `indexName` is the column to index (advanced use case)
   * - Without `tableName`: `indexName` becomes the table name, and 'vector' is used as the column (Memory compatibility)
   *
   * @param tableName - Optional table name. If not provided, defaults to indexName.
   * @param indexName - The index/column name, or table name if tableName is not provided.
   * @param dimension - Vector dimension size.
   * @param metric - Distance metric: 'cosine', 'euclidean', or 'dotproduct'.
   * @param indexConfig - Optional index configuration.
   */
  async createIndex({
    tableName,
    indexName,
    dimension,
    metric = 'cosine',
    indexConfig = {},
  }: LanceCreateIndexParams): Promise<void> {
    // Default tableName to indexName for compatibility with the standard CreateIndexParams interface.
    // This allows Memory and other consumers to call createIndex without explicitly providing tableName.
    const resolvedTableName = tableName ?? indexName;

    // Determine the column to index:
    // - If tableName was provided, indexName is the column name (advanced use case)
    // - If tableName was not provided, use 'vector' as the column name (Memory compatibility)
    const columnToIndex = tableName ? indexName : 'vector';

    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!indexName) {
        throw new Error('indexName is required');
      }

      if (typeof dimension !== 'number' || dimension <= 0) {
        throw new Error('dimension must be a positive number');
      }
    } catch (err) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'CREATE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { tableName: resolvedTableName, indexName, dimension, metric },
        },
        err,
      );
    }

    try {
      const tables = await this.lanceClient.tableNames();
      let table: Table;

      if (!tables.includes(resolvedTableName)) {
        // Table doesn't exist - create an empty table with the proper schema.
        // LanceDB requires at least one row to infer schema, so we create a dummy row
        // and immediately delete it. This leaves an empty table with the correct schema.
        // Race condition note: There's a brief window between createTable and delete where
        // the '__init__' row could appear in concurrent query results. In practice this window
        // is very short (single-digit milliseconds). Callers needing strict consistency should
        // filter out id='__init__' or ensure exclusive access during table creation.
        this.logger.debug(
          `Table ${resolvedTableName} does not exist. Creating empty table with dimension ${dimension}.`,
        );

        const initVector = new Array(dimension).fill(0);
        table = await this.lanceClient.createTable(resolvedTableName, [
          { id: '__init__', vector: initVector, _metadata_json: '' },
        ]);
        try {
          await table.delete("id = '__init__'");
        } catch (deleteError) {
          this.logger.warn(
            `Failed to delete initialization row from ${resolvedTableName}. Subsequent queries may include '__init__' row.`,
            deleteError,
          );
        }
        // Table is now empty; index will be created when data is upserted and row count >= 256
        this.logger.debug(`Table ${resolvedTableName} created. Index creation deferred until data is available.`);
        return;
      } else {
        table = await this.lanceClient.openTable(resolvedTableName);
      }

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

      // Check row count - LanceDB requires at least 256 rows for IVF_HNSW_PQ index
      const rowCount = await table.countRows();
      if (rowCount < 256) {
        this.logger.warn(
          `Table ${resolvedTableName} has ${rowCount} rows, which is below the 256 row minimum for index creation. Skipping index creation.`,
        );
        return;
      }

      if (indexConfig.type === 'ivfflat') {
        await table.createIndex(columnToIndex, {
          config: Index.ivfPq({
            numPartitions: indexConfig.numPartitions || 128,
            numSubVectors: indexConfig.numSubVectors || 16,
            distanceType: metricType,
          }),
        });
      } else {
        // Default to HNSW PQ index
        this.logger.debug('Creating HNSW PQ index with config:', indexConfig);
        await table.createIndex(columnToIndex, {
          config: Index.hnswPq({
            m: indexConfig?.hnsw?.m || 16,
            efConstruction: indexConfig?.hnsw?.efConstruction || 100,
            distanceType: metricType,
          }),
        });
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName: resolvedTableName, indexName, dimension },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    if (!this.lanceClient) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'LIST_INDEXES', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'LanceDB client not initialized. Use LanceVectorStore.create() to create an instance',
        details: { methodName: 'listIndexes' },
      });
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
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!indexName) {
        throw new Error('indexName is required');
      }
    } catch (err) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DESCRIBE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        },
        err,
      );
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
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!indexName) {
        throw new Error('indexName is required');
      }
    } catch (err) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DELETE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        },
        err,
      );
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
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Deletes all tables in the database
   */
  async deleteAllTables(): Promise<void> {
    if (!this.lanceClient) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'DELETE_ALL_TABLES', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { methodName: 'deleteAllTables' },
        text: 'LanceDB client not initialized. Use LanceVectorStore.create() to create an instance',
      });
    }
    try {
      await this.lanceClient.dropAllTables();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DELETE_ALL_TABLES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { methodName: 'deleteAllTables' },
        },
        error,
      );
    }
  }

  async deleteTable(tableName: string): Promise<void> {
    if (!this.lanceClient) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'DELETE_TABLE', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { tableName },
        text: 'LanceDB client not initialized. Use LanceVectorStore.create() to create an instance',
      });
    }

    try {
      await this.lanceClient.dropTable(tableName);
    } catch (error: any) {
      // throw new Error(`Failed to delete tables: ${error.message}`);
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DELETE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async updateVector(params: UpdateVectorParams<LanceVectorFilter>): Promise<void> {
    const { indexName, update } = params;

    // Validate mutually exclusive parameters
    if ('id' in params && 'filter' in params && params.id && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!('id' in params || 'filter' in params) || (!params.id && !params.filter)) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'UPDATE_VECTOR', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either id or filter must be provided',
        details: { indexName },
      });
    }

    if ('filter' in params && params.filter && Object.keys(params.filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot update with empty filter',
        details: { indexName },
      });
    }

    if (!update.vector && !update.metadata) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'UPDATE_VECTOR', 'NO_PAYLOAD'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No updates provided',
        details: { indexName },
      });
    }

    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!indexName) {
        throw new Error('indexName is required');
      }

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

            let whereClause: string;
            if ('id' in params && params.id) {
              whereClause = `id = '${params.id}'`;
            } else if ('filter' in params && params.filter) {
              // Use filter translator to build SQL WHERE clause
              const translator = new LanceFilterTranslator();
              const processFilterKeys = (filter: Record<string, any>): Record<string, any> => {
                const processedFilter: Record<string, any> = {};
                Object.entries(filter).forEach(([key, value]) => {
                  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                      processedFilter[`metadata_${key}_${nestedKey}`] = nestedValue;
                    });
                  } else {
                    processedFilter[`metadata_${key}`] = value;
                  }
                });
                return processedFilter;
              };

              const prefixedFilter = processFilterKeys(params.filter as Record<string, any>);
              whereClause = translator.translate(prefixedFilter) || '';

              if (!whereClause) {
                throw new Error('Failed to translate filter to SQL');
              }
            } else {
              throw new Error('Either id or filter must be provided');
            }

            // Query for existing records that match
            const existingRecords = await table
              .query()
              .where(whereClause)
              .select(schema.fields.map(field => field.name))
              .toArray();

            if (existingRecords.length === 0) {
              this.logger.info(`No records found matching criteria in table ${tableName}`);
              return;
            }

            // Update each matching record
            const updatedRecords = existingRecords.map(record => {
              const rowData: Record<string, any> = {};

              // Copy all existing field values except special fields
              Object.entries(record).forEach(([key, value]) => {
                // Skip special fields
                if (key !== '_distance') {
                  // Handle vector field specially to avoid nested properties
                  if (key === indexName) {
                    // If we're about to update this vector anyway, use the new value
                    if (update.vector) {
                      rowData[key] = update.vector;
                    } else {
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

              // Apply metadata updates if provided
              if (update.metadata) {
                // Update flattened columns for filter compatibility
                Object.entries(update.metadata).forEach(([key, value]) => {
                  rowData[`metadata_${key}`] = value;
                });

                // Keep _metadata_json in sync if the table has it
                const hasMetadataJson = schema.fields.some((f: any) => f.name === '_metadata_json');
                if (hasMetadataJson) {
                  let existingMetadata: Record<string, any> = {};
                  if (record._metadata_json) {
                    try {
                      existingMetadata = JSON.parse(record._metadata_json);
                    } catch {
                      // If existing JSON is corrupt, start fresh with updates only
                    }
                  }
                  rowData['_metadata_json'] = JSON.stringify({ ...existingMetadata, ...update.metadata });
                }
              }

              return rowData;
            });

            // Use mergeInsert for true update behavior without replacing the entire table
            await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(updatedRecords);
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...('id' in params && params.id && { id: params.id }),
            ...('filter' in params && params.filter && { filter: JSON.stringify(params.filter) }),
            hasVector: !!update.vector,
            hasMetadata: !!update.metadata,
          },
        },
        error,
      );
    }
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!indexName) {
        throw new Error('indexName is required');
      }

      if (!id) {
        throw new Error('id is required');
      }
    } catch (err) {
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DELETE_VECTOR', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            indexName,
            ...(id && { id }),
          },
        },
        err,
      );
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
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
          },
        },
        error,
      );
    }
  }

  /**
   * Extracts column names referenced in a SQL WHERE clause.
   * Identifies metadata_* prefixed identifiers used in filter conditions.
   */
  private extractFilterColumns(whereClause: string): string[] {
    // Match identifiers that look like column names (word characters, starting with metadata_)
    const matches = whereClause.match(/metadata_\w+/g);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Extracts metadata from flattened column names (legacy data without _metadata_json).
   * Returns keys as-is after stripping the 'metadata_' prefix, without any unflattening.
   */
  private extractFlatMetadata(result: Record<string, any>): Record<string, any> {
    const metadata: Record<string, any> = {};
    Object.keys(result).forEach(key => {
      if (key !== 'id' && key !== 'score' && key !== 'vector' && key !== '_distance' && key !== '_metadata_json') {
        if (key.startsWith('metadata_')) {
          metadata[key.substring('metadata_'.length)] = result[key];
        }
      }
    });
    return metadata;
  }

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<LanceVectorFilter>): Promise<void> {
    // Validate mutually exclusive parameters
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'ids and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either filter or ids must be provided',
        details: { indexName },
      });
    }

    // Validate non-empty arrays and objects
    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'DELETE_VECTORS', 'EMPTY_IDS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot delete with empty ids array',
        details: { indexName },
      });
    }

    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('LANCE', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot delete with empty filter',
        details: { indexName },
      });
    }

    try {
      if (!this.lanceClient) {
        throw new Error('LanceDB client not initialized. Use LanceVectorStore.create() to create an instance');
      }

      if (!indexName) {
        throw new Error('indexName is required');
      }

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

            if (ids) {
              // Delete by IDs
              const idsConditions = ids.map(id => `id = '${id}'`).join(' OR ');
              await table.delete(idsConditions);
            } else if (filter) {
              // Delete by filter using SQL WHERE clause
              const translator = new LanceFilterTranslator();
              const processFilterKeys = (filter: Record<string, any>): Record<string, any> => {
                const processedFilter: Record<string, any> = {};
                Object.entries(filter).forEach(([key, value]) => {
                  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                      processedFilter[`metadata_${key}_${nestedKey}`] = nestedValue;
                    });
                  } else {
                    processedFilter[`metadata_${key}`] = value;
                  }
                });
                return processedFilter;
              };

              const prefixedFilter = processFilterKeys(filter as Record<string, any>);
              const whereClause = translator.translate(prefixedFilter);

              if (!whereClause) {
                throw new Error('Failed to translate filter to SQL');
              }

              await table.delete(whereClause);
            }

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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('LANCE', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
    }
  }
}
