import type {
  StoredScorerType,
  StorageCreateScorerInput,
  StorageUpdateScorerInput,
  StorageListScorersInput,
  StorageListScorersOutput,
  StorageOrderBy,
  ThreadOrderBy,
  ThreadSortDirection,
  StoredScorerVersionType,
  StorageCreateScorerVersionInput,
} from '../../types';
import { StorageDomain } from '../base';

// ============================================================================
// Scorer Version Types
// ============================================================================

/**
 * Sort direction for version listings.
 */
export type ScorerVersionSortDirection = ThreadSortDirection;

/**
 * Fields that can be used for ordering version listings.
 */
export type ScorerVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing scorer versions with pagination and sorting.
 */
export interface ListScorerVersionsInput {
  /** ID of the scorer to list versions for */
  scorerId: string;
  /** Page number (0-indexed) */
  page?: number;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 20 if not specified.
   */
  perPage?: number | false;
  /** Sorting options */
  orderBy?: {
    field?: ScorerVersionOrderBy;
    direction?: ScorerVersionSortDirection;
  };
}

/**
 * Output for listing scorer versions with pagination info.
 */
export interface ListScorerVersionsOutput {
  /** Array of versions for the current page */
  versions: StoredScorerVersionType[];
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

const SCORER_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const SCORER_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};

const SCORER_VERSION_ORDER_BY_SET: Record<ScorerVersionOrderBy, true> = {
  versionNumber: true,
  createdAt: true,
};

// ============================================================================
// StoredScorersStorage Base Class
// ============================================================================

export abstract class StoredScorersStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'STORED_SCORERS',
    });
  }

  // ==========================================================================
  // Scorer CRUD Methods
  // ==========================================================================

  /**
   * Retrieves a scorer by its unique identifier (raw, without version resolution).
   * @param id - The unique identifier of the scorer
   * @returns The scorer if found, null otherwise
   */
  abstract getScorerById({ id }: { id: string }): Promise<StoredScorerType | null>;

  /**
   * Retrieves a scorer by its unique identifier, resolving from the active version if set.
   * This is the preferred method for fetching stored scorers as it ensures the returned
   * configuration matches the active version.
   *
   * @param id - The unique identifier of the scorer
   * @returns The scorer config (from active version snapshot if set), or null if not found
   */
  async getScorerByIdResolved({ id }: { id: string }): Promise<StoredScorerType | null> {
    const scorer = await this.getScorerById({ id });

    if (!scorer) {
      return null;
    }

    // If an active version is set, resolve from that version's snapshot
    if (scorer.activeVersionId) {
      const activeVersion = await this.getScorerVersion(scorer.activeVersionId);
      if (activeVersion) {
        // Return the snapshot with id and activeVersionId preserved from the current scorer record
        return {
          ...(activeVersion.snapshot as unknown as StoredScorerType),
          id: scorer.id,
          activeVersionId: scorer.activeVersionId,
        };
      }
    }

    return scorer;
  }

  /**
   * Lists all scorers with version resolution.
   * For each scorer that has an activeVersionId, the config is resolved from the version snapshot.
   *
   * @param args - Pagination and ordering options
   * @returns Paginated list of resolved scorers
   */
  async listScorersResolved(args?: StorageListScorersInput): Promise<StorageListScorersOutput> {
    const result = await this.listScorers(args);

    // Resolve each scorer's active version
    const resolvedScorers = await Promise.all(
      result.scorers.map(async scorer => {
        if (scorer.activeVersionId) {
          const activeVersion = await this.getScorerVersion(scorer.activeVersionId);
          if (activeVersion) {
            return {
              ...(activeVersion.snapshot as unknown as StoredScorerType),
              // Ensure id and activeVersionId are preserved from the current scorer record
              id: scorer.id,
              activeVersionId: scorer.activeVersionId,
            };
          }
        }
        return scorer;
      }),
    );

    return {
      ...result,
      scorers: resolvedScorers,
    };
  }

  /**
   * Creates a new scorer in storage.
   * @param scorer - The scorer data to create
   * @returns The created scorer with timestamps
   */
  abstract createScorer({ scorer }: { scorer: StorageCreateScorerInput }): Promise<StoredScorerType>;

  /**
   * Updates an existing scorer in storage.
   * @param id - The unique identifier of the scorer to update
   * @param updates - The fields to update
   * @returns The updated scorer
   */
  abstract updateScorer({ id, ...updates }: StorageUpdateScorerInput): Promise<StoredScorerType>;

  /**
   * Deletes a scorer from storage.
   * @param id - The unique identifier of the scorer to delete
   */
  abstract deleteScorer({ id }: { id: string }): Promise<void>;

  /**
   * Lists all scorers with optional pagination.
   * @param args - Pagination and ordering options
   * @returns Paginated list of scorers
   */
  abstract listScorers(args?: StorageListScorersInput): Promise<StorageListScorersOutput>;

  // ==========================================================================
  // Scorer Version Methods
  // ==========================================================================

  /**
   * Creates a new version record for a scorer.
   * @param input - The version data to create
   * @returns The created version with timestamp
   */
  abstract createScorerVersion(input: StorageCreateScorerVersionInput): Promise<StoredScorerVersionType>;

  /**
   * Retrieves a version by its unique ID.
   * @param id - The UUID of the version
   * @returns The version if found, null otherwise
   */
  abstract getScorerVersion(id: string): Promise<StoredScorerVersionType | null>;

  /**
   * Retrieves a version by scorer ID and version number.
   * @param scorerId - The ID of the scorer
   * @param versionNumber - The sequential version number
   * @returns The version if found, null otherwise
   */
  abstract getScorerVersionByNumber(scorerId: string, versionNumber: number): Promise<StoredScorerVersionType | null>;

  /**
   * Retrieves the latest (highest version number) version for a scorer.
   * @param scorerId - The ID of the scorer
   * @returns The latest version if found, null otherwise
   */
  abstract getLatestScorerVersion(scorerId: string): Promise<StoredScorerVersionType | null>;

  /**
   * Lists versions for a scorer with pagination and sorting.
   * @param input - Pagination and filter options
   * @returns Paginated list of versions
   */
  abstract listScorerVersions(input: ListScorerVersionsInput): Promise<ListScorerVersionsOutput>;

  /**
   * Deletes a specific version by ID.
   * @param id - The UUID of the version to delete
   */
  abstract deleteScorerVersion(id: string): Promise<void>;

  /**
   * Deletes all versions for a scorer.
   * @param scorerId - The ID of the scorer
   */
  abstract deleteScorerVersionsByScorerId(scorerId: string): Promise<void>;

  /**
   * Counts the total number of versions for a scorer.
   * @param scorerId - The ID of the scorer
   * @returns The count of versions
   */
  abstract countScorerVersions(scorerId: string): Promise<number>;

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  /**
   * Parses orderBy input for consistent scorer sorting behavior.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in SCORER_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in SCORER_SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }

  /**
   * Parses orderBy input for consistent version sorting behavior.
   */
  protected parseScorerVersionOrderBy(
    orderBy?: ListScorerVersionsInput['orderBy'],
    defaultDirection: ScorerVersionSortDirection = 'DESC',
  ): { field: ScorerVersionOrderBy; direction: ScorerVersionSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in SCORER_VERSION_ORDER_BY_SET ? orderBy.field : 'versionNumber',
      direction:
        orderBy?.direction && orderBy.direction in SCORER_SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }
}
