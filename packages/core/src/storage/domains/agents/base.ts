import { MastraBase } from '../../../base';

export interface StorageAgentType {
  id: string;
  name: string;
  workflowIds: string[];
  agentIds: string[];
  toolIds: string[];
  model: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentConfig {
  id: string;
  name: string;
  workflowIds: string[];
  agentIds: string[];
  toolIds: string[];
  model: string;
  instructions: string;
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
