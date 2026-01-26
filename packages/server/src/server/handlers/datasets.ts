import type { StoragePagination } from '@mastra/core/storage';
import { runDataset, compareRuns } from '@mastra/core/datasets';
import { HTTPException } from '../http-exception';
import { successResponseSchema } from '../schemas/common';
import {
  datasetIdPathParams,
  datasetAndRunIdPathParams,
  datasetAndItemIdPathParams,
  paginationQuerySchema,
  listItemsQuerySchema,
  createDatasetBodySchema,
  updateDatasetBodySchema,
  addItemBodySchema,
  updateItemBodySchema,
  triggerRunBodySchema,
  compareRunsBodySchema,
  datasetResponseSchema,
  datasetItemResponseSchema,
  runResponseSchema,
  runSummaryResponseSchema,
  comparisonResponseSchema,
  listDatasetsResponseSchema,
  listItemsResponseSchema,
  listRunsResponseSchema,
  listResultsResponseSchema,
} from '../schemas/datasets';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

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
      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      const result = await datasetsStore.listDatasets({ pagination });
      return {
        datasets: result.datasets,
        pagination: result.pagination,
      };
    } catch (error) {
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
      const { name, description, metadata } = params as { name: string; description?: string; metadata?: Record<string, unknown> };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      const dataset = await datasetsStore.createDataset({ name, description, metadata });
      return dataset;
    } catch (error) {
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
      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      return dataset;
    } catch (error) {
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
      const { name, description, metadata } = params as { name?: string; description?: string; metadata?: Record<string, unknown> };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const existing = await datasetsStore.getDatasetById({ id: datasetId });
      if (!existing) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      const dataset = await datasetsStore.updateDataset({ id: datasetId, name, description, metadata });
      return dataset;
    } catch (error) {
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
      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const existing = await datasetsStore.getDatasetById({ id: datasetId });
      if (!existing) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      await datasetsStore.deleteDataset({ id: datasetId });
      return { success: true };
    } catch (error) {
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
      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      const result = await datasetsStore.listItems({
        datasetId,
        pagination,
        version: version instanceof Date ? version : undefined,
      });
      return {
        items: result.items,
        pagination: result.pagination,
      };
    } catch (error) {
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
      const { input, expectedOutput, context } = params as { input: unknown; expectedOutput?: unknown; context?: Record<string, unknown> };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      const item = await datasetsStore.addItem({ datasetId, input, expectedOutput, context });
      return item;
    } catch (error) {
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
      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      const item = await datasetsStore.getItemById({ id: itemId });
      if (!item || item.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }

      return item;
    } catch (error) {
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
      const { input, expectedOutput, context } = params as { input?: unknown; expectedOutput?: unknown; context?: Record<string, unknown> };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Check if item exists
      const existing = await datasetsStore.getItemById({ id: itemId });
      if (!existing || existing.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }

      const item = await datasetsStore.updateItem({ id: itemId, datasetId, input, expectedOutput, context });
      return item;
    } catch (error) {
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
      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Check if item exists
      const existing = await datasetsStore.getItemById({ id: itemId });
      if (!existing || existing.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }

      await datasetsStore.deleteItem({ id: itemId, datasetId });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error deleting dataset item');
    }
  },
});

// ============================================================================
// Run Operations Routes (nested under datasets)
// ============================================================================

export const LIST_RUNS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/runs',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  queryParamSchema: paginationQuerySchema,
  responseSchema: listRunsResponseSchema,
  summary: 'List runs for dataset',
  description: 'Returns a paginated list of runs for the dataset',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    try {
      const { page, perPage } = params;
      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      const runsStore = await mastra.getStorage()?.getStore('runs');
      if (!datasetsStore || !runsStore) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      const result = await runsStore.listRuns({ datasetId, pagination });
      return {
        runs: result.runs,
        pagination: result.pagination,
      };
    } catch (error) {
      return handleError(error, 'Error listing runs');
    }
  },
});

export const TRIGGER_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/runs',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: triggerRunBodySchema,
  responseSchema: runSummaryResponseSchema,
  summary: 'Trigger a new run',
  description: 'Triggers a new run of the dataset against the specified target',
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

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Run the dataset
      const summary = await runDataset(mastra, {
        datasetId,
        targetType,
        targetId,
        scorers: scorerIds,
        version: version instanceof Date ? version : undefined,
        maxConcurrency,
      });

      return summary;
    } catch (error) {
      return handleError(error, 'Error triggering run');
    }
  },
});

export const GET_RUN_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/runs/:runId',
  responseType: 'json',
  pathParamSchema: datasetAndRunIdPathParams,
  responseSchema: runResponseSchema.nullable(),
  summary: 'Get run by ID',
  description: 'Returns details for a specific run',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, runId }) => {
    try {
      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      const runsStore = await mastra.getStorage()?.getStore('runs');
      if (!datasetsStore || !runsStore) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      const run = await runsStore.getRunById({ id: runId });
      if (!run || run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Run not found: ${runId}` });
      }

      return run;
    } catch (error) {
      return handleError(error, 'Error getting run');
    }
  },
});

export const LIST_RESULTS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/runs/:runId/results',
  responseType: 'json',
  pathParamSchema: datasetAndRunIdPathParams,
  queryParamSchema: paginationQuerySchema,
  responseSchema: listResultsResponseSchema,
  summary: 'List run results',
  description: 'Returns a paginated list of results for the run',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, runId, ...params }) => {
    try {
      const { page, perPage } = params;
      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      const runsStore = await mastra.getStorage()?.getStore('runs');
      if (!datasetsStore || !runsStore) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Check if run exists and belongs to dataset
      const run = await runsStore.getRunById({ id: runId });
      if (!run || run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Run not found: ${runId}` });
      }

      const result = await runsStore.listResults({ runId, pagination });
      return {
        results: result.results,
        pagination: result.pagination,
      };
    } catch (error) {
      return handleError(error, 'Error listing run results');
    }
  },
});

// ============================================================================
// Analytics Routes (nested under datasets)
// ============================================================================

export const COMPARE_RUNS_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/compare',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: compareRunsBodySchema,
  responseSchema: comparisonResponseSchema,
  summary: 'Compare two runs',
  description: 'Compares two runs to detect score regressions',
  tags: ['Datasets'],
  requiresAuth: true,
  handler: async ({ mastra, datasetId, ...params }) => {
    try {
      const { runIdA, runIdB, thresholds } = params as {
        runIdA: string;
        runIdB: string;
        thresholds?: Record<string, { value: number; direction?: 'higher-is-better' | 'lower-is-better' }>;
      };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      const runsStore = await mastra.getStorage()?.getStore('runs');
      if (!datasetsStore || !runsStore) {
        throw new HTTPException(500, { message: 'Storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Validate both runs belong to the dataset (or warn)
      const [runA, runB] = await Promise.all([
        runsStore.getRunById({ id: runIdA }),
        runsStore.getRunById({ id: runIdB }),
      ]);

      if (!runA) {
        throw new HTTPException(404, { message: `Run A not found: ${runIdA}` });
      }
      if (!runB) {
        throw new HTTPException(404, { message: `Run B not found: ${runIdB}` });
      }

      // Compare runs
      const result = await compareRuns(mastra, {
        runIdA,
        runIdB,
        thresholds,
      });

      // Add warning if runs are from different datasets
      if (runA.datasetId !== datasetId || runB.datasetId !== datasetId) {
        result.warnings.push('One or both runs belong to a different dataset than the comparison endpoint');
      }

      return result;
    } catch (error) {
      return handleError(error, 'Error comparing runs');
    }
  },
});
