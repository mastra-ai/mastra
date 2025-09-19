import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { StoreOperations, TABLE_WORKFLOW_SNAPSHOT, TABLE_EVALS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import type { ClickhouseConfig } from '../utils';
import { COLUMN_TYPES, TABLE_ENGINES, transformRow } from '../utils';

export class StoreOperationsClickhouse extends StoreOperations {
  protected ttl: ClickhouseConfig['ttl'];
  protected client: ClickHouseClient;
  constructor({ client, ttl }: { client: ClickHouseClient; ttl: ClickhouseConfig['ttl'] }) {
    super();
    this.ttl = ttl;
    this.client = client;
  }

  async hasColumn(table: string, column: string): Promise<boolean> {
    const result = await this.client.query({
      query: `DESCRIBE TABLE ${table}`,
      format: 'JSONEachRow',
    });
    const columns = (await result.json()) as { name: string }[];
    return columns.some(c => c.name === column);
  }

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return 'String';
      case 'timestamp':
        return 'DateTime64(3)';
      case 'integer':
      case 'bigint':
        return 'Int64';
      case 'jsonb':
        return 'String';
      default:
        return super.getSqlType(type); // fallback to base implementation
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
      const columns = Object.entries(schema)
        .map(([name, def]) => {
          const constraints = [];
          if (!def.nullable) constraints.push('NOT NULL');
          const columnTtl = this.ttl?.[tableName]?.columns?.[name];
          return `"${name}" ${COLUMN_TYPES[def.type]} ${constraints.join(' ')} ${columnTtl ? `TTL toDateTime(${columnTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${columnTtl.interval} ${columnTtl.unit}` : ''}`;
        })
        .join(',\n');

      const rowTtl = this.ttl?.[tableName]?.row;
      const sql =
        tableName === TABLE_WORKFLOW_SNAPSHOT
          ? `
            CREATE TABLE IF NOT EXISTS ${tableName} (
              ${['id String'].concat(columns)}
            )
            ENGINE = ${TABLE_ENGINES[tableName] ?? 'MergeTree()'}
            PRIMARY KEY (createdAt, run_id, workflow_name)
            ORDER BY (createdAt, run_id, workflow_name)
            ${rowTtl ? `TTL toDateTime(${rowTtl.ttlKey ?? 'createdAt'}) + INTERVAL ${rowTtl.interval} ${rowTtl.unit}` : ''}
            SETTINGS index_granularity = 8192
              `
          : `
            CREATE TABLE IF NOT EXISTS ${tableName} (
              ${columns}
            )
            ENGINE = ${TABLE_ENGINES[tableName] ?? 'MergeTree()'}
            PRIMARY KEY (createdAt, ${tableName === TABLE_EVALS ? 'run_id' : 'id'})
            ORDER BY (createdAt, ${tableName === TABLE_EVALS ? 'run_id' : 'id'})
            ${this.ttl?.[tableName]?.row ? `TTL toDateTime(createdAt) + INTERVAL ${this.ttl[tableName].row.interval} ${this.ttl[tableName].row.unit}` : ''}
            SETTINGS index_granularity = 8192
          `;

      await this.client.query({
        query: sql,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_CREATE_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
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
    try {
      // 1. Get existing columns
      const describeSql = `DESCRIBE TABLE ${tableName}`;
      const result = await this.client.query({
        query: describeSql,
      });
      const rows = await result.json();
      const existingColumnNames = new Set(rows.data.map((row: any) => row.name.toLowerCase()));

      // 2. Add missing columns
      for (const columnName of ifNotExists) {
        if (!existingColumnNames.has(columnName.toLowerCase()) && schema[columnName]) {
          const columnDef = schema[columnName];
          let sqlType = this.getSqlType(columnDef.type);
          if (columnDef.nullable !== false) {
            sqlType = `Nullable(${sqlType})`;
          }
          const defaultValue = columnDef.nullable === false ? this.getDefaultValue(columnDef.type) : '';
          // Use backticks or double quotes as needed for identifiers
          const alterSql =
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${columnName}" ${sqlType} ${defaultValue}`.trim();

          await this.client.query({
            query: alterSql,
          });
          this.logger?.debug?.(`Added column ${columnName} to table ${tableName}`);
        }
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_ALTER_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.client.query({
        query: `TRUNCATE TABLE ${tableName}`,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_CLEAR_TABLE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.client.query({
      query: `DROP TABLE IF EXISTS ${tableName}`,
    });
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const createdAt = (record.createdAt || record.created_at || new Date()).toISOString();
    const updatedAt = (record.updatedAt || new Date()).toISOString();

    try {
      const result = await this.client.insert({
        table: tableName,
        values: [
          {
            ...record,
            createdAt,
            updatedAt,
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          output_format_json_quote_64bit_integers: 0,
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
        },
      });
      console.info('INSERT RESULT', result);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const recordsToBeInserted = records.map(record => ({
      ...Object.fromEntries(
        Object.entries(record).map(([key, value]) => [
          key,
          TABLE_SCHEMAS[tableName as TABLE_NAMES]?.[key]?.type === 'timestamp' ? new Date(value).toISOString() : value,
        ]),
      ),
    }));

    try {
      await this.client.insert({
        table: tableName,
        values: recordsToBeInserted,
        format: 'JSONEachRow',
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_BATCH_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const engine = TABLE_ENGINES[tableName] ?? 'MergeTree()';
      const keyEntries = Object.entries(keys);
      const conditions = keyEntries
        .map(
          ([key]) =>
            `"${key}" = {var_${key}:${COLUMN_TYPES[TABLE_SCHEMAS[tableName as TABLE_NAMES]?.[key]?.type ?? 'text']}}`,
        )
        .join(' AND ');
      const values = keyEntries.reduce((acc, [key, value]) => {
        return { ...acc, [`var_${key}`]: value };
      }, {});

      const hasUpdatedAt = TABLE_SCHEMAS[tableName as TABLE_NAMES]?.updatedAt;

      const selectClause = `SELECT *, toDateTime64(createdAt, 3) as createdAt${hasUpdatedAt ? ', toDateTime64(updatedAt, 3) as updatedAt' : ''}`;

      const result = await this.client.query({
        query: `${selectClause} FROM ${tableName} ${engine.startsWith('ReplacingMergeTree') ? 'FINAL' : ''} WHERE ${conditions} ORDER BY createdAt DESC LIMIT 1`,
        query_params: values,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      if (!result) {
        return null;
      }

      const rows = await result.json();
      // If this is a workflow snapshot, parse the snapshot field
      if (tableName === TABLE_WORKFLOW_SNAPSHOT) {
        const snapshot = rows.data[0] as any;
        if (!snapshot) {
          return null;
        }
        if (typeof snapshot.snapshot === 'string') {
          snapshot.snapshot = JSON.parse(snapshot.snapshot);
        }
        return transformRow(snapshot);
      }

      const data: R = transformRow(rows.data[0]);
      return data;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_LOAD_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }
}
