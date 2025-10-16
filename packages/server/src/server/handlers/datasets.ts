import type {
  CreateDatasetPayload,
  UpdateDatasetPayload,
  AddDatasetRowsPayload,
  UpdateDatasetRowsPayload,
  DeleteDatasetRowsPayload,
  StoragePagination,
} from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';
import { Dataset, MastraScorer, runExperiment } from '@mastra/core/scores';

// Dataset Management Handlers

export async function createDatasetHandler({
  mastra,
  body,
}: Context & {
  body: CreateDatasetPayload;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ name: body.name });

    const dataset = await storage.createDataset(body);
    return dataset;
  } catch (error) {
    return handleError(error, 'Error creating dataset');
  }
}

export async function getDatasetsHandler({
  mastra,
  filter,
  pagination,
}: Context & {
  filter?: { name?: string };
  pagination?: StoragePagination;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    const result = await storage.getDatasets({ filter, pagination });
    return result;
  } catch (error) {
    return handleError(error, 'Error getting datasets');
  }
}

export async function getDatasetByIdHandler({
  mastra,
  datasetId,
}: Context & {
  datasetId: string;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ id: datasetId });

    const dataset = await storage.getDataset({ id: datasetId });
    return dataset;
  } catch (error) {
    return handleError(error, 'Error getting dataset');
  }
}

export async function updateDatasetHandler({
  mastra,
  datasetId,
  body,
}: Context & {
  datasetId: string;
  body: UpdateDatasetPayload;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ id: datasetId });

    const dataset = await storage.updateDataset({ id: datasetId, updates: body });
    return dataset;
  } catch (error) {
    return handleError(error, 'Error updating dataset');
  }
}

export async function deleteDatasetHandler({
  mastra,
  datasetId,
}: Context & {
  datasetId: string;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ id: datasetId });

    await storage.deleteDataset({ id: datasetId });
    return { message: 'Dataset deleted successfully' };
  } catch (error) {
    return handleError(error, 'Error deleting dataset');
  }
}

// Dataset Version Handlers

export async function getDatasetVersionsHandler({
  mastra,
  datasetId,
  pagination,
}: Context & {
  datasetId: string;
  pagination?: StoragePagination;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId });

    const result = await storage.getDatasetVersions({ datasetId, pagination });
    return result;
  } catch (error) {
    return handleError(error, 'Error getting dataset versions');
  }
}

// Dataset Row Handlers

export async function addDatasetRowsHandler({
  mastra,
  datasetId,
  body,
}: Context & {
  datasetId: string;
  body: Omit<AddDatasetRowsPayload, 'datasetId'>;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId, rows: body.rows });

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      throw new HTTPException(400, { message: 'Rows must be a non-empty array' });
    }

    const result = await storage.addDatasetRows({ datasetId, rows: body.rows });
    return result;
  } catch (error) {
    return handleError(error, 'Error adding dataset rows');
  }
}

export async function getDatasetRowsHandler({
  mastra,
  datasetId,
  versionId,
  pagination,
}: Context & {
  datasetId: string;
  versionId?: string;
  pagination?: StoragePagination;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId });

    const result = await storage.getDatasetRows({ datasetId, versionId, pagination });
    return result;
  } catch (error) {
    return handleError(error, 'Error getting dataset rows');
  }
}

export async function updateDatasetRowsHandler({
  mastra,
  datasetId,
  body,
}: Context & {
  datasetId: string;
  body: Omit<UpdateDatasetRowsPayload, 'datasetId'>;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId, updates: body.updates });

    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      throw new HTTPException(400, { message: 'Updates must be a non-empty array' });
    }

    const result = await storage.updateDatasetRows({ datasetId, updates: body.updates });
    return result;
  } catch (error) {
    return handleError(error, 'Error updating dataset rows');
  }
}

export async function deleteDatasetRowsHandler({
  mastra,
  datasetId,
  body,
}: Context & {
  datasetId: string;
  body: Omit<DeleteDatasetRowsPayload, 'datasetId'>;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId, rowIds: body.rowIds });

    if (!Array.isArray(body.rowIds) || body.rowIds.length === 0) {
      throw new HTTPException(400, { message: 'Row IDs must be a non-empty array' });
    }

    const result = await storage.deleteDatasetRows({ datasetId, rowIds: body.rowIds });
    return result;
  } catch (error) {
    return handleError(error, 'Error deleting dataset rows');
  }
}

export async function getDatasetRowByIdHandler({
  mastra,
  datasetId,
  rowId,
  versionId,
}: Context & {
  datasetId: string;
  rowId: string;
  versionId?: string;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId, rowId });

    const row = await storage.getDatasetRowByRowId({ rowId, versionId });

    // Verify the row belongs to the specified dataset
    if (row.datasetId !== datasetId) {
      throw new HTTPException(404, { message: 'Row not found in specified dataset' });
    }

    return row;
  } catch (error) {
    return handleError(error, 'Error getting dataset row');
  }
}

export async function getDatasetRowVersionsHandler({
  mastra,
  datasetId,
  rowId,
  pagination,
}: Context & {
  datasetId: string;
  rowId: string;
  pagination?: StoragePagination;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId, rowId });

    const result = await storage.getDatasetRowVersionsByRowId({ rowId, pagination });

    // Verify all returned rows belong to the specified dataset
    const invalidRows = result.rows.filter(row => row.datasetId !== datasetId);
    if (invalidRows.length > 0) {
      throw new HTTPException(404, { message: 'Row not found in specified dataset' });
    }

    return result;
  } catch (error) {
    return handleError(error, 'Error getting dataset row versions');
  }
}

// Experiment Handlers

export async function getDatasetExperimentsHandler({
  mastra,
  datasetId,
  // filter,
  pagination,
}: Context & {
  datasetId: string;
  // filter?: {
  //   targetType?: 'agent' | 'workflow';
  //   targetId?: string;
  //   status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  // };
  pagination?: StoragePagination;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId });

    const result = await storage.getExperiments({
      filter: { datasetId },
      pagination,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error getting experiments');
  }
}

export async function getExperimentResultsHandler({
  mastra,
  experimentId,
  pagination,
}: Context & {
  experimentId: string;
  pagination?: StoragePagination;
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ experimentId });

    const result = await storage.getExperimentRowResults({
      experimentId,
      pagination,
    });

    return result;
  } catch (error) {
    return handleError(error, 'Error getting experiment results');
  }
}

export async function runExperimentHandler({
  mastra,
  datasetId,
  body,
}: Context & {
  datasetId: string;
  body: {
    targetType: 'agent' | 'workflow';
    targetId: string;
    datasetId: string;
    datasetVersionId?: string;
    concurrency?: number;
    scorerNames?: string[];
  };
}) {
  try {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    validateBody({ datasetId, targetType: body.targetType, targetId: body.targetId });

    // Get the dataset to retrieve the current version if not specified
    const dataset = await storage.getDataset({ id: datasetId });
    const datasetVersionId = body.datasetVersionId || dataset.currentVersion.id;

    let scorers: MastraScorer<any, any, any, any>[] = [];
    if (body.scorerNames) {
      scorers = body.scorerNames.map(name => mastra.getScorerByName(name));
    }

    const scorersConfig: Record<string, { type: 'automatic' }> = {};
    for (const scorer of scorers) {
      scorersConfig[scorer.name] = { type: 'automatic' };
    }

    const experiment = await storage.createExperiment({
      datasetId,
      datasetVersionId,
      targetType: body.targetType,
      targetId: body.targetId,
      concurrency: body.concurrency,
      scorers: scorers.length > 0 ? scorersConfig : undefined,
    });

    const datasetObj = new Dataset(datasetId, storage);
    console.log('what are scorers', JSON.stringify(scorers, null, 2));
    console.log('what are scorers config', JSON.stringify(scorersConfig, null, 2));
    console.log('what are scorers names', JSON.stringify(body.scorerNames, null, 2));

    // Fire and forget - run experiment in background
    (async () => {
      try {
        // Update status to running
        await storage.updateExperiment({
          id: experiment.id,
          updates: { status: 'running' },
        });

        const target =
          body.targetType === 'agent' ? mastra.getAgentById(body.targetId) : mastra.getWorkflowById(body.targetId);

        const result = await runExperiment({
          data: datasetObj,
          target: target as any,
          concurrency: body.concurrency,
          scorers: scorers.length > 0 ? scorers : undefined,
          experimentTracking: {
            experimentId: experiment.id,
            storage: storage,
          },
        });

        // Update experiment with results
        await storage.updateExperiment({
          id: experiment.id,
          updates: {
            status: 'completed',
            totalItems: result.summary.totalItems,
            averageScores: result.scores,
            completedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`Error running experiment ${experiment.id}:`, error);

        // Mark experiment as failed
        await storage
          .updateExperiment({
            id: experiment.id,
            updates: {
              status: 'failed',
              completedAt: new Date(),
            },
          })
          .catch(updateError => {
            console.error(`Failed to update experiment status:`, updateError);
          });
      } finally {
        await storage.updateExperiment({
          id: experiment.id,
          updates: { status: 'completed' },
        });
      }
    })();

    return experiment;
  } catch (error) {
    return handleError(error, 'Error creating experiment');
  }
}
