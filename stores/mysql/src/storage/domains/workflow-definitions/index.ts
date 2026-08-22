import {
  TABLE_WORKFLOW_DEFINITIONS,
  WORKFLOW_DEFINITIONS_SCHEMA,
  assertWorkflowDefinitionAuthor,
  hasErrorCode,
  WorkflowDefinitionsStorage,
} from '@mastra/core/storage';
import type {
  CreateWorkflowDefinitionInput,
  ListWorkflowDefinitionsInput,
  ListWorkflowDefinitionsOutput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
} from '@mastra/core/storage';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
import {
  formatTableName,
  prepareInsertOnlyStatement,
  prepareUpdateStatement,
  quoteIdentifier,
  transformFromSqlRow,
} from '../utils';

function rowToDefinition(row: Record<string, unknown>): WorkflowDefinition {
  const transformed = transformFromSqlRow<Record<string, unknown>>({
    tableName: TABLE_WORKFLOW_DEFINITIONS,
    sqlRow: row,
  });
  const def: WorkflowDefinition = {
    id: String(transformed.id),
    inputSchema: transformed.inputSchema,
    outputSchema: transformed.outputSchema,
    graph: transformed.graph as WorkflowDefinition['graph'],
    status: String(transformed.status) as WorkflowDefinition['status'],
    source: String(transformed.source) as WorkflowDefinition['source'],
    createdAt: transformed.createdAt as Date,
    updatedAt: transformed.updatedAt as Date,
  };
  if (transformed.description != null) def.description = String(transformed.description);
  if (transformed.metadata != null) def.metadata = transformed.metadata as Record<string, unknown>;
  if (transformed.stateSchema != null) def.stateSchema = transformed.stateSchema;
  if (transformed.requestContextSchema != null) def.requestContextSchema = transformed.requestContextSchema;
  if (transformed.authorId != null) def.authorId = String(transformed.authorId);
  return def;
}

export class WorkflowDefinitionsMySQL extends WorkflowDefinitionsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  private database?: string;

  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_DEFINITIONS] as const;

  static getExportDDL(): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_WORKFLOW_DEFINITIONS,
        schema: WORKFLOW_DEFINITIONS_SCHEMA,
      }),
    ];
  }

  constructor({ pool, operations, database }: { pool: Pool; operations: StoreOperationsMySQL; database?: string }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.database = database;
  }

  async init(): Promise<void> {
    await this.operations.createTable({
      tableName: TABLE_WORKFLOW_DEFINITIONS,
      schema: WORKFLOW_DEFINITIONS_SCHEMA,
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_WORKFLOW_DEFINITIONS });
  }

  async upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    return this.applyUpsert(input);
  }

  async upsertMany(
    inputs: readonly (CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput)[],
  ): Promise<WorkflowDefinition[]> {
    if (inputs.length === 0) return [];
    return this.operations.withTransaction(async connection => {
      const definitions: WorkflowDefinition[] = [];
      for (const input of inputs) definitions.push(await this.applyUpsert(input, connection));
      return definitions;
    });
  }

  private async loadDefinition(id: string, connection?: PoolConnection): Promise<WorkflowDefinition | null> {
    if (!connection) return this.get(id);
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_WORKFLOW_DEFINITIONS, this.database)} WHERE ${quoteIdentifier('id', 'column name')} = ? FOR UPDATE`,
      [id],
    );
    return rows.length ? rowToDefinition(rows[0] as Record<string, unknown>) : null;
  }

  private async applyUpsert(
    input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput,
    connection?: PoolConnection,
  ): Promise<WorkflowDefinition> {
    const now = new Date();
    const existing = await this.loadDefinition(input.id, connection);

    if (!existing) {
      if (!('inputSchema' in input) || input.inputSchema === undefined)
        throw new Error(`Cannot create workflow definition "${input.id}": inputSchema is required.`);
      if (!('outputSchema' in input) || input.outputSchema === undefined)
        throw new Error(`Cannot create workflow definition "${input.id}": outputSchema is required.`);
      if (!('graph' in input) || input.graph === undefined)
        throw new Error(`Cannot create workflow definition "${input.id}": graph is required.`);

      const record: Record<string, any> = {
        id: input.id,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
        inputSchema: input.inputSchema,
        outputSchema: input.outputSchema,
        stateSchema: input.stateSchema ?? null,
        requestContextSchema: input.requestContextSchema ?? null,
        graph: input.graph,
        status: 'active',
        source: 'storage',
        authorId: 'authorId' in input ? (input.authorId ?? null) : null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        // insertOnly: a plain INSERT so a concurrent create is detected as a
        // duplicate-key error instead of ON DUPLICATE KEY UPDATE silently
        // clobbering the winning row (and its createdAt).
        if (connection) {
          const statement = prepareInsertOnlyStatement({
            tableName: TABLE_WORKFLOW_DEFINITIONS,
            record,
            database: this.database,
          });
          await connection.execute(statement.sql, statement.args);
        } else {
          await this.operations.insertOnly({ tableName: TABLE_WORKFLOW_DEFINITIONS, record });
        }
      } catch (error) {
        // A concurrent upsert may have created the row after our existence
        // check; fall back to updating it so the upsert stays idempotent.
        if (!hasErrorCode(error, new Set([1062, 'ER_DUP_ENTRY']))) throw error;
        if (!(await this.loadDefinition(input.id, connection))) throw error;
        return this.applyUpdate(input, now, connection);
      }
      const created = await this.loadDefinition(input.id, connection);
      if (!created) throw new Error(`Failed to persist workflow definition "${input.id}".`);
      return created;
    }

    return this.applyUpdate(input, now, connection);
  }

  private async applyUpdate(
    input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput,
    now: Date,
    connection?: PoolConnection,
  ): Promise<WorkflowDefinition> {
    const existing = await this.loadDefinition(input.id, connection);
    if (!existing) throw new Error(`Failed to update workflow definition "${input.id}".`);
    assertWorkflowDefinitionAuthor(existing, input);

    const data: Record<string, any> = { updatedAt: now };
    if ('description' in input && input.description !== undefined) data.description = input.description;
    if ('metadata' in input && input.metadata !== undefined) data.metadata = input.metadata;
    if ('inputSchema' in input && input.inputSchema !== undefined) data.inputSchema = input.inputSchema;
    if ('outputSchema' in input && input.outputSchema !== undefined) data.outputSchema = input.outputSchema;
    if ('stateSchema' in input && input.stateSchema !== undefined) data.stateSchema = input.stateSchema;
    if ('requestContextSchema' in input && input.requestContextSchema !== undefined)
      data.requestContextSchema = input.requestContextSchema;
    if ('graph' in input && input.graph !== undefined) data.graph = input.graph;
    if ('status' in input && input.status !== undefined) data.status = input.status;
    const keys = { id: input.id, ...(input.authorId !== undefined ? { authorId: input.authorId } : {}) };
    if (connection) {
      const statement = prepareUpdateStatement({
        tableName: TABLE_WORKFLOW_DEFINITIONS,
        updates: data,
        keys,
        database: this.database,
      });
      await connection.execute(statement.sql, statement.args);
    } else {
      await this.operations.update({ tableName: TABLE_WORKFLOW_DEFINITIONS, keys, data });
    }
    const updated = await this.loadDefinition(input.id, connection);
    if (!updated) throw new Error(`Failed to update workflow definition "${input.id}".`);
    assertWorkflowDefinitionAuthor(updated, input);
    return updated;
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_WORKFLOW_DEFINITIONS, this.database)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [id],
    );
    if (!rows.length) return null;
    return rowToDefinition(rows[0] as Record<string, unknown>);
  }

  async list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput> {
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];
    if (args?.status) {
      conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
      params.push(args.status);
    }
    if (args?.authorId !== undefined) {
      conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`);
      params.push(args.authorId);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_WORKFLOW_DEFINITIONS, this.database)}${where} ORDER BY ${quoteIdentifier('updatedAt', 'column name')} DESC`,
      params,
    );
    const definitions = rows.map(row => rowToDefinition(row as Record<string, unknown>));
    return { definitions, total: definitions.length };
  }

  async delete(id: string): Promise<void> {
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_WORKFLOW_DEFINITIONS, this.database)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [id],
    );
  }
}
