import type { StoreOperations } from '../operations/base';
import { AgentsStorage } from './base';
import type { StorageAgentType, CreateAgentConfig } from './base';

export type InMemoryAgents = Map<
  string,
  {
    id: string;
    name: string;
    workflowIds: string; // JSON string
    agentIds: string; // JSON string
    toolIds: string; // JSON string
    model: string;
    instructions: string;
    createdAt: Date;
    updatedAt: Date;
  }
>;

export class AgentsInMemory extends AgentsStorage {
  private collection: InMemoryAgents;
  private operations: StoreOperations;

  constructor({ collection, operations }: { collection: InMemoryAgents; operations: StoreOperations }) {
    super();
    this.collection = collection;
    this.operations = operations;
  }

  async createAgent(config: CreateAgentConfig): Promise<void> {
    const agentData = {
      id: config.id,
      name: config.name,
      workflowIds: JSON.stringify(config.workflowIds),
      agentIds: JSON.stringify(config.agentIds),
      toolIds: JSON.stringify(config.toolIds),
      model: config.model,
      instructions: config.instructions,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.collection.set(config.id, agentData);
  }

  async getAgent(id: string): Promise<StorageAgentType | null> {
    const agentData = this.collection.get(id);

    if (!agentData) {
      return null;
    }

    return {
      id: agentData.id,
      name: agentData.name,
      workflowIds: JSON.parse(agentData.workflowIds),
      agentIds: JSON.parse(agentData.agentIds),
      toolIds: JSON.parse(agentData.toolIds),
      model: agentData.model,
      instructions: agentData.instructions,
      createdAt: agentData.createdAt,
      updatedAt: agentData.updatedAt,
    };
  }

  async listAgents(): Promise<StorageAgentType[]> {
    const agents: StorageAgentType[] = [];

    for (const [_, agentData] of this.collection) {
      agents.push({
        id: agentData.id,
        name: agentData.name,
        workflowIds: JSON.parse(agentData.workflowIds),
        agentIds: JSON.parse(agentData.agentIds),
        toolIds: JSON.parse(agentData.toolIds),
        model: agentData.model,
        instructions: agentData.instructions,
        createdAt: agentData.createdAt,
        updatedAt: agentData.updatedAt,
      });
    }

    // Sort by createdAt DESC (newest first)
    return agents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateAgent(id: string, updates: Partial<Omit<CreateAgentConfig, 'id'>>): Promise<StorageAgentType | null> {
    const existingAgent = this.collection.get(id);

    if (!existingAgent) {
      return null;
    }

    const updatedAgent = {
      ...existingAgent,
      name: updates.name ?? existingAgent.name,
      workflowIds: updates.workflowIds ? JSON.stringify(updates.workflowIds) : existingAgent.workflowIds,
      agentIds: updates.agentIds ? JSON.stringify(updates.agentIds) : existingAgent.agentIds,
      toolIds: updates.toolIds ? JSON.stringify(updates.toolIds) : existingAgent.toolIds,
      model: updates.model ?? existingAgent.model,
      instructions: updates.instructions ?? existingAgent.instructions,
      updatedAt: new Date(),
    };

    this.collection.set(id, updatedAgent);

    return {
      id: updatedAgent.id,
      name: updatedAgent.name,
      workflowIds: JSON.parse(updatedAgent.workflowIds),
      agentIds: JSON.parse(updatedAgent.agentIds),
      toolIds: JSON.parse(updatedAgent.toolIds),
      model: updatedAgent.model,
      instructions: updatedAgent.instructions,
      createdAt: updatedAgent.createdAt,
      updatedAt: updatedAgent.updatedAt,
    };
  }

  async deleteAgent(id: string): Promise<void> {
    this.collection.delete(id);
  }
}
