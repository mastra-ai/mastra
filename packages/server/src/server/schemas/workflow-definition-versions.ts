import { z } from 'zod';
import { createPagePaginationSchema, paginationInfoSchema } from './common';
import {
  createWorkflowDefinitionBodySchema,
  storageOrderBySchema,
  workflowDefinitionIdPathParams,
} from './workflow-definitions';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Path parameters for workflow definition version operations
 * Includes both workflowDefinitionId and versionId
 */
export const workflowDefinitionVersionPathParams = workflowDefinitionIdPathParams.extend({
  versionId: z.string().describe('Unique identifier for the workflow definition version'),
});

// ============================================================================
// Snapshot Schema (matches StorageWorkflowDefinitionType)
// ============================================================================

/**
 * Workflow definition snapshot stored in a version
 */
export const workflowDefinitionSnapshotSchema = z.object({
  id: z.string().describe('Unique identifier for the workflow definition'),
  name: z.string().describe('Name of the workflow definition'),
  description: z.string().optional().describe('Description of the workflow definition'),
  inputSchema: z.record(z.unknown()).describe('JSON Schema for workflow input'),
  outputSchema: z.record(z.unknown()).describe('JSON Schema for workflow output'),
  stateSchema: z.record(z.unknown()).optional().describe('JSON Schema for workflow state'),
  stepGraph: createWorkflowDefinitionBodySchema.shape.stepGraph.describe(
    'Array of step flow entries defining execution order',
  ),
  steps: createWorkflowDefinitionBodySchema.shape.steps.describe('Map of step ID to step definition'),
  retryConfig: createWorkflowDefinitionBodySchema.shape.retryConfig,
  ownerId: z.string().optional().describe('Owner ID for multi-tenancy'),
  activeVersionId: z.string().optional().describe('ID of the currently active version'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata'),
  createdAt: z.string().describe('ISO timestamp when the definition was created'),
  updatedAt: z.string().describe('ISO timestamp when the definition was last updated'),
});

// ============================================================================
// Request Body Schemas
// ============================================================================

/**
 * POST /api/storage/workflow-definitions/:workflowDefinitionId/versions - Create version body
 * Only requires optional name and change message - the current definition is snapshotted
 */
export const createWorkflowDefinitionVersionBodySchema = z.object({
  name: z.string().optional().describe('Optional name for this version'),
  changeMessage: z.string().optional().describe('Description of changes in this version'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Workflow definition version object schema (full response)
 */
export const workflowDefinitionVersionResponseSchema = z.object({
  id: z.string().describe('Unique identifier for this version'),
  workflowDefinitionId: z.string().describe('ID of the parent workflow definition'),
  versionNumber: z.number().describe('Sequential version number'),
  name: z.string().optional().describe('Optional name for this version'),
  snapshot: workflowDefinitionSnapshotSchema.describe('Snapshot of the workflow definition at this version'),
  changedFields: z.array(z.string()).optional().describe('List of fields that changed from the previous version'),
  changeMessage: z.string().optional().describe('Description of changes in this version'),
  createdAt: z.string().describe('ISO timestamp when the version was created'),
});

/**
 * GET /api/storage/workflow-definitions/:workflowDefinitionId/versions - List versions query params
 */
export const listWorkflowDefinitionVersionsQuerySchema = createPagePaginationSchema(50).extend({
  orderBy: storageOrderBySchema.optional(),
});

/**
 * Response for GET /api/storage/workflow-definitions/:workflowDefinitionId/versions
 */
export const listWorkflowDefinitionVersionsResponseSchema = paginationInfoSchema.extend({
  versions: z.array(workflowDefinitionVersionResponseSchema),
});

/**
 * Response for GET /api/storage/workflow-definitions/:workflowDefinitionId/versions/:versionId
 */
export const getWorkflowDefinitionVersionResponseSchema = workflowDefinitionVersionResponseSchema;

/**
 * Response for POST /api/storage/workflow-definitions/:workflowDefinitionId/versions
 */
export const createWorkflowDefinitionVersionResponseSchema = workflowDefinitionVersionResponseSchema;

/**
 * Response for DELETE /api/storage/workflow-definitions/:workflowDefinitionId/versions/:versionId
 */
export const deleteWorkflowDefinitionVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============================================================================
// Activate Version Schemas
// ============================================================================

/**
 * POST /api/storage/workflow-definitions/:workflowDefinitionId/versions/:versionId/activate
 * Response for activating a specific version
 */
export const activateWorkflowDefinitionVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string().describe('The ID of the now-active version'),
});

// ============================================================================
// Compare Versions Schemas
// ============================================================================

/**
 * Query params for comparing two versions
 */
export const compareWorkflowDefinitionVersionsQuerySchema = z.object({
  versionA: z.string().describe('First version ID to compare'),
  versionB: z.string().describe('Second version ID to compare'),
});

/**
 * Diff entry representing a change between versions
 */
export const versionDiffEntrySchema = z.object({
  path: z.string().describe('JSON path to the changed value'),
  type: z.enum(['added', 'removed', 'changed']).describe('Type of change'),
  oldValue: z.unknown().optional().describe('Previous value (for removed/changed)'),
  newValue: z.unknown().optional().describe('New value (for added/changed)'),
});

/**
 * Response for GET /api/storage/workflow-definitions/:workflowDefinitionId/versions/compare
 */
export const compareWorkflowDefinitionVersionsResponseSchema = z.object({
  versionA: workflowDefinitionVersionResponseSchema,
  versionB: workflowDefinitionVersionResponseSchema,
  differences: z.array(versionDiffEntrySchema),
  hasDifferences: z.boolean(),
});
