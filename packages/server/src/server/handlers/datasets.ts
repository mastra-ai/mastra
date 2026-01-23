import type { StoragePagination } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import {
  datasetIdPathParams,
  datasetItemIdPathParams,
  datasetRunIdPathParams,
  listDatasetsQuerySchema,
  listDatasetItemsQuerySchema,
  listDatasetRunsQuerySchema,
  listDatasetRunResultsQuerySchema,
  createDatasetBodySchema,
  updateDatasetBodySchema,
  createDatasetItemsBodySchema,
  updateDatasetItemBodySchema,
  createDatasetRunBodySchema,
  datasetResponseSchema,
  datasetItemsResponseSchema,
  datasetItemResponseSchema,
  datasetRunResponseSchema,
  deleteDatasetResponseSchema,
  listDatasetsResponseSchema,
  listDatasetItemsResponseSchema,
  listDatasetRunsResponseSchema,
  listDatasetRunResultsWithInputResponseSchema,
} from '../schemas/datasets';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// ============================================================================
// Dataset Routes
// ============================================================================

export const LIST_DATASETS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets',
  responseType: 'json',
  queryParamSchema: listDatasetsQuerySchema,
  responseSchema: listDatasetsResponseSchema,
  summary: 'List all datasets',
  description: 'Returns a paginated list of all datasets',
  tags: ['Datasets'],
  handler: async ({ mastra, page, perPage }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const result = await store.listDatasets(pagination);
      return result;
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
  summary: 'Create a dataset',
  description: 'Creates a new dataset for evaluation',
  tags: ['Datasets'],
  handler: async ({ mastra, name, description, metadata }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      const dataset = await store.createDataset({ name, description, metadata });
      return { dataset };
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
  responseSchema: datasetResponseSchema,
  summary: 'Get dataset by ID',
  description: 'Returns details for a specific dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      const dataset = await store.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      return { dataset };
    } catch (error) {
      return handleError(error, 'Error getting dataset');
    }
  },
});

export const UPDATE_DATASET_ROUTE = createRoute({
  method: 'PUT',
  path: '/datasets/:datasetId',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: updateDatasetBodySchema,
  responseSchema: datasetResponseSchema,
  summary: 'Update dataset',
  description: 'Updates an existing dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, name, description, metadata }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      const dataset = await store.updateDataset({ id: datasetId, payload: { name, description, metadata } });
      return { dataset };
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
  responseSchema: deleteDatasetResponseSchema,
  summary: 'Delete dataset',
  description: 'Deletes a dataset and all its items',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      await store.deleteDataset({ id: datasetId });
      return { success: true as const };
    } catch (error) {
      return handleError(error, 'Error deleting dataset');
    }
  },
});

// ============================================================================
// Dataset Items Routes
// ============================================================================

export const LIST_DATASET_ITEMS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  queryParamSchema: listDatasetItemsQuerySchema,
  responseSchema: listDatasetItemsResponseSchema,
  summary: 'List dataset items',
  description: 'Returns a paginated list of items in a dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, page, perPage, asOf, includeArchived }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const result = await store.listDatasetItems({
        options: {
          datasetId,
          asOf,
          includeArchived,
        },
        pagination,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing dataset items');
    }
  },
});

export const CREATE_DATASET_ITEMS_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/items',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: createDatasetItemsBodySchema,
  responseSchema: datasetItemsResponseSchema,
  summary: 'Create dataset items',
  description: 'Creates new items in a dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, items }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      // Add datasetId to each item
      const payloads = items.map(item => ({
        ...item,
        datasetId,
      }));

      const createdItems = await store.createDatasetItems(payloads);
      return { items: createdItems };
    } catch (error) {
      return handleError(error, 'Error creating dataset items');
    }
  },
});

export const UPDATE_DATASET_ITEM_ROUTE = createRoute({
  method: 'PUT',
  path: '/datasets/:datasetId/items/:itemId',
  responseType: 'json',
  pathParamSchema: datasetItemIdPathParams,
  bodySchema: updateDatasetItemBodySchema,
  responseSchema: datasetItemResponseSchema,
  summary: 'Update dataset item',
  description: 'Updates an existing item in a dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, itemId, input, expectedOutput, metadata }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      // Verify item belongs to this dataset
      const existing = await store.getDatasetItemById({ id: itemId });
      if (!existing) {
        throw new HTTPException(404, { message: `Dataset item not found: ${itemId}` });
      }
      if (existing.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Dataset item not found in dataset: ${datasetId}` });
      }

      const item = await store.updateDatasetItem({ id: itemId, payload: { input, expectedOutput, metadata } });
      return { item };
    } catch (error) {
      return handleError(error, 'Error updating dataset item');
    }
  },
});

export const ARCHIVE_DATASET_ITEM_ROUTE = createRoute({
  method: 'DELETE',
  path: '/datasets/:datasetId/items/:itemId',
  responseType: 'json',
  pathParamSchema: datasetItemIdPathParams,
  responseSchema: deleteDatasetResponseSchema,
  summary: 'Archive dataset item',
  description: 'Archives (soft-deletes) an item from a dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, itemId }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      // Verify item belongs to this dataset
      const existing = await store.getDatasetItemById({ id: itemId });
      if (!existing) {
        throw new HTTPException(404, { message: `Dataset item not found: ${itemId}` });
      }
      if (existing.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Dataset item not found in dataset: ${datasetId}` });
      }

      await store.archiveDatasetItem({ id: itemId });
      return { success: true as const };
    } catch (error) {
      return handleError(error, 'Error archiving dataset item');
    }
  },
});

// ============================================================================
// Dataset Runs Routes
// ============================================================================

export const LIST_DATASET_RUNS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/runs',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  queryParamSchema: listDatasetRunsQuerySchema,
  responseSchema: listDatasetRunsResponseSchema,
  summary: 'List dataset runs',
  description: 'Returns a paginated list of evaluation runs for a dataset',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, page, perPage, status }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const result = await store.listDatasetRuns({
        options: {
          datasetId,
          status,
        },
        pagination,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing dataset runs');
    }
  },
});

export const CREATE_DATASET_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/datasets/:datasetId/runs',
  responseType: 'json',
  pathParamSchema: datasetIdPathParams,
  bodySchema: createDatasetRunBodySchema,
  responseSchema: datasetRunResponseSchema,
  summary: 'Create and execute a dataset run',
  description: 'Starts a dataset run asynchronously and returns immediately. Poll run status for progress.',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, agentId, name }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      // Verify dataset exists
      const dataset = await store.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Verify agent exists (use getAgentById since API returns agent.id, not registration key)
      const agent = mastra.getAgentById(agentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Agent not found: ${agentId}` });
      }

      // Start run asynchronously - returns immediately while processing in background
      const result = await mastra.runDatasetAsync({
        datasetId,
        name,
        target: { type: 'agent', agentId },
      });

      return { run: result.run };
    } catch (error) {
      return handleError(error, 'Error creating dataset run');
    }
  },
});

export const GET_DATASET_RUN_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/runs/:runId',
  responseType: 'json',
  pathParamSchema: datasetRunIdPathParams,
  responseSchema: datasetRunResponseSchema,
  summary: 'Get dataset run by ID',
  description: 'Returns details for a specific dataset run',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, runId }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      const run = await store.getDatasetRunById({ id: runId });
      if (!run) {
        throw new HTTPException(404, { message: `Dataset run not found: ${runId}` });
      }

      // Verify run belongs to this dataset
      if (run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Dataset run not found in dataset: ${datasetId}` });
      }

      return { run };
    } catch (error) {
      return handleError(error, 'Error getting dataset run');
    }
  },
});

export const LIST_DATASET_RUN_RESULTS_ROUTE = createRoute({
  method: 'GET',
  path: '/datasets/:datasetId/runs/:runId/results',
  responseType: 'json',
  pathParamSchema: datasetRunIdPathParams,
  queryParamSchema: listDatasetRunResultsQuerySchema,
  responseSchema: listDatasetRunResultsWithInputResponseSchema,
  summary: 'List results for a dataset run',
  description: 'Returns a paginated list of results for a specific dataset run, including item inputs',
  tags: ['Datasets'],
  handler: async ({ mastra, datasetId, runId, page, perPage, status }) => {
    try {
      const store = mastra.getDatasetsStore();
      if (!store) {
        throw new HTTPException(404, { message: 'Datasets storage not configured' });
      }

      // Verify run exists and belongs to this dataset
      const run = await store.getDatasetRunById({ id: runId });
      if (!run) {
        throw new HTTPException(404, { message: `Dataset run not found: ${runId}` });
      }
      if (run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Dataset run not found in dataset: ${datasetId}` });
      }

      const pagination: StoragePagination = {
        page: page ?? 0,
        perPage: perPage ?? 10,
      };

      const result = await store.listDatasetRunResults({ options: { runId, status }, pagination });

      // Fetch items to get inputs - include archived since items may have been archived after run
      const itemIds = result.results.map(r => r.itemId);
      const itemsResponse = await store.listDatasetItems({
        options: { datasetId, includeArchived: true },
        pagination: { page: 0, perPage: false },
      });
      const itemsMap = new Map(itemsResponse.items.map(item => [item.id, item]));

      // Enrich results with item inputs
      const resultsWithInput = result.results.map(r => ({
        ...r,
        itemInput: itemsMap.get(r.itemId)?.input ?? null,
      }));

      return {
        pagination: result.pagination,
        results: resultsWithInput,
      };
    } catch (error) {
      return handleError(error, 'Error listing dataset run results');
    }
  },
});
