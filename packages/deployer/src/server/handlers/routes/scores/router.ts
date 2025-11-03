import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  listScorersHandler,
  getScorerHandler,
  listScoresByRunIdHandler,
  listScoresByScorerIdHandler,
  listScoresByEntityIdHandler,
  saveScoreHandler,
} from './handlers';

export function scoresRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  // Scores routes
  router.get(
    '/scorers',
    describeRoute({
      description: 'Get all scorers',
      tags: ['scores'],
      responses: {
        200: {
          description: 'List of all scorers',
        },
      },
    }),
    listScorersHandler,
  );

  router.get(
    '/scorers/:scorerId',
    describeRoute({
      description: 'Get a scorer by ID',
      tags: ['scores'],
      responses: {
        200: {
          description: 'Scorer details',
        },
      },
    }),
    getScorerHandler,
  );

  router.get(
    '/run/:runId',
    describeRoute({
      description: 'Get scores by run ID',
      tags: ['scores'],
      parameters: [
        {
          name: 'runId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Page number for pagination (default: 0)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Number of items per page (default: 10)',
        },
      ],
      responses: {
        200: {
          description: 'Paginated list of scores for run ID',
        },
      },
    }),
    listScoresByRunIdHandler,
  );

  router.get(
    '/scorer/:scorerId',
    describeRoute({
      description: 'Get scores by scorer ID',
      tags: ['scores'],
      parameters: [
        {
          name: 'scorerId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Page number for pagination (default: 0)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Number of items per page (default: 10)',
        },
      ],
      responses: {
        200: {
          description: 'Paginated list of scores for run ID',
        },
      },
    }),
    listScoresByScorerIdHandler,
  );

  router.get(
    '/entity/:entityType/:entityId',
    describeRoute({
      description: 'Get scores by entity ID and type',
      tags: ['scores'],
      parameters: [
        {
          name: 'entityType',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Type of entity (e.g., agent, workflow, tool)',
        },
        {
          name: 'entityId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the entity',
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Page number for pagination (default: 0)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Number of items per page (default: 10)',
        },
      ],
      responses: {
        200: {
          description: 'Paginated list of scores for entity',
        },
      },
    }),
    listScoresByEntityIdHandler,
  );

  router.post(
    '/',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Save a score',
      tags: ['scores'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                runId: { type: 'string' },
                scorer: { type: 'object' },
                result: { type: 'object' },
                input: { type: 'object' },
                output: { type: 'object' },
                source: { type: 'string' },
                entityType: { type: 'string' },
                entity: { type: 'object' },
                metadata: { type: 'object' },
                additionalLLMContext: { type: 'object' },
                requestContext: { type: 'object' },
                resourceId: { type: 'string' },
                threadId: { type: 'string' },
                traceId: { type: 'string' },
              },
              required: ['id', 'runId', 'scorer', 'result', 'input', 'output', 'source'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Score saved successfully',
        },
        400: {
          description: 'Invalid score data',
        },
      },
    }),
    saveScoreHandler,
  );

  return router;
}
