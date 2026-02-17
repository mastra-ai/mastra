import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  SkillsStorage,
  createStorageErrorId,
  TABLE_SKILLS,
  TABLE_SKILL_VERSIONS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageSkillType,
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
} from '@mastra/core/storage';
import type {
  SkillVersion,
  CreateSkillVersionInput,
  ListSkillVersionsInput,
  ListSkillVersionsOutput,
} from '@mastra/core/storage/domains/skills';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * Snapshot config fields that live on skill version documents.
 */
const SNAPSHOT_FIELDS = [
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
] as const;

export class MongoDBSkillsStorage extends SkillsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_SKILLS, TABLE_SKILL_VERSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBSkillsStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_SKILLS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_SKILLS, keys: { status: 1 } },
      { collection: TABLE_SKILLS, keys: { createdAt: -1 } },
      { collection: TABLE_SKILLS, keys: { authorId: 1 } },
      { collection: TABLE_SKILL_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      {
        collection: TABLE_SKILL_VERSIONS,
        keys: { skillId: 1, versionNumber: -1 },
        options: { unique: true },
      },
      { collection: TABLE_SKILL_VERSIONS, keys: { skillId: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const versionsCollection = await this.getCollection(TABLE_SKILL_VERSIONS);
    await versionsCollection.deleteMany({});
    const skillsCollection = await this.getCollection(TABLE_SKILLS);
    await skillsCollection.deleteMany({});
  }

  // ==========================================================================
  // Skill CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageSkillType | null> {
    try {
      const collection = await this.getCollection(TABLE_SKILLS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformSkill(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SKILL_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;
    try {
      const collection = await this.getCollection(TABLE_SKILLS);

      const id = skill.id;

      // Check if skill already exists
      const existing = await collection.findOne({ id });
      if (existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_SKILL', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `Skill with id ${id} already exists`,
        });
      }

      const now = new Date();

      // Create thin skill record
      const newSkill: StorageSkillType = {
        id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: skill.authorId,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeSkill(newSkill));

      // Extract snapshot config from flat input
      const snapshotConfig: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((skill as any)[field] !== undefined) {
          snapshotConfig[field] = (skill as any)[field];
        }
      }

      // Create version 1
      const versionId = randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          skillId: id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        } as CreateSkillVersionInput);
      } catch (versionError) {
        // Clean up the orphaned skill record
        await collection.deleteOne({ id });
        throw versionError;
      }

      return newSkill;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { name: skill.name },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateSkillInput): Promise<StorageSkillType> {
    const { id, ...updates } = input;
    try {
      const collection = await this.getCollection(TABLE_SKILLS);

      const existingSkill = await collection.findOne<any>({ id });
      if (!existingSkill) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_SKILL', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `Skill with id ${id} not found`,
        });
      }

      const updateDoc: Record<string, any> = {
        updatedAt: new Date(),
      };

      // Metadata-level fields
      const metadataFields = {
        authorId: updates.authorId,
        activeVersionId: updates.activeVersionId,
        status: updates.status,
      };

      // Extract config fields
      const configFields: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((updates as any)[field] !== undefined) {
          configFields[field] = (updates as any)[field];
        }
      }

      // If we have config updates, create a new version
      if (Object.keys(configFields).length > 0) {
        const latestVersion = await this.getLatestVersion(id);

        if (!latestVersion) {
          throw new MastraError({
            id: createStorageErrorId('MONGODB', 'UPDATE_SKILL', 'NO_VERSION'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `Cannot update config fields for skill ${id} - no versions exist`,
            details: { id },
          });
        }

        // Extract existing snapshot and merge with updates
        const existingSnapshot = this.extractSnapshotFields(latestVersion);

        await this.createVersion({
          id: randomUUID(),
          skillId: id,
          versionNumber: latestVersion.versionNumber + 1,
          ...existingSnapshot,
          ...configFields,
          changedFields: Object.keys(configFields),
          changeMessage: `Updated: ${Object.keys(configFields).join(', ')}`,
        } as CreateSkillVersionInput);
      }

      // Handle metadata-level updates
      if (metadataFields.authorId !== undefined) updateDoc.authorId = metadataFields.authorId;
      if (metadataFields.activeVersionId !== undefined) {
        updateDoc.activeVersionId = metadataFields.activeVersionId;
        // Auto-set status to 'published' when activeVersionId is set, consistent with InMemory and LibSQL
        if (metadataFields.status === undefined) {
          updateDoc.status = 'published';
        }
      }
      if (metadataFields.status !== undefined) {
        updateDoc.status = metadataFields.status;
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedSkill = await collection.findOne<any>({ id });
      if (!updatedSkill) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_SKILL', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Skill with id ${id} was deleted during update`,
          details: { id },
        });
      }
      return this.transformSkill(updatedSkill);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Delete all versions first
      await this.deleteVersionsByParentId(id);

      // Then delete the skill
      const collection = await this.getCollection(TABLE_SKILLS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_SKILLS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_SKILLS);

      // Build filter
      const filter: Record<string, any> = {};
      if (authorId) {
        filter.authorId = authorId;
      }
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          filter[`metadata.${key}`] = value;
        }
      }

      const total = await collection.countDocuments(filter);

      if (total === 0 || perPage === 0) {
        return {
          skills: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find(filter)
        .sort({ [field]: sortOrder })
        .skip(offset);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const results = await cursor.toArray();
      const skills = results.map((doc: any) => this.transformSkill(doc));

      return {
        skills,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput !== false && offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_SKILLS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Skill Version Methods
  // ==========================================================================

  async createVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);
      const now = new Date();

      const versionDoc: Record<string, any> = {
        id: input.id,
        skillId: input.skillId,
        versionNumber: input.versionNumber,
        changedFields: input.changedFields ?? undefined,
        changeMessage: input.changeMessage ?? undefined,
        createdAt: now,
      };

      // Copy snapshot fields
      for (const field of SNAPSHOT_FIELDS) {
        if ((input as any)[field] !== undefined) {
          versionDoc[field] = (input as any)[field];
        }
      }

      await collection.insertOne(versionDoc);

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, skillId: input.skillId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<SkillVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);
      const result = await collection.findOne<any>({ skillId, versionNumber });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SKILL_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);
      const result = await collection.find<any>({ skillId }).sort({ versionNumber: -1 }).limit(1).toArray();

      if (!result || result.length === 0) {
        return null;
      }

      return this.transformVersion(result[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListSkillVersionsInput): Promise<ListSkillVersionsOutput> {
    const { skillId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_SKILL_VERSIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 20);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);

      const total = await collection.countDocuments({ skillId });

      if (total === 0 || perPage === 0) {
        return {
          versions: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find({ skillId })
        .sort({ [field]: sortOrder })
        .skip(offset);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const results = await cursor.toArray();
      const versions = results.map((doc: any) => this.transformVersion(doc));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput !== false && offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(skillId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);
      await collection.deleteMany({ skillId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSIONS_BY_SKILL_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  async countVersions(skillId: string): Promise<number> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_VERSIONS);
      return await collection.countDocuments({ skillId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'COUNT_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private transformSkill(doc: any): StorageSkillType {
    const { _id, ...rest } = doc;
    return {
      id: rest.id,
      status: rest.status as 'draft' | 'published' | 'archived',
      activeVersionId: rest.activeVersionId,
      authorId: rest.authorId,
      createdAt: rest.createdAt instanceof Date ? rest.createdAt : new Date(rest.createdAt),
      updatedAt: rest.updatedAt instanceof Date ? rest.updatedAt : new Date(rest.updatedAt),
    };
  }

  private serializeSkill(skill: StorageSkillType): Record<string, any> {
    return {
      id: skill.id,
      status: skill.status,
      activeVersionId: skill.activeVersionId,
      authorId: skill.authorId,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };
  }

  private transformVersion(doc: any): SkillVersion {
    const { _id, ...version } = doc;

    const result: any = {
      id: version.id,
      skillId: version.skillId,
      versionNumber: version.versionNumber,
      changedFields: version.changedFields,
      changeMessage: version.changeMessage,
      createdAt: version.createdAt instanceof Date ? version.createdAt : new Date(version.createdAt),
    };

    // Copy snapshot fields
    for (const field of SNAPSHOT_FIELDS) {
      if (version[field] !== undefined) {
        result[field] = version[field];
      }
    }

    return result as SkillVersion;
  }

  private extractSnapshotFields(version: SkillVersion): Record<string, any> {
    const result: Record<string, any> = {};
    for (const field of SNAPSHOT_FIELDS) {
      if ((version as any)[field] !== undefined) {
        result[field] = (version as any)[field];
      }
    }
    return result;
  }
}
