import type {
  StorageScorerDefinitionType,
  StorageScorerDefinitionSnapshotType,
  StorageResolvedScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  StorageListScorerDefinitionsResolvedOutput,
  StorageOrderBy,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import { StorageDomain } from '../base';

// ============================================================================
// Scorer Definition Version Types
// ============================================================================

/**
 * Represents a stored version of a scorer definition's content.
 * Config fields are top-level on the version row (no nested snapshot object).
 */
export interface ScorerDefinitionVersion extends StorageScorerDefinitionSnapshotType {
  /** UUID identifier for this version */
  id: string;
  /** ID of the scorer definition this version belongs to */
  scorerDefinitionId: string;
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
 * Input for creating a new scorer definition version.
 * Config fields are top-level (no nested snapshot object).
 */
export interface CreateScorerDefinitionVersionInput extends StorageScorerDefinitionSnapshotType {
  /** UUID identifier for this version */
  id: string;
  /** ID of the scorer definition this version belongs to */
  scorerDefinitionId: string;
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
export type ScorerDefinitionVersionSortDirection = ThreadSortDirection;

/**
 * Fields that can be used for ordering version listings.
 */
export type ScorerDefinitionVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing scorer definition versions with pagination and sorting.
 */
export interface ListScorerDefinitionVersionsInput {
  /** ID of the scorer definition to list versions for */
  scorerDefinitionId: string;
  /** Page number (0-indexed) */
  page?: number;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 20 if not specified.
   */
  perPage?: number | false;
  /** Sorting options */
  orderBy?: {
    field?: ScorerDefinitionVersionOrderBy;
    direction?: ScorerDefinitionVersionSortDirection;
  };
}

/**
 * Output for listing scorer definition versions with pagination info.
 */
export interface ListScorerDefinitionVersionsOutput {
  /** Array of versions for the current page */
  versions: ScorerDefinitionVersion[];
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

const SCORER_DEFINITION_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const SCORER_DEFINITION_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};

const VERSION_ORDER_BY_SET: Record<ScorerDefinitionVersionOrderBy, true> = {
  versionNumber: true,
  createdAt: true,
};

// ============================================================================
// ScorerDefinitionsStorage Base Class
// ============================================================================

export abstract class ScorerDefinitionsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'SCORER_DEFINITIONS',
    });
  }

  // ==========================================================================
  // Scorer Definition CRUD Methods
  // ==========================================================================

  /**
   * Retrieves a scorer definition by its unique identifier (raw thin record, without version resolution).
   * @param id - The unique identifier of the scorer definition
   * @returns The thin scorer definition record if found, null otherwise
   */
  abstract getScorerDefinitionById({ id }: { id: string }): Promise<StorageScorerDefinitionType | null>;

  /**
   * Retrieves a scorer definition by its unique identifier, resolving config from the active version.
   * This is the preferred method for fetching scorer definitions as it ensures the returned
   * configuration matches the active version.
   *
   * @param id - The unique identifier of the scorer definition
   * @returns The resolved scorer definition (metadata + version config), or null if not found
   */
  async getScorerDefinitionByIdResolved({ id }: { id: string }): Promise<StorageResolvedScorerDefinitionType | null> {
    const scorer = await this.getScorerDefinitionById({ id });

    if (!scorer) {
      return null;
    }

    // Try to get the version to merge with
    let version: ScorerDefinitionVersion | null = null;

    // If an active version is set, use that
    if (scorer.activeVersionId) {
      version = await this.getVersion(scorer.activeVersionId);

      // Warn if activeVersionId points to a non-existent version
      if (!version) {
        this.logger?.warn?.(
          `Scorer definition ${scorer.id} has activeVersionId ${scorer.activeVersionId} but version not found. Falling back to latest version.`,
        );
      }
    }

    // If no active version or it wasn't found, fall back to latest version
    if (!version) {
      version = await this.getLatestVersion(scorer.id);
    }

    // If we have a version, merge its config with scorer metadata
    if (version) {
      // Extract snapshot config fields from the version
      const {
        id: _versionId,
        scorerDefinitionId: _scorerDefinitionId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...snapshotConfig
      } = version;

      // Return merged scorer metadata + version config
      return {
        ...scorer,
        ...snapshotConfig,
      };
    }

    // No versions exist - return thin record cast as resolved (config fields will be undefined)
    return scorer as StorageResolvedScorerDefinitionType;
  }

  /**
   * Lists all scorer definitions with version resolution.
   * For each scorer definition that has an activeVersionId, the config is resolved from the version.
   *
   * @param args - Pagination and ordering options
   * @returns Paginated list of resolved scorer definitions
   */
  async listScorerDefinitionsResolved(
    args?: StorageListScorerDefinitionsInput,
  ): Promise<StorageListScorerDefinitionsResolvedOutput> {
    const result = await this.listScorerDefinitions(args);

    // Resolve each scorer definition's active version or latest version
    const resolvedScorers = await Promise.all(
      result.scorerDefinitions.map(async scorer => {
        // Try to get the version to merge with
        let version: ScorerDefinitionVersion | null = null;

        // If an active version is set, use that
        if (scorer.activeVersionId) {
          version = await this.getVersion(scorer.activeVersionId);
        }

        // If no active version or it wasn't found, fall back to latest version
        if (!version) {
          version = await this.getLatestVersion(scorer.id);
        }

        // If we have a version, merge its config with scorer metadata
        if (version) {
          const {
            id: _versionId,
            scorerDefinitionId: _scorerDefinitionId,
            versionNumber: _versionNumber,
            changedFields: _changedFields,
            changeMessage: _changeMessage,
            createdAt: _createdAt,
            ...snapshotConfig
          } = version;

          return {
            ...scorer,
            ...snapshotConfig,
          } as StorageResolvedScorerDefinitionType;
        }

        // No versions exist - return thin record cast as resolved
        return scorer as StorageResolvedScorerDefinitionType;
      }),
    );

    return {
      ...result,
      scorerDefinitions: resolvedScorers,
    };
  }

  /**
   * Creates a new scorer definition in storage.
   * @param scorerDefinition - The scorer definition data to create (thin record fields + initial snapshot)
   * @returns The created thin scorer definition record with timestamps
   */
  abstract createScorerDefinition({
    scorerDefinition,
  }: {
    scorerDefinition: StorageCreateScorerDefinitionInput;
  }): Promise<StorageScorerDefinitionType>;

  /**
   * Updates an existing scorer definition in storage.
   * @param id - The unique identifier of the scorer definition to update
   * @param updates - The fields to update
   * @returns The updated thin scorer definition record
   */
  abstract updateScorerDefinition({
    id,
    ...updates
  }: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType>;

  /**
   * Deletes a scorer definition from storage.
   * @param id - The unique identifier of the scorer definition to delete
   */
  abstract deleteScorerDefinition({ id }: { id: string }): Promise<void>;

  /**
   * Lists all scorer definitions with optional pagination.
   * @param args - Pagination and ordering options
   * @returns Paginated list of thin scorer definition records
   */
  abstract listScorerDefinitions(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput>;

  // ==========================================================================
  // Scorer Definition Version Methods
  // ==========================================================================

  /**
   * Creates a new version record for a scorer definition.
   * @param input - The version data to create (config fields are top-level)
   * @returns The created version with timestamp
   */
  abstract createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion>;

  /**
   * Retrieves a version by its unique ID.
   * @param id - The UUID of the version
   * @returns The version if found, null otherwise
   */
  abstract getVersion(id: string): Promise<ScorerDefinitionVersion | null>;

  /**
   * Retrieves a version by scorer definition ID and version number.
   * @param scorerDefinitionId - The ID of the scorer definition
   * @param versionNumber - The version number to look up
   * @returns The version if found, null otherwise
   */
  abstract getVersionByNumber(
    scorerDefinitionId: string,
    versionNumber: number,
  ): Promise<ScorerDefinitionVersion | null>;

  /**
   * Retrieves the latest (highest versionNumber) version for a scorer definition.
   * @param scorerDefinitionId - The ID of the scorer definition
   * @returns The latest version if found, null otherwise
   */
  abstract getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null>;

  /**
   * Lists versions for a scorer definition with pagination and sorting.
   * @param input - Pagination and filter options
   * @returns Paginated list of versions
   */
  abstract listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput>;

  /**
   * Deletes a specific version by ID.
   * @param id - The UUID of the version to delete
   */
  abstract deleteVersion(id: string): Promise<void>;

  /**
   * Deletes all versions for a scorer definition.
   * @param scorerDefinitionId - The ID of the scorer definition
   */
  abstract deleteVersionsByScorerDefinitionId(scorerDefinitionId: string): Promise<void>;

  /**
   * Counts the total number of versions for a scorer definition.
   * @param scorerDefinitionId - The ID of the scorer definition
   * @returns The count of versions
   */
  abstract countVersions(scorerDefinitionId: string): Promise<number>;

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  /**
   * Parses orderBy input for consistent scorer definition sorting behavior.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in SCORER_DEFINITION_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in SCORER_DEFINITION_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }

  /**
   * Parses orderBy input for consistent version sorting behavior.
   */
  protected parseVersionOrderBy(
    orderBy?: ListScorerDefinitionVersionsInput['orderBy'],
    defaultDirection: ScorerDefinitionVersionSortDirection = 'DESC',
  ): { field: ScorerDefinitionVersionOrderBy; direction: ScorerDefinitionVersionSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in VERSION_ORDER_BY_SET ? orderBy.field : 'versionNumber',
      direction:
        orderBy?.direction && orderBy.direction in SCORER_DEFINITION_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }
}
