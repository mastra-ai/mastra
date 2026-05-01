import type { FilesystemDB } from '../../filesystem-db';
import { FilesystemVersionedHelpers } from '../../filesystem-versioned';
import type {
  StorageSkillType,
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
} from '../../types';
import type { SkillVersion, CreateSkillVersionInput, ListSkillVersionsInput, ListSkillVersionsOutput } from './base';
import { SkillsStorage } from './base';

export class FilesystemSkillsStorage extends SkillsStorage {
  private helpers: FilesystemVersionedHelpers<StorageSkillType, SkillVersion>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'skills.json',
      parentIdField: 'skillId',
      name: 'FilesystemSkillsStorage',
      versionMetadataFields: ['id', 'skillId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
    });
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StorageSkillType | null> {
    return this.helpers.getById(id);
  }

  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;
    const now = new Date();
    const visibility = skill.visibility ?? (skill.authorId ? 'private' : undefined);
    const entity: StorageSkillType = {
      id: skill.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: skill.authorId,
      visibility,
      createdAt: now,
      updatedAt: now,
    };

    await this.helpers.createEntity(skill.id, entity);

    // Skills don't have metadata on the thin record, so only exclude id, authorId, visibility
    const { id: _id, authorId: _authorId, visibility: _visibility, ...snapshotConfig } = skill;
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      skillId: skill.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    return structuredClone(entity);
  }

  async update(input: StorageUpdateSkillInput): Promise<StorageSkillType> {
    const { id, ...updates } = input;

    const existing = await this.helpers.getById(id);
    if (!existing) {
      throw new Error(`FilesystemSkillsStorage: skill with id ${id} not found`);
    }

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
      'files',
      'metadata',
      'tree',
    ];

    const hasConfigUpdate = configFieldNames.some(field => field in configFields);

    // Update metadata fields on the record
    const updatedEntity: StorageSkillType = {
      ...existing,
      ...(authorId !== undefined && { authorId }),
      ...(visibility !== undefined && { visibility }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status: status as StorageSkillType['status'] }),
      updatedAt: new Date(),
    };

    // Auto-set status to 'published' when activeVersionId is set without explicit status
    if (activeVersionId !== undefined && status === undefined) {
      updatedEntity.status = 'published';
    }

    // If config fields are being updated, create a new version
    if (hasConfigUpdate) {
      const latestVersion = await this.getLatestVersion(id);
      if (!latestVersion) {
        throw new Error(`No versions found for skill ${id}`);
      }

      const {
        id: _versionId,
        skillId: _skillId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...latestConfig
      } = latestVersion;

      const newConfig = {
        ...latestConfig,
        ...configFields,
      };

      const changedFields = configFieldNames.filter(
        field =>
          field in configFields &&
          JSON.stringify(configFields[field as keyof typeof configFields]) !==
            JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
      );

      if (changedFields.length > 0) {
        const newVersionId = crypto.randomUUID();
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

    // Build the entity-level updates for the helpers
    const entityUpdates: Record<string, unknown> = {
      ...(authorId !== undefined && { authorId }),
      ...(visibility !== undefined && { visibility }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status }),
    };
    if (activeVersionId !== undefined && status === undefined) {
      entityUpdates.status = 'published';
    }
    return await this.helpers.updateEntity(id, entityUpdates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    const { page, perPage, orderBy, authorId, visibility, metadata } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'skills',
      filters: { authorId, visibility, metadata },
    });
    return result as unknown as StorageListSkillsOutput;
  }

  async createVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    return this.helpers.createVersion(input as SkillVersion);
  }

  async getVersion(id: string): Promise<SkillVersion | null> {
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    return this.helpers.getVersionByNumber(skillId, versionNumber);
  }

  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    return this.helpers.getLatestVersion(skillId);
  }

  async listVersions(input: ListSkillVersionsInput): Promise<ListSkillVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'skillId');
    return result as ListSkillVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(skillId: string): Promise<number> {
    return this.helpers.countVersions(skillId);
  }
}
