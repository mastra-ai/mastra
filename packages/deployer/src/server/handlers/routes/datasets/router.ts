import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  createDatasetHandler,
  listDatasetsHandler,
  getDatasetByIdHandler,
  updateDatasetHandler,
  deleteDatasetHandler,
  listDatasetVersionsHandler,
  addDatasetRowsHandler,
  listDatasetRowsHandler,
  updateDatasetRowsHandler,
  deleteDatasetRowsHandler,
  getDatasetRowByIdHandler,
  listDatasetRowVersionsHandler,
} from './handlers';

export function datasetsRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  // Dataset Management Routes

  router.post(
    '/',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create a new dataset',
      tags: ['datasets'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Dataset name' },
                description: { type: 'string', description: 'Dataset description' },
                metadata: { type: 'object', description: 'Additional metadata' },
              },
              required: ['name'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Dataset created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  metadata: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' },
                  currentVersion: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      datasetId: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        500: { description: 'Internal server error' },
      },
    }),
    createDatasetHandler,
  );

  router.get(
    '/',
    describeRoute({
      description: 'Get all datasets with optional filtering and pagination',
      tags: ['datasets'],
      parameters: [
        {
          name: 'name',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Filter datasets by name',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 0 },
          description: 'Page number (0-indexed)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 10 },
          description: 'Number of datasets per page',
        },
      ],
      responses: {
        200: {
          description: 'List of datasets with pagination info',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  datasets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        metadata: { type: 'object' },
                        createdAt: { type: 'string', format: 'date-time' },
                        currentVersion: { type: 'object' },
                      },
                    },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      total: { type: 'number' },
                      page: { type: 'number' },
                      perPage: { type: 'number' },
                      hasMore: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        500: { description: 'Internal server error' },
      },
    }),
    listDatasetsHandler,
  );

  router.get(
    '/:datasetId',
    describeRoute({
      description: 'Get a dataset by ID',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
      ],
      responses: {
        200: {
          description: 'Dataset details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  metadata: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' },
                  currentVersion: { type: 'object' },
                },
              },
            },
          },
        },
        404: { description: 'Dataset not found' },
        500: { description: 'Internal server error' },
      },
    }),
    getDatasetByIdHandler,
  );

  router.put(
    '/:datasetId',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Update a dataset',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                metadata: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Dataset updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  metadata: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  currentVersion: { type: 'object' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        404: { description: 'Dataset not found' },
        500: { description: 'Internal server error' },
      },
    }),
    updateDatasetHandler,
  );

  router.delete(
    '/:datasetId',
    describeRoute({
      description: 'Delete a dataset and all its data',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
      ],
      responses: {
        200: {
          description: 'Dataset deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        404: { description: 'Dataset not found' },
        500: { description: 'Internal server error' },
      },
    }),
    deleteDatasetHandler,
  );

  // Dataset Version Routes

  router.get(
    '/:datasetId/versions',
    describeRoute({
      description: 'Get all versions for a dataset',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 0 },
          description: 'Page number (0-indexed)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 10 },
          description: 'Number of versions per page',
        },
      ],
      responses: {
        200: {
          description: 'List of dataset versions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  versions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        datasetId: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  pagination: { type: 'object' },
                },
              },
            },
          },
        },
        404: { description: 'Dataset not found' },
        500: { description: 'Internal server error' },
      },
    }),
    listDatasetVersionsHandler,
  );

  // Dataset Row Routes

  router.post(
    '/:datasetId/rows',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Add rows to a dataset',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      input: { description: 'Row input data' },
                      groundTruth: { description: 'Expected output (optional)' },
                      requestContext: { type: 'object', description: 'Request context (optional)' },
                      traceId: { type: 'string', description: 'Trace ID (optional)' },
                      spanId: { type: 'string', description: 'Span ID (optional)' },
                    },
                    required: ['input'],
                  },
                },
              },
              required: ['rows'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Rows added successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rows: {
                    type: 'array',
                    items: { type: 'object' },
                  },
                  versionId: { type: 'string' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        404: { description: 'Dataset not found' },
        500: { description: 'Internal server error' },
      },
    }),
    addDatasetRowsHandler,
  );

  router.get(
    '/:datasetId/rows',
    describeRoute({
      description: 'Get rows from a dataset',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
        {
          name: 'versionId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Version ID to get snapshot (optional, defaults to latest)',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 0 },
          description: 'Page number (0-indexed)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 10 },
          description: 'Number of rows per page',
        },
      ],
      responses: {
        200: {
          description: 'List of dataset rows',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rows: {
                    type: 'array',
                    items: { type: 'object' },
                  },
                  pagination: { type: 'object' },
                },
              },
            },
          },
        },
        404: { description: 'Dataset not found' },
        500: { description: 'Internal server error' },
      },
    }),
    listDatasetRowsHandler,
  );

  router.put(
    '/:datasetId/rows',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Update rows in a dataset',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                updates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      rowId: { type: 'string' },
                      input: { description: 'Updated input data (optional)' },
                      groundTruth: { description: 'Updated expected output (optional)' },
                      requestContext: { type: 'object', description: 'Updated request context (optional)' },
                      traceId: { type: 'string', description: 'Updated trace ID (optional)' },
                      spanId: { type: 'string', description: 'Updated span ID (optional)' },
                    },
                    required: ['rowId'],
                  },
                },
              },
              required: ['updates'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Rows updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rows: {
                    type: 'array',
                    items: { type: 'object' },
                  },
                  versionId: { type: 'string' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        404: { description: 'Dataset or rows not found' },
        500: { description: 'Internal server error' },
      },
    }),
    updateDatasetRowsHandler,
  );

  router.delete(
    '/:datasetId/rows',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Delete rows from a dataset (soft delete)',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                rowIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of row IDs to delete',
                },
              },
              required: ['rowIds'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Rows deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  versionId: { type: 'string' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        404: { description: 'Dataset or rows not found' },
        500: { description: 'Internal server error' },
      },
    }),
    deleteDatasetRowsHandler,
  );

  router.get(
    '/:datasetId/rows/:rowId',
    describeRoute({
      description: 'Get a specific row by ID',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
        {
          name: 'rowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Row ID',
        },
        {
          name: 'versionId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Version ID (optional, defaults to latest)',
        },
      ],
      responses: {
        200: {
          description: 'Row details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rowId: { type: 'string' },
                  datasetId: { type: 'string' },
                  versionId: { type: 'string' },
                  input: { description: 'Row input data' },
                  groundTruth: { description: 'Expected output' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        404: { description: 'Dataset or row not found' },
        500: { description: 'Internal server error' },
      },
    }),
    getDatasetRowByIdHandler,
  );

  router.get(
    '/:datasetId/rows/:rowId/versions',
    describeRoute({
      description: 'Get all versions of a specific row',
      tags: ['datasets'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
        {
          name: 'rowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Row ID',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 0 },
          description: 'Page number (0-indexed)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 10 },
          description: 'Number of versions per page',
        },
      ],
      responses: {
        200: {
          description: 'List of row versions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rows: {
                    type: 'array',
                    items: { type: 'object' },
                  },
                  pagination: { type: 'object' },
                },
              },
            },
          },
        },
        404: { description: 'Dataset or row not found' },
        500: { description: 'Internal server error' },
      },
    }),
    listDatasetRowVersionsHandler,
  );

  return router;
}
