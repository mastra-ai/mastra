import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { IndexManagementBase } from '@mastra/core/storage';
import type { TABLE_NAMES, CreateIndexOptions, IndexInfo, StorageIndexStats } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type sql from 'mssql';
import { getSchemaName, getTableName } from '../utils';

// Re-export the types for convenience
export type { CreateIndexOptions, IndexInfo, StorageIndexStats };

export class IndexManagementMSSQL extends IndexManagementBase {
  public pool: sql.ConnectionPool;
  public schemaName?: string;

  constructor({ pool, schemaName }: { pool: sql.ConnectionPool; schemaName?: string }) {
    super();
    this.pool = pool;
    this.schemaName = schemaName;
  }

  /**
   * Create a new index on a table
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    try {
      const { name, table, columns, unique = false, where } = options;

      const schemaName = this.schemaName || 'dbo';
      const fullTableName = getTableName({
        indexName: table as TABLE_NAMES,
        schemaName: getSchemaName(this.schemaName),
      });

      // Check if index already exists
      const indexNameSafe = parseSqlIdentifier(name, 'index name');
      const checkRequest = this.pool.request();
      checkRequest.input('indexName', indexNameSafe);
      checkRequest.input('schemaName', schemaName);
      checkRequest.input('tableName', table);

      const indexExists = await checkRequest.query(`
        SELECT 1 as found
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE i.name = @indexName
          AND s.name = @schemaName
          AND t.name = @tableName
      `);

      if (indexExists.recordset && indexExists.recordset.length > 0) {
        // Index already exists, skip creation
        return;
      }

      // Build index creation SQL
      const uniqueStr = unique ? 'UNIQUE ' : '';
      const columnsStr = columns
        .map((col: string) => {
          // Handle columns with DESC/ASC modifiers
          if (col.includes(' DESC') || col.includes(' ASC')) {
            const [colName, ...modifiers] = col.split(' ');
            if (!colName) {
              throw new Error(`Invalid column specification: ${col}`);
            }
            return `[${parseSqlIdentifier(colName, 'column name')}] ${modifiers.join(' ')}`;
          }
          return `[${parseSqlIdentifier(col, 'column name')}]`;
        })
        .join(', ');

      const whereStr = where ? ` WHERE ${where}` : '';

      const createIndexSql = `CREATE ${uniqueStr}INDEX [${indexNameSafe}] ON ${fullTableName} (${columnsStr})${whereStr}`;

      await this.pool.request().query(createIndexSql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_INDEX_CREATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName: options.name,
            tableName: options.table,
          },
        },
        error,
      );
    }
  }

  /**
   * Drop an existing index
   */
  async dropIndex(indexName: string): Promise<void> {
    try {
      const schemaName = this.schemaName || 'dbo';
      const indexNameSafe = parseSqlIdentifier(indexName, 'index name');

      // Check if index exists first
      const checkRequest = this.pool.request();
      checkRequest.input('indexName', indexNameSafe);
      checkRequest.input('schemaName', schemaName);

      const result = await checkRequest.query(`
        SELECT t.name as table_name
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE i.name = @indexName
          AND s.name = @schemaName
      `);

      if (!result.recordset || result.recordset.length === 0) {
        // Index doesn't exist, nothing to drop
        return;
      }

      // In MSSQL, index names are unique per table, not per schema
      // If multiple tables have the same index name, throw an error
      if (result.recordset.length > 1) {
        const tables = result.recordset.map((r: any) => r.table_name).join(', ');
        throw new MastraError({
          id: 'MASTRA_STORAGE_MSSQL_INDEX_AMBIGUOUS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Index "${indexNameSafe}" exists on multiple tables (${tables}) in schema "${schemaName}". Please drop indexes manually or ensure unique index names.`,
        });
      }

      const tableName = result.recordset[0].table_name;
      const fullTableName = getTableName({
        indexName: tableName,
        schemaName: getSchemaName(this.schemaName),
      });

      const dropSql = `DROP INDEX [${indexNameSafe}] ON ${fullTableName}`;
      await this.pool.request().query(dropSql);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_INDEX_DROP_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  /**
   * List indexes for a specific table or all tables
   */
  async listIndexes(tableName?: string): Promise<IndexInfo[]> {
    try {
      const schemaName = this.schemaName || 'dbo';

      let query: string;
      const request = this.pool.request();
      request.input('schemaName', schemaName);

      if (tableName) {
        query = `
          SELECT 
            i.name as name,
            o.name as [table],
            i.is_unique as is_unique,
            CAST(SUM(s.used_page_count) * 8 / 1024.0 AS VARCHAR(50)) + ' MB' as size
          FROM sys.indexes i
          INNER JOIN sys.objects o ON i.object_id = o.object_id
          INNER JOIN sys.schemas sch ON o.schema_id = sch.schema_id
          LEFT JOIN sys.dm_db_partition_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
          WHERE sch.name = @schemaName
          AND o.name = @tableName
          AND i.name IS NOT NULL
          GROUP BY i.name, o.name, i.is_unique
        `;
        request.input('tableName', tableName);
      } else {
        query = `
          SELECT 
            i.name as name,
            o.name as [table],
            i.is_unique as is_unique,
            CAST(SUM(s.used_page_count) * 8 / 1024.0 AS VARCHAR(50)) + ' MB' as size
          FROM sys.indexes i
          INNER JOIN sys.objects o ON i.object_id = o.object_id
          INNER JOIN sys.schemas sch ON o.schema_id = sch.schema_id
          LEFT JOIN sys.dm_db_partition_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
          WHERE sch.name = @schemaName
          AND i.name IS NOT NULL
          GROUP BY i.name, o.name, i.is_unique
        `;
      }

      const result = await request.query(query);

      // For each index, get its columns
      const indexes: IndexInfo[] = [];
      for (const row of result.recordset) {
        const colRequest = this.pool.request();
        colRequest.input('indexName', row.name);
        colRequest.input('schemaName', schemaName);

        const colResult = await colRequest.query(`
          SELECT c.name as column_name
          FROM sys.indexes i
          INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          INNER JOIN sys.objects o ON i.object_id = o.object_id
          INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
          WHERE i.name = @indexName
          AND s.name = @schemaName
          ORDER BY ic.key_ordinal
        `);

        indexes.push({
          name: row.name,
          table: row.table,
          columns: colResult.recordset.map((c: any) => c.column_name),
          unique: row.is_unique || false,
          size: row.size || '0 MB',
          definition: '', // MSSQL doesn't store definition like PG
        });
      }

      return indexes;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_INDEX_LIST_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: tableName
            ? {
                tableName,
              }
            : {},
        },
        error,
      );
    }
  }

  /**
   * Get detailed statistics for a specific index
   */
  async describeIndex(indexName: string): Promise<StorageIndexStats> {
    try {
      const schemaName = this.schemaName || 'dbo';

      const request = this.pool.request();
      request.input('indexName', indexName);
      request.input('schemaName', schemaName);

      const query = `
        SELECT 
          i.name as name,
          o.name as [table],
          i.is_unique as is_unique,
          CAST(SUM(s.used_page_count) * 8 / 1024.0 AS VARCHAR(50)) + ' MB' as size,
          i.type_desc as method,
          ISNULL(us.user_scans, 0) as scans,
          ISNULL(us.user_seeks + us.user_scans, 0) as tuples_read,
          ISNULL(us.user_lookups, 0) as tuples_fetched
        FROM sys.indexes i
        INNER JOIN sys.objects o ON i.object_id = o.object_id
        INNER JOIN sys.schemas sch ON o.schema_id = sch.schema_id
        LEFT JOIN sys.dm_db_partition_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
        LEFT JOIN sys.dm_db_index_usage_stats us ON i.object_id = us.object_id AND i.index_id = us.index_id
        WHERE i.name = @indexName
        AND sch.name = @schemaName
        GROUP BY i.name, o.name, i.is_unique, i.type_desc, us.user_seeks, us.user_scans, us.user_lookups
      `;

      const result = await request.query(query);

      if (!result.recordset || result.recordset.length === 0) {
        throw new Error(`Index "${indexName}" not found in schema "${schemaName}"`);
      }

      const row = result.recordset[0];

      // Get columns for this index
      const colRequest = this.pool.request();
      colRequest.input('indexName', indexName);
      colRequest.input('schemaName', schemaName);

      const colResult = await colRequest.query(`
        SELECT c.name as column_name
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        INNER JOIN sys.objects o ON i.object_id = o.object_id
        INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE i.name = @indexName
        AND s.name = @schemaName
        ORDER BY ic.key_ordinal
      `);

      return {
        name: row.name,
        table: row.table,
        columns: colResult.recordset.map((c: any) => c.column_name),
        unique: row.is_unique || false,
        size: row.size || '0 MB',
        definition: '',
        method: row.method?.toLowerCase() || 'nonclustered',
        scans: Number(row.scans) || 0,
        tuples_read: Number(row.tuples_read) || 0,
        tuples_fetched: Number(row.tuples_fetched) || 0,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_INDEX_DESCRIBE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }
}
