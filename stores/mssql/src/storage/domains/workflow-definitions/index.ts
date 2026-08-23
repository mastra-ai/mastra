import {
  TABLE_WORKFLOW_DEFINITIONS,
  WORKFLOW_DEFINITIONS_SCHEMA,
  assertWorkflowDefinitionAuthor,
  WorkflowDefinitionsStorage,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  CreateWorkflowDefinitionInput,
  ListWorkflowDefinitionsInput,
  ListWorkflowDefinitionsOutput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
} from '@mastra/core/storage';
import sql from 'mssql';

import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';

function isDeadlockVictim(error: unknown): boolean {
  const seen = new Set<object>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { number?: number; cause?: unknown };
    if (candidate.number === 1205) return true;
    current = candidate.cause;
  }
  return false;
}
import { getSchemaName, getTableName } from '../utils';

function parseJson(value: unknown, column: string, rowId: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      // Surface corruption loudly — returning the raw string would hand
      // callers a definition whose graph/schema is a string, failing much
      // later (or silently) at rehydration time.
      throw new Error(`Workflow definition row "${String(rowId)}" has malformed JSON in column "${column}".`);
    }
  }
  return value;
}

function rowToDefinition(row: Record<string, unknown>): WorkflowDefinition {
  const inputSchema = parseJson(row.inputSchema, 'inputSchema', row.id);
  const outputSchema = parseJson(row.outputSchema, 'outputSchema', row.id);
  const graph = parseJson(row.graph, 'graph', row.id);
  if (inputSchema == null || outputSchema == null || graph == null) {
    throw new Error(`Workflow definition row "${String(row.id)}" is missing required JSON columns.`);
  }
  const def: WorkflowDefinition = {
    id: String(row.id),
    inputSchema,
    outputSchema,
    graph: graph as WorkflowDefinition['graph'],
    status: String(row.status) as WorkflowDefinition['status'],
    source: String(row.source) as WorkflowDefinition['source'],
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
  };
  if (row.description != null) def.description = String(row.description);
  const metadata = parseJson(row.metadata, 'metadata', row.id);
  if (metadata != null) def.metadata = metadata as Record<string, unknown>;
  const stateSchema = parseJson(row.stateSchema, 'stateSchema', row.id);
  if (stateSchema != null) def.stateSchema = stateSchema;
  const requestContextSchema = parseJson(row.requestContextSchema, 'requestContextSchema', row.id);
  if (requestContextSchema != null) def.requestContextSchema = requestContextSchema;
  if (row.authorId != null) def.authorId = String(row.authorId);
  return def;
}

export class WorkflowDefinitionsMSSQL extends WorkflowDefinitionsStorage {
  private pool: sql.ConnectionPool;
  private schema?: string;
  private db: MssqlDB;
  private needsConnect: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_DEFINITIONS] as const;

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName, skipDefaultIndexes });
    this.needsConnect = needsConnect;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx =>
      (WorkflowDefinitionsMSSQL.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({ tableName: TABLE_WORKFLOW_DEFINITIONS, schema: WORKFLOW_DEFINITIONS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  private getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schema && this.schema !== 'dbo' ? `${this.schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_workflow_definitions_status_idx`,
        table: TABLE_WORKFLOW_DEFINITIONS,
        columns: ['status'],
      },
    ];
  }

  private async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  private async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_WORKFLOW_DEFINITIONS });
  }

  async upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    return this.applyUpsert(input);
  }

  async upsertMany(
    inputs: readonly (CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput)[],
  ): Promise<WorkflowDefinition[]> {
    if (inputs.length === 0) return [];
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.upsertManyTransaction(inputs);
      } catch (error) {
        if (!isDeadlockVictim(error) || attempt >= 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 10 * 2 ** attempt));
      }
    }
  }

  private async upsertManyTransaction(
    inputs: readonly (CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput)[],
  ): Promise<WorkflowDefinition[]> {
    const transaction = this.pool.transaction();
    try {
      await transaction.begin();
      const definitions: WorkflowDefinition[] = [];
      for (const input of inputs) definitions.push(await this.applyUpsert(input, transaction));
      await transaction.commit();
      return definitions;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch {
        // Preserve the persistence error that caused the rollback.
      }
      throw error;
    }
  }

  private async loadDefinition(id: string, transaction?: sql.Transaction): Promise<WorkflowDefinition | null> {
    if (!transaction) return this.get(id);
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_DEFINITIONS,
      schemaName: getSchemaName(this.schema),
    });
    const request = new sql.Request(transaction);
    request.input('workflowDefinitionId', id);
    const result = await request.query(
      `SELECT * FROM ${tableName} WITH (UPDLOCK, HOLDLOCK) WHERE [id] = @workflowDefinitionId`,
    );
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    return row ? rowToDefinition(row) : null;
  }

  private async applyUpsert(
    input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput,
    transaction?: sql.Transaction,
  ): Promise<WorkflowDefinition> {
    const now = new Date();
    const existing = await this.loadDefinition(input.id, transaction);

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
        await this.db.insert({ tableName: TABLE_WORKFLOW_DEFINITIONS, record, transaction });
      } catch (error) {
        // A concurrent upsert may have created the row after our existence
        // check; fall back to updating it so the upsert stays idempotent.
        if (!(await this.loadDefinition(input.id, transaction))) throw error;
        return this.applyUpdate(input, now, transaction);
      }
      const created = await this.loadDefinition(input.id, transaction);
      if (!created) throw new Error(`Failed to persist workflow definition "${input.id}".`);
      return created;
    }

    return this.applyUpdate(input, now, transaction);
  }

  private async applyUpdate(
    input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput,
    now: Date,
    transaction?: sql.Transaction,
  ): Promise<WorkflowDefinition> {
    const existing = await this.loadDefinition(input.id, transaction);
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
    await this.db.update({ tableName: TABLE_WORKFLOW_DEFINITIONS, keys, data, transaction });
    const updated = await this.loadDefinition(input.id, transaction);
    if (!updated) throw new Error(`Failed to update workflow definition "${input.id}".`);
    assertWorkflowDefinitionAuthor(updated, input);
    return updated;
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    const row = await this.db.load<Record<string, unknown>>({
      tableName: TABLE_WORKFLOW_DEFINITIONS,
      keys: { id },
    });
    return row ? rowToDefinition(row) : null;
  }

  async list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput> {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_DEFINITIONS,
      schemaName: getSchemaName(this.schema),
    });
    const request = this.pool.request();
    const conditions: string[] = [];
    if (args?.status) {
      request.input('status', args.status);
      conditions.push(`[status] = @status`);
    }
    if (args?.authorId !== undefined) {
      request.input('authorId', args.authorId);
      conditions.push(`[authorId] = @authorId`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await request.query(`SELECT * FROM ${tableName} ${where} ORDER BY [updatedAt] DESC`);
    const definitions = (result.recordset as Record<string, unknown>[]).map(rowToDefinition);
    return { definitions, total: definitions.length };
  }

  async delete(id: string): Promise<void> {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_DEFINITIONS,
      schemaName: getSchemaName(this.schema),
    });
    const request = this.pool.request();
    request.input('id', id);
    await request.query(`DELETE FROM ${tableName} WHERE [id] = @id`);
  }
}
