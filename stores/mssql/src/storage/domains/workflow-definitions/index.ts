import {
  TABLE_WORKFLOW_DEFINITIONS,
  WORKFLOW_DEFINITIONS_SCHEMA,
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
import type sql from 'mssql';

import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

function parseJson(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function rowToDefinition(row: Record<string, unknown>): WorkflowDefinition {
  const inputSchema = parseJson(row.inputSchema);
  const outputSchema = parseJson(row.outputSchema);
  const graph = parseJson(row.graph);
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
  const metadata = parseJson(row.metadata);
  if (metadata != null) def.metadata = metadata as Record<string, unknown>;
  const stateSchema = parseJson(row.stateSchema);
  if (stateSchema != null) def.stateSchema = stateSchema;
  const requestContextSchema = parseJson(row.requestContextSchema);
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
    const now = new Date();
    const existing = await this.get(input.id);

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
      await this.db.insert({ tableName: TABLE_WORKFLOW_DEFINITIONS, record });
      const created = await this.get(input.id);
      if (!created) throw new Error(`Failed to persist workflow definition "${input.id}".`);
      return created;
    }

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

    await this.db.update({ tableName: TABLE_WORKFLOW_DEFINITIONS, keys: { id: input.id }, data });
    const updated = await this.get(input.id);
    if (!updated) throw new Error(`Failed to update workflow definition "${input.id}".`);
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
