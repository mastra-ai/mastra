import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import { createIndex, deleteIndex, describeIndex, listIndexes, queryVectors, upsertVectors } from './handlers';

export function vectorRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.post(
    '/:vectorName/upsert',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Upsert vectors into an index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
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
              properties: {
                indexName: { type: 'string' },
                vectors: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
                metadata: {
                  type: 'array',
                  items: { type: 'object' },
                },
                ids: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['indexName', 'vectors'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Vectors upserted successfully',
        },
      },
    }),
    upsertVectors,
  );

  router.post(
    '/:vectorName/create-index',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create a new vector index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
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
              properties: {
                indexName: { type: 'string' },
                dimension: { type: 'number' },
                metric: {
                  type: 'string',
                  enum: ['cosine', 'euclidean', 'dotproduct'],
                },
              },
              required: ['indexName', 'dimension'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Index created successfully',
        },
      },
    }),
    createIndex,
  );

  router.post(
    '/:vectorName/query',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Query vectors from an index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
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
              properties: {
                indexName: { type: 'string' },
                queryVector: {
                  type: 'array',
                  items: { type: 'number' },
                },
                topK: { type: 'number' },
                filter: { type: 'object' },
                includeVector: { type: 'boolean' },
              },
              required: ['indexName', 'queryVector'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Query results',
        },
      },
    }),
    queryVectors,
  );

  router.get(
    '/:vectorName/indexes',
    describeRoute({
      description: 'List all indexes for a vector store',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of indexes',
        },
      },
    }),
    listIndexes,
  );

  router.get(
    '/:vectorName/indexes/:indexName',
    describeRoute({
      description: 'Get details about a specific index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'indexName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Index details',
        },
      },
    }),
    describeIndex,
  );

  router.delete(
    '/:vectorName/indexes/:indexName',
    describeRoute({
      description: 'Delete a specific index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'indexName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Index deleted successfully',
        },
      },
    }),
    deleteIndex,
  );

  return router;
}
