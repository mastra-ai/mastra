import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { StoreOperations, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import sql from 'mssql';
import { getSchemaName, getTableName } from '../utils';

export class StoreOperationsMSSQL extends StoreOperations {
  public pool: sql.ConnectionPool;
  public schemaName?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;

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
      case 'float':
        return 'FLOAT';
      default:
        throw new MastraError({
          id: 'MASTRA_STORAGE_MSSQL_STORE_TYPE_NOT_SUPPORTED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        });
    }
  }

  constructor({ pool, schemaName }: { pool: sql.ConnectionPool; schemaName?: string }) {
    super();
    this.pool = pool;
    this.schemaName = schemaName;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const schema = this.schemaName || 'dbo';
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

  private async setupSchema() {
    if (!this.schemaName || this.schemaSetupComplete) {
      return;
    }

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          const checkRequest = this.pool.request();
          checkRequest.input('schemaName', this.schemaName);
          const checkResult = await checkRequest.query(`
            SELECT 1 AS found FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = @schemaName
          `);
          const schemaExists = Array.isArray(checkResult.recordset) && checkResult.recordset.length > 0;

          if (!schemaExists) {
            try {
              await this.pool.request().query(`CREATE SCHEMA [${this.schemaName}]`);
              this.logger?.info?.(`Schema "${this.schemaName}" created successfully`);
            } catch (error) {
              this.logger?.error?.(`Failed to create schema "${this.schemaName}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schemaName}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          this.schemaSetupComplete = true;
          this.logger?.debug?.(`Schema "${this.schemaName}" is ready for use`);
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

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
      const values = Object.values(record);
      const paramNames = values.map((_, i) => `@param${i}`);
      const insertSql = `INSERT INTO ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (${columns.map(c => `[${c}]`).join(', ')}) VALUES (${paramNames.join(', ')})`;
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

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
    try {
      // First try TRUNCATE for better performance
      try {
        await this.pool.request().query(`TRUNCATE TABLE ${fullTableName}`);
      } catch (truncateError: any) {
        // If TRUNCATE fails due to foreign key constraints, fall back to DELETE
        if (truncateError.message && truncateError.message.includes('foreign key')) {
          await this.pool.request().query(`DELETE FROM ${fullTableName}`);
        } else {
          throw truncateError;
        }
      }
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

      if (this.schemaName) {
        await this.setupSchema();
      }

      const checkTableRequest = this.pool.request();
      checkTableRequest.input(
        'tableName',
        getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })
          .replace(/[[\]]/g, '')
          .split('.')
          .pop(),
      );
      const checkTableSql = `SELECT 1 AS found FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName`;
      checkTableRequest.input('schema', this.schemaName || 'dbo');
      const checkTableResult = await checkTableRequest.query(checkTableSql);
      const tableExists = Array.isArray(checkTableResult.recordset) && checkTableResult.recordset.length > 0;

      if (!tableExists) {
        const createSql = `CREATE TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (\n${columns}\n)`;
        await this.pool.request().query(createSql);
      }

      const columnCheckSql = `
        SELECT 1 AS found
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName AND COLUMN_NAME = 'seq_id'
      `;
      const checkColumnRequest = this.pool.request();
      checkColumnRequest.input('schema', this.schemaName || 'dbo');
      checkColumnRequest.input(
        'tableName',
        getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })
          .replace(/[[\]]/g, '')
          .split('.')
          .pop(),
      );
      const columnResult = await checkColumnRequest.query(columnCheckSql);
      const columnExists = Array.isArray(columnResult.recordset) && columnResult.recordset.length > 0;

      if (!columnExists) {
        const alterSql = `ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} ADD seq_id BIGINT IDENTITY(1,1)`;
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
          const addConstraintSql = `ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} ADD CONSTRAINT ${constraintName} UNIQUE ([workflow_name], [run_id])`;
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
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    const fullTableName = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
    try {
      for (const columnName of ifNotExists) {
        if (schema[columnName]) {
          const columnCheckRequest = this.pool.request();
          columnCheckRequest.input('tableName', fullTableName.replace(/[[\]]/g, '').split('.').pop());
          columnCheckRequest.input('columnName', columnName);
          columnCheckRequest.input('schema', this.schemaName || 'dbo');
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

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const keyEntries = Object.entries(keys).map(([key, value]) => [parseSqlIdentifier(key, 'column name'), value]);
      const conditions = keyEntries.map(([key], i) => `[${key}] = @param${i}`).join(' AND ');
      const values = keyEntries.map(([_, value]) => value);
      const sql = `SELECT * FROM ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} WHERE ${conditions}`;
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

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) });
      await this.pool.request().query(`DROP TABLE IF EXISTS ${tableNameWithSchema}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_DROP_TABLE_FAILED',
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
}
