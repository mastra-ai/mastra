import { deepEqual } from '../../../utils';
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
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
  VersionOrderBy,
  VersionSortDirection,
} from './base';
import { AgentsStorage } from './base';

export class InMemoryAgentsStorage extends AgentsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.agents.clear();
    this.db.agentVersions.clear();
  }

  // ==========================================================================
  // Agent CRUD Methods
  // ==========================================================================

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
      ...(updates.ownerId !== undefined && { ownerId: updates.ownerId }),
      ...(updates.activeVersionId !== undefined && { activeVersionId: updates.activeVersionId }),
      ...(updates.integrations !== undefined && { integrations: updates.integrations }),
      ...(updates.integrationTools !== undefined && { integrationTools: updates.integrationTools }),
      updatedAt: new Date(),
    };

    this.db.agents.set(id, updatedAgent);
    return { ...updatedAgent };
  }

  async deleteAgent({ id }: { id: string }): Promise<void> {
    this.logger.debug(`InMemoryAgentsStorage: deleteAgent called for ${id}`);
    // Idempotent delete - no-op if agent doesn't exist
    this.db.agents.delete(id);
    // Also delete all versions for this agent
    await this.deleteVersionsByAgentId(id);
  }

  async listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = args || {};
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

    // Get all agents and apply filters
    let agents = Array.from(this.db.agents.values());

    // Filter by ownerId if provided
    if (ownerId !== undefined) {
      agents = agents.filter(agent => agent.ownerId === ownerId);
    }

    // Filter by metadata if provided (AND logic - all key-value pairs must match)
    if (metadata && Object.keys(metadata).length > 0) {
      agents = agents.filter(agent => {
        if (!agent.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => deepEqual(agent.metadata![key], value));
      });
    }

    // Sort filtered agents
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

  // ==========================================================================
  // Agent Version Methods
  // ==========================================================================

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    this.logger.debug(`InMemoryAgentsStorage: createVersion called for agent ${input.agentId}`);

    // Check if version with this ID already exists (versions are immutable)
    if (this.db.agentVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    const version: AgentVersion = {
      ...input,
      createdAt: new Date(),
    };

    this.db.agentVersions.set(input.id, version);
    return { ...version };
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    this.logger.debug(`InMemoryAgentsStorage: getVersion called for ${id}`);
    const version = this.db.agentVersions.get(id);
    return version ? { ...version } : null;
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    this.logger.debug(`InMemoryAgentsStorage: getVersionByNumber called for agent ${agentId}, v${versionNumber}`);

    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId && version.versionNumber === versionNumber) {
        return { ...version };
      }
    }
    return null;
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    this.logger.debug(`InMemoryAgentsStorage: getLatestVersion called for agent ${agentId}`);

    let latest: AgentVersion | null = null;
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? { ...latest } : null;
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    this.logger.debug(`InMemoryAgentsStorage: listVersions called for agent ${agentId}`);

    // Normalize perPage for query (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by agentId
    let versions = Array.from(this.db.agentVersions.values()).filter(v => v.agentId === agentId);

    // Sort versions
    versions = this.sortVersions(versions, field, direction);

    // Clone versions to avoid mutation
    const clonedVersions = versions.map(v => ({ ...v }));

    const total = clonedVersions.length;
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const paginatedVersions = clonedVersions.slice(offset, offset + perPage);

    return {
      versions: paginatedVersions,
      total,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    this.logger.debug(`InMemoryAgentsStorage: deleteVersion called for ${id}`);
    // Idempotent delete - no-op if version doesn't exist
    this.db.agentVersions.delete(id);
  }

  async deleteVersionsByAgentId(agentId: string): Promise<void> {
    this.logger.debug(`InMemoryAgentsStorage: deleteVersionsByAgentId called for agent ${agentId}`);

    for (const [id, version] of this.db.agentVersions.entries()) {
      if (version.agentId === agentId) {
        this.db.agentVersions.delete(id);
      }
    }
  }

  async countVersions(agentId: string): Promise<number> {
    this.logger.debug(`InMemoryAgentsStorage: countVersions called for agent ${agentId}`);

    let count = 0;
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

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

  private sortVersions(
    versions: AgentVersion[],
    field: VersionOrderBy,
    direction: VersionSortDirection,
  ): AgentVersion[] {
    return versions.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (field === 'createdAt') {
        aVal = a.createdAt.getTime();
        bVal = b.createdAt.getTime();
      } else {
        // versionNumber
        aVal = a.versionNumber;
        bVal = b.versionNumber;
      }

      return direction === 'ASC' ? aVal - bVal : bVal - aVal;
    });
  }
}
