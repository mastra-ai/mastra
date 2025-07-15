import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2, MastraMessageV2 } from '@mastra/core/agent';
export type MastraMessageV2WithTypedContent = Omit<MastraMessageV2, 'content'> & { content: MastraMessageContentV2 };
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult } from '@mastra/core/eval';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_RESOURCES,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
} from '@mastra/core/storage';
import type {
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageResourceType,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
  PaginationArgs,
} from '@mastra/core/storage';
import { parseSqlIdentifier, parseFieldKey } from '@mastra/core/utils';
import type { WorkflowRunState } from '@mastra/core/workflows';
import sql from 'mssql';

export type MSSQLConfigType = {
  schemaName?: string;
} & (
  | {
      server: string;
      port: number;
      database: string;
      user: string;
      password: string;
      options?: sql.IOptions;
    }
  | {
      connectionString: string;
    }
);

export type MSSQLConfig = MSSQLConfigType;

export class MSSQLStore extends MastraStorage {
  public pool: sql.ConnectionPool;
  private schema?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;
  private isConnected: Promise<boolean> | null = null;

  constructor(config: MSSQLConfigType) {
    super({ name: 'MSSQLStore' });
    try {
      if ('connectionString' in config) {
        if (
          !config.connectionString ||
          typeof config.connectionString !== 'string' ||
          config.connectionString.trim() === ''
        ) {
          throw new Error('MSSQLStore: connectionString must be provided and cannot be empty.');
        }
      } else {
        const required = ['server', 'database', 'user', 'password'];
        for (const key of required) {
          if (!(key in config) || typeof (config as any)[key] !== 'string' || (config as any)[key].trim() === '') {
            throw new Error(`MSSQLStore: ${key} must be provided and cannot be empty.`);
          }
        }
      }

      this.schema = config.schemaName;
      this.pool =
        'connectionString' in config
          ? new sql.ConnectionPool(config.connectionString)
          : new sql.ConnectionPool({
              server: config.server,
              database: config.database,
              user: config.user,
              password: config.password,
              port: config.port,
              options: config.options || { encrypt: true, trustServerCertificate: true },
            });
    } catch (e) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_INITIALIZATION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  async init(): Promise<void> {
    if (this.isConnected === null) {
      this.isConnected = this._performInitializationAndStore();
    }
    try {
      await this.isConnected;
      await super.init();
    } catch (error) {
      this.isConnected = null;
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private async _performInitializationAndStore(): Promise<boolean> {
    try {
      await this.pool.connect();
      return true;
    } catch (err) {
      throw err;
    }
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
    };
  }

  private getTableName(indexName: string) {
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
    const quotedIndexName = `[${parsedIndexName}]`;
    const quotedSchemaName = this.getSchemaName();
    return quotedSchemaName ? `${quotedSchemaName}.${quotedIndexName}` : quotedIndexName;
  }

  private getSchemaName() {
    return this.schema ? `[${parseSqlIdentifier(this.schema, 'schema name')}]` : undefined;
  }

  private transformEvalRow(row: Record<string, any>): EvalRow {
    let testInfoValue = null,
      resultValue = null;
    if (row.test_info) {
      try {
        testInfoValue = typeof row.test_info === 'string' ? JSON.parse(row.test_info) : row.test_info;
      } catch {}
    }
    if (row.test_info) {
      try {
        resultValue = typeof row.result === 'string' ? JSON.parse(row.result) : row.result;
      } catch {}
    }
    return {
      agentName: row.agent_name as string,
      input: row.input as string,
      output: row.output as string,
      result: resultValue as MetricResult,
      metricName: row.metric_name as string,
      instructions: row.instructions as string,
      testInfo: testInfoValue,
      globalRunId: row.global_run_id as string,
      runId: row.run_id as string,
      createdAt: row.created_at as string,
    };
  }

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      let query = `SELECT * FROM ${this.getTableName(TABLE_EVALS)} WHERE agent_name = @p1`;
      if (type === 'test') {
        query += " AND test_info IS NOT NULL AND JSON_VALUE(test_info, '$.testPath') IS NOT NULL";
      } else if (type === 'live') {
        query += " AND (test_info IS NULL OR JSON_VALUE(test_info, '$.testPath') IS NULL)";
      }
      query += ' ORDER BY created_at DESC';

      const request = this.pool.request();
      request.input('p1', agentName);
      const result = await request.query(query);
      const rows = result.recordset;
      return typeof this.transformEvalRow === 'function'
        ? (rows?.map((row: any) => this.transformEvalRow(row)) ?? [])
        : (rows ?? []);
    } catch (error: any) {
      if (error && error.number === 208 && error.message && error.message.includes('Invalid object name')) {
        return [];
      }
      console.error('Failed to get evals for the specified agent: ' + error?.message);
      throw error;
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const transaction = this.pool.transaction();
    try {
      await transaction.begin();
      for (const record of records) {
        await this.insert({ tableName, record });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            numberOfRecords: records.length,
          },
        },
        error,
      );
    }
  }

  /** @deprecated use getTracesPaginated instead*/
  public async getTraces(args: {
    name?: string;
    scope?: string;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    page: number;
    perPage?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<any[]> {
    if (args.fromDate || args.toDate) {
      (args as any).dateRange = {
        start: args.fromDate,
        end: args.toDate,
      };
    }
    const result = await this.getTracesPaginated(args);
    return result.traces;
  }

  public async getTracesPaginated(
    args: {
      name?: string;
      scope?: string;
      attributes?: Record<string, string>;
      filters?: Record<string, any>;
    } & PaginationArgs,
  ): Promise<
    PaginationInfo & {
      traces: any[];
    }
  > {
    const { name, scope, page = 0, perPage: perPageInput, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const perPage = perPageInput !== undefined ? perPageInput : 100;
    const currentOffset = page * perPage;

    const paramMap: Record<string, any> = {};
    const conditions: string[] = [];
    let paramIndex = 1;

    if (name) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[name] LIKE @${paramName}`);
      paramMap[paramName] = `${name}%`;
    }
    if (scope) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[scope] = @${paramName}`);
      paramMap[paramName] = scope;
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        const parsedKey = parseFieldKey(key);
        const paramName = `p${paramIndex++}`;
        conditions.push(`JSON_VALUE([attributes], '$.${parsedKey}') = @${paramName}`);
        paramMap[paramName] = value;
      });
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        const parsedKey = parseFieldKey(key);
        const paramName = `p${paramIndex++}`;
        conditions.push(`[${parsedKey}] = @${paramName}`);
        paramMap[paramName] = value;
      });
    }
    if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[createdAt] >= @${paramName}`);
      paramMap[paramName] = fromDate.toISOString();
    }
    if (toDate instanceof Date && !isNaN(toDate.getTime())) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[createdAt] <= @${paramName}`);
      paramMap[paramName] = toDate.toISOString();
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM ${this.getTableName(TABLE_TRACES)} ${whereClause}`;
    let total = 0;
    try {
      const countRequest = this.pool.request();
      Object.entries(paramMap).forEach(([key, value]) => {
        if (value instanceof Date) {
          countRequest.input(key, sql.DateTime, value);
        } else {
          countRequest.input(key, value);
        }
      });
      const countResult = await countRequest.query(countQuery);
      total = parseInt(countResult.recordset[0].total, 10);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_TRACES_PAGINATED_FAILED_TO_RETRIEVE_TOTAL_COUNT',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            name: args.name ?? '',
            scope: args.scope ?? '',
          },
        },
        error,
      );
    }

    if (total === 0) {
      return {
        traces: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }

    const dataQuery = `SELECT * FROM ${this.getTableName(TABLE_TRACES)} ${whereClause} ORDER BY [seq_id] DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    const dataRequest = this.pool.request();
    Object.entries(paramMap).forEach(([key, value]) => {
      if (value instanceof Date) {
        dataRequest.input(key, sql.DateTime, value);
      } else {
        dataRequest.input(key, value);
      }
    });
    dataRequest.input('offset', currentOffset);
    dataRequest.input('limit', perPage);

    try {
      const rowsResult = await dataRequest.query(dataQuery);
      const rows = rowsResult.recordset;
      const traces = rows.map(row => ({
        id: row.id,
        parentSpanId: row.parentSpanId,
        traceId: row.traceId,
        name: row.name,
        scope: row.scope,
        kind: row.kind,
        status: JSON.parse(row.status),
        events: JSON.parse(row.events),
        links: JSON.parse(row.links),
        attributes: JSON.parse(row.attributes),
        startTime: row.startTime,
        endTime: row.endTime,
        other: row.other,
        createdAt: row.createdAt,
      }));

      return {
        traces,
        total,
        page,
        perPage,
        hasMore: currentOffset + traces.length < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_TRACES_PAGINATED_FAILED_TO_RETRIEVE_TRACES',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            name: args.name ?? '',
            scope: args.scope ?? '',
          },
        },
        error,
      );
    }
  }

  private async setupSchema() {
    if (!this.schema || this.schemaSetupComplete) {
      return;
    }

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          const checkRequest = this.pool.request();
          checkRequest.input('schemaName', this.schema);
          const checkResult = await checkRequest.query(`
            SELECT 1 AS found FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = @schemaName
          `);
          const schemaExists = Array.isArray(checkResult.recordset) && checkResult.recordset.length > 0;

          if (!schemaExists) {
            try {
              await this.pool.request().query(`CREATE SCHEMA [${this.schema}]`);
              this.logger?.info?.(`Schema "${this.schema}" created successfully`);
            } catch (error) {
              this.logger?.error?.(`Failed to create schema "${this.schema}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schema}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          this.schemaSetupComplete = true;
          this.logger?.debug?.(`Schema "${this.schema}" is ready for use`);
        } catch (error) {
          this.schemaSetupComplete = undefined;
          this.setupSchemaPromise = null;
          throw error;
        } finally {
          this.setupSchemaPromise = null;
        }
      })();
    }

    await this.setupSchemaPromise;
  }

  protected getSqlType(type: StorageColumn['type'], isPrimaryKey = false): string {
    switch (type) {
      case 'text':
        return isPrimaryKey ? 'NVARCHAR(255)' : 'NVARCHAR(MAX)';
      case 'timestamp':
        return 'DATETIME2(7)';
      case 'uuid':
        return 'UNIQUEIDENTIFIER';
      case 'jsonb':
        return 'NVARCHAR(MAX)';
      case 'integer':
        return 'INT';
      case 'bigint':
        return 'BIGINT';
      default:
        throw new MastraError({
          id: 'MASTRA_STORAGE_MSSQL_STORE_TYPE_NOT_SUPPORTED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        });
    }
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    try {
      const uniqueConstraintColumns = tableName === TABLE_WORKFLOW_SNAPSHOT ? ['workflow_name', 'run_id'] : [];

      const columns = Object.entries(schema)
        .map(([name, def]) => {
          const parsedName = parseSqlIdentifier(name, 'column name');
          const constraints = [];
          if (def.primaryKey) constraints.push('PRIMARY KEY');
          if (!def.nullable) constraints.push('NOT NULL');
          const isIndexed = !!def.primaryKey || uniqueConstraintColumns.includes(name);
          return `[${parsedName}] ${this.getSqlType(def.type, isIndexed)} ${constraints.join(' ')}`.trim();
        })
        .join(',\n');

      if (this.schema) {
        await this.setupSchema();
      }

      const checkTableRequest = this.pool.request();
      checkTableRequest.input('tableName', this.getTableName(tableName).replace(/[[\]]/g, '').split('.').pop());
      const checkTableSql = `SELECT 1 AS found FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName`;
      checkTableRequest.input('schema', this.schema || 'dbo');
      const checkTableResult = await checkTableRequest.query(checkTableSql);
      const tableExists = Array.isArray(checkTableResult.recordset) && checkTableResult.recordset.length > 0;

      if (!tableExists) {
        const createSql = `CREATE TABLE ${this.getTableName(tableName)} (\n${columns}\n)`;
        await this.pool.request().query(createSql);
      }

      const columnCheckSql = `
        SELECT 1 AS found
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName AND COLUMN_NAME = 'seq_id'
      `;
      const checkColumnRequest = this.pool.request();
      checkColumnRequest.input('schema', this.schema || 'dbo');
      checkColumnRequest.input('tableName', this.getTableName(tableName).replace(/[[\]]/g, '').split('.').pop());
      const columnResult = await checkColumnRequest.query(columnCheckSql);
      const columnExists = Array.isArray(columnResult.recordset) && columnResult.recordset.length > 0;

      if (!columnExists) {
        const alterSql = `ALTER TABLE ${this.getTableName(tableName)} ADD seq_id BIGINT IDENTITY(1,1)`;
        await this.pool.request().query(alterSql);
      }

      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const constraintName = 'mastra_workflow_snapshot_workflow_name_run_id_key';
        const checkConstraintSql = `SELECT 1 AS found FROM sys.key_constraints WHERE name = @constraintName`;
        const checkConstraintRequest = this.pool.request();
        checkConstraintRequest.input('constraintName', constraintName);
        const constraintResult = await checkConstraintRequest.query(checkConstraintSql);
        const constraintExists = Array.isArray(constraintResult.recordset) && constraintResult.recordset.length > 0;
        if (!constraintExists) {
          const addConstraintSql = `ALTER TABLE ${this.getTableName(tableName)} ADD CONSTRAINT ${constraintName} UNIQUE ([workflow_name], [run_id])`;
          await this.pool.request().query(addConstraintSql);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_CREATE_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'timestamp':
        return 'DEFAULT SYSDATETIMEOFFSET()';
      case 'jsonb':
        return "DEFAULT N'{}'";
      default:
        return super.getDefaultValue(type);
    }
  }

  async alterTable({
    tableName,
    schema,
    ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    const fullTableName = this.getTableName(tableName);
    try {
      for (const columnName of ifNotExists) {
        if (schema[columnName]) {
          const columnCheckRequest = this.pool.request();
          columnCheckRequest.input('tableName', fullTableName.replace(/[[\]]/g, '').split('.').pop());
          columnCheckRequest.input('columnName', columnName);
          columnCheckRequest.input('schema', this.schema || 'dbo');
          const checkSql = `SELECT 1 AS found FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName AND COLUMN_NAME = @columnName`;
          const checkResult = await columnCheckRequest.query(checkSql);
          const columnExists = Array.isArray(checkResult.recordset) && checkResult.recordset.length > 0;
          if (!columnExists) {
            const columnDef = schema[columnName];
            const sqlType = this.getSqlType(columnDef.type);
            const nullable = columnDef.nullable === false ? 'NOT NULL' : '';
            const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : '';
            const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
            const alterSql =
              `ALTER TABLE ${fullTableName} ADD [${parsedColumnName}] ${sqlType} ${nullable} ${defaultValue}`.trim();
            await this.pool.request().query(alterSql);
            this.logger?.debug?.(`Ensured column ${parsedColumnName} exists in table ${fullTableName}`);
          }
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_ALTER_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const fullTableName = this.getTableName(tableName);
    try {
      const fkQuery = `
        SELECT
          OBJECT_SCHEMA_NAME(fk.parent_object_id) AS schema_name,
          OBJECT_NAME(fk.parent_object_id) AS table_name
        FROM sys.foreign_keys fk
        WHERE fk.referenced_object_id = OBJECT_ID(@fullTableName)
      `;
      const fkResult = await this.pool.request().input('fullTableName', fullTableName).query(fkQuery);
      const childTables: { schema_name: string; table_name: string }[] = fkResult.recordset || [];
      for (const child of childTables) {
        const childTableName = this.schema ? `[${child.schema_name}].[${child.table_name}]` : `[${child.table_name}]`;
        await this.clearTable({ tableName: childTableName as TABLE_NAMES });
      }
      await this.pool.request().query(`TRUNCATE TABLE ${fullTableName}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
      const values = Object.values(record);
      const paramNames = values.map((_, i) => `@param${i}`);
      const insertSql = `INSERT INTO ${this.getTableName(tableName)} (${columns.map(c => `[${c}]`).join(', ')}) VALUES (${paramNames.join(', ')})`;
      const request = this.pool.request();
      values.forEach((value, i) => {
        if (value instanceof Date) {
          request.input(`param${i}`, sql.DateTime2, value);
        } else if (typeof value === 'object' && value !== null) {
          request.input(`param${i}`, JSON.stringify(value));
        } else {
          request.input(`param${i}`, value);
        }
      });

      await request.query(insertSql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const keyEntries = Object.entries(keys).map(([key, value]) => [parseSqlIdentifier(key, 'column name'), value]);
      const conditions = keyEntries.map(([key], i) => `[${key}] = @param${i}`).join(' AND ');
      const values = keyEntries.map(([_, value]) => value);
      const sql = `SELECT * FROM ${this.getTableName(tableName)} WHERE ${conditions}`;
      const request = this.pool.request();
      values.forEach((value, i) => {
        request.input(`param${i}`, value);
      });
      const resultSet = await request.query(sql);
      const result = resultSet.recordset[0] || null;
      if (!result) {
        return null;
      }
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = result as any;
        if (typeof snapshot.snapshot === 'string') {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return snapshot;
      }
      return result;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const sql = `SELECT 
        id,
        [resourceId],
        title,
        metadata,
        [createdAt],
        [updatedAt]
      FROM ${this.getTableName(TABLE_THREADS)}
      WHERE id = @threadId`;
      const request = this.pool.request();
      request.input('threadId', threadId);
      const resultSet = await request.query(sql);
      const thread = resultSet.recordset[0] || null;
      if (!thread) {
        return null;
      }
      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_THREAD_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  public async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
    } & PaginationArgs,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    const { resourceId, page = 0, perPage: perPageInput } = args;
    try {
      const perPage = perPageInput !== undefined ? perPageInput : 100;
      const currentOffset = page * perPage;
      const baseQuery = `FROM ${this.getTableName(TABLE_THREADS)} WHERE [resourceId] = @resourceId`;

      const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;
      const countRequest = this.pool.request();
      countRequest.input('resourceId', resourceId);
      const countResult = await countRequest.query(countQuery);
      const total = parseInt(countResult.recordset[0]?.count ?? '0', 10);

      if (total === 0) {
        return {
          threads: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataQuery = `SELECT id, [resourceId], title, metadata, [createdAt], [updatedAt] ${baseQuery} ORDER BY [seq_id] DESC OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;
      const dataRequest = this.pool.request();
      dataRequest.input('resourceId', resourceId);
      dataRequest.input('perPage', perPage);
      dataRequest.input('offset', currentOffset);
      const rowsResult = await dataRequest.query(dataQuery);
      const rows = rowsResult.recordset || [];
      const threads = rows.map(thread => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }));

      return {
        threads,
        total,
        page,
        perPage,
        hasMore: currentOffset + threads.length < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId,
            page,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException?.(mastraError);
      return { threads: [], total: 0, page, perPage: perPageInput || 100, hasMore: false };
    }
  }

  public async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      const table = this.getTableName(TABLE_THREADS);
      const mergeSql = `MERGE INTO ${table} WITH (HOLDLOCK) AS target
        USING (SELECT @id AS id) AS source
        ON (target.id = source.id)
        WHEN MATCHED THEN
          UPDATE SET
            [resourceId] = @resourceId,
            title = @title,
            metadata = @metadata,
            [createdAt] = @createdAt,
            [updatedAt] = @updatedAt
        WHEN NOT MATCHED THEN
          INSERT (id, [resourceId], title, metadata, [createdAt], [updatedAt])
          VALUES (@id, @resourceId, @title, @metadata, @createdAt, @updatedAt);`;
      const req = this.pool.request();
      req.input('id', thread.id);
      req.input('resourceId', thread.resourceId);
      req.input('title', thread.title);
      req.input('metadata', thread.metadata ? JSON.stringify(thread.metadata) : null);
      req.input('createdAt', thread.createdAt);
      req.input('updatedAt', thread.updatedAt);
      await req.query(mergeSql);
      return thread;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: thread.id,
          },
        },
        error,
      );
    }
  }

  /**
   * @deprecated use getThreadsByResourceIdPaginated instead
   */
  public async getThreadsByResourceId(args: { resourceId: string }): Promise<StorageThreadType[]> {
    const { resourceId } = args;
    try {
      const baseQuery = `FROM ${this.getTableName(TABLE_THREADS)} WHERE [resourceId] = @resourceId`;
      const dataQuery = `SELECT id, [resourceId], title, metadata, [createdAt], [updatedAt] ${baseQuery} ORDER BY [seq_id] DESC`;
      const request = this.pool.request();
      request.input('resourceId', resourceId);
      const resultSet = await request.query(dataQuery);
      const rows = resultSet.recordset || [];
      return rows.map(thread => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }));
    } catch (error) {
      this.logger?.error?.(`Error getting threads for resource ${resourceId}:`, error);
      return [];
    }
  }

  /**
   * Updates a thread's title and metadata, merging with existing metadata. Returns the updated thread.
   */
  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const existingThread = await this.getThreadById({ threadId: id });
    if (!existingThread) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_MSSQL_STORE_UPDATE_THREAD_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Thread ${id} not found`,
        details: {
          threadId: id,
          title,
        },
      });
    }

    const mergedMetadata = {
      ...existingThread.metadata,
      ...metadata,
    };

    try {
      const table = this.getTableName(TABLE_THREADS);
      const sql = `UPDATE ${table}
        SET title = @title,
            metadata = @metadata,
            [updatedAt] = @updatedAt
        OUTPUT INSERTED.*
        WHERE id = @id`;
      const req = this.pool.request();
      req.input('id', id);
      req.input('title', title);
      req.input('metadata', JSON.stringify(mergedMetadata));
      req.input('updatedAt', new Date().toISOString());
      const result = await req.query(sql);
      let thread = result.recordset && result.recordset[0];
      if (thread && 'seq_id' in thread) {
        const { seq_id, ...rest } = thread;
        thread = rest;
      }
      if (!thread) {
        throw new MastraError({
          id: 'MASTRA_STORAGE_MSSQL_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Thread ${id} not found after update`,
          details: {
            threadId: id,
            title,
          },
        });
      }
      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_UPDATE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: id,
            title,
          },
        },
        error,
      );
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const messagesTable = this.getTableName(TABLE_MESSAGES);
    const threadsTable = this.getTableName(TABLE_THREADS);
    const deleteMessagesSql = `DELETE FROM ${messagesTable} WHERE [thread_id] = @threadId`;
    const deleteThreadSql = `DELETE FROM ${threadsTable} WHERE id = @threadId`;
    const tx = this.pool.transaction();
    try {
      await tx.begin();
      const req = tx.request();
      req.input('threadId', threadId);
      await req.query(deleteMessagesSql);
      await req.query(deleteThreadSql);
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_DELETE_THREAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  private async _getIncludedMessages({
    threadId,
    selectBy,
    orderByStatement,
  }: {
    threadId: string;
    selectBy: StorageGetMessagesArg['selectBy'];
    orderByStatement: string;
  }) {
    const include = selectBy?.include;
    if (!include) return null;

    const unionQueries: string[] = [];
    const paramValues: any[] = [];
    let paramIdx = 1;
    const paramNames: string[] = [];

    for (const inc of include) {
      const { id, withPreviousMessages = 0, withNextMessages = 0 } = inc;
      const searchId = inc.threadId || threadId;

      const pThreadId = `@p${paramIdx}`;
      const pId = `@p${paramIdx + 1}`;
      const pPrev = `@p${paramIdx + 2}`;
      const pNext = `@p${paramIdx + 3}`;

      unionQueries.push(
        `
          SELECT
            m.id, 
            m.content, 
            m.role, 
            m.type,
            m.[createdAt], 
            m.thread_id AS threadId,
            m.[resourceId],
            m.seq_id
          FROM (
            SELECT *, ROW_NUMBER() OVER (${orderByStatement}) as row_num
            FROM ${this.getTableName(TABLE_MESSAGES)}
            WHERE [thread_id] = ${pThreadId}
          ) AS m
          WHERE m.id = ${pId}
          OR EXISTS (
            SELECT 1
            FROM (
              SELECT *, ROW_NUMBER() OVER (${orderByStatement}) as row_num
              FROM ${this.getTableName(TABLE_MESSAGES)}
              WHERE [thread_id] = ${pThreadId}
            ) AS target
            WHERE target.id = ${pId}
            AND (
              (m.row_num <= target.row_num + ${pPrev} AND m.row_num > target.row_num)
              OR
              (m.row_num >= target.row_num - ${pNext} AND m.row_num < target.row_num)
            )
          )
        `,
      );

      paramValues.push(searchId, id, withPreviousMessages, withNextMessages);
      paramNames.push(`p${paramIdx}`, `p${paramIdx + 1}`, `p${paramIdx + 2}`, `p${paramIdx + 3}`);
      paramIdx += 4;
    }

    const finalQuery = `
      SELECT * FROM (
        ${unionQueries.join(' UNION ALL ')}
      ) AS union_result
      ORDER BY [seq_id] ASC
    `;

    const req = this.pool.request();
    for (let i = 0; i < paramValues.length; ++i) {
      req.input(paramNames[i] as string, paramValues[i]);
    }

    const result = await req.query(finalQuery);
    const includedRows = result.recordset || [];

    const seen = new Set<string>();
    const dedupedRows = includedRows.filter((row: any) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    return dedupedRows;
  }

  /**
   * @deprecated use getMessagesPaginated instead
   */
  public async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  public async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  public async getMessages(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    const { threadId, format, selectBy } = args;
    const selectStatement = `SELECT seq_id, id, content, role, type, [createdAt], thread_id AS threadId`;
    const orderByStatement = `ORDER BY [seq_id] DESC`;
    const limit = this.resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
    try {
      let rows: any[] = [];
      const include = selectBy?.include || [];
      if (include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
        if (includeMessages) {
          rows.push(...includeMessages);
        }
      }
      const excludeIds = rows.map(m => m.id).filter(Boolean);

      let query = `${selectStatement} FROM ${this.getTableName(TABLE_MESSAGES)} WHERE [thread_id] = @threadId`;
      const request = this.pool.request();
      request.input('threadId', threadId);

      if (excludeIds.length > 0) {
        const excludeParams = excludeIds.map((_, idx) => `@id${idx}`);
        query += ` AND id NOT IN (${excludeParams.join(', ')})`;
        excludeIds.forEach((id, idx) => {
          request.input(`id${idx}`, id);
        });
      }

      query += ` ${orderByStatement} OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
      request.input('limit', limit);
      const result = await request.query(query);
      const remainingRows = result.recordset || [];
      rows.push(...remainingRows);
      rows.sort((a, b) => {
        const timeDiff = a.seq_id - b.seq_id;
        return timeDiff;
      });
      rows = rows.map(({ seq_id, ...rest }) => rest);
      const fetchedMessages = (rows || []).map(message => {
        if (typeof message.content === 'string') {
          try {
            message.content = JSON.parse(message.content);
          } catch {}
        }

        if (format === 'v1') {
          if (Array.isArray(message.content)) {
          } else if (typeof message.content === 'object' && message.content && Array.isArray(message.content.parts)) {
            message.content = message.content.parts;
          } else {
            message.content = [{ type: 'text', text: '' }];
          }
        } else {
          if (typeof message.content !== 'object' || !message.content || !('parts' in message.content)) {
            message.content = { format: 2, parts: [{ type: 'text', text: '' }] };
          }
        }
        if (message.type === 'v2') delete message.type;
        return message as MastraMessageV1;
      });
      return format === 'v2'
        ? fetchedMessages.map(
            m =>
              ({ ...m, content: m.content || { format: 2, parts: [{ type: 'text', text: '' }] } }) as MastraMessageV2,
          )
        : fetchedMessages;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return [];
    }
  }

  public async getMessagesPaginated(
    args: StorageGetMessagesArg & {
      format?: 'v1' | 'v2';
    },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    const { threadId, selectBy } = args;
    const { page = 0, perPage: perPageInput } = selectBy?.pagination || {};
    const orderByStatement = `ORDER BY [seq_id] DESC`;
    let messages: any[] = [];
    if (selectBy?.include?.length) {
      const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
      if (includeMessages) {
        messages.push(...includeMessages);
      }
    }
    try {
      const { threadId, format, selectBy } = args;
      const { page = 0, perPage: perPageInput, dateRange } = selectBy?.pagination || {};
      const fromDate = dateRange?.start;
      const toDate = dateRange?.end;

      const selectStatement = `SELECT seq_id, id, content, role, type, [createdAt], thread_id AS threadId`;
      const orderByStatement = `ORDER BY [seq_id] DESC`;

      let messages: any[] = [];

      if (selectBy?.include?.length) {
        const includeMessages = await this._getIncludedMessages({ threadId, selectBy, orderByStatement });
        if (includeMessages) messages.push(...includeMessages);
      }

      const perPage =
        perPageInput !== undefined
          ? perPageInput
          : this.resolveMessageLimit({ last: selectBy?.last, defaultLimit: 40 });
      const currentOffset = page * perPage;

      const conditions: string[] = ['[thread_id] = @threadId'];
      const request = this.pool.request();
      request.input('threadId', threadId);

      if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
        conditions.push('[createdAt] >= @fromDate');
        request.input('fromDate', fromDate.toISOString());
      }
      if (toDate instanceof Date && !isNaN(toDate.getTime())) {
        conditions.push('[createdAt] <= @toDate');
        request.input('toDate', toDate.toISOString());
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      const countQuery = `SELECT COUNT(*) as total FROM ${this.getTableName(TABLE_MESSAGES)} ${whereClause}`;
      const countResult = await request.query(countQuery);
      const total = parseInt(countResult.recordset[0]?.total, 10) || 0;

      if (total === 0 && messages.length > 0) {
        const parsedIncluded = this._parseAndFormatMessages(messages, format);
        return {
          messages: parsedIncluded,
          total: parsedIncluded.length,
          page,
          perPage,
          hasMore: false,
        };
      }

      const excludeIds = messages.map(m => m.id);
      if (excludeIds.length > 0) {
        const excludeParams = excludeIds.map((_, idx) => `@id${idx}`);
        conditions.push(`id NOT IN (${excludeParams.join(', ')})`);
        excludeIds.forEach((id, idx) => request.input(`id${idx}`, id));
      }

      const finalWhereClause = `WHERE ${conditions.join(' AND ')}`;
      const dataQuery = `${selectStatement} FROM ${this.getTableName(TABLE_MESSAGES)} ${finalWhereClause} ${orderByStatement} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

      request.input('offset', currentOffset);
      request.input('limit', perPage);

      const rowsResult = await request.query(dataQuery);
      const rows = rowsResult.recordset || [];
      rows.sort((a, b) => a.seq_id - b.seq_id);
      messages.push(...rows);

      const parsed = this._parseAndFormatMessages(messages, format);
      return {
        messages: parsed,
        total: total + excludeIds.length,
        page,
        perPage,
        hasMore: currentOffset + rows.length < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_MESSAGES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            page,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      return { messages: [], total: 0, page, perPage: perPageInput || 40, hasMore: false };
    }
  }

  private _parseAndFormatMessages(messages: any[], format?: 'v1' | 'v2') {
    const parsedMessages = messages.map(message => {
      let parsed = message;
      if (typeof parsed.content === 'string') {
        try {
          parsed = { ...parsed, content: JSON.parse(parsed.content) };
        } catch {}
      }

      if (format === 'v1') {
        if (Array.isArray(parsed.content)) {
        } else if (parsed.content?.parts) {
          parsed.content = parsed.content.parts;
        } else {
          parsed.content = [{ type: 'text', text: '' }];
        }
      } else {
        if (!parsed.content?.parts) {
          parsed = { ...parsed, content: { format: 2, parts: [{ type: 'text', text: '' }] } };
        }
      }

      return parsed;
    });

    const list = new MessageList().add(parsedMessages, 'memory');
    return format === 'v2' ? list.get.all.v2() : list.get.all.v1();
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages({
    messages,
    format,
  }:
    | { messages: MastraMessageV1[]; format?: undefined | 'v1' }
    | { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    if (messages.length === 0) return messages;
    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_MESSAGES_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ID is required`,
      });
    }
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_MESSAGES_FAILED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: `Thread ${threadId} not found`,
        details: { threadId },
      });
    }
    const tableMessages = this.getTableName(TABLE_MESSAGES);
    const tableThreads = this.getTableName(TABLE_THREADS);
    try {
      const transaction = this.pool.transaction();
      await transaction.begin();
      try {
        for (const message of messages) {
          if (!message.threadId) {
            throw new Error(
              `Expected to find a threadId for message, but couldn't find one. An unexpected error has occurred.`,
            );
          }
          if (!message.resourceId) {
            throw new Error(
              `Expected to find a resourceId for message, but couldn't find one. An unexpected error has occurred.`,
            );
          }
          const request = transaction.request();
          request.input('id', message.id);
          request.input('thread_id', message.threadId);
          request.input(
            'content',
            typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          );
          request.input('createdAt', message.createdAt.toISOString() || new Date().toISOString());
          request.input('role', message.role);
          request.input('type', message.type || 'v2');
          request.input('resourceId', message.resourceId);
          const mergeSql = `MERGE INTO ${tableMessages} AS target
            USING (SELECT @id AS id) AS src
            ON target.id = src.id
            WHEN MATCHED THEN UPDATE SET
              thread_id = @thread_id,
              content = @content,
              [createdAt] = @createdAt,
              role = @role,
              type = @type,
              resourceId = @resourceId
            WHEN NOT MATCHED THEN INSERT (id, thread_id, content, [createdAt], role, type, resourceId)
              VALUES (@id, @thread_id, @content, @createdAt, @role, @type, @resourceId);`;
          await request.query(mergeSql);
        }
        const threadReq = transaction.request();
        threadReq.input('updatedAt', new Date().toISOString());
        threadReq.input('id', threadId);
        await threadReq.query(`UPDATE ${tableThreads} SET [updatedAt] = @updatedAt WHERE id = @id`);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      const messagesWithParsedContent = messages.map(message => {
        if (typeof message.content === 'string') {
          try {
            return { ...message, content: JSON.parse(message.content) };
          } catch {
            return message;
          }
        }
        return message;
      });
      const list = new MessageList().add(messagesWithParsedContent, 'memory');
      if (format === 'v2') return list.get.all.v2();
      return list.get.all.v1();
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { threadId },
        },
        error,
      );
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
    const table = this.getTableName(TABLE_WORKFLOW_SNAPSHOT);
    const now = new Date().toISOString();
    try {
      const request = this.pool.request();
      request.input('workflow_name', workflowName);
      request.input('run_id', runId);
      request.input('snapshot', JSON.stringify(snapshot));
      request.input('createdAt', now);
      request.input('updatedAt', now);
      const mergeSql = `MERGE INTO ${table} AS target
        USING (SELECT @workflow_name AS workflow_name, @run_id AS run_id) AS src
        ON target.workflow_name = src.workflow_name AND target.run_id = src.run_id
        WHEN MATCHED THEN UPDATE SET
          snapshot = @snapshot,
          [updatedAt] = @updatedAt
        WHEN NOT MATCHED THEN INSERT (workflow_name, run_id, snapshot, [createdAt], [updatedAt])
          VALUES (@workflow_name, @run_id, @snapshot, @createdAt, @updatedAt);`;
      await request.query(mergeSql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_PERSIST_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
          },
        },
        error,
      );
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
      const result = await this.load({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: {
          workflow_name: workflowName,
          run_id: runId,
        },
      });
      if (!result) {
        return null;
      }
      return (result as any).snapshot;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_LOAD_WORKFLOW_SNAPSHOT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName,
            runId,
          },
        },
        error,
      );
    }
  }

  private async hasColumn(table: string, column: string): Promise<boolean> {
    const schema = this.schema || 'dbo';
    const request = this.pool.request();
    request.input('schema', schema);
    request.input('table', table);
    request.input('column', column);
    request.input('columnLower', column.toLowerCase());
    const result = await request.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table AND (COLUMN_NAME = @column OR COLUMN_NAME = @columnLower)`,
    );
    return result.recordset.length > 0;
  }

  private parseWorkflowRun(row: any): WorkflowRun {
    let parsedSnapshot: WorkflowRunState | string = row.snapshot as string;
    if (typeof parsedSnapshot === 'string') {
      try {
        parsedSnapshot = JSON.parse(row.snapshot as string) as WorkflowRunState;
      } catch (e) {
        console.warn(`Failed to parse snapshot for workflow ${row.workflow_name}: ${e}`);
      }
    }
    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      snapshot: parsedSnapshot,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resourceId: row.resourceId,
    };
  }

  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
    resourceId,
  }: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  } = {}): Promise<WorkflowRuns> {
    try {
      const conditions: string[] = [];
      const paramMap: Record<string, any> = {};

      if (workflowName) {
        conditions.push(`[workflow_name] = @workflowName`);
        paramMap['workflowName'] = workflowName;
      }

      if (resourceId) {
        const hasResourceId = await this.hasColumn(TABLE_WORKFLOW_SNAPSHOT, 'resourceId');
        if (hasResourceId) {
          conditions.push(`[resourceId] = @resourceId`);
          paramMap['resourceId'] = resourceId;
        } else {
          console.warn(`[${TABLE_WORKFLOW_SNAPSHOT}] resourceId column not found. Skipping resourceId filter.`);
        }
      }

      if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
        conditions.push(`[createdAt] >= @fromDate`);
        paramMap[`fromDate`] = fromDate.toISOString();
      }

      if (toDate instanceof Date && !isNaN(toDate.getTime())) {
        conditions.push(`[createdAt] <= @toDate`);
        paramMap[`toDate`] = toDate.toISOString();
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      let total = 0;
      const tableName = this.getTableName(TABLE_WORKFLOW_SNAPSHOT);
      const request = this.pool.request();
      Object.entries(paramMap).forEach(([key, value]) => {
        if (value instanceof Date) {
          request.input(key, sql.DateTime, value);
        } else {
          request.input(key, value);
        }
      });

      if (limit !== undefined && offset !== undefined) {
        const countQuery = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
        const countResult = await request.query(countQuery);
        total = Number(countResult.recordset[0]?.count || 0);
      }

      let query = `SELECT * FROM ${tableName} ${whereClause} ORDER BY [seq_id] DESC`;
      if (limit !== undefined && offset !== undefined) {
        query += ` OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
        request.input('limit', limit);
        request.input('offset', offset);
      }
      const result = await request.query(query);
      const runs = (result.recordset || []).map(row => this.parseWorkflowRun(row));
      return { runs, total: total || runs.length };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_WORKFLOW_RUNS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            workflowName: workflowName || 'all',
          },
        },
        error,
      );
    }
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    try {
      const conditions: string[] = [];
      const paramMap: Record<string, any> = {};

      if (runId) {
        conditions.push(`[run_id] = @runId`);
        paramMap['runId'] = runId;
      }

      if (workflowName) {
        conditions.push(`[workflow_name] = @workflowName`);
        paramMap['workflowName'] = workflowName;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const tableName = this.getTableName(TABLE_WORKFLOW_SNAPSHOT);
      const query = `SELECT * FROM ${tableName} ${whereClause}`;
      const request = this.pool.request();
      Object.entries(paramMap).forEach(([key, value]) => request.input(key, value));
      const result = await request.query(query);

      if (!result.recordset || result.recordset.length === 0) {
        return null;
      }

      return this.parseWorkflowRun(result.recordset[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_WORKFLOW_RUN_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId,
            workflowName: workflowName || '',
          },
        },
        error,
      );
    }
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraMessageV2, 'createdAt'>> & {
      id: string;
      content?: {
        metadata?: MastraMessageContentV2['metadata'];
        content?: MastraMessageContentV2['content'];
      };
    })[];
  }): Promise<MastraMessageV2[]> {
    if (!messages || messages.length === 0) {
      return [];
    }

    const messageIds = messages.map(m => m.id);
    const idParams = messageIds.map((_, i) => `@id${i}`).join(', ');
    let selectQuery = `SELECT id, content, role, type, createdAt, thread_id AS threadId, resourceId FROM ${this.getTableName(TABLE_MESSAGES)}`;
    if (idParams.length > 0) {
      selectQuery += ` WHERE id IN (${idParams})`;
    } else {
      return [];
    }
    const selectReq = this.pool.request();
    messageIds.forEach((id, i) => selectReq.input(`id${i}`, id));
    const existingMessagesDb = (await selectReq.query(selectQuery)).recordset;
    if (!existingMessagesDb || existingMessagesDb.length === 0) {
      return [];
    }

    const existingMessages: MastraMessageV2[] = existingMessagesDb.map(msg => {
      if (typeof msg.content === 'string') {
        try {
          msg.content = JSON.parse(msg.content);
        } catch {}
      }
      return msg as MastraMessageV2;
    });

    const threadIdsToUpdate = new Set<string>();
    const transaction = this.pool.transaction();

    try {
      await transaction.begin();
      for (const existingMessage of existingMessages) {
        const updatePayload = messages.find(m => m.id === existingMessage.id);
        if (!updatePayload) continue;
        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;
        threadIdsToUpdate.add(existingMessage.threadId!);
        if (updatePayload.threadId && updatePayload.threadId !== existingMessage.threadId) {
          threadIdsToUpdate.add(updatePayload.threadId);
        }
        const setClauses: string[] = [];
        const req = transaction.request();
        req.input('id', id);
        const columnMapping: Record<string, string> = { threadId: 'thread_id' };
        const updatableFields = { ...fieldsToUpdate };
        if (updatableFields.content) {
          const newContent = {
            ...existingMessage.content,
            ...updatableFields.content,
            ...(existingMessage.content?.metadata && updatableFields.content.metadata
              ? { metadata: { ...existingMessage.content.metadata, ...updatableFields.content.metadata } }
              : {}),
          };
          setClauses.push(`content = @content`);
          req.input('content', JSON.stringify(newContent));
          delete updatableFields.content;
        }
        for (const key in updatableFields) {
          if (Object.prototype.hasOwnProperty.call(updatableFields, key)) {
            const dbColumn = columnMapping[key] || key;
            setClauses.push(`[${dbColumn}] = @${dbColumn}`);
            req.input(dbColumn, updatableFields[key as keyof typeof updatableFields]);
          }
        }
        if (setClauses.length > 0) {
          const updateSql = `UPDATE ${this.getTableName(TABLE_MESSAGES)} SET ${setClauses.join(', ')} WHERE id = @id`;
          await req.query(updateSql);
        }
      }
      if (threadIdsToUpdate.size > 0) {
        const threadIdParams = Array.from(threadIdsToUpdate)
          .map((_, i) => `@tid${i}`)
          .join(', ');
        const threadReq = transaction.request();
        Array.from(threadIdsToUpdate).forEach((tid, i) => threadReq.input(`tid${i}`, tid));
        threadReq.input('updatedAt', new Date().toISOString());
        const threadSql = `UPDATE ${this.getTableName(TABLE_THREADS)} SET updatedAt = @updatedAt WHERE id IN (${threadIdParams})`;
        await threadReq.query(threadSql);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_UPDATE_MESSAGES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }

    const refetchReq = this.pool.request();
    messageIds.forEach((id, i) => refetchReq.input(`id${i}`, id));
    const updatedMessages = (await refetchReq.query(selectQuery)).recordset;
    return (updatedMessages || []).map(message => {
      if (typeof message.content === 'string') {
        try {
          message.content = JSON.parse(message.content);
        } catch {}
      }
      return message;
    });
  }

  async close() {
    if (this.pool) {
      try {
        if (this.pool.connected) {
          await this.pool.close();
        } else if (this.pool.connecting) {
          await this.pool.connect();
          await this.pool.close();
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Cannot close a pool while it is connecting')) {
        } else {
          throw err;
        }
      }
    }
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs = {},
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    const { agentName, type, page = 0, perPage = 100, dateRange } = options;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const where: string[] = [];
    const params: Record<string, any> = {};

    if (agentName) {
      where.push('agent_name = @agentName');
      params['agentName'] = agentName;
    }

    if (type === 'test') {
      where.push("test_info IS NOT NULL AND JSON_VALUE(test_info, '$.testPath') IS NOT NULL");
    } else if (type === 'live') {
      where.push("(test_info IS NULL OR JSON_VALUE(test_info, '$.testPath') IS NULL)");
    }

    if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
      where.push(`[created_at] >= @fromDate`);
      params[`fromDate`] = fromDate.toISOString();
    }

    if (toDate instanceof Date && !isNaN(toDate.getTime())) {
      where.push(`[created_at] <= @toDate`);
      params[`toDate`] = toDate.toISOString();
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const tableName = this.getTableName(TABLE_EVALS);
    const offset = page * perPage;

    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const dataQuery = `SELECT * FROM ${tableName} ${whereClause} ORDER BY seq_id DESC OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;

    try {
      const countReq = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        if (value instanceof Date) {
          countReq.input(key, sql.DateTime, value);
        } else {
          countReq.input(key, value);
        }
      });
      const countResult = await countReq.query(countQuery);
      const total = countResult.recordset[0]?.total || 0;

      if (total === 0) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const req = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        if (value instanceof Date) {
          req.input(key, sql.DateTime, value);
        } else {
          req.input(key, value);
        }
      });
      req.input('offset', offset);
      req.input('perPage', perPage);

      const result = await req.query(dataQuery);
      const rows = result.recordset;

      return {
        evals: rows?.map(row => this.transformEvalRow(row)) ?? [],
        total,
        page,
        perPage,
        hasMore: offset + (rows?.length ?? 0) < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            agentName: agentName || 'all',
            type: type || 'all',
            page,
            perPage,
          },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    const tableName = this.getTableName(TABLE_RESOURCES);
    try {
      const req = this.pool.request();
      req.input('id', resource.id);
      req.input('workingMemory', resource.workingMemory);
      req.input('metadata', JSON.stringify(resource.metadata));
      req.input('createdAt', resource.createdAt.toISOString());
      req.input('updatedAt', resource.updatedAt.toISOString());

      await req.query(
        `INSERT INTO ${tableName} (id, workingMemory, metadata, createdAt, updatedAt) VALUES (@id, @workingMemory, @metadata, @createdAt, @updatedAt)`,
      );

      return resource;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_SAVE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId: resource.id },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    try {
      const existingResource = await this.getResourceById({ resourceId });

      if (!existingResource) {
        const newResource: StorageResourceType = {
          id: resourceId,
          workingMemory,
          metadata: metadata || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return this.saveResource({ resource: newResource });
      }

      const updatedResource = {
        ...existingResource,
        workingMemory: workingMemory !== undefined ? workingMemory : existingResource.workingMemory,
        metadata: {
          ...existingResource.metadata,
          ...metadata,
        },
        updatedAt: new Date(),
      };

      const tableName = this.getTableName(TABLE_RESOURCES);
      const updates: string[] = [];
      const req = this.pool.request();

      if (workingMemory !== undefined) {
        updates.push('workingMemory = @workingMemory');
        req.input('workingMemory', workingMemory);
      }

      if (metadata) {
        updates.push('metadata = @metadata');
        req.input('metadata', JSON.stringify(updatedResource.metadata));
      }

      updates.push('updatedAt = @updatedAt');
      req.input('updatedAt', updatedResource.updatedAt.toISOString());

      req.input('id', resourceId);

      await req.query(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = @id`);

      return updatedResource;
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_UPDATE_RESOURCE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const tableName = this.getTableName(TABLE_RESOURCES);
    try {
      const req = this.pool.request();
      req.input('resourceId', resourceId);
      const result = (await req.query(`SELECT * FROM ${tableName} WHERE id = @resourceId`)).recordset[0];

      if (!result) {
        return null;
      }

      return {
        ...result,
        workingMemory:
          typeof result.workingMemory === 'object' ? JSON.stringify(result.workingMemory) : result.workingMemory,
        metadata: typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_GET_RESOURCE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resourceId },
        },
        error,
      );
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }
}
