import type {
  StorageAgentType,
  StorageAgentSnapshotType,
  StorageResolvedAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageListAgentsResolvedOutput,
} from '../../types';
import { VersionedStorageDomain } from '../versioned';
import type { VersionBase, CreateVersionInputBase, ListVersionsInputBase, ListVersionsOutputBase } from '../versioned';

// ============================================================================
// Agent Version Types
// ============================================================================

/**
 * Represents a stored version of an agent configuration.
 * The config fields are top-level on the version row (no nested snapshot object).
 */
export interface AgentVersion extends StorageAgentSnapshotType, VersionBase {
  /** ID of the agent this version belongs to */
  agentId: string;
}

/**
 * Input for creating a new agent version.
 * Config fields are top-level (no nested snapshot object).
 */
export interface CreateVersionInput extends StorageAgentSnapshotType, CreateVersionInputBase {
  /** ID of the agent this version belongs to */
  agentId: string;
}

/**
 * Sort direction for version listings.
 */
export type VersionSortDirection = 'ASC' | 'DESC';

/**
 * Fields that can be used for ordering version listings.
 */
export type VersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing agent versions with pagination and sorting.
 */
export interface ListVersionsInput extends ListVersionsInputBase {
  /** ID of the agent to list versions for */
  agentId: string;
}

/**
 * Output for listing agent versions with pagination info.
 */
export interface ListVersionsOutput extends ListVersionsOutputBase<AgentVersion> {}

// ============================================================================
// AgentsStorage Base Class
// ============================================================================

export abstract class AgentsStorage extends VersionedStorageDomain<
  StorageAgentType,
  StorageAgentSnapshotType,
  StorageResolvedAgentType,
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
  { agent: StorageCreateAgentInput },
  StorageUpdateAgentInput,
  StorageListAgentsInput | undefined,
  StorageListAgentsOutput,
  StorageListAgentsResolvedOutput
> {
  protected readonly listKey = 'agents';
  protected readonly versionMetadataFields = [
    'id',
    'agentId',
    'versionNumber',
    'changedFields',
    'changeMessage',
    'createdAt',
  ];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENTS',
    });
  }

  // ==========================================================================
  // Domain-specific abstract methods (delegates from generic interface)
  // ==========================================================================

  /**
   * Retrieves an agent by its unique identifier (raw thin record, without version resolution).
   */
  abstract getAgentById({ id }: { id: string }): Promise<StorageAgentType | null>;

  /**
   * Creates a new agent in storage.
   */
  abstract createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType>;

  /**
   * Updates an existing agent in storage.
   */
  abstract updateAgent({ id, ...updates }: StorageUpdateAgentInput): Promise<StorageAgentType>;

  /**
   * Deletes an agent from storage.
   */
  abstract deleteAgent({ id }: { id: string }): Promise<void>;

  /**
   * Lists all agents with optional pagination.
   */
  abstract listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput>;

  // ==========================================================================
  // Version methods (domain-specific naming)
  // ==========================================================================

  abstract getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null>;
  abstract getLatestVersion(agentId: string): Promise<AgentVersion | null>;
  abstract listVersions(input: ListVersionsInput): Promise<ListVersionsOutput>;
  abstract deleteVersionsByAgentId(agentId: string): Promise<void>;
  abstract countVersions(agentId: string): Promise<number>;

  // ==========================================================================
  // Bridge: generic interface → domain-specific methods
  // ==========================================================================

  async getEntityById(id: string): Promise<StorageAgentType | null> {
    return this.getAgentById({ id });
  }

  async createEntity(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    return this.createAgent(input);
  }

  async updateEntity(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    return this.updateAgent(input);
  }

  async deleteEntity(id: string): Promise<void> {
    return this.deleteAgent({ id });
  }

  async listEntities(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    return this.listAgents(args);
  }

  async deleteVersionsByEntityId(entityId: string): Promise<void> {
    return this.deleteVersionsByAgentId(entityId);
  }

  // ==========================================================================
  // Public resolution methods (domain-specific naming, delegating to generic)
  // ==========================================================================

  /**
   * Retrieves an agent by its unique identifier, resolving config from the active version.
   */
  async getAgentByIdResolved({ id }: { id: string }): Promise<StorageResolvedAgentType | null> {
    return this.getEntityByIdResolved(id);
  }

  /**
   * Lists all agents with version resolution.
   */
  async listAgentsResolved(args?: StorageListAgentsInput): Promise<StorageListAgentsResolvedOutput> {
    return this.listEntitiesResolved(args);
  }
}
