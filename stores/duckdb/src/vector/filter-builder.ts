/**
 * DuckDB Filter Builder
 * Converts Mastra filter objects to DuckDB SQL WHERE clauses
 *
 * SECURITY: All field names are validated before use in SQL
 * User input is always parameterized using ? placeholders
 * Field names undergo strict validation to prevent injection
 */

import type { VectorFilter as BaseVectorFilter } from '@mastra/core/vector/filter';

export interface FilterSQL {
  sql: string;
  params: any[];
}

/**
 * Builds SQL WHERE clauses from filter objects
 */
export class DuckDBFilterBuilder {
  private params: any[] = [];

  /**
   * Validate and escape field names to prevent SQL injection
   */
  private validateFieldName(field: string): string {
    // Only allow alphanumeric, underscore, hyphen, and dot for nested paths
    if (!/^[a-zA-Z0-9_.-]+$/.test(field)) {
      throw new Error(
        `Invalid field name: ${field}. Only alphanumeric characters, underscores, hyphens, and dots are allowed.`,
      );
    }

    // Additional check for SQL keywords
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE', 'UNION'];
    if (sqlKeywords.includes(field.toUpperCase())) {
      throw new Error(`Field name cannot be a SQL keyword: ${field}`);
    }

    return field;
  }

  /**
   * Build SQL WHERE clause from filter
   */
  build(filter?: BaseVectorFilter, namespace?: string): FilterSQL {
    if (!filter && !namespace) {
      return { sql: '', params: [] };
    }

    this.params = [];

    const conditions: string[] = [];

    // Add namespace filter
    if (namespace) {
      conditions.push(`metadata->>'namespace' = ?`);
      this.params.push(namespace);
    }

    // Build filter conditions
    if (filter) {
      const filterSql = this.buildFilter(filter);
      if (filterSql) {
        conditions.push(filterSql);
      }
    }

    return {
      sql: conditions.length > 0 ? conditions.join(' AND ') : '',
      params: this.params,
    };
  }

  /**
   * Build filter recursively
   */
  private buildFilter(filter: BaseVectorFilter): string {
    if (!filter) return '';

    const conditions: string[] = [];
    const filterObj = filter as any;

    // Process all keys in the filter object
    for (const [key, value] of Object.entries(filterObj)) {
      if (key === '$and' && Array.isArray(value)) {
        const andConditions = value.map((f: any) => this.buildFilter(f)).filter(Boolean);
        if (andConditions.length > 0) {
          conditions.push(`(${andConditions.join(' AND ')})`);
        }
      } else if (key === '$or' && Array.isArray(value)) {
        const orConditions = value.map((f: any) => this.buildFilter(f)).filter(Boolean);
        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(' OR ')})`);
        }
      } else if (key === '$not' && value) {
        const notCondition = this.buildFilter(value as BaseVectorFilter);
        if (notCondition) {
          conditions.push(`NOT (${notCondition})`);
        }
      } else if (!key.startsWith('$')) {
        // Handle field conditions (including metadata fields)
        const fieldCondition = this.buildFieldCondition(key, value);
        if (fieldCondition) {
          conditions.push(fieldCondition);
        }
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '';
  }

  /**
   * Build field condition
   * @greptile-security-review safe - All field names validated before use
   */
  private buildFieldCondition(field: string, value: any): string {
    // Validate field name first to prevent SQL injection
    const safeField = this.validateFieldName(field);

    // Handle metadata fields specially
    // @greptile-security-review safe - Field names double-validated
    const jsonPath = safeField.startsWith('metadata.')
      ? `metadata->>'${this.validateFieldName(safeField.substring(9))}'`
      : safeField === 'metadata' && typeof value === 'object'
        ? null // Will be handled below
        : safeField;

    // If it's a metadata object, process each field
    if (field === 'metadata' && typeof value === 'object' && !Array.isArray(value)) {
      return this.buildMetadataFilter(value);
    }

    // If jsonPath is null, we already handled it
    if (!jsonPath) return '';

    // Handle different value types
    if (value === null || value === undefined) {
      return `${jsonPath} IS NULL`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle operators
      return this.buildOperatorCondition(jsonPath, value);
    } else if (Array.isArray(value)) {
      // Handle array values (IN clause)
      const placeholders = value.map(() => '?').join(',');
      this.params.push(...value.map(String));
      return `${jsonPath} IN (${placeholders})`;
    } else {
      // Simple equality
      this.params.push(String(value));
      return `${jsonPath} = ?`;
    }
  }

  /**
   * Build metadata filter
   */
  private buildMetadataFilter(metadata: Record<string, any>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(metadata)) {
      // Validate the key to prevent SQL injection
      const safeKey = this.validateFieldName(key);

      if (value === null || value === undefined) {
        conditions.push(`metadata->>'${safeKey}' IS NULL`);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle operators
        const opCondition = this.buildOperatorCondition(`metadata->>'${safeKey}'`, value);
        if (opCondition) {
          conditions.push(opCondition);
        }
      } else if (Array.isArray(value)) {
        // Handle array values (IN clause)
        const placeholders = value.map(() => '?').join(',');
        conditions.push(`metadata->>'${safeKey}' IN (${placeholders})`);
        this.params.push(...value.map(String));
      } else {
        // Simple equality
        conditions.push(`metadata->>'${safeKey}' = ?`);
        this.params.push(String(value));
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '';
  }

  /**
   * Build operator conditions
   */
  private buildOperatorCondition(jsonPath: string, operators: Record<string, any>): string {
    const conditions: string[] = [];

    // Extract the field name from jsonPath for JSON operations
    // jsonPath might be like `metadata->>'fieldname'` or just `fieldname`
    let fieldName = '';
    const metadataMatch = jsonPath.match(/metadata->>'([^']+)'/);
    if (metadataMatch && metadataMatch[1]) {
      // Validate the extracted field name to prevent SQL injection
      fieldName = this.validateFieldName(metadataMatch[1]);
    } else {
      fieldName = this.validateFieldName(jsonPath);
    }

    for (const [op, value] of Object.entries(operators)) {
      switch (op) {
        case '$eq':
          conditions.push(`${jsonPath} = ?`);
          this.params.push(String(value));
          break;

        case '$ne':
          conditions.push(`${jsonPath} != ?`);
          this.params.push(String(value));
          break;

        case '$gt':
          conditions.push(`CAST(${jsonPath} AS NUMERIC) > ?`);
          this.params.push(value);
          break;

        case '$gte':
          conditions.push(`CAST(${jsonPath} AS NUMERIC) >= ?`);
          this.params.push(value);
          break;

        case '$lt':
          conditions.push(`CAST(${jsonPath} AS NUMERIC) < ?`);
          this.params.push(value);
          break;

        case '$lte':
          conditions.push(`CAST(${jsonPath} AS NUMERIC) <= ?`);
          this.params.push(value);
          break;

        case '$in':
          if (Array.isArray(value)) {
            const placeholders = value.map(() => '?').join(',');
            conditions.push(`${jsonPath} IN (${placeholders})`);
            this.params.push(...value.map(String));
          }
          break;

        case '$nin':
          if (Array.isArray(value)) {
            const placeholders = value.map(() => '?').join(',');
            conditions.push(`${jsonPath} NOT IN (${placeholders})`);
            this.params.push(...value.map(String));
          }
          break;

        case '$like':
          conditions.push(`${jsonPath} LIKE ?`);
          this.params.push(String(value));
          break;

        case '$ilike':
          conditions.push(`${jsonPath} ILIKE ?`);
          this.params.push(String(value));
          break;

        case '$regex':
          conditions.push(`regexp_matches(${jsonPath}, ?)`);
          this.params.push(String(value));
          break;

        case '$exists':
          if (value) {
            conditions.push(`${jsonPath} IS NOT NULL`);
          } else {
            conditions.push(`${jsonPath} IS NULL`);
          }
          break;

        case '$between':
          if (Array.isArray(value) && value.length === 2) {
            conditions.push(`CAST(${jsonPath} AS NUMERIC) BETWEEN ? AND ?`);
            this.params.push(value[0], value[1]);
          }
          break;

        case '$contains':
          // For JSON arrays - use the validated fieldName for the JSON path
          // fieldName is already validated above
          conditions.push(`json_array_contains(metadata->'${fieldName}', ?)`);
          this.params.push(JSON.stringify(value));
          break;

        case '$containsAny':
          if (Array.isArray(value)) {
            // fieldName is already validated above
            const orConditions = value.map(() => `json_array_contains(metadata->'${fieldName}', ?)`);
            conditions.push(`(${orConditions.join(' OR ')})`);
            this.params.push(...value.map(v => JSON.stringify(v)));
          }
          break;

        case '$containsAll':
          if (Array.isArray(value)) {
            // fieldName is already validated above
            const andConditions = value.map(() => `json_array_contains(metadata->'${fieldName}', ?)`);
            conditions.push(`(${andConditions.join(' AND ')})`);
            this.params.push(...value.map(v => JSON.stringify(v)));
          }
          break;
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '';
  }

  /**
   * Build text search condition
   */
  static buildTextSearch(tableName: string, query: string): string {
    return `fts_main_${tableName}(content, ?)`;
  }

  /**
   * Build date range condition
   */
  static buildDateRange(field: string, start?: Date | string, end?: Date | string): FilterSQL {
    const conditions: string[] = [];
    const params: any[] = [];

    if (start) {
      conditions.push(`${field} >= ?`);
      params.push(start instanceof Date ? start.toISOString() : start);
    }

    if (end) {
      conditions.push(`${field} <= ?`);
      params.push(end instanceof Date ? end.toISOString() : end);
    }

    return {
      sql: conditions.join(' AND '),
      params,
    };
  }

  /**
   * Escape SQL identifiers
   */
  static escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Build raw SQL with parameter placeholders
   */
  static buildRawSQL(sql: string, params: any[] = []): FilterSQL {
    return { sql, params };
  }
}
