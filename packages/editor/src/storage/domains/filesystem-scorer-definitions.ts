import { ScorerDefinitionsStorage } from '@mastra/core/storage';
import type {
  StorageScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
} from '@mastra/core/storage';
import type {
  ScorerDefinitionVersion,
  CreateScorerDefinitionVersionInput,
  ListScorerDefinitionVersionsInput,
  ListScorerDefinitionVersionsOutput,
} from '@mastra/core/storage';

import type { FilesystemDB } from '../filesystem-db';
import { FilesystemVersionedHelpers } from '../filesystem-versioned';

export class FilesystemScorerDefinitionsStorage extends ScorerDefinitionsStorage {
  private helpers: FilesystemVersionedHelpers<StorageScorerDefinitionType, ScorerDefinitionVersion>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'scorer-definitions.json',
      parentIdField: 'scorerDefinitionId',
      name: 'FilesystemScorerDefinitionsStorage',
      versionMetadataFields: [
        'id',
        'scorerDefinitionId',
        'versionNumber',
        'changedFields',
        'changeMessage',
        'createdAt',
      ],
    });
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StorageScorerDefinitionType | null> {
    return this.helpers.getById(id);
  }

  async create(input: {
    scorerDefinition: StorageCreateScorerDefinitionInput;
  }): Promise<StorageScorerDefinitionType> {
    const { scorerDefinition } = input;
    const now = new Date();
    const entity: StorageScorerDefinitionType = {
      id: scorerDefinition.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: scorerDefinition.authorId,
      metadata: scorerDefinition.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.helpers.createEntity(scorerDefinition.id, entity);

    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = scorerDefinition;
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      scorerDefinitionId: scorerDefinition.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    } as CreateScorerDefinitionVersionInput);

    return structuredClone(entity);
  }

  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType> {
    const { id, ...updates } = input;
    return this.helpers.updateEntity(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    const { page, perPage, orderBy, authorId, metadata, status } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'scorerDefinitions',
      filters: { authorId, metadata, status },
    });
    return result as unknown as StorageListScorerDefinitionsOutput;
  }

  async createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion> {
    return this.helpers.createVersion(input as ScorerDefinitionVersion);
  }

  async getVersion(id: string): Promise<ScorerDefinitionVersion | null> {
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(
    scorerDefinitionId: string,
    versionNumber: number,
  ): Promise<ScorerDefinitionVersion | null> {
    return this.helpers.getVersionByNumber(scorerDefinitionId, versionNumber);
  }

  async getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null> {
    return this.helpers.getLatestVersion(scorerDefinitionId);
  }

  async listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'scorerDefinitionId');
    return result as ListScorerDefinitionVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(scorerDefinitionId: string): Promise<number> {
    return this.helpers.countVersions(scorerDefinitionId);
  }
}
