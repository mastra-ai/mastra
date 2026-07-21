import { TABLE_WORKFLOW_DEFINITIONS, WorkflowDefinitionsStorage } from '@mastra/core/storage';
import type {
  CreateWorkflowDefinitionInput,
  ListWorkflowDefinitionsInput,
  ListWorkflowDefinitionsOutput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
} from '@mastra/core/storage';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

function docToDefinition(doc: Record<string, any>): WorkflowDefinition {
  const def: WorkflowDefinition = {
    id: String(doc.id),
    inputSchema: doc.inputSchema,
    outputSchema: doc.outputSchema,
    graph: doc.graph,
    status: doc.status,
    source: doc.source,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
  };
  if (doc.description != null) def.description = doc.description;
  if (doc.metadata != null) def.metadata = doc.metadata;
  if (doc.stateSchema != null) def.stateSchema = doc.stateSchema;
  if (doc.requestContextSchema != null) def.requestContextSchema = doc.requestContextSchema;
  if (doc.authorId != null) def.authorId = doc.authorId;
  return def;
}

export class MongoDBWorkflowDefinitionsStore extends WorkflowDefinitionsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_WORKFLOW_DEFINITIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBWorkflowDefinitionsStore.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_WORKFLOW_DEFINITIONS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_WORKFLOW_DEFINITIONS, keys: { status: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection(TABLE_WORKFLOW_DEFINITIONS);
    await collection.deleteMany({});
  }

  async upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    const now = new Date();
    const collection = await this.getCollection(TABLE_WORKFLOW_DEFINITIONS);
    const existing = await collection.findOne<Record<string, any>>({ id: input.id });

    if (!existing) {
      if (!('inputSchema' in input) || input.inputSchema === undefined)
        throw new Error(`Cannot create workflow definition "${input.id}": inputSchema is required.`);
      if (!('outputSchema' in input) || input.outputSchema === undefined)
        throw new Error(`Cannot create workflow definition "${input.id}": outputSchema is required.`);
      if (!('graph' in input) || input.graph === undefined)
        throw new Error(`Cannot create workflow definition "${input.id}": graph is required.`);

      const doc: Record<string, any> = {
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
      await collection.insertOne(doc);
      return docToDefinition(doc);
    }

    const update: Record<string, any> = { updatedAt: now };
    if ('description' in input && input.description !== undefined) update.description = input.description;
    if ('metadata' in input && input.metadata !== undefined) update.metadata = input.metadata;
    if ('inputSchema' in input && input.inputSchema !== undefined) update.inputSchema = input.inputSchema;
    if ('outputSchema' in input && input.outputSchema !== undefined) update.outputSchema = input.outputSchema;
    if ('stateSchema' in input && input.stateSchema !== undefined) update.stateSchema = input.stateSchema;
    if ('requestContextSchema' in input && input.requestContextSchema !== undefined)
      update.requestContextSchema = input.requestContextSchema;
    if ('graph' in input && input.graph !== undefined) update.graph = input.graph;
    if ('status' in input && input.status !== undefined) update.status = input.status;

    await collection.updateOne({ id: input.id }, { $set: update });
    const merged = { ...existing, ...update, id: input.id, createdAt: existing.createdAt };
    return docToDefinition(merged);
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    const collection = await this.getCollection(TABLE_WORKFLOW_DEFINITIONS);
    const doc = await collection.findOne<Record<string, any>>({ id });
    return doc ? docToDefinition(doc) : null;
  }

  async list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput> {
    const collection = await this.getCollection(TABLE_WORKFLOW_DEFINITIONS);
    const filter: Record<string, unknown> = {};
    if (args?.status) filter.status = args.status;
    if (args?.authorId !== undefined) filter.authorId = args.authorId;
    const docs = await collection.find<Record<string, any>>(filter).sort({ updatedAt: -1 }).toArray();
    const definitions = docs.map(docToDefinition);
    return { definitions, total: definitions.length };
  }

  async delete(id: string): Promise<void> {
    const collection = await this.getCollection(TABLE_WORKFLOW_DEFINITIONS);
    await collection.deleteOne({ id });
  }
}
