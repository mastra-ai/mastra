import { connect } from '@lancedb/lancedb';
import type { Connection, ConnectionOptions, SchemaLike, FieldLike } from '@lancedb/lancedb';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType, TraceType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type {
  TABLE_NAMES,
  PaginationInfo,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  StorageColumn,
  EvalRow,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { DataType } from 'apache-arrow';
import { Utf8, Int32, Float32, Binary, Schema, Field, Float64 } from 'apache-arrow';

export class LanceStorage extends MastraStorage {
  private lanceClient!: Connection;

  /**
   * Creates a new instance of LanceStorage
   * @param uri The URI to connect to LanceDB
   * @param options connection options
   *
   * Usage:
   *
   * Connect to a local database
   * ```ts
   * const store = await LanceStorage.create('/path/to/db');
   * ```
   *
   * Connect to a LanceDB cloud database
   * ```ts
   * const store = await LanceStorage.create('db://host:port');
   * ```
   *
   * Connect to a cloud database
   * ```ts
   * const store = await LanceStorage.create('s3://bucket/db', { storageOptions: { timeout: '60s' } });
   * ```
   */
  public static async create(name: string, uri: string, options?: ConnectionOptions): Promise<LanceStorage> {
    const instance = new LanceStorage(name);
    try {
      instance.lanceClient = await connect(uri, options);
      return instance;
    } catch (e: any) {
      throw new Error(`Failed to connect to LanceDB: ${e}`);
    }
  }

  /**
   * @internal
   * Private constructor to enforce using the create factory method
   */
  private constructor(name: string) {
    super({ name });
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const arrowSchema = this.translateSchema(schema);
      await this.lanceClient.createEmptyTable(tableName, arrowSchema);
    } catch (error: any) {
      throw new Error(`Failed to create table: ${error}`);
    }
  }

  private translateSchema(schema: Record<string, StorageColumn>): Schema {
    const fields = Object.entries(schema).map(([name, column]) => {
      // Convert string type to Arrow DataType
      let arrowType: DataType;
      switch (column.type.toLowerCase()) {
        case 'text':
        case 'uuid':
          arrowType = new Utf8();
          break;
        case 'int':
        case 'integer':
          arrowType = new Int32();
          break;
        case 'bigint':
          arrowType = new Float64();
          break;
        case 'float':
          arrowType = new Float32();
          break;
        case 'jsonb':
        case 'json':
          arrowType = new Utf8();
          break;
        case 'binary':
          arrowType = new Binary();
          break;
        case 'timestamp':
          arrowType = new Float64();
          break;
        default:
          // Default to string for unknown types
          arrowType = new Utf8();
      }

      // Create a field with the appropriate arrow type
      return new Field(name, arrowType, column.nullable ?? true);
    });

    return new Schema(fields);
  }

  /**
   * Drop a table if it exists
   * @param tableName Name of the table to drop
   */
  async dropTable(tableName: TABLE_NAMES): Promise<void> {
    try {
      await this.lanceClient.dropTable(tableName);
    } catch (error: any) {
      // Don't throw if the table doesn't exist
      if (error.toString().includes('was not found')) {
        this.logger.debug(`Table '${tableName}' does not exist, skipping drop`);
        return;
      }
      throw new Error(`Failed to drop table: ${error}`);
    }
  }

  /**
   * Get table schema
   * @param tableName Name of the table
   * @returns Table schema
   */
  async getTableSchema(tableName: TABLE_NAMES): Promise<SchemaLike> {
    try {
      const table = await this.lanceClient.openTable(tableName);
      const rawSchema = await table.schema();
      const fields = rawSchema.fields as FieldLike[];

      // Convert schema to SchemaLike format
      return {
        fields,
        metadata: new Map<string, string>(),
        get names() {
          return fields.map((field: FieldLike) => field.name);
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to get table schema: ${error}`);
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return "''";
      case 'timestamp':
        return 'CURRENT_TIMESTAMP';
      case 'integer':
      case 'bigint':
        return '0';
      case 'jsonb':
        return "'{}'";
      case 'uuid':
        return "''";
      default:
        return super.getDefaultValue(type);
    }
  }

  /**
   * Alters table schema to add columns if they don't exist
   * @param tableName Name of the table
   * @param schema Schema of the table
   * @param ifNotExists Array of column names to add if they don't exist
   */
  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: string;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    const table = await this.lanceClient.openTable(tableName);
    const currentSchema = await table.schema();
    const existingFields = new Set(currentSchema.fields.map((f: any) => f.name));

    const typeMap: Record<string, string> = {
      text: 'string',
      integer: 'int',
      bigint: 'bigint',
      timestamp: 'timestamp',
      jsonb: 'string',
      uuid: 'string',
    };

    // Find columns to add
    const columnsToAdd = ifNotExists
      .filter(col => schema[col] && !existingFields.has(col))
      .map(col => {
        const colDef = schema[col];
        return {
          name: col,
          valueSql: colDef?.nullable
            ? `cast(NULL as ${typeMap[colDef.type ?? 'text']})`
            : `cast(${this.getDefaultValue(colDef?.type ?? 'text')} as ${typeMap[colDef?.type ?? 'text']})`,
        };
      });

    if (columnsToAdd.length > 0) {
      await table.addColumns(columnsToAdd);
      this.logger?.info?.(`Added columns [${columnsToAdd.map(c => c.name).join(', ')}] to table ${tableName}`);
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const table = await this.lanceClient.openTable(tableName);

    // delete function always takes a predicate as an argument, so we use '1=1' to delete all records because it is always true.
    await table.delete('1=1');
  }

  /**
   * Insert a single record into a table. This function overwrites the existing record if it exists. Use this function for inserting records into tables with custom schemas.
   * @param tableName The name of the table to insert into.
   * @param record The record to insert.
   */
  async insert({ tableName, record }: { tableName: string; record: Record<string, any> }): Promise<void> {
    try {
      const table = await this.lanceClient.openTable(tableName);

      const processedRecord = { ...record };

      for (const key in processedRecord) {
        if (
          processedRecord[key] !== null &&
          typeof processedRecord[key] === 'object' &&
          !(processedRecord[key] instanceof Date)
        ) {
          this.logger.debug('Converting object to JSON string: ', processedRecord[key]);
          processedRecord[key] = JSON.stringify(processedRecord[key]);
        }
      }

      await table.add([processedRecord], { mode: 'overwrite' });
    } catch (error: any) {
      throw new Error(`Failed to insert record: ${error}`);
    }
  }

  /**
   * Insert multiple records into a table. This function overwrites the existing records if they exist. Use this function for inserting records into tables with custom schemas.
   * @param tableName The name of the table to insert into.
   * @param records The records to insert.
   */
  async batchInsert({ tableName, records }: { tableName: string; records: Record<string, any>[] }): Promise<void> {
    try {
      const table = await this.lanceClient.openTable(tableName);

      const processedRecords = records.map(record => {
        const processedRecord = { ...record };

        // Convert values based on schema type
        for (const key in processedRecord) {
          // Skip null/undefined values
          if (processedRecord[key] == null) continue;

          if (
            processedRecord[key] !== null &&
            typeof processedRecord[key] === 'object' &&
            !(processedRecord[key] instanceof Date)
          ) {
            processedRecord[key] = JSON.stringify(processedRecord[key]);
          }
        }

        return processedRecord;
      });

      await table.add(processedRecords, { mode: 'overwrite' });
    } catch (error: any) {
      throw new Error(`Failed to batch insert records: ${error}`);
    }
  }

  /**
   * Load a record from the database by its key(s)
   * @param tableName The name of the table to query
   * @param keys Record of key-value pairs to use for lookup
   * @throws Error if invalid types are provided for keys
   * @returns The loaded record with proper type conversions, or null if not found
   */
  async load({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<any> {
    try {
      const table = await this.lanceClient.openTable(tableName);
      const tableSchema = await this.getTableSchema(tableName);
      const query = table.query();

      // Build filter condition with 'and' between all conditions
      if (Object.keys(keys).length > 0) {
        // Validate key types against schema
        this.validateKeyTypes(keys, tableSchema);

        const filterConditions = Object.entries(keys)
          .map(([key, value]) => {
            // Check if key is in camelCase and wrap it in backticks if it is
            const isCamelCase = /^[a-z][a-zA-Z]*$/.test(key) && /[A-Z]/.test(key);
            const quotedKey = isCamelCase ? `\`${key}\`` : key;

            // Handle different types appropriately
            if (typeof value === 'string') {
              return `${quotedKey} = '${value}'`;
            } else if (value === null) {
              return `${quotedKey} IS NULL`;
            } else {
              // For numbers, booleans, etc.
              return `${quotedKey} = ${value}`;
            }
          })
          .join(' AND ');

        this.logger.debug('where clause generated: ' + filterConditions);
        query.where(filterConditions);
      }

      const result = await query.limit(1).toArray();

      if (result.length === 0) {
        this.logger.debug('No record found');
        return null;
      }

      // Process the result with type conversions
      return this.processResultWithTypeConversion(result[0], tableSchema);
    } catch (error: any) {
      throw new Error(`Failed to load record: ${error}`);
    }
  }

  /**
   * Validates that key types match the schema definition
   * @param keys The keys to validate
   * @param tableSchema The table schema to validate against
   * @throws Error if a key has an incompatible type
   */
  private validateKeyTypes(keys: Record<string, any>, tableSchema: SchemaLike): void {
    // Create a map of field names to their expected types
    const fieldTypes = new Map(
      tableSchema.fields.map((field: any) => [field.name, field.type?.toString().toLowerCase()]),
    );

    for (const [key, value] of Object.entries(keys)) {
      const fieldType = fieldTypes.get(key);

      if (!fieldType) {
        throw new Error(`Field '${key}' does not exist in table schema`);
      }

      // Type validation
      if (value !== null) {
        if ((fieldType.includes('int') || fieldType.includes('bigint')) && typeof value !== 'number') {
          throw new Error(`Expected numeric value for field '${key}', got ${typeof value}`);
        }

        if (fieldType.includes('utf8') && typeof value !== 'string') {
          throw new Error(`Expected string value for field '${key}', got ${typeof value}`);
        }

        if (fieldType.includes('timestamp') && !(value instanceof Date) && typeof value !== 'string') {
          throw new Error(`Expected Date or string value for field '${key}', got ${typeof value}`);
        }
      }
    }
  }

  /**
   * Process a database result with appropriate type conversions based on the table schema
   * @param rawResult The raw result object from the database
   * @param tableSchema The schema of the table containing type information
   * @returns Processed result with correct data types
   */
  private processResultWithTypeConversion(
    rawResult: Record<string, any> | Record<string, any>[],
    tableSchema: SchemaLike,
  ): Record<string, any> | Record<string, any>[] {
    // Build a map of field names to their schema types
    const fieldTypeMap = new Map();
    tableSchema.fields.forEach((field: any) => {
      const fieldName = field.name;
      const fieldTypeStr = field.type.toString().toLowerCase();
      fieldTypeMap.set(fieldName, fieldTypeStr);
    });

    // Handle array case
    if (Array.isArray(rawResult)) {
      return rawResult.map(item => this.processResultWithTypeConversion(item, tableSchema));
    }

    // Handle single record case
    const processedResult = { ...rawResult };

    // Convert each field according to its schema type
    for (const key in processedResult) {
      const fieldTypeStr = fieldTypeMap.get(key);
      if (!fieldTypeStr) continue;

      // Skip conversion for ID fields - preserve their original format
      // if (key === 'id') {
      //   continue;
      // }

      // Only try to convert string values
      if (typeof processedResult[key] === 'string') {
        // Numeric types
        if (fieldTypeStr.includes('int32') || fieldTypeStr.includes('float32')) {
          if (!isNaN(Number(processedResult[key]))) {
            processedResult[key] = Number(processedResult[key]);
          }
        } else if (fieldTypeStr.includes('int64')) {
          processedResult[key] = Number(processedResult[key]);
        } else if (fieldTypeStr.includes('utf8')) {
          try {
            processedResult[key] = JSON.parse(processedResult[key]);
          } catch (e) {
            // If JSON parsing fails, keep the original string
            this.logger.debug(`Failed to parse JSON for key ${key}: ${e}`);
          }
        }
      } else if (typeof processedResult[key] === 'bigint') {
        // Convert BigInt values to regular numbers for application layer
        processedResult[key] = Number(processedResult[key]);
      }
    }

    return processedResult;
  }

  getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      return this.load({ tableName: TABLE_THREADS, keys: { id: threadId } });
    } catch (error: any) {
      throw new Error(`Failed to get thread by ID: ${error}`);
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const table = await this.lanceClient.openTable(TABLE_THREADS);
      // fetches all threads with the given resourceId
      const query = table.query().where(`\`resourceId\` = '${resourceId}'`);

      const records = await query.toArray();
      return this.processResultWithTypeConversion(
        records,
        await this.getTableSchema(TABLE_THREADS),
      ) as StorageThreadType[];
    } catch (error: any) {
      throw new Error(`Failed to get threads by resource ID: ${error}`);
    }
  }

  /**
   * Saves a thread to the database. This function doesn't overwrite existing threads.
   * @param thread - The thread to save
   * @returns The saved thread
   */
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const record = { ...thread, metadata: JSON.stringify(thread.metadata) };
      const table = await this.lanceClient.openTable(TABLE_THREADS);
      await table.add([record], { mode: 'append' });

      return thread;
    } catch (error: any) {
      throw new Error(`Failed to save thread: ${error}`);
    }
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    try {
      const record = { id, title, metadata: JSON.stringify(metadata) };
      const table = await this.lanceClient.openTable(TABLE_THREADS);
      await table.add([record], { mode: 'overwrite' });

      const query = table.query().where(`id = '${id}'`);

      const records = await query.toArray();
      return this.processResultWithTypeConversion(
        records[0],
        await this.getTableSchema(TABLE_THREADS),
      ) as StorageThreadType;
    } catch (error: any) {
      throw new Error(`Failed to update thread: ${error}`);
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      const table = await this.lanceClient.openTable(TABLE_THREADS);
      await table.delete(`id = '${threadId}'`);
    } catch (error: any) {
      throw new Error(`Failed to delete thread: ${error}`);
    }
  }

  /**
   * Processes messages to include context messages based on withPreviousMessages and withNextMessages
   * @param records - The sorted array of records to process
   * @param include - The array of include specifications with context parameters
   * @returns The processed array with context messages included
   */
  private processMessagesWithContext(
    records: any[],
    include: { id: string; withPreviousMessages?: number; withNextMessages?: number }[],
  ): any[] {
    const messagesWithContext = include.filter(item => item.withPreviousMessages || item.withNextMessages);

    if (messagesWithContext.length === 0) {
      return records;
    }

    // Create a map of message id to index in the sorted array for quick lookup
    const messageIndexMap = new Map<string, number>();
    records.forEach((message, index) => {
      messageIndexMap.set(message.id, index);
    });

    // Keep track of additional indices to include
    const additionalIndices = new Set<number>();

    for (const item of messagesWithContext) {
      const messageIndex = messageIndexMap.get(item.id);
      if (messageIndex !== undefined) {
        // Add previous messages if requested
        if (item.withPreviousMessages) {
          const startIdx = Math.max(0, messageIndex - item.withPreviousMessages);
          for (let i = startIdx; i < messageIndex; i++) {
            additionalIndices.add(i);
          }
        }

        // Add next messages if requested
        if (item.withNextMessages) {
          const endIdx = Math.min(records.length - 1, messageIndex + item.withNextMessages);
          for (let i = messageIndex + 1; i <= endIdx; i++) {
            additionalIndices.add(i);
          }
        }
      }
    }

    // If we need to include additional messages, create a new set of records
    if (additionalIndices.size === 0) {
      return records;
    }

    // Get IDs of the records that matched the original query
    const originalMatchIds = new Set(include.map(item => item.id));

    // Create a set of all indices we need to include
    const allIndices = new Set<number>();

    // Add indices of originally matched messages
    records.forEach((record, index) => {
      if (originalMatchIds.has(record.id)) {
        allIndices.add(index);
      }
    });

    // Add the additional context message indices
    additionalIndices.forEach(index => {
      allIndices.add(index);
    });

    // Create a new filtered array with only the required messages
    // while maintaining chronological order
    return Array.from(allIndices)
      .sort((a, b) => a - b)
      .map(index => records[index]);
  }

  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
    threadConfig,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      if (threadConfig) {
        throw new Error('ThreadConfig is not supported by LanceDB storage');
      }

      const table = await this.lanceClient.openTable(TABLE_MESSAGES);
      let query = table.query().where(`\`threadId\` = '${threadId}'`);

      // Apply selectBy filters if provided
      if (selectBy) {
        // Handle 'include' to fetch specific messages
        if (selectBy.include && selectBy.include.length > 0) {
          const includeIds = selectBy.include.map(item => item.id);
          // Add additional query to include specific message IDs
          // This will be combined with the threadId filter
          const includeClause = includeIds.map(id => `\`id\` = '${id}'`).join(' OR ');
          query = query.where(`(\`threadId\` = '${threadId}' OR (${includeClause}))`);

          // Note: The surrounding messages (withPreviousMessages/withNextMessages) will be
          // handled after we retrieve the results
        }
      }

      // Fetch all records matching the query
      let records = await query.toArray();

      // Sort the records chronologically
      records.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB; // Ascending order
      });

      // Process the include.withPreviousMessages and include.withNextMessages if specified
      if (selectBy?.include && selectBy.include.length > 0) {
        records = this.processMessagesWithContext(records, selectBy.include);
      }

      // If we're fetching the last N messages, take only the last N after sorting
      if (selectBy?.last !== undefined && selectBy.last !== false) {
        records = records.slice(-selectBy.last);
      }

      const messages = this.processResultWithTypeConversion(records, await this.getTableSchema(TABLE_MESSAGES));
      const normalized = messages.map((msg: MastraMessageV2 | MastraMessageV1) => ({
        ...msg,
        content:
          typeof msg.content === 'string'
            ? (() => {
                try {
                  return JSON.parse(msg.content);
                } catch {
                  return msg.content;
                }
              })()
            : msg.content,
      }));
      const list = new MessageList({ threadId, resourceId }).add(normalized, 'memory');
      if (format === 'v2') return list.get.all.v2();
      return list.get.all.v1();
    } catch (error: any) {
      throw new Error(`Failed to get messages: ${error}`);
    }
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    try {
      const { messages, format = 'v1' } = args;
      if (messages.length === 0) {
        return [];
      }

      const threadId = messages[0]?.threadId;

      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      const transformedMessages = messages.map((message: MastraMessageV2 | MastraMessageV1) => ({
        ...message,
        content: JSON.stringify(message.content),
      }));

      const table = await this.lanceClient.openTable(TABLE_MESSAGES);
      await table.add(transformedMessages, { mode: 'overwrite' });
      const list = new MessageList().add(messages, 'memory');
      if (format === `v2`) return list.get.all.v2();
      return list.get.all.v1();
    } catch (error: any) {
      throw new Error(`Failed to save messages: ${error}`);
    }
  }

  async saveTrace({ trace }: { trace: TraceType }): Promise<TraceType> {
    try {
      const table = await this.lanceClient.openTable(TABLE_TRACES);
      const record = {
        ...trace,
        attributes: JSON.stringify(trace.attributes),
        status: JSON.stringify(trace.status),
        events: JSON.stringify(trace.events),
        links: JSON.stringify(trace.links),
        other: JSON.stringify(trace.other),
      };
      await table.add([record], { mode: 'append' });

      return trace;
    } catch (error: any) {
      throw new Error(`Failed to save trace: ${error}`);
    }
  }

  async getTraceById({ traceId }: { traceId: string }): Promise<TraceType> {
    try {
      const table = await this.lanceClient.openTable(TABLE_TRACES);
      const query = table.query().where(`id = '${traceId}'`);
      const records = await query.toArray();
      return this.processResultWithTypeConversion(records[0], await this.getTableSchema(TABLE_TRACES)) as TraceType;
    } catch (error: any) {
      throw new Error(`Failed to get trace by ID: ${error}`);
    }
  }

  async getTraces({
    name,
    scope,
    page = 1,
    perPage = 10,
    attributes,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<TraceType[]> {
    try {
      const table = await this.lanceClient.openTable(TABLE_TRACES);
      const query = table.query();

      if (name) {
        query.where(`name = '${name}'`);
      }

      if (scope) {
        query.where(`scope = '${scope}'`);
      }

      if (attributes) {
        query.where(`attributes = '${JSON.stringify(attributes)}'`);
      }

      // Calculate offset based on page and perPage
      const offset = (page - 1) * perPage;

      // Apply limit for pagination
      query.limit(perPage);

      // Apply offset if greater than 0
      if (offset > 0) {
        query.offset(offset);
      }

      const records = await query.toArray();
      return records.map(record => {
        return {
          ...record,
          attributes: JSON.parse(record.attributes),
          status: JSON.parse(record.status),
          events: JSON.parse(record.events),
          links: JSON.parse(record.links),
          other: JSON.parse(record.other),
          startTime: new Date(record.startTime),
          endTime: new Date(record.endTime),
          createdAt: new Date(record.createdAt),
        };
      }) as TraceType[];
    } catch (error: any) {
      throw new Error(`Failed to get traces: ${error}`);
    }
  }

  async saveEvals({ evals }: { evals: EvalRow[] }): Promise<EvalRow[]> {
    try {
      const table = await this.lanceClient.openTable(TABLE_EVALS);
      const transformedEvals = evals.map(evalRecord => ({
        input: evalRecord.input,
        output: evalRecord.output,
        agent_name: evalRecord.agentName,
        metric_name: evalRecord.metricName,
        result: JSON.stringify(evalRecord.result),
        instructions: evalRecord.instructions,
        test_info: JSON.stringify(evalRecord.testInfo),
        global_run_id: evalRecord.globalRunId,
        run_id: evalRecord.runId,
        created_at: new Date(evalRecord.createdAt).getTime(),
      }));

      await table.add(transformedEvals, { mode: 'append' });
      return evals;
    } catch (error: any) {
      throw new Error(`Failed to save evals: ${error}`);
    }
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      if (type) {
        this.logger.warn('Type is not implemented yet in LanceDB storage');
      }
      const table = await this.lanceClient.openTable(TABLE_EVALS);
      const query = table.query().where(`agent_name = '${agentName}'`);
      const records = await query.toArray();
      return records.map(record => {
        return {
          id: record.id,
          input: record.input,
          output: record.output,
          agentName: record.agent_name,
          metricName: record.metric_name,
          result: JSON.parse(record.result),
          instructions: record.instructions,
          testInfo: JSON.parse(record.test_info),
          globalRunId: record.global_run_id,
          runId: record.run_id,
          createdAt: new Date(record.created_at).toString(),
        };
      }) as EvalRow[];
    } catch (error: any) {
      throw new Error(`Failed to get evals by agent name: ${error}`);
    }
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        // If parsing fails, return the raw snapshot string
        console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }

    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: parsedSnapshot,
      createdAt: this.ensureDate(row.createdAt)!,
      updatedAt: this.ensureDate(row.updatedAt)!,
      resourceId: row.resourceId,
    };
  }

  async getWorkflowRuns(args?: {
    namespace?: string;
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<WorkflowRuns> {
    try {
      const table = await this.lanceClient.openTable(TABLE_WORKFLOW_SNAPSHOT);
      const query = table.query();

      if (args?.workflowName) {
        query.where(`workflow_name = '${args.workflowName}'`);
      }

      if (args?.fromDate) {
        query.where(`\`createdAt\` >= ${args.fromDate.getTime()}`);
      }

      if (args?.toDate) {
        query.where(`\`createdAt\` <= ${args.toDate.getTime()}`);
      }

      if (args?.limit) {
        query.limit(args.limit);
      }

      if (args?.offset) {
        query.offset(args.offset);
      }

      const records = await query.toArray();
      return {
        runs: records.map(record => this.parseWorkflowRun(record)),
        total: records.length,
      };
    } catch (error: any) {
      throw new Error(`Failed to get workflow runs: ${error}`);
    }
  }

  /**
   * Retrieve a single workflow run by its runId.
   * @param args The ID of the workflow run to retrieve
   * @returns The workflow run object or null if not found
   */
  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<{
    workflowName: string;
    runId: string;
    snapshot: any;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      const table = await this.lanceClient.openTable(TABLE_WORKFLOW_SNAPSHOT);
      let whereClause = `run_id = '${args.runId}'`;
      if (args.workflowName) {
        whereClause += ` AND workflow_name = '${args.workflowName}'`;
      }
      const query = table.query().where(whereClause);
      const records = await query.toArray();
      if (records.length === 0) return null;
      const record = records[0];
      return this.parseWorkflowRun(record);
    } catch (error: any) {
      throw new Error(`Failed to get workflow run by id: ${error}`);
    }
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    try {
      const table = await this.lanceClient.openTable(TABLE_WORKFLOW_SNAPSHOT);

      // Try to find the existing record
      const query = table.query().where(`workflow_name = '${workflowName}' AND run_id = '${runId}'`);
      const records = await query.toArray();
      let createdAt: number;
      const now = Date.now();
      let mode: 'append' | 'overwrite' = 'append';

      if (records.length > 0) {
        createdAt = records[0].createdAt ?? now;
        mode = 'overwrite';
      } else {
        createdAt = now;
      }

      const record = {
        workflow_name: workflowName,
        run_id: runId,
        snapshot: JSON.stringify(snapshot),
        createdAt,
        updatedAt: now,
      };

      await table.add([record], { mode });
    } catch (error: any) {
      throw new Error(`Failed to persist workflow snapshot: ${error}`);
    }
  }
  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    try {
      const table = await this.lanceClient.openTable(TABLE_WORKFLOW_SNAPSHOT);
      const query = table.query().where(`workflow_name = '${workflowName}' AND run_id = '${runId}'`);
      const records = await query.toArray();
      return records.length > 0 ? JSON.parse(records[0].snapshot) : null;
    } catch (error: any) {
      throw new Error(`Failed to load workflow snapshot: ${error}`);
    }
  }

  async getTracesPaginated(_args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
    throw new Error('Method not implemented.');
  }

  async getThreadsByResourceIdPaginated(_args: {
    resourceId: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    throw new Error('Method not implemented.');
  }

  async getMessagesPaginated(
    _args: StorageGetMessagesArg,
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    throw new Error('Method not implemented.');
  }

  async updateMessages(_args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]> {
    this.logger.error('updateMessages is not yet implemented in LanceStore');
    throw new Error('Method not implemented');
  }
}
