import type { InMemoryDB } from '../inmemory-db';
import type {
  CreateWorkflowDefinitionInput,
  ListWorkflowDefinitionsInput,
  ListWorkflowDefinitionsOutput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinition,
} from './base';
import { WorkflowDefinitionsStorage } from './base';

export class InMemoryWorkflowDefinitionsStorage extends WorkflowDefinitionsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.workflowDefinitions.clear();
  }

  async upsert(input: CreateWorkflowDefinitionInput | UpdateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    const now = new Date();
    const existing = this.db.workflowDefinitions.get(input.id);

    if (existing) {
      const merged: WorkflowDefinition = {
        ...existing,
        ...('description' in input && input.description !== undefined && { description: input.description }),
        ...('metadata' in input && input.metadata !== undefined && { metadata: input.metadata }),
        ...('inputSchema' in input && input.inputSchema !== undefined && { inputSchema: input.inputSchema }),
        ...('outputSchema' in input && input.outputSchema !== undefined && { outputSchema: input.outputSchema }),
        ...('stateSchema' in input && input.stateSchema !== undefined && { stateSchema: input.stateSchema }),
        ...('requestContextSchema' in input &&
          input.requestContextSchema !== undefined && { requestContextSchema: input.requestContextSchema }),
        ...('graph' in input && input.graph !== undefined && { graph: input.graph }),
        ...('status' in input && input.status !== undefined && { status: input.status }),
        updatedAt: now,
      };
      this.db.workflowDefinitions.set(input.id, merged);
      return this.deepCopy(merged);
    }

    // Creation requires the full schema set + graph
    if (!('inputSchema' in input) || !('outputSchema' in input) || !('graph' in input)) {
      throw new Error(
        `Cannot create workflow definition "${input.id}": inputSchema, outputSchema, and graph are required.`,
      );
    }

    const def: WorkflowDefinition = {
      id: input.id,
      description: input.description,
      metadata: input.metadata,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      stateSchema: input.stateSchema,
      requestContextSchema: input.requestContextSchema,
      graph: input.graph!,
      status: 'active',
      source: 'storage',
      authorId: 'authorId' in input ? input.authorId : undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.db.workflowDefinitions.set(input.id, def);
    return this.deepCopy(def);
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    const def = this.db.workflowDefinitions.get(id);
    return def ? this.deepCopy(def) : null;
  }

  async list(args?: ListWorkflowDefinitionsInput): Promise<ListWorkflowDefinitionsOutput> {
    let defs = Array.from(this.db.workflowDefinitions.values());
    if (args?.status) defs = defs.filter(d => d.status === args.status);
    if (args?.authorId !== undefined) defs = defs.filter(d => d.authorId === args.authorId);
    const cloned = defs.map(d => this.deepCopy(d));
    return { definitions: cloned, total: cloned.length };
  }

  async delete(id: string): Promise<void> {
    this.db.workflowDefinitions.delete(id);
  }

  private deepCopy(def: WorkflowDefinition): WorkflowDefinition {
    return structuredClone(def);
  }
}
