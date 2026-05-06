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
  ] satisfies (keyof AgentVersion)[];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENTS',
    });
  }
}
