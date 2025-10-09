import { MastraBase } from '../../../base';
import type { MemoryConfig } from '../../../memory/types';

export type AgentReference = {
  agentId: string;
  from: 'CODE' | 'CONFIG';
};

/**
 * Serializable memory configuration for agents.
 * Omits non-serializable properties like storage, vector, embedder, and processors
 * which will be provided by the base Mastra instance.
 */
export type SerializableMemoryConfig = MemoryConfig;

export interface StorageAgentType {
  id: string;
  name: string;
  description?: string;
  workflowIds?: string[];
  agentIds?: AgentReference[];
  toolIds?: string[];
  model: string;
  instructions: string;
  memoryConfig?: SerializableMemoryConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentConfig {
  id: string;
  name: string;
  description?: string;
  workflowIds?: string[];
  agentIds?: AgentReference[];
  toolIds?: string[];
  model: string;
  instructions: string;
  memoryConfig?: SerializableMemoryConfig;
}

export abstract class AgentsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENTS',
    });
  }

  abstract createAgent(config: CreateAgentConfig): Promise<void>;

  abstract getAgent(id: string): Promise<StorageAgentType | null>;

  abstract listAgents(): Promise<StorageAgentType[]>;

  abstract updateAgent(id: string, updates: Partial<Omit<CreateAgentConfig, 'id'>>): Promise<StorageAgentType | null>;

  abstract deleteAgent(id: string): Promise<void>;
}
