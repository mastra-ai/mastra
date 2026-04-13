import type {
  StorageScorerDefinitionType,
  StorageScorerDefinitionSnapshotType,
  StorageResolvedScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  StorageListScorerDefinitionsResolvedOutput,
} from '../../types';
import { VersionedStorageDomain } from '../versioned';
import type { VersionBase, CreateVersionInputBase, ListVersionsInputBase, ListVersionsOutputBase } from '../versioned';

// ============================================================================
// Scorer Definition Version Types
// ============================================================================

/**
 * Represents a stored version of a scorer definition's content.
 * Config fields are top-level on the version row (no nested snapshot object).
 */
export interface ScorerDefinitionVersion extends StorageScorerDefinitionSnapshotType, VersionBase {
  /** ID of the scorer definition this version belongs to */
  scorerDefinitionId: string;
}

/**
 * Input for creating a new scorer definition version.
 * Config fields are top-level (no nested snapshot object).
 */
export interface CreateScorerDefinitionVersionInput
  extends StorageScorerDefinitionSnapshotType, CreateVersionInputBase {
  /** ID of the scorer definition this version belongs to */
  scorerDefinitionId: string;
}

/**
 * Sort direction for version listings.
 */
export type ScorerDefinitionVersionSortDirection = 'ASC' | 'DESC';

/**
 * Fields that can be used for ordering version listings.
 */
export type ScorerDefinitionVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing scorer definition versions with pagination and sorting.
 */
export interface ListScorerDefinitionVersionsInput extends ListVersionsInputBase {
  /** ID of the scorer definition to list versions for */
  scorerDefinitionId: string;
}

/**
 * Output for listing scorer definition versions with pagination info.
 */
export interface ListScorerDefinitionVersionsOutput extends ListVersionsOutputBase<ScorerDefinitionVersion> {}

// ============================================================================
// ScorerDefinitionsStorage Base Class
// ============================================================================

export abstract class ScorerDefinitionsStorage extends VersionedStorageDomain<
  StorageScorerDefinitionType,
  StorageScorerDefinitionSnapshotType,
  StorageResolvedScorerDefinitionType,
  ScorerDefinitionVersion,
  CreateScorerDefinitionVersionInput,
  ListScorerDefinitionVersionsInput,
  ListScorerDefinitionVersionsOutput,
  { scorerDefinition: StorageCreateScorerDefinitionInput },
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput | undefined,
  StorageListScorerDefinitionsOutput,
  StorageListScorerDefinitionsResolvedOutput
> {
  protected readonly listKey = 'scorerDefinitions';
  protected readonly versionMetadataFields = [
    'id',
    'scorerDefinitionId',
    'versionNumber',
    'changedFields',
    'changeMessage',
    'createdAt',
  ] satisfies (keyof ScorerDefinitionVersion)[];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'SCORER_DEFINITIONS',
    });
  }
}
