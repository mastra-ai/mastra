import type { Database } from '@google-cloud/spanner';
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

import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

function rowToDefinition(row: Record<string, any>): WorkflowDefinition {
  const parsed = transformFromSpannerRow<Record<string, any>>({
    tableName: TABLE_WORKFLOW_DEFINITIONS,
    row,
  });
  const def: WorkflowDefinition = {
    id: String(parsed.id),
    inputSchema: parsed.inputSchema,
    outputSchema: parsed.outputSchema,
    graph: parsed.graph,
    status: parsed.status,
    source: parsed.source,
    createdAt: parsed.createdAt instanceof Date ? parsed.createdAt : new Date(parsed.createdAt),
    updatedAt: parsed.updatedAt instanceof Date ? parsed.updatedAt : new Date(parsed.updatedAt),
  };
  if (parsed.description != null) def.description = parsed.description;
  if (parsed.metadata != null) def.metadata = parsed.metadata;
  if (parsed.stateSchema != null) def.stateSchema = parsed.stateSchema;
  if (parsed.requestContextSchema != null) def.requestContextSchema = parsed.requestContextSchema;
  if (parsed.authorId != null) def.authorId = parsed.authorId;
  return def;
}

export class WorkflowDefinitionsSpanner extends WorkflowDefinitionsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_DEFINITIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx =>
      (WorkflowDefinitionsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    await this.db.createTable({
      tableName: TABLE_WORKFLOW_DEFINITIONS,
      schema: WORKFLOW_DEFINITIONS_SCHEMA,
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  private getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_workflow_definitions_status_idx',
        table: TABLE_WORKFLOW_DEFINITIONS,
        columns: ['status'],
      },
    ];
  }

  private async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  private async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
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
    const row = await this.db.load<Record<string, any>>({
      tableName: TABLE_WORKFLOW_DEFINITIONS,
      keys: { id },
    });
    return row ? rowToDefinition(row) : null;
  }

  async list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput> {
    const params: Record<string, any> = {};
    const conditions: string[] = [];
    if (args?.status) {
      params.status = args.status;
      conditions.push(`${quoteIdent('status', 'column name')} = @status`);
    }
    if (args?.authorId !== undefined) {
      params.authorId = args.authorId;
      conditions.push(`${quoteIdent('authorId', 'column name')} = @authorId`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM ${quoteIdent(TABLE_WORKFLOW_DEFINITIONS, 'table name')} ${where} ORDER BY ${quoteIdent('updatedAt', 'column name')} DESC`;
    const [rows] = await this.database.run({ sql, params, json: true });
    const definitions = (rows as Array<Record<string, any>>).map(rowToDefinition);
    return { definitions, total: definitions.length };
  }

  async delete(id: string): Promise<void> {
    await this.db.runDml({
      sql: `DELETE FROM ${quoteIdent(TABLE_WORKFLOW_DEFINITIONS, 'table name')} WHERE id = @id`,
      params: { id },
    });
  }
}
