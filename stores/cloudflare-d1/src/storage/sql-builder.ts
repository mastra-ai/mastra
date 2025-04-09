/**
 * Type definition for SQL query parameters
 */
export type SqlParam = string | number | boolean | null | undefined;

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
      this.sql = `SELECT ${Array.isArray(columns) ? columns.join(', ') : columns}`;
    }
    return this;
  }

  from(table: string): SqlBuilder {
    this.sql += ` FROM ${table}`;
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
    this.sql += ` ORDER BY ${column} ${direction}`;
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

  // Insert operations
  insert(table: string, columnsOrData: string[] | Record<string, SqlParam>, values?: SqlParam[]): SqlBuilder {
    // Handle both patterns: insert(table, {col1: val1, col2: val2}) and insert(table, [col1, col2], [val1, val2])
    if (Array.isArray(columnsOrData) && values) {
      // Array-based pattern
      const columns = columnsOrData;
      const placeholders = columns.map(() => '?').join(', ');

      this.sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      this.params.push(...values);
    } else {
      // Object-based pattern
      const data = columnsOrData as Record<string, SqlParam>;
      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');

      this.sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      this.params.push(...Object.values(data));
    }

    return this;
  }

  // Update operations
  update(table: string, columnsOrData: string[] | Record<string, SqlParam>, values?: SqlParam[]): SqlBuilder {
    // Handle both patterns: update(table, {col1: val1, col2: val2}) and update(table, [col1, col2], [val1, val2])
    if (Array.isArray(columnsOrData) && values) {
      // Array-based pattern
      const columns = columnsOrData;
      const setClause = columns.map(col => `${col} = ?`).join(', ');

      this.sql = `UPDATE ${table} SET ${setClause}`;
      this.params.push(...values);
    } else {
      // Object-based pattern
      const data = columnsOrData as Record<string, SqlParam>;
      const setClause = Object.keys(data)
        .map(key => `${key} = ?`)
        .join(', ');

      this.sql = `UPDATE ${table} SET ${setClause}`;
      this.params.push(...Object.values(data));
    }

    return this;
  }

  // Delete operations
  delete(table: string): SqlBuilder {
    this.sql = `DELETE FROM ${table}`;
    return this;
  }

  /**
   * Create a table if it doesn't exist
   * @param table The table name
   * @param columnDefinitions The column definitions as an array of strings or object
   * @returns The builder instance
   */
  createTable(table: string, columnDefinitions: string[] | Record<string, string>): SqlBuilder {
    let columns: string;

    if (Array.isArray(columnDefinitions)) {
      // Handle array of column definitions
      columns = columnDefinitions.join(', ');
    } else {
      // Handle object of column name to definition
      columns = Object.entries(columnDefinitions)
        .map(([name, definition]) => `${name} ${definition}`)
        .join(', ');
    }

    this.sql = `CREATE TABLE IF NOT EXISTS ${table} (${columns})`;
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
    this.sql = `CREATE ${indexType} INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnName})`;
    return this;
  }

  /**
   * Begin a transaction
   * @returns The builder instance
   */
  beginTransaction(): SqlBuilder {
    this.sql = 'BEGIN TRANSACTION';
    return this;
  }

  /**
   * Commit a transaction
   * @returns The builder instance
   */
  commitTransaction(): SqlBuilder {
    this.sql = 'COMMIT';
    return this;
  }

  /**
   * Rollback a transaction
   * @returns The builder instance
   */
  rollbackTransaction(): SqlBuilder {
    this.sql = 'ROLLBACK';
    return this;
  }

  // Raw SQL with params
  raw(sql: string, ...params: SqlParam[]): SqlBuilder {
    this.sql = sql;
    this.params.push(...params);
    return this;
  }

  /**
   * Add a LIKE condition to the query
   * @param column The column to check
   * @param value The value to match (will be wrapped with % for LIKE)
   * @param exact If true, will not add % wildcards
   */
  like(column: string, value: string, exact: boolean = false): SqlBuilder {
    const likeValue = exact ? value : `%${value}%`;
    if (this.whereAdded) {
      this.sql += ` AND ${column} LIKE ?`;
    } else {
      this.sql += ` WHERE ${column} LIKE ?`;
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
    const jsonPattern = `%"${key}":"${value}"%`;
    if (this.whereAdded) {
      this.sql += ` AND ${column} LIKE ?`;
    } else {
      this.sql += ` WHERE ${column} LIKE ?`;
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
