import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
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
 */
export interface AgentVersion {
  /** ULID identifier for this version */
  id: string;
  /** ID of the agent this version belongs to */
  agentId: string;
  /** Sequential version number (1, 2, 3, ...) */
  versionNumber: number;
  /** Optional vanity name for this version */
  name?: string;
  /** Full agent configuration snapshot */
  snapshot: StorageAgentType;
  /** Array of field names that changed from the previous version */
  changedFields?: string[];
  /** Optional message describing the changes */
  changeMessage?: string;
  /** When this version was created */
  createdAt: Date;
}

/**
 * Input for creating a new agent version.
 */
export interface CreateVersionInput {
  /** ULID identifier for this version */
  id: string;
  /** ID of the agent this version belongs to */
  agentId: string;
  /** Sequential version number */
  versionNumber: number;
  /** Optional vanity name for this version */
  name?: string;
  /** Full agent configuration snapshot */
  snapshot: StorageAgentType;
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
   * Retrieves an agent by its unique identifier.
   * @param id - The unique identifier of the agent
   * @returns The agent if found, null otherwise
   */
  abstract getAgentById({ id }: { id: string }): Promise<StorageAgentType | null>;

  /**
   * Creates a new agent in storage.
   * @param agent - The agent data to create
   * @returns The created agent with timestamps
   */
  abstract createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType>;

  /**
   * Updates an existing agent in storage.
   * @param id - The unique identifier of the agent to update
   * @param updates - The fields to update
   * @returns The updated agent
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
   * @returns Paginated list of agents
   */
  abstract listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput>;

  // ==========================================================================
  // Agent Version Methods
  // ==========================================================================

  /**
   * Creates a new version record for an agent.
   * @param input - The version data to create
   * @returns The created version with timestamp
   */
  abstract createVersion(input: CreateVersionInput): Promise<AgentVersion>;

  /**
   * Retrieves a version by its unique ID.
   * @param id - The ULID of the version
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
   * @param id - The ULID of the version to delete
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
