import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  createDatasetHandler,
  getDatasetsHandler,
  getDatasetByIdHandler,
  updateDatasetHandler,
  deleteDatasetHandler,
  getDatasetVersionsHandler,
  addDatasetRowsHandler,
  getDatasetRowsHandler,
  updateDatasetRowsHandler,
  deleteDatasetRowsHandler,
  getDatasetRowByIdHandler,
  getDatasetRowVersionsHandler,
  getDatasetExperimentsHandler,
  getExperimentResultsHandler,
  runExperimentHandler,
} from './handlers';

export function datasetsRoutes(bodyLimitOptions: BodyLimitOptions) {
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
    getDatasetsHandler,
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
    getDatasetVersionsHandler,
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
                      runtimeContext: { type: 'object', description: 'Runtime context (optional)' },
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
    getDatasetRowsHandler,
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
                      runtimeContext: { type: 'object', description: 'Updated runtime context (optional)' },
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
    getDatasetRowVersionsHandler,
  );

  // Experiment Routes

  router.get(
    '/:datasetId/experiments',
    describeRoute({
      description: 'Get all experiments for a dataset',
      tags: ['datasets', 'experiments'],
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
          description: 'Number of experiments per page',
        },
      ],
      responses: {
        200: {
          description: 'List of experiments',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  experiments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        datasetId: { type: 'string' },
                        datasetVersionId: { type: 'string' },
                        targetType: { type: 'string', enum: ['agent', 'workflow'] },
                        targetId: { type: 'string' },
                        status: {
                          type: 'string',
                          enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
                        },
                        concurrency: { type: 'number' },
                        totalItems: { type: 'number' },
                        averageScores: { type: 'object' },
                        scorers: { type: 'object' },
                        createdAt: { type: 'string', format: 'date-time' },
                        completedAt: { type: 'string', format: 'date-time' },
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
        404: { description: 'Dataset not found' },
        500: { description: 'Internal server error' },
      },
    }),
    getDatasetExperimentsHandler,
  );

  router.post(
    '/:datasetId/experiments',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Run an experiment on a dataset',
      tags: ['datasets', 'experiments'],
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
                targetType: {
                  type: 'string',
                  enum: ['agent', 'workflow'],
                  description: 'Type of target to run (agent or workflow)',
                },
                targetId: {
                  type: 'string',
                  description: 'ID of the agent or workflow to run',
                },
                datasetVersionId: {
                  type: 'string',
                  description: 'Specific dataset version to use (optional, defaults to current version)',
                },
                concurrency: {
                  type: 'number',
                  description: 'Number of concurrent executions (optional, defaults to 1)',
                },
                scorerNames: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Names of scorers to use for evaluation (optional)',
                },
              },
              required: ['targetType', 'targetId'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Experiment created and started in background',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Experiment ID' },
                  datasetId: { type: 'string' },
                  datasetVersionId: { type: 'string' },
                  targetType: { type: 'string', enum: ['agent', 'workflow'] },
                  targetId: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
                    description: 'Current status of the experiment',
                  },
                  concurrency: { type: 'number' },
                  scorers: {
                    type: 'object',
                    description: 'Scorers being used in the experiment',
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        404: { description: 'Dataset, agent, or workflow not found' },
        500: { description: 'Internal server error' },
      },
    }),
    runExperimentHandler,
  );

  router.get(
    '/:datasetId/experiments/:experimentId/results',
    describeRoute({
      description: 'Get results for a specific experiment',
      tags: ['datasets', 'experiments'],
      parameters: [
        {
          name: 'datasetId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Dataset ID',
        },
        {
          name: 'experimentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Experiment ID',
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
          description: 'Number of results per page',
        },
      ],
      responses: {
        200: {
          description: 'List of experiment row results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        experimentId: { type: 'string' },
                        rowId: { type: 'string' },
                        input: { description: 'Input data for the experiment row' },
                        output: { description: 'Output data from the experiment' },
                        groundTruth: { description: 'Expected output' },
                        scores: {
                          type: 'object',
                          description: 'Scores for this row',
                        },
                        error: { type: 'string', description: 'Error message if execution failed' },
                        createdAt: { type: 'string', format: 'date-time' },
                        comments: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              text: { type: 'string' },
                              createdAt: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
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
        404: { description: 'Experiment not found' },
        500: { description: 'Internal server error' },
      },
    }),
    getExperimentResultsHandler,
  );

  return router;
}
