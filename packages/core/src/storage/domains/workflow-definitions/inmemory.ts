import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageWorkflowDefinitionType,
  StorageWorkflowDefinitionVersionType,
  StorageCreateWorkflowDefinitionInput,
  StorageUpdateWorkflowDefinitionInput,
  StorageListWorkflowDefinitionsInput,
  StorageListWorkflowDefinitionsOutput,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import {
  WorkflowDefinitionsStorage,
  type WorkflowDefinitionVersion,
  type CreateVersionInput,
  type ListVersionsInput,
  type ListVersionsOutput,
} from './base';

/**
 * In-memory implementation of WorkflowDefinitionsStorage.
 * Used for testing and development.
 */
export class InMemoryWorkflowDefinitionsStorage extends WorkflowDefinitionsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.workflowDefinitions.clear();
    this.db.workflowDefinitionVersions.clear();
  }

  // ==================== CRUD Methods ====================

  async createWorkflowDefinition(input: {
    definition: StorageCreateWorkflowDefinitionInput;
  }): Promise<StorageWorkflowDefinitionType> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: createWorkflowDefinition called for ${input.definition.id}`);

    if (this.db.workflowDefinitions.has(input.definition.id)) {
      throw new Error(`Workflow definition with id ${input.definition.id} already exists`);
    }

    const now = new Date();
    const definition: StorageWorkflowDefinitionType = {
      ...structuredClone(input.definition),
      createdAt: now,
      updatedAt: now,
    };

    this.db.workflowDefinitions.set(definition.id, definition);
    return structuredClone(definition);
  }

  async getWorkflowDefinitionById(input: { id: string }): Promise<StorageWorkflowDefinitionType | null> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: getWorkflowDefinitionById called for ${input.id}`);
    const definition = this.db.workflowDefinitions.get(input.id);
    return definition ? structuredClone(definition) : null;
  }

  async updateWorkflowDefinition(input: StorageUpdateWorkflowDefinitionInput): Promise<StorageWorkflowDefinitionType> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: updateWorkflowDefinition called for ${input.id}`);

    const existing = this.db.workflowDefinitions.get(input.id);
    if (!existing) {
      throw new Error(`Workflow definition with id ${input.id} not found`);
    }

    const { id, ...updates } = input;

    const updated: StorageWorkflowDefinitionType = {
      ...existing,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.inputSchema !== undefined && { inputSchema: updates.inputSchema }),
      ...(updates.outputSchema !== undefined && { outputSchema: updates.outputSchema }),
      ...(updates.stateSchema !== undefined && { stateSchema: updates.stateSchema }),
      ...(updates.stepGraph !== undefined && { stepGraph: updates.stepGraph }),
      ...(updates.steps !== undefined && { steps: updates.steps }),
      ...(updates.retryConfig !== undefined && { retryConfig: updates.retryConfig }),
      ...(updates.ownerId !== undefined && { ownerId: updates.ownerId }),
      ...(updates.activeVersionId !== undefined && { activeVersionId: updates.activeVersionId }),
      ...(updates.metadata !== undefined && {
        metadata: { ...existing.metadata, ...updates.metadata },
      }),
      updatedAt: new Date(),
    };

    this.db.workflowDefinitions.set(id, updated);
    return structuredClone(updated);
  }

  async deleteWorkflowDefinition(input: { id: string }): Promise<void> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: deleteWorkflowDefinition called for ${input.id}`);
    // Cascade delete versions first
    await this.deleteVersionsByWorkflowDefinitionId(input.id);
    // Idempotent delete - no-op if definition doesn't exist
    this.db.workflowDefinitions.delete(input.id);
  }

  async listWorkflowDefinitions(
    input?: StorageListWorkflowDefinitionsInput,
  ): Promise<StorageListWorkflowDefinitionsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = input || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: listWorkflowDefinitions called`);

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

    // Get all definitions
    let definitions = Array.from(this.db.workflowDefinitions.values());

    // Filter by ownerId
    if (ownerId) {
      definitions = definitions.filter(d => d.ownerId === ownerId);
    }

    // Filter by metadata
    if (metadata) {
      definitions = definitions.filter(d => {
        if (!d.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => d.metadata![key] === value);
      });
    }

    // Sort definitions
    const sortedDefinitions = this.sortDefinitions(definitions, field, direction);

    // Clone definitions to avoid mutation
    const clonedDefinitions = sortedDefinitions.map(d => structuredClone(d));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      definitions: clonedDefinitions.slice(offset, offset + perPage),
      total: clonedDefinitions.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedDefinitions.length,
    };
  }

  private sortDefinitions(
    definitions: StorageWorkflowDefinitionType[],
    field: string,
    direction: 'ASC' | 'DESC',
  ): StorageWorkflowDefinitionType[] {
    return definitions.sort((a, b) => {
      const aValue = new Date(a[field as keyof StorageWorkflowDefinitionType] as Date).getTime();
      const bValue = new Date(b[field as keyof StorageWorkflowDefinitionType] as Date).getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  // ==================== Version Methods ====================

  async createVersion(input: CreateVersionInput): Promise<WorkflowDefinitionVersion> {
    this.logger.debug(
      `InMemoryWorkflowDefinitionsStorage: createVersion called for ${input.workflowDefinitionId} v${input.versionNumber}`,
    );

    if (this.db.workflowDefinitionVersions.has(input.id)) {
      throw new Error(`Workflow definition version with id ${input.id} already exists`);
    }

    const version: WorkflowDefinitionVersion = {
      ...structuredClone(input),
      createdAt: new Date(),
    };

    this.db.workflowDefinitionVersions.set(version.id, version);
    return structuredClone(version);
  }

  async getVersion(id: string): Promise<WorkflowDefinitionVersion | null> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: getVersion called for ${id}`);
    const version = this.db.workflowDefinitionVersions.get(id);
    return version ? structuredClone(version) : null;
  }

  async getVersionByNumber(
    workflowDefinitionId: string,
    versionNumber: number,
  ): Promise<WorkflowDefinitionVersion | null> {
    this.logger.debug(
      `InMemoryWorkflowDefinitionsStorage: getVersionByNumber called for ${workflowDefinitionId} v${versionNumber}`,
    );

    for (const version of this.db.workflowDefinitionVersions.values()) {
      if (version.workflowDefinitionId === workflowDefinitionId && version.versionNumber === versionNumber) {
        return structuredClone(version);
      }
    }
    return null;
  }

  async getLatestVersion(workflowDefinitionId: string): Promise<WorkflowDefinitionVersion | null> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: getLatestVersion called for ${workflowDefinitionId}`);

    let latest: WorkflowDefinitionVersion | null = null;
    for (const version of this.db.workflowDefinitionVersions.values()) {
      if (version.workflowDefinitionId === workflowDefinitionId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? structuredClone(latest) : null;
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { workflowDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: listVersions called for ${workflowDefinitionId}`);

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 10)
    const perPage = normalizePerPage(perPageInput, 10);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Filter versions by workflowDefinitionId
    let versions = Array.from(this.db.workflowDefinitionVersions.values()).filter(
      v => v.workflowDefinitionId === workflowDefinitionId,
    );

    // Sort versions
    const sortedVersions = this.sortVersions(versions, field, direction);

    // Clone versions to avoid mutation
    const clonedVersions = sortedVersions.map(v => structuredClone(v));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      versions: clonedVersions.slice(offset, offset + perPage),
      total: clonedVersions.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedVersions.length,
    };
  }

  private sortVersions(
    versions: WorkflowDefinitionVersion[],
    field: 'versionNumber' | 'createdAt',
    direction: 'ASC' | 'DESC',
  ): WorkflowDefinitionVersion[] {
    return versions.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      if (field === 'versionNumber') {
        aValue = a.versionNumber;
        bValue = b.versionNumber;
      } else {
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
      }

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  async deleteVersion(id: string): Promise<void> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: deleteVersion called for ${id}`);
    // Idempotent delete - no-op if version doesn't exist
    this.db.workflowDefinitionVersions.delete(id);
  }

  async deleteVersionsByWorkflowDefinitionId(workflowDefinitionId: string): Promise<void> {
    this.logger.debug(
      `InMemoryWorkflowDefinitionsStorage: deleteVersionsByWorkflowDefinitionId called for ${workflowDefinitionId}`,
    );

    for (const [id, version] of this.db.workflowDefinitionVersions) {
      if (version.workflowDefinitionId === workflowDefinitionId) {
        this.db.workflowDefinitionVersions.delete(id);
      }
    }
  }

  async countVersions(workflowDefinitionId: string): Promise<number> {
    this.logger.debug(`InMemoryWorkflowDefinitionsStorage: countVersions called for ${workflowDefinitionId}`);

    let count = 0;
    for (const version of this.db.workflowDefinitionVersions.values()) {
      if (version.workflowDefinitionId === workflowDefinitionId) {
        count++;
      }
    }
    return count;
  }
}
