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

export async function listDatasetsHandler({
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

    const result = await storage.listDatasets({ filter, pagination });
    return result;
  } catch (error) {
    return handleError(error, 'Error listing datasets');
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

export async function listDatasetVersionsHandler({
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

    const result = await storage.listDatasetVersions({ datasetId, pagination });
    return result;
  } catch (error) {
    return handleError(error, 'Error listing dataset versions');
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

export async function listDatasetRowsHandler({
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

    const result = await storage.listDatasetRows({ datasetId, versionId, pagination });
    return result;
  } catch (error) {
    return handleError(error, 'Error listing dataset rows');
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

export async function listDatasetRowVersionsHandler({
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

    const result = await storage.listDatasetRowVersionsByRowId({ rowId, pagination });

    // Verify all returned rows belong to the specified dataset
    const invalidRows = result.rows.filter(row => row.datasetId !== datasetId);
    if (invalidRows.length > 0) {
      throw new HTTPException(404, { message: 'Row not found in specified dataset' });
    }

    return result;
  } catch (error) {
    return handleError(error, 'Error listing dataset row versions');
  }
}
