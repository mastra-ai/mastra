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

/** Input for publishing a collected snapshot as an exact version. */
export interface PublishSkillVersionInput {
  skillId: string;
  sourceVersionId: string;
  versionId: string;
  snapshot: StorageSkillSnapshotType;
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

  /**
   * Create and activate an exact immutable version. Built-in adapters may override
   * this fallback to perform both writes in a native transaction.
   */
  async publishVersion(input: PublishSkillVersionInput): Promise<SkillVersion> {
    const sourceVersion = await this.getVersion(input.sourceVersionId);
    if (!sourceVersion) {
      throw new Error(`Skill version "${input.sourceVersionId}" not found`);
    }
    if (sourceVersion.skillId !== input.skillId) {
      throw new Error(
        `Skill version "${input.sourceVersionId}" belongs to skill "${sourceVersion.skillId}", not "${input.skillId}"`,
      );
    }

    const latestVersion = await this.getLatestVersion(input.skillId);
    if (!latestVersion) {
      throw new Error(`Skill "${input.skillId}" has no versions`);
    }

    const snapshot = Object.fromEntries(Object.entries(input.snapshot).filter(([, value]) => value !== undefined));
    const version = await this.createVersion({
      ...snapshot,
      id: input.versionId,
      skillId: input.skillId,
      versionNumber: latestVersion.versionNumber + 1,
      changedFields: Object.keys(snapshot),
      changeMessage: `Published from version ${input.sourceVersionId}`,
    } as CreateSkillVersionInput);

    try {
      await this.update({
        id: input.skillId,
        activeVersionId: input.versionId,
        status: 'published',
      });
    } catch (activationError) {
      try {
        await this.deleteVersion(input.versionId);
      } catch (cleanupError) {
        throw new AggregateError([activationError, cleanupError], 'Skill publication and cleanup both failed');
      }
      throw activationError;
    }

    return version;
  }
}
