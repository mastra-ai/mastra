import {
  assertWorkflowDefinitionAuthor,
  TABLE_SCHEMAS,
  TABLE_WORKFLOW_DEFINITIONS,
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

import type { TxClient } from '../../client';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getSchemaName, getTableName, parseJsonResilient } from '../utils';

function rowToDefinition(row: Record<string, unknown>): WorkflowDefinition {
  const inputSchema = parseJsonResilient(row.inputSchema);
  const outputSchema = parseJsonResilient(row.outputSchema);
  const graph = parseJsonResilient(row.graph);
  if (inputSchema === undefined || outputSchema === undefined || graph === undefined) {
    throw new Error(`Workflow definition row "${String(row.id)}" is missing required JSON columns.`);
  }
  const def: WorkflowDefinition = {
    id: String(row.id),
    inputSchema,
    outputSchema,
    graph: graph as WorkflowDefinition['graph'],
    status: String(row.status) as WorkflowDefinition['status'],
    source: String(row.source) as WorkflowDefinition['source'],
    createdAt: new Date((row.createdAtZ ?? row.createdAt) as string | number | Date),
    updatedAt: new Date((row.updatedAtZ ?? row.updatedAt) as string | number | Date),
  };
  if (row.description != null) def.description = String(row.description);
  const metadata = parseJsonResilient(row.metadata);
  if (metadata !== undefined && metadata !== null) def.metadata = metadata as Record<string, unknown>;
  const stateSchema = parseJsonResilient(row.stateSchema);
  if (stateSchema !== undefined && stateSchema !== null) def.stateSchema = stateSchema;
  const requestContextSchema = parseJsonResilient(row.requestContextSchema);
  if (requestContextSchema !== undefined && requestContextSchema !== null) {
    def.requestContextSchema = requestContextSchema;
  }
  if (row.authorId != null) def.authorId = String(row.authorId);
  return def;
}

export class WorkflowDefinitionsPG extends WorkflowDefinitionsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_WORKFLOW_DEFINITIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx =>
      (WorkflowDefinitionsPG.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  static getExportDDL(schemaName?: string): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_WORKFLOW_DEFINITIONS,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_DEFINITIONS],
        schemaName,
        includeAllConstraints: true,
      }),
    ];
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return [
      {
        name: `${schemaPrefix}idx_workflow_definitions_status`,
        table: TABLE_WORKFLOW_DEFINITIONS,
        columns: ['status'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_WORKFLOW_DEFINITIONS,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_DEFINITIONS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_WORKFLOW_DEFINITIONS });
  }

  async upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    return this.applyUpsert(input);
  }

  async upsertMany(
    inputs: readonly (CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput)[],
  ): Promise<WorkflowDefinition[]> {
    if (inputs.length === 0) return [];
    return this.#db.client.tx(async transaction => {
      const definitions: WorkflowDefinition[] = [];
      for (const input of inputs) definitions.push(await this.applyUpsert(input, transaction));
      return definitions;
    });
  }

  private tableName(): string {
    return getTableName({
      indexName: TABLE_WORKFLOW_DEFINITIONS,
      schemaName: getSchemaName(this.#schema),
    });
  }

  private async loadDefinition(id: string, transaction?: TxClient): Promise<WorkflowDefinition | null> {
    if (!transaction) return this.get(id);
    const row = await transaction.oneOrNone(`SELECT * FROM ${this.tableName()} WHERE "id" = $1 FOR UPDATE`, [id]);
    return row ? rowToDefinition(row as Record<string, unknown>) : null;
  }

  private async applyUpsert(
    input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput,
    transaction?: TxClient,
  ): Promise<WorkflowDefinition> {
    const now = new Date();
    const existing = await this.loadDefinition(input.id, transaction);

    if (!existing) {
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
        if (transaction) {
          const columns = Object.keys(record);
          const insertResult = await transaction.query(
            `INSERT INTO ${this.tableName()} (${columns.map(column => `"${column}"`).join(', ')}) VALUES (${columns
              .map((_, index) => `$${index + 1}`)
              .join(', ')}) ON CONFLICT ("id") DO NOTHING`,
            columns.map(column => record[column]),
          );
          if (insertResult.rowCount === 0) return this.applyUpdate(input, now, transaction);
        } else {
          await this.#db.insert({ tableName: TABLE_WORKFLOW_DEFINITIONS, record });
        }
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
    transaction?: TxClient,
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
    if (transaction) {
      const fields = Object.keys(data);
      const values = fields.map(field => data[field]);
      values.push(input.id);
      let where = `"id" = $${values.length}`;
      if (input.authorId !== undefined) {
        values.push(input.authorId);
        where += ` AND "authorId" = $${values.length}`;
      }
      await transaction.query(
        `UPDATE ${this.tableName()} SET ${fields.map((field, index) => `"${field}" = $${index + 1}`).join(', ')} WHERE ${where}`,
        values,
      );
    } else {
      await this.#db.update({ tableName: TABLE_WORKFLOW_DEFINITIONS, keys, data });
    }
    const updated = await this.loadDefinition(input.id, transaction);
    if (!updated) throw new Error(`Failed to update workflow definition "${input.id}".`);
    assertWorkflowDefinitionAuthor(updated, input);
    return updated;
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${this.tableName()} WHERE "id" = $1`, [id]);
    return row ? rowToDefinition(row as Record<string, unknown>) : null;
  }

  async list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput> {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_DEFINITIONS,
      schemaName: getSchemaName(this.#schema),
    });
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (args?.status) {
      params.push(args.status);
      conditions.push(`"status" = $${params.length}`);
    }
    if (args?.authorId !== undefined) {
      params.push(args.authorId);
      conditions.push(`"authorId" = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.#db.client.manyOrNone(
      `SELECT * FROM ${tableName} ${where} ORDER BY "updatedAt" DESC`,
      params,
    );
    const definitions = rows.map(row => rowToDefinition(row as Record<string, unknown>));
    return { definitions, total: definitions.length };
  }

  async delete(id: string): Promise<void> {
    const tableName = getTableName({
      indexName: TABLE_WORKFLOW_DEFINITIONS,
      schemaName: getSchemaName(this.#schema),
    });
    await this.#db.client.none(`DELETE FROM ${tableName} WHERE "id" = $1`, [id]);
  }
}
