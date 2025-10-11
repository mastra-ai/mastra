import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  getTablesHandler,
  getTableDataHandler,
  getRecordHandler,
  updateRecordHandler,
  deleteRecordHandler,
  queryTableHandler,
} from './handlers';

export function storageRoutes(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.get(
    '/tables',
    describeRoute({
      description: 'Get list of available storage tables',
      tags: ['storage'],
      responses: {
        200: {
          description: 'List of tables',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tables: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        label: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getTablesHandler,
  );

  router.get(
    '/tables/:tableName/data',
    describeRoute({
      description: 'Get data from a specific table',
      tags: ['storage'],
      parameters: [
        {
          name: 'tableName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 0 },
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 50 },
        },
        {
          name: 'search',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Table data with pagination',
        },
      },
    }),
    getTableDataHandler,
  );

  router.post(
    '/tables/:tableName/record',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Get a single record by keys',
      tags: ['storage'],
      parameters: [
        {
          name: 'tableName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'Keys to identify the record',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Record data',
        },
        404: {
          description: 'Record not found',
        },
      },
    }),
    getRecordHandler,
  );

  router.put(
    '/tables/:tableName/record',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Update a record in the table',
      tags: ['storage'],
      parameters: [
        {
          name: 'tableName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'Record data to update',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Record updated successfully',
        },
      },
    }),
    updateRecordHandler,
  );

  router.delete(
    '/tables/:tableName/record',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Delete a record from the table',
      tags: ['storage'],
      parameters: [
        {
          name: 'tableName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'Keys to identify the record to delete',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Record deleted successfully',
        },
      },
    }),
    deleteRecordHandler,
  );

  router.get(
    '/tables/:tableName/query',
    describeRoute({
      description: 'Query table with flexible filtering',
      tags: ['storage'],
      parameters: [
        {
          name: 'tableName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'query',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'JSON-encoded query parameters',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 0 },
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number', default: 50 },
        },
      ],
      responses: {
        200: {
          description: 'Query results',
        },
      },
    }),
    queryTableHandler,
  );

  return router;
}
