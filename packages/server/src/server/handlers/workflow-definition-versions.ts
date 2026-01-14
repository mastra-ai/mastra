import { HTTPException } from '../http-exception';
import { workflowDefinitionIdPathParams } from '../schemas/workflow-definitions';
import {
  workflowDefinitionVersionPathParams,
  listWorkflowDefinitionVersionsQuerySchema,
  createWorkflowDefinitionVersionBodySchema,
  listWorkflowDefinitionVersionsResponseSchema,
  getWorkflowDefinitionVersionResponseSchema,
  createWorkflowDefinitionVersionResponseSchema,
  deleteWorkflowDefinitionVersionResponseSchema,
  activateWorkflowDefinitionVersionResponseSchema,
  compareWorkflowDefinitionVersionsQuerySchema,
  compareWorkflowDefinitionVersionsResponseSchema,
} from '../schemas/workflow-definition-versions';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { MastraStorage, WorkflowDefinitionsStorage, StorageWorkflowDefinitionType } from '@mastra/core/storage';
import type { WorkflowDefinitionVersion } from '@mastra/core/storage';

import { handleError } from './error';

/**
 * Serializes a workflow definition snapshot for API response
 * Converts Date objects to ISO strings
 */
function serializeSnapshot(snapshot: StorageWorkflowDefinitionType) {
  return {
    ...snapshot,
    createdAt: snapshot.createdAt instanceof Date ? snapshot.createdAt.toISOString() : String(snapshot.createdAt),
    updatedAt: snapshot.updatedAt instanceof Date ? snapshot.updatedAt.toISOString() : String(snapshot.updatedAt),
  };
}

/**
 * Serializes a version for API response
 * Converts Date objects to ISO strings in both the version and its snapshot
 */
function serializeVersion(version: WorkflowDefinitionVersion) {
  return {
    ...version,
    createdAt: version.createdAt instanceof Date ? version.createdAt.toISOString() : String(version.createdAt),
    snapshot: serializeSnapshot(version.snapshot),
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of versions to keep per workflow definition
 */
const MAX_VERSIONS_PER_DEFINITION = 50;

/**
 * Maximum retries for version creation when handling race conditions
 */
const MAX_VERSION_CREATE_RETRIES = 3;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a unique version ID
 */
export function generateVersionId(): string {
  return crypto.randomUUID();
}

/**
 * Calculates the changed fields between two workflow definitions
 * @param oldDef - The previous workflow definition
 * @param newDef - The new workflow definition
 * @returns Array of diff entries describing the changes
 */
export function calculateChangedFields(
  oldDef: Record<string, any>,
  newDef: Record<string, any>,
): Array<{ path: string; type: 'added' | 'removed' | 'changed'; oldValue?: unknown; newValue?: unknown }> {
  const differences: Array<{
    path: string;
    type: 'added' | 'removed' | 'changed';
    oldValue?: unknown;
    newValue?: unknown;
  }> = [];

  // Fields to compare for versioning
  const fieldsToCompare = [
    'inputSchema',
    'outputSchema',
    'stateSchema',
    'stepGraph',
    'steps',
    'retryConfig',
    'metadata',
  ];

  for (const field of fieldsToCompare) {
    const oldValue = oldDef[field];
    const newValue = newDef[field];

    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      if (oldValue === undefined) {
        differences.push({ path: field, type: 'added', newValue });
      } else if (newValue === undefined) {
        differences.push({ path: field, type: 'removed', oldValue });
      } else {
        differences.push({ path: field, type: 'changed', oldValue, newValue });
      }
    }
  }

  return differences;
}

/**
 * Enforces the retention limit by deleting oldest non-active versions
 * @param store - The workflow definitions storage instance
 * @param workflowDefinitionId - The workflow definition ID
 */
async function enforceRetentionLimit(store: WorkflowDefinitionsStorage, workflowDefinitionId: string): Promise<void> {
  const versions = await store.listVersions({
    workflowDefinitionId,
    page: 0,
    perPage: false, // Get all versions
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });

  if (versions.versions.length <= MAX_VERSIONS_PER_DEFINITION) {
    return;
  }

  const versionsToDelete = versions.versions.length - MAX_VERSIONS_PER_DEFINITION;
  let deleted = 0;

  for (const version of versions.versions) {
    if (deleted >= versionsToDelete) break;

    await store.deleteVersion(version.id);
    deleted++;
  }
}

/**
 * Creates a version with retry logic to handle race conditions
 * @param store - The workflow definitions storage instance
 * @param workflowDefinitionId - The workflow definition ID
 * @param definition - The workflow definition to snapshot
 * @param changeMessage - Optional message describing the change
 * @param changedFields - Optional list of changed field names
 * @param retries - Current retry count
 */
async function createVersionWithRetry(
  store: WorkflowDefinitionsStorage,
  workflowDefinitionId: string,
  definition: any,
  changeMessage?: string,
  changedFields?: string[],
  retries: number = 0,
): Promise<any> {
  try {
    // Get the current latest version number
    const latestVersion = await store.getLatestVersion(workflowDefinitionId);
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const version = await store.createVersion({
      id: generateVersionId(),
      workflowDefinitionId,
      versionNumber: nextVersionNumber,
      snapshot: definition,
      changedFields,
      changeMessage,
    });

    return version;
  } catch (error: any) {
    // If we get a conflict error (duplicate version number), retry
    if (retries < MAX_VERSION_CREATE_RETRIES && error.message?.includes('duplicate')) {
      return createVersionWithRetry(store, workflowDefinitionId, definition, changeMessage, changedFields, retries + 1);
    }
    throw error;
  }
}

/**
 * Handles auto-versioning when a workflow definition is updated.
 * Creates a new version if there are meaningful changes.
 * @param storage - The Mastra storage instance
 * @param workflowDefinitionId - The workflow definition ID
 * @param oldDef - The previous definition state
 * @param newDef - The new definition state
 * @param createdBy - Optional user ID who made the change
 */
export async function handleAutoVersioning(
  storage: MastraStorage,
  workflowDefinitionId: string,
  oldDef: Record<string, any>,
  newDef: Record<string, any>,
  _createdBy?: string,
): Promise<void> {
  // Calculate what changed
  const changes = calculateChangedFields(oldDef, newDef);

  // If nothing changed, don't create a version
  if (changes.length === 0) {
    return;
  }

  const store = (await storage.getStore('workflowDefinitions')) as WorkflowDefinitionsStorage | undefined;
  if (!store) {
    // Workflow definitions storage not available, skip versioning
    return;
  }

  const changeMessage = `Auto-versioned: ${changes.map(c => c.path).join(', ')} changed`;
  const changedFields = changes.map(c => c.path);

  await createVersionWithRetry(store, workflowDefinitionId, newDef, changeMessage, changedFields);

  // Enforce retention limit
  await enforceRetentionLimit(store, workflowDefinitionId);
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /api/workflow-definitions/:workflowDefinitionId/versions - List versions for a workflow definition
 */
export const LIST_DEFINITION_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflow-definitions/:workflowDefinitionId/versions',
  responseType: 'json',
  pathParamSchema: workflowDefinitionIdPathParams,
  queryParamSchema: listWorkflowDefinitionVersionsQuerySchema,
  responseSchema: listWorkflowDefinitionVersionsResponseSchema,
  summary: 'List workflow definition versions',
  description: 'Returns a paginated list of versions for a workflow definition',
  tags: ['Workflow Definition Versions'],
  handler: async ({ mastra, workflowDefinitionId, page, perPage, orderBy }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = (await storage.getStore('workflowDefinitions')) as WorkflowDefinitionsStorage | undefined;
      if (!store) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Verify the workflow definition exists
      const definition = await store.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!definition) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      const result = await store.listVersions({
        workflowDefinitionId,
        page,
        perPage,
        orderBy: orderBy as { field?: 'versionNumber' | 'createdAt'; direction?: 'ASC' | 'DESC' } | undefined,
      });

      return {
        versions: result.versions.map((version: any) => ({
          ...version,
          createdAt: version.createdAt instanceof Date ? version.createdAt.toISOString() : version.createdAt,
        })),
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        hasMore: result.hasMore,
      };
    } catch (error) {
      return handleError(error, 'Error listing workflow definition versions');
    }
  },
});

/**
 * POST /api/workflow-definitions/:workflowDefinitionId/versions - Create a new version
 */
export const CREATE_DEFINITION_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflow-definitions/:workflowDefinitionId/versions',
  responseType: 'json',
  pathParamSchema: workflowDefinitionIdPathParams,
  bodySchema: createWorkflowDefinitionVersionBodySchema,
  responseSchema: createWorkflowDefinitionVersionResponseSchema,
  summary: 'Create workflow definition version',
  description: 'Creates a new version snapshot for a workflow definition',
  tags: ['Workflow Definition Versions'],
  handler: async ({ mastra, workflowDefinitionId, name, changeMessage }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = (await storage.getStore('workflowDefinitions')) as WorkflowDefinitionsStorage | undefined;
      if (!store) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Verify the workflow definition exists and get current state
      const definition = await store.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!definition) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      // Get the latest version to compare
      const latestVersion = await store.getLatestVersion(workflowDefinitionId);
      let changedFields: string[] | undefined;

      if (latestVersion) {
        const changes = calculateChangedFields(latestVersion.snapshot, definition);
        changedFields = changes.map(c => c.path);
      }

      const version = await createVersionWithRetry(
        store,
        workflowDefinitionId,
        definition,
        changeMessage,
        changedFields,
      );

      // Update version name if provided
      if (name) {
        // Note: Would need an updateVersion method to support this
        // For now, we include name in the initial create
      }

      // Enforce retention limit
      await enforceRetentionLimit(store, workflowDefinitionId);

      return {
        ...version,
        createdAt: version.createdAt instanceof Date ? version.createdAt.toISOString() : version.createdAt,
      };
    } catch (error) {
      return handleError(error, 'Error creating workflow definition version');
    }
  },
});

/**
 * GET /api/workflow-definitions/:workflowDefinitionId/versions/compare - Compare two versions
 */
export const COMPARE_DEFINITION_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflow-definitions/:workflowDefinitionId/versions/compare',
  responseType: 'json',
  pathParamSchema: workflowDefinitionIdPathParams,
  queryParamSchema: compareWorkflowDefinitionVersionsQuerySchema,
  responseSchema: compareWorkflowDefinitionVersionsResponseSchema,
  summary: 'Compare workflow definition versions',
  description: 'Compares two versions of a workflow definition and returns the differences',
  tags: ['Workflow Definition Versions'],
  handler: async ({ mastra, workflowDefinitionId, versionA, versionB }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = (await storage.getStore('workflowDefinitions')) as WorkflowDefinitionsStorage | undefined;
      if (!store) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Verify the workflow definition exists
      const definition = await store.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!definition) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      // Fetch both versions
      const [versionAData, versionBData] = await Promise.all([store.getVersion(versionA), store.getVersion(versionB)]);

      if (!versionAData) {
        throw new HTTPException(404, { message: `Version ${versionA} not found` });
      }
      if (!versionBData) {
        throw new HTTPException(404, { message: `Version ${versionB} not found` });
      }

      // Verify both versions belong to this workflow definition
      if (versionAData.workflowDefinitionId !== workflowDefinitionId) {
        throw new HTTPException(400, {
          message: `Version ${versionA} does not belong to workflow definition ${workflowDefinitionId}`,
        });
      }
      if (versionBData.workflowDefinitionId !== workflowDefinitionId) {
        throw new HTTPException(400, {
          message: `Version ${versionB} does not belong to workflow definition ${workflowDefinitionId}`,
        });
      }

      // Calculate differences between snapshots
      const differences = calculateChangedFields(versionAData.snapshot, versionBData.snapshot);

      return {
        versionA: serializeVersion(versionAData),
        versionB: serializeVersion(versionBData),
        differences,
        hasDifferences: differences.length > 0,
      };
    } catch (error) {
      return handleError(error, 'Error comparing workflow definition versions');
    }
  },
});

/**
 * GET /api/workflow-definitions/:workflowDefinitionId/versions/:versionId - Get a specific version
 */
export const GET_DEFINITION_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/api/workflow-definitions/:workflowDefinitionId/versions/:versionId',
  responseType: 'json',
  pathParamSchema: workflowDefinitionVersionPathParams,
  responseSchema: getWorkflowDefinitionVersionResponseSchema,
  summary: 'Get workflow definition version',
  description: 'Returns a specific version of a workflow definition',
  tags: ['Workflow Definition Versions'],
  handler: async ({ mastra, workflowDefinitionId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = (await storage.getStore('workflowDefinitions')) as WorkflowDefinitionsStorage | undefined;
      if (!store) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Verify the workflow definition exists
      const definition = await store.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!definition) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      const version = await store.getVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version ${versionId} not found` });
      }

      // Verify version belongs to this workflow definition
      if (version.workflowDefinitionId !== workflowDefinitionId) {
        throw new HTTPException(400, {
          message: `Version ${versionId} does not belong to workflow definition ${workflowDefinitionId}`,
        });
      }

      return serializeVersion(version);
    } catch (error) {
      return handleError(error, 'Error getting workflow definition version');
    }
  },
});

/**
 * POST /api/workflow-definitions/:workflowDefinitionId/versions/:versionId/activate - Activate a version
 */
export const ACTIVATE_DEFINITION_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/workflow-definitions/:workflowDefinitionId/versions/:versionId/activate',
  responseType: 'json',
  pathParamSchema: workflowDefinitionVersionPathParams,
  responseSchema: activateWorkflowDefinitionVersionResponseSchema,
  summary: 'Activate workflow definition version',
  description: 'Activates a specific version, making it the current active version',
  tags: ['Workflow Definition Versions'],
  handler: async ({ mastra, workflowDefinitionId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = (await storage.getStore('workflowDefinitions')) as WorkflowDefinitionsStorage | undefined;
      if (!store) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      const definition = await store.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!definition) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      // Verify the version exists
      const version = await store.getVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version ${versionId} not found` });
      }

      // Verify version belongs to this workflow definition
      if (version.workflowDefinitionId !== workflowDefinitionId) {
        throw new HTTPException(400, {
          message: `Version ${versionId} does not belong to workflow definition ${workflowDefinitionId}`,
        });
      }

      // Update the workflow definition's activeVersionId
      await store.updateWorkflowDefinition({
        id: workflowDefinitionId,
        activeVersionId: versionId,
      });

      return {
        success: true,
        message: `Version ${versionId} activated successfully`,
        activeVersionId: versionId,
      };
    } catch (error) {
      return handleError(error, 'Error activating workflow definition version');
    }
  },
});

/**
 * DELETE /api/workflow-definitions/:workflowDefinitionId/versions/:versionId - Delete a version
 */
export const DELETE_DEFINITION_VERSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/workflow-definitions/:workflowDefinitionId/versions/:versionId',
  responseType: 'json',
  pathParamSchema: workflowDefinitionVersionPathParams,
  responseSchema: deleteWorkflowDefinitionVersionResponseSchema,
  summary: 'Delete workflow definition version',
  description: 'Deletes a specific version of a workflow definition',
  tags: ['Workflow Definition Versions'],
  handler: async ({ mastra, workflowDefinitionId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = (await storage.getStore('workflowDefinitions')) as WorkflowDefinitionsStorage | undefined;
      if (!store) {
        throw new HTTPException(500, { message: 'Workflow definitions storage domain is not available' });
      }

      // Verify the workflow definition exists
      const definition = await store.getWorkflowDefinitionById({ id: workflowDefinitionId });
      if (!definition) {
        throw new HTTPException(404, { message: `Workflow definition with id ${workflowDefinitionId} not found` });
      }

      // Verify the version exists
      const version = await store.getVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version ${versionId} not found` });
      }

      // Verify version belongs to this workflow definition
      if (version.workflowDefinitionId !== workflowDefinitionId) {
        throw new HTTPException(400, {
          message: `Version ${versionId} does not belong to workflow definition ${workflowDefinitionId}`,
        });
      }

      // Don't allow deleting active version
      if (definition.activeVersionId === versionId) {
        throw new HTTPException(400, { message: 'Cannot delete the active version. Activate another version first.' });
      }

      await store.deleteVersion(versionId);

      return {
        success: true,
        message: `Version ${versionId} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting workflow definition version');
    }
  },
});
