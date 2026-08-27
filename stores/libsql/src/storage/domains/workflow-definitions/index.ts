import type {
  CreateWorkflowDefinitionInput,
  ListWorkflowDefinitionsInput,
  ListWorkflowDefinitionsOutput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
} from '@mastra/core/storage';
import { TABLE_SCHEMAS, TABLE_WORKFLOW_DEFINITIONS, WorkflowDefinitionsStorage } from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client, SqliteInValue as InValue } from '../../db/client';
import { buildSelectColumns } from '../../db/utils';

function parseJson<T = unknown>(val: unknown, column: string, rowId: unknown): T | undefined {
  if (val == null) return undefined;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      // Surface corruption loudly — returning the raw string would hand
      // callers a definition whose graph/schema is a string, failing much
      // later (or silently) at rehydration time.
      throw new Error(`Workflow definition row "${String(rowId)}" has malformed JSON in column "${column}".`);
    }
  }
  return val as T;
}

function rowToDefinition(row: Record<string, any>): WorkflowDefinition {
  const inputSchema = parseJson(row.inputSchema, 'inputSchema', row.id);
  const outputSchema = parseJson(row.outputSchema, 'outputSchema', row.id);
  const graph = parseJson(row.graph, 'graph', row.id);
  if (inputSchema === undefined || outputSchema === undefined || graph === undefined) {
    throw new Error(`Workflow definition row "${row.id}" is missing required JSON columns.`);
  }
  const def: WorkflowDefinition = {
    id: String(row.id),
    inputSchema,
    outputSchema,
    graph: graph as WorkflowDefinition['graph'],
    status: row.status as WorkflowDefinition['status'],
    source: row.source as WorkflowDefinition['source'],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
  if (row.description != null) def.description = String(row.description);
  const metadata = parseJson<Record<string, unknown>>(row.metadata, 'metadata', row.id);
  if (metadata !== undefined) def.metadata = metadata;
  const stateSchema = parseJson(row.stateSchema, 'stateSchema', row.id);
  if (stateSchema !== undefined) def.stateSchema = stateSchema;
  const requestContextSchema = parseJson(row.requestContextSchema, 'requestContextSchema', row.id);
  if (requestContextSchema !== undefined) def.requestContextSchema = requestContextSchema;
  if (row.authorId != null) def.authorId = String(row.authorId);
  return def;
}

export class WorkflowDefinitionsLibSQL extends WorkflowDefinitionsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_WORKFLOW_DEFINITIONS,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_DEFINITIONS],
    });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON "${TABLE_WORKFLOW_DEFINITIONS}" ("status")`,
      args: [],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_WORKFLOW_DEFINITIONS });
  }

  async upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    const now = new Date();
    const existing = await this.get(input.id);

    if (!existing) {
      // Create — every required field must be present
      if (!('inputSchema' in input) || !input.inputSchema)
        throw new Error(`Cannot create workflow definition "${input.id}": inputSchema is required.`);
      if (!('outputSchema' in input) || !input.outputSchema)
        throw new Error(`Cannot create workflow definition "${input.id}": outputSchema is required.`);
      if (!('graph' in input) || !input.graph)
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
        // key violation instead of INSERT OR REPLACE silently clobbering the
        // winning row (and its createdAt).
        await this.#db.insertOnly({ tableName: TABLE_WORKFLOW_DEFINITIONS, record });
      } catch (error) {
        // A concurrent upsert may have created the row after our existence
        // check; fall back to updating it so the upsert stays idempotent.
        if (!(await this.get(input.id))) throw error;
        return this.#applyUpdate(input, now);
      }
      const created = await this.get(input.id);
      if (!created) throw new Error(`Failed to persist workflow definition "${input.id}".`);
      return created;
    }

    return this.#applyUpdate(input, now);
  }

  async #applyUpdate(
    input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput,
    now: Date,
  ): Promise<WorkflowDefinition> {
    // Update — only patch fields present in the input
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
    if ('authorId' in input && input.authorId !== undefined) data.authorId = input.authorId;

    await this.#db.update({ tableName: TABLE_WORKFLOW_DEFINITIONS, keys: { id: input.id }, data });
    const updated = await this.get(input.id);
    if (!updated) throw new Error(`Failed to update workflow definition "${input.id}".`);
    return updated;
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_WORKFLOW_DEFINITIONS)} FROM "${TABLE_WORKFLOW_DEFINITIONS}" WHERE id = ?`,
      args: [id],
    });
    const row = result.rows[0];
    return row ? rowToDefinition(row as Record<string, any>) : null;
  }

  async list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput> {
    const conditions: string[] = [];
    const params: InValue[] = [];
    if (args?.status) {
      conditions.push('status = ?');
      params.push(args.status);
    }
    if (args?.authorId !== undefined) {
      conditions.push('authorId = ?');
      params.push(args.authorId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_WORKFLOW_DEFINITIONS)} FROM "${TABLE_WORKFLOW_DEFINITIONS}" ${where} ORDER BY updatedAt DESC`,
      args: params,
    });
    const definitions = result.rows.map(row => rowToDefinition(row as Record<string, any>));
    return { definitions, total: definitions.length };
  }

  async delete(id: string): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM "${TABLE_WORKFLOW_DEFINITIONS}" WHERE id = ?`,
      args: [id],
    });
  }
}
