import type { Mastra } from '@mastra/core';
import type { StoragePagination } from '@mastra/core/storage';
import {
  createDatasetHandler as getOriginalCreateDatasetHandler,
  listDatasetsHandler as getOriginalListDatasetsHandler,
  getDatasetByIdHandler as getOriginalGetDatasetByIdHandler,
  updateDatasetHandler as getOriginalUpdateDatasetHandler,
  deleteDatasetHandler as getOriginalDeleteDatasetHandler,
  listDatasetVersionsHandler as getOriginalListDatasetVersionsHandler,
  addDatasetRowsHandler as getOriginalAddDatasetRowsHandler,
  listDatasetRowsHandler as getOriginalListDatasetRowsHandler,
  updateDatasetRowsHandler as getOriginalUpdateDatasetRowsHandler,
  deleteDatasetRowsHandler as getOriginalDeleteDatasetRowsHandler,
  getDatasetRowByIdHandler as getOriginalGetDatasetRowByIdHandler,
  listDatasetRowVersionsHandler as getOriginalListDatasetRowVersionsHandler,
} from '@mastra/server/handlers/datasets';
import type { Context } from 'hono';

import { handleError } from '../../error';
import { parsePage, parsePerPage } from '../../utils/query-parsers';

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

export async function listDatasetsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const name = c.req.query('name');
    const page = parsePage(c.req.query('page'));
    const perPage = parsePerPage(c.req.query('perPage'), 10);

    const filter = name ? { name } : undefined;
    const pagination: StoragePagination = { page, perPage };

    const result = await getOriginalListDatasetsHandler({
      mastra,
      filter,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error listing datasets');
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

export async function listDatasetVersionsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const page = parsePage(c.req.query('page'));
    const perPage = parsePerPage(c.req.query('perPage'), 10);

    const pagination: StoragePagination = { page, perPage };

    const result = await getOriginalListDatasetVersionsHandler({
      mastra,
      datasetId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error listing dataset versions');
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

export async function listDatasetRowsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const versionId = c.req.query('versionId');
    const page = parsePage(c.req.query('page'));
    const perPage = parsePerPage(c.req.query('perPage'), 10);

    const pagination: StoragePagination = { page, perPage };

    const result = await getOriginalListDatasetRowsHandler({
      mastra,
      datasetId,
      versionId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error listing dataset rows');
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

export async function listDatasetRowVersionsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const datasetId = c.req.param('datasetId');
    const rowId = c.req.param('rowId');
    const page = parsePage(c.req.query('page'));
    const perPage = parsePerPage(c.req.query('perPage'), 10);

    const pagination: StoragePagination = { page, perPage };

    const result = await getOriginalListDatasetRowVersionsHandler({
      mastra,
      datasetId,
      rowId,
      pagination,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error listing dataset row versions');
  }
}
