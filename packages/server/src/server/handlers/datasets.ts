import { Agent } from '@mastra/core/agent';
import { MastraError } from '@mastra/core/error';
import { coreFeatures } from '@mastra/core/features';
import { resolveModelConfig } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import type { DatasetItemSource, TargetType } from '@mastra/core/storage';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import { successResponseSchema } from '../schemas/common';
import {
  datasetIdPathParams,
  datasetAndExperimentIdPathParams,
  experimentResultIdPathParams,
  datasetAndItemIdPathParams,
  datasetItemVersionPathParams,
  paginationQuerySchema,
  listItemsQuerySchema,
  createDatasetBodySchema,
  updateDatasetBodySchema,
  addItemBodySchema,
  updateItemBodySchema,
  triggerExperimentBodySchema,
  compareExperimentsBodySchema,
  batchInsertItemsBodySchema,
  batchDeleteItemsBodySchema,
  generateItemsBodySchema,
  generateItemsResponseSchema,
  clusterFailuresBodySchema,
  clusterFailuresResponseSchema,
  datasetResponseSchema,
  datasetItemResponseSchema,
  experimentResponseSchema,
  experimentResultResponseSchema,
  experimentSummaryResponseSchema,
  comparisonResponseSchema,
  listDatasetsResponseSchema,
  listItemsResponseSchema,
  listExperimentsResponseSchema,
  listExperimentResultsResponseSchema,
  listDatasetVersionsResponseSchema,
  listItemVersionsResponseSchema,
  batchInsertItemsResponseSchema,
  batchDeleteItemsResponseSchema,
  updateExperimentResultBodySchema,
  reviewSummaryResponseSchema,
} from '../schemas/datasets';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// ============================================================================
// Feature gate + local type guards
// ============================================================================

function assertDatasetsAvailable(): void {
  if (!coreFeatures.has('datasets')) {
    throw new HTTPException(501, { message: 'Datasets require @mastra/core >= 1.4.0' });
  }
}

interface SchemaValidationLike extends Error {
  field: 'input' | 'groundTruth';
  errors: Array<{ path: string; code: string; message: string }>;
}

interface SchemaUpdateValidationLike extends Error {
  failingItems: Array<{
    index: number;
    data: unknown;
    field: 'input' | 'groundTruth';
    errors: Array<{ path: string; code: string; message: string }>;
  }>;
}

function isSchemaValidationError(error: unknown): error is SchemaValidationLike {
  return error instanceof Error && error.name === 'SchemaValidationError';
}

function isSchemaUpdateValidationError(error: unknown): error is SchemaUpdateValidationLike {
  return error instanceof Error && error.name === 'SchemaUpdateValidationError';
}

// ============================================================================
// Helper: Map MastraError IDs to HTTP status codes
// ============================================================================

function getHttpStatusForMastraError(errorId: string): number {
  switch (errorId) {
    case 'DATASET_NOT_FOUND':
    case 'EXPERIMENT_NOT_FOUND':
      return 404;
    case 'EXPERIMENT_NO_ITEMS':
      return 400;
    default:
      return 500;
  }
}

// ============================================================================
// Dataset CRUD Routes
// ============================================================================

export const LIST_DATASETS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets',
  responseType: 'json',
  queryParamSchema: paginationQuerySchema,
  responseSchema: listDatasetsResponseSchema,
  summary: 'List all datasets',
  description: 'Returns a paginated list of all datasets',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { page, perPage } = params;
      const result = await mastra.datasets.list({ page: page ?? 0, perPage: perPage ?? 10 });
      return {
        datasets: result.datasets as any,
        pagination: result.pagination,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing datasets');
    }
  },
});

export const CREATE_DATASET_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets',
  responseType: 'json',
  bodySchema: createDatasetBodySchema,
  responseSchema: datasetResponseSchema,
  summary: 'Create a new dataset',
  description: 'Creates a new dataset with the specified name and optional metadata',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    assertDatasetsAvailable();
    try {
      const {
        name,
        description,
        metadata,
        inputSchema,
        groundTruthSchema,
        requestContextSchema,
        targetType,
        targetIds,
        scorerIds,
      } = params as {
        name: string;
        description?: string;
        metadata?: Record<string, unknown>;
        inputSchema?: Record<string, unknown> | null;
        groundTruthSchema?: Record<string, unknown> | null;
        requestContextSchema?: Record<string, unknown> | null;
        targetType?: TargetType;
        targetIds?: string[];
        scorerIds?: string[];
      };
      const ds = await mastra.datasets.create({
        name,
        description,
        metadata,
        inputSchema,
        groundTruthSchema,
        requestContextSchema,
        targetType,
        targetIds,
        scorerIds,
      });
      const details = await ds.getDetails();
      return details as any;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error creating dataset');
    }
  },
});

export const GET_DATASET_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  responseSchema: datasetResponseSchema.nullable(),
  summary: 'Get dataset by ID',
  description: 'Returns details for a specific dataset',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId }) => {
    assertDatasetsAvailable();
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      return (await ds.getDetails()) as any;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error getting dataset');
    }
  },
});

export const UPDATE_DATASET_ROUTE = createRoute({
  method: 'PATCH',
  path: '/datasets/:datasetId',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: updateDatasetBodySchema,
  responseSchema: datasetResponseSchema,
  summary: 'Update dataset',
  description: 'Updates a dataset with the specified fields',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const {
        name,
        description,
        metadata,
        inputSchema,
        groundTruthSchema,
        requestContextSchema,
        tags,
        targetType,
        targetIds,
        scorerIds,
      } = params as {
        name?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        inputSchema?: Record<string, unknown> | null;
        groundTruthSchema?: Record<string, unknown> | null;
        requestContextSchema?: Record<string, unknown> | null;
        tags?: string[];
        targetType?: TargetType;
        targetIds?: string[];
        scorerIds?: string[] | null;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.update({
        name,
        description,
        metadata,
        inputSchema,
        groundTruthSchema,
        requestContextSchema,
        tags,
        targetType,
        targetIds,
        scorerIds,
      });
      return result as any;
    } catch (error) {
      if (isSchemaUpdateValidationError(error)) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { failingItems: error.failingItems },
        });
      }
      if (isSchemaValidationError(error)) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
      }
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error updating dataset');
    }
  },
});

export const DELETE_DATASET_ROUTE = createRoute({
  method: 'DELETE',
  path: '/datasets/:datasetId',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  responseSchema: successResponseSchema,
  summary: 'Delete dataset',
  description: 'Deletes a dataset and all its items',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId }) => {
    assertDatasetsAvailable();
    try {
      await mastra.datasets.get({ id: datasetId }); // validates existence
      await mastra.datasets.delete({ id: datasetId });
      return { success: true };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error deleting dataset');
    }
  },
});

// ============================================================================
// Item CRUD Routes
// ============================================================================

export const LIST_ITEMS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  queryParamSchema: listItemsQuerySchema,
  responseSchema: listItemsResponseSchema,
  summary: 'List dataset items',
  description: 'Returns a paginated list of items in the dataset',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { page, perPage, version, search } = params;
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.listItems({
        page: page ?? 0,
        perPage: perPage ?? 10,
        version,
        search,
      });
      // When version is specified, result is DatasetItem[] (flat). Otherwise paginated.
      if (Array.isArray(result)) {
        return { items: result, pagination: { total: result.length, page: 0, perPage: result.length, hasMore: false } };
      }
      return { items: result.items, pagination: result.pagination };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing dataset items');
    }
  },
});

export const ADD_ITEM_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: addItemBodySchema,
  responseSchema: datasetItemResponseSchema,
  summary: 'Add item to dataset',
  description: 'Adds a new item to the dataset (auto-increments dataset version)',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { input, groundTruth, requestContext, metadata, source, expectedTrajectory } = params as {
        input: unknown;
        groundTruth?: unknown;
        requestContext?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        source?: DatasetItemSource;
        expectedTrajectory?: unknown;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      return await ds.addItem({ input, groundTruth, requestContext, metadata, source, expectedTrajectory });
    } catch (error) {
      if (isSchemaValidationError(error)) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
      }
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error adding item to dataset');
    }
  },
});

export const GET_ITEM_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/items/:itemId',
  responseType: 'json',
  pathParamSchema: datasetAndItemIdPathParams,
  responseSchema: datasetItemResponseSchema.nullable(),
  summary: 'Get dataset item by ID',
  description: 'Returns details for a specific dataset item',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, itemId }) => {
    assertDatasetsAvailable();
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      const item = await ds.getItem({ itemId });
      if (!item || (item as any).datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }
      return item as any;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error getting dataset item');
    }
  },
});

export const UPDATE_ITEM_ROUTE = createRoute({
  method: 'PATCH',
  path: '/datasets/:datasetId/items/:itemId',
  responseType: 'json',
  pathParamSchema: datasetAndItemIdPathParams,
  bodySchema: updateItemBodySchema,
  responseSchema: datasetItemResponseSchema,
  summary: 'Update dataset item',
  description: 'Updates a dataset item (auto-increments dataset version)',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, itemId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { input, groundTruth, requestContext, metadata, expectedTrajectory } = params as {
        input?: unknown;
        groundTruth?: unknown;
        requestContext?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        expectedTrajectory?: unknown;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      // Check if item exists and belongs to dataset
      const existing = await ds.getItem({ itemId });
      if (!existing || (existing as any).datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }
      return await ds.updateItem({ itemId, input, groundTruth, requestContext, metadata, expectedTrajectory });
    } catch (error) {
      if (isSchemaValidationError(error)) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
      }
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error updating dataset item');
    }
  },
});

export const DELETE_ITEM_ROUTE = createRoute({
  method: 'DELETE',
  path: '/datasets/:datasetId/items/:itemId',
  responseType: 'json',
  pathParamSchema: datasetAndItemIdPathParams,
  responseSchema: successResponseSchema,
  summary: 'Delete dataset item',
  description: 'Deletes a dataset item',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, itemId }) => {
    assertDatasetsAvailable();
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      const existing = await ds.getItem({ itemId });
      if (!existing || (existing as any).datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }
      await ds.deleteItem({ itemId });
      return { success: true };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error deleting dataset item');
    }
  },
});

// ============================================================================
// Experiment Operations Routes
// ============================================================================

export const LIST_ALL_EXPERIMENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/experiments',
  responseType: 'json',
  queryParamSchema: paginationQuerySchema,
  responseSchema: listExperimentsResponseSchema,
  summary: 'List all experiments',
  description: 'Returns a paginated list of all experiments across all datasets',
  tags: ['Experiments'],
  requiresAuth: true,
  handler: async ({ mastra, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { page, perPage } = params;
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }
      const experimentsStore = await storage.getStore('experiments');
      if (!experimentsStore) {
        throw new HTTPException(500, { message: 'Experiments storage not available' });
      }
      const result = await experimentsStore.listExperiments({
        pagination: { page: page ?? 0, perPage: perPage ?? 20 },
      });
      return { experiments: result.experiments, pagination: result.pagination };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing experiments');
    }
  },
});

export const EXPERIMENT_REVIEW_SUMMARY_ROUTE = createRoute({
  method: 'GET',
  path: '/experiments/review-summary',
  responseType: 'json',
  responseSchema: reviewSummaryResponseSchema,
  summary: 'Get review summary for all experiments',
  description: 'Returns review status counts (needs-review, reviewed, complete) aggregated per experiment',
  tags: ['Experiments'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    assertDatasetsAvailable();
    try {
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }
      const experimentsStore = await storage.getStore('experiments');
      if (!experimentsStore) {
        throw new HTTPException(500, { message: 'Experiments storage not available' });
      }
      const counts = await experimentsStore.getReviewSummary();
      return { counts };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error getting review summary');
    }
  },
});

export const LIST_EXPERIMENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/experiments',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  queryParamSchema: paginationQuerySchema,
  responseSchema: listExperimentsResponseSchema,
  summary: 'List experiments for dataset',
  description: 'Returns a paginated list of experiments for the dataset',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { page, perPage } = params;
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.listExperiments({ page: page ?? 0, perPage: perPage ?? 10 });
      return { experiments: result.experiments, pagination: result.pagination };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing experiments');
    }
  },
});

export const TRIGGER_EXPERIMENT_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/experiments',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: triggerExperimentBodySchema,
  responseSchema: experimentSummaryResponseSchema,
  summary: 'Trigger a new experiment',
  description:
    'Triggers a new experiment on the dataset against the specified target. Returns immediately with pending status; execution happens in background.',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const {
        targetType,
        targetId,
        scorerIds,
        version,
        agentVersion,
        maxConcurrency,
        requestContext: rawRequestContext,
      } = params as {
        targetType: 'agent' | 'workflow' | 'scorer';
        targetId: string;
        scorerIds?: string[];
        version?: number;
        agentVersion?: string;
        maxConcurrency?: number;
        requestContext?: Record<string, unknown> | RequestContext;
      };
      // The adapter middleware merges body + query requestContext into a RequestContext instance.
      // startExperimentAsync expects a plain Record, so convert it.
      const requestContext = rawRequestContext instanceof RequestContext ? rawRequestContext.all : rawRequestContext;
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.startExperimentAsync({
        targetType,
        targetId,
        scorers: scorerIds,
        version,
        agentVersion,
        maxConcurrency,
        requestContext,
      });
      // Return shape matching experimentSummaryResponseSchema
      return {
        experimentId: result.experimentId,
        status: result.status,
        totalItems: result.totalItems ?? 0,
        succeededCount: 0,
        failedCount: 0,
        startedAt: new Date(),
        completedAt: null,
        results: [],
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error triggering experiment');
    }
  },
});

export const GET_EXPERIMENT_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/experiments/:experimentId',
  responseType: 'json',
  pathParamSchema: datasetAndExperimentIdPathParams,
  responseSchema: experimentResponseSchema.nullable(),
  summary: 'Get experiment by ID',
  description: 'Returns details for a specific experiment',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, experimentId }) => {
    assertDatasetsAvailable();
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      const run = await ds.getExperiment({ experimentId });
      if (!run || run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Experiment not found: ${experimentId}` });
      }
      return run;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error getting experiment');
    }
  },
});

export const LIST_EXPERIMENT_RESULTS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/experiments/:experimentId/results',
  responseType: 'json',
  pathParamSchema: datasetAndExperimentIdPathParams,
  queryParamSchema: paginationQuerySchema,
  responseSchema: listExperimentResultsResponseSchema,
  summary: 'List experiment results',
  description: 'Returns a paginated list of results for the experiment',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, experimentId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { page, perPage } = params;
      const ds = await mastra.datasets.get({ id: datasetId });
      // Validate experiment belongs to dataset
      const run = await ds.getExperiment({ experimentId });
      if (!run || run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Experiment not found: ${experimentId}` });
      }
      const result = await ds.listExperimentResults({ experimentId, page: page ?? 0, perPage: perPage ?? 10 });
      return {
        results: result.results.map(({ experimentId: _eid, ...rest }) => ({ experimentId, ...rest })),
        pagination: result.pagination,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing experiment results');
    }
  },
});

export const UPDATE_EXPERIMENT_RESULT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/datasets/:datasetId/experiments/:experimentId/results/:resultId',
  responseType: 'json',
  pathParamSchema: experimentResultIdPathParams,
  bodySchema: updateExperimentResultBodySchema,
  responseSchema: experimentResultResponseSchema,
  summary: 'Update an experiment result',
  description: 'Updates the status and/or tags on an experiment result',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, resultId, experimentId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }
      const experimentsStore = await storage.getStore('experiments');
      if (!experimentsStore) {
        throw new HTTPException(500, { message: 'Experiments storage not available' });
      }

      const result = await experimentsStore.updateExperimentResult({
        id: resultId,
        experimentId,
        status: params.status,
        tags: params.tags,
      });

      return result;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error updating experiment result');
    }
  },
});

// ============================================================================
// Analytics Routes (nested under datasets)
// ============================================================================

export const COMPARE_EXPERIMENTS_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/compare',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: compareExperimentsBodySchema,
  responseSchema: comparisonResponseSchema,
  summary: 'Compare two experiments',
  description: 'Compares two experiments to detect score regressions',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { experimentIdA, experimentIdB } = params as {
        experimentIdA: string;
        experimentIdB: string;
      };
      // Validate dataset exists
      await mastra.datasets.get({ id: datasetId });
      const result = await mastra.datasets.compareExperiments({
        experimentIds: [experimentIdA, experimentIdB],
        baselineId: experimentIdA,
      });
      return result;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error comparing experiments');
    }
  },
});

// ============================================================================
// Version Routes
// ============================================================================

export const LIST_DATASET_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/versions',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  queryParamSchema: paginationQuerySchema,
  responseSchema: listDatasetVersionsResponseSchema,
  summary: 'List dataset versions',
  description: 'Returns a paginated list of all versions for the dataset',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { page, perPage } = params;
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.listVersions({ page: page ?? 0, perPage: perPage ?? 10 });
      return { versions: result.versions, pagination: result.pagination };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing dataset versions');
    }
  },
});

export const LIST_ITEM_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/items/:itemId/history',
  responseType: 'json',
  pathParamSchema: datasetAndItemIdPathParams,
  responseSchema: listItemVersionsResponseSchema,
  summary: 'Get item history',
  description: 'Returns the full SCD-2 history of the item across all dataset versions',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, itemId }) => {
    assertDatasetsAvailable();
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      const rows = await ds.getItemHistory({ itemId });
      // Check rows belong to this dataset
      if (rows.length > 0 && rows[0]?.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found in dataset: ${itemId}` });
      }
      return { history: rows };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing item history');
    }
  },
});

export const GET_ITEM_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/items/:itemId/versions/:datasetVersion',
  responseType: 'json',
  pathParamSchema: datasetItemVersionPathParams,
  responseSchema: datasetItemResponseSchema.nullable(),
  summary: 'Get item at specific dataset version',
  description: 'Returns the item as it existed at a specific dataset version',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, itemId, datasetVersion }) => {
    assertDatasetsAvailable();
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      const item = await ds.getItem({ itemId, version: datasetVersion });
      if (!item) {
        throw new HTTPException(404, { message: `Item ${itemId} not found at version ${datasetVersion}` });
      }
      if ((item as any).datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found in dataset: ${itemId}` });
      }
      return item as any;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error getting item version');
    }
  },
});

// ============================================================================
// Batch Operations Routes
// ============================================================================

export const BATCH_INSERT_ITEMS_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/items/batch',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: batchInsertItemsBodySchema,
  responseSchema: batchInsertItemsResponseSchema,
  summary: 'Batch insert items to dataset',
  description: 'Adds multiple items to the dataset in a single operation (single version entry)',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { items } = params as {
        items: Array<{
          input: unknown;
          groundTruth?: unknown;
          expectedTrajectory?: unknown;
          metadata?: Record<string, unknown>;
          source?: DatasetItemSource;
        }>;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      const addedItems = await ds.addItems({ items });
      return { items: addedItems, count: addedItems.length };
    } catch (error) {
      if (isSchemaValidationError(error)) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
      }
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error batch inserting items');
    }
  },
});

export const BATCH_DELETE_ITEMS_ROUTE = createRoute({
  method: 'DELETE',
  path: '/datasets/:datasetId/items/batch',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: batchDeleteItemsBodySchema,
  responseSchema: batchDeleteItemsResponseSchema,
  summary: 'Batch delete items from dataset',
  description: 'Deletes multiple items from the dataset in a single operation (single version entry)',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    assertDatasetsAvailable();
    try {
      const { itemIds } = params as { itemIds: string[] };
      const ds = await mastra.datasets.get({ id: datasetId });
      await ds.deleteItems({ itemIds });
      return { success: true, deletedCount: itemIds.length };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error bulk deleting items');
    }
  },
});

// ============================================================================
// AI Generation
// ============================================================================

const GENERATE_ITEMS_SYSTEM_PROMPT = `You are a test data generation expert. Your job is to generate realistic, diverse test data items for an AI agent evaluation dataset.

You will be given context about the agent being tested — its purpose, system prompt, and available tools. Use this to generate inputs that thoroughly exercise the agent's capabilities.

Generate test items that:
1. Are realistic and diverse — cover edge cases, different complexities, and various scenarios
2. Match the provided schemas exactly
3. Include ground truth values when a ground truth schema is provided
4. Vary in difficulty (easy, medium, hard cases)
5. Include potential edge cases and tricky inputs
6. Test different aspects of the agent's capabilities based on its tools and instructions

Return the items as a JSON array.`;

export const GENERATE_ITEMS_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/generate-items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: generateItemsBodySchema,
  responseSchema: generateItemsResponseSchema,
  summary: 'Generate dataset items using AI',
  description:
    'Uses an LLM to generate synthetic dataset items based on the dataset schema and a user prompt. Returns generated items for review — they are NOT automatically added to the dataset.',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, modelId, prompt, count, agentContext }) => {
    assertDatasetsAvailable();
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      const dataset = await ds.getDetails();

      // Resolve the model from the "provider/model" string
      const model = await resolveModelConfig(modelId, undefined, mastra);

      // Build context about the dataset schema for the generator
      const schemaContext = [
        dataset.inputSchema ? `Input schema:\n${JSON.stringify(dataset.inputSchema, null, 2)}` : null,
        dataset.groundTruthSchema
          ? `Ground truth schema:\n${JSON.stringify(dataset.groundTruthSchema, null, 2)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const generatorAgent = new Agent({
        id: 'dataset-item-generator',
        name: 'dataset-item-generator',
        instructions: GENERATE_ITEMS_SYSTEM_PROMPT,
        model,
      });

      // Build the structured output schema dynamically based on count
      // Use z.string() for input/groundTruth since OpenAI structured output requires concrete types.
      // The generator will produce JSON strings that we parse back into objects if needed.
      const itemSchema = z.object({
        input: z
          .string()
          .describe('The input data as a JSON string matching the input schema, or a plain text string if no schema'),
        groundTruth: z
          .string()
          .optional()
          .describe('The expected output as a JSON string matching the ground truth schema'),
      });
      const outputSchema = z.object({
        items: z.array(itemSchema).min(1).max(count),
      });

      // Build agent context section
      const agentContextParts = [];
      if (agentContext?.description) {
        agentContextParts.push(`Agent description: ${agentContext.description}`);
      }
      if (agentContext?.instructions) {
        agentContextParts.push(`Agent system prompt:\n${agentContext.instructions}`);
      }
      if (agentContext?.tools?.length) {
        agentContextParts.push(`Agent tools: ${agentContext.tools.join(', ')}`);
      }
      const agentContextSection = agentContextParts.length > 0 ? agentContextParts.join('\n\n') : null;

      const userMessage = [
        `Generate exactly ${count} test items for a dataset named "${dataset.name}".`,
        dataset.description ? `Dataset description: ${dataset.description}` : null,
        agentContextSection ? `--- AGENT CONTEXT ---\n${agentContextSection}` : null,
        schemaContext || null,
        `User's request: ${prompt}`,
        `Return exactly ${count} items.`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const result = await generatorAgent.generate(userMessage, {
        structuredOutput: { schema: outputSchema },
      });

      const generated = await result.object;

      // Parse JSON strings back to objects where possible
      const items = generated.items.map(item => {
        let input: unknown = item.input;
        try {
          input = JSON.parse(item.input);
        } catch {
          // Keep as string if not valid JSON
        }
        let groundTruth: unknown = item.groundTruth;
        if (item.groundTruth) {
          try {
            groundTruth = JSON.parse(item.groundTruth);
          } catch {
            // Keep as string if not valid JSON
          }
        }
        return { input, groundTruth };
      });

      return { items };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error generating dataset items');
    }
  },
});

// ============================================================================
// Failure Clustering
// ============================================================================

const CLUSTER_FAILURES_SYSTEM_PROMPT = `You are an AI evaluation expert specializing in failure analysis. Given a set of failure items from an AI agent experiment, identify common failure patterns and assign descriptive tags to each item.

For each cluster you identify, provide:
- A short, descriptive tag label (2-5 words, lowercase, hyphenated, e.g., "no-tool-usage", "hallucination")
- A description explaining the common failure pattern
- The IDs of items that belong to this cluster

Also return a "proposedTags" array mapping each item ID to the tags you recommend, along with a brief "reason" explaining WHY those tags apply to that specific item. The reason should reference concrete evidence from the item's input/output/error.

Guidelines:
- Create between 1 and 8 clusters depending on the diversity of failures
- Every item must be assigned to at least one cluster unless there is no clear pattern of failure
- Focus on the root cause of failures, not surface-level symptoms
- If items have scores, use low scores as signals for the failure type
- Be specific about what went wrong
- IMPORTANT: If existing tags are provided, PREFER reusing them over creating new ones. Only create new tags when no existing tag fits.
- Items may already have tags — consider those when assigning new ones and avoid duplicating existing tags on an item.
- The "reason" field should be 1-2 sentences explaining the specific evidence for each tag assignment.`;

export const CLUSTER_FAILURES_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/cluster-failures',
  responseType: 'json',
  bodySchema: clusterFailuresBodySchema,
  responseSchema: clusterFailuresResponseSchema,
  summary: 'Cluster experiment failures using AI',
  description:
    'Uses an LLM to analyze failure items from an experiment and group them into meaningful failure pattern clusters.',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, modelId, items, availableTags, prompt }) => {
    assertDatasetsAvailable();
    try {
      const model = await resolveModelConfig(modelId, undefined, mastra);

      const clusterAgent = new Agent({
        id: 'failure-cluster-analyzer',
        name: 'failure-cluster-analyzer',
        instructions: CLUSTER_FAILURES_SYSTEM_PROMPT,
        model,
      });

      const outputSchema = z.object({
        clusters: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            description: z.string(),
            itemIds: z.array(z.string()),
          }),
        ),
        proposedTags: z.array(
          z.object({
            itemId: z.string(),
            tags: z.array(z.string()),
            reason: z.string().describe('Brief explanation of why these tags were assigned'),
          }),
        ),
      });

      const itemSummaries = items.map((item, i) => {
        const parts = [`Item ${i + 1} (id: ${item.id}):`];
        if (item.input !== undefined && item.input !== null) parts.push(`  Input: ${JSON.stringify(item.input)}`);
        if (item.output !== undefined && item.output !== null) parts.push(`  Output: ${JSON.stringify(item.output)}`);
        if (item.error !== undefined && item.error !== null) {
          parts.push(`  Error: ${typeof item.error === 'string' ? item.error : JSON.stringify(item.error)}`);
        }
        if (item.scores !== undefined && item.scores !== null) {
          parts.push(`  Scores: ${JSON.stringify(item.scores)}`);
        }
        if (item.existingTags && item.existingTags.length > 0) {
          parts.push(`  Existing tags: ${item.existingTags.join(', ')}`);
        }
        return parts.join('\n');
      });

      let userMessage = `Analyze these ${items.length} failure items and group them into clusters of common failure patterns:\n\n${itemSummaries.join('\n\n')}`;

      if (availableTags && availableTags.length > 0) {
        userMessage += `\n\nExisting tag vocabulary (prefer reusing these): ${availableTags.join(', ')}`;
      }

      if (prompt) {
        userMessage += `\n\nAdditional instructions from the reviewer: ${prompt}`;
      }

      userMessage += `\n\nReturn both "clusters" (grouping items by pattern) and "proposedTags" (a list mapping each item ID to the tag labels you recommend, with a "reason" explaining why). For proposedTags, only include NEW tags to add — do not repeat tags the item already has.`;

      const result = await clusterAgent.generate(userMessage, {
        structuredOutput: { schema: outputSchema },
      });

      const generated = await result.object;
      return { clusters: generated.clusters, proposedTags: generated.proposedTags ?? [] };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error clustering failures');
    }
  },
});
