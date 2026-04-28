import { randomUUID } from 'node:crypto';

import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageSkillType,
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type {
  SkillVersion,
  CreateSkillVersionInput,
  ListSkillVersionsInput,
  ListSkillVersionsOutput,
  SkillVersionOrderBy,
  SkillVersionSortDirection,
} from './base';
import { SkillsStorage } from './base';

export class InMemorySkillsStorage extends SkillsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.skills.clear();
    this.db.skillVersions.clear();
  }

  // ==========================================================================
  // Skill CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageSkillType | null> {
    const config = this.db.skills.get(id);
    return config ? this.deepCopyConfig(config) : null;
  }

  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;

    if (this.db.skills.has(skill.id)) {
      throw new Error(`Skill with id ${skill.id} already exists`);
    }

    const now = new Date();
    const visibility = skill.visibility ?? (skill.authorId ? 'private' : undefined);
    const newConfig: StorageSkillType = {
      id: skill.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: skill.authorId,
      visibility,
      starCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.db.skills.set(skill.id, newConfig);

    // Extract config fields from the flat input (everything except record fields)
    const { id: _id, authorId: _authorId, visibility: _visibility, ...snapshotConfig } = skill;

    // Create version 1 from the config
    const versionId = randomUUID();
    try {
      await this.createVersion({
        id: versionId,
        skillId: skill.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      });
    } catch (error) {
      // Roll back the orphaned skill record
      this.db.skills.delete(skill.id);
      throw error;
    }

    // Return the thin record
    return this.deepCopyConfig(newConfig);
  }

  async update(input: StorageUpdateSkillInput): Promise<StorageSkillType> {
    const { id, ...updates } = input;

    const existingConfig = this.db.skills.get(id);
    if (!existingConfig) {
      throw new Error(`Skill with id ${id} not found`);
    }

    // Separate metadata fields from config fields
    const { authorId, visibility, activeVersionId, status, ...configFields } = updates;

    // Config field names from StorageSkillSnapshotType
    const configFieldNames = [
      'name',
      'description',
      'instructions',
      'license',
      'compatibility',
      'source',
      'references',
      'scripts',
      'assets',
      'metadata',
      'tree',
    ];

    // Check if any config fields are present in the update
    const hasConfigUpdate = configFieldNames.some(field => field in configFields);

    // Update metadata fields on the record
    const updatedConfig: StorageSkillType = {
      ...existingConfig,
      ...(authorId !== undefined && { authorId }),
      ...(visibility !== undefined && { visibility }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status: status as StorageSkillType['status'] }),
      updatedAt: new Date(),
    };

    // Auto-set status to 'published' when activeVersionId is set, only if status is not explicitly provided
    if (activeVersionId !== undefined && status === undefined) {
      updatedConfig.status = 'published';
    }

    // If config fields are being updated, create a new version
    if (hasConfigUpdate) {
      // Get the latest version to use as base
      const latestVersion = await this.getLatestVersion(id);
      if (!latestVersion) {
        throw new Error(`No versions found for skill ${id}`);
      }

      // Extract config from latest version
      const {
        id: _versionId,
        skillId: _skillId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...latestConfig
      } = latestVersion;

      // Merge updates into latest config
      const newConfig = {
        ...latestConfig,
        ...configFields,
      };

      // Identify which fields changed
      const changedFields = configFieldNames.filter(
        field =>
          field in configFields &&
          JSON.stringify(configFields[field as keyof typeof configFields]) !==
            JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
      );

      // Only create a new version if something actually changed
      if (changedFields.length > 0) {
        const newVersionId = randomUUID();
        const newVersionNumber = latestVersion.versionNumber + 1;

        await this.createVersion({
          id: newVersionId,
          skillId: id,
          versionNumber: newVersionNumber,
          ...newConfig,
          changedFields,
          changeMessage: `Updated ${changedFields.join(', ')}`,
        });
      }
    }

    // Save the updated record
    this.db.skills.set(id, updatedConfig);
    return this.deepCopyConfig(updatedConfig);
  }

  async delete(id: string): Promise<void> {
    // Idempotent delete
    this.db.skills.delete(id);
    // Also delete all versions for this skill
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    const {
      page = 0,
      perPage: perPageInput,
      orderBy,
      authorId,
      status,
      visibility,
      metadata,
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

    // Get all skills and apply filters
    let configs = Array.from(this.db.skills.values());

    // Restrict to a set of IDs (used by ?starredOnly=true).
    // An empty array means "no candidates" -> empty result.
    if (entityIds !== undefined) {
      if (entityIds.length === 0) {
        return {
          skills: [],
          total: 0,
          page,
          perPage: perPageInput === false ? false : perPage,
          hasMore: false,
        };
      }
      const idSet = new Set(entityIds);
      configs = configs.filter(config => idSet.has(config.id));
    }

    // Filter by authorId if provided
    if (authorId !== undefined) {
      configs = configs.filter(config => config.authorId === authorId);
    }

    // Filter by status if provided
    if (status !== undefined) {
      configs = configs.filter(config => config.status === status);
    }

    // Filter by visibility if provided
    if (visibility !== undefined) {
      configs = configs.filter(config => config.visibility === visibility);
    }

    // Filter by metadata if provided (AND logic) — skills don't have metadata on the record,
    // but we support the filter interface for consistency
    if (metadata && Object.keys(metadata).length > 0) {
      configs = configs.filter(_config => {
        // StorageSkillType doesn't have metadata on the thin record
        return false;
      });
    }

    // Sort filtered configs (with optional starred-first compound sort)
    const starredIds = pinStarredFor ? this.collectStarredIdsFor(pinStarredFor) : undefined;
    const sortedConfigs = this.sortConfigs(configs, field, direction, starredIds);

    // Deep clone to avoid mutation
    const clonedConfigs = sortedConfigs.map(config => this.deepCopyConfig(config));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      skills: clonedConfigs.slice(offset, offset + perPage),
      total: clonedConfigs.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedConfigs.length,
    };
  }

  // ==========================================================================
  // Skill Version Methods
  // ==========================================================================

  async createVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    // Check if version with this ID already exists
    if (this.db.skillVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    // Check for duplicate (skillId, versionNumber) pair
    for (const version of this.db.skillVersions.values()) {
      if (version.skillId === input.skillId && version.versionNumber === input.versionNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for skill ${input.skillId}`);
      }
    }

    const version: SkillVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing
    this.db.skillVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<SkillVersion | null> {
    const version = this.db.skillVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    for (const version of this.db.skillVersions.values()) {
      if (version.skillId === skillId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    let latest: SkillVersion | null = null;
    for (const version of this.db.skillVersions.values()) {
      if (version.skillId === skillId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? this.deepCopyVersion(latest) : null;
  }

  async listVersions(input: ListSkillVersionsInput): Promise<ListSkillVersionsOutput> {
    const { skillId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    // Normalize perPage (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by skillId
    let versions = Array.from(this.db.skillVersions.values()).filter(v => v.skillId === skillId);

    // Sort versions
    versions = this.sortVersions(versions, field, direction);

    // Deep clone
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
    this.db.skillVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.skillVersions.entries()) {
      if (version.skillId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.skillVersions.delete(id);
    }
  }

  async countVersions(skillId: string): Promise<number> {
    let count = 0;
    for (const version of this.db.skillVersions.values()) {
      if (version.skillId === skillId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private deepCopyConfig(config: StorageSkillType): StorageSkillType {
    return {
      ...config,
    };
  }

  private deepCopyVersion(version: SkillVersion): SkillVersion {
    return structuredClone(version);
  }

  private sortConfigs(
    configs: StorageSkillType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
    starredIds?: Set<string>,
  ): StorageSkillType[] {
    return configs.sort((a, b) => {
      // Compound sort: starred first, then existing orderBy, then id ASC for stable pagination.
      if (starredIds) {
        const aStar = starredIds.has(a.id) ? 1 : 0;
        const bStar = starredIds.has(b.id) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
      }

      const aValue = a[field].getTime();
      const bValue = b[field].getTime();
      if (aValue !== bValue) {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }

      // Stable tie-break for same `createdAt`/`updatedAt`.
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  /**
   * Collect the set of skill IDs starred by the given user. Returns an empty
   * Set when the stars domain is not wired or the user has no stars.
   */
  private collectStarredIdsFor(userId: string): Set<string> {
    const starred = new Set<string>();
    for (const row of this.db.stars.values()) {
      if (row.userId === userId && row.entityType === 'skill') {
        starred.add(row.entityId);
      }
    }
    return starred;
  }

  private sortVersions(
    versions: SkillVersion[],
    field: SkillVersionOrderBy,
    direction: SkillVersionSortDirection,
  ): SkillVersion[] {
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
