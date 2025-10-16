import type { Mastra } from '@mastra/core';
import type { StoragePagination } from '@mastra/core/storage';
import {
  createDatasetHandler as getOriginalCreateDatasetHandler,
  getDatasetsHandler as getOriginalGetDatasetsHandler,
  getDatasetByIdHandler as getOriginalGetDatasetByIdHandler,
  updateDatasetHandler as getOriginalUpdateDatasetHandler,
  deleteDatasetHandler as getOriginalDeleteDatasetHandler,
  getDatasetVersionsHandler as getOriginalGetDatasetVersionsHandler,
  addDatasetRowsHandler as getOriginalAddDatasetRowsHandler,
  getDatasetRowsHandler as getOriginalGetDatasetRowsHandler,
  updateDatasetRowsHandler as getOriginalUpdateDatasetRowsHandler,
  deleteDatasetRowsHandler as getOriginalDeleteDatasetRowsHandler,
  getDatasetRowByIdHandler as getOriginalGetDatasetRowByIdHandler,
  getDatasetRowVersionsHandler as getOriginalGetDatasetRowVersionsHandler,
  getDatasetExperimentsHandler as getOriginalGetDatasetExperimentsHandler,
  getExperimentResultsHandler as getOriginalGetExperimentResultsHandler,
  runExperimentHandler as getOriginalRunExperimentHandler,
} from '@mastra/server/handlers/datasets';
import type { Context } from 'hono';

import { handleError } from '../../error';

// Dataset Management Handlers

export async function createDatasetHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const body = await c.req.json();

    const result = await getOriginalCreateDatasetHandler({
      mastra,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error creating dataset');
  }
}

export async function getDatasetsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const name = c.req.query('name');
    const page = c.req.query('page');
    const perPage = c.req.query('perPage');

    const filter = name ? { name } : undefined;
    const pagination: StoragePagination | undefined =
      page !== undefined || perPage !== undefined
        ? {
            page: page ? parseInt(page, 10) : 0,
            perPage: perPage ? parseInt(perPage, 10) : 10,
          }
        : undefined;

    const result = await getOriginalGetDatasetsHandler({
      mastra,
      filter,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting datasets');
  }
}

export async function getDatasetByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');

    const result = await getOriginalGetDatasetByIdHandler({
      mastra,
      datasetId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting dataset');
  }
}

export async function updateDatasetHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();

    const result = await getOriginalUpdateDatasetHandler({
      mastra,
      datasetId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error updating dataset');
  }
}

export async function deleteDatasetHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');

    const result = await getOriginalDeleteDatasetHandler({
      mastra,
      datasetId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error deleting dataset');
  }
}

// Dataset Version Handlers

export async function getDatasetVersionsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const page = c.req.query('page');
    const perPage = c.req.query('perPage');

    const pagination: StoragePagination | undefined =
      page !== undefined || perPage !== undefined
        ? {
            page: page ? parseInt(page, 10) : 0,
            perPage: perPage ? parseInt(perPage, 10) : 10,
          }
        : undefined;

    const result = await getOriginalGetDatasetVersionsHandler({
      mastra,
      datasetId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting dataset versions');
  }
}

// Dataset Row Handlers

export async function addDatasetRowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();

    const result = await getOriginalAddDatasetRowsHandler({
      mastra,
      datasetId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error adding dataset rows');
  }
}

export async function getDatasetRowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const versionId = c.req.query('versionId');
    const page = c.req.query('page');
    const perPage = c.req.query('perPage');

    const pagination: StoragePagination | undefined =
      page !== undefined || perPage !== undefined
        ? {
            page: page ? parseInt(page, 10) : 0,
            perPage: perPage ? parseInt(perPage, 10) : 10,
          }
        : undefined;

    const result = await getOriginalGetDatasetRowsHandler({
      mastra,
      datasetId,
      versionId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting dataset rows');
  }
}

export async function updateDatasetRowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();

    const result = await getOriginalUpdateDatasetRowsHandler({
      mastra,
      datasetId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error updating dataset rows');
  }
}

export async function deleteDatasetRowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();

    const result = await getOriginalDeleteDatasetRowsHandler({
      mastra,
      datasetId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error deleting dataset rows');
  }
}

export async function getDatasetRowByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const rowId = c.req.param('rowId');
    const versionId = c.req.query('versionId');

    const result = await getOriginalGetDatasetRowByIdHandler({
      mastra,
      datasetId,
      rowId,
      versionId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting dataset row');
  }
}

export async function getDatasetRowVersionsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const rowId = c.req.param('rowId');
    const page = c.req.query('page');
    const perPage = c.req.query('perPage');

    const pagination: StoragePagination | undefined =
      page !== undefined || perPage !== undefined
        ? {
            page: page ? parseInt(page, 10) : 0,
            perPage: perPage ? parseInt(perPage, 10) : 10,
          }
        : undefined;

    const result = await getOriginalGetDatasetRowVersionsHandler({
      mastra,
      datasetId,
      rowId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting dataset row versions');
  }
}

// Experiment Handlers

export async function getDatasetExperimentsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const page = c.req.query('page');
    const perPage = c.req.query('perPage');

    const pagination: StoragePagination | undefined =
      page !== undefined || perPage !== undefined
        ? {
            page: page ? parseInt(page, 10) : 0,
            perPage: perPage ? parseInt(perPage, 10) : 10,
          }
        : undefined;

    const result = await getOriginalGetDatasetExperimentsHandler({
      mastra,
      datasetId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting experiments');
  }
}

export async function getExperimentResultsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const experimentId = c.req.param('experimentId');
    const page = c.req.query('page');
    const perPage = c.req.query('perPage');

    const pagination: StoragePagination | undefined =
      page !== undefined || perPage !== undefined
        ? {
            page: page ? parseInt(page, 10) : 0,
            perPage: perPage ? parseInt(perPage, 10) : 10,
          }
        : undefined;

    const result = await getOriginalGetExperimentResultsHandler({
      mastra,
      experimentId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting experiment results');
  }
}

export async function runExperimentHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const body = await c.req.json();

    const result = await getOriginalRunExperimentHandler({
      mastra,
      datasetId,
      body,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error running experiment');
  }
}
