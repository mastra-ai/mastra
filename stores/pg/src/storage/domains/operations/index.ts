import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { StoreOperations, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { IDatabase } from 'pg-promise';
import { getSchemaName, getTableName } from '../utils';

export class StoreOperationsPG extends StoreOperations {
  public client: IDatabase<{}>;
  public schemaName?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;

  constructor({ client, schemaName }: { client: IDatabase<{}>; schemaName?: string }) {
    super();
    this.client = client;
    this.schemaName = schemaName;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    // Use this.schema to scope the check
    const schema = this.schemaName || 'public';

    const result = await this.client.oneOrNone(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND (column_name = $3 OR column_name = $4)`,
      [schema, table, column, column.toLowerCase()],
    );

    return !!result;
  }

  private async setupSchema() {
    if (!this.schemaName || this.schemaSetupComplete) {
      return;
    }

    const schemaName = getSchemaName(this.schemaName);

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          // First check if schema exists and we have usage permission
          const schemaExists = await this.client.oneOrNone(
            `
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.schemata
                  WHERE schema_name = $1
                )
              `,
            [this.schemaName],
          );

          if (!schemaExists?.exists) {
            try {
              await this.client.none(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
              this.logger.info(`Schema "${this.schemaName}" created successfully`);
            } catch (error) {
              this.logger.error(`Failed to create schema "${this.schemaName}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schemaName}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          // If we got here, schema exists and we can use it
          this.schemaSetupComplete = true;
          this.logger.debug(`Schema "${schemaName}" is ready for use`);
        } catch (error) {
          // Reset flags so we can retry
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
      if (record.createdAt) {
        record.createdAtZ = record.createdAt;
      }

      if (record.created_at) {
        record.created_atZ = record.created_at;
      }

      if (record.updatedAt) {
        record.updatedAtZ = record.updatedAt;
      }

      const schemaName = getSchemaName(this.schemaName);
      const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
      const values = Object.values(record);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      await this.client.none(
        `INSERT INTO ${getTableName({ indexName: tableName, schemaName })} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
        values,
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_INSERT_FAILED',
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
    try {
      const schemaName = getSchemaName(this.schemaName);
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName });
      await this.client.none(`TRUNCATE TABLE ${tableNameWithSchema} CASCADE`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_CLEAR_TABLE_FAILED',
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
        return 'DEFAULT NOW()';
      case 'jsonb':
        return "DEFAULT '{}'::jsonb";
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
      const timeZColumnNames = Object.entries(schema)
        .filter(([_, def]) => def.type === 'timestamp')
        .map(([name]) => name);

      const timeZColumns = Object.entries(schema)
        .filter(([_, def]) => def.type === 'timestamp')
        .map(([name]) => {
          const parsedName = parseSqlIdentifier(name, 'column name');
          return `"${parsedName}Z" TIMESTAMPTZ DEFAULT NOW()`;
        });

      const columns = Object.entries(schema).map(([name, def]) => {
        const parsedName = parseSqlIdentifier(name, 'column name');
        const constraints = [];
        if (def.primaryKey) constraints.push('PRIMARY KEY');
        if (!def.nullable) constraints.push('NOT NULL');
        return `"${parsedName}" ${def.type.toUpperCase()} ${constraints.join(' ')}`;
      });

      // Create schema if it doesn't exist
      if (this.schemaName) {
        await this.setupSchema();
      }

      const finalColumns = [...columns, ...timeZColumns].join(',\n');

      // Constraints are global to a database, ensure schemas do not conflict with each other
      const constraintPrefix = this.schemaName ? `${this.schemaName}_` : '';
      const sql = `
            CREATE TABLE IF NOT EXISTS ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} (
              ${finalColumns}
            );
            ${
              tableName === TABLE_WORKFLOW_SNAPSHOT
                ? `
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = '${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key'
              ) THEN
                ALTER TABLE ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })}
                ADD CONSTRAINT ${constraintPrefix}mastra_workflow_snapshot_workflow_name_run_id_key
                UNIQUE (workflow_name, run_id);
              END IF;
            END $$;
            `
                : ''
            }
          `;

      await this.client.none(sql);

      await this.alterTable({
        tableName,
        schema,
        ifNotExists: timeZColumnNames,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_CREATE_TABLE_FAILED',
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
          const columnDef = schema[columnName];
          const sqlType = this.getSqlType(columnDef.type);
          const nullable = columnDef.nullable === false ? 'NOT NULL' : '';
          const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : '';
          const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
          const alterSql =
            `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}" ${sqlType} ${nullable} ${defaultValue}`.trim();

          await this.client.none(alterSql);

          if (sqlType === 'TIMESTAMP') {
            const alterSql =
              `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS "${parsedColumnName}Z" TIMESTAMPTZ DEFAULT NOW()`.trim();
            await this.client.none(alterSql);
          }

          this.logger?.debug?.(`Ensured column ${parsedColumnName} exists in table ${fullTableName}`);
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_ALTER_TABLE_FAILED',
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
      const conditions = keyEntries.map(([key], index) => `"${key}" = $${index + 1}`).join(' AND ');
      const values = keyEntries.map(([_, value]) => value);

      const result = await this.client.oneOrNone<R>(
        `SELECT * FROM ${getTableName({ indexName: tableName, schemaName: getSchemaName(this.schemaName) })} WHERE ${conditions}`,
        values,
      );

      if (!result) {
        return null;
      }

      // If this is a workflow snapshot, parse the snapshot field
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
          id: 'MASTRA_STORAGE_PG_STORE_LOAD_FAILED',
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
    try {
      await this.client.query('BEGIN');
      for (const record of records) {
        await this.insert({ tableName, record });
      }
      await this.client.query('COMMIT');
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_BATCH_INSERT_FAILED',
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
      const schemaName = getSchemaName(this.schemaName);
      const tableNameWithSchema = getTableName({ indexName: tableName, schemaName });
      await this.client.none(`DROP TABLE IF EXISTS ${tableNameWithSchema}`);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_DROP_TABLE_FAILED',
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
