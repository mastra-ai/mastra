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

  async getById(id: string): Promise<StorageAgentType | null> {
    const agent = this.db.agents.get(id);
    return agent ? this.deepCopyAgent(agent) : null;
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;

    if (this.db.agents.has(agent.id)) {
      throw new Error(`Agent with id ${agent.id} already exists`);
    }

    const now = new Date();
    // Default visibility to 'private' when an authorId is set; leave undefined for legacy unowned rows.
    const visibility = agent.visibility ?? (agent.authorId ? 'private' : undefined);
    const newAgent: StorageAgentType = {
      id: agent.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: agent.authorId,
      visibility,
      metadata: agent.metadata,
      starCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.db.agents.set(agent.id, newAgent);

    // Extract config fields from the flat input (everything except agent-record fields)
    const { id: _id, authorId: _authorId, visibility: _visibility, metadata: _metadata, ...snapshotConfig } = agent;

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

    const existingAgent = this.db.agents.get(id);
    if (!existingAgent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    const { authorId, visibility, activeVersionId, metadata, status } = updates;

    const updatedAgent: StorageAgentType = {
      ...existingAgent,
      ...(authorId !== undefined && { authorId }),
      ...(visibility !== undefined && { visibility }),
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
    // Idempotent delete - no-op if agent doesn't exist
    this.db.agents.delete(id);
    // Also delete all versions for this agent
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const {
      page = 0,
      perPage: perPageInput,
      orderBy,
      authorId,
      visibility,
      metadata,
      status,
      entityIds,
      pinStarredFor,
    } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

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

    // Restrict to a set of IDs (used by ?starredOnly=true).
    // An empty array means "no candidates" -> empty result.
    if (entityIds !== undefined) {
      if (entityIds.length === 0) {
        return {
          agents: [],
          total: 0,
          page,
          perPage: perPageInput === false ? false : perPage,
          hasMore: false,
        };
      }
      const idSet = new Set(entityIds);
      agents = agents.filter(agent => idSet.has(agent.id));
    }

    // Filter by status
    if (status) {
      agents = agents.filter(agent => agent.status === status);
    }

    // Filter by authorId if provided
    if (authorId !== undefined) {
      agents = agents.filter(agent => agent.authorId === authorId);
    }

    // Filter by visibility if provided
    if (visibility !== undefined) {
      agents = agents.filter(agent => agent.visibility === visibility);
    }

    // Filter by metadata if provided (AND logic - all key-value pairs must match)
    if (metadata && Object.keys(metadata).length > 0) {
      agents = agents.filter(agent => {
        if (!agent.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => deepEqual(agent.metadata![key], value));
      });
    }

    // Sort filtered agents (with optional starred-first compound sort)
    const starredIds = pinStarredFor ? this.collectStarredIdsFor(pinStarredFor) : undefined;
    const sortedAgents = this.sortAgents(agents, field, direction, starredIds);

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
    const version = this.db.agentVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    for (const version of this.db.agentVersions.values()) {
      if (version.agentId === agentId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
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
    // Idempotent delete - no-op if version doesn't exist
    this.db.agentVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
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
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
    starredIds?: Set<string>,
  ): StorageAgentType[] {
    return agents.sort((a, b) => {
      // Compound sort: starred first, then existing orderBy, then id ASC for stable pagination.
      if (starredIds) {
        const aStar = starredIds.has(a.id) ? 1 : 0;
        const bStar = starredIds.has(b.id) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
      }

      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();
      if (aValue !== bValue) {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }

      // Stable tie-break for same `createdAt`/`updatedAt`.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  /**
   * Collect the set of agent IDs starred by the given user. Returns an empty
   * Set when the stars domain is not wired or the user has no stars.
   */
  private collectStarredIdsFor(userId: string): Set<string> {
    const starred = new Set<string>();
    for (const row of this.db.stars.values()) {
      if (row.userId === userId && row.entityType === 'agent') {
        starred.add(row.entityId);
      }
    }
    return starred;
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
