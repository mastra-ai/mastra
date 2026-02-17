import type {
  StorageSkillType,
  StorageSkillSnapshotType,
  StorageResolvedSkillType,
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
  StorageListSkillsResolvedOutput,
} from '../../types';
import { VersionedStorageDomain } from '../versioned';
import type { VersionBase, CreateVersionInputBase, ListVersionsInputBase, ListVersionsOutputBase } from '../versioned';

// ============================================================================
// Skill Version Types
// ============================================================================

/**
 * Represents a stored version of a skill's definition.
 * Definition fields are top-level on the version row (no nested snapshot object).
 */
export interface SkillVersion extends StorageSkillSnapshotType, VersionBase {
  /** ID of the skill this version belongs to */
  skillId: string;
}

/**
 * Input for creating a new skill version.
 * Definition fields are top-level (no nested snapshot object).
 */
export interface CreateSkillVersionInput extends StorageSkillSnapshotType, CreateVersionInputBase {
  /** ID of the skill this version belongs to */
  skillId: string;
}

/**
 * Sort direction for version listings.
 */
export type SkillVersionSortDirection = 'ASC' | 'DESC';

/**
 * Fields that can be used for ordering version listings.
 */
export type SkillVersionOrderBy = 'versionNumber' | 'createdAt';

/**
 * Input for listing skill versions with pagination and sorting.
 */
export interface ListSkillVersionsInput extends ListVersionsInputBase {
  /** ID of the skill to list versions for */
  skillId: string;
}

/**
 * Output for listing skill versions with pagination info.
 */
export interface ListSkillVersionsOutput extends ListVersionsOutputBase<SkillVersion> {}

// ============================================================================
// SkillsStorage Base Class
// ============================================================================

export abstract class SkillsStorage extends VersionedStorageDomain<
  StorageSkillType,
  StorageSkillSnapshotType,
  StorageResolvedSkillType,
  SkillVersion,
  CreateSkillVersionInput,
  ListSkillVersionsInput,
  ListSkillVersionsOutput,
  { skill: StorageCreateSkillInput },
  StorageUpdateSkillInput,
  StorageListSkillsInput | undefined,
  StorageListSkillsOutput,
  StorageListSkillsResolvedOutput
> {
  protected readonly listKey = 'skills';
  protected readonly versionMetadataFields = [
    'id',
    'skillId',
    'versionNumber',
    'changedFields',
    'changeMessage',
    'createdAt',
  ] satisfies (keyof SkillVersion)[];

  constructor() {
    super({
      component: 'STORAGE',
      name: 'SKILLS',
    });
  }
}
