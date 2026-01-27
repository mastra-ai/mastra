import { parseSqlIdentifier } from '@mastra/core/utils';

/**
 * Type definition for SQL query parameters
 */
export type SqlParam = string | number | boolean | null | undefined;

/**
 * Interface for SQL query options with generic type support
 */
export interface SqlQueryOptions {
  /** SQL query to execute */
  sql: string;
  /** Parameters to bind to the query */
  params?: SqlParam[];
  /** Whether to return only the first result */
  first?: boolean;
}

/**
 * SQL Builder class for constructing type-safe SQL queries
 * This helps create maintainable and secure SQL queries with proper parameter handling
 */
export class SqlBuilder {
  private sql: string = '';
  private params: SqlParam[] = [];
  private whereAdded: boolean = false;

  // Basic query building
  select(columns?: string | string[]): SqlBuilder {
    if (!columns || (Array.isArray(columns) && columns.length === 0)) {
      this.sql = 'SELECT *';
    } else {
      const cols = Array.isArray(columns) ? columns : [columns];
      const parsedCols = cols.map(col => parseSelectIdentifier(col));
      this.sql = `SELECT ${parsedCols.join(', ')}`;
    }
    return this;
  }

  from(table: string): SqlBuilder {
    const parsedTableName = parseSqlIdentifier(table, 'table name');
    this.sql += ` FROM ${parsedTableName}`;
    return this;
  }

  /**
   * Add a WHERE clause to the query
   * @param condition The condition to add
   * @param params Parameters to bind to the condition
   */
  where(condition: string, ...params: SqlParam[]): SqlBuilder {
    this.sql += ` WHERE ${condition}`;
    this.params.push(...params);
    this.whereAdded = true;
    return this;
  }

  /**
   * Add a WHERE clause if it hasn't been added yet, otherwise add an AND clause
   * @param condition The condition to add
   * @param params Parameters to bind to the condition
   */
  whereAnd(condition: string, ...params: SqlParam[]): SqlBuilder {
    if (this.whereAdded) {
      return this.andWhere(condition, ...params);
    } else {
      return this.where(condition, ...params);
    }
  }

  andWhere(condition: string, ...params: SqlParam[]): SqlBuilder {
    this.sql += ` AND ${condition}`;
    this.params.push(...params);
    return this;
  }

  orWhere(condition: string, ...params: SqlParam[]): SqlBuilder {
    this.sql += ` OR ${condition}`;
    this.params.push(...params);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): SqlBuilder {
    const parsedColumn = parseSqlIdentifier(column, 'column name');
    if (!['ASC', 'DESC'].includes(direction)) {
      throw new Error(`Invalid sort direction: ${direction}`);
    }
    this.sql += ` ORDER BY ${parsedColumn} ${direction}`;
    return this;
  }

  limit(count: number): SqlBuilder {
    this.sql += ` LIMIT ?`;
    this.params.push(count);
    return this;
  }

  offset(count: number): SqlBuilder {
    this.sql += ` OFFSET ?`;
    this.params.push(count);
    return this;
  }

  count(): SqlBuilder {
    this.sql += 'SELECT COUNT(*) AS count';
    return this;
  }

  /**
   * Insert a row, or update specific columns on conflict (upsert).
   * @param table Table name
   * @param columns Columns to insert
   * @param values Values to insert
   * @param conflictColumns Columns to check for conflict (usually PK or UNIQUE)
   * @param updateMap Object mapping columns to update to their new value (e.g. { name: 'excluded.name' })
   */
  insert(
    table: string,
    columns: string[],
    values: SqlParam[],
    conflictColumns?: string[],
    updateMap?: Record<string, string>,
  ): SqlBuilder {
    const parsedTableName = parseSqlIdentifier(table, 'table name');
    const parsedColumns = columns.map(col => parseSqlIdentifier(col, 'column name'));
    const placeholders = parsedColumns.map(() => '?').join(', ');

    if (conflictColumns && updateMap) {
      const parsedConflictColumns = conflictColumns.map(col => parseSqlIdentifier(col, 'column name'));
      const updateClause = Object.entries(updateMap)
        .map(([col, expr]) => `${col} = ${expr}`)
        .join(', ');
      this.sql = `INSERT INTO ${parsedTableName} (${parsedColumns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(${parsedConflictColumns.join(', ')}) DO UPDATE SET ${updateClause}`;
      this.params.push(...values);
      return this;
    }

    this.sql = `INSERT INTO ${parsedTableName} (${parsedColumns.join(', ')}) VALUES (${placeholders})`;
    this.params.push(...values);

    return this;
  }

  // Update operations
  update(table: string, columns: string[], values: SqlParam[]): SqlBuilder {
    const parsedTableName = parseSqlIdentifier(table, 'table name');
    const parsedColumns = columns.map(col => parseSqlIdentifier(col, 'column name'));
    const setClause = parsedColumns.map(col => `${col} = ?`).join(', ');
    this.sql = `UPDATE ${parsedTableName} SET ${setClause}`;
    this.params.push(...values);
    return this;
  }

  // Delete operations
  delete(table: string): SqlBuilder {
    const parsedTableName = parseSqlIdentifier(table, 'table name');
    this.sql = `DELETE FROM ${parsedTableName}`;
    return this;
  }

  /**
   * Create a table if it doesn't exist
   * @param table The table name
   * @param columnDefinitions The column definitions as an array of strings
   * @param tableConstraints Optional constraints for the table
   * @returns The builder instance
   */
  createTable(table: string, columnDefinitions: string[], tableConstraints?: string[]): SqlBuilder {
    const parsedTableName = parseSqlIdentifier(table, 'table name');
    // Naive validation: check the first word of each column definition
    const parsedColumnDefinitions = columnDefinitions.map(def => {
      const colName = def.split(/\s+/)[0];
      if (!colName) throw new Error('Empty column name in definition');
      parseSqlIdentifier(colName, 'column name');
      return def;
    });
    const columns = parsedColumnDefinitions.join(', ');
    const constraints = tableConstraints && tableConstraints.length > 0 ? ', ' + tableConstraints.join(', ') : '';
    this.sql = `CREATE TABLE IF NOT EXISTS ${parsedTableName} (${columns}${constraints})`;
    return this;
  }

  /**
   * Check if an index exists in the database
   * @param indexName The name of the index to check
   * @param tableName The table the index is on
   * @returns The builder instance
   */
  checkIndexExists(indexName: string, tableName: string): SqlBuilder {
    this.sql = `SELECT name FROM sqlite_master WHERE type='index' AND name=? AND tbl_name=?`;
    this.params.push(indexName, tableName);
    return this;
  }

  /**
   * Create an index if it doesn't exist
   * @param indexName The name of the index to create
   * @param tableName The table to create the index on
   * @param columnName The column to index
   * @param indexType Optional index type (e.g., 'UNIQUE')
   * @returns The builder instance
   */
  createIndex(indexName: string, tableName: string, columnName: string, indexType: string = ''): SqlBuilder {
    const parsedIndexName = parseSqlIdentifier(indexName, 'index name');
    const parsedTableName = parseSqlIdentifier(tableName, 'table name');
    const parsedColumnName = parseSqlIdentifier(columnName, 'column name');
    this.sql = `CREATE ${indexType ? indexType + ' ' : ''}INDEX IF NOT EXISTS ${parsedIndexName} ON ${parsedTableName}(${parsedColumnName})`;
    return this;
  }

  /**
   * Add a LIKE condition to the query
   * @param column The column to check
   * @param value The value to match (will be wrapped with % for LIKE)
   * @param exact If true, will not add % wildcards
   */
  like(column: string, value: string, exact: boolean = false): SqlBuilder {
    const parsedColumnName = parseSqlIdentifier(column, 'column name');
    const likeValue = exact ? value : `%${value}%`;
    if (this.whereAdded) {
      this.sql += ` AND ${parsedColumnName} LIKE ?`;
    } else {
      this.sql += ` WHERE ${parsedColumnName} LIKE ?`;
      this.whereAdded = true;
    }
    this.params.push(likeValue);
    return this;
  }

  /**
   * Add a JSON LIKE condition for searching in JSON fields
   * @param column The JSON column to search in
   * @param key The JSON key to match
   * @param value The value to match
   */
  jsonLike(column: string, key: string, value: string): SqlBuilder {
    const parsedColumnName = parseSqlIdentifier(column, 'column name');
    const parsedKey = parseSqlIdentifier(key, 'key name');
    const jsonPattern = `%"${parsedKey}":"${value}"%`;
    if (this.whereAdded) {
      this.sql += ` AND ${parsedColumnName} LIKE ?`;
    } else {
      this.sql += ` WHERE ${parsedColumnName} LIKE ?`;
      this.whereAdded = true;
    }
    this.params.push(jsonPattern);
    return this;
  }

  /**
   * Get the built query
   * @returns Object containing the SQL string and parameters array
   */
  build(): { sql: string; params: SqlParam[] } {
    return {
      sql: this.sql,
      params: this.params,
    };
  }

  /**
   * Reset the builder for reuse
   * @returns The reset builder instance
   */
  reset(): SqlBuilder {
    this.sql = '';
    this.params = [];
    this.whereAdded = false;
    return this;
  }
}

// Factory function for easier creation
export function createSqlBuilder(): SqlBuilder {
  return new SqlBuilder();
}

/** Represents a validated SQL SELECT column identifier (or '*', optionally with 'AS alias'). */
type SelectIdentifier = string & { __brand: 'SelectIdentifier' };

const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z0-9_]+(\s+AS\s+[a-zA-Z0-9_]+)?$/;

/**
 * Parses and returns a valid SQL SELECT column identifier.
 * Allows a single identifier (letters, numbers, underscores), or '*', optionally with 'AS alias'.
 *
 * @param column - The column identifier string to parse.
 * @returns The validated column identifier as a branded type.
 * @throws {Error} If invalid.
 *
 * @example
 * const col = parseSelectIdentifier('user_id'); // Ok
 * parseSelectIdentifier('user_id AS uid'); // Ok
 * parseSelectIdentifier('*'); // Ok
 * parseSelectIdentifier('user id'); // Throws error
 */
export function parseSelectIdentifier(column: string): SelectIdentifier {
  if (column !== '*' && !SQL_IDENTIFIER_PATTERN.test(column)) {
    throw new Error(
      `Invalid column name: "${column}". Must be "*" or a valid identifier (letters, numbers, underscores), optionally with "AS alias".`,
    );
  }
  return column as SelectIdentifier;
}
