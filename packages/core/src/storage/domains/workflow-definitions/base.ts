import { StorageDomain } from '../base';
import type {
  StorageWorkflowDefinitionType,
  StorageWorkflowDefinitionVersionType,
  StorageCreateWorkflowDefinitionInput,
  StorageUpdateWorkflowDefinitionInput,
  StorageListWorkflowDefinitionsInput,
  StorageListWorkflowDefinitionsOutput,
  StorageOrderBy,
} from '../../types';

// Re-export types for convenience
export type {
  StorageWorkflowDefinitionType,
  StorageWorkflowDefinitionVersionType,
  StorageCreateWorkflowDefinitionInput,
  StorageUpdateWorkflowDefinitionInput,
  StorageListWorkflowDefinitionsInput,
  StorageListWorkflowDefinitionsOutput,
};

export interface WorkflowDefinitionVersion {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  name?: string;
  snapshot: StorageWorkflowDefinitionType;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: Date;
}

export interface CreateWorkflowDefinitionVersionInput {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  name?: string;
  snapshot: StorageWorkflowDefinitionType;
  changedFields?: string[];
  changeMessage?: string;
}

export interface ListWorkflowDefinitionVersionsInput {
  workflowDefinitionId: string;
  page?: number;
  perPage?: number | false;
  orderBy?: {
    field?: 'versionNumber' | 'createdAt';
    direction?: 'ASC' | 'DESC';
  };
}

export interface ListWorkflowDefinitionVersionsOutput {
  versions: WorkflowDefinitionVersion[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Abstract base class for workflow definitions storage.
 *
 * Implementations must provide CRUD operations for workflow definitions
 * and version management for tracking changes over time.
 */
export abstract class WorkflowDefinitionsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOW_DEFINITIONS',
    });
  }

  // ==================== CRUD Methods ====================

  abstract createWorkflowDefinition(input: {
    definition: StorageCreateWorkflowDefinitionInput;
  }): Promise<StorageWorkflowDefinitionType>;

  abstract getWorkflowDefinitionById(input: { id: string }): Promise<StorageWorkflowDefinitionType | null>;

  abstract updateWorkflowDefinition(
    input: StorageUpdateWorkflowDefinitionInput,
  ): Promise<StorageWorkflowDefinitionType>;

  abstract deleteWorkflowDefinition(input: { id: string }): Promise<void>;

  abstract listWorkflowDefinitions(
    input?: StorageListWorkflowDefinitionsInput,
  ): Promise<StorageListWorkflowDefinitionsOutput>;

  // ==================== Version Methods ====================

  abstract createVersion(input: CreateWorkflowDefinitionVersionInput): Promise<WorkflowDefinitionVersion>;

  abstract getVersion(id: string): Promise<WorkflowDefinitionVersion | null>;

  abstract getVersionByNumber(
    workflowDefinitionId: string,
    versionNumber: number,
  ): Promise<WorkflowDefinitionVersion | null>;

  abstract getLatestVersion(workflowDefinitionId: string): Promise<WorkflowDefinitionVersion | null>;

  abstract listVersions(input: ListWorkflowDefinitionVersionsInput): Promise<ListWorkflowDefinitionVersionsOutput>;

  abstract deleteVersion(id: string): Promise<void>;

  abstract deleteVersionsByWorkflowDefinitionId(workflowDefinitionId: string): Promise<void>;

  abstract countVersions(workflowDefinitionId: string): Promise<number>;

  // ==================== Resolved Getters (Concrete) ====================

  /**
   * Gets a workflow definition, resolving from active version if set.
   *
   * If the definition has an activeVersionId, returns the snapshot from
   * that version (preserving the original id and activeVersionId).
   */
  async getWorkflowDefinitionByIdResolved(input: { id: string }): Promise<StorageWorkflowDefinitionType | null> {
    const definition = await this.getWorkflowDefinitionById(input);
    if (!definition) return null;

    if (definition.activeVersionId) {
      const activeVersion = await this.getVersion(definition.activeVersionId);
      if (activeVersion) {
        return {
          ...activeVersion.snapshot,
          id: definition.id,
          activeVersionId: definition.activeVersionId,
        };
      }
    }
    return definition;
  }

  /**
   * Lists workflow definitions, resolving each from active version if set.
   */
  async listWorkflowDefinitionsResolved(
    input?: StorageListWorkflowDefinitionsInput,
  ): Promise<StorageListWorkflowDefinitionsOutput> {
    const result = await this.listWorkflowDefinitions(input);

    const resolvedDefinitions = await Promise.all(
      result.definitions.map(async def => {
        if (def.activeVersionId) {
          const resolved = await this.getWorkflowDefinitionByIdResolved({ id: def.id });
          return resolved || def;
        }
        return def;
      }),
    );

    return { ...result, definitions: resolvedDefinitions };
  }

  // ==================== Helper Methods ====================

  /**
   * Parses orderBy input with defaults for definitions.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: 'ASC' | 'DESC' = 'DESC',
  ): { field: string; direction: 'ASC' | 'DESC' } {
    return {
      field: orderBy?.field && orderBy.field in WORKFLOW_DEFINITION_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in WORKFLOW_DEFINITION_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }

  /**
   * Parses orderBy input for versions with defaults.
   */
  protected parseVersionOrderBy(
    orderBy?: { field?: 'versionNumber' | 'createdAt'; direction?: 'ASC' | 'DESC' },
    defaultDirection: 'ASC' | 'DESC' = 'DESC',
  ): { field: 'versionNumber' | 'createdAt'; direction: 'ASC' | 'DESC' } {
    return {
      field: orderBy?.field && orderBy.field in VERSION_ORDER_BY_SET ? orderBy.field : 'versionNumber',
      direction:
        orderBy?.direction && orderBy.direction in WORKFLOW_DEFINITION_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }
}

const WORKFLOW_DEFINITION_ORDER_BY_SET: Record<string, true> = {
  createdAt: true,
  updatedAt: true,
};

const WORKFLOW_DEFINITION_SORT_DIRECTION_SET: Record<'ASC' | 'DESC', true> = {
  ASC: true,
  DESC: true,
};

const VERSION_ORDER_BY_SET: Record<'versionNumber' | 'createdAt', true> = {
  versionNumber: true,
  createdAt: true,
};
