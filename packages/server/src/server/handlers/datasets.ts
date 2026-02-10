import {
  runExperiment,
  compareExperiments,
  SchemaValidationError,
  SchemaUpdateValidationError,
} from '@mastra/core/datasets';
import type { StoragePagination } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
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
      // Cast JSONSchema7 to Record<string, unknown> for response schema compatibility
      return {
        datasets: result.datasets as any,
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
      const { name, description, metadata, inputSchema, groundTruthSchema } = params as {
        name: string;
        description?: string;
        metadata?: Record<string, unknown>;
        inputSchema?: Record<string, unknown> | null;
        groundTruthSchema?: Record<string, unknown> | null;
      };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      const dataset = await datasetsStore.createDataset({
        name,
        description,
        metadata,
        inputSchema: inputSchema as any,
        groundTruthSchema: groundTruthSchema as any,
      });
      // Cast JSONSchema7 to Record<string, unknown> for response schema compatibility
      return dataset as any;
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

      // Cast JSONSchema7 to Record<string, unknown> for response schema compatibility
      return dataset as any;
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
      const { name, description, metadata, inputSchema, groundTruthSchema } = params as {
        name?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        inputSchema?: Record<string, unknown> | null;
        groundTruthSchema?: Record<string, unknown> | null;
      };

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const existing = await datasetsStore.getDatasetById({ id: datasetId });
      if (!existing) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      const dataset = await datasetsStore.updateDataset({
        id: datasetId,
        name,
        description,
        metadata,
        inputSchema: inputSchema as any,
        groundTruthSchema: groundTruthSchema as any,
      });
      // Cast JSONSchema7 to Record<string, unknown> for response schema compatibility
      return dataset as any;
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
      const { page, perPage, version, search } = params;
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
        search,
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
      const { input, groundTruth, metadata } = params as {
        input: unknown;
        groundTruth?: unknown;
        metadata?: Record<string, unknown>;
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

      const item = await datasetsStore.addItem({ datasetId, input, groundTruth, metadata });
      return item;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
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
      const { input, groundTruth, metadata } = params as {
        input?: unknown;
        groundTruth?: unknown;
        metadata?: Record<string, unknown>;
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

      // Check if item exists
      const existing = await datasetsStore.getItemById({ id: itemId });
      if (!existing || existing.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found: ${itemId}` });
      }

      const item = await datasetsStore.updateItem({ id: itemId, datasetId, input, groundTruth, metadata });
      return item;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
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
        experiments: result.runs,
        pagination: result.pagination,
      };
    } catch (error) {
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

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      const runsStore = await mastra.getStorage()?.getStore('runs');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }
      if (!runsStore) {
        throw new HTTPException(500, { message: 'Runs storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Get items differently based on whether version is specified
      // - No version: use current items from live table
      // - Version specified: use historical snapshot
      let items: Awaited<ReturnType<typeof datasetsStore.getItemsByVersion>>;
      let datasetVersion: Date;

      if (version instanceof Date) {
        // Historical version - fetch from version snapshots
        datasetVersion = version;
        items = await datasetsStore.getItemsByVersion({
          datasetId,
          version: datasetVersion,
        });
      } else {
        // Latest version - fetch current items from live table
        datasetVersion = dataset.version;
        const result = await datasetsStore.listItems({
          datasetId,
          pagination: { page: 0, perPage: false }, // Get all items
        });
        items = result.items;
      }

      if (items.length === 0) {
        throw new HTTPException(400, {
          message: version
            ? `No items in dataset ${datasetId} at version ${datasetVersion.toISOString()}`
            : `No items in dataset ${datasetId}`,
        });
      }

      // Create run record with 'pending' status BEFORE spawning execution
      const runId = crypto.randomUUID();
      const createdAt = new Date();

      await runsStore.createRun({
        id: runId,
        datasetId,
        datasetVersion,
        targetType,
        targetId,
        totalItems: items.length,
      });

      // Spawn runExperiment() without await - fire and forget
      // The runExperiment function will update run status to 'running' then 'completed'/'failed'
      void (async () => {
        try {
          await runExperiment(mastra, {
            datasetId,
            targetType,
            targetId,
            scorers: scorerIds,
            // Only pass version for historical runs - latest uses current items
            version: version instanceof Date ? version : undefined,
            maxConcurrency,
            experimentId: runId, // Pass pre-created experimentId to avoid duplicate creation
          });
        } catch (err) {
          // Log error and update run status to failed
          console.error(`[runExperiment] Background execution failed for experiment ${runId}:`, err);
          try {
            await runsStore.updateRun({
              id: runId,
              status: 'failed',
              completedAt: new Date(),
            });
          } catch (updateErr) {
            console.error(`[runExperiment] Failed to update run status to failed:`, updateErr);
          }
        }
      })();

      // Return immediately with pending status
      return {
        experimentId: runId,
        status: 'pending' as const,
        totalItems: items.length,
        succeededCount: 0,
        failedCount: 0,
        startedAt: createdAt,
        completedAt: null,
        results: [],
      };
    } catch (error) {
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

      const run = await runsStore.getRunById({ id: experimentId });
      if (!run || run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Experiment not found: ${experimentId}` });
      }

      return run;
    } catch (error) {
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

      // Check if experiment exists and belongs to dataset
      const run = await runsStore.getRunById({ id: experimentId });
      if (!run || run.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Experiment not found: ${experimentId}` });
      }

      const result = await runsStore.listResults({ runId: experimentId, pagination });
      return {
        results: result.results.map(({ runId: experimentId, ...rest }) => ({ experimentId, ...rest })),
        pagination: result.pagination,
      };
    } catch (error) {
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
      const { experimentIdA, experimentIdB, thresholds } = params as {
        experimentIdA: string;
        experimentIdB: string;
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

      // Validate both experiments belong to the dataset (or warn)
      const [runA, runB] = await Promise.all([
        runsStore.getRunById({ id: experimentIdA }),
        runsStore.getRunById({ id: experimentIdB }),
      ]);

      if (!runA) {
        throw new HTTPException(404, { message: `Experiment A not found: ${experimentIdA}` });
      }
      if (!runB) {
        throw new HTTPException(404, { message: `Experiment B not found: ${experimentIdB}` });
      }

      // Compare experiments
      const result = await compareExperiments(mastra, {
        runIdA: experimentIdA,
        runIdB: experimentIdB,
        thresholds,
      });

      // Add warning if experiments are from different datasets
      if (runA.datasetId !== datasetId || runB.datasetId !== datasetId) {
        result.warnings.push('One or both experiments belong to a different dataset than the comparison endpoint');
      }

      return result;
    } catch (error) {
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

      const result = await datasetsStore.listDatasetVersions({
        datasetId,
        pagination,
      });

      return {
        versions: result.versions,
        pagination: result.pagination,
      };
    } catch (error) {
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

      // Get versions directly - don't require item to exist (may be deleted)
      // Versions include tombstone records for deleted items
      const result = await datasetsStore.listItemVersions({
        itemId,
        pagination,
      });

      // Check versions belong to this dataset (first version check)
      if (result.versions.length > 0 && result.versions[0]?.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found in dataset: ${itemId}` });
      }

      return {
        versions: result.versions,
        pagination: result.pagination,
      };
    } catch (error) {
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
      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      // Get version directly - don't require item to exist (may be deleted)
      const version = await datasetsStore.getItemVersion(itemId, versionNumber);
      if (!version) {
        throw new HTTPException(404, { message: `Version ${versionNumber} not found for item: ${itemId}` });
      }

      // Check version belongs to this dataset
      if (version.datasetId !== datasetId) {
        throw new HTTPException(404, { message: `Item not found in dataset: ${itemId}` });
      }

      return version;
    } catch (error) {
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
        items: Array<{
          input: unknown;
          groundTruth?: unknown;
          metadata?: Record<string, unknown>;
        }>;
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

      const addedItems = await datasetsStore.bulkAddItems({
        datasetId,
        items,
      });

      return {
        items: addedItems,
        count: addedItems.length,
      };
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw new HTTPException(400, {
          message: error.message,
          cause: { field: error.field, errors: error.errors },
        });
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

      const datasetsStore = await mastra.getStorage()?.getStore('datasets');
      if (!datasetsStore) {
        throw new HTTPException(500, { message: 'Datasets storage not configured' });
      }

      // Check if dataset exists
      const dataset = await datasetsStore.getDatasetById({ id: datasetId });
      if (!dataset) {
        throw new HTTPException(404, { message: `Dataset not found: ${datasetId}` });
      }

      await datasetsStore.bulkDeleteItems({
        datasetId,
        itemIds,
      });

      return {
        success: true,
        deletedCount: itemIds.length,
      };
    } catch (error) {
      return handleError(error, 'Error bulk deleting items');
    }
  },
});
