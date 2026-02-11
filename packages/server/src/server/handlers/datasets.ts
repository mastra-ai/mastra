import { SchemaValidationError, SchemaUpdateValidationError } from '@mastra/core/datasets';
import { MastraError } from '@mastra/core/error';
import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import { successResponseSchema } from '../schemas/common';
import {
  datasetIdPathParams,
  datasetAndExperimentIdPathParams,
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
  bulkAddItemsBodySchema,
  bulkDeleteItemsBodySchema,
  datasetResponseSchema,
  datasetItemResponseSchema,
  experimentResponseSchema,
  experimentSummaryResponseSchema,
  comparisonResponseSchema,
  listDatasetsResponseSchema,
  listItemsResponseSchema,
  listExperimentsResponseSchema,
  listExperimentResultsResponseSchema,
  listDatasetVersionsResponseSchema,
  listItemVersionsResponseSchema,
  itemVersionResponseSchema,
  bulkAddItemsResponseSchema,
  bulkDeleteItemsResponseSchema,
} from '../schemas/datasets';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// ============================================================================
// Helper: Map MastraError IDs to HTTP status codes
// ============================================================================

function getHttpStatusForMastraError(errorId: string): number {
  switch (errorId) {
    case 'DATASET_NOT_FOUND':
    case 'EXPERIMENT_NOT_FOUND':
      return 404;
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
    try {
      const { name, description, metadata, inputSchema, groundTruthSchema } = params as {
        name: string;
        description?: string;
        metadata?: Record<string, unknown>;
        inputSchema?: Record<string, unknown> | null;
        groundTruthSchema?: Record<string, unknown> | null;
      };
      const ds = await mastra.datasets.create({
        name,
        description,
        metadata,
        inputSchema: inputSchema ?? undefined,
        groundTruthSchema: groundTruthSchema ?? undefined,
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
    try {
      const { name, description, metadata, inputSchema, groundTruthSchema } = params as {
        name?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        inputSchema?: Record<string, unknown> | null;
        groundTruthSchema?: Record<string, unknown> | null;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.update({
        name,
        description,
        metadata,
        inputSchema: inputSchema ?? undefined,
        groundTruthSchema: groundTruthSchema ?? undefined,
      });
      return result as any;
    } catch (error) {
      if (error instanceof SchemaUpdateValidationError) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { failingItems: error.failingItems },
        });
      }
      if (error instanceof SchemaValidationError) {
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
    try {
      const { page, perPage, version } = params;
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.listItems({
        page: page ?? 0,
        perPage: perPage ?? 10,
        version: version instanceof Date ? version : undefined,
      });
      // listItems returns different shapes depending on version
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
    try {
      const { input, groundTruth, metadata } = params as {
        input: unknown;
        groundTruth?: unknown;
        metadata?: Record<string, unknown>;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      return await ds.addItem({ input, groundTruth, metadata });
    } catch (error) {
      if (error instanceof SchemaValidationError) {
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
    try {
      const { input, groundTruth, metadata } = params as {
        input?: unknown;
        groundTruth?: unknown;
        metadata?: Record<string, unknown>;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      // Check if item exists and belongs to dataset
      const existing = await ds.getItem({ itemId });
      if (!existing || (existing as any).datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }
      return await ds.updateItem({ itemId, input, groundTruth, metadata });
    } catch (error) {
      if (error instanceof SchemaValidationError) {
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
// Experiment Operations Routes (nested under datasets)
// ============================================================================

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
    try {
      const { targetType, targetId, scorerIds, version, maxConcurrency } = params as {
        targetType: 'agent' | 'workflow' | 'scorer';
        targetId: string;
        scorerIds?: string[];
        version?: Date;
        maxConcurrency?: number;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.startExperimentAsync({
        targetType,
        targetId,
        scorers: scorerIds,
        version: version instanceof Date ? version : undefined,
        maxConcurrency,
      });
      // Return shape matching experimentSummaryResponseSchema
      return {
        experimentId: result.experimentId,
        status: result.status,
        totalItems: 0,
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
  path: '/datasets/:datasetId/items/:itemId/versions',
  responseType: 'json',
  pathParamSchema: datasetAndItemIdPathParams,
  queryParamSchema: paginationQuerySchema,
  responseSchema: listItemVersionsResponseSchema,
  summary: 'List item versions',
  description: 'Returns a paginated list of all versions for the item',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, itemId, ...params }) => {
    try {
      const { page, perPage } = params;
      const ds = await mastra.datasets.get({ id: datasetId });
      const result = await ds.listItemVersions({ itemId, page: page ?? 0, perPage: perPage ?? 10 });
      // Check versions belong to this dataset
      if (result.versions.length > 0 && result.versions[0]?.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found in dataset: ${itemId}` });
      }
      return { versions: result.versions, pagination: result.pagination };
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error listing item versions');
    }
  },
});

export const GET_ITEM_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/items/:itemId/versions/:versionNumber',
  responseType: 'json',
  pathParamSchema: datasetItemVersionPathParams,
  responseSchema: itemVersionResponseSchema.nullable(),
  summary: 'Get item version by number',
  description: 'Returns a specific version of the item',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, itemId, versionNumber }) => {
    try {
      const ds = await mastra.datasets.get({ id: datasetId });
      const version = await ds.getItem({ itemId, version: versionNumber });
      if (!version) {
        throw new HTTPException(404, { message: `Version ${versionNumber} not found for item: ${itemId}` });
      }
      if ((version as any).datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found in dataset: ${itemId}` });
      }
      return version as any;
    } catch (error) {
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error getting item version');
    }
  },
});

// ============================================================================
// Bulk Operations Routes
// ============================================================================

export const BULK_ADD_ITEMS_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/items/bulk',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: bulkAddItemsBodySchema,
  responseSchema: bulkAddItemsResponseSchema,
  summary: 'Bulk add items to dataset',
  description: 'Adds multiple items to the dataset in a single operation (single version entry)',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    try {
      const { items } = params as {
        items: Array<{ input: unknown; groundTruth?: unknown; metadata?: Record<string, unknown> }>;
      };
      const ds = await mastra.datasets.get({ id: datasetId });
      const addedItems = await ds.addItems({ items });
      return { items: addedItems, count: addedItems.length };
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
      }
      if (error instanceof MastraError) {
        throw new HTTPException(getHttpStatusForMastraError(error.id) as StatusCode, { message: error.message });
      }
      return handleError(error, 'Error bulk adding items');
    }
  },
});

export const BULK_DELETE_ITEMS_ROUTE = createRoute({
  method: 'DELETE',
  path: '/datasets/:datasetId/items/bulk',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: bulkDeleteItemsBodySchema,
  responseSchema: bulkDeleteItemsResponseSchema,
  summary: 'Bulk delete items from dataset',
  description: 'Deletes multiple items from the dataset in a single operation (single version entry)',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
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
