import { Mutex } from 'async-mutex';
import type { DbClient } from '../client';
import type { TableName } from '../migrations/001_initial';
import { TABLES, TABLE_SCHEMAS, DEFAULT_INDEXES } from '../migrations/001_initial';
import { parseSqlIdentifier } from '../shared/config';

interface AdminPgDBConfig {
  client: DbClient;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
}

interface CreateIndexOptions {
  name?: string;
  table: string;
  columns: string[];
  unique?: boolean;
  where?: string;
}

/**
 * Core database layer for MastraAdmin PostgreSQL storage
 */
export class AdminPgDB {
  private client: DbClient;
  private schema: string;
  private skipDefaultIndexes: boolean;

  private static schemaSetupRegistry = new Map<string, Promise<void>>();
  private static schemaSetupMutex = new Mutex();

  constructor(config: AdminPgDBConfig) {
    this.client = config.client;
    this.schema = config.schemaName ? parseSqlIdentifier(config.schemaName, 'schema') : 'mastra_admin';
    this.skipDefaultIndexes = config.skipDefaultIndexes ?? false;
  }

  /**
   * Get qualified table name with schema
   */
  private qualifiedTable(table: TableName): string {
    return `"${this.schema}"."${table}"`;
  }

  /**
   * Setup schema if not public
   */
  private async setupSchema(): Promise<void> {
    if (this.schema === 'public') return;

    const poolOptions = this.client.$pool.options;
    const host = poolOptions.host ?? 'localhost';
    const port = poolOptions.port ?? 5432;
    const key = `${host}:${port}:${this.schema}`;

    const existingSetup = AdminPgDB.schemaSetupRegistry.get(key);
    if (existingSetup) {
      await existingSetup;
      return;
    }

    const release = await AdminPgDB.schemaSetupMutex.acquire();
    try {
      const recheck = AdminPgDB.schemaSetupRegistry.get(key);
      if (recheck) {
        await recheck;
        return;
      }

      const setupPromise = this.client.none(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`).then(() => {});
      AdminPgDB.schemaSetupRegistry.set(key, setupPromise);
      await setupPromise;
    } finally {
      release();
    }
  }

  /**
   * Initialize all tables
   */
  async init(): Promise<void> {
    await this.setupSchema();

    // Create tables in order (respecting foreign key constraints)
    const tableOrder: TableName[] = [
      TABLES.users,
      TABLES.teams,
      TABLES.team_members,
      TABLES.team_invites,
      TABLES.team_installations,
      TABLES.projects,
      TABLES.project_env_vars,
      TABLES.project_api_tokens,
      TABLES.deployments,
      TABLES.builds,
      TABLES.running_servers,
      TABLES.routes,
      TABLES.roles,
      TABLES.role_assignments,
    ];

    for (const table of tableOrder) {
      await this.createTable(table);
    }

    // Create default indexes
    if (!this.skipDefaultIndexes) {
      await this.createDefaultIndexes();
    }

    // Setup updated_at triggers
    await this.setupUpdatedAtTriggers();
  }

  /**
   * Create a single table
   */
  private async createTable(table: TableName): Promise<void> {
    // Replace table references with schema-qualified names
    let schema = TABLE_SCHEMAS[table];
    for (const [, tableName] of Object.entries(TABLES)) {
      schema = schema.replace(new RegExp(`REFERENCES ${tableName}\\(`, 'g'), `REFERENCES "${this.schema}"."${tableName}"(`);
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.qualifiedTable(table)} (
        ${schema}
      )
    `;
    await this.client.none(sql);
  }

  /**
   * Create default indexes
   */
  private async createDefaultIndexes(): Promise<void> {
    for (const index of DEFAULT_INDEXES) {
      const name = index.unique
        ? `${this.schema}_${index.table}_${index.columns.join('_')}_unique`
        : `${this.schema}_${index.table}_${index.columns.join('_')}_idx`;

      await this.createIndex({
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        table: index.table,
        columns: index.columns,
        unique: index.unique,
      });
    }
  }

  /**
   * Create an index
   */
  async createIndex(options: CreateIndexOptions): Promise<void> {
    const { name, table, columns, unique, where } = options;
    const indexName = name || `${this.schema}_${table}_${columns.join('_')}_idx`;
    const uniqueStr = unique ? 'UNIQUE' : '';
    const whereStr = where ? `WHERE ${where}` : '';
    const columnsStr = columns
      .map(c => {
        // Handle DESC/ASC in column names
        const parts = c.split(' ');
        if (parts.length === 1) return `"${c}"`;
        return `"${parts[0]}" ${parts.slice(1).join(' ')}`;
      })
      .join(', ');

    const sql = `
      CREATE ${uniqueStr} INDEX IF NOT EXISTS "${indexName}"
      ON ${this.qualifiedTable(table as TableName)} (${columnsStr})
      ${whereStr}
    `;

    try {
      await this.client.none(sql);
    } catch (error) {
      // Ignore "already exists" errors
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
    }
  }

  /**
   * Setup updated_at triggers
   */
  private async setupUpdatedAtTriggers(): Promise<void> {
    // Create the trigger function
    const functionSql = `
      CREATE OR REPLACE FUNCTION "${this.schema}".update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;
    await this.client.none(functionSql);

    // Tables that have updated_at column
    const tablesWithUpdatedAt: TableName[] = [
      TABLES.users,
      TABLES.teams,
      TABLES.team_installations,
      TABLES.projects,
      TABLES.project_env_vars,
      TABLES.deployments,
      TABLES.routes,
      TABLES.roles,
    ];

    for (const table of tablesWithUpdatedAt) {
      const triggerName = `${table}_updated_at_trigger`;
      const triggerSql = `
        DROP TRIGGER IF EXISTS "${triggerName}" ON ${this.qualifiedTable(table)};
        CREATE TRIGGER "${triggerName}"
        BEFORE UPDATE ON ${this.qualifiedTable(table)}
        FOR EACH ROW
        EXECUTE FUNCTION "${this.schema}".update_updated_at_column();
      `;
      await this.client.none(triggerSql);
    }
  }

  /**
   * Insert a record
   */
  async insert<T>(table: TableName, data: Record<string, unknown>): Promise<T & { id: string }> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const columns = keys.map(k => `"${this.toSnakeCase(k)}"`);

    const sql = `
      INSERT INTO ${this.qualifiedTable(table)} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const row = await this.client.one(sql, values);
    return this.transformRow<T & { id: string }>(row);
  }

  /**
   * Batch insert records
   */
  async batchInsert<T>(table: TableName, records: Record<string, unknown>[]): Promise<(T & { id: string })[]> {
    if (records.length === 0) return [];

    return this.client.tx(async tx => {
      const results: (T & { id: string })[] = [];
      for (const record of records) {
        const keys = Object.keys(record);
        const values = Object.values(record);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        const columns = keys.map(k => `"${this.toSnakeCase(k)}"`);

        const sql = `
          INSERT INTO ${this.qualifiedTable(table)} (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING *
        `;

        const row = await tx.one(sql, values);
        results.push(this.transformRow<T & { id: string }>(row));
      }
      return results;
    });
  }

  /**
   * Update a record
   */
  async update<T>(table: TableName, id: string, data: Record<string, unknown>): Promise<(T & { id: string }) | null> {
    const keys = Object.keys(data);
    if (keys.length === 0) return null;

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `"${this.toSnakeCase(k)}" = $${i + 1}`).join(', ');

    const sql = `
      UPDATE ${this.qualifiedTable(table)}
      SET ${setClause}
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    const row = await this.client.oneOrNone(sql, [...values, id]);
    return row ? this.transformRow<T & { id: string }>(row) : null;
  }

  /**
   * Delete a record
   */
  async delete(table: TableName, id: string): Promise<boolean> {
    const sql = `DELETE FROM ${this.qualifiedTable(table)} WHERE id = $1`;
    const result = await this.client.query(sql, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find a record by ID
   */
  async findById<T>(table: TableName, id: string): Promise<(T & { id: string }) | null> {
    const sql = `SELECT * FROM ${this.qualifiedTable(table)} WHERE id = $1`;
    const row = await this.client.oneOrNone(sql, [id]);
    return row ? this.transformRow<T & { id: string }>(row) : null;
  }

  /**
   * Find records by condition
   */
  async findBy<T>(
    table: TableName,
    conditions: Record<string, unknown>,
    options?: { limit?: number; offset?: number; orderBy?: string },
  ): Promise<(T & { id: string })[]> {
    const { where, values } = this.buildWhereClause(conditions);
    let sql = `SELECT * FROM ${this.qualifiedTable(table)} ${where}`;

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const rows = await this.client.any(sql, values);
    return rows.map(row => this.transformRow<T & { id: string }>(row));
  }

  /**
   * Find one record by condition
   */
  async findOneBy<T>(table: TableName, conditions: Record<string, unknown>): Promise<(T & { id: string }) | null> {
    const results = await this.findBy<T>(table, conditions, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Count records
   */
  async count(table: TableName, conditions?: Record<string, unknown>): Promise<number> {
    const { where, values } = conditions ? this.buildWhereClause(conditions) : { where: '', values: [] };

    const sql = `SELECT COUNT(*) as count FROM ${this.qualifiedTable(table)} ${where}`;
    const result = await this.client.one<{ count: string }>(sql, values);
    return parseInt(result.count, 10);
  }

  /**
   * Execute raw SQL
   */
  async query<T>(sql: string, values?: unknown[]): Promise<T[]> {
    const rows = await this.client.any(sql, values);
    return rows.map(row => this.transformRow<T>(row));
  }

  /**
   * Execute in transaction
   */
  async transaction<T>(callback: (db: AdminPgDB) => Promise<T>): Promise<T> {
    return this.client.tx(async () => {
      return callback(this);
    });
  }

  /**
   * Build WHERE clause from conditions
   */
  private buildWhereClause(conditions: Record<string, unknown>): {
    where: string;
    values: unknown[];
  } {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return { where: '', values: [] };

    const clauses: string[] = [];
    const values: unknown[] = [];

    for (const key of keys) {
      const value = conditions[key];
      const column = `"${this.toSnakeCase(key)}"`;

      if (value === null) {
        clauses.push(`${column} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map((_, i) => `$${values.length + i + 1}`);
        clauses.push(`${column} IN (${placeholders.join(', ')})`);
        values.push(...value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { gte: 5, lte: 10 }
        const ops = value as Record<string, unknown>;
        for (const [op, opValue] of Object.entries(ops)) {
          values.push(opValue);
          const placeholder = `$${values.length}`;
          switch (op) {
            case 'gte':
              clauses.push(`${column} >= ${placeholder}`);
              break;
            case 'lte':
              clauses.push(`${column} <= ${placeholder}`);
              break;
            case 'gt':
              clauses.push(`${column} > ${placeholder}`);
              break;
            case 'lt':
              clauses.push(`${column} < ${placeholder}`);
              break;
            case 'ne':
              clauses.push(`${column} != ${placeholder}`);
              break;
            case 'like':
              clauses.push(`${column} LIKE ${placeholder}`);
              break;
            case 'ilike':
              clauses.push(`${column} ILIKE ${placeholder}`);
              break;
            default:
              throw new Error(`Unknown operator: ${op}`);
          }
        }
      } else {
        values.push(value);
        clauses.push(`${column} = $${values.length}`);
      }
    }

    return { where: `WHERE ${clauses.join(' AND ')}`, values };
  }

  /**
   * Transform database row to camelCase
   */
  private transformRow<T>(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = this.toCamelCase(key);
      // Parse JSONB columns
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          result[camelKey] = JSON.parse(value);
        } catch {
          result[camelKey] = value;
        }
      } else {
        result[camelKey] = value;
      }
    }
    return result as T;
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Get the underlying client for direct access
   */
  get db(): DbClient {
    return this.client;
  }

  /**
   * Get schema name
   */
  get schemaName(): string {
    return this.schema;
  }
}

export { TABLES, type TableName };
