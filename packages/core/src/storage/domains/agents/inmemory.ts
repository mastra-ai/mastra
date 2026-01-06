import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { AgentsStorage } from './base';

export class InMemoryAgentsStorage extends AgentsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.agents.clear();
  }

  async getAgentById({ id }: { id: string }): Promise<StorageAgentType | null> {
    this.logger.debug(`InMemoryAgentsStorage: getAgentById called for ${id}`);
    const agent = this.db.agents.get(id);
    return agent
      ? {
          ...agent,
          metadata: agent.metadata ? { ...agent.metadata } : agent.metadata,
          model: { ...agent.model },
          tools: agent.tools ? [...agent.tools] : agent.tools,
          workflows: agent.workflows ? [...agent.workflows] : agent.workflows,
          agents: agent.agents ? [...agent.agents] : agent.agents,
          scorers: agent.scorers ? { ...agent.scorers } : agent.scorers,
        }
      : null;
  }

  async createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    this.logger.debug(`InMemoryAgentsStorage: createAgent called for ${agent.id}`);

    if (this.db.agents.has(agent.id)) {
      throw new Error(`Agent with id ${agent.id} already exists`);
    }

    const now = new Date();
    const newAgent: StorageAgentType = {
      ...agent,
      createdAt: now,
      updatedAt: now,
    };

    this.db.agents.set(agent.id, newAgent);
    return { ...newAgent };
  }

  async updateAgent({ id, ...updates }: StorageUpdateAgentInput): Promise<StorageAgentType> {
    this.logger.debug(`InMemoryAgentsStorage: updateAgent called for ${id}`);

    const existingAgent = this.db.agents.get(id);
    if (!existingAgent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    const updatedAgent: StorageAgentType = {
      ...existingAgent,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.instructions !== undefined && { instructions: updates.instructions }),
      ...(updates.model !== undefined && { model: updates.model }),
      ...(updates.tools !== undefined && { tools: updates.tools }),
      ...(updates.defaultOptions !== undefined && {
        defaultOptions: updates.defaultOptions,
      }),
      ...(updates.workflows !== undefined && { workflows: updates.workflows }),
      ...(updates.agents !== undefined && { agents: updates.agents }),
      ...(updates.inputProcessors !== undefined && { inputProcessors: updates.inputProcessors }),
      ...(updates.outputProcessors !== undefined && { outputProcessors: updates.outputProcessors }),
      ...(updates.memory !== undefined && { memory: updates.memory }),
      ...(updates.scorers !== undefined && { scorers: updates.scorers }),
      ...(updates.metadata !== undefined && {
        metadata: { ...existingAgent.metadata, ...updates.metadata },
      }),
      updatedAt: new Date(),
    };

    this.db.agents.set(id, updatedAgent);
    return { ...updatedAgent };
  }

  async deleteAgent({ id }: { id: string }): Promise<void> {
    this.logger.debug(`InMemoryAgentsStorage: deleteAgent called for ${id}`);
    // Idempotent delete - no-op if agent doesn't exist
    this.db.agents.delete(id);
  }

  async listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page = 0, perPage: perPageInput, orderBy } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryAgentsStorage: listAgents called`);

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 100)
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Get all agents and sort them
    const agents = Array.from(this.db.agents.values());
    const sortedAgents = this.sortAgents(agents, field, direction);

    // Clone agents to avoid mutation
    const clonedAgents = sortedAgents.map(agent => ({
      ...agent,
      metadata: agent.metadata ? { ...agent.metadata } : agent.metadata,
      model: { ...agent.model },
      tools: agent.tools ? [...agent.tools] : agent.tools,
      workflows: agent.workflows ? [...agent.workflows] : agent.workflows,
      agents: agent.agents ? [...agent.agents] : agent.agents,
      scorers: agent.scorers ? { ...agent.scorers } : agent.scorers,
    }));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      agents: clonedAgents.slice(offset, offset + perPage),
      total: clonedAgents.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedAgents.length,
    };
  }

  private sortAgents(
    agents: StorageAgentType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StorageAgentType[] {
    return agents.sort((a, b) => {
      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }
}
