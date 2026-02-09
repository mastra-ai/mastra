import type {
  StorageAgentType,
  StorageAgentSnapshotType,
  StorageResolvedAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageListAgentsResolvedOutput,
  StorageOrderBy,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import { StorageDomain } from '../base';

// ============================================================================
// Agent Version Types
// ============================================================================

/**
 * Represents a stored version of an agent configuration.
 * The config fields are top-level on the version row (no nested snapshot object).
 */
export interface AgentVersion extends StorageAgentSnapshotType {
  /** UUID identifier for this version */
  id: string;
  /** ID of the agent this version belongs to */
  agentId: string;
  /** Sequential version number (1, 2, 3, ...) */
  versionNumber: number;
  /** Array of field names that changed from the previous version */
  changedFields?: string[];
  /** Optional message describing the changes */
  changeMessage?: string;
  /** When this version was created */
  createdAt: Date;
}

/**
 * Input for creating a new agent version.
 * Config fields are top-level (no nested snapshot object).
 */
export interface CreateVersionInput extends StorageAgentSnapshotType {
  /** UUID identifier for this version */
  id: string;
  /** ID of the agent this version belongs to */
  agentId: string;
  /** Sequential version number */
  versionNumber: number;
  /** Array of field names that changed from the previous version */
  changedFields?: string[];
  /** Optional message describing the changes */
  changeMessage?: string;
}

/**
 * Sort direction for version listings.
 */
export type VersionSortDirection = ThreadSortDirection;

/**
 * Fields that can be used for ordering version listings.
 */
export type VersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing agent versions with pagination and sorting.
 */
export interface ListVersionsInput {
  /** ID of the agent to list versions for */
  agentId: string;
  /** Page number (0-indexed) */
  page?: number;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 20 if not specified.
   */
  perPage?: number | false;
  /** Sorting options */
  orderBy?: {
    field?: VersionOrderBy;
    direction?: VersionSortDirection;
  };
}

/**
 * Output for listing agent versions with pagination info.
 */
export interface ListVersionsOutput {
  /** Array of versions for the current page */
  versions: AgentVersion[];
  /** Total number of versions */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number | false;
  /** Whether there are more pages */
  hasMore: boolean;
}

// ============================================================================
// Constants for validation
// ============================================================================

const AGENT_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const AGENT_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};

const VERSION_ORDER_BY_SET: Record<VersionOrderBy, true> = {
  versionNumber: true,
  createdAt: true,
};

// ============================================================================
// AgentsStorage Base Class
// ============================================================================

export abstract class AgentsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENTS',
    });
  }

  // ==========================================================================
  // Agent CRUD Methods
  // ==========================================================================

  /**
   * Retrieves an agent by its unique identifier (raw thin record, without version resolution).
   * @param id - The unique identifier of the agent
   * @returns The thin agent record if found, null otherwise
   */
  abstract getAgentById({ id }: { id: string }): Promise<StorageAgentType | null>;

  /**
   * Retrieves an agent by its unique identifier, resolving config from the active version.
   * This is the preferred method for fetching stored agents as it ensures the returned
   * configuration matches the active version.
   *
   * @param id - The unique identifier of the agent
   * @returns The resolved agent (metadata + version config), or null if not found
   */
  async getAgentByIdResolved({ id }: { id: string }): Promise<StorageResolvedAgentType | null> {
    const agent = await this.getAgentById({ id });

    if (!agent) {
      return null;
    }

    // Try to get the version to merge with
    let version: AgentVersion | null = null;

    // If an active version is set, use that
    if (agent.activeVersionId) {
      version = await this.getVersion(agent.activeVersionId);

      // Warn if activeVersionId points to a non-existent version
      if (!version) {
        console.warn(
          `[AgentsStorage] Agent ${agent.id} has activeVersionId ${agent.activeVersionId} but version not found. Falling back to latest version.`,
        );
      }
    }

    // If no active version or it wasn't found, fall back to latest version
    if (!version) {
      version = await this.getLatestVersion(agent.id);
    }

    // If we have a version, merge its config with agent metadata
    if (version) {
      // Extract snapshot config fields from the version
      const {
        id: _versionId,
        agentId: _agentId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...snapshotConfig
      } = version;

      // Return merged agent metadata + version config
      return {
        ...agent,
        ...snapshotConfig,
      };
    }

    // No versions exist - return thin record cast as resolved (config fields will be undefined)
    return agent as StorageResolvedAgentType;
  }

  /**
   * Lists all agents with version resolution.
   * For each agent that has an activeVersionId, the config is resolved from the version.
   *
   * @param args - Pagination and ordering options
   * @returns Paginated list of resolved agents
   */
  async listAgentsResolved(args?: StorageListAgentsInput): Promise<StorageListAgentsResolvedOutput> {
    const result = await this.listAgents(args);

    // Resolve each agent's active version or latest version
    const resolvedAgents = await Promise.all(
      result.agents.map(async agent => {
        // Try to get the version to merge with
        let version: AgentVersion | null = null;

        // If an active version is set, use that
        if (agent.activeVersionId) {
          version = await this.getVersion(agent.activeVersionId);
        }

        // If no active version or it wasn't found, fall back to latest version
        if (!version) {
          version = await this.getLatestVersion(agent.id);
        }

        // If we have a version, merge its config with agent metadata
        if (version) {
          const {
            id: _versionId,
            agentId: _agentId,
            versionNumber: _versionNumber,
            changedFields: _changedFields,
            changeMessage: _changeMessage,
            createdAt: _createdAt,
            ...snapshotConfig
          } = version;

          return {
            ...agent,
            ...snapshotConfig,
          } as StorageResolvedAgentType;
        }

        // No versions exist - return thin record cast as resolved
        return agent as StorageResolvedAgentType;
      }),
    );

    return {
      ...result,
      agents: resolvedAgents,
    };
  }

  /**
   * Creates a new agent in storage.
   * @param agent - The agent data to create (thin record fields + initial snapshot)
   * @returns The created thin agent record with timestamps
   */
  abstract createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType>;

  /**
   * Updates an existing agent in storage.
   * @param id - The unique identifier of the agent to update
   * @param updates - The fields to update
   * @returns The updated thin agent record
   */
  abstract updateAgent({ id, ...updates }: StorageUpdateAgentInput): Promise<StorageAgentType>;

  /**
   * Deletes an agent from storage.
   * @param id - The unique identifier of the agent to delete
   */
  abstract deleteAgent({ id }: { id: string }): Promise<void>;

  /**
   * Lists all agents with optional pagination.
   * @param args - Pagination and ordering options
   * @returns Paginated list of thin agent records
   */
  abstract listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput>;

  // ==========================================================================
  // Agent Version Methods
  // ==========================================================================

  /**
   * Creates a new version record for an agent.
   * @param input - The version data to create (config fields are top-level)
   * @returns The created version with timestamp
   */
  abstract createVersion(input: CreateVersionInput): Promise<AgentVersion>;

  /**
   * Retrieves a version by its unique ID.
   * @param id - The UUID of the version
   * @returns The version if found, null otherwise
   */
  abstract getVersion(id: string): Promise<AgentVersion | null>;

  /**
   * Retrieves a version by agent ID and version number.
   * @param agentId - The ID of the agent
   * @param versionNumber - The sequential version number
   * @returns The version if found, null otherwise
   */
  abstract getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null>;

  /**
   * Retrieves the latest (highest version number) version for an agent.
   * @param agentId - The ID of the agent
   * @returns The latest version if found, null otherwise
   */
  abstract getLatestVersion(agentId: string): Promise<AgentVersion | null>;

  /**
   * Lists versions for an agent with pagination and sorting.
   * @param input - Pagination and filter options
   * @returns Paginated list of versions
   */
  abstract listVersions(input: ListVersionsInput): Promise<ListVersionsOutput>;

  /**
   * Deletes a specific version by ID.
   * @param id - The UUID of the version to delete
   */
  abstract deleteVersion(id: string): Promise<void>;

  /**
   * Deletes all versions for an agent.
   * @param agentId - The ID of the agent
   */
  abstract deleteVersionsByAgentId(agentId: string): Promise<void>;

  /**
   * Counts the total number of versions for an agent.
   * @param agentId - The ID of the agent
   * @returns The count of versions
   */
  abstract countVersions(agentId: string): Promise<number>;

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  /**
   * Parses orderBy input for consistent agent sorting behavior.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in AGENT_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in AGENT_SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }

  /**
   * Parses orderBy input for consistent version sorting behavior.
   */
  protected parseVersionOrderBy(
    orderBy?: ListVersionsInput['orderBy'],
    defaultDirection: VersionSortDirection = 'DESC',
  ): { field: VersionOrderBy; direction: VersionSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in VERSION_ORDER_BY_SET ? orderBy.field : 'versionNumber',
      direction:
        orderBy?.direction && orderBy.direction in AGENT_SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }
}
