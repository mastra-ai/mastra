import type { MetricResult } from '@mastra/core/eval';
import type { MessageType, StorageThreadType } from '@mastra/core/memory';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
} from '@mastra/core/storage';
import type { EvalRow, StorageColumn, StorageGetMessagesArg, TABLE_NAMES } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import pgPromise from 'pg-promise';
import type { ISSLConfig } from 'pg-promise/typescript/pg-subset';

export type PostgresConfig = {
  schemaName?: string;
  /**
   * @deprecated Use `schemaName` instead. Support for `schema` will be removed in a future release.
   */
  schema?: string;
} & (
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean | ISSLConfig;
    }
  | {
      connectionString: string;
    }
);

export class PostgresStore extends MastraStorage {
  private db: pgPromise.IDatabase<{}>;
  private pgp: pgPromise.IMain;
  private schema?: string;
  private setupSchemaPromise: Promise<void> | null = null;
  private schemaSetupComplete: boolean | undefined = undefined;

  constructor(config: PostgresConfig) {
    // Validation: connectionString or host/database/user/password must not be empty
    if ('connectionString' in config) {
      if (
        !config.connectionString ||
        typeof config.connectionString !== 'string' ||
        config.connectionString.trim() === ''
      ) {
        throw new Error(
          'PostgresStore: connectionString must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.',
        );
      }
    } else {
      const required = ['host', 'database', 'user', 'password'];
      for (const key of required) {
        if (!(key in config) || typeof (config as any)[key] !== 'string' || (config as any)[key].trim() === '') {
          throw new Error(
            `PostgresStore: ${key} must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.`,
          );
        }
      }
    }
    super({ name: 'PostgresStore' });
    this.pgp = pgPromise();
    // Deprecation notice for schema (old option)
    if ('schema' in config && config.schema) {
      console.warn(
        '[DEPRECATION NOTICE] The "schema" option in PostgresStore is deprecated. Please use "schemaName" instead. Support for "schema" will be removed in a future release.',
      );
    }
    this.schema = config.schemaName ?? config.schema;
    this.db = this.pgp(
      `connectionString` in config
        ? { connectionString: config.connectionString }
        : {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl,
          },
    );
  }

  private getTableName(indexName: string) {
    return this.schema ? `${this.schema}."${indexName}"` : `"${indexName}"`;
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT * FROM ${this.getTableName(TABLE_EVALS)} WHERE agent_name = $1`;
      const typeCondition =
        type === 'test'
          ? " AND test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL"
          : type === 'live'
            ? " AND (test_info IS NULL OR test_info->>'testPath' IS NULL)"
            : '';

      const query = `${baseQuery}${typeCondition} ORDER BY created_at DESC`;

      const rows = await this.db.manyOrNone(query, [agentName]);
      return rows?.map(row => this.transformEvalRow(row)) ?? [];
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
        return [];
      }
      console.error('Failed to get evals for the specified agent: ' + (error as any)?.message);
      throw error;
    }
  }

  private transformEvalRow(row: Record<string, any>): EvalRow {
    let testInfoValue = null;
    if (row.test_info) {
      try {
        testInfoValue = typeof row.test_info === 'string' ? JSON.parse(row.test_info) : row.test_info;
      } catch (e) {
        console.warn('Failed to parse test_info:', e);
      }
    }

    return {
      agentName: row.agent_name as string,
      input: row.input as string,
      output: row.output as string,
      result: row.result as MetricResult,
      metricName: row.metric_name as string,
      instructions: row.instructions as string,
      testInfo: testInfoValue,
      globalRunId: row.global_run_id as string,
      runId: row.run_id as string,
      createdAt: row.created_at as string,
    };
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    try {
      await this.db.query('BEGIN');
      for (const record of records) {
        await this.insert({ tableName, record });
      }
      await this.db.query('COMMIT');
    } catch (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
    filters,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
  }): Promise<any[]> {
    let idx = 1;
    const limit = perPage;
    const offset = page * perPage;

    const args: (string | number)[] = [];

    const conditions: string[] = [];
    if (name) {
      conditions.push(`name LIKE CONCAT(\$${idx++}, '%')`);
    }
    if (scope) {
      conditions.push(`scope = \$${idx++}`);
    }
    if (attributes) {
      Object.keys(attributes).forEach(key => {
        conditions.push(`attributes->>'${key}' = \$${idx++}`);
      });
    }

    if (filters) {
      Object.entries(filters).forEach(([key]) => {
        conditions.push(`${key} = \$${idx++}`);
      });
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (name) {
      args.push(name);
    }

    if (scope) {
      args.push(scope);
    }

    if (attributes) {
      for (const [_key, value] of Object.entries(attributes)) {
        args.push(value);
      }
    }

    if (filters) {
      for (const [, value] of Object.entries(filters)) {
        args.push(value);
      }
    }

    const result = await this.db.manyOrNone<{
      id: string;
      parentSpanId: string;
      traceId: string;
      name: string;
      scope: string;
      kind: string;
      events: any[];
      links: any[];
      status: any;
      attributes: Record<string, any>;
      startTime: string;
      endTime: string;
      other: any;
      createdAt: string;
    }>(
      `SELECT * FROM ${this.getTableName(TABLE_TRACES)} ${whereClause} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`,
      args,
    );

    if (!result) {
      return [];
    }

    return result.map(row => ({
      id: row.id,
      parentSpanId: row.parentSpanId,
      traceId: row.traceId,
      name: row.name,
      scope: row.scope,
      kind: row.kind,
      status: row.status,
      events: row.events,
      links: row.links,
      attributes: row.attributes,
      startTime: row.startTime,
      endTime: row.endTime,
      other: row.other,
      createdAt: row.createdAt,
    })) as any;
  }

  private async setupSchema() {
    if (!this.schema || this.schemaSetupComplete) {
      return;
    }

    if (!this.setupSchemaPromise) {
      this.setupSchemaPromise = (async () => {
        try {
          // First check if schema exists and we have usage permission
          const schemaExists = await this.db.oneOrNone(
            `
            SELECT EXISTS (
              SELECT 1 FROM information_schema.schemata 
              WHERE schema_name = $1
            )
          `,
            [this.schema],
          );

          if (!schemaExists?.exists) {
            try {
              await this.db.none(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
              this.logger.info(`Schema "${this.schema}" created successfully`);
            } catch (error) {
              this.logger.error(`Failed to create schema "${this.schema}"`, { error });
              throw new Error(
                `Unable to create schema "${this.schema}". This requires CREATE privilege on the database. ` +
                  `Either create the schema manually or grant CREATE privilege to the user.`,
              );
            }
          }

          // If we got here, schema exists and we can use it
          this.schemaSetupComplete = true;
          this.logger.debug(`Schema "${this.schema}" is ready for use`);
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
          if (def.primaryKey) constraints.push('PRIMARY KEY');
          if (!def.nullable) constraints.push('NOT NULL');
          return `"${name}" ${def.type.toUpperCase()} ${constraints.join(' ')}`;
        })
        .join(',\n');

      // Create schema if it doesn't exist
      if (this.schema) {
        await this.setupSchema();
      }

      const sql = `
        CREATE TABLE IF NOT EXISTS ${this.getTableName(tableName)} (
          ${columns}
        );
        ${
          tableName === TABLE_WORKFLOW_SNAPSHOT
            ? `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'mastra_workflow_snapshot_workflow_name_run_id_key'
          ) THEN
            ALTER TABLE ${this.getTableName(tableName)}
            ADD CONSTRAINT mastra_workflow_snapshot_workflow_name_run_id_key
            UNIQUE (workflow_name, run_id);
          END IF;
        END $$;
        `
            : ''
        }
      `;

      await this.db.none(sql);
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
      throw error;
    }
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.none(`TRUNCATE TABLE ${this.getTableName(tableName)} CASCADE`);
    } catch (error) {
      console.error(`Error clearing table ${tableName}:`, error);
      throw error;
    }
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      const columns = Object.keys(record);
      const values = Object.values(record);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      await this.db.none(
        `INSERT INTO ${this.getTableName(tableName)} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
        values,
      );
    } catch (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      throw error;
    }
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      const keyEntries = Object.entries(keys);
      const conditions = keyEntries.map(([key], index) => `"${key}" = $${index + 1}`).join(' AND ');
      const values = keyEntries.map(([_, value]) => value);

      const result = await this.db.oneOrNone<R>(
        `SELECT * FROM ${this.getTableName(tableName)} WHERE ${conditions}`,
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
      console.error(`Error loading from ${tableName}:`, error);
      throw error;
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const thread = await this.db.oneOrNone<StorageThreadType>(
        `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "updatedAt"
        FROM ${this.getTableName(TABLE_THREADS)}
        WHERE id = $1`,
        [threadId],
      );

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
      console.error(`Error getting thread ${threadId}:`, error);
      throw error;
    }
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const threads = await this.db.manyOrNone<StorageThreadType>(
        `SELECT 
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "updatedAt"
        FROM ${this.getTableName(TABLE_THREADS)}
        WHERE "resourceId" = $1`,
        [resourceId],
      );

      return threads.map(thread => ({
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      }));
    } catch (error) {
      console.error(`Error getting threads for resource ${resourceId}:`, error);
      throw error;
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      await this.db.none(
        `INSERT INTO ${this.getTableName(TABLE_THREADS)} (
          id,
          "resourceId",
          title,
          metadata,
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          "resourceId" = EXCLUDED."resourceId",
          title = EXCLUDED.title,
          metadata = EXCLUDED.metadata,
          "createdAt" = EXCLUDED."createdAt",
          "updatedAt" = EXCLUDED."updatedAt"`,
        [
          thread.id,
          thread.resourceId,
          thread.title,
          thread.metadata ? JSON.stringify(thread.metadata) : null,
          thread.createdAt,
          thread.updatedAt,
        ],
      );

      return thread;
    } catch (error) {
      console.error('Error saving thread:', error);
      throw error;
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
      // First get the existing thread to merge metadata
      const existingThread = await this.getThreadById({ threadId: id });
      if (!existingThread) {
        throw new Error(`Thread ${id} not found`);
      }

      // Merge the existing metadata with the new metadata
      const mergedMetadata = {
        ...existingThread.metadata,
        ...metadata,
      };

      const thread = await this.db.one<StorageThreadType>(
        `UPDATE ${this.getTableName(TABLE_THREADS)}
        SET title = $1,
            metadata = $2,
            "updatedAt" = $3
        WHERE id = $4
        RETURNING *`,
        [title, mergedMetadata, new Date().toISOString(), id],
      );

      return {
        ...thread,
        metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      };
    } catch (error) {
      console.error('Error updating thread:', error);
      throw error;
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      await this.db.tx(async t => {
        // First delete all messages associated with this thread
        await t.none(`DELETE FROM ${this.getTableName(TABLE_MESSAGES)} WHERE thread_id = $1`, [threadId]);

        // Then delete the thread
        await t.none(`DELETE FROM ${this.getTableName(TABLE_THREADS)} WHERE id = $1`, [threadId]);
      });
    } catch (error) {
      console.error('Error deleting thread:', error);
      throw error;
    }
  }

  async getMessages<T = unknown>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    try {
      const messages: any[] = [];
      const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;
      const include = selectBy?.include || [];

      if (include.length) {
        const includeResult = await this.db.manyOrNone(
          `
          WITH ordered_messages AS (
            SELECT 
              *,
              ROW_NUMBER() OVER (ORDER BY "createdAt" DESC) as row_num
            FROM ${this.getTableName(TABLE_MESSAGES)}
            WHERE thread_id = $1
          )
          SELECT
            m.id, 
            m.content, 
            m.role, 
            m.type,
            m."createdAt", 
            m.thread_id AS "threadId"
          FROM ordered_messages m
          WHERE m.id = ANY($2)
          OR EXISTS (
            SELECT 1 FROM ordered_messages target
            WHERE target.id = ANY($2)
            AND (
              -- Get previous messages based on the max withPreviousMessages
              (m.row_num <= target.row_num + $3 AND m.row_num > target.row_num)
              OR
              -- Get next messages based on the max withNextMessages
              (m.row_num >= target.row_num - $4 AND m.row_num < target.row_num)
            )
          )
          ORDER BY m."createdAt" DESC
          `,
          [
            threadId,
            include.map(i => i.id),
            Math.max(...include.map(i => i.withPreviousMessages || 0)),
            Math.max(...include.map(i => i.withNextMessages || 0)),
          ],
        );

        messages.push(...includeResult);
      }

      // Then get the remaining messages, excluding the ids we just fetched
      const result = await this.db.manyOrNone(
        `
        SELECT 
            id, 
            content, 
            role, 
            type,
            "createdAt", 
            thread_id AS "threadId"
        FROM ${this.getTableName(TABLE_MESSAGES)}
        WHERE thread_id = $1
        AND id != ALL($2)
        ORDER BY "createdAt" DESC
        LIMIT $3
        `,
        [threadId, messages.map(m => m.id), limit],
      );

      messages.push(...result);

      // Sort all messages by creation date
      messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Parse message content
      messages.forEach(message => {
        if (typeof message.content === 'string') {
          try {
            message.content = JSON.parse(message.content);
          } catch {
            // If parsing fails, leave as string
          }
        }
      });

      return messages as T;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return messages;

    try {
      const threadId = messages[0]?.threadId;
      if (!threadId) {
        throw new Error('Thread ID is required');
      }

      // Check if thread exists
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      await this.db.tx(async t => {
        for (const message of messages) {
          await t.none(
            `INSERT INTO ${this.getTableName(TABLE_MESSAGES)} (id, thread_id, content, "createdAt", role, type) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              message.id,
              threadId,
              typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
              message.createdAt || new Date().toISOString(),
              message.role,
              message.type,
            ],
          );
        }
      });

      return messages;
    } catch (error) {
      console.error('Error saving messages:', error);
      throw error;
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
      const now = new Date().toISOString();
      await this.db.none(
        `INSERT INTO ${this.getTableName(TABLE_WORKFLOW_SNAPSHOT)} (
          workflow_name,
          run_id,
          snapshot,
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (workflow_name, run_id) DO UPDATE
        SET snapshot = EXCLUDED.snapshot,
            "updatedAt" = EXCLUDED."updatedAt"`,
        [workflowName, runId, JSON.stringify(snapshot), now, now],
      );
    } catch (error) {
      console.error('Error persisting workflow snapshot:', error);
      throw error;
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
      console.error('Error loading workflow snapshot:', error);
      throw error;
    }
  }

  async getWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    limit,
    offset,
  }: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    runs: Array<{
      workflowName: string;
      runId: string;
      snapshot: WorkflowRunState | string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    total: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (workflowName) {
      conditions.push(`workflow_name = $${paramIndex}`);
      values.push(workflowName);
      paramIndex++;
    }

    if (fromDate) {
      conditions.push(`"createdAt" >= $${paramIndex}`);
      values.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      conditions.push(`"createdAt" <= $${paramIndex}`);
      values.push(toDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    // Only get total count when using pagination
    if (limit !== undefined && offset !== undefined) {
      const countResult = await this.db.one(
        `SELECT COUNT(*) as count FROM ${this.getTableName(TABLE_WORKFLOW_SNAPSHOT)} ${whereClause}`,
        values,
      );
      total = Number(countResult.count);
    }

    // Get results
    const query = `
      SELECT * FROM ${this.getTableName(TABLE_WORKFLOW_SNAPSHOT)} 
      ${whereClause} 
      ORDER BY "createdAt" DESC
      ${limit !== undefined && offset !== undefined ? ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}` : ''}
    `;

    const queryValues = limit !== undefined && offset !== undefined ? [...values, limit, offset] : values;

    const result = await this.db.manyOrNone(query, queryValues);

    const runs = (result || []).map(row => {
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
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    // Use runs.length as total when not paginating
    return { runs, total: total || runs.length };
  }

  async close(): Promise<void> {
    this.pgp.end();
  }
}
