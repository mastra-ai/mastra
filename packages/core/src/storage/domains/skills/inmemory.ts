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
    this.logger.debug(`InMemorySkillsStorage: getById called for ${id}`);
    const config = this.db.skills.get(id);
    return config ? this.deepCopyConfig(config) : null;
  }

  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;
    this.logger.debug(`InMemorySkillsStorage: create called for ${skill.id}`);

    if (this.db.skills.has(skill.id)) {
      throw new Error(`Skill with id ${skill.id} already exists`);
    }

    const now = new Date();
    const newConfig: StorageSkillType = {
      id: skill.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: skill.authorId,
      createdAt: now,
      updatedAt: now,
    };

    this.db.skills.set(skill.id, newConfig);

    // Extract config fields from the flat input (everything except record fields)
    const { id: _id, authorId: _authorId, ...snapshotConfig } = skill;

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
    this.logger.debug(`InMemorySkillsStorage: update called for ${id}`);

    const existingConfig = this.db.skills.get(id);
    if (!existingConfig) {
      throw new Error(`Skill with id ${id} not found`);
    }

    // Separate metadata fields from config fields
    const { authorId, activeVersionId, status, ...configFields } = updates;

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
    this.logger.debug(`InMemorySkillsStorage: delete called for ${id}`);
    // Idempotent delete
    this.db.skills.delete(id);
    // Also delete all versions for this skill
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemorySkillsStorage: list called`);

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

    // Filter by authorId if provided
    if (authorId !== undefined) {
      configs = configs.filter(config => config.authorId === authorId);
    }

    // Filter by metadata if provided (AND logic) — skills don't have metadata on the record,
    // but we support the filter interface for consistency
    if (metadata && Object.keys(metadata).length > 0) {
      configs = configs.filter(_config => {
        // StorageSkillType doesn't have metadata on the thin record
        return false;
      });
    }

    // Sort filtered configs
    const sortedConfigs = this.sortConfigs(configs, field, direction);

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
    this.logger.debug(`InMemorySkillsStorage: createVersion called for skill ${input.skillId}`);

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
    this.logger.debug(`InMemorySkillsStorage: getVersion called for ${id}`);
    const version = this.db.skillVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    this.logger.debug(`InMemorySkillsStorage: getVersionByNumber called for skill ${skillId}, v${versionNumber}`);

    for (const version of this.db.skillVersions.values()) {
      if (version.skillId === skillId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    this.logger.debug(`InMemorySkillsStorage: getLatestVersion called for skill ${skillId}`);

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

    this.logger.debug(`InMemorySkillsStorage: listVersions called for skill ${skillId}`);

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
    this.logger.debug(`InMemorySkillsStorage: deleteVersion called for ${id}`);
    this.db.skillVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    this.logger.debug(`InMemorySkillsStorage: deleteVersionsByParentId called for skill ${entityId}`);

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
    this.logger.debug(`InMemorySkillsStorage: countVersions called for skill ${skillId}`);

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
  ): StorageSkillType[] {
    return configs.sort((a, b) => {
      const aValue = a[field].getTime();
      const bValue = b[field].getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
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
