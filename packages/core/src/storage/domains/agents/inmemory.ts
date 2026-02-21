import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  EntityOrderBy,
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

  async getById(id: string): Promise<StorageAgentType | null> {
    this.logger.debug(`InMemoryAgentsStorage: getById called for ${id}`);
    const agent = this.db.agents.get(id);
    return agent ? this.deepCopyAgent(agent) : null;
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;
    this.logger.debug(`InMemoryAgentsStorage: create called for ${agent.id}`);

    if (this.db.agents.has(agent.id)) {
      throw new Error(`Agent with id ${agent.id} already exists`);
    }

    const now = new Date();
    const newAgent: StorageAgentType = {
      id: agent.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: agent.authorId,
      metadata: agent.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.agents.set(agent.id, newAgent);

    // Extract config fields from the flat input (everything except agent-record fields)
    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = agent;

    // Create version 1 from the config
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      agentId: agent.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    // Return the thin agent record (activeVersionId remains null)
    return this.deepCopyAgent(newAgent);
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;
    this.logger.debug(`InMemoryAgentsStorage: update called for ${id}`);

    const existingAgent = this.db.agents.get(id);
    if (!existingAgent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    const { authorId, activeVersionId, metadata, status } = updates;

    const updatedAgent: StorageAgentType = {
      ...existingAgent,
      ...(authorId !== undefined && { authorId }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(metadata !== undefined && {
        metadata: { ...existingAgent.metadata, ...metadata },
      }),
      ...(status !== undefined && { status }),
      updatedAt: new Date(),
    };

    this.db.agents.set(id, updatedAgent);
    return this.deepCopyAgent(updatedAgent);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`InMemoryAgentsStorage: delete called for ${id}`);
    // Idempotent delete - no-op if agent doesn't exist
    this.db.agents.delete(id);
    // Also delete all versions for this agent
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryAgentsStorage: list called`);

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

    // Filter by status
    if (status) {
      agents = agents.filter(agent => agent.status === status);
    }

    // Filter by authorId if provided
    if (authorId !== undefined) {
      agents = agents.filter(agent => agent.authorId === authorId);
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

    // Deep clone agents to avoid mutation
    const clonedAgents = sortedAgents.map(agent => this.deepCopyAgent(agent));

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

    // Check for duplicate (agentId, versionNumber) pair
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === input.agentId && version.versionNumber === input.versionNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for agent ${input.agentId}`);
      }
    }

    const version: AgentVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing to prevent external mutation
    this.db.agentVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    this.logger.debug(`InMemoryAgentsStorage: getVersion called for ${id}`);
    const version = this.db.agentVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    this.logger.debug(`InMemoryAgentsStorage: getVersionByNumber called for agent ${agentId}, v${versionNumber}`);

    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
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
    return latest ? this.deepCopyVersion(latest) : null;
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

    // Deep clone versions to avoid mutation
    const clonedVersions = versions.map(v => this.deepCopyVersion(v));

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

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    this.logger.debug(`InMemoryAgentsStorage: deleteVersionsByParentId called for agent ${entityId}`);

    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.agentVersions.entries()) {
      if (version.agentId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.agentVersions.delete(id);
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

  /**
   * Deep copy a thin agent record to prevent external mutation of stored data
   */
  private deepCopyAgent(agent: StorageAgentType): StorageAgentType {
    return {
      ...agent,
      metadata: agent.metadata ? { ...agent.metadata } : agent.metadata,
    };
  }

  /**
   * Deep copy a version to prevent external mutation of stored data
   */
  private deepCopyVersion(version: AgentVersion): AgentVersion {
    return structuredClone(version);
  }

  private sortAgents(
    agents: StorageAgentType[],
    field: EntityOrderBy,
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
